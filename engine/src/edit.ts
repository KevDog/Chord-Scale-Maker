import { type ChartDoc, type ChartLine, formPart, type FormPart, type MetaKey, parseChart, serializeChart } from './chart'
import { type BarSection, type BarView, barView, type ChartBar } from './bars'
import { LIMITS } from './limits'
import { defaultScaleOrNull } from './qualities'
import { rootName } from './pitch'
import { parseScale, samePitchScale, SCALES } from './scales'

export type RowLine = Extract<ChartLine, { kind: 'row' }>
export type RowField = 'section' | 'bar' | 'chord' | 'scale' | 'function'

/**
 * why a grid cell value would not survive serialize -> parse as the same line, or null if fine
 * (see docs/design.md §4 "Cell validation"); `meta`: a title or subtitle, where a " # " is just text
 */
export function cellError(value: string, maxLength: number = LIMITS.maxCell, meta = false): string | null {
  if (value.length > maxLength) return `longer than ${maxLength} characters`
  if (/[|\r\n]/.test(value)) return 'may not contain | or line breaks'
  if (value !== value.trim()) return 'may not start or end with spaces'
  if (!meta && /\s#(?=\s|$)/.test(value)) return 'may not contain a # after a space (that starts a comment)'
  const low = value.toLowerCase()
  if (value.startsWith('#') || value.startsWith('@') || low.startsWith('title:') || low.startsWith('subtitle:'))
    return 'may not start with #, @, title: or subtitle:'
  return null
}

const replaceAt = <T>(xs: readonly T[], i: number, x: T): T[] => [...xs.slice(0, i), x, ...xs.slice(i + 1)]

/** set one field of the row at line index i (a no-op if that line is not a row); an empty function removes it */
export function setRowField(doc: ChartDoc, i: number, field: RowField, value: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row') return doc
  if (field === 'function' && !value) {
    const { function: _, ...rest } = line
    return { lines: replaceAt(doc.lines, i, rest) }
  }
  return { lines: replaceAt(doc.lines, i, { ...line, [field]: value }) }
}

/** set an @key line's key (a no-op if line i isn't one) */
export function setKeyLine(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  return line?.kind === 'key' ? { lines: replaceAt(doc.lines, i, { ...line, key }) } : doc
}

/** an @key line just above the row at line i, from its section and bar (a no-op for a non-row or a bar like "1a") */
export function insertKeyBefore(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row' || !/^\d{1,6}$/.test(line.bar)) return doc
  return { lines: [...doc.lines.slice(0, i), { kind: 'key', section: line.section, bar: Number(line.bar), key }, ...doc.lines.slice(i)] }
}


/**
 * set a row's chord; a scale that was the old chord's default follows to the new chord's default (Cm7 → F7 takes
 * C Dorian to F Mixolydian), while a scale you chose yourself stays
 */
export function setRowChord(doc: ChartDoc, i: number, chord: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row') return doc
  const next = defaultScaleOrNull(chord)
  const follows = line.scale !== '' && next !== null && samePitchScale(line.scale, defaultScaleOrNull(line.chord)) // by pitch (R18)
  return { lines: replaceAt(doc.lines, i, { ...line, chord, scale: follows ? next : line.scale }) }
}

/** a scale's one written form ("D Half-Whole" → "D Half-Whole Diminished"), or the text as is if it can't be read */
function canonicalScale(text: string): string {
  try {
    const { root, key } = parseScale(text)
    return `${rootName(root)} ${SCALES[key][1]}`
  } catch {
    return text
  }
}

/** each row's scale as it plays, in one written form: an empty cell becomes the chord's default */
function withResolvedScales(doc: ChartDoc): ChartDoc {
  return { lines: doc.lines.map((l) => (l.kind === 'row' ? { ...l, scale: canonicalScale(l.scale || (defaultScaleOrNull(l.chord) ?? '')) } : l)) }
}

/** two chart texts that say the same thing: the same lines, ignoring spacing and whether a default scale is written */
export const sameChart = (a: string, b: string): boolean =>
  a === b || serializeChart(withResolvedScales(parseChart(a).value)) === serializeChart(withResolvedScales(parseChart(b).value))

/** insert a row after line index i (-1 = at the top), copying section and bar from the row above */
export function insertRowAfter(doc: ChartDoc, i: number): ChartDoc {
  const above = doc.lines
    .slice(0, i + 1)
    .reverse()
    .find((l): l is RowLine => l.kind === 'row')
  const row: RowLine = { kind: 'row', section: above?.section ?? 'A', bar: above?.bar ?? '1', chord: '', scale: '' }
  return { lines: [...doc.lines.slice(0, i + 1), row, ...doc.lines.slice(i + 1)] }
}

export function removeLine(doc: ChartDoc, i: number): ChartDoc {
  return { lines: doc.lines.filter((_, j) => j !== i) }
}

/** set title/subtitle: update the last such line (the one that wins), else add it at the top */
export function setMeta(doc: ChartDoc, key: MetaKey, value: string): ChartDoc {
  const i = doc.lines.findLastIndex((l) => l.kind === 'meta' && l.key === key)
  if (i >= 0) return { lines: replaceAt(doc.lines, i, { kind: 'meta', key, value }) }
  const at = key === 'title' ? 0 : doc.lines.findLastIndex((l) => l.kind === 'meta') + 1 // after the last meta line
  return { lines: [...doc.lines.slice(0, at), { kind: 'meta', key, value }, ...doc.lines.slice(at)] }
}

/*
 * Bar operations for the bar editor (docs/superpowers/proposals/editor-ux/README.md §3). A bar is addressed as
 * barView gives it: a section and the bar's number in the chart. They edit written sections only (a @copy repeat
 * changes through the section it repeats); anything they can't do cleanly gives back the same doc.
 */

const chordsError = (chords: readonly string[]): boolean => chords.some((c) => !c || cellError(c) !== null)
const sectionError = (name: string): boolean => !name || /\s/.test(name) || cellError(name) !== null
/** the written (not repeated) section and its bar, from barView */
function writtenBar(view: BarView, section: string, bar: number): Readonly<{ section: BarSection; bar: ChartBar }> | null {
  const s = view.sections.find((x) => x.name === section)
  const b = s?.bars.find((x) => x.bar === bar)
  return s && !s.copy && b ? { section: s, bar: b } : null
}
const WHOLE = /^[+-]?\d{1,6}$/
const isRowOf = (l: ChartLine, section: string): l is RowLine => l.kind === 'row' && l.section === section

/**
 * where every bar of the part goes when `section` gains (+1) or loses (−1) bar `at`: each repeat of the section
 * gains or loses it too, and every section after one of those moves along. A bar that's deleted maps to null.
 * Also each section's shift at its start, which moves a @copy's offset.
 */
function barShift(doc: ChartDoc, view: BarView, section: string, at: number, delta: 1 | -1) {
  const point = new Map<string, number>([[section, at]])
  const before = new Map<string, number>()
  const shift = new Map<FormPart, number>()
  for (const s of view.sections) {
    if (before.has(s.name)) continue
    const c = shift.get(s.part) ?? 0
    before.set(s.name, c)
    const copy = s.copy ? doc.lines[s.copy.line] : undefined
    const from = copy?.kind === 'copy' ? point.get(copy.src) : undefined
    if (from !== undefined && copy?.kind === 'copy') point.set(s.name, from + copy.offset)
    if (point.has(s.name)) shift.set(s.part, c + delta)
  }
  const map = (s: string, n: number): number | null => {
    const c = before.get(s)
    if (c === undefined) return n
    const q = point.get(s)
    if (q === undefined || n < q) return n + c
    if (n === q && delta < 0) return null
    return n + c + delta
  }
  return { map, point, before }
}

function shiftBars(doc: ChartDoc, view: BarView, section: string, at: number, delta: 1 | -1): ChartLine[] {
  const { map, point, before } = barShift(doc, view, section, at, delta)
  const bars = new Map(view.sections.map((s) => [s.name, s.bars] as const))
  /** a key or context on a deleted bar starts on the bar after it, if its section has one without its own */
  const follows = (l: Extract<ChartLine, { kind: 'key' | 'context' }>): boolean => {
    const next = bars.get(l.section)?.find((b) => b.bar === l.bar + 1)
    return next !== undefined && next[l.kind] === null
  }
  return doc.lines.flatMap((l): ChartLine[] => {
    switch (l.kind) {
      case 'row': {
        if (!WHOLE.test(l.bar)) return [l]
        const n = map(l.section, Number(l.bar))
        return n === null ? [] : n === Number(l.bar) ? [l] : [{ ...l, bar: String(n) }]
      }
      case 'mark':
      case 'nav': {
        const n = map(l.section, l.bar)
        return n === null ? [] : [{ ...l, bar: n }]
      }
      case 'key':
      case 'context': {
        const n = map(l.section, l.bar)
        if (n !== null) return [{ ...l, bar: n }]
        return follows(l) ? [{ ...l, bar: l.bar + (before.get(l.section) ?? 0) }] : []
      }
      case 'ending': {
        const q = point.get(l.section)
        const c = before.get(l.section) ?? 0
        if (q === undefined) return [{ ...l, from: map(l.section, l.from) ?? l.from, to: map(l.section, l.to) ?? l.to }]
        if (delta < 0 && l.from === q && l.to === q) return []
        const local = (n: number, first: boolean): number =>
          delta > 0 ? (n >= q ? n + 1 : n) : n > q || (n === q && !first) ? n - 1 : n
        return [{ ...l, from: local(l.from, true) + c, to: local(l.to, false) + c }]
      }
      case 'copy':
        return [{ ...l, offset: l.offset + (before.get(l.dst) ?? 0) - (before.get(l.src) ?? 0) }]
      default:
        return [l]
    }
  })
}

const rowsFor = (section: string, bar: number, chords: readonly string[]): RowLine[] =>
  chords.map((chord) => ({ kind: 'row', section, bar: String(bar), chord, scale: '' }))

/** where a bar's new rows go: before the section's first row on a later bar, else after its last row */
function rowSlot(lines: readonly ChartLine[], section: string, bar: number): number {
  const later = lines.findIndex((l) => isRowOf(l, section) && WHOLE.test(l.bar) && Number(l.bar) > bar)
  return later >= 0 ? later : lines.findLastIndex((l) => isRowOf(l, section)) + 1
}

/**
 * a new bar in a section, numbered `bar` (the bar there moves up one; the bar after the section's last appends),
 * holding `chords`, or held (the chord before goes on) with none. Every later bar of the part moves up: rows, @key,
 * @context, @ending, @segno/@coda/@nav and @copy offsets; a repeat of the section gains the bar too. A section can't
 * start on a held bar, so an empty bar can't go first.
 */
export function insertBar(doc: ChartDoc, section: string, bar: number, chords: readonly string[] = []): ChartDoc {
  const view = barView(doc)
  const s = view.sections.find((x) => x.name === section)
  const first = s?.bars[0]?.bar ?? 0
  const last = s?.bars.at(-1)?.bar ?? 0
  if (!s || s.copy || bar < first || bar > last + 1 || chordsError(chords) || (bar === first && !chords.length)) return doc
  const lines = shiftBars(doc, view, section, bar, 1)
  const at = rowSlot(lines, section, bar)
  return { lines: [...lines.slice(0, at), ...rowsFor(section, bar, chords), ...lines.slice(at)] }
}

/**
 * remove a bar with its chords and marks; every later bar of the part moves back (see insertBar), and a repeat of the
 * section loses the bar too. A key or context change on it moves to the bar after; an ending shrinks. The first bar
 * of a section can't go if a held bar would then start it.
 */
export function deleteBar(doc: ChartDoc, section: string, bar: number): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  if (!found) return doc
  const bars = found.section.bars
  if (bars[0]?.bar === bar && bars[1]?.kind === 'held') return doc
  return { lines: shiftBars(doc, view, section, bar, -1) }
}

/**
 * set a bar's chords: each takes the place of the one written there before, its scale following as setRowChord's
 * does; more chords add rows, fewer remove them. No chords leaves the bar held, but not a section's first bar.
 */
export function setBarChords(doc: ChartDoc, section: string, bar: number, chords: readonly string[]): ChartDoc {
  const found = writtenBar(barView(doc), section, bar)
  if (!found || chordsError(chords) || (!chords.length && found.section.bars[0]?.bar === bar)) return doc
  const old = found.bar.chords.map((c) => c.line)
  if (old.length === chords.length && old.every((line, k) => (doc.lines[line] as RowLine).chord === chords[k])) return doc
  let next: ChartDoc = doc
  old.slice(0, chords.length).forEach((line, k) => {
    const chord = chords[k] ?? ''
    if ((next.lines[line] as RowLine).chord !== chord) next = setRowChord(next, line, chord)
  })
  const extra = rowsFor(section, bar, chords.slice(old.length))
  if (!old.length) {
    const at = rowSlot(next.lines, section, bar)
    return { lines: [...next.lines.slice(0, at), ...extra, ...next.lines.slice(at)] }
  }
  const removed = new Set(old.slice(chords.length))
  return { lines: next.lines.flatMap((l, i) => (removed.has(i) ? [] : i === old.at(-1) ? [l, ...extra] : [l])) }
}

/**
 * new bars in a section from `bar` on, in order (as parseBarLine reads them; an empty bar is held), moving every later
 * bar along as insertBar does. All or nothing: the same doc if any bar would be refused.
 */
export function insertBars(doc: ChartDoc, section: string, bar: number, bars: readonly (readonly string[])[]): ChartDoc {
  if (!bars.length) return doc
  // a held bar goes in holding a stand-in chord, cleared after the rest: an empty bar at the very end of a part
  // wouldn't count, and the bars after it couldn't follow
  const HOLD = '%'
  let next = doc
  for (const [k, chords] of bars.entries()) {
    const step = insertBar(next, section, bar + k, chords.length ? chords : [HOLD])
    if (step === next) return doc
    next = step
  }
  for (const [k, chords] of bars.entries()) {
    if (chords.length) continue
    const step = setBarChords(next, section, bar + k, [])
    if (step === next) return doc
    next = step
  }
  return next
}

/** rename a section on its rows and every directive that names it; not to a name in use, or into or out of the form */
export function renameSection(doc: ChartDoc, from: string, to: string): ChartDoc {
  const names = new Set(barView(doc).sections.map((s) => s.name))
  if (!names.has(from) || names.has(to) || sectionError(to) || formPart(to) !== formPart(from)) return doc
  const name = (s: string): string => (s === from ? to : s)
  return {
    lines: doc.lines.map((l): ChartLine => {
      switch (l.kind) {
        case 'row':
        case 'ending':
        case 'mark':
        case 'nav':
        case 'key':
        case 'context':
          return l.section === from ? { ...l, section: to } : l
        case 'copy':
          return { ...l, src: name(l.src), dst: name(l.dst) }
        default:
          return l
      }
    }),
  }
}

/** where a new section of this part goes: the bar after the part's last, and the line after its last row or @copy */
function partEnd(doc: ChartDoc, view: BarView, part: FormPart): Readonly<{ bar: number; line: number }> {
  const sections = view.sections.filter((s) => s.part === part)
  const names = new Set(sections.map((s) => s.name))
  const bar = (sections.at(-1)?.bars.at(-1)?.bar ?? 0) + 1
  const own = doc.lines.findLastIndex((l) => (l.kind === 'row' && names.has(l.section)) || (l.kind === 'copy' && names.has(l.dst)))
  if (own >= 0) return { bar, line: own + 1 }
  // a part with no sections yet: an intro goes before the first row, the form before any coda, a coda last
  const partOf = (l: ChartLine): FormPart | null => (l.kind === 'copy' ? formPart(l.dst) : l.kind === 'row' ? formPart(l.section) : null)
  const next = doc.lines.findIndex((l) => partOf(l) !== null && (part === 'before' || (part === 'form' && partOf(l) === 'after')))
  return { bar, line: next >= 0 ? next : doc.lines.length }
}

/** a new section of one bar holding `chords`, after the last section of its part (the form, an intro or a coda) */
export function addSection(doc: ChartDoc, name: string, chords: readonly string[]): ChartDoc {
  const view = barView(doc)
  if (view.sections.some((s) => s.name === name) || sectionError(name) || !chords.length || chordsError(chords)) return doc
  const { bar, line } = partEnd(doc, view, formPart(name))
  return { lines: [...doc.lines.slice(0, line), ...rowsFor(name, bar, chords), ...doc.lines.slice(line)] }
}

/** repeat a section as a new one (`@copy SRC DST OFFSET`) after the last section of its part */
export function repeatSection(doc: ChartDoc, src: string, dst: string): ChartDoc {
  const view = barView(doc)
  const from = view.sections.find((s) => s.name === src)
  if (!from || view.sections.some((s) => s.name === dst) || sectionError(dst) || formPart(dst) !== from.part) return doc
  const { bar, line } = partEnd(doc, view, from.part)
  const copy: ChartLine = { kind: 'copy', src, dst, offset: bar - (from.bars[0]?.bar ?? 0) }
  return { lines: [...doc.lines.slice(0, line), copy, ...doc.lines.slice(line)] }
}

/** a directive for a section goes after the last line that names it (its rows, its @copy, its other directives) */
function addDirective(doc: ChartDoc, section: string, line: ChartLine): ChartDoc {
  const own = doc.lines.findLastIndex((l) => ('section' in l && l.section === section) || (l.kind === 'copy' && l.dst === section))
  const at = own >= 0 ? own + 1 : doc.lines.length
  return { lines: [...doc.lines.slice(0, at), line, ...doc.lines.slice(at)] }
}

/** set ending n (1 or 2) of a section to bars from–to, or clear it with null; not off the section or over the other ending */
export function setEnding(doc: ChartDoc, section: string, n: 1 | 2, span: Readonly<{ from: number; to: number }> | null): ChartDoc {
  const i = doc.lines.findIndex((l) => l.kind === 'ending' && l.section === section && l.n === n)
  if (!span) return i >= 0 ? removeLine(doc, i) : doc
  const s = barView(doc).sections.find((x) => x.name === section)
  const inside = (b: number): boolean => s?.bars.some((x) => x.bar === b) ?? false
  const other = doc.lines.find((l) => l.kind === 'ending' && l.section === section && l.n !== n)
  const overlaps = other?.kind === 'ending' && other.from <= span.to && span.from <= other.to
  if (span.to < span.from || !inside(span.from) || !inside(span.to) || overlaps) return doc
  const ending: ChartLine = { kind: 'ending', n, section, from: span.from, to: span.to }
  return i >= 0 ? { lines: replaceAt(doc.lines, i, ending) } : addDirective(doc, section, ending)
}

/** put a segno or coda on a bar, or take it off */
export function setMark(doc: ChartDoc, section: string, bar: number, mark: 'segno' | 'coda', on: boolean): ChartDoc {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
  if (!found || found.marks.some((m) => m.mark === mark) === on) return doc
  if (!on) return { lines: doc.lines.filter((l) => !(l.kind === 'mark' && l.mark === mark && l.section === section && l.bar === bar)) }
  return addDirective(doc, section, { kind: 'mark', mark, section, bar })
}

/** set a bar's nav text (D.S. al Coda, Fine, …), replacing what it had; '' takes it off */
export function setNav(doc: ChartDoc, section: string, bar: number, text: string): ChartDoc {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
  if (!found || (text && cellError(text, LIMITS.maxMeta, true))) return doc
  const isNav = (l: ChartLine): boolean => l.kind === 'nav' && l.section === section && l.bar === bar
  const first = doc.lines.findIndex(isNav)
  const nav: ChartLine = { kind: 'nav', section, bar, text }
  const lines = doc.lines.flatMap((l, i): ChartLine[] => (!isNav(l) ? [l] : i === first && text ? [nav] : []))
  return first >= 0 || !text ? { lines } : addDirective(doc, section, nav)
}
