'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * PayFast bounces the guest back here before its ITN webhook necessarily
 * arrives. The frontend never decides the outcome — it just polls the
 * server until the server says the payment was verified.
 */
export function WaitingForPayment({
  merchantRef,
  ticketId,
}: {
  merchantRef: string;
  ticketId: string;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<string>('PENDING');

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 3), 3000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?ref=${encodeURIComponent(merchantRef)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        if (data.status === 'CONFIRMED') {
          clearInterval(poll);
          router.replace(`/ticket/${ticketId}`);
          router.refresh();
        }
      } catch {
        /* keep waiting */
      }
    }, 3000);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [merchantRef, ticketId, router]);

  const failed = status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED';

  if (failed) {
    return (
      <>
        <h1 className="font-display text-3xl text-foam">That payment did not go through</h1>
        <p className="mt-3 text-foam/70">
          Nothing was charged and your seat has been released back to the pool. You can try again —
          seats are first come, first served.
        </p>
        <a
          href="/checkout"
          className="mx-auto mt-8 inline-block rounded-full bg-gold px-8 py-4 text-sm font-extrabold tracking-wide text-abyss shadow-gold"
        >
          Try again
        </a>
      </>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="mx-auto h-16 w-16 animate-spin rounded-full border-2 border-aqua/25 border-t-aqua"
      />
      <h1 className="mt-8 font-display text-3xl text-foam">Confirming your payment</h1>
      <p className="mt-3 text-foam/70">
        We are waiting for PayFast to confirm this on our side. It usually takes a few seconds.
      </p>
      {elapsed > 45 && (
        <p className="mt-5 text-sm text-goldlite">
          Still going. Your seat is held — you can close this page and your ticket will arrive by
          email as soon as the payment clears.
        </p>
      )}
      <p className="mt-6 text-xs text-foam/40">Reference {merchantRef}</p>
    </>
  );
}
