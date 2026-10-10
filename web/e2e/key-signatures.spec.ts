import type { Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, expect, openEditor, staves, test } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const signatures = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-keysignature')
const clefs = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-clef')
/** drawn glyphs in a signature group: one per sharp or flat */
const glyphs = (group: ReturnType<Page['locator']>) => group.locator('path, text')

async function writeChart(page: Page, text: string): Promise<void> {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill(text)
}

test('each sheet draws the clef and key signature once, at its start', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await expect(staves(page).first()).toBeVisible()
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(signatures(staves(page).first())).toHaveCount(1)
  await expect(clefs(staves(page).nth(1))).toHaveCount(0)
  await expect(signatures(staves(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)

  await chooseSheet(page, 'Guide Tones')
  // the first system's two staves (line 1 and line 2) start with them; the next system has neither
  await expect(page.locator('svg[aria-label^="Line 1:"]').nth(1)).toBeVisible()
  for (const line of ['Line 1:', 'Line 2:']) {
    const systems = page.locator(`svg[aria-label^="${line}"]`)
    await expect(clefs(systems.first())).toHaveCount(1)
    await expect(signatures(systems.first())).toHaveCount(1)
    await expect(clefs(systems.nth(1))).toHaveCount(0)
    await expect(signatures(systems.nth(1))).toHaveCount(0)
  }
  await expect(clefs(page.locator('body'))).toHaveCount(2)
  await expect(signatures(page.locator('body'))).toHaveCount(2)

  await chooseSheet(page, 'Changes')
  await expect(lines(page).nth(1)).toBeVisible()
  await expect(clefs(lines(page).first())).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
  await expect(clefs(lines(page).nth(1))).toHaveCount(0)
  await expect(signatures(lines(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('the signature is written for the instrument', async ({ page }) => {
  await page.goto('/song?chart=misty')
  const first = staves(page).first()
  await expect(signatures(first)).toHaveCount(1)
  await expect(glyphs(signatures(first))).toHaveCount(3) // E♭: three flats
  await chooseInstrument(page, 'Tenor')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(1) // F: one flat
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('no key: line, no signature, and the clef still once', async ({ page }) => {
  await writeChart(page, 'title: T\nA | 1 | C7 | C Half-Whole\nA | 2 | F7 | F Mixolydian\n')
  await expect(staves(page).nth(1)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
})

test('an @key draws no second signature; the Changes sheet shows it as a key area', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | DMaj7\nA | 3 | EMaj7\n@key A 2 D\n')
  await expect(staves(page).nth(2)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  await chooseSheet(page, 'Guide Tones')
  await expect(signatures(page.locator('body'))).toHaveCount(2) // line 1 and line 2 of the first system
  await chooseSheet(page, 'Changes')
  await expect(lines(page).first()).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  const sheet = lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  await expect(sheet.getByText('D major', { exact: true })).toBeVisible()
})

test('sharp keys: the signature draws on the scale and Changes sheets', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: E\nA | 1 | EMaj7\nA | 2 | C#m7\nA | 3 | F#m7\nA | 4 | B7\n')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(4)
  await chooseSheet(page, 'Changes')
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(4)
})
