import type { ArpDirection } from './arpeggioSheet'
import { arpeggioCells, type ArpeggioPattern, type Cells, cellVoices, placeWhole } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { Range } from './instruments'
import type { Metre } from './metre'
import { type Part, rangeOf } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import type { QuartalStack } from './quartal'
import type { RhythmPlan } from './rhythm/pour'

/**
 * The Changes sheet's Quartal line (#432 §3): under the Quartal overlay, the Line's 7th Chords slot plays each chord's
 * stacks of fourths, whole, bottom up or top down (never rotated mid-stack), up, down or alternating. Each chord starts
 * on its labeled stack, each later cell on it takes the next stack in Auto's order that differs from the last cell, and
 * each is placed whole nearest the last note (placeWhole), giving way to the next stack where it fits no octave of the
 * range or, starting a chord, where it would start on the last note. In the arpeggio line's rhythm; a three-note stack
 * the bar line cuts goes on into the chord's next bar, as the Triad pair line's triads do. Pure; no DOM.
 */

/** the line: its direction, and the arpeggio pattern a chord with no stack plays */
export type QuartalLine = Readonly<{ kind: 'quartal'; dir: ArpDirection; arpeggio: ArpeggioPattern }>

/** a stack's pitches from m: its notes bottom up (up) or top down, each a fourth from the last */
function stackAt(s: QuartalStack, up: boolean): Readonly<{ first: number; at: (m: number) => readonly number[] }> {
  const pcs = up ? s.pcs : [...s.pcs].reverse()
  const rel = pcs.reduce<number[]>((acc, pc, i) => (i === 0 ? [0] : [...acc, acc[i - 1]! + (up ? mod(pc - pcs[i - 1]!, 12) : -mod(pcs[i - 1]! - pc, 12))]), [])
  return { first: pcs[0]!, at: (m) => rel.map((r) => m + r) }
}

/** a chord's cells: its stacks (the labeled one first, then Auto's order) */
function stackCells(stacks: readonly QuartalStack[], dir: ArpDirection, range: Range): Cells {
  const tones: Spelled[] = []
  for (const n of stacks.flatMap((s) => s.notes)) if (!tones.some((t) => pcOf(t) === pcOf(n))) tones.push(n)
  const index = (pc: number): number => tones.findIndex((t) => pcOf(t) === pc)
  const inRange = (midi: readonly number[]): boolean => midi.every((m) => m >= range.lo && m <= range.hi)
  return {
    tones,
    carry: true,
    next: (prev, count, last, nth) => {
      const up = dir === 'up' || (dir === 'up-down' && count % 2 === 0)
      const lastPcs = last ? new Set(last.map((m) => mod(m, 12))) : null
      const repeats = (s: QuartalStack): boolean => !!lastPcs && s.pcs.length === lastPcs.size && s.pcs.every((pc) => lastPcs.has(pc))
      const tries = stacks.map((_, k) => stacks[(nth + k) % stacks.length]!).map((s) => {
        const { first, at } = stackAt(s, up)
        return { s, midi: placeWhole(first, at, range, prev) }
      })
      const chosen =
        tries.find((t) => !repeats(t.s) && inRange(t.midi) && (nth > 0 || prev === null || t.midi[0] !== prev)) ?? tries.find((t) => inRange(t.midi)) ?? tries[0]!
      return { order: (up ? chosen.s.pcs : [...chosen.s.pcs].reverse()).map(index), up, midi: chosen.midi }
    },
  }
}

/**
 * the Quartal line's voice for chords in time order: each chord's stacks (by row, the labeled one first) as cells
 * (cellVoices); a chord with none plays its 7th chord arpeggio in the line's pattern; rhythm: poured into its attacks
 */
export function quartalVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: QuartalLine,
  stacks: ReadonlyMap<number, readonly QuartalStack[]>,
  rhythm?: RhythmPlan,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  return cellVoices(chords, part, beats, keySig, (c) => {
    const own = stacks.get(c.row)
    return own?.length ? stackCells(own, line.dir, range) : arpeggioCells(part, c, line.arpeggio)
  }, undefined, 'none', rhythm)
}
