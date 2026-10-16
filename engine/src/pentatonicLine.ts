import type { ArpDirection } from './arpeggioSheet'
import { arpeggioCells, type ArpeggioPattern, type Cells, cellVoices, nearestTone } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { Part } from './part'
import type { Spelled } from './pitch'
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

/** a cell's cells: up, down or alternating by the run's count; the run's first from its bottom (up) or top (down), then from the note nearest the last */
function pentatonicCells(tones: readonly Spelled[], dir: ArpDirection): Cells {
  return {
    tones,
    next: (prev, count) => {
      const up = dir === 'up' || (dir === 'up-down' && count % 2 === 0)
      const from = prev === null ? (up ? 0 : tones.length - 1) : nearestTone(tones, prev)
      const n = tones.length
      return { order: tones.map((_, j) => (((from + (up ? j : -j)) % n) + n) % n), up }
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
  return cellVoices(chords, part, beats, keySig, (c) => {
    const root = roots.get(c.row)
    return root ? pentatonicCells(pentatonicCell(root, line.leave), line.dir) : arpeggioCells(part, c, line.arpeggio)
  })
}
