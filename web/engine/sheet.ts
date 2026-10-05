import type { Row } from './chart'
import { resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull, writtenChordRoot } from './chord'
import { intervalLabels } from './intervals'
import { resolveQuality } from './qualities'
import { chunk, orNull } from './util'
import { type Mode, type Part, type Pitched, type ScaleLabel, resolveStart, scaleLabel, scaleNotes } from './part'
import { accText, glyphs, LETTERS, mod, NAT_PC, parseRoot, rootName } from './pitch'

/** one staff on the page: everything a component needs, no DOM */
export type StaffModel = Readonly<{
  id: string // unique per sheet; stable while the row and its position are unchanged
  section: string
  bar: string
  chord: readonly ChordToken[] | null // null: chord can't be read
  scale: ScaleLabel | null
  notes: readonly Pitched[]
  intervals: readonly string[] | null // each note against the chord root (b9, #11…); null if the chord can't be read
  error: string | null // shown instead of notes
  last: boolean // final bar line
}>
export type SheetPart = Readonly<{ mode: Mode; heading: string; pages: readonly (readonly StaffModel[])[] }>
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

function staff(row: Row, index: number, part: Part, mode: Mode, start: Start, last: boolean): StaffModel {
  const scale = resolveScale(row)
  const startKey = 'midi' in start ? start.midi : start.error
  const id = [index, row.section, row.bar, row.chord, row.scale, part.clef, part.trans, mode, startKey].join('|')
  const base = { id, section: row.section, bar: row.bar, last }
  const chord = chordTokensOrNull(part, row.chord, scale)
  const none = { notes: [], intervals: null }
  if (scale === null) return { ...base, ...none, chord, scale: null, error: chord ? 'Choose a scale' : "Can't read this chord" }
  try {
    const label = scaleLabel(part, scale)
    if ('error' in start) return { ...base, ...none, chord, scale: label, error: start.error }
    const notes = scaleNotes(part, scale, mode, start.midi)
    return { ...base, chord, scale: label, notes, intervals: intervalsOrNull(part, row.chord, scale, notes), error: null }
  } catch (e) {
    return { ...base, ...none, chord, scale: null, error: message(e) }
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
 * page subtitle as the CLI builds it: "Subtitle – Tenor Sax (Bb) (Spelled from C)";
 * just the heading when there is neither a subtitle nor an instrument label
 */
export function pageSubtitle(subtitle: string, instrument: string, heading: string): string {
  const bits = [subtitle, instrument].filter(Boolean)
  return bits.length ? `${bits.join(' – ')} (${heading})` : heading
}


/** the printable sheet: one part per mode, each split into pages of perPage staves; never throws */
export function buildSheet(
  rows: readonly Row[],
  part: Part,
  choice: ModeChoice,
  startText: string,
  perPage: number,
): SheetPart[] {
  return modesFor(choice).map((mode) => {
    const start = startFor(part, mode, startText)
    return {
      mode,
      heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
      pages: chunk(
        rows.map((r, i) => staff(r, i, part, mode, start, i === rows.length - 1)),
        perPage,
      ),
    }
  })
}
