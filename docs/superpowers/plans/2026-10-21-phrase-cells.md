# Phrase cells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Changes sheet's Cells line from one chord to a phrase: Order (#376), phrase targeting (#379, #380),
substitutes over a long dominant (#378), chromatic cells (#377), behind a new flag `phraseCells`.

**Architecture:** All music logic is pure TypeScript in `engine/src/cells.ts` (split into `engine/src/cellOrder.ts`
and `engine/src/cellPhrase.ts` where noted). `CellsLine` grows `order` and `phrase`; `cellsVoices` reads them, and
`cellsOf` gets the whole chord list (via `cellVoices`' existing `index` argument) so a slot can see the next chord.
The web side adds two preferences, a share-link suffix, an Order listbox and a Phrase toggle in Line options.

**Tech Stack:** TypeScript strict, Vitest (engine + web), Nuxt 4 / Vue 3, Playwright, Catalyst-in-Vue `Ui*` components.

**Spec:** `docs/superpowers/specs/2026-10-21-phrase-cells-design.md` (read it first; this plan does not restate the
musical rules).

## Global Constraints

- Flag `phraseCells` (`runtimeConfig.public.features`, `useFeature`), **off** in `web/nuxt.config.ts`, on in the
  `e2e` and `a11y` scripts of `web/package.json` (`NUXT_PUBLIC_FEATURES_PHRASE_CELLS=true`). Flag off → the Cells line
  is byte-identical to today (engine defaults: `order: 'as-written'`, `phrase: false`).
- Engine stays free of Vue/DOM; new exports go through `engine/src/index.ts` and `engine/src/__tests__/api.test.ts`'s
  snapshot (`npx vitest run -u` in engine for that file only, then review).
- Never hand-type note lists: cells are degrees read through the scale (`cellTones`); chromatic degrees spelled on the
  letter their number names.
- Preferences: `csm-cells-order` (`as-written` | `reversed` | `rotated` | `swapped`, default `as-written`),
  `csm-cells-phrase` (`on`/`off`, default on). Share link: `line=cells:<id>[~<order>][~free]`; bare `cells:<id>` = as
  written, phrase on.
- Chromatic ids: `1-n7-7-6`, `5-s5-6-7`, `b9-1-3-5`, `3-5-7-b9`, `ii-v-chromatic`.
- UI: the rail must not grow a row at 1440 px (`web/e2e/editor.spec.ts`) or on a phone (`web/e2e/phone.spec.ts`).
- Each numbered PR below: branch from origin/main, `make test lint`, `make e2e`, `make a11y` (web PRs), release-notes
  item or `Release notes: none — <reason>` (flag off: none until PR 5), `gh pr create`, then `gh pr merge N --auto --merge`.
- After an engine change run `make golden` and review the diff (expect none: the Cells line isn't in the fixture
  unless the diff says so).

## Review Focus

1. A rest mid-run: the slot before a rest is a run's last slot, so it plays the system cell and gets no substitute
   (test in Task 4 and Task 6).
2. 3/4 tunes and three-beat chords: turned-back or cut slots are never targeted, and A/B parity still counts them
   (test in Task 4).
3. A slash chord or a chord whose scale has no letter for a degree (pentatonic, diminished): targeting and Order must
   go through `cellTones`' chord-tone fallback, never throw (test in Task 2 and Task 4).
4. A dominant whose scale the chart writes keeps that scale in every slot (test in Task 6).
5. An old share link `cells:3rd-3rd` and a stored `csm-cells` from before still open, phrase on, as written; a link
   with an unknown suffix (`cells:3rd-3rd~bogus`) reads as `cells:3rd-3rd` (test in Task 3).

---

## PR 1: Order (#376), and the flag

### Task 1: the flag

**Files:**
- Modify: `web/app/composables/useFeature.ts:6` (add `'phraseCells'` to `Feature`)
- Modify: `web/nuxt.config.ts` features block (`phraseCells: false, // phrase cells: Order, Phrase, substitutes, Chromatic (#376–#380; docs/superpowers/specs/2026-10-21-phrase-cells-design.md)`)
- Modify: `web/package.json` `e2e` and `a11y` scripts (add `NUXT_PUBLIC_FEATURES_PHRASE_CELLS=true`)

- [ ] **Step 1:** make the three edits. Run `npm -w web run typecheck` (or `make test`): PASS.
- [ ] **Step 2:** commit `Flag phraseCells, off (#376)`.

### Task 2: Order in the engine

**Files:**
- Create: `engine/src/cellOrder.ts`
- Modify: `engine/src/cells.ts` (`CellsLine`, `cellsOf`, `cellsVoices`), `engine/src/index.ts`
- Test: `engine/src/__tests__/cellOrder.test.ts`, `engine/src/__tests__/cells.test.ts`

**Interfaces:**
- Produces:
  - `export type CellOrder = 'as-written' | 'reversed' | 'rotated' | 'swapped'`
  - `export const CELL_ORDERS: readonly CellOrder[]`, `export const CELL_ORDER_LABELS: Readonly<Record<CellOrder, string>>`
    (`As written`, `Reversed`, `Rotated`, `Pairs swapped`), `export const isCellOrder: (x: unknown) => x is CellOrder`
  - `export type PartialContour = readonly ('u' | 'd' | null)[]` (null: decided per slot, "the nearer way")
  - `export function orderCell(cell: Cell, order: CellOrder): Readonly<{ degrees: readonly number[]; contour: PartialContour }>`
  - `export function fillContour(tones: readonly Spelled[], contour: PartialContour): Contour` (in `cells.ts`): each
    null move the nearer way, a tritone up.
  - `CellsLine` becomes `Readonly<{ kind: 'cells'; id: CellId; order?: CellOrder; phrase?: boolean }>`.

- [ ] **Step 1: failing tests** in `cellOrder.test.ts`:
  - `orderCell(cell('3 5 1 7','uud'),'reversed')` → `{ degrees: [7,1,5,3], contour: ['u','d','d'] }`
  - `'rotated'` → `{ degrees: [5,1,7,3], contour: ['u','d',null] }`; `'swapped'` → `{ degrees: [5,3,7,1], contour: [null,null,null] }`;
    `'as-written'` returns the cell's own degrees and contour.
  - `fillContour` over B G A F with `[null,null,null]` → `dud`; over C F♯ C F♯ → `uuu` (a tritone goes up); a given
    move is kept (`['d',null,null]` over G A B D → `duu`).
  - In `cells.test.ts`: `cellsVoices` with `{ kind:'cells', id:'1-2-3-5', order:'reversed' }` over one bar of G7 (C,
    treble) plays D B A G (pitch classes), contour `ddd`; with `order` absent the line equals today's (snapshot the
    existing expectation).
- [ ] **Step 2:** `npm -w engine exec -- vitest run src/__tests__/cellOrder.test.ts src/__tests__/cells.test.ts`: FAIL.
- [ ] **Step 3:** implement `cellOrder.ts`; in `cellsOf`, transform both cells of `pairOf(id)` by `line.order ?? 'as-written'`
  before `cellTones`, then `fillContour(tones, contour)` per slot. Export from `index.ts`.
- [ ] **Step 4:** run Step 2's command: PASS. Update the API snapshot (`npx vitest run -u src/__tests__/api.test.ts` in
  `engine/`), review it adds only the new names.
- [ ] **Step 5:** commit `Cells: Order, as written, reversed, rotated, pairs swapped (#376)`.

### Task 3: Order and Phrase preferences, share link, listbox

**Files:**
- Modify: `engine/src/share.ts:24-27` (`ShareLine`, `lineFrom`), `web/app/utils/sheetLine.ts` (`shareLineOf`,
  `changesLineOf`, `lineChoiceOf`), `web/app/composables/usePreferences.ts`, `web/app/components/PreviewControls.vue`,
  `web/app/components/EditorView.vue:466` (passes the new refs), `web/app/utils/interface.ts:22`
- Test: `engine/src/__tests__/share.test.ts`, `web/test/sheetLine.test.ts`, `web/test/usePreferences.test.ts`,
  `web/e2e/changes.spec.ts`

**Interfaces:**
- Consumes: `CellOrder`, `isCellOrder`, `CELL_ORDERS`, `CELL_ORDER_LABELS` (Task 2).
- Produces:
  - `ShareLine = SheetLine | \`cells:${CellId}\` | \`cells:${CellId}~${string}\``; `lineFrom` keeps a known order and
    `free`, drops unknown suffixes.
  - `shareLineOf(mode, guide, arpeggio, cells, order: CellOrder = 'as-written', phrase = true): ShareLine`
    (`~<order>` only when not as written, `~free` only when phrase off).
  - `lineChoiceOf(line)` also returns `order?: CellOrder; phrase?: boolean`.
  - `changesLineOf(c)` takes `order?: CellOrder; phrase?: boolean` and passes them on the `cells` choice.
  - `usePreferences()` returns `cellsOrder: Ref<CellOrder>`, `cellsPhrase: Ref<boolean>`; `linkPreferences` reads them
    from the link (absent → as written, on).

- [ ] **Step 1: failing tests:**
  - `share.test.ts`: `cells:3rd-3rd~reversed~free` round-trips; `cells:3rd-3rd~bogus` reads as `cells:3rd-3rd`;
    bare `cells:3rd-3rd` unchanged.
  - `sheetLine.test.ts`: `shareLineOf('cells','third','up-root','3rd-3rd','rotated',false)` = `'cells:3rd-3rd~rotated~free'`;
    `lineChoiceOf('cells:1-2-3-5~swapped')` = `{ mode:'cells', cells:'1-2-3-5', order:'swapped', phrase:true }`.
  - `usePreferences.test.ts`: defaults `as-written` and `true`; `csm-cells-phrase=off` reads false.
- [ ] **Step 2:** `make test`: those FAIL.
- [ ] **Step 3:** implement. In `PreviewControls.vue`, under the Approach `EaseReveal` (line ~166), add
  `<EaseReveal :show="phraseOn && lineMode === 'cells'">` holding a `UiListbox` (`aria-label="Order"`, selected label
  `Order: As written` when as written, like `approachLabel`) and, when the cell is a system (`id in CELL_SYSTEMS`), a
  `ToggleButton v-model="cellsPhrase" title="Aim each cell at the next chord, and colour long dominants">Phrase</ToggleButton>`
  (copy the Quartal `Perfect only` toggle at line ~108). `phraseOn = useFeature('phraseCells')`. With the flag off the
  web passes `order: 'as-written', phrase: false` to the engine and share links carry neither.
- [ ] **Step 4:** e2e in `changes.spec.ts`: choose `1 2 3 5`, Order `Reversed`: the line's `aria-label` contains the
  reversed cell (compute the expected from the engine test's notes); reload: Order still Reversed. The Phrase toggle
  shows for `3rd to 3rd`, not for `1 2 3 5`.
- [ ] **Step 5:** `make test lint`, `make e2e`, `make a11y`: PASS (editor.spec's 1440 rail and phone.spec unchanged).
- [ ] **Step 6:** commit; open PR 1 (`Release notes: none — behind phraseCells, off`; `Docs: none — flag off`).

## PR 2: Phrase targeting (#379, #380)

### Task 4: targeting in the engine

**Files:**
- Create: `engine/src/cellPhrase.ts`
- Modify: `engine/src/cells.ts` (`cellsOf` takes the chord list and index; `cellsVoices` passes `(c, i)`)
- Test: `engine/src/__tests__/cellPhrase.test.ts`

**Interfaces:**
- Consumes: `orderCell` (Task 2), `cellTones`, `CELL_SYSTEMS`, `SINGLE_CELLS`.
- Produces:
  - `export const PALETTE: readonly Cell[]` (the spec's order, 15 cells).
  - `export const isStep = (from: number, to: number): boolean` (pitch classes; 1 or 2 semitones either way).
  - `export function aimedCell(own: Cell, ownTones: readonly Spelled[], target: number, toneOf: (c: Cell) => readonly Spelled[] | null): Cell`:
    keep `own` if its last tone steps to `target`; else the first palette cell with `own`'s first degree whose last tone
    steps; else `own`.
  - In `cells.ts`, `Cells.next` for a phrase line computes the next slot's target from the next slot's chord: the same
    chord when `nth + 1` slots still fit in it, else `chords[index + 1]` (none, or a rest: no targeting).

- [ ] **Step 1: failing tests** (`cellsVoices`, C, treble, two beats a chord, `phrase: true`, pitch classes per slot):
  - II–V–I, `3rd-3rd`: `F E D C | B D G F | E …` (spec worked example).
  - I–VI–II–V (C A7 Dm7 G7), `3rd-3rd`: `E D C B | C♯ E A G | F E D C | B D G F`.
  - The same two under `root-root`, `3rd-5th`, `3rd-root`, iii–VI–II–V, I–♭III–♭VI–♭II and a four-beat II–V
    (Dm7 4 beats, G7 4 beats, then C): write the expected by running the code once, check each by hand against the
    spec's rule (each kept or chosen cell's last note a step from the next target, or no palette cell could), and pin
    them. Note in the test which slots break.
  - A single cell (`1-2-3-5`) with `phrase: true` plays exactly as `phrase: false`.
  - 3/4: `Dm7 G7 | C` in 3/4 bars: the turned-back slots equal the `phrase: false` line's.
  - A rest before G7: the slot before the rest is the system cell.
  - A chord on a pentatonic scale (`row` with `scale: 'major pentatonic'`): no throw, line drawn.
- [ ] **Step 2:** run `npm -w engine exec -- vitest run src/__tests__/cellPhrase.test.ts`: FAIL.
- [ ] **Step 3:** implement `cellPhrase.ts` and wire it into `cellsOf` only when `line.phrase` and `isSystemId(id)` and the
  slot is a full four-note cell (`cellVoices` decides turn-backs; `next` is only asked for whole cells or the carried
  first part: target only when the slot's remaining length ≥ 4 notes; pass that as a fifth `next` argument
  `whole: boolean` from `cellVoices`, defaulting true for other callers).
- [ ] **Step 4:** run Step 2's command and `make test`: PASS; `make golden`: no diff.
- [ ] **Step 5:** commit `Cells: Phrase aims each cell at the next chord (#379, #380)`.

### Task 5: wire Phrase to the web

**Files:** `web/app/components/EditorView.vue`, `web/app/utils/sheetLine.ts` (already pass `phrase` from Task 3),
`web/e2e/changes.spec.ts`, `web/app/pages/help.vue` (Cells line, under `phraseCells`), `web/app/pages/how-it-decides.vue`
(how a phrase cell is picked, under `phraseCells`).

- [ ] **Step 1:** e2e: a II–V–I chart, `3rd to 3rd`, Phrase on: the line's `aria-label` has G7's slot as `B D G F`;
  Phrase off: `B A G F`. Update `changes.spec.ts:290`'s expectation if the e2e build (flag on, phrase on by default)
  changes it, checked against the engine test.
- [ ] **Step 2:** `make test lint e2e a11y`: PASS. Commit; open PR 2 (`Release notes: none — behind phraseCells, off`;
  `Docs: none — behind the flag` unless help changed: then `Docs: help, how-it-decides`).

## PR 3: Substitutes over a long dominant (#378)

### Task 6: substitutes

**Files:**
- Modify: `engine/src/guideTones.ts:103` (`GuideInput` gains `pinned?: true`), `engine/src/changes.ts` (`drawn` sets
  `pinned` where the row's scale is written), `engine/src/cellPhrase.ts`, `engine/src/cells.ts`
- Test: `engine/src/__tests__/cellPhrase.test.ts`, `engine/src/__tests__/changes.test.ts` (pinned reaches the input)

**Interfaces:**
- Produces: `export function substituteFor(chord: GuideInput, next: GuideInput | undefined, nth: number): Readonly<{ chord: string; scale: string }> | null`
  in `cellPhrase.ts`: null unless phrase applies, the chord is a dominant (not sus), lasts ≥ 2 slots, isn't `pinned`,
  and `next`'s root is a perfect 5th or a half step below; then by `nth % 4`: 0 → null (own), 1 and 3 → tritone
  (`<root+6>7`, `'lydian dominant'`), 2 → minor 3rd (`<root+3>7`, `'half whole diminished'`). Roots spelled by the
  engine's interval spelling, flat side for the tritone (G7 → D♭7, B♭7).

- [ ] **Step 1: failing tests:**
  - `G7` 4 beats → `C`: slots `own`, `D♭7`; `3rd-5th` A cell over the D♭7 slot reads F A♭ C♭ E♭ (spec).
  - `G7` 8 beats → `C`: own, D♭7, B♭7, D♭7.
  - `G7` 4 beats → `E♭maj7`: no substitutes. `C7` 4 beats → `F7` (blues): substitutes.
  - `G7` pinned (written `| G7 | mixolydian`) 4 beats → `C`: own scale both slots.
  - Last chord of a run / before a rest: none. `G7sus4`: none. Phrase off: none.
- [ ] **Step 2:** FAIL. **Step 3:** implement; in `cellsOf`, read the slot's degrees through the substitute's chord and
  scale; targeting (Task 4) uses the substitute as that slot's chord. **Step 4:** PASS; `make golden`: no diff.
- [ ] **Step 5:** e2e: a `G7` whole bar → `C` with Phrase on: its second slot shows D♭7's notes (assert by `aria-label`).
  how-it-decides: a paragraph on the substitutes (flagged). `make test lint e2e a11y`. Commit; open PR 3.

## PR 4: Chromatic cells (#377)

### Task 7: chromatic degrees and the group

**Files:**
- Modify: `engine/src/cells.ts` (a degree may carry an accidental; `CHROMATIC_CELLS`; `CellId`; `cellLabel`), 
  `web/app/components/PreviewControls.vue` (third `UiListboxGroup` "Chromatic" under `phraseOn`)
- Test: `engine/src/__tests__/cells.test.ts`, `web/e2e/changes.spec.ts`

**Interfaces:**
- Produces:
  - `export type Degree = number | Readonly<{ n: number; semis: number }>` (`♭9` = `{ n: 9, semis: 1 }`, `♯5` = `{ n: 5, semis: 8 }`,
    `♮7` = `{ n: 7, semis: 11 }`); `Cell.degrees: readonly Degree[]`. `cellTones` spells a chromatic degree on the
    letter `n − 1` above the root with the accidental that makes `semis`.
  - `export const CHROMATIC_CELLS` with the spec's five entries and ids; `dominantOnly: true` on the four;
    `ii-v-chromatic` chooses its cell by quality. `isCellId` and `cellLabel` know them (labels: `1 ♮7 7 6`, `5 ♯5 6 7`,
    `♭9 1 3 5`, `3 5 7 ♭9`, `II–V chromatic`).
  - Order (Task 2) applies to them; the palette (Task 4) excludes them; phrase leaves them as chosen.

- [ ] **Step 1: failing tests:** over G7 (C, treble): `1-n7-7-6` → G F♯ F E `ddd`; `5-s5-6-7` → D D♯ E F;
  `b9-1-3-5` → A♭ G B D `duu`; `3-5-7-b9` → B D F A♭; `ii-v-chromatic` over Dm7 G7 → D F A C | B D F A♭;
  `b9-1-3-5` over Cmaj7 → the arpeggio C E G B; over E♭7, `b9` is F♭ (never E).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; API snapshot updated and reviewed; `make golden`.
- [ ] **Step 5:** e2e: pick `♭9 1 3 5` from the Chromatic group: line drawn, stored, reloads. `make test lint e2e a11y`.
  Commit; open PR 4.

## PR 5: Turn it on

### Task 8: flag on, notes, issues

**Files:** `web/nuxt.config.ts` (`phraseCells: true`), `web/app/utils/releaseNotes.ts`, `web/app/pages/help.vue`
(drop the flag guards' dead branches if the repo does so for shipped flags; check `versions`'s history)

- [ ] **Step 1:** flip the flag; release-notes item under the day's date with the predicted PR number: the Cells
  line's Phrase (on by default: cells lead into the next chord, long dominants borrow the tritone sub and the
  minor-3rd dominant), Order, and the Chromatic cells.
- [ ] **Step 2:** `make test lint e2e a11y`: PASS. PR body `Fixes #376, Fixes #377, Fixes #378, Fixes #379, Fixes #380`.
