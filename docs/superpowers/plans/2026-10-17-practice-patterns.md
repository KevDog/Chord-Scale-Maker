# Practice Patterns, Melodic Cells and Approaches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Patterns sheet (scale sequences), a Cells line and an Approach option on the Changes sheet, as three PRs behind three flags (#298).

**Architecture:** Pure engine modules (`patterns.ts`, `cells.ts`, `approaches.ts`) compute spelled, placed notes from what the engine already knows (written scale, `arpeggioTones`, `rangeOf(part)`). The Patterns sheet reuses the Arpeggios sheet's staff model and drawing; Cells plug into `cellVoices` as a `Cells` provider; approaches decorate `guideVoices`' output. The app adds controls, stored preferences, share-link fields and flags.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4 / Vue 3, VexFlow, Playwright, Catalyst UI (`web/app/components/ui/`).

**Spec:** `docs/superpowers/specs/2026-10-17-practice-patterns-design.md`

## Global Constraints

- Engine stays free of Vue/DOM/VexFlow; export from `engine/src/index.ts` only what the app uses, and update `api.test.ts`'s snapshot (`npx vitest run -u src/__tests__/api.test.ts` in `engine/`) in the same task.
- Flags start off: `patterns`, `cells`, `approaches` in `web/nuxt.config.ts` `runtimeConfig.public.features`, the `Feature` type (`web/app/composables/useFeature.ts`), `web/test/features.test.ts`, and `NUXT_PUBLIC_FEATURES_<NAME>=true` in `web/package.json`'s `e2e` and `a11y` scripts.
- Every stored preference reads through `storedRef` (`web/app/composables/usePreferences.ts`) with a parser that rejects junk; share-link fields are validated in `engine/src/share.ts` and dropped when invalid.
- New controls: `CONTROL_TIERS` id at `'intermediate'` (`web/app/utils/interface.ts`), hidden-settings notice via `setAway`.
- The rail keeps at most two rows (`web/e2e/editor.spec.ts` "the preview toolbar stays tidy").
- Spelling: `spellFrom`/`writtenScale`/`arpeggioTones` only; never hand-typed note lists.
- Each Part is one PR: `make test`, `make lint`, `make e2e`, `make a11y` green; `docs/design.md` updated; queue with `gh pr merge N --auto --merge`.

## Review Focus

1. A custom pattern typed half-way or wrong (`""`, `+0`, `+1 +1 +1 +2` (sum 5), nine moves, `+1 −8`, `1—2`): an error under the box, the sheet keeps the last valid pattern, nothing throws. (Task 1, Task 4)
2. A chord with no scale, an unreadable chord, or a rest, on the Patterns sheet and in the Cells and Approach lines: an error staff or a rest with the existing diagnostic, never a throw. (Task 2, Task 6, Task 9)
3. A transposing or bass-clef part (tenor sax, trombone) and a player range (`partFor(name, range)`): notes spelled for the part, inside the range. (Task 2, Task 6, Task 9)
4. Odd lengths: a 3/4 bar, a one-beat chord, a 1 + 3 bar, a chord held over a barline, for cells and approaches. (Task 6, Task 9)
5. A share link or stored value naming an unknown pattern, cell id or approach, or one opened with the flag off: the default, no crash, no dead control. (Task 3, Task 7, Task 10)

---

## PR 1: the Patterns sheet (flag `patterns`)

### Task 1: Pattern grammar, library and run

**Files:**
- Create: `engine/src/patterns.ts`
- Test: `engine/src/__tests__/patterns.test.ts`

**Interfaces:**
- Produces:
  - `type Moves = readonly number[]`
  - `parsePattern(text: string): Readonly<{ moves: Moves }> | Readonly<{ error: string }>`
  - `formatPattern(moves: Moves): string` (canonical `+1 +1 +1 −2`, U+2212 minus)
  - `PATTERN_LIBRARY: readonly Readonly<{ id: string; label: string; moves: Moves }>[]` (13, spec §Library; ids `1-2-3`, `1-2-3-4`, `1-2-3-4-5`, `1-2-3-5`, `1-2-4-3`, `1-2-3-1`, `1-3-2-1`, `1-3-2-4`, `thirds`, `fourths`, `triads`, `triads-turn`, `sevenths`)
  - `type PatternDir = 'up' | 'down' | 'up-down'` (reuse `ArpDirection` from `arpeggioSheet.ts`)
  - `patternRun(size: number, moves: Moves, dir: ArpDirection): Readonly<{ steps: readonly number[]; groups: readonly number[] }>`: `steps` are collection steps from the first note (0 = first note, `size` = its octave, may be negative or above `size`); `groups` the beam lengths.

- [ ] **Step 1: Write the failing tests**

```ts
it('parses moves with hyphen, minus or en dash, spaces or commas, a bare number up', () => {
  for (const t of ['+1 +1 +1 -2', '+1,+1,+1,−2', '1 1 1 –2']) expect(parsePattern(t)).toEqual({ moves: [1, 1, 1, -2] })
})
it('refuses what the rules refuse, saying why', () => {
  for (const t of ['', '+0 +1', '+1 +1 +1 +2', '+1 +1 +1 +1 +1 +1 +1 +1 -7', '+8 -7', '+1', 'abc']) expect(parsePattern(t)).toHaveProperty('error')
})
it('writes the canonical text', () => expect(formatPattern([1, 1, 1, -2])).toBe('+1 +1 +1 −2'))
it('holds the 13 library patterns, each one the parser accepts', () => {
  expect(PATTERN_LIBRARY).toHaveLength(13)
  for (const p of PATTERN_LIBRARY) expect(parsePattern(formatPattern(p.moves))).toEqual({ moves: p.moves })
  expect(PATTERN_LIBRARY.find((p) => p.id === 'thirds')?.moves).toEqual([2, -1])
})
it('runs 1 2 3 4 up a seven-note scale: a group on every step, then the octave alone', () => {
  const r = patternRun(7, [1, 1, 1, -2], 'up')
  expect(r.steps.slice(0, 8)).toEqual([0, 1, 2, 3, 1, 2, 3, 4])
  expect(r.groups).toEqual([4, 4, 4, 4, 4, 4, 4, 1])
  expect(r.steps.at(-1)).toBe(7)
})
it('starts a group every sum steps when the sum is above 1', () => {
  expect(patternRun(7, [2, 2, -2], 'up').steps.filter((_, i) => i % 3 === 0 && i < 12)).toEqual([0, 2, 4, 6])
})
it('reflects Up for Down, and shares the octave in Up & down', () => {
  const up = patternRun(4, [1, 1, 1, -2], 'up')
  expect(patternRun(4, [1, 1, 1, -2], 'down').steps[0]).toBe(4)
  const both = patternRun(4, [1, 1, 1, -2], 'up-down')
  expect(both.steps.length).toBe(up.steps.length * 2 - 1)
})
it('never goes below a group’s first note', () => {
  const { steps, groups } = patternRun(7, [1, 1, 1, -2], 'up')
  let i = 0
  for (const g of groups) { const grp = steps.slice(i, i + g); expect(Math.min(...grp)).toBe(grp[0]); i += g }
})
```

- [ ] **Step 2: Run** `cd engine && npx vitest run src/__tests__/patterns.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the four exports in `engine/src/patterns.ts`. Down = Up's steps mapped `s → size − s` with the groups reversed (the octave note first, alone); Up & down = Up then Down without its first (shared octave) note, groups `[...up, ...down.slice(1)]` with the shared note dropped from Down's first group.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `git add engine/src/patterns.ts engine/src/__tests__/patterns.test.ts && git commit -m "Patterns: grammar, library and run (#298)"`

### Task 2: A pattern line and the Patterns sheet model

**Files:**
- Modify: `engine/src/patterns.ts`, `engine/src/index.ts`, `engine/src/__tests__/__snapshots__/api.test.ts.snap`
- Test: `engine/src/__tests__/patterns.test.ts`

**Interfaces:**
- Consumes: Task 1; `writtenScale`, `rangeOf`, `scaleLines` (`sheet.ts`), `arpeggioTones`, `placeRun`, `ArpeggioStaffModel`/`ArpeggioSheetModel`/`ArpeggioLineNotes` (`arpeggioSheet.ts`).
- Produces:
  - `type PatternNotes = 'scale' | 'chord'`
  - `patternLine(part: Part, chord: string, scale: string | null, moves: Moves, notes: PatternNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }>`
  - `buildPatternSheet(rows: readonly Row[], part: Part, perPage: number, moves: Moves, notes: PatternNotes, dir: ArpDirection, key?: Key | null, resolved?: ReadonlyMap<number, Resolved>): ArpeggioSheetModel` (heading `Patterns`; staff `id` includes `formatPattern(moves)` and `notes`)
  - exported from `index.ts`: `parsePattern`, `formatPattern`, `PATTERN_LIBRARY`, `buildPatternSheet`, type exports.

- [ ] **Step 1: Write the failing tests**

```ts
const notes = (r: ReturnType<typeof patternLine>) => ('error' in r ? r.error : r.notes.map((n) => noteName(n.midi)))
it('runs 1 2 3 4 over C Ionian from C, in the piano range', () => {
  expect(notes(patternLine(partFor('piano'), 'Cmaj7', 'C Ionian', [1, 1, 1, -2], 'scale', 'up')).slice(0, 8)).toEqual(['C4', 'D4', 'E4', 'F4', 'D4', 'E4', 'F4', 'G4'])
})
it('runs over Dm7’s chord tones', () => {
  expect(notes(patternLine(CONCERT_PIANO, 'Dm7', 'D Dorian', [1, 1, 1, -2], 'chord', 'up')).slice(0, 8).map((n) => n.replace(/\d/, ''))).toEqual(['D', 'F', 'A', 'C', 'F', 'A', 'C', 'D'])
})
it('spells for the part: tenor sax reads Cmaj7 as Dmaj7', () => { /* first note's letter is D */ })
it('keeps every note in the part’s range where the range can hold the run (a trombone, a player range)', () => {})
it('is an error, not a throw: no scale with Scale chosen, an unreadable chord with Chord tones', () => {
  expect(patternLine(partFor('piano'), 'Cmaj7', null, [1, 1, 1, -2], 'scale', 'up')).toHaveProperty('error')
  expect(patternLine(partFor('piano'), 'Hmaj7', 'C Ionian', [1, 1, 1, -2], 'chord', 'up')).toHaveProperty('error')
})
it('builds a sheet of one staff per scale line, headed Patterns', () => {})
```

(Fill the empty bodies with concrete assertions in the same style; `CONCERT_PIANO = partFor('piano')`.)

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `patternLine`: the collection (`writtenScale(part, scale).notes` or `arpeggioTones(part, chord, scale)`), `patternRun(collection.length, …)`, step `s` → `collection[mod(s, n)]` at octave `floor(s / n)`, the run's pitch classes placed whole with `placeRun` (its `up` argument: `dir !== 'down'`), then each note's MIDI offset by its octave relative to the run (place the run's lowest step at the placed start). `buildPatternSheet`: copy `buildArpeggioSheet`'s structure, calling `patternLine`.
- [ ] **Step 4: Run** `cd engine && npx vitest run src/__tests__/patterns.test.ts && npx vitest run -u src/__tests__/api.test.ts` → PASS; review the snapshot adds only the names above.
- [ ] **Step 5: Commit** `"Patterns: a line per scale, and the sheet (#298)"`

### Task 3: Preferences, share link and flag

**Files:**
- Modify: `web/app/composables/usePreferences.ts`, `engine/src/share.ts`, `web/app/composables/useFeature.ts`, `web/nuxt.config.ts`, `web/package.json`, `web/app/utils/sheets.ts`, `web/app/utils/interface.ts`
- Test: `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/test/features.test.ts`, `web/test/interface.test.ts`

**Interfaces:**
- Produces:
  - prefs `pattern: Ref<string>` (`csm-pattern`, canonical text, default `+1 +1 +1 −2`; stored text that doesn't parse → default), `patternNotes: Ref<PatternNotes>` (`csm-pattern-notes`, default `scale`), `patternDir: Ref<ArpDirection>` (`csm-pattern-dir`, default `up`); `linkPreferences` takes the link's values over yours.
  - `ShareView`: `sheet` may be `'patterns'`; `pattern?: string`, `patternNotes?: PatternNotes`, `patternDir?: ArpDirection` (each dropped if invalid).
  - `SheetKind` gains `'patterns'`; `SHEETS` lists `{ value: 'patterns', label: 'Patterns' }` after Arpeggios; `sheetsFor(patterns: boolean)` returns the list without it when the flag is off; `firstSheet` falls back to `'changes'` for `'patterns'` with the flag off.
  - `CONTROL_TIERS.patterns = 'intermediate'`; `HiddenSetting` gains `'patterns'`; `setAway` adds `['patterns', 'intermediate']` when `sheet === 'patterns'`.

- [ ] **Step 1: Write the failing tests**: prefs default and remember each, reject `+0`, a link's values for the visit only; share round-trips `{ sheet: 'patterns', pattern: '+2 −1', patternNotes: 'chord', patternDir: 'up-down' }` and drops `pattern: '+0'`, `patternNotes: 'x'`; features expect `patterns: false`; interface: a Patterns link raises the notice at Essentials.
- [ ] **Step 2: Run** `make test` → those FAIL.
- [ ] **Step 3: Implement** as the Interfaces block says.
- [ ] **Step 4: Run** `make test` → PASS.
- [ ] **Step 5: Commit** `"Patterns: preferences, share link, flag (#298)"`

### Task 4: The Patterns sheet in the app

**Files:**
- Modify: `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`, `web/app/pages/help.vue`, `docs/design.md`
- Test: `web/test/PreviewControls.test.ts` (or a new `web/test/PatternControls.test.ts` with `mockNuxtImport('useFeature', …)` as `web/test/PlayerRange.test.ts` does), `web/e2e/patterns.spec.ts`, `web/e2e/a11y/pages.a11y.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: `PreviewControls` models `pattern`, `patternNotes`, `patternDir`; a **Pattern** `UiField` shown when `sheet === 'patterns'` (in place of the Arpeggio group): `UiListbox` (aria-label `Pattern`) of `PATTERN_LIBRARY` labels plus `Custom…`; when Custom, a `UiInput` (aria-label `Custom pattern`, `aria-describedby` its error `<p>`) that writes `pattern` only when `parsePattern` accepts it; `SegmentedControl` (legend `Notes`, options Scale / Chord tones); direction `UiListbox` (aria-label `Pattern direction`).

- [ ] **Step 1: Write the failing tests**: unit: the listbox lists 13 + Custom; choosing Thirds emits `+2 −1`; typing `+0` shows an error and emits nothing; typing `+1 +2 −2` emits it. e2e (`patterns.spec.ts`): open `/song/autumn-leaves`, choose Work on → Patterns, see one staff per scale line headed Patterns; choose Thirds; Chord tones; reload keeps all three; Share link opens the same view in a fresh context. a11y: scan the Patterns sheet with the Custom box open.
- [ ] **Step 2: Run** `cd web && npx vitest run test/PatternControls.test.ts` → FAIL.
- [ ] **Step 3: Implement**: in `EditorView.vue`, build `buildPatternSheet(…)` when `sheet === 'patterns'` (as the Arpeggios sheet is built) and render it with `<ArpeggioSheet>`; wire the models to prefs; share view writes the three fields when on Patterns (beside `arpNotes`, line ~716). Help: a short "Patterns" paragraph under the sheets. `docs/design.md`: a Patterns sheet section citing the spec.
- [ ] **Step 4: Run** `make test && make lint && make e2e && make a11y` → all PASS (incl. the two-row toolbar test).
- [ ] **Step 5: Commit** `"Patterns sheet: scale sequences over each line (#298)"`; push; PR "Patterns sheet (#298, part 1)"; `gh pr merge N --auto --merge`.

## PR 2: melodic cells (flag `cells`)

### Task 5: Cells: degrees through the scale, contour, systems

**Files:**
- Create: `engine/src/cells.ts`
- Test: `engine/src/__tests__/cells.test.ts`

**Interfaces:**
- Produces:
  - `type Contour = readonly ('u' | 'd')[]` (three moves)
  - `type Cell = Readonly<{ degrees: readonly number[]; contour: Contour }>`
  - `CELL_SYSTEMS: Readonly<Record<'root-root' | '3rd-3rd' | '3rd-5th' | '3rd-root', Readonly<{ label: string; a: Cell; b: Cell }>>>` (spec table, labels `Root to root` …)
  - `SINGLE_CELLS: readonly Readonly<{ id: string; cell: Cell }>[]` (10; ids `1-2-3-5`, `5-3-2-1`, `1-3-5-7`, `3-5-7-9`, `7-1-3-5`, `5-6-7-9`, `1-3-5-3`, `1-5-3-5`, `1-6-5-3`, `1-2-3-1`)
  - `type CellId = keyof typeof CELL_SYSTEMS | (typeof SINGLE_CELLS)[number]['id']`, `isCellId(x: unknown): x is CellId`, `cellLabel(id: CellId): string` (`Root to root`, `1 2 3 5`)
  - `cellTones(part: Part, chord: string, scale: string | undefined, degrees: readonly number[]): readonly Spelled[] | null`: degree *d* = the written scale's note whose letter is `(d − 1) mod 7` letters above the written root; no such note (or two) → the chord tone of that number from `arpeggioTones` (1, 3, 5, 7); none → null.
  - `cellPitches(tones: readonly Spelled[], contour: Contour, first: number): readonly number[]`

- [ ] **Step 1: Write the failing tests**, from the spec's table (pitch classes over G7 G Mixolydian, C7 C Mixolydian, F7 F Mixolydian):

```ts
it.each([
  ['root-root', 'a', 'G7', 'G Mixolydian', ['G', 'A', 'B', 'D']],
  ['root-root', 'b', 'C7', 'C Mixolydian', ['C', 'Bb', 'A', 'G']],
  ['3rd-3rd', 'a', 'G7', 'G Mixolydian', ['B', 'A', 'G', 'F']],
  ['3rd-5th', 'a', 'G7', 'G Mixolydian', ['B', 'D', 'F', 'A']],
  ['3rd-root', 'b', 'C7', 'C Mixolydian', ['C', 'E', 'G', 'Bb']],
])('%s %s over %s', (sys, half, chord, scale, names) => {})
it('reads one cell through each scale: 3 2 1 7 over Dm7 Dorian is F E D C, over Cmaj7 Ionian E D C B', () => {})
it('falls back to the chord tone where the scale has no letter for a degree, and to null where neither has it', () => {})
it('follows the contour: 1 5 3 5 udu from G4 is G4 D5 B4 D5; 3 2 1 7 ddd from B4 is B4 A4 G4 F4', () => {})
it('holds 4 systems and 10 single cells, each 4 degrees and 3 moves', () => {})
```

- [ ] **Step 2: Run** `cd engine && npx vitest run src/__tests__/cells.test.ts` → FAIL.
- [ ] **Step 3: Implement**; `cellPitches` steps to the next note of each pitch class in the contour's direction (as `pitchesFrom` in `pentatonicLine.ts`, per move).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `"Cells: degrees through the scale, contour, systems (#298)"`

### Task 6: The Cells line

**Files:**
- Modify: `engine/src/cells.ts`, `engine/src/arpeggios.ts` (`cellVoices`), `engine/src/changes.ts` (`ChangesLineChoice`, dispatch near line 597), `engine/src/index.ts`, API snapshot
- Test: `engine/src/__tests__/cells.test.ts`, `engine/src/__tests__/arpeggios.test.ts`

**Interfaces:**
- Consumes: Task 5; `Cells`, `cellVoices`, `arpeggioCells`.
- Produces:
  - `cellVoices(chords, part, beats, keySig, cellsOf, valueOf?: (chordBeats: number, barShortest: number) => NoteValue)`: default `(_, shortest) => noteValue(shortest)` (today's behaviour, unchanged).
  - `CELL_VALUE = (chordBeats: number): NoteValue => (chordBeats < 2 ? 0.25 : 0.5)`
  - `type CellsLine = Readonly<{ kind: 'cells'; id: CellId }>`; `ChangesLineChoice = SheetLine | PentatonicLine | TriadPairLine | CellsLine`
  - `cellsVoices(chords: readonly GuideInput[], part: Part, beats: Metre, keySig: string | null, line: CellsLine): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] }`: per chord a `Cells` whose `next(prev, count)` picks A on even `count`, B on odd (a single cell: always it), places it with `cellPitches` from the start nearest `prev` that keeps the cell in `rangeOf(part)` (fewest notes out, then nearest prev, then nearer the centre, then lower; `prev === null`: average nearest the centre), and returns `midi`; a chord whose cell has no tones plays `arpeggioCells(part, c, 'up-root')`.

- [ ] **Step 1: Write the failing tests**: G7 (2 beats) C7 (2) F7 (2) Bb7 (2) with `3rd-3rd`: the first three cells' pitch classes as the spec's row, each cell's first note a step from the last cell's last; a 4-beat chord plays two cells (A then B); a bar of 1 + 3 beats: the first chord in sixteenths, the second in eighths; 3/4, one chord a bar: six eighths, the second cell turned back (`turn`); a rest chord rests; tenor sax and trombone parts stay in `rangeOf(part)`; the arpeggio line's existing tests still pass with the default `valueOf`.
- [ ] **Step 2: Run** `cd engine && npx vitest run src/__tests__/cells.test.ts src/__tests__/arpeggios.test.ts` → new tests FAIL.
- [ ] **Step 3: Implement**; in `cellVoices` replace `noteValue(shortest…)` at `arpeggios.ts:256` with `valueOf(s.length-of-the-chord, shortest…)`; `buildChanges` dispatches `kind: 'cells'` to `cellsVoices`; `changesLinesPerPage` treats it as the arpeggio line.
- [ ] **Step 4: Run** `make test` and update the API snapshot → PASS; `make golden` shows no diff.
- [ ] **Step 5: Commit** `"Cells line: a cell per two beats, chained by system (#298)"`

### Task 7: The Cells mode in the app

**Files:**
- Modify: `web/app/utils/sheetLine.ts`, `web/app/composables/usePreferences.ts`, `engine/src/share.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`, flag files (Global Constraints), `web/app/pages/help.vue`, `docs/design.md`
- Test: `web/test/sheetLine.test.ts`, `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/e2e/changes.spec.ts`, `web/e2e/a11y/pages.a11y.ts`

**Interfaces:**
- Produces: `LineMode` gains `'cells'`; `lineModes(overlay, cells: boolean)` adds `{ value: 'cells', label: 'Cells', title: "A melodic cell on each chord, two beats each, after Randy Vincent's Building Solo Lines From Cells" }` when the flag is on; `changesLineOf` takes `cells: CellId` and returns `{ kind: 'cells', id }` for mode `cells` (whatever the overlay); prefs `cells: Ref<CellId>` (`csm-cells`, default `3rd-3rd`); `csm-line` accepts `cells`; share `line` accepts `cells:<id>` (`lineChoiceOf` returns `{ mode: 'cells', cells }`), dropped if the id is unknown; Line group: a `UiListbox` (aria-label `Cell`) with groups Systems and Cells under the modes when mode is `cells`.

- [ ] **Step 1: Write the failing tests**: `changesLineOf` with mode cells under each overlay; prefs default/remember/reject `9-9-9-9`; share round-trip `cells:1-2-3-5`, drops `cells:x`; e2e: Autumn Leaves, Line → Cells, Root to root: the first line's aria-label lists cells, a note on each beat 1 and 3 of each chord (eighths beamed in fours), the two-row toolbar test still passes; a11y: the open Cell listbox.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** If the two-row test fails with the fourth mode, apply the spec's fallback: no `cells` mode; the 7th Chords listbox gains a "Cells" `UiListboxGroup` and `arpeggio` may hold a `CellId`. Say which in the PR.
- [ ] **Step 4: Run** `make test && make lint && make e2e && make a11y` → PASS.
- [ ] **Step 5: Commit** `"Cells on the Changes sheet (#298, part 2)"`; push; PR; auto-merge.

## PR 3: approach notes and enclosures (flag `approaches`)

### Task 8: Approach figures

**Files:**
- Create: `engine/src/approaches.ts`
- Test: `engine/src/__tests__/approaches.test.ts`

**Interfaces:**
- Produces:
  - `APPROACHES = ['none', 'chromatic-below', 'chromatic-above', 'diatonic-above', 'double-below', 'double-above', 'above-below', 'enclosure', 'below-above', 'delayed'] as const`, `type Approach`, `isApproach`, `APPROACH_LABELS` (the spec's table names)
  - `approachNotes(target: Pitched, figure: Approach, scale: readonly Spelled[] | null): readonly Pitched[] | null` (the notes before the target; null when the figure needs a diatonic note and there's no scale)

- [ ] **Step 1: Write the failing tests**: every row of the spec's table into E4 over C Ionian (e.g. `enclosure` → F4 D♯4; `double-above` → F♯4 F4; `delayed` → F4 D4 D♯4), spelled letters and accidentals checked; into B♭ chromatic below is A; into C♯ chromatic above is D; `diatonic-above` with `scale` null → null.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `"Approaches: figures into a target (#298)"`

### Task 9: Approaches on the guide tone line

**Files:**
- Modify: `engine/src/guideTones.ts` (`guideVoices`), `engine/src/changes.ts`, `engine/src/index.ts`, API snapshot
- Test: `engine/src/__tests__/approaches.test.ts`, `engine/src/__tests__/guideTones.test.ts`

**Interfaces:**
- Consumes: Task 8.
- Produces: `guideVoices(chords, part, beats, keySig, line, approach: Approach = 'none')`; `buildChanges(…, line, view, overlay, approach: Approach = 'none')`.

- [ ] **Step 1: Write the failing tests**: Dm7 G7 Cmaj7, a bar each, From 3rd, `chromatic-below`: bar 1 ends with an eighth a semitone under G7's 3rd target and bar 2's first note is the target; a three-note figure takes the last beat and a half and the previous guide tone is shortened (tied lengths drawable); a held target: tie broken, figure present; a one-beat previous chord with a two-note figure: no approach; the first chord and a chord after a rest: no approach; the figure's notes in `rangeOf(part)` as written (no reflow); `approach: 'none'` leaves today's output byte-identical.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** after the line is placed: per chord *j* > 0 with a target, `approachNotes(target, figure, writtenScale(part, chords[j−1].scale).notes)`, its notes as eighths ending at chord *j*'s start, replacing that much of chord *j−1*'s voice; then `voiceAccidentals` as today.
- [ ] **Step 4: Run** `make test` → PASS; `make golden` no diff.
- [ ] **Step 5: Commit** `"Approaches on the guide tone line (#298)"`

### Task 10: The Approach control

**Files:**
- Modify: `web/app/composables/usePreferences.ts`, `engine/src/share.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`, flag files, `web/app/pages/help.vue`, `docs/design.md`
- Test: `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/e2e/changes.spec.ts`, `web/e2e/a11y/pages.a11y.ts`

**Interfaces:**
- Produces: prefs `approach: Ref<Approach>` (`csm-approach`, default `none`); share `approach?: Approach`; under Guide Tones a second `UiListbox` (aria-label `Approach`, `APPROACH_LABELS`), only with the flag on.

- [ ] **Step 1: Write the failing tests**: prefs and share round-trip, junk dropped; e2e: Autumn Leaves, Guide Tones, Approach Enclosure: more noteheads than chords, each chord's first note still its guide tone label; two-row toolbar test passes; a11y: open Approach listbox.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `make test && make lint && make e2e && make a11y` → PASS.
- [ ] **Step 5: Commit** `"Approach notes and enclosures (#298, part 3)"`; push; PR (closes #298); auto-merge.
- [ ] **Step 6: File the spec's "Later" items** as GH issues (octave displacement; reversals and permutations; chromatic cells; tritone and minor-3rd sub cells; four-beat II–V chains; turnaround systems; approach targets on chord tones), each linking the spec.
