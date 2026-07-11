// One home for the per-metric hues, imported by both the chart cards (line/fill/tick colour) and
// the shared day tooltip (the dot beside each row) so a metric's colour is defined exactly once.
export const CHART_ACCENTS = {
  requests:     'var(--green)',
  inputTokens:  'var(--blue)',
  outputTokens: 'var(--accent)',
  usd:          'var(--orange)',
} as const;

export type ChartMetric = keyof typeof CHART_ACCENTS;
