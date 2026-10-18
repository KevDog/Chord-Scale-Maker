# Several versions of one tune (#411)

The library will hold more than one chart of a tune: Summertime as it is, and Summertime from the Jazz Lab
Accelerator iReal playlist. A user's saved charts of a tune, and accepted submissions (#153), are versions too.
Decided with the user 2026-10-18.

## Chart format
- New header `version: <label>` (`META_KEYS` in `engine/src/chart.ts`; README "Charts", `docs/design.md`).
  A chart without one is the tune's **main** chart.
- Each file stands alone: its full header (composer, `aka:`, `recording:`, style…); nothing is inherited.
- `tuneSummary` gains `version: string` (`''` when absent).
- File name: `<title slug>-<version slug>` (`summertime-jazz-lab-accelerator.txt`).

## Grouping (engine, pure: `engine/src/versions.ts`)
- `tuneKey(title)`: the title as compared across charts: NFD, diacritics dropped, lowercase, apostrophes dropped,
  other non-alphanumerics to one space, trimmed (`'Round Midnight` = `Round Midnight`).
- `tuneGroups(charts: { slug; text }[])` → `{ key; main: slug; versions: { slug; label }[] }[]`: an `aka:` means the
  same tune, so a chart's title and each `aka:` that is another chart's title join one group (chains and pairs
  naming each other included), whatever order the charts come in. `main` is the chart without `version:`, else the
  first version by label; `versions` lists every chart of the group, mains first, then by label; groups sort by key.
- `versionProblems(charts)` → messages: two mains in one group; two versions with one label in a group; a version
  whose title shares its main's key but is spelt otherwise (an `aka:`-joined version may have another title).
  `engine/src/__tests__/libraryMeta.test.ts` fails on any (as on song page gaps).
- The matcher is the one #403 (skip songs already in the library) and #404 (`csm check`) use.

## csm add
`--version "<label>"`: sets `version:` and names the file `<title slug>-<version slug>.txt`; warns when no library
chart has the tune's title or `aka:` (the version would stand as a tune of its own). Header flags are trimmed; a blank
one is not given.

## Library and composer pages (flag `versions`)
- One row per group, linking to its main; "· N versions" in its details when N > 1.
- Search (`searchLibrary`, `suggestTunes`) matches any version's title or `aka:`, and lists the group once.
- The A–Z index, the library count, composer pages and tune of the day count groups, not files.

## Song page (flag `versions`)
- **Picker:** a `UiListbox` by the title, shown when the options number 2 or more:
  library versions (the main labelled "Main", others by `version:`), then a "Mine" group of saved charts whose
  `basedOn` is one of the group's slugs or whose title's `tuneKey` is the group's key (label: its own `version:`, else
  "My chart", numbered when several). Choosing one navigates to its page (`/song/<slug>` or `/song?mine=<id>`).
- **A version page** (library, with `version:`):
  - heading and `<title>`: "Summertime (Jazz Lab Accelerator)";
  - `<link rel="canonical">` to the main's page (`app.vue` takes a page's override);
  - left out of the sitemap and IndexNow (`chartSlugsOf`, `indexNowLibrary`);
  - its OG card's title carries the label.
- Flag off: no picker, versions list as their own rows and pages as today (a version is just a chart).

## Order of work (one PR each, or fewer if small)
1. Engine: `version:`, `tuneKey`, `tuneGroups`, `versionProblems` in the library test; `csm add --version`.
2. Library, search, A–Z, composer pages, tune of the day.
3. Song page: picker (library versions), version-page title, canonical, sitemap, IndexNow, OG; and the first
   versioned chart, Summertime (Jazz Lab Accelerator), via `csm add --version`, so the e2e has real data.
4. Saved charts in the picker.

## Testing
- Engine: `tuneKey` examples; `tuneGroups` (main + versions, aka match, no main, ordering); `versionProblems`
  (each message); `tuneSummary.version`; parse/serialize round-trip. `make golden` unchanged (no chart has
  `version:` until step 3).
- cli: `--version` sets the line and the slug.
- web unit: grouped library rows and counts, search once per group, picker options (library + Mine, labels,
  numbering, hidden under 2), version-page head and canonical, sitemap/IndexNow exclusion.
- e2e (flag on, step 3, over Summertime and its Jazz Lab Accelerator version): picker switches pages; Library shows
  one Summertime row with "2 versions"; the version page's canonical points to `/song/summertime`.
