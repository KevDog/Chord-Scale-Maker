import type { Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, expect, openEditor, staves, test } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const signatures = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-keysignature')
/** drawn glyphs in a signature group: one per sharp or flat */
const glyphs = (group: ReturnType<Page['locator']>) => group.locator('path, text')

async function writeChart(page: Page, text: string): Promise<void> {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill(text)
}

test('scale, guide tone and Changes sheets each open with a clef and the key signature', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await expect(staves(page).first()).toBeVisible()
  await expect(staves(page).first().locator('.vf-clef')).toHaveCount(1)
  await expect(signatures(staves(page).first())).toHaveCount(1)
  await chooseSheet(page, 'Guide Tones')
  await expect(staves(page).first().locator('.vf-clef')).toHaveCount(1)
  await expect(signatures(staves(page).first())).toHaveCount(1)
  await chooseSheet(page, 'Changes')
  await expect(lines(page).first().locator('.vf-clef')).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
})

test('the signature is written for the instrument', async ({ page }) => {
  await page.goto('/song?chart=misty')
  const first = staves(page).first()
  await expect(signatures(first)).toHaveCount(1)
  const concert = await glyphs(signatures(first)).count()
  expect(concert).toBe(3) // E♭: three flats
  await chooseInstrument(page, 'Tenor')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(1) // F: one flat
})

test('no key: line, no signature', async ({ page }) => {
  await writeChart(page, 'title: T\nA | 1 | C7 | C Half-Whole\n')
  await expect(staves(page).first()).toBeVisible()
  await expect(signatures(staves(page).first())).toHaveCount(0)
})

test('an @key shows a second signature on the Changes sheet line', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | DMaj7\nA | 3 | EMaj7\n@key A 2 D\n')
  await chooseSheet(page, 'Changes')
  await expect(lines(page).first()).toBeVisible()
  await expect(signatures(lines(page).first())).toHaveCount(2)
})

test('sharp keys: the signature draws on every sheet, and across a flat-to-sharp change', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: E\nA | 1 | EMaj7\nA | 2 | C#m7\nA | 3 | F#m7\nA | 4 | B7\n')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(4)
  await chooseSheet(page, 'Changes')
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(4)
  await page.getByLabel('Chart text').fill('title: T\nkey: Bb\nA | 1 | BbMaj7\nA | 2 | Gm7\nA | 3 | EMaj7\nA | 4 | C#m7\n@key A 3 E\n')
  await expect(signatures(lines(page).first())).toHaveCount(2)
})
