import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { applyPaymentResult } from '@/lib/payments/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Local sandbox only — drives the same verified-payment path as PayFast. */
export async function POST(request: Request) {
  if (env.isProduction() || env.paymentProvider() !== 'mock') {
    return new Response('Not found', { status: 404 });
  }

  const form = await request.formData();
  const ref = String(form.get('ref') ?? '');
  const outcome = String(form.get('outcome') ?? 'paid');

  const payment = await prisma.payment.findUnique({
    where: { merchantRef: ref },
    include: { ticket: true },
  });
  if (!payment) return new Response('Unknown reference', { status: 404 });

  const raw = { m_payment_id: ref, provider: 'mock', outcome };

  if (outcome === 'paid') {
    await applyPaymentResult(
      {
        status: 'paid',
        merchantRef: ref,
        transactionId: `mock-${payment.id}`,
        amountCents: payment.ticket.amountCents,
        raw,
      },
      'mock',
    );
  } else {
    await applyPaymentResult(
      {
        status: 'failed',
        merchantRef: ref,
        transactionId: null,
        reason: 'Sandbox: simulated failure',
        raw,
      },
      'mock',
    );
  }

  return Response.redirect(`${env.siteUrl()}/success?ref=${encodeURIComponent(ref)}`, 303);
}
