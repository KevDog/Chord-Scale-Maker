import { expect, test } from './fixtures'

test('How it decides is in the Help menu', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('banner').getByRole('button', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'How it decides' }).click()
  await expect(page).toHaveURL(/\/how-it-decides$/)
  await expect(page.getByRole('heading', { name: 'How it decides', level: 1 })).toBeVisible()
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'How it decides' })).toHaveAttribute('href', '/how-it-decides')
})

test('a link to one decision opens at its section', async ({ page }) => {
  await page.goto('/how-it-decides#pent.auto')
  await expect(page.locator('[id="pent.auto"]')).toBeInViewport()
  await expect(page.getByRole('navigation', { name: 'On this page' }).last().locator('[aria-current="true"]')).toHaveText('Superimposing')
})

test('fits a phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/how-it-decides')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
