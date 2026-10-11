import { analyse, type Area, chartKeyOf, functionChoices, type FunctionChoice } from './analysis'
import { keyCode } from './analysis/keys'
import type { ChartDoc, ChartLine } from './chart'
import { insertKeyBefore } from './edit'
import { atLevel, type Resolved, resolveScales, type ScaleView } from './resolve'
import { sameScale } from './scales'

export { chartKeyOf, functionChoices, type FunctionChoice }
export type { Key } from './analysis/keys'
export { sameFunction } from './analysis/functions'

/**
 * What the editor shows beside each row (docs/superpowers/specs/2026-10-09-chart-functions-design.md §3): why the
 * analyser chose the scale it did, any problem with the row's function, and the key area (where a key change from
 * this row would start). Live, from analyse(), so every chart has notes, not only those the CLI saved. Keyed by doc
 * line.
 */
export type RowNote = Readonly<{
  note: string
  problem: string | null
  key: string
  /** the chord's Roman numeral in its key area, or the function stated; '' when the analysis doesn't reach it */
  numeral: string
  /** the scale played (resolve.ts): the row's own, else the analysis's at the sheet's level; '' for none */
  scale: string
  /** where that scale comes from; "you chose" is said only of a written one */
  source: Resolved['source']
  /** the analysis's scale at the sheet's level, and its rule: what the row plays once its cell is blank; '' when the analysis doesn't reach it */
  analysed: string
  rule: string
}>

const STANDARD: ScaleView = { level: 'standard', seed: 0 }

export function rowNotes(doc: ChartDoc, view: ScaleView = STANDARD): ReadonlyMap<number, RowNote> {
  const a = analyse(doc)
  const resolved = resolveScales(doc, view, a)
  const problemAt = (line: number): string | null => a.problems.find((p) => p.line === line)?.message ?? null
  const out = new Map<number, RowNote>()
  for (const r of a.rows) {
    if (out.has(r.line)) continue // a @copy repeat: its source row speaks for it
    const played = resolved.get(r.row) ?? { scale: null, source: 'default' }
    const differs = played.source === 'written' && !!r.scale && !!played.scale && !sameScale(played.scale, r.scale)
    out.set(r.line, {
      note: differs ? `analyser: ${r.scale} (${r.reason}); you chose ${played.scale}` : r.reason,
      problem: problemAt(r.line),
      key: keyCode(r.key),
      numeral: r.numeral === '?' ? '' : r.numeral,
      scale: played.scale ?? r.scale ?? '',
      source: played.source,
      analysed: r.scale ? atLevel(view, r.chord, r.scale, r.rule, r.line) : '',
      rule: r.scale ? r.rule : '',
    })
  }
  for (const p of a.problems) if (!out.has(p.line)) out.set(p.line, { note: '', problem: p.message, key: '', numeral: '', scale: '', source: 'default', analysed: '', rule: '' })
  return out
}

/**
 * the grid's key-change button: an @key above the row at line i, in its key area, and, since an @key holds until the
 * next, one back to the next area where that starts (above its first row, or after the @copy that makes it), unless an
 * @key already stands there. A no-op for a non-row or a bar like "1a".
 */
export function insertKeyChange(doc: ChartDoc, i: number): ChartDoc {
  const a = analyse(doc)
  const r = a.rows.find((x) => x.line === i)
  const pinned = insertKeyBefore(doc, i, r ? keyCode(r.key) : 'C')
  const next = r ? a.areas.find((x) => x.row > r.row) : undefined
  const stands = (x: Area): boolean => doc.lines.some((l) => l.kind === 'key' && l.section === x.section && String(l.bar) === x.from)
  if (pinned === doc || !next || !/^\d{1,6}$/.test(next.from) || stands(next)) return pinned
  const first = a.rows.find((x) => x.row === next.row)?.line ?? -1
  const own = doc.lines[first]
  const at = own?.kind === 'row' && own.section === next.section ? first : doc.lines.findIndex((l) => l.kind === 'copy' && l.dst === next.section) + 1 || doc.lines.length
  const pos = at > i ? at + 1 : at // past the line just added
  const back: ChartLine = { kind: 'key', section: next.section, bar: Number(next.from), key: keyCode(next.key) }
  return { lines: [...pinned.lines.slice(0, pos), back, ...pinned.lines.slice(pos)] }
}
