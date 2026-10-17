import { expect, test } from './fixtures'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test("a composer page lists their tunes, each co-writer linked", async ({ page }) => {
    await page.goto('/composers/thelonious-monk')
    await expect(page.getByRole('heading', { name: 'Thelonious Monk', level: 1 })).toBeVisible()
    await expect(page.getByText(/^\d+ tunes in the library/)).toBeVisible()
    const row = page.getByRole('row').filter({ has: page.locator('a[href="/song/round-midnight"]') })
    await expect(row).toContainText('Cootie Williams')
    await expect(row.getByRole('link', { name: 'Cootie Williams' })).toHaveAttribute('href', '/composers/cootie-williams')
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.chordscalemaker.com/composers/thelonious-monk')
    await expect(page).toHaveTitle(/^Thelonious Monk: tunes, changes and chord scales/)
  })

  test('/composers files everyone by surname, under an A–Z bar, as the sitemap lists them', async ({ page, request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    const paths = [...xml.matchAll(/<loc>https:\/\/www\.chordscalemaker\.com(\/composers\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(100)
    await page.goto('/composers')
    await expect(page.getByRole('heading', { name: 'Composers', level: 1 })).toBeVisible()
    for (const p of paths) await expect(page.locator(`main a[href="${p}"]`)).toHaveCount(1)
    const bar = page.getByRole('navigation', { name: 'Jump to letter' })
    await expect(bar.getByRole('link', { name: 'M', exact: true })).toHaveAttribute('href', '#letter-M')
    // Gene de Paul files under P
    await expect(page.getByRole('region', { name: 'P', exact: true }).getByRole('link', { name: 'Gene de Paul' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'M', exact: true }).getByRole('link', { name: 'Thelonious Monk' })).toBeVisible()
  })
})

test('a composer in the library opens their page', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('row').filter({ has: page.locator('a[href="/song/round-midnight"]') }).getByRole('link', { name: 'Thelonious Monk' }).click()
  await expect(page.getByRole('heading', { name: 'Thelonious Monk', level: 1 })).toBeVisible()
})


test("the song's composer line links on screen and prints plain", async ({ page }) => {
  await page.goto('/song/round-midnight')
  const heading = page.locator('main header').filter({ has: page.getByRole('heading', { level: 1 }) })
  await expect(heading.getByRole('link', { name: 'Thelonious Monk' })).toHaveAttribute('href', '/composers/thelonious-monk')
  await page.emulateMedia({ media: 'print' })
  await expect(heading.getByRole('link')).toHaveCount(0)
  await expect(heading).toContainText('Thelonious Monk & Cootie Williams', { useInnerText: true })
})

test('the footer links to the composers', async ({ page }) => {
  await page.goto('/about')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Composers' }).click()
  await expect(page.getByRole('heading', { name: 'Composers', level: 1 })).toBeVisible()
})

test.describe('an unknown composer', () => {
  test.use({ expectedConsoleError: /status of 404|NUXT_E1005/ })
  test('is not found', async ({ page }) => {
    const res = await page.goto('/composers/no-such-composer')
    expect(res?.status()).toBe(404)
  })
})
