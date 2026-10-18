/** where the site lives: canonical URLs and link previews are absolute (previews of preview deployments show production's) */
export const SITE_URL = 'https://www.chordscalemaker.com'
export const SITE_NAME = 'Chord Scale Maker'
export const SITE_TAGLINE = 'Endless improvisation practice sheets for jazz standards'
export const SITE_DESCRIPTION = `${SITE_TAGLINE}: chord changes with scales, guide tones, arpeggios and pentatonics, written for your instrument.`

/** the page's address for search engines: the path alone (a share link's query or fragment never leaks), no trailing slash but the root's */
export function canonicalUrl(path: string): string {
  const bare = path.replace(/[?#].*$/s, '').replace(/\/+$/, '')
  return `${SITE_URL}${bare || '/'}`
}

/** the browser and search title: "Help · Chord Scale Maker", or the site name alone, or a title that leads with it */
export const pageTitle = (title: string | undefined): string => (!title ? SITE_NAME : title.startsWith(SITE_NAME) ? title : `${title} · ${SITE_NAME}`)

/** title without the site name (the template adds it), unless it leads with it; ogTitle when the preview's differs */
/** image: the page's own link preview (1200×630), in place of the site's og-image.png */
export type PageHead = Readonly<{ title?: string; description: string; ogTitle?: string; robots?: 'noindex' | 'index, follow, max-image-preview:large'; image?: Readonly<{ url: string; alt: string }> }>

export const PAGE_HEAD = {
  index: {
    title: `${SITE_NAME}: Endless Practice Sheets for Jazz Standards`,
    description: SITE_DESCRIPTION,
    ogTitle: `${SITE_NAME}: Endless Improvisation Practice Sheets for Jazz Standards`,
  },
  library: {
    title: 'Library',
    description: 'Every jazz standard in Chord Scale Maker, A to Z: open one for its changes and a scale for every chord, written for your instrument.',
  },
  help: {
    title: 'Help',
    description: 'How to use Chord Scale Maker: the Changes and Scales sheets, practice, editing and saving charts, and printing.',
  },
  'how-it-decides': {
    title: 'How it decides',
    description: 'Why Chord Scale Maker chose what it did: scale levels, guide tone lines, pentatonics, triad pairs, spelling and ranges, each rule with an example.',
  },
  functions: {
    title: 'Functions and rules',
    description: 'How to write a chord’s function in a chart, the scale every function gets in any key, and the rules that choose it.',
  },
  scales: {
    title: 'Scales',
    description: 'Every scale Chord Scale Maker plays, by family: its formula, its notes, the chords it plays over and the jazz standards that use it.',
  },
  composers: {
    title: 'Composers',
    description: 'The composers of the jazz standards in the library, by surname: each with their tunes, to practise with the scales, guide tones and arpeggios.',
  },
  about: {
    title: 'About',
    description: 'What Chord Scale Maker is, how its sheets help you practise jazz improvisation, and the Jazz Lab video it started with.',
  },
  contact: {
    title: 'Contact',
    description: 'Send a question, an idea, a bug report, or a tune you’d like added to the Chord Scale Maker library.',
  },
  privacy: {
    title: 'Privacy',
    description: 'Chord Scale Maker’s privacy policy, in short: nothing is tracked, sold or shared, and the charts you save stay in your browser.',
  },
  song: {
    title: 'Practice sheets',
    description: 'Edit a chord chart and print its practice sheets: the changes and a scale for every chord, written for your instrument.',
    robots: 'noindex',
  },
} as const satisfies Record<string, PageHead>

/** a page's head for useSeoMeta: the link preview's title carries the site name, as the browser's does */
export const seoMeta = (head: PageHead) => ({
  title: head.title,
  description: head.description,
  ogTitle: head.ogTitle ?? pageTitle(head.title),
  ogDescription: head.description,
  twitterDescription: head.description,
  ...(head.robots ? { robots: head.robots } : {}),
  ...(head.image
    ? { ogImage: head.image.url, ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: head.image.alt, twitterImage: head.image.url, twitterImageAlt: head.image.alt }
    : {}),
})

/** the library page, searching for `query` when there is one */
export const libraryPath = (query = ''): string => (query.trim() ? `/library?q=${encodeURIComponent(query.trim())}` : '/library')

/** an old library link (/#letter-R, from when the library was the home page): its place on the library page */
export const letterRedirect = (hash: string): string | null => (/^#letter-.$/u.test(hash) ? `/library${hash}` : null)

/** a library chart's practice sheets (round-midnight.txt -> /song/round-midnight) */
export const songPath = (slug: string): string => `/song/${slug}`

/** a chart's name from an address; old addresses and bookmarks used underscores (round_midnight) */
export const chartSlug = (name: string): string => name.replaceAll('_', '-')

type TuneName = Readonly<{ title: string; composer: string }>

/** a tune and its composer: "Blue Trane (John Coltrane)" */
export const tuneName = (t: TuneName): string => `${t.title}${t.composer ? ` (${t.composer})` : ''}`

/** a song page's title, without the site name (the template adds it) */
export const tuneTitle = (t: TuneName): string => `${tuneName(t)}: Chord Changes and Lead Sheet Practice Charts`
