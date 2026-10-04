import { describe, expect, it } from 'vitest'
import { defaultScale, QUALITY_NAMES, resolveQuality } from '../qualities'
import { parseScale } from '../scales'

describe('qualities', () => {
  it('picks the default scale for a chord quality', () => {
    expect(defaultScale('Cm7')).toBe('C Dorian')
    expect(defaultScale('F7')).toBe('F Mixolydian')
    expect(defaultScale('Gm')).toBe('G Dorian')
    expect(defaultScale('C')).toBe('C Ionian')
    expect(defaultScale('C6/9')).toBe('C Ionian')
    expect(defaultScale('D7/F#')).toBe('D Mixolydian')
    expect(defaultScale('Am7b5')).toBe('A Locrian')
  })

  it('returns null for unknown qualities so the UI can prompt', () => {
    expect(resolveQuality('Cm7#5#9x')).toBeNull()
    expect(defaultScale('Cm7#5#9x')).toBeNull()
  })

  it('spells alternate roots from the interval', () => {
    const scales = resolveQuality('Cm7')?.options.map((o) => o.scale)
    expect(scales).toContain('Eb Major Pentatonic')
    expect(resolveQuality('Gbm7b5')?.options.map((o) => o.scale)).toContain('D Major Pentatonic')
    expect(resolveQuality('Bb7alt')?.options.map((o) => o.scale)).toContain('B Melodic Minor')
  })

  it('every quality has exactly one default and known scales', () => {
    for (const q of QUALITY_NAMES) {
      const options = resolveQuality(`C${q}`)?.options ?? []
      expect(options.filter((o) => o.default), q).toHaveLength(1)
      for (const o of options) expect(() => parseScale(o.scale)).not.toThrow()
    }
  })
})
