import type { Locator, Page } from '@playwright/test'
import { chooseSheet, expect, pentatonicPreset, showPentatonics, staves, test } from '../fixtures'
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
      for (const path of ['/', '/library', '/about', '/help', '/functions', '/contact', '/privacy', '/scales', '/scales/dorian', '/composers', '/composers/thelonious-monk', '/song/blue-trane']) {
        await page.goto(path)
        if (theme === 'dark' && path === '/') await darkMode(page)
        await expectAccessible(page)
      }
    })

    test('the Changes and its popovers', async ({ page }) => {
      await page.goto(SONG)
      if (theme === 'dark') await darkMode(page)
      await expect(staves(page).first()).toBeVisible()
      await expectAccessible(page)
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
