import { describe, expect, it } from 'vitest'
import { buildChartReport, type ChartReport, guidesText } from '~/utils/chartReport'

const REPORT: ChartReport = { chart: 'key: C\nA | 1 | Dm7\n', slug: 'x', title: 'X', version: 'v1', instrument: 'Tenor Sax', sheet: 'Scales', guides: '', level: 'Standard', url: 'http://x/song?chart=x' }

describe('buildChartReport', () => {
  it('puts a prompt line, a debug block, then the chart text', () => {
    const msg = buildChartReport(REPORT)
    expect(msg).toMatch(/^What looks wrong/) // prompt first
    expect(msg).toContain('version: v1')
    expect(msg).toContain('instrument: Tenor Sax')
    expect(msg).toContain('key: C\nA | 1 | Dm7') // chart text included
  })

  it('says which guide tones were shown, after the sheet', () => {
    expect(buildChartReport({ ...REPORT, sheet: 'changes', guides: 'from 7th' })).toContain('sheet: changes\nguides: from 7th\n')
    expect(buildChartReport(REPORT)).toMatch(/^guides: $/m)
  })
})

describe('guidesText', () => {
  it('names the guide tone line shown, or nothing with it off', () => {
    expect(guidesText('off')).toBe('')
    expect(guidesText('third')).toBe('from 3rd')
    expect(guidesText('seventh')).toBe('from 7th')
  })
})
