import { describe, expect, it } from 'vitest'
import { stepUnits, type StepBlock } from '../steps'

// an AABA form of four 8-bar blocks after a 2-bar intro, a chord on each bar
const intro: StepBlock = { part: 'before', from: 0, to: 1, rows: [0, 1] }
const form: StepBlock[] = [0, 1, 2, 3].map((k) => ({ part: 'form', from: 2 + k * 8, to: 9 + k * 8, rows: Array.from({ length: 8 }, (_, j) => 2 + k * 8 + j) }))
const blocks = [intro, ...form]
const barOf = (row: number) => row // row n starts bar n
const repeat = (n: number, times: number) => Array.from({ length: times }, () => n)
const none = () => undefined

describe('stepUnits', () => {
  it('section: one unit per form block, null before it', () => {
    const u = stepUnits(blocks, none, barOf, { unit: 'section', bars: 4 })
    expect(u.ofDrawnBar).toEqual([null, null, ...repeat(0, 8), ...repeat(1, 8), ...repeat(2, 8), ...repeat(3, 8)])
    expect(u.ofChord(0, 0, 0)).toBeNull()
    expect(u.ofChord(2, 3, 13)).toBe(1)
  })

  it('bars: a unit per 4 bars of the form, intro excluded from the count', () => {
    const u = stepUnits(blocks, none, barOf, { unit: 'bars', bars: 4 })
    expect(u.ofDrawnBar.slice(0, 2)).toEqual([null, null])
    expect(u.ofDrawnBar.slice(2, 14)).toEqual([...repeat(0, 4), ...repeat(1, 4), ...repeat(2, 4)])
    expect(u.ofDrawnBar.at(-1)).toBe(7)
  })

  it('key-area: changes where the key changes, and a held bar keeps its chord\'s area', () => {
    // one chord every other bar in block 1; the key changes at the third chord
    const b: StepBlock[] = [{ part: 'form', from: 0, to: 7, rows: [0, 2, 4, 6] }]
    const key = (row: number) => (row >= 4 ? 'F' : 'C')
    const u = stepUnits(b, key, barOf, { unit: 'key-area', bars: 4 })
    expect(u.ofDrawnBar).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
  })

  it('a block outside the form is null at every unit', () => {
    for (const unit of ['section', 'key-area', 'bars'] as const) {
      expect(stepUnits(blocks, none, barOf, { unit, bars: 2 }).ofDrawnBar.slice(0, 2)).toEqual([null, null])
    }
  })

  it('a block with no row-bar span still draws one bar', () => {
    const u = stepUnits([{ part: 'form', from: 3, to: 2, rows: [] }], none, barOf, { unit: 'section', bars: 4 })
    expect(u.ofDrawnBar).toEqual([0])
  })
})
