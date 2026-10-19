import { chooseInterface, chooseSheet, expect, pickOption, staves, test } from './fixtures'

const heads = (page: import('@playwright/test').Page) => page.locator('svg[role=img]').first().locator('.vf-stavenote')

test('the Arpeggios sheet draws each scale line as an arpeggio', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await expect(staves(page)).toHaveCount(14)
  await expect(heads(page)).toHaveCount(9) // Cm7, up, two octaves (#227)
  await pickOption(page, 'Arpeggio direction', 'Up & down')
  await expect(heads(page)).toHaveCount(17)
  await pickOption(page, 'Arpeggio direction', 'Up')
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
  const fresh = await browser.newContext() // fresh storage: the link alone carries the choices
  await chooseInterface(fresh, 'everything')
  const visitor = await fresh.newPage()
  await visitor.goto(link)
  await expect(staves(visitor)).toHaveCount(14)
  await expect(visitor.getByRole('radio', { name: 'Extended' })).toBeChecked()
  await expect(visitor.getByRole('button', { name: 'Arpeggio direction' })).toContainText('Down')
})

test('prints 12 lines a page and fits a phone', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await pickOption(page, 'Arpeggio direction', 'Up & down') // 7th Chord: the longest line, 17 notes
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('Triad pairs writes each pair as six triads, arpeggiated or block, and its caption picks the pair (#436)', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await page.locator('label', { hasText: 'Triad pairs' }).click()
  await expect(heads(page)).toHaveCount(18) // lower, upper, through root position, 1st and 2nd inversion
  const caption = page.locator('[data-slot="hexatonic"] button').first()
  await expect(caption).toHaveText(/^\S+\/\S+ · covers \d$/)
  const auto = await caption.textContent()
  await caption.click()
  await page.getByRole('dialog').locator('[data-choice]').nth(1).click()
  await expect(caption).not.toHaveText(auto ?? '')
  await expect(caption).toHaveAttribute('aria-label', /your pick/)
  await pickOption(page, 'Arpeggio direction', 'Block')
  await expect(heads(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=/)
  const link = await box.inputValue()
  const fresh = await browser.newContext()
  await chooseInterface(fresh, 'everything')
  const visitor = await fresh.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('radio', { name: 'Triad pairs' })).toBeChecked()
  await expect(visitor.getByRole('button', { name: 'Arpeggio direction' })).toContainText('Block')
  await expect(heads(visitor)).toHaveCount(6)
})
