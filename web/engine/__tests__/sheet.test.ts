import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT } from '../part'
import { type ModeChoice, type StaffModel, buildSheet, noteText, toVexKey } from '../sheet'

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

  it('reports staves that need attention instead of throwing', () => {
    const [unknown, bad, typo] = staves([row('Cm7#5#9x'), row('Xyz'), row('Cm7', 'C Dorain')])
    expect(unknown).toMatchObject({ error: 'Choose a scale' })
    expect(unknown?.chord).not.toBeNull()
    expect(bad).toMatchObject({ chord: null, error: "Can't read this chord" })
    expect(typo).toMatchObject({ scale: null, error: 'unknown scale "Dorain"', chord: [{ kind: 'text', text: 'C–7' }] })
  })

  it('gives staves stable ids that change with their content', () => {
    const id = (rows: readonly Row[]): string[] => staves(rows).map((s) => s.id)
    expect(id([row('Cm7')])).toEqual(id([row('Cm7')]))
    expect(id([row('Cm7')])).not.toEqual(id([row('Cm7', 'C Aeolian')]))
    const [a, b] = id([row('Cm7'), row('Cm7')])
    expect(a).not.toBe(b)
  })
})
