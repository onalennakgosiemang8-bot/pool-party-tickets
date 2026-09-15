import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { toPublic } from '@/lib/tickets';
import { qrDataUrl } from '@/lib/qr';
import { EVENT } from '@/lib/event';
import { TicketPass } from '@/components/TicketPass';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your ticket', robots: { index: false, follow: false } };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.ticket.findUnique({ where: { id } });
  if (!record) notFound();

  const ticket = toPublic(record);
  const qr = await qrDataUrl(ticket.qrPayload);

  return (
    <main className="relative min-h-dvh">
      <WaterBackdrop ripples={false} />

      <div className="relative mx-auto max-w-lg px-5 py-10 sm:py-14">
        <Link
          href="/"
          className="no-print mb-6 inline-block text-sm text-foam/50 transition hover:text-aqua"
        >
          {EVENT.brand} · Splash Water Park Party
        </Link>

        {ticket.status !== 'CONFIRMED' && (
          <p className="no-print mb-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-goldlite">
            This ticket is {ticket.status.toLowerCase()} — it is not valid for entry until payment
            is confirmed.
          </p>
        )}

        <TicketPass
          ticketNumber={ticket.ticketNumber}
          guestName={ticket.guestName}
          status={ticket.status}
          amountCents={ticket.amountCents}
          qrDataUrl={qr}
          checkedIn={ticket.checkedIn}
        />

        <div className="no-print mt-7 grid gap-3 sm:grid-cols-2">
          <a
            href={`/api/tickets/${ticket.id}/pdf`}
            className="rounded-full bg-gold px-6 py-3.5 text-center text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
          >
            Download ticket (PDF)
          </a>
          <Link
            href="/event"
            className="rounded-full border border-foam/25 px-6 py-3.5 text-center text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
          >
            Event details
          </Link>
        </div>

        <p className="no-print mt-6 text-center text-xs leading-relaxed text-foam/45">
          Keep this link. Screenshots work too — the QR is what gets scanned. One ticket admits one
          guest and can only be checked in once.
        </p>
      </div>
    </main>
  );
}
