import type { Key } from './analysis/keys'
import { arpeggioTones } from './arpeggios'
import type { ArpDirection, ArpeggioLineNotes, ArpeggioSheetModel, ArpeggioStaffModel } from './arpeggioSheet'
import { type Row, qualityScale } from './chart'
import { chordTokensOrNull, writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { type Part, type Pitched, rangeOf, scaleLabel, writtenScale } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { resolveQuality } from './qualities'
import type { Resolved } from './resolve'
import { scaleLines } from './sheet'
import type { Range } from './instruments'
import { chunk, orNull } from './util'

/** A pattern's moves: steps between neighbouring notes of a collection, up (+) or down (−). */
export type Moves = readonly number[]

const MIN_MOVES = 2
const MAX_MOVES = 8
const MAX_MOVE = 7
const MAX_SUM = 4

const sum = (moves: Moves): number => moves.reduce((a, b) => a + b, 0)

/** The moves from text (`+1 +1 +1 −2`): hyphen, minus or en dash, spaces or commas, a bare number is up. */
export function parsePattern(text: string): Readonly<{ moves: Moves }> | Readonly<{ error: string }> {
  const tokens = text
    .replace(/[−–]/g, '-')
    .split(/[\s,]+/)
    .filter((t) => t !== '')
  if (tokens.length === 0) return { error: 'Write the moves, like +1 +1 +1 −2.' }
  const moves: number[] = []
  for (const t of tokens) {
    if (!/^[+-]?\d+$/.test(t)) return { error: `“${t}” is not a move; write a whole number of steps like +2 or −1.` }
    moves.push(Number(t))
  }
  if (moves.length < MIN_MOVES || moves.length > MAX_MOVES) return { error: `Use ${MIN_MOVES} to ${MAX_MOVES} moves.` }
  if (moves.some((m) => m === 0)) return { error: 'A move of 0 stays on the same note; use 1 to 7 steps.' }
  if (moves.some((m) => Math.abs(m) > MAX_MOVE)) return { error: `Each move is 1 to ${MAX_MOVE} steps.` }
  const total = sum(moves)
  if (total < 1 || total > MAX_SUM) return { error: `The moves must add up to 1 to ${MAX_SUM} (these add up to ${total}).` }
  let at = 0
  for (const m of moves.slice(0, -1)) {
    at += m
    if (at < 0) return { error: 'A group may not go below its first note.' }
  }
  return { moves }
}

/** The canonical text of moves: `+1 +1 +1 −2` (U+2212 minus). */
export const formatPattern = (moves: Moves): string => moves.map((m) => (m < 0 ? `−${-m}` : `+${m}`)).join(' ')

const stepwise = (id: string, moves: Moves) => ({ id, label: formatLabel(moves), moves })

/** A stepwise pattern's name: its first group counted from 1. */
function formatLabel(moves: Moves): string {
  let at = 0
  const notes = [1]
  for (const m of moves.slice(0, -1)) {
    at += m
    notes.push(at + 1)
  }
  return notes.join(' ')
}

/** The 13 library patterns, each stored as its moves. */
export const PATTERN_LIBRARY: readonly Readonly<{ id: string; label: string; moves: Moves }>[] = [
  stepwise('1-2-3', [1, 1, -1]),
  stepwise('1-2-3-4', [1, 1, 1, -2]),
  stepwise('1-2-3-4-5', [1, 1, 1, 1, -3]),
  stepwise('1-2-3-5', [1, 1, 2, -3]),
  stepwise('1-2-4-3', [1, 2, -1, -1]),
  stepwise('1-2-3-1', [1, 1, -2, 1]),
  stepwise('1-3-2-1', [2, -1, -1, 1]),
  stepwise('1-3-2-4', [2, -1, 2, -2]),
  { id: 'thirds', label: 'Thirds', moves: [2, -1] },
  { id: 'fourths', label: 'Fourths', moves: [3, -2] },
  { id: 'triads', label: 'Triads', moves: [2, 2, -3] },
  { id: 'triads-turn', label: 'Triads with a turn', moves: [2, 2, -2, -1] },
  { id: 'sevenths', label: 'Sevenths', moves: [2, 2, 2, -5] },
]

/**
 * The run of a pattern over a collection of `size` notes, as steps from its first note (0 = the first note, `size` =
 * its octave; a group may reach past the octave). `groups` are the beam lengths. Up starts a group on every
 * sum-th step below the octave, then the octave alone; Down is Up reflected step for step (same groups, the lone note
 * last); Up & down is Up without its closing octave, then Down, which starts on it. Throws when the moves don't
 * advance (sum not above 0) or `size` is below 1.
 */
export function patternRun(
  size: number,
  moves: Moves,
  dir: ArpDirection,
): Readonly<{ steps: readonly number[]; groups: readonly number[] }> {
  const up = upRun(size, moves)
  if (dir === 'up') return up
  const down = { steps: up.steps.map((s) => size - s), groups: up.groups }
  if (dir === 'down') return down
  return { steps: [...up.steps.slice(0, -1), ...down.steps], groups: [...up.groups.slice(0, -1), ...down.groups] }
}

function upRun(size: number, moves: Moves): Readonly<{ steps: readonly number[]; groups: readonly number[] }> {
  const total = sum(moves)
  if (!(total > 0)) throw new Error('A pattern must advance: its moves must add up to more than zero.')
  if (!(size >= 1)) throw new Error('A pattern needs a collection of at least one note (size).')
  const steps: number[] = []
  const groups: number[] = []
  for (let start = 0; start < size; start += total) {
    let at = start
    steps.push(at)
    for (const m of moves.slice(0, -1)) {
      at += m
      steps.push(at)
    }
    groups.push(moves.length)
  }
  steps.push(size)
  groups.push(1)
  return { steps, groups }
}

/** what a pattern runs over: the chord's scale, or its chord tones */
export type PatternNotes = 'scale' | 'chord'
export const isPatternNotes = (x: unknown): x is PatternNotes => x === 'scale' || x === 'chord'

/** a run's start: the offsets (semitones from its first note) placed whole at the start with the fewest notes out of range, then the average nearest the centre (a tie: the higher) */
function placeWhole(offsets: readonly number[], first: number, range: Range): readonly number[] {
  const avg = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
  const options: { midi: number[]; out: number }[] = []
  for (let m = range.lo - 12; m <= range.hi + 12; m++) {
    if (mod(m, 12) !== first) continue
    const midi = offsets.map((o) => m + o)
    options.push({ midi, out: midi.filter((x) => x < range.lo || x > range.hi).length })
  }
  const cost = (o: { midi: number[]; out: number }): readonly number[] => [o.out, Math.abs(avg(o.midi) - range.centre), -(o.midi[0] ?? 0)]
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0)
  return [...options].sort((a, b) => cmp(cost(a), cost(b)))[0]?.midi ?? offsets.map((o) => range.centre + o - (offsets[0] ?? 0))
}

/** one scale line's pattern: the moves over the scale or chord tones, placed whole in the part's range; an unreadable line is an error, never a throw */
export function patternLine(
  part: Part,
  chord: string,
  scale: string | null,
  moves: Moves,
  notes: PatternNotes,
  dir: ArpDirection,
): ArpeggioLineNotes | Readonly<{ error: string }> {
  try {
    return playPattern(part, chord, scale, moves, notes, dir)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

function playPattern(part: Part, chord: string, scale: string | null, moves: Moves, notes: PatternNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }> {
  let collection: readonly Spelled[]
  if (notes === 'scale') {
    if (scale === null) return { error: 'Choose a scale' }
    collection = writtenScale(part, scale).notes
  } else {
    const tones = arpeggioTones(part, chord, scale ?? undefined)
    if (!tones) return { error: `No chord tones for ${chord}` }
    collection = tones
  }
  const n = collection.length
  const pcs = collection.map(pcOf)
  // each collection note's semitones above the first, rising
  const rel = pcs.reduce<number[]>((acc, pc, i) => (i === 0 ? [0] : [...acc, (acc[i - 1] ?? 0) + mod(pc - (pcs[i - 1] ?? pc) - 1, 12) + 1]), [])
  const { steps, groups } = patternRun(n, moves, dir)
  const offsets = steps.map((s) => (rel[mod(s, n)] ?? 0) + 12 * Math.floor(s / n))
  const midi = placeWhole(offsets, pcs[0] ?? 0, rangeOf(part))
  const placed = steps.map((s, i): Pitched => {
    const note = collection[mod(s, n)] as Spelled
    return { letter: note.letter, acc: note.acc, midi: midi[i] ?? 0 }
  })
  return { notes: placed, groups }
}

/**
 * the Patterns sheet: the Scales sheet's lines (scaleLines), each its pattern, in pages of perPage; never throws.
 * key and resolved as in buildArpeggioSheet.
 */
export function buildPatternSheet(
  rows: readonly Row[],
  part: Part,
  perPage: number,
  moves: Moves,
  notes: PatternNotes,
  dir: ArpDirection,
  key?: Key | null,
  resolved?: ReadonlyMap<number, Resolved>,
): ArpeggioSheetModel {
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  const keySig = key === undefined ? null : keySignature(key, part)
  const range = rangeOf(part)
  const staves = lines.map((l, n): ArpeggioStaffModel => {
    const r = rows[l.row] as Row
    const scale = scaleOf(r, l.row)
    const showClefAndKey = key === undefined || n === 0
    const id = [l.chords.join(' '), scale, part.clef, part.trans, `${range.lo}-${range.hi}-${range.centre}`, formatPattern(moves), notes, dir, keySig, showClefAndKey ? '' : 'bare'].join('|')
    const base = {
      id,
      chords: l.chords.map((c) => chordTokensOrNull(part, c, scale)),
      scale: orNull(() => (scale ? scaleLabel(part, scale) : null)),
      keySig,
      showClefAndKey,
      last: n === lines.length - 1,
    }
    const played = patternLine(part, r.chord, scale, moves, notes, dir)
    if ('error' in played) return { ...base, notes: [], groups: [], accidentals: [], intervals: null, error: played.error }
    return {
      ...base,
      ...played,
      accidentals: accidentalsInBar(
        played.notes.map((p) => ({ letter: p.letter, acc: p.acc, octave: octaveOf(p) })),
        keySig,
      ),
      intervals: orNull(() => intervalLabels(writtenChordRootLenient(part, r.chord, scale), played.notes, resolveQuality(r.chord)?.quality ?? null)),
      error: null,
    }
  })
  return { heading: 'Patterns', pages: chunk(staves, perPage) }
}
