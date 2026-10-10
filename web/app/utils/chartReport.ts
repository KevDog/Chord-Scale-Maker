import type { GuideShow } from '~~/engine'

export const CHART_REPORT_KEY = 'csm-chart-report'
/** guides: the Changes sheet's guide tones shown, as guidesText gives them */
export type ChartReport = Readonly<{ chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; guides: string; level: string; url: string }>

/** which guide tones are shown, for a report: '', '3rd', '7th' or '3rd,7th' */
export const guidesText = (g: GuideShow): string => [g.fromThird && '3rd', g.fromSeventh && '7th'].filter(Boolean).join(',')

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
    `guides: ${r.guides}`,
    `level: ${r.level}`,
    `url: ${r.url}`,
    '',
    r.chart.trimEnd(),
  ].join('\n')
}
