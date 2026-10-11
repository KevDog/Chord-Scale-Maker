import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { barView } from '../bars'
import { type ChartDoc, type ChartLine, parseChart } from '../chart'

const chart = (name: string): ChartDoc => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
/** the index in doc.lines of the first line that matches */
const lineOf = (doc: ChartDoc, match: (l: ChartLine) => boolean): number => doc.lines.findIndex(match)
const rowLine = (doc: ChartDoc, section: string, bar: string, chord: string): number =>
  lineOf(doc, (l) => l.kind === 'row' && l.section === section && l.bar === bar && l.chord === chord)
const bar = (doc: ChartDoc, section: string, n: number) => {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === n)
  if (!found) throw new Error(`no bar ${n} in ${section}`)
  return found
}

describe('barView', () => {
  it('gives Autumn Leaves as its sections in order, bars numbered as the chart numbers them', () => {
    const view = barView(chart('autumn_leaves'))
    expect(view.beats).toBe(4)
    expect(view.sections.map((s) => [s.name, s.bars[0]?.bar, s.bars.at(-1)?.bar])).toEqual([
      ['A1', 1, 8],
      ['A2', 9, 16],
      ['B', 17, 32],
    ])
    expect(view.unplaced).toEqual([])
  })

  it('splits a bar between its chords, each with the line it was written on', () => {
    const doc = chart('autumn_leaves')
    expect(bar(doc, 'A1', 3)).toMatchObject({
      kind: 'chords',
      chords: [
        { chord: 'Bm7', beat: 0, line: rowLine(doc, 'A1', '3', 'Bm7') },
        { chord: 'E7', beat: 2, line: rowLine(doc, 'A1', '3', 'E7') },
      ],
    })
  })

  it('links a @copy section to its source, its chords pointing at the source rows', () => {
    const doc = chart('autumn_leaves')
    const a2 = barView(doc).sections[1]
    expect(a2?.copy).toEqual({ of: 'A1', line: lineOf(doc, (l) => l.kind === 'copy') })
    expect(a2?.bars[2]?.chords.map((c) => c.line)).toEqual([rowLine(doc, 'A1', '3', 'Bm7'), rowLine(doc, 'A1', '3', 'E7')])
    expect(barView(doc).sections[0]?.copy).toBeNull()
  })

  it('marks a bar with no row as held, and the bars a section is rounded up by as implied', () => {
    const doc = chart('its_you_or_no_one')
    expect(bar(doc, 'A', 8)).toMatchObject({ kind: 'held', chords: [] })
    expect(bar(doc, 'D', 31).kind).toBe('chords')
    expect(bar(doc, 'D', 32)).toMatchObject({ kind: 'implied', chords: [] })
    expect(barView(doc).sections.find((s) => s.name === 'Intro')?.bars.map((b) => b.kind)).toEqual(['chords', 'chords', 'implied', 'implied'])
  })

  it('keeps the order the chart plays, an intro and a coda as their own parts', () => {
    const view = barView(chart('its_you_or_no_one'))
    expect(view.sections.map((s) => [s.name, s.part])).toEqual([
      ['Intro', 'before'],
      ['Coda', 'after'],
      ['A', 'form'],
      ['B', 'form'],
      ['C', 'form'],
      ['D', 'form'],
    ])
  })

  it('attaches segno, coda and nav to their bars', () => {
    const doc = chart('its_you_or_no_one')
    const at = (kind: string, section: string) => lineOf(doc, (l) => l.kind === kind && 'section' in l && l.section === section)
    expect(bar(doc, 'A', 1).marks).toEqual([{ mark: 'segno', line: at('mark', 'A') }])
    expect(bar(doc, 'D', 31).marks).toEqual([{ mark: 'coda', line: at('mark', 'D') }])
    expect(bar(doc, 'D', 31).nav).toEqual([{ text: 'D.S. al Coda', line: at('nav', 'D') }])
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

  it('attaches each @key to its bar, a held bar and a @copy section too', () => {
    const doc = chart('wave')
    const key = (k: string) => lineOf(doc, (l) => l.kind === 'key' && l.key === k)
    expect(bar(doc, 'B', 25).key).toEqual({ key: 'F', line: key('F') })
    expect(bar(doc, 'B', 29).key).toEqual({ key: 'Eb', line: key('Eb') })
    expect(bar(doc, 'C', 33).key).toEqual({ key: 'D', line: key('D') })
    expect(bar(doc, 'B', 28)).toMatchObject({ kind: 'held', key: null })
    const held = text(['A | 1 | C', 'A | 3 | F', '@key A 2 G'])
    expect(bar(held, 'A', 2)).toMatchObject({ kind: 'held', key: { key: 'G', line: 2 } })
  })

  it('attaches an @context to its bar', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', '@context A 2 modal'])
    expect(bar(doc, 'A', 2).context).toEqual({ context: 'modal', line: 2 })
  })

  it('places chords on the beats of the chart\'s metre', () => {
    const doc = text(['time: 3/4', 'A | 1 | C', 'A | 1 | F', 'A | 2 | G'])
    const view = barView(doc)
    expect(view.beats).toBe(3)
    expect(view.sections[0]?.bars[0]?.chords.map((c) => c.beat)).toEqual([0, 2])
  })

  it('lists what it cannot place, with the line and why, and leaves it out of the bars', () => {
    const doc = text([
      'A | 1 | C',
      'A | x | D',
      'A | 2 | E',
      'A | 2 | F',
      'A | 2 | G',
      'A | 2 | A',
      'A | 2 | B',
      'not a row',
      '@key A 99 F',
      '@ending 1 A 2 9',
      '@segno Z 1',
      '@nav A 99 Fine',
      '@context A 99 blues',
      'B | 1.5 | C',
      '@copy B C 8',
    ])
    const view = barView(doc)
    expect(view.unplaced.map((u) => u.line)).toEqual([1, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(view.unplaced.every((u) => u.reason.length > 0)).toBe(true)
    expect(view.sections[0]?.bars.flatMap((b) => b.chords.map((c) => c.chord))).toEqual(['C', 'E', 'F', 'G', 'A'])
  })

  it('lists a second @key, @context or ending on a bar that already has one', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', '@key A 1 C', '@key A 1 G', '@context A 1 modal', '@context A 1 blues', '@ending 1 A 1 2', '@ending 2 A 2'])
    const view = barView(doc)
    expect(view.unplaced.map((u) => u.line)).toEqual([3, 5, 7])
    expect(bar(doc, 'A', 1).key?.key).toBe('C')
  })

  it('lists a row once when a @copy repeats it', () => {
    const doc = text(['A | 1 | C', 'A | 1 | D', 'A | 1 | E', 'A | 1 | F', 'A | 1 | G', '@copy A B 1'])
    expect(barView(doc).unplaced.map((u) => u.line)).toEqual([4])
  })

  it('lists a row whose bar is out of order', () => {
    const doc = text(['A | 1 | C', 'A | 2 | F', 'A | 1 | G'])
    expect(barView(doc).unplaced.map((u) => u.line)).toEqual([2])
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
