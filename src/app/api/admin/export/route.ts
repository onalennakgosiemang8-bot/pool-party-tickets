import { stringify } from 'csv-stringify/sync';
import { audit, requireAdminApi } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EVENT } from '@/lib/event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'asc' },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  const rows = tickets.map((t, i) => ({
    '#': i + 1,
    'Ticket number': t.ticketNumber,
    'Guest name': t.guestName,
    Email: t.email,
    Mobile: t.phone,
    'Emergency contact': t.emergencyContact ?? '',
    Amount: (t.amountCents / 100).toFixed(2),
    'Ticket status': t.status,
    'Payment status': t.payments[0]?.status ?? 'AWAITING',
    'Checked in': t.checkedIn ? 'Yes' : 'No',
    'Purchase date': (t.confirmedAt ?? t.createdAt).toISOString(),
    'Check-in time': t.checkedInAt?.toISOString() ?? '',
  }));

  const csv = stringify(rows, { header: true });
  await audit({
    actorId: auth.admin.id,
    actorName: auth.admin.name,
    action: 'guests.export',
    detail: { count: rows.length },
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${EVENT.slug}-guest-list.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
