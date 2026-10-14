import { chooseInstrument, chooseSheet, expect, pickOption, rankedAgainstChord, showPentatonics, test } from './fixtures'
import type { Page } from '@playwright/test'

const labels = (page: Page) => page.locator('[data-slot="pentatonic"] button')

test('the Pentatonics row names each key area’s pentatonic, and the ladder changes the rung', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(labels(page).first()).toHaveText('Gm♪') // G minor, Home
  await labels(page).first().click()
  const ladder = page.getByRole('dialog', { name: 'A1 · G minor pentatonic ladder' })
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side, for A1 only
  await expect(labels(page).first()).toHaveText('Fm♪ 4')
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('One rung')
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

test('a pick changes its label’s run only, and Reset restores it', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const texts = async () => page.locator('[data-slot="pentatonic"] [data-chord]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-chord')}: ${e.textContent}`))
  const before = await texts()
  const target = sectionLabels(page, 'B').first()
  await target.click()
  await page.getByRole('dialog', { name: /^B · / }).locator('li').first().locator('[data-pent]').click() // Home
  await expect(target).toHaveText(/♪ 5$/)
  const after = await texts()
  expect(after.filter((t, i) => t !== before[i])).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Fifths')
  await target.click()
  await page.locator('[data-reset]').click()
  await expect.poll(texts).toEqual(before)
})

test('Ranked against Chord follows each chord: Waltz for Debby’s first bars', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toHaveCount(0)
  const firstLine = page.locator('[data-slot="system"]').first().locator('[data-slot="pentatonic"] button')
  await expect.poll(async () => (await firstLine.allTextContents()).slice(0, 3)).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5']) // bars 1–3; bar 4's C7 repeats Gm
  await pickOption(page, 'Pentatonic rank', '12 · farthest')
  await expect(firstLine.first()).toHaveText(/♪ 0$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pentatonic rank' })).toContainText('12 · farthest')
})

test('a pick is per chart, kept over a reload, and cleared by a change of Rank', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  const second = page.locator('[data-slot="pentatonic"] [data-chord]').nth(1)
  await second.locator('button').click()
  await page.getByRole('dialog', { name: /pentatonic ranking$/ }).locator('li').nth(2).locator('[data-pent]').click() // rank 3
  const picked = await second.textContent()
  await page.reload()
  await expect(second).toHaveText(picked!)
  await expect(second.locator('button')).toHaveAttribute('aria-label', /your pick/)
  await pickOption(page, 'Pentatonic rank', '2')
  await expect(second.locator('button')).not.toHaveAttribute('aria-label', /your pick/)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the toggle is in the Controls dialog', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    await showPentatonics(page)
    await expect(labels(page).first()).toBeVisible()
    const dialog = page.getByRole('dialog', { name: 'Controls' })
    await expect(async () => {
      if ((await dialog.count()) === 0) await page.getByRole('button', { name: 'Controls', exact: true }).click({ timeout: 1000 })
      await expect(dialog.getByRole('radio', { name: 'Chord', exact: true })).toBeAttached({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
})

test('the Pentatonic practice preset ranks each scale’s pentatonics, remembers the rank, and prints', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  const panel = page.locator('fieldset', { hasText: 'Practice' })
  await panel.getByRole('button', { name: 'Pentatonic', exact: true }).click()
  const captions = page.locator('[data-slot="pentatonic"]')
  await expect(captions).toHaveCount(14) // one per line
  await expect(captions.first()).toHaveText(/ pent/)
  const closest = await page.locator('.vf-selected').count()
  await pickOption(page, 'Pentatonic rank', '12 · farthest')
  await expect.poll(() => page.locator('.vf-selected').count()).toBeLessThan(closest)
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.getByRole('button', { name: 'Pentatonic rank' })).toContainText('12 · farthest')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'Letter' })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2) // 14 lines, 12 a page, as without the caption
})

test('in print the longest pentatonic captions stay on one line', async ({ page }) => {
  await page.goto('/song/all-the-things-you-are')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Pentatonic', exact: true }).click()
  await page.emulateMedia({ media: 'print' })
  const long = page.locator('[data-slot="pentatonic"]', { hasText: 'shared' })
  expect(await long.count()).toBeGreaterThan(0)
  const wrapped = await long.evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(el).fontSize)).length)
  expect(wrapped).toBe(0)
})
