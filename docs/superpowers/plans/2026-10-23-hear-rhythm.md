# Hear the rhythm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Changes sheet's rhythm sounds with the click (an unpitched track, and the Line in that rhythm), and swing is a dial.

**Architecture:** Pure engine functions in `engine/src/voice.ts` turn the drawn bars into hits and swing positions; `useClick` books them on the audio clock beside the Line; `clickSounds.ts` synthesizes a rim; `ClickBar.vue` holds the switch and slider.

**Tech Stack:** TypeScript strict, Vue 3/Nuxt, Vitest, Playwright, Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-23-hear-rhythm-design.md`

## Global Constraints

- Engine stays pure: no Vue/DOM imports.
- Behind the `hearLine` flag; release notes: none while it's off (PR body says so).
- `decisions.ts` summaries use ’ (U+2019), never `'`.
- Controls stay in the click's popover; no new row in the bar.
- New public engine exports update `engine/src/__tests__/api.test.ts`'s snapshot.

## Review Focus

- A 16th or tuplet beat at swing 75%: no two attacks at one time, no zero-length note (Task 3 test `leaves a 16th beat straight`).
- A tie across the barline: one hit, not two (Task 1 test `holds a tie`).
- A guide line without Restate: no hits, no switch (Task 1 test `none for an unpoured Line`; Task 2 hasRhythm test).
- Hear rhythm off: no hits booked even with a rhythm drawn (Task 2).
- Swing never moved: chart store has no `swing` key (Task 4 round-trip).

---

## PR 1: rhythm track

### Task 1: engine hits

**Files:** Modify `engine/src/voice.ts`; Test `engine/src/__tests__/voice.test.ts`

**Interfaces — Produces:**
- `type RhythmBar = Readonly<{ beats: number; rhythm: readonly RhythmNote[]; voice: readonly GuideNote[] }>` (a `ChangesBar` fits)
- `type RhythmHit = Readonly<{ bar: number; at: number; accent: boolean }>`
- `rhythmHits(bars: readonly RhythmBar[]): RhythmHit[]`: `bar.rhythm` non-rest, non-`tiedIn` notes when any bar has rhythm notes; else from `bar.voice` notes that have `mark` (poured), a pitch and not `tiedIn`, accent `mark.accent`.
- `type TimedHit = Readonly<{ time: number; accent: boolean }>`
- `scheduleRhythm(hits, bars: number, plan, state, from, until): TimedHit[]`: same loop as `scheduleVoice`; extract a shared private iterator (`eachBar`) used by both.

- [ ] Tests: `rhythmHits` from a ChangesSheet built with `rhythm` set and line `'off'` (hits = drawn rhythm's attacks); with a poured line (`takesRhythm`), hits equal the voice's struck notes; `holds a tie` (a tiedIn note yields no hit); `none for an unpoured Line` (guide line, restate false → `[]`); accents carried; `scheduleRhythm` skips the count-in, loops the form, swings an off-beat 8th to ⅔.
- [ ] Test `a Line under a rhythm sounds in its attacks`: `voiceNotes` of a poured line has `at`s equal to `rhythmHits` `at`s per bar (rests silent, ties merged).
- [ ] Run `cd engine && npx vitest run src/__tests__/voice.test.ts` → FAIL; implement; → PASS; update api snapshot (`npx vitest run -u src/__tests__/api.test.ts`).
- [ ] Commit.

### Task 2: app

**Files:** Modify `web/app/utils/clickSounds.ts`, `web/app/composables/useClick.ts`, `web/app/components/ChangesSheet.vue`, `web/app/components/ClickBar.vue`, `web/test/clickFakes.ts`; Tests `web/test/useClick.test.ts`, `web/test/clickSounds.test.ts`, ClickBar test.

**Interfaces:**
- `ClickAudio.hit(time: number, accent: boolean): void`; `playRim(ctx, out, time, accent)`: band-passed noise (~1.8 kHz, Q ~8), ~25 ms decay; peak 0.7 accent, 0.45 otherwise.
- `ClickSettings.hearRhythm: boolean` default `true`.
- `useClick` returns `hasRhythm`, `setRhythm(r: ClickRhythm | null)`; `ClickRhythm = { hits: readonly RhythmHit[]; bars: number }`.
- ChangesSheet: `click.setRhythm({ hits: rhythmHits(bars), bars: bars.length })` in the same watchEffect; null on unmount.
- ClickBar: `<UiCheckbox v-if="hearOn && click.hasRhythm.value" v-model="hearRhythm">Hear rhythm</UiCheckbox>` in the popover.

- [ ] Tests: books `hit` only with `hearRhythm` on and hits set; `hasRhythm` false for empty hits; settings parse `hearRhythm` (missing → true); ClickBar shows Hear rhythm only with hits.
- [ ] Implement; `make test` → PASS.
- [ ] Docs: `decisions.ts` row `hear.rhythm` (anchor on How it decides); How it decides + Help paragraph. `make docs` → PASS.
- [ ] e2e: a rhythm chosen → Hear rhythm in the popover, unchecked state survives reload. `make e2e`.
- [ ] Commit, PR (`Release notes: none — hearLine is off`), auto-merge.

## PR 2: swing dial

### Task 3: engine swing ratio

**Files:** `engine/src/voice.ts`, `engine/src/click.ts`; tests `voice.test.ts`, `click.test.ts`.

**Interfaces:**
- `SWING = { min: 0.5, max: 0.75, fallback: 2 / 3 }`; `clampSwing(n: number): number` (2 decimals, NaN → fallback).
- `swingBeat(at: number, ratio = 2 / 3): number`.
- `straightBeats(times: readonly number[]): ReadonlySet<number>`: whole beats holding a time whose fraction isn't 0 or 0.5 (these don't swing).
- `swingAt(ratio, straight: ReadonlySet<number>) => (at: number) => number`, used by `scheduleVoice`, `scheduleRhythm`, `timePhrase`; a note's end at a straight beat's .5 also stays.
- `ClickOptions.swing?: number`; `clickBar` sub = `swing ?? 2/3` under Swing feel; `scheduleVoice`/`scheduleRhythm` read `plan.options.swing`.
- [ ] Tests: ratios 0.5/⅔/0.75; `leaves a 16th beat straight`; `clickBar` with swing 0.6 puts sub at n+0.6; `and-2-4` pattern follows swing; `timePhrase` takes ratio.
- [ ] Implement; PASS; api snapshot; commit.

### Task 4: app slider

**Files:** `useClick.ts`, `ClickBar.vue`, tests.

- `useClick` returns `swing: Ref<number>`; stored in the chart's record as `swing` only once moved (`swingChosen`, like `patternChosen`); plan options carry it; `play` passes it to `timePhrase`.
- ClickBar popover: `<input type="range" min=50 max=75 step=1 aria-label="Swing">` + `{{ pct }}%`, `v-if="click.feel.value === 'swing'"`.
- [ ] Tests: round-trip (unmoved → no `swing` key; moved → stored, read back clamped); slider only under Swing.
- [ ] Docs: update `hear.swing` decision + Help. `make test`, `make docs`, `make e2e`.
- [ ] Commit, PR, auto-merge.
