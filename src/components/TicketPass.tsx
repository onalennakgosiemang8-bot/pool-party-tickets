import { EVENT, formatZAR } from '@/lib/event';

type Props = {
  ticketNumber: string;
  guestName: string;
  status: string;
  amountCents: number;
  qrDataUrl: string;
  checkedIn?: boolean;
};

/** The pass itself — shown on screen, and mirrored by the PDF generator. */
export function TicketPass({
  ticketNumber,
  guestName,
  status,
  amountCents,
  qrDataUrl,
  checkedIn = false,
}: Props) {
  const confirmed = status === 'CONFIRMED';

  return (
    <article className="mx-auto w-full max-w-sm overflow-hidden rounded-xl3 border border-gold/30 bg-[linear-gradient(165deg,#062A49,#04182B_55%,#073B63)] shadow-glass">
      <div className="relative px-6 pt-7 text-center">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(31,168,224,0.45),transparent_75%)]"
        />
        <p className="relative font-display text-sm tracking-[0.42em] text-gold">
          {EVENT.brand}
        </p>
        <h1 className="relative mt-1 font-display text-2xl leading-tight text-foam">
          Splash Water Park Party
        </h1>
        <p className="relative mt-1 text-[11px] tracking-[0.2em] text-aqua/80">
          {EVENT.tagline.toUpperCase()}
        </p>
        <div className="gold-rule mx-auto mt-5 w-4/5" />
      </div>

      <div className="px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Guest</p>
        <p className="mt-1 break-words font-display text-2xl text-foam">{guestName}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Date</dt>
            <dd className="mt-0.5 text-foam">{EVENT.dateLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Time</dt>
            <dd className="mt-0.5 text-foam">{EVENT.timeLabel}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Venue</dt>
            <dd className="mt-0.5 text-foam">
              {EVENT.venueLine1}
              <br />
              {EVENT.venueLine2}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Ticket</dt>
            <dd className="mt-0.5 font-semibold tracking-wide text-gold">#{ticketNumber}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/45">Amount</dt>
            <dd className="mt-0.5 text-foam">
              {formatZAR(amountCents)}
              {confirmed && <span className="ml-2 text-xs font-bold text-aqua">PAID</span>}
            </dd>
          </div>
        </dl>

        <p
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide ${
            confirmed
              ? 'bg-aqua/15 text-aqua ring-1 ring-aqua/40'
              : 'bg-gold/15 text-gold ring-1 ring-gold/40'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {confirmed ? (checkedIn ? 'PAID · CHECKED IN' : 'PAID · CONFIRMED') : status}
        </p>
      </div>

      <div
        aria-hidden
        className="ticket-notch h-px w-full border-t border-dashed border-foam/25"
      />

      <div className="bg-abyss/60 px-6 py-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={`Entry QR code for ticket ${ticketNumber}`}
          width={240}
          height={240}
          className="mx-auto h-56 w-56 rounded-2xl bg-white p-3 sm:h-60 sm:w-60"
        />
        <p className="mt-4 text-xs text-foam/55">
          Show this at the gate. One scan, one guest.
        </p>
        <p className="mt-1 text-[11px] tracking-[0.18em] text-foam/35">#{ticketNumber}</p>
      </div>
    </article>
  );
}
