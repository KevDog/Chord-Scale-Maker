import { barCell, chooseSheet, expect, openEditor, pickOption, setScaleLevel, staves, test, typeChord, writeChart } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1')
  await chooseSheet(page, 'Scales') // a chart opens on the Changes; these tests are about the scale sheet
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
  await openEditor(page) // ?new=1 opens the editor; the Source is under ⋯
})

test('the editor is hidden until opened, remembered, and flags problems while hidden', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves') // song-first: editor hidden
  const edit = page.getByRole('button', { name: 'Edit', exact: true })
  await expect(barCell(page, 'A1', 1)).toBeHidden()
  await expect(edit).toHaveAttribute('aria-expanded', 'false')
  await edit.click()
  await expect(barCell(page, 'A1', 1)).toBeVisible()
  await page.reload()
  await expect(barCell(page, 'A1', 1)).toBeVisible() // remembered (csm-editor)
  await expect(page.getByLabel('Chart text')).toBeVisible() // and the Source, opened in beforeEach (csm-source)
  // make a problem, then close the editor: it's flagged with an Edit prompt
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Cm7 | C Dorian | ii7 | extra\n')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByLabel('Chart text')).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'text has a problem' })).toBeVisible()
})

test('grid edits update the text at once, and the inspector offers the chord’s scales', async ({ page }) => {
  await typeChord(page, 'A', 1, 'Ebm7b5')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Ebm7b5/)
  await expect(barCell(page, 'A', 1)).toBeFocused() // back on the bar, ready for the next key
  const scales = page.getByRole('radiogroup', { name: 'Scale' }).getByRole('radio')
  await expect(scales.first()).toContainText('Eb Locrian') // the usual choice, first
  await expect(scales.filter({ hasText: 'B Major Pentatonic' })).toHaveCount(1)
})

test('entering a tune is type, Space, type, Tab', async ({ page }) => {
  await barCell(page, 'A', 1).click()
  await page.keyboard.type('Em7 A7')
  await page.keyboard.press('Tab')
  await page.keyboard.type('%')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Em7\s*\nA \| 1 \| A7\s*\nA \| 2 \| Em7\s*\nA \| 2 \| A7\s*\n/)
  await expect(barCell(page, 'A', 3)).toBeFocused()
  await page.keyboard.press('ArrowUp') // the top line: stays
  await expect(barCell(page, 'A', 3)).toBeFocused()
})

/** the chart text without its column padding */
const plain = async (text: import('@playwright/test').Locator): Promise<string> => (await text.inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')

test('structure: paste bars, add and repeat a section, write the repeat out, and rename a section', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill('title: T\nkey: C\nA | 1 | C\nA | 2 | F\n')
  await expect(barCell(page, 'A', 2)).toHaveAccessibleName('A, bar 2: F')
  await barCell(page, 'A', 2).click()
  await page.getByRole('button', { name: 'Paste bars…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Bars').fill('| Dm7 | G7 |')
  await dialog.getByRole('button', { name: 'Insert after bar 2' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => plain(text)).toMatch(/A \| 3 \| Dm7\s*\nA \| 4 \| G7/)
  await expect(barCell(page, 'A', 3)).toBeFocused()

  await page.getByRole('button', { name: 'Add section…' }).click()
  await dialog.getByLabel('Section name').fill('B')
  await dialog.getByLabel('First chords').fill('Em7 A7')
  await dialog.getByRole('button', { name: 'Add section' }).click()
  await expect.poll(() => plain(text)).toMatch(/B \| 5 \| Em7\s*\nB \| 5 \| A7/)

  await page.getByRole('button', { name: 'Repeat a section…' }).click()
  await dialog.getByLabel('Section to repeat').selectOption('A')
  await dialog.getByLabel('Name of the repeat').fill('A2')
  await dialog.getByRole('button', { name: 'Repeat', exact: true }).click()
  await expect.poll(() => plain(text)).toMatch(/@copy A A2 8/)
  await expect(page.getByText('repeats A · bars 9–12')).toBeVisible()
  await page.getByRole('button', { name: 'Write out A2' }).click()
  await expect.poll(() => plain(text)).toMatch(/A2 \| 9 \| C\s*\nA2 \| 10 \| F/)
  await expect(barCell(page, 'A2', 9)).toBeVisible()

  await page.getByRole('button', { name: 'Rename section B' }).click()
  await dialog.getByLabel('Section name').fill('Bridge')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect.poll(() => plain(text)).toMatch(/Bridge \| 5 \| Em7/)
})

test('bar actions: a bar in and out, an ending, a segno, a jump and a new section', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill('title: T\nkey: C\nA | 1 | C\nA | 2 | F\nA | 3 | G7\nA | 4 | C\n')
  await expect(barCell(page, 'A', 4)).toHaveAccessibleName('A, bar 4: C')
  await barCell(page, 'A', 2).click()
  const inspector = page.getByRole('complementary')
  await inspector.getByRole('button', { name: 'Bar after' }).click()
  await expect.poll(() => plain(text)).toMatch(/A \| 2 \| F\s*\nA \| 4 \| G7/)
  await expect(barCell(page, 'A', 3)).toHaveAccessibleName('A, bar 3: held')
  await inspector.getByRole('button', { name: 'Delete bar' }).click()
  await expect.poll(() => plain(text)).toMatch(/A \| 3 \| G7/)

  await barCell(page, 'A', 4).click()
  await inspector.getByRole('button', { name: '2nd ending' }).click()
  await inspector.getByRole('button', { name: 'Coda' }).click()
  await inspector.getByLabel('Jump at the end of the bar').selectOption('D.C. al Fine')
  await expect.poll(() => plain(text)).toMatch(/@ending 2 A 4/)
  await expect.poll(() => plain(text)).toMatch(/@coda A 4/)
  await expect.poll(() => plain(text)).toMatch(/@nav A 4 D\.C\. al Fine/)
  await expect(barCell(page, 'A', 4)).toHaveAccessibleName('A, bar 4: C; 2nd ending; Coda; D.C. al Fine')

  await barCell(page, 'A', 3).click()
  await inspector.getByRole('button', { name: 'New section here…' }).click()
  await page.getByRole('dialog').getByLabel('Section name').fill('B')
  await page.getByRole('dialog').getByRole('button', { name: 'Start section' }).click()
  await expect.poll(() => plain(text)).toMatch(/B \| 3 \| G7\s*\nB \| 4 \| C/)
  await expect.poll(() => plain(text)).toMatch(/@ending 2 B 4/)
})

test('the header sets the time and, under Details, the composer', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await page.getByLabel('Time', { exact: true }).selectOption('3/4')
  await expect(text).toHaveValue(/^time: 3\/4$/m)
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByLabel('Composer').fill('Kosma')
  await expect(text).toHaveValue(/^composer: Kosma$/m)
})

test('a new chart starts in C, the key of its chords', async ({ page }) => {
  await expect(page.getByLabel('Chart text')).toHaveValue(/^key: C$/m)
})

test('⌘Z undoes an edit and ⇧⌘Z redoes it, wherever it was made', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await barCell(page, 'A', 2).click()
  await page.keyboard.press('Delete') // G7 out: bar 2 holds Dm7
  await expect(text).not.toHaveValue(/G7/)
  await expect(barCell(page, 'A', 2)).toHaveAccessibleName('A, bar 2: held')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(text).toHaveValue(/A \| 2 \| G7/)
  await expect(barCell(page, 'A', 2)).toHaveAccessibleName('A, bar 2: G7')
  await text.press('ControlOrMeta+Shift+z')
  await expect(text).not.toHaveValue(/G7/)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(text).toHaveValue(/A \| 2 \| G7/)
})

test('on a phone the page never scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const width = () => page.evaluate(() => document.documentElement.scrollWidth)
  await expect.poll(width).toBeLessThanOrEqual(390) // the Scales sheet, editor open
  await chooseSheet(page, 'Changes') // more controls in the toolbar
  await expect.poll(width).toBeLessThanOrEqual(390)
})

test('a value that would corrupt the text is rejected but stays visible', async ({ page }) => {
  await typeChord(page, 'A', 1, 'C|7')
  const input = page.getByRole('textbox', { name: 'Chord' })
  await expect(input).toHaveValue('C|7')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('may not contain |')
  await expect(page.getByLabel('Chart text')).not.toHaveValue(/C\|7/)
})

test('text edits update the grid and preview; an unknown chord is flagged and takes any scale', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill(`${await text.inputValue()}B | 9 | Cm7#5#9x\n`)
  await expect(staves(page)).toHaveCount(3) // the new row has no scale yet, so it isn't drawn
  await barCell(page, 'B', 9).getByTitle('Not a chord the app knows').click()
  await expect(page.getByRole('note').filter({ hasText: 'isn’t a chord I know' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Any scale' }).fill('alt')
  await page.getByRole('list', { name: 'Scales found' }).getByRole('button', { name: /^C Altered/ }).click()
  await expect(text).toHaveValue(/Cm7#5#9x \| C Altered/)
  await expect(staves(page)).toHaveCount(4)
})

test('the mode toggle shows one spelling at a time, and Start on only for From', async ({ page }) => {
  const mode = page.getByRole('button', { name: 'Where each scale starts' })
  await expect(mode).toContainText('From root') // the default
  await expect(page.getByLabel('Start on')).toHaveCount(0)
  await pickOption(page, 'Where each scale starts', 'From C')
  await expect(staves(page)).toHaveCount(3)
  await expect(page.locator('section header p').first()).toHaveText('C (Spelled from C)')
  await page.getByLabel('Start on').selectOption('Eb')
  await expect(mode).toContainText('From E♭')
  await pickOption(page, 'Where each scale starts', 'From root')
  await expect(page.locator('section header p').first()).toHaveText('C (Spelled from the Root)')
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
  await expect(text).toHaveValue(/A \| 6 +\| Edim7 +\| E Diatonic Diminished #IV/)
  await expect(text).toHaveValue(/title: F Jazz Blues/) // titles stay as typed
  await expect(barCell(page, 'A', 1)).toHaveAccessibleName('A, bar 1: Bb7')
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

/** the Scales sheet's staves, with their headings (chord and scale) */
const scaleStaves = (page: import('@playwright/test').Page) => page.locator('.break-inside-avoid')

test('the scale level plays on the sheets without editing the chart, and a scale you pinned stays', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\nA | 3 | BbMaj7\n')
  const text = page.getByLabel('Chart text')
  await barCell(page, 'A', 2).click() // F7
  await page.getByRole('radio', { name: /^F Lydian Dominant/ }).click() // a pick of your own
  await expect(text).toHaveValue(/F7 +\| F Lydian Dominant/)
  const written = await text.inputValue()
  await chooseSheet(page, 'Scales')
  await setScaleLevel(page, 'Basic')
  await expect(scaleStaves(page).nth(0)).toContainText('C Minor Pentatonic')
  await expect(scaleStaves(page).nth(1)).toContainText('F Lydian Dominant') // yours: kept
  await expect(text).toHaveValue(written) // the level is a view, not an edit
  await expect(page).toHaveURL(/mine=/) // saved, at its own address
  await page.reload()
  await openEditor(page)
  await expect(page.getByRole('button', { name: 'Level' })).toContainText('Basic') // remembered with the chart
  await chooseSheet(page, 'Scales')
  await setScaleLevel(page, 'Advanced')
  await expect(scaleStaves(page).nth(0)).toContainText('C Bebop Dorian')
  await setScaleLevel(page, 'Random')
  const dealt = await scaleStaves(page).allInnerTexts()
  await expect(async () => {
    await page.getByRole('button', { name: 'Shuffle' }).click({ timeout: 1000 })
    expect(await scaleStaves(page).allInnerTexts()).not.toEqual(dealt)
  }).toPass({ timeout: 10_000 })
  await expect(scaleStaves(page).nth(1)).toContainText('F Lydian Dominant')
  await setScaleLevel(page, 'Standard')
  await expect(scaleStaves(page).nth(0)).toContainText('C Dorian')
  await expect(text).toHaveValue(written)
})

test('a level leaves a library chart as published', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  const published = await text.inputValue()
  await setScaleLevel(page, 'Advanced')
  await expect(page.getByRole('button', { name: 'Level' })).toContainText('Advanced')
  await expect(text).toHaveValue(published)
  await expect(page.getByRole('status').filter({ hasText: /in this browser/ })).toHaveText('Edits are saved in this browser as your version.') // not edited
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
