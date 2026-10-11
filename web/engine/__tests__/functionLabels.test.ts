import { describe, expect, it } from 'vitest'
import { analyse, type RowAnalysis } from '../analysis'
import { parseFunction } from '../analysis/functions'
import { readFileSync } from 'node:fs'
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

/** the rows of `chords`, as "numeral scale rule" */
const sheet = (key: string, chords: string, pick: readonly string[]) =>
  pick.map((c) => {
    const r = row(key, chords, c)
    return `${r.numeral} ${r.scale} ${r.rule}`
  })

describe('L1 a dominant into the key’s own V7 is V7/V; chain links print an arrow', () => {
  it('D7 G7 | C: the D7 is V7/V, not an extended dominant', () => {
    expect(label(row('C', 'Cmaj7 | D7 | G7 | Cmaj7', 'D7'))).toEqual({
      numeral: 'V7/V',
      scale: 'D Mixolydian',
      rule: 'D3',
      fn: 'V7 of V7: the dominant of the dominant',
      reason: 'V7 of V7: the dominant of the dominant: natural tensions',
      fallback: undefined,
    })
  })

  it('the Rhythm bridge: → → V7/V V7, all Mixolydian', () => {
    const chords = 'Bbmaj7 | D7 | G7 | C7 | F7 | Bbmaj7'
    expect(sheet('Bb', chords, ['D7', 'G7', 'C7', 'F7'])).toEqual(['→ D Mixolydian D3', '→ G Mixolydian D3', 'V7/V C Mixolydian D3', 'V7 F Mixolydian D4'])
    expect(label(row('Bb', chords, 'D7'))).toMatchObject({
      fn: 'extended dominant: each one falls a fifth into the next',
      reason: 'extended dominant: each one falls a fifth into the next: natural tensions',
    })
    expect(label(row('Bb', chords, 'C7'))).toMatchObject({ fn: 'V7 of V7: the dominant of the dominant', reason: 'V7 of V7: the dominant of the dominant: natural tensions' })
  })

  it('into a minor tonic (D8): the same labels, on the way to the minor key', () => {
    const chords = 'A7 | D7 | G7 | Cm7'
    expect(sheet('Cm', chords, ['A7', 'D7', 'G7'])).toEqual(['→ A Phrygian Dominant D8', 'V7/V D Phrygian Dominant D8', 'V7 G Phrygian Dominant D8'])
    expect(label(row('Cm', chords, 'A7'))).toMatchObject({
      fn: 'extended dominant: each one falls a fifth into the next, on the way to C minor',
      reason: 'extended dominant: each one falls a fifth into the next, on the way to C minor: b9 and b13 are in the key',
    })
    expect(label(row('Cm', chords, 'D7'))).toMatchObject({
      fn: 'V7 of V7: the dominant of the dominant, on the way to C minor',
      reason: 'V7 of V7: the dominant of the dominant, on the way to C minor: b9 and b13 are in the key',
    })
    expect(label(row('Cm', chords, 'G7'))).toMatchObject({ fn: 'V7 of C minor, at the end of a chain of dominants', reason: "V7 of C minor, the chain's last link: b9 and b13 are in the key" })
  })

  it('a chain of two not into the key’s V7 is unchanged', () => {
    expect(label(row('C', 'Cmaj7 | E7 | A7 | Dm7', 'E7'))).toEqual({
      numeral: 'III7',
      scale: 'E Phrygian Dominant',
      rule: 'D8',
      fn: 'extended dominant into D minor',
      reason: 'V7 of A7, on the way to D minor: b9 and b13 are in the key',
      fallback: undefined,
    })
    expect(label(row('F', 'F7 | Bb7 | F7 | C7', 'F7'))).toMatchObject({ numeral: 'I7', scale: 'F Mixolydian', rule: 'D3', fn: 'extended dominant (V7 of Bb7)', reason: 'extended dominant: V7 of Bb7' })
  })

  it('a chain of three or more that never reaches the key’s V7 is unchanged (Anthropology)', () => {
    const chords = 'Bbmaj7 | F7 | Bb7 | Eb7 | Ab7 | Bbmaj7'
    expect(sheet('Bb', chords, ['F7', 'Bb7', 'Eb7', 'Ab7'])).toEqual(['V7 F Mixolydian D3', 'I7 Bb Mixolydian D3', 'IV7 Eb Mixolydian D3', '♭VII7 Ab Lydian Dominant D5'])
    expect(label(row('Bb', chords, 'Bb7'))).toMatchObject({ fn: 'extended dominant (V7 of Eb7)', reason: 'extended dominant: V7 of Eb7' })
  })
  it('a sus breaks the chain: no arrow before it, and it is never the V7/V link (ruling R5)', () => {
    const chords = 'A7 | D7sus4 | G7 | C'
    expect(label(row('C', chords, 'A7'))).toEqual({
      numeral: 'VI7',
      scale: 'A Mixolydian',
      rule: 'D3',
      fn: 'extended dominant (V7 of D7sus4)',
      reason: 'extended dominant: V7 of D7sus4',
      fallback: undefined,
    })
    expect(sheet('C', chords, ['D7sus4', 'G7'])).toEqual(['II7sus4 D Mixolydian s2', 'V7 G Mixolydian D4'])
    expect(sheet('C', 'D7 | G7sus4 | G7 | C', ['D7', 'G7sus4', 'G7'])).toEqual(['II7 D Mixolydian D3', 'V7sus4 G Mixolydian s3', 'V7 G Mixolydian D4'])
  })
})

describe('L2 a diatonic chord acting as a related ii prints its degree (major key areas)', () => {
  it('iii7 before V7/ii', () => {
    expect(label(row('C', 'Cmaj7 | Em7 | A7 | Dm7 | G7 | Cmaj7', 'Em7'))).toEqual({
      numeral: 'iii7',
      scale: 'E Phrygian', // R4: the iii keeps its own scale as a related ii
      rule: 'm9',
      fn: 'ii of the ii–V to D minor; also iii of C',
      reason: "iii: Phrygian, the key's own notes (the ♭2 is a passing note)",
      fallback: undefined,
    })
  })

  it('viiø7 before V7/vi: the "also" in the fn only', () => {
    expect(label(row('C', 'Bm7b5 | E7 | Am7', 'Bm7b5'))).toEqual({
      numeral: 'viiø7',
      scale: 'B Locrian',
      rule: 'h2',
      fn: 'iiø7 of the ii–V to A minor; also viiø7 of C',
      reason: "iiø7 of A minor: Locrian, the key's own notes (its ♭2 is a passing note)",
      fallback: undefined,
    })
  })

  it('whether or not its ii–V lands', () => {
    expect(label(row('C', 'Cmaj7 | Am7 | D7 | Cmaj7', 'Am7'))).toEqual({
      numeral: 'vi7',
      scale: 'A Dorian',
      rule: 'm4',
      fn: 'ii of D7; also vi of C',
      reason: 'ii of D7: Dorian',
      fallback: undefined,
    })
  })

  it('a non-diatonic related ii keeps its slash', () => {
    expect(label(row('C', 'Gm7 | C7 | Fmaj7', 'Gm7'))).toMatchObject({ numeral: 'ii7/IV', scale: 'G Dorian', rule: 'm4', fn: 'ii of the ii–V to F', reason: 'ii of the ii–V to F' })
  })

  it('the ii of the tonic is not "also" anything', () => {
    expect(label(row('C', 'Cmaj7 | Dm7 | G7 | Cmaj7', 'Dm7'))).toMatchObject({ numeral: 'ii7', rule: 'm4', fn: 'ii of the ii–V to C' })
  })

  it('a minor key area is unchanged (Autumn Leaves)', () => {
    const r = analyse(parseChart(readFileSync(new URL('../../../charts/autumn_leaves.txt', import.meta.url), 'utf8')).value).rows.find((x) => x.bar === '1')
    expect([r?.chord, r?.numeral, r?.key.name, r?.scale, r?.rule, r?.fn]).toEqual(['Cm7', 'ii7/♭III', 'G minor', 'C Dorian', 'm4', 'ii of F7'])
  })
})

describe('L6 borrowed chords are named as borrowed', () => {
  it('♭VII7 not into I: subdominant minor, no guess', () => {
    expect(label(row('C', 'Cmaj7 | Bb7 | Fmaj7', 'Bb7'))).toEqual({
      numeral: '♭VII7',
      scale: 'Bb Lydian Dominant',
      rule: 'D6',
      fn: '♭VII7, borrowed from the parallel minor (subdominant minor)',
      reason: '♭VII7 from the parallel minor: Lydian Dominant',
      fallback: undefined,
    })
  })

  it('♭VI7 returning to I', () => {
    expect(label(row('C', 'Cmaj7 | Ab7 | Cmaj7', 'Ab7'))).toEqual({
      numeral: '♭VI7',
      scale: 'Ab Lydian Dominant',
      rule: 'D6',
      fn: '♭VI7, borrowed from the parallel minor (subdominant minor)',
      reason: '♭VI7 from the parallel minor: Lydian Dominant, it returns to I',
      fallback: undefined,
    })
  })

  it('♭III7 is borrowed but not subdominant minor', () => {
    expect(label(row('C', 'Cmaj7 | Eb7 | Cmaj7', 'Eb7'))).toMatchObject({
      scale: 'Eb Lydian Dominant',
      rule: 'D6',
      fn: '♭III7, borrowed from the parallel minor',
      reason: '♭III7 from the parallel minor: Lydian Dominant, it returns to I',
      fallback: undefined,
    })
  })

  it('a dominant on any other non-diatonic root is still a chromatic guess', () => {
    expect(label(row('C', 'Cmaj7 | Gb7 | Cmaj7', 'Gb7'))).toMatchObject({ scale: 'Gb Lydian Dominant', rule: 'D6', fn: 'chromatic dominant', fallback: true })
  })

  it('a diatonic-root dominant that does not resolve is unchanged', () => {
    expect(label(row('C', 'Cmaj7 | E7 | Fmaj7', 'E7'))).toMatchObject({ numeral: 'III7', scale: 'E Phrygian Dominant', rule: 'D5', fn: 'III7 in C, not resolving', fallback: true })
  })

  it('borrowed major chords: modal interchange, from C minor or C Phrygian', () => {
    expect(label(row('C', 'Cmaj7 | Abmaj7 | G7', 'Abmaj7'))).toEqual({
      numeral: '♭VImaj7',
      scale: 'Ab Lydian',
      rule: 'M4',
      fn: '♭VImaj7, borrowed (modal interchange)',
      reason: '♭VImaj7, borrowed from C minor: Lydian (its ♯11 is in the key)',
      fallback: undefined,
    })
    expect(label(row('C', 'Cmaj7 | Dbmaj7 | Cmaj7', 'Dbmaj7'))).toMatchObject({
      scale: 'Db Lydian',
      rule: 'M4',
      fn: '♭IImaj7, borrowed (modal interchange)',
      reason: '♭IImaj7, borrowed from C Phrygian: Lydian (its ♯11 is in the key)',
    })
  })

  it('borrowed triads and sixth chords take their own numeral', () => {
    expect(label(row('C', 'Cmaj7 | Ab6 | G7', 'Ab6'))).toMatchObject({ scale: 'Ab Lydian', rule: 'M4', fn: '♭VI6, borrowed (modal interchange)', reason: '♭VI6, borrowed from C minor: Lydian (its ♯11 is in the key)' })
    expect(label(row('C', 'Cmaj7 | Eb | Dm7', 'Eb'))).toMatchObject({ scale: 'Eb Lydian', rule: 'M4', fn: '♭III, borrowed (modal interchange)', reason: '♭III, borrowed from C minor: Lydian (its ♯11 is in the key)' })
  })

  it('iiø7 with no dominant after it is borrowed, no guess', () => {
    expect(label(row('C', 'Cmaj7 | Dm7b5 | Cmaj7', 'Dm7b5'))).toEqual({
      numeral: 'iiø7',
      scale: 'D Locrian',
      rule: 'h2',
      fn: 'iiø7, borrowed',
      reason: 'iiø7, borrowed from C minor: Locrian',
      fallback: undefined,
    })
  })

  it('iiø7 before its dominant, and other unattached ø7s, are unchanged', () => {
    expect(label(row('C', 'Dm7b5 | G7 | Cmaj7', 'Dm7b5'))).toMatchObject({ scale: 'D Locrian', rule: 'h2', fn: 'iiø7 of the ii–V to C', fallback: undefined })
    expect(label(row('C', 'Cmaj7 | F#m7b5 | Fmaj7', 'F#m7b5'))).toMatchObject({ scale: 'F# Locrian', rule: 'h2', fn: '#ivø7 in C', fallback: true })
  })
})

describe('L8 extended ii–V', () => {
  it('a side-step ii–V: fn and reason, numerals and scales unchanged', () => {
    const chords = 'Bm7 | E7 | Bbm7 | Eb7 | Am7b5 | D7 | Gm7'
    expect(sheet('Gm', chords, ['E7', 'Eb7'])).toEqual(['V7/II E Mixolydian D4', 'V7/♭II Eb Mixolydian D4'])
    for (const c of ['E7', 'Eb7']) expect(label(row('Gm', chords, c))).toMatchObject({ fn: 'extended ii–V: a side-step, its own notes', reason: 'extended ii–V: a side-step, its own key' })
  })

  it('with the tensions when its target is minor', () => {
    expect(label(row('C', 'Cmaj7 | C#m7b5 | F#7 | Cmaj7', 'F#7'))).toMatchObject({
      numeral: 'V7/vii',
      scale: 'F# Phrygian Dominant',
      rule: 'D4',
      fn: 'extended ii–V: a side-step, its own notes',
      reason: 'extended ii–V: a side-step, its own key: b9 and b13 are in the key',
    })
  })
})

describe('L3 auxiliary diminished: defined by the next chord', () => {
  const AUX = { fn: 'auxiliary diminished', reason: 'auxiliary diminished: it decorates the chord and returns to it', fallback: undefined }

  it('a °7 resolving to the chord on its own root after a ii–V is auxiliary, not a passing guess', () => {
    expect(label(row('C', 'Dm7 | G7 | Cdim7 | C6', 'Cdim7'))).toEqual({ numeral: 'i°7', scale: 'C Diatonic Diminished I', rule: 'd1', ...AUX })
  })

  it('a °7 resolving to the dominant on its own root is auxiliary', () => {
    expect(label(row('C', 'Cmaj7 | Gdim7 | G7', 'Gdim7'))).toEqual({ numeral: 'v°7', scale: 'G Diatonic Diminished V', rule: 'd1', ...AUX })
  })

  it('between two chords on its own root, as before', () => {
    expect(label(row('C', 'Cmaj7 | Cdim7 | Cmaj7', 'Cdim7'))).toEqual({ numeral: 'i°7', scale: 'C Diatonic Diminished I', rule: 'd1', ...AUX })
  })
})

describe('L4 diminished numerals by direction', () => {
  it('an ascending vii°7 of X prints sharp-side', () => {
    expect(label(row('C', 'Cmaj7 | C#dim7 | Dm7', 'C#dim7'))).toEqual({
      numeral: '♯i°7',
      scale: 'C# Diatonic Diminished',
      rule: 'd1',
      fn: 'vii°7 of Dm7',
      reason: 'vii°7 of Dm7: A7♭9 without its root',
      fallback: undefined,
    })
    expect(['Dm7 | D#dim7 | Em7', 'Fmaj7 | F#dim7 | G', 'G7 | G#dim7 | Am7'].map((c) => {
      const r = rows('C', c)[1]
      return `${r?.numeral} ${r?.scale} ${r?.rule}`
    })).toEqual(['♯ii°7 D# Diatonic Diminished d1', '♯iv°7 F# Diatonic Diminished d1', '♯v°7 G# Diatonic Diminished d1'])
  })

  it('a °7 ascending to the next chord’s bass prints sharp-side, like its scale (♯II°7 to I/3)', () => {
    expect(label(row('Ab', 'Bbm7 | Bdim7 | Ab/C', 'Bdim7'))).toMatchObject({ numeral: '♯ii°7', scale: 'B Diatonic Diminished', rule: 'd1' })
    expect(label(row('Bb', 'Cm7 | Dbdim7 | Bb/D', 'Dbdim7'))).toMatchObject({ numeral: '♯ii°7', scale: 'C# Diatonic Diminished', rule: 'd1' })
  })

  it('a descending one prints flat-side, as before', () => {
    expect(label(row('C', 'Em7 | Ebdim7 | Dm7', 'Ebdim7'))).toMatchObject({ numeral: '♭iii°7', scale: 'Eb Diatonic Diminished bIII', rule: 'd1' })
  })

  it('an auxiliary one prints its own degree', () => {
    expect(label(row('C', 'Cmaj7 | Cdim7 | Cmaj7', 'Cdim7'))).toMatchObject({ numeral: 'i°7', scale: 'C Diatonic Diminished I', rule: 'd1' })
  })
})

describe('L5 a sus before its own dominant is a suspension', () => {
  it('V7sus4 before the V7 on the same root', () => {
    expect(label(row('C', 'Cmaj7 | Dm7 | G7sus4 | G7 | Cmaj7', 'G7sus4'))).toMatchObject({
      scale: 'G Mixolydian',
      rule: 's3',
      fn: 'V7sus4 before its dominant: a subdominant suspension',
      reason: 'V7sus4 before its dominant: Mixolydian, the 4th is a chord tone here',
    })
  })

  it('named by its own degree on another root', () => {
    expect(label(row('C', 'Cmaj7 | D7sus4 | D7 | G7 | Cmaj7', 'D7sus4'))).toMatchObject({
      scale: 'D Mixolydian',
      rule: 's3',
      fn: 'II7sus4 before its dominant: a subdominant suspension',
      reason: 'II7sus4 before its dominant: Mixolydian, the 4th is a chord tone here',
    })
  })

  it('a sus with no same-root dominant after it stays static', () => {
    expect(label(row('C', 'Cmaj7 | G7sus4 | Fmaj7', 'G7sus4'))).toMatchObject({ scale: 'G Mixolydian', rule: 's3', fn: 'static sus', reason: 'static sus: Mixolydian' })
  })
  it('in a modal chart a sus before its own-root dominant stays static', () => {
    const text = 'title: T\nkey: D\nbars: 16\nA | 1 | Dm7\nA | 5 | G7sus4\nA | 7 | G7\nA | 9 | Ebmaj7\nA | 13 | Dm7\n'
    const a = analyse(parseChart(text).value)
    expect(a.context).toBe('modal')
    expect(label(a.rows.find((r) => r.chord === 'G7sus4') as RowAnalysis)).toMatchObject({ scale: 'G Mixolydian', rule: 's3', fn: 'static sus', reason: 'static sus: Mixolydian' })
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
