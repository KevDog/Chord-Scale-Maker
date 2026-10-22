/**
 * Notation (rhythm spec §6): each bar's events split into drawable notes, with their tuplets, beams and brackets.
 * Pure TypeScript, so the sheet only maps these notes onto its drawing.
 */
import type { Laid, RhythmEvent } from './lay'
import { PULSE_PER_BEAT } from './rhythm'

export type RhythmValue = 'w' | 'hd' | 'h' | 'qd' | 'q' | '8d' | '8' | '16'

/** `beat` is where the note starts in its bar, in beats: halves and quarters of a beat, or thirds under `8t`. */
export type RhythmNote = Readonly<{
  beat: number
  value: RhythmValue
  rest: boolean
  accent: boolean
  tie: boolean
  tiedIn: boolean
  tuplet: number | null
  beam: number | null
  bracket: 'start' | 'end' | 'both' | null
}>

/** Straight values by length in 16ths, longest first (§6.2: 4, 3, 2, 1.5, 1 beats, then 0.75, 0.5, 0.25). */
const STRAIGHT: readonly (readonly [number, RhythmValue])[] = [
  [16, 'w'], [12, 'hd'], [8, 'h'], [6, 'qd'], [4, 'q'], [3, '8d'], [2, '8'], [1, '16'],
]

/** Whole-beat values by beats, longest first (§6.3's merged beats). */
const WHOLE_BEATS: readonly (readonly [number, RhythmValue])[] = [[4, 'w'], [3, 'hd'], [2, 'h'], [1, 'q']]

const longest = (table: readonly (readonly [number, RhythmValue])[], n: number): readonly [number, RhythmValue] =>
  table.find(([len]) => len <= n)!

/** One piece of an event, before beams and brackets: `at` and `length` in pulses from the bar's start. */
type Piece = Readonly<{ at: number; length: number; value: RhythmValue; triplet: boolean }>

/** A straight event's pieces: off the beat, cut at the next beat; on it, the longest value that fits (§6.2). */
function straightPieces(at: number, length: number, per: number): readonly Piece[] {
  const sixteenths = 4 / per
  const pieces: Piece[] = []
  for (let p = at, left = length; left > 0; ) {
    const len = p % per !== 0 ? Math.min(left, per - (p % per)) : longest(STRAIGHT, left * sixteenths)[0] / sixteenths
    pieces.push({ at: p, length: len, value: longest(STRAIGHT, len * sixteenths)[1], triplet: false })
    p += len
    left -= len
  }
  return pieces
}

/** A triplet event's pieces: cut at every beat; whole beats from the beat merge, anything else is in a tuplet (§6.3). */
function tripletPieces(at: number, length: number): readonly Piece[] {
  const pieces: Piece[] = []
  for (let p = at, left = length; left > 0; ) {
    if (p % 3 === 0 && left >= 3) {
      const [beats, value] = longest(WHOLE_BEATS, Math.floor(left / 3))
      pieces.push({ at: p, length: beats * 3, value, triplet: false })
      p += beats * 3
      left -= beats * 3
    } else {
      const len = Math.min(left, 3 - (p % 3))
      pieces.push({ at: p, length: len, value: len === 1 ? '8' : 'q', triplet: true })
      p += len
      left -= len
    }
  }
  return pieces
}

type Split = Readonly<{ note: Omit<RhythmNote, 'beam' | 'bracket'>; at: number; statement: number }>

/**
 * An event's notes: the first piece keeps its accent and tiedIn, the later ones continue it; rests never tie.
 * Each piece takes the statement at its own start, as a barline cut does (§4); a value held across a statement's
 * end without a cut stays with its attack.
 */
function splitEvent(e: RhythmEvent, per: number, triplets: boolean, statement: (at: number) => number): readonly Split[] {
  const pieces = triplets ? tripletPieces(e.at, e.length) : straightPieces(e.at, e.length, per)
  return pieces.map((p, i) => ({
    at: p.at,
    statement: statement(p.at),
    note: {
      beat: p.at / per,
      value: p.value,
      rest: e.rest,
      accent: i === 0 && e.accent,
      tiedIn: i === 0 ? e.tiedIn : !e.rest,
      tie: i === pieces.length - 1 ? e.tie : !e.rest,
      tuplet: p.triplet ? Math.floor(p.at / per) : null,
    },
  }))
}

/** Renumbers keys from 0 in order of first appearance, keeping null. */
function renumber(keys: readonly (number | null)[]): readonly (number | null)[] {
  const seen = [...new Set(keys.filter((k): k is number => k !== null))]
  return keys.map(k => (k === null ? null : seen.indexOf(k)))
}

const BEAMED: ReadonlySet<RhythmValue> = new Set(['8', '8d', '16'])

/** Beam groups (§6.4): runs of beamable notes with the same group key, never across a rest; one note has none. */
function beams(splits: readonly Split[], group: (s: Split) => number): readonly (number | null)[] {
  const runs: number[] = []
  let run = -1
  splits.forEach((s, i) => {
    const prev = splits[i - 1]
    const beamable = !s.note.rest && BEAMED.has(s.note.value)
    const joins = beamable && prev !== undefined && runs[i - 1]! >= 0 && group(prev) === group(s)
    if (beamable && !joins) run++
    runs.push(beamable ? run : -1)
  })
  const sizes = runs.reduce<Map<number, number>>((m, r) => m.set(r, (m.get(r) ?? 0) + 1), new Map())
  return renumber(runs.map(r => (r >= 0 && sizes.get(r)! > 1 ? r : null)))
}

/** The bracket over one statement's notes in a bar (§6.5): `start` on the first, `end` on the last. */
function brackets(splits: readonly Split[], statement: number | null): readonly RhythmNote['bracket'][] {
  const inside = splits.flatMap((s, i) => (s.statement === statement ? [i] : []))
  const first = inside[0]
  const last = inside.at(-1)
  return splits.map((_, i) => (i === first && i === last ? 'both' : i === first ? 'start' : i === last ? 'end' : null))
}

/** Each bar's drawable notes, one array a bar (§6). */
export function rhythmNotes(laid: Laid): readonly (readonly RhythmNote[])[] {
  const per = PULSE_PER_BEAT[laid.pulse]
  const triplets = laid.pulse === '8t'
  return laid.bars.map((events, b) => {
    const statement = (at: number): number =>
      laid.kind === 'repeat' ? Math.floor((laid.starts[b]! + at) / laid.unit) : Math.floor(at / per)
    const splits = events.flatMap(e => splitEvent(e, per, triplets, statement))
    const tuplets = renumber(splits.map(s => s.note.tuplet))
    const group = (s: Split): number => (triplets || laid.kind === 'bar' ? Math.floor(s.at / per) : s.statement)
    const beamOf = beams(splits, group)
    // the sheet's first statement in bar 0, and the statement starting each later landing bar
    const bracketed = laid.kind === 'repeat' && laid.landings.includes(b) ? (b === 0 ? 0 : events[0]!.statement) : null
    const bracketOf = brackets(splits, bracketed)
    return splits.map((s, i) => ({ ...s.note, tuplet: tuplets[i]!, beam: beamOf[i]!, bracket: bracketOf[i]! }))
  })
}
