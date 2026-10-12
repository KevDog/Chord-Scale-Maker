import { tuneDescription, tuneSummary } from '@chord-scale-maker/engine'
import { findChart } from './library'
import { type PageHead, songPath, tuneTitle } from './site'
import { breadcrumbLd, jsonLd, tuneLd } from './structuredData'

/** a library song's head (indexable: the one page per tune) and its heading, or null for any other /song address */
export function songHead(slug: string): Readonly<{ head: PageHead; ld: string; title: string; composer: string }> | null {
  const chart = findChart(slug)
  if (!chart) return null
  const summary = tuneSummary(chart.text)
  const path = songPath(slug)
  return {
    head: { title: tuneTitle(summary), description: tuneDescription(summary) },
    ld: jsonLd([tuneLd(summary, path), breadcrumbLd(summary, path)]),
    title: summary.title,
    composer: summary.composer,
  }
}
