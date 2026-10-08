import { chartHeading, isSyncCopy, parseChart } from '~~/engine'

/** subtitle: the heading line (subtitle or style, key, form), as on the sheet */
export type LibraryChart = Readonly<{ slug: string; title: string; subtitle: string; composer: string; text: string }>

/** build-time: every chart in the repo's charts/ folder, as raw text */
const files = import.meta.glob<string>('../../../charts/*.txt', { query: '?raw', import: 'default', eager: true })

export function toLibrary(entries: Readonly<Record<string, string>>): LibraryChart[] {
  return Object.entries(entries)
    .filter(([path]) => !isSyncCopy(path))
    .map(([path, text]) => ({
      slug: path.slice(path.lastIndexOf('/') + 1).replace(/\.txt$/, ''),
      ...chartHeading(parseChart(text).value),
      text,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en')) // fixed locale: same order in prerender and browser
}

export const LIBRARY: readonly LibraryChart[] = toLibrary(files)

/** by title or composer, case- and accent-insensitive */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const searchLibrary = (charts: readonly LibraryChart[], query: string): LibraryChart[] =>
  charts.filter((c) => [c.title, c.composer].some((s) => fold(s).includes(fold(query.trim()))))

export const findChart = (slug: string): LibraryChart | undefined => LIBRARY.find((c) => c.slug === slug)
