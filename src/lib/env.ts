/**
 * Central, validated access to environment configuration.
 * Nothing here is ever imported into a client component — anything the
 * browser may see lives under NEXT_PUBLIC_ and is re-exported in event.ts.
 */
import 'server-only';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  databaseUrl: () => required('DATABASE_URL'),
  siteUrl: () =>
    (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),

  sessionSecret: () => required('SESSION_SECRET'),
  ticketSigningSecret: () => required('TICKET_SIGNING_SECRET'),

  /**
   * PayFast credentials. The published sandbox pair is used as a fallback
   * ONLY in sandbox mode — a live deployment with missing credentials fails
   * loudly rather than quietly taking payments into PayFast's test account.
   */
  payfast: () => {
    const mode = optional('PAYFAST_MODE', 'sandbox') as 'sandbox' | 'live';
    const sandbox = { id: '10000100', key: '46f0cd694581a' };

    const merchantId =
      optional('PAYFAST_MERCHANT_ID') || (mode === 'sandbox' ? sandbox.id : '');
    const merchantKey =
      optional('PAYFAST_MERCHANT_KEY') || (mode === 'sandbox' ? sandbox.key : '');

    if (!merchantId || !merchantKey) {
      throw new Error(
        'PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set when PAYFAST_MODE=live.',
      );
    }

    return { mode, merchantId, merchantKey, passphrase: optional('PAYFAST_PASSPHRASE') };
  },
  paymentProvider: () => optional('PAYMENT_PROVIDER', 'payfast') as 'payfast' | 'mock',

  email: () => ({
    mode: optional('EMAIL_MODE', 'test') as 'test' | 'live',
    provider: optional('EMAIL_PROVIDER', 'resend') as 'resend' | 'sendgrid',
    apiKey: optional('EMAIL_API_KEY'),
    from: optional('EMAIL_FROM', 'The Parks Splash <tickets@example.com>'),
    replyTo: optional('EMAIL_REPLY_TO'),
  }),

  holdMinutes: () => {
    const n = Number(optional('RESERVATION_HOLD_MINUTES', '15'));
    return Number.isFinite(n) && n > 0 ? n : 15;
  },

  isProduction: () => process.env.NODE_ENV === 'production',
};

/**
 * Configuration problems worth knowing about before guests arrive.
 * Returns human-readable warnings only — never a secret, never a value.
 * Surfaced by GET /api/health so a deployment can be checked in one look.
 */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  const site = env.siteUrl();

  if (!process.env.DATABASE_URL) warnings.push('DATABASE_URL is not set.');
  if ((process.env.SESSION_SECRET ?? '').length < 32) {
    warnings.push('SESSION_SECRET is missing or shorter than 32 characters.');
  }
  if ((process.env.TICKET_SIGNING_SECRET ?? '').length < 32) {
    warnings.push('TICKET_SIGNING_SECRET is missing or shorter than 32 characters.');
  }
  if (
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET === process.env.TICKET_SIGNING_SECRET
  ) {
    warnings.push('SESSION_SECRET and TICKET_SIGNING_SECRET must be different values.');
  }
  if (!process.env.CRON_SECRET) {
    warnings.push('CRON_SECRET is not set — the expired-hold sweeper will refuse to run.');
  }
  if (env.isProduction() && !site.startsWith('https://')) {
    warnings.push('NEXT_PUBLIC_SITE_URL must be an https:// URL in production.');
  }
  if (env.isProduction() && site.includes('localhost')) {
    warnings.push('NEXT_PUBLIC_SITE_URL still points at localhost.');
  }
  if (env.isProduction() && env.paymentProvider() === 'mock') {
    warnings.push('PAYMENT_PROVIDER=mock is set in production — no real payments.');
  }
  if (env.isProduction() && (process.env.PAYFAST_MODE ?? 'sandbox') !== 'live') {
    warnings.push('PAYFAST_MODE is not live — payments are going to the sandbox.');
  }
  if (env.email().mode !== 'live') {
    warnings.push('EMAIL_MODE is not live — tickets are logged, not emailed.');
  }
  if (env.email().mode === 'live' && !env.email().apiKey) {
    warnings.push('EMAIL_MODE=live but EMAIL_API_KEY is empty.');
  }

  return warnings;
}
