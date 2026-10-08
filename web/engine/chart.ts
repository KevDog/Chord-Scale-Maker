import { LIMITS } from './limits'
import { defaultScale } from './qualities'

/**
 * The chart text format (docs/design.md §4): a tolerant parser to a ChartDoc that keeps every line, the canonical
 * serializer, @copy expansion and the default-scale lookup. Port of read_chart, minus its exits.
 */

/**
 * title: and subtitle: are the heading. key: and bars: are hints for the analyser (docs/plan-analysis.md §12);
 * composer:, style:, form: and source: describe the tune (where the chart came from). The site keeps the rest and
 * shows only the heading.
 */
export type MetaKey = 'title' | 'subtitle' | 'key' | 'bars' | 'time' | 'composer' | 'style' | 'form' | 'source'
export const META_KEYS: readonly MetaKey[] = ['title', 'subtitle', 'key', 'bars', 'time', 'composer', 'style', 'form', 'source']

/** `time:` 2/4, 3/4 or 4/4 (the default): beats a bar for the guide tone and Changes sheets; null if it's another */
export function beatsPerBar(time: string): 2 | 3 | 4 | null {
  const t = time.trim()
  if (!t) return 4
  const m = /^([234])\/4$/.exec(t)
  return m ? (Number(m[1]) as 2 | 3 | 4) : null
}
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  // scale '' = default; comment: a trailing "# …" (the analysis, docs/plan-analysis.md §12.1), kept verbatim
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string; comment?: string }>
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
export type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
/** line is 1-based (0 = whole chart); fatal = over a hard input limit: don't render it or write it back */
export type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>
export type Row = Readonly<{ section: string; bar: string; chord: string; scale: string }>
export type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>

const INT_RE = /^[+-]?\d{1,6}$/ // bar numbers; longer would lose precision as Number
const OFFSET_RE = /^[+-]?\d{1,4}$/ // bar offsets stay well inside safe integers

function parseLine(line: string): ChartLine | string {
  if (!line) return { kind: 'blank' }
  if (line.startsWith('#')) return { kind: 'comment', text: line }
  const low = line.toLowerCase()
  for (const key of META_KEYS) {
    if (low.startsWith(`${key}:`)) {
      const value = line.slice(key.length + 1).trim()
      if (value.length > LIMITS.maxMeta) return `${key} longer than ${LIMITS.maxMeta} characters`
      if (key === 'time' && beatsPerBar(value) === null) return 'time: 2/4, 3/4 or 4/4'
      return { kind: 'meta', key, value }
    }
  }
  if (low.startsWith('@copy')) {
    const [, src = '', dst = '', offset = '', ...extra] = line.split(/\s+/)
    if (extra.length > 0 || !OFFSET_RE.test(offset)) return 'use  @copy SRC DST BAR_OFFSET'
    if (src.length > LIMITS.maxCell || dst.length > LIMITS.maxCell)
      return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'copy', src, dst, offset: Number(offset) }
  }
  // a trailing comment starts at a # with space on both sides (F#m7 and C# Lydian have none before theirs)
  const hash = /\s#(?=\s|$)/.exec(line)
  const body = hash ? line.slice(0, hash.index) : line
  const comment = hash ? line.slice(hash.index + 2).trim() : undefined
  const cells = body.split('|').map((c) => c.trim())
  if (cells.length !== 3 && cells.length !== 4) return 'expected  section | bar | chord [| scale]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  if (comment !== undefined && comment.length > LIMITS.maxMeta) return `comment longer than ${LIMITS.maxMeta} characters`
  const [section = '', bar = '', chord = '', scale = ''] = cells
  return comment === undefined ? { kind: 'row', section, bar, chord, scale } : { kind: 'row', section, bar, chord, scale, comment }
}

/** tolerant parse: bad lines become 'invalid' lines plus a diagnostic, never an exception */
export function parseChart(text: string): Parsed<ChartDoc> {
  if (text.length > LIMITS.maxChars)
    return { value: { lines: [] }, diagnostics: [{ line: 0, message: `chart longer than ${LIMITS.maxChars} characters`, fatal: true }] }
  const diagnostics: Diagnostic[] = []
  const lines = text.split(/\r?\n/).map((raw, i): ChartLine => {
    const t = raw.trim()
    const parsed = parseLine(t)
    if (typeof parsed !== 'string') return parsed
    diagnostics.push({ line: i + 1, message: parsed })
    return { kind: 'invalid', text: t }
  })
  if (lines.at(-1)?.kind === 'blank') lines.pop() // trailing newline
  if (lines.filter((l) => l.kind === 'row').length > LIMITS.maxRows)
    diagnostics.push({ line: 0, message: `more than ${LIMITS.maxRows} rows`, fatal: true })
  return { value: { lines }, diagnostics }
}

export const isFatal = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some((d) => d.fatal)

/** canonical text: chord rows column-aligned, everything else verbatim */
export function serializeChart(doc: ChartDoc): string {
  const rows = doc.lines.filter((l) => l.kind === 'row')
  const width = (f: (r: (typeof rows)[number]) => string): number => Math.max(0, ...rows.map((r) => f(r).length))
  const [ws, wb, wc] = [width((r) => r.section), width((r) => r.bar), width((r) => r.chord)]
  const wsc = Math.max(0, ...rows.filter((r) => r.comment !== undefined).map((r) => r.scale.length)) // comments line up
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
        if (l.comment !== undefined) {
          const cells = l.scale ? `${l.chord.padEnd(wc)} | ${l.scale.padEnd(wsc)}` : l.chord.padEnd(wc)
          return `${head}${cells}  #${l.comment ? ` ${l.comment}` : ''}`
        }
        return l.scale ? `${head}${l.chord.padEnd(wc)} | ${l.scale}` : `${head}${l.chord}`
      }
      case 'copy':
        return `@copy ${l.src} ${l.dst} ${l.offset}`
      case 'comment':
      case 'invalid':
        return l.text
      case 'blank':
        return ''
    }
  })
  return out.join('\n') + '\n'
}

/**
 * sections outside the form: an Intro before it, a Coda, Tag or Ending after it ("Tag 2" too). They print where
 * they stand; the analysis and the guide tone timeline treat each as its own piece, around the repeating form.
 */
const OUTSIDE = /^(intro|coda|tag|ending)(\s*\d+)?$/i
export const isOutsideForm = (section: string): boolean => OUTSIDE.test(section.trim())
/** before the form (an intro), the form itself, or after it */
export type FormPart = 'before' | 'form' | 'after'
export const formPart = (section: string): FormPart => (!isOutsideForm(section) ? 'form' : /^intro/i.test(section.trim()) ? 'before' : 'after')

/** a meta value as written (the last line wins), or the fallback */
const metaValue = (doc: ChartDoc, key: MetaKey, fallback = ''): string =>
  doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)

/** the chart's beats a bar, from its `time:` line (4 without one) */
export const chartBeats = (doc: ChartDoc): 2 | 3 | 4 => beatsPerBar(metaValue(doc, 'time')) ?? 4

/** the title and subtitle as written (what the editor's fields edit) */
export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string }> {
  return { title: metaValue(doc, 'title', 'Untitled'), subtitle: metaValue(doc, 'subtitle') }
}

/** "Eb" -> "E♭", "F#m" -> "F♯ minor"; anything else as written */
export function keyLabel(key: string): string {
  const m = /^([A-G])([b#]?)(m?)$/.exec(key.trim())
  if (!m) return key.trim()
  const [, letter = '', acc, minor] = m
  return `${letter}${acc === 'b' ? '♭' : acc === '#' ? '♯' : ''}${minor ? ' minor' : ''}`
}

/**
 * what a sheet's heading shows: the title, a line under it and the composer. The line is the subtitle (or, without
 * one, the style), then the key and the form: "Bossa nova · B♭ · AB, 16 bars"
 */
export function chartHeading(doc: ChartDoc): Readonly<{ title: string; subtitle: string; composer: string }> {
  const line = [metaValue(doc, 'subtitle') || metaValue(doc, 'style'), keyLabel(metaValue(doc, 'key')), metaValue(doc, 'form')]
  return { title: metaValue(doc, 'title', 'Untitled'), subtitle: line.filter(Boolean).join(' · '), composer: metaValue(doc, 'composer') }
}

/** an expanded row and the line it came from (a @copy repeat points at its source row's line) */
export type LinedRow = Row & Readonly<{ line: number }>

/** chart rows in order with @copy applied, each with its source line index; at most maxExpandedRows */
export function expandRowLines(doc: ChartDoc): Parsed<readonly LinedRow[]> {
  const diagnostics: Diagnostic[] = []
  const rows: LinedRow[] = []
  const tooMany = (line: number): Diagnostic => ({
    line,
    message: `more than ${LIMITS.maxExpandedRows} rows after @copy`,
    fatal: true,
  })
  for (const [i, l] of doc.lines.entries()) {
    if (l.kind === 'row') {
      if (rows.length >= LIMITS.maxExpandedRows) {
        diagnostics.push(tooMany(i + 1))
        break
      }
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale, line: i })
    }
    if (l.kind !== 'copy') continue
    const src = rows.filter((r) => r.section === l.src)
    if (src.some((r) => !INT_RE.test(r.bar))) {
      diagnostics.push({ line: i + 1, message: `@copy needs whole-number bars in section ${l.src}` })
      continue
    }
    if (rows.length + src.length > LIMITS.maxExpandedRows) {
      // checked before growing: chained copies would otherwise double the rows each time
      diagnostics.push(tooMany(i + 1))
      break
    }
    rows.push(...src.map((r) => ({ ...r, section: l.dst, bar: String(Number(r.bar) + l.offset) })))
  }
  return { value: rows, diagnostics }
}

/** chart rows in order with @copy applied (a copy repeats the rows seen so far); at most maxExpandedRows */
export function expandRows(doc: ChartDoc): Parsed<readonly Row[]> {
  const { value, diagnostics } = expandRowLines(doc)
  return { value: value.map(({ section, bar, chord, scale }) => ({ section, bar, chord, scale })), diagnostics }
}

/** the row's scale, else the chord quality's default; null means "ask the user" */
export function resolveScale(row: Row): string | null {
  if (row.scale) return row.scale
  try {
    return defaultScale(row.chord)
  } catch {
    return null // unparseable chord
  }
}
