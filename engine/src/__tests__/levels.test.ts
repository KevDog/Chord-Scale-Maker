import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import raw from '../../chord_scales.json'
import { expandRows, parseChart, qualityScale } from '../chart'
import { analyse, applyAnalysis } from '../analysis'
import { ladderScale, type LevelState, relevel, SCALE_LEVELS, scaleAtLevel, seededUnit, unlevel } from '../levels'
import { resolveScales } from '../resolve'
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

  it('keep a Q5 Whole-Half Standard whose root the analysis respelled at Basic and Advanced (Gbdim7: F# Whole-Half)', () => {
    const at = (level: 'basic' | 'advanced') => scaleAtLevel('Gbdim7', level, 0, '', 'F# Whole-Half Diminished')
    expect([at('basic'), at('advanced')]).toEqual(['F# Whole-Half Diminished', 'F# Whole-Half Diminished'])
    const tat = parseChart(readFileSync('charts/time_after_time.txt', 'utf8')).value
    for (const bar of [26, 28]) {
      const r = analyse(tat).rows.find((x) => `${x.bar} ${x.chord}` === `${bar} Gbdim7`)
      expect(r?.scale, `bar ${bar}`).toBe('F# Whole-Half Diminished')
      expect(scaleAtLevel('Gbdim7', 'advanced', 0, '', r?.scale ?? undefined), `bar ${bar}`).toBe('F# Whole-Half Diminished')
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

  const at = (level: LevelState['level'], seed = 0): LevelState => ({ level, seed })
  const scales = (doc: ReturnType<typeof parseChart>['value']) => expandRows(doc).value.map(qualityScale) // a blank cell plays the default

  it('own a default written on an enharmonic root like the default itself, and keep its spelling (R18)', () => {
    const respelled = parseChart('A | 1 | Gbdim7 | F# Whole-Half Diminished\n').value
    const plain = parseChart('A | 1 | Gbdim7 | Gb Whole-Half Diminished\n').value
    const adv = relevel(respelled, at('standard'), at('advanced'))
    expect([adv.owned, adv.changed, scales(adv.doc)]).toEqual([['0:Gbdim7'], 0, ['F# Whole-Half Diminished']])
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = scales(relevel(respelled, at('standard'), at('random', seed)).doc)[0] ?? ''
      const p = scales(relevel(plain, at('standard'), at('random', seed)).doc)[0] ?? ''
      expect(samePitchScale(r, p), `seed ${seed}: ${r} / ${p}`).toBe(true)
    }
  })

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
    expect(scales(advanced.doc)).toEqual(['A Altered', 'D Bebop Dorian'])
    const back = relevel(advanced.doc, { ...at('advanced'), owned: advanced.owned }, at('standard'), library)
    expect(scales(back.doc)).toEqual(['A Phrygian Dominant', 'D Dorian']) // the chart's choice, not Half-Whole
    expect(scales(relevel(library, at('standard'), at('advanced')).doc)[0]).toBe('A Phrygian Dominant') // without it: a chosen scale, kept
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
    // Autumn Leaves as the analysis wrote it: V7 of G minor, and V7/iv
    const library = parseChart('A | 6 | D7 | D Phrygian Dominant\nA | 32 | G7 | G Mixolydian b6\nA | 33 | Cm7 | C Dorian\n').value
    expect(scales(relevel(library, at('standard'), at('basic'), library).doc)).toEqual(['G Minor Pentatonic', 'C Minor Pentatonic', 'C Minor Pentatonic'])
    expect(scales(relevel(library, at('standard'), at('advanced'), library).doc)).toEqual(['D Altered', 'G Altered', 'C Bebop Dorian'])
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

  it('make a tonic minor chord Aeolian at Basic (decision 7), and bring it back', () => {
    const doc = parseChart('key: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm\nA | 4 | Gm\nA | 5 | Cm7\nA | 6 | F7\n').value
    const basic = relevel(doc, at('standard'), at('basic'))
    expect(scales(basic.doc)).toEqual(['F Major Pentatonic', 'D Major Pentatonic', 'G Aeolian', 'G Aeolian', 'C Minor Pentatonic', 'F Major Pentatonic'])
    const back = relevel(basic.doc, { ...at('basic'), owned: basic.owned }, at('standard'))
    expect(scales(back.doc)).toEqual(['A Locrian', 'D Mixolydian', 'G Dorian', 'G Dorian', 'C Dorian', 'F Mixolydian'])
    expect(scales(relevel(doc, at('standard'), at('advanced')).doc)[2]).toBe('G Bebop Dorian') // Basic only
  })

  it('ladders name real scales, and every rung root is an interval', () => {
    for (const [name, rungs] of Object.entries(raw.ladders)) {
      expect(() => scaleKey(name), name).not.toThrow()
      for (const rung of Object.values(rungs)) expect(() => scaleKey(rung[1] ?? ''), `${name}: ${rung[1]}`).not.toThrow()
    }
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
    // a function's own diatonic diminished scale is never dealt at random (R10)
    const dims = parseChart(Array.from({ length: 24 }, (_, i) => `A | ${i + 1} | Cdim7`).join('\n')).value
    for (const seed of [1, 2, 3]) for (const s of scales(relevel(dims, at('standard'), at('random', seed)).doc)) expect(s).not.toMatch(/Diatonic Diminished/)
  })
})

describe('the level on the resolver (proposedScales on)', () => {
  const at = (level: LevelState['level'], seed = 0): LevelState => ({ level, seed })
  const cells = (doc: ReturnType<typeof parseChart>['value']) => expandRows(doc).value.map((r) => r.scale)
  const parsed = (text: string) => parseChart(text).value

  it('plays at every level what relevel wrote into the analysed chart, without writing a cell', () => {
    const doc = parsed('key: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm\nA | 4 | Cm7\nA | 5 | F7\nA | 6 | BbMaj7\nA | 7 | Dm7\n')
    const analysed = applyAnalysis(doc, analyse(doc), { scales: 'fill', save: false, date: '' }).doc // the library's way: the analysis written in
    for (const level of SCALE_LEVELS) {
      const written = relevel(analysed, at('standard'), at(level, 5), analysed).doc
      const played = [...resolveScales(doc, { level, seed: 5, proposed: true }).values()].map((r) => r.scale)
      expect(played, level).toEqual(cells(written))
    }
    expect(cells(doc).every((s) => s === '')).toBe(true)
  })

  it('migration: blanks the owned rows that still play the stored level’s scale, and only those', () => {
    const doc = parsed('A | 1 | Cm7\nA | 2 | F7\nA | 3 | Bbmaj7 | Bb Lydian\n') // Lydian: chosen
    const basic = relevel(doc, at('standard'), at('basic'))
    const lines = basic.doc.lines.map((l, i) => (l.kind === 'row' && i === 1 ? { ...l, scale: 'F Lydian Dominant' } : l)) // since changed by hand
    const out = unlevel({ lines }, { ...at('basic'), owned: basic.owned })
    expect(cells(out.doc)).toEqual(['', 'F Lydian Dominant', 'Bb Lydian'])
    expect(out.blanked).toBe(1)
  })

  it('migration: blanks a library chart’s own choice moved by a level, and a Random deal, by its seed', () => {
    const library = parsed('A | 1 | A7b9 | A Phrygian Dominant\nA | 2 | Dm7\n')
    const advanced = relevel(library, at('standard'), at('advanced'), library)
    expect(cells(unlevel(advanced.doc, { ...at('advanced'), owned: advanced.owned }, library).doc)).toEqual(['', ''])
    const random = relevel(library, at('standard'), at('random', 9), library)
    expect(cells(unlevel(random.doc, { ...at('random', 8), owned: random.owned }, library).doc)).not.toEqual(['', '']) // another deal: not the level's
    expect(cells(unlevel(random.doc, { ...at('random', 9), owned: random.owned }, library).doc)).toEqual(['', ''])
  })

  it('migration: changes nothing without owned rows', () => {
    const doc = parsed('A | 1 | Cm7 | C Minor Pentatonic\n')
    expect(unlevel(doc, at('basic'))).toEqual({ doc, blanked: 0 })
    expect(unlevel(doc, { ...at('basic'), owned: [] }).doc).toBe(doc)
  })
})
