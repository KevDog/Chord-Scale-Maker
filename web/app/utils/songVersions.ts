import { metaValue, parseChart, type TuneGroup } from '@chord-scale-maker/engine'
import { tuneNamed, tuneOf } from './library'
import type { SavedMeta } from './myCharts'
import { songPath } from './site'

export type VersionChoice = Readonly<{ path: string; label: string }>
export type VersionChoices = Readonly<{ library: readonly VersionChoice[]; mine: readonly VersionChoice[] }>
/** one of your saved charts as its index entry tells it: enough to know its tune */
export type SavedRef = Pick<SavedMeta, 'id' | 'title' | 'kind' | 'basedOn' | 'createdAt'>
/** and as the picker shows it: `version` is its own `version:` line ('' for none) */
export type SavedVersion = SavedRef & Readonly<{ version: string }>
/** the chart a song page shows: a library chart, or one of yours */
export type ChartAt = Readonly<{ slug: string }> | Readonly<{ mine: SavedRef }>
export type Tune = Pick<TuneGroup, 'main' | 'versions'>

const NONE: VersionChoices = { library: [], mine: [] }
const tuneOfSaved = (c: SavedRef): Tune | null => (c.basedOn ? tuneOf(c.basedOn) : null) ?? tuneNamed(c.title)

/** the library tune a song page's chart belongs to; none for your edit of a library chart (that chart's page shows it) */
export const tuneAt = (at: ChartAt): Tune | null => ('slug' in at ? tuneOf(at.slug) : at.mine.kind === 'edited' ? null : tuneOfSaved(at.mine))

/** one of your saved charts is a version of the tune: based on one of its charts, or titled as it is; never an edit */
export const ofTune = (tune: Tune, c: SavedRef): boolean => c.kind !== 'edited' && tuneOfSaved(c)?.main === tune.main

export const savedVersion = (meta: SavedMeta, text: string): SavedVersion => ({
  id: meta.id,
  title: meta.title,
  kind: meta.kind,
  ...(meta.basedOn ? { basedOn: meta.basedOn } : {}),
  createdAt: meta.createdAt,
  version: metaValue(parseChart(text).value, 'version'),
})

/**
 * the song page's version picker (#411): the tune's library charts, its main first as "Main", then your saved charts
 * of it, oldest first, by their `version:` or as "My chart". A label the library has gets "(mine)"; one several of
 * yours share is numbered. None when there'd be fewer than 2.
 */
export function versionChoices(tune: Tune | null, saved: readonly SavedVersion[]): VersionChoices {
  if (!tune) return NONE
  const library = tune.versions.map((v) => ({ path: songPath(v.slug), label: v.label || 'Main' }))
  const taken = new Set(library.map((c) => c.label))
  const ofThis = saved.filter((c) => ofTune(tune, c)).sort((a, b) => a.createdAt - b.createdAt)
  const base = (c: SavedVersion): string => c.version || 'My chart'
  const counts = new Map<string, number>()
  for (const c of ofThis) counts.set(base(c), (counts.get(base(c)) ?? 0) + 1)
  const seen = new Map<string, number>()
  const mine = ofThis.map((c) => {
    const b = base(c)
    const n = (seen.get(b) ?? 0) + 1
    seen.set(b, n)
    return { path: `/song?mine=${c.id}`, label: `${b}${taken.has(b) ? ' (mine)' : ''}${counts.get(b)! > 1 ? ` ${n}` : ''}` }
  })
  return library.length + mine.length < 2 ? NONE : { library, mine }
}
