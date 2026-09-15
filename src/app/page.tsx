import Image from 'next/image';
import Link from 'next/link';
import { getAvailability } from '@/lib/capacity';
import { EVENT, formatZAR } from '@/lib/event';
import { AvailabilityMeter } from '@/components/Availability';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { Timeline } from '@/components/Timeline';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';

const FACTS = [
  { label: 'Access', value: 'INVITE ONLY' },
  { label: 'Date', value: EVENT.dateLabel },
  { label: 'Time', value: EVENT.timeLabel },
  { label: 'Venue', value: `${EVENT.venueLine1} · ${EVENT.venueLine2}` },
  { label: 'Entrance', value: 'R150 PER PERSON' },
  { label: 'Capacity', value: '55 TICKETS ONLY' },
];

export default async function HomePage() {
  const availability = await getAvailability();

  return (
    <>
      <SiteNav active="home" />

      <main>
        {/* ── Hero: the real photograph of the splash park ──────── */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/hero-wide.jpg"
              alt="The splash water park at The Parks LifeStyle Apartments — pools, slides and palm trees"
              fill
              priority
              sizes="100vw"
              quality={85}
              className="object-cover object-center"
            />
            {/* Just enough shade for the words to read — the photo stays visible. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,24,43,0.78)_0%,rgba(4,24,43,0.45)_38%,rgba(4,24,43,0.88)_100%)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(100deg,rgba(4,24,43,0.9)_0%,rgba(4,24,43,0.55)_46%,rgba(4,24,43,0.15)_100%)]"
            />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-abyss/55 px-3 py-1.5 text-[11px] font-bold tracking-[0.2em] text-gold backdrop-blur-sm">
                INVITE ONLY · 55 GUESTS MAX
              </span>

              <h1 className="mt-6 font-display font-light leading-[0.9] text-foam [text-shadow:0_2px_30px_rgba(4,24,43,0.8)]">
                <span className="block text-[12vw] tracking-[0.12em] sm:text-6xl lg:text-7xl">
                  {EVENT.brand}
                </span>
                <span className="mt-2 block text-gradient text-[8vw] font-semibold leading-[1.02] sm:text-5xl lg:text-6xl">
                  Splash Water Park Party
                </span>
              </h1>

              <p className="mt-5 font-display text-lg italic text-aqua sm:text-xl">
                {EVENT.tagline}
              </p>

              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-sm text-foam">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/50">Date</dt>
                  <dd className="mt-0.5 font-semibold">{EVENT.dateLabel}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/50">Time</dt>
                  <dd className="mt-0.5 font-semibold">{EVENT.timeLabel}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-foam/50">Venue</dt>
                  <dd className="mt-0.5 font-semibold">
                    {EVENT.venueLine1}
                    <br />
                    {EVENT.venueLine2}
                  </dd>
                </div>
              </dl>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={availability.soldOut ? '/sold-out' : '/tickets'}
                  className="rounded-full bg-gold px-8 py-4 text-center text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
                >
                  {availability.soldOut
                    ? 'SOLD OUT'
                    : `GET YOUR TICKET — ${formatZAR(EVENT.priceCents)}`}
                </Link>
                <Link
                  href="/event"
                  className="rounded-full border border-foam/30 bg-abyss/40 px-8 py-4 text-center text-sm font-semibold text-foam backdrop-blur-sm transition hover:border-aqua/60"
                >
                  What happens on the day
                </Link>
              </div>

              <div className="mt-9 max-w-md">
                <AvailabilityMeter initial={availability} />
              </div>
            </div>

            {/* The invitation itself, unaltered. */}
            <div className="mx-auto w-full max-w-[22rem] lg:max-w-sm">
              <Image
                src="/hero.jpg"
                alt="The Parks Splash Water Park Party invitation — 03 October 2026, 13:00 to 22:00, invite only, R150 per guest"
                width={1024}
                height={1536}
                sizes="(max-width: 1024px) 88vw, 384px"
                quality={88}
                priority
                className="h-auto w-full rounded-xl2 border border-gold/40 shadow-glass"
              />
              <p className="mt-3 text-center text-xs text-foam/55">
                Your invitation · {EVENT.dateLong}
              </p>
            </div>
          </div>
        </section>

        {/* ── The six facts, stated plainly ─────────────────────── */}
        <section className="border-y border-foam/10 bg-abyss/70">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-foam/10 sm:grid-cols-3 lg:grid-cols-6">
            {FACTS.map((f) => (
              <div key={f.label} className="bg-abyss px-4 py-5">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-foam/45">{f.label}</dt>
                <dd className="mt-1.5 text-sm font-bold leading-snug tracking-wide text-foam">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Invitation ───────────────────────────────────────── */}
        <section className="relative mx-auto max-w-3xl px-5 py-20 sm:py-28">
          <Reveal>
            <p className="font-display text-sm tracking-[0.34em] text-gold">YOU&rsquo;RE INVITED</p>
            <div className="gold-rule mt-4 w-24" />
            <div className="mt-7 space-y-5 text-lg leading-relaxed text-foam/80">
              <p>Dear Guest,</p>
              <p>
                You are cordially invited to an exclusive celebration at The Parks LifeStyle
                Apartments &mdash; Splash Water Park.
              </p>
              <p>
                Enjoy a full day and evening of swimming, food, drinks, games and great company.
                Food and liquor will be provided throughout the event.
              </p>
              <p className="text-foam/60">
                This is an invite-only event. Guests are required to contribute{' '}
                {formatZAR(EVENT.priceCents)} for splash park entrance.
              </p>
            </div>
            <p className="mt-10 font-display text-2xl text-gradient sm:text-3xl">{EVENT.motto}</p>
          </Reveal>
        </section>

        {/* ── Schedule ─────────────────────────────────────────── */}
        <section className="relative border-y border-foam/10 bg-abyss/40">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
            <Reveal>
              <h2 className="font-display text-3xl text-foam sm:text-4xl">One day. One night.</h2>
              <p className="mt-2 text-foam/60">Swim. Eat. Play. Connect.</p>
            </Reveal>
            <Reveal delay={80} className="mt-10">
              <Timeline />
            </Reveal>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <WaterBackdrop />
          <Reveal>
            <h2 className="relative font-display text-3xl leading-tight text-foam sm:text-5xl">
              Good food. Good drinks.
              <br />
              Great people.
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-foam/65">
              Fifty-five tickets, and that is the whole guest list. Claim yours before someone else
              does.
            </p>
            <Link
              href={availability.soldOut ? '/sold-out' : '/tickets'}
              className="relative mt-8 inline-block rounded-full bg-gold px-10 py-4 text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
            >
              {availability.soldOut
                ? 'SOLD OUT'
                : `GET YOUR TICKET — ${formatZAR(EVENT.priceCents)}`}
            </Link>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
