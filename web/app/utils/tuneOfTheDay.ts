import type { LibraryChart } from './library'

/** the library's tunes: charts with a composer (forms and exercises have none) */
const tunes = (charts: readonly LibraryChart[]): readonly LibraryChart[] => charts.filter((c) => c.composer !== '')

/** days since 1970 by the viewer's calendar, so the tune turns over at local midnight */
const dayOf = (date: Date): number => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)

/** the home page's tune of the day (issue #249): one per local date, scattered through the library, not A–Z */
export function tuneOfTheDay(charts: readonly LibraryChart[], date: Date): LibraryChart | null {
  const list = tunes(charts)
  return list.length ? (list[(Math.imul(dayOf(date), 2_654_435_761) >>> 0) % list.length] ?? null) : null
}

/** "Another": any other tune, by `random` in [0, 1) */
export function anotherTune(charts: readonly LibraryChart[], current: LibraryChart, random: number): LibraryChart | null {
  const others = tunes(charts).filter((c) => c.slug !== current.slug)
  return others[Math.floor(random * others.length)] ?? null
}
