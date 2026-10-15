import type { Page } from '@playwright/test'
import { chooseInterface, chooseSheet, chooseSuperimpose, expect, moreAction, openPentatonicOptions, pentatonicPreset, pickOption, rankedAgainstChord, showPentatonics, test } from './fixtures'

// Blue Bossa (concert): G7♯5♯9, G Altered, in bars 6 and 14, and G7♯5 in bar 16 on the same Scales staff; the
// Changes positions are A:6:0, B:14:0 and B:16:1. Its choices, inside to outside: B♭m (the sheet's), Cm, Fm, E♭m, …

const BAR6 = 'A:6:0'
const ALTERED = ['A:6:0', 'B:14:0', 'B:16:1']

/** a Changes pentatonic label at a chord position */
const at = (page: Page, c: string) => page.locator(`[data-slot="pentatonic"] [data-chord="${c}"] button`)
/** the G Altered staff's caption on the Scales sheet */
const alteredCaption = (page: Page) => page.locator('div.text-right', { hasText: 'G Altered' }).locator('[data-slot="pentatonic"] button')

/** the Changes sheet with each chord's pentatonic */
async function changesByChord(page: Page): Promise<void> {
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await openPentatonicOptions(page)
  await rankedAgainstChord(page)
}

/** on the Scales sheet's Pentatonic preset, pick the G Altered staff's nth choice */
async function pickOnStaff(page: Page, n: number): Promise<void> {
  await alteredCaption(page).click()
  await page.getByRole('dialog', { name: /· bars 6, 14, 16$/ }).locator('[data-choice]').nth(n).click()
}

test('a pick on Changes bar 6 changes only that run', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await changesByChord(page)
  const labels = page.locator('[data-slot="pentatonic"] button')
  await expect(at(page, BAR6)).toHaveText('B♭m♪ 5')
  const before = await labels.allTextContents()
  await at(page, BAR6).click()
  const dialog = page.getByRole('dialog', { name: 'G7♯5♯9 Altered · bar 6' })
  await expect(dialog).toContainText('Sets bar 6.')
  await dialog.locator('[data-choice]').nth(2).click()
  await expect(at(page, BAR6)).toHaveText('Fm♪ 4')
  const after = await labels.allTextContents()
  expect(after.filter((t, i) => t !== before[i])).toEqual(['Fm♪ 4'])
  await expect(at(page, BAR6)).toHaveAttribute('aria-label', /your pick/)
})

test('a pick on a Scales staff sets its Changes bars, and the footer named them', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await pentatonicPreset(page)
  await expect(alteredCaption(page)).toHaveText('B♭m pent · 5 shared')
  await alteredCaption(page).click()
  const dialog = page.getByRole('dialog', { name: 'G7♯5♯9 Altered · bars 6, 14, 16' })
  await expect(dialog).toContainText('Sets bars 6, 14 and 16 on the Changes sheet too.')
  await dialog.locator('[data-choice]').nth(1).click()
  await expect(alteredCaption(page)).toHaveText('Cm pent · 4 shared')
  await expect(alteredCaption(page)).toHaveAttribute('aria-label', /your pick/)
  await changesByChord(page)
  for (const c of ALTERED) {
    await expect(at(page, c)).toHaveText('Cm♪ 4')
    await expect(at(page, c)).toHaveAttribute('aria-label', /your pick/)
  }
})

test('different picks in the staff’s bars show varies', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await pentatonicPreset(page)
  await pickOnStaff(page, 1) // Cm in bars 6, 14 and 16
  await changesByChord(page)
  await at(page, 'B:14:0').click()
  await page.getByRole('dialog', { name: /· bar 14$/ }).locator('[data-choice]').nth(2).click() // Fm in bar 14 only
  await expect(at(page, 'B:14:0')).toHaveText('Fm♪ 4')
  await chooseSheet(page, 'Scales')
  await expect(alteredCaption(page)).toHaveText('Cm pent · 4 shared · varies') // the first position's pick
  await alteredCaption(page).click()
  await expect(page.getByRole('dialog', { name: /· bars 6, 14, 16$/ })).toContainText('Replaces the different picks in bars 6, 14 and 16.')
})

test('a share link reproduces the picks', async ({ page, browser }) => {
  await page.goto('/song/blue-bossa')
  await pentatonicPreset(page)
  await pickOnStaff(page, 1)
  await changesByChord(page)
  await expect(at(page, BAR6)).toHaveText('Cm♪ 4')
  await page.getByRole('button', { name: 'Pentatonic options' }).click() // closes its popover, which covers Share
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const other = await browser.newContext()
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await changesByChord(visitor)
  for (const c of ALTERED) {
    await expect(at(visitor, c)).toHaveText('Cm♪ 4')
    await expect(at(visitor, c)).toHaveAttribute('aria-label', /your pick/)
  }
  await other.close()
})

test('picks survive a Built on change; Reset chord picks clears them', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await changesByChord(page)
  await at(page, BAR6).click()
  await page.getByRole('dialog', { name: /· bar 6$/ }).locator('[data-choice]').nth(2).click()
  await expect(at(page, BAR6)).toHaveText('Fm♪ 4')
  await openPentatonicOptions(page)
  await pickOption(page, 'Pentatonic built on', '2')
  await expect(at(page, BAR6)).toHaveText('Fm♪ 4')
  await expect(at(page, BAR6)).toHaveAttribute('aria-label', /your pick/)
  await moreAction(page, 'Reset chord picks')
  await expect(page.locator('[data-slot="pentatonic"] button[aria-label*="your pick"]')).toHaveCount(0)
  await expect(at(page, BAR6)).not.toHaveText('Fm♪ 4')
})

test('the hexatonic label picks too', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await chooseSheet(page, 'Changes')
  await chooseSuperimpose(page, 'Hexatonic')
  const label = page.locator(`[data-slot="hexatonic"] [data-chord="${BAR6}"] button`)
  await expect(label).toBeVisible()
  const before = await label.textContent()
  await label.click()
  const dialog = page.getByRole('dialog', { name: 'G7♯5♯9 Altered · bar 6' })
  await expect(dialog).toContainText('Sets bar 6.')
  const second = dialog.locator('[data-choice]').nth(1)
  const name = (await second.textContent())!.split(' · ')[0]!
  expect(name).not.toBe(before)
  await second.click()
  await expect(label).toHaveText(name)
  await expect(label).toHaveAttribute('aria-label', /your pick/)
})
