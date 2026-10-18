import { SITE_URL } from '../app/utils/site'
import { expect, staves, test } from './fixtures'

// a tune with two library charts: Summertime and its Jazz Lab Accelerator version (#411)

test('the Library lists Summertime once, with its count of versions', async ({ page }) => {
  await page.goto('/library')
  await page.getByPlaceholder('Search by title').fill('summertime')
  await expect(page.getByRole('link', { name: 'Summertime', exact: true })).toHaveCount(1)
  await expect(page.getByRole('row', { name: /Summertime/ })).toContainText('2 versions')
})

test('the version picker switches between a tune\'s charts', async ({ page }) => {
  await page.goto('/song/summertime')
  await expect(staves(page).first()).toBeVisible()
  const picker = page.getByRole('button', { name: 'Version' })
  await expect(picker).toContainText('Main')
  await picker.click()
  await expect(page.getByRole('option')).toHaveText(['Main', 'Jazz Lab Accelerator'])
  await page.getByRole('option', { name: 'Jazz Lab Accelerator' }).click()
  await expect(page).toHaveURL(/\/song\/summertime-jazz-lab-accelerator$/)
  await expect(page.getByRole('button', { name: 'Version' })).toContainText('Jazz Lab Accelerator')
  await expect(staves(page).first()).toBeVisible()
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a version page is named by its label, and its canonical is the main chart', async ({ page }) => {
    await page.goto('/song/summertime-jazz-lab-accelerator')
    await expect(page.getByRole('heading', { name: 'Summertime (Jazz Lab Accelerator)', level: 1 })).toBeVisible()
    await expect(page).toHaveTitle(/^Summertime \(Jazz Lab Accelerator\)/)
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/summertime`)
  })
})

test('a version page keeps its canonical once the app runs', async ({ page }) => {
  await page.goto('/song/summertime-jazz-lab-accelerator')
  await expect(staves(page).first()).toBeVisible()
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/summertime`)
})

test('a tune of one chart shows no picker', async ({ page }) => {
  await page.goto('/song/blue-trane')
  await expect(staves(page).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Version' })).toHaveCount(0)
})
