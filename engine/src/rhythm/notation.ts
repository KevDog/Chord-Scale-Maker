/**
 * Notation (rhythm spec §6): each bar's events split into drawable notes, with their tuplets, beams and brackets.
 * Pure TypeScript, so the sheet only maps these notes onto its drawing.
 */
import { statementAt, type Laid, type RhythmEvent } from './lay'
import { PULSE_GRID, pulseBeat, type Pulse, type PulseGrid, type RhythmValue } from './rhythm'

export type { RhythmValue } from './rhythm'

/** A tuplet's ratio: `notes` notes in the time of `of` notes of their value. */
export type TupletRatio = Readonly<{ notes: number; of: number }>

/**
 * `beat` is where the note starts in its bar, in beats; `ratio` is set on every note inside a tuplet, and `tuplet`
 * numbers its group in the bar (Phase 4 spec §2).
 */
export type RhythmNote = Readonly<{
  beat: number
  value: RhythmValue
  rest: boolean
  accent: boolean
  tie: boolean
  tiedIn: boolean
  tuplet: number | null
  ratio: TupletRatio | null
  beam: number | null
  bracket: 'start' | 'end' | 'both' | null
}>

/** Straight values by length in 16ths, longest first (§6.2: 4, 3, 2, 1.5, 1 beats, then 0.75, 0.5, 0.25). */
const STRAIGHT: readonly (readonly [number, RhythmValue])[] = [
  [16, 'w'], [12, 'hd'], [8, 'h'], [6, 'qd'], [4, 'q'], [3, '8d'], [2, '8'], [1, '16'],
]

/** Whole-beat values by beats, longest first (§6.3's merged beats, and a tuplet's merged groups). */
const WHOLE_BEATS: readonly (readonly [number, RhythmValue])[] = [[4, 'w'], [3, 'hd'], [2, 'h'], [1, 'q']]

/** A value's length in 16ths. */
const SIXTEENTHS: Readonly<Record<RhythmValue, number>> = { w: 16, hd: 12, h: 8, qd: 6, q: 4, '8d': 3, '8': 2, '16': 1 }

const longest = (table: readonly (readonly [number, RhythmValue])[], n: number): readonly [number, RhythmValue] =>
  table.find(([len]) => len <= n)!

/** One piece of an event, before beams and brackets: `at` and `length` in pulses from the bar's start. */
type Piece = Readonly<{ at: number; length: number; value: RhythmValue; ratio: TupletRatio | null }>

/** A straight event's pieces: off the beat, cut at the next beat; on it, the longest value that fits (§6.2). */
function straightPieces(at: number, length: number, grid: PulseGrid): readonly Piece[] {
  const per = grid.n // a straight pulse's group is one beat
  const sixteenths = 4 / per
  const pieces: Piece[] = []
  for (let p = at, left = length; left > 0; ) {
    const len = p % per !== 0 ? Math.min(left, per - (p % per)) : longest(STRAIGHT, left * sixteenths)[0] / sixteenths
    pieces.push({ at: p, length: len, value: longest(STRAIGHT, len * sixteenths)[1], ratio: null })
    p += len
    left -= len
  }
  return pieces
}

/**
 * A tuplet event's pieces (Phase 4 spec §2, generalizing §6.3): cut at every group of `grid.n` pulses; whole groups
 * from a group's start merge into straight values; anything else is in its group's tuplet, the longest of 4, 3, 2
 * and 1 pulses that fits, the rest tied.
 */
function tupletPieces(at: number, length: number, grid: PulseGrid): readonly Piece[] {
  const { n, beats: group, value: base } = grid
  const pieces: Piece[] = []
  for (let p = at, left = length; left > 0; ) {
    if (p % n === 0 && left >= n) {
      const [beats, value] = WHOLE_BEATS.find(([b]) => b % group === 0 && (b / group) * n <= left)!
      const len = (beats / group) * n
      pieces.push({ at: p, length: len, value, ratio: null })
      p += len
      left -= len
    } else {
      const room = Math.min(left, n - (p % n))
      const len = [4, 3, 2, 1].find(k => k <= room)!
      pieces.push({ at: p, length: len, value: longest(STRAIGHT, len * SIXTEENTHS[base])[1], ratio: grid.tuplet })
      p += len
      left -= len
    }
  }
  return pieces
}

/** The pieces from `at` for `length` pulses at a bar's pulse. */
function pieces(at: number, length: number, pulse: Pulse): readonly Piece[] {
  const grid = PULSE_GRID[pulse]
  return grid.tuplet ? tupletPieces(at, length, grid) : straightPieces(at, length, grid)
}

/**
 * A silence's notation from `at` for `length` pulses at a bar's pulse, as a rest event's (§6.2, §6.3, Phase 4 spec
 * §2): each piece's start, value and tuplet ratio (null outside a tuplet).
 */
export const restPieces = (at: number, length: number, pulse: Pulse): readonly Readonly<{ at: number; value: RhythmValue; ratio: TupletRatio | null }>[] =>
  pieces(at, length, pulse)

/** A tuplet piece's group in its bar: the index of the `grid.n` pulses it starts in. */
export const tupletGroup = (pulse: Pulse, at: number): number => Math.floor(at / PULSE_GRID[pulse].n)

type Split = Readonly<{ note: Omit<RhythmNote, 'beam' | 'bracket'>; at: number; statement: number }>

/**
 * An event's notes: the first piece keeps its accent and tiedIn, the later ones continue it; rests never tie.
 * Each piece takes the statement at its own start, as a barline cut does (§4); a value held across a statement's
 * end without a cut stays with its attack.
 */
function splitEvent(e: RhythmEvent, pulse: Pulse, statement: (at: number) => number): readonly Split[] {
  const split = pieces(e.at, e.length, pulse)
  return split.map((p, i) => ({
    at: p.at,
    statement: statement(p.at),
    note: {
      beat: pulseBeat(pulse, p.at),
      value: p.value,
      rest: e.rest,
      accent: i === 0 && e.accent,
      tiedIn: i === 0 ? e.tiedIn : !e.rest,
      tie: i === split.length - 1 ? e.tie : !e.rest,
      tuplet: p.ratio ? tupletGroup(pulse, p.at) : null,
      ratio: p.ratio,
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
  return laid.bars.map((events, b) => {
    const pulse = laid.pulses[b]!
    const tuplets = PULSE_GRID[pulse].tuplet !== null
    const beatOf = (at: number): number => Math.floor(pulseBeat(pulse, at))
    // a repeating rhythm's statements are counted per step (Phase 4 spec §3)
    const statement = laid.kind === 'repeat' ? statementAt(laid, b) : beatOf
    const splits = events.flatMap(e => splitEvent(e, pulse, statement))
    const tupletOf = renumber(splits.map(s => s.note.tuplet))
    // tuplet notes beam by their group (Phase 4 spec §2), a per-bar rhythm's by the beat (a straight pulse's group)
    const group = (s: Split): number => (tuplets || laid.kind === 'bar' ? tupletGroup(pulse, s.at) : s.statement)
    const beamOf = beams(splits, group)
    // the sheet's first statement in bar 0, and the statement starting each later landing bar
    const bracketed = laid.kind === 'repeat' && laid.landings.includes(b) ? (b === 0 ? 0 : events[0]!.statement) : null
    const bracketOf = brackets(splits, bracketed)
    return splits.map((s, i) => ({ ...s.note, tuplet: tupletOf[i]!, beam: beamOf[i]!, bracket: bracketOf[i]! }))
  })
}
