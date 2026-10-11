import { describe, expect, it } from 'vitest'
import { analyse, type RowAnalysis } from '../analysis'
import { parseFunction } from '../analysis/functions'
import { parseChart } from '../chart'

/**
 * The function labels spec (docs/superpowers/specs/2026-10-10-function-labels-design.md §1): what the Changes sheet
 * prints and what the report says, with the scale and the rule id pinned to today's. One bar per chord.
 */

/** the rows of a chart in `key`, one bar per chord: "Cmaj7 | D7 | G7 | Cmaj7" */
function rows(key: string, chords: string): readonly RowAnalysis[] {
  const list = chords.split('|').map((c) => c.trim())
  const text = `title: T\nkey: ${key}\nbars: ${list.length}\n${list.map((c, i) => `A | ${i + 1} | ${c}`).join('\n')}\n`
  return analyse(parseChart(text).value).rows
}

/** the first row of `chord` */
function row(key: string, chords: string, chord: string): RowAnalysis {
  const r = rows(key, chords).find((x) => x.chord === chord)
  if (!r) throw new Error(`${chord} not in ${chords}`)
  return r
}

const label = (r: RowAnalysis) => ({ numeral: r.numeral, scale: r.scale, rule: r.rule, fn: r.fn, reason: r.reason, fallback: r.fallback })

describe('L3 auxiliary diminished: defined by the next chord', () => {
  const AUX = { fn: 'auxiliary diminished', reason: 'auxiliary diminished: it decorates the chord and returns to it', fallback: undefined }

  it('a °7 resolving to the chord on its own root after a ii–V is auxiliary, not a passing guess', () => {
    expect(label(row('C', 'Dm7 | G7 | Cdim7 | C6', 'Cdim7'))).toEqual({ numeral: 'i°7', scale: 'C Whole-Half Diminished', rule: 'd1', ...AUX })
  })

  it('a °7 resolving to the dominant on its own root is auxiliary', () => {
    expect(label(row('C', 'Cmaj7 | Gdim7 | G7', 'Gdim7'))).toEqual({ numeral: 'v°7', scale: 'G Whole-Half Diminished', rule: 'd1', ...AUX })
  })

  it('between two chords on its own root, as before', () => {
    expect(label(row('C', 'Cmaj7 | Cdim7 | Cmaj7', 'Cdim7'))).toEqual({ numeral: 'i°7', scale: 'C Whole-Half Diminished', rule: 'd1', ...AUX })
  })
})

describe('L4 diminished numerals by direction', () => {
  it('an ascending vii°7 of X prints sharp-side', () => {
    expect(label(row('C', 'Cmaj7 | C#dim7 | Dm7', 'C#dim7'))).toEqual({
      numeral: '♯i°7',
      scale: 'C# Whole-Half Diminished',
      rule: 'd1',
      fn: 'vii°7 of Dm7',
      reason: 'vii°7 of Dm7: the rootless V7b9 of the next chord',
      fallback: undefined,
    })
    expect(['Dm7 | D#dim7 | Em7', 'Fmaj7 | F#dim7 | G', 'G7 | G#dim7 | Am7'].map((c) => {
      const r = rows('C', c)[1]
      return `${r?.numeral} ${r?.scale} ${r?.rule}`
    })).toEqual(['♯ii°7 D# Whole-Half Diminished d1', '♯iv°7 F# Whole-Half Diminished d1', '♯v°7 G# Whole-Half Diminished d1'])
  })

  it('a descending one prints flat-side, as before', () => {
    expect(label(row('C', 'Em7 | Ebdim7 | Dm7', 'Ebdim7'))).toMatchObject({ numeral: '♭iii°7', scale: 'Eb Whole-Half Diminished', rule: 'd1' })
  })

  it('an auxiliary one prints its own degree', () => {
    expect(label(row('C', 'Cmaj7 | Cdim7 | Cmaj7', 'Cdim7'))).toMatchObject({ numeral: 'i°7', scale: 'C Whole-Half Diminished', rule: 'd1' })
  })
})

describe('L5 a sus before its own dominant is a suspension', () => {
  it('V7sus4 before the V7 on the same root', () => {
    expect(label(row('C', 'Cmaj7 | Dm7 | G7sus4 | G7 | Cmaj7', 'G7sus4'))).toMatchObject({
      scale: 'G Mixolydian',
      rule: 's3',
      fn: 'V7sus4 before the V7: a subdominant suspension',
      reason: 'V7sus4 before the V7: Mixolydian, the 4th is a chord tone here',
    })
  })

  it('a sus with no same-root dominant after it stays static', () => {
    expect(label(row('C', 'Cmaj7 | G7sus4 | Fmaj7', 'G7sus4'))).toMatchObject({ scale: 'G Mixolydian', rule: 's3', fn: 'static sus', reason: 'static sus: Mixolydian' })
  })
})

describe('L7 print V7sus4', () => {
  it('a resolving sus prints V7sus4', () => {
    expect(label(row('C', 'G7sus4 | Cmaj7', 'G7sus4'))).toMatchObject({ numeral: 'V7sus4', scale: 'G Mixolydian', rule: 's2' })
  })

  it('reads 7sus and sus as 7sus4', () => {
    expect(['V7sus', 'Vsus', 'V7sus4'].map((t) => {
      const f = parseFunction(t)
      return typeof f === 'string' ? f : f.text
    })).toEqual(['V7sus4', 'V7sus4', 'V7sus4'])
  })
})
