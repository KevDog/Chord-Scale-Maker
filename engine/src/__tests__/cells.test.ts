import { describe, expect, it } from 'vitest'
import { CELL_SYSTEMS, CHROMATIC_CELLS, type CellId, type CellsLine, cellLabel, cellPitches, cellsVoices, cellTones, isCellId, SINGLE_CELLS } from '../cells'
import type { GuideInput, GuideNote } from '../guideTones'
import { CONCERT, partFor, rangeOf } from '../part'
import { rootName } from '../pitch'

const names = (tones: ReturnType<typeof cellTones>) => tones?.map(rootName)

describe('cells', () => {
  it.each([
    ['root-root', 'a', 'G7', 'G Mixolydian', ['G', 'A', 'B', 'D']],
    ['root-root', 'b', 'C7', 'C Mixolydian', ['C', 'Bb', 'A', 'G']],
    ['3rd-3rd', 'a', 'G7', 'G Mixolydian', ['B', 'A', 'G', 'F']],
    ['3rd-3rd', 'b', 'C7', 'C Mixolydian', ['E', 'G', 'C', 'Bb']],
    ['3rd-5th', 'a', 'G7', 'G Mixolydian', ['B', 'D', 'F', 'A']],
    ['3rd-5th', 'b', 'F7', 'F Mixolydian', ['C', 'A', 'F', 'Eb']],
    ['3rd-root', 'a', 'G7', 'G Mixolydian', ['B', 'G', 'F', 'D']],
    ['3rd-root', 'b', 'C7', 'C Mixolydian', ['C', 'E', 'G', 'Bb']],
  ] as const)('%s %s over %s', (sys, half, chord, scale, expected) => {
    expect(names(cellTones(CONCERT, chord, scale, CELL_SYSTEMS[sys][half].degrees))).toEqual(expected)
  })

  it('reads one cell through each scale: 3 2 1 7 over Dm7 Dorian is F E D C, over Cmaj7 Ionian E D C B', () => {
    expect(names(cellTones(CONCERT, 'Dm7', 'D Dorian', [3, 2, 1, 7]))).toEqual(['F', 'E', 'D', 'C'])
    expect(names(cellTones(CONCERT, 'Cmaj7', 'C Ionian', [3, 2, 1, 7]))).toEqual(['E', 'D', 'C', 'B'])
  })

  it('falls back to the chord tone where the scale has no letter for a degree, and to null where neither has it', () => {
    expect(names(cellTones(CONCERT, 'C7', 'C major pentatonic', [1, 3, 5, 7]))).toEqual(['C', 'E', 'G', 'Bb'])
    expect(names(cellTones(CONCERT, 'C7', undefined, [1, 3, 5, 7]))).toEqual(['C', 'E', 'G', 'Bb'])
    expect(cellTones(CONCERT, 'C7', 'C major pentatonic', [1, 2, 4, 5])).toBeNull()
    expect(cellTones(CONCERT, 'C7', undefined, [1, 2, 3, 5])).toBeNull()
  })

  it('follows the contour: 1 5 3 5 udu from G4 is G4 D5 B4 D5; 3 2 1 7 ddd from B4 is B4 A4 G4 F4', () => {
    const g = cellTones(CONCERT, 'G7', 'G Mixolydian', [1, 5, 3, 5])!
    expect(cellPitches(g, ['u', 'd', 'u'], 67)).toEqual([67, 74, 71, 74])
    const b = cellTones(CONCERT, 'G7', 'G Mixolydian', [3, 2, 1, 7])!
    expect(cellPitches(b, ['d', 'd', 'd'], 71)).toEqual([71, 69, 67, 65])
  })

  it('holds 4 systems and 10 single cells, each 4 degrees and 3 moves', () => {
    expect(Object.keys(CELL_SYSTEMS)).toHaveLength(4)
    expect(SINGLE_CELLS).toHaveLength(10)
    const all = [...Object.values(CELL_SYSTEMS).flatMap((s) => [s.a, s.b]), ...SINGLE_CELLS.map((c) => c.cell)]
    for (const c of all) {
      expect(c.degrees).toHaveLength(4)
      expect(c.contour).toHaveLength(3)
    }
    for (const c of SINGLE_CELLS) expect(c.id).toBe(c.cell.degrees.join('-'))
  })

  it('knows its ids and labels', () => {
    expect(isCellId('root-root')).toBe(true)
    expect(isCellId('1-2-3-5')).toBe(true)
    expect(isCellId('1-2-3-4')).toBe(false)
    expect(isCellId(7)).toBe(false)
    expect(cellLabel('root-root')).toBe('Root to root')
    expect(cellLabel('1-2-3-5')).toBe('1 2 3 5')
  })
})

describe('cells line', () => {
  const scaleOf: Readonly<Record<string, string>> = { G7: 'G Mixolydian', C7: 'C Mixolydian', F7: 'F Mixolydian', Bb7: 'Bb Mixolydian', Dm7: 'D Dorian' }
  const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
    let start = 0
    return cs.map(([chord, beats], row) => {
      const c = { row, chord, scale: scaleOf[chord], start, beats }
      start += beats
      return c
    })
  }
  const line = (id: CellId): CellsLine => ({ kind: 'cells', id })
  const noteNames = (ns: readonly GuideNote[] | undefined) => (ns ?? []).map((n) => (n.pitch ? rootName(n.pitch) : 'r'))
  const midis = (ns: readonly GuideNote[] | undefined) => (ns ?? []).map((n) => n.pitch?.midi ?? -1)

  it('5 3 2 1 on vibes over Fm C7 Fm (Airegin) stays in the comfort band, B♭3 and up, rather than fall to F3', () => {
    const fm = (start: number, beats: number): GuideInput => ({ row: start, chord: 'Fm', scale: 'F Aeolian', start, beats })
    const chords = [fm(0, 4), { row: 4, chord: 'C7', scale: 'C Phrygian dominant', start: 4, beats: 4 }, fm(8, 4)]
    const { bars } = cellsVoices(chords, partFor('vibes'), 4, null, line('5-3-2-1'))
    expect(noteNames(bars.get(0))).toEqual(['C', 'Ab', 'G', 'F', 'C', 'Ab', 'G', 'F'])
    expect([0, 1, 2].flatMap((b) => midis(bars.get(b))).every((m) => m >= 58)).toBe(true)
  })
  it('3rd to 3rd over G7 C7 F7 Bb7 chains the cells, each starting a step from the last note', () => {
    const { bars } = cellsVoices(seq(['G7', 2], ['C7', 2], ['F7', 2], ['Bb7', 2]), CONCERT, 4, null, line('3rd-3rd'))
    expect(noteNames(bars.get(0))).toEqual(['B', 'A', 'G', 'F', 'E', 'G', 'C', 'Bb'])
    expect(noteNames(bars.get(1)).slice(0, 4)).toEqual(['A', 'G', 'F', 'Eb'])
    const m = [...midis(bars.get(0)), ...midis(bars.get(1))]
    expect(Math.abs(m[4]! - m[3]!)).toBeLessThanOrEqual(2)
    expect(Math.abs(m[8]! - m[7]!)).toBeLessThanOrEqual(2)
  })
  it('plays a cell per two beats: a 4-beat chord plays A then B, in eighths', () => {
    const { bars } = cellsVoices(seq(['G7', 4]), CONCERT, 4, null, line('3rd-3rd'))
    expect(noteNames(bars.get(0))).toEqual(['B', 'A', 'G', 'F', 'B', 'D', 'G', 'F'])
    expect(bars.get(0)?.every((n) => n.beats === 0.5)).toBe(true)
  })
  it('Order reversed plays 1 2 3 5 as 5 3 2 1: D B A G over G7, falling', () => {
    const { bars } = cellsVoices(seq(['G7', 2]), CONCERT, 4, null, { kind: 'cells', id: '1-2-3-5', order: 'reversed' })
    expect(noteNames(bars.get(0))).toEqual(['D', 'B', 'A', 'G'])
    const m = midis(bars.get(0))
    expect(m.slice(1).map((x, i) => Math.sign(x - m[i]!))).toEqual([-1, -1, -1])
  })
  it('with no Order, or as written, the line is the same', () => {
    const a = cellsVoices(seq(['G7', 4], ['C7', 4]), CONCERT, 4, null, line('3rd-3rd'))
    const b = cellsVoices(seq(['G7', 4], ['C7', 4]), CONCERT, 4, null, { kind: 'cells', id: '3rd-3rd', order: 'as-written' })
    expect(b).toEqual(a)
  })
  it('a single cell plays the same cell in every slot', () => {
    const { bars } = cellsVoices(seq(['G7', 4]), CONCERT, 4, null, line('1-3-5-7'))
    expect(noteNames(bars.get(0))).toEqual(['G', 'B', 'D', 'F', 'G', 'B', 'D', 'F'])
  })
  it('a chord of one beat plays sixteenths, a chord of three eighths', () => {
    const { bars } = cellsVoices(seq(['G7', 1], ['C7', 3]), CONCERT, 4, null, line('1-3-5-7'))
    const bar = bars.get(0) ?? []
    expect(bar.filter((n) => n.beat < 1).map((n) => n.beats)).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(bar.filter((n) => n.beat >= 1).map((n) => n.beats)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
  })
  it('a G7 of three beats from beat 3 plays its B cell, then turns back in its last slot, and the next chord plays A', () => {
    const { bars } = cellsVoices(seq(['C7', 2], ['G7', 3], ['F7', 3]), CONCERT, 4, null, line('3rd-3rd'))
    expect(noteNames(bars.get(0)).slice(4)).toEqual(['B', 'D', 'G', 'F']) // the chain's B cell on beats 3 and 4
    expect(noteNames(bars.get(1)).slice(0, 2)).toEqual(['G', 'D']) // its last slot, two eighths: turned back on the B cell
    expect(bars.get(1)?.slice(0, 2).map((n) => [n.beat, n.beats])).toEqual([[0, 0.5], [0.5, 0.5]])
    expect(noteNames(bars.get(1)).slice(2, 6)).toEqual(['A', 'G', 'F', 'Eb']) // the turn-back is no cell: F7 plays A
  })
  it('a 4-beat chord from beat 2 carries its second cell across the bar line', () => {
    const { bars } = cellsVoices(seq(['C7', 1], ['G7', 4]), CONCERT, 4, null, line('3rd-3rd'))
    expect(noteNames(bars.get(0)).slice(4)).toEqual(['B', 'D', 'G', 'F', 'B', 'A']) // G7's B cell, then its A cell, cut by the bar line
    expect(noteNames(bars.get(1))).toEqual(['G', 'F']) // and carried on
    expect(bars.get(1)?.map((n) => [n.beat, n.beats])).toEqual([[0, 0.5], [0.5, 0.5]])
  })
  it('3/4, one chord a bar: six eighths, the second cell turned back', () => {
    const { bars } = cellsVoices(seq(['G7', 3]), CONCERT, 3, null, line('1-3-5-7'))
    expect(noteNames(bars.get(0))).toEqual(['G', 'B', 'D', 'F', 'D', 'B'])
  })
  it('a rest chord rests', () => {
    const { bars } = cellsVoices(seq(['G7', 2], ['r', 2]), CONCERT, 4, null, line('1-3-5-7'))
    expect(noteNames(bars.get(0)).slice(4)).toEqual(['r'])
  })
  it('a chord whose cell has no tones plays its 7th chord arpeggio up from the root', () => {
    const { bars } = cellsVoices([{ row: 0, chord: 'C7', start: 0, beats: 4 }], CONCERT, 4, null, line('1-2-3-5'))
    expect(noteNames(bars.get(0)).slice(0, 4)).toEqual(['C', 'E', 'G', 'Bb'])
  })
  it('needs tones only for the cells a chord plays: over C minor pentatonic (no 9) 3rd to 5th’s B cell still plays', () => {
    const cm = (start: number, beats: number): GuideInput => ({ row: 1, chord: 'Cm7', scale: 'C minor pentatonic', start, beats })
    const two = cellsVoices([{ row: 0, chord: 'G7', scale: 'G Mixolydian', start: 0, beats: 2 }, cm(2, 2)], CONCERT, 4, null, line('3rd-5th'))
    expect(noteNames(two.bars.get(0)).slice(4)).toEqual(['G', 'Eb', 'C', 'Bb']) // B: 5 3 1 7
    const four = cellsVoices([cm(0, 4)], CONCERT, 4, null, line('3rd-5th'))
    expect(noteNames(four.bars.get(0))).toEqual(['C', 'Eb', 'G', 'Bb', 'G', 'Eb', 'C', 'Bb']) // A (no 9): the arpeggio up from the root, then B
  })
  it.each(['tenor-sax', 'trombone'] as const)('keeps %s inside its range', (inst) => {
    const part = partFor(inst)
    const r = rangeOf(part)
    const { bars } = cellsVoices(seq(['G7', 4], ['C7', 4], ['F7', 4], ['Bb7', 4], ['Dm7', 4], ['G7', 4]), part, 4, null, line('3rd-5th'))
    for (const m of [...bars.values()].flatMap(midis)) {
      expect(m).toBeGreaterThanOrEqual(r.lo)
      expect(m).toBeLessThanOrEqual(r.hi)
    }
  })
})

describe('approaches into the Cells line (#381)', () => {
  const at = (row: number, chord: string, scale: string, start: number): GuideInput => ({ row, chord, shown: scale, start, beats: 2 })
  const cs = [at(0, 'G7', 'G Mixolydian', 0), at(1, 'C7', 'C Mixolydian', 2)]
  const bar = (approach?: Parameters<typeof cellsVoices>[5]) => cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id: '3rd-3rd' }, approach).bars.get(0)!

  it('leads the cell before into the next cell’s first note, in its eighths', () => {
    const plain = bar()
    const led = bar('chromatic-below')
    expect(led.map((n) => [n.beat, n.beats])).toEqual(plain.map((n) => [n.beat, n.beats]))
    expect(led.slice(0, 3)).toEqual(plain.slice(0, 3))
    expect(led.slice(4)).toEqual(plain.slice(4))
    expect(led[3]!.pitch).toMatchObject({ letter: 1, acc: 1, midi: plain[4]!.pitch!.midi - 1 }) // D♯ into E
  })
})

describe('chromatic cells (#377)', () => {
  const at = (row: number, chord: string, scale: string | undefined, start: number, beats = 2): GuideInput => ({ row, chord, scale, start, beats })
  const noteNames = (ns: readonly GuideNote[] | undefined) => (ns ?? []).map((n) => (n.pitch ? rootName(n.pitch) : 'r'))
  const moves = (ns: readonly GuideNote[]) => ns.slice(1).map((n, i) => (n.pitch!.midi > ns[i]!.pitch!.midi ? 'u' : 'd')).join('')
  const play = (chords: readonly GuideInput[], id: CellId, more: Partial<CellsLine> = {}) =>
    cellsVoices(chords, CONCERT, 4, null, { kind: 'cells', id, ...more }).bars.get(0) ?? []

  it.each([
    ['1-n7-7-6', ['G', 'F#', 'F', 'E'], 'ddd'],
    ['5-s5-6-7', ['D', 'D#', 'E', 'F'], 'uuu'],
    ['b9-1-3-5', ['Ab', 'G', 'B', 'D'], 'duu'],
    ['3-5-7-b9', ['B', 'D', 'F', 'Ab'], 'uuu'],
  ] as const)('%s over G7 plays %j, %s', (id, notes, contour) => {
    const bar = play([at(0, 'G7', 'G Mixolydian', 0)], id)
    expect(noteNames(bar)).toEqual(notes)
    expect(moves(bar)).toBe(contour)
  })

  it('II–V chromatic over Dm7 G7: D F A C, then B D F A♭', () => {
    expect(noteNames(play([at(0, 'Dm7', 'D Dorian', 0), at(1, 'G7', 'G Mixolydian', 2)], 'ii-v-chromatic'))).toEqual(['D', 'F', 'A', 'C', 'B', 'D', 'F', 'Ab'])
  })

  it('a dominant-only cell over Cmaj7 plays its 7th chord arpeggio up from the root', () => {
    expect(noteNames(play([at(0, 'Cmaj7', 'C Ionian', 0)], 'b9-1-3-5'))).toEqual(['C', 'E', 'G', 'B'])
  })

  it('spells a chromatic degree on the letter its number names: ♭9 of E♭7 is F♭, never E', () => {
    expect(noteNames(play([at(0, 'Eb7', 'Eb Mixolydian', 0)], 'b9-1-3-5'))).toEqual(['Fb', 'Eb', 'G', 'Bb'])
    expect(names(cellTones(CONCERT, 'Eb7', undefined, [{ n: 9, semis: 1 }]))).toEqual(['Fb'])
  })

  it('reads it from the written root: ♭9 of G7 on a tenor sax (A7) is B♭', () => {
    expect(names(cellTones(partFor('tenor-sax'), 'G7', 'G Mixolydian', [{ n: 9, semis: 1 }, 1]))).toEqual(['Bb', 'A'])
  })

  it.each([
    ['G7b13', 'G Mixolydian b6', ['G', 'B', 'D', 'F']],
    ['G7alt', 'G Altered', ['G', 'B', 'D#', 'F']], // the arpeggio's 5th as the scale has it
  ] as const)('never doubles a note: 5 ♯5 6 7 over %s (%s) plays the 7th chord arpeggio up instead, %j', (chord, scale, arpeggio) => {
    expect(noteNames(play([at(0, chord, scale, 0)], '5-s5-6-7'))).toEqual(arpeggio)
  })

  it('1 ♮7 7 6 over G7alt has no doubled neighbours: G F♯ F E♭', () => {
    expect(noteNames(play([at(0, 'G7alt', 'G Altered', 0)], '1-n7-7-6'))).toEqual(['G', 'F#', 'F', 'Eb'])
  })

  it('counts a chromatic degree from the chord’s root, not a scale on another root: ♭9 of G7 over C Ionian is A♭', () => {
    expect(names(cellTones(CONCERT, 'G7', 'C Ionian', [{ n: 9, semis: 1 }]))).toEqual(['Ab'])
  })

  it('takes the Order: 1 ♮7 7 6 reversed over G7 is E F F♯ G, rising', () => {
    const bar = play([at(0, 'G7', 'G Mixolydian', 0)], '1-n7-7-6', { order: 'reversed' })
    expect(noteNames(bar)).toEqual(['E', 'F', 'F#', 'G'])
    expect(moves(bar)).toBe('uuu')
  })

  it('is left as chosen by phrase: the same line, phrase on or off', () => {
    const cs = [at(0, 'Dm7', 'D Dorian', 0, 4), at(1, 'G7', 'G Mixolydian', 4, 8), at(2, 'Cmaj7', 'C Ionian', 12, 4)]
    const on = cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id: '3-5-7-b9', phrase: true })
    expect(on).toEqual(cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id: '3-5-7-b9' }))
    expect(noteNames(on.bars.get(1))).toEqual(['B', 'D', 'F', 'Ab', 'B', 'D', 'F', 'Ab'])
  })

  it('knows the ids and labels', () => {
    expect(CHROMATIC_CELLS.map((c) => c.id)).toEqual(['1-n7-7-6', '5-s5-6-7', 'b9-1-3-5', '3-5-7-b9', 'ii-v-chromatic'])
    expect(CHROMATIC_CELLS.map((c) => cellLabel(c.id))).toEqual(['1 ♮7 7 6', '5 ♯5 6 7', '♭9 1 3 5', '3 5 7 ♭9', 'II–V chromatic'])
    expect(CHROMATIC_CELLS.filter((c) => c.dominantOnly).map((c) => c.id)).toEqual(['1-n7-7-6', '5-s5-6-7', 'b9-1-3-5', '3-5-7-b9'])
    expect(isCellId('b9-1-3-5')).toBe(true)
    expect(isCellId('ii-v-chromatic')).toBe(true)
    expect(isCellId('b9-1-3-4')).toBe(false)
  })
})
