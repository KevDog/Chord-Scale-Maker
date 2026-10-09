import { chooseInstrument, expect, pickOption, staves, test } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 39 rows at 12 staves per letter page, even when every staff has ledger lines (trombone from B)
for (const [instrument, start] of [
  ['Concert', null],
  ['Concert', 'C'],
  ['Trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start ?? 'the root'})`, async ({ page }) => {
    await page.goto('/song?chart=autumn_leaves')
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

// 8 four-bar systems per letter page: a 32-bar tune on one page, Milestones (40 bars) on two
for (const [chart, instrument, pages] of [
  ['autumn_leaves', 'Concert', 1],
  ['autumn_leaves', 'Trombone', 1],
  ['milestones', 'Concert', 2],
] as const) {
  test(`prints guide tones 8 systems per page (${chart}, ${instrument})`, async ({ page }) => {
    await page.goto(`/song?chart=${chart}`)
    await chooseInstrument(page, instrument)
    await page.getByRole('group', { name: 'Sheet' }).getByText('Guide tones', { exact: true }).click()
    await expect(page.locator('svg[aria-label^="Line 1:"]').first()).toBeVisible()
    await expect(page.getByRole('separator')).toHaveCount(0) // no on-screen page divider
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

// eight lines a page: a 32-bar AABA written out (Satin Doll) on one; Tunisia's nine lines (with the tag) on two
for (const [chart, pages] of [
  ['autumn_leaves', 1],
  ['satin_doll', 1],
  ['a_night_in_tunisia', 2],
  ['stardust', 2],
  ['its_you_or_no_one', 2],
] as const) {
  test(`prints the Changes eight lines a page (${chart})`, async ({ page }) => {
    await page.goto(`/song?chart=${chart}`)
    await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
    await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

test('the Changes sheet shows 1st/2nd endings and a D.S. al Coda', async ({ page }) => {
  await page.goto('/song?chart=its_you_or_no_one')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.getByText('D.S. al Coda')).toBeVisible()
  await expect(page.getByLabel('Coda').first()).toBeVisible()
  await page.goto('/song?chart=stardust')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.locator('svg[aria-label^="Bars:"] text', { hasText: '1.' }).first()).toBeVisible()
})
