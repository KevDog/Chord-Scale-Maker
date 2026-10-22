import type { Page } from '@playwright/test'
import { chooseInterface, chooseSheet, expect, openEditor, pickOption, test } from './fixtures'

const SONG = '/song/rhythm-changes'
const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const paper = (page: Page) => page.locator('[data-slot="paper"]')
/** the small line of the other set's chords, above the first line's bars */
const otherLine = (page: Page) => page.locator('[data-slot="system"]').first().locator('[data-slot="other-changes"]')
const changesGroup = (page: Page) => page.getByRole('group', { name: 'Changes' })
const otherToggle = (page: Page) => page.getByRole('button', { name: 'Other changes' })

/** play a set: its radio's label (the radio itself is visually hidden), retried until hydrated */
async function play(page: Page, set: 'Standard' | 'Alternate'): Promise<void> {
  await expect(async () => {
    await changesGroup(page).locator('label', { hasText: set }).click({ timeout: 1000 })
    await expect(changesGroup(page).getByRole('radio', { name: set })).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

test('a chart with alternates plays either set, the other small above its bars, remembered (#215)', async ({ page }) => {
  await page.goto(SONG)
  await expect(changesGroup(page).getByRole('radio', { name: 'Standard' })).toBeChecked()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 G7b9 \| Cm7 F7 \|/)
  await expect(otherLine(page)).toContainText('Bdim7')
  await expect(otherLine(page)).toContainText('C♯dim7')
  await expect(paper(page)).not.toContainText('Alternate changes')

  await play(page, 'Alternate')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \| Cm7 C#dim7 \|/)
  await expect(otherLine(page)).toContainText('G7(♭9)')
  await expect(otherLine(page)).not.toContainText('Bdim7')
  await expect(paper(page)).toContainText('Alternate changes')

  await chooseSheet(page, 'Scales')
  await expect(paper(page)).toContainText('Bdim7')
  await expect(paper(page)).toContainText('Alternate changes')
  await chooseSheet(page, 'Changes')

  await otherToggle(page).click()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-slot="other-changes"]')).toHaveCount(0)

  await page.reload()
  await expect(changesGroup(page).getByRole('radio', { name: 'Alternate' })).toBeChecked()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \|/)
})

test('each set keeps its own practice selection (#215)', async ({ page }) => {
  await page.goto(SONG)
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root') // the presets are From root's
  const guideTones = page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })
  await play(page, 'Alternate')
  await guideTones.click()
  await expect(guideTones).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected').first()).toBeAttached()
  await play(page, 'Standard')
  await expect(guideTones).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.vf-selected')).toHaveCount(0)
  await play(page, 'Alternate')
  await expect(guideTones).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected').first()).toBeAttached()
})

test('a share link opens in the alternate set (#215)', async ({ page, browser }) => {
  await page.goto(SONG)
  await play(page, 'Alternate')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const fresh = await browser.newContext() // the link alone carries the set
  await chooseInterface(fresh, 'everything')
  const visitor = await fresh.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \| Cm7 C#dim7 \|/)
  await expect(changesGroup(visitor).getByRole('radio', { name: 'Alternate' })).toBeChecked()
  await expect(paper(visitor)).toContainText('Alternate changes')
  await fresh.close()
})

test('a chart without alternates has no Changes toggle (#215)', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(lines(page).first()).toBeVisible()
  await expect(changesGroup(page)).toHaveCount(0)
  await expect(otherToggle(page)).toHaveCount(0)
})

test('a bar of long alternate chords widens to keep their names apart (#475)', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 }) // four bars a line, a beat narrower than these names
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C\nalt 1 | C7#9b13\nalt 1 | F#7#11\nalt 1 | Bm7b5/F\nalt 1 | E7alt\n2 | F\n3 | G7\n4 | C\n')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: C \| F \|/)
  const names = otherLine(page).locator('[data-chord]')
  await expect(names).toHaveCount(4)
  await expect(async () => {
    const boxes = await names.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })))
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right)
  }).toPass({ timeout: 10_000 })
})

test('at a phone width the other set\'s names do not overlap (#215)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(SONG)
  await expect(otherLine(page)).toContainText('Bdim7')
  const boxes = await otherLine(page).locator('[data-other-name]').evaluateAll((ns) =>
    ns.map((n) => n.getBoundingClientRect()).sort((a, b) => a.left - b.left).map((r) => ({ left: r.left, right: r.right })))
  expect(boxes.length).toBeGreaterThan(1)
  boxes.slice(1).forEach((b, i) => expect(b.left).toBeGreaterThanOrEqual(boxes[i]!.right - 0.5))
})
