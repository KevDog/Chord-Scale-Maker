import { analyse, functionChoices, type FunctionChoice } from './analysis'
import { keyCode } from './analysis/keys'
import { type ChartDoc, resolveScale } from './chart'
import { sameScale } from './scales'

export { functionChoices, type FunctionChoice }
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
