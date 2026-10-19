import { describe, expect, it } from 'vitest'
import { parseRoot, pcOf, type Spelled } from '../pitch'
import { quartalCaption, quartalPick, quartalRanking, quartalStacks, rankedStacks, stackFits } from '../quartal'
import { type ScaleKey, spellScale } from '../scales'

const scale = (root: string, key: ScaleKey): readonly Spelled[] => spellScale(parseRoot(root), key)
const stacks = (root: string, key: ScaleKey, quality: string | null, notes: 3 | 4 = 4, perfect = false) => quartalStacks(scale(root, key), parseRoot(root), quality, notes, perfect)
const names = (root: string, key: ScaleKey, quality: string | null, notes: 3 | 4 = 4, perfect = false) => stacks(root, key, quality, notes, perfect).map((s) => s.name)
const auto = (root: string, key: ScaleKey, quality: string | null, notes: 3 | 4 = 4, perfect = false) => quartalRanking(stacks(root, key, quality, notes, perfect), parseRoot(root))[0]?.name

describe('quartalStacks', () => {
  it("stacks a seven-note scale's notes three steps apart, from each degree, keeping fourths that are perfect or one augmented", () => {
    // C major: C F B E and F B E A and G C F B hold one augmented fourth; none holds two
    expect(names('C', 'ionian', null)).toEqual(['C F B E', 'D G C F', 'E A D G', 'F B E A', 'G C F B', 'A D G C', 'B E A D'])
    expect(stacks('C', 'ionian', null).map((s) => s.augmented)).toEqual([1, 0, 0, 1, 1, 0, 0])
    expect(stacks('C', 'ionian', null).map((s) => s.degree)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('drops a stack with a diminished fourth, or with two augmented ones', () => {
    // D melodic minor (D E F G A B C♯): F B E A and A D G C♯ hold one augmented; D G C♯ F, G C♯ F B and C♯ F B E a diminished (C♯–F)
    expect(names('D', 'melodic minor', null)).toEqual(['E A D G', 'F B E A', 'A D G C♯', 'B E A D'])
  })

  it('keeps perfect fourths only under the perfect-only setting', () => {
    expect(names('C', 'ionian', null, 4, true)).toEqual(['D G C F', 'E A D G', 'A D G C', 'B E A D'])
    expect(names('C', 'ionian', null, 3, true)).toEqual(['D G C', 'E A D', 'G C F', 'A D G', 'B E A'])
  })

  it('stacks three notes', () => {
    expect(names('C', 'ionian', null, 3)).toEqual(['C F B', 'D G C', 'E A D', 'F B E', 'G C F', 'A D G', 'B E A'])
  })

  it('has none on a scale that is not seven notes', () => {
    expect(names('C', 'half whole diminished', '7')).toEqual([])
    expect(names('C', 'major pentatonic', 'maj')).toEqual([])
  })

  it('counts the guide tones and chord tones it holds, and whether it holds an avoid note (a half step above a chord tone)', () => {
    const g7 = stacks('G', 'mixolydian', '7')
    const at = (n: string) => g7.find((s) => s.name === n)!
    expect([at('F B E A').guides, at('F B E A').tones, at('F B E A').avoid]).toEqual([2, 2, false])
    expect(at('G C F B').avoid).toBe(true) // C over B
    expect([at('E A D G').guides, at('E A D G').tones]).toEqual([0, 2])
  })
})

describe('quartalRanking: Auto', () => {
  it('picks the ii–V–I in C: both guide tones, no avoid note, perfect fourths first', () => {
    expect(auto('D', 'dorian', 'm7')).toBe('D G C F') // 1 4 ♭7 ♭3
    expect(auto('G', 'mixolydian', '7')).toBe('F B E A') // ♭7 3 13 9, the tritone stack
    expect(auto('C', 'ionian', 'Maj7')).toBe('B E A D') // 7 3 13 9
  })

  it('ranks without an avoid note ahead of the guide tones', () => {
    const ranked = quartalRanking(stacks('C', 'ionian', 'Maj7'), parseRoot('C'))
    expect(ranked.findIndex((s) => s.name === 'G C F B')).toBeGreaterThan(ranked.findIndex((s) => s.name === 'A D G C'))
  })

  it('without the tritone under perfect-only, a V7 takes the perfect stack with a guide tone', () => {
    expect(auto('G', 'mixolydian', '7', 4, true)).toBe('B E A D')
  })

  it('falls back on fifths from the root for an unknown quality', () => {
    expect(auto('C', 'ionian', null)).toBe('D G C F') // nothing to count: perfect fourths, then the bottom note fewest fifths from C
  })
})

describe('quartalPick', () => {
  const pcs = (s: readonly Spelled[]) => s.map(pcOf)
  it("lights Auto's stack, or the one Built on a degree; a degree with no stack reads as Auto", () => {
    const dm = scale('D', 'dorian')
    const a = quartalPick(dm, parseRoot('D'), 'm7', 'auto', 4, false, pcs(dm))
    expect(a.quartal).toMatchObject({ name: 'D G C F', degree: 1, picked: false })
    expect(a.lit).toEqual([true, false, true, true, false, false, true]) // D E F G A B C
    expect(quartalPick(dm, parseRoot('D'), 'm7', 5, 4, false, pcs(dm)).quartal?.name).toBe('A D G C')
  })

  it('lights nothing where the scale has no stacks', () => {
    const hw = scale('C', 'half whole diminished')
    const p = quartalPick(hw, parseRoot('C'), '7', 'auto', 4, false, pcs(hw))
    expect(p.quartal).toBeNull()
    expect(p.lit.some(Boolean)).toBe(false)
  })

  it('captions the stack and its kind', () => {
    expect(quartalCaption({ name: 'D G C F', degree: 2, notes: 4, picked: false, sheet: 'D G C F' })).toBe('D G C F · 4ths')
    expect(quartalCaption(null)).toBe('no 4ths stack')
  })
})

describe('Notes Auto (#432)', () => {
  const TREBLE = { lo: 60, hi: 81, centre: 69 } // C4–A5
  const NARROW = { lo: 60, hi: 74, centre: 67 } // C4–D5: no 4-note stack fits
  it('fits a stack where some octave of it lies in the range', () => {
    const [cfbe, dgcf, , , gcfb] = stacks('C', 'ionian', null)
    expect([dgcf, cfbe, gcfb].map((s) => stackFits(s!, TREBLE))).toEqual([true, true, false]) // D4–F5, C4–E5 (16 semitones); G4–B5 is out, G3 too
    expect(stackFits(dgcf!, NARROW)).toBe(false)
  })

  it('stacks four notes where two of the chord’s four-note stacks fit the range, else three', () => {
    const ranked = (range: typeof TREBLE) => rankedStacks(scale('D', 'dorian'), parseRoot('D'), 'm7', 'auto', false, range).map((s) => s.name)
    expect(ranked(TREBLE)[0]).toBe('D G C F')
    expect(ranked(NARROW)[0]).toBe('G C F')
    expect(rankedStacks(scale('D', 'dorian'), parseRoot('D'), 'm7', 3, false, TREBLE)[0]?.name).toBe('G C F') // a set number is kept
  })
})
