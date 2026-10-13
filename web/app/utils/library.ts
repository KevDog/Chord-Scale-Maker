import { chartAka, chartHeading, isSyncCopy, parseChart, tuneSummary } from '@chord-scale-maker/engine'
import { filingTitle, libraryDetails } from './libraryIndex'
import { publishedChart } from './published'

/** subtitle: the heading line (subtitle or style, key, form), as on the sheet; details: style · key · form, the same
 * for every row; key: as the chart writes it ("Ebm"); aka: the tune's other titles */
export type LibraryChart = Readonly<{ slug: string; title: string; subtitle: string; details: string; key: string; composer: string; aka: readonly string[]; text: string }>

/** build-time: every chart in the engine package's charts/ folder (the #charts alias, nuxt.config.ts), as raw text */
const files = import.meta.glob<string>('#charts/*.txt', { query: '?raw', import: 'default', eager: true })

export function toLibrary(entries: Readonly<Record<string, string>>): LibraryChart[] {
  return Object.entries(entries)
    .filter(([path]) => !isSyncCopy(path))
    .map(([path, raw]) => {
      const text = publishedChart(raw) // the build already strips it (build/charts.ts); this keeps toLibrary honest
      const doc = parseChart(text).value
      const summary = tuneSummary(text)
      return { slug: path.slice(path.lastIndexOf('/') + 1).replace(/\.txt$/, ''), ...chartHeading(doc), details: libraryDetails(summary), key: summary.key, aka: chartAka(doc), text }
    })
    // fixed locale: same order in prerender and browser; a leading apostrophe files under the letter after it
    .sort((a, b) => filingTitle(a.title).localeCompare(filingTitle(b.title), 'en') || a.slug.localeCompare(b.slug, 'en'))
}

export const LIBRARY: readonly LibraryChart[] = toLibrary(files)

/** by title, other title or composer, case- and accent-insensitive */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const searchLibrary = (charts: readonly LibraryChart[], query: string): LibraryChart[] =>
  charts.filter((c) => [c.title, ...c.aka, c.composer].some((s) => fold(s).includes(fold(query.trim()))))

/** the home page's suggestions: title starts, then a title word's start, then elsewhere in a title or other title,
 * then composers; in library order within each; at most `limit`, and how many match in all */
export function suggestTunes(charts: readonly LibraryChart[], query: string, limit: number): Readonly<{ tunes: LibraryChart[]; total: number }> {
  const q = fold(query.trim())
  if (!q) return { tunes: [], total: 0 }
  const rank = (c: LibraryChart): number => {
    const title = fold(c.title)
    if (title.startsWith(q)) return 0
    if (title.includes(` ${q}`)) return 1
    if ([c.title, ...c.aka].some((s) => fold(s).includes(q))) return 2
    return fold(c.composer).includes(q) ? 3 : -1
  }
  const ranked = charts.map((c) => [rank(c), c] as const).filter(([r]) => r >= 0)
  const tunes = ranked.toSorted((a, b) => a[0] - b[0]).map(([, c]) => c) // stable: library order within a rank
  return { tunes: tunes.slice(0, limit), total: tunes.length }
}

/** where a query first matches a title ([start, end)), ignoring case and accents; null if it doesn't */
export function matchSpan(title: string, query: string): readonly [number, number] | null {
  const q = fold(query.trim())
  const at = q ? fold(title.normalize('NFC')).indexOf(q) : -1
  return at < 0 ? null : [at, at + q.length]
}

/** a key as the library shows it: "Bb" -> "B♭", "F#m" -> "F♯m" */
export const keyName = (key: string): string => key.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯')

export const findChart = (slug: string): LibraryChart | undefined => LIBRARY.find((c) => c.slug === slug)
