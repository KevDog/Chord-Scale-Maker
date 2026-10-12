import { expect, staves, test } from './fixtures'

test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the music starts on the first screen, the other controls in a sheet', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(staves(page).first()).toBeVisible()
  const h1 = page.getByRole('heading', { level: 1 })
  expect((await h1.boundingBox())!.y).toBeLessThan(400)
  const rail = page.getByRole('group', { name: 'Sheet controls' })
  for (const name of ['Work on', 'Instrument', 'Controls', 'Print', 'More actions']) await expect(rail.getByRole('button', { name, exact: true })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Level' })).toHaveCount(0)
  // the instrument, from the rail, redraws the sheet
  await rail.getByRole('button', { name: 'Instrument' }).click()
  await page.getByRole('option', { name: /^Tenor Sax/ }).click()
  await expect(page.getByText('the preview is transposed for tenor sax')).toBeVisible()
  // the rest in a dialog: Level, Analysis, Line, Transpose, and Edit, Share, Focus
  await rail.getByRole('button', { name: 'Controls' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sheet controls' })
  for (const name of ['Level', 'Numerals', 'Transpose…', 'Edit', 'Share', 'Focus']) await expect(dialog.getByRole('button', { name, exact: true }).first()).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Guide Tones' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Numerals' }).click()
  await expect(dialog.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
