# Approaches into the running lines (#381) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Approach listbox leads the Cells and 7th Chords lines into each chord's first note, not only the guide tone line.

**Architecture:** `cellVoices` (`engine/src/arpeggios.ts`) gains an optional `approach`; after the line is laid out and
before accidentals, a pass swaps each chord's last notes for the figure (`approachNotes`) into the next chord's first
note, keeping their beats. `arpeggioVoices`/`cellsVoices` pass it; `buildChanges` passes it to them. The app shows the
listbox and carries the setting for those lines when no Superimpose is on.

**Tech Stack:** TypeScript (strict), Vitest, Nuxt/Vue 3, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-approaches-running-lines-design.md`

## Global Constraints

- Engine pure TS, no Vue/DOM; export only what the app uses (`engine/src/__tests__/api.test.ts` snapshot).
- Figures from `approachNotes` (`engine/src/approaches.ts`) only; no new figure code.
- Flag `approaches` (already on); no new flag.
- Figure notes replace the previous chord's last k notes, each keeping the replaced note's `beat` and `beats`.
- Previous chord keeps ≥ 1 own note; no figure out of `rangeOf(part)`, after/into a rest, across a gap, or for the first chord.
- Diatonic steps from the previous chord's `shown ?? scale` (via `writtenScale(part, text).notes`, as `guideVoices`).
- Superimpose lines (`pentatonicVoices`, `triadPairVoices`) never get an approach.
- Toolbar ≤ 2 rows at 1440 px; Line group does not widen.
- `make test`, `make lint`, `make e2e`, `make a11y` green; `make golden` only if the fixture moves (it should not: default `'none'`).

## Review Focus

1. Previous chord's tail crosses a bar line (a chord of 6 beats in 4/4) → figure notes land in the right bars at the replaced notes' beats. Test in Task 1.
2. Previous chord with no more notes than the figure (a 1-beat chord of quarters before a 1-note figure) → no figure. Test in Task 1.
3. Figure note out of range (target at the part's floor, chromatic below) → no figure, line unchanged. Test in Task 1.
4. Accidentals: figure's D♯ then a D natural later in the bar → natural sign drawn. Covered by running `voiceAccidentals` after the pass; test in Task 1.
5. A share link with `approach` and a Cells line, opened with a Superimpose on → no approach in the sheet, none re-shared. Test in Task 2.

---

### Task 1: Engine — approach pass in `cellVoices`

**Files:**
- Modify: `engine/src/arpeggios.ts` (`cellVoices`, `arpeggioVoices`)
- Modify: `engine/src/cells.ts` (`cellsVoices`)
- Modify: `engine/src/changes.ts:~605` (pass `approach` to `cellsVoices` and `arpeggioVoices`; doc comment line 399)
- Test: `engine/src/__tests__/arpeggios.test.ts`, `engine/src/__tests__/cells.test.ts`, `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: `approachNotes(target: Pitched, figure: Approach, scale: readonly Spelled[] | null): readonly Pitched[] | null`; `writtenScale`; `rangeOf`.
- Produces:
  - `cellVoices(chords, part, beats, keySig, cellsOf, valueOf = …, approach: Approach = 'none')`
  - `arpeggioVoices(chords, part, beats, keySig, pattern, approach: Approach = 'none')`
  - `cellsVoices(chords, part, beats, keySig, line, approach: Approach = 'none')`
  - `buildChanges(...)` unchanged signature; its `approach` now reaches the 7th Chords and Cells lines.

- [ ] **Step 1: Write the failing tests** (`arpeggios.test.ts`, new `describe('approaches (#381)')`, using `seq`, `pitches`)

```ts
const midis = (n: readonly GuideNote[] | undefined) => (n ?? []).map((x) => x.pitch?.midi ?? null)

it('swaps the chord before for a figure into the next chord’s first note, keeping its beats', () => {
  const cs = seq(['CMaj7', 4], ['FMaj7', 4])
  const plain = arpeggioVoices(cs, CONCERT, 4, null, 'up-root').bars
  const led = arpeggioVoices(cs, CONCERT, 4, null, 'up-root', 'chromatic-below').bars
  const target = plain.get(2)![0]!.pitch!
  expect(led.get(2)).toEqual(plain.get(2))
  expect(led.get(1)!.slice(0, 3)).toEqual(plain.get(1)!.slice(0, 3))
  expect(led.get(1)![3]).toMatchObject({ beat: 3, beats: 1, pitch: { letter: 2, acc: 0, midi: target.midi - 1 } }) // E into F
})

it('plays a three-note figure in the line’s note value', () => {
  const cs = seq(['G7', 2], ['C7', 2])
  const led = cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id: '3rd-3rd' }, 'delayed').bars.get(1)!
  const plain = cellsVoices(cs, CONCERT, 4, null, { kind: 'cells', id: '3rd-3rd' }).bars.get(1)!
  expect(led.slice(1, 4).map((n) => n.beats)).toEqual([0.5, 0.5, 0.5])
  expect(led[0]).toEqual(plain[0])
  expect(led.slice(4)).toEqual(plain.slice(4))
})

it('leaves no figure for the first chord, after a rest, across a gap, or where the chord before would keep none', () => {
  // first chord, rest ('NC' or the repo's rest token), gap (start ≠ prev end), and a 1-beat chord of quarters in a 4-note bar: assert bars equal the plain line
})

it('carries the figure across a bar line', () => {
  const cs = seq(['CMaj7', 6], ['FMaj7', 2]) // CMaj7's last notes are in bar 2
  // the replaced notes are in bar 2 at the same beats as in the plain line
})

it('drops the figure when a note of it is out of range', () => {
  // a target at rangeOf(part).lo with 'chromatic-below': bars equal the plain line
})

it('marks the natural after a figure’s accidental in the same bar', () => {
  // figure D♯ into E, then D in the same bar: that D's accidental is 'n'
})
```

In `cells.test.ts`: `pentatonicVoices`/`triadPairVoices` signatures take no approach (a type-level check: `// @ts-expect-error` on passing one), so the Superimpose lines can't get one.

In `changes.test.ts`: `buildChanges(doc, CONCERT, 4, false, 'up-root', undefined, null, 'chromatic-below')` differs from `'none'` in the bar before the second chord; with `{ kind: 'pentatonic', … }` it equals `'none'`.

- [ ] **Step 2: Run to see them fail**

Run: `cd engine && npx vitest run src/__tests__/arpeggios.test.ts src/__tests__/cells.test.ts src/__tests__/changes.test.ts`
Expected: FAIL (extra argument / notes unchanged).

- [ ] **Step 3: Implement**

In `cellVoices`, collect notes as `{ chord: number; bar: number; note: GuideNote }[]` instead of pushing straight into `bars`; after the loop, if `approach !== 'none'`, for each chord j ≥ 1 apply the spec's rules 1–5 against chord j−1's notes (rule 4: drop leading figure notes whose midi equals the note before the replaced run); then group by bar and run `voiceAccidentals` as now. Keep the pass a local pure function (`withApproach(notes, chords, part, approach)`), not exported.

- [ ] **Step 4: Run to see them pass**, then `make test`.
Expected: PASS; golden unchanged.

- [ ] **Step 5: Commit**

```bash
git add engine/src/arpeggios.ts engine/src/cells.ts engine/src/changes.ts engine/src/__tests__/arpeggios.test.ts engine/src/__tests__/cells.test.ts engine/src/__tests__/changes.test.ts
git commit -m "Approaches lead the 7th Chords and Cells lines into each chord (#381)"
```

### Task 2: App — the listbox, link and hidden-settings for the running lines

**Files:**
- Modify: `web/app/utils/sheetLine.ts` (new `approachApplies`)
- Modify: `web/app/components/PreviewControls.vue:112-150` (listbox placement)
- Modify: `web/app/components/EditorView.vue:201,500,737`
- Modify: `web/app/pages/help.vue:176-181` (copy)
- Modify: `web/e2e/fixtures.ts` (`showApproach` takes a line), `web/e2e/editor.spec.ts:389-397`
- Test: `web/test/sheetLine.test.ts`, `web/test/ChangesSheet.test.ts`, `web/test/interface.test.ts`

**Interfaces:**
- Consumes: Task 1's `buildChanges` behaviour.
- Produces: `approachApplies(mode: LineMode, overlay: Overlay): boolean` — `mode === 'guide' || ((mode === 'arpeggio' || mode === 'cells') && overlay === 'off')`.

- [ ] **Step 1: Failing tests**
  - `sheetLine.test.ts`: `approachApplies` true for guide (any overlay), arpeggio/cells with overlay off; false for off, and arpeggio/cells under `'pentatonic'`/`'hexatonic'`.
  - `ChangesSheet.test.ts`: mounting with `line: 'up-root', approach: 'chromatic-below'` changes the first bar's last note vs. no approach.
  - `interface.test.ts`: `hiddenSettings` for a view with `lineMode: 'cells'`, overlay `'pentatonic'`, `approach: 'none'` (what EditorView passes there) reports no `'approaches'` (Review Focus 5).

- [ ] **Step 2: Run** `cd web && npx vitest run test/sheetLine.test.ts test/ChangesSheet.test.ts` → FAIL.

- [ ] **Step 3: Implement**
  - `approachApplies` in `sheetLine.ts`.
  - `PreviewControls.vue`: move the Approach `UiListbox` out of the Guide Tones `EaseReveal` into its own `EaseReveal :show="approachApplies(lineMode, overlay)"` placed after the 7th Chords slot reveal, keeping `class="w-0 min-w-full"` and the comment's reason.
  - `EditorView.vue`: the sheet prop (201) passes `approachApplies(prefs.lineMode.value, prefs.overlay.value) ? prefs.approach.value : 'none'`; `hiddenSettings` (500) and the share link (737) use the same condition in place of `lineMode === 'guide'`.
  - `help.vue`: replace the Approach paragraph's subject: "Under Guide Tones, and under 7th Chords and its cells with Superimpose off, **Approach** leads into each chord's first note …"; the guide tone sentence about giving up "the last beat or two" becomes "the chord before gives up its last notes to make room".

- [ ] **Step 4: Run** unit tests → PASS; `make test`, `make lint`.

- [ ] **Step 5: e2e**
  - `fixtures.ts`: `showApproach(page, name, line: 'Guide Tones' | '7th Chords' = 'Guide Tones')`.
  - `editor.spec.ts` layout test: after the Guide Tones check, `showApproach(page, 'Diatonic above, chromatic below (enclosure)', '7th Chords')` and assert rows ≤ 2, Line group ≤ `bare.lineGroup`, place unchanged. Note: the Pentatonic overlay is on in that test; turn Superimpose off first, or the listbox is hidden.
  - Run: `make e2e` and `make a11y` → PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/utils/sheetLine.ts web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/app/pages/help.vue web/e2e/fixtures.ts web/e2e/editor.spec.ts web/test/sheetLine.test.ts web/test/ChangesSheet.test.ts web/test/interface.test.ts
git commit -m "Approach listbox under 7th Chords and Cells (#381)"
```
