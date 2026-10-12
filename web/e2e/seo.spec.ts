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

const attr = (html: string, tag: RegExp, name: string): string | undefined => html.match(tag)?.[0].match(new RegExp(`${name}="([^"]*)"`))?.[1]

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a song is all there in its HTML: heading, composer, structured data, canonical, indexable', async ({ page }) => {
    await page.goto('/song/blue-trane')
    await expect(page.getByRole('heading', { name: 'Blue Trane', level: 1 })).toBeVisible()
    await expect(page.getByText('John Coltrane', { exact: true })).toBeVisible()
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/blue-trane`)
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0)
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent()) ?? '[]') as { '@type': string }[]
    expect(ld.map((d) => d['@type'])).toContain('MusicComposition')
  })
})

test('/song itself, a new chart and a share link stay out of search; a query keeps the clean canonical', async ({ page }) => {
  for (const url of ['/song?new=1', '/song']) {
    await page.goto(url)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  }
  await page.goto('/song/autumn_leaves') // an old underscore address is a duplicate of the clean one
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex')
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
    expect(attr(html, /<meta name="description"[^>]*>/, 'content'), loc).toBeTruthy()
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
    expect(title, loc).not.toBe('')
    expect(titles.get(title), `${loc} has the title of`).toBeUndefined()
    titles.set(title, loc)
  }
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
