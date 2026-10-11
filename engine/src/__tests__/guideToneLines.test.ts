import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import { guideToneLine, type LineNote } from '../guideToneLines'
import { guideToneTimeline } from '../guideToneTimeline'
import { guideLabel, guideTonesFor } from '../guideTones'
import { INSTRUMENTS, type InstrumentName } from '../instruments'
import { octaveOf } from '../keySignature'
import { CONCERT, type Part, partFor, rangeOf } from '../part'
import { pcOf, rootName } from '../pitch'
import { isSyncCopy } from '../util'

const BASS: Part = { clef: 'bass', trans: 'C' }
const TENOR: Part = { clef: 'treble', trans: 'Bb' }

type From = 'third' | 'seventh'

/** a note as the spec's tables write it: "Bb4 (7)", then ~ when held from the chord before */
const text = (n: LineNote | null): string | null => n && `${rootName(n.pitch)}${octaveOf(n.pitch)} (${guideLabel(n.label)})${n.held ? '~' : ''}`
const same = (n: LineNote, t: { note: { letter: number; acc: number }; label: string }): boolean =>
  n.pitch.letter === t.note.letter && n.pitch.acc === t.note.acc && n.label === t.label
/** one line (A: from the 3rd, B: from the 7th) over chords in concert pitch (or for a part), as text per chord */
const lineOf = (chords: readonly string[], part: Part = CONCERT, from: From = 'third', blocks?: readonly number[]): (string | null)[] =>
  guideToneLine(
    chords.map((c) => guideTonesFor(part, c)),
    rangeOf(part),
    from,
    blocks,
  ).map(text)

describe('a guide tone line', () => {
  it('rule 1: line A starts on the 3rd, in the octave nearest the centre (A4)', () => {
    expect(lineOf(['Dm7'], CONCERT, 'third')).toEqual(['F4 (3)'])
    expect(lineOf(['Bb6'], CONCERT, 'third')).toEqual(['D5 (3)'])
  })

  it('rule 1: line B starts on the 7th, in the octave nearest the centre (A4)', () => {
    expect(lineOf(['Dm7'], CONCERT, 'seventh')).toEqual(['C5 (7)'])
    expect(lineOf(['Bb6'], CONCERT, 'seventh')).toEqual(['G4 (6)'])
  })

  it('rule 1, placed: a single chord, an octave as far above the centre as below takes the higher (Eb4/Eb5 around A4; G2/G3 around C#3)', () => {
    expect(lineOf(['Cm7'], CONCERT, 'third')).toEqual(['Eb5 (3)'])
    expect(lineOf(['Eb7'], BASS, 'third')).toEqual(['G3 (3)'])
  })

  it('rule 2: a common tone before any move (line A: F4 holds as the b7 of G7)', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
  })

  it('rule 2: a step before a leap (line B: C5 to B4)', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'B4 (3)'])
  })

  it('rule 2: with nothing within a step, the smaller leap (line A: A4 to C5, not F4)', () => {
    expect(lineOf(['F7', 'Dm7'], CONCERT, 'third')).toEqual(['A4 (3)', 'C5 (7)'])
    expect(lineOf(['F7', 'Dm7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F4 (3)'])
  })

  it('rule 2: the role follows the nearer tone, so it keeps on a root moving by a step', () => {
    expect(lineOf(['CMaj7', 'Cm7'], CONCERT, 'third')).toEqual(['E4 (3)', 'Eb4 (3)'])
    expect(lineOf(['CMaj7', 'Cm7'], CONCERT, 'seventh')).toEqual(['B4 (7)', 'Bb4 (7)'])
  })

  it('rule 3.1: two tones equally near: the one nearer the centre (line A: B4 rather than F5 from D5)', () => {
    expect(lineOf(['Bb6', 'G7'], CONCERT, 'third')).toEqual(['D5 (3)', 'B4 (3)'])
  })

  it('rule 3.1: two tones equally near, the lower further from the centre: the upper (line A: F#4 rather than D4 from E4)', () => {
    expect(lineOf(['CMaj7', 'D'], CONCERT, 'third')).toEqual(['E4 (3)', 'F#4 (3)'])
  })

  it('rule 3.1 on line B: C5 rather than F#5 from Eb5, both a minor 3rd away', () => {
    expect(lineOf(['F7', 'D7'], CONCERT, 'seventh')).toEqual(['Eb5 (7)', 'C5 (7)']) // placed: Eb5's run averages as near A4 as Eb4's, so the higher
  })

  it('rule 3.2: equally near and equally central: the lower (line A: F#4 rather than C5 from A4)', () => {
    expect(lineOf(['F7', 'D7'], CONCERT, 'third')).toEqual(['A4 (3)', 'F#4 (3)'])
  })

  const DOWN_WHOLE_STEPS = ['G7', 'F7', 'Eb7', 'Db7', 'B7', 'A7', 'G7']
  it('rule 4: candidates lie inside the written range: at C#4, near the bottom of the treble range (C4), B3 is out, so line A turns up to F4', () => {
    expect(lineOf(DOWN_WHOLE_STEPS, CONCERT, 'third')).toEqual(['B4 (3)', 'A4 (3)', 'G4 (3)', 'F4 (3)', 'D#4 (3)', 'C#4 (3)', 'F4 (7)']) // B4: the only B in range
  })

  it('rule 4: at Fb2 (E2), the bottom of the bass range, Eb2 is out, so line B turns up to C3', () => {
    expect(lineOf(['C7', 'Em7', 'Dbm7', 'Cm'], BASS, 'seventh')).toEqual(['Bb2 (7)', 'G2 (3)', 'Fb2 (3)', 'C3 (1)'])
  })

  it('rule 5: a chord repeating the guide tones holds the line (the same chord again, or a change of extension)', () => {
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'third')).toEqual(['E4 (3)', 'E4 (3)~', 'E4 (3)~'])
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'seventh')).toEqual(['Bb4 (7)', 'Bb4 (7)~', 'Bb4 (7)~'])
    expect(lineOf(['Dm7', 'Dm7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'C5 (7)~'])
  })

  it('rule 5: a common tone of a different chord is struck again, not held', () => {
    expect(lineOf(['Dm7', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
  })

  it('rule 5: the same two pitches in swapped roles are struck again, not held (F and C: Dm7 3 7, G7sus4 7 4)', () => {
    expect(lineOf(['Dm7', 'G7sus4'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)'])
    expect(lineOf(['Dm7', 'G7sus4'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'C5 (4)'])
  })

  it('rule 5: no hold across a block boundary: the same pitch, struck again', () => {
    expect(lineOf(['C7', 'C7b9', 'C7'], CONCERT, 'third', [0, 0, 1])).toEqual(['E4 (3)', 'E4 (3)~', 'E4 (3)'])
  })

  it('rule 6: a chord without guide tones rests and the next restarts the line on its own degree (A: the 3rd, B: the 7th)', () => {
    expect(lineOf(['Dm7', 'Cm7#5#9x', 'G7'], CONCERT, 'third')).toEqual(['F4 (3)', null, 'B4 (3)']) // not F4
    expect(lineOf(['Dm7', 'Cm7#5#9x', 'G7'], CONCERT, 'seventh')).toEqual(['C5 (7)', null, 'F4 (7)']) // not B4
  })

  it('rule 6, placed: the restart is placed like a start, whatever the line sounded before the rest', () => {
    expect(lineOf(['Dm7', '???', 'G7', '???', 'A7'], CONCERT, 'seventh')).toEqual(['C5 (7)', null, 'F4 (7)', null, 'G4 (7)']) // was F5, G5: nearest the last note
    expect(lineOf(['???', 'A7'], CONCERT, 'seventh')).toEqual([null, 'G4 (7)'])
    expect(lineOf(['C7', '???', 'C7'], CONCERT, 'third')).toEqual(['E4 (3)', null, 'E4 (3)']) // not held over the rest
  })

  it('rule 9: a line does not loop, and its placement looks no further than the next rest: what follows a rest leaves it alone', () => {
    const tune = ['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7']
    for (const from of ['third', 'seventh'] as const) {
      const whole = lineOf(tune, CONCERT, from)
      expect(lineOf([...tune, '???', 'F#7', 'B7', 'E7'], CONCERT, from).slice(0, tune.length)).toEqual(whole)
    }
  })

  it("rule 10: a guide tone keeps its chord's spelling, whatever the octave (line B: Fb4, then D#4 a half step below it)", () => {
    expect(lineOf(['Gb7', 'B7'], CONCERT, 'seventh')).toEqual(['Fb4 (7)', 'D#4 (3)'])
    expect(lineOf(['Gb7', 'B7'], CONCERT, 'third')).toEqual(['Bb4 (3)', 'A4 (7)'])
  })
})

/** rule 7 is gone (docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md): no collision rule, no trade */
describe('each line built on its own', () => {
  it('Cmaj7 | Ebmaj7: both lines take D5 (A falls E5 to D5; B rises B4 to D5, the nearer D)', () => {
    expect(lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'third')).toEqual(['E5 (3)', 'D5 (7)'])
    expect(lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'seventh')).toEqual(['B4 (7)', 'D5 (7)'])
  })

  it('both lines may land on the same pitch, where the collision rule once moved one of them', () => {
    expect(lineOf(['Fm7', 'GMaj7'], CONCERT, 'third')).toEqual(['Ab4 (3)', 'F#4 (7)']) // was B4 (the trade)
    expect(lineOf(['Fm7', 'GMaj7'], CONCERT, 'seventh')).toEqual(['Eb4 (7)', 'F#4 (7)'])
    expect(lineOf(['F', 'G'], CONCERT, 'third')).toEqual(['A4 (3)', 'G4 (1)'])
    expect(lineOf(['F', 'G'], CONCERT, 'seventh')).toEqual(['F4 (1)', 'G4 (1)']) // was B4
  })

  it('a line takes the nearer octave of a tone the other line also takes (B: D5, not F5)', () => {
    expect(lineOf(['Cm', 'Dm', 'Bbm'], CONCERT, 'third')).toEqual(['Eb5 (3)', 'D5 (1)', 'Db5 (3)']) // met on D5: up, but nothing of Bbm above D5 in range, so as alone (G2)
    expect(lineOf(['Cm', 'Dm', 'Bbm'], CONCERT, 'seventh')).toEqual(['C5 (1)', 'D5 (1)', 'Db5 (3)']) // was F5, Bb4
  })
})

/**
 * lines that meet go apart, gently (docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md, G1–G3): the lines
 * are built together again, but only so that, after landing on one pitch, they part at the next new chord: one keeps
 * the pitch if the chord has it (G1), or they leave it in opposite directions (G2), never by more than a tritone
 * because of each other (G3)
 */
describe('lines that meet go apart, gently (G1–G3)', () => {
  const both = (chords: readonly string[], blocks?: readonly number[], part: Part = CONCERT): readonly [(string | null)[], (string | null)[]] => [lineOf(chords, part, 'third', blocks), lineOf(chords, part, 'seventh', blocks)]
  const am = guideTonesFor(CONCERT, 'Am')
  if (!am) throw new Error('Am has guide tones')
  const unison = { third: am.third, seventh: { ...am.third, label: '7' } } // a chord whose two guide tones are C and C

  it('G1: Cm7 D7 meet on C5, a guide tone of Dm7: B (below before they met) keeps it, A (above) goes up to F5', () => {
    expect(both(['Cm7', 'D7', 'Dm7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'F5 (3)'],
      ['Bb4 (7)', 'C5 (7)', 'C5 (7)'], // strict: down to F4
    ])
  })

  it('G1: the mover may go up a tritone (D7 again in a new block: A C5 to F#5), while B keeps C5, struck again', () => {
    expect(both(['Cm7', 'D7', 'D7'], [0, 0, 1])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'F#5 (3)'],
      ['Bb4 (7)', 'C5 (7)', 'C5 (7)'], // strict: F#4, a tritone down too
    ])
  })

  it('G1, the tritone cap: met on F4, a guide tone of Dm7, where C5 is 7 above, so the mover takes C4, 5 below, crossing the keeper', () => {
    expect(both(['B7', 'Dm', 'F', 'Dm7'])).toEqual([
      ['D#4 (3)', 'D4 (1)', 'F4 (1)', 'F4 (3)'],
      ['A4 (7)', 'F4 (3)', 'F4 (1)', 'C4 (7)'], // strict: C5
    ])
  })

  it('G1: together since a restart, line A (from the 3rd) keeps the shared pitch', () => {
    const range = { lo: 48, hi: 84, centre: 66 }
    const line = (from: From): (number | undefined)[] => guideToneLine([unison, guideTonesFor(CONCERT, 'Dm7')], range, from).map((n) => n?.pitch.midi)
    expect(line('third')).toEqual([72, 72])
    expect(line('seventh')).toEqual([72, 77]) // F5, the up line's side
  })

  it('G2: Cm7 D7 meet on C5, not a guide tone of G7: A (above before) goes up to F5, B down to B4', () => {
    expect(both(['Cm7', 'D7', 'G7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'F5 (7)'],
      ['Bb4 (7)', 'C5 (7)', 'B4 (3)'], // each alone: both B4
    ])
  })

  it('G2: C7 A7 meet on G4 with B above before; at Dm7 B goes up to C5 and A down to F4', () => {
    expect(both(['C7', 'A7', 'Dm7'])).toEqual([
      ['E4 (3)', 'G4 (7)', 'F4 (3)'],
      ['Bb4 (7)', 'G4 (7)', 'C5 (7)'],
    ])
  })

  it('G2: together since a restart, the line from the 7th goes up', () => {
    const [a, b] = (['third', 'seventh'] as const).map((from) => guideToneLine([unison, guideTonesFor(CONCERT, 'G7')], rangeOf(CONCERT), from).map(text))
    expect(a).toEqual(['C5 (3)', 'B4 (3)'])
    expect(b).toEqual(['C5 (7)', 'F5 (7)'])
  })

  it('G2, the tritone cap: at G, nothing above C5 within a tritone (G5 is 7 above), so A moves as alone, to B4, with B; at F they part', () => {
    expect(both(['Cm7', 'D7', 'G', 'F'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'B4 (3)', 'F5 (1)'], // strict: G5 at the G
      ['Bb4 (7)', 'C5 (7)', 'B4 (3)', 'A4 (3)'],
    ])
  })

  it('G1 at the floor: met on F4, a guide tone of Db7: A (below before) keeps it, B goes up to Cb5', () => {
    expect(both(['B7', 'Dm', 'F', 'Db7'])).toEqual([
      ['D#4 (3)', 'D4 (1)', 'F4 (1)', 'F4 (3)'], // strict: F5, an octave
      ['A4 (7)', 'F4 (3)', 'F4 (1)', 'Cb5 (7)'],
    ])
  })

  it('G1 at the ceiling: met on Eb5 with no Bb above it in range (to A5), the mover takes Bb4, 5 below, and B keeps Eb5', () => {
    expect(both(['Bb', 'Bb7', 'B', 'Ebm', 'Cm7'])).toEqual([
      ['D5 (3)', 'D5 (3)', 'D#5 (3)', 'Eb5 (1)', 'Bb4 (7)'], // strict: Eb4, an octave
      ['Bb4 (1)', 'Ab4 (7)', 'B4 (1)', 'Eb5 (1)', 'Eb5 (3)'],
    ])
  })

  it('G2 at the ceiling: met on D5 with nothing of Bbm above it in range, A moves as alone, to Db5, with B', () => {
    expect(both(['Cm', 'Dm', 'Bbm'])).toEqual([
      ['Eb5 (3)', 'D5 (1)', 'Db5 (3)'], // strict: Bb4
      ['C5 (1)', 'D5 (1)', 'Db5 (3)'],
    ])
  })

  it('G3: with no octave of the other guide tone within a tritone in range (C4–C5: F4 is 7 below C5), the mover stays with the keeper', () => {
    const range = { lo: 60, hi: 72, centre: 66 }
    const line = (from: From): (number | undefined)[] => guideToneLine([unison, guideTonesFor(CONCERT, 'Dm7')], range, from).map((n) => n?.pitch.midi)
    expect(line('third')).toEqual([72, 72])
    expect(line('seventh')).toEqual([72, 72]) // strict: F4
  })

  it('G3: a unison chord again and again in C4–C5: the only other octave is an octave away, so the lines stay together', () => {
    const range = { lo: 60, hi: 72, centre: 66 }
    const line = (from: From): (number | undefined)[] => guideToneLine([unison, unison, unison], range, from, [0, 1, 2]).map((n) => n?.pitch.midi)
    expect(line('third')).toEqual([72, 72, 72]) // placed: C4 and C5 as far from the centre, so the higher
    expect(line('seventh')).toEqual([72, 72, 72]) // strict: 60, 72
  })

  it('with no candidate at all in range (a toy range C4–D4, no B or F), the lines rest there, as a single line does, rather than fail', () => {
    const range = { lo: 60, hi: 62, centre: 61 }
    for (const from of ['third', 'seventh'] as const)
      expect(guideToneLine([unison, guideTonesFor(CONCERT, 'G7')], range, from).map((n) => n?.pitch.midi ?? null)).toEqual([60, null])
  })

  it('D3: once apart, each line moves by rules 2–6 on its own (CMaj7: A steps F5 to E5, B holds B4 as a common tone)', () => {
    expect(both(['Cm7', 'D7', 'G7', 'CMaj7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'F5 (7)', 'E5 (3)'],
      ['Bb4 (7)', 'C5 (7)', 'B4 (3)', 'B4 (7)'],
    ])
  })

  it('D3, holds: a held chord holds both lines on the shared pitch; at the first new chord B keeps it, struck again (G1)', () => {
    expect(both(['Cm7', 'D7', 'D7', 'Dm7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'C5 (7)~', 'F5 (3)'],
      ['Bb4 (7)', 'C5 (7)', 'C5 (7)~', 'C5 (7)'],
    ])
  })

  it('D3, holds: a held chord holds both lines; they part at the first new chord (G2)', () => {
    expect(both(['Cm7', 'D7', 'D7', 'G7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', 'C5 (7)~', 'F5 (7)'],
      ['Bb4 (7)', 'C5 (7)', 'C5 (7)~', 'B4 (3)'],
    ])
  })

  it('D3, rests: a rest ends the run, and the next chord restarts each line by rule 6, not by G1 or G2', () => {
    expect(both(['Cm7', 'D7', '???', 'Dm7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', null, 'F4 (3)'], // G1 would send A to F5
      ['Bb4 (7)', 'C5 (7)', null, 'C5 (7)'],
    ])
    expect(both(['Cm7', 'D7', '???', 'G7'])).toEqual([
      ['Eb5 (3)', 'C5 (7)', null, 'B4 (3)'],
      ['Bb4 (7)', 'C5 (7)', null, 'F4 (7)'],
    ])
  })
})

/**
 * placing a run (docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md, approved by the user 2026-10-11): at a
 * start or restart, the octave whose run, up to the next rest, averages nearest the centre (a tie: the higher)
 */
describe('placing a run nearest the centre', () => {
  const VIBES = partFor('vibes')
  const pitches = (line: readonly (string | null)[]): (string | null)[] => line.map((n) => n && n.replace(/ .*/, ''))
  const NICHOLAS = ['CMaj7', 'EbMaj7', 'AbMaj7', 'DbMaj7', 'CMaj7', 'EbMaj7', 'AbMaj7', 'DbMaj7', 'CMaj7', 'GbMaj7', 'CMaj7', 'DbMaj7']

  it('A Song for Nicholas on vibes, from the 3rd: line A starts on E5, not E4, whose run sinks to B♭3', () => {
    // alone, the run from E5 reads E5 D5 C5 C5 B4 D5 C5 C5 B4 Bb4 B4 C5; here line B (B4 D5 …) meets it on D5, and
    // A, above before they met, goes up at AbMaj7 (D1)
    expect(pitches(lineOf(NICHOLAS, VIBES, 'third'))).toEqual(['E5', 'D5', 'G5', 'F5', 'E5', 'D5', 'G5', 'F5', 'E5', 'F5', 'E5', 'F5'])
    expect(pitches(lineOf(NICHOLAS, VIBES, 'seventh'))).toEqual(['B4', 'D5', 'C5', 'C5', 'B4', 'D5', 'C5', 'C5', 'B4', 'Bb4', 'B4', 'C5'])
  })

  it('placement weighs each run as it really goes, turned at the floor (G7 Gb7 F7 E7 Eb7 D7, toy ranges around E4)', () => {
    const chain = ['G7', 'Gb7', 'F7', 'E7', 'Eb7', 'D7'].map((c) => guideTonesFor(CONCERT, c))
    const from = (lo: number): number[] => guideToneLine(chain, { lo, hi: 84, centre: 64 }, 'third').map((n) => n?.pitch.midi ?? 0)
    expect(from(54)).toEqual([71, 70, 69, 68, 67, 66]) // the run from B3 sinks to F#3 (average 56.5): B4's (68.5) is nearer
    expect(from(58)).toEqual([59, 58, 63, 62, 61, 60]) // floor B♭3: the run from B3 turns up to E♭4 (average 60.5) and wins
  })

  it('a restart after a rest is placed the same way: the run after the rest reads as it would alone', () => {
    const run = ['G7', 'CMaj7', 'Fm7', 'Bb7']
    for (const from of ['third', 'seventh'] as const) {
      expect(lineOf(['Dm7', 'Dm7', '???', ...run], CONCERT, from).slice(3)).toEqual(lineOf(run, CONCERT, from))
      expect(lineOf(['F#7', 'B7', '???', ...run], CONCERT, from).slice(3)).toEqual(lineOf(run, CONCERT, from))
    }
  })

  it('a tie between two placements is exact, not decided by rounding the averages (guitar doxy and clarinet misty, from the 7th)', () => {
    const first = (chart: string, instrument: InstrumentName): number | undefined => {
      const doc = parseChart(readFileSync(new URL(`../../charts/${chart}.txt`, import.meta.url), 'utf8')).value
      const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
      const part = partFor(instrument)
      return guideToneLine(events.map((e) => guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined)), rangeOf(part), 'seventh').find((n) => n)?.pitch.midi
    }
    expect(first('doxy', 'guitar')).toBe(80) // A♭5: its run averages exactly as far above F♯4 as A♭4's below
    expect(first('misty', 'clarinet')).toBe(76)
  })

  it('a tie between two placements takes the higher (Cm7 alone: Eb4 and Eb5 are as far from A4)', () => {
    expect(lineOf(['Cm7'], CONCERT, 'third')).toEqual(['Eb5 (3)'])
  })
})

/** the spec's worked examples (treble, concert): each table row is a line, each cell "pitch (label)" */
describe('the worked examples', () => {
  it('ii–V–I in C: Dm7 | G7 | Cmaj7 | Cmaj7, line A', () => {
    expect(lineOf(['Dm7', 'G7', 'CMaj7', 'CMaj7'], CONCERT, 'third')).toEqual(['F4 (3)', 'F4 (7)', 'E4 (3)', 'E4 (3)~']) // the second Cmaj7 holds (rule 5)
  })

  it('ii–V–I in C: Dm7 | G7 | Cmaj7 | Cmaj7, line B', () => {
    expect(lineOf(['Dm7', 'G7', 'CMaj7', 'CMaj7'], CONCERT, 'seventh')).toEqual(['C5 (7)', 'B4 (3)', 'B4 (7)', 'B4 (7)~'])
  })

  const RHYTHM = ['Bb6', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7']
  it('Rhythm changes, bars 1–4: Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7, line A', () => {
    expect(lineOf(RHYTHM, CONCERT, 'third')).toEqual(['D5 (3)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)', 'C5 (7)', 'B4 (3)', 'Bb4 (7)', 'A4 (3)'])
  })

  it('Rhythm changes, bars 1–4: Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7, line B', () => {
    expect(lineOf(RHYTHM, CONCERT, 'seventh')).toEqual(['G4 (6)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)', 'F4 (3)', 'F4 (7)', 'Eb4 (3)', 'Eb4 (7)'])
  })
})

describe('a guide tone line in an instrument’s range', () => {
  const VIBES = partFor('vibes')

  it('rule 4 on vibes: at C#4 line A steps down to B3 (written below C4), where the treble default turned up to F4', () => {
    const chords = ['G7', 'F7', 'Eb7', 'Db7', 'B7', 'A7', 'G7']
    expect(lineOf(chords, CONCERT, 'third').at(-1)).toEqual('F4 (7)') // the default range: C4 is the floor
    expect(lineOf(chords, VIBES, 'third')).toEqual(['B4 (3)', 'A4 (3)', 'G4 (3)', 'F4 (3)', 'D#4 (3)', 'C#4 (3)', 'B3 (3)'])
  })

  it('rule 1 on vibes: a line starts in the octave nearest B♭4', () => {
    expect(lineOf(['Dm7'], VIBES, 'third')).toEqual(['F4 (3)'])
    expect(lineOf(['Dm7'], VIBES, 'seventh')).toEqual(['C5 (7)'])
    expect(lineOf(['Ebm7'], VIBES, 'third')).toEqual(['Gb4 (3)']) // Gb4 (66) and Gb5 (78): 4 and 8 from B♭4
  })

  for (const from of ['third', 'seventh'] as const) {
    it(`a trumpet’s line from the ${from} stays within G3–G5 written`, () => {
      const trumpet = partFor('trumpet')
      const line = guideToneLine(['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7'].map((c) => guideTonesFor(trumpet, c)), rangeOf(trumpet), from)
      expect(line.every((n) => n !== null)).toBe(true)
      for (const n of line) expect(n && n.pitch.midi >= 55 && n.pitch.midi <= 79).toBe(true)
    })
  }
})

describe('guide tone lines over the library', () => {
  const LIBRARY = new URL('../../charts/', import.meta.url)
  const charts = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))

  const PARTS: readonly (readonly [string, Part])[] = [
    ['treble (concert)', CONCERT],
    ['bass', BASS],
    ['Bb tenor', TENOR],
    ...(Object.keys(INSTRUMENTS) as InstrumentName[]).map((n) => [n, partFor(n)] as const),
  ]
  for (const [name, part] of PARTS)
    for (const from of ['third', 'seventh'] as const) {
      it(`${name}, from the ${from}: the line sounds at every voiced chord, on its guide tones, inside the range`, () => {
        expect(charts.length).toBeGreaterThan(200)
        const { lo, hi } = rangeOf(part)
        const faults: string[] = []
        let voiced = 0
        for (const { f, doc } of charts) {
          const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
          const tones = events.map((e) => guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined))
          const line = guideToneLine(tones, rangeOf(part), from)
          if (line.length !== tones.length) faults.push(`${f}: ${line.length} notes for ${tones.length} chords`)
          tones.forEach((t, i) => {
            const n = line[i]
            const at = `${f} chord ${i} (${events[i]?.chord})`
            if (!t) return void (n && faults.push(`${at}: sounds without guide tones`))
            if (!n) return void faults.push(`${at}: rests`)
            voiced++
            if (n.pitch.midi < lo || n.pitch.midi > hi) faults.push(`${at}: ${rootName(n.pitch)}${octaveOf(n.pitch)} out of range`)
            if (!same(n, n.role ? t.seventh : t.third)) faults.push(`${at}: ${rootName(n.pitch)} is not the chord's guide tone`)
          })
        }
        expect(faults).toEqual([])
        expect(voiced).toBeGreaterThan(8000)
      })
    }

  for (const [name, part] of PARTS)
    it(`${name}: lines that share a pitch part gently at the next new chord: one keeps a common tone, neither leaps past a tritone because of the other`, () => {
      const faults: string[] = []
      let met = 0
      const { lo, hi } = rangeOf(part)
      const inRange = (pcs: readonly number[]): number[] => {
        const out: number[] = []
        for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m)
        return out
      }
      for (const { f, doc } of charts) {
        const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
        const tones = events.map((e) => guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined))
        const [a, b] = (['third', 'seventh'] as const).map((from) => guideToneLine(tones, rangeOf(part), from))
        tones.forEach((_, j) => {
          const [x, y, nx, ny, t] = [a?.[j], b?.[j], a?.[j + 1], b?.[j + 1], tones[j + 1]]
          if (!x || !y || !nx || !ny || !t || nx.held || x.pitch.midi !== y.pitch.midi) return
          met++
          const p = x.pitch.midi
          const at = `${f} chord ${j + 1} (${events[j + 1]?.chord}) from ${p}`
          const [n, m] = [nx.pitch.midi, ny.pitch.midi]
          const [p3, p7] = [pcOf(t.third.note), pcOf(t.seventh.note)]
          if (p % 12 === p3 || p % 12 === p7) {
            // G1: one keeps p; the other goes to the other guide tone within a tritone, or stays (G3)
            if (n !== p && m !== p) return void faults.push(`${at}: neither kept the common tone`)
            const mover = n === p ? m : n
            const others = inRange([p % 12 === p3 ? p7 : p3]).filter((c) => c !== p && Math.abs(c - p) <= 6)
            if (mover === p ? others.length > 0 : Math.abs(mover - p) > 6) faults.push(`${at}: the mover went to ${mover}`)
          } else {
            // G2: each within a tritone on its side, or as alone (rules 2–4); together again only if one had no room
            const cands = inRange([p3, p7])
            const alone = Math.min(...cands.map((c) => Math.abs(c - p)))
            for (const q of [n, m]) if (Math.abs(q - p) > Math.max(6, alone)) faults.push(`${at}: a line moved to ${q}`)
            const room = (side: number): boolean => cands.some((c) => (c - p) * side > 0 && Math.abs(c - p) <= 6)
            if (n === m && room(1) && room(-1)) faults.push(`${at}: still together on ${n}`)
          }
        })
      }
      expect(faults).toEqual([])
      expect(met).toBeGreaterThan(0)
    })
})
