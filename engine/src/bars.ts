import { type ChartContext, type ChartDoc, chartBeats, expandRowLines, formPart, type FormPart, type LinedRow } from './chart'
import { guideToneTimeline } from './guideToneTimeline'

/**
 * The chart as the bar editor sees it (docs/superpowers/proposals/editor-ux/README.md §3): sections → bars → chords,
 * in concert pitch, timed as the Changes sheet times them. Each chord and directive carries the index in doc.lines it
 * was written on, so an edit can go back to it; a @copy section's chords point at their source rows. What can't be
 * placed on a bar is listed, to be edited in Source. No analysis, no DOM.
 */

export type BarChord = Readonly<{ chord: string; beat: number; line: number }>
export type BarEnding = Readonly<{ n: number; first: boolean; last: boolean; line: number }>
export type ChartBar = Readonly<{
  /** the bar's number as the chart numbers it */
  bar: number
  /** chords: one starts here; held: none starts here, the one before goes on; implied: after the section's last row, as the sheet rounds it up */
  kind: 'chords' | 'held' | 'implied'
  chords: readonly BarChord[]
  ending: BarEnding | null
  marks: readonly Readonly<{ mark: 'segno' | 'coda'; line: number }>[]
  nav: readonly Readonly<{ text: string; line: number }>[]
  key: Readonly<{ key: string; line: number }> | null
  context: Readonly<{ context: ChartContext; line: number }> | null
}>
export type BarSection = Readonly<{
  name: string
  part: FormPart
  /** the @copy that wrote it: the section it repeats and the @copy's line; null for a section written out */
  copy: Readonly<{ of: string; line: number }> | null
  bars: readonly ChartBar[]
}>
/** a line no bar shows (a bad row, a directive on a bar that isn't there), with why */
export type Unplaced = Readonly<{ line: number; reason: string }>
export type BarView = Readonly<{ beats: 2 | 3 | 4; sections: readonly BarSection[]; unplaced: readonly Unplaced[] }>

const WHOLE = /^[+-]?\d{1,6}$/

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] }

/** rows the bars can't show: a bar that isn't a whole number, or one before the bar above it in its section */
function orderedRows(rows: readonly LinedRow[], unplaced: Unplaced[]): LinedRow[] {
  let section: string | null = null
  let prev = -Infinity
  return rows.filter((r) => {
    if (r.section !== section) [section, prev] = [r.section, -Infinity]
    if (!WHOLE.test(r.bar)) unplaced.push({ line: r.line, reason: `bar "${r.bar}" is not a whole number` })
    else if (Number(r.bar) < prev) unplaced.push({ line: r.line, reason: `bar ${r.bar} comes after bar ${prev} in ${r.section}` })
    else {
      prev = Number(r.bar)
      return true
    }
    return false
  })
}

export function barView(doc: ChartDoc): BarView {
  const beats = chartBeats(doc)
  const unplaced: Unplaced[] = []
  doc.lines.forEach((l, i) => {
    if (l.kind === 'invalid') unplaced.push({ line: i, reason: "can't read this line" })
  })
  const expanded = expandRowLines(doc)
  for (const d of expanded.diagnostics) unplaced.push({ line: d.line - 1, reason: d.message })
  const rows = orderedRows(expanded.value, unplaced)
  const { events } = guideToneTimeline(rows, beats)
  const timed = new Set(events.map((e) => e.row))
  for (const r of rows)
    if (!timed.has(r)) unplaced.push({ line: r.line, reason: `more than ${beats} chords in bar ${r.bar} of ${r.section}` })

  // runs of events in one section, as the chart plays them
  const barOf = (start: number): number => Math.floor(start / beats)
  const runs: { row: LinedRow; events: typeof events[number][] }[] = []
  for (const e of events) {
    const last = runs.at(-1)
    if (last && last.row.section === e.row.section) last.events.push(e)
    else runs.push({ row: e.row as LinedRow, events: [e] })
  }
  const total = Math.ceil(events.reduce((m, e) => Math.max(m, e.start + e.beats), 0) / beats)
  // a bar after the last chord of its part (intro, form, coda) is implied: the sheet rounds the part up
  const lastChordBar = new Map<number, number>()
  for (let k = runs.length - 1, last = -1; k >= 0; k--) {
    const run = runs[k]
    const next = runs[k + 1]
    if (!run) continue
    if (!next || formPart(next.row.section) !== formPart(run.row.section)) last = barOf(run.events.at(-1)?.start ?? 0)
    lastChordBar.set(k, last)
  }

  const copies = doc.lines.flatMap((l, line) => (l.kind === 'copy' ? [{ of: l.src, dst: l.dst, line }] : []))
  const at = new Map<string, Mutable<ChartBar>>()
  const sections = runs.map((run, k): BarSection => {
    const from = barOf(run.events[0]?.start ?? 0)
    const to = runs[k + 1] ? barOf(runs[k + 1]?.events[0]?.start ?? 0) : total
    const first = Number(run.row.bar)
    const bars = Array.from({ length: Math.max(1, to - from) }, (_, j): Mutable<ChartBar> => {
      const chords = run.events
        .filter((e) => barOf(e.start) === from + j)
        .map((e): BarChord => ({ chord: e.chord, beat: e.start - (from + j) * beats, line: (e.row as LinedRow).line }))
      const kind = chords.length ? 'chords' : from + j > (lastChordBar.get(k) ?? -1) ? 'implied' : 'held'
      const bar = { bar: first + j, kind, chords, ending: null, marks: [], nav: [], key: null, context: null } as Mutable<ChartBar>
      const id = `${run.row.section}|${bar.bar}`
      if (!at.has(id)) at.set(id, bar)
      return bar
    })
    const source = doc.lines[run.row.line]
    const isCopy = source?.kind === 'row' && source.section !== run.row.section
    const copy = isCopy ? copies.find((c) => c.dst === run.row.section) : undefined
    return { name: run.row.section, part: formPart(run.row.section), copy: copy ? { of: copy.of, line: copy.line } : null, bars }
  })

  const sectionNames = new Set(runs.map((r) => r.row.section))
  const find = (section: string, bar: number, line: number): Mutable<ChartBar> | undefined => {
    const found = at.get(`${section}|${bar}`)
    if (!found) unplaced.push({ line, reason: sectionNames.has(section) ? `no bar ${bar} in ${section}` : `no section ${section}` })
    return found
  }
  doc.lines.forEach((l, line) => {
    if (l.kind === 'mark') find(l.section, l.bar, line)?.marks.push({ mark: l.mark, line })
    else if (l.kind === 'nav') find(l.section, l.bar, line)?.nav.push({ text: l.text, line })
    else if (l.kind === 'key' || l.kind === 'context') {
      const bar = find(l.section, l.bar, line)
      if (bar?.[l.kind]) unplaced.push({ line, reason: `bar ${l.bar} of ${l.section} already has an @${l.kind}` })
      else if (bar && l.kind === 'key') bar.key = { key: l.key, line }
      else if (bar && l.kind === 'context') bar.context = { context: l.context, line }
    } else if (l.kind === 'ending') {
      const span = Array.from({ length: l.to - l.from + 1 }, (_, j) => at.get(`${l.section}|${l.from + j}`))
      if (span.some((b) => !b)) unplaced.push({ line, reason: `no bars ${l.from}–${l.to} in ${l.section}` })
      else if (span.some((b) => b?.ending)) unplaced.push({ line, reason: `an ending already covers bars ${l.from}–${l.to} of ${l.section}` })
      else span.forEach((b, j) => b && (b.ending = { n: l.n, first: j === 0, last: j === span.length - 1, line }))
    }
  })

  // a @copy repeats a row it can't place: list its line once
  const once = unplaced.filter((u, i) => unplaced.findIndex((v) => v.line === u.line) === i)
  return { beats, sections, unplaced: once.sort((a, b) => a.line - b.line) }
}
