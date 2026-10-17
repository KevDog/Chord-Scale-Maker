import { chooseSheet, expect, openEditor, pickOption, setScaleLevel, sheetChord, showLine, showPentatonics, staves, test, writeChart } from './fixtures'

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
  await page.getByLabel('Chart text').fill('title: T\nsection: A\n1 | Cm7 | C Dorian | ii7 | extra\n')
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
  await expect(page.getByLabel('Chart text')).toHaveValue(/\n1 \| Em7\s*\n1 \| A7\s*\n2 \| Em7\s*\n2 \| A7\s*\n/)
  const last = page.getByRole('combobox', { name: 'Chord, A bar 3' })
  await expect(last).toBeFocused()
  await last.press('ArrowRight') // the text is selected: → asks for the next chord, and there is none
  await expect(sheetChord(page, 'CMaj7', 'A', 3)).toBeFocused()
})

test('a repeat’s bar offers Write out alone, and writes the section out', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | C\n2 | F\n\nsection: B\nbars: 2\n1 | Em7\n\nsection: A2\nbars: 4\ncopy: A\n')
  await sheetChord(page, 'C', 'A2', 1).hover()
  const toolbar = page.getByRole('toolbar', { name: 'Bar 1 of A2' })
  await expect(toolbar.getByRole('button')).toHaveCount(1)
  await toolbar.getByRole('button', { name: 'Write out A2, which repeats A' }).click()
  await expect.poll(() => plain(text)).toMatch(/section: A2\n(?:.*\n)*?1 \| C\s*\n2 \| F/)
  await expect.poll(() => plain(text)).not.toMatch(/copy:/)
})

test('a bar’s menu on the sheet: an ending, a coda, and a jump', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | C\n2 | F\n3 | G7\n4 | C\n')
  const menu = async (item: string) => {
    await sheetChord(page, 'C', 'A', 4).hover()
    await page.getByRole('button', { name: 'More actions for A bar 4' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }
  await menu('2nd ending')
  await expect.poll(() => plain(text)).toMatch(/@ending 2 4/)
  await menu('Coda')
  await expect.poll(() => plain(text)).toMatch(/@coda 4/)
  await menu('Jump…')
  const jump = page.getByRole('dialog')
  await jump.getByLabel('Jump').selectOption('D.C. al Fine')
  await jump.getByRole('button', { name: 'Set' }).click()
  await expect.poll(() => plain(text)).toMatch(/@nav 4 D\.C\. al Fine/)
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
  await expect(text).toHaveValue(/\n2 \| Db7/)
  await expect(sheetChord(page, 'Db7', 'A', 2)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z') // over the sheet
  await expect(text).toHaveValue(/\n2 \| G7/)
  await expect(sheetChord(page, 'G7', 'A', 2)).toBeVisible()
  await text.press('ControlOrMeta+Shift+z') // in the Source
  await expect(text).toHaveValue(/\n2 \| Db7/)
  await page.getByRole('button', { name: 'Undo the last change' }).click() // the banner's
  await expect(text).toHaveValue(/\n2 \| G7/)
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
  await text.fill(`${await text.inputValue()}section: B\n1 | Cm7#5#9x\n`)
  await expect(staves(page)).toHaveCount(3) // the new row has no scale yet, so it isn't drawn
  await chooseSheet(page, 'Changes')
  await expect(sheetChord(page, 'Cm7#5#9x', 'B', 1)).toHaveClass(/decoration-amber-500/) // the amber underline
  await text.fill((await text.inputValue()).replace(/Cm7#5#9x[ \t]*$/m, 'Cm7#5#9x | C Altered'))
  await expect(text).toHaveValue(/Cm7#5#9x +\| C Altered/)
  await chooseSheet(page, 'Scales')
  await expect(staves(page)).toHaveCount(4)
})

test("one picker spells every scale from the chart's key (the default), any note, or each root", async ({ page }) => {
  const mode = page.getByRole('button', { name: 'Where each scale starts' })
  await expect(mode).toContainText('From key (C)') // the default
  await expect(staves(page)).toHaveCount(3)
  await expect(page.locator('section header p').first()).toHaveText('C – Piano (Spelled from C)')
  await pickOption(page, 'Where each scale starts', 'From E♭')
  await expect(mode).toContainText('From E♭')
  await expect(page.locator('section header p').first()).toHaveText('C – Piano (Spelled from E♭)')
  await pickOption(page, 'Where each scale starts', 'From root')
  await expect(page.locator('section header p').first()).toHaveText('C – Piano (Spelled from the Root)')
})

test('a first visit is a Piano sheet, and says so', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Instrument' })).toContainText('Piano')
  await expect(page.locator('section header p').first()).toContainText('Piano')
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
  await expect(text).toHaveValue(/\n6 +\| Edim7 +# /) // the analysis chooses its scale in the new key
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
  await expect(tip).toContainText('bar | chord | scale | function')
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
  await pickOption(page, 'Where each scale starts', 'From root') // the presets are From root's
  const panel = page.locator('fieldset', { hasText: 'Practice' })
  await panel.getByRole('button', { name: 'Guide tones' }).click()
  await expect(page.locator('.vf-selected')).toHaveCount(28) // two per staff, 14 lines
  await expect(page.locator('svg[aria-label*="; practice:"]').first()).toBeAttached()
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected')).toHaveCount(28)
  // From C keeps its own selection
  await pickOption(page, 'Where each scale starts', 'From C')
  await expect(page.locator('.vf-selected')).toHaveCount(0)
  await page.locator('fieldset', { hasText: 'Practice' }).locator('label', { hasText: /^E♭$/ }).click()
  await expect(page.locator('.vf-selected').first()).toBeAttached()
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'Letter' })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2) // 14 lines, 12 a page
})

test('focus mode shows only the sheet, leaves on Escape or its button, and still prints 2 pages', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales') // 14 lines, 2 printed pages
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Focus mode' })
  const exit = page.getByRole('button', { name: /Exit focus/ })
  await focus.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg[aria-label]')).toHaveCount(14)
  await expect(exit).toBeFocused()
  await expect(page.getByRole('button', { name: 'Work on' })).toBeHidden()
  // the overlay covers the page: nothing behind it takes a click
  expect(await page.evaluate(() => document.elementFromPoint(20, 200)?.closest('[role=dialog]') != null)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  await page.emulateMedia({ media: 'screen' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(focus).toBeFocused()
  await focus.click()
  await exit.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
})

test('focus mode shows the sheet as pages, each fitted to the window, scrolling from one to the next', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales') // 2 printed pages
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Focus mode' })
  const pages = dialog.locator('[data-slot=page]')
  await expect(pages).toHaveCount(2)
  await expect(dialog.locator('svg[aria-label]')).toHaveCount(14)
  // fitted: the first page whole in the window under the Exit bar, every page smaller than the window, page-shaped
  await expect.poll(async () => (await pages.nth(0).boundingBox())!.y + (await pages.nth(0).boundingBox())!.height).toBeLessThanOrEqual(800)
  for (const p of await pages.all()) {
    const box = (await p.boundingBox())!
    expect(box.height).toBeLessThan(800)
    expect(box.width / box.height).toBeCloseTo(816 / 1056, 1) // a letter page's shape
    await expect(p.locator('header').first()).toBeVisible() // each page under its own heading, as printed
  }
  await expect(pages.nth(0)).toBeInViewport({ ratio: 0.9 })
  await pages.nth(1).scrollIntoViewIfNeeded()
  await expect(pages.nth(1)).toBeInViewport({ ratio: 0.9 })
})

test('on a phone, focus mode’s pages lay out as printed: four bars a line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/song/autumn-leaves')
  await expect(page.locator('svg[aria-label^="Bars:"]')).toHaveCount(12) // 24 bars, two a line on the phone's screen
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await page.getByRole('dialog', { name: 'Controls' }).getByRole('button', { name: 'Focus', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Focus mode' })
  await expect(dialog.locator('svg[aria-label^="Bars:"]')).toHaveCount(6) // four a line, as printed
  await expect.poll(() => dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true) // fitted to the width: no sideways scroll
  // a chord's Why panel reads at full size, not the page's zoom
  await dialog.getByRole('button', { name: 'C Dorian', exact: true }).first().click()
  const why = page.getByRole('dialog', { name: /^Why:/ })
  await expect(why).toBeVisible()
  expect((await why.boundingBox())!.width).toBeGreaterThan(300)
})

/** the Scales sheet's staves, with their headings (chord and scale) */
const scaleStaves = (page: import('@playwright/test').Page) => page.locator('.break-inside-avoid')

test('the Scales sheet draws each scale once, naming the chords it covers', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: Bb\n\nsection: A\n1 | Cm7\n2 | F7\n3 | Cm9\n4 | F7\n')
  await chooseSheet(page, 'Scales')
  await expect(scaleStaves(page)).toHaveCount(2)
  await expect(scaleStaves(page).nth(0)).toContainText('C–7, · C–9')
  await expect(scaleStaves(page).nth(0)).not.toContainText('Bar')
})

test('the scale level plays on the sheets without editing the chart, and a scale you pinned stays', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: Bb\n\nsection: A\nbars: 4\n1 | Cm7\n2 | F7\n3 | BbMaj7\n')
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
  for (const label of ['Work on', 'Instrument', 'Level', 'Analysis', 'Guide Tones', 'Transposition']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  await chooseSheet(page, 'Scales')
  await expect(page.getByText('Show', { exact: true }).first()).toBeVisible() // Intervals, in place of Analysis and Guide Tones
  await expect(page.getByText('Guide Tones', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Level' })).toBeVisible() // the scale level is a dropdown in the toolbar
})

test('the preview toolbar stays tidy (at most two rows), in every sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From C') // Scales, spelled from a note: the most controls
  // how many rows the toolbar's labelled groups fall on (the content is capped at 72rem, so six groups can take two)
  const layout = () =>
    page.locator('#preview-toolbar').evaluate((el) => {
      const row = el.querySelector('[aria-label="Sheet controls"]')?.firstElementChild as HTMLElement // the rail's wrapping left groups (the actions pinned right beside them)
      const kids = Array.from(row.children, (c) => c.getBoundingClientRect())
      // groups are top-aligned (items-start), so distinct tops = visual rows
      return { rows: new Set(kids.map((r) => Math.round(r.top))).size, widths: `${row.clientWidth}: ${kids.map((r) => Math.round(r.width)).join(' + ')}` }
    })
  for (const sheet of ['Scales', 'Patterns', 'Changes']) {
    await chooseSheet(page, sheet)
    const { rows, widths } = await layout()
    expect(rows, `${sheet} (${widths})`).toBeLessThanOrEqual(2)
  }
  // the Pentatonics row on, at a rung with a side: its controls stack under Analysis, so the rail keeps two rows (#255)
  await showPentatonics(page)
  await pickOption(page, 'Pentatonic rung', '2 · 4 shared')
  await expect(page.getByRole('group', { name: 'Pentatonic side' })).toBeVisible()
  const pent = await layout()
  expect(pent.rows, `Changes, Pentatonics (${pent.widths})`).toBeLessThanOrEqual(2)
  // a preset's Step by, with Bars and its count, stacks under Path too (#276)
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name: 'Fifths' }).click()
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Bars', exact: true }) }).click()
  await expect(page.getByRole('group', { name: 'Bars a step' })).toBeVisible()
  const stepped = await layout()
  expect(stepped.rows, `Changes, Pentatonics stepped (${stepped.widths})`).toBeLessThanOrEqual(2)
  // a line's detail (From 3rd; under the Pentatonics, the Pentatonic line's direction and Leave out, #284) opens beneath the Line control: nothing moves
  const line = page.locator('#preview-toolbar [data-slot=label]').getByText('Line', { exact: true })
  // where the label sits in the toolbar (not the viewport: a shorter sheet below can scroll the page)
  const place = async () => {
    const [l, t] = await Promise.all([line.boundingBox(), page.locator('#preview-toolbar').boundingBox()])
    return l && t ? { x: l.x - t.x, y: l.y - t.y } : null
  }
  const at = await place()
  for (const mode of ['Guide Tones', 'Pentatonic', 'Cells'] as const) {
    await showLine(page, mode)
    const { rows, widths } = await layout()
    expect(rows, `Changes, ${mode} (${widths})`).toBeLessThanOrEqual(2)
    expect(await place(), mode).toEqual(at)
  }
})


test('practising, the rail scrolls away with the page: the notes are what matter', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/song/autumn-leaves')
  const rail = page.getByRole('group', { name: 'Sheet controls' })
  await expect(rail.getByRole('button', { name: 'Print' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect.poll(async () => (await rail.boundingBox())!.y).toBeLessThan(-100)
  await expect(rail).not.toHaveAttribute('data-stuck')
})

test('editing, the rail sticks over the sheet from lg, and a chord tapped under it opens clear of it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/song/autumn-leaves')
  const rail = page.getByRole('group', { name: 'Sheet controls' })
  await expect(rail).not.toHaveAttribute('data-stuck')
  await expect(rail.getByRole('button', { name: 'Print' })).toBeVisible()
  await rail.getByRole('button', { name: 'Edit' }).click()
  await expect(sheetChord(page, 'Am7b5', 'B', 1)).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect(rail).toHaveAttribute('data-stuck')
  const railBox = (await rail.boundingBox())!
  expect(Math.round(railBox.y)).toBeLessThanOrEqual(0)
  await sheetChord(page, 'Am7b5', 'B', 1).click()
  const field = page.getByLabel('Chord, B bar 1', { exact: true })
  await expect(field).toBeFocused()
  expect((await field.boundingBox())!.y).toBeGreaterThanOrEqual(railBox.y + railBox.height)
  await page.keyboard.press('Escape')
  // a taller rail (the guide line's detail under Line): a chord focused from the keyboard still scrolls in clear of it
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(rail).not.toHaveAttribute('data-stuck')
  await showLine(page, 'Guide Tones')
  const chord = sheetChord(page, 'Am7b5', 'B', 13)
  await chord.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 60)) // under the stuck rail
  await chord.focus()
  await expect(rail).toHaveAttribute('data-stuck')
  const tall = (await rail.boundingBox())!
  expect((await chord.boundingBox())!.y).toBeGreaterThanOrEqual(tall.y + tall.height)
})
