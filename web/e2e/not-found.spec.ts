import { expect, test } from './fixtures'

// the 404 response and Nuxt's page-not-found log are expected here; CSP violations still fail
test.use({ expectedConsoleError: /status of 404|NUXT_E1005/ })

test('unknown addresses get a themed not-found page under the same CSP', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toMatch(/script-src 'self' 'sha256-[^']+' 'sha256-[^']+'/)
  await expect(page.getByText('Error 404')).toBeVisible()
  // a quote from the library, not the one already in the navbar
  const quote = page.locator('main figure blockquote')
  await expect(quote).toBeVisible()
  expect(await quote.textContent()).not.toBe(await page.locator('nav figure blockquote').textContent())
  await page.getByRole('button', { name: 'Go to the chart library' }).click()
  await expect(page.getByRole('heading', { name: 'Chart library' })).toBeVisible()
})
