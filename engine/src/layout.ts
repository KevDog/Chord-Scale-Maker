import { beatsPerBar, type ChartContext, type ChartDoc, chartBeats, type Diagnostic, formPart, type FormPart, type LinedRow, parseContext, type Parsed, type SectionField } from './chart'
import { LIMITS } from './limits'

/**
 * Section blocks resolved (docs/design.md §4, issue #329): each section's rows with its name filled in and its bar
 * counted through its part (`at`), its length, part, stated key and context, and what a copy: carries. The views of a
 * chart read this rather than walking doc.lines. Pure; no analysis.
 */

/** a directive with the section it is in (or, for a key or context a copy: carries, the copy's) and its line */
export type Directive =
  | Readonly<{ kind: 'ending'; section: string; n: number; from: number; to: number; line: number }>
  | Readonly<{ kind: 'mark'; section: string; mark: 'segno' | 'coda'; bar: number; line: number }>
  | Readonly<{ kind: 'nav'; section: string; bar: number; text: string; line: number }>
  | Readonly<{ kind: 'key'; section: string; bar: number; key: string; line: number }>
  | Readonly<{ kind: 'context'; section: string; bar: number; context: ChartContext; line: number }>

export type LayoutSection = Readonly<{
  name: string
  /** its section: line */
  line: number
  part: FormPart
  /** the copy: source and the copy: line; null for a section written out */
  copyOf: string | null
  copyLine: number | null
  /** its metre as written or carried; the sheets still play the song's (drawn from #235) */
  beats: 2 | 3 | 4
  /** in bars: bars:, else a copy's source's length, else its last written bar */
  length: number
  /** the bars before it in its part */
  start: number
  /** stated at its bar 1: its own key:, else its copy source's; null: none stated, the analysis finds it */
  key: string | null
  context: ChartContext | null
  /** the lines of its own fields (not what a copy: carries) */
  fieldLines: Readonly<Partial<Record<SectionField, number>>>
  rows: readonly LinedRow[]
}>

export type Layout = Readonly<{
  sections: readonly LayoutSection[]
  /** every section's rows, in order (expandRowLines) */
  rows: readonly LinedRow[]
  /** own and carried directives, in chart order */
  directives: readonly Directive[]
  lengths: ReadonlyMap<string, number>
}>

const WHOLE = /^[+-]?\d{1,6}$/

export function sectionLayout(doc: ChartDoc): Parsed<Layout> {
  type Field = Readonly<{ value: string; line: number }>
  type Block = { name: string; line: number; fields: Partial<Record<SectionField, Field>>; rows: LinedRow[]; directives: Directive[] }
  const blocks: Block[] = []
  doc.lines.forEach((l, line) => {
    if (l.kind === 'section') return void blocks.push({ name: l.name, line, fields: {}, rows: [], directives: [] })
    const b = blocks.at(-1)
    if (!b) return
    if (l.kind === 'sectionMeta') b.fields[l.field] = { value: l.value, line }
    else if (l.kind === 'row') b.rows.push({ section: b.name, bar: l.bar, chord: l.chord, scale: l.scale, ...(l.function ? { function: l.function } : {}), line, at: 0 })
    else if (l.kind === 'ending' || l.kind === 'mark' || l.kind === 'nav' || l.kind === 'key' || l.kind === 'context') b.directives.push({ ...l, section: b.name, line })
  })

  const songBeats = chartBeats(doc)
  const diagnostics: Diagnostic[] = []
  const sections: LayoutSection[] = []
  const directives: Directive[] = []
  // each section as resolved, with the key and context changes a copy of it carries
  const byName = new Map<string, Readonly<{ section: LayoutSection; plan: readonly Directive[] }>>()
  const partBars: Record<FormPart, number> = { before: 0, form: 0, after: 0 }
  let seenForm = false
  let total = 0
  for (const b of blocks) {
    if (byName.has(b.name)) continue // the parser reported it
    const outside = b.fields.outside?.value === 'yes'
    const part: FormPart = outside ? (seenForm ? 'after' : 'before') : formPart(b.name)
    if (part === 'form') seenForm = true
    const src = b.fields.copy && b.fields.copy.value !== b.name ? byName.get(b.fields.copy.value) : undefined
    const base = src ? src.section.rows : b.rows
    if (total + base.length > LIMITS.maxExpandedRows) {
      // checked before growing: chained copies would otherwise double the rows each time
      diagnostics.push({ line: b.line + 1, message: `more than ${LIMITS.maxExpandedRows} rows after copy:`, fatal: true })
      break
    }
    total += base.length
    const lastBar = Math.max(1, ...base.filter((r) => WHOLE.test(r.bar)).map((r) => Number(r.bar)))
    const own = b.fields.bars ? Number(b.fields.bars.value) : src ? src.section.length : lastBar
    const length = Math.max(own, lastBar)
    const start = partBars[part]
    partBars[part] += length
    const rows = base.map((r): LinedRow => ({ ...r, section: b.name, at: start + (WHOLE.test(r.bar) ? Number(r.bar) : 1) }))
    // a copy's own key: (or context:) replaces its source's, with the source's in-block changes
    const carried = src ? src.plan.filter((d) => (d.kind === 'key' && !b.fields.key) || (d.kind === 'context' && !b.fields.context)).map((d) => ({ ...d, section: b.name })) : []
    const section: LayoutSection = {
      name: b.name,
      line: b.line,
      part,
      copyOf: b.fields.copy?.value ?? null,
      copyLine: b.fields.copy?.line ?? null,
      beats: b.fields.time ? (beatsPerBar(b.fields.time.value) ?? songBeats) : src ? src.section.beats : songBeats,
      length,
      start,
      key: b.fields.key?.value || (b.fields.key ? null : (src?.section.key ?? null)),
      context: b.fields.context ? parseContext(b.fields.context.value) : (src?.section.context ?? null),
      fieldLines: Object.fromEntries(Object.entries(b.fields).map(([f, v]) => [f, v.line])),
      rows,
    }
    byName.set(b.name, { section, plan: [...carried, ...b.directives.filter((d) => d.kind === 'key' || d.kind === 'context')] })
    sections.push(section)
    directives.push(...carried, ...b.directives)
  }
  return {
    value: { sections, rows: sections.flatMap((s) => s.rows), directives, lengths: new Map(sections.map((s) => [s.name, s.length])) },
    diagnostics,
  }
}

/** the key stated at a bar of a section: its last in-block @key at or before the bar, else its key:, else null */
export function statedKeyAt(layout: Layout, section: string, bar: number): string | null {
  const changes = layout.directives.filter((d): d is Extract<Directive, { kind: 'key' }> => d.kind === 'key' && d.section === section && d.bar <= bar)
  const change = changes.reduce<Extract<Directive, { kind: 'key' }> | undefined>((best, d) => (!best || d.bar >= best.bar ? d : best), undefined)
  return change?.key ?? layout.sections.find((s) => s.name === section)?.key ?? null
}
