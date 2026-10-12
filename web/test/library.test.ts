import { readdirSync } from 'node:fs'
import { isSyncCopy } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { findChart, findTune, LIBRARY, searchLibrary, toLibrary, TUNE_PATHS } from '~/utils/library'
import { tunePath } from '~/utils/site'
import { sitemapPaths, sitemapXml, tunePathsOf } from '~/utils/sitemap'

describe('library', () => {
  it('builds entries from chart files, sorted by title', () => {
    const lib = toLibrary({ '../x/b.txt': 'title: Beta\nA | 1 | C', '../x/a.txt': 'title: Álpha\nsubtitle: S\nA | 1 | C' })
    expect(lib.map((c) => [c.slug, c.title, c.subtitle])).toEqual([
      ['a', 'Álpha', 'S'],
      ['b', 'Beta', ''],
    ])
  })

  it('shows the heading line and the composer', () => {
    const [chart] = toLibrary({ 'a.txt': 'title: A\ncomposer: Bronisław Kaper\nstyle: Ballad\nkey: Ebm\nform: ABAC' })
    expect([chart?.subtitle, chart?.composer]).toEqual(['Ballad · E♭ minor · ABAC', 'Bronisław Kaper'])
  })

  it('searches titles and composers ignoring case and accents', () => {
    const lib = toLibrary({ 'a.txt': 'title: Álpha\ncomposer: Bronisław Kaper', 'b.txt': 'title: Beta' })
    expect(searchLibrary(lib, 'ALP').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, 'kaper').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, '  ').map((c) => c.slug)).toEqual(['a', 'b'])
    expect(searchLibrary(lib, 'zzz')).toEqual([])
  })

  it('searches other titles too', () => {
    const lib = toLibrary({ 'a.txt': 'title: Blue Trane\naka: Blue Train; Trane Blues', 'b.txt': 'title: Beta' })
    expect(searchLibrary(lib, 'train').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, 'trane blues').map((c) => c.slug)).toEqual(['a'])
  })

  it('includes the repo charts', () => {
    expect(LIBRARY.map((c) => c.slug)).toContain('autumn_leaves')
    expect(findChart('autumn_leaves')?.title).toBe('Autumn Leaves')
    expect(findChart('nope')).toBeUndefined()
  })

  it('includes every chart in the engine package, and nothing else', () => {
    // cwd-relative (the cwd is web/): import.meta.url isn't a file: URL in the nuxt environment
    const files = readdirSync('../engine/charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    expect(files.length).toBeGreaterThan(200)
    expect(LIBRARY.map((c) => `${c.slug}.txt`).sort()).toEqual([...files].sort())
  })

  it('gives each chart a tune page at a hyphenated path', () => {
    expect(tunePath('blue_trane')).toBe('/tunes/blue-trane')
    expect(findTune('blue-trane')?.slug).toBe('blue_trane')
    expect(findTune('blue_trane')).toBeUndefined()
    expect(findTune('no-such-tune')).toBeUndefined()
  })

  it('maps every library chart to its own tune path, and back', () => {
    const paths = LIBRARY.map((c) => tunePath(c.slug))
    expect(new Set(paths).size).toBe(LIBRARY.length)
    for (const c of LIBRARY) expect(findTune(tunePath(c.slug).replace('/tunes/', ''))).toBe(c)
  })

  it('lists one tune path per chart file, the same list the config prerenders and the sitemap carries', () => {
    const files = readdirSync('../engine/charts')
    expect(TUNE_PATHS.length).toBe(LIBRARY.length)
    expect([...TUNE_PATHS].sort()).toEqual([...tunePathsOf(files)].sort())
    const locs = [...sitemapXml(sitemapPaths(tunePathsOf(files))).matchAll(/<loc>https:\/\/[^/]+(\/tunes\/.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs.sort()).toEqual([...TUNE_PATHS].sort())
  })
})
