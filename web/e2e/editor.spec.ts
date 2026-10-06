import { expect, staves, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/editor?new=1')
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
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
  await expect(staves(page)).toHaveCount(3) // the new row has no scale yet, so it isn't drawn
  await expect(page.getByText('Choose a scale', { exact: true })).toHaveCount(1)
  await page.getByLabel('Scale for Cm7#5#9x').selectOption('__other')
  await page.getByLabel('Scale name').selectOption('Altered')
  await page.getByRole('button', { name: 'Set scale' }).click()
  await expect(text).toHaveValue(/Cm7#5#9x \| C Altered/)
  await expect(page.getByLabel('Scale for Cm7#5#9x')).toBeFocused() // focus returns to the row
  await expect(staves(page)).toHaveCount(4)
})

test('the mode toggle shows one spelling at a time, and Start on only for From', async ({ page }) => {
  await expect(page.getByLabel('From root')).toBeChecked() // the default
  await expect(page.getByLabel('Start on')).toHaveCount(0)
  await expect(page.getByText('Both', { exact: true })).toHaveCount(0)
  await page.getByText('From C', { exact: true }).click()
  await expect(staves(page)).toHaveCount(3)
  await expect(page.locator('section header p').first()).toHaveText('Spelled from C')
  await page.getByLabel('Start on').selectOption('Eb')
  await expect(page.getByText('From E♭', { exact: true })).toBeVisible()
  await page.getByText('From root', { exact: true }).click()
  await expect(page.locator('section header p').first()).toHaveText('Spelled from the Root')
})

test('the draft is kept, and New chart starts over', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('F7')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| F7/) // saved with the text
  await page.goto('/editor')
  await expect(page.getByLabel('chord for row 1')).toHaveValue('F7')
  await page.getByRole('link', { name: 'New chart' }).click()
  await expect(page.getByLabel('chord for row 1')).toHaveValue('Dm7')
})

test('transposing rewrites the chart in another key', async ({ page }) => {
  await page.goto('/editor?chart=f_jazz_blues')
  await page.getByRole('button', { name: 'Transpose…' }).click()
  await expect(page.getByLabel('From key')).toHaveValue('F')
  await page.getByLabel('To key').selectOption('Bb')
  await page.getByRole('button', { name: 'Transpose', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Transposed from F to B♭.')
  const text = page.getByLabel('Chart text')
  await expect(text).toHaveValue(/A \| 6 +\| Edim7 +\| E Whole-Half/)
  await expect(text).toHaveValue(/title: F Jazz Blues/) // titles stay as typed
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Bb7')
})

test('interval labels show on screen, against the chord root', async ({ page }) => {
  await page.goto('/editor?chart=footprints')
  const toggle = page.getByRole('button', { name: 'Intervals' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Intervals from the chord root:')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Intervals from the chord root:').first()).toBeAttached()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveAttribute('aria-pressed', 'true') // remembered
})

test('guide tones draw both lines, four bars a system, without the scale controls', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await page.getByText('Guide tones', { exact: true }).click()
  await expect(page.getByText('Full Form, Alternate Changes (Guide Tone Lines)')).toBeVisible()
  await expect(page.locator('svg[aria-label^="Line 1:"]')).toHaveCount(8) // 32 bars
  await expect(page.locator('svg[aria-label^="Line 2:"]')).toHaveCount(8)
  await expect(page.getByLabel('Start on')).toHaveCount(0)
  await expect(page.getByText('From root', { exact: true })).toHaveCount(0)
  await page.getByText('Scales', { exact: true }).click()
  await expect(staves(page)).toHaveCount(39)
})

test('the text editor explains itself on hover and on focus', async ({ page }) => {
  const help = page.getByRole('button', { name: 'How the text editor works' })
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeHidden()
  await help.hover()
  await expect(tip).toBeVisible()
  await expect(tip).toContainText('section | bar | chord | scale')
  await page.mouse.move(0, 0)
  await expect(tip).toBeHidden()
  await help.focus()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('guide tone notation follows dark mode (no hard-coded black)', async ({ page }) => {
  await page.goto('/editor?chart=f_jazz_blues')
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await page.getByText('Guide tones', { exact: true }).click()
  await expect(page.locator('svg[aria-label^="Line 1:"]').first()).toBeVisible()
  const black = page.locator('svg[aria-label^="Line"] [stroke="black"], svg[aria-label^="Line"] [fill="black"], svg[aria-label^="Line"] [stroke="#000000"], svg[aria-label^="Line"] [fill="#000000"]')
  await expect(black).toHaveCount(0)
})
