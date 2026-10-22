import { readdirSync, readFileSync } from 'node:fs'
import { isRest } from '../chord'
import { describe, expect, it } from 'vitest'
import { chartBeats, parseChart, qualityScale, type Row } from '../chart'
import { guideTonesFor } from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import { sectionLayout } from '../layout'
import { clockOf } from '../metre'
import { CONCERT } from '../part'
import { isSyncCopy } from '../util'

const row = (bar: string, chord: string, scale = ''): Row => ({ section: 'A', bar, chord, scale })

describe('timeline', () => {
  it('splits shared bars and holds a chord until the next change', () => {
    const t = guideToneTimeline([row('1', 'Dm7'), row('2', 'G7'), row('2', 'C7'), row('3', 'F'), row('3', 'Bb'), row('3', 'Eb'), row('5', 'Ab')])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 4],
      ['G7', 4, 2],
      ['C7', 6, 2],
      ['F', 8, 2],
      ['Bb', 10, 1],
      ['Eb', 11, 5], // to bar 5
      ['Ab', 16, 4], // the section's last written bar
    ])
    expect(t.diagnostics).toEqual([])
  })

  it('starts each section where the last ended, and holds a last chord to the section’s length', () => {
    const l = sectionLayout(parseChart('section: A\nbars: 4\n1 | Dm7\n3 | G7\nsection: B\n1 | C\n').value).value
    expect(guideToneTimeline(l.rows, 4, l.lengths).events.map((e) => [e.chord, e.start, e.beats])).toEqual([['Dm7', 0, 8], ['G7', 8, 8], ['C', 16, 4]])
  })

  it('runs a copy as long as its source, and the form to its bars:', () => {
    const end = (text: string) => {
      const l = sectionLayout(parseChart(text).value).value
      const last = guideToneTimeline(l.rows, 4, l.lengths).events.at(-1)
      return last && last.start + last.beats
    }
    expect(end('section: A1\nbars: 8\n1 | Dm7\nsection: A2\ncopy: A1\nsection: B\nbars: 8\n1 | Ebm7\nsection: A3\ncopy: A1\n')).toBe(32 * 4) // So What
    expect(end('section: A\nbars: 12\n1 | C7\n12 | G7\n')).toBe(12 * 4)
  })

  it('counts a section with no rows by its length', () => {
    const l = sectionLayout(parseChart('section: A\n1 | C\nsection: B\nbars: 4\nsection: C\n1 | G7\n').value).value
    expect(guideToneTimeline(l.rows, 4, l.lengths).events.map((e) => [e.chord, e.start])).toEqual([['C', 0], ['G7', 20]])
  })

  it('without lengths, a section lasts to its last written bar', () => {
    const rows = [row('1', 'C'), row('2', 'F'), { ...row('1', 'G'), section: 'B' }]
    expect(guideToneTimeline(rows, 4).events.map((e) => e.start)).toEqual([0, 4, 8])
  })

  it('starts a section whose first chord is after bar 1 with silent bars', () => {
    expect(guideToneTimeline([row('3', 'C')]).events.map((e) => [e.start, e.beats])).toEqual([[8, 4]])
  })

  it('treats 1 and 01 as the same bar', () => {
    expect(guideToneTimeline([row('1', 'C7'), row('01', 'F7'), row('2', 'G7')]).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 2],
      ['F7', 2, 2],
      ['G7', 4, 4],
    ])
  })

  it('reports bars it cannot place and keeps going', () => {
    const t = guideToneTimeline([row('1', 'C7'), row('x', 'F7'), row('3', 'G7'), row('2', 'C7'), ...['1', '1', '1', '1', '1'].map((b) => row(b, 'D7'))])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 4],
      ['F7', 4, 4], // "x": one bar
      ['G7', 8, 4], // next bar is earlier: one bar
      ['C7', 12, 4],
      ['D7', 16, 1],
      ['D7', 17, 1],
      ['D7', 18, 1],
      ['D7', 19, 9], // the last: to the section's length (3 bars from its bar 1)
    ])
    expect(t.diagnostics).toEqual(['bar "x" is not a whole number, so F7 gets one bar', 'more than 4 chords in bar 1: the 5th and later are left out'])
  })

  it('times a waltz in 3/4: three beats a bar', () => {
    const text = 'section: A\nbars: 8\n1 | Dm7\n2 | G7\n2 | C7\n3 | FMaj7\n5 | Bb\n'
    const l = sectionLayout(parseChart(text).value).value
    expect(guideToneTimeline(l.rows, 3, l.lengths).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 3], ['G7', 3, 2], ['C7', 5, 1], ['FMaj7', 6, 6], ['Bb', 12, 12], // Bb holds bars 5–8
    ])
  })

  it('times each bar in its own metre, and gives the clock (#235)', () => {
    const text = 'section: A\n1 | Dm7\n2 | G7\n2 | C7\n3 | F\n5 | Bb\n5 | Eb\nsection: B\n1 | Ab\n'
    const metres = new Map([['A', [4, 2, 4, 3, 6]], ['B', [5]]])
    const l = sectionLayout(parseChart(text).value).value
    const t = guideToneTimeline(l.rows, 4, l.lengths, metres)
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 4], ['G7', 4, 1], ['C7', 5, 1], ['F', 6, 7], ['Bb', 13, 3], ['Eb', 16, 3], ['Ab', 19, 5],
    ])
    expect(t.clock).toEqual(clockOf([4, 2, 4, 3, 6, 5], 4))
  })

  it('splits a 5/4 bar 3 + 2 and a 6/4 bar 3 + 3', () => {
    const two = [row('1', 'C'), row('1', 'F')]
    expect(guideToneTimeline(two, 5).events.map((e) => e.beats)).toEqual([3, 2])
    expect(guideToneTimeline(two, 6).events.map((e) => e.beats)).toEqual([3, 3])
    expect(guideToneTimeline([...two, row('1', 'G')], 6).events.map((e) => e.beats)).toEqual([2, 2, 2])
  })

  it('splits a 7/4 bar as 4 + 3, and three chords as 2, 2, 3', () => {
    const two = [row('1', 'C'), row('1', 'F')]
    const a = guideToneTimeline(two, 7).events
    expect([a.map((e) => e.start), a.map((e) => e.beats)]).toEqual([[0, 4], [4, 3]])
    const b = guideToneTimeline([...two, row('1', 'G')], 7).events
    expect([b.map((e) => e.start), b.map((e) => e.beats)]).toEqual([[0, 2, 4], [2, 2, 3]])
  })

  it('times an intro, the form and a coda one after another, each numbered from bar 1', () => {
    const text = 'section: Intro\nbars: 4\n1 | Dm7\n3 | G7\nsection: A\n1 | CMaj7\n3 | Am7\n5 | Dm7\n7 | G7\n8 | G7\nsection: Coda\nbars: 4\n1 | Db7\n2 | CMaj7\n'
    const l = sectionLayout(parseChart(text).value).value
    expect(guideToneTimeline(l.rows, 4, l.lengths).events.map((e) => [e.chord, e.start / 4, e.beats / 4])).toEqual([
      ['Dm7', 0, 2], ['G7', 2, 2],
      ['CMaj7', 4, 2], ['Am7', 6, 2], ['Dm7', 8, 2], ['G7', 10, 1], ['G7', 11, 1],
      ['Db7', 12, 1], ['CMaj7', 13, 3],
    ])
  })
})

describe('the library', () => {
  it('times every chart in its own metre without a problem, and every chord has guide tones', () => {
    for (const f of readdirSync('charts').filter((name) => !isSyncCopy(name))) {
      const doc = parseChart(readFileSync(`charts/${f}`, 'utf8')).value
      const l = sectionLayout(doc).value
      const { events, diagnostics } = guideToneTimeline(l.rows, chartBeats(doc), l.lengths)
      expect(diagnostics, f).toEqual([])
      expect(events.filter((e) => !isRest(e.chord) && !guideTonesFor(CONCERT, e.chord, qualityScale(e.row) ?? undefined)).map((e) => e.chord), f).toEqual([])
    }
  })
})
