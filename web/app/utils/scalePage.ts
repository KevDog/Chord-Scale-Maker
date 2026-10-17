import { CONCERT, glyphs, noteText, parseRoot, parseScale, type PlaysOver, playsOver, rootName, SCALES, type ScaleKey, scaleFromSlug, scaleNotes, scaleSlug, scaleTitle, scaleUsage, spellFrom } from '@chord-scale-maker/engine'
import { LIBRARY } from './library'
import { canonicalUrl, type PageHead, songPath } from './site'
import { jsonLd } from './structuredData'

/** a scale reference page (/scales/<slug>, docs/superpowers/specs/2026-10-12-seo-pages-design.md): its head and what it shows */

/** at most this many tunes listed by name; the rest are counted */
const TUNES_SHOWN = 30

export const SCALES_PATH = '/scales'
export const scaleKeyPath = (key: ScaleKey): string => `${SCALES_PATH}/${scaleSlug(key)}`

/** a scale's page from its text ("C Half-Whole Dim."), or null if it can't be read */
export function scalePath(scale: string): string | null {
  try {
    return scaleKeyPath(parseScale(scale).key)
  } catch {
    return null
  }
}

const ORDINAL: Readonly<Record<string, string>> = { 1: 'st', 2: 'nd', 3: 'rd' }
/** "6" -> "6th", "b2" -> "♭2nd" */
const ordinal = (degree: string): string => `${glyphs(degree)}${ORDINAL[degree.replace(/\D/g, '')] ?? 'th'}`

const C = parseRoot('C')

/** an option rooted off the chord's root: "from A, the 6th"; '' on the chord's root */
const fromText = (o: PlaysOver): string => {
  const [root] = spellFrom(C, o.root)
  return o.root === '1' || !root ? '' : `from ${noteText(rootName(root))}, the ${ordinal(o.root)}`
}

export type ScalePage = Readonly<{
  key: ScaleKey
  title: string
  /** on C, concert: "C D E♭ F G A B♭" */
  notes: string
  formula: string
  playsOver: readonly (PlaysOver & Readonly<{ from: string }>)[]
  tunes: readonly Readonly<{ title: string; path: string }>[]
  /** the tunes past the ones listed */
  more: number
}>

export function scalePage(slug: string): ScalePage | null {
  const key = scaleFromSlug(slug)
  if (!key) return null
  const titles = new Map(LIBRARY.map((c) => [c.slug, c.title]))
  const using = scaleUsage(LIBRARY).get(key) ?? []
  return {
    key,
    title: scaleTitle(key),
    notes: scaleNotes(CONCERT, `C ${key}`, 'root', 0)
      .map((n) => noteText(rootName(n)))
      .join(' '),
    formula: glyphs(SCALES[key][0]),
    playsOver: playsOver(key).map((o) => ({ ...o, from: fromText(o) })),
    tunes: using.slice(0, TUNES_SHOWN).map((s) => ({ title: titles.get(s) ?? s, path: songPath(s) })),
    more: Math.max(0, using.length - TUNES_SHOWN),
  }
}

const CONTEXT = 'https://schema.org'

export function scaleHead(slug: string): Readonly<{ head: PageHead; ld: string }> | null {
  const key = scaleFromSlug(slug)
  if (!key) return null
  const title = scaleTitle(key)
  const url = canonicalUrl(scaleKeyPath(key))
  const description = `The ${title} scale (${glyphs(SCALES[key][0])}): its notes, the chords it plays over and the jazz standards that use it.`
  return {
    head: { title: `${title} scale: notes, chords and tunes`, description, robots: 'index, follow, max-image-preview:large' },
    ld: jsonLd([
      { '@context': CONTEXT, '@type': 'DefinedTerm', name: `${title} scale`, description, inDefinedTermSet: 'Jazz scales', url },
      {
        '@context': CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Scales', item: canonicalUrl(SCALES_PATH) },
          { '@type': 'ListItem', position: 2, name: title, item: url },
        ],
      },
    ]),
  }
}
