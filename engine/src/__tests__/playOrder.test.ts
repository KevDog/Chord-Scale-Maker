import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import { CONCERT } from '../part'
import { isSyncCopy } from '../util'
import { type PlayBar, playOrder } from '../playOrder'

/** a drawn bar of section `section`, plain unless told */
const bar = (section: string, o: Partial<Omit<PlayBar, 'at'>> = {}): PlayBar => ({
  at: { section, bar: '1' },
  repeatStart: false,
  repeatEnd: 0,
  volta: null,
  segno: false,
  coda: false,
  nav: '',
  ...o,
})
/** the library's charts (the tests run in engine/) */
const LIBRARY_CHARTS = readdirSync('charts')
  .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
  .map((f) => ({
    slug: f.replace(/\.txt$/, ''),
    text: readFileSync(`charts/${f}`, 'utf8'),
  }))
/** sections only a cue reaches, which the marks can't say (each chart's `# routing:` comment) */
const UNREACHED: Readonly<Record<string, readonly string[]>> = {
  gemini: ['C', 'D', 'D2'],
}
const volta = (n: number, start = true, end = true) => ({ n, start, end })

describe('playOrder', () => {
  it('plays the bars as drawn with nothing to follow', () => {
    expect(playOrder([bar('A'), bar('A'), bar('B')])).toEqual([0, 1, 2])
  })

  it('goes back to the top at a repeat sign with no start', () => {
    expect(playOrder([bar('A'), bar('A', { repeatEnd: 2 }), bar('B')])).toEqual([0, 1, 0, 1, 2])
  })

  it('a second repeat with no start goes back to just past the first', () => {
    expect(playOrder([bar('A', { repeatEnd: 2 }), bar('B'), bar('B', { repeatEnd: 2 })])).toEqual([0, 0, 1, 2, 1, 2])
  })

  it('goes back to the start sign, as many times in all as the repeat says', () => {
    expect(playOrder([bar('In'), bar('A', { repeatStart: true }), bar('A', { repeatEnd: 3 }), bar('B')])).toEqual([0, 1, 2, 1, 2, 1, 2, 3])
  })

  it('plays each ending on its pass', () => {
    const bars = [bar('A', { repeatStart: true }), bar('A', { volta: volta(1), repeatEnd: 2 }), bar('A', { volta: volta(2) }), bar('B')]
    expect(playOrder(bars)).toEqual([0, 1, 0, 2, 3])
  })

  it('plays a two-bar ending whole, then the next', () => {
    const bars = [
      bar('A', { repeatStart: true }),
      bar('A', { volta: volta(1, true, false) }),
      bar('A', { volta: volta(1, false, true), repeatEnd: 2 }),
      bar('A', { volta: volta(2, true, false) }),
      bar('A', { volta: volta(2, false, true) }),
      bar('B'),
    ]
    expect(playOrder(bars)).toEqual([0, 1, 2, 0, 3, 4, 5])
  })

  it('D.S. al Coda: back to the segno, then from the coda sign to the Coda, which is skipped until then', () => {
    const bars = [
      bar('Coda', { coda: true }), // drawn first, as some charts write it
      bar('Coda'),
      bar('A', { segno: true }),
      bar('A', { coda: true }),
      bar('B', { nav: 'D.S. al Coda' }),
    ]
    expect(playOrder(bars)).toEqual([2, 3, 4, 2, 3, 0, 1])
  })

  it('takes the coda at the D.S. bar itself when that bar carries the coda sign', () => {
    const bars = [bar('A', { segno: true }), bar('A', { coda: true, nav: 'D.S. al Coda' }), bar('Coda', { coda: true })]
    expect(playOrder(bars)).toEqual([0, 1, 0, 1, 2])
  })

  it('a To Coda instruction is a departure too', () => {
    const bars = [bar('A', { segno: true }), bar('A', { nav: 'To Coda' }), bar('B', { nav: 'D.S. al Coda' }), bar('Coda')]
    expect(playOrder(bars)).toEqual([0, 1, 2, 0, 1, 3])
  })

  it('D.C. al Fine: back to the form’s first bar (the intro once), then stops at Fine', () => {
    const bars = [bar('Intro'), bar('A'), bar('A', { nav: 'Fine' }), bar('B', { nav: 'D.C. al Fine' })]
    expect(playOrder(bars)).toEqual([0, 1, 2, 3, 1, 2])
  })

  it('after a D.S. takes no repeat again and plays the last ending only', () => {
    const bars = [bar('A', { segno: true }), bar('A', { volta: volta(1), repeatEnd: 2 }), bar('A', { volta: volta(2) }), bar('B', { nav: 'D.S.' })]
    expect(playOrder(bars)).toEqual([0, 1, 0, 2, 3, 0, 2, 3])
  })

  it('a D.S. with no segno goes to the form’s top; a D.S. al Coda with no coda sign plays to the end', () => {
    expect(playOrder([bar('A'), bar('B', { nav: 'D.S. al Coda' })])).toEqual([0, 1, 0, 1])
  })

  it('a D.S. written before its section’s last bar jumps at that bar', () => {
    const bars = [bar('A', { segno: true }), bar('B', { nav: 'D.S.' }), bar('B')]
    expect(playOrder(bars)).toEqual([0, 1, 2, 0, 1, 2])
  })

  it('a D.S. copied into a later section is read there, the last time it is written', () => {
    const bars = [bar('A', { segno: true }), bar('D1', { nav: 'D.S. al Coda' }), bar('D2', { nav: 'D.S. al Coda' }), bar('Coda')]
    expect(playOrder(bars)).toEqual([0, 1, 2, 0, 1, 2, 3])
  })

  it('a D.S. al Coda with no coda sign leaves for the Coda at the D.S.’s section end', () => {
    const bars = [bar('A', { segno: true }), bar('B', { nav: 'D.S. al Coda' }), bar('B'), bar('Coda', { coda: true })]
    expect(playOrder(bars)).toEqual([0, 1, 2, 0, 1, 2, 3])
  })

  it('the Coda is the first coda sign past the last D.S., playing on to the end', () => {
    const bars = [bar('A', { coda: true }), bar('B', { nav: 'D.C. al Coda' }), bar('Solos', { coda: true }), bar('Coda', { coda: true })]
    expect(playOrder(bars)).toEqual([0, 1, 0, 2, 3])
  })

  it('with no “al Coda” in the chart, a Coda plays where it is drawn', () => {
    const bars = [bar('A', { coda: true, nav: 'To Coda (3rd time)' }), bar('B'), bar('Coda', { coda: true })]
    expect(playOrder(bars)).toEqual([0, 1, 2])
  })

  it('reads a library chart: It’s You or No One (Intro, Coda drawn early, D.S. al Coda at D7)', () => {
    const doc = parseChart(
      'title: T\nkey: C\n\nsection: Intro\n1 | C\n\nsection: Coda\n1 | C\n2 | F\n@coda 1\n\nsection: A\n1 | Dm7\n2 | G7\n@segno 1\n\nsection: B\n1 | C\n2 | C\n@coda 2\n@nav 2 D.S. al Coda\n',
    ).value
    const drawn = buildChanges(doc, CONCERT, 4, false, 'off').lines.flatMap((l) => l.bars)
    const names = playOrder(drawn).map((i) => `${drawn[i]!.at.section}${drawn[i]!.at.bar}`)
    expect(names).toEqual(['Intro1', 'A1', 'A2', 'B1', 'B2', 'A1', 'A2', 'B1', 'B2', 'Coda1', 'Coda2'])
  })

  it.each(LIBRARY_CHARTS)('plays every drawn bar of $slug', ({ slug, text }) => {
    const drawn = buildChanges(parseChart(text).value, CONCERT, 4, false, 'off').lines.flatMap((l) => l.bars)
    const order = playOrder(drawn)
    const unplayed = drawn.flatMap((b, i) => (order.includes(i) || UNREACHED[slug]?.includes(b.at.section) ? [] : [`${b.at.section}${b.at.bar}`]))
    expect(unplayed).toEqual([])
  })
})
