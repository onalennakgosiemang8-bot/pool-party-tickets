/**
 * Decorative pool backdrop: caustic light, a palm frond in each upper
 * corner and three slow ripples. Pure SVG/CSS so it costs no requests.
 */
export function WaterBackdrop({ ripples = true }: { ripples?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(127,227,232,0.22),transparent_70%)]" />

      <svg
        className="absolute -left-16 -top-10 h-64 w-64 text-aqua/25 animate-drift"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 190C100 120 70 60 12 18c58 6 96 44 110 88 8-34 30-62 66-80-24 40-34 84-30 128-16-22-34-34-58-38z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute -right-20 top-24 h-72 w-72 rotate-[140deg] text-pool/20 animate-drift [animation-delay:-4s]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 190C100 120 70 60 12 18c58 6 96 44 110 88 8-34 30-62 66-80-24 40-34 84-30 128-16-22-34-34-58-38z"
          fill="currentColor"
        />
      </svg>

      {ripples && (
        <div className="absolute inset-x-0 bottom-0 h-[45vh]">
          {[
            { left: '18%', delay: '0s' },
            { left: '54%', delay: '-1.8s' },
            { left: '82%', delay: '-3.4s' },
          ].map((r) => (
            <span
              key={r.left}
              style={{ left: r.left, animationDelay: r.delay }}
              className="absolute bottom-24 h-24 w-24 rounded-full border border-aqua/30 animate-ripple"
            />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(4,24,43,0.9))]" />
    </div>
  );
}
