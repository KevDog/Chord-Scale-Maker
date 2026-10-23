# Rhythm Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tuplet pulses, mixed phrasing (Groups path), gears (Gears path) and Feel in 4 · 2 · 1, behind the `rhythmGears` flag.

**Architecture:** The engine's pulse becomes a ratio grid (`PULSE_GRID`). The notation generalizes triplets to any
tuplet. A rhythm can be laid as `RhythmSteps`, one id per run of drawn bars, chosen by the pentatonic path's Step
units, which move into a shared `stepUnits`. Feel is a `buildChanges` option that changes slashes, beams and targets.
The web adds controls, preferences and links in the existing patterns.

**Tech Stack:** TypeScript strict (engine, pure), Nuxt 3 / Vue 3, VexFlow, vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-23-rhythm-phase4-design.md (cited as S §n / S Dn). Read it with this plan.

## Global Constraints

- One PR per Part below, opened with `gh pr create --body-file <scratchpad file>` and queued with
  `gh pr merge N --auto --merge`. A Part branches from main after the previous Part has merged; if main moved, merge
  it in.
- **Flag `rhythmGears`:** off in `web/nuxt.config.ts` `features` and in `web/test/features.test.ts`, and set
  `NUXT_PUBLIC_FEATURES_RHYTHM_GEARS=true` in both the `e2e` and `a11y` scripts of `web/package.json`.
- **Engine:** no Vue, DOM or VexFlow imports. Every new export goes in `engine/src/index.ts`, and
  `engine/src/__tests__/api.test.ts`'s snapshot is updated.
- **TDD for engine work:** write the test first. Drawing may be gated by e2e.
- **PR body:** `Release notes: none — the rhythmGears flag is off` (Parts 1–4). The docs check is met by
  `help.vue` + `decisions.ts`.
- **Copyright:** cite Saindon, Bergonzi and Galper by title and page only.
- **Commands:** `make test`, `make lint` and `make e2e` before each PR. `make a11y` runs when `web/app/` changed.
  `make golden` runs when the engine's answers change.
- **Commits:** stage only named files (no `git add -A`). Keep Bash commands plain, with no heredocs; write files with
  the Write tool.
- **e2e:** previews on port 4174 are shared across worktrees. Give the Playwright file before `--project`.

## Review Focus

1. **Old ids still lay identically.** The `PULSE_GRID` refactor must not change one answer for `4 8 8t 16`. Golden
   catches charts but not the run/card drawing paths, so Task 1.1 asserts bar-for-bar equality for each old pulse
   through `layRhythm`, `rhythmNotes`, `pourRun` and `cardBars`.
2. **A chart with an `@time` 3/4 bar under `4t`/`4q`/`8q`.** The fallback bar must draw (no NaN beats, no tuplet with
   a fraction). Task 1.2 lays `unit:4q:5:accents` over bars `[4, 3, 4]`.
3. **A path step boundary inside a held note or in the middle of a 2nd ending.** The new step must start fresh, and
   breaks must merge with step starts without double-counting. Task 2.2 lays over a sheet whose break bar is also a
   step start.
4. **A stored path on a chart whose sections changed** (an edited chart, or a `mine:` chart). The path stores lists,
   not section names, so it must still apply. Task 2.4 loads a stored path, edits the sections, and the plan still
   builds.
5. **The flag off with a stored `unit:16s:…` or `csm-feel=1`.** The sheet must read Off and 4 and keep what is stored.
   Task 1.4 and Task 4.2 cover it.

---

## Part 1 (PR 1): Tuplet pulses

### Task 1.1: The pulse grid

**Files:**
- Modify: `engine/src/rhythm/rhythm.ts`, `library.ts`, `lay.ts`, `notation.ts`, `pour.ts`, `run.ts`, `engine/src/arpeggios.ts` (`mergeSilence`)
- Test: `engine/src/__tests__/rhythm.test.ts`, `rhythmLay.test.ts`

**Interfaces:**
- Produces:
  - `type Pulse = '4' | '8' | '8t' | '16' | '4t' | '4q' | '8q' | '16q' | '16t' | '16s'`;
  - `PULSES` in that order;
  - `type PulseGrid = Readonly<{ n: number; beats: number; value: RhythmValue; tuplet: Readonly<{ notes: number; of: number }> | null; fallback: Pulse | null }>`;
  - `PULSE_GRID: Readonly<Record<Pulse, PulseGrid>>` (the S §1 table);
  - `barPulse(p: Pulse, beats: number): Pulse`;
  - `pulsesIn(p: Pulse, beats: number): number` (pulses in a bar, after `barPulse`);
  - `pulseBeat(p: Pulse, i: number): number` (`i × beats / n`);
  - `PULSE_LABELS` gains the six labels;
  - `PULSE_PER_BEAT` is kept, typed `Record<'4' | '8' | '8t' | '16', number>`;
  - `Laid` gains `pulses: readonly Pulse[]` (each bar's).

  `RhythmValue` moves to `rhythm.ts`, and `notation.ts` re-exports it.

- [ ] **Step 1: Write the failing tests.**
  - `PULSE_GRID['4q']` equals `{ n: 5, beats: 4, value: 'q', tuplet: { notes: 5, of: 4 }, fallback: '4' }`, and the
    same for each row of S §1.
  - `barPulse('4t', 3) === '4'`, `barPulse('4t', 4) === '4t'`, `barPulse('4q', 5) === '4'`, `barPulse('16s', 3) === '16s'`.
  - `pulsesIn('4t', 4) === 6`, `pulsesIn('4t', 3) === 3`, `pulsesIn('8q', 4) === 10`.
  - `parseRhythm('16s: >xxxxxx')` has pulse `16s` and 7 cells.
  - **Regression:** for each old pulse, for each of `unit:<p>:5:accents`, `unit:<p>:3:syncopated` and
    `custom:<p>:x.x_`, `layRhythm` over `[4, 3, 4]` deep-equals a snapshot taken before the refactor (commit the
    snapshot from main first). Do the same for `run:8:4:2` and `card:halves`.
- [ ] **Step 2:** Run `cd engine && npx vitest run src/__tests__/rhythm.test.ts src/__tests__/rhythmLay.test.ts`. Expected:
  the new cases FAIL, and the snapshot cases PASS (they were recorded on old code).
- [ ] **Step 3: Implement.**
  - Replace every `PULSE_PER_BEAT[...]` in `lay.ts`, `notation.ts`, `pour.ts`, `run.ts`, `library.ts` and
    `arpeggios.ts` with grid reads.
  - `layRhythm` takes each bar's pulse via `barPulse` and its length via `pulsesIn`, and the stream counts cells
    through every bar.
  - `pulseOf` and `beat` conversions use `pulseBeat` with the bar's pulse.
  - `maxK` in `library.ts` stays at `4 × PULSE_PER_BEAT[p] − 1` for `RUN_PULSES`.
  - `arpeggios.ts` `mergeSilence` takes the bar's pulse (`poured.laid.pulses[bar]`).
- [ ] **Step 4:** Run `make test`. Expected: PASS, with golden unchanged except `rhythmCases` (Task 1.3 regenerates it).
- [ ] **Step 5:** Commit: `Rhythm: pulses as a ratio grid (Phase 4 spec §1)`.

### Task 1.2: Tuplet notation

**Files:**
- Modify: `engine/src/rhythm/notation.ts`
- Test: `engine/src/__tests__/rhythmNotation.test.ts`

**Interfaces:**
- Consumes: `PULSE_GRID`, `Laid.pulses`.
- Produces: `RhythmNote` gains `ratio: Readonly<{ notes: number; of: number }> | null`. It is 3:2 on today's triplet
  notes and null on straight ones. `restPieces(at, length, pulse: Pulse)` replaces the `(per, triplets)` pair, and
  every caller is updated.

- [ ] **Step 1: Write the failing tests.** There is one test per row of S §2's table, named by its rhythm. Each
  asserts bar 1's `value`, `ratio`, `tuplet` index, `accent` and `tie` sequence. For example, `unit:4q:5:accents`
  gives five notes, all `{ value: 'q', ratio: { notes: 5, of: 4 }, tuplet: 0 }`, accents `[true, false, false, false, false]`.
  Also test:
  - `unit:4q:5:accents` over `[4, 3, 4]`: bar 2 is three `q` with `ratio: null`, and bar 3 is a 5:4 again;
  - existing triplet tests gain `ratio: { notes: 3, of: 2 }`.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/rhythmNotation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `tripletPieces` becomes `tupletPieces(at, length, grid)`:
  - cut pieces at each group boundary (`grid.n` pulses);
  - merge whole groups from a boundary into straight values of `grid.beats × groups` beats (`WHOLE_BEATS`, extended
    so 4 beats map to `w`), splitting longer runs as `straightPieces` does;
  - inside a group, take the longest of `[4, 3, 2, 1] × grid.value` that fits, mapping each to a `RhythmValue`:
    - for a 16th base: 4 → q, 3 → 8d, 2 → 8, 1 → 16;
    - for an 8th base: 4 → h, 3 → qd, 2 → q, 1 → 8;
    - for a quarter base: 4 → w, 3 → hd, 2 → h, 1 → q.

  Tuplet notes beam by group, as triplets beam by beat.
- [ ] **Step 4:** Run `make test`. Expected: PASS.
- [ ] **Step 5:** Commit: `Rhythm: tuplet notation for any pulse (Phase 4 spec §2)`.

### Task 1.3: Library ids, flag and golden

**Files:**
- Modify: `engine/src/rhythm/library.ts`, `engine/src/index.ts`, `engine/src/__tests__/api.test.ts`, `engine/fixtures/golden.json`; `web/nuxt.config.ts`, `web/package.json`, `web/test/features.test.ts`
- Test: `engine/src/__tests__/rhythmLibrary.test.ts`

**Interfaces:**
- Produces: `LIBRARY_IDS` includes `unit:<p>:<g>:<v>` for the six new pulses. `isPhase4Pulse(p: Pulse): boolean`
  (true for the six) is exported for the web.

- [ ] **Step 1: Write the failing tests.**
  - `LIBRARY_IDS` contains `unit:16s:7:accents`, and its unit count is 10 × 6 × 5.
  - `rhythmLabel('unit:4t:3:accents') === 'Quarter-note triplets in 3, with accents'`.
  - `parseRhythmId('run:4t:3:0') === null` (runs keep `RUN_PULSES`).
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.** Export `PULSE_GRID`, `barPulse`, `pulsesIn`, `pulseBeat` and `isPhase4Pulse`. Add the flag
  (Global Constraints), commented as `rhythm` and `rhythmSheets` are, pointing to the spec.
- [ ] **Step 4:** Run `make golden`, then `git diff --stat engine/fixtures/golden.json`. Expected: only `rhythms`
  entries were added; none changed. Then run `make test`. Expected: PASS.
- [ ] **Step 5:** Commit: `Rhythm: the six tuplet pulses in the library, and the rhythmGears flag`.

### Task 1.4: The web: listbox families, preference gate, drawing

**Files:**
- Modify:
  - `web/app/components/RhythmControls.vue` (`RHYTHM_FAMILIES`);
  - `web/app/composables/usePreferences.ts` (the `csm-rhythm` reader and the link reader at line ~140);
  - `web/app/utils/interface.ts` (`CONTROL_TIERS['rhythm-gears'] = 'everything'`, `HiddenSetting` gains
    `'rhythm-gears'`, `setAway` lists it when the rhythm's pulse `isPhase4Pulse`);
  - `web/app/utils/changesDrawing.ts` (`tripletsOf` → `tupletsOf(vf, ticks, notes)` reading `ratio`);
  - `web/app/utils/vexflow.ts`.
- Test: `web/test/usePreferences.test.ts`, `interface.test.ts`, `changesDrawing.test.ts`; `web/e2e/changes.spec.ts`
  (or the existing rhythm e2e file), `web/e2e/print.spec.ts`

**Interfaces:**
- Consumes: `isPhase4Pulse`, `RhythmNote.ratio`.
- Produces: `tupletsOf(vf, ticks, note: (i: number) => RhythmNote | undefined): Tuplet[]`, which makes one
  `vf.Tuplet` per tuplet index with `numNotes: ratio.notes, notesOccupied: ratio.of`.

- [ ] **Step 1: Write the failing tests.**
  - **Preferences:** with `rhythmGears` off, a stored `csm-rhythm=unit:16s:7:accents` reads `off` and stays stored;
    with it on, it reads back the same id. Links follow the same rule.
  - **Interface:** `CONTROL_TIERS['rhythm-gears'] === 'everything'`, and `setAway` lists `rhythm-gears` for
    `unit:8q:5:accents`.
  - **`changesDrawing.test.ts`:** `tupletsOf` on a 5:4 bar gives one tuplet with `num_notes` 5.
- [ ] **Step 2:** Run `cd web && npx vitest run test/usePreferences.test.ts test/interface.test.ts test/changesDrawing.test.ts`.
  Expected: FAIL.
- [ ] **Step 3: Implement.** The Units group lists the new families only when `useFeature('rhythmGears')` and
  `shows('rhythm-gears')`.
- [ ] **Step 4: e2e and print.**
  - e2e (flag on): `unit:4q:5:accents` on the Changes of a 4/4 tune draws one tuplet a bar whose text is `5`, and on
    the Scales card it does the same.
  - Print: F Blues Scales, piano, `unit:8q:5:accents` has as many PDF pages as sheet pages.
  - Run `make test && make lint && make e2e && make a11y`. Expected: PASS.
- [ ] **Step 5: Help and DECISIONS.** In `web/app/pages/help.vue`, add `#rhythm-tuplets` after `#rhythm-cycle`'s
  entry: the six pulses, and S D11's fallback in words, citing Saindon *Rhythmic Patterns* ch. 10 and Bergonzi
  *Inside Improvisation Vol. 4* ch. 24. In `engine/src/decisions.ts`, add `rhythm.tuplet-fallback`
  (page `help`, anchor `rhythm-tuplets`). Run `make docs`. Expected: PASS.
- [ ] **Step 6:** Commit, then open PR 1, "Rhythm Phase 4: tuplet pulses", and queue auto-merge.

---

## Part 2 (PR 2): Mixed phrasing

### Task 2.1: `stepUnits` moved out of `changes.ts`

**Files:**
- Create: `engine/src/steps.ts`
- Modify: `engine/src/changes.ts:568-599` (the `sectionUnit`/`formStart`/`areaUnit`/`unitOf` block)
- Test: `engine/src/__tests__/steps.test.ts`

**Interfaces:**
- Produces:
  - `stepUnits(blocks: readonly Readonly<{ part: string; from: number; to: number; rows: readonly number[] }>[], keyOfRow: (row: number) => string | undefined, step: PentatonicStep): Readonly<{ ofChord: (block: number, bar: number, row: number) => number | null; ofDrawnBar: readonly (number | null)[] }>`.
  - `ofDrawnBar` is indexed like `buildChanges`'s `lengths`. Use the block types `changes.ts` already has, without
    widening them.

- [ ] **Step 1: Write the failing tests** on a small AABA doc (build it with the test helpers `changes.test.ts`
  uses):
  - `section` gives drawn bars `[0×8, 1×8, 2×8, 3×8]`;
  - `bars` with 4 gives `0,0,0,0,1,…`;
  - `key-area` changes where `@key` changes;
  - an intro block's bars are `null`.
- [ ] **Step 2:** Run it. Expected: FAIL (no module).
- [ ] **Step 3:** Move the code into `steps.ts`, and make `changes.ts`'s `unitOf` call `ofChord`.
- [ ] **Step 4:** Run `make test`. Expected: PASS, golden unchanged (it proves S §3's "no pentatonic answer changes").
- [ ] **Step 5:** Commit: `Steps: the pentatonic path's step units in their own module`.

### Task 2.2: `RhythmSteps` and laying by steps

**Files:**
- Create: `engine/src/rhythm/path.ts`
- Modify: `engine/src/rhythm/lay.ts`, `pour.ts`, `index.ts`
- Test: `engine/src/__tests__/rhythmPath.test.ts`, `rhythmPour.test.ts`

**Interfaces:**
- Produces, in `path.ts`:
  - `type RhythmStep = PentatonicStep`;
  - `type RhythmPath = Readonly<{ groups: readonly number[] | null; gears: readonly Pulse[] | null; step: RhythmStep }>`;
  - `RHYTHM_PATH_OFF: RhythmPath` (both null, `PENTATONIC_STEP`);
  - `isRhythmPath(v: unknown): v is RhythmPath`, which checks 1–8 entries, groups in `UNIT_GROUPS`, gears in
    `PULSES` and the step by `isPentatonicStep`;
  - `type RhythmSteps = readonly Readonly<{ from: number; id: RhythmId }>[]`;
  - `rhythmSteps(id: RhythmId, path: RhythmPath, units: readonly (number | null)[]): RhythmSteps` (S §3 "The plan");
  - `RHYTHM_GROUP_PRESETS = { up: [3, 4, 5, 6, 7], down: [7, 6, 5, 4, 3] }`;
  - `RHYTHM_GEAR_PRESETS = { up: ['4t', '8', '8t', '16', '16t'], down: ['16t', '16', '8t', '8', '4t'] }`.
- Produces, in `lay.ts` and `pour.ts`:
  - `layRhythm(id: RhythmId | RhythmSteps, …)`;
  - `Laid` gains `steps: readonly Readonly<{ from: number; id: RhythmId; unit: number }>[]`;
  - `lineRhythm(id: RhythmId | RhythmSteps, …)`;
  - `RhythmPlan.id: RhythmId | RhythmSteps`.

- [ ] **Step 1: Write the failing tests.**
  - `rhythmSteps`: Groups `[3, 4, 5]` with units `[0, 0, 1, 1, 2, 2]` gives
    `[{from: 0, id: 'unit:8:3:accents'}, {from: 2, id: 'unit:8:4:accents'}, {from: 4, id: 'unit:8:5:accents'}]`.
    A null unit takes step 0. Equal neighbours merge. A custom id with Groups only gives one entry. With Gears
    `['8', '16']`, `custom:8:x.x` becomes `custom:16:x.x` at step 1. `card:downbeats` gives one entry.
  - `layRhythm` with the first two rows of S §3's table: each bar's attack/accent pattern matches exactly. The
    statement at pulse 15 in bar 2 is one note and not tied into bar 3. `steps[1].from === 2`.
  - **Review Focus 3:** steps `[{0, unit:8:3:accents}, {2, unit:8:4:accents}]` with `breaks: [2]` lays the same as
    without the break.
  - `lineRhythm` with steps and `start: 'pickup-2'`: a chord on bar 3's beat 1 (a step start) gets no pick-ups in
    bar 2.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.** `layRhythm` normalizes a bare id to `[{ from: 0, id }]`, lays each entry over its bars
  slice, and concatenates `bars`, `pulses` and `starts` (offset). Step `from`s join `breaks`. `landings` are
  offset; `unit` and `pulse` come from step 0.
- [ ] **Step 4:** Run `make test`. Expected: PASS.
- [ ] **Step 5:** Commit: `Rhythm: laying by steps (Phase 4 spec §3)`.

### Task 2.3: Changes: the Groups path, step marks and caption

**Files:**
- Modify: `engine/src/changes.ts` (`buildChanges` options, `ChangesBar`, the `plan` at line ~719, `layRhythm` at
  ~847), `engine/src/rhythm/lay.ts` (`rhythmCaption`)
- Test: `engine/src/__tests__/changes.test.ts`, `rhythmLay.test.ts`

**Interfaces:**
- Consumes: `stepUnits().ofDrawnBar`, `rhythmSteps`, `RhythmPath`.
- Produces:
  - `buildChanges` options gain `rhythmPath?: RhythmPath`;
  - `ChangesBar` gains `step: Readonly<{ group: number | null; pulse: Pulse | null }> | null`;
  - `rhythmCaption(id: RhythmId, laid: Laid, path?: RhythmPath): string`.

- [ ] **Step 1: Write the failing tests.**
  - On an AABA chart, `unit:8:3:accents` with Groups Up by section gives bars 1, 9, 17 and 25 with `step.group`
    3, 4, 5 and 6, and every other bar with `step: null`.
  - A Gears path alone gives `step.group` null and `step.pulse` set.
  - Captions:
    - `'Rhythm: 8ths, with accents · in 3 → 4 → 5 · by section'` for Groups `[3, 4, 5]`;
    - `'Rhythm: Units in 4, with accents · 8ths → triplets → 16ths · every 2 bars'` for Gears `['8', '8t', '16']`
      with bars 2;
    - with no path, unchanged.
  - With Lines poured (`line: 'arpeggio'`), the arpeggio voice under the path has its attacks where the rhythm line
    would.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. The plan's `id` and the caption's `layRhythm` both use
  `rhythmSteps(rhythm, rhythmPath, ofDrawnBar)`. The marks follow S D17: show a group on step 0 when `groups` is
  non-null, and on a later step when it differs from the previous one. Pulse marks work the same way.
- [ ] **Step 4:** Run `make test`. Expected: PASS.
- [ ] **Step 5:** Commit: `Changes: the rhythm's Groups path, its step marks and caption`.

### Task 2.4: The web: Groups and Step controls, storage, links, marks

**Files:**
- Create: `web/app/composables/useRhythmPath.ts`
- Modify:
  - `web/app/components/RhythmControls.vue`;
  - `web/app/components/EditorView.vue` (pass `rhythmPath` to `buildChanges`);
  - `engine/src/share.ts` (`rhythmPath?`);
  - `web/app/composables/usePreferences.ts` (link view);
  - `web/app/utils/interface.ts` (`ViewSettings.rhythmPath`, `setAway`, reset);
  - `web/app/utils/changesDrawing.ts` (`drawStepMark`, aria).
- Test: `web/test/useRhythmPath.test.ts`, `interface.test.ts`, `engine/src/__tests__/share.test.ts`;
  `web/e2e/changes.spec.ts`, `print.spec.ts`

**Interfaces:**
- Produces: `useRhythmPath(key: string | undefined): { path: Ref<RhythmPath>; setGroups(g: readonly number[] | null): void; setGears(p: readonly Pulse[] | null): void; setStep(s: RhythmStep): void; reset(): void }`.
  It stores under `csm-rhythm-path:<key>`, removes the entry when both lists are null, and ignores the stored value
  with the flag off. Keys follow `usePentatonicPath`.

- [ ] **Step 1: Write the failing tests.**
  - **Composable:** a round trip, removal when both lists are null, and flag off reads `RHYTHM_PATH_OFF` while
    keeping the stored value.
  - **Review Focus 4:** a stored path on a chart whose sections are then renamed still gives `groups` and the same
    steps count.
  - **Share:** `rhythmPath` with `groups: [3, 4]` round-trips. An invalid entry (`groups: [9]`) drops.
  - **Interface:** `setAway` lists `rhythm-gears` with a path on.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement the controls.** The Groups listbox (One · Up · Down · Your list…) and the Step listbox (the
  pentatonic Step's options) go in the Rhythm options popover, on the Changes only, for units, gated by S §7. Your
  list… opens a `UiInput` (aria-label "Your groups", placeholder "3 4 5") with an error under it, as
  `rhythmText` does.
- [ ] **Step 4: Implement the marks.** Draw the circled numeral `String.fromCodePoint(0x2460 + g − 1)` above the
  step's first note, in the target-dot band (`changesDrawing.ts:54`), at the target dots' font size. Add
  `, from bar N: in G` to the line's aria-label.
- [ ] **Step 5: e2e and print.**
  - e2e: on an AABA library chart with Groups Up by section, the rhythm line's aria-labels read "from bar 9: in 4".
  - Print: Autumn Leaves, trombone from B, `unit:8:3:accents`, Groups Up by section prints a sheet page to a letter
    page. If it overflows, follow S §8.
  - Run `make test && make lint && make e2e && make a11y`.
- [ ] **Step 6: Help and DECISIONS.** Add `#rhythm-groups` (Saindon *Rhythmic Patterns* p. 12, Bergonzi ch. 14) and
  `rhythm.path-step` (S D14–16). Run `make docs`.
- [ ] **Step 7:** Commit, then open PR 2, "Rhythm Phase 4: mixed phrasing", and queue auto-merge.

---

## Part 3 (PR 3): Gears

### Task 3.1: The Gears control and gear marks

**Files:**
- Modify: `web/app/components/RhythmControls.vue`, `web/app/utils/changesDrawing.ts`, `web/app/pages/help.vue`
- Test: `web/e2e/changes.spec.ts`, `print.spec.ts`; `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: `RHYTHM_GEAR_PRESETS`, `useRhythmPath().setGears`, and `ChangesBar.step.pulse`, which Part 2 already
  computes. The engine work is done.

- [ ] **Step 1: Write the failing tests.**
  - **Engine:** S §3's row 3 (Gears 8 8t 16 every 2 bars): bars 3–4 have 12 pulses, accents at pulses 0, 4 and 8,
    and `step.pulse === '8t'` on bar 3.
  - **Engine:** row 4 (Groups 3 5 + Gears 8 16): step 2 is `unit:8:3:accents` again, with both marks.
  - **e2e:** Up the gears by 2 bars shows "Quarter-note triplets" then "8ths" in the step aria-labels.
- [ ] **Step 2:** Run them. Expected: engine PASS (Part 2 built it), e2e FAIL.
- [ ] **Step 3: Implement.** Add the Gears listbox (One · Up the gears · Down the gears · Your list…, aria-label
  "Gears"), shown for units and custom rhythms. Your list… parses spellings from `PULSES` separated by spaces. The
  gear mark is the pulse's label in italics, after the numeral.
- [ ] **Step 4: Print.** Autumn Leaves, trombone from B, `unit:16s:7:accents` with Gears Down. Run
  `make test && make lint && make e2e && make a11y`.
- [ ] **Step 5: Help.** Add `#rhythm-gears` (Bergonzi chs. 22–26, contraction and expansion as a gear path by 2 bars).
  Run `make docs`.
- [ ] **Step 6:** Commit, then open PR 3, "Rhythm Phase 4: gears", and queue auto-merge.

---

## Part 4 (PR 4): Feel

### Task 4.1: Engine: `feelGroups`, slashes, beams, targets

**Files:**
- Create: `engine/src/rhythm/feel.ts`
- Modify: `engine/src/rhythm/notation.ts` (`rhythmNotes(laid, feel?)`), `engine/src/changes.ts`, `engine/src/index.ts`
- Test: `engine/src/__tests__/rhythmFeel.test.ts`, `changes.test.ts`

**Interfaces:**
- Produces:
  - `type Feel = 4 | 2 | 1`, `FEELS`, `isFeel`;
  - `feelGroups(beats: number, feel: Feel): readonly number[]`;
  - `feelSlashes(beats: number, feel: Feel): readonly Readonly<{ beat: number; value: RhythmValue; tie: boolean }>[]`;
  - `feelTargets(beats: number, feel: Feel): readonly number[]`;
  - `buildChanges` options gain `feel?: Feel`;
  - `ChangesBar` gains `slashes`;
  - `rhythmNotes(laid: Laid, feel: Feel = 4)`.

- [ ] **Step 1: Write the failing tests.** Every row of S §4's table:
  - `feelSlashes(5, 1)` is `[{0, 'w', tie: true}, {4, 'q', tie: false}]`;
  - `feelSlashes(3, 2)` is `[{0, 'hd', false}]`;
  - `run:8:4:0` in 4/4 at feel 2 gives one beam over its four 8ths;
  - `unit:8:3:accents` beams are equal at feels 4 and 1;
  - `feelTargets(4, 1)` is `[0]`, and `feelTargets(4, 2)` is `[0, 2]`.

  `buildChanges` with no `feel` is unchanged (slashes are quarters a beat).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The beam group for `kind === 'bar'` and the straight beats of poured Lines becomes the
  index of the `feelGroups` group that holds the note's beat. Statement and tuplet grouping are untouched.
  `rhythmCaption` appends ` · in 2` or ` · in 1`.
- [ ] **Step 4:** Run `make test`. Expected: PASS, golden unchanged.
- [ ] **Step 5:** Commit: `Rhythm: Feel in 4, 2, 1 (Phase 4 spec §4)`.

### Task 4.2: The web: Feel control, preference, link, slashes, mark

**Files:**
- Modify:
  - `web/app/composables/usePreferences.ts` (`csm-feel`, link);
  - `engine/src/share.ts` (`feel?: 2 | 1`);
  - `web/app/utils/interface.ts` (`feel` tier `everything`, `HiddenSetting`, `ViewSettings.feel`, reset);
  - `web/app/components/PreviewControls.vue` (the Feel listbox in the Changes Rhythm group);
  - `web/app/utils/changesDrawing.ts` (`slashes` draws `bar.slashes`, the feel mark);
  - `web/app/components/EditorView.vue`.
- Test: `web/test/usePreferences.test.ts`, `interface.test.ts`, `engine/src/__tests__/share.test.ts`; `web/e2e/changes.spec.ts`

- [ ] **Step 1: Write the failing tests.**
  - **Review Focus 5:** with the flag off, a stored `csm-feel=1` reads 4 and stays stored; with the flag on, it
    reads 1.
  - `feel: 1` round-trips in a link, and `feel: 3` drops.
  - `setAway` lists `feel` at 2.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.** Add the listbox (aria-label "Feel", *In 4*, *In 2*, *In 1*, title "Group the beats in
  4, in 2 (half time) or in 1"), shown with the flag and `shows('feel')`, rhythm on or off. Slashes draw as hollow
  slash heads for `h`/`hd`/`w`, tied where `tie`. The mark is italic "in 2" or "in 1" over the first bar, in the
  target-dot band.
- [ ] **Step 4: e2e.** Feel in 2 on F Blues: each bar has 2 slash notes, and the caption contains "in 2" when a
  rhythm is on. Run `make test && make lint && make e2e && make a11y`.
- [ ] **Step 5: Help, DECISIONS and design.md.** Add `#rhythm-feel` (Bergonzi ch. 30, Galper's half time) and the
  `rhythm.feel` row. Update `docs/design.md`'s Changes rhythm section (pulse grid, paths, Feel). Run `make docs`.
- [ ] **Step 6:** Commit, then open PR 4, "Rhythm Phase 4: Feel", and queue auto-merge.

---

## Part 5 (PR 5): Flag on

### Task 5.1: Turn `rhythmGears` on

**Files:** `web/nuxt.config.ts`, `web/test/features.test.ts`, `web/app/utils/releaseNotes.ts`

- [ ] **Step 1:** Change `features.test.ts` to expect `rhythmGears: true`, and run it. Expected: FAIL.
- [ ] **Step 2:** Turn the flag on. Add a `releaseNotes.ts` item in the style of #551's: tuplet pulses, Groups and
  Gears paths, Feel, each linking its Help anchor.
- [ ] **Step 3:** Run `make test && make lint && make e2e && make a11y`. Expected: PASS.
- [ ] **Step 4:** Commit, then open PR 5, "Rhythm Phase 4: turn on gears, paths and Feel", and queue auto-merge.
