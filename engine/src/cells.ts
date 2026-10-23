import type { Approach } from './approaches'
import { arpeggioCells, arpeggioTones, type Cells, cellVoices, type Follows, type NoteValue, placeWhole } from './arpeggios'
import { type CellOrder, orderCell, type PartialContour } from './cellOrder'
import { aimedCell, PALETTE, substituteFor } from './cellPhrase'
import { familyOf } from './analysis/stream'
import { isRest, writtenChordRootLenient } from './chord'
import type { GuideInput, GuideNote } from './guideTones'
import type { Range } from './instruments'
import type { Metre } from './metre'
import { type Part, rangeOf, writtenScale } from './part'
import { mod, pcOf, shiftBy, type Spelled } from './pitch'
import { readChord } from './qualities'
import { SCALES } from './scales'
import { orNull } from './util'
import type { RhythmPlan } from './rhythm/pour'

/**
 * Melodic cells (#298, after Randy Vincent's Building Solo Lines From Cells): four notes written as degrees from the
 * chord's root, read through its scale, with a contour of up/down for each of the three moves. Pure; no DOM.
 */

export type Contour = readonly ('u' | 'd')[]
/** a degree: a number, read through the chord's scale; or chromatic (#377), semis semitones above the root on the letter n names */
export type Degree = number | Readonly<{ n: number; semis: number }>
export type Cell = Readonly<{ degrees: readonly Degree[]; contour: Contour }>

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
const ACCIDENTAL: Readonly<Record<string, number>> = { b: -1, s: 1, n: 0 }

/** "7" as 7; "b9", "s5", "n7" as ♭9, ♯5, ♮7: the major scale's degree, flattened, sharpened or natural */
function degreeOf(token: string): Degree {
  const m = /^([bsn])(\d+)$/.exec(token)
  if (!m) return Number(token)
  const n = Number(m[2])
  return { n, semis: mod((MAJOR[(n - 1) % 7] as number) + (ACCIDENTAL[m[1] as string] as number), 12) }
}

const cell = (degrees: string, contour: string): Cell => ({ degrees: degrees.split(' ').map(degreeOf), contour: [...contour] as Contour })

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

const DOMINANT_ONLY = [
  ['1 n7 7 6', 'ddd'],
  ['5 s5 6 7', 'uuu'],
  ['b9 1 3 5', 'duu'],
  ['3 5 7 b9', 'uuu'],
] as const

/** "b9 1 3 5" as "♭9 1 3 5" */
const glyphed = (degrees: string): string => degrees.replace(/b/g, '♭').replace(/s/g, '♯').replace(/n/g, '♮')

/**
 * chromatic cells (#377): single cells for dominants (any other chord plays its 7th chord arpeggio up from the root);
 * II–V chromatic plays its cell over dominants and `others` over every other chord
 */
export const CHROMATIC_CELLS: readonly Readonly<{ id: Dashed<(typeof DOMINANT_ONLY)[number][0]> | 'ii-v-chromatic'; label: string; cell: Cell; dominantOnly: boolean; others?: Cell }>[] = [
  ...DOMINANT_ONLY.map(([degrees, contour]) => ({ id: degrees.replaceAll(' ', '-') as Dashed<typeof degrees>, label: glyphed(degrees), cell: cell(degrees, contour), dominantOnly: true })),
  { id: 'ii-v-chromatic', label: 'II–V chromatic', cell: cell('3 5 7 b9', 'uuu'), dominantOnly: false, others: cell('1 3 5 7', 'uuu') },
]

export type CellId = keyof typeof CELL_SYSTEMS | (typeof SINGLE_CELLS)[number]['id'] | (typeof CHROMATIC_CELLS)[number]['id']
/** a system (a pair of cells), the only cells Phrase aims */
export const isSystemId = (id: CellId): id is keyof typeof CELL_SYSTEMS => id in CELL_SYSTEMS
const chromaticOf = (id: string) => CHROMATIC_CELLS.find((c) => c.id === id)
export const isCellId = (x: unknown): x is CellId =>
  typeof x === 'string' && (x in CELL_SYSTEMS || SINGLE_CELLS.some((c) => c.id === x) || chromaticOf(x) !== undefined)
export const cellLabel = (id: CellId): string => (isSystemId(id) ? CELL_SYSTEMS[id].label : (chromaticOf(id)?.label ?? id.replaceAll('-', ' ')))

const CHORD_TONE: Readonly<Record<number, number>> = { 1: 0, 3: 1, 5: 2, 7: 3 }

/**
 * a cell's notes over a chord: degree d is the written scale's note d-1 letters above its root; with no such note (or
 * two) the chord tone of that number (1, 3, 5, 7); with none, null. A chromatic degree (#377) is absolute: its
 * semitones above the root (the chord's as written, else the scale's), on the letter n-1 above it
 */
export function cellTones(part: Part, chord: string, scale: string | undefined, degrees: readonly Degree[]): readonly Spelled[] | null {
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
  const from = orNull(() => writtenChordRootLenient(part, chord, scale)) ?? root
  const out: Spelled[] = []
  for (const d of degrees) {
    if (typeof d !== 'number') {
      if (!from) return null
      out.push(shiftBy(from, d.n - 1, d.semis))
      continue
    }
    const found = root ? notes.filter((n) => n.letter === mod(root.letter + d - 1, 7)) : []
    const tone = found.length === 1 ? found[0] : chordTones?.[CHORD_TONE[d] ?? -1]
    if (!tone) return null
    out.push({ letter: tone.letter, acc: tone.acc })
  }
  return out
}

/**
 * a cell's notes over a substitute (#378): each degree as cellTones reads it, else the scale formula's degree of that
 * number when it has just one (Half-Whole's 2, its ♭2, though its lettering gives no note a 2nd's letter); null if a
 * degree has neither
 */
function substituteTones(part: Part, chord: string, scale: string | undefined, degrees: readonly Degree[]): readonly Spelled[] | null {
  const formula = scale === undefined ? null : orNull(() => {
    const w = writtenScale(part, scale)
    return (SCALES[w.key][0] as string).split(' ').map((f, i) => ({ n: Number(f.replace(/[b#]/g, '')), note: w.degrees[i] }))
  })
  const out: Spelled[] = []
  for (const d of degrees) {
    const numbered = typeof d === 'number' ? (formula?.filter((f) => f.n === mod(d - 1, 7) + 1) ?? []) : []
    const tone = cellTones(part, chord, scale, [d])?.[0] ?? (numbered.length === 1 ? numbered[0]?.note : undefined)
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

/** a partial contour's open moves, each the nearer way between the two notes (the smaller semitone distance; a tritone goes up) */
export function fillContour(tones: readonly Spelled[], contour: PartialContour): Contour {
  return contour.map((m, i) => {
    const [from, to] = [tones[i], tones[i + 1]]
    if (!from || !to) throw new Error(`a contour's move ${i + 1} is between two notes: ${tones.length} notes`)
    if (m) return m
    return mod(pcOf(to) - pcOf(from), 12) <= 6 ? 'u' : 'd'
  })
}

/** the Changes sheet's Cells line (#298): which system or single cell the line plays; order (#376) re-reads every cell; phrase (#379, #380) aims them at the next chord */
export type CellsLine = Readonly<{ kind: 'cells'; id: CellId; order?: CellOrder; phrase?: boolean }>

/** a cell's note value: sixteenths in a chord shorter than two beats, else eighths (four notes make two beats) */
export const CELL_VALUE = (chordBeats: number): NoteValue => (chordBeats < 2 ? 0.25 : 0.5)

/** two neighboring notes on one pitch class */
const doubled = (tones: readonly Spelled[]): boolean => tones.some((t, i) => i > 0 && pcOf(t) === pcOf(tones[i - 1] as Spelled))

/** a dominant 7th chord, by the analysis's family (not sus) */
const isDominant = (chord: string): boolean => familyOf(readChord(chord)?.quality ?? '') === 'dominant'

/**
 * the pair of cells a line alternates over a chord: a system's A and B, or a single cell twice; a chromatic cell (#377)
 * by the chord's quality, null where it has none (a dominant-only cell over another chord)
 */
function pairOf(id: CellId, chord: string): readonly [Cell, Cell] | null {
  if (isSystemId(id)) return [CELL_SYSTEMS[id].a, CELL_SYSTEMS[id].b]
  const chromatic = chromaticOf(id)
  const single = chromatic ? (isDominant(chord) ? chromatic.cell : chromatic.others) : (SINGLE_CELLS.find((c) => c.id === id)?.cell ?? SINGLE_CELLS[0]!.cell)
  return single ? [single, single] : null
}

type Ordered = ReturnType<typeof orderCell>

/** the pair's cell for a slot count: A on an even count, B on an odd */
const cellAt = (pair: readonly [Cell, Cell], count: number): Cell => (count % 2 === 0 ? pair[0] : pair[1])

/** a cell placed whole in the part's range (placeWhole) */
const placeCell = (tones: readonly Spelled[], contour: Contour, range: Range, prev: number | null): readonly number[] =>
  placeWhole(pcOf(tones[0] as Spelled), (m) => cellPitches(tones, contour, m), range, prev)

/** a chord's cells, and with phrase on (#379, #380) the palette's (aimedCell), each in the line's Order and read through its scale */
type Read = Readonly<{ cell: Cell; ordered: Ordered; tones: readonly Spelled[]; from: number }>

/** a chord to read cells through: the slot's own, or a substitute's (substituteFor; sub: read by substituteTones) */
type Over = Readonly<{ chord: string; scale?: string; sub?: true }>

/**
 * the run of rows a dominant's substitutes count over (#378): the index-th chord and the rows next to it that restate it
 * (the same symbol and scale, unpinned, back to back in one block), as one chord: its beats summed, `from` its first
 * row, `next` the chord after the run
 */
function restated(chords: readonly GuideInput[], index: number): Readonly<{ chord: GuideInput; from: number; next: GuideInput | undefined }> {
  const same = (x: GuideInput | undefined, y: GuideInput | undefined): boolean =>
    !!x && !!y && !x.pinned && !y.pinned && x.chord === y.chord && x.scale === y.scale && x.block === y.block && x.start + x.beats === y.start
  let from = index
  while (same(chords[from - 1], chords[from])) from--
  let to = index
  while (same(chords[to], chords[to + 1])) to++
  const run = chords.slice(from, to + 1)
  return { chord: { ...(chords[index] as GuideInput), start: run[0]?.start ?? 0, beats: run.reduce((s, c) => s + c.beats, 0) }, from, next: chords[to + 1] }
}

/**
 * a chord's cells (the index-th of chords): A then B by the run's count, each read through the chord's scale; a slot
 * whose cell has no tones plays the 7th chord arpeggio up from the root (with none, the other cell); null if neither cell
 * has tones, or the line's chromatic cell has none for this chord (pairOf). With phrase on and a system, a whole eighth-note cell is aimed at the next slot's target (aimedCell): the
 * first note of the next slot's system cell, over this chord or the next by what follows it (Follows); over a long
 * dominant that resolves, a slot is read through its substitute (substituteFor, #378), else (no tones there) its own;
 * a dominant restated row by row counts its slots on across the rows (restated). cellCounts: the cells each row has
 * played so far in this line, which next adds to
 */
function cellsOf(part: Part, chords: readonly GuideInput[], index: number, line: CellsLine, range: Range, cellCounts: Map<number, number>): Cells | null {
  const chord = chords[index] as GuideInput
  const order = line.order ?? 'as-written'
  const pair = pairOf(line.id, chord.chord)
  if (!pair) return null
  const aims = line.phrase === true && isSystemId(line.id) && CELL_VALUE(chord.beats) === 0.5
  const run = restated(chords, index)
  /** the run's slot of this row's nth cell: the cells its rows before this one played, and nth */
  const inRun = (nth: number): number => chords.slice(run.from, index).reduce((s, _, k) => s + (cellCounts.get(run.from + k) ?? 0), nth)
  const subAt = (slot: number): Over | null => {
    const s = aims ? substituteFor(run.chord, run.next, slot) : null
    return s && { ...s, sub: true }
  }
  const subOf = (nth: number): Over | null => subAt(inRun(nth))
  const tones: Spelled[] = []
  /** the line's cells read through a chord, their tones added to the chord's */
  const readThrough = (over: Over): readonly Read[] => {
    const reads: Read[] = []
    for (const c of aims ? [...pair, ...PALETTE] : pair) {
      const ts = (over.sub ? substituteTones : cellTones)(part, over.chord, over.scale, orderCell(c, order).degrees)
      if (!ts || reads.some((r) => r.cell === c)) continue
      reads.push({ cell: c, ordered: orderCell(c, order), tones: ts, from: tones.length })
      tones.push(...ts)
    }
    return reads
  }
  const own = readThrough(chord)
  // a chromatic cell that doubles a note (5 ♯5 6 7 over Mixolydian ♭6: D D♯ E♭ F) plays the arpeggio instead (#377)
  if (chromaticOf(line.id) && own.some((r) => doubled(r.tones))) return null
  const subs = new Map<string, readonly Read[]>()
  for (const s of [subAt(1), subAt(2)]) if (s) subs.set(s.chord, readThrough(s))
  /** the reads a slot plays: its substitute's when that reads the slot's system cell, else the chord's own */
  const readsAt = (nth: number, count: number): readonly Read[] => {
    const s = subOf(nth)
    const reads = s ? subs.get(s.chord) : undefined
    return reads?.some((r) => r.cell === cellAt(pair, count)) ? reads : own
  }
  const readOf = (reads: readonly Read[], c: Cell) => reads.find((r) => r.cell === c)
  const [a, b] = [readOf(own, pair[0]), readOf(own, pair[1])]
  if (!a && !b) return null
  const at = tones.length
  const arpeggio = arpeggioCells(part, chord, 'up-root')
  const played = (r: Read, prev: number | null) => ({
    order: r.tones.map((_, i) => i + r.from),
    up: true,
    midi: placeCell(r.tones, fillContour(r.tones, r.ordered.contour), range, prev),
  })
  /** a cell's first note over a chord, as a pitch class; null where the cell has no tones there (the slot plays the arpeggio, #462) */
  const firstOf = (over: Over, c: Cell): number | null => {
    const first = (over.sub ? substituteTones : cellTones)(part, over.chord, over.scale, orderCell(c, order).degrees)?.[0]
    return first ? pcOf(first) : null
  }
  /**
   * the next slot's target pitch class: its system cell's first note over this chord (its substitute's for a
   * substitute slot, else its own), or the next (none, a rest, or a cell with no tones there: none)
   */
  const targetOf = (count: number, nth: number, follows: Follows): number | null => {
    const c = cellAt(pair, count + 1)
    if (follows === 'cell' || (follows === 'chord' && chords[index + 1] !== run.next)) {
      // this chord's next slot, or its restatement's (the same chord, its run's next slot)
      const s = subOf(nth + 1)
      return firstOf(s && readsAt(nth + 1, count + 1) !== own ? s : chord, c)
    }
    const next = follows === 'chord' ? chords[index + 1] : undefined
    return next && !isRest(next.chord) ? firstOf(next, c) : null
  }
  return {
    tones: [...tones, ...(arpeggio?.tones ?? [])],
    carry: true,
    turn: 'chord',
    next: (prev, count, last, nth, follows = null) => {
      cellCounts.set(index, nth + 1)
      const reads = readsAt(nth, count)
      const r = readOf(reads, cellAt(pair, count))
      if (r) {
        const target = aims ? targetOf(count, nth, follows) : null
        return played(target === null ? r : (readOf(reads, aimedCell(r.cell, r.tones, target, (c) => readOf(reads, c)?.tones ?? null, order)) ?? r), prev)
      }
      if (arpeggio) {
        const { order: o, up } = arpeggio.next(prev, count, last, nth)
        return { order: o.map((i) => i + at), up }
      }
      return played((a ?? b) as Read, prev)
    },
  }
}

/**
 * the Cells line's voice for chords in time order: a cell per two beats (cellVoices, in CELL_VALUE's note value),
 * A then B for a system, each placed whole nearest the last note in the part's range; a chord whose cells have no
 * tones plays its 7th chord arpeggio up from the root; approach: a figure into each chord's first note (cellVoices);
 * rhythm: poured into its attacks (cellVoices)
 */
export function cellsVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: CellsLine,
  approach: Approach = 'none',
  rhythm?: RhythmPlan,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  const cellCounts = new Map<number, number>() // cells each row has played, as the line is drawn (cellsOf)
  return cellVoices(chords, part, beats, keySig, (c, i) => cellsOf(part, chords, i, line, range, cellCounts) ?? arpeggioCells(part, c, 'up-root'), CELL_VALUE, approach, rhythm)
}
