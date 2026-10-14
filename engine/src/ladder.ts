import { mod } from './pitch'
import { spellFrom } from './scales'

/**
 * Tension ladders (#255, #262): any pitch-class set (a minor pentatonic, a triad pair, a hexatonic) moved to all 12
 * roots and ranked by how many of its notes a scale holds: the most shared is home, the fewest the most outside.
 * Generic: the set is the only difference between ladders; spelling and naming belong to their callers.
 */
export type LadderTransposition = Readonly<{ root: number; shared: number }>

/** a formula's pitch classes on a root pc (default 0: the shape itself) */
export const pitchClasses = (formula: string, rootPc = 0): ReadonlySet<number> =>
  new Set(spellFrom({ letter: 0, acc: 0 }, formula).map((n) => mod(rootPc + n.semis, 12)))

/** how many of a shape's notes, moved to root, are in scale */
export const sharedCount = (shape: ReadonlySet<number>, root: number, scale: ReadonlySet<number>): number =>
  [...shape].filter((pc) => scale.has(mod(root + pc, 12))).length

/** the shape on all 12 roots, most shared first; ties by root pc */
export function rankTranspositions(shape: ReadonlySet<number>, scale: ReadonlySet<number>): readonly LadderTransposition[] {
  return Array.from({ length: 12 }, (_, root) => ({ root, shared: sharedCount(shape, root, scale) })).sort(
    (a, b) => b.shared - a.shared || a.root - b.root,
  )
}

/** a transposition with its signed distance round the circle of fifths from a reference (+ ♯ side, − ♭ side, −6 the tritone) */
export type FifthsTransposition = Readonly<{ root: number; shared: number; fifths: number }>

/** the fifths from refPc to root: 1–5 up (♯ side), −1 … −6 down (♭ side, the tritone included) */
export const fifthsFrom = (root: number, refPc: number): number => {
  const d = mod(7 * (root - refPc), 12)
  return d < 6 ? d : d - 12
}

/** the shape on all 12 roots, most shared first; ties by fewest fifths from refPc, ♭ side first (#266) */
export function rankByFifths(shape: ReadonlySet<number>, scale: ReadonlySet<number>, refPc: number): readonly FifthsTransposition[] {
  return Array.from({ length: 12 }, (_, root) => ({ root, shared: sharedCount(shape, root, scale), fifths: fifthsFrom(root, refPc) })).sort(
    (a, b) => b.shared - a.shared || Math.abs(a.fifths) - Math.abs(b.fifths) || a.fifths - b.fifths,
  )
}
