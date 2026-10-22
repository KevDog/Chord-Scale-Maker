# Alternate Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A library chart carries one set of alternate changes (`alt N | …` rows); a chart-wide Standard ⇄ Alternate
toggle picks which set every sheet plays, and the other set can be drawn small above the Changes staff.

**Architecture:** The parser gains one line kind, `altRow`. A pure engine function `changesFor(doc, set)` turns a
two-set doc into an ordinary one-set doc **with the same line count** (dropped lines become `blank`), so every
line-indexed thing downstream (analysis rows, `chordPositions`, `resolveScales`, saved reasons) works unchanged
and stays aligned with the original doc. The app derives `playedDoc` from the editor's doc and hands it to every
sheet; a second `buildChanges` over the other set feeds the small chord line.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4/Vue 3, Playwright, Catalyst UI components.

**Spec:** `docs/superpowers/specs/2026-10-21-alternate-changes-design.md`

## Global Constraints

- Engine stays free of Vue/DOM; app imports it only as `@chord-scale-maker/engine`; new exports update `engine/src/__tests__/api.test.ts` snapshot.
- Feature flag `alternates`, `false` in `web/nuxt.config.ts`; add `NUXT_PUBLIC_FEATURES_ALTERNATES=true` to the `e2e` and `a11y` scripts in `web/package.json`.
- Flag off: a chart with `alt` rows plays standard only, no toggle, no small line, identical to today. The engine always treats `alt` rows as real.
- Prerendered/SEO surfaces (OG image, song page text, JSON-LD, library, search) use the standard set: they read `expandRows`/`layout.ts`, which already ignore any non-`row` kind. Do not route them through `changesFor`.
- Defaults: main `standard`, alternates shown.
- View state is never written into the chart file.
- Sheet editor: a chart with alternates is not sheet-editable (`editable` false) until #469; the source text stays editable. (Plan's call: `edit.ts` ops don't know `altRow`.)
- Picks and practice selections are kept per set; undo history per chart; the toggle is not an undo step.
- TDD for engine work (memory: load superpowers:test-driven-development). `make test` green after every task; `make golden` + review the diff where engine output changes.
- Stage files by name; never `git add -A`.

## Review Focus

1. **Alt rows out of bar order** (`alt 8` written before bar 7's rows): expect a diagnostic, not a silently scrambled bar. → Task 1 test.
2. **Alt for a held bar** (standard bar 2 has no row; `alt 2 | X`): alternate set gets X on bar 2; standard unchanged. → Task 2 test.
3. **`copy:` of a section with alt rows** and `@ending`s: the repeat plays the alternate too, both sets have equal section lengths. → Task 2 test.
4. **Transpose with alternates** (Transpose… in the editor): alt chords move with the rest and keep their bars. → Task 3 test.
5. **Download → Open round trip** of a chart with alternates: text identical, alternates intact. → Task 1 test (serialize(parse(text)) === text with `alt` rows, column alignment included).

---

### Task 1: Parse and serialize `alt` rows

**Files:**
- Modify: `engine/src/chart.ts` (ChartLine union, `parseLine`, `parseChart` block checks, `serializeChart`)
- Test: `engine/src/__tests__/chart.test.ts`

**Interfaces:**
- Produces: `ChartLine` member `Readonly<{ kind: 'altRow'; bar: string; chord: string; scale: string; function?: string; comment?: string }>`; `hasAlternates(doc: ChartDoc): boolean` (exported from `chart.ts`).

- [ ] **Step 1: Write failing tests** (`describe('alt rows')`):
  - `parseChart('section: A\n1 | C\n2 | G7\nalt 2 | Db7')` → line 3 is `{ kind: 'altRow', bar: '2', chord: 'Db7', scale: '' }`, no diagnostics; `ALT 2 | Db7` reads the same.
  - `alt 2 | Db7 | Db Lydian Dominant | subV7  # keep: melody` keeps scale, function, comment.
  - Diagnostics: `alt` in a section with `copy:` → `a section with copy: has no bars of its own`; `alt` in the header → `bars go in a section: add  section: A  above`; `alt 1 | C` after `2 | G7` → `rows and alt rows go in bar order`; `alt 9` where the section's last bar is 8 (no `bars:`) → `alt bar 9 is past the section’s end (bar 8)`.
  - Round trip: a chart text with `alt` rows, function and comment cells: `serializeChart(parseChart(t).value) === t`; an alt row is `alt ` + the row as rows are formatted (same column widths, offset by the prefix). Charts without alt rows serialize byte-identically to today.
  - `hasAlternates` true/false.
  - `LIMITS.maxRows` counts `row` + `altRow` lines.
- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/chart.test.ts` → FAIL.
- [ ] **Step 3: Implement.** In `parseLine`, a body matching `/^alt\s+/i` (before row-cell parsing) parses the rest as a row and returns `kind: 'altRow'`. In `parseChart`'s block loop track `lastRowBar` (rows and alt rows) for the bar-order check; alt rows don't raise `block.lastBar`; on `closeBlock` report alt bars past the section's length. `serializeChart`: alt rows join the rows' width calculation and are written `alt ` + the formatted row. `tsc` will flag every exhaustive switch over `ChartLine.kind`: handle `altRow` like `comment` (pass-through) everywhere except `transpose.ts` (Task 3).
- [ ] **Step 4:** chart tests PASS; `make test` PASS (golden unchanged: no library chart has alt rows yet).
- [ ] **Step 5:** Commit `Chart format: alt rows (#215)`.

### Task 2: `changesFor` — one set as an ordinary doc

**Files:**
- Create: `engine/src/alternates.ts`
- Modify: `engine/src/index.ts`, `engine/src/__tests__/__snapshots__/api.test.ts.snap`
- Test: `engine/src/__tests__/alternates.test.ts`

**Interfaces:**
- Consumes: `altRow`, `hasAlternates` (Task 1).
- Produces: `export type ChangesSet = 'standard' | 'alternate'`; `export const CHANGES_SETS: readonly ChangesSet[]`; `export function isChangesSet(v: unknown): v is ChangesSet`; `export function changesFor(doc: ChartDoc, set: ChangesSet): ChartDoc` — same `lines.length`; `standard`: every `altRow` → `{ kind: 'blank' }`; `alternate`: in each section block, every `row` whose bar has an `alt` row → `blank`, every `altRow` → `row` with the same cells. A doc without alt rows is returned as is (same object).

- [ ] **Step 1: Failing tests:**
  - line count preserved for both sets; `changesFor(docWithout, 'alternate') === docWithout`.
  - `expandRows(changesFor(d,'alternate'))` for `1 | C / 2 | Dm7 / 2 | G7 / alt 2 | Abm7 / alt 2 | Db7 / 3 | C` → chords `C, Abm7, Db7, C`; standard → `C, Dm7, G7, C`.
  - held bar: `1 | C / alt 2 | Db7 / 3 | C`, `bars: 3` → alternate `C(1), Db7(2), C(3)`; standard `C(1), C(3)`.
  - `copy: A1` section repeats alternate rows; `@ending` sections keep equal lengths in both sets (`sectionLayout(…).value.lengths` equal).
  - `chordPositions(changesFor(d, set))` keys index rows that exist at those line indices in the original doc.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement in `alternates.ts`; export from `index.ts`; update the API snapshot (`npx vitest run src/__tests__/api.test.ts -u`, review).
- [ ] **Step 4:** PASS; `make test`.
- [ ] **Step 5:** Commit `Engine: changesFor plays one set of a chart's changes (#215)`.

### Task 3: Transpose alternates

**Files:** Modify `engine/src/transpose.ts:124-140`; Test `engine/src/__tests__/transpose.test.ts`

- [ ] **Step 1: Failing test:** `transposeChart(parse('key: C\nsection: A\n1 | Dm7\n1 | G7\nalt 1 | Db7'), 'C', 'F')` → line kinds unchanged, alt row chord `Gb7`, bar `1`.
- [ ] **Step 2:** FAIL. **Step 3:** treat `altRow` as `row` in `transposeChart` (transpose its cells, keep `kind`). **Step 4:** PASS. **Step 5:** Commit.

### Task 4: Analysis over both sets (`--save`, `--strip`, `--ambiguous`, refresh)

**Files:**
- Modify: `engine/src/analysis/index.ts` (`applyAnalysis`, `refreshAnalysis`), `engine/scripts/analyse.ts`
- Test: `engine/src/__tests__/analysis.test.ts`

**Interfaces:**
- Consumes: `changesFor`, `hasAlternates`.
- Produces: `applyAnalysis(doc, analysis, options, alternate?: Analysis)` — `alternate` is `analyse(changesFor(doc, 'alternate'))`; line indices align because `changesFor` keeps them. `analysis` is `analyse(changesFor(doc, 'standard'))` for a doc with alternates (callers pass it; `analyse(doc)` already ignores `altRow`, so it is the same).

- [ ] **Step 1: Failing tests:**
  - `--save`: `altRow` lines get the alternate analysis's reason as their comment; `row` lines and `# area:` lines keep the standard analysis's; a row reason is never duplicated.
  - `--strip`: a shared `row` with a written scale is blanked only when both analyses give that scale (fixture: a scale the standard rules give but the alternate context changes → kept, listed in `overrides`); an `altRow` scale is blanked when the alternate analysis gives it; `# keep:` never stripped.
  - `refreshAnalysis` on a doc with alternates rewrites alt-row reasons too.
  - Rerun of `--save` on its own output is a no-op (header date kept).
- [ ] **Step 2:** FAIL. **Step 3:** implement; in `analyse.ts`, for each chart with `hasAlternates`, compute both analyses, pass `alternate` to `applyAnalysis`, and run `--ambiguous` over both, prefixing the alternate's entries `alternate: `. **Step 4:** PASS. **Step 5:** Commit.

### Task 5: iReal import maps alternates

**Files:** Modify `engine/src/ireal/toChart.ts` (`play`, `Played`, the row emitter); Test `engine/src/ireal/__tests__/toChart.test.ts`

**Interfaces:** `Played` gains `alts: readonly string[] | null` — null when the bar has no alternate; else the bar's chords with each chord's `( )` in its place and a stand-alone alternate in its item position (mapped with `irealChord`).

- [ ] **Step 1: Update/replace tests:** the three tests expecting `the alternate chord … is left out` now expect `alt` rows: `C7(Db7)` in bar 1 → `1 | C7` + `alt 1 | Db7`; a stand-alone `(C7)` then `F7` in a bar → `alt` rows `C7, F7` and row `F7`; no "left out" diagnostics remain for alternates. An unmappable alternate chord still reports via `m.note`.
- [ ] **Step 2:** FAIL. **Step 3:** implement; emit each bar's `alt` rows right after its rows. **Step 4:** PASS; `make test`. **Step 5:** Commit `csm add: iReal alternate chords become alt rows (#215)`.

### Task 6: Library chart with alternates + golden

**Files:**
- Modify: one library chart (builder picks a tune whose Real Book prints alternates, e.g. `engine/charts/body-and-soul.txt`; verify the alternates against a published source and name it in `source:` or a comment), `engine/src/__tests__/goldenFixture.ts`, `engine/fixtures/golden.json`

- [ ] **Step 1: Failing test:** golden fixture adds, for every chart with `hasAlternates`, an entry `<slug>~alternate` built from `changesFor(doc, 'alternate')` with the same fields as other charts. Run `make golden` before adding the chart: no diff.
- [ ] **Step 2:** add `alt` rows to the chart; `cd engine && npm run analyse -- charts/<tune>.txt --save` then `--ambiguous`; no Song page gaps.
- [ ] **Step 3:** `make golden`; review the diff: only the new `~alternate` entry and the chart's text change.
- [ ] **Step 4:** `make test` PASS. **Step 5:** Commit.

### Task 7: The other set's chords for the small line

**Files:** Modify `engine/src/changes.ts`, `engine/src/index.ts`, API snapshot; Test `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Produces: `export type AltChord = Readonly<{ beat: number; written: string }>`; `export function otherChords(main: ChangesSheet, other: ChangesSheet): ReadonlyMap<string, readonly AltChord[]>` — keyed by `barKey(bar.at)`, only bars whose `written` chord list differs between the two sheets (a bar present in `main` with no chords in `other` maps to `[]`, drawn as nothing).

- [ ] **Step 1: Failing tests:** for the Task 2 fixture with a B♭ part, `otherChords(buildChanges(std, part), buildChanges(alt, part))` → one entry `'A 2'` → `[{ beat: 0, written: 'B♭m7' … }, { beat: 2, … }]` (written for the part); swapped arguments → the standard bar's chords; identical sheets → empty map.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit.

### Task 8: View preference, share link, flag

**Files:**
- Create: `web/app/composables/useChangesSet.ts`; Test `web/test/useChangesSet.test.ts`
- Modify: `engine/src/share.ts` (`ShareView`, `shareViewFrom`), `engine/src/__tests__/share.test.ts`, `web/nuxt.config.ts`, `web/package.json`

**Interfaces:**
- Produces: `useChangesSet(key?: string, initial?: Readonly<{ changes?: ChangesSet; altHidden?: boolean }>)` → `{ main: Ref<ChangesSet>; shown: Ref<boolean>; carryTo(otherKey: string): void }`, stored per chart as `csm-changes:<key>` `{ main, shown }`, removed when both are defaults (mirror `useScaleLevel`). `ShareView` gains `changes?: 'alternate'` and `altHidden?: true` (defaults omitted).

- [ ] **Step 1: Failing tests:** composable defaults `standard`/`true`; persists and reloads by key; `initial` wins and isn't saved; `carryTo`. Share: round trip keeps `changes`/`altHidden`; bad values dropped; an old link without them → standard, shown.
- [ ] **Step 2–4:** FAIL → implement (+ flag `alternates: false` with a comment naming #215; env var in `e2e`/`a11y`) → PASS.
- [ ] **Step 5:** Commit.

### Task 9: Wire the app: played doc, per-set state, toggle, small line

**Files:**
- Modify: `web/app/components/EditorView.vue`, `web/app/components/SheetRail.vue` (or the rail popover holding view prefs), `web/app/components/ChangesSheet.vue`, `web/app/components/ChangesSystem.vue`, `web/app/components/SheetHeading.vue`
- Test: `web/e2e/alternates.spec.ts`, `web/e2e/a11y/` (scan of a song page with the toggle)

**Interfaces:**
- Consumes: `changesFor`, `hasAlternates`, `otherChords`, `useChangesSet`, flag `alternates`.
- In `EditorView.vue`: `const alternatesOn = computed(() => useFeature('alternates') && hasAlternates(editor.doc.value))`; `const mainSet = computed(() => alternatesOn.value ? changesSet.main.value : 'standard')`; `const playedDoc = computed(() => changesFor(editor.doc.value, mainSet.value))`. Every read-only use of `editor.doc.value` that feeds a sheet, resolution, picks, positions, practice or sections reads `playedDoc.value`; edit handlers, heading fields, transpose, share/download keep `editor.doc.value`.
- Picks and practice per set: instantiate `useChordPicks` and `usePractice` twice — keys `practiceKey` and `` `${practiceKey}~alt` `` — and select by `mainSet`. Share links carry the main set's picks.
- `sheetEditing` is false when `alternatesOn`.
- `ChangesSheet` prop `alternates?: ReadonlyMap<string, readonly AltChord[]>`: computed in `EditorView` as `otherChords(buildChanges(playedDoc, …), buildChanges(changesFor(doc, other), …))` only when `alternatesOn && shown`; `ChangesSystem` draws each bar's alt chords small above the chord symbols at their beats, chord symbols only, printed.
- Toggle in the rail with the other view preferences, built from `SegmentedControl` (Standard / Alternate) and `ToggleButton` (Show the other changes); not rendered unless `alternatesOn`.
- `SheetHeading` shows "Alternate changes" under the subtitle when `mainSet === 'alternate'` (prints).

- [ ] **Step 1: Failing e2e** (`alternates.spec.ts`, on the Task 6 chart): toggle present; standard shows the alt chord small above its bar; flip → the alt chord drawn large, the standard chord small, heading reads "Alternate changes", Scales sheet lists the alt chord's staff; hide → small line gone; reload keeps the choice; a chart without alternates has no toggle; share link opens in the alternate set.
- [ ] **Step 2:** `make e2e` → FAIL (port 4174 shared across worktrees; see memory).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `make test`, `make e2e`, `make a11y` PASS; `make lint`.
- [ ] **Step 5:** Commit.

### Task 10: Docs, release notes, export

**Files:** `README.md` (Charts table: `alt BAR | chord …` row), `web/app/pages/help.vue` (alternates, the toggle, show/hide), `docs/design.md` (Alternates section: format, `changesFor`, line-count invariant, per-set picks, flag), `web/app/utils/releaseNotes.ts` (item)

- [ ] **Step 1:** write them; `make docs` PASS.
- [ ] **Step 2:** Export: Download/Open already carry `alt` rows verbatim (Task 1 round-trip test covers it). Comment on #466 (backup/restore) that its settings export must include `csm-changes:<key>` entries and per-set `csm-pent-picks:<key>~alt` / practice keys.
- [ ] **Step 3:** Commit; PR body `Closes #215`, then queue with `gh pr merge N --auto --merge`.
