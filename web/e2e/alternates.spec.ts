import type { Page } from '@playwright/test'
import { chooseInterface, chooseSheet, expect, inControls, moreAction, openEditor, pickOption, sheetChord, test, typeChord, writeChart } from './fixtures'

const SONG = '/song/rhythm-changes'
const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const paper = (page: Page) => page.locator('[data-slot="paper"]')
/** the small line of the other set's chords, above the first line's bars */
const otherLine = (page: Page) => page.locator('[data-slot="system"]').first().locator('[data-slot="other-changes"]')
const changesGroup = (page: Page) => page.getByRole('group', { name: 'Changes' })
const otherToggle = (page: Page) => page.getByRole('button', { name: 'Other changes' })

/** play a set: its radio's label (the radio itself is visually hidden), retried until hydrated */
async function play(page: Page, set: 'Standard' | 'Alternate'): Promise<void> {
  await expect(async () => {
    await changesGroup(page).locator('label', { hasText: set }).click({ timeout: 1000 })
    await expect(changesGroup(page).getByRole('radio', { name: set })).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

test('a chart with alternates plays either set, the other small above its bars, remembered (#215)', async ({ page }) => {
  await page.goto(SONG)
  await expect(changesGroup(page).getByRole('radio', { name: 'Standard' })).toBeChecked()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 G7b9 \| Cm7 F7 \|/)
  await expect(otherLine(page)).toContainText('Bdim7')
  await expect(otherLine(page)).toContainText('C♯dim7')
  await expect(paper(page)).not.toContainText('Alternate changes')

  await play(page, 'Alternate')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \| Cm7 C#dim7 \|/)
  await expect(otherLine(page)).toContainText('G7(♭9)')
  await expect(otherLine(page)).not.toContainText('Bdim7')
  await expect(paper(page)).toContainText('Alternate changes')

  await chooseSheet(page, 'Scales')
  await expect(paper(page)).toContainText('Bdim7')
  await expect(paper(page)).toContainText('Alternate changes')
  await chooseSheet(page, 'Changes')

  await otherToggle(page).click()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-slot="other-changes"]')).toHaveCount(0)

  await page.reload()
  await expect(changesGroup(page).getByRole('radio', { name: 'Alternate' })).toBeChecked()
  await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \|/)
})

test('each set keeps its own practice selection (#215)', async ({ page }) => {
  await page.goto(SONG)
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root') // the presets are From root's
  const guideTones = page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })
  await play(page, 'Alternate')
  await guideTones.click()
  await expect(guideTones).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected').first()).toBeAttached()
  await play(page, 'Standard')
  await expect(guideTones).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.vf-selected')).toHaveCount(0)
  await play(page, 'Alternate')
  await expect(guideTones).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vf-selected').first()).toBeAttached()
})

test('a share link opens in the alternate set (#215)', async ({ page, browser }) => {
  await page.goto(SONG)
  await play(page, 'Alternate')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  const fresh = await browser.newContext() // the link alone carries the set
  await chooseInterface(fresh, 'everything')
  const visitor = await fresh.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toHaveAttribute('aria-label', /^Bars: Bb6 Bdim7 \| Cm7 C#dim7 \|/)
  await expect(changesGroup(visitor).getByRole('radio', { name: 'Alternate' })).toBeChecked()
  await expect(paper(visitor)).toContainText('Alternate changes')
  await fresh.close()
})

/** a My charts copy of the chart, the sheet the editor (from md up) */
async function editCopy(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(SONG)
  await moreAction(page, 'Save as a copy')
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(async () => {
    const edit = page.getByRole('button', { name: 'Edit', exact: true })
    if (await edit.isVisible()) await edit.click({ timeout: 1000 })
    await expect(sheetChord(page, 'Bb6', 'A1', 1)).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}
/** the chart text without its column padding */
const source = async (page: Page): Promise<string> => (await page.getByLabel('Chart text').inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')

test.describe('editing a chart with alternates (#469)', () => {
  test.describe('at Intermediate', () => {
    test.use({ interfaceLevel: 'intermediate' })
    test('the sheet is the editor, its Source not forced on', async ({ page }) => {
      await editCopy(page)
      await expect(sheetChord(page, 'G7b9', 'A1', 1)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveCount(0)
      await expect(page.getByLabel('Chart text')).toHaveCount(0)
    })
  })

  test('in Standard, a chord retyped keeps the Changes control', async ({ page }) => {
    await editCopy(page)
    await typeChord(page, 'A1', 1, 'Bb6', 'BbMaj7')
    await expect(sheetChord(page, 'BbMaj7', 'A1', 1)).toBeVisible()
    await expect(changesGroup(page).getByRole('radio', { name: 'Standard' })).toBeChecked()
  })

  test('in Alternate, a shared bar retyped becomes an alternate, the Other changes line showing Standard there', async ({ page }) => {
    await editCopy(page)
    await play(page, 'Alternate')
    await typeChord(page, 'A1', 3, 'Bb6', 'Dm7')
    await expect(sheetChord(page, 'Dm7', 'A1', 3)).toBeVisible()
    await expect(otherLine(page).locator('[data-other-name="2-0"]')).toHaveAttribute('data-chord', 'Bb6')
    await openEditor(page)
    await expect.poll(() => source(page)).toMatch(/\n3 \| Bb6 [^\n]*\n3 \| G7b9 [^\n]*\nalt 3 \| Dm7\nalt 3 \| G7b9/)
  })

  test('in Alternate, a scale picked on an alt chord is written on its alt row', async ({ page }) => {
    await editCopy(page)
    await openEditor(page)
    await play(page, 'Alternate')
    await page.locator('[data-slot="system"]').first().locator('[data-slot=scale]').nth(1).getByRole('button').click() // Bdim7's
    await page.getByRole('dialog', { name: 'Scale: Bdim7' }).getByRole('radio').nth(1).click()
    await expect.poll(() => source(page)).toMatch(/\nalt 1 \| Bdim7 \| [A-G]/)
    expect(await source(page)).toMatch(/\n1 \| G7b9 +#/) // the standard row as it was
  })

  test('on a phone, in Alternate, a shared bar retyped stays open in the chord sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(SONG)
    await moreAction(page, 'Save as a copy')
    await expect(page).toHaveURL(/\/song\?mine=/)
    await inControls(page, async () => {
      await page.getByRole('dialog', { name: 'Controls' }).getByRole('button', { name: 'Edit', exact: true }).click()
    })
    await page.getByRole('button', { name: 'Controls', exact: true }).click()
    await play(page, 'Alternate')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Controls' })).toHaveCount(0)
    await sheetChord(page, 'Bb6', 'A1', 3).click()
    const sheet = page.getByRole('dialog')
    const input = sheet.getByRole('textbox', { name: 'Chord' })
    await input.fill('Dm7')
    await input.press('Enter')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Dm7')
    await expect(sheet).toContainText('A1, bar 3')
  })

  test('+ after on a bar before an alternate keeps the alternate, renumbered', async ({ page }) => {
    await editCopy(page)
    await openEditor(page)
    await sheetChord(page, 'Bb6', 'A1', 1).hover()
    await page.getByRole('button', { name: 'Insert a held bar after A1 bar 1' }).click()
    await expect.poll(() => source(page)).toMatch(/\n3 \| F7 [^\n]*\nalt 3 \| Cm7 [^\n]*\nalt 3 \| C#dim7/)
  })
})

test('a chart without alternates has no Changes toggle (#215)', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(lines(page).first()).toBeVisible()
  await expect(changesGroup(page)).toHaveCount(0)
  await expect(otherToggle(page)).toHaveCount(0)
})

test('a bar of long alternate chords widens to keep their names apart (#475)', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 }) // four bars a line, a beat narrower than these names
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | C\nalt 1 | C7#9b13\nalt 1 | F#7#11\nalt 1 | Bm7b5/F\nalt 1 | E7alt\n2 | F\n3 | G7\n4 | C\n')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: C \| F \|/)
  const names = otherLine(page).locator('[data-chord]')
  await expect(names).toHaveCount(4)
  await expect(async () => {
    const boxes = await names.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })))
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right)
  }).toPass({ timeout: 10_000 })
})

test('at a phone width the other set\'s names do not overlap (#215)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(SONG)
  await expect(otherLine(page)).toContainText('Bdim7')
  const boxes = await otherLine(page).locator('[data-other-name]').evaluateAll((ns) =>
    ns.map((n) => n.getBoundingClientRect()).sort((a, b) => a.left - b.left).map((r) => ({ left: r.left, right: r.right })))
  expect(boxes.length).toBeGreaterThan(1)
  boxes.slice(1).forEach((b, i) => expect(b.left).toBeGreaterThanOrEqual(boxes[i]!.right - 0.5))
})

test.describe('the alternate line, typed bar by bar (#469)', () => {
  const PLAIN = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Em7\n2 | G7\n3 | CMaj7\n4 | A7\n'
  const target = (page: Page, section: string, bar: number) => page.getByRole('button', { name: new RegExp(`^Alternate for ${section} bar ${bar}(:|$)`) })
  const altField = (page: Page, section: string, bar: number) => page.getByRole('combobox', { name: `Alternate for ${section} bar ${bar}`, exact: true })

  test('on a chart with none, the first alternate typed brings the Changes control; cleared, it goes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await writeChart(page, PLAIN)
    await expect(changesGroup(page)).toHaveCount(0)
    await expect(target(page, 'A', 2)).toHaveText('+ alt')
    await target(page, 'A', 2).click()
    await page.keyboard.type('Abm7')
    await page.keyboard.press('Enter')
    await expect(changesGroup(page)).toBeVisible()
    await expect(target(page, 'A', 2)).toHaveAccessibleName('Alternate for A bar 2: Abm7')
    await expect.poll(() => source(page)).toMatch(/\nalt 2 \| Abm7\n/)

    await target(page, 'A', 2).click()
    await page.keyboard.press('Tab')
    await expect(altField(page, 'A', 3)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(altField(page, 'A', 2)).toBeFocused()
    await expect(altField(page, 'A', 2)).toHaveValue('Abm7')
    await altField(page, 'A', 2).fill('')
    await page.keyboard.press('Enter')
    await expect(changesGroup(page)).toHaveCount(0)
    await expect(target(page, 'A', 2)).toHaveText('+ alt')
    expect(await source(page)).not.toMatch(/\nalt /)
  })

  test('the targets show with Other changes off; none over a copy: section, none in Alternate', async ({ page }) => {
    await editCopy(page)
    await otherToggle(page).click()
    await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(target(page, 'A1', 1)).toHaveAccessibleName('Alternate for A1 bar 1: Bb6 Bdim7')
    await expect(target(page, 'A2', 1)).toBeVisible()
    await expect(target(page, 'A3', 1)).toHaveCount(0) // A3 is a copy: of A2
    await play(page, 'Alternate')
    await expect(page.getByRole('button', { name: /^Alternate for / })).toHaveCount(0)
  })

  test('in Alternate, the last alternate retyped back keeps focus on its chord as Standard plays', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await writeChart(page, 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Em7\n2 | G7\nalt 2 | Abm7\n3 | CMaj7\n4 | A7\n')
    await play(page, 'Alternate')
    await typeChord(page, 'A', 2, 'Abm7', 'G7')
    await expect(changesGroup(page)).toHaveCount(0)
    await expect(sheetChord(page, 'G7', 'A', 2)).toBeFocused()
    await expect(sheetChord(page, 'G7', 'A', 2)).toHaveClass(/ring-2/) // selected: the alt row's line is gone, so not bar 3's
    await expect(sheetChord(page, 'CMaj7', 'A', 3)).not.toHaveClass(/ring-2/)
    expect(await source(page)).not.toMatch(/\nalt /)
  })

  test('in print, the line is left out where it has nothing to print, or Other changes is off', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await writeChart(page, PLAIN)
    await expect(target(page, 'A', 2)).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(otherLine(page)).toBeHidden()
    await page.emulateMedia({ media: 'screen' })
    await writeChart(page, PLAIN.replace('2 | G7\n', '2 | G7\nalt 2 | Abm7\n'))
    await page.emulateMedia({ media: 'print' })
    await expect(otherLine(page)).toBeVisible()
    await page.emulateMedia({ media: 'screen' })
    await otherToggle(page).click()
    await expect(otherToggle(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(otherLine(page)).toBeVisible() // the targets, to type alternates
    await page.emulateMedia({ media: 'print' })
    await expect(otherLine(page)).toBeHidden()
  })

  test('on a phone there are no targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await writeChart(page, PLAIN)
    await expect(sheetChord(page, 'G7', 'A', 2)).toBeAttached()
    await expect(page.getByRole('button', { name: /^Alternate for / })).toHaveCount(0)
  })
})
