import { tuneDescription, tuneSummary } from '@chord-scale-maker/engine'
import { findChart } from './library'
import { type PageHead, pageTitle, songPath, tuneName, tuneTitle } from './site'
import { breadcrumbLd, jsonLd, tuneLd } from './structuredData'

/** a library song's head (indexable: the one page per tune), its heading and what its sheet is, or null for any other /song address */
export function songHead(slug: string): Readonly<{ head: PageHead; ld: string; title: string; composer: string; leadSheet: string }> | null {
  const chart = findChart(slug)
  if (!chart) return null
  const summary = tuneSummary(chart.text)
  const path = songPath(slug)
  return {
    head: {
      title: tuneTitle(summary),
      description: tuneDescription(summary),
      ogTitle: pageTitle(tuneName(summary)),
      robots: 'index, follow, max-image-preview:large',
    },
    ld: jsonLd([tuneLd(summary, path), breadcrumbLd(summary, path)]),
    title: summary.title,
    composer: summary.composer,
    leadSheet:
      `${tuneName(summary)}${summary.aka.length ? `, also known as ${summary.aka.join(' or ')},` : ''} as a lead sheet gives it: the chord changes bar by bar, ` +
      'without the melody. The sheets add a scale, guide tones, arpeggios and pentatonics for every chord, written for your instrument.',
  }
}
