import type { Page } from '@playwright/test'
import { arpeggiosDrawn, closePentatonicOptions, pentatonicLineDrawn, showPentatonicLine, chooseGroups, chooseInstrument, chooseRhythm, chooseRhythmStep, chooseStart, chooseTiming, chooseSuperimpose, chooseSheet, drawn, expect, guidesDrawn, hexatonicPreset, pentatonicPreset, pickOption, rankedAgainstChord, rhythmDrawn, showArpeggios, showTargets, showGuides, showPentatonics, staves, test, writeChart } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 14 lines at 12 staves per letter page, even when every staff has ledger lines (trombone from B)
for (const [instrument, start] of [
  ['Piano', null],
  ['Piano', 'C'],
  ['Trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start ?? 'the root'})`, async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Scales') // a chart opens on the Changes
    await chooseInstrument(page, instrument)
    await pickOption(page, 'Where each scale starts', start ? `From ${start}` : 'From root')
    await expect(staves(page)).toHaveCount(14)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden() // editor hidden in print
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(2)
  })
}

// a line that covers several chords (wish-for-now's F Bebop Dorian: four) has the tallest label, yet still prints 12 staves a page
test('prints 12 staves per letter page when a line names several chords (wish-for-now)', async ({ page }) => {
  await page.goto('/song/wish-for-now')
  await chooseSheet(page, 'Scales')
  await expect(page.locator('.text-right').filter({ hasText: /(·[^·]*){3}/ }).first()).toBeVisible() // a line of four chords
  const lines = await staves(page).count()
  expect(lines).toBeGreaterThan(12)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(Math.ceil(lines / 12))
})

// the other set's small line (#215) fits each page's budget: Rhythm Changes' eight lines, numerals and scales on, with it shown
// Target beats (rhythm spec §7) take no line of their own: the dots sit in the drawing's headroom, so the budgets hold
for (const [what, guides, pentatonics, pages, targets] of [
  ['slashes', false, false, 1, false], // 8 a page
  ['guide tones', true, false, 2, false], // 6
  ['slashes and pentatonics', false, true, 2, false], // 7
  ['guide tones and pentatonics', true, true, 2, false], // 5
  ['slashes and target beats', false, false, 1, true],
  ['slashes, pentatonics and target beats', false, true, 2, true],
  ['guide tones and target beats', true, false, 2, true],
  ['guide tones, pentatonics and target beats', true, true, 2, true],
] as const) {
  test(`prints the Changes with the other changes' line in its pages (${what})`, async ({ page }) => {
    await page.goto('/song/rhythm-changes')
    await expect(page.locator('[data-slot="other-changes"]').first()).toBeVisible()
    if (targets) await showTargets(page)
    if (pentatonics) {
      await showPentatonics(page)
      await closePentatonicOptions(page) // its popover (#293) opens over the Line control
    }
    if (guides) {
      await showGuides(page, 'From 3rd')
      await guidesDrawn(page)
    }
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('[data-slot="other-changes"]').first()).toBeVisible()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

// eight lines a page with guide tones off: a 32-bar AABA written out (Satin Doll) on one; Tunisia's nine lines (with the tag) on two
for (const [chart, pages] of [
  ['autumn-leaves', 1],
  ['satin-doll', 1],
  ['a-night-in-tunisia', 2],
  ['stardust', 2],
  ['its-you-or-no-one', 2],
] as const) {
  test(`prints the Changes eight lines a page (${chart})`, async ({ page }) => {
    await page.goto(`/song/${chart}`)
    await chooseSheet(page, 'Changes')
    await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

test('the Changes sheet shows 1st/2nd endings and a D.S. al Coda', async ({ page }) => {
  await page.goto('/song/its-you-or-no-one')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.getByText('D.S. al Coda')).toBeVisible()
  await expect(page.getByLabel('Coda').first()).toBeVisible()
  await page.goto('/song/stardust')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.locator('svg[aria-label^="Bars:"] text', { hasText: '1.' }).first()).toBeVisible()
})

// the tallest Changes lines: one guide tone line with numerals and scales, a 1st/2nd ending
// raised above the stems, and a bass part in the lowest guide tone range (the tuba's, C2–B♭3). On Stardust From 7th
// reaches F♯2, below the staff; From 3rd, placed nearer the centre, bottoms out at C3, inside it. Each sheet page
// holds changesLinesPerPage lines, so the PDF has as many pages as the sheet: a page that overflowed would add one
// (and with Target beats, rhythm spec §7: their dots take no room of their own)
for (const line of ['From 3rd', 'From 7th'] as const) {
for (const targets of [false, true]) {
test(`prints the Changes with a guide tone line (${line}${targets ? ', target beats' : ''}), a sheet page to a letter page, in the tallest case`, async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, line)
  if (targets) await showTargets(page)
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Scales', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const all = await Promise.all((await svgs.all()).map(drawn))
  expect(all.filter((d) => d.voltaBottom !== null).length).toBeGreaterThan(0) // the verse's 1st and 2nd endings
  expect(Math.max(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeGreaterThanOrEqual(line === 'From 7th' ? 120 : 105) // From 7th: on or below the bass staff's bottom line (G2, F♯2 here); From 3rd: down to C3
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
}
}

// an arpeggio line: sixteenths and beams on the tuba's bass staff, the same tune; again a sheet page to a letter page
for (const targets of [false, true]) {
test(`prints the Changes with a 7th chord line${targets ? ' and target beats' : ''}, a sheet page to a letter page`, async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showArpeggios(page, 'Up · root')
  if (targets) await showTargets(page)
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Scales', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await arpeggiosDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
}

// the Pentatonic line (#284): the arpeggio line's notes under the Pentatonics row, the tuba's tallest case; lines a page unchanged
test('prints the Changes with the Pentatonic line, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showPentatonicLine(page)
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  await pentatonicLineDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

test('prints the Changes with the Triad pair line, a sheet page to a letter page (#325)', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showArpeggios(page, 'Up · root')
  await chooseSuperimpose(page, 'Hexatonic')
  await expect(page.locator('[data-slot="hexatonic"] span').first()).toBeVisible()
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  await expect.poll(() => svgs.evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; triad pair: ')))).toBe(true)
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

// the Pentatonics row adds a row under Numerals and Scales: with a guide tone line on the tuba it's the tallest case
test('prints the Changes with a guide tone line and the Pentatonics row, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, 'From 7th')
  await showPentatonics(page)
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

test('prints the Changes with a guide tone line and the Pentatonics row ranked against Chord, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, 'From 7th')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  const pages = pdfPages(await page.pdf({ format: 'Letter' }))
  expect(pages).toBe(sheetPages)
})

test('prints the Changes seven lines a page with Numerals, Scales and Pentatonics and no line', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  await expect(svgs.first()).toBeVisible()
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ media: 'print' })
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

async function sideSlip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name: 'Side-slip' }).click()
  await expect(page.locator('[data-slot="pentatonic"] [class*="text-rung-"]').first()).toBeAttached()
}

// Numerals, Scales and counted Pentatonics, with a guide tone line on the tuba: the tallest case
test('prints the Changes with a guide tone line and a pentatonic path, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, 'From 7th')
  await showPentatonics(page)
  await sideSlip(page)
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

test('prints the Changes with a pentatonic path and no line, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await sideSlip(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  await expect(svgs.first()).toBeVisible()
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ media: 'print' })
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

// the rhythm line (rhythm spec §8) counts as a voiced line: its stems, accents, ties and bracket, with Numerals, Scales
// and Target beats on, and Stardust's endings raised over the stems; and a 5/4 chart, its bars the widest
const BARS_5_4 = Array.from({ length: 48 }, (_, i) => `${i + 1} | ${['Dm7', 'G7', 'CMaj7', 'A7'][i % 4]}`).join('\n')
for (const [what, open] of [
  ['Stardust', (page: Page) => page.goto('/song/stardust')],
  ['a 5/4 chart', (page: Page) => writeChart(page, `title: F\nkey: C\ntime: 5/4\n\nsection: A\n${BARS_5_4}\n`)],
] as const) {
  test(`prints the Changes with a rhythm line, a sheet page to a letter page (${what})`, async ({ page }) => {
    await open(page)
    await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'syncopated' })
    await showTargets(page)
    await rhythmDrawn(page)
    const svgs = page.locator('svg[aria-label^="Bars:"]')
    const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}

// mixed phrasing's step marks (Phase 4 spec §8; flag `rhythmGears`): the numerals sit in the target dots' band, so a
// rhythm line with Groups Up by section keeps its count; trombone from B, the tallest staves
test('prints the Changes with Groups Up by section, a sheet page to a letter page (autumn-leaves, Trombone, from B)', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseInstrument(page, 'Trombone')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From B')
  await chooseSheet(page, 'Changes')
  await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
  await chooseGroups(page, 'Up')
  await chooseRhythmStep(page, 'By section')
  await rhythmDrawn(page)
  await expect(page.locator('[data-rhythm-step]').first()).toBeAttached()
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await expect(svgs).toHaveCount(6) // a full page: a rhythm line with Numerals and Scales prints six lines a page
  expect(sheetPages).toBe(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

// gears' marks (Phase 4 spec §8; flag `rhythmGears`): the numeral and the gear's name sit in the target dots' band,
// so a rhythm line with Groups Up and Gears 8 16 by section keeps its count; trombone from B, the tallest staves.
// (A tuplet pulse's rhythm line here overflows its six lines a page with or without a path: see the Task 3.1 report.)
test('prints the Changes with Groups Up and Gears 8 16 by section, a sheet page to a letter page (autumn-leaves, Trombone, from B)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('csm-rhythm-path:autumn-leaves', JSON.stringify({ groups: [3, 4, 5, 6, 7], gears: ['8', '16'], step: { unit: 'section', bars: 4 } })))
  await page.goto('/song/autumn-leaves')
  await chooseInstrument(page, 'Trombone')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From B')
  await chooseSheet(page, 'Changes')
  await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
  await rhythmDrawn(page)
  await expect(page.locator('[data-rhythm-step]').first()).toHaveText('③8ths')
  await expect(page.locator('[data-rhythm-step]').nth(1)).toHaveText('④16ths')
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await expect(svgs).toHaveCount(6) // a full page: a rhythm line with Numerals and Scales prints six lines a page
  expect(sheetPages).toBe(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

// a poured line (rhythm-on-lines spec §9) is a voiced line: the arpeggio line's ink plus the rhythm line's, within budget
for (const [what, open, pour] of [
  ['Stardust, 3-note pick-up and target beats', async (page: Page) => {
    await page.goto('/song/stardust')
    await chooseInstrument(page, 'Tuba')
  }, async (page: Page) => {
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
    await chooseStart(page, '3-note pick-up')
    await showTargets(page)
  }],
  ['a 5/4 chart, triplets anticipating', (page: Page) => writeChart(page, `title: F\nkey: C\ntime: 5/4\n\nsection: A\n${BARS_5_4}\n`), async (page: Page) => {
    await chooseRhythm(page, 'Triplets', { In: 'In 4', Variation: 'with accents' })
    await chooseTiming(page, 'Anticipate 1½ beats')
  }],
] as const) {
  test(`prints the Changes with a poured line, a sheet page to a letter page (${what})`, async ({ page }) => {
    await open(page)
    await showArpeggios(page, 'Up · root')
    await pour(page)
    const numerals = page.getByRole('button', { name: 'Numerals' }) // a written chart has none to press
    if (await numerals.count()) await expect(numerals).toHaveAttribute('aria-pressed', 'true')
    await rhythmDrawn(page)
    const svgs = page.locator('svg[aria-label^="Bars:"]')
    const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}

// the Scales sheet's rhythm card (rhythm-scales-arpeggios spec §8): a four-bar card with "…" under every staff, a sheet
// page to a letter page: F Blues (§8's check, 3 staves) and Autumn Leaves (14: a full page at the reduced count a sheet
// with cards prints, §8's fallback), also with trombone from B, the tallest staves
for (const [song, instrument, start, pages] of [['f-blues', 'Piano', null, 1], ['autumn-leaves', 'Piano', null, 2], ['autumn-leaves', 'Trombone', 'B', 2]] as const) {
  test(`prints the Scales with a rhythm card, a sheet page to a letter page (${song}, ${instrument}${start ? `, from ${start}` : ''})`, async ({ page }) => {
    await page.goto(`/song/${song}`)
    await chooseSheet(page, 'Scales')
    await chooseInstrument(page, instrument)
    if (start) await pickOption(page, 'Where each scale starts', `From ${start}`)
    await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
    const staffs = page.locator('[data-slot=scale-staff]')
    await expect(page.locator('[data-slot=rhythm-card] [data-rhythm-bar]')).toHaveCount(4 * (await staffs.count()))
    const sheetPages = await staffs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(sheetPages).toBe(pages)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}

// a tuplet pulse's card (Phase 4 spec §8; flag `rhythmGears`): 8th-note quintuplets in 5, a one-bar card of two 5:4
// tuplets, keep the cards' count, a sheet page to a letter page
test('prints the Scales with an 8th-note quintuplet card, a sheet page to a letter page (f-blues, Piano)', async ({ page }) => {
  await page.goto('/song/f-blues')
  await chooseSheet(page, 'Scales')
  await chooseInstrument(page, 'Piano')
  await chooseRhythm(page, '8th-note quintuplets', { In: 'In 5', Variation: 'with accents' })
  const staffs = page.locator('[data-slot=scale-staff]')
  await expect(page.locator('[data-slot=rhythm-card] [data-rhythm-bar]')).toHaveCount(await staffs.count()) // 5 in 5: the cycle is a bar
  await expect(page.locator('[data-slot=rhythm-card] .vf-tuplet')).toHaveCount(2 * (await staffs.count()))
  const sheetPages = await staffs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

// Notes per bar (rhythm-scales-arpeggios spec §8): a run is a voiced staff with stems; 7 a bar (tuplets) and 1 a bar
// (15 bars on a staff), a sheet page to a letter page: F Blues (§8's check) and Autumn Leaves (14: a full page at the
// reduced count, as with cards: 12 of trombone-from-B runs at 7 a bar overflow), also trombone from B
for (const perBar of ['7 a bar', '1 a bar'] as const) {
  for (const [song, instrument, start, pages] of [['f-blues', 'Piano', null, 1], ['autumn-leaves', 'Piano', null, 2], ['autumn-leaves', 'Trombone', 'B', 2]] as const) {
    test(`prints the Scales with Notes per bar ${perBar}, a sheet page to a letter page (${song}, ${instrument}${start ? `, from ${start}` : ''})`, async ({ page }) => {
      await page.goto(`/song/${song}`)
      await chooseSheet(page, 'Scales')
      await chooseInstrument(page, instrument)
      if (start) await pickOption(page, 'Where each scale starts', `From ${start}`)
      await pickOption(page, 'Notes per bar', perBar)
      const staffs = page.locator('[data-slot=scale-staff]')
      await expect(page.locator('[data-slot=scale-staff] svg[data-time-sig]')).toHaveCount(await staffs.count())
      const sheetPages = await staffs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
      expect(sheetPages).toBe(pages)
      await page.emulateMedia({ media: 'print' })
      await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
      expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
    })
  }
}

// the Arpeggios sheet with a Rhythm (rhythm-scales-arpeggios spec §8): Up & down, triplets in 4 with accents (triplet
// brackets over accents), a sheet page to a letter page: Extended (§8's check) and 7th Chord (its longest runs: 12 of them
// overflow, so a poured sheet prints 11 a page, §8's fallback), also trombone (bass clef, the tallest staves)
for (const [notes, instrument, pages] of [['Extended', 'Piano', 2], ['Extended', 'Trombone', 2], ['7th Chord', 'Piano', 2], ['7th Chord', 'Trombone', 2]] as const) {
  test(`prints the Arpeggios with a rhythm, a sheet page to a letter page (autumn-leaves, ${notes}, ${instrument})`, async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Arpeggios')
    await chooseInstrument(page, instrument)
    await page.locator('label', { hasText: notes }).click()
    await pickOption(page, 'Arpeggio direction', 'Up & down')
    await chooseRhythm(page, 'Triplets', { In: 'In 4', Variation: 'with accents' })
    await expect(page.locator('svg[data-time-sig]')).toHaveCount(14)
    const sheetPages = await staves(page).evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(sheetPages).toBe(pages)
    expect(await firstSheetStaves(page)).toBe(11) // a poured sheet prints 11 a page (§8's fallback)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}

/** how many staves the first sheet page holds */
const firstSheetStaves = (page: Page): Promise<number> =>
  staves(page).evaluateAll((els) => els.filter((e) => e.closest('section') === els[0]?.closest('section')).length)

// Triad pairs, Arpeggiated, Up & down, in a rhythm (triplets in 4 with accents, the `unit:8t:4:accents` pour): a sheet page
// to a letter page, 11 staves a page (carried from the rhythm-scales-arpeggios PR 3 review)
for (const instrument of ['Piano', 'Trombone'] as const) {
  test(`prints the Triad pairs, arpeggiated up & down in a rhythm, a sheet page to a letter page (autumn-leaves, ${instrument})`, async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Arpeggios')
    await chooseInstrument(page, instrument)
    await page.locator('label', { hasText: 'Triad pairs' }).click()
    await pickOption(page, 'Arpeggio direction', 'Up & down')
    await chooseRhythm(page, 'Triplets', { In: 'In 4', Variation: 'with accents' })
    await expect(page.locator('svg[data-time-sig]')).toHaveCount(14)
    const sheetPages = await staves(page).evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(await firstSheetStaves(page)).toBe(11)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}

/** how many captions are taller than one line of their text */
const wrappedCaptions = (page: Page, slot: 'hexatonic' | 'pentatonic' = 'hexatonic'): Promise<number> =>
  page.locator(`[data-slot="${slot}"]`).evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(el).fontSize)).length)

test('prints 12 staves per letter page with the Hexatonic preset, each caption on one line', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await hexatonicPreset(page)
  await expect(page.locator('[data-slot="hexatonic"]')).toHaveCount(14)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(await wrappedCaptions(page)).toBe(0)
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(2) // 14 lines, 12 a page, as without the caption
})

// the 12-a-page edge with captions, on Autumn Leaves' own lines (as the gates above print them): 12 on 1 page, 13 on 2
const AUTUMN_LINES = ['Cm7 | C Dorian', 'F7 | F Mixolydian', 'Bm7 | B Dorian', 'E7 | E Mixolydian', 'Bbm7 | Bb Dorian', 'Eb7 | Eb Mixolydian', 'Am7b5 | A Locrian', 'D7 | D Phrygian Dominant', 'Gm | G Dorian', 'E7 | E Lydian Dominant', 'EbMaj7 | Eb Lydian', 'Fm7 | F Dorian', 'Bb7 | Bb Mixolydian']
for (const [count, pages] of [[12, 1], [13, 2]] as const) {
  test(`prints ${count} staves with the Hexatonic preset, ${pages} letter page${pages > 1 ? 's' : ''}`, async ({ page }) => {
    const rows = AUTUMN_LINES.slice(0, count).map((line, i) => `${i + 1} | ${line}`)
    await writeChart(page, `title: T\nkey: Gm\nsection: A\n${rows.join('\n')}`)
    await hexatonicPreset(page)
    await expect(page.locator('[data-slot="hexatonic"]')).toHaveCount(count)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(await wrappedCaptions(page)).toBe(0)
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

// the longest captions (no triad pair, an augmented or diminished triad with an accidental) stay on one line in print.
// No page count: these scale names (Harmonic Minor, Half-Whole Dim., Bebop Dominant after a root) wrap to two lines
// in the label column, so the label, not the staff, sets those lines' height, and 12 of them end within a few px of
// the page's foot: whether the 12th fits depends on the platform's font metrics (on macOS, not on Linux CI)
test('prints the longest hexatonic captions on one line', async ({ page }) => {
  const kinds = ['6 | {} Major Pentatonic', 'mMaj7 | {} Melodic Minor', 'm6 | {} Harmonic Minor', '7 | {} Half-Whole', '7 | {} Bebop Dominant']
  const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const rows = roots.map((r, i) => `${i + 1} | ${r}${kinds[i % kinds.length]!.replace('{}', r)}`)
  await writeChart(page, `title: T\nkey: C\nsection: A\n${rows.join('\n')}`)
  await hexatonicPreset(page)
  await pickOption(page, 'Hexatonic pair', '3') // E♭+/F on melodic and harmonic minor
  await expect(page.locator('[data-slot="hexatonic"]', { hasText: '+/' }).first()).toBeVisible()
  await expect(page.locator('[data-slot="hexatonic"]', { hasText: '°/' }).first()).toBeVisible()
  await expect(page.locator('[data-slot="hexatonic"]', { hasText: 'no triad pair' }).first()).toBeVisible()
  await expect(staves(page)).toHaveCount(12)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(await wrappedCaptions(page)).toBe(0)
})

// chord picks (#303): a pick on one of a staff's Changes bars makes its caption end "· varies"; print keeps it on one line
/** pick a chord's second choice on the Changes sheet (Pentatonic ranked against Chord, or Hexatonic), then back to Scales */
async function pickOnChanges(page: Page, kind: 'pentatonic' | 'hexatonic', chord: string): Promise<void> {
  await chooseSheet(page, 'Changes')
  if (kind === 'pentatonic') {
    await showPentatonics(page)
    await rankedAgainstChord(page)
  } else await chooseSuperimpose(page, 'Hexatonic')
  await page.locator(`[data-slot="${kind}"] [data-chord="${chord}"] button`).click()
  await page.getByRole('dialog', { name: / bar \d+$/ }).locator('[data-choice]').nth(1).click()
  await expect(page.locator(`[data-slot="${kind}"] [data-chord="${chord}"] button`)).toHaveAttribute('aria-label', /your pick/)
  await chooseSheet(page, 'Scales')
}

/** how many captions' text runs wider than their column (they don't wrap in print, so a long one would overflow) */
const overflowingCaptions = (page: Page, slot: 'hexatonic' | 'pentatonic'): Promise<number> =>
  page.locator(`[data-slot="${slot}"]`).evaluateAll((els) =>
    els.filter((el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return r.getBoundingClientRect().width > el.getBoundingClientRect().width + 0.5
    }).length,
  )

for (const kind of ['pentatonic', 'hexatonic'] as const) {
  // Autumn Leaves' 12 lines, its Cm7 again in bar 13 (the first staff's), so 12 staves on one page
  test(`prints 12 staves on a letter page with a ${kind} caption that varies`, async ({ page }) => {
    const rows = [...AUTUMN_LINES.slice(0, 12), AUTUMN_LINES[0]!].map((line, i) => `${i + 1} | ${line}`)
    await writeChart(page, `title: T\nkey: Gm\nsection: A\n${rows.join('\n')}`)
    await pickOnChanges(page, kind, 'A:13:0')
    await (kind === 'pentatonic' ? pentatonicPreset(page) : hexatonicPreset(page))
    await expect(page.locator(`[data-slot="${kind}"]`)).toHaveCount(12)
    await expect(page.locator(`[data-slot="${kind}"]`).first()).toHaveText(/ · varies$/)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(await wrappedCaptions(page, kind)).toBe(0)
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(1)
  })
}

// the longest captions with "· varies" (no page count, as above): F♯ half-whole in bars 13 and 15 (F♯m pent · 4 shared),
// C melodic minor in bars 16 and 18 (Pair 3: E♭+/F), a pick in the second bar of each. The pentatonic one is the
// widest caption there is (about 133px of the 136 at 10px on macOS): print tightens its tracking for other platforms
test('prints the longest captions that vary on one line', async ({ page }) => {
  const kinds = ['7 | {} Whole Tone', 'mMaj7 | {} Melodic Minor', 'm6 | {} Harmonic Minor', '7 | {} Half-Whole', '7 | {} Bebop Dominant']
  const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const rows = [...roots.map((r, i) => `${r}${kinds[i % kinds.length]!.replace('{}', r)}`), 'F#7 | F# Half-Whole', 'C7 | C Whole Tone', 'F#7 | F# Half-Whole', 'CmMaj7 | C Melodic Minor', 'C7 | C Whole Tone', 'CmMaj7 | C Melodic Minor']
  await writeChart(page, `title: T\nkey: C\nsection: A\n${rows.map((row, i) => `${i + 1} | ${row}`).join('\n')}`)
  await pickOnChanges(page, 'pentatonic', 'A:15:0')
  await pentatonicPreset(page)
  await expect(page.locator('[data-slot="pentatonic"]', { hasText: 'F♯m pent · 4 shared · varies' })).toHaveCount(1)
  await page.emulateMedia({ media: 'print' })
  expect(await wrappedCaptions(page, 'pentatonic')).toBe(0)
  expect(await overflowingCaptions(page, 'pentatonic')).toBe(0)
  await page.emulateMedia({ media: 'screen' })
  await pickOnChanges(page, 'hexatonic', 'A:18:0')
  await hexatonicPreset(page)
  await pickOption(page, 'Hexatonic pair', '3')
  await expect(page.locator('[data-slot="hexatonic"]', { hasText: 'E♭+/F hex · varies' })).toHaveCount(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(await wrappedCaptions(page, 'hexatonic')).toBe(0)
  expect(await overflowingCaptions(page, 'hexatonic')).toBe(0)
})

// the Hexatonic overlay's row takes the Pentatonics row's place: the same lines a page, with and without a guide tone line
for (const tuba of [false, true]) {
  test(`prints the Changes with the Hexatonic overlay${tuba ? ' and a guide tone line' : ''}, a sheet page to a letter page`, async ({ page }) => {
    await page.goto('/song/stardust')
    if (tuba) {
      await chooseInstrument(page, 'Tuba')
      await showGuides(page, 'From 7th')
      await guidesDrawn(page)
    } else await chooseSheet(page, 'Changes')
    await chooseSuperimpose(page, 'Hexatonic')
    await expect(page.locator('[data-slot="hexatonic"] span').first()).toBeVisible()
    const svgs = page.locator('svg[aria-label^="Bars:"]')
    const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
    expect(sheetPages).toBeGreaterThanOrEqual(2)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
  })
}
