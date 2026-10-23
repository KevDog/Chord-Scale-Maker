/**
 * Feel in 4 · 2 · 1 (Phase 4 spec §4): how the Changes groups a bar's slashes, its beat-grouped beams and its target
 * beats. Display only: the rhythm plays the same at every Feel.
 */
import { restPieces } from './notation'
import type { RhythmValue } from './rhythm'
import { targetBeats } from './targets'

export type Feel = 4 | 2 | 1

export const FEELS: readonly Feel[] = [4, 2, 1]

/** The Feel control's names (Phase 4 spec §7). */
export const FEEL_LABELS: Readonly<Record<Feel, string>> = { 4: 'In 4', 2: 'In 2', 1: 'In 1' }

export function isFeel(f: unknown): f is Feel {
  return typeof f === 'number' && (FEELS as readonly number[]).includes(f)
}

/** Each group's first beat in a bar of `beats`: every beat in 4, the target-beat split in 2, the bar in 1. */
export function feelGroups(beats: number, feel: Feel): readonly number[] {
  return feel === 4 ? Array.from({ length: beats }, (_, b) => b) : feel === 2 ? targetBeats(beats) : [0]
}

export type FeelSlash = Readonly<{ beat: number; value: RhythmValue; tie: boolean }>

/**
 * The plain slashes of a bar with no rhythm line (D18): one a group, each the group long; a group longer than a
 * whole note is split as a rest is (`restPieces`), its pieces tied.
 */
export function feelSlashes(beats: number, feel: Feel): readonly FeelSlash[] {
  const groups = feelGroups(beats, feel)
  return groups.flatMap((at, g) => {
    const pieces = restPieces(at, (groups[g + 1] ?? beats) - at, '4')
    return pieces.map((p, i) => ({ beat: p.at, value: p.value, tie: i < pieces.length - 1 }))
  })
}

/** The bar's target beats (D20): `targetBeats` in 4 and in 2, the downbeat alone in 1. */
export function feelTargets(beats: number, feel: Feel): readonly number[] {
  return feel === 1 ? [0] : targetBeats(beats)
}
