import { type ChartDoc, clearMeta, setMeta } from '@chord-scale-maker/engine'

/** how the analysis reads a chart, its context: line (docs/superpowers/specs/2026-10-18-blues-analysis-design.md §5): Auto leaves it to the detection */
export const READ_AS = ['auto', 'functional', 'modal', 'blues'] as const
export type ReadAs = (typeof READ_AS)[number]
export const READ_AS_LABELS: Readonly<Record<ReadAs, string>> = { auto: 'Auto', functional: 'Functional', modal: 'Modal', blues: 'Blues' }

/** the chart's stated context, Auto when it states none (or one it doesn't know) */
export function readAsOf(doc: ChartDoc): ReadAs {
  const line = doc.lines.findLast((l) => l.kind === 'meta' && l.key === 'context')
  const value = line?.kind === 'meta' ? line.value.trim().toLowerCase() : ''
  return READ_AS.find((r) => r === value) ?? 'auto'
}

/** the chart read as `v`: Auto removes the context: line, the others write it; null when it already reads so */
export const withReadAs = (doc: ChartDoc, v: ReadAs): ChartDoc | null => (v === readAsOf(doc) ? null : v === 'auto' ? clearMeta(doc, 'context') : setMeta(doc, 'context', v))
