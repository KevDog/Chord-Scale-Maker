import { analyse, type Area, chartKeyOf, functionChoices, type FunctionChoice } from './analysis'
import { keyCode } from './analysis/keys'
import { type ChartDoc, type ChartLine, resolveScale } from './chart'
import { insertKeyBefore } from './edit'
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
export type RowNote = Readonly<{ note: string; problem: string | null; key: string }>

export function rowNotes(doc: ChartDoc): ReadonlyMap<number, RowNote> {
  const a = analyse(doc)
  const problemAt = (line: number): string | null => a.problems.find((p) => p.line === line)?.message ?? null
  const out = new Map<number, RowNote>()
  for (const r of a.rows) {
    if (out.has(r.line)) continue // a @copy repeat: its source row speaks for it
    const line = doc.lines[r.line]
    const chosen = line?.kind === 'row' ? resolveScale(line) : null
    const differs = !!r.scale && !!chosen && !sameScale(chosen, r.scale)
    out.set(r.line, {
      note: differs ? `analyser: ${r.scale} (${r.reason}); you chose ${chosen}` : r.reason,
      problem: problemAt(r.line),
      key: keyCode(r.key),
    })
  }
  for (const p of a.problems) if (!out.has(p.line)) out.set(p.line, { note: '', problem: p.message, key: '' })
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
