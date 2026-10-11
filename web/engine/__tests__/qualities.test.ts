import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { parseChart } from '../chart'
import { enharmonics, type Spelled } from '../pitch'
import { baseQuality, defaultScale, defaultScaleOrNull, QUALITY_NAMES, resolveQuality } from '../qualities'
import { parseScale, sameScale, samePitches, type ScaleKey, SCALES, spellFrom } from '../scales'
import { isSyncCopy } from '../util'

describe('defaultScaleOrNull', () => {
  it('is defaultScale, but returns null instead of throwing on an unparseable chord', () => {
    expect(defaultScaleOrNull('Cm7')).toBe(defaultScale('Cm7'))
    expect(() => defaultScale('???')).toThrow()
    expect(defaultScaleOrNull('???')).toBeNull()
  })
})

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

  it('reads ∆ (U+2206, what Option-J types on a Mac) wherever it reads Δ (U+0394)', () => {
    for (const q of ['Δ7', 'Δ', 'Δ#11', 'Δ#5', 'Δ+5', 'Δ+', '-Δ7']) expect(baseQuality(q.replace('Δ', '\u2206')), q).toBe(baseQuality(q))
    expect(defaultScale('C\u22067')).toBe('C Ionian')
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

describe('the °7 menu’s diatonic diminished options (R17)', () => {
  const ugly = (n: { letter: number; acc: number }) => Math.abs(n.acc) > 1 || (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3))
  const functional = (chord: string) => (resolveQuality(chord)?.options ?? []).filter((o) => o.functional).map((o) => o.scale)

  it('spell their root as the analysis does: D# Diatonic Diminished on Ebdim7', () => {
    expect(functional('Ebdim7')).toContain('D# Diatonic Diminished')
    expect(functional('Ebdim7')).not.toContain('Eb Diatonic Diminished')
    expect(functional('Ebdim7')).toContain('Eb Diatonic Diminished bIII') // E♭ spells ♭III°7 cleanly
    expect(functional('Gdim7')).toContain('G Diatonic Diminished')
  })

  it('offer a ♭III°7 or ♭VI°7 with no clean root once, as the ascending lettering of its notes (fig. 7.22)', () => {
    const b = functional('Bdim7')
    expect(b).not.toContain('B Diatonic Diminished bIII') // B B♯ D D♯ E♯ …
    expect(b.filter((s) => s === 'B Diatonic Diminished')).toHaveLength(1)
    expect(new Set(b).size).toBe(b.length)
  })

  it('offer no double accidental or B♯ E♯ C♭ F♭ where a clean lettering exists', () => {
    const bad: string[] = []
    for (const root of ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb']) {
      for (const scale of functional(`${root}dim7`)) {
        const s = parseScale(scale)
        const clean = (r: Spelled, k: ScaleKey) => !spellFrom(r, SCALES[k][0]).some(ugly)
        const anyClean = enharmonics(s.root).some((r) => clean(r, s.key) || (samePitches(s.key, 'diatonic diminished') && clean(r, 'diatonic diminished')))
        if (!clean(s.root, s.key) && anyClean) bad.push(`${root}dim7: ${scale}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('hold every library °7’s analysed diatonic diminished scale, so none shows as a custom entry', () => {
    const missing: string[] = []
    for (const f of readdirSync('../charts').filter((x) => x.endsWith('.txt') && !isSyncCopy(x))) {
      for (const r of analyse(parseChart(readFileSync(`../charts/${f}`, 'utf8')).value).rows) {
        if (!r.scale?.includes('Diatonic Diminished')) continue
        if (!(resolveQuality(r.chord)?.options ?? []).some((o) => sameScale(o.scale, r.scale))) missing.push(`${f} ${r.bar} ${r.chord}: ${r.scale}`)
      }
    }
    expect(missing).toEqual([])
  })
})
