/**
 * The click's practice tools (#509; docs/superpowers/specs/2026-10-24-pattern-sets-design.md): each time through
 * the form (a chorus), all twelve keys moves the pitched tracks to the next key, and the tempo ramp plays a little
 * faster. The sheet stays as written: the keys are for the ear.
 */
import { type ClickPlan, clampTempo } from './click'
import { mod } from './pitch'

/** all twelve keys: off, up a 4th a chorus (the cycle), or up a half step */
export const KEY_CYCLES = ['off', 'fourths', 'half'] as const
export type KeyCycle = (typeof KEY_CYCLES)[number]

/** the click's bar n's chorus: the count-in and the first time through are 0; with no form, always 0 */
export function chorusOf(plan: ClickPlan, n: number): number {
  const length = plan.form?.order.length ?? 0
  return n < plan.countIn || !length ? 0 : Math.floor((n - plan.countIn) / length)
}

/** the semitones a chorus moves by, kept within a tritone of the written key (−6 to +5) */
export function chorusShift(cycle: KeyCycle, chorus: number): number {
  if (cycle === 'off') return 0
  return mod(chorus * (cycle === 'fourths' ? 5 : 1) + 6, 12) - 6
}

/** the tempo ramp: the start tempo, by beats a minute faster each chorus, within the click's range */
export const rampTempo = (start: number, by: number, chorus: number): number => clampTempo(start + by * chorus)
