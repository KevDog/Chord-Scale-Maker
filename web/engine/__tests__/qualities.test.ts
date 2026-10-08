import { describe, expect, it } from 'vitest'
import { baseQuality, defaultScale, QUALITY_NAMES, resolveQuality } from '../qualities'
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

  it('keeps b13 dominants off Half-Whole, whose 13 is natural', () => {
    expect(['G7b9', 'G13b9', 'G7b9b13', 'G7(b9,b13)', 'G7b13'].map(defaultScale)).toEqual([
      'G Half-Whole Diminished',
      'G Half-Whole Diminished',
      'G Phrygian Dominant',
      'G Phrygian Dominant',
      'G Mixolydian b6',
    ])
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

  it('reads extended symbols as their base quality when the rest is only alterations', () => {
    expect(['Maj7#9', '7sus4#9', 'Maj7b5', '-7', 'maj9', 'm7(b5)', '7(9)', 'Maj7(9)', 'm7(11)', 'm7#5#9x', '', 'x'].map(baseQuality)).toEqual([
      'Maj7', '7sus4', 'Maj7', 'm7', 'Maj7', 'm7b5', '7', 'Maj7', 'm7', null, 'maj', null,
    ])
    expect(['Maj7#11', 'Maj7#5', 'Δ+', 'Maj9#11'].map(baseQuality)).toEqual(['Maj7#11', 'Maj7#5', 'Maj7#5', 'Maj7#11']) // their own qualities
  })

  it('pairs Spanish Phrygian with dominant and sus chords, and reads sus b9 as its own chord', () => {
    const scales = (chord: string) => resolveQuality(chord)?.options.map((o) => o.scale) ?? []
    for (const chord of ['C7', 'C7b9', 'Csus', 'C7sus4b9']) expect(scales(chord)).toContain('C Spanish Phrygian')
    expect(['Csusb9', 'Ephryg', 'Csus'].map(defaultScale)).toEqual(['C Phrygian', 'E Phrygian', 'C Mixolydian'])
  })

  it('reads a major 7th chord over the note a half step below as a sus b9 on the bass', () => {
    const match = resolveQuality('DbMaj7/C')
    expect(match?.quality).toBe('Maj7') // the chord as written: labels and presets measure from Db
    expect(match?.options.map((o) => o.scale)).toEqual(['C Phrygian', 'C Spanish Phrygian', 'C Dorian b2'])
    expect(['DbMaj7', 'DbMaj7/F', 'Dbmaj7/B#', 'Gbmaj7/F'].map(defaultScale)).toEqual(['Db Ionian', 'Db Ionian', 'Db Ionian', 'F Phrygian'])
  })

  it('marks outside pentatonics apart from inside ones', () => {
    const outside = (chord: string) => Object.fromEntries((resolveQuality(chord)?.options ?? []).map((o) => [o.scale, o.outside]))
    expect(outside('Dm7')).toMatchObject({ 'E Minor Pentatonic': false, 'A Minor Pentatonic': false, 'Eb Minor Pentatonic': true, 'G# Minor Pentatonic': true })
    expect(outside('G7')).toMatchObject({ 'Db Major Pentatonic': true }) // off the b5
    expect(outside('G7alt')).toMatchObject({ 'Db Major Pentatonic': false }) // all altered tensions: inside on an alt chord
  })

  it('every quality has exactly one default and known scales', () => {
    for (const q of QUALITY_NAMES) {
      const options = resolveQuality(`C${q}`)?.options ?? []
      expect(options.filter((o) => o.default), q).toHaveLength(1)
      for (const o of options) expect(() => parseScale(o.scale)).not.toThrow()
    }
  })
})
