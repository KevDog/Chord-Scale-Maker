import { CHORD_QUALITIES, SCALES } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { canonicalUrl } from '~/utils/site'
import { chartSlugsOf, sitemapPaths, sitemapXml, songSlugs } from '~/utils/sitemap'

describe('sitemapXml', () => {
  it('is an XML urlset in the sitemap namespace', () => {
    const xml = sitemapXml(['/'])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('lists each path once, at its canonical URL', () => {
    const locs = [...sitemapXml(['/', '/help', '/song/blue-trane', '/help']).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual(['/', '/help', '/song/blue-trane'].map(canonicalUrl))
  })

  it('escapes & and <', () => {
    const xml = sitemapXml(['/a&b<c'])
    expect(xml).toContain('<loc>https://www.chordscalemaker.com/a&amp;b&lt;c</loc>')
  })
})

describe('sitemap paths', () => {
  it('lists the chart files’ names, skipping other files and sync copies', () => {
    expect(chartSlugsOf(['blue-trane.txt', 'README.md', 'so-what 2.txt'])).toEqual(['blue-trane'])
  })

  it('lists the site pages, then the scales, the composers, then the songs', () => {
    const paths = sitemapPaths(['/song/a'], ['thelonious-monk'])
    expect(paths.slice(0, 10)).toEqual(['/', '/library', '/help', '/how-it-decides', '/release-notes', '/functions', '/about', '/contact', '/privacy', '/scales'])
    expect(paths).toContain('/scales/dorian')
    expect(paths).toContain('/scales/diatonic-diminished-sharp-iv')
    expect(paths.filter((p) => p.startsWith('/scales/'))).toHaveLength(Object.keys(SCALES).length)
    expect(paths).toContain('/chords')
    expect(paths).toContain('/chords/half-diminished')
    expect(paths.filter((p) => p.startsWith('/chords/'))).toHaveLength(CHORD_QUALITIES.length)
    expect(paths.slice(-3)).toEqual(['/composers', '/composers/thelonious-monk', '/song/a'])
  })
})

describe('songSlugs (#411)', () => {
  const chart = (slug: string, head: string) => ({ slug, text: `${head}\n\nsection: A\nbars: 4\n1 | C\n` })
  it('lists each tune\'s main chart for the sitemap, and its versions apart (prerendered, not listed)', () => {
    expect(songSlugs([chart('b', 'title: B'), chart('a-v', 'title: A\nversion: V'), chart('a', 'title: A')])).toEqual({ main: ['a', 'b'], versions: ['a-v'] })
  })
})
