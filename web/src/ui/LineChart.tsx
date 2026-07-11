import s from './ui.module.css';

interface Props {
  data: number[];
  height?: number;
  ariaLabel?: string;
}

/**
 * A dependency-free, theme-aware SVG line+area chart. Deliberately no charting library —
 * this is self-contained (the old dashboard's CDN-loaded Chart.js broke air-gapped / strict-CSP
 * installs), reads its colours from CSS tokens, and stretches to its container. P7.2 layers axes,
 * tooltips, and multi-series on this same seam.
 */
export function LineChart({ data, height = 120, ariaLabel = 'Line chart' }: Props) {
  const W = 320;
  const H = height;
  const P = 6;

  if (!data.length) {
    return (
      <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <text x={W / 2} y={H / 2} text-anchor="middle" dominant-baseline="middle" class={s.chartEmpty}>No data yet</text>
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => P + (1 - (v - min) / range) * (H - 2 * P);

  const pts = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M ${x(0).toFixed(2)},${(H - P).toFixed(2)} L ${pts.join(' L ')} L ${x(n - 1).toFixed(2)},${(H - P).toFixed(2)} Z`;

  return (
    <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <path class={s.chartArea} d={area} />
      <path class={s.chartLine} d={line} vector-effect="non-scaling-stroke" />
    </svg>
  );
}
