import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { SITE_URL, songPath } from '../app/utils/site'
import { expect, test } from './fixtures'

// the engine can't be imported here (its JSON import needs a bundler): read its charts/ through the package
const CHARTS = new URL('charts/', pathToFileURL(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json')))
const SLUGS = readdirSync(CHARTS)
  .filter((f) => f.endsWith('.txt') && !/ \d+\.txt$/.test(f)) // not an iCloud sync copy (isSyncCopy)
  .map((f) => f.replace(/\.txt$/, ''))

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }
const attr = (html: string, tag: RegExp, name: string): string | undefined =>
  html
    .match(tag)?.[0]
    .match(new RegExp(`${name}="([^"]*)"`))?.[1]
    ?.replace(/&(?:amp|quot|#39|lt|gt);/g, (e) => ENTITIES[e] ?? e)

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a song is all there in its HTML: heading, composer, lead-sheet note, structured data, canonical, indexable', async ({ page }) => {
    await page.goto('/song/blue-trane')
    await expect(page.getByRole('heading', { name: 'Blue Trane', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'John Coltrane', exact: true })).toHaveAttribute('href', '/composers/john-coltrane')
    await expect(page.getByRole('heading', { name: 'Chord changes (lead-sheet style)', level: 2 })).toBeVisible()
    await expect(page.getByText(/without the melody/)).toContainText('also known as Blue Train')
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/blue-trane`)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'index, follow, max-image-preview:large')
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /lead-sheet/)
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent()) ?? '[]') as { '@type': string }[]
    expect(ld.map((d) => d['@type'])).toContain('MusicComposition')
  })

  test('a song names its notable recording, in the page and its structured data', async ({ page }) => {
    await page.goto('/song/blue-trane')
    await expect(page.getByRole('heading', { name: 'Recording', level: 2 })).toBeVisible()
    await expect(page.getByText('John Coltrane, Blue Train (Blue Note, 1958).')).toBeVisible()
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent()) ?? '[]') as { '@type': string; recordedAs?: { inAlbum: { name: string } } }[]
    expect(ld.find((d) => d['@type'] === 'MusicComposition')?.recordedAs?.inAlbum.name).toBe('Blue Train')
  })

  test('a song gives its chord changes bar by bar', async ({ page }) => {
    await page.goto('/song/blue-trane')
    const bars = page.getByRole('list', { name: 'A, bar by bar' }).getByRole('listitem')
    await expect(bars).toHaveCount(12)
    await expect(bars.first()).toHaveText('E♭7(♯9)')
    await expect(bars.nth(1)).toHaveText('%')
  })
})

test('/song itself, a new chart and a share link stay out of search; a query keeps the clean canonical', async ({ page, request }) => {
  for (const url of ['/song?new=1', '/song']) {
    await page.goto(url)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  }
  // an old underscore address is a duplicate of the clean one (in the browser it moves to the clean one)
  const old = await (await request.get('/song/autumn_leaves')).text()
  expect(attr(old, /<meta name="robots"[^>]*>/, 'content')).toBe('noindex')
  await page.goto('/song/autumn-leaves?mine=x')
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/autumn-leaves`)
})

test('old tune pages move to the song', async ({ request }) => {
  const res = await request.get('/tunes/autumn-leaves', { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(res.headers().location).toMatch(/\/song\/autumn-leaves$/)
})

test('every sitemap URL is a page: 200, its own canonical, indexable, its own title and a description', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const locs = Array.from((await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1] as string)
  for (const slug of SLUGS) expect(locs, slug).toContain(`${SITE_URL}${songPath(slug)}`)

  const titles = new Map<string, string>()
  for (const loc of locs) {
    expect(loc.startsWith(SITE_URL), loc).toBe(true)
    const res = await request.get(loc.slice(SITE_URL.length) || '/')
    expect(res.status(), loc).toBe(200)
    const html = await res.text()
    expect(attr(html, /<link rel="canonical"[^>]*>/, 'href'), loc).toBe(loc)
    expect(attr(html, /<meta name="robots"[^>]*>/, 'content') ?? '', loc).not.toMatch(/noindex/)
    const description = attr(html, /<meta name="description"[^>]*>/, 'content') ?? ''
    expect(description.length, loc).toBeGreaterThanOrEqual(70)
    expect(description.length, loc).toBeLessThanOrEqual(160)
    if (loc.includes('/song/')) expect(description, loc).toContain('lead-sheet')
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
    expect(title, loc).not.toBe('')
    expect(titles.get(title), `${loc} has the title of`).toBeUndefined()
    titles.set(title, loc)
  }
})

test('the home page carries the tagline, and the link preview image is served at 1200×630', async ({ page, request }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Chord Scale Maker: Endless Practice Sheets for Jazz Standards')
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /^Endless improvisation practice sheets for jazz standards: /)
  const image = await page.locator('head meta[property="og:image"]').getAttribute('content')
  expect(image).toBe(`${SITE_URL}/og-image.png`)
  await expect(page.locator('head meta[name="twitter:image"]')).toHaveAttribute('content', image ?? '')
  const png = await (await request.get('/og-image.png')).body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]) // the IHDR's width and height
  const manifest = (await (await request.get('/site.webmanifest')).json()) as { description: string }
  expect(manifest.description).toBe('Endless improvisation practice sheets for jazz standards')
})

test('pages load nothing from another origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin
  const elsewhere: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('data:') && new URL(r.url()).origin !== origin) elsewhere.push(r.url())
  })
  for (const path of ['/', '/song/blue-trane', '/help']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  expect(elsewhere).toEqual([])
})

test('robots.txt is served and names the sitemap', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
})
