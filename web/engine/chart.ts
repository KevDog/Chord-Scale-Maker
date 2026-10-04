import { LIMITS } from './limits'
import { defaultScale } from './qualities'

export type MetaKey = 'title' | 'subtitle'
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string }> // scale '' = default
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
  for (const key of ['title', 'subtitle'] as const) {
    if (low.startsWith(`${key}:`)) {
      const value = line.slice(key.length + 1).trim()
      return value.length > LIMITS.maxMeta ? `${key} longer than ${LIMITS.maxMeta} characters` : { kind: 'meta', key, value }
    }
  }
  if (low.startsWith('@copy')) {
    const parts = line.split(/\s+/)
    if (parts.length !== 4 || !OFFSET_RE.test(parts[3])) return 'use  @copy SRC DST BAR_OFFSET'
    if (parts[1].length > LIMITS.maxCell || parts[2].length > LIMITS.maxCell)
      return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'copy', src: parts[1], dst: parts[2], offset: Number(parts[3]) }
  }
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length !== 3 && cells.length !== 4) return 'expected  section | bar | chord [| scale]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  const [section, bar, chord, scale = ''] = cells
  return { kind: 'row', section, bar, chord, scale }
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
  if (lines.length > 0 && lines[lines.length - 1].kind === 'blank') lines.pop() // trailing newline
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
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
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

export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string }> {
  const meta = (key: MetaKey, fallback: string): string =>
    doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)
  return { title: meta('title', 'Untitled'), subtitle: meta('subtitle', '') }
}

/** chart rows in order with @copy applied (a copy repeats the rows seen so far); at most maxExpandedRows */
export function expandRows(doc: ChartDoc): Parsed<readonly Row[]> {
  const diagnostics: Diagnostic[] = []
  const rows: Row[] = []
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
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale })
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

/** the row's scale, else the chord quality's default; null means "ask the user" */
export function resolveScale(row: Row): string | null {
  if (row.scale) return row.scale
  try {
    return defaultScale(row.chord)
  } catch {
    return null // unparseable chord
  }
}
