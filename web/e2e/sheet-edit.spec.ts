import { barCell, expect, openEditor, test } from './fixtures'

/** the chart text without its column padding */
const plain = async (page: import('@playwright/test').Page): Promise<string> => (await page.getByLabel('Chart text').inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')

test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1') // the starter chart: Dm7 G7 CMaj7, on the Changes sheet
  await openEditor(page)
})

test('tapping a chord on the Changes sheet edits it in a popover, and selects it in the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const chord = page.getByRole('button', { name: 'Edit G7, A bar 2' })
  const at = await chord.boundingBox() // (the page is inert while the popover is open)
  await chord.click()
  const editor = page.getByRole('dialog')
  await expect(editor).toContainText('A, bar 2')
  // a popover by the chord, not a sheet across the window
  const box = await editor.locator('[id^=headlessui-dialog-panel]').boundingBox()
  expect(box && at && Math.abs(box.x - at.x) < 40 && box.width < 400).toBe(true)

  const input = editor.getByRole('textbox', { name: 'Chord' })
  await expect(input).toHaveValue('G7')
  await input.fill('Db7')
  await input.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| Db7/)
  await editor.getByRole('radiogroup', { name: 'Scale' }).getByRole('radio', { name: /^Db Mixolydian 1/ }).click() // not the analysed Db Lydian Dominant: this one pins
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| Db7 \| Db Mixolydian/)
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Db7, A bar 2' })).toBeVisible()
  await expect(barCell(page, 'A', 2)).toHaveAttribute('aria-selected', 'true')
})

test('on a phone the grid gives way to light edits: tap a chord, change it in a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Full editing works on a larger screen.')).toBeVisible()
  await expect(barCell(page, 'A', 1)).toBeHidden()
  await expect(page.getByRole('group', { name: 'Structure' })).toBeHidden()

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  const editor = page.getByRole('dialog')
  const box = await editor.locator('[id^=headlessui-dialog-panel]').boundingBox()
  expect(box && box.width >= 380 && Math.round(box.y + box.height) >= 840).toBe(true) // across the bottom
  const input = editor.getByRole('textbox', { name: 'Chord' })
  await input.fill('Em7')
  await input.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Em7/)
  await page.keyboard.press('Escape')
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Em7, A bar 1' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
