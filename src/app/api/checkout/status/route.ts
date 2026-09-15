import { prisma } from '@/lib/prisma';
import { noStore } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Polled by the success page while it waits for the webhook. Returns a
 * status only — no guest details — and requires the merchant reference,
 * which is only ever known to the buyer.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref) return Response.json({ error: 'Missing reference.' }, { status: 400 });

  const payment = await prisma.payment.findUnique({
    where: { merchantRef: ref },
    select: {
      status: true,
      ticket: { select: { id: true, status: true, ticketNumber: true } },
    },
  });

  if (!payment) return Response.json({ error: 'Not found.' }, { status: 404 });

  return Response.json(
    {
      status: payment.ticket.status,
      paymentStatus: payment.status,
      ticketId: payment.ticket.id,
      ticketNumber: payment.ticket.ticketNumber,
    },
    { headers: noStore },
  );
}
