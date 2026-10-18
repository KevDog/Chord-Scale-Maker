# Chord Scale Maker: interface system

The decisions behind the UI (spec: `docs/superpowers/specs/2026-10-12-interface-review-design.md`, issue #200).
Tokens live in `web/app/assets/css/main.css` (`@theme`, redefined under `html.dark`). Hold to these values; record
new component recipes here as they land.

## Direction and feel

- **Who:** a jazz student or working player, instrument within reach, at a laptop on a music stand or a phone. They
  came to play a tune.
- **What they do:** pick a tune, set the instrument, read and play the sheet (or print it).
- **Feel:** a lead sheet on a stand in a practice room. Quiet, paper-first, the Blue Note sleeve as the frame (navy
  and one blue), not a SaaS dashboard.
- **Signature:** the sheet as engraved paper: one raised page, everything else recedes around it.
- **Rejected defaults:** a toolbar of equal filled buttons → one quiet control rail; card-in-card containers → one
  stand surface and one paper; every action exposed → primary actions visible, the rest in a menu.

## Palette

- One hue: `zinc` is retuned to cool, navy-tinted neutrals; `note` is the blue scale. Surfaces change lightness only.
- **Accent:** one, `--color-accent` (note-600 light / note-300 dark) for the selected state, focus and links.
  Navy solid (`note-800`, `<UiButton color="note">`) only for the single primary action of a view.

## Surfaces

| Token             | Light     | Dark     | Use                                        |
| ----------------- | --------- | -------- | ------------------------------------------ |
| `--color-stand`   | zinc-100  | zinc-950 | the page ground (`bg-stand`)               |
| `--color-paper`   | white     | zinc-900 | the sheet, content cards (`bg-paper`)      |
| `--color-raised`  | white     | zinc-800 | menus, dialogs, the stuck rail (`bg-raised`) |
| `--color-sleeve`  | note-800  | note-900 | the header's band (`bg-sleeve`), the label's navy |

The header is the sleeve: a navy band whatever the theme, so it takes `class="dark"` (Catalyst's light-on-dark
styles) and the dark accent (note-300); its icons note-200; the logo mark keeps a `ring-white/30` edge on it.

## Depth

Shadows, not borders, for lift; one recipe each. Borders only for dividers and inputs.

- `--shadow-paper` (`shadow-paper`): `0 0 0 1px rgb(8 17 31 / .06), 0 1px 2px -1px rgb(8 17 31 / .08), 0 4px 12px
  rgb(8 17 31 / .05)`; dark: `0 0 0 1px rgb(255 255 255 / .08)`.
- `--shadow-raised` (`shadow-raised`): `0 0 0 1px rgb(8 17 31 / .06), 0 8px 24px rgb(8 17 31 / .12)`; dark: `0 0 0
  1px rgb(255 255 255 / .1)`.
- Tailwind inlines a shadow token's value into its utility, so the recipes live in `--depth-paper` /
  `--depth-raised` (set on `html` and `html.dark`) and the `--shadow-*` tokens point at them.

## Radius

6 px controls (`rounded-control`), 10 px paper and panels (`rounded-paper`), 14 px dialogs (`rounded-dialog`).
Catalyst's buttons, toggles and segmented controls keep its `rounded-lg` (8 px) so they line up;
`rounded-control` is for the rest. Nested radius = inner + padding. (Tailwind v4: use the named utilities, not `rounded-[--radius-…]`.)

## Buttons, by role

- **primary** (solid navy, `color="note"`): one per view. Song page: Print; library: New chart; dialogs: the confirm.
- **action** (`outline`): Share, Transpose, Focus.
- **toggle** (`ToggleButton`, `aria-pressed`): off = outline; on = accent tint (`note-100` bg, `note-800` text,
  `note-500` edge; dark: `note-300/15` bg, `note-200` text, `note-300` edge). Numerals, Scales, Intervals, the
  Practice presets; Edit too, as a disclosure (`expands`: `aria-expanded`, not `aria-pressed`).
- **choice** (`SegmentedControl`): its checked state uses the toggle's on style (one accent).
- `ToggleButton` is the Catalyst button's base (size, focus, icon slot) with the outline style off and the tint on, so it
  lines up with `UiButton`s beside it. Toggle-on contrast: note-800 on note-100 8.1:1; dark note-200 on note-300/15
  over zinc-950 9.4:1; the on edge (note-500 / note-300) is 4.7:1 on white, 8.9:1 on zinc-950. The
  choices (segments, Practice boxes) keep a white fill when unchecked, like inputs.
- **quiet** (`plain`): menu triggers, Report, Revert.

## Type

- Jost (`font-display`) for display: sheet title 24 px/700 (the song page's h1), page titles 28 px.
- System sans 14 px body; labels 12 px/500 zinc-500.
- Three tiers by weight and colour, not size alone. Headings `text-wrap: balance`.

## Spacing

4 px base. The rail: 8 px gaps, 12 px padding. Between rail and paper: 16 px. Paper padding: 24 px (16 px on a
phone).

## Recipes

- **Paper** (the sheet, `SheetPages`): `bg-paper shadow-paper rounded-paper p-4 sm:p-6`; no ring stack, no inner
  bordered page.
- **Paper, focus mode** (`SheetPages` paged, `utils/sheetPaged.ts`): one paper a printed page, 816 px wide and at
  least 1056 tall (a letter page at 96 dpi, so it lays out as printed), `gap-6` apart, all CSS-`zoom`ed by one factor
  so the tallest fits the window under the Exit bar; popovers on it undo the zoom (`PAGE_ZOOM`).
- **Heading:** the sheet's title is the page's only `h1` (Jost 24/32 700, balanced); the save status one muted line
  under it (`SheetStatus`, 14/24 zinc-500).
- **Rail** (`SheetRail`, a labelled group "Sheet controls", above the paper, on the stand): left = Work on ·
  Instrument · Level (Shuffle) · the sheet's own controls · Transpose; right = Edit (toggle) · Share · Focus · Print
  (primary) · ⋯ More. `-mx-3 flex flex-wrap items-end gap-x-4 gap-y-3 p-3`; 16 px to the paper. Groups and actions
  wrap as one row (the left slot `display: contents`, the actions `ml-auto`). Each group is one control tall: details
  go in a `RailPopover` panel (`bg-raised shadow-raised rounded-paper p-3`, closes on a click outside or Escape) —
  Instrument as a summary button styled as a listbox ("Piano · F3–E6", panel below: pitch, instrument, range); a
  line's details behind a plain › "Line options" (panel to its right, below on a phone). Inside the phone's Controls
  dialog the panels are inline. Sticky from `lg`
  while editing only (practising, it scrolls away): `bg-raised shadow-raised rounded-paper` once stuck (a sentinel's
  IntersectionObserver), no shadow at rest; z-10, z-40 while one of its menus is open. Its parents up to the Preview
  section are `display: contents` so it sticks the sheet's length.
- **Rail on a phone** (`compactRail` flag, below md): Work on · Instrument · Controls (outline,
  AdjustmentsHorizontal) · Print · ⋯; Controls opens `ControlsDialog` ("Controls") with the other groups (the same
  components) and Edit · Share · Focus, which run once it has closed. While editing, Done sits on the rail.
- **More menu** (`MoreMenu`, items from `moreMenuItems`): `UiDropdown` behind an outline "More actions" ⋯: Save as a
  copy, Download, Revert to library version, Report a chart error.
- **Header** (the sleeve): fixed 64 px; the quote (from xl) in two lines at most, 14/18 italic white/90, the author
  under it 12/16 note-200; the whole quote in a tooltip.
- **Library:** heading "Library"; an A–Z bar (`size-8` links, `rounded-control`, accent text) jumping to and focusing
  each letter's first tune; details built `style · key · form`; below sm a list (title 15/24 600, then composer ·
  details 14/20 muted, one line, the whole row the tap target).
- **On this page** (`PageIndex`): from lg a 14rem column beside 42rem of text, `sticky top-8`, links `border-l`
  stacked, the current one `border-accent text-accent font-semibold` (`aria-current`); below lg inline links.
- **Home** (`pages/index.vue`, `TuneSearch`, `RecentCharts`, `TuneOfTheDay`): left-aligned, `max-w-5xl`; the heading
  and search in a 42rem column. The h1 is display size (Jost 44/1.05 600, -0.025em; 34 on a phone), the only place type
  goes above 28 px. The search is paper (`bg-paper shadow-paper rounded-paper`), 64 px tall, 20 px input text (17 on a
  phone), the focus ring on the strip (`focus-within`), the instrument `UiListbox` inside it on the right. Suggestions:
  `bg-raised shadow-raised rounded-paper p-1.5`, 8 px under; a row is the title 15/22 600 (the match underlined in the
  accent), composer · style 13/18 muted, and on the right the written key (Jost 22 600) over "concert X" 11/14; the
  active row the toggle tint. Under the search, 40 px: from lg one row, Recently opened (`flex-1`) beside Tune of the
  day (20rem), their 12 px labels level; with no recents the tune of the day sits under the search. Recently opened:
  one paper list, rows 12 px × 20 px, the whole row the link. Tune of the day: "Another →" (accent, 12/16 500) at the
  right of its label; one paper card `p-5`, the title Jost 24/30 700, composer 13/20 muted, the written key Jost 28 600
  over "concert X", then style · form 12 px muted over a hairline; the whole card the link; picked in the browser
  (`utils/tuneOfTheDay.ts`), the card's size held until then. Then, past a hairline 56 px down, what the site does: a
  Jost 28 heading and 15/24 intro (1fr) beside a two-column grid (2fr) of blocks, a Jost 17 600 title over 14/22 muted
  text, no boxes.
