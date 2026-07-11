import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import s from './ui.module.css';

interface Props {
  data:       number[];
  /** Optional per-point labels (e.g. dates) shown in the default hover tooltip. */
  labels?:    string[];
  /** How a value is rendered in the tooltip (compact number, currency, …). */
  format?:    (v: number) => string;
  /** A CSS colour for this series' line/fill/dot — lets sibling charts read as distinct metrics.
   *  Defaults to the accent. Pass a token, e.g. `var(--blue)`. */
  accent?:    string;
  /** Rich tooltip: given the hovered index, render the tooltip body. Overrides label+value. */
  tooltip?:   (i: number) => ComponentChildren;
  height?:    number;
  ariaLabel?: string;
}

// Per-instance gradient id: multiple charts share a page, so each needs its own <defs> id.
let gradSeq = 0;

/**
 * A dependency-free, theme-aware SVG line+area chart. Deliberately no charting library —
 * this is self-contained (the old dashboard's CDN-loaded Chart.js broke air-gapped / strict-CSP
 * installs), reads its colours from CSS tokens, and stretches to its container.
 *
 * It is interactive: hovering shows a crosshair, a highlighted point, and a tooltip, and the line
 * draws itself in on first paint — so the data feels live, not static. The overlay is positioned in
 * percentages (robust to the stretched viewBox) and rendered as HTML so a dot stays circular
 * despite `preserveAspectRatio="none"`.
 *
 * The area is filled with a vertical gradient in **user space** spanning the full chart height, so it
 * always fades cleanly from the line down to transparent regardless of the data's shape. (An
 * object-bounding-box gradient collapses onto a near-flat series, compressing the fade into a thin
 * band that reads as a faint horizontal line over a dark surface — the artefact this avoids.)
 *
 * `accent` recolours the whole series via a CSS custom property, so four charts on one page can each
 * carry their own hue while sharing this one component.
 */
export function LineChart({
  data, labels, format = (v) => String(v), accent, tooltip, height = 120, ariaLabel = 'Line chart',
}: Props) {
  const W = 320;
  const H = height;
  const P = 6;
  const gradId = useRef(`nx-chart-fill-${gradSeq++}`).current;
  const [hover, setHover] = useState<number | null>(null);
  const style = accent ? ({ '--chart-accent': accent } as Record<string, string>) : undefined;

  if (!data.length) {
    return (
      <div class={s.chartWrap} style={style}>
        <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
          <text x={W / 2} y={H / 2} text-anchor="middle" dominant-baseline="middle" class={s.chartEmpty}>No data yet</text>
        </svg>
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => P + (1 - (v - min) / range) * (H - 2 * P);

  const pts  = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M ${x(0).toFixed(2)},${(H - P).toFixed(2)} L ${pts.join(' L ')} L ${x(n - 1).toFixed(2)},${(H - P).toFixed(2)} Z`;

  // Overlay geometry as percentages of the container (the viewBox is stretched, so px math on the
  // viewBox coordinates would be wrong; percentages track the render exactly).
  const leftPct = (i: number) => (x(i) / W) * 100;
  const topPct  = (v: number) => (y(v) / H) * 100;

  const onMove = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (r.width === 0) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const i  = n === 1 ? 0 : Math.round(((fx * W) - P) / ((W - 2 * P) / (n - 1)));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const tipLeft = Math.min(86, Math.max(14, leftPct(hover ?? 0))); // keep the tooltip off the edges

  return (
    <div class={s.chartWrap} style={style} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg class={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1={P} x2="0" y2={H}>
            <stop offset="0%"   stop-color="var(--chart-accent, var(--accent))" stop-opacity="0.24" />
            <stop offset="100%" stop-color="var(--chart-accent, var(--accent))" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class={s.chartFill} d={area} fill={`url(#${gradId})`} />
        <path class={s.chartLine} d={line} vector-effect="non-scaling-stroke" pathLength={1} />
      </svg>
      {hover !== null && (
        <>
          <span class={s.chartCrosshair} style={{ left: `${leftPct(hover)}%` }} />
          <span class={s.chartHoverDot} style={{ left: `${leftPct(hover)}%`, top: `${topPct(data[hover])}%` }} />
          <span class={s.chartTip} style={{ left: `${tipLeft}%`, top: `${topPct(data[hover])}%` }}>
            {tooltip
              ? tooltip(hover)
              : <>
                  {labels?.[hover] && <b>{labels[hover]}</b>}
                  <span>{format(data[hover])}</span>
                </>}
          </span>
        </>
      )}
    </div>
  );
}
