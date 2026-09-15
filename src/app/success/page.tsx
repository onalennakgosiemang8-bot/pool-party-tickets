import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { toPublic } from '@/lib/tickets';
import { qrDataUrl } from '@/lib/qr';
import { EVENT } from '@/lib/event';
import { TicketPass } from '@/components/TicketPass';
import { WaitingForPayment } from '@/components/WaitingForPayment';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment received', robots: { index: false, follow: false } };

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const payment = ref
    ? await prisma.payment.findUnique({ where: { merchantRef: ref }, include: { ticket: true } })
    : null;

  if (!payment) {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-foam">We could not find that booking</h1>
        <p className="mt-3 text-foam/70">
          If you have just paid, check your email — your ticket is sent there the moment PayFast
          confirms the payment.
        </p>
        <Link href="/tickets" className="mt-8 inline-block text-aqua underline">
          Back to tickets
        </Link>
      </Shell>
    );
  }

  const ticket = toPublic(payment.ticket);

  // PayFast returns the guest here immediately, but the ITN webhook is what
  // actually confirms the ticket. If it has not landed yet, poll for it.
  if (ticket.status !== 'CONFIRMED') {
    return (
      <Shell>
        <WaitingForPayment merchantRef={payment.merchantRef} ticketId={ticket.id} />
      </Shell>
    );
  }

  const qr = await qrDataUrl(ticket.qrPayload);

  return (
    <main className="relative min-h-dvh">
      <WaterBackdrop />
      <div className="relative mx-auto max-w-lg px-5 py-12 text-center">
        <p className="font-display text-sm tracking-[0.34em] text-gold">PAYMENT RECEIVED</p>
        <h1 className="mt-4 font-display text-4xl leading-tight text-foam">
          You&rsquo;re in, {ticket.guestName.split(' ')[0]}
        </h1>
        <p className="mt-3 text-foam/70">
          Ticket #{ticket.ticketNumber} is confirmed and on its way to your inbox.
        </p>

        <div className="mt-9">
          <TicketPass
            ticketNumber={ticket.ticketNumber}
            guestName={ticket.guestName}
            status={ticket.status}
            amountCents={ticket.amountCents}
            qrDataUrl={qr}
          />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a
            href={`/api/tickets/${ticket.id}/pdf`}
            className="rounded-full bg-gold px-6 py-3.5 text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
          >
            Download ticket (PDF)
          </a>
          <Link
            href={`/ticket/${ticket.id}`}
            className="rounded-full border border-foam/25 px-6 py-3.5 text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
          >
            Open my ticket page
          </Link>
        </div>

        <p className="mt-8 text-sm text-foam/55">
          {EVENT.dateLong} · {EVENT.timeLabel}
          <br />
          {EVENT.venueFull}
        </p>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh">
      <WaterBackdrop ripples={false} />
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-16 text-center">
        {children}
      </div>
    </main>
  );
}
