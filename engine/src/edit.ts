import { beatsPerBar, type ChartDoc, chartBeats, type ChartLine, formPart, type FormPart, isSectionName, lineSections, type MetaKey, parseChart, SECTION_FIELDS, type SectionField, serializeChart } from './chart'
import { type BarSection, type BarView, barView, type ChartBar } from './bars'
import { chordsAfterTyping, posOfLine } from './barGrid'
import { sectionLayout, statedKeyAt } from './layout'
import { LIMITS } from './limits'
import { defaultScaleOrNull } from './qualities'
import { rootName } from './pitch'
import { parseScale, samePitchScale, SCALES } from './scales'

export type RowLine = Extract<ChartLine, { kind: 'row' }>
export type RowField = 'bar' | 'chord' | 'scale' | 'function'

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

/** set an @key line's key, or a section's key: field's (a no-op if line i is neither) */
export function setKeyLine(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind === 'key') return { lines: replaceAt(doc.lines, i, { ...line, key }) }
  if (line?.kind === 'sectionMeta' && line.field === 'key') return { lines: replaceAt(doc.lines, i, { ...line, value: key }) }
  return doc
}

/**
 * a key stated at the row at line i: its section's key: when the row is on bar 1, else an @key line just above it (a
 * no-op for a non-row, a row outside a section, or a bar like "1a")
 */
export function insertKeyBefore(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  const section = lineSections(doc)[i]
  if (line?.kind !== 'row' || !section || !/^\d{1,6}$/.test(line.bar)) return doc
  if (Number(line.bar) === 1) return setSectionField(doc, section, 'key', key)
  return { lines: [...doc.lines.slice(0, i), { kind: 'key', bar: Number(line.bar), key }, ...doc.lines.slice(i)] }
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

/** each written scale in one written form; an empty cell stays empty (it plays the analysis, a written one pins) */
function withCanonicalScales(doc: ChartDoc): ChartDoc {
  return { lines: doc.lines.map((l) => (l.kind === 'row' && l.scale ? { ...l, scale: canonicalScale(l.scale) } : l)) }
}

/** two chart texts that say the same thing: the same lines, ignoring spacing and how a written scale is named */
export const sameChart = (a: string, b: string): boolean =>
  a === b || serializeChart(withCanonicalScales(parseChart(a).value)) === serializeChart(withCanonicalScales(parseChart(b).value))

/** insert a row after line index i (-1 = at the top), with the bar of the row above; in the header, under a new section A */
export function insertRowAfter(doc: ChartDoc, i: number): ChartDoc {
  const above = doc.lines
    .slice(0, i + 1)
    .reverse()
    .find((l): l is RowLine => l.kind === 'row')
  const row: RowLine = { kind: 'row', bar: above?.bar ?? '1', chord: '', scale: '' }
  const inSection = i >= 0 && lineSections(doc)[i] !== null
  const lines: ChartLine[] = inSection ? [row] : [{ kind: 'section', name: 'A' }, row]
  return { lines: [...doc.lines.slice(0, i + 1), ...lines, ...doc.lines.slice(i + 1)] }
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

/** remove a header line (every copy of it): a chart without one comes back as it was */
export function clearMeta(doc: ChartDoc, key: MetaKey): ChartDoc {
  const lines = doc.lines.filter((l) => !(l.kind === 'meta' && l.key === key))
  return lines.length === doc.lines.length ? doc : { lines }
}


/*
 * Bar operations for the bar editor (docs/superpowers/proposals/editor-ux/README.md §3). A bar is addressed as
 * barView gives it: a section and the bar's number in it, from 1. They edit written sections only (a copy: repeat
 * changes through the section it repeats); anything they can't do cleanly gives back the same doc. A section keeps
 * its length with bars: only where that differs from its last written bar.
 */

const chordsError = (chords: readonly string[]): boolean => chords.some((c) => !c || cellError(c) !== null)
const sectionError = (name: string): boolean => !isSectionName(name) || cellError(name) !== null
/** the written (not repeated) section and its bar, from barView */
function writtenBar(view: BarView, section: string, bar: number): Readonly<{ section: BarSection; bar: ChartBar }> | null {
  const s = view.sections.find((x) => x.name === section)
  const b = s?.bars.find((x) => x.bar === bar)
  return s && !s.copy && b ? { section: s, bar: b } : null
}
const WHOLE = /^[+-]?\d{1,6}$/

/** a section's block: its section: line and the index just past its last line (blank lines before the next section: excluded) */
function blockRange(doc: ChartDoc, name: string): Readonly<{ start: number; end: number }> | null {
  const start = doc.lines.findIndex((l) => l.kind === 'section' && l.name === name)
  if (start < 0) return null
  const next = doc.lines.findIndex((l, i) => i > start && l.kind === 'section')
  let end = next < 0 ? doc.lines.length : next
  while (end > start + 1 && doc.lines[end - 1]?.kind === 'blank') end--
  return { start, end }
}

const fieldIndex = (doc: ChartDoc, name: string, field: SectionField): number => {
  const r = blockRange(doc, name)
  return r ? doc.lines.findIndex((l, i) => i > r.start && i < r.end && l.kind === 'sectionMeta' && l.field === field) : -1
}

/** set a section field (null removes it); a new one goes in its place among the block's fields */
function setSectionField(doc: ChartDoc, name: string, field: SectionField, value: string | null): ChartDoc {
  const r = blockRange(doc, name)
  if (!r) return doc
  const i = fieldIndex(doc, name, field)
  if (value === null) return i < 0 ? doc : removeLine(doc, i)
  const line: ChartLine = { kind: 'sectionMeta', field, value }
  if (i >= 0) return { lines: replaceAt(doc.lines, i, line) }
  const rank = SECTION_FIELDS.indexOf(field)
  let at = r.start + 1
  while (at < r.end) {
    const l = doc.lines[at]
    if (l?.kind !== 'sectionMeta' || SECTION_FIELDS.indexOf(l.field) > rank) break
    at++
  }
  return { lines: [...doc.lines.slice(0, at), line, ...doc.lines.slice(at)] }
}

/** keep a section `length` bars long, writing bars: only where that differs from the length it would have without one */
function tidyBars(doc: ChartDoc, name: string, length: number): ChartDoc {
  const bare = setSectionField(doc, name, 'bars', null)
  const natural = sectionLayout(bare).value.lengths.get(name) ?? 0
  return length === natural ? bare : setSectionField(bare, name, 'bars', String(length))
}

/** the section and every copy: that repeats it (directly or through another copy) */
function withCopies(doc: ChartDoc, name: string): ReadonlySet<string> {
  const names = new Set([name])
  for (const s of sectionLayout(doc).value.sections) if (s.copyOf && names.has(s.copyOf)) names.add(s.name)
  return names
}

/** bar `at` of `section` gained (+1) or lost (−1): its rows, and its and its copies' directives and bars:, move along */
function shiftBars(doc: ChartDoc, view: BarView, section: string, at: number, delta: 1 | -1): ChartLine[] {
  const sections = lineSections(doc)
  const moved = withCopies(doc, section)
  const map = (n: number): number | null => (n < at ? n : n === at && delta < 0 ? null : n + delta)
  const bars = new Map(view.sections.map((s) => [s.name, s.bars] as const))
  return doc.lines.flatMap((l, i): ChartLine[] => {
    const s = sections[i]
    if (!s || !moved.has(s)) return [l]
    switch (l.kind) {
      case 'row': {
        if (s !== section || !WHOLE.test(l.bar)) return [l]
        const n = map(Number(l.bar))
        return n === null ? [] : n === Number(l.bar) ? [l] : [{ ...l, bar: String(n) }]
      }
      case 'mark':
      case 'nav': {
        const n = map(l.bar)
        return n === null ? [] : [{ ...l, bar: n }]
      }
      case 'key':
      case 'time':
      case 'context': {
        const n = map(l.bar)
        if (n !== null) return [{ ...l, bar: n }]
        // on a deleted bar: it starts on the bar after (now numbered as this one), if that bar has none of its own
        const next = bars.get(s)?.find((b) => b.bar === l.bar + 1)
        return next && next[l.kind] === null ? [l] : []
      }
      case 'ending': {
        if (delta < 0 && l.from === at && l.to === at) return []
        const from = delta > 0 ? (l.from >= at ? l.from + 1 : l.from) : l.from > at ? l.from - 1 : l.from
        const to = delta > 0 ? (l.to >= at ? l.to + 1 : l.to) : l.to >= at ? l.to - 1 : l.to
        return [{ ...l, from, to }]
      }
      case 'sectionMeta':
        return l.field === 'bars' ? [{ ...l, value: String(Number(l.value) + delta) }] : [l]
      default:
        return [l]
    }
  })
}

const rowsFor = (bar: number, chords: readonly string[]): RowLine[] => chords.map((chord) => ({ kind: 'row', bar: String(bar), chord, scale: '' }))

/** where a bar's new rows go: before the block's first row on a later bar, else after its last row (or its fields) */
function rowSlot(doc: ChartDoc, section: string, bar: number): number {
  const r = blockRange(doc, section)
  if (!r) return doc.lines.length
  const inBlock = (i: number): boolean => i > r.start && i < r.end
  const later = doc.lines.findIndex((l, i) => inBlock(i) && l.kind === 'row' && WHOLE.test(l.bar) && Number(l.bar) > bar)
  if (later >= 0) return later
  const lastRow = doc.lines.findLastIndex((l, i) => inBlock(i) && l.kind === 'row')
  if (lastRow >= 0) return lastRow + 1
  const lastField = doc.lines.findLastIndex((l, i) => inBlock(i) && l.kind === 'sectionMeta')
  return (lastField >= 0 ? lastField : r.start) + 1
}

/**
 * a new bar in a section, numbered `bar` (the bar there moves up one; the bar after the section's last appends),
 * holding `chords`, or held (the chord before goes on) with none. Later bars of the section move up, with its @key,
 * @context, @ending, @segno/@coda/@nav, and those of its copies; the section is a bar longer. A section can't start
 * on a held bar, so an empty bar can't go first.
 */
export function insertBar(doc: ChartDoc, section: string, bar: number, chords: readonly string[] = []): ChartDoc {
  const view = barView(doc)
  const s = view.sections.find((x) => x.name === section)
  const length = s?.bars.length ?? 0
  if (!s || s.copy || bar < 1 || bar > length + 1 || chordsError(chords) || (bar === 1 && !chords.length)) return doc
  const shifted: ChartDoc = { lines: shiftBars(doc, view, section, bar, 1) }
  const at = rowSlot(shifted, section, bar)
  return tidyBars({ lines: [...shifted.lines.slice(0, at), ...rowsFor(bar, chords), ...shifted.lines.slice(at)] }, section, length + 1)
}

/**
 * remove a bar with its chords and marks; later bars of the section move back (see insertBar). A key or context
 * change on it moves to the bar after; an ending shrinks. The first bar of a section can't go if a held bar would
 * then start it. A section's only bar takes the section with it, unless a copy: repeats it.
 */
export function deleteBar(doc: ChartDoc, section: string, bar: number): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  if (!found) return doc
  const bars = found.section.bars
  if (bar === 1 && bars[1]?.kind === 'held') return doc
  if (bars.length === 1) {
    if (view.sections.some((s) => s.copy?.of === section)) return doc
    const r = blockRange(doc, section)
    if (!r) return doc
    let start = r.start
    while (start > 0 && doc.lines[start - 1]?.kind === 'blank') start--
    // a comment in it (often about the next section) stays
    return { lines: doc.lines.filter((l, i) => i < start || i >= r.end || l.kind === 'comment') }
  }
  return tidyBars({ lines: shiftBars(doc, view, section, bar, -1) }, section, bars.length - 1)
}

/**
 * set a bar's chords: each takes the place of the one written there before, its scale following as setRowChord's
 * does; more chords add rows, fewer remove them. No chords leaves the bar held, but not a section's first bar. The
 * section keeps its length.
 */
export function setBarChords(doc: ChartDoc, section: string, bar: number, chords: readonly string[]): ChartDoc {
  const found = writtenBar(barView(doc), section, bar)
  if (!found || chordsError(chords) || (!chords.length && bar === 1)) return doc
  const old = found.bar.chords.map((c) => c.line)
  if (old.length === chords.length && old.every((line, k) => (doc.lines[line] as RowLine).chord === chords[k])) return doc
  let next: ChartDoc = doc
  old.slice(0, chords.length).forEach((line, k) => {
    const chord = chords[k] ?? ''
    if ((next.lines[line] as RowLine).chord !== chord) next = setRowChord(next, line, chord)
  })
  const extra = rowsFor(bar, chords.slice(old.length))
  const length = found.section.bars.length
  if (!old.length) {
    const at = rowSlot(next, section, bar)
    return tidyBars({ lines: [...next.lines.slice(0, at), ...extra, ...next.lines.slice(at)] }, section, length)
  }
  const removed = new Set(old.slice(chords.length))
  return tidyBars({ lines: next.lines.flatMap((l, i) => (removed.has(i) ? [] : i === old.at(-1) ? [l, ...extra] : [l])) }, section, length)
}

/**
 * the chord written on line i, replaced by `text` (Changes sheet editing): as typing it into the grid there, so
 * blank takes it out (not a section's first chord) and % is the bar before; the same doc when the chart can't take it
 */
export function setLineChord(doc: ChartDoc, i: number, text: string): ChartDoc {
  const view = barView(doc)
  const pos = posOfLine(view, i)
  return pos ? setBarChords(doc, pos.section, pos.bar, chordsAfterTyping(view, pos, text, false)) : doc
}

/** a held bar at `bar` (see insertBar): at the section's end too, where bars: then counts it */
export function insertHeldBar(doc: ChartDoc, section: string, bar: number): ChartDoc {
  return insertBar(doc, section, bar)
}

/**
 * new bars in a section from `bar` on, in order (as parseBarLine reads them; an empty bar is held), moving every later
 * bar along as insertBar does. All or nothing: the same doc if any bar would be refused.
 */
export function insertBars(doc: ChartDoc, section: string, bar: number, bars: readonly (readonly string[])[]): ChartDoc {
  let next = doc
  for (const [k, chords] of bars.entries()) {
    const step = insertBar(next, section, bar + k, chords)
    if (step === next) return doc
    next = step
  }
  return next
}

/** rename a section on its section: line and every copy: of it; not to a name in use, or into or out of the form */
export function renameSection(doc: ChartDoc, from: string, to: string): ChartDoc {
  const names = new Set(barView(doc).sections.map((s) => s.name))
  const outside = fieldIndex(doc, from, 'outside') >= 0
  if (!names.has(from) || names.has(to) || sectionError(to) || (!outside && formPart(to) !== formPart(from))) return doc
  return {
    lines: doc.lines.map((l): ChartLine =>
      l.kind === 'section' && l.name === from ? { ...l, name: to } : l.kind === 'sectionMeta' && l.field === 'copy' && l.value === from ? { ...l, value: to } : l,
    ),
  }
}

/** where a new section of this part goes: after the part's last block, else before the first block of a later part */
function partEnd(doc: ChartDoc, view: BarView, part: FormPart): number {
  const last = view.sections.filter((s) => s.part === part).at(-1)
  const r = last ? blockRange(doc, last.name) : null
  if (r) return r.end
  const later = view.sections.find((s) => (part === 'before' ? true : part === 'form' ? s.part === 'after' : false))
  const at = later ? doc.lines.findIndex((l) => l.kind === 'section' && l.name === later.name) : -1
  if (at < 0) return doc.lines.length
  let start = at
  while (start > 0 && doc.lines[start - 1]?.kind === 'blank') start--
  return start
}

/** a block inserted at a line, with a blank line above it when it doesn't open the chart's body */
function insertBlock(doc: ChartDoc, at: number, block: readonly ChartLine[]): ChartDoc {
  const lines: ChartLine[] = at > 0 ? [{ kind: 'blank' }, ...block] : [...block]
  return { lines: [...doc.lines.slice(0, at), ...lines, ...doc.lines.slice(at)] }
}

/** a new section of one bar holding `chords`, after the last section of its part (the form, an intro or a coda) */
export function addSection(doc: ChartDoc, name: string, chords: readonly string[]): ChartDoc {
  const view = barView(doc)
  if (view.sections.some((s) => s.name === name) || sectionError(name) || !chords.length || chordsError(chords)) return doc
  return insertBlock(doc, partEnd(doc, view, formPart(name)), [{ kind: 'section', name }, ...rowsFor(1, chords)])
}

/** repeat a section as a new one (`section: DST` and `copy: SRC`) after the last section of its part */
export function repeatSection(doc: ChartDoc, src: string, dst: string): ChartDoc {
  const view = barView(doc)
  const from = view.sections.find((s) => s.name === src)
  const outside = fieldIndex(doc, src, 'outside') >= 0 && (doc.lines[fieldIndex(doc, src, 'outside')] as Extract<ChartLine, { kind: 'sectionMeta' }>).value === 'yes'
  if (!from || view.sections.some((s) => s.name === dst) || sectionError(dst) || (!outside && formPart(dst) !== from.part)) return doc
  const block: ChartLine[] = [
    { kind: 'section', name: dst },
    ...(outside ? [{ kind: 'sectionMeta', field: 'outside', value: 'yes' } as ChartLine] : []),
    { kind: 'sectionMeta', field: 'copy', value: src },
  ]
  return insertBlock(doc, partEnd(doc, view, from.part), block)
}

/** a repeat written out: its copy: becomes rows of its own, in its place, with what it carried (key, time, context, bars, key and metre changes) */
export function writeOutCopy(doc: ChartDoc, section: string): ChartDoc {
  const layout = sectionLayout(doc).value
  const s = layout.sections.find((x) => x.name === section)
  const i = fieldIndex(doc, section, 'copy')
  if (!s || i < 0 || !s.rows.length) return doc
  const rows = s.rows.map(({ line: _l, at: _a, section: _s, ...r }): RowLine => ({ kind: 'row', ...r }))
  // the key, metre and context changes it carried: the layout gives them to it, but they're written in its source's block
  const sections = lineSections(doc)
  const carried = layout.directives
    .filter((d) => d.section === section && (d.kind === 'key' || d.kind === 'time' || d.kind === 'context') && sections[d.line] !== section)
    .map(({ section: _s, line: _l, ...d }) => d as ChartLine)
  let next: ChartDoc = { lines: [...doc.lines.slice(0, i), ...rows, ...carried, ...doc.lines.slice(i + 1)] }
  if (s.key && fieldIndex(next, section, 'key') < 0) next = setSectionField(next, section, 'key', s.key)
  if (s.beats !== chartBeats(doc) && fieldIndex(next, section, 'time') < 0) next = setSectionField(next, section, 'time', `${s.beats}/4`)
  if (s.context && fieldIndex(next, section, 'context') < 0) next = setSectionField(next, section, 'context', s.context)
  return tidyBars(next, section, s.length)
}

/**
 * a new section, `name`, from a bar to the end of its section, with the rows and marks on those bars renumbered from
 * 1, the key stated there and the section's metre. Not at the section's first bar or on a held one, across an ending,
 * into another part, or in a section a copy: repeats.
 */
export function splitSection(doc: ChartDoc, section: string, bar: number, name: string): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  if (!found || found.bar.kind !== 'chords' || bar === 1) return doc
  const sections = lineSections(doc)
  const mine = (i: number): boolean => sections[i] === section
  const outside = doc.lines.some((l, i) => mine(i) && l.kind === 'sectionMeta' && l.field === 'outside' && l.value === 'yes')
  if (view.sections.some((s) => s.name === name) || sectionError(name) || (!outside && formPart(name) !== found.section.part)) return doc
  if (view.sections.some((s) => s.copy?.of === section)) return doc
  if (doc.lines.some((l, i) => mine(i) && l.kind === 'ending' && l.from < bar && l.to >= bar)) return doc
  const r = blockRange(doc, section)
  if (!r) return doc
  const moves = (l: ChartLine, i: number): boolean =>
    mine(i) &&
    ((l.kind === 'row' && WHOLE.test(l.bar) && Number(l.bar) >= bar) ||
      (l.kind === 'ending' && l.from >= bar) ||
      ((l.kind === 'key' || l.kind === 'time' || l.kind === 'context' || l.kind === 'mark' || l.kind === 'nav') && l.bar >= bar))
  const renumber = (l: ChartLine): ChartLine => {
    if (l.kind === 'row') return { ...l, bar: String(Number(l.bar) - bar + 1) }
    if (l.kind === 'ending') return { ...l, from: l.from - bar + 1, to: l.to - bar + 1 }
    if (l.kind === 'key' || l.kind === 'time' || l.kind === 'context' || l.kind === 'mark' || l.kind === 'nav') return { ...l, bar: l.bar - bar + 1 }
    return l
  }
  const key = statedKeyAt(sectionLayout(doc).value, section, bar)
  // a key or metre change on the split bar is the new section's key: or time:
  const moved = doc.lines.flatMap((l, i) => (moves(l, i) ? [renumber(l)] : [])).filter((l) => !((l.kind === 'key' || l.kind === 'time') && l.bar === 1))
  const removedBefore = doc.lines.slice(0, r.end).filter((l, i) => moves(l, i)).length
  const kept = doc.lines.filter((l, i) => !moves(l, i))
  // the metre in force at the split, written where it isn't the song's or the section wrote its own
  const ownTime = doc.lines.some((l, i) => mine(i) && l.kind === 'sectionMeta' && l.field === 'time')
  const time: ChartLine | null = ownTime || found.bar.beats !== view.beats ? { kind: 'sectionMeta', field: 'time', value: `${found.bar.beats}/4` } : null
  // the context in force at the split: the last @context before it, else the section's context:
  const contextLine = doc.lines.findLast((l, i) => mine(i) && ((l.kind === 'context' && l.bar <= bar) || (l.kind === 'sectionMeta' && l.field === 'context')))
  const context = contextLine?.kind === 'context' ? contextLine.context : contextLine?.kind === 'sectionMeta' ? contextLine.value : null
  const block: ChartLine[] = [
    { kind: 'section', name },
    ...(key ? [{ kind: 'sectionMeta', field: 'key', value: key } as ChartLine] : []),
    ...(time ? [time] : []),
    ...(context ? [{ kind: 'sectionMeta', field: 'context', value: context } as ChartLine] : []),
    ...(outside ? [{ kind: 'sectionMeta', field: 'outside', value: 'yes' } as ChartLine] : []),
    ...moved,
  ]
  const length = found.section.bars.length
  const next = insertBlock({ lines: kept }, r.end - removedBefore, block)
  return tidyBars(tidyBars(next, section, bar - 1), name, length - bar + 1)
}

/**
 * put one bar of a section in a metre (2/4 to 6/4), the bars after it keeping theirs: its @time, and one on the bar
 * after to go back; a change the bar before already makes is dropped, and bar 1's is the section's time:. Not on a
 * copy's bar, or in the metre it is in.
 */
export function setBarMetre(doc: ChartDoc, section: string, bar: number, time: string): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  const beats = beatsPerBar(time)
  if (!found || beats === null || !time.trim() || found.bar.beats === beats) return doc
  const want = found.section.bars.map((b) => (b.bar === bar ? beats : b.beats))
  const sections = lineSections(doc)
  // its @time lines that still change the metre stay where they are; the rest go, and the new ones go at the block's end
  const changesAt = (n: number): boolean => n > 1 && want[n - 1] !== want[n - 2]
  const kept = doc.lines.filter((l, i) => !(sections[i] === section && l.kind === 'time' && (!changesAt(l.bar) || beatsPerBar(l.time) !== want[l.bar - 1])))
  const have = new Set(kept.flatMap((l, i) => (sections[i] === section && l.kind === 'time' ? [l.bar] : [])))
  let next: ChartDoc = { lines: kept }
  want.forEach((b, j) => {
    if (changesAt(j + 1) && !have.has(j + 1)) next = addDirective(next, section, { kind: 'time', bar: j + 1, time: `${b}/4` })
  })
  if (bar === 1) next = setSectionField(next, section, 'time', beats === view.beats ? null : `${beats}/4`)
  return next
}

/** a directive for a section goes at the end of its block */
function addDirective(doc: ChartDoc, section: string, line: ChartLine): ChartDoc {
  const at = blockRange(doc, section)?.end ?? doc.lines.length
  return { lines: [...doc.lines.slice(0, at), line, ...doc.lines.slice(at)] }
}

/** the index of the first line in a section's block that matches */
const lineIn = (doc: ChartDoc, section: string, match: (l: ChartLine) => boolean): number => {
  const sections = lineSections(doc)
  return doc.lines.findIndex((l, i) => sections[i] === section && match(l))
}

/** set ending n (1 or 2) of a section to bars from–to, or clear it with null; not off the section or over the other ending */
export function setEnding(doc: ChartDoc, section: string, n: 1 | 2, span: Readonly<{ from: number; to: number }> | null): ChartDoc {
  const i = lineIn(doc, section, (l) => l.kind === 'ending' && l.n === n)
  if (!span) return i >= 0 ? removeLine(doc, i) : doc
  const s = barView(doc).sections.find((x) => x.name === section)
  const inside = (b: number): boolean => s?.bars.some((x) => x.bar === b) ?? false
  const other = doc.lines[lineIn(doc, section, (l) => l.kind === 'ending' && l.n !== n)]
  const overlaps = other?.kind === 'ending' && other.from <= span.to && span.from <= other.to
  if (span.to < span.from || !inside(span.from) || !inside(span.to) || overlaps) return doc
  const ending: ChartLine = { kind: 'ending', n, from: span.from, to: span.to }
  return i >= 0 ? { lines: replaceAt(doc.lines, i, ending) } : addDirective(doc, section, ending)
}

/** put a segno or coda on a bar, or take it off */
export function setMark(doc: ChartDoc, section: string, bar: number, mark: 'segno' | 'coda', on: boolean): ChartDoc {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
  if (!found || found.marks.some((m) => m.mark === mark) === on) return doc
  if (on) return addDirective(doc, section, { kind: 'mark', mark, bar })
  const sections = lineSections(doc)
  return { lines: doc.lines.filter((l, i) => !(sections[i] === section && l.kind === 'mark' && l.mark === mark && l.bar === bar)) }
}

/** set a bar's nav text (D.S. al Coda, Fine, …), replacing what it had; '' takes it off */
export function setNav(doc: ChartDoc, section: string, bar: number, text: string): ChartDoc {
  const found = barView(doc).sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
  if (!found || (text && cellError(text, LIMITS.maxMeta, true))) return doc
  const sections = lineSections(doc)
  const isNav = (l: ChartLine, i: number): boolean => sections[i] === section && l.kind === 'nav' && l.bar === bar
  const first = doc.lines.findIndex(isNav)
  const nav: ChartLine = { kind: 'nav', bar, text }
  const lines = doc.lines.flatMap((l, i): ChartLine[] => (!isNav(l, i) ? [l] : i === first && text ? [nav] : []))
  return first >= 0 || !text ? { lines } : addDirective(doc, section, nav)
}

/** ending n on a bar: off when the bar is in it, else grown onto the bar next to it, else just that bar */
export function toggleEnding(doc: ChartDoc, section: string, n: 1 | 2, bar: number): ChartDoc {
  const e = doc.lines[lineIn(doc, section, (l) => l.kind === 'ending' && l.n === n)]
  if (e?.kind !== 'ending') return setEnding(doc, section, n, { from: bar, to: bar })
  if (e.from <= bar && bar <= e.to) return setEnding(doc, section, n, null)
  if (bar === e.to + 1 || bar === e.from - 1) return setEnding(doc, section, n, { from: Math.min(e.from, bar), to: Math.max(e.to, bar) })
  return setEnding(doc, section, n, { from: bar, to: bar })
}
