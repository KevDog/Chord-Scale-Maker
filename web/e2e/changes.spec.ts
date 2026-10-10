import type { Locator, Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, drawn, expect, GLYPH, guidesDrawn, openEditor, showGuides, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
/** the sheet itself, not the chart grid above it (whose menus name the same scales) */
const sheetOf = (page: Page) => lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
const guide = (page: Page, name: 'From 3rd' | 'From 7th') => page.getByRole('button', { name, exact: true })
/** a line's guide tone labels: the row between its staff and its numerals */
const labelRow = (line: Locator) => line.locator('xpath=../following-sibling::div[1]')
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
// a 1px tolerance: an accidental sits flush against its own notehead, and its glyph box differs by a fraction of a
// pixel between platforms' fonts (0.51px on CI's Linux)
const overlaps = (a: Box, b: Box): boolean => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1

test('the Changes sheet: slashes, chords, numerals and scales, a repeat, and toggles that stick', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
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
  await page.goto('/song?chart=a_night_in_tunisia')
  await chooseSheet(page, 'Changes')
  await expect(page.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await expect(page.getByText('Tag', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share' }).click()
  const link = await page.getByRole('dialog').getByLabel('Link').inputValue()
  const other = await browser.newContext()
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toBeVisible()
  await expect(visitor.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await other.close()
})

test('a function from the dropdown: the Changes sheet shows it, its note opens from the keyboard, and keys change from the grid', async ({ page }) => {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n')
  const fn = page.getByLabel('function for row 2')
  await expect(fn.locator('option').first()).toHaveText('II7 → D Mixolydian')
  await page.getByRole('button', { name: 'Show notes' }).click()
  await expect(page.getByRole('cell', { name: 'II7 in C, not resolving: natural tensions', exact: true })).toBeVisible() // the grid's note (the default Changes sheet's tooltips say it too)
  await fn.selectOption({ label: 'V7/V (to G) → D Mixolydian' })
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 2 \| D7\s+\|\s+\| V7\/V/)
  await chooseSheet(page, 'Changes')
  const sheet = sheetOf(page)
  const numeral = sheet.getByRole('button', { name: 'V7/V' })
  await numeral.focus()
  await expect(page.getByRole('tooltip').filter({ hasText: '* V7/V in C: natural tensions' })).toBeVisible()
  await expect(page.getByRole('tooltip').filter({ hasText: 'in C major' }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip').filter({ hasText: 'V7/V in C' })).toBeHidden()
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7 | | Db: V7/ii\nA | 3 | Dm7\nA | 4 | G7\n')
  await expect(fn).toHaveAttribute('aria-invalid', 'true') // V7/ii in Db is Bb7, not D7
  await page.getByLabel('Key change at row 3').click()
  await expect(page.getByLabel('Chart text')).toHaveValue(/@key A 3 C\nA \| 3 \| Dm7/)
})

test('a chart opens on the Changes sheet, and Scales is the only other sheet', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toContainText('Changes')
  await expect(lines(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Work on' }).click()
  await expect(page.getByRole('option')).toHaveText(['Changes', 'Scales'])
  await page.keyboard.press('Escape')
})

test('From 3rd and From 7th put each chord’s guide tone in place of its slashes, labelled, and stay on', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7sus4\nA | 2 | C6\nA | 2 | C\nA | 3 | Em7\nA | 3 | A7\nA | 4 | Dm7\nA | 4 | G7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7$/) // no guide tones yet
  await expect(guide(page, 'From 3rd')).toHaveAttribute('aria-pressed', 'false') // off until turned on
  await expect(guide(page, 'From 7th')).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await drawn(line)).slashes).toBe(16) // four bars of slashes
  await showGuides(page, 'From 3rd')
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7; guide tones: /)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(8) // a half note a chord
  expect((await drawn(line)).slashes).toBe(0)
  await expect(labelRow(line)).toHaveText(/^\s*3\s*7\s*3\s*3\s*7\s*3\s*7\s*7\s*$/) // from the Dm7's 3rd: the nearest guide tone of G7sus4 is its 7th (the F, a common tone); at the last G7 the lines trade rather than leap C4 to B4
  await guide(page, 'From 3rd').click()
  await showGuides(page, 'From 7th')
  await expect(guide(page, 'From 3rd')).toHaveAttribute('aria-pressed', 'false')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*4\s*6\s*1\s*3\s*7\s*3\s*3\s*$/) // from the Dm7's 7th: a sus chord's 4th, a 6 chord's 6th, a triad's root
  await showGuides(page, 'From 3rd')
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(16)
  const both = await drawn(line)
  expect(both.stems.filter((s) => s.to < s.from)).toHaveLength(8) // the upper voice: stems up
  expect(both.stems.filter((s) => s.to > s.from)).toHaveLength(8) // the lower voice: stems down
  await expect(labelRow(line)).toHaveText(/^(\s*\d){16}\s*$/) // two labels a chord
  await expectChordsOnHeads(line)
  await page.reload()
  await expect(guide(page, 'From 3rd')).toHaveAttribute('aria-pressed', 'true') // remembered
  await expect(guide(page, 'From 7th')).toHaveAttribute('aria-pressed', 'true')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
})

test('both guide tones: the ii–V–I’s labels swap, and each voice’s ties curve away from the other’s', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 5 | CMaj7\n')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Dm7 \| – \| G7 \| –/)
  await showGuides(page, 'From 3rd', 'From 7th')
  await guidesDrawn(page)
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /; guide tones: C5 7 \/ F4 3/) // Dm7: C over F
  await expect(labelRow(line)).toHaveText(/^\s*7\s*3\s*3\s*7\s*$/) // Dm7 7 over 3, then G7 3 over 7
  await expect(labelRow(lines(page).nth(1))).toHaveText(/^\s*7\s*3\s*$/) // CMaj7: 7 over 3 again
  for (const svg of await lines(page).all()) {
    const { ties } = await drawn(svg)
    const up = ties.filter((t) => t.control < t.y)
    const down = ties.filter((t) => t.control > t.y)
    expect(up.length).toBeGreaterThan(0)
    expect(down).toHaveLength(up.length) // every held chord ties in both voices
    for (const u of up) expect(down.some((d) => Math.abs(d.x - u.x) < 3 && d.y > u.y), `the upper tie at x ${u.x} has a lower one under it`).toBe(true)
  }
})

test('a chord held over a line break: an open tie ends line 1, a half-tie starts line 2', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 6 | CMaj7\n') // G7: bars 3-5, across the break after bar 4
  await showGuides(page, 'From 3rd', 'From 7th')
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
  await expect.poll(openTies).toBe(2) // one open tie per voice, from bar 4's notes
  await expect.poll(halfTies).toBe(2) // one half-tie in per voice, before bar 5's notes (polled: line 2 may draw after line 1)
})

test('guide tones are written for the part: a B♭ trumpet, and a bass clef within E2–C4', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await showGuides(page, 'From 3rd', 'From 7th')
  await chooseInstrument(page, 'Trumpet')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: (C\d 7 \/ F\d 3|F\d 3 \/ C\d 7)/) // concert C–7 is written D–7: 7th C, 3rd F
  await guidesDrawn(page)
  const trumpet = await lines(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await chooseInstrument(page, 'Trombone')
  await expect.poll(() => lines(page).evaluateAll((els, before) => els.every((e, i) => e.getAttribute('aria-label') !== before[i]), trumpet)).toBe(true)
  await expect.poll(async () => (await drawn(lines(page).first())).clefs).toEqual([GLYPH.fClef]) // line 1's clef
  await expect(page.locator('.vf-clef')).toHaveCount(1)
  const ys = (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.heads.map((h) => h.y))
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(70) // C4, a ledger line above the bass staff
  expect(Math.max(...ys)).toBeLessThanOrEqual(130) // E2, a ledger line below it
})

test('a waltz’s guide tones are in 3/4: a bar-long chord is a dotted half', async ({ page }) => {
  await page.goto('/song?chart=someday_my_prince_will_come')
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
  await page.goto('/song?chart=f_jazz_blues')
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await showGuides(page, 'From 3rd', 'From 7th')
  await guidesDrawn(page)
  const black = page.locator(['stroke="black"', 'fill="black"', 'stroke="#000000"', 'fill="#000000"'].map((a) => `svg[aria-label^="Bars:"] [${a}]`).join(', '))
  await expect(black).toHaveCount(0)
})

for (const [width, bars] of [
  [1400, 4],
  [390, 2],
] as const) {
  test(`four chords a bar, both guide tones, ${bars} bars a line: no notehead or accidental collides, and each chord sits on its note`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await writeChart(page, 'title: T\nkey: C\nA | 1 | Em7\nA | 1 | A7\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | Ebm7\nA | 2 | Ab7\nA | 2 | Dbm7\nA | 2 | Gb7\nA | 3 | CMaj7\nA | 4 | C#m7b5\nA | 4 | F#7\n')
    await showGuides(page, 'From 3rd', 'From 7th')
    const line = lines(page).first()
    await expect(line).toHaveAttribute('aria-label', /^Bars: Em7 A7 Dm7 G7 \| Ebm7 Ab7 Dbm7 Gb7.*; guide tones: /)
    const d = await drawn(line)
    expect(d.width).toBe(300 * bars)
    expect(d.heads.length).toBeGreaterThanOrEqual(16)
    expect(d.accidentals.length).toBeGreaterThan(0)
    const boxes = [...d.heads.map((h) => box(h, 4.5)), ...d.accidentals.map((a) => box(a, 10))]
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b), `${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(false)))
    await expectChordsOnHeads(line)
  })
}

test('an unknown chord gets one rest for both voices, and a note above the sheet', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | G7\nA | 4 | CMaj7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 \| Cm7#5#9x \| G7 \| CMaj7/)
  const note = page.getByRole('listitem').filter({ hasText: 'no guide tones for Cm7#5#9x (unknown chord quality)' })
  await expect(note).toHaveCount(0) // only with a guide on
  await showGuides(page, 'From 3rd', 'From 7th')
  await expect(line).toHaveAttribute('aria-label', /; guide tones: /)
  const d = await drawn(line)
  expect(d.rests).toBe(1) // never two stacked
  expect(d.heads).toHaveLength(6)
  await expect(note).toBeVisible()
})

test('on a line with an ending, the bracket clears the guide tones’ stems (B♭ part, both on)', async ({ page }) => {
  await page.goto('/song?chart=stardust')
  await chooseInstrument(page, 'Trumpet')
  await showGuides(page, 'From 3rd', 'From 7th')
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
