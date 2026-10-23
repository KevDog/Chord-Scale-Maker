/**
 * The rhythm card (Scales and Arpeggios spec §1): the bars of a rhythm's cycle over a staff's metre, as notes.
 * Pure TypeScript.
 */
import { cycleBars, layRhythm } from './lay'
import { rhythmOf, type RhythmId } from './library'
import { rhythmNotes, type RhythmNote } from './notation'
import { PULSE_PER_BEAT } from './rhythm'

/** The longest card: a cycle longer than this is cut and the card says it continues. */
const MAX_CARD_BARS = 4

/** The card's bars of notes, whether the cycle was cut, and the bar length in beats it was laid in. */
export type RhythmCardModel = Readonly<{ bars: readonly (readonly RhythmNote[])[]; cut: boolean; beats: number }>

/**
 * A rhythm's card over bars of `beats` beats: its cycle (a repeating rhythm's `unit / gcd(unit, barPulses)` bars, a
 * per-bar rhythm's 1) up to four bars, laid with `layRhythm`; null for Off.
 */
export function cardBars(id: RhythmId, beats: number): RhythmCardModel | null {
  const r = rhythmOf(id)
  if (!r) return null
  const cycle = r.kind === 'repeat' ? cycleBars(r.rhythm.cells.length, beats * PULSE_PER_BEAT[r.rhythm.pulse]) : 1
  const laid = layRhythm(id, Array<number>(Math.min(cycle, MAX_CARD_BARS)).fill(beats))
  if (!laid) return null
  return { bars: rhythmNotes(laid), cut: cycle > MAX_CARD_BARS, beats }
}
