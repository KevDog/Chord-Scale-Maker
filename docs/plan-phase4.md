# Phase 4: Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A strict, hashed Content-Security-Policy on every page, plus the standard security headers.
- Playwright browser tests in CI that fail on any CSP violation.
- SHA-pinned CI actions, and Dependabot for npm and Actions.

The Firewall rate-limit rule is applied by the controller after the tasks.

**Architecture:**
- **CSP:** `web/build/csp.ts` (pure, unit-tested) hashes each page's executable inline scripts (Nuxt's import map and runtime config) and inserts a CSP `<meta>` first in `<head>`. A Nitro `prerender:generate` hook in `nuxt.config.ts` runs it on every prerendered page.
- **Headers:** headers that `<meta>` can't carry (`frame-ancestors`, HSTS and the rest) are set in `routeRules`, and Nitro writes them into Vercel's build output.
- **E2E:** Playwright tests in `web/e2e/` run against the production static build, served by `nuxt preview`.

**Tech Stack:** as before, plus `@playwright/test` 1.63.0 (Chromium).

Spec: [design.md](design.md) §9 and §10. The code below has been run in a scratch worktree:
- 12 pytest and 99 vitest tests pass, and lint and the three typechecks (app, engine, e2e) are clean.
- All 12 Playwright tests pass. Removing one hash from a built page makes them fail with "CSP violation: script-src-elem".
- `NITRO_PRESET=vercel-static nuxt generate` writes the headers into `.vercel/output/config.json` and the CSP meta into every page.

---

## Background for the implementer

- **Layout:** `web/` is a Nuxt 4 static site. Run npm/npx from `web/` only; `make` runs from the repo root.
- **Copy, don't retype:** verified copies of every file are under `the scratch copy ` at the same relative paths. Copy them byte for byte with plain `cp`, in step order (tests first, then implementation).
- **Commits:** each commit message ends with a blank line and then exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Git:** stage only the listed files, by explicit path. Never run `git checkout`, `git stash`, `git restore` or `git reset`.

---

### Task 1: Hashed CSP and security headers

**Files:**
- Create: `web/build/csp.ts`, `web/build/csp.test.ts`
- Modify: `web/nuxt.config.ts`, `web/vitest.config.ts` (the engine project also runs `build/**/*.test.ts`), `web/tsconfig.engine.json` (includes `build/**/*.ts`)

- [ ] **Step 1: Failing test.** Copy `web/build/csp.test.ts`, `web/vitest.config.ts` and `web/tsconfig.engine.json`. Then:

Run: `cd web && npx vitest run --project engine build`
Expected: FAIL, `./csp` cannot be resolved

`web/build/csp.test.ts`:

```ts
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { addCspMeta, contentSecurityPolicy, inlineScriptHashes } from './csp'

const sha = (s: string): string => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`
const PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<script type="importmap">{"imports":{"#entry":"/_nuxt/a.js"}}</script>
<script src="/theme-init.js"></script>
<script>window.__NUXT__={};window.__NUXT__.config={public:{}}</script>
<script type="application/json" id="__NUXT_DATA__">[{}]</script>
</head><body><div id="__nuxt"></div></body></html>`

describe('csp', () => {
  it('hashes executable inline scripts, including import maps, but not data blocks or external scripts', () => {
    expect(inlineScriptHashes(PAGE)).toEqual([
      sha('{"imports":{"#entry":"/_nuxt/a.js"}}'),
      sha('window.__NUXT__={};window.__NUXT__.config={public:{}}'),
    ])
  })

  it('builds a strict policy around those hashes', () => {
    const policy = contentSecurityPolicy(["'sha256-x'"])
    expect(policy).toContain("script-src 'self' 'sha256-x'")
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("font-src 'self' data:") // VexFlow's embedded Bravura font
    expect(policy).not.toMatch(/script-src[^;]*unsafe/)
  })

  it('puts the policy first in <head>, before any script it governs', () => {
    const out = addCspMeta(PAGE)
    const meta = out.indexOf('http-equiv="Content-Security-Policy"')
    expect(meta).toBeGreaterThan(out.indexOf('<head>'))
    expect(meta).toBeLessThan(out.indexOf('<script'))
    expect(out).toContain(sha('window.__NUXT__={};window.__NUXT__.config={public:{}}'))
    expect(addCspMeta(out)).toBe(out) // idempotent
  })

  it('leaves non-HTML untouched', () => {
    expect(addCspMeta('{"a":1}')).toBe('{"a":1}')
  })
})
```

- [ ] **Step 2: Implement.** Copy `web/build/csp.ts` and `web/nuxt.config.ts`.

`web/build/csp.ts`:

```ts
import { createHash } from 'node:crypto'

/**
 * Content-Security-Policy for the static site, added to each prerendered page as a <meta> tag.
 * Nuxt's HTML has two small inline scripts (an import map and the runtime config) whose contents
 * change per build, so they are allowed by hash, computed at build time, never 'unsafe-inline'.
 * frame-ancestors can't be set from <meta>; it is sent as a header (see nuxt.config.ts routeRules).
 */

/** script types the browser executes (CSP script-src applies); data blocks like application/json don't */
const EXECUTABLE = new Set(['', 'module', 'text/javascript', 'application/javascript', 'importmap'])

const sha256 = (text: string): string => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? ''
    if (/\bsrc\s*=/i.test(attrs)) continue
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] ?? '').toLowerCase()
    if (EXECUTABLE.has(type)) hashes.push(sha256(m[2] ?? ''))
  }
  return hashes
}

export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", // Vue and VexFlow set style attributes
    "img-src 'self' data:",
    "font-src 'self' data:", // VexFlow's Bravura font is embedded as a data: URL
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/** add the CSP <meta> as the first element of <head>; non-HTML and pages that have one are unchanged */
export function addCspMeta(html: string): string {
  if (!/<head[^>]*>/i.test(html) || html.includes('http-equiv="Content-Security-Policy"')) return html
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScriptHashes(html))}">`
  return html.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
}
```

`web/nuxt.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import { addCspMeta } from './build/csp'

/** sent with every response (Nitro writes these into Vercel's build output); the CSP itself is a <meta> per page */
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'", // not allowed in <meta>
}

// Fully static site (nuxt generate). Engine + rendering run in the browser; see docs/design.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Chord Scale Maker',
      meta: [{ name: 'description', content: 'Chord-scale practice sheets from a chord chart.' }],
      // sets the dark class before first paint. A file, not inline, so it needs no CSP hash
      // (Nuxt's own inline scripts still do: see docs/design.md §9)
      script: [{ src: '/theme-init.js' }],
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: '', // NUXT_PUBLIC_SITE_URL, e.g. https://www.chordscalemaker.com
      issuesUrl: 'https://github.com/KevDog/Chord-Scale-Maker/issues/new',
    },
  },
  routeRules: { '/**': { headers: SECURITY_HEADERS } },
  nitro: {
    prerender: { routes: ['/', '/editor'] },
    hooks: {
      // hash each page's inline scripts into a CSP <meta> (build/csp.ts)
      'prerender:generate'(route) {
        if (route.fileName?.endsWith('.html') && typeof route.contents === 'string') route.contents = addCspMeta(route.contents)
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // the engine imports ../chord_scales.json and the library reads ../charts
    server: { fs: { allow: ['..'] } },
  },
})
```

- [ ] **Step 3: Verify**

Run:
```bash
cd web
npx vitest run && npm run typecheck && npm run lint && npm run generate
grep -c 'http-equiv="Content-Security-Policy"' .output/public/index.html .output/public/editor/index.html
```
Expected: `Tests 99 passed`, typecheck and lint clean, and `1` for each page.

- [ ] **Step 4: Commit**

```bash
git add web/build/csp.ts web/build/csp.test.ts web/nuxt.config.ts web/vitest.config.ts web/tsconfig.engine.json
git commit -m "feat(web): hashed CSP meta on every page; security headers via routeRules"
```

---

### Task 2: Playwright E2E, CI hardening, Dependabot, docs

**Files:**
- Create: `web/playwright.config.ts`, `web/tsconfig.e2e.json`, `web/e2e/{fixtures,library.spec,editor.spec,transposition.spec,print.spec}.ts`, `.github/dependabot.yml`
- Modify: `web/package.json`, `web/package-lock.json`, `.github/workflows/ci.yml`, `Makefile`, `.gitignore`, `docs/design.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Install Playwright:** `cd web && npm install -D -E @playwright/test@1.63.0 && npx playwright install chromium`

- [ ] **Step 2: Copy the files.** Copy `web/package.json`. It adds the `e2e` script, and its `typecheck` script now includes `tsconfig.e2e.json`; keep the lockfile npm wrote in Step 1. Then copy the e2e config, the tests, and the CI and docs files listed above.

`web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

/** browser tests against the production static build (run `npm run e2e`, which builds first) */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } } }],
  // nuxt preview serves a static build with `serve`, which takes its port from PORT (not --port)
  webServer: { command: 'npx nuxt preview', env: { PORT: String(PORT) }, port: PORT, reuseExistingServer: !process.env.CI },
})
```

`web/tsconfig.e2e.json`:

```jsonc
{
  // Playwright tests and config; code in page.addInitScript runs in the browser, hence DOM types
  "extends": "./tsconfig.engine.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"] },
  "include": ["e2e/**/*.ts", "playwright.config.ts"]
}
```

`web/e2e/fixtures.ts`:

```ts
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
```

`web/e2e/library.spec.ts`:

```ts
import { expect, staves, test } from './fixtures'

test('searches the library and opens a chart', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Chart library' })).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('zzz')
  await expect(page.getByText('No charts match')).toBeVisible()
  await page.getByPlaceholder('Search by title').fill('autumn')
  await page.getByRole('link', { name: /Autumn Leaves/ }).click()
  await expect(page).toHaveURL(/editor\?chart=autumn_leaves/)
  await expect(staves(page)).toHaveCount(78) // 39 rows, both spellings
  await expect(page.getByText('Page 1 of 8')).toBeVisible()
})

test('every page carries a hashed Content-Security-Policy', async ({ page }) => {
  for (const path of ['/', '/editor']) {
    await page.goto(path)
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+' 'sha256-[^']+'/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
  }
})

test('dark mode toggles and survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /dark mode/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})
```

`web/e2e/editor.spec.ts`:

```ts
import { expect, staves, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/editor?new=1')
  await expect(staves(page)).toHaveCount(6) // starter chart: 3 rows x 2 spellings
})

test('grid edits update the text at once', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('Ebm7b5')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 1 \| Ebm7b5/)
  const scale = page.getByLabel('Scale for Ebm7b5')
  await expect(scale.locator('option').first()).toHaveText('Default · Eb Locrian')
  await expect(scale.locator('option', { hasText: 'B Major Pentatonic' })).toHaveCount(1)
})

test('a value that would corrupt the text is rejected but stays visible', async ({ page }) => {
  const cell = page.getByLabel('chord for row 1')
  await cell.fill('C|7')
  await expect(cell).toHaveValue('C|7')
  await expect(cell).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Chart text')).not.toHaveValue(/C\|7/)
})

test('text edits update the grid and preview; unknown chords prompt for a scale', async ({ page }) => {
  const text = page.getByLabel('Chart text')
  await text.fill(`${await text.inputValue()}B | 9 | Cm7#5#9x\n`)
  await expect(staves(page)).toHaveCount(6) // the new row has no scale yet, so it isn't drawn
  await expect(page.getByText('Choose a scale', { exact: true })).toHaveCount(2)
  await page.getByLabel('Scale for Cm7#5#9x').selectOption('__other')
  await page.getByLabel('Scale name').selectOption('Altered')
  await page.getByRole('button', { name: 'Set scale' }).click()
  await expect(text).toHaveValue(/Cm7#5#9x \| C Altered/)
  await expect(staves(page)).toHaveCount(8)
})

test('the mode toggle shows one spelling or both', async ({ page }) => {
  await page.getByText('From root', { exact: true }).click()
  await expect(staves(page)).toHaveCount(3)
  await page.getByText('Both', { exact: true }).click()
  await expect(staves(page)).toHaveCount(6)
})

test('the draft is kept, and New chart starts over', async ({ page }) => {
  await page.getByLabel('chord for row 1').fill('F7')
  await page.goto('/editor')
  await expect(page.getByLabel('chord for row 1')).toHaveValue('F7')
  await page.getByRole('link', { name: 'New chart' }).click()
  await expect(page.getByLabel('chord for row 1')).toHaveValue('Dm7')
})
```

`web/e2e/transposition.spec.ts`:

```ts
import { expect, staves, test } from './fixtures'

const firstStaff = (page: import('@playwright/test').Page) => page.locator('.break-inside-avoid').first()

test('writes the sheet for a transposing instrument and remembers it', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await expect(firstStaff(page)).toContainText('C–7')
  await page.getByLabel('Instrument').selectOption('tenor-sax')
  await expect(firstStaff(page)).toContainText('D–7')
  await expect(firstStaff(page)).toContainText('D Dorian')
  await expect(page.locator('section header p').first()).toHaveText('Full Form, Alternate Changes – Tenor Sax (Bb) (Spelled from C)')
  await page.reload()
  await expect(page.getByLabel('Instrument')).toHaveValue('tenor-sax')
})

test('bass clef instruments and the start note', async ({ page }) => {
  await page.goto('/editor?chart=autumn_leaves')
  await page.getByLabel('Instrument').selectOption('trombone')
  await page.getByLabel('Start on').selectOption('B')
  await expect(page.getByText('From B', { exact: true })).toBeVisible()
  await expect(page.locator('section header p').first()).toHaveText('Full Form, Alternate Changes – Trombone (Spelled from B)')
  await expect(staves(page)).toHaveCount(78)
})
```

`web/e2e/print.spec.ts`:

```ts
import { expect, staves, test } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 39 rows in two spellings at 12 staves per letter page, even when every staff has ledger lines
for (const [instrument, start] of [
  ['concert', 'C'],
  ['trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start})`, async ({ page }) => {
    await page.goto('/editor?chart=autumn_leaves')
    await page.getByLabel('Instrument').selectOption(instrument)
    await page.getByLabel('Start on').selectOption(start)
    await expect(staves(page)).toHaveCount(78)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden() // editor hidden in print
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(8)
  })
}
```

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
permissions:
  contents: read
# actions are pinned to commit SHAs (tags can move); Dependabot proposes updates
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
        with:
          python-version: '3.12'
      - run: pip install pytest
      - run: python -m pytest tests
  engine:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run generate
      # gate on what ships to browsers (vue, vexflow); build tooling advisories are reported, not blocking
      - run: npm audit --omit=dev --audit-level=high
      - run: npm audit --audit-level=high || true
  e2e:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - if: failure()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: playwright-report
          path: web/playwright-report
          retention-days: 7
```

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /web
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 3: Verify**

Run: `make test && make lint && make e2e`
Expected: `12 passed`, `Tests 99 passed`, lint clean, and Playwright `12 passed`.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/playwright.config.ts web/tsconfig.e2e.json web/e2e .github/workflows/ci.yml .github/dependabot.yml Makefile .gitignore docs/design.md README.md CLAUDE.md
git commit -m "test: Playwright E2E in CI (fails on CSP violations); SHA-pinned actions; Dependabot"
```

---

## After the tasks (controller)

1. Add a Vercel Firewall rate-limit rule. Static pages load about 15 requests each, so allow 600 requests per minute per IP, and answer anything above that with 429.
2. Open the PR. Then confirm CI is green, including the new e2e job, and the Vercel preview.
3. After merge, check the production headers with `curl -I`.
