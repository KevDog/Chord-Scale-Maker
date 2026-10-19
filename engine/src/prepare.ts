import { ambiguities } from './analysis/ambiguity'
import { analyse, applyAnalysis } from './analysis'
import { type MetaKey, parseChart, serializeChart } from './chart'
import { clearMeta, setMeta } from './edit'
import { tuneAdvice, tuneGaps } from './tune'

export type PreparedChart = Readonly<{ chart: string; gaps: readonly string[]; advice: readonly string[]; ambiguities: readonly string[] }>

/** a new library chart as `csm add` writes it: the header flags set, the analysis saved, and what its song page lacks */
export function prepareChart(text: string, overrides: Readonly<Partial<Record<MetaKey, string>>>, date: string): PreparedChart {
  // context: auto leaves the context to the detection: no line
  const doc = Object.entries(overrides).reduce((d, [k, v]) => (!v ? d : k === 'context' && v === 'auto' ? clearMeta(d, 'context') : setMeta(d, k as MetaKey, v)), parseChart(text).value)
  const analysis = analyse(doc)
  const saved = applyAnalysis(doc, analysis, { scales: 'none', save: true, date }).doc
  return { chart: serializeChart(saved), gaps: tuneGaps(saved), advice: tuneAdvice(saved), ambiguities: ambiguities(analysis) }
}
