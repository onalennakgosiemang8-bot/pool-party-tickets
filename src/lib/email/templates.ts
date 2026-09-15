import { EVENT, formatZAR } from '../event';
import { escapeHtml } from '../validation';

type TicketEmailData = {
  guestName: string;
  ticketNumber: string;
  ticketUrl: string;
  qrCid: string; // inline image reference
  amountCents: number;
};

const SHELL = (inner: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${EVENT.brand} — ${EVENT.name}</title></head>
<body style="margin:0;padding:0;background:#04182B;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04182B;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#073B63;border-radius:22px;overflow:hidden;border:1px solid rgba(216,177,94,.35);">
${inner}
</table>
<p style="color:#7FE3E8;font-size:11px;line-height:1.6;margin:20px auto 0;max-width:480px;">
${EVENT.venueFull} · ${EVENT.dateLabel}<br>Invite only. One ticket admits one guest.
</p>
</td></tr></table></body></html>`;

const HEADER = `
<tr><td style="background:linear-gradient(135deg,#073B63,#1FA8E0);padding:30px 30px 24px;">
  <div style="color:#EFD8A0;font-size:12px;letter-spacing:.34em;">${EVENT.brand}</div>
  <div style="color:#ffffff;font-size:26px;font-weight:700;letter-spacing:.02em;margin-top:6px;">${EVENT.name}</div>
  <div style="color:#7FE3E8;font-size:13px;margin-top:8px;">${EVENT.dateLabel} · ${EVENT.timeLabel}</div>
</td></tr>`;

const detailRow = (label: string, value: string) => `
<tr>
  <td style="padding:9px 0;color:#7FE3E8;font-size:12px;width:40%;">${label}</td>
  <td style="padding:9px 0;color:#ffffff;font-size:14px;font-weight:600;">${value}</td>
</tr>`;

export function ticketEmail(data: TicketEmailData) {
  const name = escapeHtml(data.guestName);
  return {
    subject: 'Your Ticket – The Parks Splash Water Park Party',
    html: SHELL(`${HEADER}
<tr><td style="padding:28px 30px 8px;">
  <p style="color:#ffffff;font-size:16px;margin:0 0 6px;">Hi ${name}, you're on the list.</p>
  <p style="color:#BFE6FF;font-size:14px;line-height:1.65;margin:0 0 22px;">
    Payment received. Your ticket is below — show the QR code at the gate and we'll scan you in.
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(4,24,43,.55);border-radius:16px;padding:18px 20px;">
    ${detailRow('Guest', name)}
    ${detailRow('Ticket', `#${data.ticketNumber}`)}
    ${detailRow('Date', EVENT.dateLabel)}
    ${detailRow('Time', EVENT.timeLabel)}
    ${detailRow('Venue', `${EVENT.venueLine1}<br>${EVENT.venueLine2}`)}
    ${detailRow('Amount paid', formatZAR(data.amountCents))}
    ${detailRow('Status', '<span style="color:#7FE3E8;">CONFIRMED</span>')}
  </table>
</td></tr>
<tr><td align="center" style="padding:24px 30px 6px;">
  <div style="background:#ffffff;border-radius:18px;padding:16px;display:inline-block;">
    <img src="cid:${data.qrCid}" width="190" height="190" alt="Your entry QR code" style="display:block;">
  </div>
  <p style="color:#7FE3E8;font-size:12px;margin:12px 0 0;">Ticket #${data.ticketNumber}</p>
</td></tr>
<tr><td align="center" style="padding:18px 30px 30px;">
  <a href="${data.ticketUrl}" style="display:inline-block;background:#D8B15E;color:#04182B;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">View or download your ticket</a>
  <p style="color:#9CC9E8;font-size:12px;line-height:1.6;margin:18px 0 0;">
    Food and liquor are provided. Bring a towel and swimwear.<br>Keep this email — it's your entry.
  </p>
</td></tr>`),
    text: `Hi ${data.guestName}, you're on the list.

${EVENT.brand} — ${EVENT.name}
Ticket: #${data.ticketNumber}
Date: ${EVENT.dateLabel}
Time: ${EVENT.timeLabel}
Venue: ${EVENT.venueFull}
Amount paid: ${formatZAR(data.amountCents)}
Status: CONFIRMED

View or download your ticket: ${data.ticketUrl}

Show the QR code on your ticket at the gate. Food and liquor provided.`,
  };
}

export function paymentFailedEmail(data: { guestName: string; reason: string; retryUrl: string }) {
  const name = escapeHtml(data.guestName);
  return {
    subject: 'Payment unsuccessful – The Parks Splash Water Park Party',
    html: SHELL(`${HEADER}
<tr><td style="padding:28px 30px 30px;">
  <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">Hi ${name}, that payment didn't go through.</p>
  <p style="color:#BFE6FF;font-size:14px;line-height:1.65;margin:0 0 18px;">
    Nothing was charged and your seat has been released back to the 55.
    ${escapeHtml(data.reason)}
  </p>
  <a href="${data.retryUrl}" style="display:inline-block;background:#1FA8E0;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 26px;border-radius:999px;">Try again</a>
</td></tr>`),
    text: `Hi ${data.guestName}, that payment didn't go through. Nothing was charged and your seat has been released. ${data.reason}\n\nTry again: ${data.retryUrl}`,
  };
}

export function cancellationEmail(data: {
  guestName: string;
  ticketNumber: string;
  refunded: boolean;
}) {
  const name = escapeHtml(data.guestName);
  return {
    subject: `Ticket #${data.ticketNumber} cancelled – The Parks Splash Water Park Party`,
    html: SHELL(`${HEADER}
<tr><td style="padding:28px 30px 30px;">
  <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">Hi ${name}, your ticket has been cancelled.</p>
  <p style="color:#BFE6FF;font-size:14px;line-height:1.65;margin:0;">
    Ticket #${data.ticketNumber} is no longer valid for entry.
    ${data.refunded ? 'Your R150 will be refunded to the account you paid from.' : 'Speak to the organiser about a refund.'}
  </p>
</td></tr>`),
    text: `Hi ${data.guestName}, ticket #${data.ticketNumber} has been cancelled and is no longer valid for entry.`,
  };
}
