import { describe, expect, it } from 'vitest'
import { firstSheet, SHEETS, sheetsFor } from '~/utils/sheets'

describe('SHEETS', () => {
  it('offers Changes, Scales, Arpeggios and Patterns: guide tones are on the Changes sheet', () => {
    expect(SHEETS.map((s) => s.value)).toEqual(['changes', 'scales', 'arpeggios', 'patterns'])
    expect(SHEETS.map((s) => s.label)).toEqual(['Changes', 'Scales', 'Arpeggios', 'Patterns'])
  })

  it('leaves Patterns out while its flag is off', () => {
    expect(sheetsFor(false).map((s) => s.value)).toEqual(['changes', 'scales', 'arpeggios'])
    expect(sheetsFor(true)).toEqual(SHEETS)
  })
})

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined)).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'changes', 'arpeggios'] as const) expect(firstSheet(s)).toBe(s)
    expect(firstSheet('patterns', true)).toBe('patterns')
  })

  it('opens the Changes for a Patterns link while the flag is off', () => {
    expect(firstSheet('patterns')).toBe('changes')
    expect(firstSheet('patterns', false)).toBe('changes')
  })
})
