import { changesFor } from '../alternates'
import { type ChartContext, type ChartDoc, type ChartLine, expandRowLines, formPart, hasAlternates, lineSections, type LinedRow, parseContext } from '../chart'
import { type Layout, sectionLayout, statedKeyAt } from '../layout'
import { LIMITS } from '../limits'
import { pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { sameScale } from '../scales'
import { bluesKey, type Detection, detectContext, findCadences, type Key, keyText, localKeys, makeKey, parseKey, sameKey, scoreKey } from './keys'
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
export { dominantScale, dominantScaleTable, pins, ruleParts, type RuleInfo, RULES, type Slots, TIERS } from './rules'
export { FUNCTION_ERRORS, parseFunction, type Spelling, spellings, SUFFIXES } from './functions'
export { ambiguities, contextLine } from './ambiguity'
export type { Detection } from './keys'

/** bumped when a rule changes what it gives; saved in each chart's `# analysis:` line */
export { CATALOGUE_KEYS, FUNCTION_GROUPS, type FunctionGroup, type FunctionRow, functionsTable } from './catalogue'
export const RULES_VERSION = 2

/**
 * held: a later row of a chord held over several (Gm | Gm), which shares the first row's reason. numeral: the chord's
 * Roman numeral in its key area (numerals.ts)
 */
export type RowAnalysis = Readonly<
  Decision & { row: number; line: number; bar: string; chord: string; key: Key; held: boolean; numeral: string; stated: boolean; statedKey?: Key }
>
/** a key area: from a bar of `section` to a bar of `toSection` (the same section, or a later one) */
export type Area = Readonly<{ key: Key; from: string; to: string; row: number; section: string; toSection: string; stated: boolean }>

/** an area's bars as comments and reports name them: "A 1–5", "A 3", "A 11 – B 5" */
export const areaSpan = (a: Area): string =>
  a.section !== a.toSection ? `${a.section} ${a.from} – ${a.toSection} ${a.to}` : a.from === a.to ? `${a.section} ${a.from}` : `${a.section} ${a.from}–${a.to}`
/** something in the chart the analysis couldn't use: a function that won't read or doesn't fit, an @key with no bar. line: the doc line */
export type Problem = Readonly<{ line: number; message: string }>
export type Analysis = Readonly<{
  key: Key | null
  keyFrom: 'key:' | 'blues' | 'scored' | 'none'
  context: ChartContext
  /** the chart's context: line, or the detection (§5.4); detection: what it read, whichever decided */
  contextSource: 'stated' | 'detected'
  detection: Detection
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
 * stated keys (docs/design.md §4): a section's key: from its bar 1, an in-block @key from its bar, each until the
 * section ends; elsewhere the areas as found. A change on a bar a chord is held through states the chord held there.
 */
function statedAreas(layout: Layout, rows: readonly LinedRow[], stream: readonly Entry[], found: readonly Key[], problems: Problem[]): { keys: Key[]; stated: boolean[] } {
  for (const d of layout.directives) {
    if (d.kind !== 'key') continue
    const length = layout.lengths.get(d.section) ?? 0
    if (d.bar < 1 || d.bar > length) addProblem(problems, { line: d.line, message: `@key ${d.bar}: no bar ${d.bar} in section ${d.section}` })
    else if (!parseKey(d.key)) addProblem(problems, { line: d.line, message: `@key ${d.bar} ${d.key}: not a key` })
  }
  // each row's stated key: the last change before the next row's bar in its section, else the section's key:
  const rowKey = rows.map((r, i): string | null => {
    if (!/^\d+$/.test(r.bar)) return null
    const nextBar = rows.slice(i + 1).find((x) => x.section === r.section && Number(x.bar) > Number(r.bar))?.bar
    const before = nextBar === undefined ? (layout.lengths.get(r.section) ?? Number(r.bar)) : Number(nextBar) - 1
    return statedKeyAt(layout, r.section, before)
  })
  const keys = [...found]
  const stated = stream.map(() => false)
  stream.forEach((e, i) => {
    const k = e.rows.map((r) => rowKey[r] ?? null).filter((x): x is string => x !== null).at(-1)
    const key = k ? parseKey(k) : null
    if (!key) return
    keys[i] = key
    stated[i] = true
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
function withTargets(stream: readonly Entry[], keys: readonly Key[], stated: readonly (Stated | undefined)[]): { stream: Entry[]; keys: Key[]; added: boolean[] } {
  const out = [...stream]
  const outKeys = [...keys]
  const added = stream.map(() => false) // the entries a target was wired in after
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
    added[i] = true
  })
  return { stream: out, keys: outKeys, added }
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
  context: ChartContext
  contextSource: Analysis['contextSource']
  detection: Detection
  problems: readonly Problem[]
}>
type Unkeyed = Readonly<{ global: null; keyFrom: Analysis['keyFrom']; context: ChartContext; contextSource: Analysis['contextSource']; detection: Detection; problems: readonly Problem[] }>

/** the lengths in bars of the form's sections, in order (a section is a run of rows with one label) */
function sectionLengths(rows: readonly LinedRow[], formBars: number): number[] {
  const form = rows.filter((r) => formPart(r.section) === 'form' && /^\d+$/.test(r.bar))
  const starts = form.flatMap((r, i) => (i === 0 || form[i - 1]?.section !== r.section ? [r.at] : []))
  const end = (starts[0] ?? 0) + formBars
  return starts.map((b, i) => (starts[i + 1] ?? end) - b)
}

/**
 * the header lines the analysis reads beside key: (docs/superpowers/specs/2026-10-10-chart-context-design.md §1): the
 * stated context, if it is one; problems for one that isn't, for minor: (reserved) and for @context (not yet built)
 */
function statedContext(doc: ChartDoc, problems: Problem[]): ChartContext | null {
  let context: ChartContext | null = null
  const sections = lineSections(doc)
  doc.lines.forEach((l, line) => {
    if (l.kind === 'meta' && l.key === 'context') {
      context = parseContext(l.value)
      if (!context && l.value) addProblem(problems, { line, message: `context: ${l.value} is not functional, modal or blues: the context is detected` })
    }
    if (l.kind === 'meta' && l.key === 'minor') addProblem(problems, { line, message: 'minor: is reserved, and ignored' })
    if (l.kind === 'context') addProblem(problems, { line, message: `@context ${l.bar} ${l.context} in section ${sections[line]}: not yet supported: using the chart's context` })
    if (l.kind === 'sectionMeta' && l.field === 'context' && l.value)
      addProblem(problems, { line, message: `context: ${l.value} in section ${sections[line]}: not yet supported: using the chart's context` })
  })
  return context
}

/**
 * everything the rules read before they decide: the context, the stream, its key areas, the stated functions; global
 * null without a key. A stated context beats the detection, and a stated key the blues key (§5.4, principle 1).
 */
function prepare(doc: ChartDoc): Prepared | Unkeyed {
  const problems: Problem[] = []
  const layout = sectionLayout(doc).value
  const rows = layout.rows
  const bars = formBars(doc)
  const stream = buildStream(rows, bars)
  const cadences = findCadences(stream)
  const form = stream.filter((e) => e.part === 'form')
  const span = form.length ? Math.round((form.at(-1)?.start ?? 0) + (form.at(-1)?.bars ?? 0) - (form[0]?.start ?? 0)) : 0
  const sections = sectionLengths(rows, bars ?? span)
  const detection = detectContext(stream, cadences, form, bars ?? span, sections)
  const statedCtx = statedContext(doc, problems)
  const context = statedCtx ?? detection.context
  const contextSource = statedCtx ? 'stated' : 'detected'
  const stated = parseKey(meta(doc, 'key'))
  // the key: key:, else the detected blues key (whatever the context), else for a stated blues the detection missed
  // the root in bar 1, else the score
  const bar1 = form.find((e) => e.root)
  const missed = context === 'blues' && bar1?.root ? makeKey(bar1.root, bar1.family === 'minor') : null
  const bluesI = bluesKey(form, bars ?? span, sections) ?? missed
  const global = stated ?? bluesI ?? scoreKey(stream, cadences)
  const keyFrom = stated ? 'key:' : bluesI ? 'blues' : global ? 'scored' : 'none'
  if (!global) return { global: null, keyFrom, context, contextSource, detection, problems }
  const blues = context === 'blues' ? global : null
  const modal = context === 'modal'
  const found = modal || blues ? stream.map(() => global) : localKeys(stream, cadences, global)
  const areas = statedAreas(layout, rows, stream, found, problems)
  const fns = statedFunctions(stream, rows, areas.keys, global, problems)
  return { rows, stream, areaKeys: areas.keys, areaStated: areas.stated, stated: fns, global, blues, modal, keyFrom, context, contextSource, detection, problems }
}

/** the rules' context under these statements: each stated row's target wired in after it */
function contextFor(p: Prepared, stated: readonly (Stated | undefined)[]): Context {
  const v = withTargets(p.stream, p.stream.map((_, i) => stated[i]?.key ?? p.areaKeys[i] ?? p.global), stated)
  return { stream: v.stream, keys: v.keys, global: p.global, blues: p.blues, modal: p.modal, statedTarget: v.stream.map((_, i) => !!v.added[i]) }
}

const analysed = new WeakMap<ChartDoc, Analysis>()

/** the chart's analysis, made once per document (a doc is never changed in place): the sheets, notes and grid share it */
export function analyse(doc: ChartDoc): Analysis {
  const known = analysed.get(doc)
  if (known) return known
  const a = analyseNow(doc)
  analysed.set(doc, a)
  return a
}

function analyseNow(doc: ChartDoc): Analysis {
  const p = prepare(doc)
  if (p.global === null) return { key: null, keyFrom: p.keyFrom, context: p.context, contextSource: p.contextSource, detection: p.detection, areas: [], rows: [], problems: p.problems }
  const ctx = contextFor(p, p.stated)
  const out: RowAnalysis[] = []
  const areas: Area[] = []
  p.stream.forEach((e, i) => {
    const key = p.areaKeys[i] ?? p.global
    const s = p.stated[i]
    const { fallback, ...ruled } = decide(ctx, i)
    const decision: Decision = s ? { ...ruled, reason: `* ${ruled.reason}`, ...(fallback ? { fallback } : {}) } : fallback ? { ...ruled, fallback } : ruled
    const roman = s ? s.fn.text : numeral(ctx, i, decision)
    const prevKey = i > 0 ? p.areaKeys[i - 1] : undefined
    const firstRow = p.rows[e.rows[0] ?? 0]
    if (firstRow && (!prevKey || !sameKey(prevKey, key)))
      areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: e.rows[0] ?? 0, section: firstRow.section, toSection: firstRow.section, stated: p.areaStated[i] ?? false })
    const area = areas.at(-1)
    for (const [j, r] of e.rows.entries()) {
      const row = p.rows[r]
      if (!row) continue
      out.push({ ...decision, row: r, line: row.line, bar: row.bar, chord: row.chord, key, held: j > 0, numeral: roman, stated: !!s, ...(s?.fn.key ? { statedKey: s.key } : {}) })
      if (area) areas[areas.length - 1] = { ...area, to: row.bar, toSection: row.section }
    }
  })
  return { key: p.global, keyFrom: p.keyFrom, context: p.context, contextSource: p.contextSource, detection: p.detection, areas, rows: out, problems: p.problems }
}

/** one option of the grid's Function dropdown: value '' is Auto (the analyzer's own reading, labeled with
 * its numeral; "Auto" when it has none, "Auto (extended dominant)" for a chain link the sheet marks →).
 * accept (on Auto, where the rules could only guess and the row states nothing): the function that reads and
 * sounds just like Auto, so stating it settles the guess
 */
export type FunctionChoice = Readonly<{ value: string; label: string; scale: string | null; accept?: string }>

/**
 * each row's Function options, keyed by doc line: Auto, then every function that fits the chord in its key area,
 * each with the scale the rules give when it's stated (the other rows' statements stand); one that would read and
 * sound just like Auto is left out (and named as Auto's `accept` when Auto is only a guess)
 */
export function functionChoices(doc: ChartDoc): ReadonlyMap<number, readonly FunctionChoice[]> {
  const out = new Map<number, readonly FunctionChoice[]>()
  const p = prepare(doc)
  if (p.global === null) return out
  const verdict = (i: number, s: Stated | undefined): { scale: string | null; numeral: string; guess: boolean } => {
    const ctx = contextFor(p, p.stated.map((x, j) => (j === i ? s : x)))
    const d = decide(ctx, i)
    return { scale: d.scale, numeral: s ? s.fn.text : numeral(ctx, i, d), guess: !!d.fallback }
  }
  p.stream.forEach((e, i) => {
    if (!e.family) return
    const key = p.areaKeys[i] ?? p.global
    const auto = verdict(i, undefined)
    const choices: FunctionChoice[] = [{ value: '', label: auto.numeral === '?' ? 'Auto' : auto.numeral === '→' ? 'Auto (extended dominant)' : auto.numeral, scale: auto.scale }]
    for (const text of functionCandidates(e, key)) {
      const fn = parseFunction(text)
      if (typeof fn === 'string' || fitError(fn, e, key)) continue
      const t = impliedTarget(fn, key)
      const to = t ? ` (to ${rootName(shiftBy(tonicOf(key), t.steps, t.semis))}${t.minor ? 'm' : ''})` : ''
      const choice = { value: text, label: `${fn.text}${to}`, scale: verdict(i, { fn, key }).scale }
      const same = choice.label === choices[0]?.label && choice.scale === choices[0]?.scale
      if (!same) choices.push(choice)
      else if (auto.guess && !p.stated[i] && choices[0] && !choices[0].accept) choices[0] = { ...choices[0], accept: text }
    }
    for (const r of e.rows) {
      const line = p.rows[r]?.line
      if (line !== undefined && !out.has(line)) out.set(line, choices)
    }
  })
  return out
}

/** the chart's home key (its key: line) for the key signature; null without one. An @key never changes it */
export const chartKeyOf = (doc: ChartDoc): Key | null => parseKey(meta(doc, 'key'))

// —— writing it back ——

export type ApplyOptions = Readonly<{
  /** strip: blank every written scale the rules reproduce at each of the line's occurrences, except `# keep:` rows; none: scales untouched */
  scales: 'strip' | 'none'
  /** write the analysis as comments: a reason on each row, `# area:` lines, an `# analysis:` header */
  save: boolean
  /** for the header, "2026-10-08" */
  date: string
}>
export type Change = Readonly<{ line: number; bar: string; chord: string; from: string; to: string }>
/** a written scale, without `# keep:`, that the rules don't reproduce at one of its occurrences (strip leaves it) */
export type Override = Readonly<{ line: number; bar: string; chord: string; scale: string; rules: string }>
/** a @copy repeat whose analysis differs from its source row's (only the source line can be written) */
export type Conflict = Readonly<{ line: number; section: string; bar: string; chord: string; source: string; copy: string }>

const isAnalysisComment = (l: ChartLine): boolean => l.kind === 'comment' && /^#\s*(analysis|area):/.test(l.text)
const isKept = (l: ChartLine): boolean => (l.kind === 'row' || l.kind === 'altRow') && /^keep:/.test(l.comment ?? '')

export function applyAnalysis(
  doc: ChartDoc,
  analysis: Analysis,
  options: ApplyOptions,
  alternate?: Analysis,
): Readonly<{ doc: ChartDoc; changes: readonly Change[]; conflicts: readonly Conflict[]; overrides: readonly Override[] }> {
  // each written line takes its first occurrence's verdict; a repeat that disagrees is reported
  // (with alternates, `analysis` is the standard set's and `alternate` the alternate set's, over the same line indices:
  // alt rows are only in the latter; a shared row keeps the standard verdict and reason, the alternate's only veto a strip)
  const byLine = new Map<number, RowAnalysis>()
  const conflicts: Conflict[] = []
  const collect = (a: Analysis, lined: readonly { section: string }[]): void => {
    const seen = new Map<number, RowAnalysis>()
    for (const r of a.rows) {
      const first = seen.get(r.line)
      if (!first) {
        seen.set(r.line, r)
        if (!byLine.has(r.line)) byLine.set(r.line, r)
      } else if (first.scale !== r.scale && !conflicts.some((c) => c.line === r.line))
        conflicts.push({ line: r.line, section: lined[r.row]?.section ?? '', bar: r.bar, chord: r.chord, source: first.scale ?? '?', copy: r.scale ?? '?' })
    }
  }
  collect(analysis, expandRowLines(doc).value)
  if (alternate) collect(alternate, expandRowLines(changesFor(doc, 'alternate')).value)
  const occurrences = [...analysis.rows, ...(alternate?.rows ?? [])]
  const changes: Change[] = []
  const overrides: Override[] = []
  const areaAt = new Map<number, string>()
  for (const a of analysis.areas) {
    const line = analysis.rows.find((r) => r.row === a.row)?.line
    if (line !== undefined && byLine.get(line)?.row === a.row && !areaAt.has(line))
      areaAt.set(line, `# area: ${a.key.name} (${areaSpan(a)})`)
  }

  const out: ChartLine[] = []
  doc.lines.forEach((l, i) => {
    if (options.save && isAnalysisComment(l)) return // rewritten below
    if (l.kind !== 'row' && l.kind !== 'altRow') return void out.push(l)
    const r = byLine.get(i)
    if (!r) return void out.push(l)
    let row = l
    if (l.scale && !isKept(l)) {
      const differs = occurrences.find((x) => x.line === i && !sameScale(l.scale, x.scale))
      if (differs) overrides.push({ line: i, bar: differs.bar, chord: differs.chord, scale: l.scale, rules: differs.scale ?? '?' })
      else if (options.scales === 'strip') {
        changes.push({ line: i, bar: r.bar, chord: r.chord, from: l.scale, to: '' })
        row = { ...row, scale: '' }
      }
    }
    if (options.save) {
      if (areaAt.has(i) && analysis.areas.length > 1) out.push({ kind: 'comment', text: areaAt.get(i) ?? '' })
      if (!isKept(l)) {
        const differs = r.scale && row.scale && !sameScale(row.scale, r.scale)
        const repeat = conflicts.find((c) => c.line === i)
        const compose = (why: string): string | undefined => {
          const base = differs ? `≠ rules: ${r.scale} (${why})` : r.held ? undefined : why
          return repeat ? `${base ?? why}; the repeat at ${repeat.section} bar ${repeat.bar} would be ${repeat.copy}` : base
        }
        const reason = fitComment(compose, r.short ? [r.reason, r.short] : [r.reason])
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
  return { doc: { lines: out }, changes, conflicts, overrides }
}

/** a chart's analysis, and with alternates (#215) its alternate set's too, over the same line indices (its alt rows are the ones it adds) */
export function analyseBoth(doc: ChartDoc): Readonly<{ standard: Analysis; alternate: Analysis | undefined }> {
  return { standard: analyse(doc), alternate: hasAlternates(doc) ? analyse(changesFor(doc, 'alternate')) : undefined }
}

/** a line of a report about the alternate set (its ambiguities, its problems) */
export const onAlternate = (line: string): string => `alternate: ${line}`

/**
 * a chart's saved analysis rewritten for the chart as it now stands (after Transpose…, its key and reasons name the
 * new key), keeping the header's date: the rules didn't change. A chart without an `# analysis:` header comes back
 * as it is, since its row comments are the user's own.
 */
export function refreshAnalysis(doc: ChartDoc): ChartDoc {
  const header = doc.lines.find((l) => l.kind === 'comment' && /^#\s*analysis:/.test(l.text))
  if (header?.kind !== 'comment') return doc
  const date = /analysis:\s*([^,]*),/.exec(header.text)?.[1]?.trim() ?? ''
  const { standard, alternate } = analyseBoth(doc)
  return applyAnalysis(doc, standard, { scales: 'none', save: true, date }, alternate).doc
}

/**
 * R7: the first reason whose comment fits the chart's limit (LIMITS.maxMeta); else the last, cut short with "…" so
 * the comment still fits (a chart with a longer comment doesn't parse)
 */
function fitComment(compose: (why: string) => string | undefined, reasons: readonly string[]): string | undefined {
  for (const why of reasons) {
    const c = compose(why)
    if (c === undefined || c.length <= LIMITS.maxMeta) return c
  }
  const last = reasons[reasons.length - 1] ?? ''
  for (let n = last.length - 1; n > 0; n--) {
    const c = compose(`${last.slice(0, n).trimEnd()}…`)
    if (c === undefined || c.length <= LIMITS.maxMeta) return c
  }
  const c = compose('…')
  return c === undefined || c.length <= LIMITS.maxMeta ? c : `${c.slice(0, LIMITS.maxMeta - 1)}…`
}

const withoutHeader = (lines: readonly ChartLine[]): ChartLine[] => lines.filter((l) => !(l.kind === 'comment' && /^#\s*analysis:/.test(l.text)))
const sameLines = (a: readonly ChartLine[], b: readonly ChartLine[]): boolean => JSON.stringify(a) === JSON.stringify(b)
