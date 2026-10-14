import { describe, expect, it } from 'vitest'
import { fifthsFrom, pitchClasses, rankByFifths, rankTranspositions, sharedCount } from '../ladder'
import { SCALES } from '../scales'

const C_MAJOR = pitchClasses(SCALES.ionian[0])
const MINOR_PENT = pitchClasses(SCALES['minor pentatonic'][0])

describe('the generic ladder', () => {
  it('reads a formula as pitch classes on a root', () => {
    expect([...pitchClasses(SCALES['minor pentatonic'][0], 9)].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]) // A C D E G
  })

  it('counts a minor pentatonic’s notes in C major on every root', () => {
    expect([9, 2, 4, 7, 11, 0, 6, 5, 1, 10, 8, 3].map((r) => sharedCount(MINOR_PENT, r, C_MAJOR))).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
  })

  it('ranks all 12 transpositions, most shared first, ties by root', () => {
    const ranked = rankTranspositions(MINOR_PENT, C_MAJOR)
    expect(ranked).toHaveLength(12)
    expect(ranked.map((t) => t.shared)).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
    expect(ranked.slice(0, 3).map((t) => t.root)).toEqual([2, 4, 9]) // Dm Em Am
  })

  it('ranks any set: a triad pair (major triads a whole step apart) over C Lydian', () => {
    const pair = new Set([0, 4, 7, 2, 6, 9]) // C and D major triads on root 0
    const lydian = pitchClasses(SCALES.lydian[0])
    const ranked = rankTranspositions(pair, lydian)
    expect(ranked[0]).toEqual({ root: 0, shared: 6 }) // C/D: all six inside C Lydian
    expect(ranked.every((t) => t.shared <= 6)).toBe(true)
  })
})

describe('ranking by fifths from a reference', () => {
  it('signs the fifths: ♯ side up to 5, ♭ side past it, the tritone ♭', () => {
    expect([0, 7, 2, 5, 10, 6, 11, 1].map((r) => fifthsFrom(r, 0))).toEqual([0, 1, 2, -1, -2, -6, 5, -5])
    expect(fifthsFrom(9, 2)).toBe(1) // A is one fifth above D
  })

  it('orders C major’s pentatonics from C: most shared, then fewest fifths', () => {
    const ranked = rankByFifths(MINOR_PENT, C_MAJOR, 0)
    expect(ranked.map((t) => t.root)).toEqual([2, 9, 4, 7, 11, 0, 6, 5, 1, 10, 8, 3]) // Dm Am Em, Gm Bm, Cm F♯m …
    expect(ranked.map((t) => t.shared)).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
  })

  it('puts the ♭ side first on equal distance', () => {
    const all = new Set(Array.from({ length: 12 }, (_, i) => i)) // every root shares 5
    expect(rankByFifths(MINOR_PENT, all, 0).map((t) => t.fifths)).toEqual([0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6])
  })
})
