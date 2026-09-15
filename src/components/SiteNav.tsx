import Link from 'next/link';
import { EVENT } from '@/lib/event';

export function SiteNav({ active }: { active?: 'home' | 'event' | 'tickets' }) {
  const links = [
    { href: '/', label: 'Home', key: 'home' as const },
    { href: '/event', label: 'The day', key: 'event' as const },
    { href: '/tickets', label: 'Tickets', key: 'tickets' as const },
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-foam/10 bg-abyss/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-[0.2em] text-foam">
            {EVENT.brand}
          </span>
          <span className="block text-[10px] font-medium tracking-[0.28em] text-aqua/80">
            SPLASH PARTY
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-4">
          <div className="hidden gap-4 sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm transition-colors ${
                  active === l.key ? 'text-aqua' : 'text-foam/70 hover:text-foam'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            href="/tickets"
            className="rounded-full bg-gold px-4 py-2 text-xs font-bold tracking-wide text-abyss shadow-gold transition hover:bg-goldlite"
          >
            Get your ticket
          </Link>
        </div>
      </nav>
    </header>
  );
}
