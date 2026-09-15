import { releaseExpiredHolds } from '@/lib/capacity';
import { safeEqual } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Sweeps lapsed holds back into the pool. Reservations are also released
 * lazily inside reserveSeat(), so this is belt and braces.
 *
 * Accepts either form of credential:
 *   - Vercel Cron:  Authorization: Bearer $CRON_SECRET  (sent automatically)
 *   - anything else: x-cron-key: $CRON_SECRET
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = request.headers.get('authorization') ?? '';
  if (bearer.startsWith('Bearer ') && safeEqual(secret, bearer.slice(7))) return true;

  return safeEqual(secret, request.headers.get('x-cron-key') ?? '');
}

async function handle(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: 'Unauthorised.' }, { status: 401 });
  }
  const released = await releaseExpiredHolds();
  return Response.json({ released, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
