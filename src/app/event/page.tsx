import Image from 'next/image';
import Link from 'next/link';
import { getAvailability } from '@/lib/capacity';
import { EVENT, RULES, formatZAR } from '@/lib/event';
import { AvailabilityMeter } from '@/components/Availability';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { Timeline } from '@/components/Timeline';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The day' };

export default async function EventPage() {
  const availability = await getAvailability();

  return (
    <>
      <SiteNav active="event" />
      <main className="relative">
        <WaterBackdrop ripples={false} />

        <section className="relative mx-auto grid max-w-4xl gap-10 px-5 pb-14 pt-16 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="font-display text-sm tracking-[0.34em] text-gold">THE DAY</p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-foam sm:text-6xl">
              Everything you need to know
            </h1>
            <p className="mt-4 max-w-xl text-lg text-foam/70">
              {EVENT.dateLong} · {EVENT.timeLabel} · {EVENT.venueFull}
            </p>
            <p className="mt-3 text-sm font-semibold tracking-wide text-aqua">
              INVITE ONLY · R150 PER PERSON · 55 TICKETS ONLY
            </p>
          </div>

          <Image
            src="/hero.jpg"
            alt="The Parks Splash Water Park Party invitation"
            width={1024}
            height={1536}
            sizes="(max-width: 1024px) 88vw, 360px"
            className="mx-auto h-auto w-full max-w-[20rem] rounded-xl2 border border-gold/40 shadow-glass"
          />
        </section>

        <section className="relative mx-auto max-w-4xl px-5 pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { k: 'Entrance', v: formatZAR(EVENT.priceCents), d: 'per guest' },
              { k: 'Food', v: 'Provided', d: 'Braai from 17:00' },
              { k: 'Liquor', v: 'Provided', d: 'All evening' },
            ].map((c) => (
              <div key={c.k} className="glass rounded-xl2 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-foam/45">{c.k}</p>
                <p className="mt-2 font-display text-2xl text-foam">{c.v}</p>
                <p className="text-sm text-foam/55">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-4xl px-5 pb-20">
          <Reveal>
            <h2 className="font-display text-3xl text-foam">The running order</h2>
          </Reveal>
          <Reveal delay={60} className="mt-8">
            <Timeline />
          </Reveal>
        </section>

        <section className="relative border-y border-foam/10 bg-abyss/40">
          <div className="mx-auto max-w-4xl px-5 py-16">
            <h2 className="font-display text-3xl text-foam">House rules</h2>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-3 text-foam/75">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative mx-auto max-w-4xl px-5 py-16">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <AvailabilityMeter initial={availability} />
            <div>
              <h2 className="font-display text-3xl leading-tight text-foam">
                Fifty-five seats. That is the guest list.
              </h2>
              <p className="mt-3 text-foam/65">
                Once the counter hits 55 the page closes itself and no further tickets can be
                bought.
              </p>
              <Link
                href={availability.soldOut ? '/sold-out' : '/tickets'}
                className="mt-6 inline-block rounded-full bg-gold px-8 py-4 text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
              >
                {availability.soldOut
                  ? 'SOLD OUT'
                  : `GET YOUR TICKET — ${formatZAR(EVENT.priceCents)}`}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
