import { describe, expect, it } from 'vitest'
import { type ChartDoc, chartMeta, parseChart, serializeChart } from '../chart'
import { cellError, clearMeta, insertKeyBefore, insertRowAfter, removeLine, sameChart, setKeyLine, setMeta, setRowChord, setRowField } from '../edit'

const doc = parseChart('title: T\n\nsection: A\nbars: 4\n1 | Cm7\n# note\n2 | F7 | F Mixolydian\n').value

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
    expect(cellError('C Dorian # mine')).toMatch(/comment/) // would re-parse as a trailing comment
    expect([cellError('F#m7'), cellError('C# Lydian'), cellError('We\'re # 1', 120, true)]).toEqual([null, null, null])
    expect(cellError('x'.repeat(100), 120)).toBeNull()
  })

  it('sets row fields immutably and ignores non-row lines', () => {
    const next = setRowField(doc, 4, 'scale', 'C Aeolian')
    expect(next.lines[4]).toEqual({ kind: 'row', bar: '1', chord: 'Cm7', scale: 'C Aeolian' })
    expect(doc.lines[4]).toMatchObject({ scale: '' })
    expect(setRowField(doc, 5, 'chord', 'X')).toBe(doc)
  })

  it('inserts rows that take the bar above, in its section, and removes lines', () => {
    const next = insertRowAfter(doc, 6)
    expect(next.lines[7]).toEqual({ kind: 'row', bar: '2', chord: '', scale: '' })
    expect(insertRowAfter(parseChart('').value, -1).lines).toEqual([
      { kind: 'section', name: 'A' },
      { kind: 'row', bar: '1', chord: '', scale: '' },
    ])
    expect(insertRowAfter(parseChart('title: T\n').value, 0).lines.slice(1)).toEqual([
      { kind: 'section', name: 'A' },
      { kind: 'row', bar: '1', chord: '', scale: '' },
    ])
    expect(removeLine(doc, 5).lines.map((l) => l.kind)).toEqual(['meta', 'blank', 'section', 'sectionMeta', 'row', 'row'])
  })

  it('sets meta in place or inserts it at the top', () => {
    expect(chartMeta(setMeta(doc, 'title', 'New')).title).toBe('New')
    const withSub = setMeta(doc, 'subtitle', 'S')
    expect(serializeChart(withSub).split('\n').slice(0, 2)).toEqual(['title: T', 'subtitle: S'])
    expect(setMeta(parseChart('section: A\n1 | C').value, 'title', 'X').lines[0]).toEqual({ kind: 'meta', key: 'title', value: 'X' })
  })
})

describe('chord changes and comparing charts', () => {
  const doc = (rows: string) => parseChart(`section: A\n${rows}`).value
  const rowOf = (d: ChartDoc) => d.lines.find((l) => l.kind === 'row')

  it('moves a default scale to the new chord, and keeps one you chose', () => {
    expect(rowOf(setRowChord(doc('1 | Cm7 | C Dorian\n'), 1, 'F7'))).toMatchObject({ chord: 'F7', scale: 'F Mixolydian' })
    expect(rowOf(setRowChord(doc('1 | Cm7 | C Aeolian\n'), 1, 'F7'))).toMatchObject({ scale: 'C Aeolian' })
    expect(rowOf(setRowChord(doc('1 | Cm7\n'), 1, 'F7'))).toMatchObject({ scale: '' }) // empty stays empty: still the default
    expect(rowOf(setRowChord(doc('1 | Cm7 | C Dorian\n'), 1, 'Cm7#5#9x'))).toMatchObject({ scale: 'C Dorian' }) // unknown: kept
  })

  it('drops a written function the new chord no longer plays (#492), and keeps it when the chord plays as before', () => {
    expect(rowOf(setRowChord(doc('1 | A7 |  | V7/ii\n'), 1, 'Eb7'))).not.toHaveProperty('function')
    expect(rowOf(setRowChord(doc('1 | Cm7 |  | ii\n'), 1, 'C7'))).not.toHaveProperty('function')
    expect(rowOf(setRowChord(doc('1 | Cm7 |  | ii\n'), 1, 'Cm9'))).toMatchObject({ chord: 'Cm9', function: 'ii' })
  })

  it('follows a default written on an enharmonic root to the new chord (R18: F# Whole-Half on Gbdim7)', () => {
    expect(rowOf(setRowChord(doc('1 | Gbdim7 | F# Whole-Half Diminished\n'), 1, 'Cm7'))).toMatchObject({ chord: 'Cm7', scale: 'C Dorian' })
    expect(rowOf(setRowChord(doc('1 | Gbdim7 | G Whole-Half Diminished\n'), 1, 'Cm7'))).toMatchObject({ scale: 'G Whole-Half Diminished' })
  })

  it('treats charts as the same when only spacing or how a scale is named differs', () => {
    const a = (rows: string) => `section: A\n${rows}`
    expect(sameChart(a('1 | Cm7 | C Dorian\n'), a('1  |  Cm7  | C Dorian\n'))).toBe(true)
    expect(sameChart(a('1 | Cm7 | C Dorian\n'), a('1 | Cm7\n'))).toBe(false) // a written scale pins it; a blank plays the analysis
    expect(sameChart(a('6 | D7 | D Half-Whole\n'), a('6 | D7 | D Half-Whole Diminished\n'))).toBe(true)
    expect(sameChart(a('2 | Abm7\nalt 2 | Abm7 | Ab Half-Whole\n'), a('2 | Abm7\nalt 2 | Abm7 | Ab Half-Whole Diminished\n'))).toBe(true)
    expect(sameChart(a('1 | Cm7 | C Dorian\n'), a('1 | Cm7 | C Aeolian\n'))).toBe(false)
    expect(sameChart('# note\n\nsection: A\n1 | Cm7\n', a('1 | Cm7\n'))).toBe(false) // comments count
  })
})

describe('the function cell', () => {
  it('sets a function, and clearing it drops the function cell', () => {
    const set = setRowField(parseChart('section: A\n1 | D7\n').value, 1, 'function', 'V7/V')
    expect(serializeChart(set)).toBe('section: A\n1 | D7 |  | V7/V\n')
    const cleared = setRowField(set, 1, 'function', '')
    expect(cleared.lines[1]).not.toHaveProperty('function')
    expect(serializeChart(cleared)).toBe('section: A\n1 | D7\n')
  })

  it('keeps the function when the scale is cleared', () => {
    const doc = parseChart('section: A\n1 | D7 | D Mixolydian | V7/V\n').value
    expect(serializeChart(setRowField(doc, 1, 'scale', ''))).toBe('section: A\n1 | D7 |  | V7/V\n')
  })
})

describe('an altRow', () => {
  const d = parseChart('section: A\n2 | Dm7\nalt 2 | Abm7\n').value
  const i = d.lines.findIndex((l) => l.kind === 'altRow')

  it('takes a scale and a function, keeping its kind', () => {
    expect(serializeChart(setRowField(d, i, 'scale', 'Ab Dorian'))).toContain('alt 2 | Abm7 | Ab Dorian')
    expect(serializeChart(setRowField(d, i, 'function', 'ii'))).toBe('section: A\n2 | Dm7\nalt 2 | Abm7 |  | ii\n')
    expect(setRowField(d, i, 'scale', 'Ab Dorian').lines[i]?.kind).toBe('altRow')
  })

  it('setRowChord keeps its kind, and a default scale follows the chord', () => {
    const e = parseChart('section: A\n2 | Dm7\nalt 2 | Abm7 | Ab Dorian\n').value
    expect(setRowChord(e, i, 'Db7').lines[i]).toMatchObject({ kind: 'altRow', chord: 'Db7', scale: 'Db Mixolydian' })
  })
})

describe('key changes', () => {
  it('states a key on a section’s bar 1 as its key:, and changes it', () => {
    const doc = parseChart('section: A\nbars: 8\n1 | Cm7\n\nsection: B\nbars: 4\n1 | DMaj7\n').value
    const added = insertKeyBefore(doc, 6, 'D')
    expect(serializeChart(added)).toBe('section: A\nbars: 8\n1 | Cm7\n\nsection: B\nkey: D\nbars: 4\n1 | DMaj7\n')
    expect(serializeChart(setKeyLine(added, 5, 'Eb'))).toBe('section: A\nbars: 8\n1 | Cm7\n\nsection: B\nkey: Eb\nbars: 4\n1 | DMaj7\n')
  })

  it('states a key on a later bar as an @key above the row, and changes it', () => {
    const doc = parseChart('section: A\n1 | C\n2 | F\n').value
    const added = insertKeyBefore(doc, 2, 'F')
    expect(serializeChart(added)).toBe('section: A\n1 | C\n@key 2 F\n2 | F\n')
    expect(serializeChart(setKeyLine(added, 2, 'Bb'))).toBe('section: A\n1 | C\n@key 2 Bb\n2 | F\n')
  })

  it('leaves the doc alone for a line that is not a row, or a bar that is not a whole number', () => {
    const doc = parseChart('# note\nsection: A\n1a | Cm7\n').value
    expect(insertKeyBefore(doc, 0, 'D')).toBe(doc)
    expect(insertKeyBefore(doc, 2, 'D')).toBe(doc)
    expect(setKeyLine(doc, 2, 'D')).toBe(doc)
  })
})

describe('clearMeta', () => {
  it('removes the line, and leaves a chart without one as it is', () => {
    const doc = parseChart('title: T\ncontext: blues\nkey: F\n').value
    expect(serializeChart(clearMeta(doc, 'context'))).not.toMatch(/context:/)
    const none = parseChart('title: T\nkey: F\n').value
    expect(clearMeta(none, 'context')).toBe(none)
  })
})
