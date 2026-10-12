import type { Locator, Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, type Drawn, drawn, expect, GLYPH, arpeggiosDrawn, guidesDrawn, openEditor, sheetChord, showArpeggios, showGuides, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
/** the sheet itself, not the controls above it (whose menus name the same scales) */
const sheetOf = (page: Page) => lines(page).first().locator('xpath=ancestor::div[@data-slot="paper"][1]')
const lineOff = (page: Page) => page.getByRole('radio', { name: 'Off', exact: true })
const guideLine = (page: Page) => page.getByLabel('Guide tone line')
/** a line's guide tone labels: the row between its staff and its numerals */
const labelRow = (line: Locator) => line.locator('xpath=ancestor::*[@data-slot="system"][1]//*[@data-slot="guides"]')
/** each chord's x on a line, as a fraction of its width (ChangesSystem sets a mark's left 0.012 before its beat) */
const chordXs = (line: Locator): Promise<number[]> =>
  line.evaluate((el) =>
    Array.from(el.closest('.break-inside-avoid')?.firstElementChild?.querySelectorAll(':scope > div') ?? []).map(
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
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toBeVisible()
  await expect(visitor.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await other.close()
})

test('a numeral or scale with a note looks clickable on screen (dotted underline, pointer), and prints plain', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  const numeral = page.getByRole('button', { name: 'ii7', exact: true }).first()
  await expect(numeral).toHaveCSS('text-decoration-style', 'dotted')
  await expect(numeral).toHaveCSS('text-decoration-line', 'underline')
  await expect(numeral).toHaveCSS('cursor', 'pointer')
  await page.emulateMedia({ media: 'print' })
  await expect(numeral).toHaveCSS('text-decoration-line', 'none')
})

test('a function from the numeral’s picker: the sheet shows it, its note opens on a click once done, and a key change comes from the bar’s menu', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n')
  const text = page.getByLabel('Chart text')
  const sheet = sheetOf(page)
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // D7's numeral: while editing, the function picker, with the why under it
  const picker = page.getByRole('dialog', { name: 'Function: D7' })
  const fns = picker.getByRole('radiogroup', { name: 'Function' })
  await expect(fns.getByRole('radio').first()).toHaveAccessibleName(/^Auto: II7\s*→ D Mixolydian$/)
  await expect(picker.getByText('II7 in C, not resolving: natural tensions', { exact: true })).toBeVisible() // the Why (the default Changes sheet's tooltips say it too)
  await fns.getByRole('radio', { name: /^V7\/V \(to G\)\s*→ D Mixolydian$/ }).click()
  await expect(text).toHaveValue(/A \| 2 \| D7\s+\|\s+\| V7\/V/)
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
  await text.fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7 | | Db: V7/ii\nA | 3 | Dm7\nA | 4 | G7\n')
  await expect(sheetChord(page, 'Dm7', 'A', 3)).toBeAttached() // parsed
  await expect(sheet.getByRole('button', { name: 'II7', exact: true })).toContainText('⚠') // marked: the written function doesn't fit
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // the sheet reads the analysis
  await expect(picker.getByText('V7/ii in Db is on Bb, not D7', { exact: true })).toBeVisible() // the picker says what's wrong with the function
  await page.keyboard.press('Escape')
  await sheetChord(page, 'Dm7', 'A', 3).hover()
  await page.getByRole('button', { name: 'More actions for A bar 3' }).click()
  await page.getByRole('menuitem', { name: 'Key change here' }).click()
  await expect(text).toHaveValue(/@key A 3 C\nA \| 3 \| Dm7/)
  await page.getByRole('button', { name: 'Done editing' }).click()
  await sheet.getByRole('button', { name: 'II7', exact: true }).click() // not editing: why opens, saying first what's wrong
  await expect(page.getByRole('dialog', { name: 'Why: D7' })).toContainText('⚠ V7/ii in Db is on Bb, not D7')
})

test('a function picked from the numeral changes the scale the Changes sheet plays on a blank cell', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | CMaj7\n')
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
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 2 \| D7\s+\|\s+\| \S/) // the function written, the scale cell left blank
  await page.keyboard.press('Escape')
  await expect(sheet).toContainText('D Lyd Dom')
  await sheet.getByRole('button', { name: 'D Lyd Dom', exact: true }).click()
  await expect(scales.first()).toContainText('D Lydian Dominant') // the analysed option follows the function
  await expect(scales.first()).toBeChecked()
  await expect(scalePicker.getByRole('button', { name: 'Unpin' })).toHaveCount(0)
})

test('a chart opens on the Changes sheet, and Scales and Arpeggios are the other sheets', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toContainText('Changes')
  await expect(lines(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Work on' }).click()
  await expect(page.getByRole('option')).toHaveText(['Changes', 'Scales', 'Arpeggios'])
  await page.keyboard.press('Escape')
})

test('From 3rd or From 7th puts each chord’s guide tone in place of its slashes, labelled, and stays chosen', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7sus4\nA | 2 | C6\nA | 2 | C\nA | 3 | Em7\nA | 3 | A7\nA | 4 | Dm7\nA | 4 | G7\n')
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
  await expect(guideLine(page)).toContainText('From 7th')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*4\s*6\s*1\s*7\s*3\s*7\s*3\s*$/) // from the Dm7's 7th: a sus chord's 4th, a 6 chord's 6th, a triad's root
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(8) // one line at a time
  await expectChordsOnHeads(line)
  await page.reload()
  await expect(guideLine(page)).toContainText('From 7th') // remembered
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
})

test('choosing Off, From 3rd, From 7th and Off again redraws the line each time', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  const line = lines(page).first()
  await expect(line).not.toHaveAttribute('aria-label', /guide tones/)
  await showGuides(page, 'From 3rd')
  await expect(labelRow(line)).toHaveText(/^\s*3\s*7\s*3\s*$/)
  await expect.poll(async () => (await drawn(line)).heads.length).toBeGreaterThan(0)
  const third = { aria: await line.getAttribute('aria-label'), ys: (await drawn(line)).heads.map((h) => h.y) }
  await showGuides(page, 'From 7th')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*3\s*7\s*$/) // another line, not the same one relabelled
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
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  await showGuides(page, 'From 7th')
  await page.reload()
  await expect(guideLine(page)).toContainText('From 7th')
  await expect(labelRow(lines(page).first())).toHaveText(/^\s*7\s*3\s*7\s*$/)
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/) // made, not "Making the link…"
  const link = await box.inputValue()
  const other = await browser.newContext() // fresh storage: its own preference is Off
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(guideLine(visitor)).toContainText('From 7th')
  await expect(labelRow(lines(visitor).first())).toHaveText(/^\s*7\s*3\s*7\s*$/)
  await other.close()
})

test('7th Chords arpeggiates each chord: quarters for one a bar, eighths for two, sixteenths for more, beamed', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 2 | G7\nA | 3 | Dm7\nA | 3 | G7\nA | 3 | C\nA | 4 | CMaj7\n')
  const line = lines(page).first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4 \| D4 F4 A4 C5, G4 B4 D5 F5 \| /)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(4 + 8 + 16 + 4)
  expect((await drawn(line)).slashes).toBe(0)
  expect(await line.locator('.vf-beam').count()).toBeGreaterThan(0)
  await expect(labelRow(line)).toHaveCount(0) // no labels under arpeggio notes
  await showArpeggios(page, 'Down · root')
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: B4 G4 E4 C4 \|/)
  await page.reload()
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked() // remembered
  await expect(page.getByLabel('Arpeggio pattern')).toContainText('Down · root')
})

test('7th Chords in 3/4: six eighths for a bar of one chord', async ({ page }) => {
  await writeChart(page, 'title: W\nkey: C\ntime: 3/4\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | CMaj7\n') // a full line: a last chord holds through the empty bars after it
  const line = lines(page).first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4 C4 E4 \| D4 F4 A4 C5 D4 F4 \| /) // the pattern restarts to fill the bar
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(4 * 6)
})

test('a share link carries the arpeggio pattern', async ({ page, browser }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\n')
  await showArpeggios(page, 'Voice-led')
  await arpeggiosDrawn(page)
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/) // made, not "Making the link…"
  const link = await box.inputValue()
  const other = await browser.newContext() // fresh storage: its own preference is Off
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await expect(visitor.getByLabel('Arpeggio pattern')).toContainText('Voice-led')
  await arpeggiosDrawn(visitor)
  await other.close()
})

test('one voice’s stems: up below the middle line, down above it', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | CMaj7\nA | 2 | A7\nA | 3 | Dm7\nA | 3 | G7\nA | 4 | CMaj7\nA | 4 | Am7\n') // two chords a bar: half notes, which have stems
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
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 5 | CMaj7\n')
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
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 6 | CMaj7\n') // G7: bars 3-5, across the break after bar 4
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
    await writeChart(page, 'title: T\nkey: C\nA | 1 | Em7\nA | 1 | A7\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | Ebm7\nA | 2 | Ab7\nA | 2 | Dbm7\nA | 2 | Gb7\nA | 3 | CMaj7\nA | 4 | C#m7b5\nA | 4 | F#7\n')
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
    await writeChart(page, 'title: T\nkey: C\nA | 1 | Abm7\nA | 2 | D7\nA | 3 | Ebm7\nA | 4 | Gbm7\nA | 5 | Abm7\nA | 6 | BbMaj7\nA | 7 | Eb7\nA | 8 | Bm7\n') // from the 3rd: Cb4 C4 Db4 Fb4 Cb4 A3 G3 (at the Eb7) A3
    await chooseInstrument(page, 'Vibes')
    await showGuides(page, 'From 3rd')
    await guidesDrawn(page)
    const all = await Promise.all((await lines(page).all()).map(drawn))
    expect(Math.max(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeGreaterThanOrEqual(145) // G3: two ledger lines below the staff (80–120, 5 a step)
    for (const d of all) expectNoCollisions(d)
    for (const line of await lines(page).all()) await expectChordsOnHeads(line)
  })
}

test('an unknown chord gets one rest, and a note above the sheet', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | G7\nA | 4 | CMaj7\n')
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

const CROWDED = 'key: Bb\nA | 1 | Bbmaj7#11\nA | 1 | Eb7alt\nA | 1 | Abm7b5\nA | 1 | Db7sus4\nA | 2 | Dm7\nA | 2 | G7\nA | 3 | Cmaj7\nA | 4 | C7\n'
test('chords on consecutive beats keep their names apart: the crowded bar widens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, CROWDED)
  await expectNamesApart(page)
  await expect(page.locator('[data-slot="system"]').first().locator('[data-name]')).toHaveCount(8) // one line
})

test('on a phone, a line whose names would shrink too far breaks: the crowded bar on a line of its own', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await writeChart(page, 'key: C\nA | 1 | Cmaj7\nA | 1 | A7b9\nA | 1 | Dm7\nA | 1 | G7sus4\nA | 2 | Em7b5\nA | 2 | A7\nA | 3 | Dm7\nA | 4 | G7\n')
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
