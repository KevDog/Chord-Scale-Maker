import type { ChartDoc, ChartLine } from './chart'

/** the two sets of a chart's changes: the standard ones, and the alt rows' alternate ones (#215) */
export type ChangesSet = 'standard' | 'alternate'
export const CHANGES_SETS: readonly ChangesSet[] = ['standard', 'alternate']
export const isChangesSet = (v: unknown): v is ChangesSet => v === 'standard' || v === 'alternate'

const BLANK: ChartLine = { kind: 'blank' }

/** one set of a chart's changes as an ordinary doc with the same lines, so line indices match the original; no alt rows: the doc itself */
export function changesFor(doc: ChartDoc, set: ChangesSet): ChartDoc {
  if (!doc.lines.some((l) => l.kind === 'altRow')) return doc
  if (set === 'standard') return { lines: doc.lines.map((l) => (l.kind === 'altRow' ? BLANK : l)) }
  // per section block, the bars that have an alt row: their main rows give way to it
  const swapped = new Set<string>()
  let section = -1
  for (const l of doc.lines) {
    if (l.kind === 'section') section++
    else if (l.kind === 'altRow') swapped.add(`${section}|${l.bar}`)
  }
  section = -1
  return {
    lines: doc.lines.map((l): ChartLine => {
      if (l.kind === 'section') section++
      if (l.kind === 'altRow') return { ...l, kind: 'row' }
      return l.kind === 'row' && swapped.has(`${section}|${l.bar}`) ? BLANK : l
    }),
  }
}
