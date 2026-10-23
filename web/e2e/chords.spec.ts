import { chooseInstrument, expect, staves, test } from './fixtures'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a chord page is all there in its HTML: notes, its scales, the tunes', async ({ page }) => {
    await page.goto('/chords/minor-7')
    await expect(page.getByRole('heading', { name: 'Minor 7th chord', level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Minor 7th on C' }).getByRole('listitem')).toHaveCount(4)
    await expect(page.getByRole('list', { name: 'Minor 7th on C' })).toContainText('B♭')
    await expect(page.locator('main h2')).toHaveText(['Notes', 'Practice it', 'Scales', 'Tunes'])
    await expect(page.getByRole('region', { name: 'Scales' }).getByRole('link', { name: 'C Dorian', exact: true })).toHaveAttribute('href', '/scales/dorian')
    await expect(page.getByRole('region', { name: 'Tunes' }).getByRole('link').first()).toHaveAttribute('href', /^\/song\//)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.chordscalemaker.com/chords/minor-7')
  })

  test('a chord page’s link preview is its own, served at 1200×630 (#524)', async ({ page, request }) => {
    await page.goto('/chords/minor-7')
    await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute('content', 'https://www.chordscalemaker.com/og/chords/minor-7.png')
    const png = await (await request.get('/og/chords/minor-7.png')).body()
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]) // the IHDR's width and height
  })

  test('/chords lists every chord in the sitemap', async ({ page, request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    const paths = [...xml.matchAll(/<loc>https:\/\/www\.chordscalemaker\.com(\/chords\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(15)
    await page.goto('/chords')
    await expect(page.getByRole('heading', { name: 'Chords', level: 1 })).toBeVisible()
    for (const p of paths) await expect(page.locator(`main a[href="${p}"]`)).toHaveCount(1)
  })

  test("a scale page's Plays over chords link to their pages", async ({ page }) => {
    await page.goto('/scales/dorian')
    await expect(page.getByRole('region', { name: 'Plays over' }).locator('a[href="/chords/minor-7"]')).toHaveCount(1)
  })
})

test('a chord page draws its staff, written for the instrument', async ({ page }) => {
  await page.goto('/chords/minor-7')
  await expect(staves(page)).toHaveCount(1)
  const practice = page.getByRole('region', { name: 'Practice it' })
  await expect(practice).toContainText('C Dorian')
  await chooseInstrument(page, 'Tenor')
  await expect(practice).toContainText('D Dorian')
  await expect(practice.getByText('Spell Scale')).toHaveCount(0) // a reference page spells from the root
})

test('Chords is in the menu bar, beside Scales', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Chords' }).click()
  await expect(page.getByRole('heading', { name: 'Chords', level: 1 })).toBeVisible()
})

test('on a phone, the chord editor links to the chord’s page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/song?new=1')
  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'About this chord' })).toHaveAttribute('href', '/chords/minor-7')
})

test.describe('an unknown chord', () => {
  test.use({ expectedConsoleError: /status of 404|NUXT_E1005/ })
  test('is not found', async ({ page }) => {
    const res = await page.goto('/chords/no-such-chord')
    expect(res?.status()).toBe(404)
  })
})
