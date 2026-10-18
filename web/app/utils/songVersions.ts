import { metaValue, parseChart } from '@chord-scale-maker/engine'
import { tuneNamed, tuneOf } from './library'
import type { SavedChart, SavedKind } from './myCharts'
import { songPath } from './site'

export type VersionChoice = Readonly<{ path: string; label: string }>
export type VersionChoices = Readonly<{ library: readonly VersionChoice[]; mine: readonly VersionChoice[] }>
/** one of your saved charts, as the picker reads it: `version` is its own `version:` line ('' for none) */
export type SavedVersion = Readonly<{ id: string; title: string; kind: SavedKind; basedOn?: string; version: string }>
/** the chart a song page shows: a library chart, or one of yours */
export type ChartAt = Readonly<{ slug: string }> | Readonly<{ mine: SavedVersion }>

export const savedVersion = ({ meta, text }: SavedChart): SavedVersion => ({
  id: meta.id,
  title: meta.title,
  kind: meta.kind,
  ...(meta.basedOn ? { basedOn: meta.basedOn } : {}),
  version: metaValue(parseChart(text).value, 'version'),
})

const NONE: VersionChoices = { library: [], mine: [] }
const tuneOfSaved = (c: SavedVersion) => (c.basedOn ? tuneOf(c.basedOn) : null) ?? tuneNamed(c.title)

/**
 * the song page's version picker (#411): the tune's library charts, its main first as "Main", then your saved charts
 * of it (based on one of them, or titled as it is), by their `version:` or as "My chart", numbered when several.
 * Your edits of a library chart are left out: that chart's page shows them. None when there'd be fewer than 2.
 */
export function versionChoices(at: ChartAt, saved: readonly SavedVersion[]): VersionChoices {
  const tune = 'slug' in at ? tuneOf(at.slug) : tuneOfSaved(at.mine)
  if (!tune) return NONE
  const ofTune = saved.filter((c) => c.kind !== 'edited' && tuneOfSaved(c)?.main === tune.main)
  const unlabelled = ofTune.filter((c) => !c.version).length
  let n = 0
  const mine = ofTune.map((c) => ({ path: `/song?mine=${c.id}`, label: c.version || (unlabelled > 1 ? `My chart ${++n}` : 'My chart') }))
  const library = tune.versions.map((v) => ({ path: songPath(v.slug), label: v.label || 'Main' }))
  return library.length + mine.length < 2 ? NONE : { library, mine }
}
