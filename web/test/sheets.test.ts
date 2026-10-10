import { describe, expect, it } from 'vitest'
import { firstSheet, SHEETS } from '~/utils/sheets'

describe('SHEETS', () => {
  it('offers Scales and Changes only: guide tones are on the Changes sheet', () => {
    expect(SHEETS.map((s) => s.value)).toEqual(['scales', 'changes'])
    expect(SHEETS.map((s) => s.label)).toEqual(['Scales', 'Changes'])
  })
})

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: true })).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'changes'] as const) expect(firstSheet(s, { changes: true })).toBe(s)
  })

  it('falls back to Scales without the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: false })).toBe('scales')
    expect(firstSheet('changes', { changes: false })).toBe('scales')
  })
})
