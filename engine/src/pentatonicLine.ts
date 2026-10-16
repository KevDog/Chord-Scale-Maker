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
const orderFrom = (n: number, from: number, up: boolean): readonly number[] => Array.from({ length: n }, (_, j) => (((from + (up ? j : -j)) % n) + n) % n)

/** the pitches of a cell in an order, from `first` (MIDI): each note the next of its pitch class above (up) or below (down) */
const pitchesFrom = (pcs: readonly number[], up: boolean, first: number): readonly number[] =>
  pcs.reduce<number[]>((acc, pc, i) => (i === 0 ? [first] : [...acc, acc[i - 1]! + (up ? ((pc - pcs[i - 1]! + 11) % 12) + 1 : -(((pcs[i - 1]! - pc + 11) % 12) + 1))]), [])

/**
 * the start (an index into the tones) of the cell after `prev`: of every placement the range allows (each note as
 * the start, in the direction, at each octave the whole cell fits), the one whose first note is nearest prev, never
 * prev itself (a tie: the lower), with its pitches; with none that fits, the tone nearest prev (the arpeggio's rule then places it)
 */
function nearestFitting(tones: readonly Spelled[], up: boolean, prev: number, range: Range): Readonly<{ s: number; midi?: readonly number[] }> {
  const best = tones
    .flatMap((_, s) => {
      const pcs = orderFrom(tones.length, s, up).map((i) => pcOf(tones[i]!))
      const out: { s: number; first: number }[] = []
      for (let m = range.lo; m <= range.hi; m++) {
        if (mod(m, 12) !== pcs[0] || m === prev) continue
        if (pitchesFrom(pcs, up, m).every((x) => x >= range.lo && x <= range.hi)) out.push({ s, first: m })
      }
      return out
    })
    .sort((a, b) => Math.abs(a.first - prev) - Math.abs(b.first - prev) || a.first - b.first)[0]
  if (!best) return { s: nearestTone(tones, prev) }
  return { s: best.s, midi: pitchesFrom(orderFrom(tones.length, best.s, up).map((i) => pcOf(tones[i]!)), up, best.first) }
}

/** a cell's cells: up, down or alternating by the run's count; the run's first from its bottom (up) or top (down), then from the nearest placement that fits the range */
function pentatonicCells(tones: readonly Spelled[], dir: ArpDirection, range: Range): Cells {
  return {
    tones,
    next: (prev, count) => {
      const up = dir === 'up' || (dir === 'up-down' && count % 2 === 0)
      if (prev === null) return { order: orderFrom(tones.length, up ? 0 : tones.length - 1, up), up }
      const { s, midi } = nearestFitting(tones, up, prev, range)
      return { order: orderFrom(tones.length, s, up), up, ...(midi ? { midi } : {}) }
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
