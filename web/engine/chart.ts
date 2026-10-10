import { LIMITS } from './limits'
import { defaultScaleOrNull } from './qualities'

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

/** `time:` 2/4, 3/4 or 4/4 (the default): beats a bar for the Changes sheet and its guide tones; null if it's another */
export function beatsPerBar(time: string): 2 | 3 | 4 | null {
  const t = time.trim()
  if (!t) return 4
  const m = /^([234])\/4$/.exec(t)
  return m ? (Number(m[1]) as 2 | 3 | 4) : null
}
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  // scale '' = default; function: the author's harmonic function (V7/ii, D: V7/ii), absent when not written;
  // comment: a trailing "# …" (the analysis, docs/plan-analysis.md §12.1), kept verbatim
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string; function?: string; comment?: string }>
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'ending'; n: number; section: string; from: number; to: number }>
  | Readonly<{ kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }>
  | Readonly<{ kind: 'nav'; section: string; bar: number; text: string }>
  // the author's key area, from this bar until the next @key
  | Readonly<{ kind: 'key'; section: string; bar: number; key: string }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
export type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
/** line is 1-based (0 = whole chart); fatal = over a hard input limit: don't render it or write it back */
export type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>
export type Row = Readonly<{ section: string; bar: string; chord: string; scale: string; function?: string }>
export type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>

const INT_RE = /^[+-]?\d{1,6}$/ // bar numbers; longer would lose precision as Number
/** a key as `key:` and `@key` take it: "Eb", "F#m", "Bb minor", "C-" */
const KEY_TEXT_RE = /^([A-G][b#]?)\s*(m|-|min|minor|major|maj)?$/i
/** KEY_TEXT_RE, case-blind for its suffix (Bb Minor), with the note letter a capital ("bb" is no key); null if no key */
export function matchKeyText(text: string): RegExpExecArray | null {
  const m = KEY_TEXT_RE.exec(text)
  return m && /^[A-G]/.test(m[1] ?? '') ? m : null
}
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
  if (low.startsWith('@ending')) {
    const [, n = '', section = '', from = '', to = from, ...extra] = line.split(/\s+/)
    if (extra.length > 0 || (n !== '1' && n !== '2') || !INT_RE.test(from) || !INT_RE.test(to)) return 'use  @ending N SECTION FIRST [LAST]'
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    if (Number(to) < Number(from)) return '@ending LAST must be at least FIRST'
    return { kind: 'ending', n: Number(n), section, from: Number(from), to: Number(to) }
  }
  if (low.startsWith('@segno') || low.startsWith('@coda')) {
    const [word = '', section = '', bar = '', ...extra] = line.split(/\s+/)
    if (extra.length > 0 || !section || !INT_RE.test(bar)) return 'use  @segno SECTION BAR  or  @coda SECTION BAR'
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'mark', mark: word.toLowerCase() === '@coda' ? 'coda' : 'segno', section, bar: Number(bar) }
  }
  if (low.startsWith('@nav')) {
    const m = /^@nav\s+(\S+)\s+(\S+)\s+(.+)$/.exec(line)
    if (!m || !INT_RE.test(m[2] ?? '')) return 'use  @nav SECTION BAR TEXT'
    const [, section = '', bar = '', text = ''] = m
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    if (text.trim().length > LIMITS.maxMeta) return `nav text longer than ${LIMITS.maxMeta} characters`
    return { kind: 'nav', section, bar: Number(bar), text: text.trim() }
  }
  if (low.startsWith('@key')) {
    const m = /^@key\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(line)
    const k = (m?.[3] ?? '').trim()
    if (!m || !INT_RE.test(m[2] ?? '') || !matchKeyText(k)) return 'use  @key SECTION BAR KEY  (a key like Eb or Cm)'
    const [, section = '', bar = ''] = m
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'key', section, bar: Number(bar), key: k }
  }
  // a trailing comment starts at a # with space on both sides (F#m7 and C# Lydian have none before theirs)
  const hash = /\s#(?=\s|$)/.exec(line)
  const body = hash ? line.slice(0, hash.index) : line
  const comment = hash ? line.slice(hash.index + 2).trim() : undefined
  const cells = body.split('|').map((c) => c.trim())
  if (cells.length < 3 || cells.length > 5) return 'expected  section | bar | chord [| scale [| function]]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  if (comment !== undefined && comment.length > LIMITS.maxMeta) return `comment longer than ${LIMITS.maxMeta} characters`
  const [section = '', bar = '', chord = '', scale = '', fn = ''] = cells
  return { kind: 'row', section, bar, chord, scale, ...(fn ? { function: fn } : {}), ...(comment === undefined ? {} : { comment }) }
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
  // scales line up where a comment or a function follows them; functions where a comment follows
  const wsc = Math.max(0, ...rows.filter((r) => r.comment !== undefined || r.function !== undefined).map((r) => r.scale.length))
  const wf = Math.max(0, ...rows.filter((r) => r.function !== undefined && r.comment !== undefined).map((r) => (r.function ?? '').length))
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
        const tail = l.comment !== undefined ? `  #${l.comment ? ` ${l.comment}` : ''}` : ''
        if (l.function !== undefined) {
          const fn = l.comment !== undefined ? l.function.padEnd(wf) : l.function
          return `${head}${l.chord.padEnd(wc)} | ${l.scale.padEnd(wsc)} | ${fn}${tail}`
        }
        if (l.comment !== undefined) {
          const cells = l.scale ? `${l.chord.padEnd(wc)} | ${l.scale.padEnd(wsc)}` : l.chord.padEnd(wc)
          return `${head}${cells}${tail}`
        }
        return l.scale ? `${head}${l.chord.padEnd(wc)} | ${l.scale}` : `${head}${l.chord}`
      }
      case 'copy':
        return `@copy ${l.src} ${l.dst} ${l.offset}`
      case 'ending':
        return `@ending ${l.n} ${l.section} ${l.from}${l.to !== l.from ? ` ${l.to}` : ''}`
      case 'mark':
        return `@${l.mark} ${l.section} ${l.bar}`
      case 'nav':
        return `@nav ${l.section} ${l.bar} ${l.text}`
      case 'key':
        return `@key ${l.section} ${l.bar} ${l.key}`
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
 * they stand; the analysis and the Changes timeline (guideToneTimeline.ts) treat each as its own piece, around the repeating form.
 */
const OUTSIDE = /^(intro|coda|tag|ending)(\s*\d+)?$/i
const isOutsideForm = (section: string): boolean => OUTSIDE.test(section.trim())
/** before the form (an intro), the form itself, or after it */
export type FormPart = 'before' | 'form' | 'after'
export const formPart = (section: string): FormPart => (!isOutsideForm(section) ? 'form' : /^intro/i.test(section.trim()) ? 'before' : 'after')

/** a meta value as written (the last line wins), or the fallback */
const metaValue = (doc: ChartDoc, key: MetaKey, fallback = ''): string =>
  doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)

/** the chart's beats a bar, from its `time:` line (4 without one) */
export const chartBeats = (doc: ChartDoc): 2 | 3 | 4 => beatsPerBar(metaValue(doc, 'time')) ?? 4

/** the title, subtitle and key as written (what the editor's fields edit) */
export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string; key: string }> {
  return { title: metaValue(doc, 'title', 'Untitled'), subtitle: metaValue(doc, 'subtitle'), key: metaValue(doc, 'key') }
}

/** a valid chart key: a note letter, optional accidental, optional minor "m" ("Eb", "F#m"); nothing else */
export const isValidKey = (text: string): boolean => /^[A-G][b#]?m?$/.test(text.trim())

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
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale, ...(l.function ? { function: l.function } : {}), line: i })
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
  return row.scale ? row.scale : defaultScaleOrNull(row.chord)
}
