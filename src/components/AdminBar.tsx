'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVENT } from '@/lib/event';

export function AdminBar({
  adminName,
  active,
}: {
  adminName: string;
  active: 'dashboard' | 'check-in';
}) {
  const router = useRouter();

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
    router.refresh();
  }

  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active === key ? 'bg-foam/10 text-aqua' : 'text-foam/65 hover:text-foam'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-foam/10 bg-abyss/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm tracking-[0.2em] text-gold">{EVENT.brand}</span>
          <span className="hidden text-xs text-foam/35 sm:inline">Organiser</span>
        </div>

        <div className="flex items-center gap-1">
          {link('/admin/dashboard', 'Dashboard', 'dashboard')}
          {link('/admin/check-in', 'Check-in', 'check-in')}
          <button
            onClick={signOut}
            className="ml-1 rounded-full border border-foam/20 px-3 py-1.5 text-sm text-foam/65 transition hover:border-gold/60 hover:text-foam"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="sr-only">Signed in as {adminName}</p>
    </header>
  );
}
