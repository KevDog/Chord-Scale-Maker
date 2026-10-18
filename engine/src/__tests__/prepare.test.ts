import { describe, expect, it } from 'vitest'
import { prepareChart } from '../prepare'

const chart = ['title: Tune', 'style: Medium Swing', 'key: C', 'source: iReal Pro', '', 'section: A', '1 | CMaj7', '2 | Dm7', '2 | G7', '3 | CMaj7', ''].join('\n')

describe('prepareChart', () => {
  it('lists the gaps a song page would fail on, and the advice', () => {
    const p = prepareChart(chart, {}, '2026-10-18')
    expect(p.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^no composer:/), 'no form:']))
    expect(p.advice).toEqual(expect.arrayContaining([expect.stringMatching(/^no aka:/), expect.stringMatching(/^no recording:/)]))
  })

  it('sets the header from the overrides, after the existing header lines', () => {
    const p = prepareChart(chart, { composer: 'Jim Hall', form: 'A, 3 bars', aka: 'Other' }, '2026-10-18')
    expect(p.gaps).toEqual([])
    expect(p.chart).toMatch(/^title: Tune\nstyle: Medium Swing\nkey: C\nsource: iReal Pro\ncomposer: Jim Hall\nform: A, 3 bars\naka: Other\n/)
    expect(p.advice.some((a) => a.startsWith('no aka:'))).toBe(false)
  })

  it('replaces a header line that is there', () => {
    const p = prepareChart(chart, { style: 'Ballad' }, '2026-10-18')
    expect(p.chart).toContain('style: Ballad\n')
    expect(p.chart).not.toContain('Medium Swing')
  })

  it('skips empty overrides', () => {
    expect(prepareChart(chart, { composer: '' }, '2026-10-18').chart).not.toMatch(/^composer:/m)
  })

  it('saves the analysis with the given date', () => {
    const p = prepareChart(chart, { composer: 'Jim Hall' }, '2026-10-18')
    expect(p.chart).toMatch(/^# analysis: 2026-10-18, /m)
    expect(p.chart).toMatch(/^1 +\| CMaj7 +#/m) // a reason on the row
    expect(Array.isArray(p.ambiguities)).toBe(true)
  })
})
