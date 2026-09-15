import { prisma } from '@/lib/prisma';
import { configWarnings } from '@/lib/env';
import { EVENT } from '@/lib/event';
import { noStore } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deployment smoke test. Confirms the function can reach the database and
 * that the event row exists — the two things that break a fresh deploy.
 * Returns no secrets and no guest data.
 */
export async function GET() {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: EVENT.slug },
      select: { capacity: true, priceCents: true, currency: true },
    });

    if (!event) {
      return Response.json(
        {
          ok: false,
          database: 'up',
          event: 'missing',
          hint: 'Run `npm run seed` against this database.',
        },
        { status: 503, headers: noStore },
      );
    }

    return Response.json(
      {
        ok: true,
        database: 'up',
        event: 'ready',
        capacity: event.capacity,
        price: `${event.currency} ${(event.priceCents / 100).toFixed(2)}`,
        paymentProvider: process.env.PAYMENT_PROVIDER ?? 'payfast',
        payfastMode: process.env.PAYFAST_MODE ?? 'sandbox',
        emailMode: process.env.EMAIL_MODE ?? 'test',
        warnings: configWarnings(),
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error('[health] database unreachable', error);
    return Response.json(
      { ok: false, database: 'down', hint: 'Check DATABASE_URL.' },
      { status: 503, headers: noStore },
    );
  }
}
