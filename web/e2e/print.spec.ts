import { chooseInstrument, chooseSheet, drawn, expect, guidesDrawn, pickOption, showGuides, staves, test } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 39 rows at 12 staves per letter page, even when every staff has ledger lines (trombone from B)
for (const [instrument, start] of [
  ['Concert', null],
  ['Concert', 'C'],
  ['Trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start ?? 'the root'})`, async ({ page }) => {
    await page.goto('/song?chart=autumn_leaves')
    await chooseSheet(page, 'Scales') // a chart opens on the Changes
    await chooseInstrument(page, instrument)
    if (start) {
      await pickOption(page, 'Where each scale starts', 'From C')
      await page.getByLabel('Start on').selectOption(start)
    }
    await expect(staves(page)).toHaveCount(39)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden() // editor hidden in print
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(4)
  })
}

// eight lines a page with guide tones off: a 32-bar AABA written out (Satin Doll) on one; Tunisia's nine lines (with the tag) on two
for (const [chart, pages] of [
  ['autumn_leaves', 1],
  ['satin_doll', 1],
  ['a_night_in_tunisia', 2],
  ['stardust', 2],
  ['its_you_or_no_one', 2],
] as const) {
  test(`prints the Changes eight lines a page (${chart})`, async ({ page }) => {
    await page.goto(`/song?chart=${chart}`)
    await chooseSheet(page, 'Changes')
    await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

test('the Changes sheet shows 1st/2nd endings and a D.S. al Coda', async ({ page }) => {
  await page.goto('/song?chart=its_you_or_no_one')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.getByText('D.S. al Coda')).toBeVisible()
  await expect(page.getByLabel('Coda').first()).toBeVisible()
  await page.goto('/song?chart=stardust')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.locator('svg[aria-label^="Bars:"] text', { hasText: '1.' }).first()).toBeVisible()
})

// the tallest Changes lines: both guide tones (two voices, stems both ways) with numerals and scales, a 1st/2nd ending
// raised above the stems, and a bass part below the staff (no library chart reaches E2, the range's floor: Stardust's
// trombone part goes to F♯2). Each sheet page holds changesLinesPerPage lines, so the PDF has as many pages as the
// sheet: a page that overflowed would add one
test('prints the Changes with both guide tones, a sheet page to a letter page, in the tallest case', async ({ page }) => {
  await page.goto('/song?chart=stardust')
  await chooseInstrument(page, 'Trombone')
  await showGuides(page, 'From 3rd', 'From 7th')
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Scales', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const all = await Promise.all((await svgs.all()).map(drawn))
  expect(all.filter((d) => d.voltaBottom !== null).length).toBeGreaterThan(0) // the verse's 1st and 2nd endings
  expect(Math.max(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeGreaterThanOrEqual(120) // on or below the bass staff's bottom line (G2)
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
