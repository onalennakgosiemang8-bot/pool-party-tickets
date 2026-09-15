import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAvailability } from '@/lib/capacity';
import { EVENT, SCHEDULE, formatZAR } from '@/lib/event';
import { AvailabilityMeter } from '@/components/Availability';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Get your ticket' };

export default async function TicketsPage() {
  const availability = await getAvailability();
  if (availability.soldOut) redirect('/sold-out');

  return (
    <>
      <SiteNav active="tickets" />
      <main className="relative">
        <WaterBackdrop />
        <section className="relative mx-auto max-w-4xl px-5 py-16 sm:py-20">
          <p className="font-display text-sm tracking-[0.34em] text-gold">YOUR TICKET</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-foam sm:text-6xl">
            One guest, one ticket, {formatZAR(EVENT.priceCents)}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-foam/70">
            Pay online, get your pass with a QR code straight away, and walk in at the gate.
          </p>

          <div className="relative mt-8 aspect-[21/9] w-full overflow-hidden rounded-xl2 border border-foam/15 sm:aspect-[21/7]">
            <Image
              src="/hero-wide.jpg"
              alt="The splash water park at The Parks LifeStyle Apartments"
              fill
              sizes="(max-width: 896px) 92vw, 896px"
              className="object-cover object-center"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(4,24,43,0.75))]"
            />
            <p className="absolute bottom-4 left-5 text-sm font-semibold tracking-wide text-foam">
              INVITE ONLY · {EVENT.dateLabel} · {EVENT.timeLabel}
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_1fr]">
            <AvailabilityMeter initial={availability} />

            <div className="glass-dark rounded-xl2 p-6">
              <h2 className="font-display text-xl text-foam">What {formatZAR(EVENT.priceCents)} covers</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-foam/75">
                {[
                  'Splash park entrance for the full day',
                  'Braai, sides and snacks',
                  'Liquor and drinks all evening',
                  'Games night with prizes',
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-aqua" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/checkout"
                className="mt-7 block rounded-full bg-gold px-6 py-4 text-center text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
              >
                CONTINUE TO CHECKOUT
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-4">
            {SCHEDULE.map((s) => (
              <div key={s.title} className="glass rounded-xl2 p-4">
                <p className="text-xs font-semibold text-aqua">{s.time}</p>
                <p className="mt-1 font-display text-lg leading-tight text-foam">{s.title}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
