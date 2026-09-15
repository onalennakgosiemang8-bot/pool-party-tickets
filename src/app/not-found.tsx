import Link from 'next/link';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export default function NotFound() {
  return (
    <main className="relative min-h-dvh">
      <WaterBackdrop ripples={false} />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
        <p className="font-display text-sm tracking-[0.34em] text-gold">NOTHING HERE</p>
        <h1 className="mt-4 font-display text-4xl text-foam">This page is out of the pool</h1>
        <p className="mt-3 text-foam/65">
          The link may be old, or the ticket it pointed to was cancelled.
        </p>
        <Link href="/" className="mt-8 text-aqua underline underline-offset-4">
          Back to the event
        </Link>
      </div>
    </main>
  );
}
