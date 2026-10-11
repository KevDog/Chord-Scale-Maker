import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ambiguities, analyse, type Analysis, contextLine } from '../analysis'
import { parseChart } from '../chart'

/**
 * The chart's context (docs/superpowers/specs/2026-10-10-chart-context-design.md): `context:` stated or detected,
 * the detection's fixes, and the report line.
 */

const library = (name: string): string => readFileSync(`../charts/${name}.txt`, 'utf8')
/** a library chart as if it had no context: line */
const undeclared = (name: string): string => library(name).replace(/^context:.*\n/m, '')
const read = (text: string): Analysis => analyse(parseChart(text).value)
/** "Eb Mixolydian (D5)" for the first row at "bar chord" */
const verdict = (text: string, barChord: string): string | undefined => {
  const r = read(text).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
  return r && `${r.scale} (${r.rule})`
}
/** a chart from `key`, a header and `bar chord` pairs: "1 Bb7, 5 Eb7" */
const chart = (key: string, rows: string, extra = ''): string =>
  `title: T\n${key ? `key: ${key}\n` : ''}${extra}` +
  rows
    .split(',')
    .map((r) => r.trim().split(/\s+/))
    .map(([bar, chord]) => `A | ${bar} | ${chord}`)
    .join('\n') +
  '\n'
const BLUES_ROWS = '1 Bb7, 5 Eb7, 7 Bb7, 9 F7, 11 Bb7'
const VAMP = Array.from({ length: 16 }, (_, i) => `${i + 1} G7`).join(', ')

describe('a stated context (§2)', () => {
  it('is used, and says so; without one the context is detected', () => {
    const so = read(library('so_what'))
    expect([so.context, so.contextSource]).toEqual(['modal', 'detected'])
    const pinned = read(library('so_what').replace('key: Dm\n', 'key: Dm\ncontext: functional\n'))
    expect([pinned.context, pinned.contextSource]).toEqual(['functional', 'stated'])
  })

  it('beats the detection: a functional tune stated modal reads each chord as its own mode', () => {
    const text = chart('C', '1 Dm7, 3 G7, 5 CMaj7', 'context: modal\n')
    expect(read(text).context).toBe('modal')
    expect(verdict(text, '3 G7')).toBe('G Mixolydian (D7)')
    expect(verdict(text, '5 CMaj7')).toBe('C Lydian (M5)')
  })

  it('beats a detected blues: context: functional on a 12-bar blues keeps its key areas', () => {
    const a = read(library('f_blues').replace(/^key:.*\n/m, (k) => `${k}context: functional\n`))
    expect([a.context, a.contextSource]).toEqual(['functional', 'stated'])
    expect(a.rows.some((r) => r.reason.startsWith('I7 of the blues'))).toBe(false)
  })

  it('blues: the I is key:, else bar 1, and I7 and IV7 are D5 (Watermelon Man, 16 bars)', () => {
    const rows = '1 F7, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 C7, 12 Bb7, 13 C7, 14 Bb7, 15 F7'
    const stated = read(chart('', rows, 'form: A, 16 bars\ncontext: blues\n'))
    expect([stated.context, stated.contextSource, stated.key?.name, stated.keyFrom]).toEqual(['blues', 'stated', 'F major', 'blues'])
    expect(verdict(chart('', rows, 'form: A, 16 bars\ncontext: blues\n'), '5 Bb7')).toBe('Bb Mixolydian (D5)')
    expect(verdict(chart('', rows, 'form: A, 16 bars\ncontext: blues\n'), '1 F7')).toBe('F Mixolydian (D5)')
    expect(read(chart('Bb', rows, 'form: A, 16 bars\ncontext: blues\n')).key?.name).toBe('Bb major')
  })

  it('blues on a minor blues: key areas off, the minor-key rules inside (Mr. P.C.)', () => {
    const before = read(library('mr_pc'))
    const after = read(library('mr_pc').replace(/^key:.*\n/m, (k) => `${k}context: blues\n`))
    expect([after.context, after.key?.name, after.areas.length]).toEqual(['blues', 'C minor', 1])
    expect(after.rows.map((r) => r.scale)).toEqual(before.rows.map((r) => r.scale))
  })
})

describe('a stated key beats the blues key (§2)', () => {
  it('a 12-bar Bb7 … Eb7 chart with key: Eb reports E♭', () => {
    const a = read(chart('Eb', BLUES_ROWS, 'form: A, 12 bars\n'))
    expect([a.key?.name, a.keyFrom, a.context]).toEqual(['Eb major', 'key:', 'blues'])
  })

  it('without key: the blues key is bar 1', () => {
    const a = read(chart('', BLUES_ROWS, 'form: A, 12 bars\n'))
    expect([a.key?.name, a.keyFrom, a.context]).toEqual(['Bb major', 'blues', 'blues'])
  })
})

describe('what the analysis could not use (§1)', () => {
  it('a bad context: falls back to the detection, with a problem on its line', () => {
    const a = read('title: T\nkey: Dm\ncontext: bossa\nA | 1 | Dm7\nA | 9 | EbMaj7\n')
    expect(a.contextSource).toBe('detected')
    expect(a.problems).toEqual([{ line: 2, message: 'context: bossa is not functional, modal or blues: the context is detected' }])
  })

  it('minor: is reserved, and ignored', () => {
    expect(read('title: T\nkey: Dm\nminor: aeolian\nA | 1 | Dm7\n').problems).toEqual([{ line: 2, message: 'minor: is reserved, and ignored' }])
  })

  it("@context is not yet supported: the chart's context holds", () => {
    const a = read('title: T\nkey: Dm\n@context A 1 blues\nA | 1 | Dm7\nA | 9 | EbMaj7\n')
    expect(a.problems).toEqual([{ line: 2, message: "@context A 1 blues: not yet supported: using the chart's context" }])
    expect(a.context).toBe('modal')
  })
})

describe('the detection (§2)', () => {
  it('the modal guard: more than half the chords dominant 7ths, on several roots, is not modal', () => {
    const a = read(chart('', '1 Ab7, 3 G7, 5 Gb7, 7 F7, 9 E7, 11 Eb7, 13 D7, 15 Db7', 'form: A, 16 bars\n'))
    expect(a.context).toBe('functional')
    expect(a.detection).toMatchObject({ chords: 8, inCadence: 0, medianBars: 2, dominants: 8, oneRoot: false })
  })

  it('a one-root dominant vamp (G7 ×16) stays modal: a Mixolydian tonic', () => {
    const a = read(chart('', VAMP))
    expect(a.context).toBe('modal')
    expect(a.detection).toMatchObject({ dominants: 1, oneRoot: true })
    expect(verdict(chart('', VAMP), '1 G7')).toBe('G Mixolydian (D7)')
  })

  it('Locomotion without context: is not modal; its first 12-bar section is a blues', () => {
    const a = read(undeclared('locomotion'))
    expect([a.context, a.contextSource, a.detection.blues]).toEqual(['blues', 'detected', 'section'])
    expect(verdict(undeclared('locomotion'), '5 Eb7')).toBe('Eb Mixolydian (D5)')
    expect(verdict(undeclared('locomotion'), '1 Bb7')).toBe('Bb Mixolydian (D5)')
  })

  it('Tee Pee Time (12-12-8-12) is a blues by its first section', () => {
    expect(read(undeclared('tee_pee_time')).detection.blues).toBe('section')
  })

  it('12 bars repeated: the first 12-bar section is tested', () => {
    const rows = [0, 12, 24].map((o) => `${1 + o} Bb7, ${5 + o} Eb7, ${7 + o} Bb7, ${9 + o} F7, ${11 + o} Bb7`).join(', ')
    const text = chart('', rows, 'form: AAA, 36 bars\n').replace(/^A \| (1[3-9]|2[0-4]) /gm, 'B | $1 ').replace(/^A \| (2[5-9]|3\d) /gm, 'C | $1 ')
    expect(read(text).detection.blues).toBe('section')
  })

  it('a 12-bar form keeps its blues by the whole form', () => {
    expect(read(chart('', BLUES_ROWS, 'form: A, 12 bars\n')).detection.blues).toBe('form')
  })

  it('a 12-12-8-12 form whose bar 1 is no dominant is no blues', () => {
    const rows = '1 BbMaj7, 5 Eb7, 13 BbMaj7, 17 Eb7, 25 Ab7, 33 BbMaj7, 37 Eb7'
    const text = chart('Bb', rows, 'form: AABC, 44 bars\n').replace(/^A \| (1[3-9]|2[0-4]) /gm, 'A2 | $1 ').replace(/^A \| (2[5-9]|3[0-2]) /gm, 'B | $1 ').replace(/^A \| (3[3-9]|4\d) /gm, 'C | $1 ')
    expect(read(text).detection.blues).toBe(null)
  })
})

describe('the report line (§1, §4)', () => {
  it('stated', () => {
    expect(contextLine(read(library('so_what').replace('key: Dm\n', 'key: Dm\ncontext: modal\n')))).toBe('context: modal (stated)')
  })

  it('detected, with its numbers', () => {
    expect(contextLine(read(undeclared('footprints')))).toBe('context: modal (detected: 0 of 8 chords in cadences, median chord 2 bars)')
    expect(contextLine(read(chart('', '1 Ab7, 3 G7, 5 Gb7, 7 F7, 9 E7, 11 Eb7, 13 D7, 15 Db7', 'form: A, 16 bars\n')))).toBe(
      'context: functional (detected: 0 of 8 chords in cadences, median chord 2 bars, but 8 of 8 dominant 7ths)',
    )
    expect(contextLine(read(chart('', BLUES_ROWS, 'form: A, 12 bars\n')))).toBe('context: blues (detected: a 12-bar blues, I7 in bar 1 and IV7 in bar 5)')
    expect(contextLine(read(undeclared('locomotion')))).toBe('context: blues (detected: a blues in the first 12-bar section, I7 in bar 1 and IV7 in bar 5)')
  })
})

describe('--ambiguous: a detection within one chord of a threshold (§4)', () => {
  it('Footprints: modal by the median exactly; consider context:', () => {
    expect(ambiguities(read(undeclared('footprints')))).toContain('context: modal by the median exactly (2 bars); consider  context: modal')
  })

  it('says nothing once the context is stated', () => {
    const pinned = undeclared('footprints').replace('key: Cm\n', 'key: Cm\ncontext: modal\n')
    expect(ambiguities(read(pinned)).filter((l) => l.startsWith('context:'))).toEqual([])
  })

  it('names the cadence count when it sits one chord from a third', () => {
    // 9 chords, 3 in a cadence (Dm7 G7 CMaj7): one fewer would be under a third
    const text = chart('C', '1 EbMaj7, 3 Dm7, 4 G7, 5 CMaj7, 7 AbMaj7, 9 DbMaj7, 11 Em7, 13 Fm7, 15 BbMaj7', 'form: A, 16 bars\n')
    expect(read(text).detection).toMatchObject({ chords: 9, inCadence: 3 })
    expect(ambiguities(read(text))).toContain('context: functional by one chord: 3 of 9 chords in cadences (under a third is modal); consider  context: functional')
  })

  it('a detection far from every threshold says nothing', () => {
    expect(ambiguities(read(library('autumn_leaves'))).filter((l) => l.startsWith('context:'))).toEqual([])
  })
})
