import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT } from '../part'
import { type ModeChoice, type StaffModel, buildSheet, noteText, pageSubtitle, toVexKey } from '../sheet'
import { parseKey } from '../analysis/keys'

const row = (chord: string, scale = '', bar = '1'): Row => ({ section: 'A', bar, chord, scale })

/** every staff of the first part, across pages */
const staves = (rows: readonly Row[], mode: ModeChoice = 'root'): StaffModel[] =>
  buildSheet(rows, CONCERT, mode, 'C', 12)[0]?.pages.flat() ?? []

describe('sheet', () => {
  it('converts pitched notes to VexFlow keys', () => {
    expect(toVexKey({ letter: 2, acc: -1, midi: 63 })).toBe('eb/4')
    expect(toVexKey({ letter: 0, acc: -1, midi: 59 })).toBe('cb/4') // Cb4 sounds as B3
    expect(toVexKey({ letter: 6, acc: 1, midi: 72 })).toBe('b#/4') // B#4 sounds as C5
    expect(toVexKey({ letter: 4, acc: 0, midi: 43 })).toBe('g/2')
  })

  it('formats start notes for headings', () => {
    expect(noteText('Eb')).toBe('E♭')
    expect(noteText('F#3')).toBe('F♯')
    expect(noteText('Ebb')).toBe('E♭♭')
  })

  it('builds one part per mode with pages of perPage staves', () => {
    const rows = Array.from({ length: 13 }, (_, i) => row('Cm7', '', String(i + 1)))
    const sheet = buildSheet(rows, CONCERT, 'both', 'C', 12)
    expect(sheet.map((p) => [p.mode, p.heading, p.pages.map((pg) => pg.length)])).toEqual([
      ['from', 'Spelled from C', [12, 1]],
      ['root', 'Spelled from the Root', [12, 1]],
    ])
    const first = sheet[0]?.pages.flat() ?? []
    expect(first.map((s) => s.last)).toEqual([...Array(12).fill(false), true])
  })

  it('fills in default scales and spells the notes', () => {
    const [s] = staves([row('Cm7')])
    if (!s) throw new Error('no staff')
    expect(s.scale).toEqual({ root: { letter: 0, acc: 0 }, name: 'Dorian' })
    expect(s.notes.map(toVexKey)).toEqual(['c/4', 'd/4', 'eb/4', 'f/4', 'g/4', 'a/4', 'bb/4'])
    expect(s.chord).toEqual([{ kind: 'text', text: 'C–7' }])
    expect(s.error).toBeNull()
  })

  it('labels each note against the chord root, in any mode and for any instrument', () => {
    expect(staves([row('G7', 'Db Major Pentatonic')])[0]?.intervals).toEqual(['b5', 'b13', 'b7', 'b9', '#9'])
    const [from] = staves([row('Dm7')], 'from') // D Dorian from C: C D E F G A B
    expect(from?.intervals).toEqual(['b7', '1', '9', 'b3', '11', '5', '13'])
    const tenor = buildSheet([row('C7#9', 'C Altered')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages[0]?.[0]
    expect(tenor?.intervals).toEqual(['1', 'b9', '#9', '3', '#11', 'b13', 'b7']) // written D Altered over D7#9
    expect(staves([row('Cm7#5#9x', 'C Dorian')])[0]?.intervals).toEqual(['1', '9', 'b3', '11', '5', '13', 'b7']) // unknown quality
    expect(staves([row('???', 'C Dorian')])[0]?.intervals).toBeNull()
  })

  it('reports staves that need attention instead of throwing', () => {
    const [unknown, bad, typo] = staves([row('Cm7#5#9x'), row('Xyz'), row('Cm7', 'C Dorain')])
    expect(unknown).toMatchObject({ error: 'Choose a scale' })
    expect(unknown?.chord).not.toBeNull()
    expect(bad).toMatchObject({ chord: null, error: "Can't read this chord" })
    expect(typo).toMatchObject({ scale: null, error: 'unknown scale "Dorain"', chord: [{ kind: 'text', text: 'C–7' }] })
  })

  it('rejects a pitch that does not match its spelling', () => {
    expect(() => toVexKey({ letter: 0, acc: 0, midi: 61 })).toThrow(/does not match/)
  })

  it('never throws for a bad start note or page size', () => {
    const rows = [row('Cm7'), row('F7')]
    expect(buildSheet(rows, CONCERT, 'root', 'H', 12)[0]?.pages.flat()).toHaveLength(2) // start unused in root mode
    const [from] = buildSheet(rows, CONCERT, 'from', 'H', 12)
    expect(from?.heading).toBe('Spelled from H')
    expect(from?.pages.flat().map((s) => s.error)).toEqual(['bad start note "H" (try C, Eb, F#3)', 'bad start note "H" (try C, Eb, F#3)'])
    for (const perPage of [0, -3, Number.NaN, 1.5])
      expect(buildSheet(rows, CONCERT, 'root', 'C', perPage)[0]?.pages.map((p) => p.length)).toEqual([1, 1])
    expect(buildSheet([], CONCERT, 'both', 'C', 12).map((p) => p.pages)).toEqual([[], []])
  })

  it('gives staves stable ids that change with their content', () => {
    const id = (rows: readonly Row[]): string[] => staves(rows).map((s) => s.id)
    expect(id([row('Cm7')])).toEqual(id([row('Cm7')]))
    expect(id([row('Cm7')])).not.toEqual(id([row('Cm7', 'C Aeolian')]))
    const [a, b] = id([row('Cm7'), row('Cm7')])
    expect(a).not.toBe(b)
    const bb = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat()[0]?.id
    expect(bb).not.toBe(id([row('Cm7')])[0]) // a different instrument redraws
  })

  it('builds page subtitles', () => {
    expect(pageSubtitle('Full Form', 'Tenor Sax (Bb)', 'Spelled from C')).toBe('Full Form – Tenor Sax (Bb) (Spelled from C)')
    expect(pageSubtitle('Full Form', '', 'Spelled from the Root')).toBe('Full Form (Spelled from the Root)')
    expect(pageSubtitle('', 'Trombone', 'Spelled from C')).toBe('Trombone (Spelled from C)')
    expect(pageSubtitle('', '', 'Spelled from C')).toBe('Spelled from C')
  })

  it('writes the sheet for a transposing instrument', () => {
    const [s] = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat() ?? []
    expect(s?.chord).toEqual([{ kind: 'text', text: 'D–7' }])
    expect(s?.scale?.name).toBe('Dorian')
    expect(s?.notes.map(toVexKey)).toEqual(['d/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'])
    const [b] = buildSheet([row('Cm7')], { clef: 'bass', trans: 'C' }, 'from', 'C', 12)[0]?.pages.flat() ?? []
    expect(b?.notes.map(toVexKey)[0]).toBe('c/3') // bass clef starts an octave lower
  })

  it('with keys, gives each staff its written signature and only the accidentals that leave it', () => {
    const rows = [{ section: 'A', bar: '1', chord: 'Dm7', scale: 'D Dorian' }]
    const [staff] = buildSheet(rows, CONCERT, 'root', 'C', 12, null, [parseKey('Eb')]).flatMap((p) => p.pages.flat())
    expect(staff?.keySig).toBe('Eb')
    expect(staff?.notes.map((n, i) => (staff.accidentals[i] ?? '') + 'CDEFGAB'[n.letter])).toEqual(['D', 'nE', 'F', 'G', 'nA', 'nB', 'C'])
    const [plain] = buildSheet(rows, CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect([plain?.keySig, plain?.accidentals.every((a) => a === null)]).toEqual([null, true])
  })
  it('with a null key (no key: line), keeps explicit accidentals as without keys', () => {
    const rows = [{ section: 'A', bar: '1', chord: 'C7', scale: 'C Half-Whole' }]
    const [a] = buildSheet(rows, CONCERT, 'root', 'C', 12, null, [null]).flatMap((p) => p.pages.flat())
    const [b] = buildSheet(rows, CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
    expect([a?.keySig, a?.accidentals]).toEqual([null, b?.accidentals])
  })
  it('writes the signature for a transposing part', () => {
    const rows = [{ section: 'A', bar: '1', chord: 'EbMaj7', scale: 'Eb Ionian' }]
    const [staff] = buildSheet(rows, { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12, null, [parseKey('Eb')]).flatMap((p) => p.pages.flat())
    expect([staff?.keySig, staff?.accidentals.every((a) => a === null)]).toEqual(['F', true]) // F Ionian in F: no accidentals
  })
})
