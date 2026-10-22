import { chartMeta, LIMITS, parseChart, type SavedKind, type SavedMeta, savedMetaFrom } from '@chord-scale-maker/engine'
import { ref } from 'vue'
import { LEGACY_STARTER_CHART } from '~/utils/starterChart'

/**
 * My charts: charts saved in this browser's localStorage, with no account and nothing sent anywhere. An index of
 * small records (`csm-charts`) plus one key per chart's text (`csm-chart:<id>`), so listing never reads every
 * chart and saving one never rewrites the rest.
 *
 * - edited: your version of a library chart (`basedOn` its slug), at most one per slug
 * - copy: Save as a copy, of a library chart or of one of yours
 * - new: started blank, opened from a file, or saved from a share link
 */
export type { SavedKind, SavedMeta }
export type SavedChart = Readonly<{ meta: SavedMeta; text: string }>
export type SaveResult = Readonly<{ ok: true; meta: SavedMeta }> | Readonly<{ ok: false; reason: 'full' | 'tooLong' }>

export const MY_CHARTS_MAX = 200
const INDEX = 'csm-charts'
const textKey = (id: string): string => `csm-chart:${id}`

export const titleOf = (text: string): string => chartMeta(parseChart(text).value).title.trim() || 'Untitled'

export const newChartId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

function readIndex(): SavedMeta[] {
  try {
    const v: unknown = JSON.parse(readStored(INDEX) ?? '[]')
    return Array.isArray(v) ? v.map(savedMetaFrom).filter((m): m is SavedMeta => m !== null) : []
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

/** a saved chart's text alone, without reading the index (null for none) */
export const chartText = (id: string): string | null => readStored(textKey(id))

/** counts this tab's saves and deletes: a view of your charts reads it to follow them (the version picker, #411) */
export const savedRevision = ref(0)

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
  savedRevision.value++
  return { ok: true, meta }
}

/** what a chart's view keeps per chart, under `<prefix>:<key>` (practice adds `:<mode>`): one list for delete, the sweep and a backup (#466) */
export const PER_CHART_PREFIXES = ['csm-practice', 'csm-level', 'csm-pent-path', 'csm-pent-picks', 'csm-undo', 'csm-changes'] as const
/** the alternate set's picks and practice add `~alt` after the chart key (#215) */
const MINE_KEY = new RegExp(`^(?:${PER_CHART_PREFIXES.join('|')}):mine:([A-Za-z0-9_-]+)(?:~alt)?(?::[a-z]+)?$`)

/** the saved chart id a per-chart key belongs to, if it's one of yours */
const mineIdOf = (key: string): string | null => MINE_KEY.exec(key)?.[1] ?? null

/** remove a chart, with everything kept for it */
export function deleteChart(id: string): void {
  writeStored(INDEX, JSON.stringify(readIndex().filter((m) => m.id !== id)))
  removeStored(textKey(id))
  for (const key of storedKeys()) if (mineIdOf(key) === id) removeStored(key)
  savedRevision.value++
}

/** drop what charts deleted before #467 left behind; nothing when the index can't be read, so a broken one never costs your picks */
export function sweepOrphans(): void {
  let ids: Set<string>
  try {
    const v: unknown = JSON.parse(readStored(INDEX) ?? '[]')
    if (!Array.isArray(v)) return
    ids = new Set(v.map(savedMetaFrom).flatMap((m) => (m ? [m.id] : [])))
  } catch {
    return
  }
  for (const key of storedKeys()) {
    const id = mineIdOf(key)
    if (id !== null && !ids.has(id)) removeStored(key)
  }
}

/** the old single draft (the hidden New chart's), moved into My charts once; one still holding a starter is left behind */
export function migrateDraft(starter: string, now = Date.now(), legacyStarter = LEGACY_STARTER_CHART): void {
  const draft = readStored('csm-draft')
  if (draft === null) return
  const untouched = [starter, legacyStarter].some((s) => draft.trim() === s.trim())
  if (draft.trim() && !untouched && !saveChart({ id: newChartId(), text: draft, kind: 'new' }, now).ok) return // keep it to try again
  removeStored('csm-draft')
}

/** a library chart's practice picks and scale level, saved under its name (never `mine:<id>`): csm-practice:<name>:<mode>, csm-level:<name> */
const OLD_NAME_KEY = /^(?:csm-practice:(?!mine:)[a-z0-9]+(?:_[a-z0-9]+)+:[a-z]+|csm-level:(?!mine:)[a-z0-9]+(?:_[a-z0-9]+)+)$/

/**
 * Chart files were renamed from round_midnight.txt to round-midnight.txt (2026-10): move what this browser saved under
 * the old names. A key that can't be written stays where it was, to try again on the next visit.
 */
export function migrateChartNames(): void {
  for (const key of storedKeys()) {
    const value = OLD_NAME_KEY.test(key) ? readStored(key) : null
    if (value === null) continue
    const to = key.replaceAll('_', '-')
    if (readStored(to) === null && !tryWriteStored(to, value)) continue
    removeStored(key)
  }
  const index = readIndex()
  if (index.some((c) => c.basedOn?.includes('_')))
    tryWriteStored(INDEX, JSON.stringify(index.map((c) => (c.basedOn?.includes('_') ? { ...c, basedOn: c.basedOn.replaceAll('_', '-') } : c))))
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
