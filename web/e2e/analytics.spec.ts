import type { BrowserContext, Page } from '@playwright/test'
import { chooseInstrument, chooseInterface, chooseSheet, expect, test } from './fixtures'

// production builds load Vercel's script; here a recording window.va stands in for it (e2e builds turn analyticsEvents on)
type Call = [string, Record<string, unknown>]
const recordVa = (context: BrowserContext | Page) =>
  context.addInitScript(() => {
    const w = window as unknown as { va: unknown; vaCalls: unknown[] }
    w.vaCalls = []
    w.va = (...a: unknown[]) => w.vaCalls.push(a)
  })
test.beforeEach(({ page }) => recordVa(page))
const calls = (page: Page): Promise<Call[]> => page.evaluate(() => (window as unknown as { vaCalls: Call[] }).vaCalls)
const pageviews = async (page: Page) => (await calls(page)).filter(([k]) => k === 'pageview').map(([, p]) => p)
const events = async (page: Page) => (await calls(page)).filter(([k]) => k === 'event').map(([, e]) => e)

test('one page view per page shown, with its route', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => pageviews(page)).toEqual([{ route: '/', path: '/' }])
  await page.goto('/scales')
  await page.locator('main a[href="/scales/dorian"]').first().click() // an in-app navigation
  await expect(page).toHaveURL(/\/scales\/dorian/)
  await expect.poll(() => pageviews(page)).toEqual([
    { route: '/scales', path: '/scales' },
    { route: '/scales/[slug]', path: '/scales/dorian' },
  ])
})

test('a song page is counted under its route', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect.poll(() => pageviews(page)).toEqual([{ route: '/song/[slug]', path: '/song/autumn-leaves' }])
})

// /song is prerendered without its query: while it hydrates the router briefly shows a bare /song (song/[[slug]].vue)
test('a /song address with a query is counted once, as itself', async ({ page }) => {
  await page.goto('/song?new=1')
  await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
  await page.waitForLoadState('networkidle') // a late duplicate would land by now
  expect(await pageviews(page)).toEqual([{ route: '/song/[slug]', path: '/song' }])
  await page.goto('/song?chart=autumn-leaves')
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await page.waitForLoadState('networkidle')
  // an old ?chart= link: /song, then the tune it moves to (never a phantom /library)
  expect(await pageviews(page)).toEqual([
    { route: '/song/[slug]', path: '/song' },
    { route: '/song/[slug]', path: '/song/autumn-leaves' },
  ])
})

test('actions send one anonymous event each, none on load', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
  expect(await events(page)).toEqual([])
  await chooseSheet(page, 'Scales')
  await chooseInstrument(page, 'Tenor')
  await chooseInstrument(page, 'Trombone')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=/)
  await expect.poll(() => events(page)).toEqual([
    { name: 'Sheet chosen', data: { sheet: 'scales' } },
    { name: 'Instrument chosen', data: { instrument: 'tenor-sax' } },
    { name: 'Share created', data: { song: 'autumn-leaves' } },
  ])

  const fresh = await browser.newContext()
  await chooseInterface(fresh, 'everything')
  await recordVa(fresh)
  const visitor = await fresh.newPage()
  await visitor.goto(await box.inputValue())
  // the library chart as published, so it may be named; the title never is
  await expect.poll(() => events(visitor)).toEqual([{ name: 'Shared link opened', data: { song: 'autumn-leaves' } }])
  expect(JSON.stringify(await calls(visitor))).not.toContain('Autumn')
  expect(JSON.stringify(await calls(visitor))).not.toContain('#s=')
})
