import { expect, staves, test } from './fixtures'

test('searches the library and opens a chart', async ({ page }) => {
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('zzz')
  await expect(page.getByText('No charts match')).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('autumn')
  const title = page.getByRole('link', { name: 'Autumn Leaves', exact: true })
  await expect(title).toHaveAttribute('href', '/song/autumn-leaves') // not an old address the redirect would mend
  await title.click()
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await expect(staves(page)).toHaveCount(6) // it opens on the Changes: 24 bars, four a line
})

test('a library title leads straight to its song, and links there', async ({ page }) => {
  await page.goto('/library')
  await page.getByPlaceholder('Search by title').fill('green dolphin')
  const title = page.getByRole('link', { name: 'On Green Dolphin Street', exact: true })
  await expect(title).toHaveAttribute('href', '/song/on-green-dolphin-street')
  await title.click()
  await expect(page).toHaveURL(/\/song\/on-green-dolphin-street$/)
  await expect(staves(page).first()).toBeVisible()
})

test('finds a tune by another title, and its song names that title', async ({ page }) => {
  await page.goto('/library')
  await page.getByPlaceholder('Search by title').fill('blue train')
  await page.getByRole('link', { name: 'Blue Trane', exact: true }).click()
  await expect(page).toHaveURL(/\/song\/blue-trane$/)
  await expect(staves(page).first()).toBeVisible()
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /Blue Trane \(also Blue Train\)/)
})

test('finds a tune by its composer, and the sheet carries the composer and the tune line', async ({ page }) => {
  await page.goto('/library')
  await page.getByPlaceholder('Search by title or composer').fill('kaper')
  await expect(page.getByRole('link', { name: 'Invitation', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'On Green Dolphin Street', exact: true }).click()
  const header = page.locator('section header').first()
  await expect(header).toContainText('Latin / swing · C · ABCD, 32 bars')
  await expect(header.getByText('Bronisław Kaper')).toBeVisible()
})

test('every page carries a hashed Content-Security-Policy', async ({ page }) => {
  for (const path of ['/', '/library', '/song', '/help', '/about', '/contact', '/privacy']) {
    await page.goto(path)
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+' 'sha256-[^']+'/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
  }
})

test('dark mode toggles and survives a reload', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: /dark mode/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('a quote in the header, kept while navigating', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/library')
  const quote = page.locator('nav figure')
  await expect(quote).toBeVisible()
  await expect(quote.locator('figcaption')).toHaveText(/^ ?— [^·]+$/) // the author only
  const text = await quote.textContent()
  await page.getByRole('link', { name: 'Autumn Leaves', exact: true }).click()
  await expect(page).toHaveURL(/song/)
  await expect(page.locator('nav figure')).toHaveText(text ?? '')
})

test('the icons are linked and served, and the mark leads the navbar', async ({ page, request }) => {
  await page.goto('/library')
  const hrefs = await page.locator('head link[rel=icon], head link[rel=apple-touch-icon], head link[rel=manifest]').evaluateAll((ls) => ls.map((l) => l.getAttribute('href')))
  expect(hrefs).toEqual(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest'])
  const manifest = (await (await request.get('/site.webmanifest')).json()) as { icons: { src: string }[] }
  for (const href of [...hrefs, ...manifest.icons.map((i) => i.src)]) expect((await request.get(href ?? '')).status(), href ?? '').toBe(200)
  const mark = page.getByRole('link', { name: 'Chord Scale Maker, home' }).locator('img')
  await expect(mark).toHaveAttribute('src', '/favicon.svg')
  expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('Request a chart opens the contact form', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('link', { name: 'Request a chart' }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible()
})

test('pages carry a link preview: Open Graph tags and a 1200×630 image', async ({ page, request }) => {
  for (const [path, title] of [['/', 'Chord Scale Maker'], ['/library', 'Library · Chord Scale Maker'], ['/help', 'Help · Chord Scale Maker'], ['/about', 'About · Chord Scale Maker']] as const) {
    await page.goto(path)
    const og = (p: string) => page.locator(`head meta[property="${p}"]`).getAttribute('content')
    await expect(page).toHaveTitle(title)
    expect(await og('og:title')).toBe(title)
    expect(await og('og:description')).toBe(await page.locator('head meta[name="description"]').getAttribute('content'))
    expect(await og('og:url')).toBe(`https://www.chordscalemaker.com${path}`)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://www.chordscalemaker.com${path}`)
    expect(await og('og:image')).toBe('https://www.chordscalemaker.com/og-image.png')
    expect(await page.locator('head meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image')
  }
  const image = await request.get('/og-image.png')
  expect(image.status()).toBe(200)
  const png = await image.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]) // the PNG header's width and height
})

test('a library chart’s practice sheets live at /song/<name>: indexable, its own canonical, its tab naming the chart', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(page).toHaveTitle('Autumn Leaves · Chord Scale Maker')
  await expect(staves(page)).toHaveCount(6)
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.chordscalemaker.com/song/autumn-leaves')
})

test('old ?chart= links and underscore names move to /song/<name>, without a history entry', async ({ page }) => {
  await page.goto('/help')
  await page.goto('/song?chart=autumn_leaves')
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await expect(staves(page)).toHaveCount(6)
  await page.goBack()
  await expect(page).toHaveURL(/\/help$/)
  await page.goto('/song?chart=round-midnight')
  await expect(page).toHaveURL(/\/song\/round-midnight$/)
  await page.goto('/song/round_midnight')
  await expect(page).toHaveURL(/\/song\/round-midnight$/)
})

test('a library chart drops a stray ?mine= from its address', async ({ page }) => {
  await page.goto('/song/autumn-leaves?mine=000000000000')
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await expect(staves(page)).toHaveCount(6)
})

test('an old ?chart= link keeps its hash when it moves', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves#s=abc')
  await expect(page).toHaveURL(/\/song\/autumn-leaves#s=abc$/)
})

test('an old ?chart= address reached inside the editor moves to /song/<name> too', async ({ page }) => {
  await page.goto('/song?mine=000000000000')
  await expect(page.getByRole('heading', { name: 'That chart isn’t here' })).toBeVisible()
  // the router's own back/forward path: the address changes without a page load
  await page.evaluate(() => {
    history.pushState(history.state, '', '/song?chart=autumn_leaves')
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  })
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
  await expect(staves(page)).toHaveCount(6)
})

test('an unknown chart, old or new address, goes to the library', async ({ page }) => {
  await page.goto('/song/no-such-tune')
  await expect(page).toHaveURL(/\/library$/)
  await page.goto('/song?chart=no_such_tune')
  await expect(page).toHaveURL(/\/library$/)
})

test('the sheet’s heading is the page’s only heading, its save status under it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/song/autumn-leaves')
  await expect(staves(page).first()).toBeVisible()
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toHaveCount(1)
  await expect(h1).toHaveText('Autumn Leaves')
  await expect(page.locator('[data-slot=paper]').getByRole('status').filter({ hasText: 'in this browser' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(h1).toHaveCount(1)
  await expect(h1.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Autumn Leaves') // the editable heading is the h1
})

test('one Library heading, an A–Z bar that jumps to a letter and hides while searching', async ({ page }) => {
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  await expect(page.getByText('Chart library')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Library', level: 2 })).toHaveCount(0) // no My charts above it
  const az = page.getByRole('navigation', { name: 'Jump to letter' })
  const round = page.getByRole('link', { name: 'Rapture', exact: true }) // R's first tune
  // retried: before hydration the link is a plain #letter-R jump, which scrolls but leaves focus behind
  await expect(async () => {
    await az.getByRole('link', { name: 'R', exact: true }).click()
    await expect(round).toBeFocused({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
  await expect(round).toBeInViewport()
  await expect(page.getByRole('row', { name: /^All Blues/ })).toContainText('Blues · G · A, 12 bars') // details, built
  await page.getByPlaceholder('Search by title').fill('blue')
  await expect(az).toBeHidden()
})

test('on a phone the library is a list: no sideways scroll, each tune with its composer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/library')
  const item = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Autumn Leaves', exact: true }) })
  await expect(item).toContainText('Joseph Kosma')
  await expect(item.getByRole('link', { name: 'Autumn Leaves', exact: true })).toHaveAttribute('href', '/song/autumn-leaves')
  await expect(page.getByRole('table')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('navigation', { name: 'Jump to letter' }).getByRole('link', { name: 'W', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Waltz for Ellington', exact: true })).toBeInViewport()
  await page.reload() // the address keeps the letter: back to it on a phone too
  await expect(page.getByRole('link', { name: 'Waltz for Ellington', exact: true })).toBeInViewport()
})
