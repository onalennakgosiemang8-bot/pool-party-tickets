/* eslint-disable no-console */
/**
 * End-to-end verification of the fifteen rules that matter.
 *
 *   1  terminal:  PAYMENT_PROVIDER=mock EMAIL_MODE=test npm run dev
 *   2  terminal:  npm run verify -- --reset
 *
 * --reset wipes every ticket, payment, check-in and guest for this event
 * first, so run it against a development database only. It never touches
 * organiser accounts.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = (process.env.VERIFY_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const EVENT_SLUG = 'parks-splash-2026';

let passed = 0;
let failed = 0;
let cookie = '';

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✕ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function api(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function buy(name: string, email: string) {
  const res = await api('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({
      fullName: name,
      email,
      phone: '0821234567',
      confirmInvited: true,
      confirmEntranceFee: true,
      confirmInviteOnly: true,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function pay(ref: string, outcome: 'paid' | 'failed' = 'paid') {
  const res = await fetch(`${BASE}/api/payments/mock/complete`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
    body: new URLSearchParams({ ref, outcome }).toString(),
  });
  return res.status;
}

async function qrPayloadFor(ticketId: string) {
  const t = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  return `PSWP1.${t.ticketNumber}.${t.qrToken}.${t.qrSignature}`;
}

async function reset() {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: EVENT_SLUG } });
  await prisma.checkIn.deleteMany({});
  await prisma.emailLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.ticket.deleteMany({ where: { eventId: event.id } });
  await prisma.guest.deleteMany({});
  await prisma.webhookEvent.deleteMany({});
  await prisma.event.update({ where: { id: event.id }, data: { lastTicketSeq: 0 } });
  console.log('· Cleared tickets, payments, check-ins and guests for this event.\n');
}

async function main() {
  if (!process.argv.includes('--reset')) {
    console.error('Refusing to run without --reset (this script writes test data).');
    process.exit(1);
  }

  const ping = await fetch(`${BASE}/api/availability`).catch(() => null);
  if (!ping?.ok) {
    console.error(`No app at ${BASE}. Start it with: PAYMENT_PROVIDER=mock npm run dev`);
    process.exit(1);
  }

  await reset();
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: EVENT_SLUG } });
  const capacity = event.capacity;

  // ── 1–3 · First ticket, generated with the guest's name and a QR ──
  console.log('Guest journey');
  const first = await buy('Nomsa Dlamini', 'nomsa@verify.local');
  check('1 · guest can reserve ticket #1', first.status === 200, `status ${first.status}`);
  await pay(first.body.merchantRef);

  const t1 = await prisma.ticket.findUniqueOrThrow({ where: { id: first.body.ticketId } });
  check('2 · ticket carries the guest name', t1.guestName === 'Nomsa Dlamini');
  check('2 · ticket number is PARKS-0001', t1.ticketNumber === 'PARKS-0001', t1.ticketNumber);
  check('2 · ticket is CONFIRMED after payment', t1.status === 'CONFIRMED', t1.status);

  const ticketPage = await fetch(`${BASE}/ticket/${t1.id}`);
  const html = await ticketPage.text();
  check('3 · ticket page renders the name and QR', html.includes('Nomsa Dlamini') && html.includes('data:image/png'));

  // ── 4–6 · Dashboard reflects the sale ──
  console.log('\nAdmin dashboard');
  const noAuth = await api('/api/admin/stats');
  check('14 · stats API rejects anonymous callers', noAuth.status === 401, `status ${noAuth.status}`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const login = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const setCookie = login.headers.get('set-cookie') ?? '';
    cookie = setCookie.split(';')[0];
    check('14 · organiser can sign in', login.status === 200 && cookie.length > 10);

    const stats = await api('/api/admin/stats').then((r) => r.json());
    check('4 · guest appears in the dashboard', stats.sold === 1, `sold ${stats.sold}`);
    check('5 · counter reads 1 / 55', stats.sold === 1 && stats.capacity === capacity);
    check('6 · revenue reads R150', stats.revenueCents === 15000, `${stats.revenueCents}`);

    const guests = await api('/api/admin/guests').then((r) => r.json());
    check('15 · guest list is served only to signed-in organisers', guests.guests[0].email === 'nomsa@verify.local');
  } else {
    console.log('  … ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping signed-in checks');
  }

  // ── 7–8 · Check-in, once and only once ──
  console.log('\nCheck-in');
  const payload = await qrPayloadFor(t1.id);
  const scan1 = await api('/api/admin/check-in', { method: 'POST', body: JSON.stringify({ payload }) });
  const r1 = await scan1.json();
  check('7 · valid ticket checks in', r1.result === 'valid', JSON.stringify(r1));

  const scan2 = await api('/api/admin/check-in', { method: 'POST', body: JSON.stringify({ payload }) });
  const r2 = await scan2.json();
  check('8 · the same QR cannot check in twice', r2.result === 'already', JSON.stringify(r2));

  const forged = await api('/api/admin/check-in', {
    method: 'POST',
    body: JSON.stringify({ payload: 'PSWP1.PARKS-0001.not-a-real-token.deadbeef' }),
  });
  check('8 · forged QR is rejected', (await forged.json()).result === 'invalid');

  // ── 9 · A failed payment must not take a seat ──
  console.log('\nPayments');
  const failedBuy = await buy('Sipho Khumalo', 'sipho@verify.local');
  await pay(failedBuy.body.merchantRef, 'failed');
  const failedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: failedBuy.body.ticketId } });
  check('9 · failed payment leaves no confirmed ticket', failedTicket.status === 'FAILED', failedTicket.status);

  const afterFail = await fetch(`${BASE}/api/availability`).then((r) => r.json());
  check('9 · failed payment frees the seat', afterFail.sold === 1 && afterFail.remaining === capacity - 1);

  // ── 13 · Duplicate notifications ──
  const dupRef = first.body.merchantRef;
  await pay(dupRef);
  await pay(dupRef);
  const dupTickets = await prisma.ticket.count({ where: { email: 'nomsa@verify.local', status: 'CONFIRMED' } });
  const dupPayments = await prisma.payment.count({ where: { ticketId: t1.id, status: 'PAID' } });
  check('13 · replayed payment makes no second ticket', dupTickets === 1, `${dupTickets}`);
  check('13 · replayed payment makes no second payment row', dupPayments === 1, `${dupPayments}`);

  // ── 10–11 · Filling the room ──
  console.log('\nCapacity');
  for (let i = 2; i <= capacity; i += 1) {
    const res = await buy(`Guest ${i}`, `guest${i}@verify.local`);
    if (res.status !== 200) {
      check(`10 · ticket ${i} could be purchased`, false, JSON.stringify(res.body));
      break;
    }
    await pay(res.body.merchantRef);
  }

  const full = await fetch(`${BASE}/api/availability`).then((r) => r.json());
  check(`10 · ticket ${capacity} can be purchased`, full.sold === capacity, `sold ${full.sold}`);
  check('10 · remaining reaches zero', full.remaining === 0 && full.soldOut === true);

  const overflow = await buy('One Too Many', 'overflow@verify.local');
  check(
    `11 · ticket ${capacity + 1} is refused`,
    overflow.status === 409 && overflow.body.code === 'SOLD_OUT',
    `status ${overflow.status}`,
  );

  const soldOutPage = await fetch(`${BASE}/tickets`, { redirect: 'manual' });
  check(
    '11 · the ticket page closes itself when sold out',
    soldOutPage.status === 307 || soldOutPage.status === 308 || soldOutPage.status === 302,
    `status ${soldOutPage.status}`,
  );

  // ── Late payment on a lapsed hold must not oversell ──
  await pay(failedBuy.body.merchantRef, 'paid');
  const latePaid = await prisma.ticket.findUniqueOrThrow({ where: { id: failedBuy.body.ticketId } });
  const afterLate = await fetch(`${BASE}/api/availability`).then((r) => r.json());
  check(
    '11 · a payment that lands after the room is full never becomes a 56th ticket',
    latePaid.status !== 'CONFIRMED' && afterLate.sold === capacity,
    `${latePaid.status}, sold ${afterLate.sold}`,
  );
  const flagged = await prisma.payment.findFirstOrThrow({ where: { ticketId: latePaid.id } });
  check('11 · that payment is flagged for refund', flagged.status === 'PAID' && !!flagged.failureReason);

  // ── 12 · Two people, one last seat ──
  const lastTicket = await prisma.ticket.findFirstOrThrow({
    where: { status: 'CONFIRMED' },
    orderBy: { createdAt: 'desc' },
  });
  await prisma.ticket.update({
    where: { id: lastTicket.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'verify: free one seat' },
  });

  const [a, b] = await Promise.all([
    buy('Racer A', 'racer-a@verify.local'),
    buy('Racer B', 'racer-b@verify.local'),
  ]);
  const winners = [a, b].filter((r) => r.status === 200).length;
  const losers = [a, b].filter((r) => r.status === 409).length;
  check('12 · only one of two simultaneous buyers gets the last seat', winners === 1 && losers === 1, `won ${winners}, lost ${losers}`);

  // ── 15 · Nothing personal leaks in public ──
  console.log('\nPrivacy');
  const publicAvailability = await fetch(`${BASE}/api/availability`).then((r) => r.text());
  check('15 · public availability exposes counts only', !publicAvailability.includes('@verify.local'));

  cookie = '';
  const guestsAnon = await api('/api/admin/guests');
  check('15 · guest list is 401 without a session', guestsAnon.status === 401, `status ${guestsAnon.status}`);

  const dashAnon = await fetch(`${BASE}/admin/dashboard`, { redirect: 'manual' });
  check(
    '14 · dashboard redirects anonymous visitors to sign in',
    [302, 307, 308].includes(dashAnon.status),
    `status ${dashAnon.status}`,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  await reset();
  if (failed > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
