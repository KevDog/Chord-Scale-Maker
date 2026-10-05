import type { Clef } from './instruments'
import type { Pitched } from './part'
import { pcOf, type Spelled } from './pitch'

/**
 * Voice leading for guide tone lines: given each chord's two guide tones, choose pitches for two complementary
 * lines (one on the 3rd, one on the 7th of every chord) with the least combined motion, inside the part's range.
 */

export type GuideTone = Readonly<{ note: Spelled; label: string }>
export type GuideTones = Readonly<{ third: GuideTone; seventh: GuideTone }>

/** written ranges: anything inside [lo, hi]; [comfortLo, comfortHi] costs nothing */
const RANGES: Readonly<Record<Clef, Readonly<{ lo: number; hi: number; comfortLo: number; comfortHi: number }>>> = {
  treble: { lo: 60, hi: 81, comfortLo: 64, comfortHi: 74 }, // C4-A5, comfortable E4-D5
  bass: { lo: 40, hi: 60, comfortLo: 43, comfortHi: 55 }, // E2-C4, comfortable G2-G3
}
const OUTSIDE_COST = 3 // per semitone outside the comfortable range
const LEAP_COST = 2 // per semitone beyond a whole step
const CENTRE_COST = 0.01 // ties: nearer the middle of the range

/** a guide tone at one octave; role 0 = the chord's "3rd", 1 = its "7th" */
export type Candidate = Readonly<{ pitch: Pitched; label: string; role: 0 | 1 }>

function candidates(tones: GuideTones, clef: Clef): Candidate[] {
  const { lo, hi } = RANGES[clef]
  return ([tones.third, tones.seventh] as const).flatMap((t, role) => {
    const pc = pcOf(t.note)
    const out: Candidate[] = []
    for (let midi = lo; midi <= hi; midi++)
      if (midi % 12 === pc) out.push({ pitch: { letter: t.note.letter, acc: t.note.acc, midi }, label: t.label, role: role as 0 | 1 })
    return out
  })
}

function placeCost(midi: number, clef: Clef): number {
  const { comfortLo, comfortHi } = RANGES[clef]
  const outside = Math.max(0, comfortLo - midi, midi - comfortHi)
  return OUTSIDE_COST * outside + CENTRE_COST * Math.abs(midi - (comfortLo + comfortHi) / 2)
}

function moveCost(from: number, to: number): number {
  const d = Math.abs(to - from)
  return d + LEAP_COST * Math.max(0, d - 2) // a held note costs 0, a step 1-2
}

type Pair = readonly [Candidate, Candidate] // line 1, line 2: always one 3rd and one 7th

/**
 * the smoothest pair of lines through consecutive chords (Viterbi over pairs): the two lines are complementary
 * (one on the 3rd, one on the 7th), line 1 starts on the 3rd, and their combined motion is as small as possible,
 * so neither line pays for the other's smoothness
 */
function smoothestPairs(steps: readonly Candidate[][], clef: Clef): Pair[] {
  const pairsOf = (cands: readonly Candidate[], first: boolean): Pair[] =>
    cands.flatMap((a) => (first && a.role !== 0 ? [] : cands.filter((b) => b.role !== a.role).map((b): Pair => [a, b])))
  const place = (p: Pair): number => placeCost(p[0].pitch.midi, clef) + placeCost(p[1].pitch.midi, clef)
  const move = (from: Pair, to: Pair): number => moveCost(from[0].pitch.midi, to[0].pitch.midi) + moveCost(from[1].pitch.midi, to[1].pitch.midi)

  const states = steps.map((c, s) => pairsOf(c, s === 0))
  let costs = (states[0] ?? []).map(place)
  const back: number[][] = []
  for (let s = 1; s < states.length; s++) {
    const prev = states[s - 1] ?? []
    const best = (states[s] ?? []).map((st) => {
      let min = Infinity
      let arg = 0
      prev.forEach((p, j) => {
        const cost = (costs[j] ?? Infinity) + move(p, st)
        if (cost < min) [min, arg] = [cost, j]
      })
      return [min + place(st), arg] as const
    })
    costs = best.map(([c]) => c)
    back.push(best.map(([, a]) => a))
  }
  let at = costs.indexOf(Math.min(...costs))
  const path: Pair[] = []
  for (let s = states.length - 1; s >= 0; s--) {
    const st = states[s]?.[at]
    if (st) path.unshift(st)
    at = s > 0 ? (back[s - 1]?.[at] ?? 0) : 0
  }
  return path
}

/** both lines, one guide tone (or a rest) per chord; runs between rests are voice-led separately */
export function voiceLead(tones: readonly (GuideTones | null)[], clef: Clef): readonly [(Candidate | null)[], (Candidate | null)[]] {
  const one: (Candidate | null)[] = []
  const two: (Candidate | null)[] = []
  let run: Candidate[][] = []
  const flush = (): void => {
    for (const [a, b] of smoothestPairs(run, clef)) {
      one.push(a)
      two.push(b)
    }
    run = []
  }
  for (const t of tones) {
    if (t) run.push(candidates(t, clef))
    else {
      flush()
      one.push(null) // a rest; both lines start again after it
      two.push(null)
    }
  }
  flush()
  return [one, two]
}
