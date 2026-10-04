import type { ChartDoc, ChartLine, MetaKey } from './chart'
import { LIMITS } from './limits'

export type RowLine = Extract<ChartLine, { kind: 'row' }>
export type RowField = 'section' | 'bar' | 'chord' | 'scale'

/**
 * why a grid cell value would not survive serialize -> parse as the same line, or null if fine
 * (see docs/design.md §4 "Cell validation")
 */
export function cellError(value: string, maxLength: number = LIMITS.maxCell): string | null {
  if (value.length > maxLength) return `longer than ${maxLength} characters`
  if (/[|\r\n]/.test(value)) return 'may not contain | or line breaks'
  if (value !== value.trim()) return 'may not start or end with spaces'
  const low = value.toLowerCase()
  if (value.startsWith('#') || value.startsWith('@') || low.startsWith('title:') || low.startsWith('subtitle:'))
    return 'may not start with #, @, title: or subtitle:'
  return null
}

const replaceAt = <T>(xs: readonly T[], i: number, x: T): T[] => [...xs.slice(0, i), x, ...xs.slice(i + 1)]

/** set one field of the row at line index i (a no-op if that line is not a row) */
export function setRowField(doc: ChartDoc, i: number, field: RowField, value: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row') return doc
  return { lines: replaceAt(doc.lines, i, { ...line, [field]: value }) }
}

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
  const at = key === 'subtitle' ? doc.lines.findIndex((l) => l.kind === 'meta' && l.key === 'title') + 1 : 0
  return { lines: [...doc.lines.slice(0, at), { kind: 'meta', key, value }, ...doc.lines.slice(at)] }
}
