import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { changesFor } from '../alternates'
import { barView } from '../bars'
import { type ChartDoc, parseChart, serializeChart } from '../chart'
import { parseBarLine } from '../barLine'
import { addSection, deleteBar, insertBar, insertBars, insertHeldBar, renameSection, repeatSection, setBarChords, setEnding, setBarMetre, setLineChord, setMark, setNav, splitSection, toggleEnding, writeOutCopy } from '../edit'

const chart = (name: string): ChartDoc => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
/** the chart's lines as text, without the column padding */
const out = (doc: ChartDoc): string[] =>
  serializeChart(doc)
    .trimEnd()
    .split('\n')
    .map((l) => l.replace(/ +\| +/g, ' | ').replace(/ {2,}#/, '  #'))
/** each section as [name, first bar, last bar] */
const spans = (doc: ChartDoc) => barView(doc).sections.map((s) => [s.name, s.bars[0]?.bar, s.bars.at(-1)?.bar])
const copyLine = (doc: ChartDoc) => doc.lines.find((l) => l.kind === 'sectionMeta' && l.field === 'copy')

// A: four bars; B: three, its bar 2 held
const small = text(['section: A', '1 | C', '2 | F', '3 | G', '4 | C', 'section: B', '1 | Dm7', '3 | G7'])

describe('insertBar', () => {
  it('inserts a held bar and moves the later bars of its section only', () => {
    expect(out(insertBar(small, 'A', 2))).toEqual(['section: A', '1 | C', '3 | F', '4 | G', '5 | C', 'section: B', '1 | Dm7', '3 | G7'])
  })

  it('adds a held bar at the end of a section, counted through bars:', () => {
    expect(out(insertBar(small, 'A', 5))).toEqual(['section: A', 'bars: 5', '1 | C', '2 | F', '3 | G', '4 | C', 'section: B', '1 | Dm7', '3 | G7'])
    expect(spans(insertBar(small, 'A', 5))).toEqual([
      ['A', 1, 5],
      ['B', 1, 3],
    ])
  })

  it('writes the chords it is given into the new bar', () => {
    expect(out(insertBar(small, 'B', 1, ['Em7', 'A7'])).slice(5)).toEqual(['section: B', '1 | Em7', '1 | A7', '2 | Dm7', '4 | G7'])
    expect(out(insertBar(small, 'A', 5, ['E7'])).slice(0, 7)).toEqual(['section: A', '1 | C', '2 | F', '3 | G', '4 | C', '5 | E7', 'section: B'])
  })

  it("won't start a section with an empty bar", () => {
    expect(insertBar(small, 'B', 1)).toBe(small)
  })

  it('refuses a bar the section does not have, a section that is not there, and chords that would not read back', () => {
    expect(insertBar(small, 'A', 6)).toBe(small)
    expect(insertBar(small, 'C', 1)).toBe(small)
    expect(insertBar(small, 'A', 2, ['C|7'])).toBe(small)
  })

  it('moves the directives after the bar in its section, and none before it or in other sections', () => {
    const doc = text(['section: A', '@segno 2', '1 | C', '2 | F', '@key 1 C', 'section: B', '@key 1 F', '@context 2 modal', '1 | Gm7', '2 | C7', '@coda 2', '@nav 2 D.S. al Coda'])
    expect(out(insertBar(doc, 'A', 2))).toEqual(['section: A', '@segno 3', '1 | C', '3 | F', '@key 1 C', 'section: B', '@key 1 F', '@context 2 modal', '1 | Gm7', '2 | C7', '@coda 2', '@nav 2 D.S. al Coda'])
  })

  it('grows an ending it lands inside, and moves one after it', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '5 | C', '@ending 1 2 3', '@ending 2 4 5'])
    expect(out(insertBar(doc, 'A', 3)).slice(-2)).toEqual(['@ending 1 2 4', '@ending 2 5 6'])
    expect(out(insertBar(doc, 'A', 2, ['Dm7'])).slice(-2)).toEqual(['@ending 1 3 4', '@ending 2 5 6'])
  })

  it('leaves an intro, the form and a coda numbered on their own', () => {
    const doc = text(['section: Intro', '1 | C', '2 | G7', 'section: A', '1 | C', '2 | F', '@key 2 F', 'section: Coda', '1 | C', '@coda 1'])
    expect(out(insertBar(doc, 'Intro', 2))).toEqual(['section: Intro', '1 | C', '3 | G7', 'section: A', '1 | C', '2 | F', '@key 2 F', 'section: Coda', '1 | C', '@coda 1'])
  })

  it('keeps comments, functions and scales on the rows it moves', () => {
    const doc = text(['section: A', '1 | C', '2 | D7 | D Mixolydian | V7/V  # secondary dominant'])
    expect(insertBar(doc, 'A', 2).lines[2]).toEqual({ kind: 'row', bar: '3', chord: 'D7', scale: 'D Mixolydian', function: 'V7/V', comment: 'secondary dominant' })
  })

  it('adds the bar to every repeat of the section (Autumn Leaves)', () => {
    const doc = insertBar(chart('autumn-leaves'), 'A1', 3)
    expect(spans(doc)).toEqual([
      ['A1', 1, 9],
      ['A2', 1, 9],
      ['B', 1, 16],
    ])
    expect(copyLine(doc)).toEqual(copyLine(chart('autumn-leaves')))
    const a2 = barView(doc).sections[1]?.bars ?? []
    expect(a2.map((b) => b.kind)).toEqual(['chords', 'chords', 'held', 'chords', 'chords', 'chords', 'chords', 'chords', 'chords'])
  })

  it('adds the bar to a repeat of a repeat', () => {
    const doc = text(['section: A1', '1 | C', '2 | G7', 'section: A2', 'copy: A1', 'section: A3', 'copy: A2', 'section: B', '1 | F'])
    expect(out(insertBar(doc, 'A1', 2)).slice(0, 3)).toEqual(['section: A1', '1 | C', '3 | G7'])
    expect(spans(insertBar(doc, 'A1', 2))).toEqual([
      ['A1', 1, 3],
      ['A2', 1, 3],
      ['A3', 1, 3],
      ['B', 1, 1],
    ])
  })

  it('keeps a repeat’s own key: on its bar 1 (Wave)', () => {
    const keyed = (doc: ChartDoc) => barView(doc).sections.find((s) => s.name === 'C')?.bars.find((b) => b.key)
    expect(keyed(insertBar(chart('wave'), 'A1', 2))).toMatchObject({ bar: 1, key: keyed(chart('wave'))?.key })
  })

  it('leaves a repeat alone when the bar goes in another section', () => {
    const doc = insertBar(chart('autumn-leaves'), 'B', 4)
    expect(copyLine(doc)).toEqual(copyLine(chart('autumn-leaves')))
    expect(spans(doc).slice(0, 2)).toEqual(spans(chart('autumn-leaves')).slice(0, 2))
  })

  it('edits written sections only: a repeat is changed through the section it repeats', () => {
    const doc = chart('autumn-leaves')
    expect(insertBar(doc, 'A2', 2)).toBe(doc)
  })
})

describe('insertBars', () => {
  it('inserts the bars in order before a bar, moving the later bars along', () => {
    expect(out(insertBars(small, 'A', 2, [['Dm7'], ['G7']])).slice(0, 7)).toEqual(['section: A', '1 | C', '2 | Dm7', '3 | G7', '4 | F', '5 | G', '6 | C'])
  })

  it('leaves an empty bar held, and counts it', () => {
    expect(out(insertBars(small, 'A', 2, [['Dm7', 'G7'], []])).slice(0, 5)).toEqual(['section: A', '1 | C', '2 | Dm7', '2 | G7', '4 | F'])
    expect(spans(insertBars(small, 'A', 2, [['Dm7', 'G7'], []]))[0]).toEqual(['A', 1, 6])
  })

  it('appends after the last bar of a section, a held bar and all', () => {
    expect(out(insertBars(small, 'B', 4, [['C'], [], ['F']])).slice(5)).toEqual(['section: B', '1 | Dm7', '3 | G7', '4 | C', '6 | F'])
  })

  it('takes what parseBarLine reads, a held bar at the end through bars:', () => {
    expect(out(insertBars(small, 'A', 5, parseBarLine('| E7 | % |').value)).slice(0, 8)).toEqual(['section: A', 'bars: 6', '1 | C', '2 | F', '3 | G', '4 | C', '5 | E7', 'section: B'])
  })

  it('refuses them all if one would be refused: a held bar starting a section, a chord that would not read back', () => {
    expect(insertBars(small, 'B', 1, [[], ['C']])).toBe(small)
    expect(insertBars(small, 'A', 2, [['C'], ['C|7']])).toBe(small)
    expect(insertBars(small, 'A', 9, [['C']])).toBe(small)
    expect(insertBars(small, 'A', 2, [])).toBe(small)
  })
})

describe('deleteBar', () => {
  it('removes a bar with its chords and moves the later bars of its section back', () => {
    expect(out(deleteBar(small, 'A', 2))).toEqual(['section: A', '1 | C', '2 | G', '3 | C', 'section: B', '1 | Dm7', '3 | G7'])
  })

  it('removes a held bar, moving the later bars back', () => {
    expect(out(deleteBar(small, 'B', 2)).slice(5)).toEqual(['section: B', '1 | Dm7', '2 | G7'])
  })

  it('removes the last written bar, and a held bar past it, keeping the length where it should', () => {
    expect(out(deleteBar(text(['section: A', 'bars: 4', '1 | C', '3 | F']), 'A', 4))).toEqual(['section: A', '1 | C', '3 | F'])
    expect(out(deleteBar(text(['section: A', 'bars: 4', '1 | C', '3 | F']), 'A', 3))).toEqual(['section: A', 'bars: 3', '1 | C'])
  })

  it('removes the marks on the bar, and moves its key change to the bar after', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '3 | Bb', '@key 2 F', '@segno 2', '@nav 2 Fine', '@coda 3'])
    expect(out(deleteBar(doc, 'A', 2))).toEqual(['section: A', '1 | C', '2 | Bb', '@key 2 F', '@coda 2'])
  })

  it("drops a key change on the section's last bar, and one where the next bar has its own", () => {
    const last = text(['section: A', '1 | C', '2 | F', '@key 2 F', 'section: B', '1 | C'])
    expect(out(deleteBar(last, 'A', 2))).toEqual(['section: A', '1 | C', 'section: B', '1 | C'])
    const both = text(['section: A', '1 | C', '2 | F', '3 | Bb', '@key 2 F', '@key 3 Bb'])
    expect(out(deleteBar(both, 'A', 2))).toEqual(['section: A', '1 | C', '2 | Bb', '@key 2 Bb'])
  })

  it('shrinks an ending, and removes one that was only this bar', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '5 | C', '@ending 1 2 3', '@ending 2 4'])
    expect(out(deleteBar(doc, 'A', 2)).slice(-2)).toEqual(['@ending 1 2', '@ending 2 3'])
    expect(out(deleteBar(doc, 'A', 4)).slice(-2)).toEqual(['4 | C', '@ending 1 2 3'])
  })

  it('removes the bar from every repeat of the section (Autumn Leaves)', () => {
    expect(spans(deleteBar(chart('autumn-leaves'), 'A1', 3))).toEqual([
      ['A1', 1, 7],
      ['A2', 1, 7],
      ['B', 1, 16],
    ])
  })

  it("won't leave a section starting on a held bar, and won't edit a repeat", () => {
    expect(deleteBar(small, 'B', 1)).toBe(small)
    const doc = chart('autumn-leaves')
    expect(deleteBar(doc, 'A2', 1)).toBe(doc)
    expect(deleteBar(doc, 'A1', 12)).toBe(doc)
  })

  it('keeps a comment above the next section when it removes a section of one bar (review)', () => {
    expect(out(deleteBar(text(['section: A', '1 | C', 'section: T', '1 | G7', '# about B', 'section: B', '1 | C']), 'T', 1))).toEqual(['section: A', '1 | C', '# about B', 'section: B', '1 | C'])
  })

  it('removes a section of one bar, but not one a copy: repeats', () => {
    expect(out(deleteBar(text(['section: A', '1 | C', 'section: T', '1 | G7', 'section: B', '1 | C']), 'T', 1))).toEqual(['section: A', '1 | C', 'section: B', '1 | C'])
    const copied = text(['section: A', '1 | C', 'section: B', 'copy: A'])
    expect(deleteBar(copied, 'A', 1)).toBe(copied)
  })
})

describe('insertBar and deleteBar over the library', { timeout: 30_000 }, () => {
  const files = readdirSync('charts').filter((f) => f.endsWith('.txt'))

  it('place every line after an insert, and a delete of the same bar gives the chart back', () => {
    for (const file of files) {
      const doc = chart(file.replace(/\.txt$/, ''))
      for (const section of barView(doc).sections.filter((s) => !s.copy)) {
        const last = section.bars.length
        for (const at of new Set([2, Math.floor((1 + last) / 2), last, last + 1].filter((b) => b > 1))) {
          const inserted = insertBar(doc, section.name, at)
          expect([file, section.name, at, barView(inserted).unplaced]).toEqual([file, section.name, at, []])
          expect([file, section.name, at, serializeChart(deleteBar(inserted, section.name, at))]).toEqual([file, section.name, at, serializeChart(doc)])
        }
        const opened = insertBar(doc, section.name, 1, ['C'])
        expect([file, section.name, barView(opened).unplaced]).toEqual([file, section.name, []])
        expect([file, section.name, serializeChart(deleteBar(opened, section.name, 1))]).toEqual([file, section.name, serializeChart(doc)])
      }
    }
  })

  it('write out every repeat to the same bars and chords', () => {
    const played = (d: ChartDoc) => barView(d).sections.map((s) => [s.name, s.bars.map((b) => [b.bar, b.kind, b.chords.map((c) => c.chord)])])
    for (const file of files) {
      const doc = chart(file.replace(/\.txt$/, ''))
      for (const section of barView(doc).sections.filter((s) => s.copy)) {
        const written = writeOutCopy(doc, section.name)
        expect([file, section.name, played(written), barView(written).unplaced]).toEqual([file, section.name, played(doc), barView(doc).unplaced])
      }
    }
  })
})

describe('setBarChords', () => {
  it("replaces a bar's chords, a changed chord taking its scale as setRowChord does", () => {
    const doc = text(['section: A', '1 | Cm7 | C Dorian  # ii', '2 | F7 | F Mixolydian', '3 | Bb'])
    expect(out(setBarChords(doc, 'A', 1, ['Cm7', 'F7']))).toEqual(['section: A', '1 | Cm7 | C Dorian  # ii', '1 | F7', '2 | F7 | F Mixolydian', '3 | Bb'])
    expect(out(setBarChords(doc, 'A', 2, ['B7']))[2]).toBe('2 | B7 | B Mixolydian')
    expect(out(setBarChords(doc, 'A', 2, ['Gm7', 'C7'])).slice(2, 4)).toEqual(['2 | Gm7 | G Dorian', '2 | C7'])
  })

  it('writes chords into a held bar, between the bars around it', () => {
    expect(out(setBarChords(text(['section: A', '1 | C', '3 | F']), 'A', 2, ['Dm7', 'G7']))).toEqual(['section: A', '1 | C', '2 | Dm7', '2 | G7', '3 | F'])
  })

  it('empties a bar into a held one, but not the first bar of a section; the section keeps its length', () => {
    expect(out(setBarChords(small, 'A', 2, []))).toEqual(['section: A', '1 | C', '3 | G', '4 | C', 'section: B', '1 | Dm7', '3 | G7'])
    expect(out(setBarChords(small, 'A', 4, [])).slice(0, 2)).toEqual(['section: A', 'bars: 4'])
    expect(setBarChords(small, 'B', 1, [])).toBe(small)
  })

  it('returns the same doc for no change, a repeat, a missing bar or a chord that would not read back', () => {
    expect(setBarChords(small, 'A', 1, ['C'])).toBe(small)
    expect(setBarChords(small, 'A', 9, ['C'])).toBe(small)
    expect(setBarChords(small, 'A', 1, ['#x'])).toBe(small)
    const doc = chart('autumn-leaves')
    expect(setBarChords(doc, 'A2', 1, ['C'])).toBe(doc)
  })
})

describe('sections', () => {
  it('renames a section on its section: line and every copy: of it', () => {
    const doc = text(['section: A', 'key: C', '1 | C', '@ending 1 1', '@segno 1', '@nav 1 Fine', 'section: A2', 'copy: A'])
    expect(out(renameSection(doc, 'A', 'A1'))).toEqual(['section: A1', 'key: C', '1 | C', '@ending 1 1', '@segno 1', '@nav 1 Fine', 'section: A2', 'copy: A1'])
    expect(out(renameSection(doc, 'A2', 'A3'))[6]).toBe('section: A3')
  })

  it("refuses a name that is taken, has spaces, wouldn't read back, or moves the section in or out of the form", () => {
    const doc = text(['section: A', '1 | C', 'section: B', '1 | F'])
    for (const name of ['B', 'A 2', '', '#A', 'Coda']) expect(renameSection(doc, 'A', name)).toBe(doc)
    expect(renameSection(doc, 'X', 'Y')).toBe(doc)
  })

  it('renames an outside: section to any name', () => {
    const doc = text(['section: Vamp', 'outside: yes', '1 | Dm7', 'section: A', '1 | C'])
    expect(out(renameSection(doc, 'Vamp', 'Groove'))[0]).toBe('section: Groove')
  })

  it('adds a section at the end of its part: the form after its last section, an intro before it, a coda last', () => {
    const doc = text(['title: T', '', 'section: A', '1 | C', '4 | G7', '', 'section: A2', 'copy: A', '', 'section: Coda', '1 | C'])
    expect(out(addSection(doc, 'B', ['F']))).toEqual(['title: T', '', 'section: A', '1 | C', '4 | G7', '', 'section: A2', 'copy: A', '', 'section: B', '1 | F', '', 'section: Coda', '1 | C'])
    expect(out(addSection(doc, 'Intro', ['G7'])).slice(0, 5)).toEqual(['title: T', '', 'section: Intro', '1 | G7', ''])
    expect(out(addSection(doc, 'Tag', ['C'])).slice(-2)).toEqual(['section: Tag', '1 | C'])
    expect(out(addSection(text(['title: T']), 'A', ['C']))).toEqual(['title: T', '', 'section: A', '1 | C'])
  })

  it('refuses a section that is there already, a bad name, or no chords', () => {
    expect(addSection(small, 'A', ['C'])).toBe(small)
    expect(addSection(small, 'C 2', ['C'])).toBe(small)
    expect(addSection(small, 'C', [])).toBe(small)
  })

  it('repeats a section with copy:, after the last section of its part', () => {
    const doc = repeatSection(chart('autumn-leaves'), 'A1', 'A3')
    expect(out(doc).slice(-2)).toEqual(['section: A3', 'copy: A1'])
    expect(spans(doc).at(-1)).toEqual(['A3', 1, 8])
    expect(barView(doc).sections.at(-1)?.copy).toMatchObject({ of: 'A1' })
    expect(barView(doc).unplaced).toEqual([])
  })

  it('repeats an outside: yes section under any name, outside the form too (review)', () => {
    const d = repeatSection(text(['section: Vamp', 'outside: yes', '1 | Dm7', 'section: A', '1 | C']), 'Vamp', 'Vamp2')
    expect(out(d)).toContain('section: Vamp2')
    expect(barView(d).sections.find((x) => x.name === 'Vamp2')?.part).toBe('before')
  })

  it('refuses to repeat a missing section, or into a name that is taken', () => {
    expect(repeatSection(small, 'C', 'D')).toBe(small)
    expect(repeatSection(small, 'A', 'B')).toBe(small)
  })
})

describe('endings, marks and nav', () => {
  const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', 'section: B', '1 | F'])

  it('sets an ending on bars of a section, at the end of its block, replaces it, and clears it', () => {
    const one = setEnding(doc, 'A', 1, { from: 2, to: 3 })
    expect(out(one)).toEqual([...out(doc).slice(0, 5), '@ending 1 2 3', 'section: B', '1 | F'])
    expect(out(setEnding(one, 'A', 1, { from: 3, to: 3 }))[5]).toBe('@ending 1 3')
    expect(out(setEnding(one, 'A', 1, null))).toEqual(out(doc))
  })

  it('refuses an ending off the section or over the other ending', () => {
    const one = setEnding(doc, 'A', 1, { from: 2, to: 3 })
    expect(setEnding(doc, 'A', 1, { from: 4, to: 5 })).toBe(doc)
    expect(setEnding(one, 'A', 2, { from: 3, to: 4 })).toBe(one)
    expect(out(setEnding(one, 'A', 2, { from: 4, to: 4 }))[6]).toBe('@ending 2 4')
  })

  it('turns a segno or coda on a bar on and off', () => {
    const on = setMark(doc, 'B', 1, 'segno', true)
    expect(out(on).at(-1)).toBe('@segno 1')
    expect(setMark(on, 'B', 1, 'segno', true)).toBe(on)
    expect(out(setMark(on, 'B', 1, 'segno', false))).toEqual(out(doc))
    expect(setMark(doc, 'B', 9, 'coda', true)).toBe(doc)
  })

  it('takes a mark off its own section only', () => {
    const both = setMark(setMark(doc, 'A', 1, 'segno', true), 'B', 1, 'segno', true)
    expect(out(setMark(both, 'A', 1, 'segno', false)).filter((l) => l.startsWith('@'))).toEqual(['@segno 1'])
    expect(barView(setMark(both, 'A', 1, 'segno', false)).sections[1]?.bars[0]?.marks).toHaveLength(1)
  })

  it("sets a bar's nav text, replaces it, and clears it with ''", () => {
    const on = setNav(doc, 'A', 4, 'D.C. al Fine')
    expect(barView(on).sections[0]?.bars[3]?.nav).toMatchObject([{ text: 'D.C. al Fine' }])
    expect(barView(setNav(on, 'A', 4, 'Fine')).sections[0]?.bars[3]?.nav).toMatchObject([{ text: 'Fine' }])
    expect(out(setNav(on, 'A', 4, ''))).toEqual(out(doc))
    expect(setNav(doc, 'A', 4, 'a|b')).toBe(doc)
  })
})

describe('insertHeldBar', () => {
  it('puts in a held bar, moving the later bars along', () => {
    expect(out(insertHeldBar(small, 'A', 3)).slice(0, 5)).toEqual(['section: A', '1 | C', '2 | F', '4 | G', '5 | C'])
    expect(spans(insertHeldBar(small, 'A', 5))).toEqual([
      ['A', 1, 5],
      ['B', 1, 3],
    ])
  })

  it("holds the chord on at a part's end, the section a bar longer", () => {
    const doc = text(['section: A', '1 | C', '2 | F', '3 | G', '4 | C7'])
    expect(out(insertHeldBar(doc, 'A', 5))).toEqual(['section: A', 'bars: 5', '1 | C', '2 | F', '3 | G', '4 | C7'])
    expect(spans(insertHeldBar(doc, 'A', 5))).toEqual([['A', 1, 5]])
  })

  it("won't go before a section's first bar or past its end", () => {
    expect(insertHeldBar(small, 'B', 1)).toBe(small)
    expect(insertHeldBar(small, 'A', 9)).toBe(small)
  })
})

describe('writeOutCopy', () => {
  it('turns a repeat into written rows of its own, in its place', () => {
    const doc = text(['section: A', '1 | C | C Ionian', '2 | G7 |  | V7', 'section: A2', 'copy: A', 'section: B', '1 | F'])
    const written = writeOutCopy(doc, 'A2')
    expect(written.lines.slice(3, 6)).toEqual([
      { kind: 'section', name: 'A2' },
      { kind: 'row', bar: '1', chord: 'C', scale: 'C Ionian' },
      { kind: 'row', bar: '2', chord: 'G7', scale: '', function: 'V7' },
    ])
    expect(barView(written).sections[1]?.copy).toBeNull()
  })

  it('writes out what the copy carried: its key, length and key changes', () => {
    const doc = text(['section: A', 'key: Eb', 'bars: 4', '1 | Cm7', '@key 2 Bb', '2 | F7', 'section: B', 'copy: A'])
    expect(out(writeOutCopy(doc, 'B')).slice(6)).toEqual(['section: B', 'key: Eb', 'bars: 4', '1 | Cm7', '2 | F7', '@key 2 Bb'])
  })

  it('keeps a later repeat of the repeat playing the same bars', () => {
    const doc = text(['section: A', '1 | C', '2 | G7', 'section: A2', 'copy: A', 'section: A3', 'copy: A2'])
    const chords = (d: ChartDoc) => barView(d).sections.flatMap((s) => s.bars.map((b) => b.chords.map((c) => c.chord).join()))
    expect(chords(writeOutCopy(doc, 'A2'))).toEqual(chords(doc))
  })

  it('refuses a section that is not a repeat', () => {
    expect(writeOutCopy(small, 'A')).toBe(small)
    expect(writeOutCopy(small, 'Z')).toBe(small)
  })
})

describe('splitSection', () => {
  const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '@key 3 G', '@segno 4', '@ending 1 1 2', 'section: B', '1 | F'])

  it('starts a new section at a bar, numbered from 1, with the bars’ marks and the key stated there', () => {
    expect(out(splitSection(doc, 'A', 3, 'A2'))).toEqual(['section: A', '1 | C', '2 | F', '@ending 1 1 2', '', 'section: A2', 'key: G', '1 | G7', '2 | C', '@segno 2', 'section: B', '1 | F'])
    expect(spans(splitSection(doc, 'A', 3, 'A2'))).toEqual([
      ['A', 1, 2],
      ['A2', 1, 2],
      ['B', 1, 1],
    ])
  })

  it('splits the length between the two', () => {
    expect(spans(splitSection(text(['section: A', 'bars: 8', '1 | C', '5 | F']), 'A', 5, 'B'))).toEqual([
      ['A', 1, 4],
      ['B', 1, 4],
    ])
  })

  it('carries the context in force and outside: yes to the new section (review)', () => {
    const d = splitSection(text(['section: V', 'outside: yes', 'context: modal', '1 | C', '@context 3 blues', '3 | F', '5 | G']), 'V', 5, 'V2')
    expect(out(d).slice(-4)).toEqual(['section: V2', 'context: blues', 'outside: yes', '1 | G'])
  })

  it("refuses the section's first bar, a held bar, a name in use or of another part, an ending across the split, or a section another repeats", () => {
    const held = text(['section: A', '1 | C', '3 | G7', 'section: B', '1 | F'])
    expect(splitSection(doc, 'A', 1, 'A2')).toBe(doc)
    expect(splitSection(held, 'A', 2, 'A2')).toBe(held)
    expect(splitSection(doc, 'A', 3, 'B')).toBe(doc)
    expect(splitSection(doc, 'A', 3, 'Coda')).toBe(doc)
    expect(splitSection(doc, 'A', 2, 'A2')).toBe(doc)
    const repeated = text(['section: A', '1 | C', '2 | F', 'section: A2', 'copy: A'])
    expect(splitSection(repeated, 'A', 2, 'X')).toBe(repeated)
  })
})

describe('metre changes (#235)', () => {
  const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '@time 3 3/4', 'section: B', 'copy: A'])

  it('moves an @time with its bar, and onto the bar after when its bar goes', () => {
    expect(out(insertBar(doc, 'A', 2)).slice(0, 6)).toEqual(['section: A', '1 | C', '3 | F', '4 | G7', '5 | C', '@time 4 3/4'])
    expect(out(deleteBar(doc, 'A', 3)).slice(0, 5)).toEqual(['section: A', '1 | C', '2 | F', '3 | C', '@time 3 3/4'])
  })

  it('splits a section with the metre in force at the split', () => {
    const one = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '@time 3 3/4'])
    expect(out(splitSection(one, 'A', 4, 'A2'))).toEqual(['section: A', '1 | C', '2 | F', '3 | G7', '@time 3 3/4', '', 'section: A2', 'time: 3/4', '1 | C'])
    expect(out(splitSection(one, 'A', 3, 'A2'))).toEqual(['section: A', '1 | C', '2 | F', '', 'section: A2', 'time: 3/4', '1 | G7', '2 | C'])
  })

  it('writes out a copy with the metre changes it carried', () => {
    expect(out(writeOutCopy(doc, 'B')).slice(6)).toEqual(['section: B', '1 | C', '2 | F', '3 | G7', '4 | C', '@time 3 3/4'])
  })

  it('puts one bar in a metre, the bars after it keeping theirs', () => {
    const two = setBarMetre(doc, 'A', 2, '2/4')
    expect(barView(two).sections[0]?.bars.map((b) => b.beats)).toEqual([4, 2, 3, 3])
    expect(out(two).slice(5, 7)).toEqual(['@time 3 3/4', '@time 2 2/4'])
    const back = setBarMetre(two, 'A', 2, '4/4')
    expect(out(back)).toEqual(out(doc))
  })

  it('drops a change the bar before already makes, and writes a section’s bar 1 as its time:', () => {
    expect(out(setBarMetre(doc, 'A', 3, '4/4')).slice(0, 6)).toEqual(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', '@time 4 3/4'])
    expect(out(setBarMetre(setBarMetre(doc, 'A', 3, '4/4'), 'A', 4, '4/4')).slice(0, 6)).toEqual(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', 'section: B'])
    const waltz = setBarMetre(doc, 'A', 1, '3/4')
    expect(out(waltz).slice(0, 3)).toEqual(['section: A', 'time: 3/4', '1 | C'])
    expect(barView(waltz).sections[0]?.bars.map((b) => b.beats)).toEqual([3, 4, 3, 3])
  })

  it('refuses a metre it can’t read, the bar’s own metre, and a copy’s bar', () => {
    expect(setBarMetre(doc, 'A', 2, '7/8')).toBe(doc)
    expect(setBarMetre(doc, 'A', 2, '4/4')).toBe(doc)
    expect(setBarMetre(doc, 'B', 2, '3/4')).toBe(doc)
  })
})

describe('toggleEnding', () => {
  const doc = text(['section: A', '1 | C', '2 | F', '3 | G7', '4 | C', 'section: B', '1 | F'])

  it('puts an ending on a bar, grows it onto the bar next to it, and takes it off a bar inside it', () => {
    const one = toggleEnding(doc, 'A', 1, 2)
    expect(out(one)[5]).toBe('@ending 1 2')
    expect(out(toggleEnding(one, 'A', 1, 3))[5]).toBe('@ending 1 2 3')
    expect(out(toggleEnding(one, 'A', 1, 1))[5]).toBe('@ending 1 1 2')
    expect(out(toggleEnding(one, 'A', 1, 2))).toEqual(out(doc))
    expect(out(toggleEnding(one, 'A', 1, 4))[5]).toBe('@ending 1 4')
  })

  it('refuses an ending over the other one', () => {
    const one = toggleEnding(doc, 'A', 1, 2)
    expect(toggleEnding(one, 'A', 2, 2)).toBe(one)
  })
})

describe('setLineChord', () => {
  const doc = text(['section: A', '1 | Cm7 | C Dorian', '2 | F7', '2 | Bb7', '3 | Ebmaj7', 'section: B', 'copy: A'])

  it('replaces the chord written on a line, its scale following as setRowChord’s does', () => {
    expect(out(setLineChord(doc, 1, 'Dm7'))[1]).toBe('1 | Dm7 | D Dorian')
    expect(out(setLineChord(doc, 3, 'E7')).slice(2, 4)).toEqual(['2 | F7', '2 | E7'])
  })

  it('takes the chord out when cleared, but not a section’s first', () => {
    expect(out(setLineChord(doc, 3, ' ')).slice(2, 4)).toEqual(['2 | F7', '3 | Ebmaj7'])
    expect(setLineChord(doc, 1, '')).toBe(doc)
  })

  it('gives back the same doc for a chord the chart can’t take, or a line that isn’t a chord', () => {
    expect(setLineChord(doc, 2, 'F7 | x')).toBe(doc)
    expect(setLineChord(doc, 6, 'C7')).toBe(doc) // the copy:
    expect(setLineChord(doc, 2, 'F7')).toBe(doc) // unchanged
  })
})

describe('alternate changes (alt rows)', () => {
  const alt = 'section: A\n1 | C\n2 | Dm7\n2 | G7\nalt 2 | Abm7\nalt 2 | Db7\n3 | C\n4 | F\n'
  const d = (extra = ''): ChartDoc => parseChart(alt + extra).value

  it('setBarChords keeps alt rows', () => {
    const t = out(setBarChords(d(), 'A', 2, ['Dm9']))
    expect(t).toContain('2 | Dm9')
    expect(t).not.toContain('2 | G7')
    expect(t).toContain('alt 2 | Abm7')
    expect(t).toContain('alt 2 | Db7')
  })

  it('insertBar moves alt rows', () => {
    const t = out(insertHeldBar(d(), 'A', 2)) // a held bar can't go first
    expect(t).toContain('alt 3 | Abm7')
    expect(t).toContain('alt 3 | Db7')
  })

  it('deleteBar moves alt rows, and drops those on the deleted bar', () => {
    expect(out(deleteBar(d(), 'A', 1))).toContain('alt 1 | Abm7')
    expect(out(deleteBar(d(), 'A', 2)).some((l) => l.startsWith('alt'))).toBe(false)
  })

  it('splitSection carries alt rows', () => {
    const t = out(splitSection(d(), 'A', 2, 'B'))
    const at = t.indexOf('section: B')
    expect(t.slice(at)).toContain('alt 1 | Abm7')
    expect(t.slice(at)).toContain('alt 1 | Db7')
    expect(t.slice(0, at).some((l) => l.startsWith('alt'))).toBe(false)
  })

  it('writeOutCopy writes alt rows', () => {
    const doc = d('\nsection: A2\ncopy: A\n')
    const w = writeOutCopy(doc, 'A2')
    const t = out(w)
    const a2 = t.slice(t.indexOf('section: A2'))
    expect(a2).toContain('alt 2 | Abm7')
    expect(a2).toContain('alt 2 | Db7')
    const chords = (x: ChartDoc) => changesFor(x, 'alternate').lines.flatMap((l) => (l.kind === 'row' ? [l.chord] : []))
    expect(chords(w)).toEqual([...chords(doc), ...chords(doc)]) // A2 now plays what A plays
  })
})
