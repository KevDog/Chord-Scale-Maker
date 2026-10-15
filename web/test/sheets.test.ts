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
    expect(firstSheet(undefined)).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'changes', 'arpeggios'] as const) expect(firstSheet(s)).toBe(s)
  })
})
