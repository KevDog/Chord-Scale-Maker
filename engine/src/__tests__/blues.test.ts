import { describe, expect, it } from 'vitest'
import { ambiguities, analyse, type Analysis } from '../analysis'
import { parseChart } from '../chart'
import { migrateChart } from '../migrate'

/** blues-aware analysis (docs/superpowers/specs/2026-10-18-blues-analysis-design.md §2) */

const read = (text: string): Analysis => analyse(parseChart(migrateChart(text).text).value)
const verdict = (text: string, barChord: string): string | undefined => {
  const r = read(text).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
  return r && `${r.scale} (${r.rule})`
}
/** a chart from `key`, extra header lines and `bar chord` pairs: "1 F7, 5 Bb7" */
const chart = (key: string, rows: string, extra = ''): string =>
  `title: T\n${key ? `key: ${key}\n` : ''}${extra}` +
  rows
    .split(',')
    .map((r) => r.trim().split(/\s+/))
    .map(([bar, chord]) => `A | ${bar} | ${chord}`)
    .join('\n') +
  '\n'
const BLUES = 'context: blues\nform: A, 12 bars\n'

describe('D9: the blues dominants', () => {
  const f = chart('F', '1 F7, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 F7', BLUES)
  it('I7, IV7 and an unresolved V7 are Mixolydian', () => {
    expect(verdict(f, '1 F7')).toBe('F Mixolydian (D9)')
    expect(verdict(f, '5 Bb7')).toBe('Bb Mixolydian (D9)')
    expect(verdict(f, '9 C7')).toBe('C Mixolydian (D9)')
  })
  it('the bar-9 V7 is not a guess, so no ❓', () => {
    expect(read(f).rows.find((r) => r.bar === '9')?.fallback).toBeUndefined()
    expect(ambiguities(read(f)).some((l) => l.includes('C7'))).toBe(false)
  })
  it('a written tension moves it: D1+D9', () => {
    expect(verdict(chart('F', '1 F7#9, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 F7', BLUES), '1 F7#9')).toMatch(/\(D1\+D9\)$/)
  })
  it('a stated V7/IV on the I7 goes the usual way', () => {
    const text = 'title: T\nkey: F\ncontext: blues\nform: A, 12 bars\nA | 1 | F7 | | V7/IV\nA | 5 | Bb7\nA | 7 | F7\nA | 9 | C7\nA | 11 | F7\n'
    expect(verdict(text, '1 F7')).not.toMatch(/D9/)
  })
  it('a resolving ii–V inside a jazz blues keeps its rules', () => {
    const jazz = chart('F', '1 F7, 5 Bb7, 7 F7, 9 Gm7, 10 C7, 11 F7', BLUES)
    expect(verdict(jazz, '9 Gm7')).toMatch(/\(m4\)$/)
    expect(verdict(jazz, '10 C7')).toBe('C Mixolydian (D3)') // resolving into the I7: an extended dominant, not D9
  })
  it('the turnaround V7 back to the I7 is the blues V, not an extended dominant', () => {
    expect(verdict(chart('F', '1 F7, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 F7, 12 C7', BLUES), '12 C7')).toBe('C Mixolydian (D9)')
  })
  it('a V7 after the I triad is the blues V, not V7 of the chord before it', () => {
    expect(verdict(chart('E', '1 E, 5 A, 7 E, 9 B7, 10 A, 11 E', BLUES), '9 B7')).toBe('B Mixolydian (D9)')
  })
})

describe('M6: triads in a blues', () => {
  const e = chart('E', '1 E, 5 A, 7 E, 9 B, 10 A, 11 E', BLUES)
  it('a major triad on I, IV or V is Mixolydian', () => {
    expect(verdict(e, '1 E')).toBe('E Mixolydian (M6)')
    expect(verdict(e, '5 A')).toBe('A Mixolydian (M6)')
    expect(verdict(e, '9 B')).toBe('B Mixolydian (M6)')
  })
  it('a 6 chord too; a maj7 keeps the major rules', () => {
    expect(verdict(chart('E', '1 E6, 5 A, 7 E, 9 B, 11 E', BLUES), '1 E6')).toBe('E Mixolydian (M6)')
    expect(verdict(chart('E', '1 EMaj7, 5 A, 7 E, 9 B, 11 E', BLUES), '1 EMaj7')).not.toMatch(/M6/)
  })
  it('a major I in a minor-key blues is a blues chord', () => {
    expect(verdict(chart('Em', '1 Em, 5 Am, 7 E, 9 B7, 11 Em', BLUES), '7 E')).toBe('E Mixolydian (M6)')
  })
})

describe('m10: the minor blues', () => {
  const c = chart('Cm', '1 Cm7, 5 Fm7, 7 Cm7, 9 G7, 11 Cm7', BLUES)
  it('i and iv are Dorian', () => {
    expect(verdict(c, '1 Cm7')).toBe('C Dorian (m10)')
    expect(verdict(c, '5 Fm7')).toBe('F Dorian (m10)')
  })
  it('a tonic m6 is Dorian too', () => {
    expect(verdict(chart('Cm', '1 Cm6, 5 Fm7, 7 Cm7, 9 G7, 11 Cm7', BLUES), '1 Cm6')).toBe('C Dorian (m10)')
  })
  it('its V7 keeps the minor-key rules', () => {
    expect(verdict(c, '9 G7')).not.toMatch(/D9|m10/)
  })
})

describe('s4: sus in a blues', () => {
  it('a sus on I, IV or V is Mixolydian', () => {
    expect(verdict(chart('F', '1 F7, 5 Bb7, 7 F7, 9 C7sus4, 11 F7', BLUES), '9 C7sus4')).toBe('C Mixolydian (s4)')
  })
})

describe('what is not a blues chord', () => {
  it('a chord under @key gets the ordinary rules', () => {
    const text = 'title: T\nkey: F\ncontext: blues\nform: A, 12 bars\nA | 1 | F7\nA | 5 | Bb7\n@key 7 Ab\nA | 7 | AbMaj7\nA | 9 | C7\nA | 11 | F7\n'
    expect(verdict(text, '7 AbMaj7')).not.toMatch(/M6|D9/)
  })
  it('a 13-bar form reads as a blues only when stated', () => {
    const rows = '1 E7, 5 A7, 7 E7, 9 B7, 10 A7, 11 E7, 13 B7'
    expect(verdict(chart('E', rows, 'context: blues\nform: A, 13 bars\n'), '9 B7')).toBe('B Mixolydian (D9)')
    expect(verdict(chart('E', rows, 'form: A, 13 bars\n'), '9 B7')).not.toMatch(/D9/)
  })
})
