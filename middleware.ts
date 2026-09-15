import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two jobs:
 *   1. Security headers on every response.
 *   2. A cheap edge gate on /admin and /api/admin — it verifies the HMAC
 *      on the session cookie so junk never reaches the database. The real
 *      authorisation still happens server-side in requireAdminPage /
 *      requireAdminApi, which check the session row, its expiry and the
 *      account's active flag. This is a filter, not the lock.
 */

const SESSION_COOKIE = 'parks_admin_session';

const PUBLIC_ADMIN_PATHS = ['/admin', '/api/admin/login', '/api/admin/logout'];

function securityHeaders(response: NextResponse, isHttps: boolean) {
  const csp = [
    "default-src 'self'",
    // Next.js ships inline bootstrap scripts; styles come from Tailwind + next/font.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // PayFast is reached by a top-level form POST, not an iframe.
    "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  if (isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  return response;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hasPlausibleSession(request: NextRequest): Promise<boolean> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!raw || !secret) return false;

  const idx = raw.lastIndexOf('.');
  if (idx < 1) return false;

  const token = raw.slice(0, idx);
  const signature = raw.slice(idx + 1);
  return (await hmacHex(secret, token)) === signature;
}

export async function middleware(request: NextRequest) {
  const { pathname, protocol } = request.nextUrl;
  const isHttps = protocol === 'https:';

  const guarded =
    (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) &&
    !PUBLIC_ADMIN_PATHS.includes(pathname);

  if (guarded && !(await hasPlausibleSession(request))) {
    if (pathname.startsWith('/api/')) {
      return securityHeaders(
        NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }),
        isHttps,
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return securityHeaders(NextResponse.redirect(url), isHttps);
  }

  return securityHeaders(NextResponse.next(), isHttps);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
