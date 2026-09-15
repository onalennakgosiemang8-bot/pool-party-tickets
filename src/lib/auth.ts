import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { env } from './env';
import { hashPassword, hmac, randomToken, safeEqual, sha256, verifyPassword } from './crypto';

export const SESSION_COOKIE = 'parks_admin_session';
const SESSION_TTL_HOURS = 12;

export type AdminIdentity = { id: string; email: string; name: string; role: string };

/** token.signature — the signature lets edge middleware reject junk without a DB hit. */
function signToken(token: string): string {
  return hmac(env.sessionSecret(), token);
}

export function buildCookieValue(token: string): string {
  return `${token}.${signToken(token)}`;
}

export function splitCookieValue(value: string): string | null {
  const idx = value.lastIndexOf('.');
  if (idx < 1) return null;
  const token = value.slice(0, idx);
  const signature = value.slice(idx + 1);
  return safeEqual(signToken(token), signature) ? token : null;
}

export async function createAdminSession(adminId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  const h = await headers();

  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: h.get('user-agent')?.slice(0, 200) ?? null,
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, buildCookieValue(token), {
    httpOnly: true,
    secure: env.isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/** Full server-side verification: signature, DB lookup, expiry, revocation. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const token = splitCookieValue(raw);
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.admin.isActive) return null;

  return {
    id: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    role: session.admin.role,
  };
}

/** For pages — bounces to the login screen. */
export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin?next=1');
  return admin;
}

/** For API routes — returns 401 JSON instead of redirecting. */
export async function requireAdminApi(): Promise<
  { ok: true; admin: AdminIdentity } | { ok: false; response: Response }
> {
  const admin = await getAdmin();
  if (!admin) {
    return {
      ok: false,
      response: Response.json({ error: 'Sign in to continue.' }, { status: 401 }),
    };
  }
  return { ok: true, admin };
}

export async function destroyAdminSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    const token = splitCookieValue(raw);
    if (token) {
      await prisma.adminSession
        .updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
        .catch(() => null);
    }
  }
  jar.delete(SESSION_COOKIE);
}

export async function authenticateAdmin(email: string, password: string) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Always run a hash comparison so a missing account and a wrong password
  // take the same amount of time.
  const stored = admin?.passwordHash ?? hashPassword('placeholder-not-a-real-password');
  const valid = verifyPassword(password, stored);

  if (!admin || !admin.isActive || !valid) return null;

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return admin;
}

export async function audit(entry: {
  actorId?: string;
  actorName?: string;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog
    .create({
      data: {
        actorId: entry.actorId,
        actorName: entry.actorName,
        action: entry.action,
        target: entry.target,
        detail: entry.detail as never,
        ip: entry.ip,
      },
    })
    .catch(() => null);
}
