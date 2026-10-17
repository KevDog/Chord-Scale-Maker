import { arpeggioCells, arpeggioTones, type Cells, cellVoices, type NoteValue } from './arpeggios'
import type { GuideInput, GuideNote } from './guideTones'
import type { Range } from './instruments'
import type { Metre } from './metre'
import { type Part, rangeOf, writtenScale } from './part'
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

/** "1 2 3 5" as "1-2-3-5", in the type too, so a single cell's id is a literal */
type Dashed<S extends string> = S extends `${infer H} ${infer T}` ? `${H}-${Dashed<T>}` : S

const SINGLES = [
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

/** single cells: every slot plays the same one */
export const SINGLE_CELLS = SINGLES.map(([degrees, contour]) => ({ id: degrees.replaceAll(' ', '-') as Dashed<typeof degrees>, cell: cell(degrees, contour) }))

export type CellId = keyof typeof CELL_SYSTEMS | (typeof SINGLE_CELLS)[number]['id']
const isSystemId = (id: CellId): id is keyof typeof CELL_SYSTEMS => id in CELL_SYSTEMS
export const isCellId = (x: unknown): x is CellId => typeof x === 'string' && (x in CELL_SYSTEMS || SINGLE_CELLS.some((c) => c.id === x))
export const cellLabel = (id: CellId): string => (isSystemId(id) ? CELL_SYSTEMS[id].label : id.replaceAll('-', ' '))

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

/** the Changes sheet's Cells line (#298): which system or single cell the line plays */
export type CellsLine = Readonly<{ kind: 'cells'; id: CellId }>

/** a cell's note value: sixteenths in a chord shorter than two beats, else eighths (four notes make two beats) */
export const CELL_VALUE = (chordBeats: number): NoteValue => (chordBeats < 2 ? 0.25 : 0.5)

/** the pair of cells a line alternates: a system's A and B, or a single cell twice */
function pairOf(id: CellId): readonly [Cell, Cell] {
  if (isSystemId(id)) return [CELL_SYSTEMS[id].a, CELL_SYSTEMS[id].b]
  const single = SINGLE_CELLS.find((c) => c.id === id)?.cell ?? SINGLE_CELLS[0]!.cell
  return [single, single]
}

/**
 * a cell placed whole in the part's range: the first note with the fewest notes out of range, then nearest prev,
 * nearer the centre, the lower; with no prev (a run's start) the average nearest the centre, a tie the higher
 */
function placeCell(tones: readonly Spelled[], contour: Contour, range: Range, prev: number | null): readonly number[] {
  const first = pcOf(tones[0] as Spelled)
  const options: { midi: readonly number[]; out: number }[] = []
  for (let m = range.lo - 12; m <= range.hi + 12; m++) {
    if (mod(m, 12) !== first) continue
    const midi = cellPitches(tones, contour, m)
    options.push({ midi, out: midi.filter((x) => x < range.lo || x > range.hi).length })
  }
  const avg = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length
  const key = (o: (typeof options)[number]): readonly number[] => {
    const m = o.midi[0] ?? 0
    return prev === null ? [o.out, Math.abs(avg(o.midi) - range.centre), -m] : [o.out, Math.abs(m - prev), Math.abs(m - range.centre), m]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0)
  return [...options].sort((a, b) => cmp(key(a), key(b)))[0]?.midi ?? cellPitches(tones, contour, range.centre)
}

/** a chord's cells: A then B by the run's count, each read through the chord's scale; null if either has no tones */
function cellsOf(part: Part, chord: GuideInput, id: CellId, range: Range): Cells | null {
  const [a, b] = pairOf(id)
  const ta = cellTones(part, chord.chord, chord.scale, a.degrees)
  const tb = cellTones(part, chord.chord, chord.scale, b.degrees)
  if (!ta || !tb) return null
  return {
    tones: [...ta, ...tb],
    carry: true,
    turn: 'chord',
    next: (prev, count) => {
      const [tones, cell, at] = count % 2 === 0 ? ([ta, a, 0] as const) : ([tb, b, ta.length] as const)
      const midi = placeCell(tones, cell.contour, range, prev)
      return { order: tones.map((_, i) => i + at), up: true, midi }
    },
  }
}

/**
 * the Cells line's voice for chords in time order: a cell per two beats (cellVoices, in CELL_VALUE's note value),
 * A then B for a system, each placed whole nearest the last note in the part's range; a chord whose cells have no
 * tones plays its 7th chord arpeggio up from the root
 */
export function cellsVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: CellsLine,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  return cellVoices(chords, part, beats, keySig, (c) => cellsOf(part, c, line.id, range) ?? arpeggioCells(part, c, 'up-root'), CELL_VALUE)
}
