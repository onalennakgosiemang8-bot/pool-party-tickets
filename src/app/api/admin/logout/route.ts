import { destroyAdminSession } from '@/lib/auth';
import { badOrigin, isSameOrigin } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return badOrigin();
  await destroyAdminSession();
  return Response.json({ ok: true });
}
