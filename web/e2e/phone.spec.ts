import { chooseInstrument, expect, staves, test } from './fixtures'

test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the music starts on the first screen, the other controls in a sheet', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(staves(page).first()).toBeVisible()
  const h1 = page.getByRole('heading', { level: 1 })
  expect((await h1.boundingBox())!.y).toBeLessThan(440) // Autumn Leaves has versions: the picker takes a row above (#411)
  const staff = (await staves(page).first().boundingBox())!
  expect(staff.y + staff.height).toBeLessThan(844) // its first staff whole on the first screen
  const rail = page.getByRole('group', { name: 'Sheet controls' })
  for (const name of ['Work on', /^Instrument: /, 'Controls', 'Print', 'More actions']) await expect(rail.getByRole('button', { name, exact: typeof name === 'string' })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Level' })).toHaveCount(0)
  // the instrument, from the rail, redraws the sheet
  await chooseInstrument(page, 'Tenor Sax')
  await expect(page.getByText('the preview is transposed for tenor sax')).toBeVisible()
  // the rest in a dialog: Level, Analysis, Line, Transpose, and Edit, Share, Focus
  await rail.getByRole('button', { name: 'Controls' }).click()
  const dialog = page.getByRole('dialog', { name: 'Controls' })
  for (const name of ['Level', 'Numerals', 'Transpose…', 'Edit', 'Share', 'Focus']) await expect(dialog.getByRole('button', { name, exact: true }).first()).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Guide Tones' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Numerals' }).click()
  await expect(dialog.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // editing: Done is on the rail, the way out; focus mode from the dialog comes back to Controls
  await rail.getByRole('button', { name: 'Controls' }).click()
  await dialog.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(rail.getByRole('button', { name: 'Done', exact: true })).toBeVisible()
  await rail.getByRole('button', { name: 'Done', exact: true }).click()
  await rail.getByRole('button', { name: 'Controls' }).click()
  await dialog.getByRole('button', { name: 'Focus', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Exit focus/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(rail.getByRole('button', { name: 'Controls' })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
