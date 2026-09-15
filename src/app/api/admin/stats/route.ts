import { TicketStatus } from '@prisma/client';
import { requireAdminApi } from '@/lib/auth';
import { getAvailability, getEvent } from '@/lib/capacity';
import { prisma } from '@/lib/prisma';
import { noStore } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const [event, availability] = await Promise.all([getEvent(), getAvailability()]);

  const confirmed = await prisma.ticket.findMany({
    where: { eventId: event.id, status: TicketStatus.CONFIRMED },
    select: { confirmedAt: true, createdAt: true, amountCents: true },
    orderBy: { confirmedAt: 'asc' },
  });

  // Sales per day, cumulative — enough for the dashboard chart.
  const byDay = new Map<string, number>();
  for (const t of confirmed) {
    const day = (t.confirmedAt ?? t.createdAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  let running = 0;
  const salesOverTime = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      running += count;
      return { date, count, cumulative: running };
    });

  const revenueCents = confirmed.reduce((sum, t) => sum + t.amountCents, 0);

  return Response.json(
    {
      capacity: availability.capacity,
      sold: availability.sold,
      held: availability.held,
      remaining: availability.remaining,
      soldOut: availability.soldOut,
      checkedIn: availability.checkedIn,
      notCheckedIn: availability.sold - availability.checkedIn,
      revenueCents,
      currency: event.currency,
      salesOverTime,
      purchaseRatePct: Math.round((availability.sold / availability.capacity) * 100),
    },
    { headers: noStore },
  );
}
