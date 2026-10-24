import { CONCERT, chordFormula, chordFromSlug, chordQualityOf, chordScales, chordSlug, chordTitle, type ChordToken, chordTokens, chordUsage, glyphs, noteText, parseRoot, rootName, type Row, type ScaleOption, spellFrom } from '@chord-scale-maker/engine'
import { LIBRARY, tuneOf } from './library'
import { scalePageTitle, scalePath } from './scalePage'
import { canonicalUrl, type PageHead, SITE_URL, songPath } from './site'
import { jsonLd } from './structuredData'

/** a chord reference page (/chords/<slug>, #498), as scalePage.ts is for the scales: its head and what it shows */

/** at most this many tunes listed by name; the rest are counted */
const TUNES_SHOWN = 30

export const CHORDS_PATH = '/chords'
export const chordQualityPath = (quality: string): string => `${CHORDS_PATH}/${chordSlug(quality)}`

/** a written chord's page ("Bb-7" -> /chords/minor-7), or null for a rest or a chord the app doesn't know */
export function chordPath(chord: string): string | null {
  const q = chordQualityOf(chord)
  return q ? chordQualityPath(q) : null
}

/** the quality on C as a chart writes it: "C", "Cm7" */
export const chordOnC = (quality: string): string => `C${quality === 'maj' ? '' : quality}`

export type ChordScaleTag = 'default' | 'basic' | 'advanced' | 'outside' | 'functional'

const tagsOf = (o: ScaleOption): ChordScaleTag[] =>
  (
    [
      ['default', o.default],
      ['basic', o.level === 'basic'],
      ['advanced', o.level === 'advanced'],
      ['outside', o.outside],
      ['functional', o.functional],
    ] as const
  )
    .filter(([, on]) => on)
    .map(([tag]) => tag)

export type ChordPage = Readonly<{
  quality: string
  title: string
  symbolOnC: readonly ChordToken[]
  /** on C, concert: "C E♭ G B♭" */
  notes: string
  formula: string
  /** its scales on C ("E♭ Major Pentatonic", as the app writes it: source), each linked to its page, titled as it is there */
  scales: readonly Readonly<{ scale: string; source: string; path: string | null; pageTitle: string | null; note: string; tags: readonly ChordScaleTag[] }>[]
  tunes: readonly Readonly<{ title: string; path: string }>[]
  /** the tunes past the ones listed */
  more: number
}>

export function chordPage(slug: string): ChordPage | null {
  const quality = chordFromSlug(slug)
  if (!quality) return null
  const titles = new Map(LIBRARY.map((c) => [c.slug, c.title]))
  // a tune once, at its main chart, however many of its versions write the chord (#411)
  const using = [...new Set((chordUsage(LIBRARY).get(quality) ?? []).map((s) => tuneOf(s)?.main ?? s))]
  return {
    quality,
    title: chordTitle(quality),
    symbolOnC: chordTokens(CONCERT, chordOnC(quality)),
    notes: spellFrom(parseRoot('C'), chordFormula(quality))
      .map((n) => noteText(rootName(n)))
      .join(' '),
    formula: glyphs(chordFormula(quality)),
    scales: chordScales(quality).map((o) => ({ scale: glyphs(o.scale), source: o.scale, path: scalePath(o.scale), pageTitle: scalePageTitle(o.scale), note: o.note, tags: tagsOf(o) })),
    tunes: using.slice(0, TUNES_SHOWN).map((s) => ({ title: titles.get(s) ?? s, path: songPath(s) })),
    more: Math.max(0, using.length - TUNES_SHOWN),
  }
}

/** a row for each of the page's scales, on the chord on C, in the page's order: what its staves draw (#523) */
export const chordScaleRows = (page: ChordPage): readonly Row[] => page.scales.map((s) => ({ section: '', bar: '', chord: chordOnC(page.quality), scale: s.source }))

const CONTEXT = 'https://schema.org'

export function chordHead(slug: string): Readonly<{ head: PageHead; ld: string }> | null {
  const quality = chordFromSlug(slug)
  if (!quality) return null
  const title = chordTitle(quality)
  const url = canonicalUrl(chordQualityPath(quality))
  const description = `The ${title} chord (${glyphs(chordFormula(quality))}): its notes, the scales that play over it and the jazz standards that use it.`
  return {
    head: {
      title: `${title} chord: notes, scales and tunes`,
      description,
      robots: 'index, follow, max-image-preview:large',
      // drawn by scripts/og.ts (make og)
      image: { url: `${SITE_URL}/og/chords/${slug}.png`, alt: `${title} chord: its formula, notes and scales` },
    },
    ld: jsonLd([
      { '@context': CONTEXT, '@type': 'DefinedTerm', name: `${title} chord`, description, inDefinedTermSet: 'Jazz chords', url },
      {
        '@context': CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Chords', item: canonicalUrl(CHORDS_PATH) },
          { '@type': 'ListItem', position: 2, name: title, item: url },
        ],
      },
    ]),
  }
}

/** the /chords index's families, each quality in one */
export const CHORD_GROUPS: readonly Readonly<{ title: string; qualities: readonly string[] }>[] = [
  { title: 'Major', qualities: ['maj', 'Maj7', '6', 'Maj7#11', 'Maj7#5', 'aug'] },
  { title: 'Minor', qualities: ['m', 'm7', 'm6', 'mMaj7'] },
  { title: 'Dominant', qualities: ['7', '7sus4', '7sus4b9', '7b9', '7b13', '7b9b13', '7#11', '7alt'] },
  { title: 'Diminished', qualities: ['m7b5', 'dim7'] },
]
