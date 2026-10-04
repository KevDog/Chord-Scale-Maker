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
