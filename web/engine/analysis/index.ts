import { type ChartDoc, type ChartLine, expandRowLines } from '../chart'
import { sameScale } from '../scales'
import { bluesKey, findCadences, isModal, type Key, localKeys, parseKey, sameKey, scoreKey } from './keys'
import { type Context, decide, type Decision } from './rules'
import { buildStream } from './stream'

/**
 * Harmonic analysis for scale choice (docs/plan-analysis.md): a chart's chords to a scale per row, with the rule
 * and the reason, and the analysis written back into the chart as comments (§12.1). Pure: the CLI
 * (scripts/analyse.ts) does the files.
 */

export { parseKey, type Key } from './keys'
export { pins } from './rules'

/** bumped when a rule changes what it gives; saved in each chart's `# analysis:` line */
export const RULES_VERSION = 1

/** held: a later row of a chord held over several (Gm | Gm), which shares the first row's reason */
export type RowAnalysis = Readonly<Decision & { row: number; line: number; bar: string; chord: string; key: Key; held: boolean }>
export type Area = Readonly<{ key: Key; from: string; to: string; row: number }>
export type Analysis = Readonly<{
  key: Key | null
  keyFrom: 'key:' | 'blues' | 'scored' | 'none'
  context: 'functional' | 'modal' | 'blues'
  areas: readonly Area[]
  rows: readonly RowAnalysis[]
}>

const meta = (doc: ChartDoc, key: string): string => doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), '')

/** the form's length in bars, from `bars:` or the `form:` line ("AABA, 32 bars") */
function formBars(doc: ChartDoc): number | undefined {
  const n = Number(meta(doc, 'bars')) || Number(/(\d+) bars/.exec(meta(doc, 'form'))?.[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function analyse(doc: ChartDoc): Analysis {
  const rows = expandRowLines(doc).value
  const bars = formBars(doc)
  const stream = buildStream(rows, bars)
  const cadences = findCadences(stream)
  const span = stream.length ? Math.round((stream.at(-1)?.start ?? 0) + (stream.at(-1)?.bars ?? 0) - (stream[0]?.start ?? 0)) : 0
  const blues = bluesKey(stream, bars ?? span)
  const stated = parseKey(meta(doc, 'key'))
  const global = blues ?? stated ?? scoreKey(stream, cadences)
  const keyFrom = blues ? 'blues' : stated ? 'key:' : global ? 'scored' : 'none'
  const modal = !blues && isModal(stream, cadences)
  if (!global) return { key: null, keyFrom, context: 'functional', areas: [], rows: [] }
  const keys = modal || blues ? stream.map(() => global) : localKeys(stream, cadences, global)
  const ctx: Context = { stream, keys, global, blues, modal }
  const out: RowAnalysis[] = []
  const areas: Area[] = []
  stream.forEach((e, i) => {
    const key = keys[i] ?? global
    const decision = decide(ctx, i)
    const prevKey = i > 0 ? keys[i - 1] : undefined
    const firstRow = rows[e.rows[0] ?? 0]
    if (firstRow && (!prevKey || !sameKey(prevKey, key))) areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: e.rows[0] ?? 0 })
    const area = areas.at(-1)
    for (const [j, r] of e.rows.entries()) {
      const row = rows[r]
      if (!row) continue
      out.push({ ...decision, row: r, line: row.line, bar: row.bar, chord: row.chord, key, held: j > 0 })
      if (area) areas[areas.length - 1] = { ...area, to: row.bar }
    }
  })
  return { key: global, keyFrom, context: blues ? 'blues' : modal ? 'modal' : 'functional', areas, rows: out }
}

// —— writing it back ——

export type ApplyOptions = Readonly<{
  /** fill: blank scale cells only; force: every row the rules reach, except `# keep:` rows; none: scales untouched */
  scales: 'fill' | 'force' | 'none'
  /** write the analysis as comments: a reason on each row, `# area:` lines, an `# analysis:` header */
  save: boolean
  /** for the header, "2026-10-08" */
  date: string
}>
export type Change = Readonly<{ line: number; bar: string; chord: string; from: string; to: string }>
/** a @copy repeat whose analysis differs from its source row's (only the source line can be written) */
export type Conflict = Readonly<{ line: number; bar: string; chord: string; source: string; copy: string }>

const isAnalysisComment = (l: ChartLine): boolean => l.kind === 'comment' && /^#\s*(analysis|area):/.test(l.text)
const isKept = (l: ChartLine): boolean => l.kind === 'row' && /^keep:/.test(l.comment ?? '')
const keyText = (key: Key): string => (key.minor ? key.name : key.name.replace(/ major$/, ''))

export function applyAnalysis(
  doc: ChartDoc,
  analysis: Analysis,
  options: ApplyOptions,
): Readonly<{ doc: ChartDoc; changes: readonly Change[]; conflicts: readonly Conflict[] }> {
  // each written line takes its first occurrence's verdict; a repeat that disagrees is reported
  const byLine = new Map<number, RowAnalysis>()
  const conflicts: Conflict[] = []
  for (const r of analysis.rows) {
    const first = byLine.get(r.line)
    if (!first) byLine.set(r.line, r)
    else if (first.scale !== r.scale && !conflicts.some((c) => c.line === r.line))
      conflicts.push({ line: r.line, bar: r.bar, chord: r.chord, source: first.scale ?? '?', copy: r.scale ?? '?' })
  }
  const changes: Change[] = []
  const areaAt = new Map<number, string>()
  for (const a of analysis.areas) {
    const line = analysis.rows.find((r) => r.row === a.row)?.line
    if (line !== undefined && byLine.get(line)?.row === a.row && !areaAt.has(line))
      areaAt.set(line, `# area: ${a.key.name}${a.from === a.to ? ` (bar ${a.from})` : ` (bars ${a.from}–${a.to})`}`)
  }

  const out: ChartLine[] = []
  doc.lines.forEach((l, i) => {
    if (options.save && isAnalysisComment(l)) return // rewritten below
    if (l.kind !== 'row') return void out.push(l)
    const r = byLine.get(i)
    if (!r) return void out.push(l)
    let row = l
    if (r.scale && !isKept(l) && ((options.scales === 'fill' && !l.scale) || (options.scales === 'force' && !sameScale(l.scale, r.scale)))) {
      if (!sameScale(l.scale, r.scale)) changes.push({ line: i, bar: r.bar, chord: r.chord, from: l.scale, to: r.scale })
      row = { ...row, scale: r.scale }
    }
    if (options.save) {
      if (areaAt.has(i) && analysis.areas.length > 1) out.push({ kind: 'comment', text: areaAt.get(i) ?? '' })
      if (!isKept(l)) {
        const differs = r.scale && row.scale && !sameScale(row.scale, r.scale)
        const repeat = conflicts.find((c) => c.line === i)
        const base = differs ? `≠ rules: ${r.scale} (${r.reason})` : r.held ? undefined : r.reason
        const reason = repeat ? `${base ?? r.reason}; the repeat at bar ${repeat.bar} would be ${repeat.copy}` : base
        const { comment: _, ...bare } = row
        row = reason === undefined ? bare : { ...bare, comment: reason }
      }
    }
    out.push(row)
  })
  if (options.save && analysis.key) {
    const at = out.findLastIndex((l) => l.kind === 'meta') + 1
    const old = doc.lines.find((l) => l.kind === 'comment' && /^#\s*analysis:/.test(l.text))
    const header = `# analysis: ${options.date}, rules v${RULES_VERSION}; ${keyText(analysis.key)}${analysis.context === 'functional' ? '' : `, ${analysis.context}`}`
    // an unchanged analysis keeps its old date, so a rerun is a no-op
    const unchanged = old?.kind === 'comment' && old.text.replace(/analysis: [^,]*,/, '') === header.replace(/analysis: [^,]*,/, '') && sameLines(withoutHeader(doc.lines), withoutHeader(out))
    out.splice(at, 0, { kind: 'comment', text: unchanged && old?.kind === 'comment' ? old.text : header })
  }
  return { doc: { lines: out }, changes, conflicts }
}

const withoutHeader = (lines: readonly ChartLine[]): ChartLine[] => lines.filter((l) => !(l.kind === 'comment' && /^#\s*analysis:/.test(l.text)))
const sameLines = (a: readonly ChartLine[], b: readonly ChartLine[]): boolean => JSON.stringify(a) === JSON.stringify(b)
