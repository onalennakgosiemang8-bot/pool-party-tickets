import { redirect } from 'next/navigation';
import { TicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { releaseSeat } from '@/lib/capacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PayFast cancel_url. Releases the held seat straight away. */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref');

  if (ref) {
    const payment = await prisma.payment.findUnique({
      where: { merchantRef: ref },
      include: { ticket: true },
    });
    if (payment && payment.ticket.status === TicketStatus.PENDING) {
      await releaseSeat(payment.ticketId, TicketStatus.CANCELLED, 'Guest cancelled at PayFast');
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED', failureReason: 'Cancelled by guest' },
      });
    }
  }

  redirect('/checkout?cancelled=1');
}
