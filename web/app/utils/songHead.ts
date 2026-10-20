import { chartOutline, type OutlineSection, type Recording, tuneDescription, tuneSummary } from '@chord-scale-maker/engine'
import { findChart, tuneOf } from './library'
import { type PageHead, pageTitle, SITE_URL, songPath, tuneName, tuneTitle } from './site'
import { breadcrumbLd, jsonLd, tuneLd } from './structuredData'

type SongHead = Readonly<{
  head: PageHead
  ld: string
  title: string
  composer: string
  leadSheet: string
  outline: readonly OutlineSection[]
  /** its notable recording and video ('' without one), with the recordings flag */
  recording: Recording | null
  youtube: string
  /** false when the video won't play embedded: only a link to it */
  embeddable: boolean
  /** who sent the chart, credited on the page ('' without one) */
  contributor: string
  /** a version's canonical page: its tune's main chart ('' for a main chart, #411) */
  canonical: string
}>

/** a library song's head (indexable: the one page per tune), its heading, its changes and what its sheet is, or null
 * for any other /song address; `recordings` (the feature flag) shows its notable recording, on the page and in the JSON-LD */
export function songHead(slug: string, opts: Readonly<{ recordings: boolean }> = { recordings: false }): SongHead | null {
  const chart = findChart(slug)
  if (!chart) return null
  const read = tuneSummary(chart.text)
  // a version is named by its label: "Summertime (Jazz Mind Accelerator)" (#411)
  const tune = read.version ? { ...read, title: `${read.title} (${read.version})` } : read
  const summary = opts.recordings ? tune : { ...tune, recording: null, youtube: '' }
  const main = tuneOf(slug)?.main ?? slug
  const path = songPath(slug)
  return {
    head: {
      title: tuneTitle(summary),
      description: tuneDescription(summary),
      ogTitle: pageTitle(tuneName(summary)),
      robots: 'index, follow, max-image-preview:large',
      // drawn by scripts/og.ts (make og)
      image: { url: `${SITE_URL}/og/${slug}.png`, alt: `${[summary.title, summary.composer].filter(Boolean).join(', ')}: chord changes` },
    },
    // a version is its tune's composition: the main title and canonical; its label only in the breadcrumb (#424)
    ld: jsonLd([tuneLd({ ...summary, title: read.title }, songPath(main)), breadcrumbLd(summary, path)]),
    title: summary.title,
    composer: summary.composer,
    leadSheet:
      `${tuneName(summary)}${summary.aka.length ? `, also known as ${summary.aka.join(' or ')},` : ''} as a lead sheet gives it: the chord changes bar by bar, ` +
      'without the melody. The sheets add a scale, guide tones, arpeggios and pentatonics for every chord, written for your instrument.',
    outline: chartOutline(chart.text),
    recording: summary.recording,
    youtube: summary.recording ? summary.youtube : '',
    embeddable: summary.embeddable,
    contributor: summary.contributor,
    canonical: main === slug ? '' : songPath(main),
  }
}
