import Link from 'next/link';
import { EVENT } from '@/lib/event';

export function Footer() {
  return (
    <footer className="no-print border-t border-foam/10 bg-abyss/80">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm text-foam/60 sm:grid-cols-3">
        <div>
          <p className="font-display text-base tracking-[0.2em] text-foam">{EVENT.brand}</p>
          <p className="mt-1 text-foam/60">{EVENT.motto}</p>
        </div>
        <div>
          <p className="text-foam/80">{EVENT.dateLong}</p>
          <p>{EVENT.timeLabel}</p>
          <p className="mt-1">{EVENT.venueFull}</p>
        </div>
        <div className="sm:text-right">
          <p>Invite only · 55 guests</p>
          <Link href="/admin" className="mt-2 inline-block text-foam/40 hover:text-aqua">
            Organiser sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
