import { describe, expect, it } from 'vitest'
import { pitchClasses, rankTranspositions, sharedCount } from '../ladder'
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
