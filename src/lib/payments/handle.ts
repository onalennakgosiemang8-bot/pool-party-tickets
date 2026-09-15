import 'server-only';
import { TicketStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { releaseSeat } from '../capacity';
import { confirmTicket } from '../tickets';
import { deliverTicket, notifyPaymentFailed } from '../notifications';
import type { VerifiedPayment } from './provider';

export type PaymentOutcome =
  | {
      handled: true;
      result: 'confirmed' | 'already-confirmed' | 'released' | 'refund-required';
    }
  | { handled: false; reason: string };

/**
 * Applies a *verified* payment result. This is the only place a ticket is
 * ever confirmed. Shared by the PayFast ITN route and the local mock
 * provider so both follow identical rules.
 */
export async function applyPaymentResult(
  verified: VerifiedPayment,
  provider: string,
): Promise<PaymentOutcome> {
  if (verified.status === 'rejected') {
    return { handled: false, reason: verified.reason };
  }

  const payment = await prisma.payment.findUnique({
    where: { merchantRef: verified.merchantRef },
    include: { ticket: true },
  });

  if (!payment) {
    return { handled: false, reason: `Unknown reference ${verified.merchantRef}` };
  }

  if (verified.status === 'paid') {
    if (verified.amountCents !== payment.ticket.amountCents) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: `Amount mismatch: expected ${payment.ticket.amountCents}, received ${verified.amountCents}`,
          rawPayload: verified.raw,
        },
      });
      return { handled: false, reason: 'Amount mismatch — ticket left unconfirmed.' };
    }

    const { ticket, alreadyConfirmed, needsRefund } = await confirmTicket({
      ticketId: payment.ticketId,
      provider,
      transactionId: verified.transactionId,
      amountCents: verified.amountCents,
      rawPayload: verified.raw,
      merchantRef: verified.merchantRef,
    });

    // Paid, but the hold had lapsed and the room was already full. The money
    // is real, so record it as PAID and flag it for a refund rather than
    // quietly admitting a 56th guest.
    if (needsRefund) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          transactionId: verified.transactionId,
          failureReason:
            'Paid after the 15-minute hold lapsed and the event was full — refund this guest.',
          rawPayload: verified.raw,
        },
      });

      await notifyPaymentFailed({
        email: payment.ticket.email,
        guestName: payment.ticket.guestName,
        ticketId: payment.ticketId,
        reason:
          'The last seat went while your payment was going through. Your R150 will be refunded.',
      }).catch((error) => console.error('[email] refund notice failed', error));

      console.warn(`[payments] refund required for ${payment.ticket.ticketNumber}`);
      return { handled: true, result: 'refund-required' };
    }

    // Only the first webhook sends an email. Replays are silent.
    if (!alreadyConfirmed) {
      await deliverTicket(ticket, payment.ticket.email).catch((error) => {
        console.error('[email] ticket delivery failed', error);
      });
    }

    return { handled: true, result: alreadyConfirmed ? 'already-confirmed' : 'confirmed' };
  }

  // Failed or cancelled — release the seat if it is still only held.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: verified.status === 'cancelled' ? 'CANCELLED' : 'FAILED',
      failureReason: verified.reason,
      transactionId: verified.transactionId ?? undefined,
      rawPayload: verified.raw,
    },
  });

  if (payment.ticket.status === TicketStatus.PENDING) {
    await releaseSeat(
      payment.ticketId,
      verified.status === 'cancelled' ? TicketStatus.CANCELLED : TicketStatus.FAILED,
      verified.reason,
    );

    await notifyPaymentFailed({
      email: payment.ticket.email,
      guestName: payment.ticket.guestName,
      ticketId: payment.ticketId,
      reason: verified.reason,
    }).catch((error) => console.error('[email] failure notice failed', error));
  }

  return { handled: true, result: 'released' };
}
