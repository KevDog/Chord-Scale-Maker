import { type CellOrder, orderCell } from './cellOrder'
import type { Cell, Contour } from './cells'
import { mod, pcOf, type Spelled } from './pitch'

/**
 * Phrase (#379, #380, docs/superpowers/specs/2026-10-21-phrase-cells-design.md): a system's cell aimed at the next
 * slot's target, its last note a step from it, from a palette of cells when the system's own doesn't step. Pure; no DOM.
 */

const cell = (degrees: string, contour: string): Cell => ({ degrees: degrees.split(' ').map(Number), contour: [...contour] as Contour })

/** the cells phrase may swap in: the systems' cells first, by how often a system uses them, then the single cells in their listbox order */
export const PALETTE: readonly Cell[] = [
  cell('3 2 1 7', 'ddd'),
  cell('1 3 5 7', 'uuu'),
  cell('3 5 7 9', 'uuu'),
  cell('1 2 3 5', 'uuu'),
  cell('5 3 2 1', 'ddd'),
  cell('3 5 1 7', 'uud'),
  cell('3 1 7 5', 'ddd'),
  cell('1 7 6 5', 'ddd'),
  cell('5 3 1 7', 'ddd'),
  cell('7 1 3 5', 'uuu'),
  cell('5 6 7 9', 'uuu'),
  cell('1 6 5 3', 'ddd'),
  cell('1 3 5 3', 'uud'),
  cell('1 5 3 5', 'udu'),
  cell('1 2 3 1', 'uud'),
]

/** pitch classes a step apart: 1 or 2 semitones, either way (a common tone is not a step) */
export const isStep = (from: number, to: number): boolean => [1, 2].includes(Math.min(mod(to - from, 12), mod(from - to, 12)))

const stepsTo = (tones: readonly Spelled[] | null, target: number): boolean => {
  const last = tones?.[tones.length - 1]
  return last !== undefined && isStep(pcOf(last), target)
}

/**
 * the cell a slot plays, aimed at the next slot's target pitch class: its own if its last note steps to it; else the
 * first palette cell on the same first degree (in the line's Order) whose last note does; else its own. toneOf: a
 * cell's notes in the Order over the slot's chord, null if it has none
 */
export function aimedCell(
  own: Cell,
  ownTones: readonly Spelled[],
  target: number,
  toneOf: (c: Cell) => readonly Spelled[] | null,
  order: CellOrder = 'as-written',
): Cell {
  if (stepsTo(ownTones, target)) return own
  const first = orderCell(own, order).degrees[0]
  return PALETTE.find((c) => orderCell(c, order).degrees[0] === first && stepsTo(toneOf(c), target)) ?? own
}
