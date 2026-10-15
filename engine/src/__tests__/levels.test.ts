import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import raw from '../../chord_scales.json'
import { expandRows, parseChart } from '../chart'
import { analyse } from '../analysis'
import { ladderScale, type LevelState, scaleAtLevel, seededUnit, unlevel } from '../levels'
import { resolveQuality } from '../qualities'
import { samePitchScale, scaleKey } from '../scales'


describe('scale levels', () => {
  it('pick the Basic, Standard and Advanced scale for each kind of chord', () => {
    const at = (chord: string) => (['basic', 'standard', 'advanced'] as const).map((l) => scaleAtLevel(chord, l))
    expect(at('Cm7')).toEqual(['C Minor Pentatonic', 'C Dorian', 'C Bebop Dorian'])
    expect(at('G7')).toEqual(['G Major Pentatonic', 'G Mixolydian', 'G Bebop Dominant'])
    expect(at('G7alt')).toEqual(['Db Major Pentatonic', 'G Altered', 'G Half-Whole Diminished'])
    expect(at('Bm7b5')).toEqual(['G Major Pentatonic', 'B Locrian', 'B Locrian natural 2'])
    expect(at('C7sus4')).toEqual(['Bb Major Pentatonic', 'C Mixolydian', 'C Dorian'])
    expect(at('Cm6')).toEqual(['C Minor Pentatonic', 'C Dorian', 'C Melodic Minor']) // Dorian is m6's standard now
    expect(at('Cdim7')).toEqual(['C Whole-Half Diminished', 'C Whole-Half Diminished', 'C Whole-Half Diminished']) // Harmonic Minor is a menu option (R3b)
    expect(scaleAtLevel('Cm7#5#9x', 'basic')).toBeNull()
  })

  it('climb a diatonic diminished Standard to Whole-Half at Basic and Advanced (R3b)', () => {
    const at = (level: 'basic' | 'advanced', standard: string) => scaleAtLevel(`${standard.split(' ')[0]}dim7`, level, 0, '', standard)
    for (const standard of ['Bb Diatonic Diminished bVI', 'C# Diatonic Diminished', 'Eb Diatonic Diminished bIII', 'C Diatonic Diminished I', 'G Diatonic Diminished V', 'F# Diatonic Diminished #IV']) {
      const root = standard.split(' ')[0]
      expect([at('basic', standard), at('advanced', standard)], standard).toEqual([`${root} Whole-Half Diminished`, `${root} Whole-Half Diminished`])
    }
    const dim7 = resolveQuality('Cdim7')?.options ?? []
    expect(dim7.find((o) => o.default)?.scale).toBe('C Whole-Half Diminished')
    expect(dim7.find((o) => o.scale === 'C# Harmonic Minor')?.level).toBeUndefined()
    // R17: spelled as the analysis spells them (C ascending needs F♭ B𝄫 C♭: B♯ is the cleaner root)
    expect(dim7.map((o) => o.scale)).toEqual(expect.arrayContaining(['B# Diatonic Diminished', 'C Diatonic Diminished bIII', 'C Diatonic Diminished bIII optional', 'C Diatonic Diminished bVI', 'C Diatonic Diminished I', 'C Diatonic Diminished I optional', 'C Diatonic Diminished V', 'C Diatonic Diminished #IV', 'B# Diatonic Diminished #IV optional']))
  })

  it('keep a Q5 Whole-Half Standard written on another root at Basic and Advanced (Gbdim7: F# Whole-Half)', () => {
    const at = (level: 'basic' | 'advanced') => scaleAtLevel('Gbdim7', level, 0, '', 'F# Whole-Half Diminished')
    expect([at('basic'), at('advanced')]).toEqual(['F# Whole-Half Diminished', 'F# Whole-Half Diminished'])
    const tat = parseChart(readFileSync('charts/time-after-time.txt', 'utf8')).value
    for (const bar of [26, 28]) {
      const r = analyse(tat).rows.find((x) => `${x.bar} ${x.chord}` === `${bar} Gbdim7`)
      expect(r?.scale, `bar ${bar}`).toBe('Gb Whole-Half Diminished') // G♭ now letters cleanly (#279): no respelling
      expect(scaleAtLevel('Gbdim7', 'advanced', 0, '', r?.scale ?? undefined), `bar ${bar}`).toBe('Gb Whole-Half Diminished')
    }
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

  it('keep a Standard written on an enharmonic root, and deal it like the default itself (R18)', () => {
    expect(scaleAtLevel('Gbdim7', 'advanced', 0, '0:Gbdim7', 'F# Whole-Half Diminished')).toBe('F# Whole-Half Diminished')
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = scaleAtLevel('Gbdim7', 'random', seed, '0:Gbdim7', 'F# Whole-Half Diminished') ?? ''
      const p = scaleAtLevel('Gbdim7', 'random', seed, '0:Gbdim7', 'Gb Whole-Half Diminished') ?? ''
      expect(samePitchScale(r, p), `seed ${seed}: ${r} / ${p}`).toBe(true)
    }
  })

  it('climb the Standard scale’s ladder when the chart’s Standard isn’t the quality’s (§11)', () => {
    expect(['D Phrygian Dominant', 'G Mixolydian b6', 'A Altered', 'C Whole Tone', 'Eb Lydian', 'F# Locrian natural 2'].map((s) => [ladderScale(s, 'basic'), ladderScale(s, 'advanced')])).toEqual([
      ['G Minor Pentatonic', 'D Altered'], // the minor key's pentatonic over its V7; Altered at Advanced (R5)
      ['C Minor Pentatonic', 'G Altered'],
      ['Eb Major Pentatonic', 'A Half-Whole Diminished'],
      ['C Whole Tone', 'C Altered'], // no simpler rung: the Standard stays
      ['Eb Major Pentatonic', 'Eb Lydian'],
      ['D Major Pentatonic', 'F# Locrian natural 2'],
    ])
    expect(scaleAtLevel('D7', 'basic', 0, '', 'D Phrygian Dominant')).toBe('G Minor Pentatonic')
    expect(scaleAtLevel('D7', 'basic', 0, '', 'D Mixolydian')).toBe('D Major Pentatonic') // the quality's own default: its tags
  })

  it('a V7 of a minor chord on Phrygian Dominant is Altered at Advanced; the 7 menu keeps Spanish Phrygian (R5)', () => {
    const doc = parseChart('key: Cm\nA | 1 | Dm7b5\nA | 2 | G7\nA | 3 | Cm7\n').value
    const standard = analyse(doc).rows.find((r) => r.chord === 'G7')?.scale ?? undefined
    expect(standard).toBe('G Phrygian Dominant')
    expect(scaleAtLevel('G7', 'advanced', 0, '', standard)).toBe('G Altered')
    expect(scaleAtLevel('G7', 'basic', 0, '', standard)).toBe('C Minor Pentatonic') // Basic unchanged
    const menu = resolveQuality('G7')?.options ?? []
    expect(menu.map((o) => o.scale)).toEqual(expect.arrayContaining(['G Altered', 'G Spanish Phrygian']))
    expect(menu.find((o) => o.scale === 'G Spanish Phrygian')?.note).toMatch(/V7 of a minor chord/)
  })

  it('a tonic m6 on Melodic Minor (R6) is Minor Pentatonic at Basic and stays Melodic Minor at Advanced (no ♭6 against its 6th)', () => {
    expect(scaleAtLevel('Dm6/9', 'basic', 0, '', 'D Melodic Minor')).toBe('D Minor Pentatonic')
    expect(scaleAtLevel('Dm6/9', 'advanced', 0, '', 'D Melodic Minor')).toBe('D Melodic Minor')
    expect(scaleAtLevel('CmMaj7', 'advanced', 0, '', 'C Melodic Minor')).toBe('C Harmonic Minor') // m1 keeps its ladder
  })

  it('an m7 on Phrygian (iii7, R4) is Dorian at Advanced; a sus b9 keeps Dorian b2 (quality_ladders)', () => {
    expect(scaleAtLevel('Em7', 'advanced', 0, '', 'E Phrygian')).toBe('E Dorian')
    expect(scaleAtLevel('Em7', 'basic', 0, '', 'E Phrygian')).toBe('E Minor Pentatonic') // the Phrygian ladder's own Basic
    expect(scaleAtLevel('Dm7', 'advanced', 0, '', 'D Phrygian')).toBe('D Dorian') // v of a minor key too (Q4)
    expect(scaleAtLevel('G7sus4b9', 'advanced', 0, '', 'G Phrygian')).toBe('G Dorian b2')
    expect(ladderScale('E Phrygian', 'advanced')).toBe('E Dorian b2') // no quality: the ladder as it is
    expect(scaleAtLevel('Em', 'advanced', 0, '', 'E Phrygian')).toBe('E Dorian') // a iii triad climbs like iii7
    expect(ladderScale('E Phrygian', 'advanced', 'm7')).toBe('E Dorian')
    expect(ladderScale('E Phrygian', 'advanced', '7sus4b9')).toBe('E Dorian b2')
  })

  it('ladders name real scales, and every rung root is an interval', () => {
    for (const [name, rungs] of Object.entries(raw.ladders)) {
      expect(() => scaleKey(name), name).not.toThrow()
      for (const rung of Object.values(rungs)) expect(() => scaleKey(rung[1] ?? ''), `${name}: ${rung[1]}`).not.toThrow()
    }
  })

  it('pick at random repeatably, only among inside options, and redeal on a new seed', () => {
    const dealt = (chord: string, seed: number) => Array.from({ length: 24 }, (_, i) => scaleAtLevel(chord, 'random', seed, `${i}:${chord}`))
    expect(dealt('Dm7', 42)).toEqual(dealt('Dm7', 42))
    expect(dealt('Dm7', 42)).not.toEqual(dealt('Dm7', 43))
    const inside = (resolveQuality('Dm7')?.options ?? []).filter((o) => !o.outside).map((o) => o.scale)
    for (const s of [...dealt('Dm7', 1), ...dealt('Dm7', 2)]) expect(inside).toContain(s)
    expect(new Set(dealt('Dm7', 1)).size).toBeGreaterThan(2)
    for (const k of ['a', 'b', 'c']) expect(seededUnit(9, k)).toBeGreaterThanOrEqual(0)
    // a function's own diatonic diminished scale is never dealt at random (R10)
    for (const seed of [1, 2, 3]) for (const s of dealt('Cdim7', seed)) expect(s).not.toMatch(/Diatonic Diminished/)
  })
})

describe('unlevel, the migration of a chart a level once wrote into', () => {
  const cells = (doc: ReturnType<typeof parseChart>['value']) => expandRows(doc).value.map((r) => r.scale)
  const parsed = (text: string) => parseChart(text).value
  const at = (level: LevelState['level'], seed = 0, owned?: readonly string[]): LevelState => ({ level, seed, ...(owned ? { owned } : {}) })

  it('blanks the owned rows that still play the stored level’s scale, and only those', () => {
    // Basic wrote Cm7 and F7; F7 was changed by hand since; Bb Lydian is a pick of your own
    const doc = parsed('A | 1 | Cm7 | C Minor Pentatonic\nA | 2 | F7 | F Lydian Dominant\nA | 3 | Bbmaj7 | Bb Lydian\n')
    const out = unlevel(doc, at('basic', 0, ['0:Cm7', '1:F7']))
    expect(cells(out.doc)).toEqual(['', 'F Lydian Dominant', 'Bb Lydian'])
    expect(out.blanked).toBe(1)
  })

  it('blanks a library chart’s own choice moved by a level, and a Random deal, by its seed', () => {
    const library = parsed('A | 1 | A7b9 | A Phrygian Dominant\nA | 2 | Dm7\n')
    const owned = ['0:A7b9', '1:Dm7']
    expect(cells(unlevel(parsed('A | 1 | A7b9 | A Altered\nA | 2 | Dm7 | D Bebop Dorian\n'), at('advanced', 0, owned), library).doc)).toEqual(['', ''])
    const random = parsed('A | 1 | A7b9 | A Spanish Phrygian\nA | 2 | Dm7 | D Dorian\n') // Random, seed 9
    expect(cells(unlevel(random, at('random', 8, owned), library).doc)).not.toEqual(['', '']) // another deal: not the level's
    expect(cells(unlevel(random, at('random', 9, owned), library).doc)).toEqual(['', ''])
  })

  it('blanks a tonic minor chord Basic made Aeolian', () => {
    const doc = parsed('key: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm | G Aeolian\n')
    expect(cells(unlevel(doc, at('basic', 0, ['3:Gm'])).doc)).toEqual(['', '', ''])
  })

  it('changes nothing without owned rows', () => {
    const doc = parsed('A | 1 | Cm7 | C Minor Pentatonic\n')
    expect(unlevel(doc, at('basic'))).toEqual({ doc, blanked: 0 })
    expect(unlevel(doc, at('basic', 0, [])).doc).toBe(doc)
  })
})
