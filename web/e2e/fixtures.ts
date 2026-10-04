import { test as base, expect } from '@playwright/test'

/**
 * Every test fails on a page error, a console error or a CSP violation: the site must run
 * under its own Content-Security-Policy.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`)
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
