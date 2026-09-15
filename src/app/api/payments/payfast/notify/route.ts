import { prisma } from '@/lib/prisma';
import { getPaymentProvider } from '@/lib/payments';
import { applyPaymentResult } from '@/lib/payments/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * PayFast ITN endpoint. The only route that can confirm a ticket.
 *
 * Order of defence:
 *   1. Record the notification first, keyed by (provider, externalId).
 *      The unique index means a replayed webhook stops here.
 *   2. Verify signature, source IP and a server-to-server callback to
 *      PayFast before believing anything in the body.
 *   3. Confirm the ticket inside a serializable transaction.
 *
 * Always answers 200 — PayFast retries anything else, and a retry storm
 * helps nobody. Failures are recorded on the WebhookEvent row instead.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const externalId =
    `${params.get('pf_payment_id') ?? params.get('m_payment_id') ?? 'unknown'}:` +
    `${params.get('payment_status') ?? 'unknown'}`;

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'payfast',
        externalId,
        signature: params.get('signature'),
        payload: Object.fromEntries(params.entries()),
      },
    });
  } catch {
    // Unique violation — we have already processed this exact notification.
    return new Response('OK (duplicate ignored)', { status: 200 });
  }

  try {
    const provider = getPaymentProvider();
    const verified = await provider.verifyWebhook(body, request.headers);
    const outcome = await applyPaymentResult(verified, provider.name);

    await prisma.webhookEvent.updateMany({
      where: { provider: 'payfast', externalId },
      data: {
        processedAt: new Date(),
        result: outcome.handled ? outcome.result : `rejected: ${outcome.reason}`,
      },
    });

    if (!outcome.handled) console.warn('[payfast] notification rejected:', outcome.reason);
  } catch (error) {
    console.error('[payfast] notification error', error);
    await prisma.webhookEvent
      .updateMany({
        where: { provider: 'payfast', externalId },
        data: { processedAt: new Date(), result: 'error' },
      })
      .catch(() => null);
  }

  return new Response('OK', { status: 200 });
}
