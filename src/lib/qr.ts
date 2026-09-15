import 'server-only';
import QRCode from 'qrcode';
import { env } from './env';
import { hmac, randomToken, safeEqual } from './crypto';

/**
 * QR payload format:  PSWP1.<ticketNumber>.<opaqueToken>.<sig>
 *
 * The token is 32 random bytes and means nothing on its own — it is looked
 * up server-side. The signature lets the scanner reject obviously forged
 * codes before touching the database. No name, email, phone or amount is
 * ever encoded in the QR.
 */
const PREFIX = 'PSWP1';

export function createQrToken(): { token: string; signature: string } {
  const token = randomToken(32);
  return { token, signature: signQrToken(token) };
}

export function signQrToken(token: string): string {
  return hmac(env.ticketSigningSecret(), `qr:${token}`).slice(0, 32);
}

export function buildQrPayload(ticketNumber: string, token: string, signature: string): string {
  return [PREFIX, ticketNumber, token, signature].join('.');
}

export type ParsedQr = { ticketNumber: string; token: string; signature: string };

/** Parses and verifies the HMAC. Returns null for anything malformed or forged. */
export function parseQrPayload(raw: string): ParsedQr | null {
  const value = raw.trim();
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [prefix, ticketNumber, token, signature] = parts;
  if (prefix !== PREFIX) return null;
  if (!/^PARKS-\d{4,}$/.test(ticketNumber)) return null;
  if (!safeEqual(signQrToken(token), signature)) return null;
  return { ticketNumber, token, signature };
}

export async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 640,
    color: { dark: '#04182B', light: '#FFFFFF' },
  });
}

export async function qrPngBuffer(payload: string, width = 640): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    type: 'png',
    color: { dark: '#04182B', light: '#FFFFFF' },
  });
}
