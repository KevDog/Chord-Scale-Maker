import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { functionChoices, rowNotes } from '../notes'

const notes = (text: string) => rowNotes(parseChart(text).value)
const C_TUNE = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | Am7\nA | 6 | Dm7\nA | 7 | G7\nA | 8 | CMaj7\n'

describe('rowNotes', () => {
  it('gives each row its reason and key area, keyed by doc line', () => {
    expect(notes('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').get(3)).toEqual({ note: 'V7 of C: natural tensions', problem: null, key: 'C' })
  })

  it("says when your scale isn't the analyser's", () => {
    expect(notes('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7 | G Altered\nA | 3 | CMaj7\n').get(3)?.note).toBe(
      'analyser: G Mixolydian (V7 of C: natural tensions); you chose G Altered',
    )
  })

  it("carries a row's function problem, and an @key's", () => {
    const n = notes('title: T\nkey: C\n@key Z 9 D\nA | 1 | Dm7\nA | 2 | G7 | | ii7\nA | 3 | CMaj7\n')
    expect(n.get(4)?.problem).toBe('ii7 is a minor chord, G7 a dominant one')
    expect(n.get(2)).toEqual({ note: '', problem: '@key Z 9: no bar 9 in section Z', key: '' })
  })
})

describe('functionChoices', () => {
  it('offers Auto, then each function that fits, with the scale it would give', () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(3) ?? []
    expect(d7[0]).toEqual({ value: '', label: 'Auto: II7', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' })
    expect(d7.map((c) => c.value)).toEqual(['', 'V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III', 'II7'])
  })

  it("shows Auto as the analyser's own reading even when the row states a function", () => {
    const stated = functionChoices(parseChart(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | subV7/♭II')).value).get(3) ?? []
    expect(stated[0]).toEqual({ value: '', label: 'Auto: II7', scale: 'D Mixolydian' })
  })

  it('gives a held row the choices of the chord it holds', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | D7\nA | 2 | D7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    expect(functionChoices(doc).get(3)).toEqual(functionChoices(doc).get(2))
  })
})
