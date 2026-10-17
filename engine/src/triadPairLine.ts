import type { ArpDirection } from './arpeggioSheet'
import { arpeggioCells, type ArpeggioPattern, type Cells, cellVoices, nearestTone } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { ChainTriad, TriadQuality } from './hexatonics'
import type { Range } from './instruments'
import type { Metre } from './metre'
import { type Part, rangeOf } from './part'
import { nextCell, orderFrom } from './pentatonicLine'
import type { Spelled } from './pitch'
import { spellFrom } from './scales'

/**
 * The Changes sheet's Triad pair line (#325): under the Hexatonic overlay, the Line's 7th Chords slot plays each
 * chord's labelled pair as three-note cells, its lower triad then its upper in turn (each chord from its lower), up,
 * down or alternating, each cell from its note nearest the last; in the arpeggio line's rhythm and range, a cell the
 * bar line cuts going on into the chord's next bar. Pure; no DOM.
 */

/** the line: the cells' direction, and the arpeggio pattern a chord with no pair plays */
export type TriadPairLine = Readonly<{ kind: 'triad-pair'; dir: ArpDirection; arpeggio: ArpeggioPattern }>
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
 * the Triad pair line's voice for chords in time order: each chord's pair (by row, as its label shows it) as cells
 * (cellVoices); a chord with none plays its 7th chord arpeggio in the line's pattern
 */
export function triadPairVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: TriadPairLine,
  pairs: ReadonlyMap<number, TriadPair>,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  return cellVoices(chords, part, beats, keySig, (c) => {
    const pair = pairs.get(c.row)
    return pair ? pairCells(pair, line.dir, range) : arpeggioCells(part, c, line.arpeggio)
  })
}
