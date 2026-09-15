import { Prisma, TicketStatus } from '@prisma/client';
import { requireAdminApi } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { noStore } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Guest list. Behind admin auth — this is the only place PII is served. */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? 'all';
  const checked = url.searchParams.get('checked') ?? 'all';

  const where: Prisma.TicketWhereInput = {};

  if (q) {
    where.OR = [
      { guestName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { ticketNumber: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (status !== 'all') where.status = status as TicketStatus;
  if (checked === 'yes') where.checkedIn = true;
  if (checked === 'no') where.checkedIn = false;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 500,
    select: {
      id: true,
      ticketNumber: true,
      guestName: true,
      email: true,
      phone: true,
      emergencyContact: true,
      amountCents: true,
      status: true,
      checkedIn: true,
      checkedInAt: true,
      createdAt: true,
      confirmedAt: true,
      payments: {
        select: { status: true, provider: true, transactionId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return Response.json(
    {
      guests: tickets.map((t, i) => ({
        row: i + 1,
        id: t.id,
        ticketNumber: t.ticketNumber,
        guestName: t.guestName,
        email: t.email,
        phone: t.phone,
        emergencyContact: t.emergencyContact,
        amountCents: t.amountCents,
        ticketStatus: t.status,
        paymentStatus: t.payments[0]?.status ?? 'AWAITING',
        checkedIn: t.checkedIn,
        checkedInAt: t.checkedInAt,
        purchasedAt: t.confirmedAt ?? t.createdAt,
      })),
    },
    { headers: noStore },
  );
}
