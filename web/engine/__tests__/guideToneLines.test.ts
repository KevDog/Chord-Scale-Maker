import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import { guideToneLines, type LineNote } from '../guideToneLines'
import { guideToneTimeline } from '../guideToneTimeline'
import { guideLabel, guideTonesFor } from '../guideTones'
import type { Clef } from '../instruments'
import { octaveOf } from '../keySignature'
import { CONCERT, type Part } from '../part'
import { pcOf, rootName } from '../pitch'
import { isSyncCopy } from '../util'
import { RANGES } from '../voiceLeading'

const BASS: Part = { clef: 'bass', trans: 'C' }
const TENOR: Part = { clef: 'treble', trans: 'Bb' }

/** a note as the spec's tables write it: "Bb4 (7)", then ~ when held from the chord before */
const text = (n: LineNote | null): string | null => n && `${rootName(n.pitch)}${octaveOf(n.pitch)} (${guideLabel(n.label)})${n.held ? '~' : ''}`
const same = (n: LineNote, t: { note: { letter: number; acc: number }; label: string }): boolean =>
  n.pitch.letter === t.note.letter && n.pitch.acc === t.note.acc && n.label === t.label
/** lines A and B over chords in concert pitch (or for a part), as text */
const linesOf = (chords: readonly string[], part: Part = CONCERT, blocks?: readonly number[]) => {
  const [a, b] = guideToneLines(chords.map((c) => guideTonesFor(part, c)), part.clef as Clef, blocks)
  return { a: a.map(text), b: b.map(text) }
}

describe('guide tone lines', () => {
  it('rule 1: line A starts on the 3rd, line B on the 7th, each in the octave nearest the centre (A4)', () => {
    expect(linesOf(['Dm7'])).toEqual({ a: ['F4 (3)'], b: ['C5 (7)'] })
    expect(linesOf(['Bb6'])).toEqual({ a: ['D5 (3)'], b: ['G4 (6)'] })
  })

  it('rule 1: an octave as far above the centre as below takes the lower (Eb4/Eb5 around A4; G2/G3 around C#3)', () => {
    expect(linesOf(['Cm7']).a).toEqual(['Eb4 (3)'])
    expect(linesOf(['Eb7'], BASS).a).toEqual(['G2 (3)'])
  })

  it('rule 2: a common tone before any move (F4 holds as the b7 of G7), a step before a leap (C5 to B4)', () => {
    expect(linesOf(['Dm7', 'G7'])).toEqual({ a: ['F4 (3)', 'F4 (7)'], b: ['C5 (7)', 'B4 (3)'] })
  })

  it('rule 2: with nothing within a step, the smaller leap (A4 to C5, not F4)', () => {
    expect(linesOf(['F7', 'Dm7'])).toEqual({ a: ['A4 (3)', 'C5 (7)'], b: ['Eb4 (7)', 'F4 (3)'] })
  })

  it('rule 2: the role follows the nearer tone, so it changes on a root moving by a 4th and keeps on a step', () => {
    expect(linesOf(['CMaj7', 'Cm7'])).toEqual({ a: ['E4 (3)', 'Eb4 (3)'], b: ['B4 (7)', 'Bb4 (7)'] })
  })

  it('rule 3.1: two tones equally near: the one nearer the centre (B4 rather than F5 from D5)', () => {
    expect(linesOf(['Bb6', 'G7']).a).toEqual(['D5 (3)', 'B4 (3)'])
  })

  it('rule 3.1: two tones equally near, the lower further from the centre: the upper (F#4 rather than D4 from E4)', () => {
    expect(linesOf(['CMaj7', 'D'])).toEqual({ a: ['E4 (3)', 'F#4 (3)'], b: ['B4 (7)', 'D5 (1)'] })
  })

  it('rule 3.2: equally near and equally central: the lower (F#4 rather than C5 from A4)', () => {
    expect(linesOf(['F7', 'D7']).a).toEqual(['A4 (3)', 'F#4 (3)'])
  })

  it('rule 4: candidates lie inside the written range: at E2, the bottom of the bass range, the line turns up to Eb3', () => {
    expect(linesOf(['Ab', 'G', 'Gb', 'F', 'E', 'Eb'], BASS)).toEqual({
      a: ['C3 (3)', 'B2 (3)', 'Bb2 (3)', 'A2 (3)', 'G#2 (3)', 'G2 (3)'],
      b: ['Ab2 (1)', 'G2 (1)', 'Gb2 (1)', 'F2 (1)', 'E2 (1)', 'Eb3 (1)'],
    })
  })
  it('rule 7.1: each line chooses for itself, and the two choices stand when they differ', () => {
    expect(linesOf(['Bb6', 'G7'])).toEqual({ a: ['D5 (3)', 'B4 (3)'], b: ['G4 (6)', 'F4 (7)'] })
  })

  it('rule 7.2: both choose the same tone: the smaller move keeps it, the other line takes the remaining tone nearest its note', () => {
    expect(linesOf(['CMaj7', 'EbMaj7'])).toEqual({ a: ['E4 (3)', 'D4 (7)'], b: ['B4 (7)', 'G4 (3)'] })
  })

  it('rule 7.2: equal moves: the line moving down keeps the tone, whichever line it is', () => {
    expect(linesOf(['F7', 'D7'])).toEqual({ a: ['A4 (3)', 'F#4 (3)'], b: ['Eb4 (7)', 'C4 (7)'] }) // A falls to F#4
    expect(linesOf(['Cm6', 'D7'])).toEqual({ a: ['Eb4 (3)', 'C4 (7)'], b: ['A4 (6)', 'F#4 (3)'] }) // B falls to F#4
  })

  it('rule 7.3: the lines may cross (A from above B to below it)', () => {
    expect(linesOf(['Fm7', 'GMaj7'])).toEqual({ a: ['Ab4 (3)', 'F#4 (7)'], b: ['Eb4 (7)', 'B4 (3)'] })
  })

  it('rule 7: the lines are complementary: different tones at every chord, even where both would choose the same', () => {
    const [a, b] = guideToneLines(['CMaj7', 'EbMaj7', 'F7', 'D7', 'Cm6', 'D7', 'Fm7', 'GMaj7'].map((c) => guideTonesFor(CONCERT, c)), 'treble')
    a.forEach((n, i) => expect(n?.role, `chord ${i}`).not.toBe(b[i]?.role))
  })
  it('rule 5: a chord repeating the guide tones holds both lines (the same chord again, or a change of extension)', () => {
    expect(linesOf(['C7', 'C7b9', 'C7'])).toEqual({ a: ['E4 (3)', 'E4 (3)~', 'E4 (3)~'], b: ['Bb4 (7)', 'Bb4 (7)~', 'Bb4 (7)~'] })
    expect(linesOf(['Dm7', 'Dm7'])).toEqual({ a: ['F4 (3)', 'F4 (3)~'], b: ['C5 (7)', 'C5 (7)~'] })
  })

  it('rule 5: a common tone of a different chord is struck again, not held', () => {
    expect(linesOf(['Dm7', 'G7']).a).toEqual(['F4 (3)', 'F4 (7)'])
  })

  it('rule 5: no hold across a block boundary: the same pitches, struck again', () => {
    expect(linesOf(['C7', 'C7b9', 'C7'], CONCERT, [0, 0, 1])).toEqual({ a: ['E4 (3)', 'E4 (3)~', 'E4 (3)'], b: ['Bb4 (7)', 'Bb4 (7)~', 'Bb4 (7)'] })
  })

  it('rule 6: a chord without guide tones rests in both lines and the next restarts A on its 3rd, B on its 7th', () => {
    expect(linesOf(['Dm7', 'Cm7#5#9x', 'G7'])).toEqual({ a: ['F4 (3)', null, 'B4 (3)'], b: ['C5 (7)', null, 'F5 (7)'] }) // not F4, B4
  })

  it("rule 6: the restart takes the octave nearest each line's last sounded note, or the centre if there is none", () => {
    expect(linesOf(['Dm7', '???', 'G7', '???', 'A7']).b).toEqual(['C5 (7)', null, 'F5 (7)', null, 'G5 (7)']) // G5 from F5, not G4
    expect(linesOf(['???', 'A7']).b).toEqual([null, 'G4 (7)'])
    expect(linesOf(['C7', '???', 'C7']).a).toEqual(['E4 (3)', null, 'E4 (3)']) // not held over the rest
  })

  it('rule 9: the lines do not loop or look ahead: a longer chart only extends them', () => {
    const tune = ['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7']
    const whole = linesOf(tune)
    for (let n = 1; n < tune.length; n++) expect(linesOf(tune.slice(0, n))).toEqual({ a: whole.a.slice(0, n), b: whole.b.slice(0, n) })
  })

  it("rule 10: a guide tone keeps its chord's spelling, whatever the octave (Fb4, then D#4 a half step below it)", () => {
    expect(linesOf(['Gb7', 'B7'])).toEqual({ a: ['Bb4 (3)', 'A4 (7)'], b: ['Fb4 (7)', 'D#4 (3)'] })
  })
})

/** the spec's worked examples (treble, concert), verbatim: each table row is a line, each cell "pitch (label)" */
describe('the worked examples', () => {
  it('ii–V–I in C: Dm7 | G7 | Cmaj7 | Cmaj7', () => {
    const { a, b } = linesOf(['Dm7', 'G7', 'CMaj7', 'CMaj7'])
    expect(a.map((n) => n?.replace('~', ''))).toEqual(['F4 (3)', 'F4 (7)', 'E4 (3)', 'E4 (3)'])
    expect(b.map((n) => n?.replace('~', ''))).toEqual(['C5 (7)', 'B4 (3)', 'B4 (7)', 'B4 (7)'])
    expect([a[3], b[3]]).toEqual(['E4 (3)~', 'B4 (7)~']) // the second Cmaj7 holds (rule 5)
  })

  it('Rhythm changes, bars 1–4: Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7', () => {
    expect(linesOf(['Bb6', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7'])).toEqual({
      a: ['D5 (3)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)', 'C5 (7)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)'],
      b: ['G4 (6)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)', 'F4 (3)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)'],
    })
  })

  it('a collision: Cmaj7 | Ebmaj7', () => {
    expect(linesOf(['CMaj7', 'EbMaj7'])).toEqual({ a: ['E4 (3)', 'D4 (7)'], b: ['B4 (7)', 'G4 (3)'] })
  })
})

describe('guide tone lines over the library', () => {
  const LIBRARY = new URL('../../../charts/', import.meta.url)
  const charts = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))

  for (const [name, part] of [['treble (concert)', CONCERT], ['bass', BASS], ['Bb tenor', TENOR]] as const) {
    it(`${name}: both lines sound at every voiced chord, on different guide tones, inside the written range`, () => {
      expect(charts.length).toBeGreaterThan(200)
      const { lo, hi } = RANGES[part.clef]
      const faults: string[] = []
      let voiced = 0
      for (const { f, doc } of charts) {
        const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
        const tones = events.map((e) => guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined))
        const [a, b] = guideToneLines(tones, part.clef)
        tones.forEach((t, i) => {
          const [x, y] = [a[i], b[i]]
          const at = `${f} chord ${i} (${events[i]?.chord})`
          if (!t) {
            if (x || y) faults.push(`${at}: sounds without guide tones`)
            return
          }
          if (!x || !y) return void faults.push(`${at}: a line rests`)
          voiced++
          if (x.role === y.role || pcOf(x.pitch) === pcOf(y.pitch)) faults.push(`${at}: both lines on ${rootName(x.pitch)}`)
          for (const n of [x, y]) {
            if (n.pitch.midi < lo || n.pitch.midi > hi) faults.push(`${at}: ${rootName(n.pitch)}${octaveOf(n.pitch)} out of range`)
            if (!same(n, n.role ? t.seventh : t.third)) faults.push(`${at}: ${rootName(n.pitch)} is not the chord's guide tone`)
          }
        })
      }
      expect(faults).toEqual([])
      expect(voiced).toBeGreaterThan(8000)
    })
  }
})
