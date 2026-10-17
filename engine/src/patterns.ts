import type { ArpDirection } from './arpeggioSheet'

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
 * sum-th step below the octave, then the octave alone; Down is Up reflected step for step (same groups, the lone note last); Up & down is Up without its
 * closing octave, then Down, which starts on it.
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
