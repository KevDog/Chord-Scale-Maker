import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { noteName } from '../instruments'
import { type Pitched, partFor, rangeOf } from '../part'
import { rootName } from '../pitch'
import { buildPatternSheet, formatPattern, parsePattern, PATTERN_LIBRARY, patternLine, patternRun } from '../patterns'

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
    expect(down.groups[0]).toBe(4)
    const both = patternRun(4, [1, 1, 1, -2], 'up-down')
    expect(both.steps.length).toBe(up.steps.length * 2 - 1)
    expect(both.groups.reduce((a, b) => a + b, 0)).toBe(both.steps.length)
  })
  it('writes Down exactly: Up reflected, groups kept, the lone note last', () => {
    expect(patternRun(4, [1, 1, 1, -2], 'down')).toEqual({
      steps: [4, 3, 2, 1, 3, 2, 1, 0, 2, 1, 0, -1, 1, 0, -1, -2, 0],
      groups: [4, 4, 4, 4, 1],
    })
    expect(patternRun(7, [2, 2, -2], 'down')).toEqual({
      steps: [7, 5, 3, 5, 3, 1, 3, 1, -1, 1, -1, -3, 0],
      groups: [3, 3, 3, 3, 1],
    })
  })
  it('writes Up & down exactly: Up without its octave, then Down', () => {
    expect(patternRun(4, [1, 1, 1, -2], 'up-down')).toEqual({
      steps: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6, 4, 3, 2, 1, 3, 2, 1, 0, 2, 1, 0, -1, 1, 0, -1, -2, 0],
      groups: [4, 4, 4, 4, 4, 4, 4, 4, 1],
    })
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

const CONCERT_PIANO = partFor('piano')
const names = (r: ReturnType<typeof patternLine>) => ('error' in r ? r.error : r.notes.map((n) => noteName(n.midi)))

describe('patternLine', () => {
  it('runs 1 2 3 4 over C Ionian from C, in the piano range', () => {
    expect(names(patternLine(CONCERT_PIANO, 'Cmaj7', 'C Ionian', [1, 1, 1, -2], 'scale', 'up')).slice(0, 8)).toEqual(['C4', 'D4', 'E4', 'F4', 'D4', 'E4', 'F4', 'G4'])
  })
  it('runs over Dm7’s chord tones', () => {
    const r = names(patternLine(CONCERT_PIANO, 'Dm7', 'D Dorian', [1, 1, 1, -2], 'chord', 'up'))
    expect((r as string[]).slice(0, 8).map((n) => n.replace(/\d/, ''))).toEqual(['D', 'F', 'A', 'C', 'F', 'A', 'C', 'D'])
  })
  it('spells for the part: tenor sax reads Cmaj7 as Dmaj7', () => {
    const r = patternLine(partFor('tenor-sax'), 'Cmaj7', 'C Ionian', [1, 1, 1, -2], 'scale', 'up')
    if ('error' in r) throw new Error(r.error)
    expect(rootName(r.notes[0] as Pitched)).toBe('D')
  })
  it('keeps every note in the part’s range where the range can hold the run (a trombone, a player range)', () => {
    for (const part of [partFor('trombone'), partFor('trumpet')]) {
      const r = patternLine(part, 'Cmaj7', 'C Ionian', [1, 1, 1, -2], 'scale', 'up')
      if ('error' in r) throw new Error(r.error)
      const { lo, hi } = rangeOf(part)
      for (const n of r.notes) expect(n.midi >= lo && n.midi <= hi).toBe(true)
    }
    const part = { ...partFor('trumpet'), range: { lo: 60, hi: 84, centre: 70 } }
    const r = patternLine(part, 'Dm7', 'D Dorian', [2, -1], 'scale', 'down')
    if ('error' in r) throw new Error(r.error)
    for (const n of r.notes) expect(n.midi >= 60 && n.midi <= 84).toBe(true)
  })
  it('is an error, not a throw: no scale with Scale chosen, an unreadable chord with Chord tones', () => {
    expect(patternLine(CONCERT_PIANO, 'Cmaj7', null, [1, 1, 1, -2], 'scale', 'up')).toHaveProperty('error')
    expect(patternLine(CONCERT_PIANO, 'Hmaj7', 'C Ionian', [1, 1, 1, -2], 'chord', 'up')).toHaveProperty('error')
  })
  it('goes down by reflection and keeps the groups', () => {
    const r = patternLine(CONCERT_PIANO, 'Cmaj7', 'C Ionian', [1, 1, 1, -2], 'scale', 'down')
    if ('error' in r) throw new Error(r.error)
    expect(r.groups).toEqual([4, 4, 4, 4, 4, 4, 4, 1])
    expect(r.notes.length).toBe(29)
    expect(r.notes[0]?.midi).toBeGreaterThan(r.notes.at(-1)?.midi ?? 0)
  })
})

describe('buildPatternSheet', () => {
  const row = (chord: string, scale = ''): Row => ({ section: 'A', bar: '1', chord, scale })
  it('builds a sheet of one staff per scale line, headed Patterns', () => {
    const moves = [1, 1, 1, -2]
    const s = buildPatternSheet([row('Dm7', 'D Dorian'), row('G7', 'G Mixolydian')], CONCERT_PIANO, 12, moves, 'scale', 'up')
    expect(s.heading).toBe('Patterns')
    const staves = s.pages.flat()
    expect(staves).toHaveLength(2)
    for (const st of staves) {
      expect(st.id).toContain(formatPattern(moves))
      expect(st.id).toContain('scale')
      expect(st.error).toBeNull()
      expect(st.notes.length).toBeGreaterThan(0)
    }
    expect(new Set(staves.map((x) => x.id)).size).toBe(2)
  })
})
