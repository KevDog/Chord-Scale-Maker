import { chartMeta, LIMITS, parseChart } from '~~/engine'

/**
 * My charts: charts saved in this browser's localStorage, with no account and nothing sent anywhere. An index of
 * small records (`csm-charts`) plus one key per chart's text (`csm-chart:<id>`), so listing never reads every
 * chart and saving one never rewrites the rest.
 *
 * - edited: your version of a library chart (`basedOn` its slug), at most one per slug
 * - copy: Save as a copy, of a library chart or of one of yours
 * - new: started blank, opened from a file, or saved from a share link
 */
export type SavedKind = 'edited' | 'copy' | 'new'
export type SavedMeta = Readonly<{ id: string; title: string; kind: SavedKind; basedOn?: string; createdAt: number; updatedAt: number }>
export type SavedChart = Readonly<{ meta: SavedMeta; text: string }>
export type SaveResult = Readonly<{ ok: true; meta: SavedMeta }> | Readonly<{ ok: false; reason: 'full' | 'tooLong' }>

export const MY_CHARTS_MAX = 200
const INDEX = 'csm-charts'
const textKey = (id: string): string => `csm-chart:${id}`
const KINDS: readonly string[] = ['edited', 'copy', 'new']
const ID = /^[A-Za-z0-9_-]{6,40}$/

export const titleOf = (text: string): string => chartMeta(parseChart(text).value).title.trim() || 'Untitled'

export const newChartId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

/** a stored index entry, if it is one */
function metaFrom(v: unknown): SavedMeta | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !ID.test(o.id) || typeof o.kind !== 'string' || !KINDS.includes(o.kind)) return null
  if (typeof o.createdAt !== 'number' || typeof o.updatedAt !== 'number') return null
  return {
    id: o.id,
    title: typeof o.title === 'string' ? o.title.slice(0, LIMITS.maxMeta) : 'Untitled',
    kind: o.kind as SavedKind,
    ...(typeof o.basedOn === 'string' ? { basedOn: o.basedOn } : {}),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

function readIndex(): SavedMeta[] {
  try {
    const v: unknown = JSON.parse(readStored(INDEX) ?? '[]')
    return Array.isArray(v) ? v.map(metaFrom).filter((m): m is SavedMeta => m !== null) : []
  } catch {
    return []
  }
}

/** newest first */
export const listCharts = (): SavedMeta[] => readIndex().sort((a, b) => b.updatedAt - a.updatedAt)

export function loadChart(id: string): SavedChart | null {
  const meta = readIndex().find((m) => m.id === id)
  const text = meta ? readStored(textKey(id)) : null
  return meta && text !== null ? { meta, text } : null
}

/** your edited version of a library chart, if you've made one */
export const versionOf = (slug: string): SavedMeta | null => readIndex().find((m) => m.kind === 'edited' && m.basedOn === slug) ?? null

/**
 * save a chart: an existing id updates it (its kind and origin stay), a new one adds it. The text is written before
 * the index, so a failed write never leaves an entry without its chart.
 */
export function saveChart(input: Readonly<{ id: string; text: string; kind: SavedKind; basedOn?: string }>, now = Date.now()): SaveResult {
  if (input.text.length > LIMITS.maxChars) return { ok: false, reason: 'tooLong' }
  const index = readIndex()
  const old = index.find((m) => m.id === input.id)
  if (!old && index.length >= MY_CHARTS_MAX) return { ok: false, reason: 'full' }
  const meta: SavedMeta = old
    ? { ...old, title: titleOf(input.text), updatedAt: now }
    : { id: input.id, title: titleOf(input.text), kind: input.kind, ...(input.basedOn ? { basedOn: input.basedOn } : {}), createdAt: now, updatedAt: now }
  const next = old ? index.map((m) => (m.id === meta.id ? meta : m)) : [...index, meta]
  if (!tryWriteStored(textKey(meta.id), input.text) || !tryWriteStored(INDEX, JSON.stringify(next))) return { ok: false, reason: 'full' }
  return { ok: true, meta }
}

export function deleteChart(id: string): void {
  writeStored(INDEX, JSON.stringify(readIndex().filter((m) => m.id !== id)))
  removeStored(textKey(id))
}

/** the old single draft (the hidden New chart's), moved into My charts once */
export function migrateDraft(starter: string, now = Date.now()): void {
  const draft = readStored('csm-draft')
  if (draft === null) return
  if (draft.trim() && draft.trim() !== starter.trim() && !saveChart({ id: newChartId(), text: draft, kind: 'new' }, now).ok) return // keep it to try again
  removeStored('csm-draft')
}

/** a download's file name: the title, safe on every system */
export function filenameFor(title: string): string {
  const safe = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ._()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+/, '') // no hidden files, no leading ../
    .slice(0, 80)
    .trim()
  return `${safe || 'chart'}.txt`
}
