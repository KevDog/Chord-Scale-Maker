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

- Jost (`font-display`) for display: sheet title 28 px/700, page titles 28 px.
- System sans 14 px body; labels 12 px/500 zinc-500.
- Three tiers by weight and colour, not size alone. Headings `text-wrap: balance`.

## Spacing

4 px base. The rail: 8 px gaps, 12 px padding. Between rail and paper: 16 px. Paper padding: 24 px (16 px on a
phone).

## Recipes

- **Paper** (the sheet, `SheetPages`): `bg-paper shadow-paper rounded-paper p-4 sm:p-6`; no ring stack, no inner
  bordered page.
- **Rail** (above the paper, on the stand): left = Work on · Instrument · Level (Shuffle) · the sheet's own controls
  · Transpose; right = Edit (toggle) · Share · Focus · Print (primary) · ⋯ More. `flex flex-wrap items-end gap-2
  p-3`; sticky from `lg` while editing only (practising, it scrolls away), `bg-raised shadow-raised rounded-paper` once stuck (no shadow at rest).
- **More menu:** `UiDropdown` behind a plain "More actions" trigger: Save as a copy, Download, Revert to library
  version, Report a chart error.
