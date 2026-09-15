import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import { EVENT } from '@/lib/event';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${EVENT.brand} · ${EVENT.name}`,
    template: `%s · ${EVENT.brand}`,
  },
  description: `${EVENT.tagline} — ${EVENT.dateLabel}, ${EVENT.venueFull}. Invite only, 55 guests.`,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${EVENT.brand} — ${EVENT.name}`,
    description: `${EVENT.dateLabel} · ${EVENT.timeLabel} · Invite only`,
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#04182B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${sans.variable}`}>
      <body className="pool-surface min-h-dvh antialiased">{children}</body>
    </html>
  );
}
