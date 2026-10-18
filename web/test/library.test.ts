import { readdirSync, readFileSync } from 'node:fs'
import { composerIndex, isSyncCopy } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { findChart, keyName, LIBRARY, matchSpan, searchLibrary, suggestTunes, toLibrary, toTunes, tuneDetails, tuneOf, TUNES } from '~/utils/library'
import { songPath } from '~/utils/site'
import { sitemapPaths, sitemapXml, chartSlugsOf } from '~/utils/sitemap'
import { COMPOSERS } from '~/utils/composerPage'

describe('library', () => {
  it('builds entries from chart files, sorted by title', () => {
    const lib = toLibrary({ '../x/b.txt': 'title: Beta\n\nsection: A\nbars: 4\n1 | C', '../x/a.txt': 'title: Álpha\nsubtitle: S\n\nsection: A\nbars: 4\n1 | C' })
    expect(lib.map((c) => [c.slug, c.title, c.subtitle])).toEqual([
      ['a', 'Álpha', 'S'],
      ['b', 'Beta', ''],
    ])
  })

  it('leaves out the source: line, which is for internal use only', () => {
    const [chart] = toLibrary({ 'a.txt': 'title: A\nsource: Some Book, p. 12\n# source: earlier from Another, p. 3\nkey: C\n\nsection: A\nbars: 4\n1 | C' })
    expect(chart?.text).toBe('title: A\nkey: C\n\nsection: A\nbars: 4\n1 | C')
  })

  it('ships no library chart with a source: line', () => {
    expect(LIBRARY.filter((c) => /^(#\s*)?source:/m.test(c.text)).map((c) => c.slug)).toEqual([])
  })

  it('files a title with a leading apostrophe under its letter', () => {
    const lib = toLibrary({ 'q.txt': 'title: Quiet', 'r.txt': "title: 'Round Midnight", 's.txt': 'title: Ruby', 'a.txt': 'title: Alpha' })
    expect(lib.map((c) => c.slug)).toEqual(['a', 'q', 'r', 's'])
  })

  it('builds the details from style, key and form, whatever the subtitle', () => {
    const [chart] = toLibrary({ 'a.txt': 'title: A\nsubtitle: AABA, 36 Bars\nstyle: Ballad\nkey: Ab\nform: AABC' })
    expect(chart?.details).toBe('Ballad · A♭ · AABC')
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

  it('keeps the key as written, for the written-key column', () => {
    const [chart] = toLibrary({ 'a.txt': 'title: A\nkey: Ebm' })
    expect(chart?.key).toBe('Ebm')
  })

  it('suggests title starts first, then word starts, then other matches, then composers', () => {
    const lib = toLibrary({
      'composer.txt': 'title: Zed\ncomposer: Star Man',
      'inside.txt': 'title: Upstart',
      'word.txt': 'title: Stella by Starlight',
      'start.txt': 'title: Stardust',
      'aka.txt': 'title: Quux\naka: Lodestar',
    })
    expect(suggestTunes(lib, 'star', 10).tunes.map((c) => c.slug)).toEqual(['start', 'word', 'aka', 'inside', 'composer'])
  })

  it('suggests at most the limit, and counts every match', () => {
    const lib = toLibrary({ 'a.txt': 'title: Blue A', 'b.txt': 'title: Blue B', 'c.txt': 'title: Blue C' })
    const { tunes, total } = suggestTunes(lib, 'blue', 2)
    expect([tunes.map((c) => c.slug), total]).toEqual([['a', 'b'], 3])
  })

  it('suggests nothing for a blank query', () => {
    expect(suggestTunes(LIBRARY, '  ', 6)).toEqual({ tunes: [], total: 0 })
  })

  it('finds where a query matches a title, ignoring case and accents', () => {
    expect(matchSpan('Stella by Starlight', ' STAR ')).toEqual([10, 14])
    expect(matchSpan('Álpha', 'alp')).toEqual([0, 3])
    expect(matchSpan('Beta', 'zz')).toBeNull()
    expect(matchSpan('Beta', ' ')).toBeNull()
  })

  it('names a key short, with real accidentals', () => {
    expect(['Bb', 'F#m', 'C', ''].map(keyName)).toEqual(['B♭', 'F♯m', 'C', ''])
  })

  it('searches other titles too', () => {
    const lib = toLibrary({ 'a.txt': 'title: Blue Trane\naka: Blue Train; Trane Blues', 'b.txt': 'title: Beta' })
    expect(searchLibrary(lib, 'train').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, 'trane blues').map((c) => c.slug)).toEqual(['a'])
  })

  it('includes the repo charts', () => {
    expect(LIBRARY.map((c) => c.slug)).toContain('autumn-leaves')
    expect(findChart('autumn-leaves')?.title).toBe('Autumn Leaves')
    expect(findChart('nope')).toBeUndefined()
  })

  it('includes every chart in the engine package, and nothing else', () => {
    // cwd-relative (the cwd is web/): import.meta.url isn't a file: URL in the nuxt environment
    const files = readdirSync('../engine/charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    expect(files.length).toBeGreaterThan(200)
    expect(LIBRARY.map((c) => `${c.slug}.txt`).sort()).toEqual([...files].sort())
  })

  it('names every chart file in lowercase with hyphens (round-midnight.txt)', () => {
    const bad = readdirSync('../engine/charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f) && !/^[a-z0-9]+(-[a-z0-9]+)*\.txt$/.test(f))
    expect(bad).toEqual([])
  })

  it('maps every library chart to its own song path, in the sitemap, and back', () => {
    const files = readdirSync('../engine/charts')
    const paths = sitemapPaths(chartSlugsOf(files).map((s) => songPath(s)), [])
    expect(new Set(LIBRARY.map((c) => songPath(c.slug))).size).toBe(LIBRARY.length)
    for (const c of LIBRARY) {
      expect(paths).toContain(songPath(c.slug))
      expect(findChart(c.slug)).toBe(c)
    }
    const locs = [...sitemapXml(paths).matchAll(/<loc>https:\/\/[^/]+(\/song\/.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs.sort()).toEqual(LIBRARY.map((c) => songPath(c.slug)).sort())
  })

  it("the config's composers, from the raw chart files, are the library's (nuxt.config.ts lists them for the sitemap)", () => {
    const charts = chartSlugsOf(readdirSync('../engine/charts')).map((slug) => ({ slug, text: readFileSync(`../engine/charts/${slug}.txt`, 'utf8') }))
    expect(composerIndex(charts).map((c) => c.slug)).toEqual(COMPOSERS.map((c) => c.slug))
  })
})

describe('tunes (#411): one row per tune, its versions folded in', () => {
  const body = '\n\nsection: A\nbars: 4\n1 | C'
  const lib = toLibrary({
    'summertime.txt': `title: Summertime\ncomposer: George Gershwin${body}`,
    'summertime-jla.txt': `title: Summertime\naka: Summer Time\nversion: Jazz Lab Accelerator${body}`,
    'autumn-leaves.txt': `title: Autumn Leaves${body}`,
  })

  it('keeps the main chart, in library order, with its count of versions', () => {
    expect(toTunes(lib).map((t) => [t.slug, t.versions])).toEqual([
      ['autumn-leaves', 1],
      ['summertime', 2],
    ])
  })

  it('finds a tune once by any version\'s title or aka:', () => {
    expect(searchLibrary(toTunes(lib), 'summer time').map((t) => t.slug)).toEqual(['summertime'])
    expect(suggestTunes(toTunes(lib), 'summer', 10).tunes.map((t) => t.slug)).toEqual(['summertime'])
  })

  it('says how many versions a row stands for', () => {
    const [autumn, summertime] = toTunes(lib)
    expect(tuneDetails(summertime!)).toBe('2 versions')
    expect(tuneDetails({ ...summertime!, details: 'Ballad · Am' })).toBe('Ballad · Am · 2 versions')
    expect(tuneDetails(autumn!)).toBe(autumn!.details)
  })

  it('lists Summertime once, with its Jazz Lab Accelerator version', () => {
    expect(TUNES.filter((t) => t.title === 'Summertime').map((t) => [t.slug, t.versions])).toEqual([['summertime', 2]])
    expect(TUNES.length).toBe(LIBRARY.length - 1)
  })

  it('gives a chart its tune: the main and every version', () => {
    expect(tuneOf('summertime-jazz-lab-accelerator')).toEqual({ main: 'summertime', versions: [{ slug: 'summertime', label: '' }, { slug: 'summertime-jazz-lab-accelerator', label: 'Jazz Lab Accelerator' }] })
    expect(tuneOf('blue-trane')?.versions).toHaveLength(1)
    expect(tuneOf('nope')).toBeNull()
  })
})
