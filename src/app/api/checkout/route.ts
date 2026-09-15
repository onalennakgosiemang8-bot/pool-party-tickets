import { EVENT } from '@/lib/event';
import { env } from '@/lib/env';
import { DuplicateTicketError, SoldOutError, reserveSeat } from '@/lib/capacity';
import { getPaymentProvider } from '@/lib/payments';
import { checkoutSchema, normalisePhone } from '@/lib/validation';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { badOrigin, isSameOrigin, noStore, tooMany } from '@/lib/security';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Holds a seat and hands back a redirect to the payment provider.
 * A ticket created here is PENDING: it occupies a seat for the hold
 * window only and is never valid for entry until a verified payment
 * arrives at the webhook.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return badOrigin();

  const ip = clientIp(request.headers);
  // Tight in production; relaxed locally so `npm run verify` can buy 55 seats.
  const limit = await rateLimit({
    key: `checkout:${ip}`,
    limit: env.isProduction() ? 8 : 1000,
    windowSeconds: 600,
  });
  if (!limit.ok) return tooMany(limit.retryAfter);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Send valid JSON.' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return Response.json(
      { error: 'Check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    const { ticket, payment, seatsLeft } = await reserveSeat({
      fullName: input.fullName,
      email: input.email,
      phone: normalisePhone(input.phone),
      emergencyContact: input.emergencyContact || null,
    });

    const site = env.siteUrl();
    const provider = getPaymentProvider();

    const redirect = await provider.createCheckout({
      merchantRef: payment.merchantRef,
      ticketNumber: ticket.ticketNumber,
      amountCents: ticket.amountCents,
      currency: ticket.currency,
      itemName: `${EVENT.brand} Splash Party — 1 guest`,
      itemDescription: `Splash park entrance, ${EVENT.dateLabel}. Ticket ${ticket.ticketNumber}.`,
      guestName: ticket.guestName,
      email: ticket.email,
      phone: ticket.phone,
      returnUrl: `${site}/success?ref=${encodeURIComponent(payment.merchantRef)}`,
      cancelUrl: `${site}/api/payments/cancel?ref=${encodeURIComponent(payment.merchantRef)}`,
      notifyUrl: `${site}/api/payments/payfast/notify`,
    });

    return Response.json(
      {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        merchantRef: payment.merchantRef,
        holdExpiresAt: ticket.reservedUntil,
        seatsLeft,
        redirect,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof SoldOutError) {
      return Response.json(
        { error: 'All 55 tickets are taken.', code: 'SOLD_OUT' },
        { status: 409 },
      );
    }

    if (error instanceof DuplicateTicketError) {
      const existing = await prisma.ticket.findUnique({
        where: { ticketNumber: error.ticketNumber },
        select: { id: true },
      });
      return Response.json(
        {
          error: `That email already has ticket #${error.ticketNumber}. Check your inbox, or ask an organiser to add a second guest.`,
          code: 'DUPLICATE',
          ticketId: existing?.id ?? null,
        },
        { status: 409 },
      );
    }

    console.error('[checkout] failed', error);
    return Response.json(
      { error: 'We could not hold your seat. Try again in a moment.' },
      { status: 500 },
    );
  }
}
