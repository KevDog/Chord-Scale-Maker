import { describe, expect, it } from 'vitest'
import { parseScale } from '@chord-scale-maker/engine'
import { PICKER_SCALES, scaleChoices, scaleFormula, searchScales } from '~/utils/scaleChoices'

describe('scaleChoices', () => {
  it('splits the default from the alternates', () => {
    const c = scaleChoices('Cm7')
    expect(c).toMatchObject({ known: true, defaultScale: 'C Dorian' })
    expect(c.alternates.map((o) => o.scale)).toContain('Eb Major Pentatonic')
    expect(c.alternates.map((o) => o.scale)).not.toContain('C Dorian')
  })

  it('offers nothing for unknown or unreadable chords', () => {
    expect(scaleChoices('Cm7#5#9x')).toEqual({ known: false, defaultScale: null, alternates: [] })
    expect(scaleChoices('')).toEqual({ known: false, defaultScale: null, alternates: [] })
  })

  it('picker labels parse back to scales', () => {
    for (const name of PICKER_SCALES) expect(() => parseScale(`C ${name}`), name).not.toThrow()
  })
})

describe('scaleFormula', () => {
  it('gives a scale’s degrees, or null for one it can’t read', () => {
    expect(scaleFormula('E Lydian Dominant')).toBe('1 2 3 ♯4 5 6 ♭7')
    expect(scaleFormula('E Nonsense')).toBeNull()
  })
})

describe('searchScales', () => {
  it('reads a leading note as the root, and the rest as the start of the name’s words', () => {
    const found = searchScales('E ph', 'C')
    expect(found).toContain('E Phrygian')
    expect(found).toContain('E Phrygian Dominant')
    expect(found.every((s) => s.startsWith('E '))).toBe(true)
    expect(searchScales('f# lyd dom', 'C')).toEqual(['F# Lydian Dominant'])
  })

  it('uses the chord’s root when none is typed', () => {
    expect(searchScales('lydian dom', 'Bb')).toEqual(['Bb Lydian Dominant'])
  })

  it('finds nothing for nothing, or for a name it doesn’t know, and at most eight', () => {
    expect(searchScales('  ', 'C')).toEqual([])
    expect(searchScales('zzz', 'C')).toEqual([])
    expect(searchScales('C', 'C')).toHaveLength(8)
  })
})
