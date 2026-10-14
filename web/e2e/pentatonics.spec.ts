import { chooseInstrument, chooseSheet, expect, showPentatonics, test } from './fixtures'
import type { Page } from '@playwright/test'

const labels = (page: Page) => page.locator('[data-slot="pentatonic"] button')

test('the Pentatonics row names each key area’s pentatonic, and the ladder changes the rung', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(labels(page).first()).toHaveText('Gm♪') // G minor, Home
  await labels(page).first().click()
  const ladder = page.getByRole('dialog', { name: 'A1 · G minor ladder' })
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side, for A1 only
  await expect(labels(page).first()).toHaveText('Fm♪ 4')
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Custom')
})

test('the row survives a reload, written for a B♭ part', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await page.reload()
  await expect(labels(page).first()).toHaveText('Gm♪')
  await chooseInstrument(page, 'Tenor Sax')
  await expect(labels(page).first()).toHaveText('Am♪') // concert G minor, written A minor
})

const sectionLabels = (page: Page, section: string) => page.locator(`[data-slot="pentatonic"] [data-section="${section}"] button`)

async function choosePath(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name }).click()
}

test('Side-slip takes the bridge a half step out, and comes home', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Side-slip')
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toHaveCount(0)
  for (const s of ['A1', 'A2', 'A3']) await expect(sectionLabels(page, s).first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 1$/)
  await sectionLabels(page, 'B').first().click()
  const rung5 = page.getByRole('dialog', { name: /^B · / }).locator('li').filter({ hasText: /^5 ·/ })
  await expect(rung5.locator('[data-pent]').first()).toHaveAttribute('aria-current', 'true') // the ♭ side, not the ♯
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 1$/) // kept for this chart
})

test('a path that varies tints the labels and draws the contour: the bridge high, with a riser', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.locator('[data-slot="contour"]')).toHaveCount(0) // One rung: no band
  await choosePath(page, 'Side-slip')
  await expect(page.locator('[data-slot="contour"]').first()).toBeAttached()
  const bridge = page.locator('[data-slot="system"]').filter({ has: sectionLabels(page, 'B') }).first()
  await expect(bridge.locator('[data-slot="contour"] line[data-kind="run"]').first()).toHaveAttribute('data-rung', '5')
  await expect(bridge.locator('[data-slot="contour"] line[data-kind="riser"]')).toHaveCount(1)
  await expect(page.locator('[data-slot="pentatonic"] [data-section="B"]').first()).toHaveClass(/text-rung-5/)
  await expect(page.locator('[data-slot="pentatonic"] [data-section="A1"]').first()).toHaveClass(/text-rung-0/)
})

test('a pick in one section’s ladder changes that section only', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const texts = async () => page.locator('[data-slot="pentatonic"] [data-section]').evaluateAll(els => els.map(e => `${e.getAttribute('data-section')}: ${e.textContent}`))
  const before = await texts()
  await expect(sectionLabels(page, 'A2').first()).not.toHaveText(/♪ 5$/) // the climber is not Home under Fifths
  await sectionLabels(page, 'B').first().click()
  await page.getByRole('dialog', { name: /^B · / }).locator('li').first().locator('[data-pent]').click() // the Home row
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 5$/)
  const after = await texts()
  expect(after.length).toBe(before.length)
  expect(before.length).toBeGreaterThan(1)
  const changed = after.filter((t, i) => t !== before[i]).map(t => t.split(':')[0])
  expect(changed.length).toBeGreaterThan(0)
  expect(new Set(changed)).toEqual(new Set(['B']))
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Custom')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the toggle is in the Controls dialog', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    await showPentatonics(page)
    await expect(labels(page).first()).toBeVisible()
  })
})
