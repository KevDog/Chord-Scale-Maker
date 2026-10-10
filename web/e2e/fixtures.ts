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

/** reveal the editor (grid + text) if it isn't already shown — the page is song-first, editor hidden by default */
export async function openEditor(page: import('@playwright/test').Page): Promise<void> {
  const text = page.getByLabel('Chart text')
  // retry the click: before hydration the Edit handler isn't attached yet, so a single click can be lost
  await expect(async () => {
    if (!(await text.isVisible())) {
      const edit = page.getByRole('button', { name: 'Edit', exact: true })
      if (await edit.count()) await edit.click({ timeout: 1000 })
    }
    await expect(text).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** a new chart with this text, the editor open (it opens on the Changes sheet) */
export async function writeChart(page: Page, text: string): Promise<void> {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill(text)
}

/** turn on the Changes sheet's guide tone toggles, each confirmed pressed (retried: a click before hydration is lost) */
export async function showGuides(page: Page, ...names: readonly ('From 3rd' | 'From 7th')[]): Promise<void> {
  for (const name of names) {
    const toggle = page.getByRole('button', { name, exact: true })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  }
}

/** wait until every Changes line has been drawn with its guide tones (each line draws on its own) */
export async function guidesDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; guide tones: '))))
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
