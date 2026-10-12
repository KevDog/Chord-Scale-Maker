# Hyphenated chart names, and practice sheets at /song/<name>

## Goal
A library chart's name is the same everywhere: its file `engine/charts/round-midnight.txt`, its tune page
`/tunes/round-midnight`, its practice sheets `/song/round-midnight` (was `/song?chart=round_midnight`). The SEO work
of #151 stays as it is; nothing a visitor saved in their browser is lost; old links still open the chart.

## Two PRs
1. **Hyphenated chart names**: rename the files, the fixtures and tests that name them, migrate browser storage,
   make the add-a-chart flow use hyphens. No URL changes (tune page URLs are already hyphenated).
2. **Practice sheets at `/song/<name>`**: the new route, its redirects and prerender, the links.

## Part 1: hyphenated chart names

### Names
- A chart file's name is `[a-z0-9]+(-[a-z0-9]+)*.txt` (lowercase, hyphen-separated). A library test fails on any
  other `.txt` in `engine/charts/` (sync copies aside), naming the file.
- The slug is the file name without `.txt`, as `toLibrary` (`web/app/utils/library.ts`) reads it now.
- `tunePath(slug)` is `/tunes/<slug>` with no conversion; `findTune` is `findChart` (removed, its callers use
  `findChart`).

### Rename
A one-off `git mv` of all 242 charts (`_` → `-`), by a shell loop in the plan, not a kept script. Then
`make golden` and `cd engine && npm run analyse -- --all --save`: `golden.json` and `analysis.json` are keyed by
chart name, and their diffs must be key renames only (checked: the diff with `_`/`-` normalised is empty).

### Tests and docs that name charts
Engine tests, web unit tests and e2e specs that name a chart (`'autumn_leaves'`, `charts/autumn_leaves.txt`,
`/song?chart=autumn_leaves`) use the hyphen name. `/song?chart=autumn-leaves` still works in Part 1 (the page looks
the chart up by its slug).

### Browser storage migration
Three things a visitor's browser holds name a library chart:
- My charts' index (`csm-charts`): an edited library chart's `basedOn: 'round_midnight'`
- practice picks: `csm-practice:round_midnight:<mode>`
- the scale level: `csm-level:round_midnight`

`migrateChartNames()` (`web/app/utils/myCharts.ts`, beside `migrateDraft`), run on every load by a client plugin
(`web/app/plugins/chartNames.client.ts`):
- rewrites `basedOn` and the two key families whose chart name has a `_` (found by listing the keys, so the
  plugin needn't load the library); `mine:<id>` keys are untouched;
- if both the old and the new key exist, keeps the new and removes the old;
- is idempotent: a second run changes nothing; storage that throws (private mode) is skipped, as `storage.ts` does.

### Add-a-chart flow
- `CLAUDE.md` "Make a chart for <tune>": `engine/charts/<tune-name>.txt`, lowercase and hyphens (`round-midnight.txt`).
- `README.md` (lines ~74, ~118) and `engine/scripts/analyse.ts` usage text: hyphen examples.
- The name test above catches an underscore or capital at `make test`.

## Part 2: practice sheets at /song/<name>

### Decisions
- **One page**: `web/app/pages/song.vue` becomes `web/app/pages/song/[[slug]].vue` (optional param). One page file
  serves `/song` and `/song/<name>`. Nuxt's page key includes params, so moving between `/song/<a>` and `/song?mine=`
  remounts the page (harmless); either way the editor restarts on a different chart (on `fullPath`, as now).
- **Only library charts move**. `?mine=<id>`, `?new=1` and `#s=<payload>` stay on a bare `/song`.

### Units
- `web/app/utils/site.ts`: `songPath(slug)` → `/song/<slug>`; `chartSlug(name)` → the name with `_` → `-` (old
  addresses and bookmarks used underscores).
- The page: the chart is `findChart(chartSlug(route.params.slug ?? query('chart')))`.
- Links: `pages/tunes/[slug].vue` (Open practice sheets), `pages/index.vue` (Open), `components/MyChartsList.vue`
  (an edited library chart) use `songPath()`.

### Old and odd addresses (client-side, in the page, `router.replace`, hash kept)
| Arrives as | Goes to |
|---|---|
| `/song?chart=round_midnight` or `?chart=round-midnight` | `/song/round-midnight` |
| `/song/round_midnight` | `/song/round-midnight` |
| `/song/no-such-tune`, `/song?chart=no_such_tune` | `/` (as an unknown `?chart=` does today) |

Client-side only: `/song` is `noindex` and never in the sitemap, so there's no search equity for a server redirect
to carry, and the e2e build (no Vercel) tests the same code that runs in production.

### Prerender
`nitro.prerender.routes` adds `/song/<name>` for every library chart (`chartSlugsOf(files).map(songPath)` in
`nuxt.config.ts`, beside the tune pages). `/song` stays prerendered. Each page gets its CSP `<meta>` from the
existing `prerender:generate` hook.

### SEO (unchanged in substance)
- Practice sheets stay `noindex` (`PAGE_HEAD.song`) and out of `SITEMAP_PATHS`.
- Canonical: `app.vue`'s `canonicalUrl(route.path)`, now `/song/round-midnight`. No canonical to the tune page:
  `noindex` plus a cross-page canonical is a mixed signal.
- Tune page URLs, the sitemap, structured data and `robots.txt` don't change.

## Testing
- Part 1, unit: the name test over `engine/charts/`; `tunePath`; `migrateChartNames` (each key family, `basedOn`,
  both-keys collision, `mine:` keys untouched, a full storage keeps the old key, idempotent).
- Part 1, e2e: an edited library chart and practice picks saved under the old names survive a reload (storage
  seeded before load).
- Part 2, unit: `songPath`, `chartSlug`. e2e: `/song/<name>` opens the chart (canonical, `noindex`); the redirects
  in the table (replace, not a history entry); the tune page and library links land on `/song/<name>`.
- `make test`, `make lint`, `make e2e` on each PR; Part 1 also `make golden`.

## Docs
`docs/design.md`: the pages list (~61), the tune page note (~686), the `/song` canonical note (~700), and wherever it
names a chart file with underscores.

## Out of scope
Paths for `?mine=` / `?new=1`; server redirects; tune page URLs (already hyphenated).
