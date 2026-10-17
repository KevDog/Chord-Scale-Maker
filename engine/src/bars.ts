import { type Beats, type ChartContext, type ChartDoc, chartBeats, type FormPart, type LinedRow } from './chart'
import { guideToneTimeline } from './guideToneTimeline'
import { sectionLayout } from './layout'
import { barAt, barStart } from './metre'

/**
 * The chart as the bar editor sees it (docs/superpowers/proposals/editor-ux/README.md §3): sections → bars → chords,
 * in concert pitch, timed as the Changes sheet times them. Each chord and directive carries the index in doc.lines it
 * was written on, so an edit can go back to it; a copy: section's chords point at their source rows. What can't be
 * placed on a bar is listed, to be edited in Source. No analysis, no DOM.
 */

export type BarChord = Readonly<{ chord: string; beat: number; line: number }>
export type BarEnding = Readonly<{ n: number; first: boolean; last: boolean; line: number }>
export type ChartBar = Readonly<{
  /** the bar's number in its section, from 1 */
  bar: number
  /** chords: one starts here; held: none starts here, the one before goes on (to the section's length) */
  kind: 'chords' | 'held'
  /** its metre's beats (#235) */
  beats: Beats
  chords: readonly BarChord[]
  ending: BarEnding | null
  marks: readonly Readonly<{ mark: 'segno' | 'coda'; line: number }>[]
  nav: readonly Readonly<{ text: string; line: number }>[]
  key: Readonly<{ key: string; line: number }> | null
  /** a metre stated here: an @time, or a section's time: on its bar 1 */
  time: Readonly<{ time: string; line: number }> | null
  context: Readonly<{ context: ChartContext; line: number }> | null
}>
export type BarSection = Readonly<{
  name: string
  part: FormPart
  /** the copy: that wrote it: the section it repeats and the copy: line; null for a section written out */
  copy: Readonly<{ of: string; line: number }> | null
  bars: readonly ChartBar[]
}>
/** a line no bar shows (a bad row, a directive on a bar that isn't there), with why */
export type Unplaced = Readonly<{ line: number; reason: string }>
/** beats: the song's metre */
export type BarView = Readonly<{ beats: Beats; sections: readonly BarSection[]; unplaced: readonly Unplaced[] }>

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
  const { value: layout, diagnostics } = sectionLayout(doc)
  for (const d of diagnostics) unplaced.push({ line: d.line - 1, reason: d.message })
  const rows = orderedRows(layout.rows, unplaced)
  const { events, clock } = guideToneTimeline(rows, beats, layout.lengths, layout.metres)
  const timed = new Set(events.map((e) => e.row))
  for (const r of rows) {
    const n = layout.metres.get(r.section)?.[Number(r.bar) - 1] ?? beats
    if (!timed.has(r)) unplaced.push({ line: r.line, reason: `more than ${n} chords in bar ${r.bar} of ${r.section}` })
  }

  const at = new Map<string, Mutable<ChartBar>>()
  let first = 0 // each section's bar 1, counted through the chart as the timeline plays it
  const sections = layout.sections.map((s): BarSection => {
    const own = events.filter((e) => e.row.section === s.name)
    const bars = Array.from({ length: s.length }, (_, j): Mutable<ChartBar> => {
      const chords = own
        .filter((e) => barAt(clock, e.start) === first + j)
        .map((e): BarChord => ({ chord: e.chord, beat: e.start - barStart(clock, first + j), line: (e.row as LinedRow).line }))
      const bar = { bar: j + 1, kind: chords.length ? 'chords' : 'held', beats: s.metre[j] ?? s.beats, chords, ending: null, marks: [], nav: [], key: null, time: null, context: null } as Mutable<ChartBar>
      at.set(`${s.name}|${bar.bar}`, bar)
      return bar
    })
    // a key:, time: or context: field states its section's bar 1
    const bar1 = bars[0]
    if (bar1 && s.key && s.fieldLines.key !== undefined) bar1.key = { key: s.key, line: s.fieldLines.key }
    if (bar1 && s.fieldLines.time !== undefined) bar1.time = { time: `${s.beats}/4`, line: s.fieldLines.time }
    if (bar1 && s.context && s.fieldLines.context !== undefined) bar1.context = { context: s.context, line: s.fieldLines.context }
    first += s.length
    return { name: s.name, part: s.part, copy: s.copyOf !== null && s.copyLine !== null ? { of: s.copyOf, line: s.copyLine } : null, bars }
  })

  const sectionNames = new Set(layout.sections.map((s) => s.name))
  const find = (section: string, bar: number, line: number): Mutable<ChartBar> | undefined => {
    const found = at.get(`${section}|${bar}`)
    if (!found) unplaced.push({ line, reason: sectionNames.has(section) ? `no bar ${bar} in ${section}` : `no section ${section}` })
    return found
  }
  for (const d of layout.directives) {
    const { line } = d
    if (d.kind === 'mark') find(d.section, d.bar, line)?.marks.push({ mark: d.mark, line })
    else if (d.kind === 'nav') find(d.section, d.bar, line)?.nav.push({ text: d.text, line })
    else if (d.kind === 'key' || d.kind === 'time' || d.kind === 'context') {
      const bar = find(d.section, d.bar, line)
      if (bar?.[d.kind]) unplaced.push({ line, reason: `bar ${d.bar} of ${d.section} already has an @${d.kind}` })
      else if (bar && d.kind === 'key') bar.key = { key: d.key, line }
      else if (bar && d.kind === 'time') bar.time = { time: d.time, line }
      else if (bar && d.kind === 'context') bar.context = { context: d.context, line }
    } else if (d.kind === 'ending') {
      const span = Array.from({ length: d.to - d.from + 1 }, (_, j) => at.get(`${d.section}|${d.from + j}`))
      if (span.some((b) => !b)) unplaced.push({ line, reason: `no bars ${d.from}–${d.to} in ${d.section}` })
      else if (span.some((b) => b?.ending)) unplaced.push({ line, reason: `an ending already covers bars ${d.from}–${d.to} of ${d.section}` })
      else span.forEach((b, j) => b && (b.ending = { n: d.n, first: j === 0, last: j === span.length - 1, line }))
    }
  }

  // a copy: repeats a row or directive it can't place: list its line once
  const once = unplaced.filter((u, i) => unplaced.findIndex((v) => v.line === u.line) === i)
  return { beats, sections, unplaced: once.sort((a, b) => a.line - b.line) }
}
