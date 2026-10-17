import type { Page } from '@playwright/test'
import { expect, staves, test } from './fixtures'

// the offline worker (#324); the other specs block service workers (playwright.config.ts)
test.use({ serviceWorkers: 'allow' })

/** open the site and wait for its worker to precache the app and take control of the page */
async function installed(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  })
}

test('is installable: a manifest with a standalone display and icons', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await page.request.get(href ?? '')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.short_name).toBe('Chord Scale Maker') // the Home Screen label: iOS reads it over apple-mobile-web-app-title
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
})

test('offline, the library opens and a tune never visited opens from it', async ({ page, context }) => {
  await installed(page)
  await context.setOffline(true)
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('autumn')
  await page.getByRole('link', { name: 'Autumn Leaves', exact: true }).click()
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await expect(staves(page)).toHaveCount(6)
})

test('offline, a song never visited opens its chart from the app shell', async ({ page, context }) => {
  await installed(page)
  await context.setOffline(true)
  await page.goto('/song/on-green-dolphin-street')
  await expect(page.getByRole('heading', { name: 'On Green Dolphin Street' })).toBeVisible()
  await expect(staves(page).first()).toBeVisible()
})

test('offline, Help says how to add it to the home screen', async ({ page, context }) => {
  await installed(page)
  await context.setOffline(true)
  await page.goto('/help')
  await expect(page.getByText('Share → Add to Home Screen')).toBeVisible()
})
