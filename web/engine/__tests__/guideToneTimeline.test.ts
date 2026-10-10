import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartBeats, expandRows, parseChart, resolveScale, type Row } from '../chart'
import { guideTonesFor } from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import { CONCERT } from '../part'
import { isSyncCopy } from '../util'

const row = (bar: string, chord: string, scale = ''): Row => ({ section: 'A', bar, chord, scale })
const rowsOf = (text: string): readonly Row[] => expandRows(parseChart(text).value).value

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
      ['Ab', 16, 16], // the last row fills out the 4-bar phrase (bars 5-8)
    ])
    expect(t.diagnostics).toEqual([])
  })

  it('runs the last section as long as the one it repeats, in whole 4-bar phrases', () => {
    const end = (text: string) => {
      const { events } = guideToneTimeline(rowsOf(text))
      const last = events.at(-1)
      return last && last.start + last.beats
    }
    expect(end('A1 | 1 | Dm7\n@copy A1 A2 8\nB | 17 | Ebm7\n@copy A1 A3 24\n')).toBe(32 * 4) // So What: 32 bars
    expect(end('A | 1 | Cm7\nA | 5 | Fm7\nA | 7 | Cm7\nA | 9 | F#m7b5\nA | 10 | E7alt\nA | 11 | Cm7\n')).toBe(12 * 4) // 12-bar
    expect(end('A | 1 | C7\nA | 12 | G7\n')).toBe(12 * 4)
  })

  it('treats 1 and 01 as the same bar', () => {
    expect(guideToneTimeline([row('1', 'C7'), row('01', 'F7'), row('2', 'G7')]).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 2],
      ['F7', 2, 2],
      ['G7', 4, 12],
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
      ['D7', 19, 1],
    ])
    expect(t.diagnostics).toEqual(['bar "x" is not a whole number, so F7 gets one bar', 'more than 4 chords in bar 1: the 5th and later are left out'])
  })

  it('times a waltz in 3/4: three beats a bar', () => {
    const text = 'A | 1 | Dm7\nA | 2 | G7\nA | 2 | C7\nA | 3 | FMaj7\nA | 5 | Bb\n'
    expect(guideToneTimeline(rowsOf(text), 3).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 3], ['G7', 3, 2], ['C7', 5, 1], ['FMaj7', 6, 6], ['Bb', 12, 12], // Bb holds bars 5–8
    ])
  })

  it('times an intro and a coda on their own, each numbered from bar 1', () => {
    const text = 'Intro | 1 | Dm7\nIntro | 3 | G7\nA | 1 | CMaj7\nA | 3 | Am7\nA | 5 | Dm7\nA | 7 | G7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n'
    expect(guideToneTimeline(rowsOf(text)).events.map((e) => [e.chord, e.start / 4, e.beats / 4])).toEqual([
      ['Dm7', 0, 2], ['G7', 2, 2], // the intro: 4 bars
      ['CMaj7', 4, 2], ['Am7', 6, 2], ['Dm7', 8, 2], ['G7', 10, 2], // the form, from bar 1
      ['Db7', 12, 1], ['CMaj7', 13, 3], // the coda, rounded to 4 bars
    ])
  })
})

describe('the library', () => {
  it('times every chart in its own metre without a problem, and every chord has guide tones', () => {
    for (const f of readdirSync('../charts').filter((name) => !isSyncCopy(name))) {
      const doc = parseChart(readFileSync(`../charts/${f}`, 'utf8')).value
      const { events, diagnostics } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
      expect(diagnostics, f).toEqual([])
      expect(events.filter((e) => !guideTonesFor(CONCERT, e.chord, resolveScale(e.row) ?? undefined)).map((e) => e.chord), f).toEqual([])
    }
  })
})
