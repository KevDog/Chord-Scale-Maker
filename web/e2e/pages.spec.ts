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

test('the footer links the About, Contact and Privacy pages', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('© ')
  await expect(footer).toContainText('Kevin Stevens')
  await footer.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
  await expect(page.getByText('Vercel Web Analytics')).toBeVisible()
})
