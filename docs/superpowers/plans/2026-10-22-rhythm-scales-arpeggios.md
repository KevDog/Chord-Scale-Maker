# Rhythm on the Scales and Arpeggios Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Scales sheet gets a rhythm card under each staff and a Notes per bar run, and the Arpeggios sheet pours
its runs into the Rhythm, all behind a new flag `rhythmSheets`.

**Architecture:** The engine holds everything that can be pure:
- `engine/src/rhythm/run.ts` (new) holds the card (`cardBars`), Notes per bar's notation (`evenBar`, `evenRun`) and
  pouring a run of notes into a rhythm (`pourRun`). It reads `layRhythm` and `rhythmNotes` and changes neither;
- `buildSheet` and `buildArpeggioSheet` take `{ rhythm, notesPerBar, beatsOf }` and put `card`, `run` and `timeSig`
  on their staff models;
- `rowBarBeats(doc)` (`changes.ts`) gives each row's bar length, which `EditorView` hands in as `beatsOf`.

On the web side, `web/app/utils/vexflow.ts` draws a run bar by bar (`drawRun`, shared by both staves), and
`changesDrawing.ts` draws the card (`drawRhythmCard`, sharing the rhythm line's helpers). The Rhythm controls move
into `RhythmControls.vue`, used by the Changes Line options and a new Rhythm rail group on Scales and Arpeggios.

**Tech Stack:** TypeScript strict, Vitest, VexFlow, Nuxt/Vue, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-rhythm-scales-arpeggios-design.md` (cited as §n, its Decisions as Dn).
It builds on `docs/superpowers/specs/2026-10-22-rhythm-line-design.md` (P1) and
`docs/superpowers/specs/2026-10-22-rhythm-on-lines-design.md` (P2).

## Global Constraints

- `engine/` has no Vue, DOM or VexFlow imports. Every new export goes through `engine/src/index.ts` (the rhythm
  folder's `index.ts` re-exports `run.ts`); `api.test.ts`'s snapshot is updated with `-u` and reviewed.
- **With the flag off, or with Rhythm Off and Notes per bar *Whole notes*, both sheets are exactly today's** (D4, D7).
  No staff `id` changes at the defaults, so nothing redraws.
- New flag `rhythmSheets`: off in `web/nuxt.config.ts`, on in the e2e build; `web/test/features.test.ts` lists
  `rhythmSheets: false` (Task 3), and `true` only in Task 10.
- The Rhythm is the one `csm-rhythm` preference (D6). Start, Timing, Restate and Target beats stay Changes-only.
- Existing tests pass unedited, except the intended edits named in their task: `api.test.ts` (snapshot),
  `features.test.ts`, `interface.test.ts` (`CONTROL_TIERS` equality, `DEFAULTS: ViewSettings`).
- **Red first.** Every Step 1 test must fail before its implementation step; a *(guard)* test passes before on purpose.
- Pure functions and readonly data (`Readonly<{…}>`, no classes); typed test fixtures, so `make test`'s typecheck passes.
- Nothing from Saindon or Bergonzi is reproduced; Help cites them by title and page. American spelling.
- After an engine task: `make golden` shows no diff (D17), then `make test`; `make lint` clean.
- Each PR touches the Help page or `decisions.ts`, and its description carries
  `Release notes: none — the rhythmSheets flag is off` (D18), until Task 10.
- Commits stage files by name, never `git add -A`.

## Review Focus

1. **A rhythm with an all-rest bar** (custom `8: x_______________` is 2 bars, the second all held; `8: x.......
   ........` has an empty 2nd bar): the run keeps the empty bar and goes on in the next, never loops forever. Test in
   Task 4.
2. **A staff with an error** (no scale, unreadable chord) gets no card, run or time signature. Test in Task 2.
3. **Accidentals by bar:** a run in key-signature mode that plays F♯ in bar 1 and F in bar 2 draws the natural again
   in bar 2, and an F♯ repeated within a bar draws its sharp once. Test in Task 5.
4. **The Pentatonic preset's added notes** (#308) join the run, and their `outside` flag follows them up and down.
   Test in Task 5.
5. **Flag off with a stored rhythm** (a player who chose one on the Changes): Scales and Arpeggios draw today's
   staves and list no hidden setting. Test in Task 3.

---

## PR 1: the rhythm card

### Task 1: `cardBars` and each row's bar length

**Files:**
- Create: `engine/src/rhythm/run.ts`; Test: `engine/src/__tests__/rhythmRun.test.ts`
- Modify: `engine/src/rhythm/lay.ts` (export the cycle count), `engine/src/rhythm/index.ts`,
  `engine/src/changes.ts` (`rowBarBeats`), `engine/src/index.ts` if `changes.ts`'s exports are listed by name
- Test: `engine/src/__tests__/changes.test.ts`, `engine/src/__tests__/api.test.ts` (snapshot)

**Interfaces:**
- Produces:
  - `cycleBars(unit: number, barPulses: number): number` in `lay.ts` (`unit / gcd(unit, barPulses)`); `rhythmCaption`
    uses it in place of its inline sum;
  - `type RhythmCardModel = Readonly<{ bars: readonly (readonly RhythmNote[])[]; cut: boolean; beats: number }>`;
  - `cardBars(id: RhythmId, beats: number): RhythmCardModel | null` (null for Off);
  - `rowBarBeats(doc: ChartDoc): ReadonlyMap<number, number>`: each row of `sectionLayout(doc).value.rows` (the
    indexes `buildSheet`'s rows use) to the length in beats of the bar it starts in, from `laidOut`'s clock
    (`barLength(clock, bar)`); rows of a folded repeat take their bar too.

- [ ] **Step 1: Write the failing tests** — `rhythmRun.test.ts`, "cardBars": §1's table, one `it` per row, asserting
  `bars.length` and `cut` (`unit:8:3:accents` 4 → 3, false; `unit:8:5:accents` 4 → 4, true; `unit:8:4:accents` → 1;
  `card:downbeats` → 1; `run:8:3:0` → 1; `unit:8:3:accents` at 3 beats → 1), plus `cardBars('off', 4)` is null and
  `cardBars('unit:8:3:accents', 4)!.bars` equals `rhythmNotes(layRhythm('unit:8:3:accents', [4, 4, 4])!)`.
  `changes.test.ts`, "rowBarBeats": a chart with `time: 4/4` and a section B with `time: 3/4` maps an A row to 4 and a
  B row to 3; a chart with no time maps every row to 4.
- [ ] **Step 2: Run to see them fail** — `cd engine && npx vitest run src/__tests__/rhythmRun.test.ts src/__tests__/changes.test.ts`. Expected: FAIL, `cardBars`/`rowBarBeats` not exported.
- [ ] **Step 3: Implement** `cycleBars`, `cardBars` (cycle from the laid rhythm's `unit` and one bar's pulses for a
  repeat, 1 for `kind: 'bar'`; lay over `min(cycle, 4)` bars of `beats`) and `rowBarBeats`. Export them.
- [ ] **Step 4: Run** the two files, then `npx vitest run src/__tests__/rhythmLay.test.ts` (caption guard) and
  `npx vitest run src/__tests__/api.test.ts -u`; review the snapshot adds only the three names and the type.
- [ ] **Step 5: Commit** — `git add engine/src/rhythm/run.ts engine/src/rhythm/lay.ts engine/src/rhythm/index.ts engine/src/changes.ts engine/src/index.ts engine/src/__tests__/rhythmRun.test.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/__snapshots__` → "Rhythm cards: cardBars and rowBarBeats".

### Task 2: The Scales staff model gains a card, a time signature, and the subtitle the rhythm

**Files:**
- Modify: `engine/src/sheet.ts`; Test: `engine/src/__tests__/sheet.test.ts`

**Interfaces:**
- Consumes: `cardBars`, `RhythmCardModel` (Task 1).
- Produces:
  - `type SheetRhythm = Readonly<{ rhythm?: RhythmId; notesPerBar?: NotesPerBar; beatsOf?: (row: number) => number }>`
    (`NotesPerBar` arrives in Task 4; in this task the type has `rhythm` and `beatsOf` only);
  - `buildSheet(..., keys?, options: SheetRhythm = {})`: the new trailing parameter;
  - `StaffModel` gains `card: RhythmCardModel | null` and `timeSig: string | null`;
  - `pageSubtitle(subtitle, instrument, heading, extra: readonly string[] = [])`: appends ` · ${part}` for each;
    `sheetRhythmText(rhythm: RhythmId, notesPerBar?: NotesPerBar): readonly string[]` gives
    `['Rhythm: 8ths in 3, with accents']` (`Rhythm: ${rhythmLabel(id)}`) and, from Task 4, `'4 a bar'`; `[]` for Off.

- [ ] **Step 1: Write the failing tests** in `sheet.test.ts`, "rhythm card":
  - `buildSheet(rows, part, 'from', 'C', 12, null, undefined, undefined, undefined, undefined, { rhythm: 'unit:8:5:accents' })`:
    every staff without an error has `card.bars.length === 4`, `card.cut === true`, `timeSig === '4/4'`;
  - with `beatsOf: (r) => (r === 1 ? 3 : 4)`, the staff whose line's first row is 1 has `timeSig '3/4'` and
    `card.beats === 3`;
  - a staff with `error` ("Choose a scale") has `card === null` and `timeSig === null` (Review Focus 2);
  - *(guard)* with no options, every staff's `card` and `timeSig` are null and its `id` equals the id built today
    (snapshot the ids of a fixture chart before the change);
  - the `id` with a rhythm differs from the id without;
  - `pageSubtitle('Stella', 'Tenor Sax (Bb)', 'Spelled from C', sheetRhythmText('unit:8:3:accents'))` is
    `'Stella – Tenor Sax (Bb) (Spelled from C) · Rhythm: 8ths in 3, with accents'`; `sheetRhythmText('off')` is `[]`.
- [ ] **Step 2: Run to see them fail** — `cd engine && npx vitest run src/__tests__/sheet.test.ts`.
- [ ] **Step 3: Implement** in `staff()`: the line's beats `beatsOf?.(line.row) ?? 4`; `card` when the rhythm is not
  Off and the staff has notes; `timeSig` `${beats}/4` when it has a card; the id appends `rhythm|beats` only when a
  card is drawn (so default ids hold). `pageSubtitle` and `sheetRhythmText` as above; export `sheetRhythmText`.
- [ ] **Step 4: Run** `sheet.test.ts`, `arpeggioSheet.test.ts` (guard), `make golden` (no diff), `api.test.ts -u`.
- [ ] **Step 5: Commit** — `git add engine/src/sheet.ts engine/src/index.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/__snapshots__` → "Rhythm cards: the Scales staff model".

### Task 3: The flag, `RhythmControls.vue`, the Scales Rhythm group and its wiring

**Files:**
- Create: `web/app/components/RhythmControls.vue`
- Modify: `web/nuxt.config.ts` (flag), `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`,
  `web/app/components/ScaleSheet.vue`, `web/app/utils/interface.ts`
- Test: `web/test/features.test.ts`, `web/test/interface.test.ts`, `web/e2e/scales.spec.ts`

**Interfaces:**
- Consumes: `buildSheet`'s `SheetRhythm`, `sheetRhythmText`, `rowBarBeats`.
- Produces:
  - `RhythmControls.vue`: `v-model` a `RhythmId`; it is the Rhythm listbox and its unit/run/custom detail, moved
    verbatim from `PreviewControls.vue` (the `rhythmFamily`, `setUnit`, `setRun`, `rhythmText` logic with it). The
    Start/Timing/Restate block and the Guide Tones description stay in `PreviewControls.vue`, after it.
  - `ScaleSheet.vue` props gain `rhythm?: RhythmId` and `beatsOf?: (row: number) => number`.
  - In `EditorView.vue`, `sheetRhythm = computed(() => sheet === 'changes' ? prefs.rhythm : rhythmSheetsOn && !(sheet === 'arpeggios' && arpShape === 'block') ? prefs.rhythm : 'off')`.
    It feeds the sheets and `ViewSettings.rhythm`.

- [ ] **Step 1: Write the failing tests**:
  - `features.test.ts`: the flags `toEqual` gains `rhythmSheets: false` (intended edit; title gains "rhythmSheets (new)");
  - `interface.test.ts`, "lists the rhythm on the Scales sheet": `hiddenSettings('essentials', { ...DEFAULTS, sheet:
    'scales', rhythm: 'unit:8:3:accents' })` lists `'rhythm'` at `'intermediate'`; with `rhythm: 'off'` (what
    `EditorView` passes with the flag off: Review Focus 5) it lists nothing;
  - `scales.spec.ts`, "a rhythm card under each staff": on F Blues, Scales sheet, Rhythm 8ths in 5 with accents (the
    fixture `chooseRhythm` works through `RhythmControls`): every staff has a `[data-slot=rhythm-card]`, and the page
    subtitle contains "Rhythm: 8ths in 5, with accents". (The card's drawing lands in Task 4; this asserts the slot
    and the subtitle.)
- [ ] **Step 2: Run to see them fail** — `cd web && npx vitest run test/features.test.ts test/interface.test.ts`; `npm run e2e -- --grep "rhythm card"`.
- [ ] **Step 3: Implement**:
  - the flag `rhythmSheets: false` beside `rhythm` in `nuxt.config.ts`, and on in the e2e build's flag list;
  - `RhythmControls.vue`; the Line options popover uses it (no visible change: the existing Changes rhythm e2e
    specs are the guard);
  - on Scales, a `UiField` "Rhythm" after Spell Scale, shown when `useFeature('rhythmSheets') && shows('rhythm')`:
    the Rhythm listbox's selected label, and a *Rhythm options* `RailPopover` button holding the detail (as
    Line options does) only when the rhythm has detail;
  - `setAway`: `'rhythm'` at Intermediate also when `(scales || v.sheet === 'arpeggios') && v.rhythm !== 'off'`;
  - share link: `rhythm` written on Scales and Arpeggios too when `sheetRhythm !== 'off'`;
  - `ScaleSheet.vue` passes `{ rhythm, beatsOf }` to `buildSheet` and `sheetRhythmText(rhythm)` to `pageSubtitle`;
    `ScaleStaff.vue` renders an empty `<div data-slot="rhythm-card">` when `staff.card`;
  - `EditorView` builds `beatsOf` from `rowBarBeats(doc)` (the document the rows come from), default 4.
- [ ] **Step 4: Run** `make test`, `npm run e2e -- --grep "rhythm"` (the Changes rhythm specs still pass).
- [ ] **Step 5: Commit** — the files above by name → "Rhythm cards: the flag, RhythmControls and the Scales Rhythm group".

### Task 4: Drawing the card and the time signature; print, Help, decision, a11y

**Files:**
- Modify: `web/app/utils/changesDrawing.ts` (`drawRhythmCard`), `web/app/utils/vexflow.ts` (`drawStaff`'s time
  signature), `web/app/components/ScaleStaff.vue`, `web/app/pages/help.vue`, `engine/src/decisions.ts`,
  `docs/design.md`
- Test: `web/test/changesDrawing.test.ts`, `web/e2e/scales.spec.ts`, `web/e2e/print.spec.ts`, `web/e2e/a11y/*`

**Interfaces:**
- Consumes: `StaffModel.card`, `StaffModel.timeSig`.
- Produces: `drawRhythmCard(vf, el, card: RhythmCardModel, width: number): void` and `cardAria(label: string, card:
  RhythmCardModel): string` → `'Rhythm card: 8ths in 5, with accents, 4 bars, continues'` (", continues" only when cut).

- [ ] **Step 1: Write the failing tests**:
  - `changesDrawing.test.ts`: `cardAria` for a cut 4-bar card and an uncut 1-bar card (`'Rhythm card: Downbeats, 1 bar'`);
  - `scales.spec.ts` (extends Task 3's): each card's SVG has 4 bars (`[data-rhythm-bar]` count), an "…" text, an
    aria-label from `cardAria`, and a `[data-rhythm-bracket]`; each staff's SVG has a time signature
    (`data-time-sig="4/4"` on its SVG, set by `drawStaff`); with Rhythm Off, none of these (guard);
  - `print.spec.ts`: §8's first check (F Blues, piano, `unit:8:5:accents`): PDF pages equal sheet pages.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** `drawRhythmCard`: a 1-line stave per bar (each `width / 4` wide, D14), `rhythmTick`
  notes, `tripletsOf`, beams by `beam`, ties, Saindon's bracket as `drawRhythmLine` draws it (extract the bracket loop
  into a helper both call), the time signature on the first stave, an "…" text after the last barline when `cut`;
  each stave group tagged `data-rhythm-bar`. `drawStaff` adds `stave.addTimeSignature(staff.timeSig)` after the key
  when set. If print overflows, apply §8's fallback (`perPage` 10 when any staff has a card) and note it in the PR.
- [ ] **Step 4: Docs**: Help `#rhythm-card` (what the card is, its cycle and the "…", that the whole notes stay);
  `DECISIONS` row `rhythm.staff-metre` (page `help`, anchor `#rhythm-card`, D8 in a sentence); `docs/design.md`'s
  Scales section. a11y: the Scales sheet with a card, light and dark, via `expectAccessible`.
- [ ] **Step 5: Run** `make test`, `make docs`, `npm run e2e -- --grep "rhythm card|print"`, `make a11y`.
- [ ] **Step 6: Commit and open PR 1** ("Rhythm Phase 3: rhythm cards on the Scales sheet", with `Release notes:
  none — the rhythmSheets flag is off`), queue with `gh pr merge N --auto --merge`.

## PR 2: Notes per bar

### Task 5: `evenBar`, `evenRun`, `pourRun`

**Files:** Modify `engine/src/rhythm/run.ts`; Test `engine/src/__tests__/rhythmRun.test.ts`, `api.test.ts`.

**Interfaces:**
- Produces (exact, from §5):
  ```ts
  type NotesPerBar = 'whole' | 1 | 2 | 3 | 4 | 5 | 6 | 7
  const NOTES_PER_BAR: readonly NotesPerBar[]            // ['whole', 1, 2, 3, 4, 5, 6, 7]
  const NOTES_PER_BAR_LABELS: Readonly<Record<string, string>>  // whole: 'Whole notes', 1: '1 a bar', … 7: '7 a bar'
  function isNotesPerBar(x: unknown): x is NotesPerBar
  type BarTuplet = Readonly<{ notes: number; of: number }>
  function evenBar(beats: number, n: number): Readonly<{ values: readonly RhythmValue[]; tuplet: BarTuplet | null }>
  type RunNote = Readonly<{ note: number | null; mark: RhythmNote }>
  type RunBar = Readonly<{ notes: readonly RunNote[]; tuplet: BarTuplet | null }>
  type StaffRun = Readonly<{ beats: number; bars: readonly RunBar[] }>
  function evenRun(count: number, beats: number, n: number): StaffRun
  function pourRun(count: number, id: RhythmId, beats: number, perBar: number | null): StaffRun | null
  ```
  `evenBar(b, 1).values` is the bar-long split (`restPieces(0, b·per, per, false)`'s values: 5 → `['w', 'q']`).
  In a tuplet bar, every note's `mark.tuplet` is 0 and `mark.beam` is 0 when the value beams. `sheetRhythmText` gains
  `'<n> a bar'` for a number.

- [ ] **Step 1: Write the failing tests**:
  - "evenBar": §2's table, all 21 cells, as `[beats, n, values, tuplet]` rows (`[4, 3, ['h','h','h'], {notes:3, of:2}]`,
    `[3, 4, ['q','q','q','q'], {notes:4, of:3}]`, `[3, 7, [8 ×7], {notes:7, of:6}]`, `[5, 2, ['q','q'], {notes:2, of:5}]`,
    `[3, 2, ['qd','qd'], null]`, `[5, 1, ['w','q'], null]`, …);
  - "evenRun": §2's worked rows: `evenRun(15, 4, 4)` has 4 bars, notes `[0..3]`, `[4..7]`, `[8..11]`, `[12,13,14,null]`
    (the last a `q` rest); `evenRun(15, 4, 5)` 3 bars, tuplet `{5,4}` each, no rests; `evenRun(15, 3, 6)`'s last bar
    is notes 12–14 then rests `8` at beat 1.5 and `q` at beat 2; `evenRun(15, 4, 7)`'s last bar is note 14 and six
    tuplet `q` rests;
  - "pourRun": §2's last two rows (`unit:8:3:accents`, n 4: bar 1 notes 0–3 as `8`s then an `h` rest; `card:downbeats`,
    n 3: `q q q` then a `q` rest); §4's three rows with `perBar: null` and `count: 9` (accents on notes 0, 3, 6; bar 2
    = note 8 then `8`, `q`, `h` rests; `unit:8:3:rests` gives `C r r E r G r` placement); a tied rhythm
    (`unit:8:3:tied`) gives the tied-in piece its attack's `note`; Review Focus 1: `pourRun(3, <the custom id for `8: x...............`>, 4, null)` gives 5 bars (attack, empty,
    attack, empty, attack) and returns; `pourRun(n, 'off', …)` is null.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** `evenBar` by §2's four rules in order; `evenRun` fills bars and pads the last; `pourRun`
  lays the rhythm over growing bars (double from `count` bars, cap 64) until the kept attacks reach `count`, keeps the
  first `perBar` attacks a bar (later ones become rests merged by `restPieces`), assigns notes in order, drops bars
  after the last note. A rhythm short of attacks at 64 bars returns null (the caller draws today's staff).
- [ ] **Step 4: Run** `rhythmRun.test.ts`, `api.test.ts -u` (review), `make golden` (no diff).
- [ ] **Step 5: Commit** → "Notes per bar: evenBar, evenRun and pourRun".

### Task 6: The run on the Scales staff model

**Files:** Modify `engine/src/sheet.ts`; Test `engine/src/__tests__/sheet.test.ts`.

**Interfaces:**
- Consumes: Task 5.
- Produces: `SheetRhythm.notesPerBar`; `StaffModel.run: (StaffRun & Readonly<{ notes: readonly Pitched[];
  accidentals: readonly (string | null)[]; source: readonly number[] }>) | null`, where `notes` is the run's 2K + 1
  pitches, `accidentals` one per run note figured bar by bar (`accidentalsInBar` per bar against `keySig`), and
  `source[i]` the staff note index run note i repeats (the top note: 0 shifted an octave; D15). `scaleRun(notes:
  readonly Pitched[]): Readonly<{ notes: readonly Pitched[]; source: readonly number[] }>` exported for the tests.

- [ ] **Step 1: Write the failing tests**: `scaleRun` of C D E F G A B → 15 notes ending on C4 with C5 in the middle,
  `source` `[0..6, 0, 6..0]`; `buildSheet(..., { notesPerBar: 4 })` → each staff's `run.bars.length === 4`,
  `timeSig '4/4'`, `card === null` even with a rhythm (D10); with a rhythm and n 4, `run` comes from `pourRun`;
  Review Focus 3: D Mixolydian from D in key-signature mode (C major), n 4 (bars D E F♯ G · A B C D · C B A G ·
  F♯ E D r): `#` on the F♯ in bar 1 and again in bar 4; n 7 (D E F♯ G A B C · D C B A G F♯ E · D): `#` once in bar 1
  and once in bar 2;
  Review Focus 4: with the Pentatonic preset adding a note,
  `run.notes.length === 2 * staff.notes.length + 1` and the added note's `source` points at its staff index;
  *(guard)* `notesPerBar: 'whole'` leaves `run` null and ids unchanged.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** in `staff()`, after the practice merge, so the run reads the final `notes`.
- [ ] **Step 4: Run** `sheet.test.ts`, `make golden`, `api.test.ts -u`.
- [ ] **Step 5: Commit** → "Notes per bar: the run on the Scales staff".

### Task 7: Drawing runs; the Notes per bar control, preference, link and docs

**Files:**
- Modify: `web/app/utils/vexflow.ts` (`drawRun`, `drawStaff`), `web/app/components/ScaleStaff.vue`,
  `PreviewControls.vue`, `EditorView.vue`, `ScaleSheet.vue`, `web/app/composables/usePreferences.ts`,
  `engine/src/share.ts`, `web/app/utils/interface.ts`, `web/app/pages/help.vue`, `engine/src/decisions.ts`,
  `docs/design.md`
- Test: `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/test/interface.test.ts`,
  `web/e2e/scales.spec.ts`, `web/e2e/print.spec.ts`, `web/e2e/a11y/*`

**Interfaces:**
- Produces: `drawRun(vf, ctx, run: StaffRun, pitches: readonly Pitched[], accidentals: readonly (string | null)[],
  clef, x0: number, width: number, opts: { clef: boolean; keySig: string | null; timeSig: string; last: boolean }):
  StaveNote[]` (one stave per bar, widths shared by note count; ties; one `vf.Tuplet({ numNotes, notesOccupied: of })`
  per tuplet bar; beams by `mark.beam`; returns the run's notes in order, rests included); `drawArpeggioStaff` reuses
  it in Task 9. `notesPerBar` preference `csm-notes-per-bar` (`whole` | `1`…`7`, else `whole`; read as `whole` with the
  flag off); `ShareView.notesPerBar?: 1|…|7`; `ViewSettings.notesPerBar`; `HiddenSetting` `'notes-per-bar'`;
  `CONTROL_TIERS['notes-per-bar'] = 'intermediate'`.

- [ ] **Step 1: Write the failing tests**:
  - prefs: stored `'5'` reads 5, `'9'` and `'x'` read `'whole'`; flag off reads `'whole'`;
  - share: `notesPerBar: 4` round-trips; `0`, `8`, `'whole'` drop;
  - interface: `CONTROL_TIERS` equality gains `'notes-per-bar': 'intermediate'`, `DEFAULTS` gains
    `notesPerBar: 'whole'`; at Essentials, Scales with `notesPerBar: 3` lists `'notes-per-bar'`;
  - e2e "notes per bar": F Blues Scales, Notes per bar 4: the first staff has 4 bars and a `4/4` time signature; with
    Practice "1 3 5" on, the lit notes (`.vf-selected`) number twice the staff's lit pitches less one where the top
    repeats the root (assert by aria-label: "; practice:" lists the run's lit names); a share link with
    `notesPerBar: 5` opens with "Notes per bar: 5 a bar" selected; intervals row labels one per run note;
  - print: §8's second check (Notes per bar 7 and 1).
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement**: `drawRun`; `drawStaff` takes the run path when `staff.run` (practice classes by
  `run.source`, aria-label from run names with "rest", the xs per run note); `ScaleStaff` maps `staff.intervals`
  through `run.source` for its labels; the Notes per bar listbox in the Scales Rhythm group (`aria-label="Notes per
  bar"`, the title from §9, shown with `shows('notes-per-bar')`); `ScaleSheet` passes `notesPerBar` and
  `sheetRhythmText(rhythm, notesPerBar)`; the reset clears it. Print fallback per §8 if needed (and the N = 1
  up-only fallback only if its bars collide; then add `scaleRun`'s up-only variant and a test).
- [ ] **Step 4: Docs**: Help `#notes-per-bar` (the run, §2 in words, a Rhythm's first N attacks; Bergonzi, *Inside
  Improvisation Vol. 4*, ch. 1); `DECISIONS` `rhythm.notes-per-bar`; `docs/design.md`. a11y: Scales with Notes per
  bar 5 and Practice on, light and dark.
- [ ] **Step 5: Run** `make test`, `make lint`, `make docs`, `npm run e2e -- --grep "notes per bar|print"`, `make a11y`.
- [ ] **Step 6: Commit and open PR 2** ("Rhythm Phase 3: Notes per bar"), queue it.

## PR 3: the Arpeggios sheet

### Task 8: The poured run on the Arpeggios staff model

**Files:** Modify `engine/src/arpeggioSheet.ts`; Test `engine/src/__tests__/arpeggioSheet.test.ts`.

**Interfaces:**
- Consumes: `pourRun` (Task 5).
- Produces: `PairOptions` gains `rhythm?: RhythmId; beatsOf?: (row: number) => number`; `ArpeggioStaffModel` gains
  `run: StaffRun | null` and `timeSig: string | null`; with a run, `accidentals` is refigured bar by bar; `id` gains the
  rhythm and beats only with a run.

- [ ] **Step 1: Write the failing tests**: §4's three rows on a Cmaj7 line (7th Chord, Up): `run.bars` notes and
  marks as the table gives (`unit:8:3:accents`: accents on notes 0, 3, 6, beams `[0,1,2] [3,4,5] [6,7]`, bar 2 note 8
  unaccented then rests); `timeSig '4/4'`; Block (`shape: 'block'`) with a rhythm → `run === null`, `timeSig === null`;
  an error staff → no run; *(guard)* no rhythm → ids and `groups` unchanged.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement**: `pourRun(notes.length, rhythm, beats, null)` per staff, beside today's notes.
- [ ] **Step 4: Run** the file, `triadPairSheet.test.ts` (guard), `make golden`, `api.test.ts -u`.
- [ ] **Step 5: Commit** → "Arpeggios: the run poured into the rhythm".

### Task 9: Drawing, the Arpeggios Rhythm group, docs

**Files:** Modify `web/app/utils/vexflow.ts` (`drawArpeggioStaff`), `web/app/components/ArpeggioSheet.vue`,
`ArpeggioStaff.vue`, `PreviewControls.vue`, `EditorView.vue`, `web/app/pages/help.vue`, `docs/design.md`; Test
`web/e2e/arpeggios-sheet.spec.ts`, `web/e2e/print.spec.ts`, `web/e2e/a11y/*`.

- [ ] **Step 1: Write the failing tests** (e2e): Arpeggios, 7th Chord, Up, Rhythm 8ths in 3 with accents: each staff
  has a `4/4` time signature, its aria-label lists the notes and ends with "; rhythm: Rhythm: 8ths in 3, with
  accents", and the page subtitle names the rhythm; switching to Triad pairs · Block hides the Rhythm group and the
  time signature; print: §8's third check (Extended, Up & down, `unit:8t:4:accents`).
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement**: `drawArpeggioStaff` uses `drawRun` when `staff.run` (no Saindon bracket: P2 D19);
  `ArpeggioSheet` passes `{ rhythm, beatsOf }` and `sheetRhythmText(rhythm)`; the Rhythm group (Task 3's, without
  Notes per bar) shows on Arpeggios when not Block. Print fallback per §8 if needed.
- [ ] **Step 4: Docs**: Help `#rhythm-arpeggios` and `#rhythm-grouping` ("Grouping in N: choose Rhythm 8ths in N,
  with accents"; Saindon, *Rhythmic Patterns*, p. 12; Bergonzi, ch. 32); `docs/design.md`'s Arpeggios section. a11y:
  the Arpeggios sheet with a rhythm, light and dark.
- [ ] **Step 5: Run** `make test`, `make lint`, `make docs`, `npm run e2e -- --grep "arpeggios|print"`, `make a11y`.
- [ ] **Step 6: Commit and open PR 3** ("Rhythm Phase 3: rhythm on the Arpeggios sheet"), queue it.

## PR 4: the flag on

### Task 10: `rhythmSheets` on, release notes

**Files:** `web/nuxt.config.ts`, `web/test/features.test.ts`, `web/app/utils/releaseNotes.ts`.

- [ ] **Step 1:** `features.test.ts` expects `rhythmSheets: true`; run, see it fail.
- [ ] **Step 2:** turn the flag on; add one `releaseNotes.ts` item covering the card, Notes per bar and the
  Arpeggios rhythm, linking `#rhythm-card`.
- [ ] **Step 3:** `make test`, `make e2e`; commit; open PR 4 as #544 did; queue it.
