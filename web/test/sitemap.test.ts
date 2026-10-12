import { describe, expect, it } from 'vitest'
import { canonicalUrl } from '~/utils/site'
import { sitemapXml } from '~/utils/sitemap'

describe('sitemapXml', () => {
  it('is an XML urlset in the sitemap namespace', () => {
    const xml = sitemapXml(['/'])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('lists each path once, at its canonical URL', () => {
    const locs = [...sitemapXml(['/', '/help', '/tunes/blue-trane', '/help']).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual(['/', '/help', '/tunes/blue-trane'].map(canonicalUrl))
  })

  it('escapes & and <', () => {
    const xml = sitemapXml(['/a&b<c'])
    expect(xml).toContain('<loc>https://www.chordscalemaker.com/a&amp;b&lt;c</loc>')
  })
})
