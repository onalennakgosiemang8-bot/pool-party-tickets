import 'server-only';
import { env } from './env';

/**
 * Same-origin check for state-changing requests. Combined with
 * SameSite=Lax session cookies this closes off CSRF without needing a
 * token round-trip. Payment webhooks are exempt — they are verified by
 * signature instead.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // native fetch from same origin omits it on GET
  try {
    const allowed = new URL(env.siteUrl()).host;
    const host = request.headers.get('host');
    const incoming = new URL(origin).host;
    return incoming === allowed || incoming === host;
  } catch {
    return false;
  }
}

export function badOrigin() {
  return Response.json({ error: 'Request blocked.' }, { status: 403 });
}

export function tooMany(retryAfter: number) {
  return Response.json(
    { error: 'Too many attempts. Give it a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export const noStore = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;
