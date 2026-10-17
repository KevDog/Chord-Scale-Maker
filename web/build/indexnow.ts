import { composerIndex, SCALES, type ScaleKey, scaleSlug, scaleUsage } from '@chord-scale-maker/engine'
import { canonicalUrl, songPath } from '../app/utils/site'
import { sitemapPaths } from '../app/utils/sitemap'

/** IndexNow takes at most this many URLs a request */
export const MAX_URLS = 10_000

/** what the URL rules need to know about the library: its songs, the sitemap, and which scales and composers each song's pages show */
export type IndexNowLibrary = Readonly<{
  slugs: readonly string[]
  sitemap: readonly string[]
  scalesOf: (slug: string) => readonly string[]
  composersOf: (slug: string) => readonly string[]
}>

export function indexNowLibrary(charts: readonly Readonly<{ slug: string; text: string }>[]): IndexNowLibrary {
  const composers = composerIndex(charts)
  const usage = scaleUsage(charts)
  const scaleSlugs = (slug: string): string[] =>
    (Object.keys(SCALES) as ScaleKey[]).filter((k) => usage.get(k)?.includes(slug)).map(scaleSlug)
  return {
    slugs: charts.map((c) => c.slug),
    sitemap: sitemapPaths(charts.map((c) => songPath(c.slug)), composers.map((c) => c.slug)),
    scalesOf: scaleSlugs,
    composersOf: (slug) => composers.filter((c) => c.tunes.includes(slug)).map((c) => c.slug),
  }
}

const allScales = (): string[] => (Object.keys(SCALES) as ScaleKey[]).map((k) => `/scales/${scaleSlug(k)}`)

/** the sitemap paths a page file (web/app/pages/….vue) draws: index.vue is its folder, [x] one segment, [[x]] an optional one */
function pagePaths(file: string, sitemap: readonly string[]): string[] {
  const route = file.replace(/\.vue$/, '').replace(/(^|\/)index$/, '')
  const pattern = route
    .split('/')
    .filter(Boolean)
    .map((seg) => (/^\[\[.+\]\]$/.test(seg) ? '(?:/[^/]+)?' : /^\[.+\]$/.test(seg) ? '/[^/]+' : `/${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    .join('')
  const re = new RegExp(`^${pattern || '/'}$`)
  return sitemap.filter((p) => re.test(p))
}

/** the paths one changed file affects */
function pathsFor(file: string, lib: IndexNowLibrary): string[] {
  const chart = /^engine\/charts\/([^/]+)\.txt$/.exec(file)?.[1]
  if (chart) return [songPath(chart), ...lib.composersOf(chart).map((s) => `/composers/${s}`), ...lib.scalesOf(chart).map((s) => `/scales/${s}`)]
  if (file === 'engine/chord_scales.json' || (file.startsWith('engine/src/') && !file.includes('/__tests__/')))
    return [...lib.slugs.map(songPath), ...allScales()]
  const page = /^web\/app\/pages\/(.+\.vue)$/.exec(file)?.[1]
  if (page) return pagePaths(page, lib.sitemap)
  return []
}

/** the absolute URLs to ping after a deploy: what the changed files affect, and the sitemap; every sitemap URL when
 * there's no previous deploy to compare with (`changed === null`); deduplicated, at most MAX_URLS */
export function urlsFor(changed: readonly string[] | null, lib: IndexNowLibrary): string[] {
  const paths = changed === null ? lib.sitemap : changed.flatMap((f) => pathsFor(f, lib))
  return [...new Set([...paths.map(canonicalUrl), canonicalUrl('/sitemap.xml')])].slice(-MAX_URLS)
}
