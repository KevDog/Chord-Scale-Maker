import { chooseInstrument, expect, staves, test } from './fixtures'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a scale page is all there in its HTML: notes, what it plays over, the tunes', async ({ page }) => {
    await page.goto('/scales/dorian')
    await expect(page.getByRole('heading', { name: 'Dorian scale', level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Dorian on C' }).getByRole('listitem')).toHaveCount(7)
    await expect(page.getByRole('list', { name: 'Dorian on C' })).toContainText('E♭')
    await expect(page.getByRole('region', { name: 'Plays over' })).toContainText('C–7')
    await expect(page.locator('main h2')).toHaveText(['Notes', 'Practice it', 'Plays over', 'Tunes'])
    const tunes = page.getByRole('region', { name: 'Tunes' }).getByRole('link')
    await expect(tunes.first()).toHaveAttribute('href', /^\/song\//)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.chordscalemaker.com/scales/dorian')
  })

  test('a scale no library tune plays at Standard says so', async ({ page }) => {
    await page.goto('/scales/diatonic-diminished-i-optional')
    await expect(page.getByText('No library tune plays it at the Standard level yet')).toBeVisible()
  })

  test('/scales lists every scale in the sitemap', async ({ page, request }) => {
    // the engine can't load under Playwright (its JSON import): the sitemap lists every scale page
    const xml = await (await request.get('/sitemap.xml')).text()
    const paths = [...xml.matchAll(/<loc>https:\/\/www\.chordscalemaker\.com(\/scales\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(30)
    await page.goto('/scales')
    await expect(page.getByRole('heading', { name: 'Scales', level: 1 })).toBeVisible()
    for (const p of paths) await expect(page.locator(`main a[href="${p}"]`)).toHaveCount(1)
  })
})

test('a scale page draws its staff, written for the instrument', async ({ page }) => {
  await page.goto('/scales/dorian')
  await expect(staves(page)).toHaveCount(1)
  const practice = page.getByRole('region', { name: 'Practice it' })
  await expect(practice).toContainText('C Dorian')
  await chooseInstrument(page, 'Tenor')
  await expect(practice).toContainText('D Dorian')
  await expect(practice.getByText('Spell Scale')).toHaveCount(0) // a reference page spells from the root
})

test.describe('an unknown scale', () => {
  test.use({ expectedConsoleError: /status of 404|NUXT_E1005/ })
  test('is not found', async ({ page }) => {
    const res = await page.goto('/scales/no-such-scale')
    expect(res?.status()).toBe(404)
  })
})

test('the footer and the Functions page link to the scales', async ({ page }) => {
  await page.goto('/functions')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Scales' }).click()
  await expect(page.getByRole('heading', { name: 'Scales', level: 1 })).toBeVisible()
  await page.goto('/functions')
  await expect(page.locator('main a[href="/scales/dorian"]').first()).toBeVisible()
})
