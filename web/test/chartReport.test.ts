import { describe, expect, it } from 'vitest'
import { buildChartReport } from '~/utils/chartReport'

describe('buildChartReport', () => {
  it('puts a prompt line, a debug block, then the chart text', () => {
    const msg = buildChartReport({ chart: 'key: C\nA | 1 | Dm7\n', slug: 'x', title: 'X', version: 'v1', instrument: 'Tenor Sax', sheet: 'Scales', level: 'Standard', url: 'http://x/song?chart=x' })
    expect(msg).toMatch(/^What looks wrong/) // prompt first
    expect(msg).toContain('version: v1')
    expect(msg).toContain('instrument: Tenor Sax')
    expect(msg).toContain('key: C\nA | 1 | Dm7') // chart text included
  })
})
