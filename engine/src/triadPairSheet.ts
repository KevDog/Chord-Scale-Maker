import type { ArpDirection, ArpeggioLineNotes } from './arpeggioSheet'
import { placeWhole } from './arpeggios'
import type { Range } from './instruments'
import type { Pitched } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { type TriadPair, triadTones } from './triadPairLine'

/**
 * The Arpeggios sheet's Triad pairs (#436): a chord's pair as six close triads, lower and upper in turn through root
 * position, 1st and 2nd inversion (Weiskopf, Intervalic Improvisation, ex. 1), arpeggiated or as block chords. Pure; no DOM.
 */

export const PAIR_SHAPES = ['arpeggiated', 'block'] as const
export type PairShape = (typeof PAIR_SHAPES)[number]
export const isPairShape = (x: unknown): x is PairShape => (PAIR_SHAPES as readonly unknown[]).includes(x)
export const PAIR_SHAPE_LABELS: Readonly<Record<PairShape, string>> = { arpeggiated: 'Arpeggiated', block: 'Block' }

/** the six shapes in order: lower root, upper root, lower 1st, upper 1st, lower 2nd, upper 2nd */
const shapesOf = (pair: TriadPair): readonly (readonly Spelled[])[] =>
  [0, 1, 2].flatMap((k) => [pair.lower, pair.upper].map((t) => {
    const tones = triadTones(t)
    return [...tones.slice(k), ...tones.slice(0, k)]
  }))

/**
 * offsets from the first note: each shape rising from its bottom; the upper triad's first bottom the nearest the
 * lower's (a tritone: above), each later shape's bottom the next above its own triad's last
 */
function offsets(shapes: readonly (readonly Spelled[])[]): readonly number[] {
  const bottoms: number[] = []
  return shapes.flatMap((s, k) => {
    const pcs = s.map(pcOf)
    const near = mod(pcs[0]! - pcOf(shapes[0]![0]!) + 5, 12) - 5
    const own = shapes[k - 2]
    const bottom = k === 0 ? 0 : k === 1 ? near : bottoms[k - 2]! + mod(pcs[0]! - pcOf(own![0]!) - 1, 12) + 1
    bottoms.push(bottom)
    let at = bottom
    return pcs.map((pc, i) => (i === 0 ? at : (at += mod(pc - pcs[i - 1]! - 1, 12) + 1)))
  })
}

/**
 * the pair's figure in the range: placed whole (placeWhole: fewest notes out, then nearest the centre), then any shape
 * still out moved an octave into it, whole; Down plays it backwards, Up & down climbs and comes back sharing the top.
 * Block: the six shapes as chords (each group one chord), rising, whatever the direction
 */
export function triadPairFigure(pair: TriadPair, shape: PairShape, dir: ArpDirection, range: Range): ArpeggioLineNotes {
  const shapes = shapesOf(pair)
  const spelled = shapes.flat()
  const rel = offsets(shapes)
  const placed = placeWhole(pcOf(spelled[0]!), (m) => rel.map((r) => m + r), range, null)
  const out = (ms: readonly number[]): number => ms.filter((m) => m < range.lo || m > range.hi).length
  const midi = shapes.flatMap((_, s) => {
    const ms = placed.slice(3 * s, 3 * s + 3)
    return [0, -12, 12].map((d) => ms.map((m) => m + d)).reduce((best, x) => (out(x) < out(best) ? x : best))
  })
  const asc: Pitched[] = spelled.map((n, i) => ({ letter: n.letter, acc: n.acc, midi: midi[i]! }))
  const groups = shapes.map(() => 3)
  if (shape === 'block' || dir === 'up') return { notes: asc, groups }
  const desc = [...asc].reverse()
  if (dir === 'down') return { notes: desc, groups }
  return { notes: [...asc, ...desc.slice(1)], groups: [...groups, 2, ...groups.slice(1)] }
}
