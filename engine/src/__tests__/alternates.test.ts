import { describe, expect, it } from 'vitest'
import { type ChartDoc, expandRowLines, expandRows, parseChart, serializeChart } from '../chart'
import { altBarChords, setAltBarChords, setBarChords, setBarChordsIn, setLineChord, setLineChordIn } from '../edit'
import { CHANGES_SETS, changesFor, isChangesSet } from '../alternates'
import { chordPositions } from '../changes'
import { sectionLayout } from '../layout'

const doc = (text: string) => parseChart(text).value
const chords = (d: ReturnType<typeof doc>) => expandRows(d).value.map((r) => r.chord)
const BASE = 'section: A\n1 | C\n2 | Dm7\n2 | G7\nalt 2 | Abm7\nalt 2 | Db7\n3 | C\n'

describe('changesFor', () => {
  it('names the sets', () => {
    expect(CHANGES_SETS).toEqual(['standard', 'alternate'])
    expect(isChangesSet('alternate')).toBe(true)
    expect(isChangesSet('x')).toBe(false)
  })

  it('keeps the line count and returns a doc without alt rows as is', () => {
    const d = doc(BASE)
    for (const s of CHANGES_SETS) expect(changesFor(d, s).lines).toHaveLength(d.lines.length)
    const plain = doc('section: A\n1 | C\n')
    expect(changesFor(plain, 'alternate')).toBe(plain)
    expect(changesFor(plain, 'standard')).toBe(plain)
  })

  it('plays either set of a bar', () => {
    const d = doc(BASE)
    expect(chords(changesFor(d, 'alternate'))).toEqual(['C', 'Abm7', 'Db7', 'C'])
    expect(chords(changesFor(d, 'standard'))).toEqual(['C', 'Dm7', 'G7', 'C'])
  })

  it('works when the alt rows come before the bar’s main rows', () => {
    const d = doc('section: A\n1 | C\nalt 2 | Abm7\n2 | Dm7\n3 | C\n')
    expect(chords(changesFor(d, 'alternate'))).toEqual(['C', 'Abm7', 'C'])
    expect(chords(changesFor(d, 'standard'))).toEqual(['C', 'Dm7', 'C'])
  })

  it('adds a bar the standard changes hold through', () => {
    const d = doc('section: A\nbars: 3\n1 | C\nalt 2 | Db7\n3 | C\n')
    const bars = (s: 'standard' | 'alternate') => expandRows(changesFor(d, s)).value.map((r) => [r.chord, r.bar])
    expect(bars('alternate')).toEqual([['C', '1'], ['Db7', '2'], ['C', '3']])
    expect(bars('standard')).toEqual([['C', '1'], ['C', '3']])
  })

  it('does not match a bar in another section', () => {
    const d = doc('section: A\n1 | C\n2 | F\nsection: B\n1 | G7\nalt 2 | Eb7\n')
    expect(chords(changesFor(d, 'alternate'))).toEqual(['C', 'F', 'G7', 'Eb7'])
  })

  it('repeats the alternate rows in a copy', () => {
    const d = doc('section: A1\n1 | C\n2 | Dm7\nalt 2 | Abm7\nsection: A2\ncopy: A1\n')
    expect(chords(changesFor(d, 'alternate'))).toEqual(['C', 'Abm7', 'C', 'Abm7'])
    expect(chords(changesFor(d, 'standard'))).toEqual(['C', 'Dm7', 'C', 'Dm7'])
  })

  it('keeps section lengths with endings in both sets', () => {
    const d = doc('section: A\n1 | C\n2 | Dm7\nalt 2 | Abm7\n3 | G7\n4 | C\n@ending 1 3 3\n@ending 2 4 4\n')
    const lengths = (s: 'standard' | 'alternate') => [...sectionLayout(changesFor(d, s)).value.lengths]
    expect(lengths('alternate')).toEqual(lengths('standard'))
  })

  it('keeps chord positions on rows of the original doc', () => {
    const d = doc(BASE)
    for (const s of CHANGES_SETS) {
      const c = changesFor(d, s)
      const rows = expandRowLines(c).value
      for (const i of chordPositions(c).keys()) {
        const line = rows[i]!.line
        expect(['row', 'altRow']).toContain(d.lines[line]!.kind)
        expect(c.lines[line]!.kind).toBe('row')
      }
    }
  })
})

describe('setAltBarChords', () => {
  const text = (d: ChartDoc) => serializeChart(d)
  const lineOf = (d: ChartDoc, bar: string) => d.lines.findIndex((l) => l.kind === 'row' && l.bar === bar)

  it('adds an alternate', () => {
    const d = setAltBarChords(doc(BASE), 'A', 3, ['Ebmaj7'])
    expect(text(d)).toContain('3 | C\nalt 3 | Ebmaj7')
    expect(altBarChords(d, 'A', 3)).toEqual(['Ebmaj7'])
    expect(altBarChords(doc(BASE), 'A', 3)).toEqual([])
  })

  it('replaces and removes', () => {
    const one = setAltBarChords(doc(BASE), 'A', 2, ['Abm7'])
    expect(one.lines.filter((l) => l.kind === 'altRow')).toHaveLength(1)
    expect(altBarChords(one, 'A', 2)).toEqual(['Abm7'])
    expect(setAltBarChords(doc(BASE), 'A', 2, []).lines.filter((l) => l.kind === 'altRow')).toHaveLength(0)
  })

  it('same as played: no alt rows', () => {
    const d = doc(BASE)
    expect(setAltBarChords(d, 'A', 1, ['C'])).toEqual(d)
  })

  it('keeps an alt that stops a carry', () => {
    const d = doc('section: A\nbars: 2\n1 | Cmaj7\nalt 1 | Dm7\n')
    expect(altBarChords(setAltBarChords(d, 'A', 2, ['Cmaj7']), 'A', 2)).toEqual(['Cmaj7'])
  })

  it('copy sections refused', () => {
    const d = doc('section: A1\n1 | C\nsection: A2\ncopy: A1\n')
    expect(setAltBarChords(d, 'A2', 1, ['D'])).toBe(d)
  })

  it('setLineChordIn alternate on a shared bar', () => {
    const d = doc(BASE)
    const e = setLineChordIn(d, 'alternate', lineOf(d, '3'), 'E7')
    expect(text(e)).toContain('3 | C\nalt 3 | E7')
  })

  it('setLineChordIn standard', () => {
    const d = doc(BASE)
    const i = lineOf(d, '3')
    expect(setLineChordIn(d, 'standard', i, 'E7')).toEqual(setLineChord(d, i, 'E7'))
  })

  it('setLineChordIn alternate: empty on a shared bar is a no-op', () => {
    const d = doc(BASE)
    expect(setLineChordIn(d, 'alternate', lineOf(d, '3'), '')).toBe(d)
  })

  it('% copies the set’s bar before', () => {
    const d = doc(BASE)
    const e = setLineChordIn(d, 'alternate', lineOf(d, '3'), '%')
    expect(altBarChords(e, 'A', 3)).toEqual(['Abm7', 'Db7'])
  })

  it('setBarChordsIn routes by set', () => {
    const d = doc(BASE)
    expect(setBarChordsIn(d, 'standard', 'A', 3, ['F'])).toEqual(setBarChords(d, 'A', 3, ['F']))
    expect(setBarChordsIn(d, 'alternate', 'A', 3, ['F'])).toEqual(setAltBarChords(d, 'A', 3, ['F']))
  })

  it('an alternate takes the scale and function of the chord it replaces', () => {
    const d = doc('section: A\n1 | Dm7 | D Dorian\n')
    expect(text(setAltBarChords(d, 'A', 1, ['Dm7']))).not.toContain('alt')
    const e = setAltBarChords(d, 'A', 1, ['Em7'])
    const alt = e.lines.find((l) => l.kind === 'altRow')
    expect(alt && alt.kind === 'altRow' && alt.scale).toBe('E Dorian')
  })
})
