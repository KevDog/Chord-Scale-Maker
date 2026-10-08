import { describe, expect, it } from 'vitest'
import { type ChartDoc, chartMeta, parseChart, serializeChart } from '../chart'
import { cellError, insertRowAfter, removeLine, sameChart, setMeta, setRowChord, setRowField } from '../edit'

const doc = parseChart('title: T\nA | 1 | Cm7\n# note\nA | 2 | F7 | F Mixolydian\n').value

describe('edit', () => {
  it('rejects cell values that would re-parse as a different line', () => {
    expect(cellError('Cm7')).toBeNull()
    expect(cellError('C|7')).toMatch(/\|/)
    expect(cellError('a\nb')).toMatch(/line breaks/)
    expect(cellError('#1')).toMatch(/start with/)
    expect(cellError('@copy')).toMatch(/start with/)
    expect(cellError('Title: x')).toMatch(/start with/)
    expect(cellError(' A')).toMatch(/spaces/)
    expect(cellError('x'.repeat(41))).toMatch(/longer/)
    expect(cellError('x'.repeat(100), 120)).toBeNull()
  })

  it('sets row fields immutably and ignores non-row lines', () => {
    const next = setRowField(doc, 1, 'scale', 'C Aeolian')
    expect(next.lines[1]).toEqual({ kind: 'row', section: 'A', bar: '1', chord: 'Cm7', scale: 'C Aeolian' })
    expect(doc.lines[1]).toMatchObject({ scale: '' })
    expect(setRowField(doc, 2, 'chord', 'X')).toBe(doc)
  })

  it('inserts rows that inherit section and bar, and removes lines', () => {
    const next = insertRowAfter(doc, 3)
    expect(next.lines[4]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: '', scale: '' })
    expect(insertRowAfter(parseChart('').value, -1).lines).toEqual([
      { kind: 'row', section: 'A', bar: '1', chord: '', scale: '' },
    ])
    expect(removeLine(doc, 2).lines.map((l) => l.kind)).toEqual(['meta', 'row', 'row'])
  })

  it('sets meta in place or inserts it at the top', () => {
    expect(chartMeta(setMeta(doc, 'title', 'New')).title).toBe('New')
    const withSub = setMeta(doc, 'subtitle', 'S')
    expect(serializeChart(withSub).split('\n').slice(0, 2)).toEqual(['title: T', 'subtitle: S'])
    expect(setMeta(parseChart('A | 1 | C').value, 'title', 'X').lines[0]).toEqual({ kind: 'meta', key: 'title', value: 'X' })
  })
})

describe('chord changes and comparing charts', () => {
  const doc = (text: string) => parseChart(text).value
  const rowOf = (d: ChartDoc) => d.lines.find((l) => l.kind === 'row')

  it('moves a default scale to the new chord, and keeps one you chose', () => {
    expect(rowOf(setRowChord(doc('A | 1 | Cm7 | C Dorian\n'), 0, 'F7'))).toMatchObject({ chord: 'F7', scale: 'F Mixolydian' })
    expect(rowOf(setRowChord(doc('A | 1 | Cm7 | C Aeolian\n'), 0, 'F7'))).toMatchObject({ scale: 'C Aeolian' })
    expect(rowOf(setRowChord(doc('A | 1 | Cm7\n'), 0, 'F7'))).toMatchObject({ scale: '' }) // empty stays empty: still the default
    expect(rowOf(setRowChord(doc('A | 1 | Cm7 | C Dorian\n'), 0, 'Cm7#5#9x'))).toMatchObject({ scale: 'C Dorian' }) // unknown: kept
  })

  it('treats charts as the same when only spacing or a written-out default differs', () => {
    expect(sameChart('A | 1 | Cm7 | C Dorian\n', 'A | 1  |  Cm7\n')).toBe(true)
    expect(sameChart('A | 6 | D7 | D Half-Whole\n', 'A | 6 | D7 | D Half-Whole Diminished\n')).toBe(true)
    expect(sameChart('A | 1 | Cm7 | C Dorian\n', 'A | 1 | Cm7 | C Aeolian\n')).toBe(false)
    expect(sameChart('# note\nA | 1 | Cm7\n', 'A | 1 | Cm7\n')).toBe(false) // comments count
  })
})
