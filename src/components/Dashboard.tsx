'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EVENT, formatZAR } from '@/lib/event';
import { AdminBar } from './AdminBar';
import { SalesChart } from './SalesChart';

type Stats = {
  capacity: number;
  sold: number;
  held: number;
  remaining: number;
  soldOut: boolean;
  checkedIn: number;
  notCheckedIn: number;
  revenueCents: number;
  purchaseRatePct: number;
  salesOverTime: { date: string; count: number; cumulative: number }[];
};

type Guest = {
  row: number;
  id: string;
  ticketNumber: string;
  guestName: string;
  email: string;
  phone: string;
  emergencyContact: string | null;
  amountCents: number;
  ticketStatus: string;
  paymentStatus: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  purchasedAt: string;
};

export function Dashboard({ adminName }: { adminName: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [checked, setChecked] = useState('all');
  const [showSales, setShowSales] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGuests = useCallback(async () => {
    const params = new URLSearchParams({ q: query, status, checked });
    const res = await fetch(`/api/admin/guests?${params}`, { cache: 'no-store' });
    if (res.ok) setGuests((await res.json()).guests);
  }, [query, status, checked]);

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats', { cache: 'no-store' });
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 30_000);
    return () => clearInterval(id);
  }, [loadStats]);

  useEffect(() => {
    const id = setTimeout(loadGuests, 200); // debounce the search box
    return () => clearTimeout(id);
  }, [loadGuests]);

  async function act(guest: Guest, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(guest.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${guest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? 'That action did not go through.');
      await Promise.all([loadGuests(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  const cards = useMemo(
    () => [
      { label: 'Capacity', value: stats?.capacity ?? EVENT.capacity, tone: 'foam' },
      { label: 'Tickets sold', value: stats?.sold ?? '—', tone: 'aqua' },
      { label: 'Remaining', value: stats?.remaining ?? '—', tone: 'gold' },
      {
        label: 'Revenue',
        value: stats ? formatZAR(stats.revenueCents) : '—',
        tone: 'foam',
      },
      { label: 'Checked in', value: stats?.checkedIn ?? '—', tone: 'aqua' },
      { label: 'Not checked in', value: stats?.notCheckedIn ?? '—', tone: 'foam' },
    ],
    [stats],
  );

  const pct = stats ? Math.round((stats.sold / stats.capacity) * 100) : 0;

  return (
    <div className="min-h-dvh">
      <AdminBar adminName={adminName} active="dashboard" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header>
          <h1 className="font-display text-2xl leading-tight text-foam sm:text-3xl">
            {EVENT.brand} · Splash Water Park Party
          </h1>
          <p className="mt-1 text-sm text-foam/55">
            {EVENT.dateLong} · {EVENT.timeLabel}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="glass rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-foam/45">{c.label}</p>
              <p
                className={`mt-1.5 font-display text-2xl leading-none sm:text-3xl ${
                  c.tone === 'aqua' ? 'text-aqua' : c.tone === 'gold' ? 'text-gold' : 'text-foam'
                }`}
              >
                {c.value}
              </p>
            </div>
          ))}
        </section>

        <section className="glass mt-4 rounded-2xl p-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-foam/70">
              {stats?.sold ?? 0} / {stats?.capacity ?? EVENT.capacity} guests
            </span>
            <span className="text-foam/45">{pct}% of capacity</span>
          </div>
          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-foam/10"
            role="progressbar"
            aria-valuenow={stats?.sold ?? 0}
            aria-valuemin={0}
            aria-valuemax={stats?.capacity ?? EVENT.capacity}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#1FA8E0,#7FE3E8,#D8B15E)] transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {stats && stats.held > 0 && (
            <p className="mt-2 text-xs text-foam/50">
              Plus {stats.held} seat{stats.held === 1 ? '' : 's'} held mid-payment.
            </p>
          )}
        </section>

        <nav className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <a
            href="#guests"
            className="rounded-full border border-foam/20 px-4 py-3 text-center text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
          >
            View guests
          </a>
          <Link
            href="/admin/check-in"
            className="rounded-full bg-gold px-4 py-3 text-center text-sm font-extrabold text-abyss shadow-gold transition hover:bg-goldlite"
          >
            Scan ticket
          </Link>
          <a
            href="/api/admin/export"
            className="rounded-full border border-foam/20 px-4 py-3 text-center text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
          >
            Export CSV
          </a>
          <button
            onClick={() => setShowSales((v) => !v)}
            className="rounded-full border border-foam/20 px-4 py-3 text-center text-sm font-semibold text-foam/85 transition hover:border-aqua/60"
          >
            {showSales ? 'Hide sales' : 'View sales'}
          </button>
        </nav>

        {showSales && stats && (
          <section className="glass mt-4 rounded-2xl p-5">
            <h2 className="font-display text-lg text-foam">Tickets over time</h2>
            <SalesChart data={stats.salesOverTime} capacity={stats.capacity} />
          </section>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-goldlite">
            {error}
          </p>
        )}

        {/* ── Guest list ─────────────────────────────────────── */}
        <section id="guests" className="mt-8 scroll-mt-20">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl text-foam">Guest list</h2>
            <span className="text-sm text-foam/45">{guests.length} shown</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, mobile or ticket number"
              className="w-full rounded-xl border border-foam/15 bg-abyss/50 px-4 py-3 text-sm text-foam placeholder:text-foam/35 outline-none focus:border-aqua/60"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-foam/15 bg-abyss/50 px-4 py-3 text-sm text-foam outline-none focus:border-aqua/60"
            >
              <option value="all">All tickets</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Awaiting payment</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <select
              value={checked}
              onChange={(e) => setChecked(e.target.value)}
              className="rounded-xl border border-foam/15 bg-abyss/50 px-4 py-3 text-sm text-foam outline-none focus:border-aqua/60"
            >
              <option value="all">Any check-in</option>
              <option value="yes">Checked in</option>
              <option value="no">Not checked in</option>
            </select>
          </div>

          {guests.length === 0 ? (
            <p className="glass mt-4 rounded-2xl p-8 text-center text-foam/55">
              No guests match this view yet. The first ticket will appear here the moment a payment
              clears.
            </p>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="mt-4 space-y-3 md:hidden">
                {guests.map((g) => (
                  <li key={g.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg leading-tight text-foam">
                          {g.guestName}
                        </p>
                        <p className="text-xs text-foam/50">#{g.ticketNumber}</p>
                      </div>
                      <StatusPill guest={g} />
                    </div>
                    <p className="mt-2 break-all text-sm text-foam/60">{g.email}</p>
                    <p className="text-sm text-foam/60">{g.phone}</p>
                    <RowActions guest={g} busy={busyId === g.id} act={act} />
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-foam/10 md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-abyss/60 text-[11px] uppercase tracking-[0.14em] text-foam/45">
                    <tr>
                      {['#', 'Guest', 'Email', 'Mobile', 'Ticket', 'Payment', 'Check-in', 'Purchased', ''].map(
                        (h) => (
                          <th key={h} className="px-3 py-3 font-semibold">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foam/10">
                    {guests.map((g) => (
                      <tr key={g.id} className="align-top hover:bg-foam/[0.04]">
                        <td className="px-3 py-3 text-foam/40">{g.row}</td>
                        <td className="px-3 py-3 font-medium text-foam">{g.guestName}</td>
                        <td className="px-3 py-3 text-foam/65">{g.email}</td>
                        <td className="px-3 py-3 text-foam/65">{g.phone}</td>
                        <td className="px-3 py-3 text-gold">#{g.ticketNumber}</td>
                        <td className="px-3 py-3">
                          <StatusPill guest={g} />
                        </td>
                        <td className="px-3 py-3 text-foam/65">
                          {g.checkedIn
                            ? new Date(g.checkedInAt!).toLocaleTimeString('en-ZA', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-foam/50">
                          {new Date(g.purchasedAt).toLocaleDateString('en-ZA')}
                        </td>
                        <td className="px-3 py-3">
                          <RowActions guest={g} busy={busyId === g.id} act={act} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusPill({ guest }: { guest: Guest }) {
  const tone =
    guest.ticketStatus === 'CONFIRMED'
      ? 'bg-aqua/15 text-aqua ring-aqua/40'
      : guest.ticketStatus === 'PENDING'
        ? 'bg-gold/15 text-gold ring-gold/40'
        : 'bg-foam/10 text-foam/60 ring-foam/20';

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone}`}>
      {guest.ticketStatus === 'CONFIRMED' ? guest.paymentStatus : guest.ticketStatus}
      {guest.checkedIn && ' · IN'}
    </span>
  );
}

function RowActions({
  guest,
  busy,
  act,
  compact = false,
}: {
  guest: Guest;
  busy: boolean;
  act: (g: Guest, action: string, extra?: Record<string, unknown>) => Promise<void>;
  compact?: boolean;
}) {
  const btn =
    'rounded-full border border-foam/20 px-3 py-1.5 text-xs font-semibold text-foam/80 transition hover:border-aqua/60 disabled:opacity-40';

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
      <a className={btn} href={`/ticket/${guest.id}`} target="_blank" rel="noreferrer">
        Ticket
      </a>

      {guest.ticketStatus === 'CONFIRMED' &&
        (guest.checkedIn ? (
          <button className={btn} disabled={busy} onClick={() => act(guest, 'undo-check-in')}>
            Undo check-in
          </button>
        ) : (
          <button className={btn} disabled={busy} onClick={() => act(guest, 'check-in')}>
            Check in
          </button>
        ))}

      {guest.ticketStatus === 'CONFIRMED' && (
        <>
          <button
            className={btn}
            disabled={busy}
            onClick={() => {
              if (confirm(`Cancel ${guest.guestName}'s ticket and free the seat?`)) {
                act(guest, 'cancel', { refund: false });
              }
            }}
          >
            Cancel
          </button>
          <button
            className={btn}
            disabled={busy}
            onClick={() => {
              if (confirm(`Mark ${guest.ticketNumber} refunded and free the seat?`)) {
                act(guest, 'cancel', { refund: true });
              }
            }}
          >
            Refund
          </button>
          <button
            className={btn}
            disabled={busy}
            onClick={() => {
              const guestName = prompt('New guest name', guest.guestName);
              if (!guestName) return;
              const email = prompt('New email', guest.email);
              if (!email) return;
              const phone = prompt('New mobile', guest.phone);
              if (!phone) return;
              act(guest, 'transfer', { guestName, email, phone });
            }}
          >
            Transfer
          </button>
        </>
      )}
    </div>
  );
}
