import { TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { audit, requireAdminApi } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkInByToken, undoCheckIn } from '@/lib/tickets';
import { notifyCancelled } from '@/lib/notifications';
import { badOrigin, isSameOrigin, noStore } from '@/lib/security';
import { normalisePhone } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('check-in') }),
  z.object({ action: z.literal('undo-check-in') }),
  z.object({ action: z.literal('cancel'), refund: z.boolean().default(false), reason: z.string().max(200).optional() }),
  z.object({
    action: z.literal('transfer'),
    guestName: z.string().trim().min(3).max(80),
    email: z.string().trim().toLowerCase().email().max(120),
    phone: z.string().trim().min(9).max(24),
  }),
]);

/** Admin ticket operations: manual check-in, undo, cancel/refund, transfer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return badOrigin();

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return Response.json({ error: 'Ticket not found.' }, { status: 404 });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const body = parsed.data;

  switch (body.action) {
    case 'check-in': {
      const outcome = await checkInByToken(ticket.qrToken, auth.admin.id, 'manual');
      await audit({
        actorId: auth.admin.id,
        actorName: auth.admin.name,
        action: 'checkin.manual',
        target: ticket.ticketNumber,
        detail: { result: outcome.result },
      });
      return Response.json({ ok: outcome.result === 'valid', result: outcome.result }, { headers: noStore });
    }

    case 'undo-check-in': {
      await undoCheckIn(ticket.id);
      await audit({
        actorId: auth.admin.id,
        actorName: auth.admin.name,
        action: 'checkin.undo',
        target: ticket.ticketNumber,
      });
      return Response.json({ ok: true }, { headers: noStore });
    }

    case 'cancel': {
      // Frees the seat: the capacity count only ever includes CONFIRMED
      // and live PENDING holds.
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.CANCELLED,
          reservedUntil: null,
          cancelledAt: new Date(),
          cancelReason: body.reason ?? (body.refund ? 'Refunded by organiser' : 'Cancelled by organiser'),
          checkedIn: false,
          checkedInAt: null,
        },
      });
      await prisma.checkIn.deleteMany({ where: { ticketId: ticket.id } });

      if (body.refund) {
        await prisma.payment.updateMany({
          where: { ticketId: ticket.id, status: 'PAID' },
          data: { status: 'REFUNDED' },
        });
      }

      await notifyCancelled({
        email: ticket.email,
        guestName: ticket.guestName,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        refunded: body.refund,
      }).catch((error) => console.error('[email] cancellation notice failed', error));

      await audit({
        actorId: auth.admin.id,
        actorName: auth.admin.name,
        action: body.refund ? 'ticket.refund' : 'ticket.cancel',
        target: ticket.ticketNumber,
      });

      return Response.json({ ok: true, seatReleased: true }, { headers: noStore });
    }

    case 'transfer': {
      // The only way a ticket changes hands, exactly as the house rules say.
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          guestName: body.guestName,
          email: body.email,
          phone: normalisePhone(body.phone),
        },
      });
      await audit({
        actorId: auth.admin.id,
        actorName: auth.admin.name,
        action: 'ticket.transfer',
        target: ticket.ticketNumber,
        detail: { from: ticket.guestName, to: body.guestName },
      });
      return Response.json(
        { ok: true, guestName: updated.guestName },
        { headers: noStore },
      );
    }
  }
}
