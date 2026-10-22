# The rhythm line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pitch-free rhythm on the Changes sheet in place of the beat slashes, with Saindon's bracket, a cycle
caption, Galper's target-beat dots, and 7/4.

**Architecture:** The engine holds everything that can be pure, in `engine/src/rhythm/`:
- the text form;
- the generated library and its ids;
- laying a rhythm over the drawn bars;
- splitting the events into drawable notes;
- the target beats.

`buildChanges` puts each bar's `RhythmNote[]` and its targets on `ChangesBar`. `changesDrawing.ts` only maps those
onto VexFlow. The controls, preferences and share link follow the Approach's pattern behind the flag `rhythm`.

**Tech Stack:** TypeScript strict, Vitest, VexFlow, Nuxt/Vue, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-rhythm-line-design.md` (cited below as §n). The roadmap it follows is
`docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md`.

## Global Constraints

- `engine/` has no Vue, DOM or VexFlow imports. The app imports it only as `@chord-scale-maker/engine`, and every new
  export goes through `engine/src/index.ts` (the `api.test.ts` snapshot).
- Rhythm is a view preference and a share-link field. It is never written into chart rows.
- Flag `rhythm` starts off in `web/nuxt.config.ts`. The e2e build turns every flag on.
- Pulses: `4`, `8`, `8t`, `16` only. Groupings 2–7. Runs: n 2–7, pulse `8` | `8t` | `16`.
- Text form cells: `x . _ > |` and spaces, 1–64 cells, at least one `x`.
- Nothing from the three books is reproduced. Labels and Help text cite them by title and page.
- Pure functions and readonly data, matching the engine's style (`Readonly<{…}>`, no classes).
- After any engine change, run `make golden` and review the diff, then `make test`. `make lint` must be clean.
- The PR touches the Help page and `decisions.ts`, and adds a `releaseNotes.ts` item.

## Review Focus

1. **A custom rhythm whose leading `_` follows a rest at a repeat**, e.g. `8: _x.`. Expected: each later statement
   starts by holding the previous statement's last cell. That cell is a rest, which the validity rule forbids inside
   a statement, so `layRhythm` must treat a leading tie after a rest as an attack. Test in Task 4.
2. **A 2/4 or 3/4 bar inside a 4/4 chart under a run whose k exceeds that bar**, e.g. `run:8:3:6` over a 3/4 bar.
   Expected: the bar plays only what spills into it, with no crash and no negative lengths. Test in Task 3.
3. **A rhythm on a chart whose only bar is a repeat-sign section drawn once.** Expected: the landings and caption use
   the drawn bars, with no doubled bars. Test in Task 6.
4. **A stored `csm-rhythm` that names a unit with g = 8, or a pulse `32`.** Expected: it reads as Off and the sheet
   draws slashes. Test in Task 7.
5. **Triplets with a held note across two beats**, e.g. `8t: x_____` (two beats). Expected: per §6.3, whole beats
   of one held note merge, so a single `h` with no tuplet. Test in Task 5.

---

### Task 1: 7/4

**Files:**
- Modify: `engine/src/chart.ts:36-44` (`Beats`, `METRES`, `beatsPerBar`), the `@time` message at `:119`
- Modify: `engine/src/guideToneTimeline.ts:14-20` (`SPLITS`)
- Modify: `engine/src/guideTones.ts:69-79` (`drawnLengths`)
- Test: `engine/src/__tests__/chart.test.ts`, `guideToneTimeline.test.ts`, `guideTones.test.ts`

**Interfaces:**
- Produces: `Beats = 2 | 3 | 4 | 5 | 6 | 7`.

- [ ] **Step 1: Write failing tests**

```ts
it('reads 7/4', () => expect(beatsPerBar('7/4')).toBe(7))
it('still refuses 8/4', () => expect(beatsPerBar('8/4')).toBeNull())
it('splits a 7/4 bar as 4 + 3', () => /* a chart `time: 7/4`, bar 1 with two chords */ expect(starts).toEqual([0, 4]))
it('splits three chords in 7/4 as 2, 2, 3', () => expect(starts).toEqual([0, 2, 4]))
it('draws 7 beats as 4 + 3', () => expect(drawnLengths(7)).toEqual([4, 3]))
```

Also update the existing diagnostic assertions to read "2/4, 3/4, 4/4, 5/4, 6/4 or 7/4".

- [ ] **Step 2: Run them to see them fail**

`npm test -w engine -- chart guideTone`. Expected: the 7/4 cases fail.

- [ ] **Step 3: Implement**

- The regex becomes `/^([2-7])\/4$/`, and `METRES` and the `@time` message list 7/4.
- Add to `SPLITS`: `7: [[7],[4,3],[2,2,3],[2,2,2,1],[2,2,1,1,1],[2,1,1,1,1,1],[1,1,1,1,1,1,1]]`.
- `drawnLengths`: `if (length === 7) return [4, 3]` beside the 5 case.
- Fix any `Record<Beats, …>` the type checker flags. `changesLinesPerPage` is unaffected.

- [ ] **Step 4: Check**

`make test`. Expected: PASS.

- [ ] **Step 5: Commit**

`git add engine/src/chart.ts engine/src/guideToneTimeline.ts engine/src/guideTones.ts engine/src/__tests__` then commit
"7/4 metre (rhythm spec §5)".

### Task 2: The text form

**Files:**
- Create: `engine/src/rhythm/rhythm.ts`
- Test: `engine/src/__tests__/rhythm.test.ts`

**Interfaces:**
- Produces:
  - `type Pulse = '4' | '8' | '8t' | '16'`
  - `PULSES: readonly Pulse[]`
  - `PULSE_PER_BEAT: Readonly<Record<Pulse, number>>` (1, 2, 3, 4)
  - `PULSE_LABELS` (Quarters, 8ths, Triplets, 16ths)
  - `type Cell = 'x' | '.' | '_' | '>x'`, where `'>x'` is an accented attack: one cell
  - `type Rhythm = Readonly<{ pulse: Pulse; cells: readonly Cell[] }>`
  - `parseRhythm(text: string): Rhythm | null`
  - `formatRhythm(r: Rhythm): string`

- [ ] **Step 1: Write failing tests**

```ts
expect(parseRhythm('8: >xx.x_')).toEqual({ pulse: '8', cells: ['>x', 'x', 'x', '.', 'x', '_'] })
expect(formatRhythm(parseRhythm('8:  x x | . x')!)).toBe('8: xx.x')
expect(parseRhythm('8t: _xx')?.cells[0]).toBe('_') // a leading tie is valid
for (const bad of ['', '8:', '8: ...', '8: x>', '8: x._', '32: x', '8: xyz', `8: ${'x'.repeat(65)}`]) expect(parseRhythm(bad)).toBeNull()
```

- [ ] **Step 2: Run to see them fail**

`npm test -w engine -- rhythm`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** in `rhythm.ts`, with §2's rules exactly.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm text form (rhythm spec §2)".

### Task 3: The library and its ids

**Files:**
- Create: `engine/src/rhythm/library.ts`
- Test: `engine/src/__tests__/rhythmLibrary.test.ts`

**Interfaces:**
- Consumes: Task 2's types.
- Produces:
  - `type Variation = 'accents' | 'rests' | 'rest-last' | 'syncopated' | 'tied'`
  - `VARIATIONS` and `VARIATION_LABELS`
  - `type RhythmId = 'off' | \`unit:${string}\` | \`run:${string}\` | \`card:${'downbeats' | 'upbeats' | 'halves'}\` | \`custom:${string}\``
  - `isRhythmId(s: string): s is RhythmId`
  - `rhythmLabel(id: RhythmId): string`
  - `unitRhythm(pulse: Pulse, g: number, v: Variation): Rhythm`
  - `type BarRhythm = (beats: number) => readonly Cell[]`: one bar's cells at the id's pulse, for runs and cards
  - `rhythmOf(id: RhythmId): Readonly<{ kind: 'repeat'; rhythm: Rhythm } | { kind: 'bar'; pulse: Pulse; bar: BarRhythm; n: number; k: number }> | null`
    - n and k are the run's (0 for a card);
    - null for `off` or an invalid id.
  - `positionLabel(pulse: Pulse, k: number): string`
  - `LIBRARY_IDS: readonly RhythmId[]`: every unit, run and card, for the golden fixture and the listboxes

- [ ] **Step 1: Write failing tests**

```ts
expect(formatRhythm(unitRhythm('8', 3, 'accents'))).toBe('8: >xxx')
expect(formatRhythm(unitRhythm('8', 3, 'rests'))).toBe('8: x..')
expect(formatRhythm(unitRhythm('8', 3, 'rest-last'))).toBe('8: xx.')
expect(formatRhythm(unitRhythm('8', 3, 'syncopated'))).toBe('8: _xx')
expect(formatRhythm(unitRhythm('8', 3, 'tied'))).toBe('8: x__')
expect(rhythmLabel('unit:8:5:accents')).toBe('8ths in 5, with accents')
expect(rhythmLabel('run:8:4:3')).toBe('4 8ths from the and of 2')
expect(positionLabel('8t', 4)).toBe('the trip of 2')
expect(positionLabel('16', 3)).toBe('the a of 1')
expect(rhythmLabel('card:upbeats')).toBe('Upbeats')
expect(rhythmLabel('custom:8:x.x')).toBe('Your rhythm (8: x.x)')
for (const bad of ['unit:8:8:accents', 'unit:32:3:accents', 'run:4:3:0', 'run:8:4:8', 'card:fours', 'custom:8:...', 'x']) expect(isRhythmId(bad)).toBe(false)
// cards
const card = rhythmOf('card:halves')
expect(card?.kind === 'bar' && card.bar(3).join('')).toBe('x___x_')
const up = rhythmOf('card:upbeats')
expect(up?.kind === 'bar' && up.bar(4).join('')).toBe('.x.x.x.x')
// a run past a short bar's end (Review Focus 2): k 6 in a 3/4 bar of 8ths has no own attacks
const run = rhythmOf('run:8:3:6')
expect(run?.kind === 'bar' && run.bar(3).join('')).toBe('......')
```

A run's `bar` returns only the bar's own cells. The spill past the barline is `layRhythm`'s job (Task 4), which reads
n and k from `rhythmOf`.

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement** per §3. The 4/4 bar's pulse count bounds k: 8, 12 or 16.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm library and ids (rhythm spec §3)".

### Task 4: Laying a rhythm over the bars, and the caption

**Files:**
- Create: `engine/src/rhythm/lay.ts`
- Test: `engine/src/__tests__/rhythmLay.test.ts`

**Interfaces:**
- Consumes: `rhythmOf`, `rhythmLabel`, `PULSE_PER_BEAT`.
- Produces:
  - `type RhythmEvent = Readonly<{ at: number; length: number; rest: boolean; accent: boolean; tiedIn: boolean; tie: boolean; statement: number }>`
    - `at` and `length` are in pulses from the bar's start;
    - `statement` is the unit statement's index on the sheet for a repeating rhythm, and the beat's index in the bar
      for a per-bar one.
  - `type Laid = Readonly<{ pulse: Pulse; kind: 'repeat' | 'bar'; bars: readonly (readonly RhythmEvent[])[]; landings: readonly number[] }>`
  - `layRhythm(id: RhythmId, bars: readonly number[]): Laid | null`
  - `rhythmCaption(id: RhythmId, laid: Laid, bars: readonly number[]): string`

- [ ] **Step 1: Write failing tests**

These cover §4's landing table, row by row:

```ts
expect(layRhythm('unit:8:5:accents', Array(8).fill(4))?.landings).toEqual([0, 5])
expect(layRhythm('unit:8:4:accents', Array(4).fill(3))?.landings).toEqual([0, 2])
expect(layRhythm('unit:8t:4:accents', [4, 4])?.landings).toEqual([0, 1])
expect(layRhythm('unit:8:7:accents', Array(14).fill(3))?.landings).toEqual([0, 7])
expect(layRhythm('unit:8:5:accents', [4, 4, 3, 4, 4])?.landings).toEqual([0, 4])
```

The captions:

```ts
const cap = (id: RhythmId, bars: number[]) => rhythmCaption(id, layRhythm(id, bars)!, bars)
expect(cap('unit:8:5:accents', Array(8).fill(4))).toBe('Rhythm: 8ths in 5, with accents · back on one every 5 bars')
expect(cap('unit:8t:4:rests', [4, 4])).toBe('Rhythm: Triplets in 4, with rests · back on one every bar')
expect(cap('unit:8:5:accents', [4, 4, 3, 4, 4])).toBe('Rhythm: 8ths in 5, with accents · back on one at bars 1, 5')
expect(cap('unit:8:3:accents', [4, 3])).toBe('Rhythm: 8ths in 3, with accents · never back on one')
expect(cap('run:8:4:3', [4, 4])).toBe('Rhythm: 4 8ths from the and of 2')
```

The events:

```ts
// a tied unit held over the barline: 8ths in 3, tied, over 4/4: the third statement (pulses 6–8) crosses into bar 1
const laid = layRhythm('unit:8:3:tied', [4, 4])!
expect(laid.bars[0]!.at(-1)).toMatchObject({ at: 6, length: 2, tie: true })
expect(laid.bars[1]![0]).toMatchObject({ at: 0, length: 1, tiedIn: true })
// a run spills into the next bar and merges with its own run (§3)
const r = layRhythm('run:8:4:6', [4, 4])!
expect(r.bars[1]!.filter((e) => !e.rest).map((e) => e.at)).toEqual([0, 1, 6, 7])
// a leading tie on the sheet's first pulse is an attack; after a rest it is an attack too (Review Focus 1)
const c = layRhythm('custom:8:_x.', [3])!
expect(c.bars[0]!.filter((e) => !e.rest).map((e) => [e.at, e.tiedIn])).toEqual([[0, false], [1, false], [3, false], [4, false]])
```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

The steady-metre "every n bars" uses `lcm(unitLength, barPulses) / barPulses` (§4).

```ts
// a repeating rhythm as one stream: the cells, statement after statement, over the total of the bars' pulses;
// then each note (an attack and its following '_') is cut at the barlines
```

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** "Lay a rhythm over the bars (rhythm spec §4)".

### Task 5: Notation, and the target beats

**Files:**
- Create: `engine/src/rhythm/notation.ts`, `engine/src/rhythm/targets.ts`, `engine/src/rhythm/index.ts` (re-exports)
- Modify: `engine/src/index.ts` (export the rhythm API), `engine/src/__tests__/api.test.ts` snapshot
- Test: `engine/src/__tests__/rhythmNotation.test.ts`

**Interfaces:**
- Consumes: `Laid`, `RhythmEvent`.
- Produces:
  - `type RhythmValue = 'w' | 'hd' | 'h' | 'qd' | 'q' | '8d' | '8' | '16'`
  - `type RhythmNote = Readonly<{ beat: number; value: RhythmValue; rest: boolean; accent: boolean; tie: boolean; tiedIn: boolean; tuplet: number | null; beam: number | null; bracket: 'start' | 'end' | 'both' | null }>`
  - `rhythmNotes(laid: Laid): readonly (readonly RhythmNote[])[]`: one array a bar
  - `targetBeats(beats: number): readonly number[]`

- [ ] **Step 1: Write failing tests**

```ts
const notes = (id: RhythmId, bars: number[]) => rhythmNotes(layRhythm(id, bars)!)
const vals = (n: readonly RhythmNote[]) => n.map((x) => `${x.value}${x.rest ? 'r' : ''}${x.tie ? '~' : ''}`)
```

- **8ths in 3, tied, over two 4/4 bars.** Bar 0's statements fall at 0, 1.5, 3 (the last cut at the barline):
  ```ts
  expect(vals(notes('unit:8:3:tied', [4, 4])[0]!)).toEqual(['qd', '8~', 'q', 'q~'])
  ```
- **Triplets: a beat of `x_x`** is a `q` then an `8`, in one tuplet:
  ```ts
  const t = notes('custom:8t:x_x', [2])[0]!
  expect(vals(t)).toEqual(['q', '8', 'q', '8'])
  expect(t.map((n) => n.tuplet)).toEqual([0, 0, 1, 1])
  ```
- **Triplets: two whole beats of one held note merge** into an `h` with no tuplet (Review Focus 5):
  ```ts
  expect(vals(notes('custom:8t:x_____', [2])[0]!)).toEqual(['h'])
  ```
- **Beams by statement.** 8ths in 3 with accents over 4/4 beams in threes, then the last two:
  ```ts
  expect(notes('unit:8:3:accents', [4])[0]!.map((n) => n.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
  ```
- **Beams never cross a rest, and a lone note has none:**
  ```ts
  expect(notes('unit:8:3:rest-last', [4])[0]!.map((n) => n.beam)).toEqual([0, 0, null, 1, 1, null, 2, 2])
  expect(notes('unit:8:2:rest-last', [2])[0]!.map((n) => n.beam)).toEqual([null, null, null, null])
  ```
- **The bracket marks the first statement on the sheet and each landing bar's first:**
  ```ts
  const b = notes('unit:8:5:accents', Array(6).fill(4)).map((bar) => bar.map((n) => n.bracket))
  expect(b[0]!.slice(0, 5)).toEqual(['start', null, null, null, 'end'])
  expect(b[5]![0]).toBe('start')
  ```
- **Target beats** (§7):
  ```ts
  expect([2, 3, 4, 5, 6, 7].map((n) => targetBeats(n))).toEqual([[0], [0], [0, 2], [0, 3], [0, 3], [0, 4]])
  ```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement** per §6 rules 2–5 and §7. Export everything listed under Produces in Tasks 2–5, plus
  `layRhythm`, `rhythmCaption`, `LIBRARY_IDS`, `isRhythmId` and `rhythmLabel`, from `engine/src/index.ts`. Update the
  `api.test.ts` snapshot (`npx vitest -u src/__tests__/api.test.ts` in `engine/`) and review that only the new names
  appear.

- [ ] **Step 4: Run** `make test`. Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm notation and target beats (rhythm spec §6–7)".

### Task 6: The Changes sheet's model, and the golden fixture

**Files:**
- Modify: `engine/src/changes.ts`:
  - `ChangesBar` (~line 139): add `rhythm` and `targets`;
  - `ChangesSheet` (~line 180): add `rhythmCaption`;
  - `buildChanges` (line 425): add the options;
  - `changesLinesPerPage` (line 219): a rhythm counts as a voiced line.
- Modify: `engine/src/__tests__/goldenFixture.ts` (the `Golden` type and a `rhythmCases()`), `golden.test.ts`
- Test: `engine/src/__tests__/changes.test.ts` (or the Changes test file that holds `buildChanges` tests)

**Interfaces:**
- Consumes: `layRhythm`, `rhythmNotes`, `rhythmCaption`, `targetBeats`.
- Produces:
  - `buildChanges(doc, part, barsPerLine, signatures, line, view, overlay, approach, rhythm: RhythmId = 'off', targets = false)`
  - `ChangesBar.rhythm: readonly RhythmNote[]`
  - `ChangesBar.targets: readonly number[]`
  - `ChangesSheet.rhythmCaption: string | null`
  - `changesLinesPerPage(line, rows, rhythm = false)`

- [ ] **Step 1: Write failing tests**

- A 4/4 chart of eight bars with `rhythm: 'unit:8:5:accents'`:
  - every bar's `rhythm` is non-empty;
  - `rhythmCaption` is "Rhythm: 8ths in 5, with accents · back on one every 5 bars".
- The same with `line: 'third'`: every bar's `rhythm` is `[]`, and `rhythmCaption` is null.
- `targets: true` on a 5/4 chart: each bar's `targets` is `[0, 3]`.
- Review Focus 3: a chart of section A (four bars) and `section: A2` + `copy: A1`, drawn with repeat signs:
  - the landings are counted over the four drawn bars;
  - the caption for `unit:8:3:accents` is "back on one every 3 bars", as for four plain bars.
- `changesLinesPerPage('off', { numerals: true, scales: true }, true)` is 6, the voiced count.

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

- `buildChanges` collects the drawn bars' `beats` in sheet order (all lines' bars, flattened) once, lays the rhythm
  when `line === 'off'`, and maps `rhythmNotes(laid)[i]` onto the i-th drawn bar.
- Add `rhythms: Record<RhythmId, { label: string; text: string | null; landings44: number[]; landings34: number[] }>`
  to `Golden`, built by `rhythmCases()` over `LIBRARY_IDS` and sixteen bars of each metre. `text` is null for a
  per-bar rhythm.
- `golden.test.ts` compares it as it compares `hexatonics`.

- [ ] **Step 4: Run** `make golden`, review that `engine/fixtures/golden.json` gains only `rhythms`, then `make test`.
  Expected: PASS.

- [ ] **Step 5: Commit** (`git add engine/src engine/fixtures/golden.json`) "Changes sheet carries the rhythm line
  (rhythm spec §8)".

### Task 7: Preferences, share links, flag, tier, hidden settings

**Files:**
- Modify: `web/nuxt.config.ts` features (add `rhythm: false, // the Changes sheet's rhythm line and target beats (docs/superpowers/specs/2026-10-22-rhythm-line-design.md)`)
- Modify: `web/app/composables/usePreferences.ts` (after `approach`, ~line 65)
- Modify: `engine/src/share.ts` (`ShareView` ~line 55, `shareViewFrom` ~line 149)
- Modify: `web/app/utils/interface.ts` (`CONTROL_TIERS`, `ViewSettings`, `HiddenSetting`, the hidden list ~line 57)
- Test: `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/test/interface.test.ts`

**Interfaces:**
- Produces:
  - `rhythm: Ref<RhythmId>` (`csm-rhythm`) and `targets: Ref<boolean>` (`csm-targets`) from `usePreferences`
  - `ShareView.rhythm?: RhythmId`
  - `ShareView.targets?: boolean`
  - `ControlId` `'rhythm'`
  - `HiddenSetting` `'rhythm'`
  - `ViewSettings.rhythm: RhythmId`
  - `ViewSettings.targets: boolean`

- [ ] **Step 1: Write failing tests**

- **Preferences:** a stored `csm-rhythm` of `unit:8:5:accents` reads back with the flag on. With the flag off it reads
  as `off` and the stored value stays. The values `unit:8:8:accents` and `unit:32:3:accents` read as `off` (Review
  Focus 4).
- **Share links:**
  - `shareViewFrom({ rhythm: 'run:8:4:3', targets: true })` keeps both;
  - `{ rhythm: 'bogus', targets: 'yes' }` drops both.
- **Hidden settings:** at Essentials, a Changes view with `rhythm: 'card:upbeats'` lists `['rhythm', 'intermediate']`.
  So does one with `targets: true`.

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

- `usePreferences` follows `csm-approach`'s pattern:
  ```ts
  storedRef<RhythmId>('csm-rhythm', (s) => (isRhythmId(s) && rhythmOn ? s : undefined), 'off')
  ```
  `csm-targets` uses the on/off encoding, also gated by the flag.
- `CONTROL_TIERS.rhythm` is `'intermediate'`.

- [ ] **Step 4: Run** `make test`. Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm preferences, link and flag (rhythm spec §9)".

### Task 8: Drawing, controls and target dots

**Files:**
- Modify: `web/app/utils/changesDrawing.ts`:
  - `drawChangesLine` dispatches to a new `drawRhythmLine` when any bar has `rhythm` notes;
  - add `rhythmAria`.
- Modify: `web/app/components/PreviewControls.vue`:
  - the Rhythm group beside Line, inside `shows('rhythm')` and `useFeature('rhythm')`;
  - the Target beats toggle in Show.
- Modify: `web/app/components/ChangesSheet.vue`:
  - pass `rhythm` and `targets` to `buildChanges`;
  - draw the target dots from `layout.xs`;
  - the caption beside the pentatonic caption.
- Modify: `web/app/components/EditorView.vue`, where the share view is built and read (beside `approach:`).
- Test: `web/test/changesDrawing.test.ts` (`rhythmAria`); `web/e2e/changes.spec.ts`; `web/e2e/print.spec.ts`

**Interfaces:**
- Consumes: `ChangesBar.rhythm`, `ChangesBar.targets`, `ChangesSheet.rhythmCaption`, `LIBRARY_IDS`, `rhythmLabel`,
  `positionLabel`, `VARIATIONS`, `parseRhythm`.
- Produces: `rhythmAria(caption: string | null): string`, returning `'; rhythm: <caption without "Rhythm: ">'` or `''`.

- [ ] **Step 1: Write failing tests**

**The unit test:**
```ts
expect(rhythmAria('Rhythm: 8ths in 5, with accents · back on one every 5 bars')).toBe('; rhythm: 8ths in 5, with accents · back on one every 5 bars')
```

**e2e, in `changes.spec.ts`, with the Interface at Intermediate:**
- choose Rhythm → 8ths, In 5, with accents on a 4/4 library chart of at least 8 bars;
  - the caption reads "back on one every 5 bars";
  - `[data-rhythm-bracket]` appears in the sheet's bars 1 and 6;
- choose a tied unit that holds over a line's last barline (`unit:8:3:tied` with 4 bars a line): the line's SVG has a
  half-tie at its end;
- a pasted chart with `time: 7/4` draws a `7/4` time signature;
- Target beats on: 2 dots a bar on a 4/4 chart;
- a share link carrying `rhythm: 'card:upbeats'` opens with Rhythm reading "Upbeats".

**`print.spec.ts`:** Stardust with `unit:8:5:syncopated`, and a 5/4 chart, fit their lines a page (§8).

- [ ] **Step 2: Run to see them fail**

`make e2e` (or the single spec through `npx playwright test changes` in `web/`). Expected: FAIL.

- [ ] **Step 3: Implement**

`drawRhythmLine` mirrors `drawGuideLine`'s two passes:
- `StaveNote({ keys: ['b/4'], duration, type: 's', stem_direction: 1 })`, with `type: 'r'` for rests and a `d` for
  dotted values;
- `Articulation('a>')`;
- one `Tuplet` per `tuplet` index;
- one `Beam` per `beam` index;
- a `StaveTie` chain as in the guide line;
- the bracket as an SVG path under the staff's bottom line, from the first `start` note's x to its `end` note's x,
  with `data-rhythm-bracket` on its group.

**The controls:**
- The Rhythm listbox's options come from `LIBRARY_IDS`, grouped by family and pulse.
- The In, Variation, Attacks and From listboxes write back the whole id.
- *Your rhythm…* shows a text field. It writes `custom:<pulse>:<cells>` when `parseRhythm` accepts it, and otherwise
  shows "Use x, ., _ and > after 4:, 8:, 8t: or 16:".
- With Line not Off, the group's description reads "Turn Line off to see the rhythm."

**The target dots** are spans with `data-target-beat`, placed at `xs[bar][beat]`.

- [ ] **Step 4: Run** `make test`, `make e2e`, `make lint`. Expected: PASS.

- [ ] **Step 5: Commit** "Draw the rhythm line and target beats (rhythm spec §8)".

### Task 9: Docs, decisions, release notes, a11y

**Files:**
- Modify:
  - `web/app/pages/help.vue`: a `#rhythm` section per §10, citing the books by title;
  - `engine/src/decisions.ts`: `rhythm.cycle` and `rhythm.targets`, page `help`, anchors `rhythm-cycle` and
    `rhythm-targets`;
  - `docs/design.md`: §4 (7/4) and §5 (the rhythm line);
  - `web/app/utils/releaseNotes.ts`: one item;
  - `web/e2e/a11y/pages.a11y.ts`: a Changes sheet with a rhythm and target beats.
- Test: `web/test/docs/decisions.test.ts`, `help.test.ts` (existing; they check the anchors), `make a11y`

- [ ] **Step 1: Add the a11y case**

```ts
test('the Changes with a rhythm and target beats', async ({ page }) => { /* open a library song, Intermediate, Rhythm 8ths in 5, Target beats on */ })
```

Run `make a11y`. Expected: PASS, or a violation to fix in Task 8's markup.

- [ ] **Step 2: Write the Help section and the DECISIONS rows**

Run `make docs`. Expected: PASS (the anchors exist, the links resolve).

- [ ] **Step 3: Write the release notes item and the design.md text**

- [ ] **Step 4: Run** `make test`, `make lint`, `make docs`. Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm docs, decisions and release notes (rhythm spec §10)".
