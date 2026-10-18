import type { Locator, Page } from '@playwright/test'
import { chooseSheet, expect, pentatonicPreset, pickOption, showApproach, showCell, showPentatonics, staves, test } from '../fixtures'
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

    test('the Changes and its popovers', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await expectAccessible(page)
      // the player's range (#359): a picker's notes
      await opens(page, page.getByRole('button', { name: 'Lowest note' }), page.getByRole('listbox'))
      await expectAccessible(page)
      await page.keyboard.press('Escape')
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
      await opens(page, page.locator('[data-slot="pentatonic"] button').first(), page.getByRole('dialog', { name: / bar \d+$/ }))
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
      await expect(page.getByRole('button', { name: 'Arpeggio pattern', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Arpeggio pattern', exact: true }).click()
      await expect(page.getByRole('listbox')).toBeVisible()
      await expectAccessible(page)
    })

    test('the Changes sheet’s Guide Tones with the Approach listbox open', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await showApproach(page, 'Diatonic above, chromatic below (enclosure)')
      await page.getByRole('button', { name: 'Approach', exact: true }).click()
      await expect(page.getByRole('listbox')).toBeVisible()
      await expectAccessible(page)
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
