import { arpeggioTones } from './arpeggios'
import { type Part, writtenScale } from './part'
import { mod, pcOf, type Spelled } from './pitch'

/**
 * Melodic cells (#298, after Randy Vincent's Building Solo Lines From Cells): four notes written as degrees from the
 * chord's root, read through its scale, with a contour of up/down for each of the three moves. Pure; no DOM.
 */

export type Contour = readonly ('u' | 'd')[]
export type Cell = Readonly<{ degrees: readonly number[]; contour: Contour }>

const cell = (degrees: string, contour: string): Cell => ({ degrees: degrees.split(' ').map(Number), contour: [...contour] as Contour })

/** the four systems: a pair of cells, A and B, alternating from slot to slot so each cell's last note steps into the next's target */
export const CELL_SYSTEMS = {
  'root-root': { label: 'Root to root', a: cell('1 2 3 5', 'uuu'), b: cell('1 7 6 5', 'ddd') },
  '3rd-3rd': { label: '3rd to 3rd', a: cell('3 2 1 7', 'ddd'), b: cell('3 5 1 7', 'uud') },
  '3rd-5th': { label: '3rd to 5th', a: cell('3 5 7 9', 'uuu'), b: cell('5 3 1 7', 'ddd') },
  '3rd-root': { label: '3rd to root', a: cell('3 1 7 5', 'ddd'), b: cell('1 3 5 7', 'uuu') },
} as const satisfies Readonly<Record<string, Readonly<{ label: string; a: Cell; b: Cell }>>>

/** single cells: every slot plays the same one */
export const SINGLE_CELLS: readonly Readonly<{ id: string; cell: Cell }>[] = (
  [
    ['1 2 3 5', 'uuu'],
    ['5 3 2 1', 'ddd'],
    ['1 3 5 7', 'uuu'],
    ['3 5 7 9', 'uuu'],
    ['7 1 3 5', 'uuu'],
    ['5 6 7 9', 'uuu'],
    ['1 3 5 3', 'uud'],
    ['1 5 3 5', 'udu'],
    ['1 6 5 3', 'ddd'],
    ['1 2 3 1', 'uud'],
  ] as const
).map(([degrees, contour]) => ({ id: degrees.replaceAll(' ', '-'), cell: cell(degrees, contour) }))

export type CellId = keyof typeof CELL_SYSTEMS | (typeof SINGLE_CELLS)[number]['id']
export const isCellId = (x: unknown): x is CellId => typeof x === 'string' && (x in CELL_SYSTEMS || SINGLE_CELLS.some((c) => c.id === x))
export const cellLabel = (id: CellId): string => (id in CELL_SYSTEMS ? CELL_SYSTEMS[id as keyof typeof CELL_SYSTEMS].label : id.replaceAll('-', ' '))

const CHORD_TONE: Readonly<Record<number, number>> = { 1: 0, 3: 1, 5: 2, 7: 3 }

/**
 * a cell's notes over a chord: degree d is the written scale's note d-1 letters above its root; with no such note (or
 * two) the chord tone of that number (1, 3, 5, 7); with none, null
 */
export function cellTones(part: Part, chord: string, scale: string | undefined, degrees: readonly number[]): readonly Spelled[] | null {
  let root: Spelled | undefined
  let notes: readonly Spelled[] = []
  if (scale !== undefined) {
    try {
      const w = writtenScale(part, scale)
      root = w.root
      notes = w.notes
    } catch {
      // an unreadable scale reads as none: chord tones only
    }
  }
  const chordTones = arpeggioTones(part, chord, scale)
  const out: Spelled[] = []
  for (const d of degrees) {
    const found = root ? notes.filter((n) => n.letter === mod(root.letter + d - 1, 7)) : []
    const tone = found.length === 1 ? found[0] : chordTones?.[CHORD_TONE[d] ?? -1]
    if (!tone) return null
    out.push({ letter: tone.letter, acc: tone.acc })
  }
  return out
}

/** a cell's MIDI pitches from `first`: each note the next of its pitch class from the last, up or down by the contour's move */
export function cellPitches(tones: readonly Spelled[], contour: Contour, first: number): readonly number[] {
  const pcs = tones.map(pcOf)
  return pcs.reduce<number[]>((acc, pc, i) => {
    if (i === 0) return [first]
    const prev = pcs[i - 1]!
    const step = contour[i - 1] === 'd' ? -(mod(prev - pc - 1, 12) + 1) : mod(pc - prev - 1, 12) + 1
    return [...acc, acc[i - 1]! + step]
  }, [])
}
