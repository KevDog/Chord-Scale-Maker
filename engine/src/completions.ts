import type { ChartDoc } from './chart'
import { setBarChords } from './edit'
import { rowNotes } from './notes'
import { defaultScaleOrNull, QUALITY_NAMES, readChord } from './qualities'
import type { ScaleView } from './resolve'

/**
 * The lead-sheet editor's chord field (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.2): what
 * completes a half-typed chord, and how the chart would read a candidate in its bar. Pure: no DOM.
 */

/** the qualities offered for a bare root, most common first */
const COMMON = ['7', 'm7', 'Maj7', 'm7b5', '7b9'] as const
const ROOT_RE = /^([A-G][b#]?)([^/]*)(\/.*)?$/

/** chord symbols that complete `text`: the typed text first, then the root with each matching quality; at most `limit` */
export function chordCompletions(text: string, limit = 6): readonly string[] {
  const t = text.trim()
  if (!t) return []
  const m = ROOT_RE.exec(t)
  if (!m) return [t]
  const [, root = '', suffix = '', bass = ''] = m
  const typed = suffix.toLowerCase()
  const pool = typed ? QUALITY_NAMES.filter((q) => q.toLowerCase().startsWith(typed)) : COMMON
  const out = [t, ...pool.map((q) => `${root}${q}${bass}`)]
  return out.filter((c, i) => out.indexOf(c) === i).slice(0, limit)
}

export type ChordPreview = Readonly<{ numeral: string | null; scale: string | null; readable: boolean }>

const NONE: ChordPreview = { numeral: null, scale: null, readable: false }

/** the doc lines of the rows written for a bar, in order */
const rowsOf = (doc: ChartDoc, section: string, bar: number): number[] =>
  doc.lines.flatMap((l, i) => (l.kind === 'row' && l.section === section && l.bar === String(bar) ? [i] : []))

/**
 * how the chart would read a bar once its chords are `chords`: the numeral and scale of the one at `index`, at the
 * view's level. The quality's default where the analysis doesn't reach; nulls for a chord that can't be read. When
 * the chart refuses the chords (the same doc back), the row as it is.
 */
export function chordPreview(doc: ChartDoc, section: string, bar: number, chords: readonly string[], index: number, view?: ScaleView): ChordPreview {
  const chord = chords[index]?.trim() ?? ''
  if (chords[index] !== undefined && !chord) return NONE
  const next = setBarChords(doc, section, bar, chords)
  const rows = rowsOf(doc, section, bar)
  const unchanged = rows.length === chords.length && rows.every((l, k) => (doc.lines[l] as { chord: string }).chord === chords[k])
  if (next === doc && !unchanged) {
    const line = rows[index]
    const kept = line === undefined ? undefined : rowNotes(doc, view).get(line)
    return kept ? { numeral: kept.numeral || null, scale: kept.scale || null, readable: false } : NONE
  }
  if (readChord(chord) === null) return NONE
  const line = rowsOf(next, section, bar)[index]
  if (line === undefined) return NONE
  const n = rowNotes(next, view).get(line)
  return { numeral: n?.numeral || null, scale: n?.scale || defaultScaleOrNull(chord), readable: true }
}
