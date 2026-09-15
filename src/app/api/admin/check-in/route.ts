import { audit, requireAdminApi } from '@/lib/auth';
import { parseQrPayload } from '@/lib/qr';
import { checkInByToken } from '@/lib/tickets';
import { scanSchema } from '@/lib/validation';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { badOrigin, isSameOrigin, noStore, tooMany } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scan endpoint. Verifies the HMAC on the QR before touching the database,
 * then claims the check-in with a conditional update, so the same ticket
 * can never be checked in twice — even by two scanners at once.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return badOrigin();

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limit = await rateLimit({
    key: `scan:${clientIp(request.headers)}`,
    limit: 240,
    windowSeconds: 60,
  });
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = scanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { result: 'invalid', message: 'Nothing readable in that code.' },
      { headers: noStore },
    );
  }

  const qr = parseQrPayload(parsed.data.payload);
  if (!qr) {
    return Response.json(
      { result: 'invalid', message: 'Not a ticket for this event.' },
      { headers: noStore },
    );
  }

  const outcome = await checkInByToken(qr.token, auth.admin.id, 'qr');

  if (outcome.result === 'invalid') {
    return Response.json(
      { result: 'invalid', message: 'This code is not on the guest list.' },
      { headers: noStore },
    );
  }

  // Belt and braces: the number printed on the pass must match the record.
  if (outcome.ticket.ticketNumber !== qr.ticketNumber) {
    return Response.json(
      { result: 'invalid', message: 'Ticket number does not match this code.' },
      { headers: noStore },
    );
  }

  const base = {
    ticketId: outcome.ticket.id,
    ticketNumber: outcome.ticket.ticketNumber,
    guestName: outcome.ticket.guestName,
    status: outcome.ticket.status,
  };

  switch (outcome.result) {
    case 'valid':
      await audit({
        actorId: auth.admin.id,
        actorName: auth.admin.name,
        action: 'checkin',
        target: outcome.ticket.ticketNumber,
      });
      return Response.json(
        {
          result: 'valid',
          message: 'Valid ticket — let them in.',
          checkedInAt: outcome.checkedInAt,
          ...base,
        },
        { headers: noStore },
      );

    case 'already':
      return Response.json(
        {
          result: 'already',
          message: 'Already checked in.',
          checkedInAt: outcome.checkedInAt,
          ...base,
        },
        { headers: noStore },
      );

    case 'cancelled':
      return Response.json(
        { result: 'cancelled', message: 'This ticket was cancelled.', ...base },
        { headers: noStore },
      );

    default:
      return Response.json(
        { result: 'unpaid', message: 'Payment never completed — no entry.', ...base },
        { headers: noStore },
      );
  }
}
