import { chooseInstrument, chooseSheet, expect, showPentatonics, test } from './fixtures'
import type { Page } from '@playwright/test'

const labels = (page: Page) => page.locator('[data-slot="pentatonic"] button')

test('the Pentatonics row names each key area’s pentatonic, and the ladder changes the rung', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(labels(page).first()).toHaveText('Gm♪') // G minor, Home
  await labels(page).first().click()
  const ladder = page.getByRole('dialog', { name: 'G minor ladder' })
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side
  await expect(labels(page).first()).toHaveText('Fm♪')
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toContainText('2 · 4 shared')
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the toggle is in the Controls dialog', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    await showPentatonics(page)
    await expect(labels(page).first()).toBeVisible()
  })
})
