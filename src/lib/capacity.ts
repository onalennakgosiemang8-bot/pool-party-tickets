import 'server-only';
import { Prisma, TicketStatus } from '@prisma/client';
import { prisma } from './prisma';
import { env } from './env';
import { EVENT } from './event';
import { createQrToken } from './qr';

export class SoldOutError extends Error {
  constructor() {
    super('All 55 tickets are taken.');
    this.name = 'SoldOutError';
  }
}

export class DuplicateTicketError extends Error {
  constructor(public ticketNumber: string) {
    super('This email address already has a confirmed ticket.');
    this.name = 'DuplicateTicketError';
  }
}

export type Availability = {
  capacity: number;
  sold: number; // CONFIRMED only — the number that matters
  held: number; // PENDING holds that have not expired
  remaining: number; // capacity - sold - held
  soldOut: boolean;
  checkedIn: number;
  revenueCents: number;
};

export async function getEvent() {
  const event = await prisma.event.findUnique({ where: { slug: EVENT.slug } });
  if (!event) {
    throw new Error(
      'Event row not found. Run `npm run seed` to create the event and admin user.',
    );
  }
  return event;
}

/**
 * Public availability. Cheap enough to poll every 20s.
 * Expired holds are treated as released here even before the sweeper runs,
 * so the number a guest sees is never pessimistic.
 */
export async function getAvailability(): Promise<Availability> {
  const event = await getEvent();
  const now = new Date();

  const [sold, held, checkedIn] = await Promise.all([
    prisma.ticket.count({
      where: { eventId: event.id, status: TicketStatus.CONFIRMED },
    }),
    prisma.ticket.count({
      where: {
        eventId: event.id,
        status: TicketStatus.PENDING,
        reservedUntil: { gt: now },
      },
    }),
    prisma.ticket.count({
      where: { eventId: event.id, status: TicketStatus.CONFIRMED, checkedIn: true },
    }),
  ]);

  const remaining = Math.max(0, event.capacity - sold - held);

  return {
    capacity: event.capacity,
    sold,
    held,
    remaining,
    soldOut: remaining === 0,
    checkedIn,
    revenueCents: sold * event.priceCents,
  };
}

/** Marks lapsed holds as EXPIRED so their seats return to the pool. */
export async function releaseExpiredHolds(
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const result = await tx.ticket.updateMany({
    where: { status: TicketStatus.PENDING, reservedUntil: { lt: new Date() } },
    data: { status: TicketStatus.EXPIRED },
  });
  return result.count;
}

type ReserveInput = {
  fullName: string;
  email: string;
  phone: string;
  emergencyContact?: string | null;
};

/**
 * Allocates one seat and returns a PENDING ticket + its payment row.
 *
 * Race safety, in order:
 *   1. SELECT ... FOR UPDATE on the single Event row. Two concurrent
 *      requests are serialised here — the second waits for the first to
 *      commit, so it sees the first one's seat.
 *   2. Expired holds are released inside the same lock.
 *   3. Seats are counted inside the same lock.
 *   4. lastTicketSeq is incremented inside the same lock, so ticket
 *      numbers are unique and gapless.
 * The unique index on Ticket.ticketNumber is the final backstop.
 */
export async function reserveSeat(input: ReserveInput) {
  const holdMinutes = env.holdMinutes();

  return prisma.$transaction(
    async (tx) => {
      const [event] = await tx.$queryRaw<
        Array<{ id: string; capacity: number; lastTicketSeq: number; priceCents: number; currency: string }>
      >`SELECT id, capacity, "lastTicketSeq", "priceCents", currency
          FROM "Event" WHERE slug = ${EVENT.slug} FOR UPDATE`;

      if (!event) throw new Error('Event row not found. Run `npm run seed`.');

      await releaseExpiredHolds(tx);

      // One confirmed ticket per email address.
      const existing = await tx.ticket.findFirst({
        where: { email: input.email, status: TicketStatus.CONFIRMED },
        select: { ticketNumber: true },
      });
      if (existing) throw new DuplicateTicketError(existing.ticketNumber);

      const taken = await tx.ticket.count({
        where: {
          eventId: event.id,
          OR: [
            { status: TicketStatus.CONFIRMED },
            { status: TicketStatus.PENDING, reservedUntil: { gt: new Date() } },
          ],
        },
      });

      if (taken >= event.capacity) throw new SoldOutError();

      const seq = event.lastTicketSeq + 1;
      const ticketNumber = `PARKS-${String(seq).padStart(4, '0')}`;

      await tx.event.update({
        where: { id: event.id },
        data: { lastTicketSeq: seq },
      });

      const guest = await tx.guest.upsert({
        where: { email: input.email },
        update: {
          fullName: input.fullName,
          phone: input.phone,
          emergencyContact: input.emergencyContact || null,
        },
        create: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          emergencyContact: input.emergencyContact || null,
        },
      });

      const { token, signature } = createQrToken();

      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          eventId: event.id,
          guestId: guest.id,
          guestName: input.fullName,
          email: input.email,
          phone: input.phone,
          emergencyContact: input.emergencyContact || null,
          amountCents: event.priceCents,
          currency: event.currency,
          status: TicketStatus.PENDING,
          reservedUntil: new Date(Date.now() + holdMinutes * 60_000),
          qrToken: token,
          qrSignature: signature,
        },
      });

      const payment = await tx.payment.create({
        data: {
          ticketId: ticket.id,
          provider: env.paymentProvider(),
          merchantRef: `${ticketNumber}-${Date.now().toString(36)}`,
          amountCents: event.priceCents,
          currency: event.currency,
          status: 'AWAITING',
        },
      });

      const seatsLeft = event.capacity - (taken + 1);
      return { ticket, payment, seatsLeft };
    },
    {
      // READ COMMITTED on purpose. The FOR UPDATE above already serialises
      // concurrent buyers by making the second one wait; under SERIALIZABLE
      // that waiter would instead abort with a serialization failure and the
      // guest would see a 500 rather than a clean "sold out".
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15_000,
      maxWait: 10_000,
    },
  );
}

/** Releases a seat when payment fails, is cancelled, or the hold lapses. */
export async function releaseSeat(
  ticketId: string,
  status: TicketStatus.FAILED | TicketStatus.EXPIRED | TicketStatus.CANCELLED,
  reason?: string,
) {
  return prisma.ticket.updateMany({
    // Guard: never demote a ticket that is already CONFIRMED.
    where: { id: ticketId, status: TicketStatus.PENDING },
    data: { status, reservedUntil: null, cancelledAt: new Date(), cancelReason: reason },
  });
}
