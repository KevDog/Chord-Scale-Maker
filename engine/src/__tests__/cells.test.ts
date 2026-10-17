import { describe, expect, it } from 'vitest'
import { CELL_SYSTEMS, type CellId, cellLabel, cellPitches, cellTones, isCellId, SINGLE_CELLS } from '../cells'
import { CONCERT } from '../part'
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
    expect(cellLabel('1-2-3-5' as CellId)).toBe('1 2 3 5')
  })
})
