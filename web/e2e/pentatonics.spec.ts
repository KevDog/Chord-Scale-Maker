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
  await page.reload()
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 1$/) // kept for this chart
})

test('a pick in one section’s ladder changes that section only', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const before = await sectionLabels(page, 'A1').first().textContent()
  await sectionLabels(page, 'B').first().click()
  await page.getByRole('dialog', { name: /^B · / }).locator('[data-pent]').first().click() // Home
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'A1').first()).toHaveText(before ?? '')
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
