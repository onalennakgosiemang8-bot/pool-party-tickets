import 'server-only';
import { env } from './env';
import { sendEmail, ticketEmail, paymentFailedEmail, cancellationEmail } from './email';
import { buildTicketPdf } from './pdf';
import { qrPngBuffer } from './qr';
import type { PublicTicket } from './tickets';

/** Delivers the ticket: HTML email + inline QR + attached PDF pass. */
export async function deliverTicket(ticket: PublicTicket, email: string) {
  const ticketUrl = `${env.siteUrl()}/ticket/${ticket.id}`;
  const qrCid = `qr-${ticket.ticketNumber}`;

  const [qrPng, pdf] = await Promise.all([
    qrPngBuffer(ticket.qrPayload, 480),
    buildTicketPdf({
      ticketNumber: ticket.ticketNumber,
      guestName: ticket.guestName,
      amountCents: ticket.amountCents,
      qrPayload: ticket.qrPayload,
    }),
  ]);

  const message = ticketEmail({
    guestName: ticket.guestName,
    ticketNumber: ticket.ticketNumber,
    ticketUrl,
    qrCid,
    amountCents: ticket.amountCents,
  });

  return sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    template: 'ticket',
    ticketId: ticket.id,
    attachments: [
      { filename: `${qrCid}.png`, content: qrPng, contentType: 'image/png', cid: qrCid },
      {
        filename: `${ticket.ticketNumber}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function notifyPaymentFailed(opts: {
  email: string;
  guestName: string;
  ticketId: string;
  reason: string;
}) {
  const message = paymentFailedEmail({
    guestName: opts.guestName,
    reason: opts.reason,
    retryUrl: `${env.siteUrl()}/checkout`,
  });
  return sendEmail({
    to: opts.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    template: 'payment-failed',
    ticketId: opts.ticketId,
  });
}

export async function notifyCancelled(opts: {
  email: string;
  guestName: string;
  ticketId: string;
  ticketNumber: string;
  refunded: boolean;
}) {
  const message = cancellationEmail({
    guestName: opts.guestName,
    ticketNumber: opts.ticketNumber,
    refunded: opts.refunded,
  });
  return sendEmail({
    to: opts.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    template: 'cancellation',
    ticketId: opts.ticketId,
  });
}
