import { type ChartDoc, type ChartLine, expandRowLines, type LinedRow } from '../chart'
import { pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { sameScale } from '../scales'
import { bluesKey, findCadences, isModal, type Key, keyText, localKeys, parseKey, sameKey, scoreKey } from './keys'
import { type Context, decide, type Decision } from './rules'
import { numeral } from './numerals'
import { buildStream, type Entry, type Family } from './stream'
import { fitError, functionCandidates, impliedTarget, parseFunction, type StatedFunction, tonicOf } from './functions'

/**
 * Harmonic analysis for scale choice (docs/plan-analysis.md): a chart's chords to a scale per row, with the rule
 * and the reason, and the analysis written back into the chart as comments (§12.1). Pure: the CLI
 * (scripts/analyse.ts) does the files.
 */

export { parseKey, type Key } from './keys'
export { pins } from './rules'
export { ambiguities } from './ambiguity'

/** bumped when a rule changes what it gives; saved in each chart's `# analysis:` line */
export const RULES_VERSION = 1

/**
 * held: a later row of a chord held over several (Gm | Gm), which shares the first row's reason. numeral: the chord's
 * Roman numeral in its key area (numerals.ts)
 */
export type RowAnalysis = Readonly<
  Decision & { row: number; line: number; bar: string; chord: string; key: Key; held: boolean; numeral: string; stated: boolean; statedKey?: Key }
>
export type Area = Readonly<{ key: Key; from: string; to: string; row: number; section: string; stated: boolean }>
/** something in the chart the analysis couldn't use: a function that won't read or doesn't fit, an @key with no bar. line: the doc line */
export type Problem = Readonly<{ line: number; message: string }>
export type Analysis = Readonly<{
  key: Key | null
  keyFrom: 'key:' | 'blues' | 'scored' | 'none'
  context: 'functional' | 'modal' | 'blues'
  areas: readonly Area[]
  rows: readonly RowAnalysis[]
  problems: readonly Problem[]
}>

const meta = (doc: ChartDoc, key: string): string => doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), '')

/** the form's length in bars, from `bars:` or the `form:` line ("AABA, 32 bars") */
function formBars(doc: ChartDoc): number | undefined {
  const n = Number(meta(doc, 'bars')) || Number(/(\d+) bars/.exec(meta(doc, 'form'))?.[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

type Stated = Readonly<{ fn: StatedFunction; key: Key }>
const addProblem = (problems: Problem[], p: Problem): void => {
  if (!problems.some((q) => q.line === p.line && q.message === p.message)) problems.push(p)
}

/**
 * `@key` lines: each holds from its bar until the next; before the first, the areas as found. Its bar may be one a
 * chord is held through (no row of its own): the key starts with the entry that covers it, played in its section.
 */
function statedAreas(doc: ChartDoc, rows: readonly LinedRow[], stream: readonly Entry[], found: readonly Key[], problems: Problem[]): { keys: Key[]; stated: boolean[] } {
  const starts: { at: number; key: Key }[] = []
  doc.lines.forEach((l, line) => {
    if (l.kind !== 'key') return
    const covers = (e: Entry): boolean => e.start <= l.bar && l.bar < e.start + e.bars && rows[e.rows.findLast((r) => Number(rows[r]?.bar) <= l.bar) ?? -1]?.section === l.section
    const at = stream.findIndex(covers)
    const key = parseKey(l.key)
    if (at < 0 || !key) return void addProblem(problems, { line, message: `@key ${l.section} ${l.bar}: no bar ${l.bar} in section ${l.section}` })
    starts.push({ at, key })
  })
  starts.sort((a, b) => a.at - b.at)
  const keys = [...found]
  const stated = stream.map(() => false)
  starts.forEach(({ at, key }, k) => {
    for (let i = at; i < (starts[k + 1]?.at ?? stream.length); i++) {
      keys[i] = key
      stated[i] = true
    }
  })
  return { keys, stated }
}

/** each entry's function, when it reads and fits its chord; otherwise a problem, and none */
function statedFunctions(stream: readonly Entry[], rows: readonly LinedRow[], keys: readonly Key[], global: Key, problems: Problem[]): (Stated | undefined)[] {
  return stream.map((e, i) => {
    if (!e.function) return undefined
    const line = rows[e.rows[0] ?? 0]?.line ?? 0
    const fn = parseFunction(e.function)
    if (typeof fn === 'string') return void addProblem(problems, { line, message: fn })
    const key = fn.key ?? keys[i] ?? global
    const misfit = fitError(fn, e, key)
    if (misfit) return void addProblem(problems, { line, message: misfit })
    return { fn, key }
  })
}

/**
 * the stream the rules read: a stated row's target as a chord after it (with its V7 between, for a ii), so each rule
 * decides through its usual path. The extra entries follow the real ones and are never reported.
 */
function withTargets(stream: readonly Entry[], keys: readonly Key[], stated: readonly (Stated | undefined)[]): { stream: Entry[]; keys: Key[] } {
  const out = [...stream]
  const outKeys = [...keys]
  stream.forEach((e, i) => {
    const s = stated[i]
    const t = s ? impliedTarget(s.fn, s.key) : null
    if (!s || !t || e.family === 'major') return
    const add = (root: Spelled, quality: string, family: Family, next: number | null): number => {
      const chord = `${rootName(root)}${quality === 'maj' ? '' : quality}`
      out.push({ ...e, rows: [], next, prev: i, chord, root, pc: pcOf(root), quality, family, symbol: '', start: e.start + e.bars, bars: 1, function: '' })
      outKeys.push(s.key)
      return out.length - 1
    }
    const root = shiftBy(tonicOf(s.key), t.steps, t.semis)
    let next = add(root, t.minor ? 'm' : 'maj', t.minor ? 'minor' : 'major', null)
    if (e.family === 'minor' || e.family === 'halfdim') next = add(shiftBy(root, 4, 7), '7', 'dominant', next)
    out[i] = { ...e, next }
  })
  return { stream: out, keys: outKeys }
}

type Prepared = Readonly<{
  rows: readonly LinedRow[]
  stream: readonly Entry[]
  areaKeys: readonly Key[]
  areaStated: readonly boolean[]
  stated: readonly (Stated | undefined)[]
  global: Key
  blues: Key | null
  modal: boolean
  keyFrom: Analysis['keyFrom']
  problems: readonly Problem[]
}>

/** everything the rules read before they decide: the stream, its key areas, the stated functions; global null without a key */
function prepare(doc: ChartDoc): Prepared | Readonly<{ global: null; keyFrom: Analysis['keyFrom'] }> {
  const rows = expandRowLines(doc).value
  const bars = formBars(doc)
  const stream = buildStream(rows, bars)
  const cadences = findCadences(stream)
  const form = stream.filter((e) => e.part === 'form')
  const span = form.length ? Math.round((form.at(-1)?.start ?? 0) + (form.at(-1)?.bars ?? 0) - (form[0]?.start ?? 0)) : 0
  const blues = bluesKey(form, bars ?? span)
  const stated = parseKey(meta(doc, 'key'))
  const global = blues ?? stated ?? scoreKey(stream, cadences)
  const keyFrom = blues ? 'blues' : stated ? 'key:' : global ? 'scored' : 'none'
  if (!global) return { global: null, keyFrom }
  const modal = !blues && isModal(stream, cadences)
  const found = modal || blues ? stream.map(() => global) : localKeys(stream, cadences, global)
  const problems: Problem[] = []
  const areas = statedAreas(doc, rows, stream, found, problems)
  const fns = statedFunctions(stream, rows, areas.keys, global, problems)
  return { rows, stream, areaKeys: areas.keys, areaStated: areas.stated, stated: fns, global, blues, modal, keyFrom, problems }
}

/** the rules' context under these statements: each stated row's target wired in after it */
function contextFor(p: Prepared, stated: readonly (Stated | undefined)[]): Context {
  const v = withTargets(p.stream, p.stream.map((_, i) => stated[i]?.key ?? p.areaKeys[i] ?? p.global), stated)
  return { stream: v.stream, keys: v.keys, global: p.global, blues: p.blues, modal: p.modal }
}

export function analyse(doc: ChartDoc): Analysis {
  const p = prepare(doc)
  if (p.global === null) return { key: null, keyFrom: p.keyFrom, context: 'functional', areas: [], rows: [], problems: [] }
  const ctx = contextFor(p, p.stated)
  const out: RowAnalysis[] = []
  const areas: Area[] = []
  p.stream.forEach((e, i) => {
    const key = p.areaKeys[i] ?? p.global
    const s = p.stated[i]
    const { fallback, ...ruled } = decide(ctx, i)
    const decision: Decision = s ? { ...ruled, reason: `* ${ruled.reason}` } : fallback ? { ...ruled, fallback } : ruled
    const roman = s ? s.fn.text : numeral(ctx, i, decision)
    const prevKey = i > 0 ? p.areaKeys[i - 1] : undefined
    const firstRow = p.rows[e.rows[0] ?? 0]
    if (firstRow && (!prevKey || !sameKey(prevKey, key)))
      areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: e.rows[0] ?? 0, section: firstRow.section, stated: p.areaStated[i] ?? false })
    const area = areas.at(-1)
    for (const [j, r] of e.rows.entries()) {
      const row = p.rows[r]
      if (!row) continue
      out.push({ ...decision, row: r, line: row.line, bar: row.bar, chord: row.chord, key, held: j > 0, numeral: roman, stated: !!s, ...(s?.fn.key ? { statedKey: s.key } : {}) })
      if (area) areas[areas.length - 1] = { ...area, to: row.bar }
    }
  })
  return { key: p.global, keyFrom: p.keyFrom, context: p.blues ? 'blues' : p.modal ? 'modal' : 'functional', areas, rows: out, problems: p.problems }
}

/** one option of the grid's Function dropdown: value '' is Auto (the analyser's own reading, labelled with its numeral) */
export type FunctionChoice = Readonly<{ value: string; label: string; scale: string | null }>

/**
 * each row's Function options, keyed by doc line: Auto, then every function that fits the chord in its key area,
 * each with the scale the rules give when it's stated (the other rows' statements stand); one that would read and
 * sound just like Auto is left out
 */
export function functionChoices(doc: ChartDoc): ReadonlyMap<number, readonly FunctionChoice[]> {
  const out = new Map<number, readonly FunctionChoice[]>()
  const p = prepare(doc)
  if (p.global === null) return out
  const verdict = (i: number, s: Stated | undefined): { scale: string | null; numeral: string } => {
    const ctx = contextFor(p, p.stated.map((x, j) => (j === i ? s : x)))
    const d = decide(ctx, i)
    return { scale: d.scale, numeral: s ? s.fn.text : numeral(ctx, i, d) }
  }
  p.stream.forEach((e, i) => {
    if (!e.family) return
    const key = p.areaKeys[i] ?? p.global
    const auto = verdict(i, undefined)
    const choices: FunctionChoice[] = [{ value: '', label: auto.numeral === '?' ? 'Auto' : auto.numeral, scale: auto.scale }]
    for (const text of functionCandidates(e, key)) {
      const fn = parseFunction(text)
      if (typeof fn === 'string' || fitError(fn, e, key)) continue
      const t = impliedTarget(fn, key)
      const to = t ? ` (to ${rootName(shiftBy(tonicOf(key), t.steps, t.semis))}${t.minor ? 'm' : ''})` : ''
      const choice = { value: text, label: `${fn.text}${to}`, scale: verdict(i, { fn, key }).scale }
      if (choice.label !== choices[0]?.label || choice.scale !== choices[0]?.scale) choices.push(choice)
    }
    for (const r of e.rows) {
      const line = p.rows[r]?.line
      if (line !== undefined && !out.has(line)) out.set(line, choices)
    }
  })
  return out
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
