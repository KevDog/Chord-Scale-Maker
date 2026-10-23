import { chooseInstrument, chooseRhythm, chooseSheet, expect, staves, test } from './fixtures'

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

// the Scales sheet's rhythm card (rhythm-scales-arpeggios spec §1, §6, §9; flag `rhythmSheets`)
test.describe('the Scales sheet’s rhythm', () => {
  test.use({ interfaceLevel: 'intermediate' })

  test('a rhythm card under each staff', async ({ page }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await expect(staves(page).first()).toBeVisible()
    await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
    const count = await page.locator('[data-slot=scale-staff]').count()
    expect(count).toBeGreaterThan(0)
    await expect(page.locator('[data-slot=scale-staff]:not(:has([data-slot=rhythm-card]))')).toHaveCount(0)
    await expect(page.locator('[data-slot=rhythm-card]')).toHaveCount(count)
    await expect(page.locator('section header p').first()).toContainText('Rhythm: 8ths in 5, with accents')
    // drawn: four bars of the five-bar cycle, "…", Saindon's bracket, the label; a time signature on every staff
    const cards = page.locator('[data-slot=rhythm-card] svg')
    await expect(cards).toHaveCount(count)
    for (const card of await cards.all()) {
      await expect(card.locator('[data-rhythm-bar]')).toHaveCount(4)
      await expect(card.locator('text', { hasText: '…' })).toHaveCount(1)
      await expect(card.locator('[data-rhythm-bracket]')).not.toHaveCount(0)
      await expect(card).toHaveAttribute('aria-label', 'Rhythm card: 8ths in 5, with accents, 4 bars, continues')
    }
    await expect(staves(page)).toHaveCount(count) // the cards aren't staves
    await expect(page.locator('[data-slot=scale-staff] svg[data-time-sig="4/4"]:not([data-slot=rhythm-card] svg)')).toHaveCount(count)
    // Off: today's staves, no card and no time signature
    await chooseRhythm(page, 'Off')
    await expect(page.locator('[data-slot=rhythm-card]')).toHaveCount(0)
    await expect(page.locator('svg[data-time-sig]')).toHaveCount(0)
    await expect(page.locator('[data-rhythm-bar]')).toHaveCount(0)
    await expect(staves(page)).toHaveCount(count)
  })
})
