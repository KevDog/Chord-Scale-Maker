# SEO and Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A search for a library tune ("Blue Trane lead sheet", "Autumn Leaves chord scales") returns that tune's page on Chord Scale Maker. Every library chart gets a prerendered, indexable page, and the site gains a sitemap, robots.txt, canonical URLs, per-page titles and descriptions, and structured data. Nothing is added that tracks visitors, sets cookies or loads from a third-party origin.

**Why:** Today the 242 library charts live only at `/song?chart=<slug>`. `/song` is prerendered once, without a query, and its content is inside `<ClientOnly>`, so a crawler receives "Loading editor…" under the title "Editor · Chord Scale Maker" for every chart. There is no `robots.txt`, no `sitemap.xml`, no canonical link, and every page shares the site description and the `og:title` "Chord Scale Maker".

**Architecture:** A pure engine function, `tuneSummary(text)`, turns a chart into what a tune page shows (heading fields and one row per chord: section, bar, chord, numeral, scale, all in concert pitch), using `parseChart` and `buildChanges(doc, CONCERT)`. The app adds `pages/tunes/[slug].vue`, rendered on the server and prerendered for every chart in `LIBRARY`, with an "Open practice sheets" button into the unchanged editor (`/song?chart=<slug>`). `app.vue` sets the title template and canonical; pages set their own head with `useSeoMeta`. A prerendered Nitro route emits `sitemap.xml`; `robots.txt` is a static file. JSON-LD is built by pure functions in `app/utils/structuredData.ts` and emitted as `application/ld+json` data blocks, which CSP `script-src` does not govern.

**Tech Stack:** Nuxt 4 (prerendered pages, Unhead `useHead`/`useSeoMeta`), Vue 3 `<script setup>`, TypeScript strict, Tailwind, Catalyst components in `web/app/components/ui/`, Vitest, Playwright.

**Background:** Project doc `claude/seo-discoverability.md` (the research behind this plan); [Nuxt 4: SEO and Meta](https://nuxt.com/docs/4.x/getting-started/seo-meta).

## Global Constraints

- **Privacy:** no cookies, no new analytics, no third-party scripts, styles, fonts, images or frames. The CSP's origins do not change. Search Console and Bing Webmaster Tools are verified by DNS TXT record, never by a tag or file on the site.
- No feature flag: tune pages, head tags, sitemap and robots ship on (they change no existing behaviour of the editor).
- No new runtime `dependencies`, and no new dev dependencies (no `@nuxtjs/sitemap`, `@nuxtjs/robots`, `nuxt-schema-org` or `nuxt-og-image`): each piece here is a few dozen lines.
- Pages run under the hashed CSP (`web/build/csp.ts`): no inline *executable* script of our own, no `eval`. JSON-LD is `type="application/ld+json"`, which `inlineScriptHashes` already skips (not in `EXECUTABLE`).
- JSON-LD text is escaped so a chart's title can never close the `<script>`: `JSON.stringify(data).replace(/</g, '\\u003c')`.
- `engine/` stays free of Vue/DOM imports; `tuneSummary` is pure and lives in the engine.
- Tune pages show only what the library already publishes: title, composer, heading fields, chords, numerals and scales. No melody.
- Canonical URLs are `https://www.chordscalemaker.com` + the path, never the query or fragment (share links stay private).
- Tune paths use hyphens: `/tunes/blue-trane` for the slug `blue_trane` (search engines read hyphens as word breaks). `tunePath(slug)` is the only place this mapping lives, and a test proves it is one-to-one over the library.
- Build screens from the Catalyst components (`UiHeading`, `UiSubheading`, `UiText`, `UiTable*`, `UiButton`, `UiTextLink`) and the Help page's patterns.
- Vitest: `cd web && npx vitest run <file>`, or `cd engine && npx vitest run <file>`. Gates: `make test`, `make lint`, `make e2e`, `make golden` from the repo root.
- Stage files by name; never `git add -A` (iCloud `* 2.*` copies sit untracked in the tree). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pure logic gets a failing test first (TDD); page layout may be e2e-gated.

## Review Focus

1. **JavaScript off:** `/tunes/blue-trane`'s HTML, fetched with JavaScript disabled, contains the title, composer, key, form and every chord row, and an `<a href="/song?chart=blue_trane">`. → Task 10 e2e with `javaScriptEnabled: false`.
2. **A title with markup:** a chart titled `</script><script>alert(1)</script>` produces valid JSON-LD and no executable script. → Task 6 unit test of `jsonLd()`.
3. **Unknown tune:** `/tunes/no-such-tune` returns 404 through `app/error.vue` (not Nuxt's built-in error page, which the CSP blocks). → Task 10 e2e, extending `not-found.spec.ts`.
4. **Slug collisions:** two charts whose slugs map to the same hyphenated path fail the build's test, not production. → Task 3 unit test over `LIBRARY`.
5. **Canonical never leaks a share link:** on `/song?chart=x#s=…` and `/song?mine=…` the canonical is `…/song` and the page is `noindex`. → Task 2 unit test and Task 9 e2e.
6. **Sitemap agrees with the pages:** every URL in `sitemap.xml` is prerendered, returns 200, is not `noindex`, and equals its own canonical; every library chart is listed. → Task 10 e2e.
7. **A new chart, added the usual way, needs no SEO step to get its page:** dropping a file into `engine/charts/` gives it a tune page, a sitemap entry and a library link with no list edited anywhere; and a chart missing the data its page needs fails `make test` with a message naming the chart and the field. → Task 9 unit tests.

---

## File map

| File | Change | Task |
| --- | --- | --- |
| `web/app/utils/site.ts` | new: `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, `canonicalUrl(path)` | 1 |
| `web/nuxt.config.ts` | import from `site.ts`; drop static `og:title`/`og:description`; prerender tune routes, `/sitemap.xml` | 1, 4, 7 |
| `web/app/app.vue` | `titleTemplate`, canonical, `og:url` | 1 |
| `web/app/pages/{about,contact,functions,help,privacy,index}.vue` | `useSeoMeta` with own title and description | 2 |
| `web/app/pages/song.vue` | `robots: noindex`; title from the chart in the browser | 2 |
| `engine/src/tune.ts` | new: `TuneSummary`, `tuneSummary(text)`, `tuneDescription(summary)` | 3 |
| `engine/src/index.ts`, `engine/src/__tests__/api.test.ts` | export and snapshot | 3 |
| `engine/src/__tests__/tune.test.ts` | new | 3 |
| `web/app/utils/library.ts` | `tunePath(slug)`, `findTune(pathSlug)` | 3 |
| `web/test/library.test.ts` | `tunePath` round trip, no collisions | 3 |
| `web/app/pages/tunes/[slug].vue` | new | 4 |
| `web/app/pages/index.vue` | library rows link to `tunePath` | 5 |
| `web/app/utils/structuredData.ts` | new: `websiteLd`, `webAppLd`, `tuneLd`, `breadcrumbLd`, `jsonLd` | 6 |
| `web/test/structuredData.test.ts` | new | 6 |
| `web/build/csp.test.ts` | ld+json is not hashed | 6 |
| `web/server/routes/sitemap.xml.ts` | new, prerendered | 7 |
| `web/app/utils/sitemap.ts`, `web/test/sitemap.test.ts` | new: `sitemapXml(urls)` | 7 |
| `web/public/robots.txt` | new | 7 |
| `engine/src/chart.ts` | `aka` meta key (8); `kind` meta key (9) | 8, 9 |
| `engine/src/tune.ts` | `tuneGaps(doc)`; `kind` in `TuneSummary` | 9 |
| `engine/src/__tests__/libraryMeta.test.ts` | new: every library chart has its page's data | 9 |
| `engine/scripts/analyse.ts` | a "Tune page" section in the report; `--all` summary count | 9 |
| `engine/charts/*.txt` | backfill the 13 charts without `composer:`/`style:`/`form:` | 9 |
| `web/app/utils/library.ts`, `web/test/library.test.ts` | `TUNE_PATHS`, shared by prerender and sitemap | 9 |
| `web/e2e/seo.spec.ts` | new | 10 |
| `web/e2e/not-found.spec.ts`, `web/e2e/library.spec.ts` | unknown tune; library links | 5, 10 |
| `docs/design.md`, `CLAUDE.md`, `README.md` | docs | 11 |

---

### Task 1: Site constants, title template and canonical

**Files:**
- Create: `web/app/utils/site.ts`
- Modify: `web/nuxt.config.ts`, `web/app/app.vue`
- Create: `web/test/site.test.ts`

**Interfaces:**
- Produces: `SITE_URL = 'https://www.chordscalemaker.com'`, `SITE_NAME = 'Chord Scale Maker'`, `SITE_DESCRIPTION` (the current `DESCRIPTION`), `canonicalUrl(path: string): string`.

- [ ] **Step 1: Test `canonicalUrl` first**

Cases: `'/'` → `https://www.chordscalemaker.com/`; `'/help'` → `…/help`; `'/help/'` → `…/help` (no trailing slash except the root); `'/song?chart=x#s=abc'` → `…/song` (query and fragment dropped).

- [ ] **Step 2: Run it to see it fail**, then implement `site.ts`.

- [ ] **Step 3: `nuxt.config.ts` imports `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`** from `./app/utils/site` in place of its local constants. Remove the static `og:title` and `og:description` from `app.head.meta` (pages now set them); keep `og:type`, `og:site_name`, the image tags, `twitter:card` and the default `description` as a fallback.

- [ ] **Step 4: `app.vue`**

```ts
const route = useRoute()
useHead({
  titleTemplate: (t) => (t && t !== SITE_NAME ? `${t} · ${SITE_NAME}` : SITE_NAME),
  link: [{ rel: 'canonical', href: () => canonicalUrl(route.path) }],
})
useSeoMeta({ ogUrl: () => canonicalUrl(route.path) })
```

- [ ] **Step 5:** `make test`, then commit: "Head: title template, canonical URL and og:url on every page".

---

### Task 2: Each page's own title and description; `/song` is `noindex`

**Files:**
- Modify: `web/app/pages/about.vue`, `contact.vue`, `functions.vue`, `help.vue`, `privacy.vue`, `index.vue`, `song.vue`

- [ ] **Step 1:** Replace each `useHead({ title: '… · Chord Scale Maker' })` with `useSeoMeta({ title, description, ogTitle, ogDescription })`. Titles without the suffix (the template adds it). Descriptions are one formal sentence, 120–160 characters, written from the page's own content:
  - `/` (title omitted: the template gives "Chord Scale Maker"): the library and what the sheets are.
  - `/help`: "How to use Chord Scale Maker: the Changes and Scales sheets, practice, editing and saving charts, and printing."
  - `/functions`: how the engine chooses a scale for each chord, its functions and rules.
  - `/about`, `/contact`, `/privacy`: one sentence each.
- [ ] **Step 2:** `song.vue`: `useSeoMeta({ title: 'Editor', robots: 'noindex' })`. In the browser, once the chart is known, the title becomes the chart's title (`Blue Trane · Editor`), so tabs and history read well; this has no effect on search.
- [ ] **Step 3:** A unit test (`web/test/pages-head.test.ts`, or extend `index.test.ts`) mounts each page and asserts a unique, non-empty title and a description of 50–160 characters.
- [ ] **Step 4:** `make test`, commit: "Head: a title and description for each page; the editor is noindex".

---

### Task 3: `tuneSummary` in the engine, and `tunePath` in the app

**Files:**
- Create: `engine/src/tune.ts`, `engine/src/__tests__/tune.test.ts`
- Modify: `engine/src/index.ts`, `engine/src/__tests__/api.test.ts` (snapshot)
- Modify: `web/app/utils/library.ts`, `web/test/library.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TuneRow = Readonly<{ section: string; bar: string; chord: string; numeral: string; scale: string | null }>
  export type TuneSummary = Readonly<{
    title: string; subtitle: string; composer: string; aka: readonly string[]
    key: string; keyLabel: string; style: string; form: string; time: string; source: string
    rows: readonly TuneRow[]
  }>
  export function tuneSummary(text: string): TuneSummary
  export function tuneDescription(t: TuneSummary): string
  ```
  `rows` come from `buildChanges(parseChart(text).value, CONCERT)`, one per chord (`bar.at`, `chord.text`, `chord.numeral`, `chord.scale`), repeats included as drawn. `aka` is `[]` until Task 8.
- `tuneDescription` builds one sentence, at most 160 characters, dropping clauses from the end to fit: "Chord-scale practice sheets for Blue Trane by John Coltrane, a 12-bar blues in E♭: the changes as a study lead sheet with guide tones, and a scale for every chord, for your instrument."
- `web/app/utils/library.ts`: `tunePath(slug) = '/tunes/' + slug.replaceAll('_', '-')`, `findTune(pathSlug)` finds the chart whose `tunePath` ends with it.

- [ ] **Step 1: Tests first.**
  - `tuneSummary` over `blue_trane.txt`: title "Blue Trane", composer "John Coltrane", key label E♭ major (as `keyLabel` gives it), form "A, 12 bars", first row `{ section: 'A', bar: '1', chord: 'Eb7#9', numeral: <as buildChanges gives>, scale: <as buildChanges gives> }`. Assert against `buildChanges`'s output, not hand-typed scales (design rule: never hand-type note lists or scale results).
  - A chart with no composer or form: no "by" clause, no empty commas, in both the summary and the description.
  - `tuneDescription` is ≤ 160 characters for every chart in `charts/` (loop over the folder).
  - `tunePath`/`findTune` round-trip every library slug, and the paths are all distinct.
- [ ] **Step 2:** See them fail; implement; see them pass.
- [ ] **Step 3:** Export from `engine/src/index.ts`; update the API snapshot; `make test`; `make golden` (expected: no fixture change).
- [ ] **Step 4:** Commit: "Engine: tuneSummary, a chart's heading and changes as text, for tune pages".

---

### Task 4: The tune page, prerendered for every library chart

**Files:**
- Create: `web/app/pages/tunes/[slug].vue`
- Modify: `web/nuxt.config.ts` (`nitro.prerender.routes`)

- [ ] **Step 1: The page.** Server-rendered (no `<ClientOnly>`). `findTune(route.params.slug)`; none → `throw createError({ statusCode: 404, statusMessage: 'Tune not found' })`.
  - The small "Library" tab label (as on the home page), `UiHeading` with the title, then composer · style · key · form · time, and the source.
  - `UiButton color="note" :href="'/song?chart=' + chart.slug"` "Open practice sheets", and a short line saying the sheets are written for your instrument, with the Changes and the Scales.
  - `UiSubheading` "The changes", then a `UiTable` (Section, Bar, Chord, Function, Scale) from `summary.rows`. A section's name shows on its first row only.
  - A closing line linking to `/functions` ("How the scales are chosen") and back to the library.
  - Head: `useSeoMeta({ title: `${title} (${composer}): changes and chord scales` (no parentheses without a composer), description: tuneDescription(summary), ogTitle, ogDescription })`.
- [ ] **Step 2: Prerender.** In `nuxt.config.ts`, add every tune path to `nitro.prerender.routes`, read from the engine's `charts/` folder at config time (`readdirSync(join(ENGINE_DIR, 'charts'))`, skipping sync copies as `isSyncCopy` does, mapped through the same hyphen rule; import `tunePath` if the config can, else a shared pure helper in `site.ts`).
- [ ] **Step 3:** `make preview`; open `/tunes/blue-trane` and `/tunes/autumn-leaves`; check light and dark, 390px wide, and print.
- [ ] **Step 4:** Commit: "Tune pages: each library chart's heading and changes, prerendered at /tunes/<name>".

---

### Task 5: The library links to tune pages

**Files:**
- Modify: `web/app/pages/index.vue`, `web/e2e/library.spec.ts`

- [ ] **Step 1:** Each library row's title links to `tunePath(chart.slug)`. Add a second, compact link in the row, "Open", straight to `/song?chart=<slug>`, so a returning user is still one click from the editor. (Alternative for the user to choose at review: keep the title going to the editor and add "Details" to the tune page. Either way, every tune page is linked from the home page.)
- [ ] **Step 2:** Update `library.spec.ts` for the new link targets; `MyChartsList` is unchanged (saved charts are private and have no tune page).
- [ ] **Step 3:** `make test`, `make e2e`, commit: "Library: each tune links to its page, and straight to the editor".

---

### Task 6: Structured data (JSON-LD)

**Files:**
- Create: `web/app/utils/structuredData.ts`, `web/test/structuredData.test.ts`
- Modify: `web/app/pages/index.vue`, `web/app/pages/tunes/[slug].vue`, `web/build/csp.test.ts`

**Interfaces:**
- `websiteLd()`: `{ '@context': 'https://schema.org', '@type': 'WebSite', name, url }` (Google uses it for the site name in results).
- `webAppLd()`: `WebApplication`, `applicationCategory: 'EducationalApplication'`, `operatingSystem: 'Any'`, `offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }`, `browserRequirements`. No rating is invented; the app rich result needs one, so none is expected.
- `tuneLd(summary, path)`: `MusicComposition` with `name`, `alternateName` (aka), `composer: { '@type': 'Person', name }` (omitted without one), `musicalKey`, `url`.
- `breadcrumbLd(summary, path)`: `BreadcrumbList`: Library (`/`) › the tune.
- `jsonLd(data)`: `JSON.stringify(data).replace(/</g, '\\u003c')`.
- Pages: `useHead({ script: [{ type: 'application/ld+json', innerHTML: jsonLd([...]) }] })`.

- [ ] **Step 1: Tests first:** each builder's shape; no `composer` key without a composer; `jsonLd` of a title containing `</script>` contains no `<`.
- [ ] **Step 2:** `csp.test.ts`: a page with an `application/ld+json` block gets no hash for it (it already passes; this pins the behaviour).
- [ ] **Step 3:** Implement; add to the home and tune pages; `make test`.
- [ ] **Step 4:** Validate one tune page and the home page in Google's Rich Results Test (paste the prerendered HTML; no deployment needed).
- [ ] **Step 5:** Commit: "Structured data: the site, the app, and each tune as a composition with breadcrumbs".

---

### Task 7: `sitemap.xml` and `robots.txt`

**Files:**
- Create: `web/app/utils/sitemap.ts`, `web/test/sitemap.test.ts`, `web/server/routes/sitemap.xml.ts`, `web/public/robots.txt`
- Modify: `web/nuxt.config.ts` (prerender `/sitemap.xml`)

- [ ] **Step 1: Test `sitemapXml(paths)` first:** valid XML with the sitemap namespace, each `<loc>` is `canonicalUrl(path)`, `&` and `<` escaped, no duplicates.
- [ ] **Step 2:** Implement. The route lists `/`, `/help`, `/functions`, `/about`, `/contact`, `/privacy` and every `tunePath`; never `/song` or `/ui`. No `lastmod`: Vercel's clone is shallow, so per-chart commit dates aren't reliable at build, and a wrong `lastmod` is worse than none.
- [ ] **Step 3:** Prerender it (`nitro.prerender.routes` gets `/sitemap.xml`), so it ships as a static file and `web/server/` still runs only the contact form at request time. Set `Content-Type: application/xml`.
- [ ] **Step 4:** `public/robots.txt`:
  ```
  User-agent: *
  Allow: /

  Sitemap: https://www.chordscalemaker.com/sitemap.xml
  ```
  `/song` is not disallowed: its `noindex` must be readable.
- [ ] **Step 5:** `npm run check:headers` still passes (the security headers apply to both files). Commit: "Sitemap and robots.txt".

---

### Task 8: Alternate titles (`aka:`)

**Files:**
- Modify: `engine/src/chart.ts` (`MetaKey`, `META_KEYS`), `engine/src/tune.ts`, `README.md` (chart format), `web/app/pages/help.vue` (the chart header list)
- Modify: tests for both

- [ ] **Step 1: Test first:** `aka: Blue Train; Blue Trane (alt take)` parses to two names (`;` separates, since titles may contain commas); `serializeChart` round-trips it; `tuneSummary(...).aka` has both.
- [ ] **Step 2:** Implement. The tune page shows "Also known as …" under the heading; the description adds "(also Blue Train)" when it fits in 160 characters; `tuneLd` uses `alternateName`. Library search (`searchLibrary`) also matches aka names.
- [ ] **Step 3:** Add `aka:` to the charts that need one (start with `blue_trane.txt`: "Blue Train"; others as found). Then `make golden` and read the diff (expected: no scale change).
- [ ] **Step 4:** Commit: "Charts: an aka: header for alternate titles, on tune pages and in search".

---

### Task 9: New tunes get their page and their data automatically

A chart is added to the library the usual way ("Make a chart for <tune>" in CLAUDE.md, or a chart request from the contact form): a file in `engine/charts/`, then `npm run analyse -- charts/<tune>.txt --save`, then `make golden`. This task makes that same flow produce a complete tune page, with no separate SEO step to remember, and makes CI refuse a chart that lacks the data its page needs.

Charts opened or imported by a visitor (My charts, an opened `.txt`, a share link) stay in that browser and are private: they get no tune page, no sitemap entry and no head data beyond the editor's, by design.

**Files:**
- Modify: `engine/src/chart.ts` (`kind` meta key), `engine/src/tune.ts` (`tuneGaps`, `kind`), `engine/scripts/analyse.ts`
- Create: `engine/src/__tests__/libraryMeta.test.ts`
- Modify: `web/app/utils/library.ts` (`TUNE_PATHS`), `web/nuxt.config.ts`, `web/server/routes/sitemap.xml.ts`, `web/test/library.test.ts`
- Modify: the 13 charts listed in Step 4

**Interfaces:**
- `kind: tune | form | exercise` (chart header, default `tune`). A *form* is a generic progression with no composer (F Blues, Rhythm Changes); an *exercise* is a study chart (Modes of the Major Scale). Forms and exercises still get tune pages ("F jazz blues changes" is a real search) but no composer, and `tuneLd` gives them `CreativeWork` instead of `MusicComposition`.
- `tuneGaps(doc: ChartDoc): readonly string[]`: what the chart's page is missing, as plain sentences ("no composer: a tune's page needs one (or write kind: form)"). Required: `title`, `key`; `composer` when `kind` is `tune`; `style` and `form` for every kind. Advisory (reported, never failing): no `source:`; a title with a well-known alternate and no `aka:` cannot be detected, so the report reminds the author to consider one when `aka:` is absent.
- `TUNE_PATHS: readonly string[]` in `web/app/utils/library.ts`, `LIBRARY.map((c) => tunePath(c.slug))`, the single list both the prerender routes and the sitemap use.

- [ ] **Step 1: One source for every list (tests first).**
  - `web/test/library.test.ts`: `TUNE_PATHS` has one entry per file in the engine's `charts/` (sync copies excluded), and equals the paths in `sitemapXml`'s output.
  - Task 4 and Task 7 already derive from `charts/`; replace their own `readdirSync`/mapping with `TUNE_PATHS` (in `nuxt.config.ts`, import it, or a pure helper both can import, if the config cannot load app code with the `#charts` alias). After this step no file lists tunes by hand: adding `charts/x.txt` and rebuilding is enough for the page, the sitemap and the library row.
- [ ] **Step 2: `tuneGaps` (tests first).** Cases: a complete tune → `[]`; no composer with `kind: tune` (or no `kind:`) → one gap; `kind: form` without composer → `[]`; an unknown `kind:` value → a parse diagnostic, as other bad header values get.
- [ ] **Step 3: The library gate.** `engine/src/__tests__/libraryMeta.test.ts` loops over `charts/*.txt` and expects `tuneGaps` to be empty for each, failing with `<file>: <gap>` lines, so a new chart without its data fails `make test` and CI, with the fix in the message.
- [ ] **Step 4: Backfill the library** so the gate passes. Today 13 charts have no `composer:`, `style:` or `form:`:
  - Tunes, which need all three (and `source:` where the chart came from a book): `impressions.txt` (John Coltrane), `maiden_voyage.txt` (Herbie Hancock), `milestones.txt` (Miles Davis), `so_what.txt` (Miles Davis). Confirm each composer, style and form from the chart's source before writing it.
  - Forms (`kind: form`, plus `style:` and `form:`): `bb_blues`, `bb_jazz_blues`, `bb_bird_blues`, `f_blues`, `f_jazz_blues`, `f_bird_blues`, `rhythm_changes`.
  - Exercises (`kind: exercise`, plus `style:` and `form:`): `modes_of_major`, `modes_of_melodic_minor`.
  - Run `npm run analyse -- --all --save` (header comments only) and `make golden`: expected no scale change. Read the diff.
- [ ] **Step 5: Report it where charts are made.** In `engine/scripts/analyse.ts`, after a chart's analysis, print a "Tune page" section: each `tuneGaps` line, the advisory lines, and the page's title and description exactly as they will appear (`tuneDescription`), with its length. `--all` ends its summary with "Tune pages: N complete, M missing data". `--quiet` still prints gaps (they fail the build). This is the "on import" check: the person or agent adding a chart sees what its search listing will say before committing.
- [ ] **Step 6: The workflow.** CLAUDE.md, "Make a chart for <tune>": add `kind:` for a form or exercise, `aka:` where the tune has another common title, and "read the report's Tune page section and leave no gaps". Help's chart-format list gets `kind:` (Task 8 adds `aka:`).
- [ ] **Step 7:** `make test`, `make golden`, commit: "Tune pages: every chart's page from charts/ alone, and a gate on the data each page needs".

---

### Task 10: e2e: `web/e2e/seo.spec.ts`

- [ ] **Tune page without JavaScript** (Review Focus 1): context with `javaScriptEnabled: false`; `/tunes/blue-trane` has the heading, composer, every chord of `tuneSummary` in the table, and the editor link.
- [ ] **Every sitemap URL** (Review Focus 6): fetch `/sitemap.xml`; for each `<loc>` (path only, against the preview server): 200, `<link rel="canonical">` equals the `<loc>`, no `noindex`, a non-empty unique `<title>` and a `<meta name="description">`. Every library chart is present.
- [ ] **The editor** (Review Focus 5): `/song?chart=autumn_leaves` has `noindex` and canonical `…/song`.
- [ ] **Unknown tune** (Review Focus 3): in `not-found.spec.ts`, `/tunes/no-such-tune` → 404, the site's error page, no CSP violation.
- [ ] **No third-party requests:** on `/`, `/tunes/blue-trane` and `/help`, every request is same-origin.
- [ ] **robots.txt** is served and names the sitemap.
- [ ] `make e2e`; commit: "e2e: tune pages, sitemap, canonicals and noindex".

---

### Task 11: Documentation

- [ ] `docs/design.md`: a new section, "Search and discoverability": tune pages and `tuneSummary`, `tunePath`, head tags, canonical rules, JSON-LD and why the CSP doesn't apply to it, sitemap and robots, and the privacy constraints. Update the file tree (§ near line 61) and §9 (the prerendered sitemap route).
- [ ] `CLAUDE.md`: "no inline `<script>` of our own" → "no inline executable `<script>` of our own (JSON-LD data blocks are fine)"; "the only server code is `web/server/` (the contact form)" → add "and the prerendered sitemap"; add "Make a chart" step: add `aka:` where a tune has another common title.
- [ ] `README.md`: the `aka:` and `kind:` headers in the chart format.
- [ ] Commit: "Docs: search and discoverability".

---

### Task 12: After deployment (manual, by the owner)

Not code; listed so the work is finished end to end.

- [ ] Confirm the apex domain redirects to `www` (308) in the Vercel dashboard.
- [ ] Google Search Console: add a Domain property, verify by DNS TXT record, submit `https://www.chordscalemaker.com/sitemap.xml`, and request indexing of `/` and two or three tune pages.
- [ ] Bing Webmaster Tools: import from Search Console (or verify by DNS), submit the sitemap. Bing's index also serves DuckDuckGo and Yahoo.
- [ ] After two to four weeks, check Search Console's Pages report for "Crawled – currently not indexed" and "Duplicate without user-selected canonical" on tune pages.
- [ ] Outreach (see the project doc): Jazz Lab, the About video's YouTube description, Ko-fi and Patreon profiles, r/jazztheory, instrument forums.

## Out of scope (later)

- Composer index pages (`/composers/john-coltrane`).
- Scale reference pages (`/scales/lydian-dominant`), generated from `SCALES` and `chord_scales.json`.
- Per-tune Open Graph images drawn at build time by `scripts/icons.mjs`.
- IndexNow pings at deploy.
