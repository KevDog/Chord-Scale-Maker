import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseChart, serializeChart } from '../chart'
import { functionChoices, insertKeyChange, rowKeys, rowNotes } from '../notes'

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
  it("offers the analyser's reading, then each function that fits, with the scale it would give", () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(3) ?? []
    expect(d7[0]).toEqual({ value: '', label: 'II7', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' })
    expect(d7.map((c) => c.value)).toEqual(['', 'V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III'])
  })

  it("leaves out a function that would read and sound the same as the analyser's", () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(3) ?? []
    expect(d7.filter((c) => c.label === 'II7' && c.scale === 'D Mixolydian')).toHaveLength(1)
  })

  it("shows Auto as the analyser's own reading even when the row states a function", () => {
    const stated = functionChoices(parseChart(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | subV7/♭II')).value).get(3) ?? []
    expect(stated[0]).toEqual({ value: '', label: 'II7', scale: 'D Mixolydian' })
  })

  it("keeps the other rows' statements while it works out one row's choices", () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Em7\nA | 3 | A7 | | V7/II\nA | 4 | Dm7\nA | 5 | G7\nA | 6 | CMaj7\n').value
    expect(functionChoices(doc).get(3)?.[0]?.label).toBe('ii7/II')
  })

  it('gives a held row the choices of the chord it holds', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | D7\nA | 2 | D7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    expect(functionChoices(doc).get(3)).toEqual(functionChoices(doc).get(2))
  })
})

describe('insertKeyChange', () => {
  const MOVES = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | CMaj7\nB | 5 | Am7\nB | 6 | D7\nB | 7 | GMaj7\nB | 8 | GMaj7\n'
  const C = 'C | 9 | Dm7\nC | 10 | G7\nC | 11 | CMaj7\nC | 12 | CMaj7\n'
  const change = (text: string, i: number): string => serializeChart(insertKeyChange(parseChart(text).value, i))
  const tidy = (text: string): string => serializeChart(parseChart(text).value)

  it("pins the row's key area from the row, then returns to the next area where it starts", () => {
    expect(change(MOVES + C, 7)).toBe(tidy(MOVES.replace('B | 6', '@key B 6 G\nB | 6') + `@key C 9 C\n${C}`))
  })

  it('adds no return when an @key already starts the next area', () => {
    const text = `${MOVES}@key C 9 C\n${C}`
    expect(change(text, 7)).toBe(tidy(text.replace('B | 6', '@key B 6 G\nB | 6')))
  })

  it('returns after the @copy line when the next area is a copy', () => {
    const text = `${MOVES}@copy A A2 8\n`
    expect(change(text, 7)).toBe(tidy(`${MOVES.replace('B | 6', '@key B 6 G\nB | 6')}@copy A A2 8\n@key A2 9 C\n`))
  })

  it('adds only the one line in the last area', () => {
    expect(change(MOVES + C, 11)).toBe(tidy(MOVES + C.replace('C | 10', '@key C 10 C\nC | 10')))
  })
})

describe('rowKeys', () => {
  const names = (text: string) => rowKeys(parseChart(text).value).map((k) => k?.name ?? null)
  it("gives every row the chart's key, an @key's from its bar until the next", () => {
    expect(names('title: T\nkey: Eb\nA | 1 | EbMaj7\nB | 2 | DMaj7\nB | 3 | Em7\nC | 4 | EbMaj7\n@key B 2 D\n@key C 4 Eb\n')).toEqual([
      'Eb major', 'D major', 'D major', 'Eb major',
    ])
  })
  it('lets an @key hold through an @copy until the next @key', () => {
    const chart = 'title: T\nkey: Eb\nA1 | 1 | EbMaj7\nA1 | 2 | Cm7\n@key A1 2 C\n@copy A1 A2 2\n'
    expect(names(chart)).toEqual(['Eb major', 'C major', 'C major', 'C major'])
    expect(names(chart.replace('@copy', '@key A2 3 Eb\n@copy'))).toEqual(['Eb major', 'C major', 'Eb major', 'Eb major'])
  })
  it('ignores key areas the analyser only found', () => {
    const body = readFileSync('../charts/body_and_soul.txt', 'utf8')
    expect(new Set(names(body))).toEqual(new Set(['Db major']))
  })
  it('is null without a key: line', () => {
    expect(names('title: T\nA | 1 | Cm7\n')).toEqual([null])
  })
})
