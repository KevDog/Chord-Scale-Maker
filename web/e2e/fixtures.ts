import { test as base, expect } from '@playwright/test'

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

/** choose a sheet (Scales / Guide Tones / Changes) from the toolbar's "Work on" dropdown */
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
