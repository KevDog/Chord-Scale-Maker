import { expect, staves, test } from './fixtures'

test('searches the library and opens a chart', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Chart library' })).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('zzz')
  await expect(page.getByText('No charts match')).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('autumn')
  await page.getByRole('link', { name: /Autumn Leaves/ }).click()
  await expect(page).toHaveURL(/editor\?chart=autumn_leaves/)
  await expect(staves(page)).toHaveCount(39) // 39 rows, from the root
  await expect(page.getByRole('separator', { name: /Printed page \d starts here/ })).toHaveCount(3) // 4 printed pages
})

test('every page carries a hashed Content-Security-Policy', async ({ page }) => {
  for (const path of ['/', '/editor', '/about', '/contact', '/privacy']) {
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
  await expect(page).toHaveURL(/editor/)
  await expect(page.locator('nav figure')).toHaveText(text ?? '')
})
