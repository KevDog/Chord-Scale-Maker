import { describe, expect, it } from 'vitest'
import { firstSheet } from '~/utils/sheets'

const ALL = { guideTones: true, changes: true } as const

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined, ALL)).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'guideTones', 'changes'] as const) expect(firstSheet(s, ALL)).toBe(s)
  })

  it('falls back to Scales without the Changes sheet', () => {
    const noChanges = { guideTones: true, changes: false }
    expect(firstSheet(undefined, noChanges)).toBe('scales')
    expect(firstSheet('changes', noChanges)).toBe('scales')
  })

  it('opens a Guide Tones link on Changes when that sheet is off', () => {
    expect(firstSheet('guideTones', { guideTones: false, changes: true })).toBe('changes')
  })
})
