import { audit, authenticateAdmin, createAdminSession } from '@/lib/auth';
import { adminLoginSchema } from '@/lib/validation';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { badOrigin, isSameOrigin, tooMany } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return badOrigin();

  const ip = clientIp(request.headers);
  const limit = await rateLimit({ key: `admin-login:${ip}`, limit: 6, windowSeconds: 900 });
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = adminLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const admin = await authenticateAdmin(parsed.data.email, parsed.data.password);
  if (!admin) {
    await audit({ action: 'admin.login.failed', target: parsed.data.email, ip });
    // Deliberately vague: never reveal whether the account exists.
    return Response.json({ error: 'Those details did not match.' }, { status: 401 });
  }

  await createAdminSession(admin.id);
  await audit({ actorId: admin.id, actorName: admin.name, action: 'admin.login', ip });

  return Response.json({ ok: true, name: admin.name });
}
