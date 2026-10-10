# Guide Tone Ranges per Instrument Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The guide tone lines take their written range and centre from the instrument, so vibes lines can go down to G3 and up to D6 around B♭4, a trumpet's stay within C4–G5, and so on.

**Architecture:** A `Range` (`{ lo, hi, centre }`, MIDI, written) per instrument in `INSTRUMENTS`; `partFor(name)` carries it on `Part`; `rangeOf(part)` gives the part's range or its clef's default. `guideToneLines` and `voiceLead` take a `Range` instead of a `Clef`. The rules don't change.

**Tech Stack:** TypeScript (strict) engine in `web/engine/`, Vitest, Playwright, Nuxt app (unchanged wiring).

**Spec:** docs/superpowers/specs/2026-10-10-guide-tone-ranges-design.md

## Global Constraints

- The ranges, verbatim from the spec (written pitch, MIDI; C4 = 60):
  concert 60–81 centre 69; piano 60–84 centre 70; vibes 55–86 centre 70; flute 60–84 centre 73; guitar 57–81 centre 63;
  trumpet and flugelhorn 60–79 centre 70; clarinet 57–84 centre 66; soprano, alto, tenor and bari sax 58–84 centre 68;
  horn 60–79 centre 70; trombone 46–64 centre 56; tuba 36–58 centre 47; bass 40–60 centre 49.
- The readability cap (`CAPS`): treble 55–86 (G3–D6), bass 35–65 (B1–F4). Every instrument's range lies inside its clef's cap.
- Clef defaults (`RANGES`, for a part without a range such as `CONCERT`): treble `{ lo: 60, hi: 81, centre: 69 }`, bass `{ lo: 40, hi: 60, centre: 49 }` — today's behaviour exactly.
- The centre is used only for the start octave (rules 1 and 6) and rule 3's tie-break; the range is the only pitch limit. No guide tone rule changes.
- The pair search (`voiceLead`, comparison script only) uses a comfort band of `centre ± 5` semitones.
- The Scales sheet's range is unchanged.
- `web/engine/` stays free of Vue/DOM imports. No feature flag, no new dependency.
- Vitest: `cd web && npx vitest run <file>`; gates `make test`, `make lint`, `make e2e`, `make golden` from the repo root (golden: no fixture change expected).
- Stage files by name; never `git add -A` (iCloud `* 2.*` copies). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Do not push.** The branch `guide-tone-ranges` stays local until the user says so.

## Review Focus

1. **A part built by hand without a range** (`CONCERT`, the tests' `TENOR`/`BASS`, share links of old views): must behave exactly as today. → Task 2: the existing rule tests and worked examples pass unchanged with `CONCERT`; a test that `rangeOf({ clef: 'treble', trans: 'Bb' })` equals the treble default.
2. **The trumpet on the Changes sheet** (the e2e "written for the part" test): its range shrinks to C4–G5 with centre B♭4, so drawn pitches may move. → Task 3: update that e2e test's expectations only, and assert every drawn guide tone lies within C4–G5 written.
3. **Vibes at the C4 floor:** the line now steps down to B3 instead of turning up. → Task 2: unit test with the vibes part.
4. **Ledger lines on vibes:** notes down to G3 and up to D6 draw two ledger lines without colliding with the chord symbols or labels. → Task 3 e2e at 4 and 2 bars a line.
5. **Every instrument over the library:** both lines always inside that instrument's range. → Task 2 library test, one case per instrument.

---

## File map

| File | Change | Task |
| --- | --- | --- |
| `web/engine/instruments.ts` | `Range`, `CAPS`, a `range` on every `INSTRUMENTS` entry | 1 |
| `web/engine/part.ts` | `Part.range?`, `partFor` carries it, `rangeOf` | 1 |
| `web/engine/voiceLeading.ts` | `RANGES` as `{ lo, hi, centre }`; `voiceLead(tones, range)` | 1 (RANGES shape), 2 (voiceLead) |
| `web/engine/guideToneLines.ts` | `guideToneLines(tones, range, blocks)` | 2 |
| `web/engine/guideTones.ts` | `guideVoices` passes `rangeOf(part)` | 2 |
| `web/scripts/guideLines.ts` | `--instrument <name>` | 2 |
| `web/engine/__tests__/instruments.test.ts` | ranges, caps, partFor, rangeOf | 1 |
| `web/engine/__tests__/guideToneLines.test.ts` | call sites; vibes cases; library per instrument | 2 |
| `web/e2e/changes.spec.ts` | trumpet expectations; vibes ledger lines | 3 |
| `docs/design.md`, `docs/roadmap.md`, the spec | docs | 3 |

---

### Task 1: Ranges on instruments and parts

**Files:**
- Modify: `web/engine/instruments.ts`
- Modify: `web/engine/part.ts:11,19-25`
- Modify: `web/engine/voiceLeading.ts:14-18` (the `RANGES` shape) and its two readers in that file (`candidates`, `placeCost`)
- Modify: `web/engine/guideToneLines.ts:69` (reads `RANGES[clef].comfortLo/Hi` — switch to `.centre` so the file still compiles; Task 2 replaces the clef parameter)
- Test: `web/engine/__tests__/instruments.test.ts`

**Interfaces:**
- Produces:
  - `type Range = Readonly<{ lo: number; hi: number; centre: number }>` (exported from `engine/instruments.ts`)
  - `const CAPS: Readonly<Record<Clef, Readonly<{ lo: number; hi: number }>>>` (`engine/instruments.ts`)
  - every `INSTRUMENTS[name].range: Range`
  - `type Part = Readonly<{ clef: Clef; trans: Transposition; range?: Range }>`
  - `partFor(name)` returns `{ clef, trans, range }`
  - `rangeOf(part: Part): Range` (`engine/part.ts`)
  - `RANGES: Readonly<Record<Clef, Range>>` (`engine/voiceLeading.ts`): treble `{ lo: 60, hi: 81, centre: 69 }`, bass `{ lo: 40, hi: 60, centre: 49 }`
- Re-export `Range`, `CAPS` and `rangeOf` from `web/engine/index.ts` the way `partFor` and `INSTRUMENTS` are exported.

- [ ] **Step 1: Write the failing tests**

In `web/engine/__tests__/instruments.test.ts`, change the imports to
`import { CAPS, INSTRUMENTS, instrumentLabel, isInstrumentName } from '../instruments'` and
`import { CONCERT, partFor, rangeOf } from '../part'`, plus `import { RANGES } from '../voiceLeading'`. Replace the
"maps instruments to the part they read" test and add:

```ts
  it('maps instruments to the part they read, with their guide tone range', () => {
    expect(partFor('trumpet')).toEqual({ clef: 'treble', trans: 'Bb', range: { lo: 60, hi: 79, centre: 70 } })
    expect(partFor('bari-sax')).toEqual({ clef: 'treble', trans: 'Eb', range: { lo: 58, hi: 84, centre: 68 } })
    expect(partFor('tuba')).toEqual({ clef: 'bass', trans: 'C', range: { lo: 36, hi: 58, centre: 47 } })
  })

  it('gives every instrument the range the spec lists (written MIDI; C4 = 60)', () => {
    const ranges = Object.fromEntries(Object.entries(INSTRUMENTS).map(([name, i]) => [name, [i.range.lo, i.range.hi, i.range.centre]]))
    expect(ranges).toEqual({
      concert: [60, 81, 69], piano: [60, 84, 70], vibes: [55, 86, 70], flute: [60, 84, 73], guitar: [57, 81, 63],
      trumpet: [60, 79, 70], flugelhorn: [60, 79, 70], clarinet: [57, 84, 66],
      'soprano-sax': [58, 84, 68], 'alto-sax': [58, 84, 68], 'tenor-sax': [58, 84, 68], 'bari-sax': [58, 84, 68],
      horn: [60, 79, 70], trombone: [46, 64, 56], tuba: [36, 58, 47], bass: [40, 60, 49],
    })
  })

  it('keeps every range inside its clef’s two-ledger-line cap, with its centre inside the range', () => {
    expect(CAPS).toEqual({ treble: { lo: 55, hi: 86 }, bass: { lo: 35, hi: 65 } })
    for (const [name, { clef, range }] of Object.entries(INSTRUMENTS)) {
      expect(range.lo, name).toBeGreaterThanOrEqual(CAPS[clef].lo)
      expect(range.hi, name).toBeLessThanOrEqual(CAPS[clef].hi)
      expect(range.centre, name).toBeGreaterThanOrEqual(range.lo)
      expect(range.centre, name).toBeLessThanOrEqual(range.hi)
    }
  })

  it('a part without a range takes its clef’s default, today’s range', () => {
    expect(RANGES).toEqual({ treble: { lo: 60, hi: 81, centre: 69 }, bass: { lo: 40, hi: 60, centre: 49 } })
    expect(rangeOf(CONCERT)).toEqual(RANGES.treble)
    expect(rangeOf({ clef: 'treble', trans: 'Bb' })).toEqual(RANGES.treble)
    expect(rangeOf({ clef: 'bass', trans: 'C' })).toEqual(RANGES.bass)
    expect(rangeOf(partFor('vibes'))).toEqual({ lo: 55, hi: 86, centre: 70 })
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run engine/__tests__/instruments.test.ts`
Expected: FAIL — `CAPS`, `rangeOf` not exported; `partFor` has no `range`.

- [ ] **Step 3: Implement**

`web/engine/instruments.ts`: after `Instrument`'s type:

```ts
/** a guide tone line's written range (MIDI, C4 = 60): candidates lie in [lo, hi]; centre places a start and breaks ties */
export type Range = Readonly<{ lo: number; hi: number; centre: number }>
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string; range: Range }>

/** the most a guide tone line may need on the staff: two ledger lines either side (treble G3–D6, bass B1–F4) */
export const CAPS: Readonly<Record<Clef, Readonly<{ lo: number; hi: number }>>> = {
  treble: { lo: 55, hi: 86 },
  bass: { lo: 35, hi: 65 },
}
```

(replace the existing `Instrument` type line) and give every `INSTRUMENTS` entry its `range`, from the Global Constraints list, e.g.

```ts
  concert: { clef: 'treble', trans: 'C', description: 'any C instrument, treble clef (piano RH, vibes, flute, violin)', range: { lo: 60, hi: 81, centre: 69 } },
  vibes: { clef: 'treble', trans: 'C', description: 'same as concert', range: { lo: 55, hi: 86, centre: 70 } }, // G3–D6, centre the middle B♭ (B♭4)
```

with a short comment on each giving the note names (G3–D6, B♭4) as the spec's table has them.

`web/engine/voiceLeading.ts`: replace `RANGES` with

```ts
/** each clef's default guide tone range (written): a part without its own (CONCERT) uses it — treble C4–A5 around A4, bass E2–C4 around C♯3 */
export const RANGES: Readonly<Record<Clef, Range>> = {
  treble: { lo: 60, hi: 81, centre: 69 },
  bass: { lo: 40, hi: 60, centre: 49 },
}
```

(`import type { Clef, Range } from './instruments'`), and in `placeCost` replace the comfort bounds with `const comfortLo = RANGES[clef].centre - 5` and `const comfortHi = RANGES[clef].centre + 5` (the pair search's band; Task 2 makes it take a `Range`).

`web/engine/part.ts`:

```ts
export type Part = Readonly<{ clef: Clef; trans: Transposition; range?: Range }>
…
export const partFor = (name: InstrumentName): Part => {
  const { clef, trans, range } = INSTRUMENTS[name]
  return { clef, trans, range }
}

/** a part's guide tone range: its instrument's, or its clef's default */
export const rangeOf = (part: Part): Range => part.range ?? RANGES[part.clef]
```

(`import { RANGES } from './voiceLeading'`; `import type { Range } from './instruments'`). If importing `RANGES` into `part.ts` creates an import cycle that breaks at runtime (voiceLeading imports a type from part — type-only imports are fine), move `RANGES` into `instruments.ts` beside `CAPS` and re-export it from `voiceLeading.ts`.

`web/engine/guideToneLines.ts:69`: `const centre = RANGES[clef].centre`.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `cd web && npx vitest run engine && npm run typecheck`
Expected: PASS. Any test or code that deep-compares a `partFor(...)` result against `{ clef, trans }` fails here — update it to include the range (there may be some in `web/test/`; run `cd web && npx vitest run` too).

- [ ] **Step 5: Commit**

```bash
git add web/engine/instruments.ts web/engine/part.ts web/engine/voiceLeading.ts web/engine/guideToneLines.ts web/engine/index.ts web/engine/__tests__/instruments.test.ts
# plus any test file Step 4 made you update, by name
git commit -m "Engine: a guide tone range per instrument (written, inside a two-ledger-line cap), carried on the part

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The lines read the part's range

**Files:**
- Modify: `web/engine/guideToneLines.ts` (signature, `octaves`, `together`, `centre`)
- Modify: `web/engine/guideTones.ts:160`
- Modify: `web/engine/voiceLeading.ts` (`voiceLead`, `smoothestPairs`, `candidates`, `placeCost` take a `Range`)
- Modify: `web/scripts/guideLines.ts:21,110`
- Test: `web/engine/__tests__/guideToneLines.test.ts`

**Interfaces:**
- Consumes: `Range`, `rangeOf`, `partFor`, `RANGES` (Task 1).
- Produces: `guideToneLines(tones: readonly (GuideTones | null)[], range: Range, blocks?: readonly number[])`; `voiceLead(tones, range: Range)`; script flag `--instrument <name>`.

- [ ] **Step 1: Write the failing tests**

In `web/engine/__tests__/guideToneLines.test.ts`:
- import `partFor, rangeOf` from `'../part'` and `INSTRUMENTS, type InstrumentName` from `'../instruments'`;
- the helper `linesOf` calls `guideToneLines(chords.map((c) => guideTonesFor(part, c)), rangeOf(part), blocks)` (drop the `as Clef` cast and the `Clef` import if unused);
- the "rule 7" test at ~line 100 passes `rangeOf(CONCERT)`;
- add:

```ts
describe('guide tone lines in an instrument’s range', () => {
  const VIBES = partFor('vibes')

  it('rule 4 on vibes: at C4 the line steps down to B3 (Cb4 here), where the treble default turned up to F4', () => {
    expect(linesOf(['C7', 'Ab', 'Db7']).a).toEqual(['E4 (3)', 'C4 (3)', 'F4 (3)']) // the default range: C4 is the floor
    expect(linesOf(['C7', 'Ab', 'Db7'], VIBES).a).toEqual(['E4 (3)', 'C4 (3)', 'Cb4 (7)'])
  })

  it('rule 1 on vibes: a line starts in the octave nearest B♭4', () => {
    expect(linesOf(['Dm7'], VIBES)).toEqual({ a: ['F4 (3)'], b: ['C5 (7)'] })
    expect(linesOf(['Ebm7'], VIBES).a).toEqual(['Gb4 (3)']) // Gb4 (66) and Gb5 (78): 4 and 8 from B♭4
  })

  it('a trumpet’s lines stay within C4–G5 written', () => {
    const [a, b] = guideToneLines(['Dm7', 'G7', 'CMaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7'].map((c) => guideTonesFor(partFor('trumpet'), c)), rangeOf(partFor('trumpet')))
    for (const n of [...a, ...b]) expect(n && n.pitch.midi >= 60 && n.pitch.midi <= 79).toBe(true)
  })
})
```

Verify each expectation by hand before trusting it: compute the vibes `Db7` case from `C4` (Db7's 3rd F, 7th C♭; with `lo` 55 the C♭ a half step below C4 is a candidate, so the move is 1). If a hand computation disagrees with an expectation above, the expectation is wrong: fix it and say so in your report — do not change engine logic to fit a test.

- In the library describe at ~line 166: iterate the instruments too, and read the range from the part:

```ts
  const PARTS: readonly (readonly [string, Part])[] = [
    ['treble (concert)', CONCERT], ['bass', BASS], ['Bb tenor', TENOR],
    ...(Object.keys(INSTRUMENTS) as InstrumentName[]).map((n) => [n, partFor(n)] as const),
  ]
  for (const [name, part] of PARTS) {
    it(`${name}: both lines sound at every voiced chord, on different guide tones, inside the written range`, () => {
      …
      const { lo, hi } = rangeOf(part)
      …
        const [a, b] = guideToneLines(tones, rangeOf(part))
```

(import `type Part` from `'../part'`).

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run engine/__tests__/guideToneLines.test.ts`
Expected: FAIL — type errors or wrong pitches (the engine still takes a clef).

- [ ] **Step 3: Implement**

`web/engine/guideToneLines.ts`: replace every `clef: Clef` parameter with `range: Range` (`import type { Range } from './instruments'`):

```ts
function octaves(t: GuideTones, role: 0 | 1, range: Range): Candidate[] {
  const { lo, hi } = range
  …
}
function together(from: Pair, [a, b]: Pair, t: GuideTones, range: Range, centre: number): Pair { … octaves(t, …, range) … }
export function guideToneLines(tones: readonly (GuideTones | null)[], range: Range, blocks: readonly number[] = []): … {
  const centre = range.centre
  … octaves(t, 0, range) … together(prev.notes, [a, b], t, range, centre) …
}
```

Drop the `RANGES` import if nothing else in the file uses it.

`web/engine/guideTones.ts:160`: `guideToneLines(tones, rangeOf(part), chords.map((c) => c.block ?? 0))` (import `rangeOf` from `./part`).

`web/engine/voiceLeading.ts`: `candidates(tones, range)`, `placeCost(midi, range)` with `comfortLo = range.centre - 5`, `comfortHi = range.centre + 5`, `smoothestPairs(steps, range)`, `export function voiceLead(tones, range: Range)`. The file no longer needs `Clef` except in `RANGES`' type.

`web/scripts/guideLines.ts`: replace the `part` line with

```ts
const instrument = flag('--instrument') ? args[args.indexOf('--instrument') + 1] : undefined
if (instrument !== undefined && !isInstrumentName(instrument)) throw new Error(`--instrument: no instrument "${instrument}" (${Object.keys(INSTRUMENTS).join(', ')})`)
const part: Part = instrument ? partFor(instrument) : args[args.indexOf('--part') + 1] === 'bass' && flag('--part') ? { ...CONCERT, clef: 'bass' } : CONCERT
```

(import `INSTRUMENTS`, `isInstrumentName`, `partFor`, `rangeOf` from `'../engine'`), line 110: `guideToneLines(tones, rangeOf(part), …) : voiceLead(tones, rangeOf(part))`, add the flag to the usage comment at the top (`npm run guide-lines -- --instrument vibes   the lines in an instrument's own range`), and print the instrument's name in the report headings where the part is named today.

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run engine && npm run typecheck && npm run guide-lines -- --check && npm run guide-lines -- --instrument vibes | head -12`
Expected: PASS; `--check` matches the sheet on all charts; the vibes report prints.

- [ ] **Step 5: Measure, before and after**

Before: the clef defaults are today's behaviour, so `npm run guide-lines` (treble) and `npm run guide-lines -- --part bass` give the before numbers. After: `npm run guide-lines -- --instrument <name>` for vibes, trumpet, tenor-sax, guitar and trombone. For each, record the common-tone / step / leap shares, the count of moves over a tritone and the largest move, as a markdown table in your report (it goes into the PR description).

- [ ] **Step 6: Commit**

```bash
git add web/engine/guideToneLines.ts web/engine/guideTones.ts web/engine/voiceLeading.ts web/scripts/guideLines.ts web/engine/__tests__/guideToneLines.test.ts
git commit -m "Guide tone lines: each part's own range and centre; the script measures an instrument

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sheet, the browser tests and the docs

**Files:**
- Modify: `web/e2e/changes.spec.ts` (~line 168: the trumpet/bass test; add a vibes test)
- Modify: `docs/design.md` (the guide tone lines section)
- Modify: `docs/roadmap.md` (move the entry to Done)
- Modify: `docs/superpowers/specs/2026-10-10-guide-tone-ranges-design.md` (Status: implemented)

**Interfaces:**
- Consumes: Tasks 1–2; e2e helpers in `web/e2e/fixtures.ts` (`writeChart`, `showGuides`, `guidesDrawn`, `chooseInstrument`, `drawn`, `lines`).

- [ ] **Step 1: Run the e2e suite to see what moved**

Run: `make e2e` (repo root). Expected: the trumpet test at ~line 168 may fail because the trumpet's pitches moved (range C4–G5, centre B♭4). Change its expectations only (keep its intent: guide tones are written for the part; the bass part within E2–C4), and add an assertion that every trumpet guide tone note sits within C4–G5 written (read the notes the way the test already does).

- [ ] **Step 2: Add the vibes test**

In `web/e2e/changes.spec.ts`, next to the four-chords-a-bar collision tests, add a test that, for vibes at 1400 and 390 wide (4 and 2 bars a line), writes a chart whose line falls below C4 and rises above A5 — e.g. `title: T\nkey: C\nA | 1 | C7\nA | 2 | Ab\nA | 3 | Db7\nA | 4 | Gb\nA | 5 | B7\nA | 6 | E7\nA | 7 | A7\nA | 8 | D7\n` (check by hand or with `npm run guide-lines -- --instrument vibes`-style reasoning that it reaches below C4; adjust the chart until it does) — shows both guide tones, and asserts:
- the line's lowest notehead sits below the staff's bottom line (it needs a ledger line), and
- no notehead or accidental collides (reuse the existing `box`/`overlaps` check and its own-accidental rule from the collision tests in that file), and every chord symbol sits on its note (`expectChordsOnHeads`).

Run: `cd web && npx playwright test e2e/changes.spec.ts` after one `make e2e` build. Expected: PASS.

- [ ] **Step 3: Docs**

- `docs/design.md`, guide tone lines section: the candidates are both guide tones at every octave inside the part's range (`rangeOf(part)`: its instrument's range from `INSTRUMENTS`, inside a two-ledger-line cap, treble G3–D6, bass B1–F4; a part without one uses the clef default, treble C4–A5 around A4, bass E2–C4 around C♯3); the centre places a start and breaks ties. Replace the sentence that gives the clef ranges as the only ones and any mention of a "comfortable range" for the lines.
- `docs/roadmap.md`: move "Guide tone ranges per instrument" from Next to Done, one line pointing at the spec.
- The spec: `Status: implemented (branch guide-tone-ranges).` on the date line.

- [ ] **Step 4: Gates**

Run: `make test && make lint && make golden && git status --short fixtures/ && make e2e`
Expected: all green, `fixtures/` unchanged.

- [ ] **Step 5: Commit (do not push)**

```bash
git add web/e2e/changes.spec.ts docs/design.md docs/roadmap.md docs/superpowers/specs/2026-10-10-guide-tone-ranges-design.md
git commit -m "Guide tone ranges: the trumpet and vibes on the sheet; docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
