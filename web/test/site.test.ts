import { describe, expect, it } from 'vitest'
import { PAGE_HEAD, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, canonicalUrl, chartSlug, letterRedirect, libraryPath, pageTitle, seoMeta, songPath, tuneTitle } from '~/utils/site'

describe('canonicalUrl', () => {
  it('is the site root for /', () => {
    expect(canonicalUrl('/')).toBe('https://www.chordscalemaker.com/')
  })

  it('keeps the path, without a trailing slash', () => {
    expect(canonicalUrl('/help')).toBe('https://www.chordscalemaker.com/help')
    expect(canonicalUrl('/help/')).toBe('https://www.chordscalemaker.com/help')
  })

  it('drops the query and fragment, so share links never leak', () => {
    expect(canonicalUrl('/song?chart=x#s=abc')).toBe('https://www.chordscalemaker.com/song')
    expect(canonicalUrl('/song#s=abc')).toBe('https://www.chordscalemaker.com/song')
    expect(canonicalUrl('?mine=1')).toBe('https://www.chordscalemaker.com/')
  })
})

describe('pageTitle', () => {
  it('adds the site name after a page title', () => {
    expect(pageTitle('Help')).toBe('Help · Chord Scale Maker')
  })

  it('is the site name alone without a title, or when the title is the site name', () => {
    expect(pageTitle(undefined)).toBe(SITE_NAME)
    expect(pageTitle('')).toBe(SITE_NAME)
    expect(pageTitle(SITE_NAME)).toBe(SITE_NAME)
  })

  it('keeps a title that already leads with the site name (the home page)', () => {
    expect(pageTitle(PAGE_HEAD.index.title)).toBe('Chord Scale Maker: Endless Practice Sheets for Jazz Standards')
  })
})

describe('the tagline', () => {
  it('opens the site description, which fits a search snippet', () => {
    expect(SITE_TAGLINE).toBe('Endless improvisation practice sheets for jazz standards')
    expect(SITE_DESCRIPTION.startsWith(`${SITE_TAGLINE}:`)).toBe(true)
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(PAGE_HEAD.index.description).toBe(SITE_DESCRIPTION)
  })
})

describe('PAGE_HEAD', () => {
  const heads = Object.values(PAGE_HEAD)

  it('gives each page a unique title without the site suffix', () => {
    const titles = heads.map((h) => pageTitle(h.title))
    expect(new Set(titles).size).toBe(titles.length)
    for (const h of heads) expect(h.title ?? '').not.toContain('·')
  })

  it('gives each page a description of 70–160 characters', () => {
    for (const [page, h] of Object.entries(PAGE_HEAD)) {
      expect(h.description.length, page).toBeGreaterThanOrEqual(70)
      expect(h.description.length, page).toBeLessThanOrEqual(160)
    }
  })

  it('keeps the editor out of search results', () => {
    expect(PAGE_HEAD.song.robots).toBe('noindex')
    expect(heads.filter((h) => h.robots)).toEqual([PAGE_HEAD.song])
  })
})

describe('seoMeta', () => {
  it('gives the link preview the full title and the page description', () => {
    expect(seoMeta(PAGE_HEAD.help)).toEqual({
      title: 'Help',
      description: PAGE_HEAD.help.description,
      ogTitle: 'Help · Chord Scale Maker',
      ogDescription: PAGE_HEAD.help.description,
      twitterDescription: PAGE_HEAD.help.description,
    })
    expect(seoMeta(PAGE_HEAD.index).ogTitle).toBe('Chord Scale Maker: Endless Improvisation Practice Sheets for Jazz Standards')
    expect(seoMeta(PAGE_HEAD.song).robots).toBe('noindex')
  })
  it('gives a page with its own preview image that image, 1200×630, for both previews', () => {
    const image = { url: 'https://www.chordscalemaker.com/og/x.png', alt: 'X: chord changes' }
    expect(seoMeta({ ...PAGE_HEAD.help, image })).toMatchObject({
      ogImage: image.url,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: image.alt,
      twitterImage: image.url,
      twitterImageAlt: image.alt,
    })
  })
})

describe('song pages', () => {
  it('are titled by the tune and its composer, with no parentheses without one', () => {
    expect(tuneTitle({ title: 'Blue Trane', composer: 'John Coltrane' })).toBe('Blue Trane (John Coltrane): Chord Changes and Lead Sheet Practice Charts')
    expect(tuneTitle({ title: 'Bb Blues', composer: '' })).toBe('Bb Blues: Chord Changes and Lead Sheet Practice Charts')
  })
})

describe('songPath and chartSlug', () => {
  it('puts a chart’s practice sheets at /song/<name>', () => {
    expect(songPath('round-midnight')).toBe('/song/round-midnight')
  })

  it('reads an old underscore name as the chart’s name', () => {
    expect(chartSlug('round_midnight')).toBe('round-midnight')
    expect(chartSlug('round-midnight')).toBe('round-midnight')
  })
})

describe('libraryPath', () => {
  it('is /library, with a search when there is one', () => {
    expect(libraryPath()).toBe('/library')
    expect(libraryPath('  ')).toBe('/library')
    expect(libraryPath(' blue monk ')).toBe('/library?q=blue%20monk')
  })

  it('titles the library page', () => {
    expect(PAGE_HEAD.library.title).toBe('Library')
  })
})

describe('letterRedirect', () => {
  it('sends an old /#letter-X link to the library', () => {
    expect(letterRedirect('#letter-R')).toBe('/library#letter-R')
    expect(letterRedirect('#letter-RR')).toBeNull()
    expect(letterRedirect('')).toBeNull()
  })
})
