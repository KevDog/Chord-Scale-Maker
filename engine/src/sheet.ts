import type { Row } from './chart'
import { qualityScale } from './chart'
import { type ChordToken, chordTokensOrNull, parseChord, writtenChordRoot, writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { isPentatonicSelection, type PracticeSelection, practiceKeys, selectedNotes, startReference } from './practice'
import { pentatonicPick, type StaffPentatonic } from './pentatonics'
import { baseQuality, resolveQuality } from './qualities'
import { parseScale } from './scales'
import type { Key } from './analysis/keys'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { chunk, orNull } from './util'
import { type Mode, type Part, type Pitched, type ScaleLabel, resolveStart, scaleLabel, scaleNotes } from './part'
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
  error: string | null // shown instead of notes
  last: boolean // final bar line
}>
export type SheetPart = Readonly<{ mode: Mode; heading: string; pages: readonly (readonly StaffModel[])[] }>

/** one line of the scale sheet: the rows that play one scale over one chord (row: the first; chords: as written, once each) */
export type ScaleLine = Readonly<{ row: number; chords: readonly string[] }>

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
  const lines = new Map<string, { row: number; chords: string[] }>()
  rows.forEach((r, i) => {
    const key = lineKey(r.chord, scaleOf(r, i))
    const line = lines.get(key)
    if (!line) lines.set(key, { row: i, chords: [r.chord] })
    else if (!line.chords.includes(r.chord)) line.chords.push(r.chord)
  })
  return [...lines.values()]
}
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
  practice: PracticeSelection | null,
): Pick<StaffModel, 'keys' | 'selected' | 'pentatonic'> {
  const reference = mode === 'from' ? startReference(startText) : orNull(() => writtenChordRootLenient(part, row.chord, scale))
  const keys = reference ? practiceKeys(reference, notes, mode === 'root' ? (resolveQuality(row.chord)?.quality ?? null) : null) : null
  if (isPentatonicSelection(practice)) {
    const chordRoot = orNull(() => writtenChordRootLenient(part, row.chord, scale)) ?? scaleLabel(part, scale).root
    const { pentatonic, lit } = pentatonicPick(notes.map((n) => pcOf(n)), chordRoot, practice.rank)
    return { keys, selected: keys ? lit : null, pentatonic }
  }
  return { keys, selected: practice && keys ? selectedNotes(practice, row.chord, keys) : null, pentatonic: null }
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
): StaffModel {
  const startKey = 'midi' in start ? start.midi : start.error
  const keySig = key === undefined ? null : keySignature(key, part)
  const id = [chordTexts.join(' '), scale, part.clef, part.trans, mode, startKey, keySig, showClefAndKey ? '' : 'bare'].join('|')
  const base = { id, last, keySig, showClefAndKey }
  const chords = chordTexts.map((c) => chordTokensOrNull(part, c, scale))
  const none = { notes: [], accidentals: [], intervals: null, keys: null, selected: null, pentatonic: null }
  if (scale === null) return { ...base, ...none, chords, scale: null, error: chords[0] ? 'Choose a scale' : "Can't read this chord" }
  try {
    const label = scaleLabel(part, scale)
    if ('error' in start) return { ...base, ...none, chords, scale: label, error: start.error }
    const notes = scaleNotes(part, scale, mode, start.midi)
    return {
      ...base,
      chords,
      scale: label,
      notes,
      accidentals: accidentalsInBar(notes.map((n) => ({ letter: n.letter, acc: n.acc, octave: octaveOf(n) })), keySig),
      intervals: intervalsOrNull(part, row.chord, scale, notes),
      ...practiceFor(row, part, mode, startText, scale, notes, practice),
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
 * own scale or its quality's default.
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
): SheetPart[] {
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  return modesFor(choice).map((mode) => {
    const start = startFor(part, mode, startText)
    return {
      mode,
      heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
      pages: chunk(
        lines.map((l, n) => {
          const r = rows[l.row] as Row
          return staff(r, l.chords, scaleOf(r, l.row), part, mode, start, n === lines.length - 1, startText, practice, key, key === undefined || n === 0)
        }),
        perPage,
      ),
    }
  })
}
