import { type ChartDoc, type ChartLine, type MetaKey, parseChart, serializeChart } from './chart'
import { LIMITS } from './limits'
import { defaultScaleOrNull } from './qualities'
import { rootName } from './pitch'
import { parseScale, sameScale, SCALES } from './scales'

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
  const follows = line.scale !== '' && next !== null && sameScale(line.scale, defaultScaleOrNull(line.chord))
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
