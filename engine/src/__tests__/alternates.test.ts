import { describe, expect, it } from 'vitest'
import { expandRowLines, expandRows, parseChart } from '../chart'
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
