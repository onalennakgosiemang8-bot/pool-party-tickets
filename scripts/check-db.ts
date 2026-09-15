/**
 * Production-safe database check.
 *
 * Verifies that DATABASE_URL is reachable, the Parks event exists,
 * capacity is 55 or less, and no more than capacity-confirmed tickets exist.
 * Never prints DATABASE_URL or any credentials.
 *
 * Usage:
 *   npm run db:check
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const event = await prisma.event.findUnique({
    where: { slug: 'parks-splash-2026' },
    include: { _count: { select: { tickets: true } } },
  });

  if (!event) {
    throw new Error('Event parks-splash-2026 is missing. Run npm run seed.');
  }

  const sold = await prisma.ticket.count({
    where: { eventId: event.id, status: 'CONFIRMED' },
  });

  const pending = await prisma.ticket.count({
    where: {
      eventId: event.id,
      status: 'PENDING',
      reservedUntil: { gt: new Date() },
    },
  });

  const warnings: string[] = [];

  if (event.capacity > 55) warnings.push(`Capacity is ${event.capacity}; hard maximum is 55.`);
  if (sold > event.capacity) warnings.push(`Confirmed tickets (${sold}) exceed capacity (${event.capacity}).`);

  console.log(JSON.stringify({
    ok: warnings.length === 0,
    event: {
      name: event.name,
      capacity: event.capacity,
      priceCents: event.priceCents,
      currency: event.currency,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    },
    tickets: { sold, pending, remaining: Math.max(0, event.capacity - sold - pending) },
    warnings,
  }, null, 2));

  if (warnings.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
