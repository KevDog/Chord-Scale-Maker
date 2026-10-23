/**
 * The rhythm on a Line (rhythm-on-lines spec §2–3): each chord's span after the Timing, its target and pick-ups
 * forced into the rhythm, and who plays each of the laid notes. Pure TypeScript; the line builders pick the pitches.
 */
import { layRhythm, pulseOf, stepsOf, type Laid } from './lay'
import { rhythmOf, type RhythmId } from './library'
import type { Feel } from './feel'
import { rhythmNotes, type RhythmNote } from './notation'
import type { RhythmSteps } from './path'
import { pickupNotes, type RhythmStart } from './phrasing'
import { barPulse, PULSE_GRID, pulsesIn } from './rhythm'

/** A chord on the sheet, for the rhythm: its start in sheet beats, and whether its line plays it. */
export type LineSpan = Readonly<{ at: number; sounds: boolean }>

/** Who plays a note: chord, and 0 for a poured note or m for its m-th scale-below pick-up (§3.3). */
export type Owner = Readonly<{ chord: number; below: number }>

export type LineRhythm = Readonly<{
  /** the forced rhythm; the line builders read its pulse (the caption comes from the unforced rhythm laid in buildChanges) */
  laid: Laid
  /** per drawn bar */
  bars: readonly (readonly RhythmNote[])[]
  /** per drawn bar, one per note */
  owners: readonly (readonly (Owner | null)[])[]
}>

/** What a line builder needs to pour: the rhythm and how drawn bars map to clock bars. */
export type RhythmPlan = Readonly<{
  id: RhythmId | RhythmSteps
  start: RhythmStart
  anticipate: number
  bars: readonly number[]
  clockBars: readonly number[]
  breaks: readonly number[]
  /** how the Changes groups the straight beats' beams (Phase 4 spec D19); 4 when absent */
  feel?: Feel
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
 * id: a rhythm or a plan (Phase 4 spec §3), whose step boundaries join `breaks` (D14).
 * breaks: the bars no tie runs into (a 2nd ending); chords: in sheet order; feel: the beams' grouping (Phase 4 spec D19).
 */
export function lineRhythm(
  id: RhythmId | RhythmSteps,
  bars: readonly number[],
  breaks: readonly number[],
  chords: readonly LineSpan[],
  start: RhythmStart,
  anticipate: number,
  feel: Feel = 4,
): LineRhythm | null {
  const steps = stepsOf(id, bars.length)
  const rs = steps.map(s => rhythmOf(s.id))
  if (bars.length === 0 || steps[0]?.from !== 0 || !rs.every(r => r !== null)) return null
  // each bar's rhythm pulse, its step's; a step's first bar is a break (once, if it is a break already)
  const pulses = bars.map((_, d) => pulseOf(rs[steps.findLastIndex(s => s.from <= d)]!))
  const cuts = [...new Set([...breaks, ...steps.map(s => s.from).filter(f => f > 0)])].sort((a, b) => a - b)
  const total = bars.reduce((a, b) => a + b, 0)
  const before = (d: number): number => bars.slice(0, d).reduce((a, b) => a + b, 0)
  // each bar's pulse, first beat and first stream pulse (Phase 4 spec §1): sheet beats to stream pulses bar by bar
  const grids = bars.map((b, d) => PULSE_GRID[barPulse(pulses[d]!, b)])
  const beatStarts = bars.map((_, d) => before(d))
  const pulseStarts = bars.map((_, d) => bars.slice(0, d).reduce((a, b, k) => a + pulsesIn(pulses[k]!, b), 0))
  const toPulse = (beat: number): number => {
    const d = Math.max(0, beatStarts.findLastIndex(s => s <= beat))
    return pulseStarts[d]! + ((beat - beatStarts[d]!) * grids[d]!.n) / grids[d]!.beats
  }
  const breakBeats = cuts.filter(b => b >= 0 && b < bars.length).map(before) // each break bar's first beat
  const breakPulses = breakBeats.map(toPulse)
  const bounds = boundaries(chords, anticipate, breakBeats, total)
  const end = (j: number): number => bounds[j + 1] ?? total
  const n = pickupNotes(start)

  const forced: readonly Forced[] =
    n === 0
      ? []
      : chords.flatMap((c, j): Forced[] => {
          if (!c.sounds || end(j) - bounds[j]! < EPS) return []
          const target = Math.ceil(toPulse(bounds[j]!) - EPS)
          if (target >= toPulse(end(j)) - EPS) return []
          const pickups = Array.from({ length: n }, (_, i) => target - i - 1).map(p =>
            p < 0 || breakPulses.some(q => q > p && q <= target) ? null : p,
          )
          return [{ chord: j, target, pickups }]
        })
  const force = forced.flatMap(f => [f.target, ...f.pickups.filter((p): p is number => p !== null)])

  const laid = layRhythm(id, bars, cuts, force)!
  const notes = rhythmNotes(laid, feel)

  const spanOf = (pulse: number): number =>
    bounds.findLastIndex((b, j) => pulse >= toPulse(b) - EPS && pulse < toPulse(end(j)) - EPS)
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
      if (!note.tiedIn) held = attackOwner(Math.round(toPulse(beatStarts[b]! + note.beat)))
      return held
    }),
  )
  return { laid, bars: notes, owners }
}
