import { chooseInstrument, expect, openEditor, test, writeChart } from './fixtures'

/** the chart text without its column padding */
const plain = async (page: import('@playwright/test').Page): Promise<string> => (await page.getByLabel('Chart text').inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')

test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1') // the starter chart: Dm7 G7 CMaj7, on the Changes sheet
  await openEditor(page)
})

test('clicking a chord on the Changes sheet opens its field in place', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const chord = page.getByRole('button', { name: 'Edit G7, A bar 2' })
  const at = await chord.boundingBox()
  await chord.click()
  const field = page.getByRole('combobox', { name: 'Chord, A bar 2' })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('G7')
  const box = await field.boundingBox()
  expect(box && at && Math.abs(box.x - at.x) < 16).toBe(true) // on the chord's beat (the click scrolls it into view, so y moves)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toHaveCount(0) // the sheet is the editor: no bar grid
  await field.fill('Db7')
  await field.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| Db7/)
  await expect(page.getByRole('button', { name: 'Edit Db7, A bar 2' })).toBeVisible()
})

test('on a phone the grid gives way to light edits: tap a chord, change it in a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Full editing works on a larger screen.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeVisible() // the Chart pane stays below md: its heading fields
  await expect(page.getByLabel('Time', { exact: true })).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Structure' })).toBeHidden()

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  const editor = page.getByRole('dialog')
  const box = await editor.locator('[id^=headlessui-dialog-panel]').boundingBox()
  expect(box && box.width >= 380 && Math.round(box.y + box.height) >= 840).toBe(true) // across the bottom
  const input = editor.getByRole('textbox', { name: 'Chord' })
  await input.fill('Em7')
  await input.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Em7/)
  await page.keyboard.press('Escape')
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Em7, A bar 1' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('the sheet is the editor: type into a chord with completions that read the bar, Tab moves, Space adds', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.getByText('Editing the sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  const field = page.getByRole('combobox', { name: 'Chord, A bar 2' })
  await expect(field).toHaveValue('G7')
  await field.fill('G7b')
  const options = page.getByRole('listbox', { name: 'Completions' }).getByRole('option')
  await expect(options.first()).toHaveText(/^G7b/)
  await expect(options.nth(1)).toContainText('→ G ')
  const reading = (await options.nth(1).textContent())?.split('→')[1]?.trim() ?? ''
  await field.press('ArrowDown')
  await field.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7b9/)
  // the label under the chord now reads what the completion promised
  await expect(page.locator('[data-slot=scale]', { hasText: reading }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 1' }).press('Tab')
  await expect(page.getByRole('combobox', { name: 'Chord, A bar 2' })).toBeFocused()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 1' }).press(' ')
  const slot = page.getByRole('combobox', { name: 'Chord, A bar 1' })
  await expect(slot).toHaveValue('')
  await slot.fill('A7')
  await slot.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Dm7\nA \| 1 \| A7/)
  await expect(page.getByRole('button', { name: 'Edit A7, A bar 1' })).toBeVisible()
})

test('a transposing part is shown in concert pitch while editing, and comes back on Done', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await chooseInstrument(page, 'Tenor')
  await expect(page.getByText(/Concert pitch while you edit/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit G7, A bar 2' })).toBeVisible() // not A7, the tenor's
  await page.getByRole('button', { name: 'Done editing' }).click()
  await expect(page.getByText(/Concert pitch while you edit/)).toBeHidden()
  await expect(page.getByText('A7').first()).toBeVisible()
})

test('a refused chord keeps the field open and says why; Escape restores the chord', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  const field = page.getByRole('combobox', { name: 'Chord, A bar 2' })
  await field.fill('G7 | x')
  await field.press('Enter')
  await expect(page.getByText(/can’t go in a chart/)).toBeVisible()
  await expect(field).toBeVisible()
  await field.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit G7, A bar 2' })).toBeVisible()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7\n/)
})

test('the numeral opens the function list and the scale label the scale list; a pinned scale shows its pin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'V7', exact: true }).first().click()
  const fn = page.getByRole('dialog', { name: 'Function: G7' })
  await expect(fn.getByRole('radiogroup', { name: 'Function' })).toBeVisible()
  await expect(fn).toContainText('Why')
  await page.keyboard.press('Escape')
  await expect(fn).toBeHidden()
  await page.getByRole('button', { name: 'G Mixo', exact: true }).first().click()
  const sc = page.getByRole('dialog', { name: 'Scale: G7' })
  await sc.getByRole('radiogroup', { name: 'Scale' }).getByRole('radio', { name: /^G Altered/ }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7 \| G Altered/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'G Altered', exact: true }).first().locator('[data-pin]')).toBeVisible()
})

test('the numeral picker accepts a guessed function, and takes any function typed in full', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | CMaj7\n')
  const guessed = page.getByRole('button', { name: 'II7', exact: true }).first() // D7: II7 in C, not resolving (ruling D5, a guess)
  await expect(guessed).toHaveClass(/decoration-amber-500/)
  await guessed.click()
  const d7 = page.getByRole('dialog', { name: 'Function: D7' })
  await expect(d7).toContainText('could only guess here')
  await d7.getByRole('button', { name: 'Accept guess' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| D7 \| +\| II7\n/)
  await expect(page.getByRole('button', { name: 'II7', exact: true }).first()).not.toHaveClass(/decoration-amber-500/)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'V7', exact: true }).first().click()
  const g7 = page.getByRole('dialog', { name: 'Function: G7' })
  const other = g7.getByRole('textbox', { name: 'Other function' })
  await other.fill('banana')
  await other.press('Enter')
  await expect(g7).toContainText("\"banana\" isn't a function")
  await expect.poll(() => plain(page)).toMatch(/A \| 4 \| G7\n/)
  await other.fill('F: V7/V') // G7 heard in F: its key prefix stays as typed
  await expect(g7.getByRole('status', { name: 'The scale it gives' })).toContainText(/^→ G /)
  await other.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 4 \| G7 \| +\| F: V7\/V\n/)
  await expect(page.getByRole('button', { name: 'V7/V', exact: true }).first()).toBeVisible()
})

test('the bar toolbar inserts and deletes bars, the ghost bar adds one, + Section adds a section', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).hover()
  await page.getByRole('button', { name: 'Insert a held bar after A bar 2' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7\nA \| 4 \| CMaj7/)
  await page.getByRole('button', { name: 'Edit CMaj7, A bar 4' }).hover()
  await page.getByRole('button', { name: 'Delete A bar 4' }).click()
  await expect.poll(() => plain(page)).not.toMatch(/CMaj7/)
  await page.getByRole('button', { name: 'Add a bar at the end of A' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Dm7\nA \| 2 \| G7\nA \| 3 \| G7/) // at the part's end a held bar wouldn't count: the sounding chord is written
  await page.getByRole('button', { name: 'Section', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Section name').fill('B')
  await dialog.getByLabel('First chords').fill('Fm7 Bb7')
  await dialog.getByRole('button', { name: 'Add section' }).click()
  await expect.poll(() => plain(page)).toMatch(/B \| 5 \| Fm7\nB \| 5 \| Bb7/) // numbered on from A's four bars
})

test('the toolbar’s menu sets a jump and starts a new section at a bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit CMaj7, A bar 3' }).hover()
  await page.getByRole('button', { name: 'More actions for A bar 3' }).click()
  await page.getByRole('menuitem', { name: 'Jump…' }).click()
  const jump = page.getByRole('dialog')
  await jump.getByLabel('Jump').selectOption('Fine')
  await jump.getByRole('button', { name: 'Set' }).click()
  await expect.poll(() => plain(page)).toMatch(/@nav A 3 Fine/)
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).hover()
  await page.getByRole('button', { name: 'More actions for A bar 2' }).click()
  await page.getByRole('menuitem', { name: 'New section here…' }).click()
  const split = page.getByRole('dialog')
  await split.getByLabel('Section name').fill('B')
  await split.getByRole('button', { name: 'Start section' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Dm7\nB \| 2 \| G7/)
})

test('the heading is edited where it prints, and nothing of the editor prints', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const sheet = page.getByRole('region', { name: 'Preview' }) // the grid's heading fields have the same names
  const title = sheet.getByRole('textbox', { name: 'Title', exact: true })
  await title.fill('My Tune')
  await expect.poll(() => plain(page)).toMatch(/^title: My Tune/)
  await expect(page.getByRole('heading', { name: 'My Tune' })).toBeVisible() // the page's heading follows
  await sheet.getByRole('combobox', { name: 'Key', exact: true }).selectOption('Em')
  await expect.poll(() => plain(page)).toMatch(/^key: Em$/m)
  await sheet.getByRole('textbox', { name: 'Composer', exact: true }).fill('Kosma')
  await expect.poll(() => plain(page)).toMatch(/^composer: Kosma$/m)
  await page.emulateMedia({ media: 'print' })
  await expect(title).toBeHidden()
  await expect(page.getByText('Editing the sheet')).toBeHidden()
  await expect(page.getByRole('toolbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a bar at the end of A' })).toBeHidden()
})

test('⇧Tab moves back a bar; Tab from the last chord returns focus to its button (review)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 2' }).press('Shift+Tab')
  await expect(page.getByRole('combobox', { name: 'Chord, A bar 1' })).toBeFocused()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Edit CMaj7, A bar 3' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 3' }).press('Tab')
  await expect(page.getByRole('button', { name: 'Edit CMaj7, A bar 3' })).toBeFocused()
  await expect(page.getByRole('combobox', { name: /^Chord, / })).toHaveCount(0)
})

test('→ and ← walk the chords: through a bar’s, then into the next or previous bar’s; inside the text they move the caret', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Em7\nA | 2 | G7\nA | 2 | Db7\nA | 3 | CMaj7\n')
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  const fields = page.getByRole('combobox', { name: /^Chord, / })
  await expect(fields).toHaveValue('G7') // selected: → is the next chord
  await page.keyboard.press('ArrowRight')
  await expect(fields).toHaveValue('Db7') // the bar's second chord
  await page.keyboard.press('ArrowRight')
  await expect(fields).toHaveValue('CMaj7') // the next bar's first
  await expect(fields).toHaveAccessibleName('Chord, A bar 3')
  await page.keyboard.press('ArrowLeft')
  await expect(fields).toHaveValue('Db7') // back: the previous bar's last
  await page.keyboard.press('ArrowLeft')
  await expect(fields).toHaveValue('G7')
  await page.keyboard.type('G13') // over the selection; the caret is now at the end
  await page.keyboard.press('ArrowLeft') // inside the text: the caret moves, the field stays
  await expect(fields).toHaveValue('G13')
  await expect(fields).toHaveJSProperty('selectionStart', 2)
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(fields).toHaveJSProperty('selectionStart', 0)
  await page.keyboard.press('ArrowLeft') // at the start: commits, and opens the previous bar's chord
  await expect(fields).toHaveValue('Em7')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G13/)
  await page.keyboard.press('ArrowLeft') // the first chord: nowhere to go, focus back on its button
  await expect(page.getByRole('button', { name: 'Edit Em7, A bar 1' })).toBeFocused()
  await expect(fields).toHaveCount(0)
})

test('a chord drawn twice (a written-out repeat) opens one field, where it was clicked (review)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nB | 1 | Fm7\n@copy A C 0\n')
  await page.getByRole('button', { name: 'Edit G7, C bar 2' }).click()
  const field = page.getByRole('combobox', { name: 'Chord, C bar 2' })
  await expect(field).toBeFocused()
  await expect(page.getByRole('combobox', { name: /^Chord, / })).toHaveCount(1)
  await expect(page.getByText('C repeats A')).toBeVisible()
  await field.fill('Db7')
  await field.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| Db7/)
  await expect(page.getByRole('button', { name: 'Edit Db7, C bar 2' })).toBeVisible()
})
