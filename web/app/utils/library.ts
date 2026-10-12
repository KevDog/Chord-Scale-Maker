import { chartAka, chartHeading, isSyncCopy, parseChart, tuneSummary } from '@chord-scale-maker/engine'
import { filingTitle, libraryDetails } from './libraryIndex'
import { publishedChart } from './published'

/** subtitle: the heading line (subtitle or style, key, form), as on the sheet; details: style · key · form, the same
 * for every row; aka: the tune's other titles */
export type LibraryChart = Readonly<{ slug: string; title: string; subtitle: string; details: string; composer: string; aka: readonly string[]; text: string }>

/** build-time: every chart in the engine package's charts/ folder (the #charts alias, nuxt.config.ts), as raw text */
const files = import.meta.glob<string>('#charts/*.txt', { query: '?raw', import: 'default', eager: true })

export function toLibrary(entries: Readonly<Record<string, string>>): LibraryChart[] {
  return Object.entries(entries)
    .filter(([path]) => !isSyncCopy(path))
    .map(([path, raw]) => {
      const text = publishedChart(raw) // the build already strips it (build/charts.ts); this keeps toLibrary honest
      const doc = parseChart(text).value
      return { slug: path.slice(path.lastIndexOf('/') + 1).replace(/\.txt$/, ''), ...chartHeading(doc), details: libraryDetails(tuneSummary(text)), aka: chartAka(doc), text }
    })
    // fixed locale: same order in prerender and browser; a leading apostrophe files under the letter after it
    .sort((a, b) => filingTitle(a.title).localeCompare(filingTitle(b.title), 'en') || a.slug.localeCompare(b.slug, 'en'))
}

export const LIBRARY: readonly LibraryChart[] = toLibrary(files)

/** by title, other title or composer, case- and accent-insensitive */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const searchLibrary = (charts: readonly LibraryChart[], query: string): LibraryChart[] =>
  charts.filter((c) => [c.title, ...c.aka, c.composer].some((s) => fold(s).includes(fold(query.trim()))))

export const findChart = (slug: string): LibraryChart | undefined => LIBRARY.find((c) => c.slug === slug)

