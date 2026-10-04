import { expect, staves, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/editor?new=1')
  await expect(staves(page)).toHaveCount(6) // starter chart: 3 rows x 2 spellings
})

test('grid edits update the text at once', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('Ebm7b5')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Ebm7b5/)
  const scale = page.getByLabel('Scale for Ebm7b5')
  await expect(scale.locator('option').first()).toHaveText('Default · Eb Locrian')
  await expect(scale.locator('option', { hasText: 'B Major Pentatonic' })).toHaveCount(1)
})

test('a value that would corrupt the text is rejected but stays visible', async ({ page }) => {
  const cell = page.getByLabel('chord for row 1')
  await cell.fill('C|7')
  await expect(cell).toHaveValue('C|7')
  await expect(cell).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Chart text')).not.toHaveValue(/C\|7/)
})

test('text edits update the grid and preview; unknown chords prompt for a scale', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill(`${await text.inputValue()}B | 9 | Cm7#5#9x\n`)
  await expect(staves(page)).toHaveCount(6) // the new row has no scale yet, so it isn't drawn
  await expect(page.getByText('Choose a scale', { exact: true })).toHaveCount(2)
  await page.getByLabel('Scale for Cm7#5#9x').selectOption('__other')
  await page.getByLabel('Scale name').selectOption('Altered')
  await page.getByRole('button', { name: 'Set scale' }).click()
  await expect(text).toHaveValue(/Cm7#5#9x \| C Altered/)
  await expect(staves(page)).toHaveCount(8)
})

test('the mode toggle shows one spelling or both', async ({ page }) => {
  await page.getByText('From root', { exact: true }).click()
  await expect(staves(page)).toHaveCount(3)
  await page.getByText('Both', { exact: true }).click()
  await expect(staves(page)).toHaveCount(6)
})

test('the draft is kept, and New chart starts over', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('F7')
  await page.goto('/editor')
  await expect(page.getByLabel('chord for row 1')).toHaveValue('F7')
  await page.getByRole('link', { name: 'New chart' }).click()
  await expect(page.getByLabel('chord for row 1')).toHaveValue('Dm7')
})
