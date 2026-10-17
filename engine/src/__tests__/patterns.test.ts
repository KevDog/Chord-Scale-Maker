import { describe, expect, it } from 'vitest'
import { formatPattern, parsePattern, PATTERN_LIBRARY, patternRun } from '../patterns'

describe('patterns', () => {
  it('parses moves with hyphen, minus or en dash, spaces or commas, a bare number up', () => {
    for (const t of ['+1 +1 +1 -2', '+1,+1,+1,−2', '1 1 1 –2']) expect(parsePattern(t)).toEqual({ moves: [1, 1, 1, -2] })
  })
  it('refuses what the rules refuse, saying why', () => {
    for (const t of ['', '+0 +1', '+1 +1 +1 +2', '+1 +1 +1 +1 +1 +1 +1 +1 -7', '+8 -7', '+1', 'abc', '-1 +2 +1']) {
      expect(parsePattern(t)).toHaveProperty('error')
    }
  })
  it('writes the canonical text', () => expect(formatPattern([1, 1, 1, -2])).toBe('+1 +1 +1 −2'))
  it('holds the 13 library patterns, each one the parser accepts', () => {
    expect(PATTERN_LIBRARY).toHaveLength(13)
    for (const p of PATTERN_LIBRARY) expect(parsePattern(formatPattern(p.moves))).toEqual({ moves: p.moves })
    expect(PATTERN_LIBRARY.find((p) => p.id === 'thirds')?.moves).toEqual([2, -1])
  })
  it('labels stepwise patterns by their first group and the rest by name', () => {
    const label = (id: string) => PATTERN_LIBRARY.find((p) => p.id === id)?.label
    expect(label('1-2-4-3')).toBe('1 2 4 3')
    expect(label('1-3-2-1')).toBe('1 3 2 1')
    expect(label('triads-turn')).toBe('Triads with a turn')
  })
  it('runs each stepwise library label as its first group', () => {
    for (const p of PATTERN_LIBRARY.filter((q) => /^\d/.test(q.label))) {
      const r = patternRun(7, p.moves, 'up')
      expect(r.steps.slice(0, p.moves.length).map((s) => s + 1).join(' ')).toBe(p.label)
    }
  })
  it('runs 1 2 3 4 up a seven-note scale: a group on every step, then the octave alone', () => {
    const r = patternRun(7, [1, 1, 1, -2], 'up')
    expect(r.steps.slice(0, 8)).toEqual([0, 1, 2, 3, 1, 2, 3, 4])
    expect(r.groups).toEqual([4, 4, 4, 4, 4, 4, 4, 1])
    expect(r.steps.at(-1)).toBe(7)
  })
  it('starts a group every sum steps when the sum is above 1', () => {
    expect(patternRun(7, [2, 2, -2], 'up').steps.filter((_, i) => i % 3 === 0 && i < 12)).toEqual([0, 2, 4, 6])
  })
  it('reflects Up for Down, and shares the octave in Up & down', () => {
    const up = patternRun(4, [1, 1, 1, -2], 'up')
    const down = patternRun(4, [1, 1, 1, -2], 'down')
    expect(down.steps[0]).toBe(4)
    expect(down.groups[0]).toBe(1)
    const both = patternRun(4, [1, 1, 1, -2], 'up-down')
    expect(both.steps.length).toBe(up.steps.length * 2 - 1)
    expect(both.groups.reduce((a, b) => a + b, 0)).toBe(both.steps.length)
  })
  it('never goes below a group’s first note', () => {
    const { steps, groups } = patternRun(7, [1, 1, 1, -2], 'up')
    let i = 0
    for (const g of groups) {
      const grp = steps.slice(i, i + g)
      expect(Math.min(...grp)).toBe(grp[0])
      i += g
    }
  })
})
