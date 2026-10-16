import type { ArpDirection } from './arpeggioSheet'
import { arpeggioCells, type ArpeggioPattern, type Cells, cellVoices, nearestTone } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { Range } from './instruments'
import { type Part, rangeOf } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { SCALES, spellFrom } from './scales'

/**
 * The Changes sheet's Pentatonic line (#284): under the Pentatonic overlay, the Line's 7th Chords slot plays each
 * chord's labelled minor pentatonic as four-note cells, the pentatonic less one note (Leave out), up, down or
 * alternating, each cell from its note nearest the last; in the arpeggio line's rhythm and range. Pure; no DOM.
 */

/** the minor pentatonic's degrees, as its formula has them: what Leave out may drop */
export const PENTATONIC_LEAVES = ['1', 'b3', '4', '5', 'b7'] as const
export type PentatonicLeave = (typeof PENTATONIC_LEAVES)[number]
export const isPentatonicLeave = (x: unknown): x is PentatonicLeave => (PENTATONIC_LEAVES as readonly unknown[]).includes(x)
export const PENTATONIC_LEAVE_LABELS: Readonly<Record<PentatonicLeave, string>> = { '1': '1', b3: '♭3', '4': '4', '5': '5', b7: '♭7' }
/** leave out 1: ♭3-4-5-♭7, the relative major's 1-2-3-5 (Bergonzi's cell) */
export const PENTATONIC_LEAVE: PentatonicLeave = '1'

/** the line: the degree left out, the cells' direction, and the arpeggio pattern a chord with no pentatonic plays */
export type PentatonicLine = Readonly<{ kind: 'pentatonic'; leave: PentatonicLeave; dir: ArpDirection; arpeggio: ArpeggioPattern }>

/** a minor pentatonic on root (written) less one degree: four notes, in the formula's order */
export function pentatonicCell(root: Spelled, leave: PentatonicLeave): readonly Spelled[] {
  const degrees = SCALES['minor pentatonic'][0].split(' ').filter((d) => d !== leave)
  return spellFrom(root, degrees.join(' ')).map(({ letter, acc }) => ({ letter, acc }))
}

/** a cell's order from its index `from`, up or down */
export const orderFrom = (n: number, from: number, up: boolean): readonly number[] => Array.from({ length: n }, (_, j) => (((from + (up ? j : -j)) % n) + n) % n)

/** the pitches of a cell in an order, from `first` (MIDI): each note the next of its pitch class above (up) or below (down) */
const pitchesFrom = (pcs: readonly number[], up: boolean, first: number): readonly number[] =>
  pcs.reduce<number[]>((acc, pc, i) => (i === 0 ? [first] : [...acc, acc[i - 1]! + (up ? ((pc - pcs[i - 1]! + 11) % 12) + 1 : -(((pcs[i - 1]! - pc + 11) % 12) + 1))]), [])

type Placement = Readonly<{ s: number; up: boolean; midi: readonly number[] }>
const inRange = (midi: readonly number[], range: Range): boolean => midi.every((x) => x >= range.lo && x <= range.hi)
const placed = (tones: readonly Spelled[], s: number, up: boolean, first: number): Placement => ({ s, up, midi: pitchesFrom(orderFrom(tones.length, s, up).map((i) => pcOf(tones[i]!)), up, first) })

/** every placement the range allows in these directions (each note as the start, at each octave the whole cell fits), never starting on prev */
const placements = (tones: readonly Spelled[], dirs: readonly boolean[], prev: number, range: Range): Placement[] =>
  dirs.flatMap((up) =>
    tones.flatMap((t, s) => {
      const out: Placement[] = []
      for (let m = range.lo; m <= range.hi; m++) if (mod(m, 12) === pcOf(t) && m !== prev && inRange(placed(tones, s, up, m).midi, range)) out.push(placed(tones, s, up, m))
      return out
    }),
  )
const byNearest = (prev: number) => (a: Placement, b: Placement): number => Math.abs(a.midi[0]! - prev) - Math.abs(b.midi[0]! - prev) || a.midi[0]! - b.midi[0]!

/**
 * the cell after `prev` (#284): its note nearest prev at any octave, never prev itself (a tie: the lower), played the
 * way chosen if the whole cell fits the range, else the other way from it (a turn at the range's wall); else, of the
 * placements the range allows, the nearest prev that differs from the last cell; with none, null (the arpeggio's rule).
 * Up & down (turn false) keeps its alternation: the nearest placement that fits, the way chosen
 */
export function nextCell(tones: readonly Spelled[], up: boolean, prev: number, last: readonly number[] | null, range: Range, turn: boolean): Placement | null {
  if (!turn) return placements(tones, [up], prev, range).sort(byNearest(prev))[0] ?? null
  const start = tones
    .map((t, s) => {
      const above = mod(pcOf(t) - prev, 12)
      const first = above === 0 ? prev + 12 : above <= 12 - above ? prev + above : prev - (12 - above)
      const other = above === 0 ? prev - 12 : first > prev ? first - 12 : first + 12
      return [{ s, first }, { s, first: other }]
    })
    .flat()
    .filter((c) => c.first !== prev)
    .sort((a, b) => Math.abs(a.first - prev) - Math.abs(b.first - prev) || a.first - b.first)[0]!
  for (const way of [up, !up]) {
    const p = placed(tones, start.s, way, start.first)
    if (inRange(p.midi, range)) return p
  }
  const all = placements(tones, [up, !up], prev, range).sort(byNearest(prev))
  const same = (p: Placement): boolean => !!last && p.midi.join() === last.join()
  return all.find((p) => !same(p)) ?? all[0] ?? null
}

/** a cell's cells: up, down or alternating by the run's count; the run's first from its bottom (up) or top (down), then nextCell */
function pentatonicCells(tones: readonly Spelled[], dir: ArpDirection, range: Range): Cells {
  return {
    tones,
    next: (prev, count, last) => {
      const up = dir === 'up' || (dir === 'up-down' && count % 2 === 0)
      if (prev === null) return { order: orderFrom(tones.length, up ? 0 : tones.length - 1, up), up }
      const p = nextCell(tones, up, prev, last, range, dir !== 'up-down')
      if (!p) return { order: orderFrom(tones.length, nearestTone(tones, prev), up), up }
      return { order: orderFrom(tones.length, p.s, p.up), up: p.up, midi: p.midi }
    },
  }
}

/**
 * the Pentatonic line's voice for chords in time order: each chord's pentatonic (roots: its written root by row, as
 * its label shows it) as cells (cellVoices); a chord with none plays its 7th chord arpeggio in the line's pattern
 */
export function pentatonicVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  line: PentatonicLine,
  roots: ReadonlyMap<number, Spelled>,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  return cellVoices(chords, part, beats, keySig, (c) => {
    const root = roots.get(c.row)
    return root ? pentatonicCells(pentatonicCell(root, line.leave), line.dir, range) : arpeggioCells(part, c, line.arpeggio)
  })
}
