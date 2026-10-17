import type { Page } from '@playwright/test'
import { arpeggiosDrawn, pentatonicLineDrawn, showPentatonicLine, chooseInstrument, chooseSuperimpose, chooseSheet, drawn, expect, guidesDrawn, hexatonicPreset, pentatonicPreset, pickOption, rankedAgainstChord, showArpeggios, showGuides, showPentatonics, staves, test, writeChart } from './fixtures'

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
for (const line of ['From 3rd', 'From 7th'] as const) {
test(`prints the Changes with a guide tone line (${line}), a sheet page to a letter page, in the tallest case`, async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, line)
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

// an arpeggio line: sixteenths and beams on the tuba's bass staff, the same tune; again a sheet page to a letter page
test('prints the Changes with a 7th chord line, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showArpeggios(page, 'Up · root')
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
  const kinds = ['7 | {} Whole Tone', 'mMaj7 | {} Melodic Minor', 'm6 | {} Harmonic Minor', '7 | {} Half-Whole', '7 | {} Bebop Dominant']
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
