import { chooseSheet, expect, openEditor, pickOption, setScaleLevel, staves, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1')
  await chooseSheet(page, 'Scales') // a chart opens on the Changes; these tests are about the scale sheet
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
})

test('the editor is hidden until opened, remembered, and flags problems while hidden', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves') // song-first: editor hidden
  const edit = page.getByRole('button', { name: 'Edit', exact: true })
  await expect(page.getByLabel('Chart text')).toBeHidden()
  await expect(edit).toHaveAttribute('aria-expanded', 'false')
  await edit.click()
  await expect(page.getByLabel('Chart text')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Chart text')).toBeVisible() // remembered (csm-editor)
  // make a problem, then close the editor: it's flagged with an Edit prompt
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Cm7 | C Dorian | ii7 | extra\n')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByLabel('Chart text')).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'text has a problem' })).toBeVisible()
})

test('grid edits update the text at once', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('Ebm7b5')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Ebm7b5/)
  const scale = page.getByLabel('Scale for Ebm7b5')
  await expect(scale.locator('option').first()).toHaveText('Eb Locrian') // the usual choice, first
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
  const text = page.getByLabel('Chart text') // ?new=1: the editor is already open
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
  const mode = page.getByRole('button', { name: 'Where each scale starts' })
  await expect(mode).toContainText('From root') // the default
  await expect(page.getByLabel('Start on')).toHaveCount(0)
  await pickOption(page, 'Where each scale starts', 'From C')
  await expect(staves(page)).toHaveCount(3)
  await expect(page.locator('section header p').first()).toHaveText('Spelled from C')
  await page.getByLabel('Start on').selectOption('Eb')
  await expect(mode).toContainText('From E♭')
  await pickOption(page, 'Where each scale starts', 'From root')
  await expect(page.locator('section header p').first()).toHaveText('Spelled from the Root')
})

test('transposing rewrites the chart in another key', async ({ page }) => {
  await page.goto('/song?chart=f_jazz_blues')
  await page.getByRole('button', { name: 'Transpose…' }).click()
  await expect(page.getByRole('dialog')).toContainText('From key') // From is the chart's key (read-only); the status below confirms it's F
  await page.getByLabel('To key').selectOption('Bb')
  await page.getByRole('button', { name: 'Transpose', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Transposed' })).toHaveText('Transposed from F to B♭.')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  await expect(text).toHaveValue(/A \| 6 +\| Edim7 +\| E Whole-Half/)
  await expect(text).toHaveValue(/title: F Jazz Blues/) // titles stay as typed
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Bb7')
})

test('interval labels show on screen, against the chord root, on until turned off', async ({ page }) => {
  await page.goto('/song?chart=footprints')
  await chooseSheet(page, 'Scales') // the Changes has no Intervals toggle
  const toggle = page.getByRole('button', { name: 'Intervals' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true') // on by default
  await expect(page.getByText('Intervals from the chord root:').first()).toBeAttached()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Intervals from the chord root:')).toHaveCount(0)
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveAttribute('aria-pressed', 'false') // remembered
})

test('the text editor explains itself on hover and on focus', async ({ page }) => {
  const help = page.getByRole('button', { name: 'How the text editor works' }) // ?new=1: the editor is already open
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

test('practice highlights the chosen notes, remembers them per chart, and prints them', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // practice is on the scale sheet
  const panel = page.locator('fieldset', { hasText: 'Practice' })
  await panel.getByRole('button', { name: 'Guide tones' }).click()
  await expect(page.locator('.vf-selected')).toHaveCount(78) // two per staff, 39 staves
  await expect(page.locator('svg[aria-label*="; practice:"]').first()).toBeAttached()
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected')).toHaveCount(78)
  // From C keeps its own selection
  await pickOption(page, 'Where each scale starts', 'From C')
  await expect(page.locator('.vf-selected')).toHaveCount(0)
  await page.locator('fieldset', { hasText: 'Practice' }).locator('label', { hasText: /^E♭$/ }).click()
  await expect(page.locator('.vf-selected').first()).toBeAttached()
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'Letter' })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(4) // still 12 staves a page
})

test('focus mode shows only the sheet, leaves on Escape or its button, and still prints 4 pages', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // 39 staves, 4 printed pages
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Focus mode' })
  const exit = page.getByRole('button', { name: /Exit focus/ })
  await focus.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg[aria-label]')).toHaveCount(39)
  await expect(exit).toBeFocused()
  await expect(page.getByRole('button', { name: 'Work on' })).toBeHidden()
  // the overlay covers the page: nothing behind it takes a click
  expect(await page.evaluate(() => document.elementFromPoint(20, 200)?.closest('[role=dialog]') != null)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(4)
  await page.emulateMedia({ media: 'screen' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(focus).toBeFocused()
  await focus.click()
  await exit.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
})

test('the scale level writes its scales into the chart, keeps your own picks, and goes back', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  const status = page.getByRole('status').filter({ hasText: /in this browser/ })
  await page.getByLabel('Scale for D7').first().selectOption('D Lydian Dominant') // a pick of your own
  await setScaleLevel(page, 'Basic')
  await expect(text).toHaveValue(/Cm7 +\| C Minor Pentatonic/)
  await expect(text).toHaveValue(/D7 +\| D Lydian Dominant/) // yours: kept
  await expect(page.getByRole('status').filter({ hasText: /chords moved to basic scales/ })).toBeVisible()
  await expect(status).toHaveText(/^Your edited version of Autumn Leaves/)
  await page.reload()
  await openEditor(page)
  await expect(page.getByRole('button', { name: 'Level' })).toContainText('Basic') // remembered with the chart
  await setScaleLevel(page, 'Advanced')
  await expect(text).toHaveValue(/Cm7 +\| C Bebop Dorian/)
  await setScaleLevel(page, 'Random')
  const dealt = await text.inputValue()
  await page.getByRole('button', { name: 'Shuffle' }).click()
  await expect.poll(() => text.inputValue()).not.toEqual(dealt)
  await expect(text).toHaveValue(/D7 +\| D Lydian Dominant/)
  await setScaleLevel(page, 'Standard')
  await expect(text).toHaveValue(/Cm7 +\| C Dorian/)
  await page.getByLabel('Scale for D7').first().selectOption('D Phrygian Dominant') // back to the library's own
  await expect(status).toHaveText('Edits are saved in this browser as your version.') // the library version again
})

test('levels take over a library chart’s own scale choices, and Standard brings them back', async ({ page }) => {
  await page.goto('/song?chart=f_bird_blues')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  await expect(text).toHaveValue(/A7b9 +\| A Phrygian Dominant/)
  await setScaleLevel(page, 'Advanced')
  await expect(text).toHaveValue(/A7b9 +\| A Spanish Phrygian/)
  await setScaleLevel(page, 'Standard')
  await expect(text).toHaveValue(/A7b9 +\| A Phrygian Dominant/) // the chart's choice, not Half-Whole
  await expect(page.getByRole('status').filter({ hasText: /in this browser/ })).toHaveText('Edits are saved in this browser as your version.')
})

test('the toolbar groups the controls under labels, with the scale level as a dropdown', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  for (const label of ['Work on', 'Instrument', 'Level', 'Analysis', 'Guide Tones', 'Transposition', 'Display']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  await chooseSheet(page, 'Scales')
  await expect(page.getByText('Show', { exact: true }).first()).toBeVisible() // Intervals, in place of Analysis and Guide Tones
  await expect(page.getByText('Guide Tones', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Level' })).toBeVisible() // the scale level is a dropdown in the toolbar
})

test('the preview toolbar stays tidy (at most two rows), in every sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From C') // Scales with its Start on menu: the most controls
  // how many rows the toolbar's labelled groups fall on (the content is capped at 72rem, so six groups can take two)
  const layout = () =>
    page.locator('#preview-toolbar').evaluate((el) => {
      const row = el.firstElementChild?.firstElementChild as HTMLElement // the wrapping left groups (Display is pinned top-right beside them)
      const kids = Array.from(row.children, (c) => c.getBoundingClientRect())
      // groups are top-aligned (items-start), so distinct tops = visual rows
      return { rows: new Set(kids.map((r) => Math.round(r.top))).size, widths: `${row.clientWidth}: ${kids.map((r) => Math.round(r.width)).join(' + ')}` }
    })
  for (const sheet of ['Scales', 'Changes']) {
    await chooseSheet(page, sheet)
    const { rows, widths } = await layout()
    expect(rows, `${sheet} (${widths})`).toBeLessThanOrEqual(2)
  }
})


test('a spinner shows over the sheet while it renders', async ({ browser }) => {
  const ctx = await browser.newContext() // fresh: VexFlow not cached yet
  const page = await ctx.newPage()
  await page.route(/\/_nuxt\/.*\.js$/, async (route) => {
    await new Promise((r) => setTimeout(r, 400)) // slow every chunk, so the VexFlow load+draw exceeds the spinner's 150ms debounce
    await route.continue()
  })
  await page.goto('/song?chart=autumn_leaves')
  await expect(page.getByRole('status', { name: 'Loading' }).first()).toBeVisible()
  await expect(staves(page)).toHaveCount(6) // drawn once VexFlow loads: Autumn Leaves opens on the Changes, six lines
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0) // spinner gone
  await ctx.close()
})
