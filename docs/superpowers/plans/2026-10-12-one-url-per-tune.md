# One URL per tune: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/song/<name>` is the one prerendered, indexable page per library tune; `/tunes/<name>` goes (301 to the song).

**Architecture:** a pure head builder gives a library song's title, description and JSON-LD; the song page uses it (and keeps `noindex` for `/song` itself) and prerenders the tune's heading as the editor's loading fallback. The library links titles to the song; the sitemap lists song paths; the tune page and its helpers are deleted.

**Tech Stack:** Nuxt 4 (prerendered, Nitro `routeRules`), Vue 3, TypeScript (strict), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-one-url-per-tune-design.md` (issue #198).

## Global Constraints

- CSP unchanged: JSON-LD stays an `application/ld+json` data block via `jsonLd()` (its `<` escaping kept).
- `/song`, `?mine=`, `?new=1`, share links: `noindex`. Library songs: no `robots` meta.
- Song title: `tuneTitle(summary)` (`<Title> (<Composer>): changes and chord scales`); description: `tuneDescription(summary)`.
- `/tunes/**` → `/song/**`, 301.
- `make test` after each task; `make lint`, `make e2e` at the end. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name; PR body `Closes #198`.

## Review Focus

- **A library address with a query** (`/song/autumn-leaves?mine=x`, `#s=`): served the indexable file, but its canonical is the clean path — Task 4 e2e asserts the canonical.
- **An unknown song** (`/song/no-such-tune`): still goes to the library, no indexable page — Task 4 e2e (moved from `/tunes/no-such-tune` in `not-found.spec.ts`).
- **Two tunes with the same title** (the unique-title check): titles carry the composer — the sitemap e2e checks every song's title is unique.
- **The fallback heading flashing** before the editor: the editor replaces it in place; no layout jump bigger than today's "Loading editor…" — check by eye in Task 2 Step 6.
- **The browser tab title after edits** still follows the chart, not the prerendered title — existing `library.spec.ts` "its tab names the chart" stays green.

---

### Task 1: the song head builder

**Files:** Create `web/app/utils/songHead.ts` (in its own file: `library.ts` imports `site.ts`, so `site.ts` can't import `findChart`); Test `web/test/songHead.test.ts`, `web/test/structuredData.test.ts`; Modify `web/test/site.test.ts` (delete the "live at /tunes/" test).

**Interfaces:**
- Produces: `export function songHead(slug: string): Readonly<{ head: PageHead; ld: string; title: string; composer: string }> | null` — null when the slug isn't a library chart. `head` has no `robots`; `ld` is `jsonLd([tuneLd(summary, songPath(slug)), breadcrumbLd(summary, songPath(slug))])`.

- [ ] **Step 1: Failing test** (`web/test/songHead.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { PAGE_HEAD } from '~/utils/site'
import { songHead } from '~/utils/songHead'

describe('songHead', () => {
  it("gives a library song its title, description and structured data, indexable", () => {
    const h = songHead('blue-trane')
    expect(h?.head).toEqual({ title: 'Blue Trane (John Coltrane): changes and chord scales', description: expect.stringContaining('Blue Trane') })
    expect(h?.head).not.toHaveProperty('robots')
    expect(h?.title).toBe('Blue Trane')
    expect(h?.composer).toBe('John Coltrane')
    const ld = JSON.parse(h?.ld ?? '[]') as { '@type': string; url?: string }[]
    expect(ld.map((d) => d['@type'])).toEqual(['MusicComposition', 'BreadcrumbList'])
    expect(ld[0]?.url).toBe('https://www.chordscalemaker.com/song/blue-trane')
  })
  it('is null for anything that is not a library chart', () => {
    expect(songHead('no-such-tune')).toBeNull()
  })
  it('keeps /song itself out of search', () => {
    expect(PAGE_HEAD.song.robots).toBe('noindex')
  })
})
```

- [ ] **Step 2:** `cd web && npx vitest run test/songHead.test.ts` → FAIL.

- [ ] **Step 3: Implement** `web/app/utils/songHead.ts`:

```ts
import { tuneDescription, tuneSummary } from '@chord-scale-maker/engine'
import { findChart } from './library'
import { type PageHead, songPath, tuneTitle } from './site'
import { breadcrumbLd, jsonLd, tuneLd } from './structuredData'

/** a library song's head (indexable: the one page per tune) and its heading, or null for any other /song address */
export function songHead(slug: string): Readonly<{ head: PageHead; ld: string; title: string; composer: string }> | null {
  const chart = findChart(slug)
  if (!chart) return null
  const summary = tuneSummary(chart.text)
  const path = songPath(slug)
  return {
    head: { title: tuneTitle(summary), description: tuneDescription(summary) },
    ld: jsonLd([tuneLd(summary, path), breadcrumbLd(summary, path)]),
    title: summary.title,
    composer: summary.composer,
  }
}
```
Update `structuredData.test.ts`'s `PATH` to `/song/blue-trane` and its expected URLs.

- [ ] **Step 4:** PASS; `make test`. **Step 5:** commit, "songHead: a library song's title, description and structured data (#198)".

---

### Task 2: the song page and the library

**Files:** Modify `web/app/pages/song/[[slug]].vue`, `web/app/pages/index.vue`, `web/app/utils/site.ts` (delete `tunePath`), `web/app/utils/library.ts` (delete `TUNE_PATHS`), `web/app/utils/sitemap.ts` (delete `tunePathsOf`; `sitemapPaths(songPaths)`), `web/nuxt.config.ts`; Delete `web/app/pages/tunes/[slug].vue`; Test `web/test/sitemap.test.ts`, `web/test/library.test.ts`, `web/test/index.test.ts`.

**Interfaces:** consumes `songHead`. Produces `sitemapPaths(songPaths: readonly string[])` (same shape, song paths); `chartSlugsOf` stays.

- [ ] **Step 1: Failing tests:**
  - `sitemap.test.ts`: `sitemapPaths(['/song/a'])` → `['/', '/help', '/functions', '/about', '/contact', '/privacy', '/song/a']`; the `sitemapXml` example uses `/song/blue-trane`; delete the `tunePathsOf` test.
  - `library.test.ts`: replace the `tunePath`/`TUNE_PATHS`/`tunePathsOf` assertions with: every `LIBRARY` slug's `songPath` is in `sitemapPaths(chartSlugsOf(files).map(songPath))`, and `findChart` finds each by slug.
  - `index.test.ts`: each library row's title link has `href="/song/<slug>"`; there's no link named `Open … in the editor`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Library page** (`index.vue`): the title cell's link → `songPath(chart.slug)`; delete the Editor header cell and the Open cell; intro → `Pick a tune to open its practice sheets{{ myCharts ? ', or start a new chart' : '' }}. Charts are written in concert pitch.`; drop the `tunePath` import.
- [ ] **Step 4: Song page** (`song/[[slug]].vue`):

```ts
const song = songHead(slug()) // null for /song, ?mine=, ?new=1, share links
useSeoMeta(seoMeta(song?.head ?? PAGE_HEAD.song))
if (song) useHead({ script: [{ type: 'application/ld+json', innerHTML: song.ld }] })
```
replacing `useSeoMeta(seoMeta(PAGE_HEAD.song))` (keep the client title override after it). Fallback:

```vue
    <template #fallback>
      <div v-if="song" class="space-y-1">
        <UiHeading>{{ song.title }}</UiHeading>
        <UiText v-if="song.composer">{{ song.composer }}</UiText>
        <UiText class="text-zinc-500">Loading the practice sheets…</UiText>
      </div>
      <p v-else class="text-zinc-500">Loading editor…</p>
    </template>
```
(`UiHeading` renders an `<h1>`; check, and pass `:level="1"` if it needs it.)
- [ ] **Step 5: Sitemap, prerender, redirect, deletions.** `sitemap.ts`: delete `tunePathsOf` and its `tunePath` import; `sitemapPaths` parameter renamed `songPaths`, docstring "…then each library song". `nuxt.config.ts`: `const SITEMAP_PATHS = sitemapPaths(CHART_SLUGS.map(songPath))`; `prerender.routes: [...SITEMAP_PATHS, '/song', '/sitemap.xml']` (comment: "the library songs are in the sitemap"); `routeRules` adds `'/tunes/**': { redirect: { to: '/song/**', statusCode: 301 } }`. Delete `pages/tunes/[slug].vue`, `tunePath` (`site.ts`), `TUNE_PATHS` (`library.ts`).
- [ ] **Step 6:** `make test`, `make lint`; `make preview`, open `/song/autumn-leaves` with JavaScript disabled (DevTools → Disable JavaScript) and enabled; check the heading, then the sheets replacing it; `/tunes/autumn-leaves` lands on the song.
- [ ] **Step 7:** commit, "One URL per tune: /song/<name> is the indexable page; /tunes goes (#198)".

---

### Task 3: engine and notes

**Files:** Modify `engine/src/tune.ts` (drop `rows`, `TuneRow`, the `buildChanges`/`CONCERT` imports if unused), `engine/src/__tests__/tune.test.ts`, `engine/scripts/analyse.ts` (headings), `CLAUDE.md`, `engine/src/__tests__/__snapshots__/api.test.ts.snap` (only if a runtime name goes; `TuneRow` is a type).

- [ ] **Step 1:** delete the two row tests in `tune.test.ts` ("gives one row per chord…", "includes a repeated section…"); remove `rows` from `TuneSummary` and `tuneSummary`; `TuneRow` goes. `npx vitest run` in `engine` → PASS; `make test` (typecheck finds any reader left; there should be none after Task 2).
- [ ] **Step 2:** `analyse.ts`: `'  Tune page:'` → `'  Song page:'`; `Tune pages: … complete` → `Song pages: … complete`; `tuneGaps`' doc comments say "song page". `CLAUDE.md` "Make a chart": "(its Tune page section must show no gaps…)" → "(its Song page section must show no gaps…)".
- [ ] **Step 3:** `make test`; `make golden` shows no diff. **Step 4:** commit, "Song pages: drop the tune page's rows; analyse reports the song page (#198)".

---

### Task 4: browser tests and design notes

**Files:** Modify `web/e2e/seo.spec.ts`, `web/e2e/library.spec.ts`, `web/e2e/not-found.spec.ts`, `docs/design.md`.

- [ ] **Step 1: `seo.spec.ts`:** import `songPath` (not `tunePath`); the sitemap test expects `${SITE_URL}${songPath(slug)}` for every slug (the rest of it unchanged). Replace the no-JS tune page test with:

```ts
  test('a song is all there in its HTML: heading, composer, structured data, canonical, indexable', async ({ page }) => {
    await page.goto('/song/blue-trane')
    await expect(page.getByRole('heading', { name: 'Blue Trane', level: 1 })).toBeVisible()
    await expect(page.getByText('John Coltrane', { exact: true })).toBeVisible()
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/blue-trane`)
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0)
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent()) ?? '[]') as { '@type': string }[]
    expect(ld.map((d) => d['@type'])).toContain('MusicComposition')
  })
```
and add (with JavaScript on):

```ts
test('/song itself, a new chart and a share link stay out of search; a query keeps the clean canonical', async ({ page }) => {
  for (const url of ['/song?new=1', '/song']) {
    await page.goto(url)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  }
  await page.goto('/song/autumn-leaves?mine=x')
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/autumn-leaves`)
})

test('old tune pages move to the song', async ({ request }) => {
  const res = await request.get('/tunes/autumn-leaves', { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(res.headers().location).toMatch(/\/song\/autumn-leaves$/)
})
```
- [ ] **Step 2: `library.spec.ts`:** the tests that click a title and expect `/tunes/<name>` (lines ~18, ~28) now expect `/song/<name>$` and the sheets (`staves(page)` visible); remove clicks on "Open practice sheets" and on `Open <title> in the editor` (that link is gone: click the title). Fold #180's href pin here if that cleanup PR hasn't landed: the title link's `href` is `/song/<name>`.
- [ ] **Step 3: `not-found.spec.ts`:** the `/tunes/no-such-tune` case becomes `/song/no-such-tune` (it lands on the library, as an unknown song does today; keep whatever that file asserts for unknown songs).
- [ ] **Step 4:** `make e2e` green. **Step 5: `docs/design.md`:** the pages list (no tune pages), the SEO section (song pages carry the head and JSON-LD; the fallback heading; `/tunes` 301), the sitemap. **Step 6:** commit, "Browser tests and design notes for one URL per tune (#198)".
