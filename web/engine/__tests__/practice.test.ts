import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT, type Part } from '../part'
import { parseRoot, rootName } from '../pitch'
import { compareKeys, litKeys, type PracticeSelection, practiceBoxes, practiceKeys, selectedNotes, startReference } from '../practice'
import { buildSheet, type StaffModel } from '../sheet'

const row = (chord: string, scale = '', bar = '1'): Row => ({ section: 'A', bar, chord, scale })
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const staves = (rows: readonly Row[], mode: 'root' | 'from', practice: PracticeSelection | null = null, start = 'C', part = CONCERT): StaffModel[] =>
  buildSheet(rows, part, mode, start, 50, practice)[0]?.pages.flat() ?? []
/** the selected notes of each staff, by name */
const picked = (s: readonly StaffModel[]): string[][] => s.map((st) => st.notes.filter((_, i) => st.selected?.[i]).map((n) => rootName(n)))

describe('practice keys', () => {
  it('are spelled intervals from the chord root (From root) or from the start note (From X)', () => {
    const [d] = staves([row('Dm7')], 'root')
    expect(d?.keys).toEqual(['1', '2', 'b3', '4', '5', '6', 'b7'])
    const [f] = staves([row('F7')], 'from') // F Mixolydian from C: C D Eb F G A Bb
    expect(f?.notes.map((n) => rootName(n))).toEqual(['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'])
    expect(f?.keys).toEqual(['1', '2', 'b3', '4', '5', '6', 'b7'])
  })

  it('keep every spelling apart: two notes on one degree, #4 against b5', () => {
    expect(staves([row('D7b9', 'D Half-Whole')], 'root')[0]?.keys).toEqual(['1', 'b2', 'b3', '3', '#4', '5', '6', 'b7'])
    expect(staves([row('C7', 'C Blues')], 'root')[0]?.keys).toEqual(['1', 'b3', '4', 'b5', '5', 'b7'])
    expect(staves([row('C', 'C Major Pentatonic')], 'root')[0]?.keys).toEqual(['1', '2', '3', '5', '6'])
    expect(practiceKeys(parseRoot('C'), [parseRoot('E#'), parseRoot('F')])).toEqual(['#3', '4'])
  })

  it('follow the written spelling for a transposing instrument, so From root keys are unchanged', () => {
    const [concert] = staves([row('Cm7')], 'root')
    const [tenor] = staves([row('Cm7')], 'root', null, 'C', TENOR) // written D Dorian
    expect(tenor?.keys).toEqual(concert?.keys)
  })

  it('reads the start note with or without an octave', () => {
    expect(startReference('F#3')).toEqual(parseRoot('F#'))
    expect(startReference('Eb')).toEqual(parseRoot('Eb'))
    expect(startReference('H')).toBeNull()
  })
})

describe('practice selection', () => {
  it('is off unless asked for', () => {
    expect(staves([row('Dm7')], 'root')[0]?.selected).toBeNull()
  })

  it('picks explicit keys on every staff', () => {
    const rows = [row('Dm7b5', '', '1'), row('G7alt', '', '2'), row('Cm7', '', '3')]
    expect(picked(staves(rows, 'root', { keys: ['b3', '3'] }))).toEqual([['F'], ['Bb', 'B'], ['Eb']]) // G Altered has b3 (#9) and 3
    // From C: the A slot (a major 6th above C) and the Ab slot, as the plan's ii–V–i example
    expect(picked(staves(rows, 'from', { keys: ['b6', '6'] }))).toEqual([['Ab'], ['Ab'], ['A']])
  })

  it('keeps its meaning when the start note changes (From X keys are relative to it)', () => {
    const rows = [row('F7')]
    expect(picked(staves(rows, 'from', { keys: ['b3'] }, 'C'))).toEqual([['Eb']])
    expect(picked(staves(rows, 'from', { keys: ['b3'] }, 'Eb'))).toEqual([[]]) // Gb isn't in F Mixolydian
    expect(picked(staves(rows, 'from', { keys: ['3'] }, 'Eb'))).toEqual([['G']])
  })

  it('presets pick per chord, from its quality', () => {
    const rows = [row('G7alt', '', '1'), row('G7sus4', '', '2'), row('C6', 'C Ionian', '3'), row('Bm7b5', '', '4')]
    expect(picked(staves(rows, 'root', { preset: 'chordTones' }))).toEqual([
      ['G', 'B', 'F'], // alt: 1 3 b7 (its b3 is a #9, not a chord tone)
      ['G', 'C', 'D', 'F'], // sus: the 4, no 3rd
      ['C', 'E', 'G', 'A'], // sixth chord: the 6
      ['B', 'D', 'F', 'A'],
    ])
    expect(picked(staves(rows, 'root', { preset: 'guideTones' }))).toEqual([['B', 'F'], ['C', 'F'], ['E', 'A'], ['D', 'A']])
    expect(picked(staves([row('G7alt')], 'root', { preset: 'tensions' }))).toEqual([['Ab', 'Bb', 'C#', 'Eb']])
    expect(picked(staves([row('C7sus4b9')], 'root', { preset: 'chordTones' }))).toEqual([['C', 'Db', 'F', 'G', 'Bb']]) // sus b9
    expect(picked(staves([row('Cm7#5#9x', 'C Dorian')], 'root', { preset: 'chordTones' }))).toEqual([[]]) // unknown quality
    expect(picked(staves([row('F7')], 'from', { preset: 'all' }))[0]).toHaveLength(7)
  })

  it('selectedNotes works on keys alone', () => {
    expect(selectedNotes({ keys: ['1', '5'] }, 'C7', ['1', '3', '5', 'b7'])).toEqual([true, false, true, false])
  })
})

describe('practice boxes', () => {
  it('lists the keys present in the chart, by degree then flattest first, labelled for the mode', () => {
    const rows = [row('Dm7'), row('G7b9', 'G Half-Whole'), row('C', 'C Major Pentatonic')]
    const root = practiceBoxes(staves(rows, 'root'), 'root', 'C')
    expect(root.map((b) => b.key)).toEqual(['1', 'b2', '2', 'b3', '3', '4', '#4', '5', '6', 'b7'])
    expect(root.find((b) => b.key === 'b3')?.label).toBe('♭3')
    const from = practiceBoxes(staves([row('F7')], 'from', null, 'Eb'), 'from', 'Eb')
    expect(from.map((b) => b.label)).toEqual(['E♭', 'F', 'G', 'A', 'B♭', 'C', 'D'])
  })

  it('orders keys and reports what a selection lights', () => {
    expect(['5', 'b3', '#4', '3', '1', 'bb7', 'b7'].sort(compareKeys)).toEqual(['1', 'b3', '3', '#4', '5', 'bb7', 'b7'])
    expect(litKeys(staves([row('G7alt'), row('Dm7')], 'root', { preset: 'guideTones' }))).toEqual(['b3', '3', 'b7'])
  })
})
