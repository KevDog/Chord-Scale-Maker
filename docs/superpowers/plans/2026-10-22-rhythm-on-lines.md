# Rhythm on the Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With a Rhythm and a Line both on, the Line's pitches are poured into the rhythm's attacks. Two new controls
shape the line: a Start (Galper's pick-ups) and a Timing (anticipate or resolve late). With Target beats on, notes
struck on a target beat show whether they are chord tones.

**Architecture:** The engine holds everything that can be pure:
- `engine/src/rhythm/phrasing.ts` holds the Start and Timing vocabulary and the caption;
- `layRhythm` gains forced attacks;
- `engine/src/rhythm/pour.ts` holds `lineRhythm`, which shifts the spans, forces the pick-ups and assigns each note an
  owner;
- `cellVoices` reads its slots from the rhythm, by chord;
- `markTargets` marks target tones;
- `takesRhythm` (`changes.ts`, exported) says whether a line takes the rhythm. It is the only copy: the web imports it.

`buildChanges` passes a `RhythmPlan` to the line builders. `changesDrawing.ts` maps each `GuideNote.mark` and `target`
onto VexFlow. The controls, preferences and links follow Phase 1's pattern, behind the existing flag `rhythm`.

**Tech Stack:** TypeScript strict, Vitest, VexFlow, Nuxt/Vue, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-rhythm-on-lines-design.md` (cited below as §n, its Decisions as Dn). It
builds on the Phase 1 spec, `docs/superpowers/specs/2026-10-22-rhythm-line-design.md` (P1 §n), and the roadmap
`docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md`.

## Global Constraints

- `engine/` has no Vue, DOM or VexFlow imports. The app imports it only as `@chord-scale-maker/engine`, and every new
  export goes through `engine/src/index.ts` (the `api.test.ts` snapshot). `guideTones.ts` and `engine/src/rhythm/`
  import each other's types only (`import type`), so there is no runtime cycle.
- Rhythm, Start, Timing and Restate are view preferences and share-link fields. They are never written into chart rows.
- No new flag: everything sits behind `rhythm`, which stays off in `web/nuxt.config.ts`. The e2e build turns every flag
  on.
- **With Rhythm Off and Target beats off, the sheet is exactly today's.** Start, Timing and Restate are inert without a
  rhythm and a Line that takes it (D9). Target colors on the Lines need Target beats on, with or without a Rhythm
  (D18).
- **Existing tests:** they pass unedited, except these intended edits:
  - `web/test/interface.test.ts`: the `CONTROL_TIERS` equality ("follows the spec tier tables") gains
    `'rhythm-phrasing': 'everything'`, and `DEFAULTS: ViewSettings` gains `rhythmStart: 'beat', anticipate: 0,
    rhythmLine: false` (Task 7);
  - `engine/src/__tests__/api.test.ts`: the snapshot gains the new names, updated with `-u` and reviewed (Tasks 5, 6);
  - `engine/src/__tests__/changes.test.ts`: "draws no rhythm with a Line on" is renamed "a guide line without Restate
    draws no rhythm", its assertions unchanged (Task 5).

  No existing test asserts "Turn Line off to see the rhythm.". The text lives only in `PreviewControls.vue`,
  `help.vue` and `docs/design.md`, and Tasks 9 and 11 remove it.
- **Red first.** Every Step 1 test must fail before its Step 3. A test marked *(guard)* passes before the change on
  purpose, to pin behavior that must not move. It is not counted as RED.
- Pitches come only from the sheet: the cells, the guide tones and the chord's shown scale. Never a new melody.
- Nothing from Saindon, Bergonzi or Galper is reproduced. Help text and titles cite them by title and page.
- User-facing text is in American spelling ("color", not "colour").
- Pure functions and readonly data, matching the engine's style (`Readonly<{…}>`, no classes). Test fixtures are typed
  (`const C4: Pitched = …`, tuples as `[A, B][]`), so `make test`'s typecheck passes.
- After any engine change, run `make golden` and review the diff (this plan expects none: D23), then `make test`.
  `make lint` must be clean.
- The PR touches the Help page and `decisions.ts`. It adds **no** `releaseNotes.ts` item. Its description carries
  `Release notes: none — the rhythm flag is off`.
- The print budgets of existing sheets don't change (§9).

## Review Focus

1. **A tied attack across a chord change**, e.g. `unit:8:3:tied` over CMaj7 + Dm7 (2 + 2 beats). Expected: the attack
   on beat 1½ belongs to CMaj7, and its tied piece on beat 2 holds E into Dm7's span, so the bar reads C E E D. The held
   piece is never target-colored. Tests in Tasks 3, 4 and 6.
2. **A Timing larger than a chord**, at the sheet's ends: resolve late 3 over a last chord of 2 beats. Expected:
   boundaries are clamped and kept in order, an empty span plays nothing, and there are no negative lengths. Test in
   Task 3.
3. **½ beat under triplets.** The boundary falls between pulses, and each attack goes to the span holding its start.
   Test in Task 3.
4. **The Approach with pick-ups.** `withApproach` must find each chord's target among its poured notes, and never
   overwrite a scale-below pick-up. Test in Task 4.
5. **A 2nd ending.** No pick-up is forced into it, and its boundary doesn't move. Test in Task 3.
6. **The cellVoices refactor.** Rhythm Off must give identical voices. The existing arpeggio, cells, pentatonic,
   triad-pair and quartal tests are the guard, and `make golden` shows no diff.
7. **Pick-ups and the part's range.** A scale-below note outside the range rests (§3.4). The concert treble range
   (lo C4) puts CMaj7 after a rest at C4, so its pick-ups rest; the tests that expect G A B use a range reaching F3.

---

### Task 1: Start and Timing vocabulary, and the caption

**Files:**
- Create: `engine/src/rhythm/phrasing.ts`; add `export * from './phrasing'` to `engine/src/rhythm/index.ts`
- Test: `engine/src/__tests__/rhythmPhrasing.test.ts`

**Interfaces:**
- Produces:
  - `type RhythmStart = 'beat' | 'pickup-1' | 'pickup-2' | 'pickup-3'`
  - `RHYTHM_STARTS: readonly RhythmStart[]`
  - `RHYTHM_START_LABELS: Readonly<Record<RhythmStart, string>>`
  - `isRhythmStart(s: unknown): s is RhythmStart`
  - `pickupNotes(s: RhythmStart): 0 | 1 | 2 | 3`
  - `ANTICIPATE_STEPS: readonly number[]`
  - `isAnticipate(n: unknown): n is number`
  - `anticipateLabel(n: number): string`
  - `phrasingCaption(caption: string, start: RhythmStart, anticipate: number): string`

- [ ] **Step 1: Write failing tests** (all RED: the module is new)

```ts
expect(RHYTHM_STARTS).toEqual(['beat', 'pickup-1', 'pickup-2', 'pickup-3'])
expect(RHYTHM_STARTS.map((s) => RHYTHM_START_LABELS[s])).toEqual(['On the beat', '1-note pick-up', '2-note pick-up', '3-note pick-up'])
expect(RHYTHM_STARTS.map(pickupNotes)).toEqual([0, 1, 2, 3])
expect(['pickup-4', 'Beat', 3, null].some(isRhythmStart)).toBe(false)
expect(ANTICIPATE_STEPS).toEqual([3, 2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3])
expect([1.5, -3, 0].every(isAnticipate)).toBe(true)
expect([0.25, 3.5, -3.5, NaN, '1', null].some(isAnticipate)).toBe(false)
expect([0, 0.5, 1, 1.5, -0.5, -2].map(anticipateLabel)).toEqual(['On time', 'Anticipate ½ beat', 'Anticipate 1 beat', 'Anticipate 1½ beats', 'Resolve late ½ beat', 'Resolve late 2 beats'])
expect(phrasingCaption('Rhythm: X', 'beat', 0)).toBe('Rhythm: X')
expect(phrasingCaption('Rhythm: X', 'pickup-2', 1.5)).toBe('Rhythm: X · 2-note pick-ups · anticipate 1½ beats')
expect(phrasingCaption('Rhythm: X', 'pickup-1', -0.5)).toBe('Rhythm: X · 1-note pick-ups · resolve late ½ beat')
expect(phrasingCaption('Rhythm: X', 'beat', 2)).toBe('Rhythm: X · anticipate 2 beats')
```

- [ ] **Step 2: Run to see them fail**

`npm test -w engine -- rhythmPhrasing`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** per §2 and §3.1. The caption lower-cases only the label's first letter.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm start and timing vocabulary (rhythm-on-lines spec §2, §3)".

### Task 2: Forced attacks in `layRhythm`

**Files:**
- Modify: `engine/src/rhythm/lay.ts` (`layRhythm`, and `perBarCells`'s caller)
- Test: `engine/src/__tests__/rhythmLay.test.ts`

**Interfaces:**
- Produces: `layRhythm(id, bars, breaks = [], force: readonly number[] = [])`. `force` holds stream pulses. Each one
  inside the sheet becomes an attack in the stream's cells before `segments()` runs. A `>x` stays accented, and a `.`
  or a `_` becomes `x`. Pulses outside `[0, total)` are ignored.

- [ ] **Step 1: Write failing tests**

```ts
const ats = (l: Laid | null, b = 0) => l!.bars[b]!.filter((e) => !e.rest).map((e) => [e.at, e.length])
// RED: a rest made an attack (Upbeats with its first pulse forced)
expect(layRhythm('card:upbeats', [4], [], [0])!.bars[0]!.filter((e) => !e.rest).map((e) => e.at)).toEqual([0, 1, 3, 5, 7])
// RED: a rest in a repeating unit made a plain, unaccented attack (8: x.. with pulse 1 forced)
expect(layRhythm('unit:8:3:rests', [4], [], [1])!.bars[0]!.find((e) => e.at === 1)).toMatchObject({ rest: false, accent: false, length: 1 })
// RED: a hold made an attack; the tie after it now holds the new note
expect(ats(layRhythm('unit:8:3:tied', [4], [], [1]))).toEqual([[0, 1], [1, 2], [3, 3], [6, 2]])
// (guard) an accent stays: pulse 3 is already >x, so this passes today too
expect(layRhythm('unit:8:3:accents', [4], [], [3])!.bars[0]!.find((e) => e.at === 3)?.accent).toBe(true)
// (guard) out of range: as if none
expect(layRhythm('unit:8:3:tied', [4], [], [-1, 99])).toEqual(layRhythm('unit:8:3:tied', [4]))
```

- [ ] **Step 2: Run to see the RED ones fail.**

- [ ] **Step 3: Implement.** For a repeating rhythm, build the stream's cells with `range(total).map(...)`, then apply
  the forced pulses. For a per-bar one, apply them to `perBarCells`'s result. Landings and `unit` are unchanged.

- [ ] **Step 4: Run** `npm test -w engine -- rhythm`. Expected: PASS, with every Phase 1 rhythm test unchanged.

- [ ] **Step 5: Commit** "Forced attacks in layRhythm (rhythm-on-lines spec §3.2)".

### Task 3: `lineRhythm`: spans, Timing, pick-ups and owners

**Files:**
- Create: `engine/src/rhythm/pour.ts`; export from `engine/src/rhythm/index.ts`
- Test: `engine/src/__tests__/rhythmPour.test.ts`

**Interfaces:**
- Consumes: `layRhythm` (with `force`), `rhythmNotes`, `PULSE_PER_BEAT`, `rhythmOf`, `pickupNotes`.
- Produces (§7):
  - `type LineSpan = Readonly<{ at: number; sounds: boolean }>`
  - `type Owner = Readonly<{ chord: number; below: number }>`
  - `type LineRhythm = Readonly<{ laid: Laid; bars: readonly (readonly RhythmNote[])[]; owners: readonly (readonly (Owner | null)[])[] }>`
  - `type RhythmPlan = Readonly<{ id: RhythmId; start: RhythmStart; anticipate: number; bars: readonly number[]; clockBars: readonly number[]; breaks: readonly number[] }>`
  - `lineRhythm(id, bars, breaks, chords: readonly LineSpan[], start, anticipate): LineRhythm | null` (null for Off or
    no bars)

- [ ] **Step 1: Write failing tests** (all RED: the module is new)

```ts
const S = (at: number, sounds = true): LineSpan => ({ at, sounds })
const vals = (r: LineRhythm, b: number) => r.bars[b]!.map((n) => `${n.value}${n.rest ? 'r' : ''}`)
const who = (r: LineRhythm, b: number) => r.owners[b]!.map((o) => (o ? (o.below ? `${o.chord}<${o.below}` : o.chord) : null))
```

- **A 1-note pick-up into a sounding chord** is poured by the chord before. The and of 4 is struck (§3.2–3.3). The
  forced pulses are 0, 7 and 8:
  ```ts
  const a = lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'pickup-1', 0)!
  expect(vals(a, 0)).toEqual(['q', 'q', 'q', '8', '8'])
  expect(who(a, 0)).toEqual([0, 0, 0, 0, 0])
  expect(who(a, 1)).toEqual([1, 1, 1, 1])
  ```
- **After a rest, a 3-note pick-up plays scale notes below** (`below` 3, 2, 1 in time order), and the rest's other
  attacks have no owner. The forced pulses are 5, 6, 7 and 8:
  ```ts
  const b = lineRhythm('card:downbeats', [4, 4], [], [S(0, false), S(4)], 'pickup-3', 0)!
  expect(vals(b, 0)).toEqual(['q', 'q', '8', '8', '8', '8'])
  expect(who(b, 0)).toEqual([null, null, null, '1<3', '1<2', '1<1'])
  ```
- **Anticipate and resolve late** move the boundary (to 3, then to 5), not the symbol:
  ```ts
  expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'beat', 1)!, 0)).toEqual([0, 0, 0, 1])
  expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'beat', -1)!, 1)).toEqual([0, 1, 1, 1])
  ```
- **½ beat under triplets** (Review Focus 3). The boundary at 3½ beats is pulse 10.5: pulses 0–10 stay with chord 0,
  and pulse 11 (3⅔) goes to chord 1:
  ```ts
  expect(who(lineRhythm('unit:8t:3:accents', [4, 4], [], [S(0), S(4)], 'beat', 0.5)!, 0)).toEqual([...Array(11).fill(0), 1])
  ```
- **The sheet's first chord** takes no pick-up, but its target is struck (§3.5). On the beat leaves Upbeats alone:
  ```ts
  expect(vals(lineRhythm('card:upbeats', [4], [], [S(0)], 'pickup-1', 0)!, 0)).toEqual(['8', '8', '8r', '8', '8r', '8', '8r', '8'])
  expect(vals(lineRhythm('card:upbeats', [4], [], [S(0)], 'beat', 0)!, 0)).toEqual(['8r', '8', '8r', '8', '8r', '8', '8r', '8'])
  ```
- **A break** (Review Focus 5). Bar 2 is a 2nd ending. Chord 1 anticipates by a beat (boundary 3, target pulse 6) with
  its pick-up on pulse 5. Chord 2 keeps its boundary at 8, and its pick-up pulse 15 drops (break bar 2's first pulse,
  16, lies after it and at or before the target). So the forced pulses are 0, 5, 6 and 16:
  ```ts
  const g = lineRhythm('card:downbeats', [4, 4, 4], [2], [S(0), S(4), S(8)], 'pickup-1', 1)!
  expect(vals(g, 0)).toEqual(['q', 'q', '8', '8', 'q'])
  expect(who(g, 0)).toEqual([0, 0, 0, 0, 1])
  expect(vals(g, 1)).toEqual(['q', 'q', 'q', 'q'])
  expect(who(g, 1)).toEqual([1, 1, 1, 1])
  expect(who(g, 2)).toEqual([2, 2, 2, 2])
  ```
- **A Timing longer than a chord** (Review Focus 2). Resolving late by 3 over chords at 0, 4 and 6 (a 2-beat last
  chord) gives boundaries 0, 7 and 9, clamped to 8. The spans are [0, 7), [7, 8) and [8, 8), which is empty:
  ```ts
  expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4), S(6)], 'beat', -3)!, 1)).toEqual([0, 0, 0, 1])
  ```
- **A tied piece takes its attack's owner** (Review Focus 1). The notes are qd at 0, an 8th at 1½ tied to a q at 2,
  and a q at 3:
  ```ts
  expect(who(lineRhythm('unit:8:3:tied', [4], [], [S(0), S(2)], 'beat', 0)!, 0)).toEqual([0, 0, 0, 1])
  ```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement** §2 and §3.2–3.3, in this order:
  1. the boundaries, clamped right to left;
  2. each sounding chord's target pulse (`Math.ceil(b·per - 1e-9)`), kept only inside its span;
  3. its pick-up pulses. Drop a pulse when it is before pulse 0, or when **the first pulse of a break bar lies after it
     and at or before the target** (§3.2). A pick-up before a break elsewhere on the sheet is kept;
  4. `layRhythm(id, bars, breaks, forced)` → `rhythmNotes`;
  5. owners by each attack's sheet beat (`(starts[bar] + note.beat·per) / per`). Tied-in pieces inherit their owner,
     across barlines too.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** "lineRhythm: spans, pick-ups and owners (rhythm-on-lines spec §2–3)".

### Task 4: `cellVoices` pours

**Files:**
- Modify: `engine/src/guideTones.ts`:
  - `GuideNote.beats: number`;
  - `mark?: RhythmMark`;
  - `target?: 'tone' | 'other'`;
  - export `type RhythmMark`, importing `RhythmNote` with `import type`.
- Modify: `engine/src/arpeggios.ts`:
  - `cellVoices` and `arpeggioVoices` take a trailing `rhythm?: RhythmPlan`;
  - `withApproach` skips pick-up notes.
- Modify: `engine/src/approaches.ts`: export `scaleStepsBelow(target: Pitched, n: number, scale: readonly Spelled[] | null): readonly Pitched[] | null`.
  It is built on `diatonic`: n steps down, returned in time order, lowest first.
- Modify: `web/app/utils/changesDrawing.ts` `tickFor`: `DURATIONS[n.beats as NoteBeats]`, so the app still
  type-checks. Drawing marks is Task 8.
- Test: `engine/src/__tests__/arpeggios.test.ts`, `engine/src/__tests__/approaches.test.ts`

**Interfaces:**
- Consumes: `lineRhythm`, `RhythmPlan`.
- Produces:
  - `cellVoices(chords, part, beats, keySig, cellsOf, valueOf?, approach?, rhythm?: RhythmPlan)`
  - `arpeggioVoices(chords, part, beats, keySig, pattern, approach?, rhythm?)`
  - `RhythmMark = Pick<RhythmNote, 'value' | 'tuplet' | 'beam' | 'accent'>`

- [ ] **Step 1: Write failing tests**

In `arpeggios.test.ts`, beside the file's `seq`:
```ts
const plan = (id: RhythmId, bars: number[], more: Partial<RhythmPlan> = {}): RhythmPlan => ({ id, start: 'beat', anticipate: 0, bars, clockBars: bars.map((_, i) => i), breaks: [], ...more })
// a range reaching F3 (piano's low end), so pick-ups below C4 fit; CMaj7 after a rest still sits at C4 (avg 65.5 nearer the centre 69 than C5's 77.5)
const WIDE: Part = { ...CONCERT, range: { lo: 53, hi: 81, centre: 69 } }
const poured = (cs: GuideInput[], m: Metre, p: RhythmPlan, approach: Approach = 'none', part: Part = CONCERT) => arpeggioVoices(cs, part, m, null, 'up-root', approach, p).bars
const letters = (v: readonly GuideNote[] | undefined) => (v ?? []).map((n) => (n.pitch ? rootName(n.pitch) : 'r'))
```

RED: §4's table, row by row. Today the plan is ignored, so the letters, values and marks all differ:
```ts
const u = poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:accents', [4])).get(0)!
expect(letters(u)).toEqual(['C', 'E', 'G', 'B', 'C', 'E', 'G', 'B'])
expect(u.map((n) => n.mark?.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
expect(u.flatMap((n, i) => (n.mark?.accent ? [i] : []))).toEqual([0, 3, 6])
expect(letters(poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:rests', [4])).get(0))).toEqual(['C', 'r', 'r', 'E', 'r', 'G', 'r'])
const t = poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:tied', [4])).get(0)!
expect(letters(t)).toEqual(['C', 'E', 'E', 'G'])
expect(t.map((n) => n.tiedIn)).toEqual([false, false, true, false])
expect(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('card:downbeats', [4])).get(0)!.map((n) => n.mark?.value)).toEqual(['q', 'q', 'q', 'q'])
expect(letters(poured(seq(['CMaj7', 3]), 3, plan('unit:8:2:accents', [3])).get(0))).toEqual(['C', 'E', 'G', 'B', 'G', 'E'])
const p1 = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { start: 'pickup-1' }))
expect(letters(p1.get(0))).toEqual(['C', 'E', 'G', 'B', 'G'])
expect(p1.get(0)!.map((n) => n.mark?.value)).toEqual(['q', 'q', 'q', '8', '8'])
expect(letters(p1.get(1))).toEqual(['D', 'F', 'A', 'C'])
const nc = seq(['N.C.', 4], ['CMaj7', 4]).map((c, i) => (i === 1 ? { ...c, scale: 'C Ionian' } : c))
const p3 = poured(nc, 4, plan('card:downbeats', [4, 4], { start: 'pickup-3' }), 'none', WIDE)
expect(letters(p3.get(0))).toEqual(['r', 'r', 'r', 'G', 'A', 'B'])
expect(p3.get(0)!.slice(3).map((n) => n.pitch!.midi)).toEqual([55, 57, 59])
expect(p3.get(1)![0]!.pitch!.midi).toBe(60)
// the same in the concert treble range (lo C4): G3 A3 B3 are out of range and rest (§3.4)
expect(letters(poured(nc, 4, plan('card:downbeats', [4, 4], { start: 'pickup-3' })).get(0))).toEqual(['r', 'r', 'r', 'r', 'r', 'r'])
const ant = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { anticipate: 1 }))
expect([letters(ant.get(0)), letters(ant.get(1))]).toEqual([['C', 'E', 'G', 'D'], ['F', 'A', 'C', 'A']])
const late = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { anticipate: -1 }))
expect([letters(late.get(0)), letters(late.get(1))]).toEqual([['C', 'E', 'G', 'B'], ['G', 'D', 'F', 'A']])
```

RED: the "C E D F (cut)" row of §4's table. Today the bar's shortest chord (2 beats) gives 8ths, C E G B D F A C:
```ts
expect(letters(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('card:downbeats', [4])).get(0))).toEqual(['C', 'E', 'D', 'F'])
```

RED: by chord across the barline (D15). Two 3/4 bars of quarters under one chord turn back at the chord's end. Today,
bar 2 starts a new cell, C E G:
```ts
const over = poured(seq(['CMaj7', 6]), 3, plan('card:downbeats', [3, 3]))
expect([letters(over.get(0)), letters(over.get(1))]).toEqual([['C', 'E', 'G'], ['B', 'G', 'E']])
```

RED: a tie across the chord change (Review Focus 1):
```ts
expect(letters(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('unit:8:3:tied', [4])).get(0))).toEqual(['C', 'E', 'E', 'D'])
```

RED: the Approach with pick-ups (Review Focus 4), in the WIDE range, over N.C. | CMaj7 (C Ionian) | Dm7 with a 1-note
pick-up. The pick-up into CMaj7 stays the scale's B3 (no approach after a rest). The and of 4 before Dm7 takes
`chromatic-below`'s note, a half step under Dm7's first note (C♯ under D):
```ts
const ap = poured([...nc, { row: 2, chord: 'Dm7', start: 8, beats: 4 }], 4, plan('card:downbeats', [4, 4, 4], { start: 'pickup-1' }), 'chromatic-below', WIDE)
expect(letters(ap.get(0))).toEqual(['r', 'r', 'r', 'r', 'B'])
expect(ap.get(2)![0]!.pitch!.midi - ap.get(1)!.at(-1)!.pitch!.midi).toBe(1)
```

*(guard)* Rhythm Off is unchanged (Review Focus 6). A plan whose rhythm is `off` (`lineRhythm` gives null) gives exactly
the voices of no plan. The existing suite is the main guard:
```ts
const cs = seq(['CMaj7', 4], ['Dm7', 4])
expect(arpeggioVoices(cs, CONCERT, 4, null, 'up-root', 'none', plan('off', [4, 4]))).toEqual(arpeggioVoices(cs, CONCERT, 4, null, 'up-root'))
```

RED, in `approaches.test.ts`, with the file's `note` and `cIonian`:
```ts
const C4 = note('C', 60)
expect(scaleStepsBelow(C4, 3, cIonian)?.map((p) => [rootName(p), p.midi])).toEqual([['G', 55], ['A', 57], ['B', 59]])
expect(scaleStepsBelow(C4, 1, null)).toBeNull()
```

- [ ] **Step 2: Run to see them fail**

`npm test -w engine -- arpeggios approaches`. Expected: the RED cases FAIL, and the guards pass.

- [ ] **Step 3: Implement** (§4)

- Map each chord to a `LineSpan`:
  - `at`: its start in sheet beats, through `plan.clockBars` (`barAt(beats, c.start)` → drawn index → the sum of
    `plan.bars` before it, plus `c.start − barStart`);
  - `sounds`: `cells[j] !== null && !isRest(c.chord)`.
- Call `lineRhythm`. If it gives null, run today's path unchanged.
- Refactor the main loop so that each segment carries `slots: readonly Slot[]`, where `Slot = { bar, beat, beats }`:
  - with no rhythm, today's `length / v` slots, unchanged;
  - with one, one segment per chord: its owned attacks (`below: 0`) in order, `byChord` true, and `followsAt` and
    `left` counted in slots.
- `play()` writes `slots[k]`.
- After the loop, build each clock bar's voice from `lineRhythm`'s notes:
  - an owned attack takes its played pitch, and its tied-in pieces copy it;
  - a `below: m` note takes `scaleStepsBelow(first pitch of its chord, m, writtenScale(part, shown ?? scale).notes)[m-th
    from the top]`, or rests if that is null or outside `rangeOf(part)`;
  - every other note is a rest;
  - `beats` is the value's length in beats (× ⅔ in a tuplet);
  - `mark` is `{ value, tuplet, beam, accent }`;
  - `tie` and `tiedIn` hold only on pitched notes.
- `Played` gains `pickup?: true`. `withApproach` skips pick-ups, both when it looks for the target and when it rewrites
  the chord before's notes.
- Then `voiceAccidentals` per bar, as today.

- [ ] **Step 4: Run** `make test`, then `make golden`. Expected: PASS, and **no diff** in `engine/fixtures/golden.json`
  (D23). A diff means Rhythm Off moved: fix it before going on.

- [ ] **Step 5: Commit** (`git add engine/src web/app/utils/changesDrawing.ts`) "cellVoices pours a rhythm (rhythm-on-lines spec §4)".

### Task 5: The Lines take the rhythm; Restate; `buildChanges`; `takesRhythm`

**Files:**
- Modify (by function; each takes and passes a trailing `rhythm?: RhythmPlan` to `cellVoices`):
  - `cellsVoices` in `engine/src/cells.ts`;
  - `pentatonicVoices` in `engine/src/pentatonicLine.ts`, after `roots`;
  - `triadPairVoices` in `engine/src/triadPairLine.ts`, after `pairs`;
  - `quartalVoices` in `engine/src/quartalLine.ts`, after `stacks`.
- Modify: `guideVoices` in `engine/src/guideTones.ts`: `rhythm?: RhythmPlan, restate = false` (§5).
- Modify: `engine/src/changes.ts`:
  - `buildChanges` options `{ rhythm, targets, start, anticipate, restate }`;
  - **exported** `takesRhythm(line: ChangesLineChoice, restate: boolean): boolean`, the only copy (the web imports it in
    Tasks 7 and 9);
  - the drawn bars (clock bars, lengths, breaks) worked out once, before the voices, with the existing rhythm-line code
    reading the same list;
  - the caption, given below.
- Modify: `engine/src/index.ts` (export the Task 1–3 names, `RhythmMark` and `takesRhythm`), the `api.test.ts` snapshot
  (an intended edit)
- Test: `engine/src/__tests__/changes.test.ts` (the `describe('the rhythm line and target beats …')` block)

**Interfaces:**
- Consumes: `cellVoices(…, rhythm)`, `phrasingCaption`, `RhythmPlan`.
- Produces:
  - `buildChanges(doc, part, barsPerLine, signatures, line, view, overlay, approach, { rhythm?, targets?, start?: RhythmStart, anticipate?: number, restate?: boolean })`
  - `takesRhythm(line, restate)`

- [ ] **Step 1: Write failing tests**

```ts
const two = parseChart('key: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n').value
const letters = (b: ChangesBar) => b.voice.map((n) => (n.pitch ? rootName(n.pitch) : 'r'))
const LINES: [ChangesLineChoice, OverlayPlan | null][] = [
  [{ kind: 'cells', id: '3rd-3rd' }, null],
  [{ kind: 'pentatonic', leave: PENTATONIC_LEAVE, dir: 'up', arpeggio: 'up-root' }, one(0, 'flat')],
  [{ kind: 'triad-pair', dir: 'up', arpeggio: 'up-root', shape: 'nearest' }, { kind: 'hexatonic' }],
  [{ kind: 'quartal', dir: 'up', arpeggio: 'up-root' }, { kind: 'quartal' }],
]
```

RED: `takesRhythm` (a new export):
```ts
const cases: [ChangesLineChoice, boolean, boolean][] = [['off', false, false], ['third', false, false], ['third', true, true], ['up-root', false, true], ...LINES.map(([l]): [ChangesLineChoice, boolean, boolean] => [l, false, true])]
expect(cases.map(([l, r]) => takesRhythm(l, r))).toEqual(cases.map(([, , want]) => want))
```

RED: a Line takes the rhythm. The slash rhythm is not drawn, and the caption is set. Over two 4/4 bars, the 3-pulse
unit starts bar 2 on pulse 8, which is not a multiple of 3, so only bar 1 is a landing: "never back on one":
```ts
const s = buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { rhythm: 'unit:8:3:rests' })
expect(bars(s).every((b) => b.rhythm.length === 0)).toBe(true)
expect(letters(bars(s)[0]!)).toEqual(['C', 'r', 'r', 'E', 'r', 'G', 'r'])
expect(s.rhythmCaption).toBe('Rhythm: 8ths in 3, with rests · never back on one')
```

RED: the caption names the start and the timing (D20):
```ts
expect(buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { rhythm: 'unit:8:3:rests', start: 'pickup-2', anticipate: 1.5 }).rhythmCaption).toBe('Rhythm: 8ths in 3, with rests · never back on one · 2-note pick-ups · anticipate 1½ beats')
```

RED: Restate (§5). Line A starts on CMaj7's 3rd, E, then moves to Dm7's nearer guide tone, F:
```ts
const r = buildChanges(two, CONCERT, 4, false, 'third', undefined, null, 'none', { rhythm: 'card:downbeats', restate: true })
expect(bars(r).map(letters)).toEqual([['E', 'E', 'E', 'E'], ['F', 'F', 'F', 'F']])
expect(r.rhythmCaption).toBe('Rhythm: Downbeats')
expect(bars(r)[0]!.chords[0]!.guide).toBe('3')
```

RED: each of the other four lines takes the rhythm. Under `card:upbeats`, every bar starts with a rest and every note
has a `mark`:
```ts
for (const [line, overlay] of LINES) expect(bars(buildChanges(two, CONCERT, 4, false, line, undefined, overlay, 'none', { rhythm: 'card:upbeats' })).every((b) => b.voice[0]?.pitch === null && b.voice.every((n) => n.mark))).toBe(true)
```

*(guard)* Start and Timing are inert without a rhythm (D9). The options are ignored today too:
```ts
expect(buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { start: 'pickup-3', anticipate: 2 })).toEqual(buildChanges(two, CONCERT, 4, false, 'up-root'))
```

*(guard)* Without Restate, the guide line ignores the rhythm (D17). This is today's behavior. The existing test is
renamed "a guide line without Restate draws no rhythm", and gains:
```ts
const g = buildChanges(two, CONCERT, 4, false, 'third', undefined, null, 'none', { rhythm: 'card:downbeats' })
expect(bars(g).map(letters)).toEqual([['E'], ['F']])
expect(g.rhythmCaption).toBeNull()
```

*(guard)* The symbol stays put under a Timing:
```ts
expect(bars(buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { rhythm: 'card:downbeats', anticipate: 1 }))[1]!.chords[0]!.beat).toBe(0)
```

- [ ] **Step 2: Run to see the RED ones fail.**

- [ ] **Step 3: Implement**

- `guideVoices` with `restate && rhythm`: after `guideToneLine`, call
  `cellVoices(chords, part, beats, keySig, (_, j) => oneNote(notes[j]), undefined, approach, rhythm)`. Here `oneNote`
  gives the placed note's cell, or null. Keep `labels` and `missing` from the guide path.
- `buildChanges`:
  - `const drawnBars = blocks.flatMap((b) => …)` gives `{ clockBars, lengths, breaks }` before `voices`. The clock
    bars match the voices' keys, and the rhythm-line block at the end reads the same list;
  - the plan goes to the line when `rhythm !== 'off' && takesRhythm(line, restate)`;
  - **the caption, one way only:** `rhythmCaption(rhythm, layRhythm(rhythm, lengths, breaks)!, lengths)` (landings
    don't depend on forcing). When a Line took the rhythm, pass it through `phrasingCaption(…, start, anticipate)`.
    `ChangesBar.rhythm` is laid only when `line === 'off'`.
- Update the API snapshot (`npx vitest -u src/__tests__/api.test.ts` in `engine/`) and review that only the new names
  appear.

- [ ] **Step 4: Run** `make test`, then `make golden`. Expected: PASS, and no golden diff.

- [ ] **Step 5: Commit** "The Lines take the rhythm; Restate (rhythm-on-lines spec §1, §5, §7)".

### Task 6: Target tones

**Files:**
- Modify: `engine/src/rhythm/targets.ts` (add `markTargets`; `import type { GuideNote }`); `engine/src/changes.ts`
  (apply it when `targets`); `engine/src/index.ts` and the API snapshot (an intended edit)
- Test: `engine/src/__tests__/rhythmTargets.test.ts` (new), `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Produces: `markTargets(voice: readonly GuideNote[], targets: readonly number[], tonesAt: (beat: number) => readonly number[] | null): GuideNote[]`

- [ ] **Step 1: Write failing tests**

RED, in `rhythmTargets.test.ts` (the function is new):
```ts
const n = (letter: string, beat: number, more: Partial<GuideNote> = {}): GuideNote => ({ pitch: { ...parseRoot(letter), midi: 60 + pcOf(parseRoot(letter)) }, beat, beats: 1, tie: false, tiedIn: false, accidental: null, ...more })
const CMAJ7 = () => [0, 4, 7, 11]
expect(markTargets([n('C', 0), n('E', 1), n('D', 2)], [0, 2], CMAJ7).map((x) => x.target)).toEqual(['tone', undefined, 'other'])
expect(markTargets([n('E', 2, { tiedIn: true })], [0, 2], CMAJ7)[0]!.target).toBeUndefined()
expect(markTargets([{ ...n('C', 0), pitch: null }], [0], CMAJ7)[0]!.target).toBeUndefined()
expect(markTargets([n('C', 0)], [0], () => null)[0]!.target).toBeUndefined()
```

RED, in `changes.test.ts`: §6's example through `buildChanges`. The boundaries are 0 and 2: CMaj7 plays C E, and Dm7
plays D F A C, then turns back A F:
```ts
const m = buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { rhythm: 'card:downbeats', anticipate: 2, targets: true })
expect(bars(m).map(letters)).toEqual([['C', 'E', 'D', 'F'], ['A', 'C', 'A', 'F']])
expect(bars(m).map((b) => b.voice.map((x) => x.target ?? null))).toEqual([['tone', null, 'other', null], ['tone', null, 'tone', null]])
```

RED: with Rhythm Off and Target beats on, the Line is colored (D18). With quarters, bar 1 is C E G B, and C (beat 1) and
G (beat 3) are both tones:
```ts
expect(bars(buildChanges(two, CONCERT, 4, false, 'up-root', undefined, null, 'none', { targets: true }))[0]!.voice.map((x) => x.target ?? null)).toEqual(['tone', null, 'tone', null])
```

RED: a tied piece is never colored (Review Focus 1). Use `unit:8:3:tied` over the chart `1 | CMaj7` + `1 | Dm7` (two
rows, one bar), with targets. It gives C@0, E@1½, E@2 (tied in) and D@3:
```ts
const tie = parseChart('key: C\n\nsection: A\n1 | CMaj7\n1 | Dm7\n').value
expect(bars(buildChanges(tie, CONCERT, 4, false, 'up-root', undefined, null, 'none', { rhythm: 'unit:8:3:tied', targets: true }))[0]!.voice.map((x) => x.target ?? null)).toEqual(['tone', null, null, null])
```

*(guard)* Without `targets`, no note has a `target`, with or without a rhythm.

- [ ] **Step 2: Run to see the RED ones fail.**

- [ ] **Step 3: Implement** per §6. In `buildChanges`, build `tonesAt` from the line's `drawn()` GuideInputs: the last
  input whose `start` (clock beats) is at or before the note's clock beat (`barStart(clock, clockBar) + note.beat`),
  then `arpeggioTones(part, input.chord, input.scale)` → pitch classes. Do not use `ChangesChord.scale`: it is the
  written display label.

- [ ] **Step 4: Run** `make test`, `make golden`. Expected: PASS, and no golden diff.

- [ ] **Step 5: Commit** "Target tones on the Lines (rhythm-on-lines spec §6)".

### Task 7: Preferences, share links, tiers, hidden settings

**Files:**
- Modify: `web/app/composables/usePreferences.ts` (after `targets`; `linkPreferences`)
- Modify: `engine/src/share.ts` (`ShareView`, `shareViewFrom`)
- Modify: `web/app/utils/interface.ts` (`CONTROL_TIERS`, `ViewSettings`, `HiddenSetting`, `setAway`)
- Modify (intended edits to existing tests): `web/test/interface.test.ts`:
  - "follows the spec tier tables" gains `'rhythm-phrasing': 'everything'`;
  - `DEFAULTS` gains `rhythmStart: 'beat', anticipate: 0, rhythmLine: false`.
- Test: `web/test/usePreferences.test.ts`, `engine/src/__tests__/share.test.ts`, `web/test/interface.test.ts`

**Interfaces:**
- Consumes: `isRhythmStart`, `isAnticipate` (from `@chord-scale-maker/engine`, exported in Task 5).
- Produces:
  - from `usePreferences` and `linkPreferences`: `rhythmStart: Ref<RhythmStart>` (`csm-rhythm-start`),
    `anticipate: Ref<number>` (`csm-anticipate`), `restate: Ref<boolean>` (`csm-guide-restate`);
  - `ShareView.rhythmStart?`, `ShareView.anticipate?`, `ShareView.restate?: true`;
  - `ControlId` `'rhythm-phrasing'` and `HiddenSetting` `'rhythm-phrasing'`;
  - `ViewSettings` gains `rhythmStart: RhythmStart`, `anticipate: number` and `rhythmLine: boolean`. `rhythmLine` is
    the engine's `takesRhythm` on the drawn line, computed by `EditorView` in Task 9.

- [ ] **Step 1: Write failing tests** (all RED: the fields are new)

- **Preferences:**
  - with the flag on, stored `pickup-2`, `-1.5` and `on` read back as `'pickup-2'`, -1.5 and true;
  - `pickup-4` reads as `beat`; `0.25` and `4` read as 0;
  - with the flag off, all three read their defaults and the stored text stays.
- **Share links:**
  ```ts
  expect(shareViewFrom({ rhythmStart: 'pickup-2', anticipate: 1.5, restate: true })).toEqual({ rhythmStart: 'pickup-2', anticipate: 1.5, restate: true })
  ```
  These two are *(guards)*: today every unknown field is dropped.
  ```ts
  expect(shareViewFrom({ rhythmStart: 'pickup-9', anticipate: 0.3, restate: 'yes' })).toBeUndefined()
  expect(shareViewFrom({ anticipate: 0 })).toBeUndefined()
  ```
- **Hidden settings** (C3: only when the Line takes the rhythm):
  ```ts
  const away = { ...DEFAULTS, lineMode: 'arpeggio', rhythm: 'card:upbeats', rhythmLine: true, rhythmStart: 'pickup-1' } as const satisfies ViewSettings
  expect(hiddenSettings('intermediate', away)).toEqual({ settings: ['rhythm-phrasing'], needs: 'everything' })
  expect(hiddenSettings('intermediate', { ...away, rhythmStart: 'beat', anticipate: -1 })).toEqual({ settings: ['rhythm-phrasing'], needs: 'everything' })
  expect(hiddenSettings('intermediate', { ...away, rhythmLine: false })).toBeNull() // Line Off: Start does nothing, so it isn't named
  expect(hiddenSettings('everything', away)).toBeNull()
  ```
  Restate gets no rule of its own (§10): it acts only with a rhythm on, which already lists `rhythm`.

- [ ] **Step 2: Run to see them fail** (`npm test -w web -- usePreferences interface`, `npm test -w engine -- share`).

- [ ] **Step 3: Implement.**
  - Follow `csm-targets`' pattern, gated by `rhythmOn`. `csm-anticipate` is stored with `String(n)` and read with
    `Number(s)` through `isAnticipate`.
  - `CONTROL_TIERS['rhythm-phrasing'] = 'everything'`.
  - `setAway`: on the Changes, with `rhythm !== 'off' && rhythmLine && (rhythmStart !== 'beat' || anticipate !== 0)`,
    add `['rhythm-phrasing', 'everything']`.

- [ ] **Step 4: Run** `make test`. Expected: PASS.

- [ ] **Step 5: Commit** "Start, timing and Restate preferences, links and tiers (rhythm-on-lines spec §10)".

### Task 8: Drawing poured lines and target tones

**Files:**
- Modify: `web/app/utils/changesDrawing.ts`:
  - `tickFor` uses `n.mark`;
  - `drawGuideLine` adds tuplets, mark beams (`beamRuns`), accents, ink tops and target classes;
  - `xs` reads whole beats only.
- Modify: `web/app/components/ChangesSheet.vue`: new props `rhythmStart`, `anticipate` and `restate`, passed to
  `buildChanges`.
- Modify: `web/app/components/EditorView.vue`: pass `prefs.rhythmStart`, `prefs.anticipate` and `prefs.restate` to
  `ChangesSheet` (beside `:rhythm`), so this task's e2e can set them through `localStorage`. The controls come in
  Task 9.
- Test: `web/test/changesDrawing.test.ts`; `web/e2e/changes.spec.ts`

**Interfaces:**
- Consumes: `GuideNote.mark`, `GuideNote.target`; the Task 7 refs.
- Produces: `beamRuns(notes: readonly GuideNote[]): number[][]`. It gives the indexes of each run of two or more
  consecutive pitched notes that share `mark.beam`. It reuses the file's `groupsOf`, keyed by `${beam}:${run}`, where a
  rest starts a new run.

- [ ] **Step 1: Write failing tests**

**The unit test** (RED: `beamRuns` is new):
```ts
const C4: Pitched = { letter: 0, acc: 0, midi: 60 }
const n = (beam: number | null, pitched = true): GuideNote => ({ pitch: pitched ? C4 : null, beat: 0, beats: 0.5, tie: false, tiedIn: false, accidental: null, mark: { value: '8', tuplet: null, beam, accent: false } })
expect(beamRuns([n(0), n(0, false), n(0), n(1), n(1), n(1)])).toEqual([[3, 4, 5]])
expect(beamRuns([n(0), n(0), n(null), n(2), n(2)])).toEqual([[0, 1], [3, 4]])
```

**e2e, in `changes.spec.ts`** (all RED: no marks or classes are drawn today). Use the pasted chart
`title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | Dm7\n3 | G7\n4 | CMaj7\n`, Piano, 7th Chords Up · root. Set
`csm-rhythm`, `csm-rhythm-start` and `csm-anticipate` in `localStorage` before load:
- `unit:8:3:rests`: the first line's aria-label matches `/7th chords: C\S* rest rest E\S* rest G\S* rest /`, and
  contains `; rhythm: 8ths in 3, with rests`;
- `card:downbeats`, `csm-anticipate` 2, Target beats on: the first line's SVG holds 3 `.vf-dimmed` and 5
  `.vf-selected`. The boundaries are 0, 2, 6 and 10, giving `C E D F | A C G B | D F C E | G B G E`. On beats 1 and 3:
  C✓ D✗ / A✓ G✗ / D✓ C✗ / G✓ G✓;
- `unit:8t:4:accents`: the first line holds a triplet bracket (its `3` text) and at least one accent glyph;
- Rhythm Off, Target beats on: `.vf-selected` is 8 (quarters, one chord a bar: beats 1 and 3 of each bar, every
  7th-chord note a chord tone), and `.vf-dimmed` is 0.

- [ ] **Step 2: Run to see them fail**

`npx playwright test changes` in `web/`. Expected: FAIL.

- [ ] **Step 3: Implement** per §8:
- `tickFor`: `duration = n.mark?.value ?? DURATIONS[n.beats as NoteBeats]`.
  - **With a mark,** dot exactly when `mark.value` ends in `d`, and add `Articulation('a>')` when `mark.accent`. Share
    that code with `rhythmTick`, through one helper both call.
  - **Without a mark,** today's rule (3 or 6 beats). A poured `hd` must get one dot, not two.
- In `drawGuideLine`:
  - when any note has a mark, beams come from `beamRuns`, not `generateBeams`, and there is one `Tuplet` per
    `mark.tuplet`;
  - `tops` and `row` include the accents and the tuplets, as `drawRhythmLine` does;
  - `xs` keys on whole beats only (`onBeat`);
  - after the notes are drawn, `getSVGElement()?.classList.add('vf-selected' | 'vf-dimmed')` by `target`.
- The aria-label adds `rhythmAria(opts.rhythmCaption)` when any note has a mark.

- [ ] **Step 4: Run** `make test`, `make e2e`, `make lint`. Expected: PASS.

- [ ] **Step 5: Commit** "Draw poured lines and target tones (rhythm-on-lines spec §8)".

### Task 9: Controls, and the editor's wiring

**Files:**
- Modify: `web/app/components/PreviewControls.vue`:
  - in the Rhythm group, under the rhythm's detail: Start, Timing and Restate;
  - remove `Turn Line off to see the rhythm.`;
  - add the Restate description;
  - a new boolean prop `lineTakesRhythm`.
- Modify: `web/app/components/EditorView.vue`:
  - `v-model:rhythm-start`, `v-model:anticipate` and `v-model:restate` beside `v-model:rhythm`;
  - `:line-takes-rhythm="takesRhythm(changesLine, prefs.restate.value)"`, using the engine's `takesRhythm` on the
    existing `changesLine` computed;
  - `hiddenSettings` gains `rhythmStart`, `anticipate` and `rhythmLine` (the same `takesRhythm` value);
  - the reset clears start, timing and Restate;
  - the share view writes `rhythmStart`, `anticipate` and `restate` when away from their defaults, on the Changes with
    a rhythm on.
- Modify: `web/e2e/fixtures.ts`: `chooseStart(page, label)`, `chooseTiming(page, label)`, `restateOn(page)`, beside
  `chooseRhythm`.
- Test: `web/e2e/changes.spec.ts`

**Interfaces:**
- Consumes: `RHYTHM_STARTS`, `RHYTHM_START_LABELS`, `ANTICIPATE_STEPS`, `anticipateLabel`, `takesRhythm` (all from
  `@chord-scale-maker/engine`).

- [ ] **Step 1: Write failing tests (e2e; all RED: the controls are new)**

These are added; no existing test is replaced.
- With Guide Tones and a rhythm, the Rhythm listbox is described by "Guide tones hold each chord's note. Turn on
  Restate to play it in the rhythm." After `restateOn`, the description is gone and the first line's aria-label carries
  `; rhythm: `.
- With 7th Chords and `8ths in 3`:
  - Start and Timing show at Everything;
  - at Intermediate they are hidden, and opening a link that set `rhythmStart` shows the hidden-settings notice.
- `chooseStart(page, '3-note pick-up')` on a chart with `1 | N.C.` and `2 | CMaj7`, Piano:
  - bar 1's aria part reads `rest rest rest G\S* A\S* B\S*`;
  - Piano's range reaches F3, and CMaj7 there takes C Lydian, whose notes below C are B, A, G.
- A share link with
  `{ line: 'up-root', rhythm: 'card:downbeats', rhythmStart: 'pickup-2', anticipate: 1.5 }`, opened at Everything:
  - Start reads "Start: 2-note pick-up" and Timing reads "Anticipate 1½ beats";
  - the caption ends `· 2-note pick-ups · anticipate 1½ beats`.
- With the Line Off, Start and Timing are hidden, and the rhythm line draws as in Phase 1.

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement** per §10:
  - Start: `aria-label="Start"`, selected "Start: {label}";
  - Timing: `aria-label="Timing"`, selected `anticipateLabel`;
  - both inside `EaseReveal :show="rhythm !== 'off' && lineTakesRhythm && shows('rhythm-phrasing')"`;
  - Restate: a `ToggleButton`, `v-if="lineMode === 'guide' && rhythm !== 'off'"`;
  - `aria-describedby="rhythm-help"` only when the description shows;
  - the rail keeps its two rows: everything is inside the Line options popover.

- [ ] **Step 4: Run** `make test`, `make e2e`, `make lint`. Expected: PASS.

- [ ] **Step 5: Commit** "Start, Timing and Restate controls (rhythm-on-lines spec §10)".

### Task 10: Print

**Files:**
- Modify: `web/e2e/print.spec.ts`, beside the rhythm line's loop
- Maybe modify (only if a test fails): `changesLinesPerPage` in `engine/src/changes.ts` (a `poured` fourth argument)
  and its test; `linesPerPage` in `web/app/components/ChangesSheet.vue`
- Test: `web/e2e/print.spec.ts`; `engine/src/__tests__/changes.test.ts`

- [ ] **Step 1: Write the tests** (§9). They are *(guards)* by design: each pins that the voiced budget holds, and
  passes as soon as Tasks 8–9 draw the lines. Each prints a sheet page to a letter page, with Numerals and Scales on:
  - Stardust, Tuba, `showArpeggios(page, 'Up · root')`, `chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })`,
    `chooseStart(page, '3-note pick-up')`, `showTargets(page)`;
  - the 5/4 chart (`BARS_5_4`), `showArpeggios(page, 'Up · root')`, `chooseRhythm(page, 'Triplets', { In: 'In 4', Variation: 'with accents' })`,
    `chooseTiming(page, 'Anticipate 1½ beats')`.

  Both wait for `rhythmDrawn(page)`, then `expect(pdfPages(...)).toBe(sheetPages)`, with `sheetPages >= 2`.

- [ ] **Step 2: Run** `npx playwright test print` in `web/`.
  - **Expected:** PASS with no code change. A poured line is a voiced line, and its ink is the arpeggio line's plus
    what the rhythm line already prints within budget (§9).
  - **If either fails:**
    - add `poured = false` to `changesLinesPerPage`, giving `voiced − 1`;
    - add a RED unit test: `changesLinesPerPage('up-root', { numerals: true, scales: true }, true, true)` is 5;
    - pass `poured` from `ChangesSheet` (a Line on and a rhythm caption);
    - rerun until both pass, and record the measured result in §9 of the spec.

- [ ] **Step 3: Run** `make test`, `make e2e`. Expected: PASS, and every existing print test unchanged.

- [ ] **Step 4: Commit** "Print poured lines within the voiced budget (rhythm-on-lines spec §9)".

### Task 11: Docs, decisions, design.md, a11y

**Files:**
- Modify:
  - `web/app/pages/help.vue` `#rhythm`, per §11:
    - the Rhythm entry's "draws only while the Line is Off; with a Line on, the control says *Turn Line off to see the
      rhythm.*" becomes "With a Line on, the Line plays in the rhythm.";
    - new entries `#rhythm-pour`, `#rhythm-pickups`, `#rhythm-anticipate`, Restate, and `#rhythm-target-tones` under
      Target beats;
    - citations, each by title and page only: Galper, *Forward Motion*, pp. 169–172 and pp. 47–49; Bergonzi, *Inside
      Improvisation Vol. 4*, p. 119;
  - `engine/src/decisions.ts`:
    - new rows `rhythm.pour`, `rhythm.pickups`, `rhythm.anticipate` and `rhythm.target-tones`, page `help`, anchors
      `rhythm-pour`, `rhythm-pickups`, `rhythm-anticipate` and `rhythm-target-tones`;
    - the existing `arp.line` row's summary, which says the line "keeps its rhythm", gains "unless a Rhythm is chosen".
      Its section in `web/app/pages/how-it-decides.vue` (`DecisionSection id="arp.line"`) says the same;
  - `docs/design.md`:
    - the rhythm section gains the Lines (pouring, Start, Timing, Restate, target tones, `lineRhythm`, `RhythmPlan`,
      `takesRhythm`), and loses "Turn Line off to see the rhythm.";
    - the 7th Chords and Triad pair entries say that a rhythm replaces their note-value rule;
  - `web/e2e/a11y/pages.a11y.ts`: a new case in the light/dark loop.
- Test: `web/test/docs/decisions.test.ts`, `help.test.ts` (existing; they check the anchors), `make a11y`

- [ ] **Step 1: Add the a11y case** (RED until Task 9's controls exist; run it after Task 9). It goes beside
  "the Changes with a rhythm and target beats" and uses the file's `SONG`, `darkMode`, `staves` and `expectAccessible`:

```ts
test('the Changes with a Line in a rhythm, pick-ups and target beats', async ({ page }) => {
  await page.goto(SONG)
  if (theme === 'dark') await darkMode(page)
  await expect(staves(page).first()).toBeVisible()
  await showArpeggios(page, 'Up · root')
  await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
  await chooseStart(page, '2-note pick-up')
  await rhythmDrawn(page)
  await showTargets(page)
  await expect(page.locator('svg[aria-label^="Bars:"] .vf-selected').first()).toBeVisible()
  await expectAccessible(page)
})
```

Add `showArpeggios` and `chooseStart` to the file's fixtures import. Run `make a11y`. Expected: PASS, or a violation
to fix in Task 8's or Task 9's markup. The `vf-dimmed` grey is the Practice color already scanned on the Scales sheet.

- [ ] **Step 2: Write the Help entries and the DECISIONS rows.** Each Help entry states its rule in plain words:
  - Rhythm on a Line: "one note an attack; rests skipped; a tie holds; a chord with more notes than attacks is cut, with
    fewer it starts the next cell or turns back";
  - Start: "the target and the pick-up are struck even where the rhythm rests; the pick-up's notes are the chord
    before's, or after a rest the scale notes below (a note outside your range rests); the sheet's first bar has no
    pick-up; a 2nd ending starts on its beat";
  - Timing: "the chord symbols stay put";
  - Restate: Guide Tones hold their note unless Restate is on;
  - Target tones: "with Target beats on, a chord tone on a dot is lit and any other note on a dot is grey; nothing
    moves a note onto a dot".

  Run `make docs`. Expected: PASS (the anchors exist, the links resolve).

- [ ] **Step 3: Write the design.md text.** No `releaseNotes.ts` item: the PR description carries
  `Release notes: none — the rhythm flag is off`.

- [ ] **Step 4: Run** `make test`, `make lint`, `make docs`, `make a11y`. Expected: PASS.

- [ ] **Step 5: Commit** "Rhythm on the Lines: docs, decisions and a11y (rhythm-on-lines spec §11)".
