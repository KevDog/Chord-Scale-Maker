import { arpeggiosDrawn, chooseInstrument, chooseSheet, chooseSuperimpose, closePanel, expect, openPanel, openPentatonicOptions, pentatonicLineDrawn, pickOption, rankedAgainstChord, showArpeggios, showPentatonicLine, showPentatonics, test, writeChart } from './fixtures'
import type { Page } from '@playwright/test'

const labels = (page: Page) => page.locator('[data-slot="pentatonic"] button')

test('the Pentatonics row names each key area’s pentatonic, and the ladder changes the rung', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(labels(page).first()).toHaveText('Gm♪') // G minor, Home
  await labels(page).first().click()
  const ladder = page.getByRole('dialog', { name: 'Cm7 Dorian · A1 bar 1, A1 bar 2, A1 bar 3, A1 bar 4' }) // headed by the chord; the ladder's title (A1 · G minor pentatonic ladder) under it
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side, for A1 only
  await expect(labels(page).first()).toHaveText('Fm♪ 4')
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('One rung')
})

test('the row survives a reload, written for a B♭ part', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await page.reload()
  await expect(labels(page).first()).toHaveText('Gm♪')
  await chooseInstrument(page, 'Tenor Sax')
  await expect(labels(page).first()).toHaveText('Am♪') // concert G minor, written A minor
})

const sectionLabels = (page: Page, section: string) => page.locator(`[data-slot="pentatonic"] [data-section="${section}"] button`)

async function choosePath(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name }).click()
}

test('Side-slip alternates by section: A2 and A3 a half step out, A1 and the bridge home (#276)', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Side-slip')
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toHaveCount(0)
  for (const s of ['A1', 'B']) await expect(sectionLabels(page, s).first()).toHaveText(/♪ 5$/)
  for (const s of ['A2', 'A3']) await expect(sectionLabels(page, s).first()).toHaveText(/♪ 1$/)
  await sectionLabels(page, 'A2').first().click()
  const ladder = page.getByRole('dialog', { name: / bar \d+$/ })
  const flat = await ladder.locator('li').filter({ hasText: /^5 ·/ }).locator('[data-pent]').first().textContent()
  await expect(ladder.locator('[data-sheet-choice]')).toHaveText(`Sheet’s choice (${flat})`) // the ♭ side, not the ♯
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(sectionLabels(page, 'A2').first()).toHaveText(/♪ 1$/) // kept for this chart
})

test('a path that varies tints the labels, with the shared count and no contour band (#277)', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.locator('[data-slot="pentatonic"] [class*="text-rung-"]')).toHaveCount(0) // One rung: no tint
  await choosePath(page, 'Side-slip')
  const a2 = page.locator('[data-slot="pentatonic"] [data-section="A2"]').first()
  await expect(a2).toHaveClass(/text-rung-5/)
  await expect(a2).toHaveText(/♪ 1$/)
  await expect(a2.getByRole('button')).toHaveAccessibleName(/, 1 of 5 notes in /)
  await expect(page.locator('[data-slot="pentatonic"] [data-section="A1"]').first()).toHaveClass(/text-rung-0/)
  await expect(page.locator('[data-slot="contour"]')).toHaveCount(0)
})

test('a pick changes its label’s run only, and the sheet’s choice restores it', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const texts = async () => page.locator('[data-slot="pentatonic"] [data-chord]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-chord')}: ${e.textContent}`))
  const before = await texts()
  const target = sectionLabels(page, 'B').first()
  await target.click()
  await page.getByRole('dialog', { name: / bar \d+$/ }).locator('[data-pent]').first().click() // Home
  await expect(target).toHaveText(/♪ 5$/)
  const after = await texts()
  expect(after.filter((t, i) => t !== before[i])).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Fifths')
  await target.click()
  await page.locator('[data-sheet-choice]').click()
  await expect.poll(texts).toEqual(before)
})

test('Ranked against Chord follows each chord: Waltz for Debby’s first bars', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toHaveCount(0)
  const firstLine = page.locator('[data-slot="system"]').first().locator('[data-slot="pentatonic"] button')
  await expect.poll(async () => (await firstLine.allTextContents()).slice(0, 3)).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5']) // bars 1–3; bar 4's C7 repeats Gm
  await pickOption(page, 'Pentatonic built on', '♭3')
  await expect(firstLine.first()).toHaveText('G♯m♪ 0') // on ♭3 of FMaj7 (F Ionian), spelled without C♭ and F♭: nothing shared
  await page.reload()
  await openPentatonicOptions(page)
  await expect(page.getByRole('button', { name: 'Pentatonic built on' })).toHaveText('Built on: ♭3')
})

test('a pick is per chart, kept over a reload, and survives a change of Built on (#303)', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  const second = page.locator('[data-slot="pentatonic"] [data-chord]').nth(1)
  await second.locator('button').click()
  await page.getByRole('dialog', { name: / bar \d+$/ }).locator('[data-choice]').nth(2).click() // the third in the ranking
  const picked = await second.textContent()
  await page.reload()
  await expect(second).toHaveText(picked!)
  await expect(second.locator('button')).toHaveAttribute('aria-label', /your pick/)
  await openPentatonicOptions(page)
  await pickOption(page, 'Pentatonic built on', '2')
  await expect(second.locator('button')).toHaveAttribute('aria-label', /your pick/)
  await expect(second).toHaveText(picked!)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the toggle is in the Controls dialog', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    await showPentatonics(page)
    await expect(labels(page).first()).toBeVisible()
    const dialog = page.getByRole('dialog', { name: 'Controls' })
    await expect(async () => {
      if ((await dialog.count()) === 0) await page.getByRole('button', { name: 'Controls', exact: true }).click({ timeout: 1000 })
      await expect(dialog.getByRole('radio', { name: 'Chord', exact: true })).toBeAttached({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
})

test('the Pentatonic practice preset builds on a degree, remembers it, and prints', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  const panel = page.locator('fieldset', { hasText: 'Practice' })
  await panel.getByRole('button', { name: 'Pentatonic', exact: true }).click()
  const captions = page.locator('[data-slot="pentatonic"]')
  await expect(captions).toHaveCount(14) // one per line
  await expect(captions.first()).toHaveText(/ pent · 5 shared$/)
  await expect(page.getByRole('button', { name: 'Pentatonic built on' })).toHaveText('Built on: Auto')
  const auto = await page.locator('.vf-selected').count()
  await pickOption(page, 'Pentatonic built on', '♭3')
  await expect(captions.first()).toHaveText(/ pent · [0-4] shared$/)
  // all five still lit on each staff (#308): fewer from the scale, the rest added from outside it in the second accent
  await expect.poll(() => page.locator('.vf-selected.vf-second').count()).toBeGreaterThan(0)
  expect(await page.locator('.vf-selected').count()).toBe(auto)
  await expect(page.locator('svg[aria-label*="; added from the pentatonic: "]').first()).toBeAttached()
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.getByRole('button', { name: 'Pentatonic built on' })).toHaveText('Built on: ♭3')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'Letter' })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2) // 14 lines, 12 a page, as without the caption
})

test('in print the longest pentatonic captions stay on one line', async ({ page }) => {
  await page.goto('/song/all-the-things-you-are')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Pentatonic', exact: true }).click()
  await page.emulateMedia({ media: 'print' })
  const long = page.locator('[data-slot="pentatonic"]', { hasText: 'shared' })
  expect(await long.count()).toBeGreaterThan(0)
  const wrapped = await long.evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(el).fontSize)).length)
  expect(wrapped).toBe(0)
})

/** check a SegmentedControl's radio (sr-only: click its label; retried, a click before hydration is lost) */
async function checkRadio(page: Page, group: string, name: string): Promise<void> {
  const set = page.getByRole('group', { name: group })
  const radio = set.getByRole('radio', { name, exact: true })
  await expect(async () => {
    if (!(await radio.isChecked())) await set.locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) }).click({ timeout: 1000 })
    await expect(radio).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

test('a preset moves every section after the first: Waltz for Debby’s A B C', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.getByRole('group', { name: 'Pentatonic step' })).toHaveCount(0) // One rung: no step
  await choosePath(page, 'Minor thirds')
  await expect(sectionLabels(page, 'A').first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 3$/)
  await expect(sectionLabels(page, 'C').first()).toHaveText(/♪ 0$/)
  await expect(page.getByText('Pentatonics: Minor thirds · by section').first()).toBeVisible()
})

test('every 4 bars moves page 1’s second line, prints the path, and is kept over a reload', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Minor thirds')
  await checkRadio(page, 'Pentatonic step', 'Bars')
  await checkRadio(page, 'Bars a step', '4')
  const at = (chord: string) => page.locator(`[data-slot="pentatonic"] [data-chord="${chord}"]`) // by chord, not by line: a line the app breaks early would shift a line count
  await expect(at('A1:1:0')).toHaveText(/♪ 5$/)
  await expect(at('A1:5:0')).toHaveText(/♪ 3$/) // bars 5–8: the second unit, 3♭
  await page.reload()
  await expect(at('A1:5:0')).toHaveText(/♪ 3$/)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByText('Pentatonics: Minor thirds · every 4 bars').first()).toBeVisible()
})

test('a pick survives a change of step (#303)', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const target = sectionLabels(page, 'B').first()
  const before = await target.textContent()
  await target.click()
  await page.getByRole('dialog', { name: / bar \d+$/ }).locator('li').last().locator('[data-pent]').click() // rung 6
  await expect(target).not.toHaveText(before ?? '')
  const picked = await target.textContent()
  await checkRadio(page, 'Pentatonic step', 'Key area')
  await checkRadio(page, 'Pentatonic step', 'Section')
  await expect(target).toHaveText(picked ?? '')
  await expect(target).toHaveAttribute('aria-label', /your pick/)
})

test('a pick stays on its chord when a bar goes in before it (#275)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | A7')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  const at = (chord: string) => page.locator(`[data-slot="pentatonic"] [data-chord="${chord}"] button`)
  await at('A:4:0').click()
  await page.getByRole('dialog', { name: / bar \d+$/ }).locator('[data-choice]').nth(2).click() // the third in the ranking
  await expect(at('A:4:0')).toHaveAttribute('aria-label', /your pick/)
  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).hover()
  await page.getByRole('button', { name: 'Insert a held bar after A bar 1' }).click()
  await expect(page.getByRole('button', { name: 'Edit A7, A bar 5' })).toBeVisible()
  await expect(at('A:5:0')).toHaveAttribute('aria-label', /your pick/)
  await expect(page.locator('[data-slot="pentatonic"] button[aria-label*="your pick"]')).toHaveCount(1)
})

test('the Line plays each chord’s labeled pentatonic in cells under the Pentatonic overlay, and 7th Chords again without it (#284)', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n1 | G7\n2 | CMaj7\n')
  const line = page.locator('svg[aria-label^="Bars:"]').first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await showPentatonicLine(page)
  await expect(page.getByRole('radio', { name: 'Pentatonic', exact: true })).toBeChecked() // the stored arpeggio line, read as Pentatonic
  await pentatonicLineDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; pentatonic: C5 D5 E5 G5, E5 G5 C6 D6 \| C6 G5 E5 D5/) // Am less A, from piano's centre (B♭4), each cell from its note nearest the last, turned at piano's top (E6)
  await pickOption(page, 'Leave out', '♭7')
  await expect(line).toHaveAttribute('aria-label', /; pentatonic: A4 C5 D5 E5, /)
  await pickOption(page, 'Pentatonic direction', 'Down')
  await expect(line).toHaveAttribute('aria-label', /; pentatonic: E5 D5 C5 A4, /)
  await page.reload()
  await openPanel(page, 'Line options')
  await expect(page.getByLabel('Leave out')).toContainText('Leave out: ♭7') // remembered
  await closePanel(page, 'Line options')
  await pentatonicLineDrawn(page)
  await chooseSuperimpose(page, 'Off')
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await expect(page.getByLabel('Leave out')).toHaveCount(0)
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: D4 F4 A4 C5/)
})
