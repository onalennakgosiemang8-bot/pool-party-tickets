/**
 * Seeds the single Event row and the first organiser account.
 * Safe to re-run: everything here is an upsert.
 *
 *   npm run seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';
import { EVENT } from '../src/lib/event';

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: EVENT.slug },
    update: {
      name: `${EVENT.brand} ${EVENT.name}`,
      venue: EVENT.venueFull,
      startsAt: new Date(EVENT.startsAt),
      endsAt: new Date(EVENT.endsAt),
      priceCents: EVENT.priceCents,
      currency: EVENT.currency,
      capacity: EVENT.capacity,
    },
    create: {
      slug: EVENT.slug,
      name: `${EVENT.brand} ${EVENT.name}`,
      tagline: EVENT.tagline,
      venue: EVENT.venueFull,
      startsAt: new Date(EVENT.startsAt),
      endsAt: new Date(EVENT.endsAt),
      priceCents: EVENT.priceCents,
      currency: EVENT.currency,
      capacity: EVENT.capacity,
      inviteOnly: true,
    },
  });

  console.log(`✓ Event ready: ${event.name} — capacity ${event.capacity}`);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Event Organizer';

  if (!email || !password) {
    console.log('… ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping organiser account.');
    console.log('  Set them in .env and re-run, or use: npm run admin:create');
    return;
  }

  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
  }

  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { name, isActive: true },
    create: {
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      role: 'owner',
    },
  });

  console.log(`✓ Organiser ready: ${admin.email}`);
  console.log('  Sign in at /admin');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
