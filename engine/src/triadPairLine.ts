import type { ArpDirection } from './arpeggioSheet'
import { arpeggioCells, type ArpeggioPattern, type Cells, cellVoices, nearestTone, placeWhole } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { ChainTriad, TriadQuality } from './hexatonics'
import type { Range } from './instruments'
import type { Metre } from './metre'
import { type Part, rangeOf } from './part'
import { nextCell, orderFrom } from './pentatonicLine'
import { mod, pcOf, type Spelled } from './pitch'
import { spellFrom } from './scales'
import type { RhythmPlan } from './rhythm/pour'

/**
 * The Changes sheet's Triad pair line (#325): under the Hexatonic overlay, the Line's 7th Chords slot plays each
 * chord's labeled pair as three-note cells, its lower triad then its upper in turn (each chord from its lower), up,
 * down or alternating, each cell from its note nearest the last; in the arpeggio line's rhythm and range, a cell the
 * bar line cuts going on into the chord's next bar. Pure; no DOM.
 */

/**
 * the line's shape (#432, after Weiskopf's exercises 1–6): Nearest, each triad from its note nearest the last; Climb,
 * both triads in root position, then first inversion, then second, each from the note past the last triad's start;
 * Arpeggios, the Climb with each triad 1 3 5 8
 */
export const PAIR_LINE_SHAPES = ['nearest', 'climb', 'arpeggios'] as const
export type PairLineShape = (typeof PAIR_LINE_SHAPES)[number]
export const isPairLineShape = (x: unknown): x is PairLineShape => (PAIR_LINE_SHAPES as readonly unknown[]).includes(x)
export const PAIR_LINE_SHAPE_LABELS: Readonly<Record<PairLineShape, string>> = { nearest: 'Nearest', climb: 'Climb', arpeggios: 'Arpeggios 1 3 5 8' }

/** the line: the cells' direction, the arpeggio pattern a chord with no pair plays, and its shape (Nearest if none) */
export type TriadPairLine = Readonly<{ kind: 'triad-pair'; dir: ArpDirection; arpeggio: ArpeggioPattern; shape?: PairLineShape }>
/** a chord's pair, written for the part (a HexPair is one) */
export type TriadPair = Readonly<{ lower: ChainTriad; upper: ChainTriad }>

const FORMULA: Readonly<Record<TriadQuality, string>> = { maj: '1 3 5', min: '1 b3 5', dim: '1 b3 b5', aug: '1 3 #5' }

/** a triad's notes, root, third, fifth, spelled from its root */
export const triadTones = (t: ChainTriad): readonly Spelled[] => spellFrom(t.root, FORMULA[t.quality]).map(({ letter, acc }) => ({ letter, acc }))

/** a pair's cells: the chord's nth cell its lower triad (n even) or upper; up, down or alternating by the run's count */
function pairCells(pair: TriadPair, dir: ArpDirection, range: Range): Cells {
  const lower = triadTones(pair.lower)
  const upper = triadTones(pair.upper)
  return {
    tones: [...lower, ...upper],
    carry: true,
    next: (prev, count, last, nth) => {
      const [tones, at] = nth % 2 === 0 ? [lower, 0] : [upper, 3]
      const shift = (order: readonly number[]): readonly number[] => order.map((i) => i + at)
      const up = dir === 'up' || (dir === 'up-down' && count % 2 === 0)
      if (prev === null) return { order: shift(orderFrom(3, up ? 0 : 2, up)), up }
      const p = nextCell(tones, up, prev, last, range, dir !== 'up-down')
      if (!p) return { order: shift(orderFrom(3, nearestTone(tones, prev), up)), up }
      return { order: shift(orderFrom(3, p.s, p.up)), up: p.up, midi: p.midi }
    },
  }
}

/**
 * a pair's Climb (or Arpeggios, `four`): the nth cell the climb's nth triad (lower, upper, through root position, 1st and
 * 2nd inversion), each starting on its note just past the last triad's start; Down mirrors it (the upper's 2nd inversion
 * top down first); Up & down climbs six triads up, then six down. A triad that would leave the range is placed whole
 * nearest the last note instead, and the climb goes on from there; a 1 3 5 8 that fits no octave of it drops its 8.
 */
function climbCells(pair: TriadPair, dir: ArpDirection, range: Range, four: boolean): Cells {
  const tones = [...triadTones(pair.lower), ...triadTones(pair.upper)]
  return {
    tones,
    carry: true,
    next: (prev, _count, last, nth) => {
      const k = dir === 'up-down' ? nth % 12 : nth % 6
      const up = dir === 'up' || (dir === 'up-down' && k < 6)
      const rising = up ? k % 6 : 5 - (k % 6) // its place in the climb up
      const inversion = [0, 1, 2].map((j) => (Math.floor(rising / 2) + j) % 3 + (rising % 2) * 3)
      const inRange = (midi: readonly number[]): boolean => midi.every((m) => m >= range.lo && m <= range.hi)
      const cell = (notes: readonly number[]) => {
        const order = up ? notes : [...notes].reverse()
        const pcs = order.map((i) => pcOf(tones[i]!))
        const rel = pcs.reduce<number[]>((acc, pc, i) => (i === 0 ? [0] : [...acc, acc[i - 1]! + (up ? mod(pc - pcs[i - 1]!, 12) || 12 : -(mod(pcs[i - 1]! - pc, 12) || 12))]), [])
        const at = (m: number): readonly number[] => rel.map((r) => m + r)
        const start = nth > 0 ? last?.[0] : undefined
        const climbed = start === undefined ? null : at(up ? start + (mod(pcs[0]! - start, 12) || 12) : start - (mod(start - pcs[0]!, 12) || 12))
        return { order, up, midi: climbed && inRange(climbed) ? climbed : placeWhole(pcs[0]!, at, range, prev) }
      }
      // a 1 3 5 8 that fits no octave of the range drops its 8
      const arpeggio = four ? cell([...inversion, inversion[0]!]) : null
      return arpeggio && inRange(arpeggio.midi) ? arpeggio : cell(inversion)
    },
  }
}

/**
 * the Triad pair line's voice for chords in time order: each chord's pair (by row, as its label shows it) as cells
 * (cellVoices); a chord with none plays its 7th chord arpeggio in the line's pattern; rhythm: poured into its attacks
 */
export function triadPairVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: TriadPairLine,
  pairs: ReadonlyMap<number, TriadPair>,
  rhythm?: RhythmPlan,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  return cellVoices(chords, part, beats, keySig, (c) => {
    const pair = pairs.get(c.row)
    if (!pair) return arpeggioCells(part, c, line.arpeggio)
    return line.shape === 'climb' || line.shape === 'arpeggios' ? climbCells(pair, line.dir, range, line.shape === 'arpeggios') : pairCells(pair, line.dir, range)
  }, undefined, 'none', rhythm)
}
