import { describe, expect, it } from 'vitest'
import raw from '../../../chord_scales.json'
import { expandRows, parseChart } from '../chart'
import { applyLevel, followsLevel, levelChanges, scaleAtLevel, seededUnit } from '../levels'
import { resolveQuality } from '../qualities'

const rows = (text: string) => expandRows(parseChart(text).value).value.map((r) => r.scale)

describe('scale levels', () => {
  it('pick the Basic, Standard and Advanced scale for each kind of chord', () => {
    const at = (chord: string) => (['basic', 'standard', 'advanced'] as const).map((l) => scaleAtLevel(chord, l))
    expect(at('Cm7')).toEqual(['C Minor Pentatonic', 'C Dorian', 'C Bebop Dorian'])
    expect(at('G7')).toEqual(['G Major Pentatonic', 'G Mixolydian', 'G Bebop Dominant'])
    expect(at('G7alt')).toEqual(['Db Major Pentatonic', 'G Altered', 'G Half-Whole Diminished'])
    expect(at('Bm7b5')).toEqual(['G Major Pentatonic', 'B Locrian', 'B Locrian natural 2'])
    expect(at('C7sus4')).toEqual(['Bb Major Pentatonic', 'C Mixolydian', 'C Dorian'])
    expect(at('Cm6')).toEqual(['C Minor Pentatonic', 'C Dorian', 'C Melodic Minor']) // Dorian is m6's standard now
    expect(at('Cdim7')).toEqual(['C Whole-Half Diminished', 'C Whole-Half Diminished', 'C# Harmonic Minor']) // no simpler one; C# avoids Db harmonic minor's Bbb
    expect(scaleAtLevel('Cm7#5#9x', 'basic')).toBeNull()
  })

  it('tag at most one Basic and one Advanced option per quality', () => {
    for (const [q, opts] of Object.entries(raw.qualities)) {
      const levels = opts.map((o) => ('level' in o ? o.level : undefined)).filter(Boolean)
      expect(levels.filter((l) => l === 'basic').length, q).toBeLessThanOrEqual(1)
      expect(levels.filter((l) => l === 'advanced').length, q).toBeLessThanOrEqual(1)
      expect(new Set(levels).size, q).toBe(levels.length)
    }
    expect(resolveQuality('Cm7')?.options.find((o) => o.level === 'basic')?.scale).toBe('C Minor Pentatonic')
  })

  it('change only rows that follow their default, and leave Standard as written', () => {
    const doc = parseChart('A | 1 | Cm7\nA | 2 | F7 | F Mixolydian\nA | 3 | Bbmaj7 | Bb Lydian\n').value
    expect(followsLevel('F7', 'F Mixolydian')).toBe(true)
    expect(followsLevel('Bbmaj7', 'Bb Lydian')).toBe(false) // chosen: stays
    const basic = expandRows(applyLevel(doc, 'basic')).value.map((r) => r.scale)
    expect(basic).toEqual(['C Minor Pentatonic', 'F Major Pentatonic', 'Bb Lydian'])
    expect(applyLevel(doc, 'standard')).toBe(doc)
    expect(levelChanges(doc, 'basic')).toBe(2)
    expect(levelChanges(doc, 'standard')).toBe(0)
  })

  it('share a pick across @copy repeats', () => {
    expect(rows('A | 1 | Cm7\n@copy A B 8\n').length).toBe(2)
    const levelled = expandRows(applyLevel(parseChart('A | 1 | Cm7\n@copy A B 8\n').value, 'random', 7)).value
    expect(levelled[0]?.scale).toBe(levelled[1]?.scale)
  })

  it('pick at random repeatably, only among inside options, and differently for another seed', () => {
    const doc = parseChart(Array.from({ length: 24 }, (_, i) => `A | ${i + 1} | Dm7`).join('\n')).value
    const picks = (seed: number) => expandRows(applyLevel(doc, 'random', seed)).value.map((r) => r.scale)
    expect(picks(42)).toEqual(picks(42))
    expect(picks(42)).not.toEqual(picks(43))
    const inside = (resolveQuality('Dm7')?.options ?? []).filter((o) => !o.outside).map((o) => o.scale)
    for (const s of [...picks(1), ...picks(2)]) expect(inside).toContain(s)
    expect(new Set(picks(1)).size).toBeGreaterThan(2) // it really varies
    for (const k of ['a', 'b', 'c']) expect(seededUnit(9, k)).toBeGreaterThanOrEqual(0)
  })
})
