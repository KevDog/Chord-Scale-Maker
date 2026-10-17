import { describe, expect, it } from 'vitest'
import { CELL_SYSTEMS, type CellId, type CellsLine, cellLabel, cellPitches, cellsVoices, cellTones, isCellId, SINGLE_CELLS } from '../cells'
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
