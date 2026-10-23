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
export const staves = (page: import('@playwright/test').Page) => page.locator('svg[role=img]:not([data-slot=rhythm-card] svg)') // not a Scales staff's rhythm card

/** each Pitch's instruments as the picker names them (Playwright can't load the engine: its JSON import) */
const PITCHES: Readonly<Record<string, readonly string[]>> = {
  Concert: ['Piano', 'Vibes', 'Flute', 'Guitar'],
  'B♭': ['Trumpet', 'Flugelhorn', 'Clarinet', 'Soprano Sax', 'Tenor Sax'],
  'E♭': ['Alto Sax', 'Bari Sax'],
  F: ['Horn'],
  Bass: ['Trombone', 'Tuba', 'Bass'],
}

/** pick an instrument by its visible name: its Pitch first, then the Instrument listbox (#417) */
export async function chooseInstrument(page: import('@playwright/test').Page, name: string): Promise<void> {
  const pitch = Object.keys(PITCHES).find((p) => PITCHES[p]!.some((n) => n.startsWith(name)))
  if (!pitch) throw new Error(`no instrument ${name}`)
  const opened = await reveal(page, 'Pitch')
  const current = await page.getByRole('button', { name: 'Pitch' }).textContent()
  if (current?.trim() !== pitch) {
    await page.getByRole('button', { name: 'Pitch' }).click()
    await page.getByRole('listbox', { name: 'Pitch' }).getByRole('option', { name: pitch, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Instrument', exact: true }).click()
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click()
  if (opened) await closePanel(page, 'Instrument')
}

/**
 * the rail keeps each group one control tall: the instrument's pitch and range sit in its panel (the "Instrument: …"
 * button), the line's detail in Line options. Open the one holding this control, if it's tucked away.
 */
async function reveal(page: Page, button: string | RegExp): Promise<'Instrument' | 'Line options' | null> {
  // a panel closing (a click outside it) fades out: wait it out, or its controls look there and vanish under the click
  for (const panel of ['Instrument', 'Line options'] as const) {
    const opener = panelButton(page, panel)
    if ((await opener.count()) && (await opener.getAttribute('aria-expanded')) !== 'true') await expect(page.getByRole('dialog', { name: panel })).toHaveCount(0)
  }
  if (await page.getByRole('button', { name: button }).first().isVisible()) return null
  const name = typeof button === 'string' ? button : button.source
  for (const panel of ['Instrument', 'Line options'] as const) {
    if (panel === 'Instrument' && !/^(Pitch|Instrument|Lowest note|Highest note)$/.test(name)) continue
    const opener = panelButton(page, panel)
    if (!(await opener.isVisible()) || (await opener.getAttribute('aria-expanded')) === 'true') continue
    await opener.click()
    // look in the panel: a control still rendering may show up outside it meanwhile, on a sheet the pick then drops this panel from
    if (await page.getByRole('dialog', { name: panel }).getByRole('button', { name: button }).first().isVisible()) return panel
    await closePanel(page, panel)
  }
  return null
}

/** the rail's popovers: the Instrument's, Line options (the Changes), Rhythm options (the Scales and Arpeggios sheets' Rhythm group) */
type Panel = 'Instrument' | 'Line options' | 'Rhythm options'
const panelButton = (page: Page, panel: Panel): Locator =>
  page.getByRole('button', { name: panel === 'Instrument' ? /^Instrument: / : panel }).first()

/** open the Instrument's panel (its pitch, instrument and range) or Line options, to read what's set there */
export async function openPanel(page: Page, panel: Panel): Promise<void> {
  const opener = panelButton(page, panel)
  await expect(async () => {
    if ((await opener.getAttribute('aria-expanded')) !== 'true') await opener.click({ timeout: 1000 })
    await expect(page.getByRole('dialog', { name: panel })).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
  await expect(page.locator('.ease-fade-enter-active')).toHaveCount(0) // settled: faded in
}

/** close that panel, so it covers nothing under it */
export async function closePanel(page: Page, panel: Panel): Promise<void> {
  const opener = panelButton(page, panel)
  if ((await opener.count()) && (await opener.getAttribute('aria-expanded')) === 'true') await opener.click()
  await expect(page.getByRole('dialog', { name: panel })).toHaveCount(0)
}

/** open a listbox (by its current button name) and choose an option by exact label; a panel opened to reach it is closed after */
export async function pickOption(page: import('@playwright/test').Page, button: string | RegExp, option: string | RegExp): Promise<void> {
  const opened = await reveal(page, button)
  await page.getByRole('button', { name: button }).click()
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
  if (opened) await closePanel(page, opened)
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

/** with Guide Tones (or 7th Chords, #381) chosen, pick the line's Approach (#298, flag `approaches`) from its listbox: "None", "Chromatic below", "Diatonic above, chromatic below (enclosure)", … */
export async function showApproach(page: Page, name: string, line: 'Guide Tones' | '7th Chords' = 'Guide Tones'): Promise<void> {
  await inControls(page, async () => {
    await pickLine(page, line)
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

/** with a cell or system chosen, pick the Cells line's Order (#376, flag `phraseCells`): "As written", "Reversed", "Rotated", "Pairs swapped" */
export async function showOrder(page: Page, order: string): Promise<void> {
  await inControls(page, () => pickOption(page, /^Order$/, order))
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
export async function chooseSuperimpose(page: Page, name: 'Off' | 'Pentatonic' | 'Hexatonic' | 'Quartal'): Promise<void> {
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

export async function quartalPreset(page: Page): Promise<void> {
  await practicePreset(page, 'Quartal')
}

async function practicePreset(page: Page, name: 'Pentatonic' | 'Hexatonic' | 'Quartal'): Promise<void> {
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name, exact: true }).click()
  await expect(page.locator(`[data-slot="${name.toLowerCase()}"]`).first()).toBeVisible()
}

/**
 * choose the rhythm: the Changes sheet's in Line options (rhythm spec §9, flag `rhythm`), or the Scales and Arpeggios
 * sheets' on the rail, its detail in Rhythm options (flag `rhythmSheets`): a family from the Rhythm listbox
 * ("8ths", "Runs of 16ths", "Upbeats", …), then each detail by its listbox ({ In: 'In 5', Variation: 'syncopated' });
 * retried until the page has hydrated and the listbox reads it; the panel is closed after
 */
export async function chooseRhythm(page: Page, family: string, detail: Readonly<Record<string, string>> = {}): Promise<void> {
  await inControls(page, async () => {
    const panel = await panelButton(page, 'Line options').isVisible() // in the Controls dialog it's inline
    if (panel) await openPanel(page, 'Line options')
    const listbox = page.getByRole('button', { name: 'Rhythm', exact: true })
    await expect(async () => {
      if ((await listbox.textContent())?.trim() !== `Rhythm: ${family}`) {
        await listbox.click({ timeout: 1000 })
        await page.getByRole('option', { name: family, exact: true }).click({ timeout: 1000 })
      }
      await expect(listbox).toHaveText(`Rhythm: ${family}`, { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    const options = !panel && Object.keys(detail).length > 0 && (await panelButton(page, 'Rhythm options').isVisible()) // on the rail; inline in the Controls dialog
    if (options) await openPanel(page, 'Rhythm options')
    for (const [name, option] of Object.entries(detail)) {
      await page.getByRole('button', { name, exact: true }).click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page.getByRole('button', { name, exact: true })).toHaveText(option)
    }
    if (options) await closePanel(page, 'Rhythm options')
    if (panel) await closePanel(page, 'Line options')
  })
}

/** in Line options, choose a listbox's option by its label, retried until the listbox reads `shown`; the panel is closed after */
async function chooseInLineOptions(page: Page, name: string, option: string, shown: string): Promise<void> {
  await inControls(page, async () => {
    const panel = await panelButton(page, 'Line options').isVisible() // in the Controls dialog it's inline
    if (panel) await openPanel(page, 'Line options')
    const listbox = page.getByRole('button', { name, exact: true })
    await expect(async () => {
      if ((await listbox.textContent())?.trim() !== shown) {
        await listbox.click({ timeout: 1000 })
        await page.getByRole('option', { name: option, exact: true }).click({ timeout: 1000 })
      }
      await expect(listbox).toHaveText(shown, { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    if (panel) await closePanel(page, 'Line options')
  })
}

/** with a unit on the Changes, choose its Groups path (Phase 4 spec §7): "One", "Up (3 4 5 6 7)", "Down (7 6 5 4 3)", by their labels */
export const chooseGroups = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Groups', label, `Groups: ${label}`)

/** with a unit or your rhythm on the Changes, choose its Gears path (Phase 4 spec §7): "One", "Up the gears (4t 8 8t 16 16t)", …, by their labels */
export const chooseGears = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Gears', label, `Gears: ${label}`)

/** with a rhythm path on, choose its Step (Phase 4 spec §7): "By section", "By key area", "Every 2 bars", … */
export const chooseRhythmStep = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Step', label, `Step: ${label}`)

/** on the Changes, choose its Feel (Phase 4 spec §7): "In 4", "In 2", "In 1" */
export const chooseFeel = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Feel', label, `Feel: ${label}`)

/** with a rhythm on a Line that takes it, choose its Start (rhythm-on-lines spec §10): "On the beat", "1-note pick-up", … */
export const chooseStart = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Start', label, `Start: ${label}`)

/** with a rhythm on a Line that takes it, choose its Timing (rhythm-on-lines spec §10): "On time", "Anticipate 1½ beats", "Resolve late 1 beat", … */
export const chooseTiming = (page: Page, label: string): Promise<void> => chooseInLineOptions(page, 'Timing', label, label)

/** with Guide Tones and a rhythm, turn Restate on (rhythm-on-lines spec §5), retried until it reads pressed; the panel is closed after */
export async function restateOn(page: Page): Promise<void> {
  await inControls(page, async () => {
    const panel = await panelButton(page, 'Line options').isVisible() // in the Controls dialog it's inline
    if (panel) await openPanel(page, 'Line options')
    const toggle = page.getByRole('button', { name: 'Restate', exact: true })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    if (panel) await closePanel(page, 'Line options')
  })
}

/** wait until every Changes line has been drawn with its rhythm */
export async function rhythmDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; rhythm: '))))
    .toBe(true)
}

/** Target beats on (rhythm spec §7, flag `rhythm`), retried until the page has hydrated and the toggle reads it */
export async function showTargets(page: Page): Promise<void> {
  await inControls(page, async () => {
    const toggle = page.getByRole('button', { name: 'Target beats' })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
  await expect(page.locator('[data-target-beat]').first()).toBeAttached()
}
