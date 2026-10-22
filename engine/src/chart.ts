import { sectionLayout } from './layout'
import { LIMITS } from './limits'
import { defaultScaleOrNull } from './qualities'

/**
 * The chart text format (docs/design.md §4): a header of song fields, then section blocks: a `section:` line, its own
 * fields (key:, time:, context:, bars:, outside:, copy:), then its rows (`bar | chord [| scale [| function]]`, bars
 * from 1) and directives (@key, @time, @context, @ending, @segno, @coda, @nav), until the next `section:`. A tolerant parser
 * to a ChartDoc that keeps every line, the canonical serializer and the default-scale lookup; layout.ts resolves the
 * blocks.
 */

/**
 * title: and subtitle: are the heading. key:, bars: and context: are hints for the analyser (docs/plan-analysis.md
 * §12; context: functional, modal or blues, §5.4); minor: is reserved (accepted, ignored); composer:, style:, form:
 * and source: describe the tune (where the chart came from); aka: lists its other titles, `;` between them; recording:
 * names one notable recording (artist; album; label; year) and youtube: its video's ID; kind: says
 * whether it's a tune (the default), a form with no composer (F Blues) or an exercise; contributor: credits who sent the chart (shown on its song page). The site keeps the rest and shows only the heading.
 */
export type MetaKey = 'title' | 'subtitle' | 'version' | 'key' | 'bars' | 'time' | 'context' | 'minor' | 'composer' | 'style' | 'form' | 'source' | 'aka' | 'recording' | 'youtube' | 'kind' | 'contributor'
export const META_KEYS: readonly MetaKey[] = ['title', 'subtitle', 'version', 'key', 'bars', 'time', 'context', 'minor', 'composer', 'style', 'form', 'source', 'aka', 'recording', 'youtube', 'kind', 'contributor']

export type ChartKind = 'tune' | 'form' | 'exercise'
const CHART_KINDS: readonly ChartKind[] = ['tune', 'form', 'exercise']
const asKind = (value: string): ChartKind | undefined => CHART_KINDS.find((k) => k === value.trim().toLowerCase())

/** how the analyser reads a chart (docs/plan-analysis.md §5.4): its rule families and whether key areas are found */
export type ChartContext = 'functional' | 'modal' | 'blues'
/** a `context:` or `@context` value, case-blind ("Modal"), a trailing " # …" dropped; null if it is none of the three */
export function parseContext(text: string): ChartContext | null {
  const t = text.replace(/\s#(\s.*)?$/, '').trim().toLowerCase()
  return t === 'functional' || t === 'modal' || t === 'blues' ? t : null
}

/** a bar's length in quarter-note beats: the metres a chart can be in */
export type Beats = 2 | 3 | 4 | 5 | 6 | 7
const METRES = 'time: 2/4, 3/4, 4/4, 5/4, 6/4 or 7/4'
/** `time:` or `@time` 2/4 to 7/4 (4/4, the default, when empty): beats a bar for the Changes sheet and its guide tones; null if it's another */
export function beatsPerBar(time: string): Beats | null {
  const t = time.trim()
  if (!t) return 4
  const m = /^([2-7])\/4$/.exec(t)
  return m ? (Number(m[1]) as Beats) : null
}
/** a section block's own fields (docs/design.md §4), in the order the serializer writes them */
export type SectionField = 'key' | 'time' | 'context' | 'bars' | 'outside' | 'copy'
export const SECTION_FIELDS: readonly SectionField[] = ['key', 'time', 'context', 'bars', 'outside', 'copy']
/** a section's name: no spaces, at most maxCell characters */
export const isSectionName = (name: string): boolean => !!name && !/\s/.test(name) && name.length <= LIMITS.maxCell

export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  // opens a block: the rows and directives after it, until the next section:, belong to it
  | Readonly<{ kind: 'section'; name: string }>
  | Readonly<{ kind: 'sectionMeta'; field: SectionField; value: string }>
  // bar: counted from 1 in its section; scale '' = default; function: the author's harmonic function (V7/ii, D: V7/ii),
  // absent when not written; comment: a trailing "# …" (the analysis, docs/plan-analysis.md §12.1), kept verbatim
  | Readonly<{ kind: 'row'; bar: string; chord: string; scale: string; function?: string; comment?: string }>
  | Readonly<{ kind: 'altRow'; bar: string; chord: string; scale: string; function?: string; comment?: string }> // alt BAR | CHORD…: the alternate changes
  | Readonly<{ kind: 'ending'; n: number; from: number; to: number }>
  | Readonly<{ kind: 'mark'; mark: 'segno' | 'coda'; bar: number }>
  | Readonly<{ kind: 'nav'; bar: number; text: string }>
  // the author's key area, from this bar to the end of its section
  | Readonly<{ kind: 'key'; bar: number; key: string }>
  // the metre (2/4 to 7/4), from this bar to the end of its section (#235)
  | Readonly<{ kind: 'time'; bar: number; time: string }>
  // the author's context, from this bar to the end of its section (parsed; the analyser doesn't use it yet)
  | Readonly<{ kind: 'context'; bar: number; context: ChartContext }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
export type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
/** line is 1-based (0 = whole chart); fatal = over a hard input limit: don't render it or write it back */
export type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>
/** a row as played: its section filled in from its block, its bar counted from 1 in that section */
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

const HEADER_ONLY = 'directives go in a section: add  section: A  above'

/** a directive's line, without a section (it belongs to its block) */
function parseDirective(line: string, low: string): ChartLine | string | null {
  if (low.startsWith('@copy')) return '@copy is gone: write  copy: SRC  under the section’s section: line'
  if (low.startsWith('@ending')) {
    const [, n = '', from = '', to = from, ...extra] = line.split(/\s+/)
    if (extra.length > 0 || (n !== '1' && n !== '2') || !INT_RE.test(from) || !INT_RE.test(to)) return 'use  @ending N FIRST [LAST]'
    if (Number(to) < Number(from)) return '@ending LAST must be at least FIRST'
    return { kind: 'ending', n: Number(n), from: Number(from), to: Number(to) }
  }
  if (low.startsWith('@segno') || low.startsWith('@coda')) {
    const [word = '', bar = '', ...extra] = line.split(/\s+/)
    if (extra.length > 0 || !INT_RE.test(bar)) return 'use  @segno BAR  or  @coda BAR'
    return { kind: 'mark', mark: word.toLowerCase() === '@coda' ? 'coda' : 'segno', bar: Number(bar) }
  }
  if (low.startsWith('@nav')) {
    const m = /^@nav\s+(\S+)\s+(.+)$/i.exec(line)
    if (!m || !INT_RE.test(m[1] ?? '')) return 'use  @nav BAR TEXT'
    const text = (m[2] ?? '').trim()
    if (text.length > LIMITS.maxMeta) return `nav text longer than ${LIMITS.maxMeta} characters`
    return { kind: 'nav', bar: Number(m[1]), text }
  }
  if (low.startsWith('@key')) {
    const m = /^@key\s+(\S+)\s+(.+)$/i.exec(line)
    const k = (m?.[2] ?? '').trim()
    if (!m || !INT_RE.test(m[1] ?? '') || !matchKeyText(k)) return 'use  @key BAR KEY  (a key like Eb or Cm)'
    return { kind: 'key', bar: Number(m[1]), key: k }
  }
  if (low.startsWith('@time')) {
    const m = /^@time\s+(\S+)\s+(\S+)$/i.exec(line)
    const time = (m?.[2] ?? '').trim()
    if (!m || !INT_RE.test(m[1] ?? '') || !time || beatsPerBar(time) === null) return 'use  @time BAR METRE  (2/4, 3/4, 4/4, 5/4, 6/4 or 7/4)'
    return { kind: 'time', bar: Number(m[1]), time }
  }
  if (low.startsWith('@context')) {
    const m = /^@context\s+(\S+)\s+(\S+)$/i.exec(line)
    const context = parseContext(m?.[2] ?? '')
    if (!m || !INT_RE.test(m[1] ?? '') || !context) return 'use  @context BAR CONTEXT  (functional, modal or blues)'
    return { kind: 'context', bar: Number(m[1]), context }
  }
  return null
}

/** a section field's line, in a block */
function parseSectionField(field: SectionField, value: string): ChartLine | string {
  if (field === 'key' && value && !matchKeyText(value)) return 'key: a key like Eb or Cm'
  if (field === 'time' && beatsPerBar(value) === null) return METRES
  if (field === 'bars' && !(/^\d{1,4}$/.test(value) && Number(value) > 0)) return 'bars: a whole number of bars'
  if (field === 'outside') {
    const v = value.toLowerCase()
    return v === 'yes' || v === 'no' ? { kind: 'sectionMeta', field, value: v } : 'outside: yes or no'
  }
  if (field === 'copy' && !isSectionName(value)) return 'copy: the name of a section above'
  return { kind: 'sectionMeta', field, value }
}

// the video's ID, `(link only)` after it when it won't play embedded (the song page then links to it, no player)
const YOUTUBE = /^([A-Za-z0-9_-]{11})( \(link only\))?$/
const recordingFields = (value: string): string[] => value.split(';').map((s) => s.trim())

/** what's wrong with a recording: value, or null */
function recordingProblem(value: string): string | null {
  const [artist = '', album = '', , year = '', ...rest] = recordingFields(value)
  if (!artist || !album || rest.length) return 'recording: artist; album; label; year (artist and album required)'
  return year && !/^\d{4}$/.test(year) ? 'recording: the year is four digits' : null
}

function parseLine(line: string, inSection: boolean): ChartLine | string {
  if (!line) return { kind: 'blank' }
  if (line.startsWith('#')) return { kind: 'comment', text: line }
  const low = line.toLowerCase()
  if (low.startsWith('section:')) {
    const name = line.slice('section:'.length).trim()
    return isSectionName(name) ? { kind: 'section', name } : `section: a name without spaces, at most ${LIMITS.maxCell} characters`
  }
  for (const field of ['outside', 'copy'] as const) {
    if (!low.startsWith(`${field}:`)) continue
    return inSection ? parseSectionField(field, line.slice(field.length + 1).trim()) : `${field}: belongs to a section`
  }
  for (const key of META_KEYS) {
    if (!low.startsWith(`${key}:`)) continue
    const value = line.slice(key.length + 1).trim()
    if (value.length > LIMITS.maxMeta) return `${key} longer than ${LIMITS.maxMeta} characters`
    if (inSection) {
      if (key === 'key' || key === 'time' || key === 'context' || key === 'bars') return parseSectionField(key, value)
      return `${key}: belongs in the header, before the first section:`
    }
    if (key === 'time' && beatsPerBar(value) === null) return METRES
    if (key === 'kind' && value && !asKind(value)) return 'kind: tune, form or exercise'
    const problem = key === 'recording' && value ? recordingProblem(value) : null
    if (problem) return problem
    if (key === 'youtube' && value && !YOUTUBE.test(value)) return 'youtube: the 11-character video ID'
    return { kind: 'meta', key, value }
  }
  if (line.startsWith('@')) {
    const d = parseDirective(line, low)
    if (d === null) return `can't read ${line.split(/\s+/)[0]}`
    return inSection || typeof d === 'string' ? d : HEADER_ONLY
  }
  // a trailing comment starts at a # with space on both sides (F#m7 and C# Lydian have none before theirs)
  const alt = /^alt\s+/i.exec(line)
  const rowText = alt ? line.slice(alt[0].length) : line
  const hash = /\s#(?=\s|$)/.exec(rowText)
  const body = hash ? rowText.slice(0, hash.index) : rowText
  const comment = hash ? rowText.slice(hash.index + 2).trim() : undefined
  const cells = body.split('|').map((c) => c.trim())
  if (!inSection) {
    if (cells.length >= 3 && cells.length <= 5 && INT_RE.test(cells[1] ?? '')) return 'old chart format: put rows under a section: line, numbered from 1'
    return 'bars go in a section: add  section: A  above'
  }
  if (cells.length < 2 || cells.length > 4) return 'expected  bar | chord [| scale [| function]]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  if (comment !== undefined && comment.length > LIMITS.maxMeta) return `comment longer than ${LIMITS.maxMeta} characters`
  const [bar = '', chord = '', scale = '', fn = ''] = cells
  return { kind: alt ? 'altRow' : 'row', bar, chord, scale, ...(fn ? { function: fn } : {}), ...(comment === undefined ? {} : { comment }) }
}

/** tolerant parse: bad lines become 'invalid' lines plus a diagnostic, never an exception */
export function parseChart(text: string): Parsed<ChartDoc> {
  if (text.length > LIMITS.maxChars)
    return { value: { lines: [] }, diagnostics: [{ line: 0, message: `chart longer than ${LIMITS.maxChars} characters`, fatal: true }] }
  const diagnostics: Diagnostic[] = []
  const names = new Set<string>()
  const lengths = new Map<string, number>() // each block's length so far, for a copy: of it
  let block: { name: string; copy: string | null; body: boolean; lastBar: number; lastRowBar: number; alts: { line: number; value: number }[]; bars: { line: number; value: number } | null } | null = null
  const closeBlock = (): void => {
    if (!block) return
    const carried = block.copy ? lengths.get(block.copy) : undefined
    if (block.bars && block.bars.value < block.lastBar)
      diagnostics.push({ line: block.bars.line, message: `bars: ${block.bars.value} is shorter than the section (its last bar is ${block.lastBar})` })
    if (block.bars && carried !== undefined && block.bars.value < carried)
      diagnostics.push({ line: block.bars.line, message: `bars: ${block.bars.value} is shorter than the section it repeats (${carried} bars)` })
    const length = Math.max(block.bars?.value ?? 0, block.lastBar)
    for (const a of block.alts) if (a.value > length) diagnostics.push({ line: a.line, message: `alt bar ${a.value} is past the section’s end (bar ${length})` })
    lengths.set(block.name, Math.max(block.bars?.value ?? carried ?? 0, block.lastBar, carried ?? 0, 1))
  }
  const lines = text.split(/\r?\n/).map((raw, i): ChartLine => {
    const t = raw.trim()
    let parsed = parseLine(t, block !== null)
    const report = (message: string): void => void diagnostics.push({ line: i + 1, message })
    if (typeof parsed !== 'string') {
      if (parsed.kind === 'meta' && parsed.key === 'context' && parsed.value && !parseContext(parsed.value)) report('context: functional, modal or blues')
      if (parsed.kind === 'section') {
        if (names.has(parsed.name)) parsed = `section ${parsed.name} is already in the chart`
        else {
          closeBlock()
          names.add(parsed.name)
          block = { name: parsed.name, copy: null, body: false, lastBar: 0, lastRowBar: 0, alts: [], bars: null }
        }
      } else if (parsed.kind === 'sectionMeta' && block) {
        if (block.body) parsed = 'section fields go straight under section:, before its bars'
        else {
          const { field, value } = parsed
          if (field === 'context' && value && !parseContext(value)) report('context: functional, modal or blues')
          if (field === 'copy') {
            block.copy = value
            if (!names.has(value) || value === block.name) report(`copy: ${value} must name a section above it`)
          }
          if (field === 'bars') block.bars = { line: i + 1, value: Number(value) }
        }
      } else if (block && parsed.kind !== 'comment' && parsed.kind !== 'blank' && parsed.kind !== 'invalid') {
        block.body = true
        if (parsed.kind === 'row' || parsed.kind === 'altRow') {
          const alt = parsed.kind === 'altRow'
          if (block.copy) report('a section with copy: has no bars of its own')
          if (INT_RE.test(parsed.bar)) {
            const bar = Number(parsed.bar)
            if ((alt || block.alts.length) && bar < block.lastRowBar) report('rows and alt rows go in bar order')
            block.lastRowBar = Math.max(block.lastRowBar, bar)
            if (alt) {
              if (!block.copy) block.alts.push({ line: i + 1, value: bar })
            } else block.lastBar = Math.max(block.lastBar, bar)
          }
        }
      }
    }
    if (typeof parsed !== 'string') return parsed
    report(parsed)
    return { kind: 'invalid', text: t }
  })
  closeBlock()
  const recorded = lines.some((l) => l.kind === 'meta' && l.key === 'recording' && l.value)
  lines.forEach((l, i) => {
    if (!recorded && l.kind === 'meta' && l.key === 'youtube' && l.value) diagnostics.push({ line: i + 1, message: 'youtube: needs a recording: line' })
  })
  if (lines.at(-1)?.kind === 'blank') lines.pop() // trailing newline
  if (lines.filter((l) => l.kind === 'row' || l.kind === 'altRow').length > LIMITS.maxRows)
    diagnostics.push({ line: 0, message: `more than ${LIMITS.maxRows} rows`, fatal: true })
  return { value: { lines }, diagnostics }
}

export const isFatal = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some((d) => d.fatal)

/** whether the chart has alternate changes (alt rows) */
export const hasAlternates = (doc: ChartDoc): boolean => doc.lines.some((l) => l.kind === 'altRow')

/** the section each line belongs to: the name of the block it is in, null in the header */
export function lineSections(doc: ChartDoc): readonly (string | null)[] {
  let name: string | null = null
  return doc.lines.map((l) => (l.kind === 'section' ? (name = l.name) : name))
}

/** canonical text: chord rows column-aligned, everything else verbatim */
export function serializeChart(doc: ChartDoc): string {
  const rows = doc.lines.filter((l) => l.kind === 'row' || l.kind === 'altRow')
  const width = (f: (r: (typeof rows)[number]) => string): number => Math.max(0, ...rows.map((r) => f(r).length))
  const [wb, wc] = [width((r) => r.bar), width((r) => r.chord)]
  // scales line up where a comment or a function follows them; functions where a comment follows
  const wsc = Math.max(0, ...rows.filter((r) => r.comment !== undefined || r.function !== undefined).map((r) => r.scale.length))
  const wf = Math.max(0, ...rows.filter((r) => r.function !== undefined && r.comment !== undefined).map((r) => (r.function ?? '').length))
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'section':
        return `section: ${l.name}`
      case 'sectionMeta':
        return `${l.field}: ${l.value}`
      case 'row':
      case 'altRow': {
        const head = `${l.kind === 'altRow' ? 'alt ' : ''}${l.bar.padEnd(wb)} | `
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
      case 'ending':
        return `@ending ${l.n} ${l.from}${l.to !== l.from ? ` ${l.to}` : ''}`
      case 'mark':
        return `@${l.mark} ${l.bar}`
      case 'nav':
        return `@nav ${l.bar} ${l.text}`
      case 'key':
        return `@key ${l.bar} ${l.key}`
      case 'time':
        return `@time ${l.bar} ${l.time}`
      case 'context':
        return `@context ${l.bar} ${l.context}`
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
export const metaValue = (doc: ChartDoc, key: MetaKey, fallback = ''): string =>
  doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)

/** the chart's beats a bar, from its `time:` line (4 without one) */
export const chartBeats = (doc: ChartDoc): Beats => beatsPerBar(metaValue(doc, 'time')) ?? 4

/** the title, subtitle and key as written (what the editor's fields edit) */
export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string; key: string }> {
  return { title: metaValue(doc, 'title', 'Untitled'), subtitle: metaValue(doc, 'subtitle'), key: metaValue(doc, 'key') }
}

/** what the chart is (kind:): a tune without one */
export const chartKind = (doc: ChartDoc): ChartKind => asKind(metaValue(doc, 'kind')) ?? 'tune'

/** the tune's other titles (aka:), `;` between them since a title may hold a comma */
export const chartAka = (doc: ChartDoc): readonly string[] =>
  metaValue(doc, 'aka').split(';').map((s) => s.trim()).filter(Boolean)

export type Recording = Readonly<{ artist: string; album: string; label: string; year: string }>

/** the tune's notable recording (recording:, `;` between its fields since an album may hold a comma), null without a readable one */
export function chartRecording(doc: ChartDoc): Recording | null {
  const value = metaValue(doc, 'recording')
  if (!value || recordingProblem(value)) return null
  const [artist = '', album = '', label = '', year = ''] = recordingFields(value)
  return { artist, album, label, year }
}

/** the tune's YouTube video (youtube:), and whether it plays embedded; null without a readable one */
export function chartYoutube(doc: ChartDoc): Readonly<{ id: string; embeddable: boolean }> | null {
  const m = YOUTUBE.exec(metaValue(doc, 'youtube'))
  return m ? { id: m[1] as string, embeddable: !m[2] } : null
}

/** the time and the tune's details as written (what the editor's Details fields edit) */
export function chartDetails(doc: ChartDoc): Readonly<{ time: string; composer: string; style: string; form: string }> {
  return { time: metaValue(doc, 'time'), composer: metaValue(doc, 'composer'), style: metaValue(doc, 'style'), form: metaValue(doc, 'form') }
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

/** what a chart is called: its title, a version's label after it, "Summertime (Jazz Mind Accelerator)" (#411) */
export function chartName(doc: ChartDoc): string {
  const title = metaValue(doc, 'title', 'Untitled')
  const version = metaValue(doc, 'version')
  return version ? `${title} (${version})` : title
}

/**
 * an expanded row, the line it came from (a copy: repeat points at its source row's line) and `at`, its bar counted
 * through its part (intro, form or coda) from 1: where the analysis stream places it
 */
export type LinedRow = Row & Readonly<{ line: number; at: number }>

/** chart rows in order with copy: applied, each with its source line index; at most maxExpandedRows (layout.ts) */
export function expandRowLines(doc: ChartDoc): Parsed<readonly LinedRow[]> {
  const { value, diagnostics } = sectionLayout(doc)
  return { value: value.rows, diagnostics }
}

/** chart rows in order with copy: applied; at most maxExpandedRows */
export function expandRows(doc: ChartDoc): Parsed<readonly Row[]> {
  const { value, diagnostics } = expandRowLines(doc)
  return { value: value.map(({ section, bar, chord, scale }) => ({ section, bar, chord, scale })), diagnostics }
}

/**
 * one row on its own: its scale, else the chord quality's default; null means "ask the user". The sheets read
 * resolveScales (resolve.ts), which also hears the analysis; this is for places with no document (a quality's usual).
 */
export function qualityScale(row: Row): string | null {
  return row.scale ? row.scale : defaultScaleOrNull(row.chord)
}
