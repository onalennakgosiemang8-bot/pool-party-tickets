import { prisma } from '@/lib/prisma';
import { buildTicketPdf } from '@/lib/pdf';
import { toPublic } from '@/lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Downloadable pass. The ticket id is the unguessable capability here. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.ticket.findUnique({ where: { id } });
  if (!record) return new Response('Ticket not found', { status: 404 });

  const ticket = toPublic(record);
  const pdf = await buildTicketPdf({
    ticketNumber: ticket.ticketNumber,
    guestName: ticket.guestName,
    amountCents: ticket.amountCents,
    qrPayload: ticket.qrPayload,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ticket.ticketNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
