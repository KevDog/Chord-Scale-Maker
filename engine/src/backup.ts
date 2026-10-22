import { isChangesSet } from './alternates'
import { chartMeta, parseChart, serializeChart } from './chart'
import { chordPicksFrom } from './chordPicks'
import { setMeta } from './edit'
import { isScaleLevel } from './levels'
import { LIMITS } from './limits'
import { isPentatonicPathName } from './pentatonics'
import { practiceSelectionFrom } from './practice'

/**
 * Back up and restore (#466): everything this browser keeps (your charts with their state, library charts' state, the
 * view preferences) as one file, and the plan for merging one into a browser that has its own. The app hands in a
 * snapshot of its storage and gets back a list of writes and removes; nothing here touches storage itself.
 *
 * Storage layout (web/app/utils/myCharts.ts): an index `csm-charts` of SavedMeta, each chart's text at
 * `csm-chart:<id>`, its state at `<prefix>:mine:<id>` (practice adds `:<mode>`), a library chart's state at
 * `<prefix>:<slug>`. In a backup, state is keyed without its chart: `csm-practice:root`, `csm-level`.
 */

/**
 * My charts' index entries: edited (your version of a library chart, `basedOn` its slug, at most one per slug), copy
 * (Save as a copy) or new (started blank, opened from a file, or saved from a share link)
 */
export type SavedKind = 'edited' | 'copy' | 'new'
export type SavedMeta = Readonly<{ id: string; title: string; kind: SavedKind; basedOn?: string; createdAt: number; updatedAt: number }>
/** a chart's or library chart's state: stored values by name, without the chart part of the key */
export type BackupState = Readonly<Record<string, string>>
export type BackupChart = Readonly<{ meta: SavedMeta; text: string; state: BackupState }>
export type Backup = Readonly<{
  format: 'csm-backup'
  v: 1
  exportedAt: string
  version: string
  charts: readonly BackupChart[]
  library: Readonly<Record<string, BackupState>>
  preferences: BackupState
}>

export type ImportStatus = 'new' | 'identical' | 'conflict'
export type ChartChoice = 'both' | 'mine' | 'imported'
export type ChartItem = Readonly<{ status: ImportStatus; incoming: BackupChart; local?: BackupChart }>
export type LibraryItem = Readonly<{ slug: string; status: ImportStatus; incoming: BackupState; local: BackupState }>
/** apply: the default (only in a fresh browser) */
export type PreferencesItem = Readonly<{ status: ImportStatus | 'none'; incoming: BackupState; apply: boolean }>
export type ImportPlan = Readonly<{ charts: readonly ChartItem[]; library: readonly LibraryItem[]; preferences: PreferencesItem; local: Backup; incoming: Backup }>
/** a conflict's choice, keyed by the incoming chart's id or the slug; a missing one takes the default */
export type ImportChoices = Readonly<{ charts?: Readonly<Record<string, ChartChoice>>; library?: Readonly<Record<string, 'mine' | 'imported'>>; preferences?: boolean }>
/** what one item writes: removes first, then writes in order (a chart's text before the index, so a full store never leaves an entry without its chart) */
export type ImportStep = Readonly<{ kind: 'chart' | 'library' | 'preferences'; label: string; removes: readonly string[]; writes: readonly (readonly [string, string])[] }>

type Store = Readonly<Record<string, string>>

const INDEX = 'csm-charts'
const textKey = (id: string): string => `csm-chart:${id}`
const KINDS: readonly string[] = ['edited', 'copy', 'new']
const ID = /^[A-Za-z0-9_-]{6,40}$/
/** a library chart's file name (an old one may still hold `_`: it is renamed on the way in) */
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/
const MAX_CHARTS = 1_000
const MAX_PREFERENCE = 2_000
const IMPORTED = ' (imported)'

/** a stored index entry, if it is one */
export function savedMetaFrom(v: unknown): SavedMeta | null {
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

const json = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
const hasOwn = (v: unknown, k: string): v is Record<string, unknown> => !!v && typeof v === 'object' && Object.hasOwn(v, k)

/** each state name and how its stored value is checked: a value comes back as stored, or normalized, or null to drop */
const STATE: Readonly<Record<string, (raw: string) => string | null>> = {
  'csm-practice:root': (raw) => practice(raw),
  'csm-practice:from': (raw) => practice(raw),
  'csm-level': (raw) => (hasOwn(json(raw), 'level') && isScaleLevel((json(raw) as { level: unknown }).level) ? raw : null),
  'csm-pent-path': (raw) => (hasOwn(json(raw), 'path') && isPentatonicPathName((json(raw) as { path: unknown }).path) ? raw : null),
  'csm-pent-picks': (raw) => picks(raw),
  'csm-changes': (raw) => {
    const v = json(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    const o = v as { main?: unknown; shown?: unknown }
    return isChangesSet(o.main) && typeof o.shown === 'boolean' ? JSON.stringify({ main: o.main, shown: o.shown }) : null
  },
  // the alternate set's own picks and practice (#215), kept under the chart with `~alt` on the prefix
  'csm-pent-picks~alt': (raw) => picks(raw),
  'csm-practice~alt:root': (raw) => practice(raw),
  'csm-practice~alt:from': (raw) => practice(raw),
}
function picks(raw: string): string | null {
  const v = json(raw)
  return v && typeof v === 'object' ? JSON.stringify(chordPicksFrom(v)) : null
}
function practice(raw: string): string | null {
  const s = practiceSelectionFrom(json(raw))
  return s ? JSON.stringify(s) : null
}

/** the state prefixes a backup carries (undo history stays behind) */
const PREFIX = '(csm-practice|csm-level|csm-pent-path|csm-pent-picks|csm-changes)'
/** the alternate set's state sits under the chart key with `~alt` (`csm-pent-picks:<key>~alt`, `csm-practice:<key>~alt:root`); in a backup the suffix moves to the prefix (`csm-pent-picks~alt`) */
const MINE_STATE = new RegExp(`^${PREFIX}:mine:([A-Za-z0-9_-]+?)(~alt)?(?::(root|from))?$`)
const LIBRARY_STATE = new RegExp(`^${PREFIX}:(?!mine:)([a-z0-9-]+?)(~alt)?(?::(root|from))?$`)
const stateName = (prefix: string, alt: string | undefined, mode: string | undefined): string => `${prefix}${alt ?? ''}${mode ? `:${mode}` : ''}`
/** a state name's storage key for a chart part (`mine:<id>` or a slug) */
const stateKey = (name: string, part: string): string => {
  const [head = '', mode] = name.split(':')
  const [prefix, alt] = head.split('~')
  return `${prefix}:${part}${alt === undefined ? '' : '~alt'}${mode ? `:${mode}` : ''}`
}

/** a global view preference: `csm-<name>`, never your charts, per-chart state or a kept list */
const NOT_PREFERENCES: readonly string[] = [INDEX, 'csm-recent', 'csm-draft']
export const isPreferenceKey = (key: string): boolean => /^csm-[a-z0-9-]+$/.test(key) && !NOT_PREFERENCES.includes(key)

/** the state values that check out, and how many didn't */
function stateFrom(v: unknown): { state: BackupState; dropped: number } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { state: {}, dropped: 0 }
  const entries = Object.entries(v as Record<string, unknown>)
  const kept = entries.flatMap(([name, raw]): [string, string][] => {
    const check = Object.hasOwn(STATE, name) ? STATE[name] : undefined
    const value = check && typeof raw === 'string' && raw.length <= LIMITS.maxChars ? check(raw) : null
    return value === null ? [] : [[name, value]]
  })
  return { state: Object.fromEntries(kept), dropped: entries.length - kept.length }
}

/** everything kept in a browser's storage, as a backup */
export function backupFrom(store: Store, header: Readonly<{ exportedAt: string; version: string }>): Backup {
  const mine = new Map<string, Record<string, string>>()
  const library = new Map<string, Record<string, string>>()
  for (const [key, raw] of Object.entries(store)) {
    const own = MINE_STATE.exec(key)
    const m = own ?? LIBRARY_STATE.exec(key)
    if (!m) continue
    const [, prefix, part, alt, mode] = m as unknown as [string, string, string, string | undefined, string | undefined]
    const into = own ? mine : library
    into.set(part, { ...into.get(part), [stateName(prefix, alt, mode)]: raw })
  }
  const index = json(store[INDEX] ?? '[]')
  const metas = Array.isArray(index) ? index.map(savedMetaFrom).filter((m): m is SavedMeta => m !== null) : []
  const charts = metas.flatMap((meta): BackupChart[] => {
    const text = store[textKey(meta.id)]
    return text === undefined ? [] : [{ meta, text, state: stateFrom(mine.get(meta.id)).state }]
  })
  const lib = [...library].map(([slug, s]): [string, BackupState] => [slug, stateFrom(s).state]).filter(([, s]) => Object.keys(s).length > 0)
  const preferences = Object.fromEntries(Object.entries(store).filter(([k]) => isPreferenceKey(k)))
  return { format: 'csm-backup', v: 1, ...header, charts, library: Object.fromEntries(lib), preferences }
}

export const serializeBackup = (backup: Backup): string => `${JSON.stringify(backup, null, 1)}\n`

const pad = (n: number): string => String(n).padStart(2, '0')
/** the file a backup downloads as, dated in local time */
export const backupFileName = (d: Date): string => `chord-scale-maker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`

const renamed = (slug: string): string => slug.replaceAll('_', '-')

function chartFrom(v: unknown): { chart: BackupChart | null; dropped: number } {
  if (!v || typeof v !== 'object') return { chart: null, dropped: 1 }
  const o = v as Record<string, unknown>
  const meta = savedMetaFrom(o.meta)
  if (!meta || typeof o.text !== 'string' || o.text.length > LIMITS.maxChars) return { chart: null, dropped: 1 }
  const { state, dropped } = stateFrom(o.state)
  const basedOn = meta.basedOn !== undefined ? { basedOn: renamed(meta.basedOn) } : {}
  return { chart: { meta: { ...meta, ...basedOn }, text: o.text, state }, dropped }
}

/** one edited chart per library chart (the newest) and one chart per id (the first): the rest are dropped */
function distinct(charts: readonly BackupChart[]): BackupChart[] {
  const newest = new Map<string, BackupChart>()
  for (const c of charts)
    if (c.meta.kind === 'edited' && c.meta.basedOn !== undefined && (newest.get(c.meta.basedOn)?.meta.updatedAt ?? -Infinity) < c.meta.updatedAt)
      newest.set(c.meta.basedOn, c)
  const ids = new Set<string>()
  return charts.filter((c) => {
    if (c.meta.kind === 'edited' && c.meta.basedOn !== undefined && newest.get(c.meta.basedOn) !== c) return false
    if (ids.has(c.meta.id)) return false
    ids.add(c.meta.id)
    return true
  })
}

/** a backup file's contents, its bad entries dropped and counted; null for anything that isn't one. Never throws. */
export function parseBackup(text: string): Readonly<{ backup: Backup; dropped: number }> | null {
  const v = json(text)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (o.format !== 'csm-backup' || o.v !== 1) return null
  let dropped = 0
  const given = Array.isArray(o.charts) ? o.charts.slice(0, MAX_CHARTS) : []
  const read = given.flatMap((c): BackupChart[] => {
    const r = chartFrom(c)
    dropped += r.dropped
    return r.chart ? [r.chart] : []
  })
  const charts = distinct(read)
  dropped += read.length - charts.length
  const libraryIn = o.library && typeof o.library === 'object' && !Array.isArray(o.library) ? Object.entries(o.library as Record<string, unknown>) : []
  const library = libraryIn.flatMap(([slug, s]): [string, BackupState][] => {
    if (!SLUG.test(slug)) return (dropped++, [])
    const r = stateFrom(s)
    dropped += r.dropped
    return Object.keys(r.state).length ? [[renamed(slug), r.state]] : []
  })
  const prefsIn = o.preferences && typeof o.preferences === 'object' && !Array.isArray(o.preferences) ? Object.entries(o.preferences as Record<string, unknown>) : []
  const preferences = prefsIn.filter((e): e is [string, string] => isPreferenceKey(e[0]) && typeof e[1] === 'string' && e[1].length <= MAX_PREFERENCE)
  dropped += prefsIn.length - preferences.length
  const header = { exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt.slice(0, 40) : '', version: typeof o.version === 'string' ? o.version.slice(0, 40) : '' }
  return { backup: { format: 'csm-backup', v: 1, ...header, charts, library: Object.fromEntries(library), preferences: Object.fromEntries(preferences) }, dropped }
}

const sameState = (a: BackupState, b: BackupState): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => Object.hasOwn(b, k) && b[k] === v)

/**
 * whether a browser has never kept anything (no `csm-*` keys but the Interface level, which the app sets on arrival):
 * only then do a backup's preferences apply by default
 */
const isFresh = (store: Store): boolean => !Object.keys(store).some((k) => k.startsWith('csm-') && k !== 'csm-interface')

/**
 * each item in a backup against what this browser has: new, identical (skipped) or a conflict. An edited chart meets
 * yours of the same library chart (there is one per slug), any other chart the one with its id.
 */
export function planImport(store: Store, incoming: Backup): ImportPlan {
  const local = backupFrom(store, { exportedAt: '', version: '' })
  const charts = incoming.charts.map((c): ChartItem => {
    const edited = c.meta.kind === 'edited' ? local.charts.find((l) => l.meta.kind === 'edited' && l.meta.basedOn === c.meta.basedOn) : undefined
    if (edited) return { status: edited.text === c.text ? 'identical' : 'conflict', incoming: c, local: edited }
    const same = local.charts.find((l) => l.meta.id === c.meta.id)
    if (!same) return { status: 'new', incoming: c }
    return { status: same.text === c.text && sameState(same.state, c.state) ? 'identical' : 'conflict', incoming: c, local: same }
  })
  const library = Object.entries(incoming.library).map(([slug, s]): LibraryItem => {
    const mine = Object.hasOwn(local.library, slug) ? local.library[slug]! : {}
    const status = !Object.keys(mine).length ? 'new' : sameState(mine, s) ? 'identical' : 'conflict'
    return { slug, status, incoming: s, local: mine }
  })
  const theirs = incoming.preferences
  const prefStatus = !Object.keys(theirs).length
    ? 'none'
    : !Object.keys(local.preferences).length
      ? 'new'
      : Object.entries(theirs).every(([k, v]) => local.preferences[k] === v)
        ? 'identical'
        : 'conflict'
  return { charts, library, preferences: { status: prefStatus, incoming: theirs, apply: prefStatus !== 'none' && prefStatus !== 'identical' && isFresh(store) }, local, incoming }
}

const stateWrites = (state: BackupState, part: string): [string, string][] => Object.entries(state).map(([name, v]) => [stateKey(name, part), v])
const stateRemoves = (state: BackupState, part: string): string[] => Object.keys(state).map((name) => stateKey(name, part))

/** the title with " (imported)", in the text and the index */
function markImported(c: BackupChart): BackupChart {
  const doc = parseChart(c.text).value
  const title = `${chartMeta(doc).title.trim() || 'Untitled'}${IMPORTED}`.slice(0, LIMITS.maxMeta)
  return { ...c, meta: { ...c.meta, title }, text: serializeChart(setMeta(doc, 'title', title)) }
}

/**
 * the writes that carry out a plan with these choices, one step per item, in plan order. Keep both (a chart's
 * default) imports it under a new id with "(imported)" on its title, an edited chart as a copy of the same library
 * chart (taking that chart's state with it); Use imported replaces text and state together and clears its undo
 * history. A library chart's state defaults to Keep mine. `charts` is how many charts the index holds after.
 */
export function applyChoices(plan: ImportPlan, choices: ImportChoices, newId: () => string): Readonly<{ steps: readonly ImportStep[]; charts: number }> {
  let index: readonly SavedMeta[] = plan.local.charts.map((c) => c.meta)
  const taken = new Set([...index, ...plan.incoming.charts.map((c) => c.meta)].map((m) => m.id))
  const freshId = (): string => {
    let id = newId()
    while (taken.has(id)) id = newId()
    return id
  }
  const chartStep = (c: BackupChart, removes: readonly string[]): ImportStep => {
    index = index.some((m) => m.id === c.meta.id) ? index.map((m) => (m.id === c.meta.id ? c.meta : m)) : [...index, c.meta]
    taken.add(c.meta.id)
    const writes: [string, string][] = [[textKey(c.meta.id), c.text], ...stateWrites(c.state, `mine:${c.meta.id}`), [INDEX, JSON.stringify(index)]]
    return { kind: 'chart', label: c.meta.title, removes, writes }
  }
  const steps: ImportStep[] = []
  for (const item of plan.charts) {
    const c = item.incoming
    if (item.status === 'identical') continue
    if (item.status === 'new' || !item.local) {
      steps.push(chartStep(c, []))
      continue
    }
    const choice = choices.charts?.[c.meta.id] ?? 'both'
    if (choice === 'mine') continue
    const local = item.local
    if (choice === 'imported') {
      const meta = { ...c.meta, id: local.meta.id }
      const undo = [`csm-undo:mine:${local.meta.id}`, ...(local.meta.kind === 'edited' && local.meta.basedOn ? [`csm-undo:${local.meta.basedOn}`] : [])]
      steps.push(chartStep({ ...c, meta }, [...stateRemoves(local.state, `mine:${local.meta.id}`), ...undo]))
      continue
    }
    const slug = c.meta.kind === 'edited' ? c.meta.basedOn : undefined
    const carried = slug !== undefined && Object.hasOwn(plan.incoming.library, slug) ? plan.incoming.library[slug] : {}
    const kind: SavedKind = c.meta.kind === 'edited' ? 'copy' : c.meta.kind
    steps.push(chartStep(markImported({ meta: { ...c.meta, id: freshId(), kind }, text: c.text, state: { ...carried, ...c.state } }), []))
  }
  for (const item of plan.library) {
    if (item.status === 'identical' || (item.status === 'conflict' && (choices.library?.[item.slug] ?? 'mine') === 'mine')) continue
    steps.push({ kind: 'library', label: item.slug, removes: stateRemoves(item.local, item.slug), writes: stateWrites(item.incoming, item.slug) })
  }
  const prefs = plan.preferences
  if (prefs.status !== 'none' && prefs.status !== 'identical' && (choices.preferences ?? prefs.apply))
    steps.push({ kind: 'preferences', label: 'Preferences', removes: [], writes: Object.entries(prefs.incoming) })
  return { steps, charts: index.length }
}
