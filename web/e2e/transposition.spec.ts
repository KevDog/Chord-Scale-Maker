import { chooseInstrument, expect, staves, test } from './fixtures'

const firstStaff = (page: import('@playwright/test').Page) => page.locator('.break-inside-avoid').first()

test('writes the sheet for a transposing instrument and remembers it', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await expect(firstStaff(page)).toContainText('C–7')
  await chooseInstrument(page, 'Tenor sax')
  await expect(firstStaff(page)).toContainText('D–7')
  await expect(firstStaff(page)).toContainText('D Dorian')
  await expect(page.locator('section header p').first()).toHaveText('Full Form, Alternate Changes – Tenor Sax (Bb) (Spelled from the Root)')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Instrument' })).toContainText('Tenor sax')
})

test('bass clef instruments and the start note', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await chooseInstrument(page, 'Trombone')
  await page.getByText('From C', { exact: true }).click()
  await page.getByLabel('Start on').selectOption('B')
  await expect(page.getByText('From B', { exact: true })).toBeVisible()
  await expect(page.locator('section header p').first()).toHaveText('Full Form, Alternate Changes – Trombone (Spelled from B)')
  await expect(staves(page)).toHaveCount(39)
})
