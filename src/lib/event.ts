/**
 * Event constants. Safe to import from client components.
 * The database is still the source of truth for capacity and price —
 * these values seed it and drive copy.
 */
export const EVENT = {
  slug: 'parks-splash-2026',
  brand: 'THE PARKS',
  name: 'SPLASH WATER PARK PARTY',
  tagline: 'An Exclusive Day & Night Experience',
  motto: 'SAME PEOPLE. BETTER MOMENTS.',
  dateLabel: '03 OCTOBER 2026',
  dateLong: 'Saturday, 03 October 2026',
  timeLabel: '13:00 – 22:00',
  venueLine1: 'THE PARKS LIFESTYLE APARTMENTS',
  venueLine2: 'SPLASH WATER PARK',
  venueFull: 'The Parks LifeStyle Apartments — Splash Water Park',
  capacity: 55,
  priceCents: 15000,
  currency: 'ZAR',
  startsAt: '2026-10-03T13:00:00+02:00',
  endsAt: '2026-10-03T22:00:00+02:00',
} as const;

export const SCHEDULE = [
  {
    time: '14:00 – 17:00',
    title: 'SPLASH WATER PARK',
    detail: 'Swimming',
    note: 'Slides and pools are all yours for three hours.',
  },
  {
    time: '17:00 – 19:30',
    title: 'BRAAI',
    detail: 'Food & socialising',
    note: 'Dry off, eat well, catch up.',
  },
  {
    time: '19:30 – 21:30',
    title: 'GAMES NIGHT',
    detail: 'Games & entertainment',
    note: 'Teams get picked. Feelings get hurt.',
  },
  {
    time: '21:30 – 22:00',
    title: 'CLOSING',
    detail: 'Final drinks / wind-down',
    note: 'Last round under the lights.',
  },
] as const;

export const RULES = [
  'Invite only — your name must be on the list.',
  'R150 per guest, for splash park entrance.',
  'Maximum capacity: 55 guests. No exceptions.',
  'Food is provided.',
  'Liquor is provided.',
  'A ticket is required for entry.',
  'One ticket admits one guest.',
  'Tickets cannot be transferred unless an organiser updates the guest details.',
] as const;

export function formatZAR(cents: number): string {
  return `R${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
