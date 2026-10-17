import { type BrowserContext, test as base, expect, type Locator, type Page } from '@playwright/test'

export type InterfaceLevel = 'essentials' | 'intermediate' | 'everything'

/** a browser that has chosen an Interface level (null: a new browser, which decides its own). Specs expect every control unless they say otherwise */
export async function chooseInterface(context: BrowserContext, level: InterfaceLevel): Promise<void> {
  await context.addInitScript((l) => {
    try {
      if (localStorage.getItem('csm-interface') === null) localStorage.setItem('csm-interface', l)
    } catch {
      // no storage on this page (about:blank)
    }
  }, level)
}

/**
 * Every test fails on a page error, a console error or a CSP violation: the site must run
 * under its own Content-Security-Policy. A spec can allow specific expected console errors
 * (e.g. the 404 itself) with test.use({ expectedConsoleError: /.../ }); CSP violations never are.
 */
export const test = base.extend<{ expectedConsoleError: RegExp | null; interfaceLevel: InterfaceLevel | null; problems: string[] }>({
  expectedConsoleError: [null, { option: true }],
  interfaceLevel: ['everything', { option: true }],
  problems: [
    async ({ page, expectedConsoleError, interfaceLevel }, use) => {
      if (interfaceLevel) await chooseInterface(page.context(), interfaceLevel)
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
  const section = /^section:\s*(\S+)/m.exec(text)?.[1] ?? ''
  const [, bar = '', chord = ''] = text.match(/^(\d+)\s*\|\s*([^|\n]+?)\s*(?:\||\s#|$)/m) ?? []
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

/** choose the Changes sheet's line mode (Off · Guide Tones · 7th Chords, or Pentatonic under the Pentatonic overlay), confirmed checked (retried: a click before hydration is lost) */
export async function showLine(page: Page, name: 'Off' | 'Guide Tones' | '7th Chords' | 'Pentatonic'): Promise<void> {
  await inControls(page, () => pickLine(page, name))
}

async function pickLine(page: Page, name: 'Off' | 'Guide Tones' | '7th Chords' | 'Pentatonic'): Promise<void> {
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

/** with Guide Tones chosen, pick the guide tone line's Approach (#298, flag `approaches`) from its listbox: "None", "Chromatic below", "Diatonic above, chromatic below (enclosure)", … */
export async function showApproach(page: Page, name: string): Promise<void> {
  await inControls(page, async () => {
    await pickLine(page, 'Guide Tones')
    await pickOption(page, 'Approach', name)
  })
}

/** choose a melodic cell or system (#298, flag `cells`) from the 7th Chords' "Arpeggio pattern" listbox: "Root to root", "1 2 3 5", … */
export async function showCell(page: Page, cell: string): Promise<void> {
  await inControls(page, async () => {
    await pickLine(page, '7th Chords')
    await pickOption(page, 'Arpeggio pattern', cell)
  })
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

/** choose the Changes sheet's Superimpose (inside Controls on a phone), retried until the page has hydrated and the listbox reads it */
export async function chooseSuperimpose(page: Page, name: 'Off' | 'Pentatonic' | 'Hexatonic'): Promise<void> {
  await inControls(page, async () => {
    const listbox = page.getByRole('button', { name: 'Superimpose', exact: true })
    await expect(async () => {
      if (!(await listbox.textContent())?.includes(`Superimpose: ${name}`)) {
        await listbox.click({ timeout: 1000 })
        await page.getByRole('option', { name, exact: true }).click({ timeout: 1000 })
      }
      await expect(listbox).toContainText(`Superimpose: ${name}`, { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
}

/** the Pentatonic overlay on */
export const showPentatonics = (page: Page): Promise<void> => chooseSuperimpose(page, 'Pentatonic')

/** the Pentatonic line (#284): Superimpose Pentatonic, then the Line's Pentatonic, leaving out a degree ("1", "♭3" …) if given */
export async function showPentatonicLine(page: Page, leave?: string): Promise<void> {
  await showPentatonics(page)
  await closePentatonicOptions(page)
  await inControls(page, async () => {
    await pickLine(page, 'Pentatonic')
    if (leave) await pickOption(page, 'Leave out', leave)
  })
}

/** wait until every Changes line has been drawn with the Pentatonic line */
export async function pentatonicLineDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; pentatonic: '))))
    .toBe(true)
}

/** close the Pentatonic options' popover that opens as the Superimpose turns to Pentatonic (#293): wait for it to open, then
 * toggle it shut with its chevron, so it can't cover the controls below it (Escape needs focus inside it, which it doesn't take) */
export async function closePentatonicOptions(page: Page): Promise<void> {
  const chevron = page.getByRole('button', { name: 'Pentatonic options' })
  if (!(await chevron.isVisible())) return
  await expect(chevron).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 }).catch(() => {})
  await expect(async () => {
    if ((await chevron.getAttribute('aria-expanded')) === 'true') await chevron.click({ timeout: 1_000 })
    await expect(chevron).not.toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

/** open the Pentatonic options' popover beside the Superimpose (#293): it opens as the Superimpose turns to Pentatonic, not after a reload */
export async function openPentatonicOptions(page: Page): Promise<void> {
  const chevron = page.getByRole('button', { name: 'Pentatonic options' })
  if ((await chevron.getAttribute('aria-expanded')) !== 'true') await chevron.click()
}

/** choose Ranked against: Chord (inside Controls on a phone), retried: a click before hydration is lost */
export async function rankedAgainstChord(page: Page): Promise<void> {
  await inControls(page, async () => {
    const radio = page.getByRole('radio', { name: 'Chord', exact: true })
    await expect(async () => {
      if (!(await radio.isChecked())) await page.locator('label').filter({ has: radio }).click({ timeout: 1000 })
      await expect(radio).toBeChecked({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
}

/** the Scales sheet's Pentatonic practice preset, from the root (#266), its captions shown */
export async function pentatonicPreset(page: Page): Promise<void> {
  await practicePreset(page, 'Pentatonic')
}

/** the Scales sheet's Hexatonic practice preset, from the root, its captions shown */
export async function hexatonicPreset(page: Page): Promise<void> {
  await practicePreset(page, 'Hexatonic')
}

async function practicePreset(page: Page, name: 'Pentatonic' | 'Hexatonic'): Promise<void> {
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name, exact: true }).click()
  await expect(page.locator(`[data-slot="${name.toLowerCase()}"]`).first()).toBeVisible()
}
