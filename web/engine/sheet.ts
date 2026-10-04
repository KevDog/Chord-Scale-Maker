import type { Row } from './chart'
import { resolveScale } from './chart'
import { type ChordToken, chordTokens } from './chord'
import { type Mode, type Part, type Pitched, type ScaleLabel, resolveStart, scaleLabel, scaleNotes } from './part'
import { accText, LETTERS, NAT_PC, parseRoot, rootName } from './pitch'

/** one staff on the page: everything a component needs, no DOM */
export type StaffModel = Readonly<{
  id: string // unique per sheet; stable while the row and its position are unchanged
  section: string
  bar: string
  chord: readonly ChordToken[] | null // null: chord can't be read
  scale: ScaleLabel | null
  notes: readonly Pitched[]
  error: string | null // shown instead of notes
  last: boolean // final bar line
}>
export type SheetPart = Readonly<{ mode: Mode; heading: string; pages: readonly (readonly StaffModel[])[] }>
export type ModeChoice = Mode | 'both'

export const modesFor = (choice: ModeChoice): readonly Mode[] => (choice === 'both' ? ['from', 'root'] : [choice])

/** VexFlow key for a pitched note, e.g. { E, -1, 63 } -> "eb/4" (middle C = C4) */
export function toVexKey(n: Pitched): string {
  const octave = (n.midi - NAT_PC[n.letter] - n.acc) / 12 - 1
  return `${LETTERS[n.letter].toLowerCase()}${accText(n.acc)}/${octave}`
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function chordOrNull(part: Part, chord: string, scale: string | null): readonly ChordToken[] | null {
  try {
    return chordTokens(part, chord, scale ?? undefined)
  } catch {
    try {
      return chordTokens(part, chord) // scale is bad but the chord may be fine
    } catch {
      return null
    }
  }
}

function staff(row: Row, index: number, part: Part, mode: Mode, start: number, last: boolean): StaffModel {
  const scale = resolveScale(row)
  const base = { id: `${index}|${row.section}|${row.bar}|${row.chord}|${row.scale}|${mode}|${start}`, section: row.section, bar: row.bar, last }
  const chord = chordOrNull(part, row.chord, scale)
  if (scale === null) return { ...base, chord, scale: null, notes: [], error: chord ? 'Choose a scale' : "Can't read this chord" }
  try {
    return { ...base, chord, scale: scaleLabel(part, scale), notes: scaleNotes(part, scale, mode, start), error: null }
  } catch (e) {
    return { ...base, chord, scale: null, notes: [], error: message(e) }
  }
}

/** "Eb" -> "E♭" for headings */
export const noteText = (text: string): string => {
  const r = parseRoot(text.trim().replace(/\d$/, ''))
  return rootName(r).replace(/b/g, '♭').replace(/#/g, '♯')
}

const chunk = <T>(xs: readonly T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/** the printable sheet: one part per mode, each split into pages of perPage staves */
export function buildSheet(
  rows: readonly Row[],
  part: Part,
  choice: ModeChoice,
  startText: string,
  perPage: number,
): SheetPart[] {
  const start = resolveStart(part.clef, startText)
  return modesFor(choice).map((mode) => ({
    mode,
    heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
    pages: chunk(
      rows.map((r, i) => staff(r, i, part, mode, start, i === rows.length - 1)),
      perPage,
    ),
  }))
}
