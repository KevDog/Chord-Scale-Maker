import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { barView } from '../bars'
import { type ChartDoc, parseChart, serializeChart } from '../chart'
import { parseBarLine } from '../barLine'
import { addSection, deleteBar, insertBar, insertBars, insertHeldBar, renameSection, repeatSection, setBarChords, setEnding, setMark, setNav, splitSection, toggleEnding, writeOutCopy } from '../edit'

const chart = (name: string): ChartDoc => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
/** the chart's lines as text, without the column padding */
const out = (doc: ChartDoc): string[] =>
  serializeChart(doc)
    .trimEnd()
    .split('\n')
    .map((l) => l.replace(/\s*\|\s*/g, ' | ').replace(/ {2,}#/, '  #'))
/** each section as [name, first bar, last bar] */
const spans = (doc: ChartDoc) => barView(doc).sections.map((s) => [s.name, s.bars[0]?.bar, s.bars.at(-1)?.bar])

const small = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G', 'A | 4 | C', 'B | 5 | Dm7', 'B | 7 | G7'])

describe('insertBar', () => {
  it('inserts a held bar and moves the later bars, in its section and the next', () => {
    expect(out(insertBar(small, 'A', 2))).toEqual(['A | 1 | C', 'A | 3 | F', 'A | 4 | G', 'A | 5 | C', 'B | 6 | Dm7', 'B | 8 | G7'])
  })

  it('adds a bar at the end of a section, before the next one starts', () => {
    expect(out(insertBar(small, 'A', 5)).slice(4)).toEqual(['B | 6 | Dm7', 'B | 8 | G7'])
    expect(spans(insertBar(small, 'A', 5))).toEqual([
      ['A', 1, 5],
      ['B', 6, 8],
    ])
  })

  it('writes the chords it is given into the new bar, in the section where it goes', () => {
    expect(out(insertBar(small, 'B', 5, ['Em7', 'A7'])).slice(4)).toEqual(['B | 5 | Em7', 'B | 5 | A7', 'B | 6 | Dm7', 'B | 8 | G7'])
    expect(out(insertBar(small, 'A', 5, ['E7'])).slice(4)).toEqual(['A | 5 | E7', 'B | 6 | Dm7', 'B | 8 | G7'])
  })

  it("won't start a section with an empty bar, which would belong to the section before", () => {
    expect(insertBar(small, 'B', 5)).toBe(small)
  })

  it('refuses a bar the section does not have, a section that is not there, and chords that would not read back', () => {
    expect(insertBar(small, 'A', 7)).toBe(small)
    expect(insertBar(small, 'C', 1)).toBe(small)
    expect(insertBar(small, 'A', 2, ['C|7'])).toBe(small)
  })

  it('moves every directive after the bar, and none before it', () => {
    const doc = text([
      '@segno A 2',
      'A | 1 | C',
      'A | 2 | F',
      '@key A 1 C',
      '@key B 3 F',
      '@context B 4 modal',
      'B | 3 | Gm7',
      'B | 4 | C7',
      '@coda B 4',
      '@nav B 4 D.S. al Coda',
    ])
    expect(out(insertBar(doc, 'A', 2))).toEqual([
      '@segno A 3',
      'A | 1 | C',
      'A | 3 | F',
      '@key A 1 C',
      '@key B 4 F',
      '@context B 5 modal',
      'B | 4 | Gm7',
      'B | 5 | C7',
      '@coda B 5',
      '@nav B 5 D.S. al Coda',
    ])
  })

  it('grows an ending it lands inside, and moves one after it', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G7', 'A | 4 | C', 'A | 5 | C', '@ending 1 A 2 3', '@ending 2 A 4 5'])
    expect(out(insertBar(doc, 'A', 3)).slice(-2)).toEqual(['@ending 1 A 2 4', '@ending 2 A 5 6'])
    expect(out(insertBar(doc, 'A', 2, ['Dm7'])).slice(-2)).toEqual(['@ending 1 A 3 4', '@ending 2 A 5 6'])
  })

  it('keeps an intro and a coda numbered on their own', () => {
    const doc = text(['Intro | 1 | C', 'Intro | 2 | G7', 'A | 1 | C', 'A | 2 | F', '@key A 2 F', 'Coda | 1 | C', '@coda Coda 1'])
    expect(out(insertBar(doc, 'Intro', 2))).toEqual([
      'Intro | 1 | C',
      'Intro | 3 | G7',
      'A | 1 | C',
      'A | 2 | F',
      '@key A 2 F',
      'Coda | 1 | C',
      '@coda Coda 1',
    ])
  })

  it('keeps comments, functions and scales on the rows it moves', () => {
    const doc = text(['A | 1 | C', 'A | 2 | D7 | D Mixolydian | V7/V  # secondary dominant'])
    expect(insertBar(doc, 'A', 2).lines[1]).toEqual({
      kind: 'row',
      section: 'A',
      bar: '3',
      chord: 'D7',
      scale: 'D Mixolydian',
      function: 'V7/V',
      comment: 'secondary dominant',
    })
  })

  it('adds the bar to every repeat of the section, and moves each repeat after it (Autumn Leaves)', () => {
    const doc = insertBar(chart('autumn_leaves'), 'A1', 3)
    expect(spans(doc)).toEqual([
      ['A1', 1, 9],
      ['A2', 10, 18],
      ['B', 19, 36],
    ])
    expect(doc.lines.find((l) => l.kind === 'copy')).toEqual({ kind: 'copy', src: 'A1', dst: 'A2', offset: 9 })
    const a2 = barView(doc).sections[1]?.bars ?? []
    expect(a2.map((b) => b.kind)).toEqual(['chords', 'chords', 'held', 'chords', 'chords', 'chords', 'chords', 'chords', 'chords'])
  })

  it('adds the bar to a repeat of a repeat', () => {
    const doc = text(['A1 | 1 | C', 'A1 | 2 | G7', '@copy A1 A2 2', '@copy A2 A3 2', 'B | 7 | F'])
    expect(out(insertBar(doc, 'A1', 2))).toEqual(['A1 | 1 | C', 'A1 | 3 | G7', '@copy A1 A2 3', '@copy A2 A3 3', 'B | 10 | F'])
  })

  it('keeps a key change in a repeat on its bar (Wave)', () => {
    const keyed = (doc: ChartDoc) => barView(doc).sections.find((s) => s.name === 'C')?.bars.find((b) => b.key)
    const before = keyed(chart('wave'))
    const after = keyed(insertBar(chart('wave'), 'A1', 2))
    expect(after?.bar).toBe((before?.bar ?? 0) + 1) // A1's new bar 2 moves C along; C's own copy of it comes after its bar 33
    expect(after?.chords.map((c) => c.chord)).toEqual(before?.chords.map((c) => c.chord))
  })

  it("leaves a repeat's offset alone when the bar goes after the section it repeats", () => {
    const doc = insertBar(chart('autumn_leaves'), 'B', 20)
    expect(doc.lines.find((l) => l.kind === 'copy')).toEqual({ kind: 'copy', src: 'A1', dst: 'A2', offset: 8 })
  })

  it('edits written sections only: a repeat is changed through the section it repeats', () => {
    const doc = chart('autumn_leaves')
    expect(insertBar(doc, 'A2', 10)).toBe(doc)
  })
})

describe('insertBars', () => {
  it('inserts the bars in order before a bar, moving the later bars along', () => {
    expect(out(insertBars(small, 'A', 2, [['Dm7'], ['G7']]))).toEqual([
      'A | 1 | C',
      'A | 2 | Dm7',
      'A | 3 | G7',
      'A | 4 | F',
      'A | 5 | G',
      'A | 6 | C',
      'B | 7 | Dm7',
      'B | 9 | G7',
    ])
  })

  it('leaves an empty bar held, and counts it', () => {
    expect(out(insertBars(small, 'A', 2, [['Dm7', 'G7'], []])).slice(0, 4)).toEqual(['A | 1 | C', 'A | 2 | Dm7', 'A | 2 | G7', 'A | 4 | F'])
    expect(spans(insertBars(small, 'A', 2, [['Dm7', 'G7'], []]))[0]).toEqual(['A', 1, 6])
  })

  it('appends after the last bar of the chart, a held bar and all', () => {
    const last = barView(small).sections.at(-1)?.bars.at(-1)?.bar ?? 0
    expect(out(insertBars(small, 'B', last + 1, [['C'], [], ['F']])).slice(-2)).toEqual([`B | ${last + 1} | C`, `B | ${last + 3} | F`])
  })

  it('takes what parseBarLine reads', () => {
    expect(out(insertBars(small, 'A', 5, parseBarLine('| E7 | % |').value)).slice(4)).toEqual(['A | 5 | E7', 'B | 7 | Dm7', 'B | 9 | G7'])
  })

  it('refuses them all if one would be refused: a held bar starting a section, a chord that would not read back', () => {
    expect(insertBars(small, 'B', 5, [[], ['C']])).toBe(small)
    expect(insertBars(small, 'A', 2, [['C'], ['C|7']])).toBe(small)
    expect(insertBars(small, 'A', 9, [['C']])).toBe(small)
    expect(insertBars(small, 'A', 2, [])).toBe(small)
  })
})

describe('deleteBar', () => {
  it('removes a bar with its chords and moves the later bars back', () => {
    expect(out(deleteBar(small, 'A', 2))).toEqual(['A | 1 | C', 'A | 2 | G', 'A | 3 | C', 'B | 4 | Dm7', 'B | 6 | G7'])
  })

  it('removes a held bar, moving the later bars back', () => {
    expect(out(deleteBar(small, 'B', 6)).slice(4)).toEqual(['B | 5 | Dm7', 'B | 6 | G7'])
  })

  it('removes the marks on the bar, and moves its key change to the bar after', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | Bb', '@key A 2 F', '@segno A 2', '@nav A 2 Fine', '@coda A 3'])
    expect(out(deleteBar(doc, 'A', 2))).toEqual(['A | 1 | C', 'A | 2 | Bb', '@key A 2 F', '@coda A 2'])
  })

  it("drops a key change on the section's last bar, and one where the next bar has its own", () => {
    const last = text(['A | 1 | C', 'A | 2 | F', '@key A 2 F', 'B | 3 | C'])
    expect(out(deleteBar(last, 'A', 2))).toEqual(['A | 1 | C', 'B | 2 | C'])
    const both = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | Bb', '@key A 2 F', '@key A 3 Bb'])
    expect(out(deleteBar(both, 'A', 2))).toEqual(['A | 1 | C', 'A | 2 | Bb', '@key A 2 Bb'])
  })

  it('shrinks an ending, and removes one that was only this bar', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G7', 'A | 4 | C', 'A | 5 | C', '@ending 1 A 2 3', '@ending 2 A 4'])
    expect(out(deleteBar(doc, 'A', 2)).slice(-2)).toEqual(['@ending 1 A 2', '@ending 2 A 3'])
    expect(out(deleteBar(doc, 'A', 4)).slice(-2)).toEqual(['A | 4 | C', '@ending 1 A 2 3'])
  })

  it('removes the bar from every repeat of the section (Autumn Leaves)', () => {
    const doc = deleteBar(chart('autumn_leaves'), 'A1', 3)
    expect(spans(doc)).toEqual([
      ['A1', 1, 7],
      ['A2', 8, 14],
      ['B', 15, 32],
    ])
    expect(doc.lines.find((l) => l.kind === 'copy')).toEqual({ kind: 'copy', src: 'A1', dst: 'A2', offset: 7 })
  })

  it("won't leave a section starting on a held bar, and won't edit a repeat", () => {
    expect(deleteBar(small, 'B', 5)).toBe(small)
    const doc = chart('autumn_leaves')
    expect(deleteBar(doc, 'A2', 9)).toBe(doc)
    expect(deleteBar(doc, 'A1', 12)).toBe(doc)
  })

  it('removes a section of one bar', () => {
    const doc = text(['A | 1 | C', 'T | 2 | G7', 'B | 3 | C'])
    expect(out(deleteBar(doc, 'T', 2))).toEqual(['A | 1 | C', 'B | 2 | C'])
  })
})

describe('insertBar and deleteBar over the library', () => {
  const files = readdirSync('charts').filter((f) => f.endsWith('.txt'))

  it('place every line after an insert, and a delete of the same bar gives the chart back', () => {
    for (const file of files) {
      const doc = chart(file.replace(/\.txt$/, ''))
      for (const section of barView(doc).sections.filter((s) => !s.copy)) {
        const first = section.bars[0]?.bar ?? 0
        const last = section.bars.at(-1)?.bar ?? 0
        for (const at of new Set([first + 1, Math.floor((first + last) / 2), last, last + 1].filter((b) => b > first))) {
          const inserted = insertBar(doc, section.name, at)
          expect([file, section.name, at, barView(inserted).unplaced]).toEqual([file, section.name, at, []])
          expect([file, section.name, at, serializeChart(deleteBar(inserted, section.name, at))]).toEqual([file, section.name, at, serializeChart(doc)])
        }
        const opened = insertBar(doc, section.name, first, ['C'])
        expect([file, section.name, barView(opened).unplaced]).toEqual([file, section.name, []])
        expect([file, section.name, serializeChart(deleteBar(opened, section.name, first))]).toEqual([file, section.name, serializeChart(doc)])
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
    const doc = text(['A | 1 | Cm7 | C Dorian  # ii', 'A | 2 | F7 | F Mixolydian', 'A | 3 | Bb'])
    expect(out(setBarChords(doc, 'A', 1, ['Cm7', 'F7']))).toEqual([
      'A | 1 | Cm7 | C Dorian  # ii',
      'A | 1 | F7',
      'A | 2 | F7 | F Mixolydian',
      'A | 3 | Bb',
    ])
    expect(out(setBarChords(doc, 'A', 2, ['B7']))[1]).toBe('A | 2 | B7 | B Mixolydian')
    expect(out(setBarChords(doc, 'A', 2, ['Gm7', 'C7'])).slice(1, 3)).toEqual(['A | 2 | Gm7 | G Dorian', 'A | 2 | C7'])
  })

  it('writes chords into a held bar, between the bars around it', () => {
    const doc = text(['A | 1 | C', 'A | 3 | F'])
    expect(out(setBarChords(doc, 'A', 2, ['Dm7', 'G7']))).toEqual(['A | 1 | C', 'A | 2 | Dm7', 'A | 2 | G7', 'A | 3 | F'])
  })

  it('empties a bar into a held one, but not the first bar of a section', () => {
    expect(out(setBarChords(small, 'A', 2, []))).toEqual(['A | 1 | C', 'A | 3 | G', 'A | 4 | C', 'B | 5 | Dm7', 'B | 7 | G7'])
    expect(setBarChords(small, 'B', 5, [])).toBe(small)
  })

  it('returns the same doc for no change, a repeat, a missing bar or a chord that would not read back', () => {
    expect(setBarChords(small, 'A', 1, ['C'])).toBe(small)
    expect(setBarChords(small, 'A', 9, ['C'])).toBe(small)
    expect(setBarChords(small, 'A', 1, ['#x'])).toBe(small)
    const doc = chart('autumn_leaves')
    expect(setBarChords(doc, 'A2', 9, ['C'])).toBe(doc)
  })
})

describe('sections', () => {
  it('renames a section everywhere it is named', () => {
    const doc = text(['A | 1 | C', '@key A 1 C', '@copy A A2 1', '@ending 1 A 1', '@segno A 1', '@nav A 1 Fine'])
    expect(out(renameSection(doc, 'A', 'A1'))).toEqual(['A1 | 1 | C', '@key A1 1 C', '@copy A1 A2 1', '@ending 1 A1 1', '@segno A1 1', '@nav A1 1 Fine'])
    expect(out(renameSection(doc, 'A2', 'A3'))[2]).toBe('@copy A A3 1')
  })

  it("refuses a name that is taken, has spaces, wouldn't read back, or moves the section in or out of the form", () => {
    const doc = text(['A | 1 | C', 'B | 2 | F'])
    for (const name of ['B', 'A 2', '', '#A', 'Coda']) expect(renameSection(doc, 'A', name)).toBe(doc)
    expect(renameSection(doc, 'X', 'Y')).toBe(doc)
  })

  it('adds a section at the end of its part: the form after its last section, an intro before it, a coda last', () => {
    const doc = text(['title: T', 'A | 1 | C', 'A | 4 | G7', '@copy A A2 4', 'Coda | 1 | C'])
    expect(out(addSection(doc, 'B', ['F']))).toEqual(['title: T', 'A | 1 | C', 'A | 4 | G7', '@copy A A2 4', 'B | 9 | F', 'Coda | 1 | C'])
    expect(out(addSection(doc, 'Intro', ['G7']))).toEqual(['title: T', 'Intro | 1 | G7', 'A | 1 | C', 'A | 4 | G7', '@copy A A2 4', 'Coda | 1 | C'])
    expect(out(addSection(doc, 'Tag', ['C'])).at(-1)).toBe('Tag | 5 | C')
    expect(out(addSection(text(['title: T']), 'A', ['C']))).toEqual(['title: T', 'A | 1 | C'])
  })

  it('refuses a section that is there already, a bad name, or no chords', () => {
    expect(addSection(small, 'A', ['C'])).toBe(small)
    expect(addSection(small, 'C 2', ['C'])).toBe(small)
    expect(addSection(small, 'C', [])).toBe(small)
  })

  it('repeats a section with a @copy, after the last section of its part', () => {
    const doc = repeatSection(chart('autumn_leaves'), 'A1', 'A3')
    expect(doc.lines.at(-1)).toEqual({ kind: 'copy', src: 'A1', dst: 'A3', offset: 32 })
    expect(spans(doc).at(-1)).toEqual(['A3', 33, 40])
    expect(barView(doc).sections.at(-1)?.copy).toMatchObject({ of: 'A1' })
    expect(barView(doc).unplaced).toEqual([])
  })

  it('refuses to repeat a missing section, or into a name that is taken', () => {
    expect(repeatSection(small, 'C', 'D')).toBe(small)
    expect(repeatSection(small, 'A', 'B')).toBe(small)
  })
})

describe('endings, marks and nav', () => {
  const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G7', 'A | 4 | C', 'B | 5 | F'])

  it('sets an ending on bars of a section, replaces it, and clears it', () => {
    const one = setEnding(doc, 'A', 1, { from: 2, to: 3 })
    expect(out(one)).toEqual([...out(doc).slice(0, 4), '@ending 1 A 2 3', 'B | 5 | F'])
    expect(out(setEnding(one, 'A', 1, { from: 3, to: 3 }))[4]).toBe('@ending 1 A 3')
    expect(out(setEnding(one, 'A', 1, null))).toEqual(out(doc))
  })

  it('refuses an ending off the section or over the other ending', () => {
    const one = setEnding(doc, 'A', 1, { from: 2, to: 3 })
    expect(setEnding(doc, 'A', 1, { from: 4, to: 5 })).toBe(doc)
    expect(setEnding(one, 'A', 2, { from: 3, to: 4 })).toBe(one)
    expect(out(setEnding(one, 'A', 2, { from: 4, to: 4 }))[5]).toBe('@ending 2 A 4')
  })

  it('turns a segno or coda on a bar on and off', () => {
    const on = setMark(doc, 'B', 5, 'segno', true)
    expect(out(on).at(-1)).toBe('@segno B 5')
    expect(setMark(on, 'B', 5, 'segno', true)).toBe(on)
    expect(out(setMark(on, 'B', 5, 'segno', false))).toEqual(out(doc))
    expect(setMark(doc, 'B', 9, 'coda', true)).toBe(doc)
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
    expect(out(insertHeldBar(small, 'A', 3))).toEqual(['A | 1 | C', 'A | 2 | F', 'A | 4 | G', 'A | 5 | C', 'B | 6 | Dm7', 'B | 8 | G7'])
    expect(spans(insertHeldBar(small, 'A', 5))).toEqual([
      ['A', 1, 5],
      ['B', 6, 8],
    ])
  })

  it("writes the chord that sounds there at a part's end, where a held bar wouldn't count", () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G', 'A | 4 | C7'])
    expect(out(insertHeldBar(doc, 'A', 5)).at(-1)).toBe('A | 5 | C7')
    expect(spans(insertHeldBar(doc, 'A', 5))).toEqual([['A', 1, 8]])
  })

  it("won't go before a section's first bar or past its end", () => {
    expect(insertHeldBar(small, 'B', 5)).toBe(small)
    expect(insertHeldBar(small, 'A', 9)).toBe(small)
  })
})

describe('writeOutCopy', () => {
  it('turns a repeat into written rows of its own, in its place', () => {
    const doc = text(['A | 1 | C | C Ionian', 'A | 2 | G7 | | V7', '@copy A A2 2', 'B | 5 | F'])
    expect(out(writeOutCopy(doc, 'A2'))).toEqual(['A | 1 | C | C Ionian', 'A | 2 | G7 |  | V7', 'A2 | 3 | C | C Ionian', 'A2 | 4 | G7 |  | V7', 'B | 5 | F'])
    expect(barView(writeOutCopy(doc, 'A2')).sections[1]?.copy).toBeNull()
  })

  it('keeps a later repeat of the repeat playing the same bars', () => {
    const doc = text(['A | 1 | C', 'A | 2 | G7', '@copy A A2 2', '@copy A2 A3 2'])
    expect(barView(writeOutCopy(doc, 'A2')).sections.flatMap((s) => s.bars.map((b) => b.chords.map((c) => c.chord).join()))).toEqual(
      barView(doc).sections.flatMap((s) => s.bars.map((b) => b.chords.map((c) => c.chord).join())),
    )
  })

  it('refuses a section that is not a repeat', () => {
    expect(writeOutCopy(small, 'A')).toBe(small)
    expect(writeOutCopy(small, 'Z')).toBe(small)
  })
})

describe('splitSection', () => {
  const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G7', 'A | 4 | C', '@key A 3 G', '@segno A 4', '@ending 1 A 1 2', 'B | 5 | F'])

  it('starts a new section at a bar: that bar and the rest of the section, with their marks', () => {
    expect(out(splitSection(doc, 'A', 3, 'A2'))).toEqual(['A | 1 | C', 'A | 2 | F', 'A2 | 3 | G7', 'A2 | 4 | C', '@key A2 3 G', '@segno A2 4', '@ending 1 A 1 2', 'B | 5 | F'])
    expect(spans(splitSection(doc, 'A', 3, 'A2'))).toEqual([
      ['A', 1, 2],
      ['A2', 3, 4],
      ['B', 5, 8],
    ])
  })

  it("refuses the section's first bar, a held bar, a name in use or of another part, an ending across the split, or a section another repeats", () => {
    const held = text(['A | 1 | C', 'A | 3 | G7', 'B | 5 | F'])
    expect(splitSection(doc, 'A', 1, 'A2')).toBe(doc)
    expect(splitSection(held, 'A', 2, 'A2')).toBe(held)
    expect(splitSection(doc, 'A', 3, 'B')).toBe(doc)
    expect(splitSection(doc, 'A', 3, 'Coda')).toBe(doc)
    expect(splitSection(doc, 'A', 2, 'A2')).toBe(doc)
    const repeated = text(['A | 1 | C', 'A | 2 | F', '@copy A A2 2'])
    expect(splitSection(repeated, 'A', 2, 'X')).toBe(repeated)
  })
})

describe('toggleEnding', () => {
  const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 3 | G7', 'A | 4 | C', 'B | 5 | F'])

  it('puts an ending on a bar, grows it onto the bar next to it, and takes it off a bar inside it', () => {
    const one = toggleEnding(doc, 'A', 1, 2)
    expect(out(one)[4]).toBe('@ending 1 A 2')
    expect(out(toggleEnding(one, 'A', 1, 3))[4]).toBe('@ending 1 A 2 3')
    expect(out(toggleEnding(one, 'A', 1, 1))[4]).toBe('@ending 1 A 1 2')
    expect(out(toggleEnding(one, 'A', 1, 2))).toEqual(out(doc))
    expect(out(toggleEnding(one, 'A', 1, 4))[4]).toBe('@ending 1 A 4')
  })

  it('refuses an ending over the other one', () => {
    const one = toggleEnding(doc, 'A', 1, 2)
    expect(toggleEnding(one, 'A', 2, 2)).toBe(one)
  })
})
