# Editor UI overhaul — design

**Goal:** Restructure the editor page into a song-first view with a labelled control toolbar, fix the scale-label
bleed, require a chart key, and add a one-click chart-error report, from a round of UI testing.

**Status:** design, approved in brainstorming 2026-10-09.

## Intent

The `/editor` page grew control-by-control; UI testing surfaced bleed, crowding and a few missing affordances. This
makes it a song-first page (`/song`) whose primary job is viewing/practising a chart, with editing revealed on
demand, and tidies the toolbar into labelled groups. Eight changes, mostly independent; each ships as its own small
PR where it can.

Who it's for: the player practising from a chart, and the chart author. Success: the toolbar reads at a glance, the
Changes sheet's scale labels don't collide, and a player can report a wrong chart in one click.

### Decisions (brainstorming, 2026-10-09)

- **Repeated scale labels:** suppress a chord's scale label when it equals the previous chord's **on the same
  line**; the first chord of every line always shows its scale (across-the-line, not whole-sheet).
- **Route:** hard rename `/editor` → `/song`; no redirect (old `/editor` links are dropped).
- **Required key:** add a **Key** field to the editor; `key:` becomes required (block Transpose, flag the chart,
  until a valid key is set).
- **Chart-error report:** hand the chart text + debug context to the contact form via `sessionStorage` (not URL
  params); pre-fill the full chart.
- **Toolbar:** labelled groups — Sheet · Instrument · Work on · Show · Transposition · Display; the editor
  show/hide toggle lives in Display with Focus and Print.

## 1. Scale-label abbreviation and de-dup (Changes sheet)

The Changes sheet's scale row (`ChangesSystem.vue:22-24`, `m.scale`) collides when names are long and repeats across
a bar/line. Both fixes live in the **pure engine** (`engine/changes.ts` + a new `abbreviateScale`), so they are
unit-tested and the Vue layer only renders.

- **Abbreviate** (`engine/scales.ts`, `export function abbreviateScale(name: string): string`, applied to the
  written scale name in `changes.ts`'s `writtenScale`): word replacements —
  `Mixolydian→Mixo`, `Pentatonic→Pent`, `Dominant→Dom`, `Diminished→Dim`, `Lydian→Lyd`, `Phrygian→Phryg`,
  `Locrian→Locr`, `Harmonic Minor→Harm min`, `Melodic Minor→Mel min`, `Half-Whole→H/W`, `Whole-Half→W/H`,
  `Augmented→Aug`. Left as-is: `Ionian`, `Dorian`, `Aeolian`, `Altered`, `Blues`, and roots (`B♭`, `F♯`). Applies
  to each word, so "Lydian Dominant" → "Lyd Dom", "Bebop Dominant" → "Bebop Dom".
- **De-dup across the line:** after `buildChanges` lays out `lines`, for each line walk its chords in order and set
  `scale = ''` on any chord whose (abbreviated) scale equals the previous chord's **within that line**; the first
  chord of each line keeps its scale. `ChangesChord.scale` stays `string` (`''` renders nothing). Numerals are
  untouched.

Scope: the Changes sheet only (the "chord chart"). The Scales sheet's left-of-staff labels don't collide and are
left alone.

## 2. Toolbar restructure (`PreviewControls.vue`, `EditorView.vue`)

One desktop row of labelled groups (wrapping on phones), each group a small left-justified label over its control:

```
 Sheet            Instrument    Work on      Show                 Transposition          Display
[Scales|GT|Changes] [Tenor ▾]   [Standard ▾] [toggles by sheet]  [From C ▾] [Transpose…]      [Edit][Focus][Print]
```

- **Sheet** — the existing `SegmentedControl` (Scales / Guide tones / Changes), moved into the labelled row
  (leftmost). Only shown when more than one sheet is enabled.
- **Instrument** — the existing `UiListbox`, keeps its "Instrument" label.
- **Work on** — the scale-level control (`scaleLevels` flag), changed from `SegmentedControl` to a `UiListbox`
  dropdown (Basic / Standard / Advanced / Random); the "Random" shuffle becomes a small ↻ icon button beside it.
  Its status message ("… rows changed") moves below the sheet, not inline in the row.
- **Show** — the display toggles, swapping by sheet: Scales → `Intervals`; Changes → `Numerals` `Scales`; Guide
  tones → none (group hidden). Same `v-model` bindings as today.
- **Transposition** — `From C / From root` as a `UiListbox` dropdown (Scales sheet only; it's the practice start
  reference), plus the `Transpose…` button (all sheets). The `Start on` note select stays, shown when "From root".
- **Display** — right-justified group (label left-justified over the buttons): **Edit** (the editor show/hide
  toggle, see §3), **Focus**, **Print**.

No engine change; this is layout in the two components. The print/toolbar e2e (`print.spec.ts`, `editor.spec.ts`)
guards that nothing is lost.

## 3. Song-first view + `/song` route

- **Route:** rename `app/pages/editor.vue` → `app/pages/song.vue` (path `/song`). It reads the same query/hash:
  `?chart=<slug>`, `?mine=<id>`, `?new=1`, `#s=<share>`. Update every builder of an `/editor` URL to `/song`:
  `useOpenChart.ts:22`, `MyChartsList.vue:69`, `EditorView.vue:286,309,322`, `editor.vue`(→`song.vue`)`:99`,
  `index.vue:14,42,55`, and the share link (`EditorView.vue:309` → `${origin}/song#s=…`). No redirect from
  `/editor` (approved): old links 404.
- **Editor show/hide:** replace the "Hide text" button and its `showText` pref with **`showEditor`** (pref key
  `csm-editor`, default **false** = editor hidden, song-first). When off, the whole editing area (the `ChartGrid`
  section and the `ChartText` pane) is hidden; only the preview (toolbar + sheet) shows. The Display group's **Edit**
  toggles it ("Edit" when hidden, "Done" when shown). The editor is forced shown (regardless of the pref) for a
  brand-new chart (`?new=1`, you're creating it) and for a chart with a fatal diagnostic (as `showText || fatal`
  does today). Focus mode (full-screen sheet) is unchanged and independent.

## 4. Required key + Transpose "From" (`ChartGrid.vue`, `ChartTranspose.vue`)

- **Key field:** add `key` to the grid's editable meta (`ChartGrid.vue:63`, today `['title','subtitle']`), rendered
  as a key picker (a `UiSelect` of the valid keys: `C…B`, `Cm…Bm`, with accidentals) bound through `setMeta(doc,
  'key', …)`. A chart whose `key:` is missing or not a valid key shows a chart-level error in the editor ("Add a
  key") and the key picker is marked invalid.
- **Transpose From:** `ChartTranspose.vue` currently guesses From from the first chord (`chartKey`). Change it to
  read the chart's `key:` meta (`metaValue(doc, 'key')`), shown **read-only** (display, not a dropdown). When `key:`
  is missing/invalid, the Transpose button is disabled with a hint ("Set the chart's key first"). `To` is unchanged
  (`TRANSPOSE_KEYS`).
- **Validation helper:** a pure `isValidKey(text): boolean` in `engine/chart.ts` (reuse `parseKey` /`keyLabel`), so
  both the editor and transpose agree on what a valid key is.

## 5. Chart-error report (`contact.vue`, a new report control)

- **Button:** a small "Report a chart error" link in the Display group (or just under the sheet). On click it writes
  to `sessionStorage` a JSON blob `{ chart: <text>, slug, title, version, instrument, sheet, level, url }`
  (key `csm-chart-report`) and navigates to `/contact`.
- **Contact pre-fill:** `contact.vue` on mount reads `csm-chart-report` (once, then clears it). If present, it
  pre-fills `message` with a human "what's wrong?" prompt line, a blank line, then a fenced debug block (version,
  instrument, sheet, level, url) and the chart text; focus lands at the top of the message so the reporter types
  their description first. No change to the server contract or validation.
- The debug block is plain text inside the message (not new fields), so the existing contact flow and spam checks
  are unchanged.

## 6. Remove the on-screen page divider (`SheetPages.vue`)

Delete the on-screen "Page N" dashed separator (`SheetPages.vue:8-12`); keep the print page-break classes
(`print:break-after-page`). Pages simply stack with their existing spacing on screen.

## Testing

- **Engine (test-first):** `abbreviateScale` (each replacement, words left alone, roots/accidentals intact);
  `buildChanges` de-dup (a line whose 2nd+ chords repeat a scale blank out; each line's first chord keeps its
  scale; abbreviation applied); `isValidKey` (valid majors/minors, rejects junk).
- **Component/unit:** the toolbar renders each labelled group for the current sheet (`PreviewControls` test); the
  Key picker writes `key:` via `setMeta`; the editor show/hide toggles the grid + text.
- **e2e:** `/song?chart=…` loads and `/editor` is gone; the Edit toggle shows/hides the editor; Transpose is
  disabled without a key and uses the chart key as From; "Report a chart error" lands on `/contact` with the chart
  text pre-filled; the page divider is absent on screen; print budgets still hold (extend `print.spec.ts`,
  `editor.spec.ts`, `my-charts.spec.ts` as needed for the route rename).
- **Golden:** `abbreviateScale`/de-dup are display-only (golden stores pre-glyph ASCII scale names) — `golden.json`
  is expected to stay unchanged; confirm it.

## PR sequencing

Independent, shippable PRs (rough order): (a) remove divider; (b) scale-label abbreviate + de-dup; (c) `isValidKey`
+ Key field + Transpose-From; (d) `/song` route rename + link updates; (e) song-first show/hide editor; (f) toolbar
restructure; (g) chart-error report. (e) and (f) touch the same components, so land (e) then (f); (c)'s Transpose
change pairs with the Key field.

## Out of scope

- No redirect/back-compat for `/editor` (approved).
- No new contact fields or server change for the error report (it's message text).
- Abbreviation/de-dup for the Scales sheet labels (they don't collide).
- Editing meta other than title/subtitle/key in the grid (the rest stays in the text pane).
