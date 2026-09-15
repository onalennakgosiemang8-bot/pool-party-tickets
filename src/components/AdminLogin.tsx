'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLogin({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Sign in failed.');
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('No connection to the server.');
      setBusy(false);
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-foam/15 bg-abyss/50 px-4 py-3 text-foam outline-none transition focus:border-aqua/60';

  return (
    <form onSubmit={onSubmit} className="glass mt-8 rounded-xl2 p-6">
      <label className="block text-sm">
        <span className="text-foam/80">Email</span>
        <input
          className={field}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="mt-5 block text-sm">
        <span className="text-foam/80">Password</span>
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && (
        <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-goldlite">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-gold px-6 py-3.5 text-sm font-extrabold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
