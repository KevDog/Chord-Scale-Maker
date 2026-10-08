import { expect, test } from './fixtures'

const status = (page: import('@playwright/test').Page) => page.getByRole('status').filter({ hasText: /in this browser|Saving/ })

test('a new chart saves itself, gets its own address, and is listed in My charts', async ({ page }) => {
  await page.goto('/editor?new=1')
  await page.getByLabel('chord for row 1', { exact: true }).fill('F7')
  await expect(status(page)).toHaveText(/^Saved in this browser at/)
  await expect(page).toHaveURL(/\/editor\?mine=[a-f0-9]{12}$/)
  await expect(page.getByLabel('chord for row 1', { exact: true })).toBeFocused() // the editor didn't restart
  await page.reload()
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('F7')
  await page.goto('/')
  const mine = page.getByRole('region', { name: 'My charts' })
  await expect(mine.getByRole('row', { name: /Untitled/ })).toContainText('Mine')
})

test('edits to a library chart are kept as your version, until you revert', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await expect(status(page)).toHaveText('Edits are saved in this browser as your version.')
  await page.getByLabel('chord for row 1', { exact: true }).fill('Cm9')
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves, saved in this browser/)
  await page.reload()
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm9')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'My charts' }).getByRole('row', { name: /Autumn Leaves/ })).toContainText('Edited')
  await page.getByRole('region', { name: 'My charts' }).getByRole('link', { name: 'Autumn Leaves' }).click()
  await page.getByRole('button', { name: 'Revert to library version' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Revert' }).click()
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm7')
  await expect(page.getByRole('button', { name: 'Revert to library version' })).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})

test('Save as a copy keeps a variation beside your version, and Delete removes one', async ({ page }) => {
  await page.goto('/editor?chart=so_what')
  await page.getByRole('button', { name: 'Save as a copy' }).click()
  await expect(page).toHaveURL(/\/editor\?mine=/)
  await expect(page.getByRole('heading', { name: 'So What (copy)', level: 1 })).toBeVisible()
  await page.goto('/')
  const mine = page.getByRole('region', { name: 'My charts' })
  await expect(mine.getByRole('row', { name: /So What \(copy\)/ })).toContainText('Copy')
  await mine.getByRole('button', { name: 'Delete So What (copy)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})

test('a chart that isn’t saved here says so', async ({ page }) => {
  await page.goto('/editor?mine=doesnotexist')
  await expect(page.getByRole('heading', { name: 'That chart isn’t here' })).toBeVisible()
})
