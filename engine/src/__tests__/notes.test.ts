import { describe, expect, it } from 'vitest'
import { parseChart, serializeChart } from '../chart'
import { chartKeyOf, functionChoices, insertKeyChange, rowNotes } from '../notes'
import type { ScaleView } from '../resolve'

const notes = (text: string, view?: ScaleView) => rowNotes(parseChart(text).value, view)
const ON: ScaleView = { level: 'standard', seed: 0 }
const C_TUNE = 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | D7\n3 | Dm7\n4 | G7\n5 | Am7\n6 | Dm7\n7 | G7\n8 | CMaj7\n'

describe('rowNotes', () => {
  it('gives each row its reason and key area, keyed by doc line', () => {
    expect(notes('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n').get(6)).toEqual({ note: 'V7 of C: natural tensions', problem: null, key: 'C', numeral: 'V7', scale: 'G Mixolydian', source: 'rules', analysed: 'G Mixolydian', rule: 'D4' })
  })

  it("gives the analyzer's scale and rule beside yours, at the sheet's level: what blanking the cell would play", () => {
    expect(notes('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7 | G Altered\n3 | CMaj7\n').get(6)).toMatchObject({ scale: 'G Altered', analysed: 'G Mixolydian', rule: 'D4' })
    const minor = 'title: T\nkey: Gm\n\nsection: A\nbars: 4\n1 | Am7b5\n2 | D7\n3 | Gm7 | G Dorian\n'
    expect(notes(minor, { ...ON, level: 'basic' }).get(7)).toMatchObject({ scale: 'G Dorian', source: 'written', analysed: 'G Aeolian' })
  })

  it('gives the scale played: yours over the analyzer’s; and the function you stated as the numeral', () => {
    const n = notes('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7 | G Altered | V7/I\n3 | CMaj7\n')
    expect(n.get(6)).toMatchObject({ numeral: 'V7/I', scale: 'G Altered', source: 'written' })
  })

  it("says when your scale isn't the analyzer's", () => {
    expect(notes('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7 | G Altered\n3 | CMaj7\n').get(6)?.note).toBe(
      'analyzer: G Mixolydian (V7 of C: natural tensions); you chose G Altered',
    )
  })

  it('says "you chose" only of a written scale: a blank cell chose nothing', () => {
    const stated = 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | CMaj7\n2 | D7 |  | subV7/♭II\n3 | Dm7\n4 | G7\n5 | CMaj7\n'
    expect(notes(stated, ON).get(6)).toMatchObject({ note: expect.stringMatching(/^\* /), scale: 'D Lydian Dominant', source: 'function' })
    expect(notes(stated.replace('|  | subV7', '| D Mixolydian | subV7'), ON).get(6)).toMatchObject({ note: expect.stringContaining('; you chose D Mixolydian'), source: 'written' })
  })

  it('gives the scale played at the sheet’s level', () => {
    const minor = 'title: T\nkey: Gm\n\nsection: A\nbars: 4\n1 | Am7b5\n2 | D7\n3 | Gm7\n'
    expect(notes(minor, { ...ON, level: 'basic' }).get(6)).toMatchObject({ scale: 'G Minor Pentatonic', source: 'rules', note: expect.not.stringContaining('you chose') })
  })

  it("carries a row's function problem, and an @key's", () => {
    const n = notes('title: T\nkey: C\n\nsection: A\nbars: 4\n@key 9 F\n1 | Dm7\n2 | G7 |  | ii7\n3 | CMaj7\n')
    expect(n.get(7)?.problem).toBe('ii7 is a minor chord, G7 a dominant one')
    expect(n.get(5)).toEqual({ note: '', problem: '@key 9: no bar 9 in section A', key: '', numeral: '', scale: '', source: 'default', analysed: '', rule: '' })
  })
})

describe('functionChoices', () => {
  it("offers the analyzer's reading, then each function that fits, with the scale it would give", () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(5) ?? []
    expect(d7[0]).toMatchObject({ value: '', label: 'II7', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' })
    expect(d7.map((c) => c.value)).toEqual(['', 'V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III'])
  })

  it("leaves out a function that would read and sound the same as the analyzer's", () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(5) ?? []
    expect(d7.filter((c) => c.label === 'II7' && c.scale === 'D Mixolydian')).toHaveLength(1)
  })

  it('names, on Auto, the function that states a guess (ruling D5): the left-out candidate that reads and sounds like Auto', () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(5) ?? []
    expect(d7[0]).toEqual({ value: '', label: 'II7', scale: 'D Mixolydian', accept: 'II7' })
  })

  it('gives Auto no accept where the rules decided, or where the row already states its function', () => {
    const choices = functionChoices(parseChart(C_TUNE).value)
    expect(choices.get(7)?.[0]).toEqual({ value: '', label: 'V7', scale: 'G Mixolydian' }) // diatonic, decided
    const stated = functionChoices(parseChart(C_TUNE.replace('2 | D7', '2 | D7 | | II7')).value).get(5) ?? []
    expect(stated[0]).toEqual({ value: '', label: 'II7', scale: 'D Mixolydian' })
  })

  it("shows Auto as the analyzer's own reading even when the row states a function", () => {
    const stated = functionChoices(parseChart(C_TUNE.replace('2 | D7', '2 | D7 | | subV7/♭II')).value).get(5) ?? []
    expect(stated[0]).toEqual({ value: '', label: 'II7', scale: 'D Mixolydian' })
  })

  it("keeps the other rows' statements while it works out one row's choices", () => {
    const text = 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | CMaj7\n2 | F#m7\n3 | B7 |  | V7/III\n4 | Em7\n5 | G7\n6 | CMaj7\n'
    expect(functionChoices(parseChart(text).value).get(6)?.[0]?.label).toBe('ii7/III')
    expect(functionChoices(parseChart(text.replace(' |  | V7/III', '')).value).get(6)?.[0]?.label).toBe('ii7/iii') // unstated
  })

  it('labels Auto "Auto (extended dominant)" on a chain link the sheet marks with an arrow (ruling R7)', () => {
    const bridge = functionChoices(parseChart('title: T\nkey: Bb\n\nsection: A\nbars: 8\n1 | BbMaj7\n2 | D7\n3 | G7\n4 | C7\n5 | F7\n6 | BbMaj7\n').value)
    expect([6, 7, 8].map((line) => bridge.get(line)?.[0])).toEqual([
      { value: '', label: 'Auto (extended dominant)', scale: 'D Mixolydian' },
      { value: '', label: 'Auto (extended dominant)', scale: 'G Mixolydian' },
      { value: '', label: 'V7/V', scale: 'C Mixolydian' },
    ])
  })

  it('gives a held row the choices of the chord it holds', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | D7\n2 | D7\n3 | G7\n4 | CMaj7\n').value
    expect(functionChoices(doc).get(5)).toEqual(functionChoices(doc).get(4))
  })
})

describe('insertKeyChange', () => {
  const MOVES = 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n\nsection: B\n1 | Am7\n2 | D7\n3 | GMaj7\n4 | GMaj7\n'
  const C = 'section: C\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n'
  // one section: C, then G from bar 5, then C again from bar 9
  const LONG = 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n5 | Am7\n6 | D7\n7 | GMaj7\n8 | GMaj7\n9 | Dm7\n10 | G7\n11 | CMaj7\n12 | CMaj7\n'
  const change = (text: string, i: number): string => serializeChart(insertKeyChange(parseChart(text).value, i))
  const tidy = (text: string): string => serializeChart(parseChart(text).value)

  it("pins the row's key area from the row, then returns to the next area where it starts in the same section", () => {
    expect(change(LONG, 9)).toBe(tidy(LONG.replace('6 | D7', '@key 6 G\n6 | D7').replace('9 | Dm7', '@key 9 C\n9 | Dm7')))
  })

  it('adds no return when the next area starts in another section: a stated key holds only to its section’s end', () => {
    expect(change(MOVES + C, 11)).toBe(tidy((MOVES + C).replace('2 | D7', '@key 2 G\n2 | D7')))
  })

  it('states a key on a section’s bar 1 as its key:', () => {
    expect(change(MOVES + C, 10)).toBe(tidy((MOVES + C).replace('section: B\n', 'section: B\nkey: G\n')))
  })

  it('adds no return when an @key already starts the next area', () => {
    const text = LONG.replace('9 | Dm7', '@key 9 C\n9 | Dm7')
    expect(change(text, 9)).toBe(tidy(text.replace('6 | D7', '@key 6 G\n6 | D7')))
  })
})

describe('chartKeyOf', () => {
  it("is the chart's key: line, whatever its @key areas", () => {
    expect(chartKeyOf(parseChart('title: T\nkey: Eb\n\nsection: A\n1 | EbMaj7\n\nsection: B\nkey: D\nbars: 3\n1 | DMaj7\n').value)?.name).toBe('Eb major')
    expect(chartKeyOf(parseChart('title: T\nkey: Gm\n\nsection: A\nbars: 4\n1 | Gm7\n').value)?.name).toBe('G minor')
  })
  it('is null without a key: line', () => {
    expect(chartKeyOf(parseChart('title: T\n\nsection: A\nbars: 4\n1 | Cm7\n').value)).toBeNull()
  })
})
