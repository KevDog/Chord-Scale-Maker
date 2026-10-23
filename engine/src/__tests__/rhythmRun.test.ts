import { describe, expect, it } from 'vitest'
import { cardBars, evenBar, evenRun, isNotesPerBar, layRhythm, NOTES_PER_BAR, NOTES_PER_BAR_LABELS, pourRun, rhythmNotes } from '../rhythm'
import type { RhythmId, RhythmValue, RunBar } from '../rhythm'
import { sheetRhythmText } from '../sheet'

describe('cardBars (§1)', () => {
  const card = (id: string, beats = 4) => cardBars(id as RhythmId, beats)!
  it.each([
    ['unit:8:3:accents', 4, 3, false],
    ['unit:8:5:accents', 4, 4, true],
    ['unit:8:4:accents', 4, 1, false],
    ['card:downbeats', 4, 1, false],
    ['run:8:3:0', 4, 1, false],
    ['unit:8:3:accents', 3, 1, false],
  ])('%s at %i beats', (id, beats, bars, cut) => {
    expect(card(id, beats)).toMatchObject({ beats, cut })
    expect(card(id, beats).bars.length).toBe(bars)
  })

  it('is null for off', () => {
    expect(cardBars('off', 4)).toBeNull()
  })

  it('lays the rhythm over the card bars', () => {
    expect(cardBars('unit:8:3:accents', 4)!.bars).toEqual(rhythmNotes(layRhythm('unit:8:3:accents', [4, 4, 4])!))
  })
})

describe('Notes per bar', () => {
  it('lists whole notes and 1 to 7 a bar', () => {
    expect(NOTES_PER_BAR).toEqual(['whole', 1, 2, 3, 4, 5, 6, 7])
    expect(NOTES_PER_BAR_LABELS['whole']).toBe('Whole notes')
    expect(NOTES_PER_BAR_LABELS[1]).toBe('1 a bar')
    expect(NOTES_PER_BAR_LABELS[7]).toBe('7 a bar')
    expect(NOTES_PER_BAR.every(isNotesPerBar)).toBe(true)
    expect([0, 8, '4', 'Whole', null].some(isNotesPerBar)).toBe(false)
  })

  it('names a number in the subtitle', () => {
    expect(sheetRhythmText('unit:8:3:accents', 4)).toEqual(['Rhythm: 8ths in 3, with accents', '4 a bar'])
    expect(sheetRhythmText('off', 1)).toEqual(['1 a bar'])
    expect(sheetRhythmText('off', 'whole')).toEqual([])
  })
})

const t = (notes: number, of: number) => ({ notes, of })
const x = (v: RhythmValue, n: number): RhythmValue[] => Array<RhythmValue>(n).fill(v)

describe('evenBar (§2)', () => {
  it.each<[number, number, RhythmValue[], { notes: number; of: number } | null]>([
    [3, 1, ['hd'], null],
    [4, 1, ['w'], null],
    [5, 1, ['w', 'q'], null],
    [3, 2, ['qd', 'qd'], null],
    [4, 2, ['h', 'h'], null],
    [5, 2, ['q', 'q'], t(2, 5)],
    [3, 3, x('q', 3), null],
    [4, 3, ['h', 'h', 'h'], t(3, 2)],
    [5, 3, x('q', 3), t(3, 5)],
    [3, 4, x('q', 4), t(4, 3)],
    [4, 4, x('q', 4), null],
    [5, 4, x('q', 4), t(4, 5)],
    [3, 5, x('q', 5), t(5, 3)],
    [4, 5, x('q', 5), t(5, 4)],
    [5, 5, x('q', 5), null],
    [3, 6, x('8', 6), null],
    [4, 6, x('q', 6), t(6, 4)],
    [5, 6, x('q', 6), t(6, 5)],
    [3, 7, x('8', 7), t(7, 6)],
    [4, 7, x('q', 7), t(7, 4)],
    [5, 7, x('q', 7), t(7, 5)],
  ])('%i beats, %i a bar', (beats, n, values, tuplet) => {
    expect(evenBar(beats, n)).toEqual({ values, tuplet })
  })
})

const notesOf = (bar: RunBar) => bar.notes.map(n => n.note)
const valuesOf = (bar: RunBar) => bar.notes.map(n => n.mark.value)

describe('evenRun (§2)', () => {
  it('4/4, 4 a bar: the last bar rests a quarter', () => {
    const run = evenRun(15, 4, 4)
    expect(run.beats).toBe(4)
    expect(run.bars.map(notesOf)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, null]])
    expect(run.bars[3]!.notes[3]!.mark).toMatchObject({ value: 'q', rest: true, beat: 3 })
    expect(run.bars.every(b => b.tuplet === null)).toBe(true)
  })

  it('4/4, 5 a bar: three bars of 5:4, no rests', () => {
    const run = evenRun(15, 4, 5)
    expect(run.bars).toHaveLength(3)
    expect(run.bars.map(b => b.tuplet)).toEqual([t(5, 4), t(5, 4), t(5, 4)])
    expect(run.bars.flatMap(b => b.notes).every(n => n.note !== null && n.mark.tuplet === 0 && n.mark.beam === null)).toBe(true)
    expect(run.bars[0]!.notes.map(n => n.mark.beat)).toEqual([0, 0.8, 1.6, 2.4, 3.2])
  })

  it("3/4, 6 a bar: the last bar's rests merge", () => {
    const last = evenRun(15, 3, 6).bars.at(-1)!
    expect(notesOf(last)).toEqual([12, 13, 14, null, null])
    expect(last.notes.slice(3).map(n => [n.mark.value, n.mark.beat, n.mark.rest])).toEqual([['8', 1.5, true], ['q', 2, true]])
    expect(last.notes.map(n => n.mark.beam)).toEqual([0, 0, 0, null, null])
  })

  it('4/4, 7 a bar: one note and six tuplet quarter rests', () => {
    const last = evenRun(15, 4, 7).bars.at(-1)!
    expect(last.tuplet).toEqual(t(7, 4))
    expect(notesOf(last)).toEqual([14, null, null, null, null, null, null])
    expect(last.notes.slice(1).every(n => n.mark.rest && n.mark.value === 'q' && n.mark.tuplet === 0)).toBe(true)
  })

  it('3/4, 7 a bar: 8ths beam as one group under the tuplet', () => {
    const bar = evenRun(15, 3, 7).bars[0]!
    expect(bar.notes.map(n => [n.mark.tuplet, n.mark.beam])).toEqual(x('8', 7).map(() => [0, 0]))
  })

  it('4/4, 2 a bar: the last bar rests a half', () => {
    const run = evenRun(15, 4, 2)
    expect(run.bars).toHaveLength(8)
    expect(valuesOf(run.bars[7]!)).toEqual(['h', 'h'])
    expect(notesOf(run.bars[7]!)).toEqual([14, null])
    expect(run.bars[7]!.notes.map(n => n.mark.rest)).toEqual([false, true])
  })

  it('4/4, 4 a bar, one note left: q, r(q), r(h), not r(hd)', () => {
    const last = evenRun(13, 4, 4).bars.at(-1)!
    expect(notesOf(last)).toEqual([12, null, null])
    expect(last.notes.map(n => [n.mark.value, n.mark.beat, n.mark.rest])).toEqual([['q', 0, false], ['q', 1, true], ['h', 2, true]])
  })

  it('5/4, 1 a bar: a whole tied to a quarter', () => {
    const run = evenRun(3, 5, 1)
    expect(run.bars).toHaveLength(3)
    expect(run.bars[1]!.notes.map(n => [n.note, n.mark.value, n.mark.beat, n.mark.tie, n.mark.tiedIn])).toEqual([
      [1, 'w', 0, true, false],
      [1, 'q', 4, false, true],
    ])
  })
})

/** the canonical custom id for a rhythm's text */
const custom = (text: string): RhythmId => `custom:${text.replace(': ', ':')}` as RhythmId

describe('pourRun (§3, §4)', () => {
  it('keeps the first n attacks a bar: unit:8:3:accents, 4 a bar', () => {
    const run = pourRun(15, 'unit:8:3:accents', 4, 4)!
    const [bar, bar2] = [run.bars[0]!, run.bars[1]!]
    expect(notesOf(bar)).toEqual([0, 1, 2, 3, null])
    expect(valuesOf(bar)).toEqual(['8', '8', '8', '8', 'h'])
    expect(bar.notes[4]!.mark).toMatchObject({ rest: true, beat: 2, accent: false })
    expect(notesOf(bar2)).toEqual([4, 5, 6, 7, null])
    expect(valuesOf(bar2)).toEqual(['8', '8', '8', '8', 'h'])
    expect(bar2.notes[4]!.mark).toMatchObject({ rest: true, beat: 2 })
  })

  it('card:downbeats, 3 a bar: q q q and a quarter rest', () => {
    const run = pourRun(15, 'card:downbeats', 4, 3)!
    expect(run.bars).toHaveLength(5)
    for (const [b, bar] of run.bars.slice(0, 2).entries()) {
      expect(notesOf(bar)).toEqual([3 * b, 3 * b + 1, 3 * b + 2, null])
      expect(valuesOf(bar)).toEqual(['q', 'q', 'q', 'q'])
      expect(bar.notes.map(n => n.mark.rest)).toEqual([false, false, false, true])
    }
  })

  it('every attack with no n: unit:8:3:accents over 9 notes', () => {
    const run = pourRun(9, 'unit:8:3:accents', 4, null)!
    expect(run.bars).toHaveLength(2)
    const accented = run.bars.flatMap(b => b.notes).filter(n => n.mark.accent).map(n => n.note)
    expect(accented).toEqual([0, 3, 6])
    expect(run.bars[0]!.notes.map(n => n.mark.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
    expect(notesOf(run.bars[1]!)).toEqual([8, null, null, null])
    expect(valuesOf(run.bars[1]!)).toEqual(['8', '8', 'q', 'h'])
    expect(run.bars[1]!.notes.map(n => n.mark.beat)).toEqual([0, 0.5, 1, 2])
    expect(run.bars.flatMap(b => b.notes).every(n => n.mark.bracket === null)).toBe(true)
  })

  it('unit:8:3:rests places the notes on its attacks', () => {
    const run = pourRun(9, 'unit:8:3:rests', 4, null)!
    expect(run.bars).toHaveLength(4)
    expect(notesOf(run.bars[0]!)).toEqual([0, null, null, 1, null, 2, null])
    expect(valuesOf(run.bars[0]!)).toEqual(['8', '8', '8', '8', 'q', '8', '8'])
    expect(notesOf(run.bars[3]!)).toEqual([8, null, null, null])
  })

  it('card:downbeats over 9 notes', () => {
    const run = pourRun(9, 'card:downbeats', 4, null)!
    expect(run.bars.map(notesOf).slice(0, 2)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]])
    expect(run.bars).toHaveLength(3)
    expect(notesOf(run.bars[2]!)).toEqual([8, null, null])
    expect(run.bars[2]!.notes.map(n => [n.mark.value, n.mark.beat, n.mark.rest])).toEqual([['q', 0, false], ['q', 1, true], ['h', 2, true]])
  })

  it("a tied-in piece holds its attack's note, across the barline too", () => {
    const run = pourRun(3, 'unit:8:3:tied', 4, null)!
    expect(run.bars[0]!.notes.map(n => [n.note, n.mark.value, n.mark.tiedIn])).toEqual([
      [0, 'qd', false],
      [1, '8', false],
      [1, 'q', true],
      [2, 'q', false],
    ])
    expect(run.bars).toHaveLength(2)
    expect(run.bars[1]!.notes[0]).toMatchObject({ note: 2, mark: { tiedIn: true } })
    expect(notesOf(run.bars[1]!).slice(1).every(n => n === null)).toBe(true)
  })

  it('unit:8q:5:accents, 3 notes: a 5:4 group of two 8ths, its rest filling the group (Phase 4 spec §2)', () => {
    const run = pourRun(3, 'unit:8q:5:accents', 4, 2)!
    const bar = run.bars[0]!
    expect(notesOf(bar)).toEqual([0, 1, null, null])
    expect(valuesOf(bar)).toEqual(['8', '8', 'qd', 'h'])
    expect(bar.notes.map(n => n.mark.ratio)).toEqual([{ notes: 5, of: 4 }, { notes: 5, of: 4 }, { notes: 5, of: 4 }, null])
  })

  it("keeps a rhythm's empty bar and goes on (Review Focus 1)", () => {
    const run = pourRun(3, custom('8: x...............'), 4, null)!
    expect(run.bars.map(b => b.notes.find(n => n.note !== null)?.note ?? null)).toEqual([0, null, 1, null, 2])
  })

  it('is null for off, an invalid id, or too few attacks in 64 bars', () => {
    expect(pourRun(9, 'off', 4, null)).toBeNull()
    expect(pourRun(0, 'unit:8:3:accents', 4, null)).toBeNull()
    expect(pourRun(-1, 'unit:8:3:accents', 4, null)).toBeNull()
    expect(pourRun(9, 'unit:8:9:accents', 4, null)).toBeNull()
    expect(pourRun(65, 'unit:8:3:accents', 4, 1)).toBeNull()
    expect(pourRun(64, 'unit:8:3:accents', 4, 1)!.bars).toHaveLength(64)
  })

  it("keeps triplets' tuplets on the kept notes", () => {
    const bar = pourRun(9, 'unit:8t:3:accents', 4, 2)!.bars[0]!
    expect(notesOf(bar)).toEqual([0, 1, null, null, null])
    expect(bar.notes.slice(0, 2).map(n => n.mark.tuplet)).toEqual([0, 0])
    expect(bar.notes.slice(2).map(n => [n.mark.value, n.mark.beat])).toEqual([['8', 2 / 3], ['q', 1], ['h', 2]])
  })
})
