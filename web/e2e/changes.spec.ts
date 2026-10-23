import type { Locator, Page } from '@playwright/test'
import { chooseGears, chooseGroups, chooseInstrument, chooseInterface, chooseRhythm, chooseRhythmStep, chooseSheet, chooseStart, closePanel, type Drawn, drawn, expect, openPanel, GLYPH, arpeggiosDrawn, guidesDrawn, openEditor, restateOn, rhythmDrawn, sheetChord, showArpeggios, showApproach, showCell, showGuides, showOrder, showTargets, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
/** the sheet itself, not the controls above it (whose menus name the same scales) */
const sheetOf = (page: Page) => lines(page).first().locator('xpath=ancestor::div[@data-slot="paper"][1]')
const lineOff = (page: Page) => page.getByRole('radio', { name: 'Off', exact: true })
/** the guide tone line's listbox, in Line options */
const guideLine = async (page: Page) => {
  await openPanel(page, 'Line options')
  return page.getByLabel('Guide tone line')
}
/** a line's guide tone labels: the row between its staff and its numerals */
const labelRow = (line: Locator) => line.locator('xpath=ancestor::*[@data-slot="system"][1]//*[@data-slot="guides"]')
/** each chord's x on a line, as a fraction of its width (ChangesSystem sets a mark's left 0.012 before its beat) */
const chordXs = (line: Locator): Promise<number[]> =>
  line.evaluate((el) =>
    Array.from(el.closest('.break-inside-avoid')?.querySelector('[data-slot="names"]')?.querySelectorAll(':scope > div') ?? []).map(
      (d) => Number.parseFloat((d as HTMLElement).style.left) / 100 + 0.012,
    ),
  )

/** every chord sits within 1% of the line's width of a notehead's centre */
async function expectChordsOnHeads(line: Locator): Promise<void> {
  const d = await drawn(line)
  const centres = d.heads.map((h) => (h.x + h.w / 2) / d.width)
  const xs = await chordXs(line)
  expect(xs.length).toBeGreaterThan(0)
  for (const x of xs) expect(Math.min(...centres.map((c) => Math.abs(c - x))), `chord at ${x.toFixed(3)}`).toBeLessThanOrEqual(0.01)
}

type Box = Readonly<{ left: number; right: number; top: number; bottom: number }>
const box = (g: Readonly<{ x: number; y: number; w: number }>, half: number): Box => ({ left: g.x, right: g.x + g.w, top: g.y - half, bottom: g.y + half })
const overlaps = (a: Box, b: Box): boolean => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

/** no two noteheads or accidentals overlap; an accidental sits flush against its own notehead (same height, just to
 * its right), and its glyph box differs by platform (it reaches 1.5px into the head on CI's Linux): that pair is not a
 * collision */
function expectNoCollisions(d: Drawn): void {
  const heads = d.heads.map((h) => box(h, 4.5))
  const accidentals = d.accidentals.map((a) => box(a, 10))
  const own = (a: Box, h: Box): boolean => Math.abs((a.top + a.bottom) / 2 - (h.top + h.bottom) / 2) < 0.5 && h.left > a.left && h.left < a.right + 1
  const boxes = [...heads, ...accidentals]
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => {
      if (accidentals.includes(b) && heads.includes(a) && own(b, a)) return
      expect(overlaps(a, b), `${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(false)
    }),
  )
}
test('the Changes sheet: slashes, chords, numerals and scales, a repeat, and toggles that stick', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await expect(lines(page)).toHaveCount(6) // A1 · A2 played twice, then B: 24 bars, four a line
  const sheet = sheetOf(page)
  await expect(sheet.getByText('A1 · A2', { exact: true })).toBeVisible()
  await expect(sheet.getByText('ii7/♭III').first()).toBeVisible()
  await expect(sheet.getByText('D Phryg Dom').first()).toBeVisible()
  await expect(page.locator('section header p').first()).toHaveText(/\(Changes\)/)
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveCount(0) // per note: not on this sheet
  await page.getByRole('button', { name: 'Numerals' }).click()
  await expect(sheet.getByText('ii7/♭III')).toHaveCount(0)
  await page.getByRole('button', { name: 'Scales', exact: true }).click()
  await expect(sheet.getByText('D Phryg Dom')).toHaveCount(0)
  await page.reload()
  await chooseSheet(page, 'Changes')
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'false') // remembered
  await chooseInstrument(page, 'Tenor')
  await expect(sheetOf(page).getByText('A minor', { exact: true })).toBeVisible() // the key area, written for the tenor
})

test('a later copy is written out, a tag follows a double barline, and a share link opens on the sheet', async ({ page, browser }) => {
  await page.goto('/song/a-night-in-tunisia')
  await chooseSheet(page, 'Changes')
  await expect(page.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await expect(page.getByText('Tag', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/) // made, not "Making the link…"
  const link = await box.inputValue()
  const other = await browser.newContext()
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toBeVisible()
  await expect(visitor.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await other.close()
})

test('a numeral or scale with a note looks clickable on screen (dotted underline, pointer), and prints plain', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n')
  const numeral = page.getByRole('button', { name: 'ii7', exact: true }).first()
  await expect(numeral).toHaveCSS('text-decoration-style', 'dotted')
  await expect(numeral).toHaveCSS('text-decoration-line', 'underline')
  await expect(numeral).toHaveCSS('cursor', 'pointer')
  await page.emulateMedia({ media: 'print' })
  await expect(numeral).toHaveCSS('text-decoration-line', 'none')
})

test('a function from the numeral’s picker: the sheet shows it, its note opens on a click once done, and a key change comes from the bar’s menu', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | D7\n3 | Dm7\n4 | G7\n')
  const text = page.getByLabel('Chart text')
  const sheet = sheetOf(page)
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // D7's numeral: while editing, the function picker, with the why under it
  const picker = page.getByRole('dialog', { name: 'Function: D7' })
  const fns = picker.getByRole('radiogroup', { name: 'Function' })
  await expect(fns.getByRole('radio').first()).toHaveAccessibleName(/^Auto: II7\s*→ D Mixolydian$/)
  await expect(picker.getByText('II7 in C, not resolving: natural tensions', { exact: true })).toBeVisible() // the Why (the default Changes sheet's tooltips say it too)
  await fns.getByRole('radio', { name: /^V7\/V \(to G\)\s*→ D Mixolydian$/ }).click()
  await expect(text).toHaveValue(/\n2 \| D7\s+\|\s+\| V7\/V/)
  await expect(fns.getByRole('radio', { name: /^V7\/V \(to G\)/ })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
  const numeral = sheet.getByRole('button', { name: 'V7/V' })
  await page.getByRole('button', { name: 'Done editing' }).click() // not editing: the numeral opens why
  await numeral.click()
  const note = page.getByRole('dialog', { name: 'Why: D7' })
  await expect(note).toContainText('* V7/V in C: natural tensions')
  await expect(note).toContainText('in C major')
  await expect(note.getByRole('link', { name: 'D4' })).toHaveAttribute('href', '/functions#rule-D4')
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
  await openEditor(page)
  await text.fill('title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | D7 |  | Db: V7/ii\n3 | Dm7\n4 | G7\n')
  await expect(sheetChord(page, 'Dm7', 'A', 3)).toBeAttached() // parsed
  await expect(sheet.getByRole('button', { name: 'II7', exact: true })).toContainText('⚠') // marked: the written function doesn't fit
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // the sheet reads the analysis
  await expect(picker.getByText('V7/ii in Db is on Bb, not D7', { exact: true })).toBeVisible() // the picker says what's wrong with the function
  await page.keyboard.press('Escape')
  await sheetChord(page, 'Dm7', 'A', 3).hover()
  await page.getByRole('button', { name: 'More actions for A bar 3' }).click()
  await page.getByRole('menuitem', { name: 'Key change here' }).click()
  await expect(text).toHaveValue(/@key 3 C\n3 +\| Dm7/)
  await page.getByRole('button', { name: 'Done editing' }).click()
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // not editing: why opens, saying first what's wrong
  await expect(page.getByRole('dialog', { name: 'Why: D7' })).toContainText('⚠ V7/ii in Db is on Bb, not D7')
})

test('a function picked from the numeral changes the scale the Changes sheet plays on a blank cell', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | CMaj7\n2 | D7\n3 | Dm7\n4 | G7\n5 | CMaj7\n')
  const sheet = sheetOf(page)
  await expect(sheet).toContainText('D Mixo') // the sheet's short names
  await sheet.getByRole('button', { name: 'D Mixo', exact: true }).click() // D7's scale label: the scale list
  const scalePicker = page.getByRole('dialog', { name: 'Scale: D7' })
  const scales = scalePicker.getByRole('radiogroup', { name: 'Scale' }).getByRole('radio')
  await expect(scales.first()).toContainText('D Mixolydian')
  await expect(scales.first()).toBeChecked()
  await page.keyboard.press('Escape')
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // its numeral: the function list
  const fnPicker = page.getByRole('dialog', { name: 'Function: D7' })
  await fnPicker.getByRole('radiogroup', { name: 'Function' }).getByRole('radio').filter({ hasText: '→ D Lydian Dominant' }).first().click()
  await expect(page.getByLabel('Chart text')).toHaveValue(/\n2 \| D7\s+\|\s+\| \S/) // the function written, the scale cell left blank
  await page.keyboard.press('Escape')
  await expect(sheet).toContainText('D Lyd Dom')
  await sheet.getByRole('button', { name: 'D Lyd Dom', exact: true }).click()
  await expect(scales.first()).toContainText('D Lydian Dominant') // the analysed option follows the function
  await expect(scales.first()).toBeChecked()
  await expect(scalePicker.getByRole('button', { name: 'Unpin' })).toHaveCount(0)
})

test('a chart opens on the Changes sheet, and Scales, Arpeggios and Patterns are the other sheets', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toContainText('Changes')
  await expect(lines(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Work on' }).click()
  await expect(page.getByRole('option')).toHaveText(['Changes', 'Scales', 'Arpeggios', 'Patterns'])
  await page.keyboard.press('Escape')
})

test('From 3rd or From 7th puts each chord’s guide tone in place of its slashes, labeled, and stays chosen', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n1 | G7sus4\n2 | C6\n2 | C\n3 | Em7\n3 | A7\n4 | Dm7\n4 | G7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7$/) // no guide tones yet
  await expect(lineOff(page)).toBeChecked() // off until chosen
  await expect.poll(async () => (await drawn(line)).slashes).toBe(16) // four bars of slashes
  await showGuides(page, 'From 3rd')
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7; guide tones: /)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(8) // a half note a chord
  expect((await drawn(line)).slashes).toBe(0)
  await expect(labelRow(line)).toHaveText(/^\s*3\s*7\s*3\s*3\s*7\s*7\s*3\s*7\s*$/) // from the Dm7's 3rd (F5, the run placed nearest the centre): F5 F5 E5 E5 D5 G5 F5 F5. G7sus4's nearest guide tone is its 7th (the F, a common tone); the lines meet on D5 at Em7, and A, above before, goes up to G5 at A7 (G2: D is not a guide tone of A7; alone it would take C#5); at the last G7, F5 again
  await showGuides(page, 'From 7th')
  await expect(await guideLine(page)).toContainText('From 7th')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*4\s*6\s*1\s*7\s*3\s*7\s*3\s*$/) // from the Dm7's 7th: a sus chord's 4th, a 6 chord's 6th, a triad's root
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(8) // one line at a time
  await expectChordsOnHeads(line)
  await page.reload()
  await expect(await guideLine(page)).toContainText('From 7th') // remembered
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
})

test('choosing Off, From 3rd, From 7th and Off again redraws the line each time', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n')
  const line = lines(page).first()
  await expect(line).not.toHaveAttribute('aria-label', /guide tones/)
  await showGuides(page, 'From 3rd')
  await expect(labelRow(line)).toHaveText(/^\s*3\s*7\s*3\s*$/)
  await expect.poll(async () => (await drawn(line)).heads.length).toBeGreaterThan(0)
  const third = { aria: await line.getAttribute('aria-label'), ys: (await drawn(line)).heads.map((h) => h.y) }
  await showGuides(page, 'From 7th')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*3\s*7\s*$/) // another line, not the same one relabeled
  await expect(line).not.toHaveAttribute('aria-label', third.aria ?? '') // the staff is redrawn: other notes
  await expect.poll(async () => (await drawn(line)).heads.map((h) => h.y)).not.toEqual(third.ys)
  expect((await drawn(line)).heads.length).toBeGreaterThan(0)
  await showGuides(page, 'Off')
  await expect(line).not.toHaveAttribute('aria-label', /guide tones/)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(0) // no notes
  await expect(page.locator('[data-slot="guides"]')).toHaveCount(0) // and no label row
  await expect.poll(async () => (await drawn(line)).slashes).toBe(16) // the slashes are back
})

test('the guide tone choice survives a reload and rides a share link', async ({ page, browser }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n')
  await showGuides(page, 'From 7th')
  await page.reload()
  await expect(await guideLine(page)).toContainText('From 7th')
  await expect(labelRow(lines(page).first())).toHaveText(/^\s*7\s*3\s*7\s*$/)
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/) // made, not "Making the link…"
  const link = await box.inputValue()
  const other = await browser.newContext() // fresh storage: its own preference is Off
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(await guideLine(visitor)).toContainText('From 7th')
  await expect(labelRow(lines(visitor).first())).toHaveText(/^\s*7\s*3\s*7\s*$/)
  await other.close()
})

test('7th Chords arpeggiates each chord: quarters for one a bar, eighths for two, sixteenths for more, beamed', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n2 | G7\n3 | Dm7\n3 | G7\n3 | C\n4 | CMaj7\n')
  const line = lines(page).first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4 \| D5 F5 A5 C6, G4 B4 D5 F5 \| /) // each chord nearest the last note, in piano's range (to E6)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(4 + 8 + 16 + 4)
  expect((await drawn(line)).slashes).toBe(0)
  expect(await line.locator('.vf-beam').count()).toBeGreaterThan(0)
  await expect(labelRow(line)).toHaveCount(0) // no labels under arpeggio notes
  await showArpeggios(page, 'Down · root')
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: B4 G4 E4 C4 \|/)
  await page.reload()
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked() // remembered
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Arpeggio pattern')).toContainText('Down · root')
})

test('7th Chords in 3/4: six eighths for a bar of one chord, turning back after the arpeggio', async ({ page }) => {
  await writeChart(page, 'title: W\nkey: C\ntime: 3/4\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n') // a full line: a last chord holds through the empty bars after it
  const line = lines(page).first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4 G4 E4 \| D4 F4 A4 C5 A4 F4 \| /) // each next chord nearest the turn-back's last note
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(4 * 6)
})

test('Approach (#298): an enclosure into each guide tone adds notes, the guide tones keep their beats, and the choice stays and rides a share link', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  const line = lines(page).first()
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  const labels = (await labelRow(line).textContent()) ?? ''
  const plain = (await drawn(line)).heads.length
  await showApproach(page, 'Diatonic above, chromatic below (enclosure)')
  await expect.poll(async () => (await drawn(line)).heads.length).toBeGreaterThan(plain) // the figures are more noteheads than chords
  await expect(labelRow(line)).toHaveText(labels) // each chord's first note is still its guide tone
  await expectChordsOnHeads(line)
  await page.reload()
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Approach', { exact: true })).toContainText('enclosure') // remembered
  await expect(page.getByLabel('Approach', { exact: true }).locator('..')).toHaveAttribute('title', 'Diatonic above, chromatic below (enclosure)') // the listbox's tooltip: the whole name, which the button truncates
  await closePanel(page, 'Line options')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const other = await browser.newContext()
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await openPanel(visitor, 'Line options')
  await expect(visitor.getByLabel('Approach', { exact: true })).toContainText('enclosure')
  await other.close()
})

test('Cells (#298): a cell on each beat 1 and 3 of a chord, eighths beamed by the beat, and the choice stays and rides a share link', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  const line = lines(page).first()
  await showCell(page, 'Root to root')
  // Phrase (#379) on: Cm7's first slot is 1 3 5 7, ending a step below its own second slot's C; F7's, 1 3 5 7 into C's B
  await expect(line).toHaveAttribute('aria-label', /; cells: C4 E♭4 G4 B♭4 C5 B♭4 A4 G4 \| F4 A4 C5 E♭5 F5 /)
  const bars = 4
  const beats = 4 // Autumn Leaves is in 4/4
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(bars * beats * 2) // eighths throughout: every chord has a cell a two beats
  expect((await drawn(line)).slashes).toBe(0)
  expect(await line.locator('.vf-beam').count()).toBe(bars * beats) // a beam for each beat's pair of eighths (changesDrawing beams by the beat)
  await expectChordsOnHeads(line) // each chord sits on a note, on its beat 1 or 3
  await expect(labelRow(line)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked() // remembered: the cells share its slot
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Arpeggio pattern', { exact: true })).toContainText('Root to root')
  await closePanel(page, 'Line options')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const other = await browser.newContext()
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await openPanel(visitor, 'Line options')
  await expect(visitor.getByLabel('Arpeggio pattern', { exact: true })).toContainText('Root to root')
  await other.close()
})

test('Order (#376): 1 2 3 5 reversed plays each cell 5 3 2 1, and the choice stays; Phrase shows for a system, not a cell', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  const line = lines(page).first()
  await showCell(page, '1 2 3 5')
  await expect(line).toHaveAttribute('aria-label', /; cells: C5 D5 E♭5 G5 /)
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Order', { exact: true })).toContainText('Order: As written')
  await expect(page.getByRole('button', { name: 'Phrase', exact: true })).toHaveCount(0) // one cell: nothing to aim
  await closePanel(page, 'Line options')
  await showOrder(page, 'Reversed')
  await expect(line).toHaveAttribute('aria-label', /; cells: G5 E♭5 D5 C5 /) // Cm7's 5 3 2 1, falling from G5
  await page.reload()
  await expect(line).toHaveAttribute('aria-label', /; cells: G5 E♭5 D5 C5 /) // remembered
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Order', { exact: true })).toContainText('Reversed')
  await closePanel(page, 'Line options')
  await showCell(page, '3rd to 3rd')
  await openPanel(page, 'Line options')
  await expect(page.getByRole('button', { name: 'Phrase', exact: true })).toHaveAttribute('aria-pressed', 'true') // a system: on until turned off
})

test('Phrase (#379): root to root over I–♭III–♭VI–♭II aims C’s cell into E♭ (C A G E); Off plays the system as written (C D E G)', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 2\n1 | CMaj7\n1 | Eb7\n2 | AbMaj7\n2 | Db7\n')
  const line = lines(page).first()
  await showCell(page, 'Root to root')
  await expect(line).toHaveAttribute('aria-label', /; cells: C\d A\d G\d E\d, E♭\d D♭\d C\d B♭\d /)
  await openPanel(page, 'Line options')
  const phrase = page.getByRole('button', { name: 'Phrase', exact: true })
  await expect(phrase).toHaveAttribute('aria-pressed', 'true')
  await phrase.click()
  await expect(phrase).toHaveAttribute('aria-pressed', 'false')
  await closePanel(page, 'Line options')
  await expect(line).toHaveAttribute('aria-label', /; cells: C\d D\d E\d G\d, E♭\d D♭\d C\d B♭\d /)
  await page.reload()
  await expect(line).toHaveAttribute('aria-label', /; cells: C\d D\d E\d G\d, E♭\d D♭\d C\d B♭\d /) // remembered
})

test('a share link carries the Cells line’s Order and Phrase off (#376, #462)', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  const line = lines(page).first()
  await showCell(page, '3rd to 3rd')
  await showOrder(page, 'Rotated')
  await openPanel(page, 'Line options')
  await page.getByRole('button', { name: 'Phrase', exact: true }).click()
  await closePanel(page, 'Line options')
  const label = await line.getAttribute('aria-label')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const other = await browser.newContext()
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toHaveAttribute('aria-label', label ?? '')
  await openPanel(visitor, 'Line options')
  await expect(visitor.getByLabel('Order', { exact: true })).toContainText('Rotated')
  await expect(visitor.getByRole('button', { name: 'Phrase', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await other.close()
})

test('Phrase (#378): G7 for a whole bar → C reads its second cell through D♭7 (F A♭ C♭ E♭, into C’s E); Off plays G7’s own (B D G F)', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | G7\n2 | C\n')
  const line = lines(page).first()
  await showCell(page, '3rd to 3rd')
  await expect(line).toHaveAttribute('aria-label', /; cells: B\d A\d G\d F\d F\d A♭\d C♭\d E♭\d \| E\d /)
  await openPanel(page, 'Line options')
  await page.getByRole('button', { name: 'Phrase', exact: true }).click()
  await closePanel(page, 'Line options')
  await expect(line).toHaveAttribute('aria-label', /; cells: B\d A\d G\d F\d B\d D\d G\d F\d \| E\d /)
})

test('Chromatic cells (#377): ♭9 1 3 5 plays A♭ G B D over G7 and C’s arpeggio over C, and the choice stays', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | G7\n2 | C\n')
  const line = lines(page).first()
  await showCell(page, '♭9 1 3 5')
  await expect(line).toHaveAttribute('aria-label', /; cells: A♭\d G\d B\d D\d A♭\d G\d B\d D\d \| C\d E\d G\d /)
  // the chart's save is debounced (useSavedChart): wait for it before reloading
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('csm-chart:') && (localStorage.getItem(k) ?? '').includes('2 | C')))).toBe(true)
  await page.reload()
  await expect(line).toHaveAttribute('aria-label', /; cells: A♭\d G\d B\d D\d A♭\d G\d B\d D\d \| C\d E\d G\d /) // remembered
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Arpeggio pattern', { exact: true })).toContainText('♭9 1 3 5')
  await expect(page.getByRole('button', { name: 'Phrase', exact: true })).toHaveCount(0) // a single cell: phrase leaves it as chosen
})

test('a share link carries the arpeggio pattern', async ({ page, browser }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | CMaj7\n')
  await showArpeggios(page, 'Voice-led')
  await arpeggiosDrawn(page)
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/) // made, not "Making the link…"
  const link = await box.inputValue()
  const other = await browser.newContext() // fresh storage: its own preference is Off
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await openPanel(visitor, 'Line options')
  await expect(visitor.getByLabel('Arpeggio pattern')).toContainText('Voice-led')
  await closePanel(visitor, 'Line options')
  await arpeggiosDrawn(visitor)
  await other.close()
})

test('one voice’s stems: up below the middle line, down above it', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n1 | G7\n2 | CMaj7\n2 | A7\n3 | Dm7\n3 | G7\n4 | CMaj7\n4 | Am7\n') // two chords a bar: half notes, which have stems
  await chooseInstrument(page, 'Guitar') // a low centre (F♯4), so the two lines sit either side of the middle line
  const stems: { from: number; to: number }[] = []
  for (const choice of ['From 3rd', 'From 7th'] as const) { // the 3rd line sits low (F4, E4), the 7th line high (C5, B4)
    await showGuides(page, choice)
    await guidesDrawn(page)
    await expect.poll(async () => (await drawn(lines(page).first())).stems.length).toBeGreaterThan(0)
    stems.push(...(await drawn(lines(page).first())).stems)
  }
  const clear = stems.filter((st) => Math.abs(st.from - 100) > 3) // the middle line is y 100
  expect(clear.some((st) => st.from > 100) && clear.some((st) => st.from < 100)).toBe(true) // notes on both sides
  for (const st of clear) expect(st.from > 100 ? st.to < st.from : st.to > st.from, `stem from ${st.from} to ${st.to}`).toBe(true)
})

test('a guide tone line: the ii–V–I’s labels alternate, and each held chord ties', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | Dm7\n3 | G7\n5 | CMaj7\n')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Dm7 \| – \| G7 \| –/)
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /; guide tones: F4 3/) // Dm7: its 3rd, F
  await expect(labelRow(line)).toHaveText(/^\s*3\s*7\s*$/) // Dm7 3, then G7 7
  await expect(labelRow(lines(page).nth(1))).toHaveText(/^\s*3\s*$/) // CMaj7: 3 again
  for (const svg of await lines(page).all()) expect((await drawn(svg)).ties.length).toBeGreaterThan(0)
})

test('a chord held over a line break: an open tie ends line 1, a half-tie starts line 2', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 8\n1 | Dm7\n3 | G7\n6 | CMaj7\n') // G7: bars 3-5, across the break after bar 4
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  const openTies = async () => {
    const one = await drawn(lines(page).nth(0))
    const lastHead = Math.max(...one.heads.map((h) => h.x))
    return one.ties.filter((t) => t.x >= lastHead - 3).length
  }
  const halfTies = async () => {
    const two = await drawn(lines(page).nth(1))
    const firstHead = Math.min(...two.heads.map((h) => h.x))
    return two.ties.filter((t) => t.x < firstHead).length
  }
  await expect.poll(openTies).toBe(1) // an open tie, from bar 4's note
  await expect.poll(halfTies).toBe(1) // a half-tie in, before bar 5's note (polled: line 2 may draw after line 1)
})

test('guide tones are written for the part, in its range: a B♭ trumpet within G3–G5, a trombone in bass clef within E2–E4', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await showGuides(page, 'From 3rd')
  await chooseInstrument(page, 'Trumpet')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: F\d 3/) // concert C–7 is written D–7: 3rd F
  await guidesDrawn(page)
  const heads = async () => (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.heads.map((h) => h.y))
  const written = await heads()
  expect(Math.min(...written)).toBeGreaterThanOrEqual(75) // G5, a space above the treble staff (lines at 80–120, 5 a step)
  expect(Math.max(...written)).toBeLessThanOrEqual(145) // G3, two ledger lines below it
  const trumpet = await lines(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await chooseInstrument(page, 'Trombone')
  await expect.poll(() => lines(page).evaluateAll((els, before) => els.every((e, i) => e.getAttribute('aria-label') !== before[i]), trumpet)).toBe(true)
  await expect.poll(async () => (await drawn(lines(page).first())).clefs).toEqual([GLYPH.fClef]) // line 1's clef
  await expect(page.locator('.vf-clef')).toHaveCount(1)
  const ys = await heads()
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(60) // E4, two steps above the bass staff's ledger C4
  expect(Math.max(...ys)).toBeLessThanOrEqual(130) // E2, a ledger line below the bass staff
})

test('the player’s range moves the guide tones, and is kept for the instrument (#359)', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await showGuides(page, 'From 3rd')
  await chooseInstrument(page, 'Clarinet')
  await guidesDrawn(page)
  const heads = async () => (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.heads.map((h) => h.y))
  const before = await lines(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await openPanel(page, 'Instrument')
  await page.getByRole('button', { name: 'Lowest note' }).click()
  await page.getByRole('option', { name: 'F4', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Highest note' })).toHaveText('F6') // pushed along: two octaves
  await expect.poll(() => lines(page).evaluateAll((els, b) => els.some((e, i) => e.getAttribute('aria-label') !== b[i]), before)).toBe(true)
  expect(Math.max(...(await heads()))).toBeLessThanOrEqual(115) // F4, the treble staff's first space (lines at 80–120, 5 a step)
  await page.reload()
  await openPanel(page, 'Instrument')
  await expect(page.getByRole('button', { name: 'Lowest note' })).toHaveText('F4')
  await chooseInstrument(page, 'Tenor Sax')
  await expect(page.getByRole('button', { name: 'Lowest note' })).toHaveText('B♭3') // the tenor's own: its preset
  await expect(page.getByRole('button', { name: 'Highest note' })).toHaveText('C6')
})

test('a waltz’s guide tones are in 3/4: a bar-long chord is a dotted half', async ({ page }) => {
  await page.goto('/song/someday-my-prince-will-come')
  await showGuides(page, 'From 7th')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /; guide tones: /)
  await expect(line.locator('.vf-timesignature').first()).toBeAttached()
  const d = await drawn(line)
  expect(d.heads).toHaveLength(4) // FMaj7 | B7#11 | BbMaj7 | D7alt, a bar each
  expect(d.dots).toBe(4)
  await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
})

test('a metre change partway: a time signature where it changes, each bar in its own metre (#235)', async ({ page }) => {
  await writeChart(page, 'title: M\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | C6\n@time 2 3/4\n@time 3 6/4\n@time 4 5/4\n')
  const line = lines(page).first()
  await expect(line.locator('.vf-timesignature')).toHaveCount(4) // 4/4, 3/4, 6/4, 5/4
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  const d = await drawn(line)
  expect(d.heads).toHaveLength(5) // a note a bar, the 5/4 bar's a dotted half tied to a half
  expect(d.dots).toBe(3) // 3/4's dotted half, 6/4's dotted whole, 5/4's dotted half
  await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
})

test('guide tone notes follow dark mode (no hard-coded black)', async ({ page }) => {
  await page.goto('/song/f-jazz-blues')
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  const black = page.locator(['stroke="black"', 'fill="black"', 'stroke="#000000"', 'fill="#000000"'].map((a) => `svg[aria-label^="Bars:"] [${a}]`).join(', '))
  await expect(black).toHaveCount(0)
})

// on a phone, two bars of four chords don't fit a line together (their names would shrink too far): each gets its own
for (const [width, bars, label] of [
  [1400, 4, /^Bars: Em7 A7 Dm7 G7 \| Ebm7 Ab7 Dbm7 Gb7.*; guide tones: /],
  [390, 2, /^Bars: Em7 A7 Dm7 G7; guide tones: /],
] as const) {
  test(`four chords a bar, a guide tone line, ${bars} bars a line: no notehead or accidental collides, and each chord sits on its note`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Em7\n1 | A7\n1 | Dm7\n1 | G7\n2 | Ebm7\n2 | Ab7\n2 | Dbm7\n2 | Gb7\n3 | CMaj7\n4 | C#m7b5\n4 | F#7\n')
    await showGuides(page, 'From 3rd')
    const line = lines(page).first()
    await expect(line).toHaveAttribute('aria-label', label)
    await guidesDrawn(page)
    const all = await Promise.all((await lines(page).all()).map(drawn))
    for (const d of all) expect(d.width).toBe(300 * bars)
    expect(all.flatMap((d) => d.heads).length).toBeGreaterThanOrEqual(11)
    expect(all.flatMap((d) => d.accidentals).length).toBeGreaterThan(0)
    for (const d of all) expectNoCollisions(d)
    for (const l of await lines(page).all()) await expectChordsOnHeads(l)
  })
}

for (const [width, bars] of [
  [1400, 4],
  [390, 2],
] as const) {
  test(`vibes, ${bars} bars a line: a line down to G3 draws two ledger lines below the staff, and nothing collides`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Abm7\n2 | D7\n3 | Ebm7\n4 | Gbm7\n5 | Abm7\n6 | BbMaj7\n7 | Eb7\n8 | Bm7\n') // from the 3rd: Cb4 C4 Db4 Fb4 Cb4 A3 G3 (at the Eb7) A3
    await chooseInstrument(page, 'Vibes')
    await showGuides(page, 'From 3rd')
    await guidesDrawn(page)
    const all = await Promise.all((await lines(page).all()).map(drawn))
    expect(Math.max(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeGreaterThanOrEqual(145) // G3: two ledger lines below the staff (80–120, 5 a step)
    for (const d of all) expectNoCollisions(d)
    for (const line of await lines(page).all()) await expectChordsOnHeads(line)
  })
}

for (const [width, bars] of [
  [1400, 4],
  [390, 2],
] as const) {
  test(`piano, ${bars} bars a line: a line up to E6 draws three ledger lines above the staff, and nothing collides (#331)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | FMaj7\n4 | FMaj7\n')
    await showArpeggios(page, 'Up · root')
    await arpeggiosDrawn(page)
    await expect(page.locator('svg[aria-label^="Bars:"][aria-label*="FMaj7"]').first()).toHaveAttribute('aria-label', /7th chords: (.* \| )?F5 A5 C6 E6/) // FMaj7 whole inside piano's range, its top E6
    const all = await Promise.all((await lines(page).all()).map(drawn))
    expect(Math.min(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeLessThanOrEqual(50) // E6: on the third ledger line above the staff (80–120, 5 a step)
    for (const d of all) expectNoCollisions(d)
    for (const line of await lines(page).all()) await expectChordsOnHeads(line)
  })
}

test('an unknown chord gets one rest, and a note above the sheet', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | Cm7#5#9x\n3 | G7\n4 | CMaj7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 \| Cm7#5#9x \| G7 \| CMaj7/)
  const note = page.getByRole('listitem').filter({ hasText: 'no guide tones for Cm7#5#9x (unknown chord quality)' })
  await expect(note).toHaveCount(0) // only with a guide on
  await showGuides(page, 'From 3rd')
  await expect(line).toHaveAttribute('aria-label', /; guide tones: /)
  const d = await drawn(line)
  expect(d.rests).toBe(1)
  expect(d.heads).toHaveLength(3)
  await expect(note).toBeVisible()
})

test('on a line with an ending, the bracket clears the guide tones’ stems (B♭ part)', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Trumpet')
  await showGuides(page, 'From 3rd')
  await guidesDrawn(page)
  let endings = 0
  for (const svg of await lines(page).all()) {
    const d = await drawn(svg)
    if (d.voltaBottom === null) continue
    endings += 1
    expect(d.stems.length).toBeGreaterThan(0)
    const tip = Math.min(...d.stems.map((s) => Math.min(s.from, s.to)))
    expect(d.voltaBottom, `${await svg.getAttribute('aria-label')}`).toBeLessThan(tip)
  }
  expect(endings).toBeGreaterThan(0) // the verse's 1st and 2nd endings
})

/** each chord name's box on the first line (with the marker or key area over its bar's first) */
const nameBoxes = (page: Page) =>
  page
    .locator('[data-slot="system"]')
    .first()
    .locator('[data-name]')
    .evaluateAll((els) => els.map((e) => ({ text: e.textContent?.trim() ?? '', ...e.getBoundingClientRect().toJSON() }) as { text: string; left: number; right: number }))

/** no chord name runs into the next one's */
async function expectNamesApart(page: Page): Promise<void> {
  await expect(page.locator('[data-slot="system"]').first().locator('svg')).toBeVisible()
  await expect(async () => {
    const boxes = await nameBoxes(page)
    expect(boxes.length).toBeGreaterThanOrEqual(4)
    boxes.slice(1).forEach((b, i) => expect(b.left, `${boxes[i]?.text} runs into ${b.text}`).toBeGreaterThanOrEqual(boxes[i]?.right ?? 0))
  }).toPass({ timeout: 5000 })
}

const CROWDED = 'key: Bb\n\nsection: A\n1 | Bbmaj7#11\n1 | Eb7alt\n1 | Abm7b5\n1 | Db7sus4\n2 | Dm7\n2 | G7\n3 | Cmaj7\n4 | C7\n'
test('chords on consecutive beats keep their names apart: the crowded bar widens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, CROWDED)
  await expectNamesApart(page)
  await expect(page.locator('[data-slot="system"]').first().locator('[data-name]')).toHaveCount(8) // one line
})

test('on a phone, a line whose names would shrink too far breaks: the crowded bar on a line of its own', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await writeChart(page, 'key: C\n\nsection: A\n1 | Cmaj7\n1 | A7b9\n1 | Dm7\n1 | G7sus4\n2 | Em7b5\n2 | A7\n3 | Dm7\n4 | G7\n')
  await expectNamesApart(page)
  await expect(page.locator('[data-slot="system"]').first().locator('[data-name]')).toHaveCount(4)
})

test('chords on consecutive beats keep their names apart in print', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 1000 }) // a letter page's printed width
  await writeChart(page, CROWDED)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  await expectNamesApart(page)
})

test('a pasted chart in 7/4 draws a 7/4 time signature', async ({ page }) => {
  await writeChart(page, 'title: S\nkey: C\ntime: 7/4\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | C6\n')
  const sig = lines(page).first().locator('.vf-timesignature').first()
  await expect.poll(() => sig.evaluate((el) => Array.from(el.textContent ?? '').map((c) => c.codePointAt(0)))).toEqual([0xe087, 0xe084]) // Bravura's 7 over 4, once the text is read
})

// the rhythm line (rhythm spec §8, §9): its controls show from Intermediate
test.describe('the rhythm line', () => {
  test.use({ interfaceLevel: 'intermediate' })

  test('8ths in 5 with accents: the caption names its cycle, and Saindon’s bracket marks bars 1 and 6', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
    await rhythmDrawn(page)
    await expect(page.locator('section header p').first()).toContainText('back on one every 5 bars')
    await expect(lines(page).first()).toHaveAttribute('aria-label', /; rhythm: 8ths in 5, with accents · back on one every 5 bars$/)
    await expect(page.locator('[data-rhythm-bracket="A 1"]')).toHaveCount(1)
    await expect(page.locator('[data-rhythm-bracket="A 6"]')).toHaveCount(1)
    await expect(page.locator('[data-rhythm-bracket]')).toHaveCount(3) // and bar 11, the next landing
    await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
  })

  test('a tied unit held over a line’s last barline: a half-tie ends the line', async ({ page }) => {
    await page.goto('/song/f-jazz-blues') // 4 bars a line: 32 8ths, so in 3 the statement from the 31st holds into bar 5
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'tied' })
    await rhythmDrawn(page)
    const reach = (svg: Locator) =>
      svg.evaluate((el) => {
        const boxes = Array.from(el.querySelectorAll('.vf-stavetie path')).map((p) => (p as SVGGraphicsElement).getBBox())
        return { width: Number(el.getAttribute('viewBox')?.split(' ')[2] ?? 0), right: Math.max(...boxes.map((b) => b.x + b.width)), left: Math.min(...boxes.map((b) => b.x)) }
      })
    await expect.poll(async () => { const r = await reach(lines(page).nth(0)); return r.width - r.right }).toBeLessThan(15) // open to the line's end
    await expect.poll(async () => (await reach(lines(page).nth(1))).left).toBeLessThan(40) // and a half-tie in, before line 2's first note
  })

  test('Target beats: two dots a bar in 4/4, on beats 1 and 3', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await expect(lines(page).first()).toBeVisible()
    const toggle = page.getByRole('button', { name: 'Target beats' })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    const first = page.locator('[data-slot="system"]').first()
    await expect(first.locator('[data-target-beat]')).toHaveCount(8) // 4 bars
    await expect(first.locator('[data-target-beat="0"]')).toHaveCount(4)
    await expect(first.locator('[data-target-beat="2"]')).toHaveCount(4)
    await expect(lines(page).first()).toHaveAttribute('aria-label', /; target beats: 1 and 3$/)
  })

  test('a share link carries the rhythm: it opens reading Upbeats', async ({ page, browser }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, 'Upbeats')
    await rhythmDrawn(page)
    await page.getByRole('button', { name: 'Share' }).click()
    const box = page.getByRole('dialog').getByLabel('Link')
    await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
    const link = await box.inputValue()
    const other = await browser.newContext() // fresh storage: its own rhythm is Off
    await chooseInterface(other, 'intermediate')
    const visitor = await other.newPage()
    await visitor.goto(link)
    await openPanel(visitor, 'Line options')
    await expect(visitor.getByRole('button', { name: 'Rhythm', exact: true })).toHaveText('Rhythm: Upbeats')
    await rhythmDrawn(visitor)
    await other.close()
  })
})

// the tuplet pulses (Phase 4 spec §2, §7; flag `rhythmGears`): Units families at Everything, drawn at their ratio
test.describe('the tuplet pulses', () => {
  test('quarter-note quintuplets in 5: one tuplet a bar, its number 5', async ({ page }) => {
    await page.goto('/song/f-jazz-blues') // 4/4, 4 bars a line
    await chooseRhythm(page, 'Quarter-note quintuplets', { In: 'In 5', Variation: 'with accents' })
    await rhythmDrawn(page)
    const line = lines(page).first()
    await expect(line.locator('.vf-tuplet')).toHaveCount(4)
    await expect(line.locator('.vf-tuplet text')).toHaveText(Array(4).fill(String.fromCodePoint(0xe885))) // Bravura's tuplet 5
    await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
  })

  // Task 3.2: a bar of 28 septuplet 16ths can't fit a quarter of a line (each note keeps its glyph's room), so it ran on
  // under the next bar, its tuplets over that bar's; now a bar takes its notes' room and the line breaks: two bars a line
  for (const [what, open] of [
    ['the rhythm line', async (page: Page) => {
      await page.addInitScript(() => localStorage.setItem('csm-rhythm', 'unit:16s:7:accents'))
      await page.goto('/song/f-jazz-blues')
      await rhythmDrawn(page)
    }],
    ['a poured Line', async (page: Page) => {
      await page.addInitScript(() => Object.entries({ 'csm-rhythm': 'unit:16s:7:accents', 'csm-rhythm-start': 'beat', 'csm-anticipate': '0' }).forEach(([k, v]) => localStorage.setItem(k, v)))
      await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n')
      await chooseInstrument(page, 'Piano')
      await showArpeggios(page, 'Up · root')
      await arpeggiosDrawn(page)
    }],
  ] as const) {
    test(`septuplets in 7 on ${what}: a tuplet a beat, none overlapping, each bar's notes inside it`, async ({ page }) => {
      await open(page)
      const all = await lines(page).all()
      expect(all.length).toBeGreaterThan(1)
      for (const line of all) {
        const d = await line.evaluate((svg) => {
          const rect = (e: Element) => e.getBoundingClientRect()
          const staves = Array.from(svg.querySelectorAll('.vf-stave')).map(rect)
          const notes = Array.from(svg.querySelectorAll('.vf-stavenote')).map(rect)
          const tuplets = Array.from(svg.querySelectorAll('.vf-tuplet')).map(rect).sort((a, b) => a.left - b.left)
          return {
            bars: staves.length,
            tuplets: tuplets.length,
            // adjacent brackets meet where one beat's last note ends and the next's first starts: allow that pixel
            overlaps: tuplets.slice(1).filter((t, i) => t.left < tuplets[i]!.right - 1).length,
            // each bar holds its own 28 notes: none starts past its bar's right edge
            inside: staves.map((s, b) => notes.filter((n) => n.left >= s.left && n.left < (staves[b + 1]?.left ?? s.right) && n.right <= s.right).length),
          }
        })
        expect(d.bars).toBeLessThanOrEqual(2)
        expect(d.tuplets).toBe(4 * d.bars)
        expect(d.overlaps).toBe(0)
        expect(d.inside).toEqual(Array(d.bars).fill(28))
      }
      await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
    })
  }
})

// mixed phrasing (Phase 4 spec §3, §6, §7; flag `rhythmGears`): Groups Up by section on an AABA chart, 4 bars a line
test.describe('the Groups path', () => {
  const upBySection = async (page: Page) => {
    await page.goto('/song/satin-doll')
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
    await chooseGroups(page, 'Up')
    await chooseRhythmStep(page, 'By section')
    await rhythmDrawn(page)
  }

  test('marks each section’s grouping, ③ ④ ⑤ ⑥, and names them in the lines’ aria-labels', async ({ page }) => {
    await upBySection(page)
    await expect(page.locator('section header p').first()).toContainText('in 3 → 4 → 5 → 6 → 7 · by section')
    await expect(lines(page).nth(0)).toHaveAttribute('aria-label', /, from bar 1: in 3/)
    await expect(lines(page).nth(2)).toHaveAttribute('aria-label', /, from bar 9: in 4/)
    await expect(lines(page).nth(4)).toHaveAttribute('aria-label', /, from bar 17: in 5/)
    await expect(lines(page).nth(6)).toHaveAttribute('aria-label', /, from bar 25: in 6/)
    await expect(lines(page).nth(1)).not.toHaveAttribute('aria-label', /from bar/)
    await expect(page.locator('[data-rhythm-step]')).toHaveText(['③', '④', '⑤', '⑥'])
    await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
  })

  test('a share link carries the path: it opens with the same marks', async ({ page, browser }) => {
    await upBySection(page)
    await page.getByRole('button', { name: 'Share' }).click()
    const box = page.getByRole('dialog').getByLabel('Link')
    await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
    const link = await box.inputValue()
    const other = await browser.newContext() // fresh storage: no path of its own
    await chooseInterface(other, 'everything')
    const visitor = await other.newPage()
    await visitor.goto(link)
    await rhythmDrawn(visitor)
    await expect(visitor.locator('[data-rhythm-step]')).toHaveText(['③', '④', '⑤', '⑥'])
    await other.close()
  })
})

// gears (Phase 4 spec §3, §6, §7; flag `rhythmGears`): Up the gears by 2 bars, 4 bars a line
test.describe('the Gears path', () => {
  test('names each step’s pulse over its first bar and in the lines’ aria-labels', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, '8ths', { In: 'In 4', Variation: 'with accents' })
    await chooseGears(page, 'Up the gears')
    await chooseRhythmStep(page, 'Every 2 bars')
    await rhythmDrawn(page)
    await expect(page.locator('section header p').first()).toContainText('quarter-note triplets → 8ths → triplets → 16ths → sextuplets · every 2 bars')
    await expect(lines(page).nth(0)).toHaveAttribute('aria-label', /, from bar 1: quarter-note triplets, from bar 3: 8ths(?!,)/)
    await expect(lines(page).nth(1)).toHaveAttribute('aria-label', /, from bar 5: triplets, from bar 7: 16ths/)
    await expect(page.locator('[data-rhythm-step]').first()).toHaveText('♩ triplets') // the short name; the aria-label keeps the full one
    await expect(page.locator('[data-rhythm-step]').nth(1)).toHaveText('8ths')
    await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
  })

  test('marks both where both change, the numeral first', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
    await chooseGroups(page, 'Up')
    await chooseGears(page, 'Down the gears')
    await chooseRhythmStep(page, 'Every 4 bars')
    await rhythmDrawn(page)
    await expect(page.locator('[data-rhythm-step]').first()).toHaveText('③Sextuplets')
    await expect(lines(page).nth(0)).toHaveAttribute('aria-label', /, from bar 1: in 3, sextuplets/)
  })

  // the longest short names (♩ triplets, ③ before each) at phone width, the narrowest bars, with the target dots on the same row
  test('keeps each mark clear of the target dots and inside its bar (phone width, Target beats on)', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
    await chooseGroups(page, 'Up')
    await chooseGears(page, 'Up the gears')
    await chooseRhythmStep(page, 'Every 2 bars')
    await showTargets(page)
    await page.setViewportSize({ width: 390, height: 844 }) // the controls set, the lines redraw at phone width
    await rhythmDrawn(page)
    await expect(page.locator('[data-target-beat]').first()).toBeVisible()
    await expect(page.locator('[data-rhythm-step]')).toHaveCount(6)
    type Box = Readonly<{ left: number; right: number; top: number; bottom: number }>
    const found = await page.locator('svg[aria-label^="Bars:"]').evaluateAll((svgs) => {
      const box = (e: Element): Box => {
        const r = e.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }
      const dots = Array.from(document.querySelectorAll('[data-target-beat]')).map(box)
      return svgs.flatMap((svg) => {
        const staves = Array.from(svg.querySelectorAll('.vf-stave')).map(box)
        return Array.from(svg.querySelectorAll('[data-rhythm-step]')).map((m) => ({ mark: box(m), text: m.textContent, dots, bar: staves.find((s) => s.left <= box(m).left && box(m).left < s.right) ?? null }))
      })
    })
    const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    expect(found).toHaveLength(6)
    for (const { mark, text, dots, bar } of found) {
      expect(dots.filter((d) => overlaps(mark, d)), `${text} over a target dot`).toEqual([])
      expect(bar, `${text}'s bar`).not.toBeNull()
      expect(mark.right, `${text} inside its bar`).toBeLessThanOrEqual(bar!.right)
    }
  })
})

// a rhythm poured into the Line (rhythm-on-lines spec §8): Rhythm, Start, Timing and Target beats set in storage before load
test.describe('a rhythm on the Lines', () => {
  const CHART = 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n'
  const poured = async (page: Page, prefs: Readonly<Record<string, string>>) => {
    await page.addInitScript((p) => Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, v)), prefs)
    await writeChart(page, CHART)
    await chooseInstrument(page, 'Piano')
    await showArpeggios(page, 'Up · root')
    await arpeggiosDrawn(page)
  }

  test('8ths in 3 with rests: each attack plays the arpeggio, the rests rest, and the label names the rhythm', async ({ page }) => {
    await poured(page, { 'csm-rhythm': 'unit:8:3:rests', 'csm-rhythm-start': 'beat', 'csm-anticipate': '0' })
    const line = lines(page).first()
    await expect(line).toHaveAttribute('aria-label', /7th chords: C\S* rest rest E\S* rest G\S* rest /)
    await expect(line).toHaveAttribute('aria-label', /; rhythm: 8ths in 3, with rests/)
  })

  test('Target beats under Downbeats, anticipating 2 beats: a chord tone on a target beat is colored, any other note dimmed', async ({ page }) => {
    await poured(page, { 'csm-rhythm': 'card:downbeats', 'csm-rhythm-start': 'beat', 'csm-anticipate': '2', 'csm-targets': 'on' })
    const line = lines(page).first()
    await expect(line.locator('.vf-dimmed')).toHaveCount(3) // C E D F | A C G B | D F C E | G B G E: beat 3's D, G and C
    await expect(line.locator('.vf-selected')).toHaveCount(5)
    await expect(line).toHaveAttribute('aria-label', /; target tones: C\S*, D\S* not a chord tone \| A\S*, G\S* not a chord tone \|/)
  })

  test('8th triplets in 4 with accents: a triplet bracket and accents on the Line', async ({ page }) => {
    await poured(page, { 'csm-rhythm': 'unit:8t:4:accents', 'csm-rhythm-start': 'beat', 'csm-anticipate': '0' })
    const line = lines(page).first()
    await expect(line.locator('.vf-tuplet').first()).toBeAttached()
    await expect(line.locator('text', { hasText: String.fromCodePoint(0xe4a0) }).first()).toBeAttached() // Bravura's accent above
  })

  test('Rhythm Off, Target beats on: the quarters on beats 1 and 3 are chord tones, colored', async ({ page }) => {
    await poured(page, { 'csm-rhythm': 'off', 'csm-targets': 'on' })
    const line = lines(page).first()
    await expect(line.locator('.vf-selected')).toHaveCount(8)
    await expect(line.locator('.vf-dimmed')).toHaveCount(0)
  })
})

// Start, Timing and Restate (rhythm-on-lines spec §10): in Line options, under the rhythm's detail
test.describe('Start, Timing and Restate', () => {
  const stored = (page: Page, prefs: Readonly<Record<string, string>>) => page.addInitScript((p) => Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, v)), prefs)
  const listbox = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
  /** the page's share link */
  const shareLink = async (page: Page): Promise<string> => {
    await page.getByRole('button', { name: 'Share' }).click()
    const box = page.getByRole('dialog').getByLabel('Link')
    await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
    return box.inputValue()
  }

  test('Guide Tones with a rhythm: the Rhythm names Restate, and Restate pours the guide tones into the rhythm', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await showGuides(page, 'From 3rd')
    await guidesDrawn(page)
    await chooseRhythm(page, '8ths')
    await openPanel(page, 'Line options')
    await expect(listbox(page, 'Rhythm')).toHaveAccessibleDescription("Guide tones hold each chord's note. Turn on Restate to play it in the rhythm.")
    await closePanel(page, 'Line options')
    await restateOn(page)
    await openPanel(page, 'Line options')
    await expect(listbox(page, 'Rhythm')).not.toHaveAttribute('aria-describedby')
    await expect(page.getByText('Turn on Restate to play it in the rhythm.')).toHaveCount(0)
    await expect(lines(page).first()).toHaveAttribute('aria-label', /; rhythm: /)
  })

  test('7th Chords and 8ths in 3, at Everything: Start and Timing show', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await showArpeggios(page, 'Up · root')
    await chooseRhythm(page, '8ths', { In: 'In 3' })
    await openPanel(page, 'Line options')
    await expect(listbox(page, 'Start')).toHaveText('Start: On the beat')
    await expect(listbox(page, 'Timing')).toHaveText('On time')
  })

  test.describe('at Intermediate', () => {
    test.use({ interfaceLevel: 'intermediate' })

    test('Start and Timing are hidden, and a link that sets the Start says the sheet uses Everything settings', async ({ page, browser }) => {
      await stored(page, { 'csm-line': 'arpeggio', 'csm-arpeggio': 'up-root', 'csm-rhythm': 'unit:8:3:accents', 'csm-rhythm-start': 'pickup-1' })
      await page.goto('/song/f-jazz-blues')
      await rhythmDrawn(page)
      await openPanel(page, 'Line options')
      await expect(listbox(page, 'Rhythm')).toHaveText('Rhythm: 8ths')
      await expect(listbox(page, 'Start')).toHaveCount(0)
      await expect(listbox(page, 'Timing')).toHaveCount(0)
      await closePanel(page, 'Line options')
      const link = await shareLink(page)
      const other = await browser.newContext()
      await chooseInterface(other, 'intermediate')
      const visitor = await other.newPage()
      await visitor.goto(link)
      await expect(visitor.getByRole('status').filter({ hasText: 'This sheet uses Everything settings' })).toBeVisible()
      await other.close()
    })
  })

  test('a 3-note pick-up into CMaj7 after N.C.: bar 1 ends G A B, from C Lydian below C in the Piano’s range', async ({ page }) => {
    await stored(page, { 'csm-rhythm': 'unit:8:3:accents' })
    await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | N.C.\n2 | CMaj7\n')
    await chooseInstrument(page, 'Piano')
    await showArpeggios(page, 'Up · root')
    await chooseStart(page, '3-note pick-up')
    await expect(lines(page).first()).toHaveAttribute('aria-label', /7th chords: rest rest rest G\S* A\S* B\S* \|/)
  })

  test('a share link carries the Start and the Timing: the listboxes and the caption read them', async ({ page, browser }) => {
    await stored(page, { 'csm-line': 'arpeggio', 'csm-arpeggio': 'up-root', 'csm-rhythm': 'card:downbeats', 'csm-rhythm-start': 'pickup-2', 'csm-anticipate': '1.5' })
    await page.goto('/song/f-jazz-blues')
    await rhythmDrawn(page)
    const link = await shareLink(page)
    const other = await browser.newContext() // fresh storage: on the beat, on time
    await chooseInterface(other, 'everything')
    const visitor = await other.newPage()
    await visitor.goto(link)
    await rhythmDrawn(visitor)
    await expect(visitor.locator('section header p').first()).toHaveText(/ · 2-note pick-ups · anticipate 1½ beats$/)
    await openPanel(visitor, 'Line options')
    await expect(listbox(visitor, 'Start')).toHaveText('Start: 2-note pick-up')
    await expect(listbox(visitor, 'Timing')).toHaveText('Anticipate 1½ beats')
    await other.close()
  })

  test('with the Line Off, Start and Timing are hidden and the rhythm line draws', async ({ page }) => {
    await page.goto('/song/f-jazz-blues')
    await chooseRhythm(page, '8ths', { In: 'In 3' })
    await rhythmDrawn(page)
    await expect(lines(page).first()).toHaveAttribute('aria-label', /; rhythm: 8ths in 3/)
    await expect(lines(page).first()).not.toHaveAttribute('aria-label', /7th chords/)
    await openPanel(page, 'Line options')
    await expect(listbox(page, 'Start')).toHaveCount(0)
    await expect(listbox(page, 'Timing')).toHaveCount(0)
  })
})
