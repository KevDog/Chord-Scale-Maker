/** where the site lives: canonical URLs and link previews are absolute (previews of preview deployments show production's) */
export const SITE_URL = 'https://www.chordscalemaker.com'
export const SITE_NAME = 'Chord Scale Maker'
export const SITE_DESCRIPTION =
  'Practice sheets for jazz improvisation: every chord’s scale, the changes with their guide tones, and practice picks, written for your instrument.'

/** the page's address for search engines: the path alone (a share link's query or fragment never leaks), no trailing slash but the root's */
export function canonicalUrl(path: string): string {
  const bare = path.replace(/[?#].*$/s, '').replace(/\/+$/, '')
  return `${SITE_URL}${bare || '/'}`
}

/** the browser and search title: "Help · Chord Scale Maker", or the site name alone */
export const pageTitle = (title: string | undefined): string => (title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME)

/** title without the site name (the template adds it; none on the home page) */
export type PageHead = Readonly<{ title?: string; description: string; robots?: 'noindex' }>

export const PAGE_HEAD = {
  index: {
    description: 'A library of jazz standards as practice sheets: the changes with their guide tones, and a scale for every chord, written for your instrument.',
  },
  help: {
    title: 'Help',
    description: 'How to use Chord Scale Maker: the Changes and Scales sheets, practice, editing and saving charts, and printing.',
  },
  functions: {
    title: 'Functions and rules',
    description: 'How to write a chord’s function in a chart, the scale every function gets in any key, and the rules that choose it.',
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
  ogTitle: pageTitle(head.title),
  ogDescription: head.description,
  ...(head.robots ? { robots: head.robots } : {}),
})
