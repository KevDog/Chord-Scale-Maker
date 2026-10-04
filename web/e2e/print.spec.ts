import { chooseInstrument, expect, staves, test } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 39 rows in two spellings at 12 staves per letter page, even when every staff has ledger lines
for (const [instrument, start] of [
  ['Concert', 'C'],
  ['Trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start})`, async ({ page }) => {
    await page.goto('/editor?chart=autumn_leaves')
    await chooseInstrument(page, instrument)
    await page.getByLabel('Start on').selectOption(start)
    await expect(staves(page)).toHaveCount(78)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden() // editor hidden in print
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(8)
  })
}
