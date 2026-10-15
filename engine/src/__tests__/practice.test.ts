import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT, type Part } from '../part'
import { parseRoot, rootName } from '../pitch'
import { compareKeys, isPentatonicSelection, litKeys, type PracticeSelection, practiceBoxes, practiceKeys, practiceSelectionFrom, PRESETS, selectedNotes, startReference } from '../practice'
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

describe('practice on a diminished seventh chord (R3b)', () => {
  it('keys its chord tones by semitone, so the presets light 1 ♭3 ♭5 °7 whatever the scale’s letters', () => {
    const [wave] = staves([row('Bbdim7', 'Bb Diatonic Diminished bVI')], 'root', { preset: 'chordTones' })
    expect(wave?.keys).toEqual(['1', '#1', 'b3', '3', 'b5', '#5', 'bb7', '7'])
    expect(picked(wave ? [wave] : [])).toEqual([['Bb', 'C#', 'E', 'G']])
    const [tensions] = staves([row('Bbdim7', 'Bb Diatonic Diminished bVI')], 'root', { preset: 'tensions' })
    expect(picked(tensions ? [tensions] : [])).toEqual([['B', 'D', 'F#', 'A']])
    expect(staves([row('C#dim7', 'C# Diatonic Diminished')], 'root')[0]?.keys).toEqual(['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'bb7', '7'])
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

  it('lights a merged line like its first chord: Cm7 + Cm9 over C Dorian are one staff', () => {
    const merged = staves([row('Cm7', 'C Dorian', '1'), row('Cm9', 'C Dorian', '2')], 'root', { preset: 'chordTones' })
    expect(merged).toHaveLength(1)
    expect(picked(merged)).toEqual(picked(staves([row('Cm7', 'C Dorian')], 'root', { preset: 'chordTones' })))
    expect(picked(staves([row('Cm7', 'C Dorian', '1'), row('Cm9', 'C Dorian', '2')], 'root', { preset: 'guideTones' }))).toEqual([['Eb', 'Bb']])
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

describe('the Pentatonic selection (#266)', () => {
  it('is offered in both modes, last', () => {
    expect(PRESETS.root.at(-1)).toBe('pentatonic')
    expect(PRESETS.from).toEqual(['all', 'pentatonic'])
  })

  it('reads from untrusted data with a rank 1–12; a missing or bad rank reads as 1', () => {
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 7 })).toEqual({ preset: 'pentatonic', rank: 7 })
    expect(practiceSelectionFrom({ preset: 'pentatonic' })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 13 })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 2.5 })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'guideTones', rank: 3 })).toEqual({ preset: 'guideTones' })
  })

  it('is told apart from the other selections', () => {
    expect(isPentatonicSelection({ preset: 'pentatonic', rank: 2 })).toBe(true)
    expect(isPentatonicSelection({ preset: 'all' })).toBe(false)
    expect(isPentatonicSelection({ keys: ['1'] })).toBe(false)
    expect(isPentatonicSelection(null)).toBe(false)
  })
})

describe('the Pentatonic preset on the Scales sheet (#266)', () => {
  const pent = (rank: number): PracticeSelection => ({ preset: 'pentatonic', rank })

  it('selects nothing by keys', () => {
    expect(selectedNotes({ preset: 'pentatonic', rank: 1 }, 'Dm7', ['1', 'b3'])).toEqual([false, false])
  })

  it('lights each staff’s pentatonic at the rank and names it', () => {
    const [d, g] = staves([row('Dm7'), row('G7', '', '2')], 'root', pent(1))
    expect(d?.pentatonic).toEqual({ name: 'Dm', rank: 1, shared: 5, best: 5 })
    expect(picked([d!])[0]).toEqual(['D', 'F', 'G', 'A', 'C'])
    expect(g?.pentatonic?.name).toBe('Dm')
  })

  it('lights fewer notes farther down the ladder, in From X mode too', () => {
    const [far] = staves([row('Dm7')], 'from', pent(12))
    expect(far?.pentatonic?.shared).toBe(0)
    expect(far?.selected?.every((s) => !s)).toBe(true)
  })

  it('names the written pentatonic for a transposing part, lighting the same degrees', () => {
    const [concert] = staves([row('Dm7')], 'root', pent(1))
    const [tenor] = staves([row('Dm7')], 'root', pent(1), 'C', TENOR)
    expect(tenor?.pentatonic?.name).toBe('Em')
    expect(tenor?.selected).toEqual(concert?.selected)
  })

  it('is null under other selections and on staves that can’t be drawn', () => {
    expect(staves([row('Dm7')], 'root', { preset: 'guideTones' })[0]?.pentatonic).toBeNull()
    expect(staves([row('Dm7')], 'root')[0]?.pentatonic).toBeNull()
    expect(staves([row('Xq7')], 'root', pent(1))[0]?.pentatonic).toBeNull()
  })

  it('ranks from the scale’s root when the chord can’t be read', () => {
    const [s] = staves([row('Xq7', 'D Dorian')], 'root', pent(1))
    expect(s?.pentatonic?.name).toBe('Dm')
  })

  it('still lights what the caption names when the reference can’t be read', () => {
    const [s] = staves([row('Xq7', 'D Dorian')], 'root', pent(1))
    expect(s?.keys).toBeNull()
    expect(s?.selected?.filter(Boolean)).toHaveLength(5)
  })

  it('reports a best under 5 on a whole-tone staff', () => {
    expect(staves([row('C7#5', 'C Whole Tone')], 'root', pent(1))[0]?.pentatonic?.best).toBe(3)
  })
})
