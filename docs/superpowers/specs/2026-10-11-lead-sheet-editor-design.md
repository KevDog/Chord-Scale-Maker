# Lead-sheet editor: edit chords where they print

Date: 2026-10-11. Status: **shipped** (flag on, 2026-10-11; D1–D12 reviewed and accepted by the user, 2026-10-11). Plan:
[2026-10-11-lead-sheet-editor.md](../plans/2026-10-11-lead-sheet-editor.md). Builds on the editor UX proposal ([mockup A](../proposals/editor-ux/mockup-a-lead-sheet.html),
[README §3 A](../proposals/editor-ux/README.md)), the bar editor that shipped from it (proposal B, stages 1–3), and the
proposed-scales spec (2026-10-11): the function decides, the scale cell overrides.

## Goal

Make the Changes sheet itself the place a chart is written, the way a notation program works: click a chord on its
beat and type; the numeral and scale under it become the pickers for its function and scale; a bar's toolbar handles
structure; the heading is edited where it prints. The chart stays one `ChartDoc`; nothing here changes the format, the
engine's answers or the golden fixture.

### What the mockup assumed, and what changed since

The mockup (2026-10-11, morning) was drawn when a blank scale cell played the **chord quality's default** and the
scale was the thing you chose. Since then the editor's workflow is:

1. you write the chord;
2. the analysis proposes its **function** and the scale that goes with it, at the sheet's level;
3. you may override the function; the proposed scale follows;
4. you may override the scale (a written scale is a pin).

So three things in the mockup read differently now:

| Mockup | Now |
| --- | --- |
| Completions show "the scale it would get" (the quality's default: D7♭9 → D Phrygian Dominant). | Completions show **the analysis's reading of that chord in that bar**: its numeral and scale (D7♭9 in bar 6 of *Autumn Leaves* → V7, D Phrygian Dominant; the same symbol in another bar may read V7/iv). A quality's default appears only where the analysis doesn't reach. |
| The scale list under a chord: default ✓, alternates, Outside, Any scale. | `ChordChoices` as it is today: the **analysed** scale first (choosing it blanks the cell), the quality's usual, inside, outside, any scale by search; a pinned scale shows the pin and **Unpin**. |
| The numeral label opens the "Why". | While editing, the numeral opens the **function** list (Auto, then the functions that fit, each with the scale it gives), with the Why under it; the scale label opens the scale list. Read mode keeps the Why popover. |

Everything else in the mockup holds, and part of it has shipped already (proposal B stage 3): tapping a chord on the
sheet opens `SheetChordEditor` (a popover from `md` up, a bottom sheet below) with the chord's text and its
`ChordChoices`; the selected chord is outlined; the phone has light edits only. This spec is the **remaining
distance** from that to mockup A, on larger screens.

## Decisions

Recommendations, in the order they matter. Each is referenced from the section that depends on it.

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | Does the sheet editor replace the bar grid? | **No: a second editing surface over the same doc.** The grid (`BarEditor`, its inspector) stays as the structural overview and the keyboard-first path. Retiring it is a later decision, after the sheet editor has been used. **Amended after sign-off (2026-10-11): yes, from `md` up.** The sheet is the editor there; the Chart pane (grid, inspector, heading fields, its Undo/Redo/Save/⋯) is not rendered from `md` up, and stays below `md` (heading fields, D8) and on a chart over a size limit. Save moved into the banner. The field walks chords with ← → (D5). The code stays until a later PR deletes it; Paste bars, Repeat a section, Rename section, Time and the Details fields are in the Source alone meanwhile. **Deleted 2026-10-12 (#141, PR #146); the sheet versions of those actions are #142.** | Two surfaces share every engine operation and `ChordChoices`, so the cost is UI only. The grid is where whole-tune entry (type, Tab, type) is fastest and where a screen reader has a real grid. Amendment: with the toolbar, ghost bars and the heading in place, the sheet covered the grid's daily use, and two surfaces for one doc read as clutter. |
| D2 | Pitch while editing a transposed part. | **Concert pitch, the chart's own, while the editor is open**; a banner says so ("Concert pitch while you edit · your B♭ part comes back when you're done"). Done restores the part. | What you type is what the chart stores (proposal B, decision 1); a field that prints A7 and stores G7 is a trap, and the pickers' scales are concert already. |
| D3 | Guide tones, numerals and scales while editing. | **Stay as the viewer set them.** The chord positions come from the drawing either way. Numerals and scales are forced **on** while editing (they are the pickers). | Changing the view on Edit is one surprise too many; the mockup turned guide tones off only to keep its drawing simple. |
| D4 | What a completion shows. | The candidate's **numeral → scale in this bar**, from the analysis, computed by trying the candidate in the doc (`chordPreview`). Six at most, matched on the quality typed after the root; the typed text is always the first row, as is. | Measured over all 242 library charts: a candidate costs 0.6 ms on average, 2.2 ms at worst, so six per keystroke is under the frame budget. |
| D5 | Keys in the field. | **Enter** and **Tab** commit; Tab then opens the next bar's first chord (over line ends; ⇧Tab the previous). **→** with the caret at the end of the text (or the text selected, as the field opens) and **←** at its start commit and open the next or previous chord, through the bar and then into the next bar's (added 2026-10-11, with the D1 amendment; inside the text the arrows move the caret, ↑ ↓ stay on the completions). **Space** commits and adds a chord to the bar on its next free beat (two chords split 2 + 2, as the format means; a third is allowed, as `setBarChords` allows). **Esc** cancels. Blank takes the chord out; `%` is the bar before, as the grid has it. | The same vocabulary as the grid (`chordsAfterTyping`), so one habit serves both. |
| D6 | Where the pickers open. | In a popover anchored to the label (as `ChangesNote` is today), holding the one `ChordChoices` part: function from the numeral, scale from the scale label, each with Why under it. | One component, three doors. The bottom sheet below `md` keeps all three together, as now. |
| D7 | The bar toolbar's look. | The site's popover surface (white / zinc-800, `ring-1 ring-zinc-950/10`, `shadow-lg`), not the mockup's dark pill: + before, + after, Split, Delete, ⋯ (Key change here, 1st / 2nd ending, Segno, Coda, Jump…, New section here). It shows for the hovered bar and for the bar whose chord has focus, and it is in the Tab order after that bar's chords. | One depth strategy on the page. Every action is the inspector's, by name, so the two surfaces never disagree. |
| D8 | Phones (below `md`). | **Unchanged**: tap a chord → the bottom sheet; no inline field, toolbar, ghost bars or heading fields; the note "Full editing works on a larger screen" stays. | Decided in the proposal (2026-10-11): phone use is reading, transposing and fixing a chord. |
| D9 | Flag. | `leadSheetEditor` in `runtimeConfig.public.features`, **off**; on in e2e builds, as every flag is. Off, the sheet keeps today's tap-to-edit. | CLAUDE.md. |
| D10 | Repeats. | A chord in a folded repeat ("A1 · A2") or a written-out one ("A3 (= A1)") edits its source row (`ChangesChord.line` already points there); the field's hint line says "A2 repeats A1: a change here changes A1 and every repeat of it", as the bottom sheet does. The toolbar on a repeat's bar offers **Write out** (`writeOutCopy`) and nothing else. | Structure edits inside a `@copy` have no row to land on. |
| D11 | Printing. | Every editing mark is `print:hidden`: banner, field, toolbar, ghosts, heading fields, dotted underlines (already). Print from the editor prints the sheet as it reads. | Existing pattern on the sheet. |
| D12 | New engine code. | `engine/src/completions.ts`, pure: `chordCompletions(text, limit)` and `chordPreview(doc, section, bar, chords, index, view)`. Exported from `index.ts` (the API snapshot test updates). No change to any existing function. | Keeps the view logic that can be pure in the engine (CLAUDE.md). |

## Design direction

**Intent.** A player at a desk with a tune half-remembered and the sheet in front of them. They want to fix bar 6,
hear whether it's V7 or V7/iv, and keep looking at the music. It should feel like **writing on the lead sheet**, not
filling in a form: the paper stays still, the pencil marks are quiet, and the only thing that moves is what you touch.

**Hierarchy.** The chord being edited is the focal point: the same 16 px / 600 as its neighbours, grown a 2 px accent
ring, with its completion list under it. Everything else keeps the sheet's three-tier type (chord 16/600 · numeral
14/500 · scale 11/400, the sheet's own) and nothing else gains contrast. The toolbar and ghost bars are the quietest
tier: dashed or muted until hovered.

**Palette.** The site's: `zinc` (the navy-tinted neutrals), `note` (the one accent, for "this opens" and "this is
selected"), amber for a problem or a guess. No new colours.

**Depth.** Popovers and the toolbar on the site's one surface recipe (ring + shadow). No second strategy.

**Typography and spacing.** Jost, the sheet's sizes; 4 px base. The field's padding is the chord button's (`px-1`), so
the symbol doesn't shift when it becomes editable.

**Signature** (five places the sheet-as-editor can be recognised):
1. the chord field sits **on its beat**, over the slash, sized to its text, and the completions under it read
   `D7♭9 · V7 → D Phrygian Dominant`: harmony, not a dropdown;
2. a function the rules **only guessed** (`ChangesChord.fallback`) gets an amber dotted underline while editing, an
   invitation to state it (the analysis's own "an @key or a function would settle it", shown where it applies);
3. a **pinned** scale shows the map-pin glyph before its name, as the inspector does;
4. the **ghost bar** is a dashed box the width of a bar, aligned to the staff's last barline, with "+ bar" in it;
5. the heading fields are the printed title, subtitle, key and composer with a dashed underline, not boxes.

**Rejected defaults.** A modal chord dialog → the field on the beat. A dark floating toolbar (the mockup's) → the
site's light popover surface (D7). A generic autocomplete of chord names → completions that run the analysis (D4).

## 1. The editor on the sheet (from `md` up, flag on)

Edit (next to the title) opens the editor as today. With the flag on, on screens from `md` up:

- A banner over the sheet (`note-800`, white text, as the mockup): **Editing the sheet** · the concert-pitch line
  (D2; omitted for a concert instrument) · Undo · Source · **Done**. Undo is the existing `useChartHistory`; Source
  toggles the ⋯ menu's Source pane; Done is the toolbar's Done.
- The sheet shows concert pitch (D2): `ChangesSheet` gets `part` = concert while `sheetEditing`; the Scales sheet is
  untouched.
- Numerals and scales are shown (D3) whatever `csm-numerals` / `csm-scale-names` say; the toggles are disabled with
  a title saying why. The preferences are not changed.
- The bar grid pane stays where it is (D1; since the D1 amendment it is not rendered from `md` up). The chord being
  edited is the one outlined on the sheet (`selectedLine`).

### 1.1 The chord field

Clicking a chord (the existing button, "Edit Dm7, A bar 3") replaces it **in place** with a field:

- An `<input>` in the chord's own absolutely placed `div` at `left: x%`, `font-semibold text-base`, `px-1`, `ring-2
  ring-note-500`, white / zinc-900 background, `w-[max(3ch,<n>ch)]` from the draft's length; `autocomplete`,
  `autocapitalize` and `spellcheck` off. Its label: "Chord, A bar 3".
- The text is selected on open. Typing edits a **draft**; the doc is not written until commit (D5), so one chord is
  one undo step, and `setLineChord`'s refusals happen once.
- Under the field, the chord's numeral and scale show **the draft's reading** (`chordPreview`), in the muted tier
  and italic, settling to the usual weight on commit: "is it V7 or V7/iv?" is answered where you look. A draft that
  can't be read shows the labels blank.
- A hint line in the completion list's foot: `Tab` next bar · `Space` 2nd chord · `Esc` cancel; and the repeat note
  (D10) when the chord is a repeat's.

**Commit** (Enter, Tab, Space, or focus leaving the field): the draft, trimmed, goes through `cellError`, then
`setLineChord(doc, line, text)`. A refusal ("A section's first chord can't be taken out", "The chart can't take that
chord here") keeps the field open, the text as typed, with the message under it in `UiErrorMessage` and announced
(`said`). An unknown chord (not in `chord_scales.json`) is **accepted** and gets the amber underline the grid gives,
with the bottom-sheet's note ("isn't a chord I know…") in the popover when its label is opened.

**Tab / ⇧Tab** after a commit opens the field on the next / previous bar's first chord (`moveInGrid(view, pos,
'right' | 'left')` over `barView(doc)`, then the chord's `line`), scrolling it into view; from the last bar, Tab
leaves the field and focus lands on that section's ghost bar. **Space** commits, then reopens the field empty in a **new**
chord slot at the bar's next beat (nothing is written yet: an empty chord is refused); that slot's commit writes
`setBarChords(doc, section, bar, [...chords, text])`, and Esc on it adds nothing. **Esc** restores the button with the chord as it was. **Blank** commits take the chord out (`setLineChord`
with ''), closing the field; the section's first is refused, as above.

### 1.2 Completions

As the draft changes, a listbox under the field (`role=listbox`, `aria-activedescendant`, ↑ ↓ to move, Enter to take,
the typed text always the first option):

- `chordCompletions(text, 6)` (D12): the root the user typed (`readChord`'s spelling, or the draft's leading letter
  and accidental), then each quality in `QUALITY_NAMES` whose symbol starts with the suffix typed, in the data's
  order; aliases that read as the same quality appear once. With no suffix, the six most common qualities (`7`,
  `m7`, `maj7`, `m7b5`, `7b9`, `dim7`). Formatting uses the site's glyphs (♭ ♯) for display and the plain text for
  the chart.
- Each option shows the candidate's symbol and `chordPreview(doc, section, bar, chords-with-candidate, index, view)`: `numeral → scale`
  (`V7 → D Phrygian Dominant`); a candidate the analysis doesn't reach shows the quality's default scale, muted;
  an unreadable one shows nothing.
- Taking an option commits it (as Enter does) and stays in the bar: the user may still Tab or Space.

### 1.3 The labels as pickers

While editing (and only then), the numeral and the scale under each chord are buttons that open a popover (the
`ChangesNote` anchor and placement, `panelShift`), holding `ChordChoices` for that `line` with one part open:

- **Numeral → Function**: the list from `functionChoices` (Auto first, then each function that fits, with the scale
  it gives); the Why under it. Choosing writes the function cell (`setRowField`), the scale follows by analysis,
  and the sheet redraws. The problem line (`RowNote.problem`) shows as today.
- **Scale → Scale**: the analysed scale first (blank cell), the usual, inside, outside, any scale by search; Pin /
  Unpin as in the inspector. The Why under it.
- The guessed-function mark (`fallback`, signature 2): the numeral's dotted underline is amber (`decoration-amber-500`)
  and its popover opens on the function list with the line "The rules could only guess here; stating the function
  settles it" above it, beside an **Accept guess** button that states the function Auto stands for
  (`FunctionChoice.accept`, PR function-field).
- **Other function** (PR function-field): under the function list, a field takes any function in full, as the chart
  cell would (`cellError`, then `parseFunction`); while the draft reads it shows the scale it would give, Enter writes
  it (a key prefix kept as typed) and clears the field, and a draft that doesn't read stays with the parser's message.
- A pinned scale (`source === 'written'`) shows `MapPinIcon` before its label (signature 3).
- Read mode (editor closed) keeps today's `ChangesNote` Why popovers unchanged.

### 1.4 The bar toolbar

For the bar under the pointer, and for the bar whose chord or field has focus, a toolbar appears above the bar's
first beat (D7), `print:hidden`, in the Tab order after that bar's chords: **+ before** (`insertHeldBar(doc, section,
bar)`), **+ after** (`insertHeldBar(doc, section, bar + 1)`, with the proposal's rule for a part's end), **Split**
(`setBarChords` with the chord twice, so the second half can be typed), **Delete** (`deleteBar`), **⋯** a menu (Headless
UI `Menu`): Key change here (`insertKeyChange`), 1st ending / 2nd ending (`toggleEnding`), Segno, Coda (`setMark`),
Jump… (`setNav`, with the text in a `BarDialog`), New section here (`splitSection`, name in a `BarDialog`). On a
repeat's bar: **Write out** only (D10). Every refused change leaves the doc as it was and says why in a `UiText`
under the toolbar and in the live region, as the grid does. The toolbar's buttons are labelled with the bar: "Insert a
held bar before A bar 8".

### 1.5 Ghost bar and + section

After each section's last bar, in the staff's line, a dashed box the width of a bar (signature 4): **+ bar**
(`insertHeldBar` after the section's last, before a part's rounding-out bars, as the grid's + Bar). Under the last line,
**+ section** opens the grid's `BarDialog` for a section (`addSection`). Both `print:hidden`, both focusable, both
quiet until hovered (`text-zinc-500`, `border-zinc-400` dashed → `note` on hover and focus).

### 1.6 The heading, where it prints

`SheetPages`' heading, while editing, swaps its title, subtitle, key and composer for `MetaInput` fields styled as the
printed text with a dashed underline (signature 5): the same validation, the same refusal display (the value stays,
flagged), the same `setDoc` path as `ChartHeadingFields`, which stays in the grid pane as it is. The key field is the
grid's key control (a listbox of the keys; a chart with no key shows "Pick the chart's key" there).

### 1.7 Phones

Below `md`, nothing in §1 applies (D8). The flag changes nothing there.

## 2. Engine (`engine/src/completions.ts`, D12)

```ts
/** chord symbols that complete `text`: the typed text first, then the root with each matching quality; at most `limit` */
export function chordCompletions(text: string, limit = 6): readonly string[]

/** how the chart would read a bar once its chords are `chords`: the numeral and scale of the one at `index`, at the view's level */
export function chordPreview(doc: ChartDoc, section: string, bar: number, chords: readonly string[], index: number, view?: ScaleView): Readonly<{ numeral: string | null; scale: string | null; readable: boolean }>
```

- `chordPreview` is `setBarChords` then `rowNotes(next, view)` on the bar's `index`-th row; `readable` is
  `readChord(chord) !== null`. A preview is of a bar's chords (not a line) so the new chord slot after Space previews
  the same way as a chord that exists (plan, Task 1). When `setBarChords` refuses (same doc back), the preview is the
  row as it is, with `readable: false`.
- Both pure; no Vue, no DOM; tests in `engine/src/__tests__/completions.test.ts`. The API snapshot gains the two names.

## 3. Site

| File | Change |
| --- | --- |
| `web/app/components/ChangesSystem.vue` | The chord button becomes `SheetChord` (new): button, or field with completions, with the draft's reading under it; emits `edit`, `commit`, `move`, `add`. The numeral and scale spans become `SheetLabelPicker` (new) while `editing`; `ChangesNote` otherwise. The bar toolbar (`SheetBarToolbar`, new) and the ghost bar per line. |
| `web/app/components/ChangesSheet.vue` | Props `editing`, `view`; passes the concert `part` while editing (D2); the + section under the last line; the heading fields in `SheetPages` while editing. |
| `web/app/components/EditorView.vue` | The banner; `sheetEditing && leadSheetEditor && wide` decides field vs. `SheetChordEditor`; forces numerals and scales on (D3); the `move`/`add` handlers over `barView`/`moveInGrid`. |
| `web/app/components/SheetChordEditor.vue` | Unchanged: the phone's bottom sheet and the flag-off path. |
| `web/app/components/ChordChoices.vue` | A `part` prop (`'function' | 'scale' | 'all'`) so a popover opens one section; `fallbackNote` slot or prop for the guessed-function line. |
| `web/app/utils/sheetChordEdit.ts` | `nextChordLine(doc, line, dir)` thin wrapper over `barView` + `moveInGrid` + `posOfLine` for the Tab moves (pure, tested). |
| `web/nuxt.config.ts` | `leadSheetEditor: false` with its comment; `web/package.json` e2e script sets `NUXT_PUBLIC_FEATURES_LEAD_SHEET_EDITOR=true`. |
| `docs/design.md` §4 | A "Lead-sheet editor" bullet after "Tap to edit", with D1–D12 in one paragraph each. |

## 4. Tests

- **Engine:** `chordCompletions` (root spelling kept, `Bb` stays flat; suffix matching; limit; typed text first;
  an unreadable text returns just itself). `chordPreview` (a V7 in a minor key reads Phrygian Dominant; a refused
  edit previews the row as it is; a function stated on the row is respected). Golden untouched (`make golden` not
  needed).
- **Web unit (`web/test/`):** `SheetChord`: open selects the text; Esc restores; Enter commits once; a refused
  commit keeps the field and shows why; Space emits `add`; Tab emits `move`; the preview labels follow the draft.
  `SheetLabelPicker`: the numeral opens the function list, the scale opens the scale list; the amber mark on
  `fallback`. `nextChordLine` over a two-section chart with a `@copy`.
- **e2e (`web/e2e/sheet-edit.spec.ts`, extended):** type `D7b9` into bar 6 with completions showing `V7 → D Phrygian
  Dominant` and take one; Tab moves to bar 7; Space adds a second chord and the sheet shows the split; the numeral
  opens Function and choosing one changes the scale under the chord; the scale label pins and the pin shows; the
  toolbar inserts and deletes a bar and the bar numbers follow; the ghost bar adds one; the title is edited in place;
  a B♭ instrument shows concert pitch with the banner while editing and the part after Done; print preview hides every
  mark (`page.emulateMedia({ media: 'print' })`); at 390 px nothing of this appears and the bottom sheet still works.

## 5. Rollout

Each a PR; `make test`, `make lint`, `make e2e` green; the flag off until the last.

1. **Engine:** `completions.ts`, tests, API snapshot.
2. **The field** (flag): `SheetChord` with completions and the draft's reading; concert pitch and the banner; the
   Tab/Space/Esc moves; e2e for them.
3. **The pickers:** `SheetLabelPicker`, the `part` prop on `ChordChoices`, the guessed-function mark, the pin.
4. **Structure:** the bar toolbar, the ghost bar, + section.
5. **The heading** in place.
6. **Sign-off:** flag on in `nuxt.config.ts`; `docs/design.md`; then a short note deciding the grid's future (D1).
   Decided 2026-10-11: hidden from `md` up (the D1 amendment); deletion a later PR.

## Risks

- **Positions come from VexFlow** (`xs` per line): the field is placed where the button was, so it needs no extra
  measurement; a commit redraws the line and the field, keyed by `line`, moves with it. A Space that changes a bar's
  beats moves the first chord's x too; the field stays mounted.
- **Analysis per keystroke:** six candidates at ≤ 2.2 ms each on the worst library chart (measured on
  `a_night_in_tunisia`); a chart at the input limits (1,000 expanded rows) is slower, so the preview is debounced by a
  frame (`requestAnimationFrame`) and skipped while a draft is unreadable.
- **Two surfaces, one doc** (D1): an edit on the sheet must select the chord in the grid and the reverse; both already
  go through `selectedLine`.
- **Guide tone line on:** the labels row sits lower (the guide labels are between); the popover anchors to the label,
  so nothing changes, but the e2e should cover it once.

## Out of scope

- Retiring `BarEditor`, `BarInspector` or `ChartHeadingFields` (D1).
- Editing on phones beyond today's bottom sheet (D8).
- Converting written pitch to concert on entry (D2 forces concert instead).
- Editing a `@copy` section's bars in place (Write out first, D10).
- Narrowing the engine's public API, the scale level's design, the format.
