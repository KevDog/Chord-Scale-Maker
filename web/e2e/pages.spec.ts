import { crc32, deflateSync } from 'node:zlib'
import { expect, test } from './fixtures'

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
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', { name: 'Support me on Ko-fi' })).toHaveAttribute('href', 'https://ko-fi.com/kcstevens90266')
  await expect(footer.getByRole('link', { name: 'Support me on Patreon' })).toHaveAttribute('href', 'https://www.patreon.com/kcstevens')
})
