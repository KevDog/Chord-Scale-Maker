import { describe, expect, it } from 'vitest'
import { buildChartReport, type ChartReport, guidesText } from '~/utils/chartReport'
import { NO_GUIDES } from '~~/engine'

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
    expect(buildChartReport({ ...REPORT, sheet: 'changes', guides: '3rd,7th' })).toContain('sheet: changes\nguides: 3rd,7th\n')
    expect(buildChartReport(REPORT)).toMatch(/^guides: $/m)
  })
})

describe('guidesText', () => {
  it('names the guide tones shown', () => {
    expect(guidesText(NO_GUIDES)).toBe('')
    expect(guidesText({ third: true, seventh: false })).toBe('3rd')
    expect(guidesText({ third: false, seventh: true })).toBe('7th')
    expect(guidesText({ third: true, seventh: true })).toBe('3rd,7th')
  })
})
