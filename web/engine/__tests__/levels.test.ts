import { describe, expect, it } from 'vitest'
import raw from '../../../chord_scales.json'
import { expandRows, parseChart, resolveScale } from '../chart'
import { type LevelState, relevel, scaleAtLevel, seededUnit } from '../levels'
import { resolveQuality } from '../qualities'


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

  const at = (level: LevelState['level'], seed = 0): LevelState => ({ level, seed })
  const scales = (doc: ReturnType<typeof parseChart>['value']) => expandRows(doc).value.map(resolveScale) // a blank cell plays the default

  it('write the level into the chart, moving only rows that play the old level’s scale', () => {
    const doc = parseChart('A | 1 | Cm7\nA | 2 | F7 | F Mixolydian\nA | 3 | Bbmaj7 | Bb Bebop Major\n').value
    const basic = relevel(doc, at('standard'), at('basic'))
    expect(scales(basic.doc)).toEqual(['C Minor Pentatonic', 'F Major Pentatonic', 'Bb Bebop Major']) // chosen: stays
    expect(basic.changed).toBe(2)
    const advanced = relevel(basic.doc, at('basic'), at('advanced'))
    expect(scales(advanced.doc)).toEqual(['C Bebop Dorian', 'F Bebop Dominant', 'Bb Bebop Major'])
    const back = relevel(advanced.doc, at('advanced'), at('standard'))
    expect(scales(back.doc)).toEqual(['C Dorian', 'F Mixolydian', 'Bb Bebop Major'])
  })

  it('own only the rows that played their default, so a chosen scale that is also a level’s choice stays', () => {
    const doc = parseChart('A | 1 | Cm7\nA | 2 | Bbmaj7 | Bb Lydian\n').value // Lydian: chosen, and Maj7's Advanced
    const advanced = relevel(doc, at('standard'), at('advanced'))
    expect(advanced.owned).toEqual(['0:Cm7'])
    const random = relevel(advanced.doc, { ...at('advanced'), owned: advanced.owned }, at('random', 3))
    const back = relevel(random.doc, { ...at('random', 3), owned: random.owned }, at('standard'))
    expect(scales(back.doc)).toEqual(['C Dorian', 'Bb Lydian'])
    expect(back.owned).toEqual([])
  })

  it('take over a library chart’s own choices, and bring them back at Standard', () => {
    const library = parseChart('A | 1 | A7b9 | A Phrygian Dominant\nA | 2 | Dm7\n').value // the Bird Blues' V7♭9 → ii
    const advanced = relevel(library, at('standard'), at('advanced'), library)
    expect(scales(advanced.doc)).toEqual(['A Spanish Phrygian', 'D Bebop Dorian'])
    const back = relevel(advanced.doc, { ...at('advanced'), owned: advanced.owned }, at('standard'), library)
    expect(scales(back.doc)).toEqual(['A Phrygian Dominant', 'D Dorian']) // the chart's choice, not Half-Whole
    expect(scales(relevel(library, at('standard'), at('advanced')).doc)[0]).toBe('A Phrygian Dominant') // without it: a chosen scale, kept
  })

  it('leave a scale you changed by hand alone on the next move', () => {
    const basic = relevel(parseChart('A | 1 | Cm7\nA | 2 | F7\n').value, at('standard'), at('basic')).doc
    const lines = basic.lines.map((l, i) => (l.kind === 'row' && i === 0 ? { ...l, scale: 'C Aeolian' } : l))
    expect(scales(relevel({ lines }, at('basic'), at('advanced')).doc)).toEqual(['C Aeolian', 'F Bebop Dominant'])
  })

  it('change nothing at the same level, and keep @copy repeats on their source row', () => {
    const doc = parseChart('A | 1 | Cm7\n@copy A B 8\n').value
    expect(relevel(doc, at('standard'), at('standard'))).toMatchObject({ doc, changed: 0, owned: [] })
    const random = scales(relevel(doc, at('standard'), at('random', 7)).doc)
    expect(random[0]).toBe(random[1])
  })

  it('pick at random repeatably, only among inside options, and redeal on a new seed', () => {
    const doc = parseChart(Array.from({ length: 24 }, (_, i) => `A | ${i + 1} | Dm7`).join('\n')).value
    const dealt = (seed: number) => scales(relevel(doc, at('standard'), at('random', seed)).doc)
    expect(dealt(42)).toEqual(dealt(42))
    expect(dealt(42)).not.toEqual(dealt(43))
    const inside = (resolveQuality('Dm7')?.options ?? []).filter((o) => !o.outside).map((o) => o.scale)
    for (const s of [...dealt(1), ...dealt(2)]) expect(inside).toContain(s)
    expect(new Set(dealt(1)).size).toBeGreaterThan(2)
    const shuffled = relevel(relevel(doc, at('standard'), at('random', 1)).doc, at('random', 1), at('random', 2)).doc
    expect(scales(shuffled)).toEqual(dealt(2)) // Shuffle: every random pick moves to the new deal
    for (const k of ['a', 'b', 'c']) expect(seededUnit(9, k)).toBeGreaterThanOrEqual(0)
  })
})
