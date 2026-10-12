import { describe, expect, it } from 'vitest'
import { firstSheet, SHEETS } from '~/utils/sheets'

describe('SHEETS', () => {
  it('offers Changes, Scales and Arpeggios: guide tones are on the Changes sheet', () => {
    expect(SHEETS.map((s) => s.value)).toEqual(['changes', 'scales', 'arpeggios'])
    expect(SHEETS.map((s) => s.label)).toEqual(['Changes', 'Scales', 'Arpeggios'])
  })
})

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: true, arpeggios: true })).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'changes'] as const) expect(firstSheet(s, { changes: true, arpeggios: true })).toBe(s)
  })

  it('falls back to Scales without the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: false, arpeggios: true })).toBe('scales')
    expect(firstSheet('changes', { changes: false, arpeggios: true })).toBe('scales')
  })

  it('opens a link on Arpeggios only with the flag on', () => {
    expect(firstSheet('arpeggios', { changes: true, arpeggios: true })).toBe('arpeggios')
    expect(firstSheet('arpeggios', { changes: true, arpeggios: false })).toBe('changes')
  })
})
