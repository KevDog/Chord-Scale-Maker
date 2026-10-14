import { test as base, expect, type Locator, type Page } from '@playwright/test'

/**
 * Every test fails on a page error, a console error or a CSP violation: the site must run
 * under its own Content-Security-Policy. A spec can allow specific expected console errors
 * (e.g. the 404 itself) with test.use({ expectedConsoleError: /.../ }); CSP violations never are.
 */
export const test = base.extend<{ expectedConsoleError: RegExp | null; problems: string[] }>({
  expectedConsoleError: [null, { option: true }],
  problems: [
    async ({ page, expectedConsoleError }, use) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        const text = m.text()
        const expected = !text.includes('CSP violation') && !!expectedConsoleError?.test(text)
        if (m.type() === 'error' && !expected) problems.push(`console: ${text}`)
      })
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
        )
      })
      await use(problems)
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** count of drawn staves (VexFlow SVGs) */
export const staves = (page: import('@playwright/test').Page) => page.locator('svg[role=img]')

/** pick an instrument from the editor's Instrument listbox by its visible name */
export async function chooseInstrument(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Instrument' }).click()
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
}

/** open a listbox (by its current button name) and choose an option by exact label */
export async function pickOption(page: import('@playwright/test').Page, button: string | RegExp, option: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: button }).click()
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

/** set the scale level from its toolbar "Level" dropdown */
export async function setScaleLevel(page: import('@playwright/test').Page, label: string): Promise<void> {
  await pickOption(page, 'Level', label)
}

/** choose a sheet (Scales / Changes) from the toolbar's "Work on" dropdown; a chart opens on the Changes */
export async function chooseSheet(page: import('@playwright/test').Page, label: string): Promise<void> {
  await pickOption(page, 'Work on', label)
}

/**
 * reveal the editor and its text (the Source: the sheet banner's button from md up, the bar editor's ⋯ menu below) if
 * they aren't already shown — the page is song-first, editor hidden by default
 */
export async function openEditor(page: import('@playwright/test').Page): Promise<void> {
  const text = page.getByLabel('Chart text')
  const source = page.getByRole('button', { name: 'Source', exact: true })
  const more = page.getByRole('button', { name: 'More editing options' })
  // retry the clicks: before hydration the handlers aren't attached yet, so a single click can be lost
  await expect(async () => {
    if (!(await text.isVisible())) {
      if (await source.isVisible()) {
        await source.click({ timeout: 1000 })
      } else if (await more.isVisible()) {
        await more.click({ timeout: 1000 })
        await page.getByRole('menuitem', { name: 'Show source' }).click({ timeout: 1000 })
      } else {
        const edit = page.getByRole('button', { name: 'Edit', exact: true })
        if (await edit.count()) await edit.click({ timeout: 1000 })
      }
    }
    await expect(text).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** a chord on the Changes sheet while editing: its button ("Edit G7, A bar 2"), which opens its field (from md up) or the bottom sheet */
export const sheetChord = (page: Page, chord: string, section: string, bar: number) => page.getByRole('button', { name: `Edit ${chord}, ${section} bar ${bar}`, exact: true })

/** choose an action from the song page's More menu (the rail's ⋯) */
export async function moreAction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name }).click()
}

/** type a chord over one on the Changes sheet (from md up: its field opens with the chord selected), and confirm it */
export async function typeChord(page: Page, section: string, bar: number, from: string, to: string): Promise<void> {
  await sheetChord(page, from, section, bar).click()
  await page.keyboard.type(to)
  await page.keyboard.press('Enter')
}

/**
 * a new chart with this text, the editor open (it opens on the Changes sheet). Give it a first chord the starter
 * chart (Dm7 G7 CMaj7) hasn't at that bar, or the wait below is over before the text is parsed and the sheet redraws
 * under the next click.
 */
export async function writeChart(page: Page, text: string): Promise<void> {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill(text)
  // the text is parsed after a short pause (useChartEditor): wait until the sheet shows the first chord written
  const [, section = '', bar = '', chord = ''] = text.match(/^([^#|\n][^|\n]*?)\s*\|\s*(\d+)\s*\|\s*([^|\n]+?)\s*(?:\||$)/m) ?? []
  if (chord) await expect(sheetChord(page, chord, section, Number(bar))).toBeAttached()
}

/** on a phone (compactRail) the sheet's other controls are in the Controls dialog: open it around these steps */
export async function inControls(page: Page, steps: () => Promise<void>): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) >= 768) return steps()
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await steps()
  const dialog = page.getByRole('dialog', { name: 'Controls' })
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Close', exact: true }).click()
}

/** choose the Changes sheet's line mode (Off · Guide Tones · 7th Chords), confirmed checked (retried: a click before hydration is lost) */
export async function showLine(page: Page, name: 'Off' | 'Guide Tones' | '7th Chords'): Promise<void> {
  await inControls(page, () => pickLine(page, name))
}

async function pickLine(page: Page, name: 'Off' | 'Guide Tones' | '7th Chords'): Promise<void> {
  const radio = page.getByRole('radio', { name, exact: true })
  await expect(async () => {
    if (!(await radio.isChecked())) await page.locator('label').filter({ has: radio }).click({ timeout: 1000 })
    await expect(radio).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** choose the Changes sheet's guide tone line: Off, or Guide Tones from the 3rd or the 7th */
export async function showGuides(page: Page, name: 'Off' | 'From 3rd' | 'From 7th'): Promise<void> {
  await inControls(page, async () => {
    await pickLine(page, name === 'Off' ? 'Off' : 'Guide Tones')
    if (name !== 'Off') await pickOption(page, 'Guide tone line', name)
  })
}

/** wait until every Changes line has been drawn with its guide tones (each line draws on its own) */
export async function guidesDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; guide tones: '))))
    .toBe(true)
}

/** choose 7th Chords with a pattern ("Up · root", "Voice-led", …) */
export async function showArpeggios(page: Page, pattern: string): Promise<void> {
  await inControls(page, async () => {
    await pickLine(page, '7th Chords')
    await pickOption(page, 'Arpeggio pattern', pattern)
  })
}

/** wait until every Changes line has been drawn with its arpeggios */
export async function arpeggiosDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; 7th chords: '))))
    .toBe(true)
}

/** Bravura code points VexFlow draws as SVG text */
export const GLYPH = { flat: 0xe260, natural: 0xe261, sharp: 0xe262, gClef: 0xe050, fClef: 0xe062 } as const

/** a glyph's position (x: its left, y: its line) and advance width, in drawing units */
export type Glyph = Readonly<{ x: number; y: number; w: number; code: number }>
/** what VexFlow drew in one SVG, read from its glyphs and paths, in drawing units (the staff lines are at y 80-120) */
export type Drawn = Readonly<{
  width: number // the viewBox width: 300 a bar
  heads: readonly Glyph[]
  accidentals: readonly Glyph[] // on notes only (a key signature's are in .vf-keysignature)
  rests: number
  slashes: number
  dots: number
  stems: readonly Readonly<{ from: number; to: number }>[] // y at the notehead, y at the tip
  ties: readonly Readonly<{ x: number; y: number; control: number }>[] // start, and the first curve's control point y
  clefs: readonly number[]
  voltaBottom: number | null // the lowest point of a 1st/2nd-ending bracket; null for none
}>

export const drawn = (svg: Locator): Promise<Drawn> =>
  svg.evaluate((el): Drawn => {
    const code = (t: Element): number => t.textContent?.codePointAt(0) ?? 0
    const glyph = (t: Element): Glyph => ({ x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), w: (t as SVGTextElement).getBBox().width, code: code(t) })
    const within = (lo: number, hi: number) => (t: Element): boolean => code(t) >= lo && code(t) <= hi
    const nums = (p: Element): number[] => (p.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const notes = Array.from(el.querySelectorAll('.vf-stavenote text'))
    const volta = Array.from(el.querySelectorAll(':scope > rect')).map((r) => Number(r.getAttribute('y')) + Number(r.getAttribute('height')))
    return {
      width: Number(el.getAttribute('viewBox')?.split(' ')[2] ?? 0),
      heads: notes.filter(within(0xe0a0, 0xe0a4)).map(glyph),
      accidentals: notes.filter(within(0xe260, 0xe264)).map(glyph),
      rests: notes.filter(within(0xe4e0, 0xe4e7)).length,
      slashes: notes.filter(within(0xe100, 0xe10f)).length,
      dots: notes.filter(within(0xe1e7, 0xe1e7)).length,
      stems: Array.from(el.querySelectorAll('.vf-stem path')).map((p) => {
        const [, from = 0, , to = 0] = nums(p)
        return { from, to }
      }),
      ties: Array.from(el.querySelectorAll('.vf-stavetie path')).map((p) => {
        const [x = 0, y = 0, , control = 0] = nums(p)
        return { x, y, control }
      }),
      clefs: Array.from(el.querySelectorAll('.vf-clef text')).map(code),
      voltaBottom: volta.length ? Math.max(...volta) : null,
    }
  })

/** turn the Pentatonics row on, retrying the click until the page has hydrated and the toggle reads pressed */
export async function showPentatonics(page: Page): Promise<void> {
  await inControls(page, async () => {
    const toggle = page.getByRole('button', { name: 'Pentatonics', exact: true })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
}
