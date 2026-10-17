import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { barView } from '../bars'
import { type ChartDoc, type ChartLine, lineSections, parseChart } from '../chart'

const chart = (name: string): ChartDoc => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
/** the index in doc.lines of the first line that matches */
const lineOf = (doc: ChartDoc, match: (l: ChartLine) => boolean): number => doc.lines.findIndex(match)
const rowLine = (doc: ChartDoc, section: string, bar: string, chord: string): number => {
  const sections = lineSections(doc)
  return doc.lines.findIndex((l, i) => l.kind === 'row' && sections[i] === section && l.bar === bar && l.chord === chord)
}
/** a directive line of a kind in a section */
const inSection = (doc: ChartDoc, kind: ChartLine['kind'], section: string): number => {
  const sections = lineSections(doc)
  return doc.lines.findIndex((l, i) => l.kind === kind && sections[i] === section)
}
const bar = (doc: ChartDoc, section: string, n: number) => {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === n)
  if (!found) throw new Error(`no bar ${n} in ${section}`)
  return found
}

describe('barView', () => {
  it('gives Autumn Leaves as its sections in order, each numbered from bar 1', () => {
    const view = barView(chart('autumn-leaves'))
    expect(view.beats).toBe(4)
    expect(view.sections.map((s) => [s.name, s.bars[0]?.bar, s.bars.at(-1)?.bar])).toEqual([
      ['A1', 1, 8],
      ['A2', 1, 8],
      ['B', 1, 16],
    ])
    expect(view.unplaced).toEqual([])
  })

  it('splits a bar between its chords, each with the line it was written on', () => {
    const doc = chart('autumn-leaves')
    expect(bar(doc, 'A1', 3)).toMatchObject({
      kind: 'chords',
      chords: [
        { chord: 'Bm7', beat: 0, line: rowLine(doc, 'A1', '3', 'Bm7') },
        { chord: 'E7', beat: 2, line: rowLine(doc, 'A1', '3', 'E7') },
      ],
    })
  })

  it('links a copy: section to its source, its chords pointing at the source rows', () => {
    const doc = chart('autumn-leaves')
    const a2 = barView(doc).sections[1]
    expect(a2?.copy).toEqual({ of: 'A1', line: lineOf(doc, (l) => l.kind === 'sectionMeta' && l.field === 'copy') })
    expect(a2?.bars[2]?.chords.map((c) => c.line)).toEqual([rowLine(doc, 'A1', '3', 'Bm7'), rowLine(doc, 'A1', '3', 'E7')])
    expect(barView(doc).sections[0]?.copy).toBeNull()
  })

  it('marks a bar with no row as held, up to the section’s bars:', () => {
    const doc = chart('its-you-or-no-one')
    expect(bar(doc, 'A', 8)).toMatchObject({ kind: 'held', chords: [] })
    expect(bar(doc, 'D', 7).kind).toBe('chords')
    expect(bar(doc, 'D', 8)).toMatchObject({ kind: 'held', chords: [] })
    expect(barView(doc).sections.find((s) => s.name === 'Intro')?.bars.map((b) => b.kind)).toEqual(['chords', 'chords', 'held', 'held'])
  })

  it('numbers each section’s bars from 1 and holds bars up to bars:', () => {
    const v = barView(text(['section: A', 'bars: 4', '1 | Dm7', '2 | G7', 'section: B', 'copy: A']))
    expect(v.sections.map((s) => [s.name, s.bars.map((b) => `${b.bar}${b.kind[0]}`).join(' '), s.copy?.of ?? null])).toEqual([
      ['A', '1c 2c 3h 4h', null],
      ['B', '1c 2c 3h 4h', 'A'],
    ])
    expect(v.sections[1]?.copy?.line).toBe(5)
  })

  it('keeps the order the chart plays, an intro and a coda as their own parts', () => {
    const view = barView(chart('its-you-or-no-one'))
    expect(view.sections.map((s) => [s.name, s.part])).toEqual([
      ['Intro', 'before'],
      ['Coda', 'after'],
      ['A', 'form'],
      ['B', 'form'],
      ['C', 'form'],
      ['D', 'form'],
    ])
  })

  it('keeps a section with no rows in place: its bars held, the sections after it where they were (review)', () => {
    const v = barView(parseChart(['section: A', '1 | C', '2 | F', 'section: B', 'bars: 4', 'section: C', '1 | G7', '2 | Bb'].join('\n')).value)
    expect(v.sections.map((s) => [s.name, s.bars.map((b) => b.chords.map((c) => c.chord).join() || '-').join(' ')])).toEqual([
      ['A', 'C F'],
      ['B', '- - - -'],
      ['C', 'G7 Bb'],
    ])
  })

  it('attaches segno, coda and nav to their bars', () => {
    const doc = chart('its-you-or-no-one')
    const at = (kind: ChartLine['kind'], section: string) => inSection(doc, kind, section)
    expect(bar(doc, 'A', 1).marks).toEqual([{ mark: 'segno', line: at('mark', 'A') }])
    expect(bar(doc, 'D', 7).marks).toEqual([{ mark: 'coda', line: at('mark', 'D') }])
    expect(bar(doc, 'D', 7).nav).toEqual([{ text: 'D.S. al Coda', line: at('nav', 'D') }])
    expect(bar(doc, 'Coda', 1).marks).toEqual([{ mark: 'coda', line: at('mark', 'Coda') }])
    expect(bar(doc, 'A', 2)).toMatchObject({ marks: [], nav: [], ending: null, key: null, context: null })
  })

  it('attaches 1st and 2nd endings to each bar they cover', () => {
    const doc = chart('stardust')
    const ending = (n: number) => lineOf(doc, (l) => l.kind === 'ending' && l.n === n)
    expect([7, 8, 9, 10].map((n) => bar(doc, 'Intro', n).ending)).toEqual([
      { n: 1, first: true, last: false, line: ending(1) },
      { n: 1, first: false, last: true, line: ending(1) },
      { n: 2, first: true, last: false, line: ending(2) },
      { n: 2, first: false, last: true, line: ending(2) },
    ])
    expect(bar(doc, 'Intro', 6).ending).toBeNull()
    expect(bar(doc, 'A1', 2).kind).toBe('held')
  })

  it('attaches each @key to its bar and a section’s key: to its bar 1, a held bar and a copy: section too', () => {
    const doc = chart('wave')
    const field = (k: string) => lineOf(doc, (l) => l.kind === 'sectionMeta' && l.field === 'key' && l.value === k)
    expect(bar(doc, 'B', 1).key).toEqual({ key: 'F', line: field('F') })
    expect(bar(doc, 'B', 5).key).toEqual({ key: 'Eb', line: lineOf(doc, (l) => l.kind === 'key' && l.key === 'Eb') })
    expect(bar(doc, 'C', 1).key).toEqual({ key: 'D', line: field('D') })
    expect(bar(doc, 'B', 4)).toMatchObject({ kind: 'held', key: null })
    const held = text(['section: A', '1 | C', '3 | F', '@key 2 G'])
    expect(bar(held, 'A', 2)).toMatchObject({ kind: 'held', key: { key: 'G', line: 3 } })
  })

  it('attaches an @context to its bar', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '@context 2 modal'])
    expect(bar(doc, 'A', 2).context).toEqual({ context: 'modal', line: 3 })
  })

  it('places chords on the beats of the chart\'s metre', () => {
    const doc = text(['time: 3/4', 'section: A', '1 | C', '1 | F', '2 | G'])
    const view = barView(doc)
    expect(view.beats).toBe(3)
    expect(view.sections[0]?.bars[0]?.chords.map((c) => c.beat)).toEqual([0, 2])
  })

  it('lists what it cannot place, with the line and why, and leaves it out of the bars', () => {
    const doc = text([
      'section: A',
      '1 | C',
      'x | D',
      '2 | E',
      '2 | F',
      '2 | G',
      '2 | A',
      '2 | B',
      'not a row',
      '@key 99 F',
      '@ending 1 2 9',
      '@segno 99',
      '@nav 99 Fine',
      '@context 99 blues',
      'section: B',
      '1.5 | C',
      'section: C',
      'copy: B',
    ])
    const view = barView(doc)
    expect(view.unplaced.map((u) => u.line)).toEqual([2, 7, 8, 9, 10, 11, 12, 13, 15])
    expect(view.unplaced.every((u) => u.reason.length > 0)).toBe(true)
    expect(view.sections[0]?.bars.flatMap((b) => b.chords.map((c) => c.chord))).toEqual(['C', 'E', 'F', 'G', 'A'])
  })

  it('lists a second @key, @context or ending on a bar that already has one', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '@key 1 C', '@key 1 G', '@context 1 modal', '@context 1 blues', '@ending 1 1 2', '@ending 2 2'])
    const view = barView(doc)
    expect(view.unplaced.map((u) => u.line)).toEqual([4, 6, 8])
    expect(bar(doc, 'A', 1).key?.key).toBe('C')
  })

  it('lists a row once when a copy: repeats it', () => {
    const doc = text(['section: A', '1 | C', '1 | D', '1 | E', '1 | F', '1 | G', 'section: B', 'copy: A'])
    expect(barView(doc).unplaced.map((u) => u.line)).toEqual([5])
  })

  it('lists a row whose bar is out of order', () => {
    const doc = text(['section: A', '1 | C', '2 | F', '1 | G'])
    expect(barView(doc).unplaced.map((u) => u.line)).toEqual([3])
  })

  it('places every line of every library chart', () => {
    for (const file of readdirSync('charts').filter((f) => f.endsWith('.txt'))) {
      expect([file, barView(chart(file.replace(/\.txt$/, ''))).unplaced]).toEqual([file, []])
    }
  })

  it('gives an empty chart no sections', () => {
    expect(barView(text(['title: X']))).toEqual({ beats: 4, sections: [], unplaced: [] })
  })
})
