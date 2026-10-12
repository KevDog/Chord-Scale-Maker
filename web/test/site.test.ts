import { describe, expect, it } from 'vitest'
import { PAGE_HEAD, SITE_NAME, canonicalUrl, chartSlug, pageTitle, seoMeta, songPath, tuneTitle } from '~/utils/site'

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
})

describe('PAGE_HEAD', () => {
  const heads = Object.values(PAGE_HEAD)

  it('gives each page a unique title without the site suffix', () => {
    const titles = heads.map((h) => pageTitle(h.title))
    expect(new Set(titles).size).toBe(titles.length)
    for (const h of heads) expect(h.title ?? '').not.toContain('·')
  })

  it('gives each page a description of 50–160 characters', () => {
    for (const [page, h] of Object.entries(PAGE_HEAD)) {
      expect(h.description.length, page).toBeGreaterThanOrEqual(50)
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
    })
    expect(seoMeta(PAGE_HEAD.index).ogTitle).toBe(SITE_NAME)
    expect(seoMeta(PAGE_HEAD.song).robots).toBe('noindex')
  })
})

describe('song pages', () => {
  it('are titled by the tune and its composer, with no parentheses without one', () => {
    expect(tuneTitle({ title: 'Blue Trane', composer: 'John Coltrane' })).toBe('Blue Trane (John Coltrane): changes and chord scales')
    expect(tuneTitle({ title: 'Bb Blues', composer: '' })).toBe('Bb Blues: changes and chord scales')
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
