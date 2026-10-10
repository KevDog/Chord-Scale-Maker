import type { Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, drawn, expect, GLYPH, guidesDrawn, showGuides, staves, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const signatures = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-keysignature')
const clefs = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-clef')
/** drawn glyphs in a signature group: one per sharp or flat */
const glyphs = (group: ReturnType<Page['locator']>) => group.locator('path, text')
/** the accidentals drawn on notes, every line in order (not the signature's) */
const noteAccidentals = async (page: Page): Promise<number[]> => (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.accidentals.map((a) => a.code))

test('each sheet draws the clef and key signature once, at its start, guide tones or not', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).first()).toBeVisible()
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(signatures(staves(page).first())).toHaveCount(1)
  await expect(clefs(staves(page).nth(1))).toHaveCount(0)
  await expect(signatures(staves(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)

  await chooseSheet(page, 'Changes')
  await expect(lines(page).nth(1)).toBeVisible()
  await expect(clefs(lines(page).first())).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
  await expect(clefs(lines(page).nth(1))).toHaveCount(0)
  await expect(signatures(lines(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)

  // with both guide tones on: still line 1 only
  await showGuides(page, 'From 3rd', 'From 7th')
  await guidesDrawn(page)
  await expect(clefs(lines(page).first())).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
  await expect(clefs(lines(page).nth(1))).toHaveCount(0)
  await expect(signatures(lines(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('the signature is written for the instrument', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await chooseSheet(page, 'Scales')
  const first = staves(page).first()
  await expect(signatures(first)).toHaveCount(1)
  await expect(glyphs(signatures(first))).toHaveCount(3) // E♭: three flats
  await chooseInstrument(page, 'Tenor')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(1) // F: one flat
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('no key: line, no signature, and the clef still once, guide tones too', async ({ page }) => {
  await writeChart(page, 'title: T\nA | 1 | C7 | C Half-Whole\nA | 2 | F7 | F Mixolydian\n')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).nth(1)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await chooseSheet(page, 'Changes')
  await showGuides(page, 'From 3rd', 'From 7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: C7 \| F7.*; guide tones: /)
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect(clefs(lines(page).first())).toHaveCount(1) // a guide on: line 1 gets the clef, key or not
  await expect(clefs(page.locator('body'))).toHaveCount(1)
})

test('guide tones take their accidentals from the signature, and from C without a key:', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: F\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n')
  await showGuides(page, 'From 3rd', 'From 7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Gm7 \| C7 \| FMaj7.*; guide tones: /)
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(1) // F: one flat
  expect(await noteAccidentals(page)).toEqual([]) // the B♭s of Gm7 and C7 are in the signature
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n')
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect.poll(() => noteAccidentals(page)).toEqual([GLYPH.flat, GLYPH.flat]) // against C: a flat on each bar's B♭
})

test('an @key draws no second signature; the Changes sheet shows it as a key area', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | DMaj7\nA | 3 | EMaj7\n@key A 2 D\n')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).nth(2)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  await chooseSheet(page, 'Changes')
  await expect(lines(page).first()).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  await showGuides(page, 'From 3rd', 'From 7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
  await expect(signatures(page.locator('body'))).toHaveCount(1) // the key change goes by accidentals, never a new signature
  const sheet = lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  await expect(sheet.getByText('D major', { exact: true })).toBeVisible()
})

test('sharp keys: the signature draws on the scale and Changes sheets', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: E\nA | 1 | EMaj7\nA | 2 | C#m7\nA | 3 | F#m7\nA | 4 | B7\n')
  await chooseSheet(page, 'Scales')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(4)
  await chooseSheet(page, 'Changes')
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(4)
})
