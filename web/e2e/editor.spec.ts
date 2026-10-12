import { chooseSheet, expect, openEditor, pickOption, setScaleLevel, sheetChord, staves, test, writeChart } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1')
  await chooseSheet(page, 'Scales') // a chart opens on the Changes; these tests are about the scale sheet
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
  await openEditor(page) // ?new=1 opens the editor; the Source is behind the banner's Source
})

/** the chart text without its column padding */
const plain = async (text: import('@playwright/test').Locator): Promise<string> => (await text.inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')

test('the editor is hidden until opened, remembered, and flags problems while hidden', async ({ page }) => {
  await page.goto('/song/autumn-leaves') // song-first: editor hidden
  const edit = page.getByRole('button', { name: 'Edit', exact: true })
  const banner = page.getByText('Editing the sheet')
  await expect(banner).toBeHidden()
  await expect(edit).toHaveAttribute('aria-expanded', 'false')
  await edit.click()
  await expect(banner).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(0) // the sheet is the editor: no bar grid from md up
  await page.reload()
  await expect(banner).toBeVisible() // remembered (csm-editor)
  await expect(page.getByLabel('Chart text')).toBeVisible() // and the Source, opened in beforeEach (csm-source)
  // make a problem, then close the editor: it's flagged with an Edit prompt
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Cm7 | C Dorian | ii7 | extra\n')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByLabel('Chart text')).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'text has a problem' })).toBeVisible()
})

test('entering a tune on the sheet is type, Space, type, Tab; → from the last chord returns to its button', async ({ page }) => {
  await chooseSheet(page, 'Changes') // the sheet is the editor
  await sheetChord(page, 'Dm7', 'A', 1).click()
  await page.keyboard.type('Em7') // over the selected chord
  await page.keyboard.press(' ') // commits, and opens the new chord slot
  await page.keyboard.type('A7')
  await page.keyboard.press('Tab') // commits, on to bar 2's chord
  await page.keyboard.type('%')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Em7\s*\nA \| 1 \| A7\s*\nA \| 2 \| Em7\s*\nA \| 2 \| A7\s*\n/)
  const last = page.getByRole('combobox', { name: 'Chord, A bar 3' })
  await expect(last).toBeFocused()
  await last.press('ArrowRight') // the text is selected: → asks for the next chord, and there is none
  await expect(sheetChord(page, 'CMaj7', 'A', 3)).toBeFocused()
})

test('a repeat’s bar offers Write out alone, and writes the section out', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await writeChart(page, 'title: T\nkey: C\nA | 1 | C\nA | 2 | F\nB | 3 | Em7\n@copy A A2 4\n')
  await sheetChord(page, 'C', 'A2', 5).hover()
  const toolbar = page.getByRole('toolbar', { name: 'Bar 5 of A2' })
  await expect(toolbar.getByRole('button')).toHaveCount(1)
  await toolbar.getByRole('button', { name: 'Write out A2, which repeats A' }).click()
  await expect.poll(() => plain(text)).toMatch(/A2 \| 5 \| C\s*\nA2 \| 6 \| F/)
  await expect.poll(() => plain(text)).not.toMatch(/@copy/)
})

test('a bar’s menu on the sheet: an ending, a coda, and a jump', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await writeChart(page, 'title: T\nkey: C\nA | 1 | C\nA | 2 | F\nA | 3 | G7\nA | 4 | C\n')
  const menu = async (item: string) => {
    await sheetChord(page, 'C', 'A', 4).hover()
    await page.getByRole('button', { name: 'More actions for A bar 4' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }
  await menu('2nd ending')
  await expect.poll(() => plain(text)).toMatch(/@ending 2 A 4/)
  await menu('Coda')
  await expect.poll(() => plain(text)).toMatch(/@coda A 4/)
  await menu('Jump…')
  const jump = page.getByRole('dialog')
  await jump.getByLabel('Jump').selectOption('D.C. al Fine')
  await jump.getByRole('button', { name: 'Set' }).click()
  await expect.poll(() => plain(text)).toMatch(/@nav A 4 D\.C\. al Fine/)
})

test('a new chart starts in C, the key of its chords', async ({ page }) => {
  await expect(page.getByLabel('Chart text')).toHaveValue(/^key: C$/m)
})

test('⌘Z undoes an edit and ⇧⌘Z redoes it, wherever it was made', async ({ page }) => {
  await chooseSheet(page, 'Changes')
  const text = page.getByLabel('Chart text')
  await sheetChord(page, 'G7', 'A', 2).click()
  await page.keyboard.type('Db7')
  await page.keyboard.press('Enter') // the field closes, focus back on the chord
  await expect(text).toHaveValue(/A \| 2 \| Db7/)
  await expect(sheetChord(page, 'Db7', 'A', 2)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z') // over the sheet
  await expect(text).toHaveValue(/A \| 2 \| G7/)
  await expect(sheetChord(page, 'G7', 'A', 2)).toBeVisible()
  await text.press('ControlOrMeta+Shift+z') // in the Source
  await expect(text).toHaveValue(/A \| 2 \| Db7/)
  await page.getByRole('button', { name: 'Undo the last change' }).click() // the banner's
  await expect(text).toHaveValue(/A \| 2 \| G7/)
})

test('on a phone the page never scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const width = () => page.evaluate(() => document.documentElement.scrollWidth)
  await expect.poll(width).toBeLessThanOrEqual(390) // the Scales sheet, editor open
  await chooseSheet(page, 'Changes') // more controls in the toolbar
  await expect.poll(width).toBeLessThanOrEqual(390)
})

test('text edits update the sheets; an unknown chord is flagged on the sheet, and draws once given a scale', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill(`${await text.inputValue()}B | 9 | Cm7#5#9x\n`)
  await expect(staves(page)).toHaveCount(3) // the new row has no scale yet, so it isn't drawn
  await chooseSheet(page, 'Changes')
  await expect(sheetChord(page, 'Cm7#5#9x', 'B', 9)).toHaveClass(/decoration-amber-500/) // the amber underline
  await text.fill((await text.inputValue()).replace(/Cm7#5#9x[ \t]*$/m, 'Cm7#5#9x | C Altered'))
  await expect(text).toHaveValue(/Cm7#5#9x +\| C Altered/)
  await chooseSheet(page, 'Scales')
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
  await page.goto('/song/f-jazz-blues')
  await page.getByRole('button', { name: 'Transpose…' }).click()
  await expect(page.getByRole('dialog')).toContainText('From key') // From is the chart's key (read-only); the status below confirms it's F
  await page.getByLabel('To key').selectOption('Bb')
  await page.getByRole('button', { name: 'Transpose', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Transposed' })).toHaveText('Transposed from F to B♭.')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  await expect(text).toHaveValue(/A \| 6 +\| Edim7 +# /) // the analysis chooses its scale in the new key
  await expect(text).toHaveValue(/title: F Jazz Blues/) // titles stay as typed
  await expect(sheetChord(page, 'Bb7', 'A', 1)).toBeVisible()
  // back in the original key, the message clears
  await page.getByRole('button', { name: 'Transpose…' }).click()
  await page.getByLabel('To key').selectOption('F')
  await page.getByRole('button', { name: 'Transpose', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Transposed' })).toHaveCount(0)
  await expect(sheetChord(page, 'F7', 'A', 1)).toBeVisible()
})

test('interval labels show on screen, against the chord root, on until turned off', async ({ page }) => {
  await page.goto('/song/footprints')
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
  await page.goto('/song/autumn-leaves')
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
  await page.goto('/song/autumn-leaves')
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
  await page.getByRole('button', { name: 'F Mixo', exact: true }).first().click() // F7's scale label: the scale list
  await page.getByRole('dialog', { name: 'Scale: F7' }).getByRole('radio', { name: /^F Lydian Dominant/ }).click() // a pick of your own
  await expect(text).toHaveValue(/F7 +\| F Lydian Dominant/)
  await page.keyboard.press('Escape')
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
  await page.goto('/song/autumn-leaves')
  await openEditor(page)
  const text = page.getByLabel('Chart text')
  const published = await text.inputValue()
  await setScaleLevel(page, 'Advanced')
  await expect(page.getByRole('button', { name: 'Level' })).toContainText('Advanced')
  await expect(text).toHaveValue(published)
  await expect(page.getByRole('status').filter({ hasText: /in this browser/ })).toHaveText('Edits are saved in this browser as your version.') // not edited
})

test('the toolbar groups the controls under labels, with the scale level as a dropdown', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  for (const label of ['Work on', 'Instrument', 'Level', 'Analysis', 'Guide Tones', 'Transposition', 'Display']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  await chooseSheet(page, 'Scales')
  await expect(page.getByText('Show', { exact: true }).first()).toBeVisible() // Intervals, in place of Analysis and Guide Tones
  await expect(page.getByText('Guide Tones', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Level' })).toBeVisible() // the scale level is a dropdown in the toolbar
})

test('the preview toolbar stays tidy (at most two rows), in every sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/song/autumn-leaves')
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

