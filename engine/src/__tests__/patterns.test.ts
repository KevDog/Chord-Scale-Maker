import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { noteName } from '../instruments'
import { type Pitched, partFor, rangeOf } from '../part'
import { rootName } from '../pitch'
import { buildPatternSheet, formatPattern, parsePattern, PATTERN_LIBRARY, patternLine, patternRun, splitRun } from '../patterns'

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
  it('returns an error rather than looping for moves that never advance', () => {
    expect(() => patternRun(7, [1, -1], 'up')).toThrow(/advance/)
    expect(() => patternRun(0, [1, 1], 'up')).toThrow(/size/)
    expect(patternLine(CONCERT_PIANO, 'Cmaj7', 'C Ionian', [1, -1], 'scale', 'up')).toEqual({ error: expect.stringMatching(/advance/) })
  })

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
    // each 29-note Up run continues onto a second stave (16 + 13): two lines, four staves
    expect(staves).toHaveLength(4)
    for (const st of staves) {
      expect(st.id).toContain(formatPattern(moves))
      expect(st.id).toContain('scale')
      expect(st.error).toBeNull()
      expect(st.notes.length).toBeGreaterThan(0)
    }
    expect(new Set(staves.map((x) => x.id)).size).toBe(4)
  })
  describe('long runs', () => {
    const moves = [1, 1, 1, -2]
    const build = (dir: 'up' | 'down' | 'up-down', perPage = 12) =>
      buildPatternSheet([row('Cmaj7', 'C Ionian'), row('Dm7', 'D Dorian')], CONCERT_PIANO, perPage, moves, 'scale', dir).pages.flat()
    const whole = (chord: string, scale: string, dir: 'up' | 'down' | 'up-down', m: readonly number[] = moves) => {
      const r = patternLine(CONCERT_PIANO, chord, scale, m, 'scale', dir)
      if ('error' in r) throw new Error(r.error)
      return r
    }
    it('splits the default Up & down at the turn, then at whole groups of at most 24 notes', () => {
      const staves = build('up-down').filter((s) => s.id.startsWith('Cmaj7'))
      const full = whole('Cmaj7', 'C Ionian', 'up-down')
      expect(full.notes).toHaveLength(57)
      expect(staves.length).toBeGreaterThan(1)
      for (const s of staves) {
        expect(s.notes.length).toBeLessThanOrEqual(24)
        expect(s.groups.reduce((a, b) => a + b, 0)).toBe(s.notes.length)
        expect(s.intervals).toHaveLength(s.notes.length)
      }
      expect(staves.flatMap((s) => s.notes)).toEqual(full.notes)
      expect(staves.flatMap((s) => s.groups)).toEqual(full.groups)
      // Down starts on the octave, and a stave starts there: the break at the turn
      const octave = (full.notes[0]?.midi ?? 0) + 12
      expect(staves.findIndex((s, i) => i > 0 && s.notes[0]?.midi === octave)).toBeGreaterThan(0)
    })
    it('balances a run over the fewest staves instead of leaving an orphan', () => {
      const staves = build('up').filter((s) => s.id.startsWith('Cmaj7'))
      expect(staves.map((s) => s.notes.length)).toEqual([16, 13])
    })
    it('keeps a run of at most 24 notes on one stave', () => {
      const short = buildPatternSheet([row('Cmaj7', 'C Ionian')], CONCERT_PIANO, 12, [2, -1], 'chord', 'up-down').pages.flat()
      expect(short).toHaveLength(1)
      expect(short[0]?.notes.length).toBeLessThanOrEqual(24)
      expect(short[0]?.last).toBe(true)
    })
    it('labels the first stave only, ends on one last, and gives unique ids', () => {
      const all = build('up-down')
      const mine = all.filter((s) => s.id.startsWith('Cmaj7'))
      expect(mine[0]?.chords).toHaveLength(1)
      expect(mine[0]?.scale).not.toBeNull()
      for (const s of mine.slice(1)) {
        expect(s.chords).toEqual([])
        expect(s.scale).toBeNull()
      }
      expect(all.filter((s) => s.last)).toEqual([all.at(-1)])
      expect(new Set(all.map((s) => s.id)).size).toBe(all.length)
    })
    it('splits by dynamic programming: fewest pieces, then the smallest largest, then the longer first', () => {
      const cuts = (g: number[], turn = 0) => splitRun(g, turn).map(([a, b]) => g.slice(a, b).reduce((x, y) => x + y, 0))
      expect(cuts([9, 9, 9, 9, 9])).toEqual([18, 18, 9])
      expect(cuts([4, 4, 4, 4, 4, 4, 4, 1])).toEqual([16, 13])
      expect(cuts([4, 4, 1])).toEqual([9])
      expect(cuts([30, 5])).toEqual([30, 5]) // a lone group over the cap stands alone
      expect(cuts([4, 4, 4, 4, 4, 4, 4, 4], 4)).toEqual([16, 16])
      expect(() => splitRun([4, 4], 3)).toThrow()
    })
    it('keeps every cut on a group boundary and off the turn, for every pattern, direction and scale size', () => {
      const scales = ['C Major Pentatonic', 'C Whole Tone', 'C Ionian', 'C Bebop Dominant']
      const patterns = [...PATTERN_LIBRARY.map((p) => p.moves), [1, 1, 1, 1, 1, 1, 1, -6], [1, 2, 1, -1, 2, -2, 1, -1]]
      for (const moves of patterns)
        for (const dir of ['up', 'down', 'up-down'] as const)
          for (const scale of scales) {
            const full = whole('C7', scale, dir, moves)
            const staves = buildPatternSheet([row('C7', scale)], CONCERT_PIANO, 100, moves, 'scale', dir).pages.flat()
            const tag = `${moves} ${dir} ${scale}`
            expect(staves.flatMap((x) => x.notes), tag).toEqual(full.notes)
            expect(staves.flatMap((x) => x.groups), tag).toEqual(full.groups)
            for (const x of staves) {
              expect(x.groups.reduce((a, b) => a + b, 0), tag).toBe(x.notes.length)
              if (x.groups.length > 1) expect(x.notes.length, tag).toBeLessThanOrEqual(24)
            }
            if (dir === 'up-down' && full.notes.length > 24) {
              const turnAt = full.groups.slice(0, (full.groups.length + 1) / 2 - 1).reduce((a, b) => a + b, 0)
              const ends = staves.map((x, i) => staves.slice(0, i + 1).reduce((a, y) => a + y.notes.length, 0))
              expect(ends, tag).toContain(turnAt)
            }
          }
    })
    it('restarts accidentals on each stave', () => {
      const staves = buildPatternSheet([row('Gmaj7', 'G Ionian')], CONCERT_PIANO, 12, moves, 'scale', 'up-down').pages.flat()
      const sharpAt = (s: (typeof staves)[number]) => s.notes.findIndex((n) => n.acc === 1)
      expect(staves.length).toBeGreaterThan(1)
      // no key signature: every stave's first F sharp is written, as in a fresh bar
      const withSharp = staves.filter((s) => sharpAt(s) >= 0)
      expect(withSharp.length).toBeGreaterThan(1)
      for (const s of withSharp) expect(s.accidentals[sharpAt(s)]).toBe('#')
    })
    it('pages the pieces', () => {
      const pages = buildPatternSheet([row('Cmaj7', 'C Ionian')], CONCERT_PIANO, 2, moves, 'scale', 'up-down').pages
      expect(pages.length).toBeGreaterThan(1)
      expect(pages[0]).toHaveLength(2)
    })
  })
})
