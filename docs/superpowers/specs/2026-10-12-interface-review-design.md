# Interface review: the sheet leads: design

Date: 2026-10-12. Status: approved (the user chose all of A–G the same day). Issue: #200. From a review of the live
site at 1280 and 390 px, light and dark (library, song page on Changes and Scales, editing, Help, About).

## Intent

- **Who:** a jazz student or working player, instrument within reach, at a laptop on a music stand or a phone.
  They came to play a tune.
- **What they do:** pick a tune, set the instrument, read and play the sheet (or print it).
- **Feel:** a lead sheet on a stand in a practice room. Quiet, paper-first, the Blue Note sleeve as the frame (navy
  and one blue), not a SaaS dashboard.
- **Signature:** the sheet as engraved paper: one raised page, everything else recedes around it.
- **Rejected defaults:** a toolbar of equal filled buttons → one quiet control rail; card-in-card containers → one
  stand surface and one paper; every action exposed → primary actions visible, the rest in a menu.

## Findings this answers (from the review)

1. The sheet isn't the focal point: it starts ~500 px down on desktop and more than a screen down on a phone, below
   ~9 equal navy filled buttons (Edit, Save as a copy, Download, Share, Numerals, Scales, Transpose, Focus, Print).
2. Toggles and actions look alike (Numerals/Scales "on" = the navy fill Print has); the Line control uses a second,
   brighter blue (note-500).
3. Containers nest 3–4 deep: the layout's white card → the blue-tint control panel (`bg-note-100`) → the sheet card
   (`SheetPages`: `ring-1` + `shadow-xs`) → its inner bordered page; radii aren't concentric.
4. The title shows twice (the page `<h1>` + byline, then the sheet's heading + subtitle + composer).
5. "Report a chart error" sits alone on a row between toolbar and sheet; "Edits are saved in this browser as your
   version." reads as a stray line among the actions.
6. The navbar's random quote wraps to 2–3 lines, so the header is 64–82 px depending on the quote and every page
   shifts.
7. Library on a phone: the table scrolls sideways (Composer cut, Details and Open off screen); "Library" is said three
   times (eyebrow tag, "Chart library" heading, "Library" subheading); 242 rows, no A–Z jump; Details is free text
   from `subtitle:` and reads inconsistently ("AABA, 36 Bars · A♭ · AABC").
8. Content pages: `max-w-2xl` prose in a full-width card leaves the right half empty; Help's "On this page" links
   sit inline at the top only.

Kept as is: the Blue Note palette and tokens (`main.css`), Jost headings, the Editing-the-sheet banner, dashed
underlines on editable fields, dark mode, the Scales staff label column.

## System (G, written first as `.interface-design/system.md`)

- **Surfaces (one hue, lightness only):** `stand` (the page ground: zinc-100 light / zinc-950 dark) → `paper` (the
  sheet: white / zinc-900) → `raised` (menus, dialogs, the sticky rail: white / zinc-800). Tokens in `main.css`
  `@theme`: `--color-stand`, `--color-paper`, `--color-raised`, redefined under `html.dark`.
- **Depth:** shadows, not borders, for lift; one recipe each. `--shadow-paper`: `0 0 0 1px rgb(8 17 31 / .06), 0 1px
  2px -1px rgb(8 17 31 / .08), 0 4px 12px rgb(8 17 31 / .05)`; dark: `0 0 0 1px rgb(255 255 255 / .08)`.
  `--shadow-raised`: the same ring plus `0 8px 24px rgb(8 17 31 / .12)`. Borders only for dividers and inputs.
- **Radius scale:** 6 px controls, 10 px paper and panels, 14 px dialogs; nested radius = inner + padding.
- **Accent:** one: `--color-accent` (note-600 light / note-300 dark) for the selected state, focus and links.
  Navy solid (`note-800`) only for the single primary action of a view.
- **Buttons, by role:**
  - primary (solid navy): one per view (song page: Print; library: New chart; dialogs: the confirm);
  - action (outline): Share, Transpose, Focus;
  - toggle: a new `ToggleButton` (`aria-pressed`): off = outline, on = accent tint (`note-100` bg, `note-800` text,
    `note-300` ring; dark: `note-300/15` bg, `note-200` text) — Numerals, Scales, Intervals;
  - choice: `SegmentedControl`, its checked fill changed from note-500 to the toggle's on style (one accent);
  - quiet (plain): menu triggers, Report, Revert.
- **Type:** Jost for display (sheet title 28 px/700, page titles 28 px), system sans 14 px body; label 12 px/500
  zinc-500; three tiers by weight and colour, not size alone. Headings `text-wrap: balance`.
- **Spacing:** 4 px base; rail 8 px gaps, 12 px padding; between rail and paper 16 px; paper padding 24 px (16 on a
  phone).

## A. The sheet leads (song page)

- **One heading:** the page's own title block (the `<h1>`, the byline) goes; the sheet's heading in `SheetPages`
  becomes the page's `<h1>` on screen (an `as`/`level` prop; print keeps today's header). Save status ("Edits are
  saved in this browser as your version", "A shared chart…") moves under the sheet heading as one muted line.
- **The rail:** one row directly above the paper, on the stand surface (no tinted panel):
  - left: Work on · Instrument · Level (and Shuffle) · the sheet's own controls (Analysis toggles and Line on the
    Changes; Intervals and Spell Scale on the Scales) · Transpose;
  - right: Edit (toggle) · Share (outline) · Focus (outline) · **Print (primary)** · **⋯ More** (`UiDropdown`):
    Save as a copy, Download, Revert to library version, Report a chart error (and #153's Send to the library /
    Suggest these changes when that lands).
  - Sticky on `lg` and up (`sticky top-0`, `raised` surface and shadow once stuck, via an IntersectionObserver
    sentinel; no shadow at rest).
  - The Practice panel (Scales) stays a separate block between rail and paper, restyled on the stand surface.
- **Phones (< md):** the rail shows Work on · Instrument · **Controls** (opens a `UiDialog` sheet holding every other
  control, the same components) · Print · ⋯. The paper starts within the first screen (target: the sheet's title
  above y = 400 at 390×844).
- **Editing:** the Editing-the-sheet banner stays, above the rail; the Source pane stays above the paper.

## B. Button hierarchy

As the System section: `ToggleButton` for on/off, one segmented style, outline for actions, one primary per view.
Applied to the song page, the library header, the Practice panel (All/Clear stay plain), dialogs.

## C. Surfaces

- `StackedLayout` gets a `bare` mode for the song page: no white content card; the page sits on `stand`.
- `SheetPages` becomes the `paper` (shadow-paper, 10 px radius, no ring stack); the extra inner bordered page goes.
- Content pages and the library keep the layout card, retuned to `paper` + `--shadow-paper`.

## D. Header

- The quote: one line, `truncate`, the whole quote and author in the `title` and in an `sr-only` span; shown from
  `xl` up (it already hides below `md`). The navbar height is fixed (64 px) on every page.

## E. Library

- One label: the heading reads "Library"; the eyebrow tag goes; the "Library" subheading shows only when My charts
  is above it.
- Phones (< sm): rows become a list (title 15 px/600, then composer and details on one muted line), no sideways
  scroll; from `sm` up the table stays.
- An A–Z bar (letters with tunes link to the first tune of each letter; a leading article ("A", "The") files under its
  own letter as titles sort today); hidden while searching.
- Details is built, not free text: `style · key · form` from the chart's headers (`tuneSummary`'s `style`,
  `keyLabel`, `form`), so every row reads the same. `subtitle:` stays on the sheet.

## F. Content pages

- Help, Functions, Privacy: from `lg` up, two columns: prose (`max-w-2xl`) and a sticky "On this page" index (the
  existing `SECTIONS` nav) in the right column, its current section marked (IntersectionObserver). Below `lg`, the
  inline links stay.

## G. Save the system

`.interface-design/system.md` holds the System section's values and the component recipes (rail, ToggleButton,
paper), and is updated as the work lands.

## Order and overlaps

- After #198 (one URL per tune: it changes the library links and the song page's fallback heading) and #189 (Scales
  lines: `ScaleStaff` labels). #153 and #188 add buttons and controls: whichever lands later puts them in the rail
  and the ⋯ menu as described here.
- Each phase ships on its own; no feature flag (visual changes, all reversible), except the rail on phones, behind
  `compactRail` (off; e2e on) until it's tried on a real phone.

## Testing

- Unit: `ToggleButton` (aria-pressed, styles by state); `libraryDetails(summary)`; the A–Z index builder
  (letters present, first tune per letter); the rail's More menu items by chart state.
- e2e: update selectors that move into the ⋯ menu (Save as a copy, Download, Report a chart error, Revert: 12
  references today); new checks: the song's `<h1>` is the sheet title and appears once; at 390×844 the sheet title is
  above y = 400 with `compactRail` on; the navbar's height is the same on three pages with different quotes; the
  library at 390 has no horizontal scroll; the A–Z bar jumps; Help's index is sticky at 1280.
- Visual: before/after screenshots at 1280 and 390, light and dark, attached to each PR.
