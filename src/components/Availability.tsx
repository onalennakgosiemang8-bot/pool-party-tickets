'use client';

import { useEffect, useState } from 'react';

export type AvailabilityView = {
  capacity: number;
  sold: number;
  held: number;
  remaining: number;
  soldOut: boolean;
};

/**
 * Live seat counter. The server render is already correct; polling only
 * keeps a page that stays open honest. The server is still the authority —
 * the checkout endpoint re-checks capacity under a row lock.
 */
export function useAvailability(initial: AvailabilityView, intervalMs = 25_000) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/availability', { cache: 'no-store' });
        if (!res.ok) return;
        const next = (await res.json()) as AvailabilityView;
        if (alive) setData(next);
      } catch {
        /* offline — keep showing the last known figure */
      }
    };
    const id = setInterval(load, intervalMs);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);

  return data;
}

export function AvailabilityMeter({ initial }: { initial: AvailabilityView }) {
  const a = useAvailability(initial);
  const pct = Math.min(100, Math.round((a.sold / a.capacity) * 100));

  return (
    <div className="glass rounded-xl2 p-5 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-4xl leading-none text-foam sm:text-5xl">
            {a.sold}
            <span className="text-2xl text-foam/40"> / {a.capacity}</span>
          </p>
          <p className="mt-1 text-sm text-foam/70">tickets sold</p>
        </div>
        <div className="text-right">
          <p
            className={`font-display text-4xl leading-none sm:text-5xl ${
              a.remaining <= 5 ? 'text-gold' : 'text-aqua'
            }`}
          >
            {a.remaining}
          </p>
          <p className="mt-1 text-sm text-foam/70">
            {a.remaining === 1 ? 'ticket remaining' : 'tickets remaining'}
          </p>
        </div>
      </div>

      <div
        className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-foam/10"
        role="progressbar"
        aria-valuenow={a.sold}
        aria-valuemin={0}
        aria-valuemax={a.capacity}
        aria-label="Tickets sold"
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#1FA8E0,#7FE3E8,#D8B15E)] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-foam/55">
        {a.soldOut
          ? 'Every seat is taken.'
          : a.held > 0
            ? `${a.held} ${a.held === 1 ? 'seat is' : 'seats are'} held while guests finish paying.`
            : 'Seats are confirmed the moment payment clears.'}
      </p>
    </div>
  );
}

/** Compact inline counter for headers and the checkout summary. */
export function AvailabilityPill({ initial }: { initial: AvailabilityView }) {
  const a = useAvailability(initial);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-aqua/30 bg-abyss/50 px-3 py-1.5 text-xs font-semibold text-aqua">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua" />
      </span>
      {a.soldOut ? 'Sold out' : `${a.remaining} of ${a.capacity} left`}
    </span>
  );
}
