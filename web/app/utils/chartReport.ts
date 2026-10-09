export const CHART_REPORT_KEY = 'csm-chart-report'
export type ChartReport = Readonly<{ chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; level: string; url: string }>

/** the contact message a chart-error report pre-fills: a prompt for the reporter, a debug block, then the chart text */
export function buildChartReport(r: ChartReport): string {
  return [
    'What looks wrong? (describe it here)',
    '',
    '--- chart details (for debugging) ---',
    `title: ${r.title}`,
    `slug: ${r.slug}`,
    `version: ${r.version}`,
    `instrument: ${r.instrument}`,
    `sheet: ${r.sheet}`,
    `level: ${r.level}`,
    `url: ${r.url}`,
    '',
    r.chart.trimEnd(),
  ].join('\n')
}
