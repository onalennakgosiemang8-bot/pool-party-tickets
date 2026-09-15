/**
 * Adds or resets an organiser account without touching .env.
 *
 *   npm run admin:create -- "sam@example.com" "a-long-password" "Sam"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const [email, password, name = 'Organiser'] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npm run admin:create -- <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Choose a password of at least 10 characters.');
    process.exit(1);
  }

  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash: hashPassword(password), name, isActive: true },
    create: { email: email.toLowerCase(), passwordHash: hashPassword(password), name },
  });

  // Any existing session for this account is dropped on a password change.
  await prisma.adminSession.updateMany({
    where: { adminId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`✓ ${admin.email} can now sign in at /admin`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
