import { crc32, deflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { shownQuotes } from '../build/quotes'
import { expect, moreAction, test } from './fixtures'

test('About credits Jazz Lab and loads the video only when played, from the no-cookie domain', async ({ page }) => {
  const youtube: string[] = []
  // a stand-in for YouTube, so the test needs no network and stays fast
  await page.route(/youtube/, (route) => {
    youtube.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>video</title>' })
  })
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About Chord Scale Maker' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Jazz Lab Music' })).toHaveAttribute('href', 'https://jazzlabmusic.org/')
  await expect(page.getByRole('link', { name: 'YouTube channel' })).toHaveAttribute('href', 'https://www.youtube.com/@jazzlabmusic')
  await expect(page.getByText('an engineer with a vibraphone habit')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(youtube).toEqual([]) // nothing from YouTube before play
  await page.getByRole('button', { name: /Play the video/ }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/2SwqlkX-_HE/)
})

test('About links to Ko-fi and Patreon in a new tab, loading nothing from either', async ({ page }) => {
  const outside: string[] = []
  page.on('request', (r) => {
    if (/ko-fi|patreon/.test(r.url())) outside.push(r.url())
  })
  await page.goto('/about')
  for (const [name, href] of [
    ['Buy me a coffee on Ko-fi', 'https://ko-fi.com/kcstevens90266'],
    ['Become a patron on Patreon', 'https://www.patreon.com/kcstevens'],
  ] as const) {
    const link = page.getByRole('link', { name })
    await expect(link).toHaveAttribute('href', href)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  }
  expect(outside).toEqual([])
})

test('Contact sends a message, and points out what is missing first', async ({ page }) => {
  await page.goto('/contact')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Please add your name.')).toBeVisible()
  await expect(page.getByText('Please write a message.')).toBeVisible()
  await page.getByLabel('Name').fill('Bill Evans')
  await page.getByLabel('Email').fill('bill@example.com')
  await page.getByLabel('Message').fill('Could you add Peace Piece?')
  await page.waitForTimeout(2600) // the server treats an instant submit as a bot
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('status')).toContainText('your message is on its way')
})

/** an uncompressed PNG of random pixels: too big to send as is (about 4.8 MB), so the page must shrink it */
function noisePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let i = 0; i < raw.length; i++) raw[i] = i % (width * 3 + 1) === 0 ? 0 : Math.floor(Math.random() * 256)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))])
}

test('Contact attaches a dropped PDF, and shrinks a big photo to send', async ({ page }) => {
  await page.goto('/contact')
  await expect(page.getByText("If you have a chart you'd like added, a photo or PDF of it would be very helpful.")).toBeVisible()
  // drag and drop a small PDF
  const drop = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['%PDF-1.7 a chart'], 'Peace Piece.pdf', { type: 'application/pdf' }))
    return dt
  })
  await page.getByText('or drag and drop it here').dispatchEvent('drop', { dataTransfer: drop })
  await expect(page.getByText('Peace Piece.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Remove Peace Piece.pdf' }).click()
  // choose a 4.8 MB PNG with the button: it is sent as a JPEG of at most 3 MB
  const png = noisePng(1600, 1000)
  expect(png.length).toBeGreaterThan(3_000_000)
  const chooser = page.waitForEvent('filechooser')
  await page.getByText('Choose a file').click()
  await (await chooser).setFiles({ name: 'noise.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('shrunk to send')).toBeVisible()
  await expect(page.getByText('noise.jpg')).toBeVisible()
  await page.getByLabel('Name').fill('Bill Evans')
  await page.getByLabel('Email').fill('bill@example.com')
  await page.getByLabel('Message').fill('Peace Piece, attached.')
  await page.waitForTimeout(2600) // the server treats an instant submit as a bot
  const request = page.waitForRequest('**/api/contact')
  await page.getByRole('button', { name: 'Send message' }).click()
  const { attachment } = (await request).postDataJSON() as { attachment: { filename: string; type: string; content: string } }
  expect(attachment).toMatchObject({ filename: 'noise.jpg', type: 'image/jpeg' })
  expect((attachment.content.length / 4) * 3).toBeLessThanOrEqual(3_000_000)
  await expect(page.getByRole('status')).toContainText('your message is on its way') // the server accepted it
})

test('the footer links the About, Contact and Privacy pages', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('© ')
  await expect(footer).toContainText(/\d{4}\.\d{2}\.\d{2} · ([0-9a-f]{7}|dev)/) // the build's version
  await expect(footer).toContainText('Kevin Stevens')
  await footer.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
  await expect(page.getByText('Vercel Web Analytics')).toBeVisible()
})

test('Help is in the navbar and footer, and its contents jump to each section', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Help', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'How it all works' })).toBeVisible()
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Editing a chart' }).click()
  await expect(page).toHaveURL(/#editing$/)
  await expect(page.getByRole('heading', { name: 'Editing a chart' })).toBeInViewport()
  await page.getByRole('link', { name: 'How a line is built' }).click() // the link in The two sheets
  await expect(page).toHaveURL(/#guide-lines$/)
  await expect(page.getByRole('heading', { name: 'How a guide tone line is built', level: 3 })).toBeInViewport()
  await expect(page.getByText('vibes G3–D6')).toBeVisible() // the ranges, from INSTRUMENTS
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', { name: 'Support me on Ko-fi' })).toHaveAttribute('href', 'https://ko-fi.com/kcstevens90266')
  await expect(footer.getByRole('link', { name: 'Support me on Patreon' })).toHaveAttribute('href', 'https://www.patreon.com/kcstevens')
})

test('Report a chart error opens the contact form, pre-filled with the chart and details', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await moreAction(page, 'Report a chart error')
  await expect(page).toHaveURL(/\/contact/)
  const message = page.getByRole('textbox', { name: 'Message' })
  await expect(message).toHaveValue(/version:/)
  await expect(message).toHaveValue(/Cm7/) // the chart text came along
  await page.reload() // the report is used once, then cleared
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('')
})

test('the header is the same height whatever the quote, and keeps the whole quote', async ({ page }) => {
  const quotes = shownQuotes(JSON.parse(readFileSync(new URL('../../data/quotes.json', import.meta.url), 'utf8')))
  const byLength = quotes.map((q, i) => ({ i, n: q.quote.length + q.author.length })).sort((a, b) => a.n - b.n)
  const longest = quotes[byLength.at(-1)!.i]!
  const at = (i: number): number => (i + 0.5) / quotes.length // the Math.random value that picks quote i
  const picks = [byLength.at(-1)!.i, byLength[0]!.i, 0, quotes.length - 1, byLength[Math.floor(byLength.length / 2)]!.i, 1]
  const paths = ['/', '/help', '/about', '/contact', '/functions', '/song/autumn-leaves']
  const heights = new Set<number>()
  for (const [n, path] of paths.entries()) {
    await page.addInitScript((r) => (Math.random = () => r), at(picks[n]!)) // init scripts run in order: the last added wins
    await page.goto(path)
    const quote = page.getByRole('banner').locator('figure')
    await expect(quote).toBeVisible()
    expect((await quote.boundingBox())?.height).toBeLessThanOrEqual(64)
    if (n === 0) {
      await expect(page.getByRole('banner').locator('[title]')).toHaveAttribute('title', `“${longest.quote}” — ${longest.author}`)
      await expect(quote.locator('figcaption')).toHaveText(`— ${longest.author}`)
    }
    heights.add(Math.round((await page.getByRole('banner').boundingBox())?.height ?? 0))
    expect((await page.getByRole('banner').getByRole('navigation').first().boundingBox())?.height).toBeLessThanOrEqual(64)
  }
  // the longest quotes, at the narrowest width that shows one: whole, and the author whole under them
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const { i } of byLength.slice(-6)) {
    await page.addInitScript((r) => (Math.random = () => r), at(i))
    await page.goto('/help')
    const quote = page.getByRole('banner').locator('figure')
    await expect(quote).toBeVisible()
    const clipped = await quote.evaluate((f) => Array.from(f.children).some((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1))
    expect(clipped, quotes[i]!.quote).toBe(false)
    heights.add(Math.round((await page.getByRole('banner').boundingBox())?.height ?? 0))
  }
  await page.setViewportSize({ width: 390, height: 844 }) // a phone: the menu button's row, no quote
  for (const path of ['/', '/song/autumn-leaves']) {
    await page.goto(path)
    heights.add(Math.round((await page.getByRole('banner').boundingBox())?.height ?? 0))
  }
  expect([...heights]).toEqual([64])
})

test('Help’s On this page index stays beside the text from lg, marking the section being read', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/help')
  const index = page.getByRole('navigation', { name: 'On this page' })
  await expect(index).toHaveCount(1)
  // scrolled by hand into the middle: the section under the reading line
  await page.evaluate(() => window.scrollBy(0, (document.getElementById('editing')?.getBoundingClientRect().top ?? 0) - 40))
  await expect(index).toBeInViewport()
  await expect(index.getByRole('link', { name: 'Editing a chart' })).toHaveAttribute('aria-current', 'true')
  // a link to a section near the end, where the page can't scroll it up to the line: the one followed
  await index.getByRole('link', { name: 'Printing and Focus' }).click()
  await expect(index).toBeInViewport()
  await expect(index.getByRole('link', { name: 'Printing and Focus' })).toHaveAttribute('aria-current', 'true')
  await expect(index.locator('[aria-current]')).toHaveCount(1)
})
