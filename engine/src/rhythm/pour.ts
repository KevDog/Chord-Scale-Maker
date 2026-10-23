/**
 * The rhythm on a Line (rhythm-on-lines spec §2–3): each chord's span after the Timing, its target and pick-ups
 * forced into the rhythm, and who plays each of the laid notes. Pure TypeScript; the line builders pick the pitches.
 */
import { layRhythm, type Laid } from './lay'
import type { RhythmId } from './library'
import { rhythmNotes, type RhythmNote } from './notation'
import { pickupNotes, type RhythmStart } from './phrasing'
import { PULSE_PER_BEAT } from './rhythm'

/** A chord on the sheet, for the rhythm: its start in sheet beats, and whether its line plays it. */
export type LineSpan = Readonly<{ at: number; sounds: boolean }>

/** Who plays a note: chord, and 0 for a poured note or m for its m-th scale-below pick-up (§3.3). */
export type Owner = Readonly<{ chord: number; below: number }>

export type LineRhythm = Readonly<{
  /** the forced rhythm, for its caption and landings */
  laid: Laid
  /** per drawn bar */
  bars: readonly (readonly RhythmNote[])[]
  /** per drawn bar, one per note */
  owners: readonly (readonly (Owner | null)[])[]
}>

/** What a line builder needs to pour: the rhythm and how drawn bars map to clock bars. */
export type RhythmPlan = Readonly<{
  id: RhythmId
  start: RhythmStart
  anticipate: number
  bars: readonly number[]
  clockBars: readonly number[]
  breaks: readonly number[]
}>

/** the tolerance for comparing beats, which under triplets are inexact floats */
export const EPS = 1e-9

/**
 * Each chord's boundary in sheet beats (§2): `at − anticipate`, except the first chord's and a chord starting a
 * break bar, which stay at their start; clamped to the sheet, then right to left never past the next one.
 */
function boundaries(chords: readonly LineSpan[], anticipate: number, breakBeats: readonly number[], total: number): readonly number[] {
  const shifted = chords.map((c, j) =>
    Math.min(total, Math.max(0, j === 0 || breakBeats.some(b => Math.abs(b - c.at) < EPS) ? c.at : c.at - anticipate)),
  )
  return shifted.reduceRight<number[]>((acc, b, j) => {
    acc[j] = j === shifted.length - 1 ? b : Math.min(b, acc[j + 1]!)
    return acc
  }, [])
}

/** A sounding chord's target pulse and its pick-up pulses (index m − 1 is the m-th, nearest the target first). */
type Forced = Readonly<{ chord: number; target: number; pickups: readonly (number | null)[] }>

/**
 * The rhythm laid over the drawn bars (lengths in beats) for a Line, with each chord's target and pick-ups forced
 * (§3.2) and each note's owner (§3.3); null for Off or no bars.
 * breaks: the bars no tie runs into (a 2nd ending); chords: in sheet order.
 */
export function lineRhythm(
  id: RhythmId,
  bars: readonly number[],
  breaks: readonly number[],
  chords: readonly LineSpan[],
  start: RhythmStart,
  anticipate: number,
): LineRhythm | null {
  const plain = layRhythm(id, bars, breaks)
  if (!plain) return null
  const per = PULSE_PER_BEAT[plain.pulse]
  const total = bars.reduce((a, b) => a + b, 0)
  const breakBeats = breaks.map(b => plain.starts[b]).filter((p): p is number => p !== undefined).map(p => p / per)
  const breakPulses = breakBeats.map(b => b * per)
  const bounds = boundaries(chords, anticipate, breakBeats, total)
  const end = (j: number): number => bounds[j + 1] ?? total
  const n = pickupNotes(start)

  const forced: readonly Forced[] =
    n === 0
      ? []
      : chords.flatMap((c, j): Forced[] => {
          if (!c.sounds || end(j) - bounds[j]! < EPS) return []
          const target = Math.ceil(bounds[j]! * per - EPS)
          if (target >= end(j) * per - EPS) return []
          const pickups = Array.from({ length: n }, (_, i) => target - i - 1).map(p =>
            p < 0 || breakPulses.some(q => q > p && q <= target) ? null : p,
          )
          return [{ chord: j, target, pickups }]
        })
  const force = forced.flatMap(f => [f.target, ...f.pickups.filter((p): p is number => p !== null)])

  const laid = layRhythm(id, bars, breaks, force)!
  const notes = rhythmNotes(laid)

  const spanOf = (pulse: number): number =>
    bounds.findLastIndex((b, j) => pulse >= b * per - EPS && pulse < end(j) * per - EPS)
  const attackOwner = (pulse: number): Owner | null => {
    const j = spanOf(pulse)
    if (j >= 0 && chords[j]!.sounds) return { chord: j, below: 0 }
    const f = forced.find(f => f.pickups.includes(pulse))
    return f ? { chord: f.chord, below: f.pickups.indexOf(pulse) + 1 } : null
  }

  // a tied-in piece continues the attack before it, across barlines too
  let held: Owner | null = null
  const owners = notes.map((bar, b) =>
    bar.map(note => {
      if (note.rest) return null
      if (!note.tiedIn) held = attackOwner(Math.round(laid.starts[b]! + note.beat * per))
      return held
    }),
  )
  return { laid, bars: notes, owners }
}
