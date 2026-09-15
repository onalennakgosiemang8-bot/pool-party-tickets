import { SCHEDULE } from '@/lib/event';

export function Timeline() {
  return (
    <ol className="relative space-y-4 border-l border-aqua/25 pl-6 sm:pl-8">
      {SCHEDULE.map((slot, i) => (
        <li key={slot.title} className="relative">
          <span
            aria-hidden
            className="absolute -left-[31px] top-5 flex h-4 w-4 items-center justify-center rounded-full border border-aqua/50 bg-abyss sm:-left-[39px]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          </span>
          <div className="glass rounded-xl2 p-5">
            <p className="text-sm font-semibold tracking-wide text-aqua">{slot.time}</p>
            <h3 className="mt-1 font-display text-xl text-foam sm:text-2xl">{slot.title}</h3>
            <p className="text-sm text-foam/70">{slot.detail}</p>
            <p className="mt-2 text-sm text-foam/50">{slot.note}</p>
          </div>
          {i === SCHEDULE.length - 1 && (
            <span aria-hidden className="absolute -left-[25px] -bottom-2 h-2 w-2 sm:-left-[33px]" />
          )}
        </li>
      ))}
    </ol>
  );
}
