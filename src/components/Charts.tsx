/**
 * Small SVG chart primitives. Hand-drawn rather than pulled from a charting library: these are
 * three fixed shapes, and a dependency would cost more than it saves.
 */

export interface Slice {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  slices: Slice[];
  total: number;
  totalLabel?: string;
  size?: number;
}

/** Ring chart with the total in the middle, drawn with stroke-dasharray on a single circle
 *  per slice so there is no path maths to get wrong. */
export function Donut({ slices, total, totalLabel = "Total", size = 132 }: DonutProps) {
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1;

  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {slices.map((s) => {
          const len = (s.value / sum) * c;
          // A hairline gap keeps neighbouring slices legible without a separate divider.
          const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        fontSize="11"
        fill="var(--text-tertiary)"
      >
        {totalLabel}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fill="var(--text-primary)"
      >
        {total.toLocaleString("en-IN")}
      </text>
    </svg>
  );
}

export function DonutLegend({
  slices,
  showPercent = false,
}: {
  slices: Slice[];
  showPercent?: boolean;
}) {
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <ul className="chart-legend">
      {slices.map((s) => (
        <li key={s.label}>
          <span className="chart-dot" style={{ background: s.color }} />
          <span className="chart-legend-label">{s.label}</span>
          <span className="chart-legend-value mono">
            {s.value.toLocaleString("en-IN")}
            {showPercent && ` (${Math.round((s.value / sum) * 100)}%)`}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface BarsProps {
  data: { label: string; value: number }[];
  height?: number;
}

/** Column chart with a light horizontal grid, sized to whatever the data's peak happens to be. */
export function Bars({ data, height = 168 }: BarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const top = Math.ceil(max / 20) * 20 || 20;
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];

  return (
    <div className="bar-chart" style={{ height }}>
      <div className="bar-axis">
        {[...ticks].reverse().map((t) => (
          <span key={t}>{Math.round(t)}</span>
        ))}
      </div>
      <div className="bar-plot">
        {[...ticks].reverse().map((t) => (
          <div key={t} className="bar-grid-line" />
        ))}
        <div className="bar-columns">
          {data.map((d) => (
            <div key={d.label} className="bar-col" title={`${d.label}: ${d.value}`}>
              <div className="bar-fill" style={{ height: `${(d.value / top) * 100}%` }} />
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
