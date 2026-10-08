/** Tiny inline trend line for the last few scores (0–100). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="inline-block w-16" />;
  const w = 64;
  const h = 20;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline points={points} fill="none" strokeWidth={2} className={up ? "stroke-emerald-500" : "stroke-rose-400"} />
    </svg>
  );
}
