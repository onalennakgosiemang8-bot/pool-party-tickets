import 'server-only';
import { Prisma, TicketStatus } from '@prisma/client';
import { prisma } from './prisma';
import { buildQrPayload } from './qr';

export type PublicTicket = {
  id: string;
  ticketNumber: string;
  guestName: string;
  status: TicketStatus;
  amountCents: number;
  currency: string;
  qrPayload: string;
  checkedIn: boolean;
  confirmedAt: Date | null;
};

/**
 * Confirms a ticket after a payment has been verified server-side.
 * Idempotent: replaying the same webhook returns the already-confirmed
 * ticket without creating a second payment row or a second ticket.
 */
export async function confirmTicket(opts: {
  ticketId: string;
  provider: string;
  transactionId: string;
  amountCents: number;
  rawPayload: Prisma.InputJsonValue;
  merchantRef?: string;
}): Promise<{ ticket: PublicTicket; alreadyConfirmed: boolean; needsRefund: boolean }> {
  const pre = await prisma.ticket.findUnique({
    where: { id: opts.ticketId },
    select: { eventId: true },
  });
  if (!pre) throw new Error(`Ticket ${opts.ticketId} not found`);

  return prisma.$transaction(
    async (tx) => {
      // Locks are always taken Event → Ticket, the same order reserveSeat
      // uses, so the two can never deadlock against each other.
      const [event] = await tx.$queryRaw<Array<{ id: string; capacity: number }>>`
        SELECT id, capacity FROM "Event" WHERE id = ${pre.eventId} FOR UPDATE`;

      // Two webhooks arriving together (a PayFast retry racing the original)
      // are serialised here: the second reads CONFIRMED and returns quietly.
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${opts.ticketId} FOR UPDATE`;

      const ticket = await tx.ticket.findUnique({ where: { id: opts.ticketId } });
      if (!ticket) throw new Error(`Ticket ${opts.ticketId} not found`);

      if (ticket.status === TicketStatus.CONFIRMED) {
        return { ticket: toPublic(ticket), alreadyConfirmed: true, needsRefund: false };
      }

      if (ticket.amountCents !== opts.amountCents) {
        throw new Error(
          `Amount mismatch on ${ticket.ticketNumber}: expected ${ticket.amountCents}, got ${opts.amountCents}`,
        );
      }

      // The hold lapsed while the guest was paying (slow EFT, retried card).
      // Take the seat back if there is still room; if the room is full, the
      // payment stands as PAID and is flagged for refund rather than quietly
      // creating a 56th guest.
      if (ticket.status !== TicketStatus.PENDING) {
        const taken = await tx.ticket.count({
          where: {
            eventId: ticket.eventId,
            id: { not: ticket.id },
            OR: [
              { status: TicketStatus.CONFIRMED },
              { status: TicketStatus.PENDING, reservedUntil: { gt: new Date() } },
            ],
          },
        });

        if (!event || taken >= event.capacity) {
          return { ticket: toPublic(ticket), alreadyConfirmed: false, needsRefund: true };
        }
      }

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.CONFIRMED,
          confirmedAt: new Date(),
          reservedUntil: null,
          cancelledAt: null,
          cancelReason: null,
        },
      });

      // The AWAITING row created at reservation time is the one we settle.
      // Creating a second row would collide on the unique merchantRef, so
      // look it up first and only insert when there is nothing to settle.
      const existingPayment = opts.merchantRef
        ? await tx.payment.findUnique({ where: { merchantRef: opts.merchantRef } })
        : await tx.payment.findFirst({ where: { ticketId: ticket.id } });

      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            provider: opts.provider,
            transactionId: opts.transactionId,
            status: 'PAID',
            paidAt: new Date(),
            failureReason: null,
            rawPayload: opts.rawPayload,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            ticketId: ticket.id,
            provider: opts.provider,
            transactionId: opts.transactionId,
            merchantRef:
              opts.merchantRef ?? `${ticket.ticketNumber}-${Date.now().toString(36)}`,
            amountCents: opts.amountCents,
            currency: ticket.currency,
            status: 'PAID',
            paidAt: new Date(),
            rawPayload: opts.rawPayload,
          },
        });
      }

      return { ticket: toPublic(updated), alreadyConfirmed: false, needsRefund: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
  );
}

export function toPublic(t: {
  id: string;
  ticketNumber: string;
  guestName: string;
  status: TicketStatus;
  amountCents: number;
  currency: string;
  qrToken: string;
  qrSignature: string;
  checkedIn: boolean;
  confirmedAt: Date | null;
}): PublicTicket {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    guestName: t.guestName,
    status: t.status,
    amountCents: t.amountCents,
    currency: t.currency,
    qrPayload: buildQrPayload(t.ticketNumber, t.qrToken, t.qrSignature),
    checkedIn: t.checkedIn,
    confirmedAt: t.confirmedAt,
  };
}

export async function getTicketForDisplay(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  return { ...toPublic(ticket), createdAt: ticket.createdAt };
}

export type CheckInOutcome =
  | { result: 'valid'; ticket: PublicTicket; checkedInAt: Date }
  | { result: 'already'; ticket: PublicTicket; checkedInAt: Date | null }
  | { result: 'unpaid'; ticket: PublicTicket }
  | { result: 'cancelled'; ticket: PublicTicket }
  | { result: 'invalid' };

/**
 * Single-use check-in. The conditional updateMany means two scanners
 * hitting the same ticket at the same instant can never both win — one
 * gets count 1, the other gets 0 and reads "already checked in".
 */
export async function checkInByToken(
  qrToken: string,
  adminId: string,
  method: 'qr' | 'manual' = 'qr',
): Promise<CheckInOutcome> {
  const ticket = await prisma.ticket.findUnique({ where: { qrToken } });
  if (!ticket) return { result: 'invalid' };

  if (ticket.status === TicketStatus.CANCELLED) {
    return { result: 'cancelled', ticket: toPublic(ticket) };
  }
  if (ticket.status !== TicketStatus.CONFIRMED) {
    return { result: 'unpaid', ticket: toPublic(ticket) };
  }

  const now = new Date();
  const claimed = await prisma.ticket.updateMany({
    where: { id: ticket.id, checkedIn: false, status: TicketStatus.CONFIRMED },
    data: { checkedIn: true, checkedInAt: now },
  });

  if (claimed.count === 0) {
    const current = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    return {
      result: 'already',
      ticket: toPublic(current!),
      checkedInAt: current?.checkedInAt ?? null,
    };
  }

  await prisma.checkIn.create({
    data: { ticketId: ticket.id, checkedInBy: adminId, checkedInAt: now, method },
  });

  const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  return { result: 'valid', ticket: toPublic(fresh!), checkedInAt: now };
}

/** Undo a check-in (admin only) — someone scanned the wrong person. */
export async function undoCheckIn(ticketId: string) {
  await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { id: ticketId },
      data: { checkedIn: false, checkedInAt: null },
    }),
    prisma.checkIn.deleteMany({ where: { ticketId } }),
  ]);
}
