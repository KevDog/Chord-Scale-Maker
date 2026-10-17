import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { parseChart, qualityScale } from '../chart'
import type { ScaleLevel } from '../levels'
import { type Resolved, resolveScales, type ScaleView } from '../resolve'

const on = (level: ScaleLevel = 'standard', seed = 0): ScaleView => ({ level, seed })
const resolve = (text: string, view = on()): readonly Resolved[] => [...resolveScales(parseChart(text).value, view).values()]
const scales = (text: string, view = on()): readonly (string | null)[] => resolve(text, view).map((r) => r.scale)

// in C: a written scale, a stated function (D7 subV7/♭II: Lydian Dominant), and the rules' own choices
const C_TUNE = 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | CMaj7 | C Lydian\n2 | D7 |  | subV7/♭II\n3 | Dm7\n4 | G7\n5 | CMaj7\n'
const G_MINOR = 'title: T\nkey: Gm\n\nsection: A\n1 | Am7b5\n2 | D7\n3 | Gm7 | G Dorian\n4 | Gm7\n'

describe('resolveScales', () => {
  it('plays a written scale, else the stated function’s, else the rules’, keyed by expanded row', () => {
    const map = resolveScales(parseChart(C_TUNE).value, on())
    expect([...map.keys()]).toEqual([0, 1, 2, 3, 4])
    expect(map.get(0)).toEqual({ scale: 'C Lydian', source: 'written' })
    expect(map.get(1)).toEqual({ scale: 'D Lydian Dominant', source: 'function', rule: 'D2', reason: expect.stringMatching(/^\* /) })
    expect(map.get(2)).toMatchObject({ scale: 'D Dorian', source: 'rules', rule: 'm4' })
    expect(map.get(4)).toMatchObject({ scale: 'C Ionian', source: 'rules', rule: 'M3' })
  })

  it('falls back to the quality’s default where the analysis does not reach the row', () => {
    const doc = parseChart(C_TUNE).value
    const unreached = { ...analyse(doc), rows: [] }
    expect([...resolveScales(doc, on(), unreached).values()]).toEqual([
      { scale: 'C Lydian', source: 'written' },
      { scale: 'D Mixolydian', source: 'default' },
      { scale: 'D Dorian', source: 'default' },
      { scale: 'G Mixolydian', source: 'default' },
      { scale: 'C Ionian', source: 'default' },
    ])
  })

  it('changes the scale when a function is stated, with no scale written', () => {
    const plain = C_TUNE.replace(' |  | subV7/♭II', '')
    expect(scales(plain)[1]).toBe('D Mixolydian')
    expect(scales(C_TUNE)[1]).toBe('D Lydian Dominant')
  })

  it('gives a chord the quality has no default for the analysed scale', () => {
    expect(resolve('title: T\nkey: F\n\nsection: A\nbars: 4\n1 | FMaj7\n2 | C7b9#11\n3 | FMaj7\n')[1]).toMatchObject({ scale: 'C Half-Whole Diminished', source: 'rules' })
  })

  it('is null for a chord that can’t be read yet', () => {
    expect(resolve('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | Cm7#5#9x\n3 | CMaj7\n')[1]).toEqual({ scale: null, source: 'default' })
  })

  it('moves the analysed rows with the level and leaves written ones', () => {
    expect(scales(G_MINOR, on('standard'))).toEqual(['A Locrian', 'D Phrygian Dominant', 'G Dorian', 'G Dorian'])
    // Basic: the quality's tag on its default (Locrian), the analysed scale's ladder (V7 of a minor key: its pentatonic), Aeolian on a tonic minor (m5)
    expect(scales(G_MINOR, on('basic'))).toEqual(['F Major Pentatonic', 'G Minor Pentatonic', 'G Dorian', 'G Aeolian'])
    expect(scales(G_MINOR, on('advanced'))[2]).toBe('G Dorian')
    expect(scales(G_MINOR, on('advanced'))[3]).not.toBe('G Aeolian') // Aeolian on a tonic minor: Basic only
    expect(resolve(G_MINOR, on('basic')).map((r) => r.source)).toEqual(['rules', 'rules', 'written', 'rules'])
  })

  it('deals Random the same for the same seed', () => {
    const tune = 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | A7\n5 | Dm7\n6 | G7\n7 | CMaj7\n8 | CMaj7 | C Ionian\n'
    for (const seed of [1, 2, 3]) expect(scales(tune, on('random', seed))).toEqual(scales(tune, on('random', seed)))
    expect(new Set([1, 2, 3, 4, 5].map((seed) => scales(tune, on('random', seed)).join())).size).toBeGreaterThan(1)
    expect(scales(tune, on('random', 4))[7]).toBe('C Ionian')
    const copied = scales('title: T\nkey: C\n\nsection: A\nbars: 8\n1 | Dm7\n\nsection: B\ncopy: A\n', on('random', 7))
    expect(copied[1]).toBe(copied[0]) // a @copy repeat deals as its source row
  })

  it('resolves a @copy repeat on its own row', () => {
    // the A7 leads back to Dm7 the first time (V7/ii) and on to DMaj7 the second (V7)
    const rows = resolve('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | A7\n\nsection: A2\ncopy: A\n\nsection: B\nbars: 4\n1 | DMaj7\n')
    expect(rows.map((r) => r.scale)).toEqual(['D Dorian', 'A Mixolydian b6', 'D Dorian', 'A Mixolydian', 'D Ionian'])
  })

  it('resolves a modal chart’s chords to their modes by the rules', () => {
    const rows = resolve('title: T\ncontext: modal\n\nsection: A\n1 | Dm7\n2 | Dm7\n3 | Ebm7\n4 | Ebm7\n')
    expect(rows).toEqual(Array.from({ length: 4 }, (_, i) => expect.objectContaining({ scale: i < 2 ? 'D Dorian' : 'Eb Dorian', source: 'rules', rule: 'm6' })))
  })
})

describe('qualityScale', () => {
  it('is the row’s own scale, else the quality’s default; null when the chord can’t be read', () => {
    expect(qualityScale({ section: 'A', bar: '1', chord: 'D7', scale: '' })).toBe('D Mixolydian')
    expect(qualityScale({ section: 'A', bar: '1', chord: 'D7', scale: 'D Altered' })).toBe('D Altered')
    expect(qualityScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })
})
