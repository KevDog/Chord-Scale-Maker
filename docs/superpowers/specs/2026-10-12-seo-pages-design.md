# Composer pages, scale pages, song preview images, IndexNow: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Issues: #164, #165, #166, #167.

**Assumes landed:** #198 (one URL per tune: `/song/<name>` is the indexable page, the sheet heading its `<h1>`) and
#200 (the interface review: `SheetRail`, the stand and paper surfaces, the library's phone list and A–Z bar, content
pages with a sticky "On this page" index, `.interface-design/system.md`). Every page below follows `system.md`.

## Goal

More doors in from search, each one useful to a player once through it: a page per composer, a page per scale, a
proper link preview for every song, and prompt indexing on Bing (which also feeds DuckDuckGo and ChatGPT search).
Constraints as #151: prerendered, no third-party origins, CSP unchanged, no new runtime dependency.

## #165 Scale pages: `/scales/<name>` and `/scales`

- **One page per `SCALES` key** (`half whole diminished` → `/scales/half-whole-diminished`; the slug is the key with
  spaces as hyphens). Aliases aren't pages.
- **Content (prerendered HTML on one paper):**
  - `<h1>` the scale's display name ("Lydian Dominant scale"); a one-line lead: "Seven notes: 1 2 3 ♯4 5 6 ♭7."
  - **The notes from C** as text (C D E F♯ G A B♭) and **the formula** as degrees.
  - **Plays over:** every chord quality in `chord_scales.json` with an option naming this scale: the quality's symbol
    on C (C7, C7♯11), the root it starts from when not the chord's ("from the ♭2: over B♭7sus4♭9…" as the option's
    `root` interval gives), and its tags (default, basic/advanced, outside), each linking to `/help#…` only where Help
    explains the tag.
  - **Tunes that use it:** library songs whose Standard-level analysis (`resolveScales(doc, { level: 'standard',
    seed: 0 })`) plays this scale somewhere, linked to `/song/<name>`, with a count; capped at 30, then "and N more" as plain text. Computed at build time by one engine function over the
    library (`scaleUsage`).
  - **The staff, drawn in the browser:** a `SheetRail` with Instrument and Spell Scale (the same components and
    stored preferences as the song page), then the scale on a `ScaleStaff` (from C, or from the instrument's written
    pitch), Intervals on. The prerendered fallback is the notes as text, so crawlers lose nothing.
- **`/scales`:** every scale, grouped as `docs/design.md` groups them (major modes, melodic minor modes, harmonic
  minor, symmetric, pentatonic and blues, bebop…), each with its formula; uses the content-page sticky index for the
  groups.
- **Links in:** the song page's scale labels (the Changes' scale row, the Scales sheet's scale name) gain a "About
  this scale" item where they already open a menu or picker; the Functions page's scale names link; the footer links
  `/scales`. No new link on the printed page.
- **SEO:** title "Lydian Dominant scale: notes, chords and tunes", a description from the formula and its chords,
  JSON-LD `DefinedTerm` (in a `DefinedTermSet` "Jazz scales"), breadcrumbs Scales → name; in the sitemap.

## #164 Composer pages: `/composers/<name>` and `/composers`

- **Composers come from `composer:`**, split on `, ` and ` & ` ("Borodin, Wright & Forrest" → three).
  Slug: ASCII-folded, lowercase, quotes dropped, other non-alphanumerics to `-` (`Harry "Sweets" Edison` →
  `harry-sweets-edison`). Charts with `kind: form` or `kind: exercise` have no composer and no page.
- **`/composers/<name>`:** `<h1>` the name; "N tunes in the library"; the tunes as the library shows them (the table
  from `sm`, the list on phones; built Details), each linked to its song; co-writers named on each row ("with Cootie
  Williams", linked).
- **`/composers`:** every composer with a count, sorted by surname (the last word, `de`/`van` kept with it: "Gene de
  Paul" under P), the library's A–Z bar by surname.
- **Links in (screen only; print stays plain):** the library's Composer cell and the phone list's composer text; the
  composer line under the song's `<h1>` on the paper, one link per composer; the footer links `/composers`.
- **SEO:** title "Thelonious Monk: tunes, changes and chord scales", JSON-LD `Person` with `ItemList` of the
  `MusicComposition`s (each `url` its song), breadcrumbs Composers → name; in the sitemap.

## #166 Song preview images: `web/public/og/<name>.png`

- **Made locally, committed:** `npm run og` (Playwright Chromium, as `web/scripts/icons.mjs` draws `og-image.png`)
  writes one 1200×630 PNG per library chart. The look follows `system.md`: the stand ground, a paper card with the
  title (Jost 700), composer, and "Style · Key · Form"; the site mark and "chordscalemaker.com" small; and the first
  four bars of the Changes drawn as on the sheet (chord symbols and slashes) along the bottom: the product's own
  object, not a generic banner.
- **Fresh by test:** `web/public/og/manifest.json` maps each chart to a hash of what the image shows (title, composer,
  details, the first four bars' symbols); a unit test fails when a chart has no image or its hash is stale ("run `npm
  run og`"), the way the golden fixture works. `make og` wraps it; CLAUDE.md's "Make a chart" steps add it.
- **Used by:** `/song/<name>`'s `og:image` (and `twitter:image`), with width, height and alt ("Autumn Leaves, Joseph
  Kosma: chord changes"). Composer and scale pages keep the shared `og-image.png`.
- Size budget: PNGs quantised (`magick … -colors 64`, ≤ 60 KB each, ~15 MB for 242); the test checks the cap.

## #167 IndexNow at deploy

- **Key:** a random 32-hex key, `web/public/<key>.txt` containing the key (IndexNow's ownership proof); the key is
  public by design (it isn't a secret), kept in the repo.
- **When:** a GitHub Actions workflow on `deployment_status` where the environment is Production and the state is
  `success` (Vercel reports these to GitHub).
- **What:** the URLs whose pages changed between the previous successful production deployment's commit and this one:
  - a chart file changed → its `/song/<name>`, its composers' pages, and the `/scales/` pages of
    every scale it plays (before or after the change);
  - `engine/` or `chord_scales.json` changed (analysis or scales) → every `/song/`, `/scales/` URL;
  - `web/app/pages/*.vue` changed → that page's URL; the sitemap itself always.
  The list is built by a script (`web/scripts/indexnow-urls.mjs`, unit-tested on fixtures of changed paths) and capped
  at IndexNow's 10,000.
- **How:** one POST to `https://api.indexnow.org/indexnow` (`host`, `key`, `keyLocation`, `urlList`); a non-2xx
  logs a warning, never fails the workflow. The previous deployment's commit comes from the GitHub Deployments API
  (`gh api repos/{owner}/{repo}/deployments?environment=Production`).
- This runs in GitHub's runner, not the site: nothing changes for visitors, no CSP change.

## Order

#165 first (most search value, and #164's and #166's pages link to it), then #164, #166, #167 (last: it lists the
others' URLs).

## Testing

- Engine: `scaleUsage` (a fixture library: which songs use which scales at Standard); the "plays over" builder (from
  `chord_scales.json`: qualities, roots, tags); `composersOf(credit)` (splits, slugs, the form/exercise case,
  quotes); surname sort keys.
- App unit: the head and JSON-LD builders for scale and composer pages; the sitemap lists `/scales/…` and
  `/composers/…`; the og manifest freshness test; `indexnow-urls` on changed-path fixtures.
- e2e: with JS off, a scale page has its `<h1>`, notes as text, the chords and the tunes; with JS, the staff draws and
  follows the Instrument; a composer page lists its tunes and links back; the library's composer links; the song's
  composer link; `og:image` on a song points at an existing 1200×630 PNG; sitemap ↔ canonicals (the existing test
  covers the new URLs).
