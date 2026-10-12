# One URL per tune: design

Date: 2026-10-12. Status: approved (decided with the user the same day). Issue: #198. Replaces the tune pages of
[SEO and discoverability](2026-10-12-seo-discoverability.md)'s plan (#151).

## Goal

One address per library tune, `/song/<name>`: the page people land on, share and search engines index. Today the
library links a title to `/tunes/<name>`, whose "Open practice sheets" goes to `/song/<name>`: an extra step, and two
addresses for one tune. There's no traffic or ranking to protect yet.

## Decisions

- **`/song/<name>`** (a library chart) is prerendered, indexable and canonical, and is what the sitemap lists.
- **`/tunes/<name>`** is deleted; `routeRules` sends `/tunes/**` to `/song/**` with a 301 (one line: covers old link
  previews and anything already crawled).
- **`/song`** itself (`?mine=`, `?new=1`, a share link `#s=`) keeps `noindex`. A query on a library address
  (`/song/autumn-leaves?mine=x`) is served the same static file; its canonical (path only) names the clean address.
- **`/`** stays the library and the homepage.
- **No changes table or summary for users:** the chart itself is the content. Search needs the head (title,
  description, canonical, Open Graph, JSON-LD), which is invisible, and some HTML text for crawlers that don't run
  JavaScript: the loading fallback becomes the tune's heading.

## The song page's prerendered output (library tunes)

- **Head:** title `<Title> (<Composer>): changes and chord scales` (`tuneTitle`), the description `tuneDescription`
  gives, the JSON-LD the tune page had (`tuneLd`, `breadcrumbLd`, with the song path), Open Graph from `seoMeta`; no
  `robots`. App-wide canonical and `og:url` (`app.vue`) already follow the path.
- **Body:** `ClientOnly`'s fallback, prerendered, becomes
  `<h1>Autumn Leaves</h1><p>Joseph Kosma</p><p>Loading the practice sheets…</p>` (composer line only when there is
  one); for `/song` itself it stays "Loading editor…".
- **In the browser:** unchanged; the tab title still follows the chart as edited.

## The library page

- A title links to `songPath(slug)`; the **Open** column (and its header cell) goes.
- Intro: "Pick a tune to open its practice sheets{, or start a new chart}. Charts are written in concert pitch."

## Clean-up

- Deleted: `web/app/pages/tunes/[slug].vue`, `tunePath`, `TUNE_PATHS`, `tunePathsOf`.
- `sitemapPaths` takes song paths: `nuxt.config.ts` builds `SITEMAP_PATHS` from `CHART_SLUGS.map(songPath)`; the
  prerender list drops its separate song paths (they're in the sitemap list now) but keeps `/song`.
- Engine: `TuneSummary.rows` (only the tune page read it) and its tests go; `tuneSummary`, `tuneDescription`,
  `tuneGaps`, `tuneAdvice` stay. The `analyse` report's "Tune page" heading reads "Song page"; CLAUDE.md's "Make a
  chart" note follows.
- `docs/design.md`: the SEO section and the page list.

## Testing

- Unit: `sitemapPaths` lists `/song/<name>`; a head builder for a library song (title, description, JSON-LD with the
  song path, no robots) and for `/song` (noindex); the library page links titles to `/song/<name>` with no Open link.
- e2e (`seo.spec.ts`, `library.spec.ts`, `not-found.spec.ts`):
  - with JavaScript off, `/song/autumn-leaves` has the `<h1>`, the composer, JSON-LD of type MusicComposition, the
    canonical, and no `noindex`;
  - `/song?new=1` and a share link are `noindex`;
  - `/tunes/autumn-leaves` answers 301 to `/song/autumn-leaves` (`request.get(…, { maxRedirects: 0 })`);
  - clicking a library title opens the sheets;
  - the sitemap test (every URL: 200, its own canonical, indexable, unique title) passes over the song paths.
