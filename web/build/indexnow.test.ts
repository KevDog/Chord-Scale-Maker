import { describe, expect, it } from 'vitest'
import { libraryCharts } from './ogCard'
import { indexNowLibrary, MAX_URLS, urlsFor } from './indexnow'

const lib = indexNowLibrary(libraryCharts())
const site = (path: string): string => `https://www.chordscalemaker.com${path}`

describe('urlsFor: the pages a deploy changed, for IndexNow', () => {
  it('pings a changed chart’s song, its composers and its scales', () => {
    const urls = urlsFor(['engine/charts/autumn-leaves.txt'], lib)
    expect(urls).toEqual(expect.arrayContaining([
      site('/song/autumn-leaves'), site('/composers/joseph-kosma'), site('/scales/dorian'), site('/sitemap.xml'),
    ]))
    expect(urls).not.toContain(site('/song/blue-bossa'))
  })

  it('pings every song and scale when the engine or its scale data changes', () => {
    for (const path of ['engine/chord_scales.json', 'engine/src/scales.ts']) {
      const urls = urlsFor([path], lib)
      expect(urls).toEqual(expect.arrayContaining([site('/song/autumn-leaves'), site('/song/blue-bossa'), site('/scales/lydian-dominant')]))
      expect(urls.filter((u) => u.includes('/song/'))).toHaveLength(lib.slugs.length)
    }
  })

  it('ignores the engine’s tests, scripts and fixtures', () => {
    expect(urlsFor(['engine/src/__tests__/api.test.ts', 'engine/fixtures/golden.json', 'engine/scripts/analyse.ts'], lib)).toEqual([site('/sitemap.xml')])
  })

  it('pings a changed page’s own address', () => {
    expect(urlsFor(['web/app/pages/help.vue'], lib)).toEqual([site('/help'), site('/sitemap.xml')])
    expect(urlsFor(['web/app/pages/index.vue'], lib)).toEqual([site('/'), site('/sitemap.xml')])
    expect(urlsFor(['web/app/pages/scales/index.vue'], lib)).toEqual([site('/scales'), site('/sitemap.xml')])
  })

  it('pings every page a changed dynamic page draws, and none that isn’t in the sitemap', () => {
    expect(urlsFor(['web/app/pages/composers/[slug].vue'], lib)).toContain(site('/composers/joseph-kosma'))
    expect(urlsFor(['web/app/pages/song/[[slug]].vue'], lib).filter((u) => u.includes('/song/'))).toHaveLength(lib.slugs.length)
    expect(urlsFor(['web/app/pages/ui.vue'], lib)).toEqual([site('/sitemap.xml')])
  })

  it('pings just the sitemap when nothing a page shows changed', () => {
    expect(urlsFor(['README.md'], lib)).toEqual([site('/sitemap.xml')])
    expect(urlsFor([], lib)).toEqual([site('/sitemap.xml')])
  })

  it('pings the whole sitemap on the first deploy', () => {
    const urls = urlsFor(null, lib)
    expect(urls).toEqual(expect.arrayContaining([site('/'), site('/library'), site('/composers'), site('/song/autumn-leaves'), site('/sitemap.xml')]))
    expect(urls.length).toBe(lib.sitemap.length + 1)
  })

  it('lists each address once, absolute, and no more than IndexNow takes', () => {
    const urls = urlsFor(['engine/chord_scales.json', 'engine/charts/autumn-leaves.txt', 'web/app/pages/song/[[slug]].vue'], lib)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.every((u) => u.startsWith('https://www.chordscalemaker.com/'))).toBe(true)
    const many = { ...lib, slugs: Array.from({ length: 20_000 }, (_, i) => `tune-${i}`) }
    expect(urlsFor(['engine/chord_scales.json'], many)).toHaveLength(MAX_URLS)
  })
})

describe('versions (#411)', () => {
  it('leaves a version out of the sitemap, and pings its main page when it changes', () => {
    expect(lib.sitemap).toContain('/song/summertime')
    expect(lib.sitemap).not.toContain('/song/summertime-jazz-mind-accelerator')
    expect(urlsFor(['engine/charts/summertime-jazz-mind-accelerator.txt'], lib)).toContain(site('/song/summertime'))
    expect(urlsFor(['engine/charts/summertime-jazz-mind-accelerator.txt'], lib)).not.toContain(site('/song/summertime-jazz-mind-accelerator'))
  })
})
