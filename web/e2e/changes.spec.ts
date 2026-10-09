import { chooseInstrument, expect, test } from './fixtures'

const lines = (page: import('@playwright/test').Page) => page.locator('svg[aria-label^="Bars:"]')
/** the sheet itself, not the chart grid above it (whose menus name the same scales) */
const sheetOf = (page: import('@playwright/test').Page) => lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')

test('the Changes sheet: slashes, chords, numerals and scales, a repeat, and toggles that stick', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(lines(page)).toHaveCount(6) // A1 · A2 played twice, then B: 24 bars, four a line
  const sheet = sheetOf(page)
  await expect(sheet.getByText('A1 · A2', { exact: true })).toBeVisible()
  await expect(sheet.getByText('ii7/♭III').first()).toBeVisible()
  await expect(sheet.getByText('D Phryg Dom').first()).toBeVisible()
  await expect(page.locator('section header p').first()).toHaveText(/\(Changes\)/)
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveCount(0) // per note: not on this sheet
  await page.getByRole('button', { name: 'Numerals' }).click()
  await expect(sheet.getByText('ii7/♭III')).toHaveCount(0)
  await page.getByRole('button', { name: 'Scales', exact: true }).click()
  await expect(sheet.getByText('D Phryg Dom')).toHaveCount(0)
  await page.reload()
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'false') // remembered
  await chooseInstrument(page, 'Tenor')
  await expect(sheetOf(page).getByText('A minor', { exact: true })).toBeVisible() // the key area, written for the tenor
})

test('a later copy is written out, a tag follows a double barline, and a share link opens on the sheet', async ({ page, browser }) => {
  await page.goto('/song?chart=a_night_in_tunisia')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await expect(page.getByText('Tag', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share' }).click()
  const link = await page.getByRole('dialog').getByLabel('Link').inputValue()
  const other = await browser.newContext()
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toBeVisible()
  await expect(visitor.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await other.close()
})
