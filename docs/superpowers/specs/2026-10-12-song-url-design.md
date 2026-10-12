# Practice sheets at /song/<slug>

## Goal
A library chart's practice sheets live at `/song/round-midnight`, not `/song?chart=round_midnight`, so the path reads
like the tune page it comes from (`/tunes/round-midnight`). The SEO work of #151 stays as it is.

## Decisions
- **Slug**: hyphens, the same rule as `tunePath()` (`blue_trane` → `blue-trane`).
- **One page**: `web/app/pages/song.vue` becomes `web/app/pages/song/[[slug]].vue` (optional param). `/song` and
  `/song/<slug>` are one component, so moving between a library chart, `?mine=`, `?new=1` and `#s=` doesn't
  remount the page (the editor still restarts on `fullPath`, as now).
- **Only library charts move**. `?mine=<id>`, `?new=1` and `#s=<payload>` stay on a bare `/song`.

## Units
- `web/app/utils/site.ts`
  - `songPath(slug)`: `/song/<hyphenated slug>`; shares the hyphen rule with `tunePath()` (one private helper).
  - `chartSlug(param)`: the URL's slug back to the chart's file name (`round-midnight` → `round_midnight`); a
    chart's file name never contains a hyphen (checked by a unit test over the library), so the mapping is exact.
- `web/app/pages/song/[[slug]].vue`: the chart slug is `chartSlug(route.params.slug)`, not `query('chart')`.
  Everything else in `source` is unchanged.
- Links: `pages/tunes/[slug].vue` (Open practice sheets), `pages/index.vue` (Open), `components/MyChartsList.vue`
  (an edited library chart) use `songPath()`.

## Old and odd addresses (client-side, in the page, `router.replace`, hash kept)
| Arrives as | Goes to |
|---|---|
| `/song?chart=round_midnight` | `/song/round-midnight` |
| `/song/round_midnight` | `/song/round-midnight` |
| `/song/no-such-tune` | `/` (as an unknown `?chart=` does today) |

Client-side only: `/song` is `noindex` and never in the sitemap, so there's no search equity for a server redirect
to carry, and the e2e build (no Vercel) tests the same code that runs in production.

## Prerender
`nitro.prerender.routes` adds `/song/<slug>` for every library chart (built beside `TUNE_ROUTES` in
`nuxt.config.ts` with `songPath`). `/song` stays prerendered. Each page gets its CSP `<meta>` from the existing
`prerender:generate` hook.

## SEO (unchanged in substance)
- Practice sheets stay `noindex` (`PAGE_HEAD.song`) and out of `SITEMAP_PATHS`.
- Canonical: `app.vue`'s `canonicalUrl(route.path)`, now `/song/round-midnight` (the query was dropped before; the
  path now names the chart). No canonical to the tune page: `noindex` plus a cross-page canonical is a mixed
  signal.
- Tune pages remain the indexable URLs; structured data and breadcrumbs don't reference `/song`.
- `robots.txt` unchanged.

## Testing
- Unit (`web/test/site.test.ts`): `songPath`, `chartSlug`, round trip over every library chart, no hyphen in any
  chart's file name.
- e2e: `/song?chart=<slug>` visits become `/song/<slug>`; new cases for the three redirects above and for the
  tune page's button landing on `/song/<slug>`; My charts flows (`?mine=`) unchanged.
- `make test`, `make lint`, `make e2e`.

## Docs
`docs/design.md`: the pages list (line ~61), the tune page note (~686) and the `/song` canonical note (~700).

## Out of scope
Paths for `?mine=` / `?new=1`; server redirects; changing tune page URLs.
