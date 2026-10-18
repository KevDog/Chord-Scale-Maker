import { expect, test } from './fixtures'

test('the release notes are a footer link away, newest first', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Release notes' }).click()
  await expect(page).toHaveURL(/\/release-notes$/)
  await expect(page.getByRole('heading', { name: "What's new", level: 1 })).toBeVisible()
  await expect(page.locator('[data-release]').first()).toHaveAttribute('data-release', /^\d{4}-\d{2}-\d{2}$/)
})
