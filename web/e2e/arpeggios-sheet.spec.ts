import { chooseSheet, expect, pickOption, staves, test } from './fixtures'

const heads = (page: import('@playwright/test').Page) => page.locator('svg[role=img]').first().locator('.vf-stavenote')

test('the Arpeggios sheet draws each scale line as an arpeggio', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await expect(staves(page)).toHaveCount(14)
  await expect(heads(page)).toHaveCount(4) // Cm7, up
  await page.locator('label', { hasText: 'Extended' }).click()
  await expect(heads(page)).toHaveCount(7)
  await pickOption(page, 'Arpeggio direction', 'Up & down')
  await expect(heads(page)).toHaveCount(13)
})

test('a share link reopens the Arpeggios sheet with its choices', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await page.locator('label', { hasText: 'Extended' }).click()
  await pickOption(page, 'Arpeggio direction', 'Down')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=/) // the link is made asynchronously
  const link = await box.inputValue()
  const visitor = await (await browser.newContext()).newPage() // fresh storage: the link alone carries the choices
  await visitor.goto(link)
  await expect(staves(visitor)).toHaveCount(14)
  await expect(visitor.getByRole('radio', { name: 'Extended' })).toBeChecked()
  await expect(visitor.getByRole('button', { name: 'Arpeggio direction' })).toContainText('Down')
})

test('prints 12 lines a page and fits a phone', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await page.locator('label', { hasText: 'Extended' }).click()
  await pickOption(page, 'Arpeggio direction', 'Up & down')
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
