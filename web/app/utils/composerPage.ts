import { composerIndex, type ComposerEntry, composersOf } from '@chord-scale-maker/engine'
import { LIBRARY, TUNES } from './library'
import { canonicalUrl, type PageHead, songPath } from './site'
import { jsonLd } from './structuredData'

/** a composer's page (/composers/<slug>, docs/superpowers/specs/2026-10-12-seo-pages-design.md): its head and what it shows */

export const COMPOSERS_PATH = '/composers'
export const composerPath = (slug: string): string => `${COMPOSERS_PATH}/${slug}`

/** every library composer, filed by surname, with their tunes (a tune's versions listed once, #411) */
export const COMPOSERS: readonly ComposerEntry[] = composerIndex(TUNES)
const BY_SLUG = new Map(COMPOSERS.map((c) => [c.slug, c]))
const CHARTS = new Map(LIBRARY.map((c) => [c.slug, c]))

/** a piece of a credit as written: a composer (path: their page, if the library has one) or what stands between them */
export type CreditPart = Readonly<{ text: string; path: string | null }>

/** a `composer:` credit in pieces, each library composer linked; a traditional tune is text */
export function creditParts(credit: string): readonly CreditPart[] {
  if (!credit.trim()) return []
  if (!composersOf(credit).length) return [{ text: credit, path: null }]
  return credit.split(/(,\s*|\s+&\s+)/).filter(Boolean).map((text, i) => {
    const slug = i % 2 ? undefined : composersOf(text)[0]?.slug
    return { text, path: slug && BY_SLUG.has(slug) ? composerPath(slug) : null }
  })
}

export type ComposerPage = Readonly<{
  name: string
  tunes: readonly Readonly<{ title: string; path: string; details: string; with: readonly CreditPart[] }>[]
}>

/** the composer's tunes in library order, each with the others who wrote it ("A, B & C", as credit parts) */
export function composerPage(slug: string): ComposerPage | null {
  const c = BY_SLUG.get(slug)
  if (!c) return null
  const tunes = c.tunes.flatMap((s) => {
    const chart = CHARTS.get(s)
    if (!chart) return []
    const others = composersOf(chart.composer).filter((o) => o.slug !== slug)
    const names = others.map((o): CreditPart => ({ text: o.name, path: BY_SLUG.has(o.slug) ? composerPath(o.slug) : null }))
    return [{ title: chart.title, path: songPath(s), details: chart.details, with: names.flatMap((n, i) => (i === 0 ? [n] : [{ text: i === names.length - 1 ? ' & ' : ', ', path: null }, n])) }]
  })
  return { name: c.name, tunes }
}

const CONTEXT = 'https://schema.org'
const count = (n: number): string => `${n} ${n === 1 ? 'tune' : 'tunes'}`

export function composerHead(slug: string): Readonly<{ head: PageHead; ld: string }> | null {
  const page = composerPage(slug)
  if (!page) return null
  const url = canonicalUrl(composerPath(slug))
  const description = `${count(page.tunes.length)} by ${page.name} to practise: the chord changes with their scales, guide tones and arpeggios, for your instrument.`
  return {
    head: { title: `${page.name}: tunes, changes and chord scales`, description, robots: 'index, follow, max-image-preview:large' },
    ld: jsonLd([
      { '@context': CONTEXT, '@type': 'Person', name: page.name, url },
      {
        '@context': CONTEXT,
        '@type': 'ItemList',
        name: `Tunes by ${page.name}`,
        itemListElement: page.tunes.map((t, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'MusicComposition', name: t.title, url: canonicalUrl(t.path) } })),
      },
      {
        '@context': CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Composers', item: canonicalUrl(COMPOSERS_PATH) },
          { '@type': 'ListItem', position: 2, name: page.name, item: url },
        ],
      },
    ]),
  }
}
