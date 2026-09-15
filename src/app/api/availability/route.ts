import { getAvailability } from '@/lib/capacity';
import { noStore } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public. Returns counts only — never guest details. */
export async function GET() {
  const a = await getAvailability();
  return Response.json(
    {
      capacity: a.capacity,
      sold: a.sold,
      held: a.held,
      remaining: a.remaining,
      soldOut: a.soldOut,
      updatedAt: new Date().toISOString(),
    },
    { headers: noStore },
  );
}
