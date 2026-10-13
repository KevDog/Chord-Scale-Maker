import type { TuneSummary } from '@chord-scale-maker/engine'
import { SITE_DESCRIPTION, SITE_NAME, canonicalUrl, libraryPath } from './site'

/** schema.org structured data for search engines, as JSON-LD (docs/superpowers/plans/2026-10-12-seo-discoverability.md, Task 6) */

const CONTEXT = 'https://schema.org'

export const websiteLd = () => ({ '@context': CONTEXT, '@type': 'WebSite', name: SITE_NAME, url: canonicalUrl('/') })

/** free, in any browser; no rating is invented (so no app rich result is expected) */
export const webAppLd = () => ({
  '@context': CONTEXT,
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: canonicalUrl('/'),
  description: SITE_DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript and a modern web browser',
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
})

/** keyLabel reads "E♭" for a major key and "C minor" for a minor one */
const musicalKey = (t: TuneSummary): string => (!t.keyLabel || t.keyLabel.endsWith(' minor') ? t.keyLabel : `${t.keyLabel} major`)

export const tuneLd = (t: TuneSummary, path: string) => {
  const key = musicalKey(t)
  return {
    '@context': CONTEXT,
    // a form (F Blues) or an exercise has no composer: a work, not a composition
    '@type': t.kind === 'tune' ? 'MusicComposition' : 'CreativeWork',
    name: t.title,
    ...(t.aka.length ? { alternateName: t.aka } : {}),
    ...(t.composer ? { composer: { '@type': 'Person', name: t.composer } } : {}),
    ...(key ? { musicalKey: key } : {}),
    url: canonicalUrl(path),
  }
}

export const breadcrumbLd = (t: TuneSummary, path: string) => ({
  '@context': CONTEXT,
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Library', item: canonicalUrl(libraryPath()) },
    { '@type': 'ListItem', position: 2, name: t.title, item: canonicalUrl(path) },
  ],
})

/** for a <script type="application/ld+json">: "<" escaped, so no value can close the tag */
export const jsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c')
