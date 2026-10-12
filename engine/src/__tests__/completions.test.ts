import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { sheetScale } from '../changes'
import { chordCompletions, chordPreview } from '../completions'
import { CONCERT } from '../part'

const C = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const GM = parseChart('title: T\nkey: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm7\n').value

describe('chordCompletions', () => {
  it('puts the typed text first, then the root with each quality that starts with the suffix typed', () => {
    expect(chordCompletions('D7')).toEqual(['D7', 'D7sus4', 'D7sus4b9', 'D7b9', 'D7b9b13', 'D7b13'])
    expect(chordCompletions('D7b')).toEqual(['D7b', 'D7b9', 'D7b9b13', 'D7b13'])
    expect(chordCompletions('D7b9')).toEqual(['D7b9', 'D7b9b13'])
  })

  it('offers the common qualities for a bare root, and keeps the root’s own spelling', () => {
    expect(chordCompletions('Bb')).toEqual(['Bb', 'Bb7', 'Bbm7', 'BbMaj7', 'Bbm7b5', 'Bb7b9'])
    expect(chordCompletions('F#', 3)).toEqual(['F#', 'F#7', 'F#m7'])
  })

  it('matches qualities without regard to case', () => {
    expect(chordCompletions('Cma')).toEqual(['Cma', 'Cmaj', 'CMaj7', 'CMaj7#11', 'CMaj7#5']) // the data's order
  })

  it('leaves a slash bass alone', () => {
    expect(chordCompletions('D7/F#')).toEqual(['D7/F#', 'D7sus4/F#', 'D7sus4b9/F#', 'D7b9/F#', 'D7b9b13/F#', 'D7b13/F#'])
  })

  it('offers nothing for an empty draft, and only the text for one with no root', () => {
    expect(chordCompletions('')).toEqual([])
    expect(chordCompletions('%')).toEqual(['%'])
    expect(chordCompletions('xyz')).toEqual(['xyz'])
  })
})

describe('chordPreview', () => {
  it('reads a candidate in its bar: the numeral and scale the analysis gives', () => {
    expect(chordPreview(C, 'A', 2, ['G7'], 0)).toEqual({ numeral: 'V7', scale: 'G Mixolydian', readable: true })
    expect(chordPreview(GM, 'A', 2, ['D7'], 0)).toEqual({ numeral: 'V7', scale: 'D Phrygian Dominant', readable: true })
    expect(chordPreview(GM, 'A', 2, ['D7b9'], 0)).toMatchObject({ numeral: 'V7', scale: 'D Phrygian Dominant' })
  })

  it('previews a new chord added to a bar, at its index', () => {
    const p = chordPreview(C, 'A', 1, ['Dm7', 'A7'], 1)
    expect(p.readable).toBe(true)
    expect(p.scale).toMatch(/^A /)
    expect(p.numeral).toBe('V7/ii')
  })

  it('reads at the view’s level', () => {
    expect(chordPreview(GM, 'A', 2, ['D7'], 0, { level: 'basic', seed: 0 }).scale).toBe('G Minor Pentatonic')
  })

  it('falls back to the quality’s default where the analysis doesn’t reach, and says when a chord can’t be read', () => {
    const NOKEY = parseChart('title: T\nA | 1 | Cm7\n').value
    expect(chordPreview(NOKEY, 'A', 1, ['Cm7'], 0)).toMatchObject({ scale: 'C Dorian', readable: true })
    expect(chordPreview(C, 'A', 2, ['Gxyz'], 0)).toEqual({ numeral: null, scale: null, readable: false })
    expect(chordPreview(C, 'A', 2, [''], 0)).toEqual({ numeral: null, scale: null, readable: false })
  })

  it('previews the row as it is when the chart refuses the chords', () => {
    expect(chordPreview(C, 'A', 1, [], 0)).toEqual({ numeral: 'ii7', scale: 'D Dorian', readable: false }) // a section’s first bar can’t be emptied
  })
})

describe('sheetScale', () => {
  it('writes a preview’s scale as the Changes sheet labels it: the part’s root, the long words shortened', () => {
    expect(sheetScale(CONCERT, 'G Half-Whole Diminished')).toBe('G H/W Dim.')
    expect(sheetScale(CONCERT, 'Db Mixolydian')).toBe('D♭ Mixo')
    expect(sheetScale({ clef: 'treble', trans: 'Bb' }, 'G Mixolydian')).toBe('A Mixo')
    expect(sheetScale(CONCERT, null)).toBeNull()
  })
})
