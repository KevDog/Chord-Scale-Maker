import type { Pitched } from './part'
import { enharmonics, mod, NAT_PC, pcOf, type Letter, type Spelled } from './pitch'

/**
 * Approach figures (#298): the notes that lead into a target, each a move from it: c a chromatic semitone, d a step of
 * the scale the figure sounds over. Pure; no DOM.
 */

type Move = readonly ['c' | 'd', number]

const FIGURES = {
  none: { label: 'None', moves: [] },
  'chromatic-below': { label: 'Chromatic below', moves: [['c', -1]] },
  'chromatic-above': { label: 'Chromatic above', moves: [['c', 1]] },
  'diatonic-above': { label: 'Diatonic above', moves: [['d', 1]] },
  'double-below': { label: 'Double chromatic below', moves: [['c', -2], ['c', -1]] },
  'double-above': { label: 'Double chromatic above', moves: [['c', 2], ['c', 1]] },
  'above-below': { label: 'Above and below (chromatic)', moves: [['c', 1], ['c', -1]] },
  enclosure: { label: 'Diatonic above, chromatic below (enclosure)', moves: [['d', 1], ['c', -1]] },
  'below-above': { label: 'Below and above (chromatic)', moves: [['c', -1], ['c', 1]] },
  delayed: { label: 'Delayed resolution', moves: [['d', 1], ['d', -1], ['c', -1]] },
} as const satisfies Readonly<Record<string, Readonly<{ label: string; moves: readonly Move[] }>>>

export type Approach = keyof typeof FIGURES
export const APPROACHES = ['none', 'chromatic-below', 'chromatic-above', 'diatonic-above', 'double-below', 'double-above', 'above-below', 'enclosure', 'below-above', 'delayed'] as const satisfies readonly Approach[]
export const isApproach = (x: unknown): x is Approach => typeof x === 'string' && x in FIGURES
export const APPROACH_LABELS: Readonly<Record<Approach, string>> = Object.fromEntries(APPROACHES.map((a) => [a, FIGURES[a].label])) as Record<Approach, string>

/**
 * the note n semitones from the target: one semitone is on the next letter over (into E: D♯, F; into B♭: A), two
 * on the simplest spelling (into E from below: D), a tie going flat below and sharp above
 */
function chromatic(target: Pitched, n: number): Pitched {
  const midi = target.midi + n
  if (Math.abs(n) === 1) {
    const letter = mod(target.letter + n, 7) as Letter
    return { letter, acc: mod(midi - NAT_PC[letter] + 6, 12) - 6, midi }
  }
  const [best] = [...enharmonics({ letter: 0, acc: mod(midi, 12) })].sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc) || (n < 0 ? a.acc - b.acc : b.acc - a.acc))
  return { ...best!, midi }
}

/** the scale's own note a step above (1) or below (-1) the target, which keeps the scale's spelling; null with no scale */
function diatonic(target: Pitched, scale: readonly Spelled[] | null, step: number): Pitched | null {
  if (!scale?.length) return null
  const tpc = pcOf(target)
  const dist = (s: Spelled): number => (step > 0 ? mod(pcOf(s) - tpc, 12) : mod(tpc - pcOf(s), 12))
  const [near] = scale.filter((s) => dist(s) > 0).sort((a, b) => dist(a) - dist(b))
  return near ? { ...near, midi: target.midi + step * dist(near) } : null
}

/**
 * the notes before the target for a figure (a move is from the target; diatonic steps are the scale's), or null when
 * the figure needs a scale note and there is none
 */
export function approachNotes(target: Pitched, figure: Approach, scale: readonly Spelled[] | null): readonly Pitched[] | null {
  const notes: Pitched[] = []
  for (const [kind, n] of FIGURES[figure].moves) {
    const note = kind === 'c' ? chromatic(target, n) : diatonic(target, scale, n)
    if (!note) return null
    notes.push(note)
  }
  return notes
}
