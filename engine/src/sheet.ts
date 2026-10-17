import type { ChordAt } from './changes'
import { type ChordPicks, livePicks, pickTarget } from './chordPicks'
import type { Row } from './chart'
import { qualityScale } from './chart'
import { type ChordToken, chordTokensOrNull, isRest, parseChord, writtenChordRoot, writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { type HexPair, hexatonicPairs, hexatonicPick, type StaffHexatonic } from './hexatonics'
import { isHexatonicSelection, isPentatonicSelection, type PracticeSelection, practiceKeys, selectedNotes, startReference } from './practice'
import { outsideNotes, pentatonicPick, type StaffPentatonic } from './pentatonics'
import { baseQuality, resolveQuality } from './qualities'
import { parseScale } from './scales'
import type { Key } from './analysis/keys'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { chunk, orNull } from './util'
import { type Mode, type Part, type Pitched, type ScaleLabel, resolveStart, scaleLabel, scaleNotes, writtenRoot, writtenScale } from './part'
import { accText, glyphs, LETTERS, mod, NAT_PC, parseRoot, pcOf, rootName } from './pitch'
import type { Resolved } from './resolve'

/**
 * The scale sheet's view model: every scale sheet line (`scaleLines`) becomes a StaffModel (labels, written notes, interval labels or an
 * error), split into pages, one part per mode. Components only draw it.
 */

/** one staff on the page: everything a component needs, no DOM */
export type StaffModel = Readonly<{
  id: string // unique per sheet; stable while the line's scale, chords and the view are unchanged
  chords: readonly (readonly ChordToken[] | null)[] // the line's chord symbols, as written, once each (null: can't be read)
  scale: ScaleLabel | null
  notes: readonly Pitched[]
  keySig: string | null // VexFlow major spec for the staff's key signature; null: none drawn
  showClefAndKey: boolean // draw the clef (and keySig) at its start: every staff without signatures, each part's first with them
  accidentals: readonly (string | null)[] // per note: the accidental to draw ("#", "b", "n"…) or null
  intervals: readonly string[] | null // each note against the chord root (b9, #11…); null if the chord can't be read
  keys: readonly string[] | null // practice keys: each note's spelled interval from the mode's reference
  selected: readonly boolean[] | null // practice: which notes are picked; null when practice is off
  pentatonic: StaffPentatonic | null // the Pentatonic preset's pick for this staff (#266); null otherwise
  hexatonic: StaffHexatonic | null // the Hexatonic preset's pair for this staff; null otherwise, and where the scale has none
  second: readonly boolean[] | null // the Hexatonic preset: which selected notes are in group B; null otherwise
  outside: readonly boolean[] | null // the Pentatonic preset (#308): which notes are its pentatonic's, added from outside the scale; null otherwise
  positions: readonly ChordAt[] // the drawn chords it covers (#303), in form order; [] without picks given, or all in a folded repeat
  varies: boolean // its positions have different picks of the preset's kind (a pick and none differ)
  source: Readonly<{ chord: string; scale: string }> | null // what a pick on it is made for: its first row's chord and scale, concert; null with no scale
  error: string | null // shown instead of notes
  last: boolean // final bar line
}>
export type SheetPart = Readonly<{ mode: Mode; heading: string; pages: readonly (readonly StaffModel[])[] }>
/** the chord picks (#303) and each row's drawn position (chordPositions over the rows' document) */
export type SheetPicks = Readonly<{ picks: ChordPicks; at: ReadonlyMap<number, ChordAt> }>
/** a staff's pick, written for the part: a pentatonic's root pc, or a triad pair's two root pcs */
type StaffPick = number | readonly [number, number] | null

/** one line of the scale sheet: the rows that play one scale over one chord (row: the first; chords: as written, once each) */
export type ScaleLine = Readonly<{ row: number; rows: readonly number[]; chords: readonly string[] }>

/** what puts two rows on one line: the scale and the written chord's root and canonical quality; text when either can't be read */
function lineKey(chord: string, scale: string | null): string {
  const read = orNull(() => {
    const s = parseScale(scale ?? '')
    const c = parseChord(chord)
    const quality = baseQuality(c.quality)
    return quality === null ? null : [pcOf(s.root), s.key, pcOf(c.root), quality].join(' ')
  })
  return read ?? `?${chord}|${scale ?? ''}`
}

/** the chart's rows as scale sheet lines, in order of first appearance */
export function scaleLines(rows: readonly Row[], scaleOf: (row: Row, index: number) => string | null): ScaleLine[] {
  const lines = new Map<string, { row: number; rows: number[]; chords: string[] }>()
  rows.forEach((r, i) => {
    if (isRest(r.chord)) return // a rest has no scale to practise
    const key = lineKey(r.chord, scaleOf(r, i))
    const line = lines.get(key)
    if (!line) lines.set(key, { row: i, rows: [i], chords: [r.chord] })
    else {
      line.rows.push(i)
      if (!line.chords.includes(r.chord)) line.chords.push(r.chord)
    }
  })
  return [...lines.values()]
}

/** the drawn positions a line covers (#303): its rows' positions on the Changes sheet, in form order, once each */
export const linePositions = (line: ScaleLine, at: ReadonlyMap<number, ChordAt>): readonly ChordAt[] => [...new Set(line.rows.flatMap((i) => at.get(i) ?? []))]
export type ModeChoice = Mode | 'both'

export const modesFor = (choice: ModeChoice): readonly Mode[] => (choice === 'both' ? ['from', 'root'] : [choice])

/** VexFlow key for a pitched note, e.g. { E, -1, 63 } -> "eb/4" (middle C = C4) */
export function toVexKey(n: Pitched): string {
  const d = n.midi - NAT_PC[n.letter] - n.acc
  if (mod(d, 12) !== 0) throw new Error(`pitch ${n.midi} does not match its spelling`)
  return `${LETTERS[n.letter].toLowerCase()}${accText(n.acc)}/${d / 12 - 1}`
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))


const intervalsOrNull = (part: Part, chord: string, scale: string, notes: readonly Pitched[]): readonly string[] | null =>
  orNull(() => intervalLabels(writtenChordRoot(part, chord, scale), notes, resolveQuality(chord)?.quality ?? null))

/** the written start pitch for 'from' mode; 'root' mode ignores it, so a bad start text only matters there */
type Start = Readonly<{ midi: number } | { error: string }>

function startFor(part: Part, mode: Mode, text: string): Start {
  if (mode === 'root') return { midi: 0 }
  try {
    return { midi: resolveStart(part.clef, text) }
  } catch (e) {
    return { error: message(e) }
  }
}

/** practice keys and selection for one staff's notes (keys null if the reference can't be read) */
function practiceFor(
  row: Row,
  part: Part,
  mode: Mode,
  startText: string,
  scale: string,
  notes: readonly Pitched[],
  degrees: readonly Pitched[],
  practice: PracticeSelection | null,
  pick: StaffPick,
  low: number,
): Pick<StaffModel, 'notes' | 'keys' | 'selected' | 'pentatonic' | 'hexatonic' | 'second' | 'outside'> & Readonly<{ degrees: readonly Pitched[] }> {
  const reference = mode === 'from' ? startReference(startText) : orNull(() => writtenChordRootLenient(part, row.chord, scale))
  // from the root, a key is the note's degree: in the formula's letters, whatever letters the staff shows (#279)
  const keysOf = (ns: readonly Pitched[], ds: readonly Pitched[]) => (reference ? practiceKeys(reference, mode === 'root' ? ds : ns, mode === 'root' ? (resolveQuality(row.chord)?.quality ?? null) : null) : null)
  const keys = keysOf(notes, degrees)
  const none = { notes, degrees, pentatonic: null, hexatonic: null, second: null, outside: null }
  const chordRoot = () => orNull(() => writtenChordRootLenient(part, row.chord, scale)) ?? scaleLabel(part, scale).root
  if (isPentatonicSelection(practice)) {
    const pcs = notes.map((n) => pcOf(n))
    const { pentatonic, lit, root } = pentatonicPick(pcs, chordRoot(), practice.degree, typeof pick === 'number' ? pick : null)
    // the pentatonic's notes outside the scale join the staff, lit, in pitch order (#308)
    const added = outsideNotes(root, pcs, low)
    const all = [...notes.map((n, i) => ({ n, d: degrees[i] ?? n, lit: lit[i] ?? false, out: false })), ...added.map((n) => ({ n, d: n, lit: true, out: true }))].sort((a, b) => a.n.midi - b.n.midi)
    const merged = { notes: all.map((x) => x.n), degrees: all.map((x) => x.d) }
    return { ...none, ...merged, keys: keysOf(merged.notes, merged.degrees), selected: all.map((x) => x.lit), outside: all.map((x) => x.out), pentatonic }
  }
  if (isHexatonicSelection(practice)) {
    const quality = orNull(() => baseQuality(parseChord(row.chord).quality))
    const pcs = notes.map((n) => pcOf(n))
    const { hexatonic, lit, second } = hexatonicPick(writtenScale(part, scale).notes, chordRoot(), quality, practice.pair, practice.grouping, pcs, Array.isArray(pick) ? (pick as readonly [number, number]) : null)
    return { ...none, keys, selected: lit, hexatonic, second }
  }
  return { ...none, keys, selected: practice && keys ? selectedNotes(practice, row.chord, keys) : null }
}

function staff(
  row: Row,
  chordTexts: readonly string[],
  scale: string | null,
  part: Part,
  mode: Mode,
  start: Start,
  last: boolean,
  startText: string,
  practice: PracticeSelection | null,
  key: Key | null | undefined,
  showClefAndKey: boolean,
  covers: Cover,
): StaffModel {
  const startKey = 'midi' in start ? start.midi : start.error
  const keySig = key === undefined ? null : keySignature(key, part)
  const id = [chordTexts.join(' '), scale, part.clef, part.trans, mode, startKey, keySig, showClefAndKey ? '' : 'bare'].join('|')
  const base = { id, last, keySig, showClefAndKey, positions: covers.positions, source: scale === null ? null : { chord: row.chord, scale } }
  const chords = chordTexts.map((c) => chordTokensOrNull(part, c, scale))
  const none = { notes: [], accidentals: [], intervals: null, keys: null, selected: null, pentatonic: null, hexatonic: null, second: null, outside: null, varies: false }
  if (scale === null) return { ...base, ...none, chords, scale: null, error: chords[0] ? 'Choose a scale' : "Can't read this chord" }
  try {
    const label = scaleLabel(part, scale)
    if ('error' in start) return { ...base, ...none, chords, scale: label, error: start.error }
    const scaleOnly = scaleNotes(part, scale, mode, start.midi)
    const low = mode === 'root' ? (scaleOnly[0]?.midi ?? 0) : start.midi
    const { degrees, ...practiced } = practiceFor(row, part, mode, startText, scale, scaleOnly, scaleNotes(part, scale, mode, start.midi, 'degrees'), practice, covers.pick, low)
    const { notes } = practiced
    return {
      ...base,
      chords,
      scale: label,
      accidentals: accidentalsInBar(notes.map((n) => ({ letter: n.letter, acc: n.acc, octave: octaveOf(n) })), keySig),
      intervals: intervalsOrNull(part, row.chord, scale, degrees),
      ...practiced,
      varies: covers.varies,
      error: null,
    }
  } catch (e) {
    return { ...base, ...none, chords, scale: null, error: message(e) }
  }
}

/** "Eb" -> "E♭" for headings; text that isn't a note is shown as typed */
export function noteText(text: string): string {
  try {
    return glyphs(rootName(parseRoot(text.trim().replace(/\d$/, ''))))
  } catch {
    return text.trim()
  }
}

/**
 * the page subtitle: "Subtitle – Tenor Sax (Bb) (Spelled from C)";
 * just the heading when there is neither a subtitle nor an instrument label
 */
export function pageSubtitle(subtitle: string, instrument: string, heading: string): string {
  const bits = [subtitle, instrument].filter(Boolean)
  return bits.length ? `${bits.join(' – ')} (${heading})` : heading
}


/**
 * the printable sheet: one part per mode, each split into pages of perPage lines (`scaleLines`); never throws.
 * key: the chart's home key for the signature (null: no key: line, no signature); undefined: signatures off. With
 * signatures, only each part's first staff starts with the clef and signature, and every staff's accidentals go against it.
 * resolved: resolveScales over the document the rows come from, at the sheet's level; without it each row plays its
 * own scale or its quality's default. picks (#303): each staff plays its first position's live pick of the preset's
 * kind, and varies where its positions' picks differ.
 */
export function buildSheet(
  rows: readonly Row[],
  part: Part,
  choice: ModeChoice,
  startText: string,
  perPage: number,
  practice: PracticeSelection | null = null,
  key?: Key | null,
  resolved?: ReadonlyMap<number, Resolved>,
  picks?: SheetPicks,
): SheetPart[] {
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  const live = picks && livePicks(picks.picks, new Map(rows.flatMap((r, i) => {
    const at = picks.at.get(i)
    return at === undefined ? [] : [[at, pickTarget(r.chord, scaleOf(r, i))] as const]
  })))
  const toWritten = pcOf(writtenRoot(part, parseRoot('C'), 'ionian')) // concert pc + this = written pc
  const covers = lines.map((l) => {
    if (!picks || !live) return NO_COVER
    const r = rows[l.row] as Row
    return coverOf(l, picks.at, live, toWritten, practice, () => staffPairs(r, scaleOf(r, l.row), part))
  })
  return modesFor(choice).map((mode) => {
    const start = startFor(part, mode, startText)
    return {
      mode,
      heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
      pages: chunk(
        lines.map((l, n) => {
          const r = rows[l.row] as Row
          return staff(r, l.chords, scaleOf(r, l.row), part, mode, start, n === lines.length - 1, startText, practice, key, key === undefined || n === 0, covers[n]!)
        }),
        perPage,
      ),
    }
  })
}

type Cover = Readonly<{ positions: readonly ChordAt[]; varies: boolean; pick: StaffPick }>
const NO_COVER: Cover = { positions: [], varies: false, pick: null }
/** a staff's triad pairs, as practiceFor reads them; [] when its scale can't be read */
const staffPairs = (row: Row, scale: string | null, part: Part): readonly HexPair[] =>
  (scale === null ? null : orNull(() => {
    const chordRoot = orNull(() => writtenChordRootLenient(part, row.chord, scale)) ?? scaleLabel(part, scale).root
    const quality = orNull(() => baseQuality(parseChord(row.chord).quality))
    return hexatonicPairs(writtenScale(part, scale).notes, chordRoot, quality)
  })) ?? []

/** the line's positions, whether their picks differ, and its first position's pick (written); a hexatonic pick not among the staff's pairs plays the sheet's pair, so counts as none */
function coverOf(line: ScaleLine, at: ReadonlyMap<number, ChordAt>, live: ChordPicks, toWritten: number, practice: PracticeSelection | null, pairsOf: () => readonly HexPair[]): Cover {
  const positions = linePositions(line, at)
  const kind = isPentatonicSelection(practice) ? 'pentatonic' : isHexatonicSelection(practice) ? 'hexatonic' : null
  if (!kind || !positions.length) return { positions, varies: false, pick: null }
  const written = (pc: number): number => mod(pc + toWritten, 12)
  const pairs = kind === 'hexatonic' ? pairsOf() : []
  const isPair = (lower: number, upper: number): boolean => pairs.some((p) => pcOf(p.lower.root) === lower && pcOf(p.upper.root) === upper)
  const vals = positions.map((p): StaffPick => {
    if (kind === 'pentatonic') {
      const v = Object.hasOwn(live.pentatonic, p) ? live.pentatonic[p] : undefined
      return v ? written(v.pc) : null
    }
    const v = Object.hasOwn(live.hexatonic, p) ? live.hexatonic[p] : undefined
    if (!v) return null
    const [lower, upper] = [written(v.roots[0]), written(v.roots[1])]
    return isPair(lower, upper) ? [lower, upper] : null
  })
  const keyOf = (v: StaffPick): string => (v === null ? '-' : typeof v === 'number' ? String(v) : v.join())
  return { positions, varies: new Set(vals.map(keyOf)).size > 1, pick: vals[0] ?? null }
}
