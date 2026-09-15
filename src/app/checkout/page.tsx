import { redirect } from 'next/navigation';
import { getAvailability } from '@/lib/capacity';
import { EVENT } from '@/lib/event';
import { CheckoutForm } from '@/components/CheckoutForm';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const availability = await getAvailability();
  if (availability.soldOut) redirect('/sold-out');

  return (
    <>
      <SiteNav active="tickets" />
      <main className="relative">
        <WaterBackdrop ripples={false} />
        <section className="relative mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <p className="font-display text-sm tracking-[0.34em] text-gold">CHECKOUT</p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-foam sm:text-5xl">
            {EVENT.brand} · Splash Water Park Party
          </h1>
          <p className="mt-3 text-foam/65">
            {EVENT.dateLong} · {EVENT.timeLabel}
          </p>

          <div className="mt-10">
            <CheckoutForm availability={availability} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
