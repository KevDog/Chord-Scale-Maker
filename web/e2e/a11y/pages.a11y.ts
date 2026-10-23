import type { Locator, Page } from '@playwright/test'
import { chooseRhythm, chooseSheet, chooseStart, closePanel, closePentatonicOptions, expect, openPanel, pentatonicPreset, pickOption, rhythmDrawn, showApproach, showArpeggios, showCell, showPentatonics, showTargets, staves, test } from '../fixtures'
import { expectAccessible } from './axe'

const SONG = '/song/autumn-leaves'

/** click until the popover shows: a click before hydration is lost */
async function opens(page: Page, button: Locator, popover: Locator): Promise<void> {
  await expect(async () => {
    if (!(await popover.isVisible())) await button.click({ timeout: 1000 })
    await expect(popover).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

async function darkMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test('the pages', async ({ page }) => {
      test.setTimeout(90_000) // 13 pages: past 30 s in CI
      for (const path of ['/', '/library', '/about', '/help', '/how-it-decides', '/release-notes', '/functions', '/contact', '/privacy', '/scales', '/scales/dorian', '/composers', '/composers/thelonious-monk']) {
        await page.goto(path)
        if (theme === 'dark' && path === '/') await darkMode(page)
        await expectAccessible(page)
      }
    })

    test('the navbar’s Help menu open (#496)', async ({ page }) => {
      await page.goto('/functions')
      if (theme === 'dark') await darkMode(page)
      await opens(page, page.getByRole('banner').getByRole('button', { name: 'Help' }), page.getByRole('menu'))
      await expectAccessible(page)
    })

    test('the contact page with a chart for the library (#153)', async ({ page }) => {
      await page.goto('/contact')
      if (theme === 'dark') await darkMode(page)
      await page.evaluate(() => sessionStorage.setItem('csm-chart-submission', JSON.stringify({ text: 'title: T\n\nsection: A\n1 | Cm7\n', title: 'T', mode: 'new' })))
      await page.reload()
      await expect(page.getByText('attached as t.txt')).toBeVisible()
      await page.getByRole('checkbox', { name: /^Credit me as/ }).check()
      await expectAccessible(page)
    })

    // its own test: the page list runs close to the timeout in CI
    test('a song with its recording', async ({ page }) => {
      await page.goto('/song/blue-trane')
      if (theme === 'dark') await darkMode(page)
      await expect(page.getByRole('heading', { name: 'Recording', level: 2 })).toBeVisible()
      await expectAccessible(page)
    })

    test('a song with its recording on video', async ({ page }) => {
      await page.goto('/song/so-what')
      if (theme === 'dark') await darkMode(page)
      await expect(page.getByRole('button', { name: /Play the video/ })).toBeVisible()
      await expectAccessible(page)
    })

    test('a song with alternate changes: the Changes toggle and the other set’s line (#215)', async ({ page }) => {
      await page.goto('/song/rhythm-changes')
      if (theme === 'dark') await darkMode(page)
      await expect(page.getByRole('group', { name: 'Changes', exact: true })).toBeVisible()
      await expect(page.locator('[data-slot="other-changes"]').first()).toBeVisible()
      await expectAccessible(page)
      // editing: the alternate line's targets (#469), and one's field open
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Alternate for A1 bar 3', exact: true })).toBeVisible()
      await expectAccessible(page)
      await page.getByRole('button', { name: 'Alternate for A1 bar 3', exact: true }).click()
      await page.keyboard.type('D')
      await expect(page.getByRole('combobox', { name: 'Alternate for A1 bar 3' })).toBeFocused()
      await expectAccessible(page)
    })

    test('a song’s version picker open, with your chart under Mine (#425)', async ({ page }) => {
      await page.goto('/help')
      await page.evaluate(() => {
        localStorage.setItem('csm-charts', JSON.stringify([{ id: 'mysummer01', title: 'Summertime', kind: 'copy', basedOn: 'summertime', createdAt: 1, updatedAt: 1 }]))
        localStorage.setItem('csm-chart:mysummer01', 'title: Summertime\nversion: Ballad\nkey: Am\n\nsection: A\nbars: 4\n1 | Am6')
      })
      await page.goto('/song/summertime')
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await opens(page, page.getByRole('button', { name: 'Version' }), page.getByRole('group', { name: 'Mine' }))
      await expectAccessible(page)
    })

    test('the Changes and its popovers', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await expectAccessible(page)
      // the player's range (#359): a picker's notes, in the Instrument panel
      await openPanel(page, 'Instrument')
      await expectAccessible(page)
      await opens(page, page.getByRole('button', { name: 'Lowest note' }), page.getByRole('listbox'))
      await expectAccessible(page)
      await page.keyboard.press('Escape')
      await closePanel(page, 'Instrument')
      const scale = page.getByRole('button', { name: 'C Dorian', exact: true }).first()
      // a scale label: why the sheet plays it
      await opens(page, scale, page.getByRole('dialog', { name: /^Why: / }))
      await expectAccessible(page)
      await page.keyboard.press('Escape')
      // editing, the label pickers: a scale label's scale list, a numeral's functions
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await opens(page, scale, page.getByRole('dialog', { name: /^Scale: / }))
      await expectAccessible(page)
      await page.keyboard.press('Escape')
      await opens(page, page.getByRole('button', { name: 'iiø7', exact: true }).first(), page.getByRole('dialog', { name: /^Function: / }))
      await expectAccessible(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Done editing' }).click()
      // a pentatonic label: its ladder
      await showPentatonics(page)
      await closePentatonicOptions(page) // its panel would cover the actions
      await opens(page, page.locator('[data-slot="pentatonic"] button').first(), page.getByRole('dialog', { name: / bar \d+$/ }))
      await expectAccessible(page)
    })

    test('the Changes with a rhythm and target beats', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
      await rhythmDrawn(page)
      await showTargets(page)
      await expectAccessible(page)
    })

    test('the Changes with a Line in a rhythm, pick-ups and target beats', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await showArpeggios(page, 'Up · root')
      await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
      await chooseStart(page, '2-note pick-up')
      await rhythmDrawn(page)
      await showTargets(page)
      await expect(page.locator('svg[aria-label^="Bars:"] .vf-selected').first()).toBeVisible()
      await expectAccessible(page)
    })

    test('the Scales sheet with a rhythm card (rhythm-scales-arpeggios spec §1)', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await chooseSheet(page, 'Scales')
      await expect(staves(page).first()).toBeVisible()
      await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
      await expect(page.locator('[data-slot=rhythm-card] [data-rhythm-bar]').first()).toBeVisible()
      await expectAccessible(page)
    })

    test('the Patterns sheet, with the Custom box open', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await chooseSheet(page, 'Patterns')
      await expect(staves(page).first()).toBeVisible()
      await pickOption(page, /^Pattern$/, 'Custom…')
      await page.getByLabel('Custom pattern').fill('+0')
      await expect(page.locator('#pattern-error')).toBeVisible()
      await expectAccessible(page)
    })

    test('the Changes sheet’s Cells line, with the Arpeggio pattern listbox open on its cells', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await showCell(page, 'Root to root')
      await openPanel(page, 'Line options')
      await expect(page.getByRole('button', { name: 'Arpeggio pattern', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Arpeggio pattern', exact: true }).click()
      await expect(page.getByRole('listbox')).toBeVisible()
      // its panel: the open list lies over the sheet's labels, which the other scans cover
      await expectAccessible(page, '[role="dialog"]')
    })

    test('the Changes sheet’s Guide Tones with the Approach listbox open', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await showApproach(page, 'Diatonic above, chromatic below (enclosure)')
      await openPanel(page, 'Line options')
      await page.getByRole('button', { name: 'Approach', exact: true }).click()
      await expect(page.getByRole('listbox')).toBeVisible()
      // its panel: the open list lies over the sheet's labels, which the other scans cover
      await expectAccessible(page, '[role="dialog"]')
    })

    test('the Scales and a staff’s chord picks', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await chooseSheet(page, 'Scales')
      await expect(staves(page).first()).toBeVisible()
      await expectAccessible(page)
      await pentatonicPreset(page)
      await opens(page, page.locator('div.text-right [data-slot="pentatonic"] button').first(), page.getByRole('dialog', { name: / bar \d+$/ }))
      await expectAccessible(page, '[role="dialog"]')
    })

    test('the click, docked with its settings open, and in focus mode (#254)', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      const bar = page.getByRole('toolbar', { name: 'Click' })
      await opens(page, page.getByRole('button', { name: 'Click', exact: true }), bar)
      await expectAccessible(page)
      const settings = page.getByRole('dialog', { name: 'Click settings' })
      await opens(page, bar.getByRole('button', { name: 'Click settings' }), settings)
      await expect(settings).toHaveCSS('opacity', '1') // past its fade: mid-fade it reads as low contrast
      await expectAccessible(page, '[role=dialog][aria-label="Click settings"]')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Focus', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Focus mode' }).getByRole('toolbar', { name: 'Click' })).toBeVisible()
      // the click alone: focus mode's own known violations (its Esc hint, the zoomed sheet’s chord buttons) are #488
      await expectAccessible(page, '[aria-label="Focus mode"] [role=toolbar][aria-label=Click]')
    })

    test('the library’s Import iReal link… dialog', async ({ page }) => {
      await page.goto('/library')
      if (theme === 'dark') await darkMode(page)
      const dialog = page.getByRole('dialog', { name: 'Import from iReal Pro' })
      // a click before hydration is lost; once the dialog is up the page behind it is inert, so click only while it is absent
      await expect(async () => {
        if ((await page.getByRole('dialog').count()) === 0) await page.getByRole('button', { name: 'Import iReal link…' }).click({ timeout: 1000 })
        await expect(dialog.getByRole('heading', { name: 'Import from iReal Pro' })).toBeVisible({ timeout: 3000 })
      }).toPass({ timeout: 10_000 })
      await expectAccessible(page, '[role="dialog"]')
    })
  })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the library, and the song with its Controls', async ({ page }) => {
    await page.goto('/library')
    await expectAccessible(page)
    await page.goto(SONG)
    await expect(staves(page).first()).toBeVisible()
    await expectAccessible(page)
    await opens(page, page.getByRole('group', { name: 'Sheet controls' }).getByRole('button', { name: 'Controls' }), page.getByRole('dialog', { name: 'Controls' }).getByRole('button', { name: 'Level' }))
    await expectAccessible(page)
  })
})

// the prerendered page as it is before the app runs: its scripts emptied, not JavaScript off (axe needs it)
test.describe('without the app', () => {
  test('a song: its changes', async ({ page }) => {
    await page.route(/\.m?js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto(SONG)
    await expect(page.getByRole('list', { name: /bar by bar/ }).first()).toBeVisible()
    await expectAccessible(page)
  })
})
