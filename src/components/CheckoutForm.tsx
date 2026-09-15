'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EVENT, formatZAR } from '@/lib/event';
import { AvailabilityPill, type AvailabilityView } from './Availability';

type FieldErrors = Record<string, string>;

const CONFIRMATIONS = [
  { name: 'confirmInvited', label: 'I confirm that I have been invited to this event.' },
  {
    name: 'confirmEntranceFee',
    label: 'I understand that the R150 payment is for splash park entrance.',
  },
  { name: 'confirmInviteOnly', label: 'I understand that this is an invite-only event.' },
] as const;

export function CheckoutForm({ availability }: { availability: AvailabilityView }) {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    phone: '',
    emergencyContact: '',
  });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  /** Providers that need a form POST get one built here, then submitted. */
  const postToProvider = (url: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.style.display = 'none';
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, ...checks }),
      });
      const data = await res.json();

      if (res.status === 409 && data.code === 'SOLD_OUT') {
        router.push('/sold-out');
        return;
      }
      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? 'That did not go through. Check the form and try again.');
        setBusy(false);
        return;
      }

      if (data.redirect.method === 'POST') {
        postToProvider(data.redirect.url, data.redirect.fields ?? {});
      } else {
        window.location.href = data.redirect.url;
      }
    } catch {
      setFormError('No connection to the server. Check your signal and try again.');
      setBusy(false);
    }
  }

  const allConfirmed = CONFIRMATIONS.every((c) => checks[c.name]);
  const field =
    'mt-1.5 w-full rounded-xl border border-foam/15 bg-abyss/40 px-4 py-3 text-foam placeholder:text-foam/30 outline-none transition focus:border-aqua/60';

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1.15fr_1fr]" noValidate>
      <div className="glass rounded-xl2 p-6 sm:p-8">
        <h2 className="font-display text-2xl text-foam">Who is coming?</h2>
        <p className="mt-1 text-sm text-foam/60">
          Your name goes on the ticket exactly as you type it here.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block text-sm">
            <span className="text-foam/80">Full name</span>
            <input
              className={field}
              name="fullName"
              autoComplete="name"
              value={values.fullName}
              onChange={set('fullName')}
              placeholder="Thandi Mokoena"
              required
            />
            {errors.fullName && <Err msg={errors.fullName} />}
          </label>

          <label className="block text-sm">
            <span className="text-foam/80">Email address</span>
            <input
              className={field}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              onChange={set('email')}
              placeholder="you@email.com"
              required
            />
            {errors.email ? (
              <Err msg={errors.email} />
            ) : (
              <span className="mt-1 block text-xs text-foam/45">
                Your ticket and QR code are sent here.
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-foam/80">Mobile number</span>
            <input
              className={field}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              placeholder="082 123 4567"
              required
            />
            {errors.phone && <Err msg={errors.phone} />}
          </label>

          <label className="block text-sm">
            <span className="text-foam/80">
              Emergency contact <span className="text-foam/40">· optional</span>
            </span>
            <input
              className={field}
              name="emergencyContact"
              value={values.emergencyContact}
              onChange={set('emergencyContact')}
              placeholder="Name and number"
            />
            <span className="mt-1 block text-xs text-foam/45">
              There is water and there is liquor. Someone should know.
            </span>
          </label>
        </div>

        <div className="mt-8 space-y-3 border-t border-foam/10 pt-6">
          {CONFIRMATIONS.map((c) => (
            <label key={c.name} className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-foam/30 bg-abyss/60 accent-gold"
                checked={Boolean(checks[c.name])}
                onChange={(e) => setChecks((p) => ({ ...p, [c.name]: e.target.checked }))}
              />
              <span className="text-foam/75">{c.label}</span>
            </label>
          ))}
          {(errors.confirmInvited || errors.confirmEntranceFee || errors.confirmInviteOnly) && (
            <Err msg="Tick all three boxes to continue." />
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="glass-dark rounded-xl2 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm tracking-[0.3em] text-gold">{EVENT.brand}</p>
              <h3 className="mt-1 font-display text-xl leading-snug text-foam">
                Splash Water Park Party
              </h3>
            </div>
            <AvailabilityPill initial={availability} />
          </div>

          <div className="mt-5 space-y-1 text-sm text-foam/70">
            <p>{EVENT.dateLong}</p>
            <p>{EVENT.timeLabel}</p>
            <p>{EVENT.venueFull}</p>
          </div>

          <div className="mt-6 space-y-2 border-t border-foam/10 pt-5 text-sm">
            <Row label="Entrance · 1 guest" value={formatZAR(EVENT.priceCents)} />
            <Row label="Food and liquor" value="Included" />
            <div className="gold-rule my-3" />
            <div className="flex items-baseline justify-between">
              <span className="text-foam/80">Total</span>
              <span className="font-display text-3xl text-foam">
                {formatZAR(EVENT.priceCents)}
              </span>
            </div>
          </div>

          {formError && (
            <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-goldlite">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !allConfirmed}
            className="mt-6 w-full rounded-full bg-gold px-6 py-4 text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite disabled:cursor-not-allowed disabled:bg-foam/20 disabled:text-foam/50 disabled:shadow-none"
          >
            {busy ? 'Holding your seat…' : `PAY ${formatZAR(EVENT.priceCents)} & GET MY TICKET`}
          </button>

          <p className="mt-3 text-center text-xs text-foam/45">
            {allConfirmed
              ? 'You will be taken to PayFast to pay. Your seat is held for 15 minutes.'
              : 'Tick the three boxes above to continue.'}
          </p>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-foam/60">{label}</span>
      <span className="text-foam">{value}</span>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <span className="mt-1.5 block text-xs font-medium text-goldlite">{msg}</span>;
}
