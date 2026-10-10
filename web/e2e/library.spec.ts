import { expect, staves, test } from './fixtures'

test('searches the library and opens a chart', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Chart library' })).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('zzz')
  await expect(page.getByText('No charts match')).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('autumn')
  await page.getByRole('link', { name: /Autumn Leaves/ }).click()
  await expect(page).toHaveURL(/song\?chart=autumn_leaves/)
  await expect(staves(page)).toHaveCount(6) // it opens on the Changes: 24 bars, four a line
})

test('finds a tune by its composer, and the sheet carries the composer and the tune line', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Search by title or composer').fill('kaper')
  await expect(page.getByRole('link', { name: 'Invitation' })).toBeVisible()
  await page.getByRole('link', { name: 'On Green Dolphin Street' }).click()
  await expect(page.getByText('Latin / swing · C · ABCD, 32 bars — Bronisław Kaper')).toBeVisible() // under the editor heading
  const header = page.locator('section header').first()
  await expect(header).toContainText('Latin / swing · C · ABCD, 32 bars')
  await expect(header.getByText('Bronisław Kaper')).toBeVisible()
})

test('every page carries a hashed Content-Security-Policy', async ({ page }) => {
  for (const path of ['/', '/song', '/help', '/about', '/contact', '/privacy']) {
    await page.goto(path)
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+' 'sha256-[^']+'/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
  }
})

test('dark mode toggles and survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /dark mode/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('a quote in the header, kept while navigating', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const quote = page.locator('nav figure')
  await expect(quote).toBeVisible()
  await expect(quote.locator('figcaption')).toHaveText(/^— [^·]+$/) // the author only
  const text = await quote.textContent()
  await page.getByRole('link', { name: /Autumn Leaves/ }).click()
  await expect(page).toHaveURL(/song/)
  await expect(page.locator('nav figure')).toHaveText(text ?? '')
})

test('the icons are linked and served, and the mark leads the navbar', async ({ page, request }) => {
  await page.goto('/')
  const hrefs = await page.locator('head link[rel=icon], head link[rel=apple-touch-icon], head link[rel=manifest]').evaluateAll((ls) => ls.map((l) => l.getAttribute('href')))
  expect(hrefs).toEqual(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest'])
  const manifest = (await (await request.get('/site.webmanifest')).json()) as { icons: { src: string }[] }
  for (const href of [...hrefs, ...manifest.icons.map((i) => i.src)]) expect((await request.get(href ?? '')).status(), href ?? '').toBe(200)
  const mark = page.getByRole('link', { name: 'Chord Scale Maker, home' }).locator('img')
  await expect(mark).toHaveAttribute('src', '/favicon.svg')
  expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('Request a chart opens the contact form', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Request a chart' }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible()
})

test('pages carry a link preview: Open Graph tags and a 1200×630 image', async ({ page, request }) => {
  for (const path of ['/', '/help', '/about']) {
    await page.goto(path)
    const og = (p: string) => page.locator(`head meta[property="${p}"]`).getAttribute('content')
    expect(await og('og:title')).toBe('Chord Scale Maker')
    expect(await og('og:description')).toMatch(/jazz improvisation/)
    expect(await og('og:image')).toBe('https://www.chordscalemaker.com/og-image.png')
    expect(await page.locator('head meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image')
  }
  const image = await request.get('/og-image.png')
  expect(image.status()).toBe(200)
  const png = await image.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]) // the PNG header's width and height
})
