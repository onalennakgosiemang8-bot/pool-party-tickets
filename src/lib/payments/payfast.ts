import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '../env';
import { safeEqual } from '../crypto';
import type {
  CheckoutRedirect,
  CheckoutRequest,
  PaymentProvider,
  VerifiedPayment,
} from './provider';

const HOSTS = {
  sandbox: {
    process: 'https://sandbox.payfast.co.za/eng/process',
    validate: 'https://sandbox.payfast.co.za/eng/query/validate',
  },
  live: {
    process: 'https://www.payfast.co.za/eng/process',
    validate: 'https://www.payfast.co.za/eng/query/validate',
  },
};

/** PayFast's published ITN source ranges, resolved to IPs at runtime. */
const PAYFAST_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
];

/**
 * PayFast signature: urlencode each value (uppercase hex, spaces as +),
 * join in the given order, append the passphrase, then MD5.
 */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signaturePayload(
  data: Record<string, string>,
  passphrase: string,
  order?: string[],
): string {
  const keys = order ?? Object.keys(data);
  const parts: string[] = [];
  for (const key of keys) {
    if (key === 'signature') continue;
    const value = data[key];
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${pfEncode(String(value))}`);
  }
  let payload = parts.join('&');
  if (passphrase) payload += `&passphrase=${pfEncode(passphrase)}`;
  return payload;
}

export function generateSignature(
  data: Record<string, string>,
  passphrase: string,
  order?: string[],
): string {
  return createHash('md5').update(signaturePayload(data, passphrase, order)).digest('hex');
}

export const payfast: PaymentProvider = {
  name: 'payfast',

  async createCheckout(req: CheckoutRequest): Promise<CheckoutRedirect> {
    const cfg = env.payfast();
    const [firstName, ...rest] = req.guestName.trim().split(/\s+/);

    // PayFast signs fields in the order they are submitted.
    const fields: Record<string, string> = {
      merchant_id: cfg.merchantId,
      merchant_key: cfg.merchantKey,
      return_url: req.returnUrl,
      cancel_url: req.cancelUrl,
      notify_url: req.notifyUrl,
      name_first: firstName.slice(0, 100),
      name_last: (rest.join(' ') || firstName).slice(0, 100),
      email_address: req.email,
      m_payment_id: req.merchantRef,
      amount: (req.amountCents / 100).toFixed(2),
      item_name: req.itemName.slice(0, 100),
      item_description: req.itemDescription.slice(0, 255),
      // Our own reference, echoed back untouched on the ITN.
      custom_str1: req.ticketNumber,
      custom_str2: req.guestName.slice(0, 255),
      email_confirmation: '1',
      confirmation_address: req.email,
    };
for (const k of Object.keys(fields)) {
      const v = (fields[k] ?? '').trim();
      if (v) fields[k] = v;
      else delete fields[k];
    }
    fields.signature = generateSignature(fields, cfg.passphrase);

    return { url: HOSTS[cfg.mode].process, fields, method: 'POST' };
  },

  async verifyWebhook(body: string, headers: Headers): Promise<VerifiedPayment> {
    const cfg = env.payfast();
    const params = new URLSearchParams(body);
    const data: Record<string, string> = {};
    const order: string[] = [];
    params.forEach((value, key) => {
      data[key] = value;
      order.push(key);
    });

    // 1 — signature over the fields in the order PayFast sent them.
    const received = data.signature ?? '';
    const rawPayload = body
      .split('&')
      .filter((p) => !p.startsWith('signature='))
      .join('&');
    const signedPayload = cfg.passphrase
      ? `${rawPayload}&passphrase=${pfEncode(cfg.passphrase)}`
      : rawPayload;
    const expected = createHash('md5').update(signedPayload).digest('hex');
    if (!received || !safeEqual(received, expected)) {
      return { status: 'rejected', reason: 'Signature mismatch' };
    }

    // 2 — source IP must resolve to a PayFast host.
    const ip =
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headers.get('x-real-ip') ??
      '';
    if (env.isProduction() && ip && !(await isPayfastIp(ip))) {
      return { status: 'rejected', reason: `Untrusted source address ${ip}` };
    }

    // 3 — ask PayFast to confirm it really sent this.
    const validation = await fetch(HOSTS[cfg.mode].validate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
      .then((r) => r.text())
      .catch(() => 'FAILED');

    if (!validation.trim().startsWith('VALID')) {
      return { status: 'rejected', reason: 'PayFast did not validate this notification' };
    }

    // 4 — merchant id must be ours.
    if (data.merchant_id !== cfg.merchantId) {
      return { status: 'rejected', reason: 'Merchant id mismatch' };
    }

    const merchantRef = data.m_payment_id ?? '';
    const transactionId = data.pf_payment_id ?? null;
    const amountCents = Math.round(Number(data.amount_gross ?? '0') * 100);

    switch (data.payment_status) {
      case 'COMPLETE':
        if (!transactionId) {
          return { status: 'rejected', reason: 'Missing pf_payment_id' };
        }
        return { status: 'paid', merchantRef, transactionId, amountCents, raw: data };
      case 'CANCELLED':
        return {
          status: 'cancelled',
          merchantRef,
          transactionId,
          reason: 'Guest cancelled the payment',
          raw: data,
        };
      default:
        return {
          status: 'failed',
          merchantRef,
          transactionId,
          reason: data.payment_status ?? 'Unknown payment status',
          raw: data,
        };
    }
  },
};

let ipCache: { at: number; ips: Set<string> } | null = null;

async function isPayfastIp(ip: string): Promise<boolean> {
  if (!ipCache || Date.now() - ipCache.at > 3600_000) {
    const dns = await import('node:dns/promises');
    const ips = new Set<string>();
    for (const host of PAYFAST_HOSTS) {
      try {
        const addresses = await dns.resolve4(host);
        addresses.forEach((a) => ips.add(a));
      } catch {
        /* host unreachable — fall through */
      }
    }
    ipCache = { at: Date.now(), ips };
  }
  // If DNS failed entirely we don't want to reject genuine traffic;
  // the signature and the validate callback have already passed.
  if (ipCache.ips.size === 0) return true;
  return ipCache.ips.has(ip);
}
