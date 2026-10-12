import { ARPEGGIO_LABELS, isArpeggioPattern, type SheetLine } from '@chord-scale-maker/engine'

export const CHART_REPORT_KEY = 'csm-chart-report'
/** guides: the Changes sheet's line, as guidesText gives it */
export type ChartReport = Readonly<{ chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; guides: string; level: string; url: string }>

/** which line is shown, for a report: 'from 3rd', 'from 7th', '7th chords: Up · root', or '' with it off */
export const guidesText = (line: SheetLine): string =>
  isArpeggioPattern(line) ? `7th chords: ${ARPEGGIO_LABELS[line]}` : ({ off: '', third: 'from 3rd', seventh: 'from 7th' } as const)[line]

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
