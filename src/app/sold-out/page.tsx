import Link from 'next/link';
import { getAvailability } from '@/lib/capacity';
import { EVENT } from '@/lib/event';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sold out' };

export default async function SoldOutPage() {
  const a = await getAvailability();

  return (
    <>
      <SiteNav />
      <main className="relative">
        <WaterBackdrop />
        <section className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-5 py-20 text-center">
          <p className="font-display text-sm tracking-[0.34em] text-gold">
            {EVENT.dateLabel}
          </p>
          <h1 className="mt-5 font-display text-6xl leading-none text-gradient sm:text-8xl">
            SOLD OUT
          </h1>
          <p className="mt-6 text-lg text-foam/75">
            All {a.capacity} seats are taken. The guest list for the Splash Water Park Party is
            closed.
          </p>
          <p className="mt-3 text-foam/55">
            If someone cancels, an organiser can release their seat. Message the organiser directly
            if you would like to be next in line.
          </p>

          <div className="mx-auto mt-10 grid w-full max-w-sm grid-cols-2 gap-4">
            <div className="glass rounded-xl2 p-5">
              <p className="font-display text-4xl text-foam">{a.sold}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-foam/45">Confirmed</p>
            </div>
            <div className="glass rounded-xl2 p-5">
              <p className="font-display text-4xl text-gold">0</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-foam/45">Remaining</p>
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/event"
              className="rounded-full border border-foam/25 px-8 py-4 text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
            >
              See what you are missing
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
