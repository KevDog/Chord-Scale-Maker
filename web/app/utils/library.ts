import { chartAka, chartHeading, isSyncCopy, parseChart } from '@chord-scale-maker/engine'
import { tunePath } from './site'

/** subtitle: the heading line (subtitle or style, key, form), as on the sheet; aka: the tune's other titles */
export type LibraryChart = Readonly<{ slug: string; title: string; subtitle: string; composer: string; aka: readonly string[]; text: string }>

/** build-time: every chart in the engine package's charts/ folder (the #charts alias, nuxt.config.ts), as raw text */
const files = import.meta.glob<string>('#charts/*.txt', { query: '?raw', import: 'default', eager: true })

export function toLibrary(entries: Readonly<Record<string, string>>): LibraryChart[] {
  return Object.entries(entries)
    .filter(([path]) => !isSyncCopy(path))
    .map(([path, text]) => {
      const doc = parseChart(text).value
      return { slug: path.slice(path.lastIndexOf('/') + 1).replace(/\.txt$/, ''), ...chartHeading(doc), aka: chartAka(doc), text }
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en')) // fixed locale: same order in prerender and browser
}

export const LIBRARY: readonly LibraryChart[] = toLibrary(files)

/** every library chart's tune page; nuxt.config.ts derives the same list for prerendering and the sitemap (test/library.test.ts) */
export const TUNE_PATHS: readonly string[] = LIBRARY.map((c) => tunePath(c.slug))

/** by title, other title or composer, case- and accent-insensitive */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const searchLibrary = (charts: readonly LibraryChart[], query: string): LibraryChart[] =>
  charts.filter((c) => [c.title, ...c.aka, c.composer].some((s) => fold(s).includes(fold(query.trim()))))

export const findChart = (slug: string): LibraryChart | undefined => LIBRARY.find((c) => c.slug === slug)

