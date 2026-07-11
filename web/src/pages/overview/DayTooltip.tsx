import type { OverviewDay } from '../../api';
import { compactNumber, currency } from '../../lib/format';
import { CHART_ACCENTS, type ChartMetric } from './chartColors';
import s from '../../ui/ui.module.css';

// The hover body shared by all four Overview charts: the day's date, then every metric for that day
// with its colour dot — so hovering the Cost line still tells you the requests and tokens behind it.
// The chart you're hovering marks its own metric as the active row.
const ROWS: { key: ChartMetric; label: string; fmt: (n: number) => string }[] = [
  { key: 'requests',     label: 'Requests', fmt: compactNumber },
  { key: 'inputTokens',  label: 'Input',    fmt: compactNumber },
  { key: 'outputTokens', label: 'Output',   fmt: compactNumber },
  { key: 'usd',          label: 'Cost',     fmt: currency },
];

export function DayTooltip({ day, label, active }: { day: OverviewDay; label: string; active: ChartMetric }) {
  return (
    <>
      <b>{label}</b>
      {ROWS.map((r) => (
        <span key={r.key} class={`${s.chartTipRow} ${r.key === active ? s.chartTipRowActive : ''}`}>
          <span><i class={s.chartTipDot} style={{ background: CHART_ACCENTS[r.key] }} />{r.label}</span>
          <span>{r.fmt(day[r.key])}</span>
        </span>
      ))}
    </>
  );
}
