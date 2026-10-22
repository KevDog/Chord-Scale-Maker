# Edit Alternate Changes in the Sheet Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charts with alternate changes become editable from the Changes sheet: an editable alt line in Standard
view, set-aware chord / scale / function edits in Alternate view, and bar edits that keep both sets intact (#469).

**Architecture:** All doc edits stay pure in `engine/src/edit.ts`. Structural ops learn `altRow` (they move with
their bars). Chord edits take a `set`: the Alternate set's writes go through a new `setAltBarChords`, which owns
the redundancy rule. The app draws from the played doc (`changesFor`) but **writes against the real doc**
(`editor.doc`). The line-count invariant of `changesFor` means a played line index is the same line in the real
doc. So editing components get `source` (the real doc) and `set` props beside `doc` (the drawn doc). Standard view
passes the real doc as `doc` too: layout already ignores `altRow`.

**Tech Stack:** TypeScript strict, Vitest, Vue 3 / Nuxt, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-edit-alternates-design.md`

## Global Constraints

- Engine pure: no Vue/DOM in `engine/`. New engine exports go in `engine/src/index.ts`; update the
  `api.test.ts` snapshot (`npx vitest -u engine/src/__tests__/api.test.ts`, then review it).
- `make golden` must show **no diff** (no library chart text changes). A diff is a bug.
- An alt bar is redundant when removing its `alt` rows leaves the Alternate set playing the same chords,
  scales and functions there. Checked only in `setAltBarChords`, never as cleanup in other ops.
- Empty input in an alternate edit removes the bar's `alt` rows. An alternate is never held.
- `copy:` sections: no alt edits (`writtenBar` already refuses them). Their alternates show read-only.
- Phones (below md): no alt-line targets. They edit via Alternate view + the chord sheet.
- UI from `web/app/components/ui/`; hashed CSP; alt targets are `<button>`s labelled
  `Alternate for {section} bar {bar}`; `make a11y` clean.
- Flag `alternates` off: no alt line; sheet edits act on the real doc and keep `alt` rows.
- Stage files by name; commit after each task; `make test` green before each commit.

## Review Focus

1. **Standard edit on an alt bar's chords:** retyping the standard chord of bar 2 leaves `alt 2` rows untouched
   (Task 1 test `setBarChords keeps alt rows`).
2. **Delete the bar before an alt bar:** the alt rows renumber with their bar, and none are lost or duplicated
   (Task 1 test `deleteBar moves alt rows`).
3. **Alternate carried into a held bar:** typing into a held standard bar after an alt bar writes an alt row
   even when it equals standard's carried chord, because removing it would change what Alternate plays
   (Task 2 test `keeps an alt that stops a carry`).
4. **Retype a shared bar in Alternate view back to what it was:** no alt rows get written (Task 2 test
   `same as played: no alt rows`).
5. **Scale picked on an alt chord in Alternate view:** it writes the `altRow`, not the standard row
   (Task 1 test `setRowField sets an altRow`; Task 4 e2e).

---

### Task 1: Structural ops and row fields know `altRow`

**Files:**
- Modify: `engine/src/edit.ts` (`setRowField`, `setRowChord`, `withCanonicalScales`, `shiftBars`, `splitSection`, `writeOutCopy`)
- Test: `engine/src/__tests__/barEdit.test.ts`, `engine/src/__tests__/edit.test.ts`

**Interfaces:**
- Produces: `setRowField(doc, i, field, value)` and `setRowChord(doc, i, chord)` act on an `altRow` at `i`
  the same as on a `row`. Every bar op keeps `alt` rows with their bars.

- [ ] **Step 1: Write the failing tests** (use the fixture `section: A\n1 | C\n2 | Dm7\n2 | G7\nalt 2 | Abm7\nalt 2 | Db7\n3 | C\n4 | F\n`, written out with `serializeChart` for assertions)
  - `setBarChords keeps alt rows`: `setBarChords(d, 'A', 2, ['Dm9'])` → the text has `2 | Dm9` and both `alt 2` rows, and no `2 | G7`.
  - `insertBar moves alt rows`: `insertHeldBar(d, 'A', 1)` → `alt 3 | Abm7`, `alt 3 | Db7`.
  - `deleteBar moves alt rows`: `deleteBar(d, 'A', 1)` → `alt 1 | Abm7`; `deleteBar(d, 'A', 2)` → no `alt` line at all.
  - `splitSection carries alt rows`: `splitSection(d, 'A', 2, 'B')` → section B holds `alt 1 | Abm7`, `alt 1 | Db7`; A has none.
  - `writeOutCopy writes alt rows`: on `d` + `\nsection: A2\ncopy: A\n`, `writeOutCopy(_, 'A2')` → A2 has `alt 2 | Abm7`, `alt 2 | Db7`; `changesFor(_, 'alternate')` plays the same chords as before.
  - `setRowField sets an altRow`: the index of `alt 2 | Abm7` → `setRowField(d, i, 'scale', 'Ab Dorian')` gives `alt 2 | Abm7 | Ab Dorian`; `'function'` likewise.
  - `sameChart canonicalises alt scales`: `alt 2 | Abm7 | Ab Half-Whole` vs `… | Ab Half-Whole Diminished` → `true`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/barEdit.test.ts src/__tests__/edit.test.ts`
Expected: the new tests FAIL; the old ones pass.

- [ ] **Step 3: Implement**
  - `shiftBars`: `case 'altRow'` falls through with `case 'row'`.
  - `splitSection`: its `moves` and `renumber` treat `altRow` as `row`.
  - `writeOutCopy`: after the copied rows, append the source section's `altRow` lines (same bars, scale,
    function; no comment).
  - `setRowField` / `setRowChord` / `withCanonicalScales`: accept `row | altRow`, and keep the kind.

- [ ] **Step 4: Run the tests to verify they pass.** Run the same command. Expected: all PASS. Then `make test`.

- [ ] **Step 5: Commit** — `git add engine/src/edit.ts engine/src/__tests__/barEdit.test.ts engine/src/__tests__/edit.test.ts`, message `Edit: bar ops and row fields keep alt rows (#469)`.

### Task 2: `setAltBarChords` and set-aware chord edits

**Files:**
- Modify: `engine/src/edit.ts`, `engine/src/index.ts`, `engine/src/__tests__/__snapshots__/api.test.ts.snap`
- Test: `engine/src/__tests__/alternates.test.ts` (new `describe('setAltBarChords')`)

**Interfaces:**
- Consumes: Task 1.
- Produces (exported):
  - `altBarChords(doc: ChartDoc, section: string, bar: number): readonly string[]`. The bar's `alt` rows'
    chords, `[]` when the bar has none.
  - `setAltBarChords(doc: ChartDoc, section: string, bar: number, chords: readonly string[]): ChartDoc`. It
    replaces the bar's `alt` rows with `chords` (`[]` removes them), then drops them again if they are
    redundant (Global Constraints). It returns the same doc where the bar isn't a written one or a chord fails
    `cellError`.
  - `setBarChordsIn(doc: ChartDoc, set: ChangesSet, section: string, bar: number, chords: readonly string[]): ChartDoc`.
    Standard → `setBarChords`. Alternate → `setAltBarChords`.
  - `setLineChordIn(doc: ChartDoc, set: ChangesSet, i: number, text: string): ChartDoc`. Like `setLineChord`,
    except that `posOfLine` and `chordsAfterTyping` read `barView(changesFor(doc, set))`, so `%` copies that
    set's bar before. The write goes through `setBarChordsIn`.

- [ ] **Step 1: Write the failing tests** (on `BASE` from the file)
  - `adds an alternate`: `setAltBarChords(d, 'A', 3, ['Ebmaj7'])` → `alt 3 | Ebmaj7` comes after the `3 | C` row, and `altBarChords(_, 'A', 3)` is `['Ebmaj7']`.
  - `replaces and removes`: bar 2 → `['Abm7']` leaves a single `alt 2` row; `[]` leaves none.
  - `same as played: no alt rows`: `setAltBarChords(d, 'A', 1, ['C'])` returns a doc equal to `d`.
  - `keeps an alt that stops a carry`: on `section: A\n1 | Cmaj7\nbars: 2\nalt 1 | Dm7\n`, `setAltBarChords(_, 'A', 2, ['Cmaj7'])` keeps `alt 2 | Cmaj7`.
  - `copy sections refused`: a bar of a `copy:` section → same doc.
  - `setLineChordIn alternate on a shared bar`: the `3 | C` line index, `setLineChordIn(d, 'alternate', i, 'E7')` → `alt 3 | E7` is added and `3 | C` stays.
  - `setLineChordIn standard`: equals `setLineChord`.
  - `% copies the set's bar before`: in alternate, `setLineChordIn(d, 'alternate', <bar 3 line>, '%')` → `alt 3` rows `Abm7`, `Db7`.

- [ ] **Step 2: Run them to verify they fail.** Run: `cd engine && npx vitest run src/__tests__/alternates.test.ts`. Expected: FAIL (not exported).

- [ ] **Step 3: Implement** in `edit.ts` (importing `changesFor`, `ChangesSet` from `./alternates`). New alt rows go
  right after the bar's last `row`/`altRow` in its block, else at `rowSlot`. An alt chord takes the scale and
  function of the Alternate set's chord it replaces by position, under `setRowChord`'s keep-or-drop rule.
  Redundancy: compare `barView(changesFor(x, 'alternate'))`'s chords (chord, scale, function) at that bar,
  between the doc with and the doc without the new rows. Export the four functions from `index.ts` and update
  the API snapshot.

- [ ] **Step 4: Run them to verify they pass**, then `make test`.

- [ ] **Step 5: Commit** — `git add engine/src/edit.ts engine/src/index.ts engine/src/__tests__/alternates.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap`, message `Edit: set-aware chord edits and setAltBarChords (#469)`.

### Task 3: Sheet editing on for charts with alternates (writes against the real doc)

**Files:**
- Modify: `web/app/components/EditorView.vue`, `ChangesSheet.vue`, `ChangesSystem.vue`, `SheetChord.vue`, `SheetBarToolbar.vue`, `SheetLabelPicker.vue`, `ChordChoices.vue`, `SheetChordEditor.vue`
- Test: `web/test/ChangesSystem.test.ts` (or `ChangesSheet.test.ts`), `web/e2e/alternates.spec.ts`

**Interfaces:**
- Consumes: `setBarChordsIn`, `setLineChordIn`, and Task 1's `setRowField`.
- Produces: optional props `source?: ChartDoc` (default: `doc`) and `set?: ChangesSet` (default `'standard'`) on
  `ChangesSheet`, threaded through `ChangesSystem`, to `SheetChord`, `SheetBarToolbar`, `SheetLabelPicker` →
  `ChordChoices`, and `SheetChordEditor`. Reads and analysis use `doc`. Every emitted `update:doc` is computed
  from `source`: chord typing via `setBarChordsIn(source, set, …)` / `setLineChordIn`, scale and function via
  `setRowField(source, line, …)`, bar ops via the same op on `source`.

- [ ] **Step 1: Write the failing tests**
  - Unit (`ChangesSystem.test.ts`): with `doc = changesFor(real, 'alternate')`, `source = real` and `set = 'alternate'`, committing `E7` on bar 3's chord emits a doc whose text has `alt 3 | E7` and `3 | C`.
  - e2e (`alternates.spec.ts`), on a My charts copy of a library chart that has alternates (the one the file already uses):
    1. With Edit on, the main chords are editable buttons and the Source isn't forced open.
    2. In Standard, retyping bar 1's chord keeps the Changes control.
    3. In Alternate, retyping a shared bar makes the Other changes line show the standard chord there.
    4. In Alternate, picking a scale on an alt chord writes `alt … | … | <scale>` (check the Source text).
    5. `+ after` on a bar before an alternate keeps it, renumbered (Source).

- [ ] **Step 2: Run them to verify they fail.** Run: `cd web && npx vitest run test/ChangesSystem.test.ts`; `make e2e` (or `npx playwright test e2e/alternates.spec.ts`; see memory *e2e port shared*). Expected: FAIL.

- [ ] **Step 3: Implement**
  - In `EditorView`, `sheetEditing` and `sourceOffered` drop their `hasAlternates` clauses.
  - `ChangesSheet` gets `:doc="mainSet === 'alternate' ? playedDoc : editor.doc.value"`, `:source="editor.doc.value"` and `:set="mainSet"`.
  - `SheetChordEditor` gets the played doc as `doc`, plus `source` and `set`.
  - Rewrite the stale comment above `<ChangesSheet>`, and the `sheetEditing` / `sourceOffered` doc comments.

- [ ] **Step 4: Run them to verify they pass**, then `make test`, `make e2e`.

- [ ] **Step 5: Commit** the files above by name, message `Sheet editing on for charts with alternates, set-aware (#469)`.

### Task 4: The editable alt line (Standard view, md and up)

**Files:**
- Create: `web/app/components/SheetAltChord.vue`
- Modify: `web/app/components/ChangesSystem.vue`, `ChangesSheet.vue`, `EditorView.vue`
- Test: `web/test/SheetAltChord.test.ts`, `web/e2e/alternates.spec.ts`, `web/e2e/a11y/` (the editor scan)

**Interfaces:**
- Consumes: `altBarChords`, `setAltBarChords`, `otherChords`.
- Produces: `SheetAltChord` props `{ source: ChartDoc; section: string; bar: number; text: string; open: boolean }`,
  emits `update:doc`, `said`, `refused`, `next` (Tab), `prev` (Shift+Tab), `close`. While closed, it's a button
  showing `text` small, or a faint `+ alt` when `text` is empty. While open, it's an input holding
  `altBarChords(source, section, bar).join(' ')`, parsed and refused like a main bar's text.
  - Enter or Tab commits via `setAltBarChords`, then Tab opens the next written bar's target (Shift+Tab the
    previous one).
  - Esc cancels. ← / → move the caret in the field (one field per bar, my call).
  - `ChangesSystem` gets `altEditing?: boolean` and draws a `SheetAltChord` above every written bar of a
    non-`copy:` section, in the small line's slot. Bars of `copy:` sections keep today's read-only small
    chords.

- [ ] **Step 1: Write the failing tests**
  - Unit `SheetAltChord.test.ts`:
    - Typing `Ebm7 Ab7` + Enter emits a doc with `alt N | Ebm7` and `alt N | Ab7`.
    - An empty commit removes the bar's alt rows.
    - Typing the standard chords emits no alt rows.
    - Esc emits `close` and no doc.
    - The button's accessible name is `Alternate for A bar 3`.
  - e2e:
    - On a chart with no alternates, with Edit on (wide), clicking `Alternate for A bar 2` and typing `Abm7` + Enter makes the Changes control appear.
    - Tab moves to `Alternate for A bar 3`.
    - Clearing it again takes the control away.
    - At 390px wide there are no `Alternate for …` buttons.
  - a11y: the editor scan on a chart with alternates and Edit on stays clean.

- [ ] **Step 2: Run them to verify they fail.**

- [ ] **Step 3: Implement**
  - In `EditorView`: `altEditing = alternatesFlag && sheetEditor && mainSet === 'standard'`.
  - While `altEditing`, the small line shows whatever the `Other changes` toggle says, and also on charts with
    no alternates yet.
  - In Alternate view the small line stays read-only (Standard's chords).
  - Focus moves along the bars through `next`/`prev`, the way `SheetChord`'s Tab does.

- [ ] **Step 4: Run them to verify they pass**, then `make test`, `make e2e`, `make a11y`.

- [ ] **Step 5: Commit**, message `Sheet editor: the alternate line, typed bar by bar (#469)`.

### Task 5: Docs, decision, release note

**Files:**
- Modify:
  - `web/app/pages/help.vue`: in the `#alternates` section, replace "can't be edited bar by bar yet" with how to add, edit and remove alternates (the alt line, Alternate view, phones, the same-as-standard rule).
  - `docs/design.md`: in "Alternate changes", replace the "Sheet editing is off" bullet with the write-against-source model, `setAltBarChords` and redundancy.
  - `engine/src/decisions.ts`: a row `{ id: 'alt.same', title: 'An alternate the same as the changes', page: 'help', anchor: 'alternates', summary: 'A bar you give the same chords, scales and functions as it already plays isn’t kept as an alternate.' }`.
  - `web/app/utils/releaseNotes.ts`: one item, "Edit alternate changes on the sheet".
  - `README.md` only if its `alt` row needs it.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `make docs` and `make test`. Expected: PASS (the anchor test covers the new DECISIONS row).
- [ ] **Step 3:** Commit, message `Docs: editing alternate changes (#469)`. Then run `make golden` and confirm no diff.

PRs: Tasks 1–2 (engine), Task 3, Tasks 4–5. Each is queued with `gh pr merge N --auto --merge`, `Fixes #469` on the last.
