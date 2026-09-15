'use client';

/** Small inline SVG chart — daily bars plus the cumulative line. No deps. */
export function SalesChart({
  data,
  capacity,
}: {
  data: { date: string; count: number; cumulative: number }[];
  capacity: number;
}) {
  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-foam/50">
        No confirmed sales yet. This fills in as tickets are paid for.
      </p>
    );
  }

  const w = 640;
  const h = 200;
  const pad = { top: 12, right: 12, bottom: 26, left: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const maxDaily = Math.max(...data.map((d) => d.count), 1);
  const barW = Math.max(6, Math.min(44, innerW / data.length - 8));

  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1 || 1));
  const yDaily = (v: number) => pad.top + innerH - (v / maxDaily) * innerH;
  const yCum = (v: number) => pad.top + innerH - (v / capacity) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yCum(d.cumulative).toFixed(1)}`)
    .join(' ');

  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Ticket sales over time">
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH * t}
            y2={pad.top + innerH * t}
            stroke="rgba(242,250,255,0.1)"
            strokeWidth="1"
          />
        ))}

        {data.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - barW / 2}
            y={yDaily(d.count)}
            width={barW}
            height={pad.top + innerH - yDaily(d.count)}
            rx="4"
            fill="rgba(31,168,224,0.45)"
          />
        ))}

        <path d={linePath} fill="none" stroke="#D8B15E" strokeWidth="2.5" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={yCum(d.cumulative)} r="3.5" fill="#D8B15E" />
        ))}

        {data.map((d, i) =>
          i === 0 || i === data.length - 1 || data.length <= 6 ? (
            <text
              key={`l-${d.date}`}
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(242,250,255,0.45)"
            >
              {d.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-foam/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-pool/50" /> tickets that day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gold" /> running total of {capacity}
        </span>
      </figcaption>
    </figure>
  );
}
