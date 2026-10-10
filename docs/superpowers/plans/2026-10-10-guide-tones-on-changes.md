# Guide tones on the chord sheet: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two toggles on the Changes sheet, **3rd** and **7th**, both off by default. Turning one on replaces the beat slashes with that guide tone for each chord: one note per chord, voice-led, labelled, and tied across barlines. With both on, the sheet shows two voices on one staff. The separate Guide tones sheet is removed, and a chart now opens on the Changes sheet.

**Architecture:**
- **Engine.**
  - `web/engine/voiceLeading.ts` gains `voiceLeadOne`, a single-line wrapper around the existing pair search.
  - `web/engine/guideTones.ts` gains `guideVoices`. It voice-leads the chords, splits each note at barlines (`notesFor`, now exported with `tiedIn`), and sets accidentals with the measure rule across both voices.
  - `web/engine/changes.ts` calls `guideVoices` once, over the rows as drawn and before the lines are cut. It hangs the results on `ChangesBar.voices` and `ChangesChord.guide`.
- **Drawing.** `web/app/utils/changesDrawing.ts` draws a line that has voices in two passes: format, then raise any ending bracket, then draw. It keeps a ghost-note beat grid so that the HTML chords, numerals and scales still line up with their notes. `ChangesSystem.vue` adds a label row.
- **App.** The toggles go through `usePreferences` → `PreviewControls` → `EditorView` → `ChangesSheet`, and through share links and chart-error reports.
- **Removal and tests.** Task 5 deletes the old sheet. Task 6 rewrites the browser tests and the docs, and brings the spec in line with the two deliberate deviations.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript (strict, `noUncheckedIndexedAccess`), VexFlow 5.0.0, Tailwind with the Catalyst port, Vitest (with `@nuxt/test-utils` and happy-dom), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md`

## Global Constraints

- **Unit tests:** run vitest from `web/` without `--project`: `cd web && npx vitest run <files>`. This runs both the `engine` (node) and `app` (nuxt) projects.
- **Full checks:** run `make test` (typecheck, then vitest), `make lint` and `make e2e` from the repo root.
- **Engine purity:** `web/engine/` imports no Vue or DOM. View logic that can be pure lives in the engine; VexFlow code lives in `web/app/utils/`.
- **Pages:** must run under the hashed CSP (`web/build/csp.ts`): no inline `<script>` of our own, no `eval`, no third-party origins.
- **Dependencies:** no new runtime `dependencies`. CI gates on `npm audit --omit=dev`.
- **Old sheet:** the Guide tones sheet keeps compiling and working through Tasks 1–4, using `LegacyGuideNote` and the `guideTones` flag. Task 5 deletes it.
- **Golden fixture:** `fixtures/golden.json` stays unchanged, because it doesn't cover guide tones or the Changes sheet. No `make golden`.
- **Accidentals in tests:** VexFlow 5 draws no `.vf-accidental` class. Assert accidentals on the engine's `GuideNote.accidental`, or on Bravura code points U+E260–E264 in `.vf-stavenote text`.
- **Staging:** stage files by name, never `git add -A` or a glob. `web/test/` and `web/engine/__tests__/` hold untracked iCloud copies (`* 2.ts`).
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Delivery:** one PR from branch `guide-tones-on-changes`. No feature flag; both toggles start off.
- **Names:** shared names follow the contract exactly. Additions beyond the contract:
  - Task 1: `voiceAccidentals`.
  - Task 3: `DURATIONS`, `REST_KEY`, `INK`, `voltaShift`, `voicedBand`, `beatXs`, `tieDirection`, `guideAria`.
  - Task 4: `firstSheet` and `guidesText`.
  - Task 5 narrows `firstSheet`'s second argument to `{ changes }`.
- **Old links:** spec §4 says an old link with `sheet: 'guideTones'` falls back to Scales. Here the decoder drops the field instead, so the link opens the default view, which is now Changes. The spec also says no links were shared. Task 6 Step 10 updates the spec to match.

## Review Focus

These are the five failures most likely to bite a musician reading the sheet. Each points to the test that pins it.

1. **Wrong accidental between the two voices, or against the key signature.**
   - The risk: a natural or a sharp lost when one voice alters a letter the other voice then plays in the same bar, a tied-in note wrongly re-sharped, or a flat drawn on a B♭ that is already in the signature.
   - Pinned by:
     - Task 1: `applies the measure rule across both voices`, `writes the sharp again on a note struck after the same note was held over the barline`, and the `voiceAccidentals` cases.
     - Task 2: `reads accidentals against the signature when it is drawn, and against C when it is not`.
     - Task 6: `key-signatures.spec`, `guide tones take their accidentals from the signature, and from C without a key:`.
2. **Voices that cross, collide or leap.**
   - The risk: with both on, the upper and lower voices swap or sit a 2nd apart, the lines stop moving by step, or a transposed or bass part leaves its range.
   - Pinned by:
     - Task 1: the library property test `both on, concert/bass: at least 85% of moves are steps; the voices never cross, stay a minor 3rd apart and in range` (which also checks that the two voices never carry the same label), and `writes for the part`.
     - Task 6: the 4-chord-bar collision test and the trumpet/trombone test.
3. **Mislabelled degree, or labels in a different order from the notes.**
   - The risk: a sus chord's 4th, a triad's root, a 6 chord's 6th or a dim7's `bb7` labelled `3`/`7` by mistake, or a label stack that doesn't swap as the voices trade 3rd and 7th.
   - Pinned by:
     - Task 1: `labels the real degree…`, `both on: … labels swapping 7/3 -> 3/7 -> 7/3`, and `ignores a scale it cannot read rather than the chord`.
     - Task 2: `labels each chord with its real degree…`.
     - Task 3: `ChangesSystem` label row, `stacks the labels top to bottom like the notes`.
     - Task 6: label-row assertions in `changes.spec`.
4. **Broken continuity at block and line edges.**
   - The risk: a tie that runs into the next section or a folded repeat, a 2nd ending voiced from the wrong chord, a chord held over a line break that loses its tie, or pitches that change between phone (2 bars a line) and desktop (4 bars a line).
   - Pinned by:
     - Task 2: `voices a folded repeat once`, `voices a 2nd ending from the 1st ending's last chord, in written order` (added here), the library `tie only inside a block…`, and `voice the same at 2 or 4 bars a line…`.
     - Task 6: `a chord held over a line break: an open tie ends line 1, a half-tie starts line 2`, and `each voice's ties curve away from the other's`.
5. **Layout that no longer reads.**
   - The risk: chord symbols no longer over their notes, an ending bracket drawn through the stems, or a printed page that overflows onto an extra sheet.
   - Pinned by:
     - Task 3: `beatXs`, `voltaShift`, `voicedBand`.
     - Task 6: `each chord sits on its note` (2 and 4 bars a line), `the bracket clears the guide tones' stems`, and `print.spec`'s tallest case.

---

### Task 1: Engine: voice-led guide tones per chord

**Files:**
- Modify: `web/engine/voiceLeading.ts`: append after line 111, the end of `voiceLead`.
- Modify: `web/engine/guideTones.ts`: full replacement of lines 1–128.
- Modify: `web/app/utils/guideToneDrawing.ts`: lines 1, 27 and 37. This renames the old note type so the old sheet keeps compiling.
- Modify: `web/engine/__tests__/guideTones.test.ts`: lines 3–5, 11 and 24, then append after line 219.
- Consumed, unchanged:
  - `web/engine/keySignature.ts`: `accidentalsInBar` (:29) and `octaveOf` (:43).
  - `web/engine/guideToneTimeline.ts`: `guideToneTimeline` (:54).
  - `web/engine/chord.ts`: `writtenChordRootLenient` (:91), which falls back to the chord's own root when the scale can't be read.
  - `web/engine/index.ts`: :13–15 already re-export `guideTones`, `guideToneTimeline` and `voiceLeading`. None of the new names clash.

**Interfaces:**
- Consumes:
  - `guideTonesFor(part: Part, chord: string, scale?: string): GuideTones | null`
  - `voiceLead(tones: readonly (GuideTones | null)[], clef: Clef): readonly [(Candidate | null)[], (Candidate | null)[]]`
  - `accidentalsInBar(notes: readonly BarNote[], spec: string | null): (string | null)[]`
  - `octaveOf(p: Pitched): number`
- Produces, in `web/engine/voiceLeading.ts`:
  - `export function voiceLeadOne(tones: readonly (GuideTones | null)[], role: 0 | 1, clef: Clef): (Candidate | null)[]`
- Produces, in `web/engine/guideTones.ts`:
  - `export type GuideShow = Readonly<{ third: boolean; seventh: boolean }>`
  - `export const NO_GUIDES: GuideShow`
  - `export const guidesOn = (s: GuideShow): number`
  - `export type GuideNote = Readonly<{ pitch: Pitched | null; beat: number; beats: 1 | 2 | 3 | 4; tie: boolean; tiedIn: boolean; accidental: string | null }>`
  - `export const guideLabel = (degree: string): string`
  - `export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number }>`
  - `export function notesFor(c: Candidate | null, start: number, length: number, beats: number): { bar: number; note: GuideNote }[]`
  - `export function voiceAccidentals(voices: readonly (readonly GuideNote[])[], keySig: string | null): GuideNote[][]`
  - `export function guideVoices(chords: readonly GuideInput[], part: Part, beats: 2 | 3 | 4, keySig: string | null, show: GuideShow): { bars: ReadonlyMap<number, readonly (readonly GuideNote[])[]>; labels: ReadonlyMap<number, readonly string[]>; missing: readonly string[] }`
  - `export type LegacyGuideNote = Readonly<{ pitch: Pitched | null; beats: 1 | 2 | 3 | 4; tie: boolean; label: string }>`. This is the old `GuideNote`; Task 5 deletes it.
  - Kept until Task 5: `GuideChord`, `GuideBar` (its `lines` are now `LegacyGuideNote[]`), `GuideSystem`, `GuideToneSheet` and `buildGuideTones`.

- [ ] **Step 1: Write the failing tests**

In `web/engine/__tests__/guideTones.test.ts`, replace lines 3–5.

Before:
```ts
import type { Row } from '../chart'
import { expandRows, parseChart } from '../chart'
import { buildGuideTones, guideTonesFor, type GuideNote } from '../guideTones'
```
After:
```ts
import type { ChartDoc, Row } from '../chart'
import { chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import {
  buildGuideTones,
  type GuideInput,
  guideLabel,
  type GuideNote,
  type GuideShow,
  guideTonesFor,
  guideVoices,
  type LegacyGuideNote,
  NO_GUIDES,
  voiceAccidentals,
} from '../guideTones'
```

Replace line 11.

Before:
```ts
import { parseKey } from '../analysis/keys'
```
After:
```ts
import { parseKey } from '../analysis/keys'
import { voiceLeadOne } from '../voiceLeading'
```

Replace line 24, inside `struck`.

Before:
```ts
    return notes.filter((_, j) => !notes[j - 1]?.tie).map((n: GuideNote) => (n.pitch ? toVexKey(n.pitch) : 'rest'))
```
After:
```ts
    return notes.filter((_, j) => !notes[j - 1]?.tie).map((n: LegacyGuideNote) => (n.pitch ? toVexKey(n.pitch) : 'rest'))
```

Append after the last line, 219 (the closing `})` of `describe('guide tone lines', …)`):

```ts

const BOTH: GuideShow = { third: true, seventh: true }
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
/** chord i on row i, one after another, len beats each */
const inTurn = (chords: readonly string[], len = 4): GuideInput[] => chords.map((chord, i) => ({ row: i, chord, start: i * len, beats: len }))
/** a note as "beat:key/beats", then ~ (tie), ^ (tied in) and its accidental */
const noteText = (n: GuideNote): string =>
  `${n.beat}:${n.pitch ? toVexKey(n.pitch) : 'rest'}/${n.beats}${n.tie ? '~' : ''}${n.tiedIn ? '^' : ''}${n.accidental ?? ''}`
/** each bar in order, its voices top to bottom joined by " | " */
const barsText = (g: ReturnType<typeof guideVoices>): string[] =>
  [...g.bars.entries()].sort(([a], [b]) => a - b).map(([, voices]) => voices.map((v) => v.map(noteText).join(' ')).join(' | '))

describe('voiceLeadOne', () => {
  const line = (role: 0 | 1, chords: readonly string[]) =>
    voiceLeadOne(chords.map((c) => guideTonesFor(CONCERT, c)), role, 'treble').map((c) => c && `${toVexKey(c.pitch)} ${c.label} ${c.role}`)

  it('voices one guide tone alone in its smoothest line, which cannot always move by step', () => {
    expect(line(0, ['Dm7', 'G7', 'CMaj7'])).toEqual(['f/4 b3 0', 'b/4 3 0', 'e/5 3 0']) // F -> B -> E: a 4th each way
    expect(line(1, ['Dm7', 'G7', 'CMaj7'])).toEqual(['c/5 b7 1', 'f/4 b7 1', 'b/4 7 1'])
  })

  it('reports the role asked for and labels each note with its own degree, resting where there is none', () => {
    const chords = ['Bdim7', 'C', 'C6', 'Cm7#5#9x', 'G7sus4']
    expect(line(1, chords)).toEqual(['ab/4 bb7 1', 'c/5 1 1', 'a/4 6 1', null, 'f/4 b7 1'])
    expect(line(0, chords)).toEqual(['d/4 b3 0', 'e/4 3 0', 'e/4 3 0', null, 'c/5 4 0'])
  })
})

describe('guideLabel', () => {
  it('drops the flat or sharp from the degree', () => {
    expect(['b3', '3', 'b7', 'bb7', '7', '4', '1', '6', '#11'].map(guideLabel)).toEqual(['3', '3', '7', '7', '7', '4', '1', '6', '11'])
  })
})

describe('guideVoices', () => {
  it('gives nothing, not even a diagnostic, with both toggles off', () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x']), CONCERT, 4, null, NO_GUIDES)
    expect([g.bars.size, g.labels.size, g.missing]).toEqual([0, 0, []])
  })

  it('both on: two voices, upper first, that move by step, their labels swapping 7/3 -> 3/7 -> 7/3', () => {
    const g = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:c/5/4 | 0:f/4/4', '0:b/4/4 | 0:f/4/4', '0:b/4/4 | 0:e/4/4'])
    expect([...g.labels]).toEqual([[0, ['7', '3']], [1, ['3', '7']], [2, ['7', '3']]])
  })

  it('one on: that degree alone, in the nearest octave, correctly labelled', () => {
    const third = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, THIRD)
    expect(barsText(third)).toEqual(['0:f/4/4', '0:b/4/4', '0:e/5/4'])
    expect([...third.labels]).toEqual([[0, ['3']], [1, ['3']], [2, ['3']]])
    const seventh = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, SEVENTH)
    expect(barsText(seventh)).toEqual(['0:c/5/4', '0:f/4/4', '0:b/4/4'])
    expect([...seventh.labels]).toEqual([[0, ['7']], [1, ['7']], [2, ['7']]])
  })

  it('labels the real degree: 6 on a 6 chord, 4 on a sus chord, 1 on a triad, 7 on a dim7', () => {
    const g = guideVoices(inTurn(['C6', 'C7sus4', 'C', 'Bdim7']), CONCERT, 4, null, BOTH)
    expect([...g.labels]).toEqual([[0, ['6', '3']], [1, ['7', '4']], [2, ['1', '3']], [3, ['3', '7']]])
  })

  it('holds a chord across barlines with ties, the carried pieces marked tied in', () => {
    expect(barsText(guideVoices(inTurn(['Dm7'], 8), CONCERT, 4, null, THIRD))).toEqual(['0:f/4/4~', '0:f/4/4^'])
  })

  it('writes a whole bar of 3/4 as a dotted half, tied over the barline in both voices', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Dm7', start: 0, beats: 3 },
      { row: 1, chord: 'G7', start: 3, beats: 6 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 3, null, BOTH))).toEqual(['0:c/5/3 | 0:f/4/3', '0:b/4/3~ | 0:f/4/3~', '0:b/4/3^ | 0:f/4/3^'])
  })

  it('writes accidentals against the key signature, and against C without one', () => {
    const chords = inTurn(['Gm7', 'C7', 'FMaj7'])
    expect(barsText(guideVoices(chords, CONCERT, 4, 'F', BOTH))).toEqual(['0:bb/4/4 | 0:f/4/4', '0:bb/4/4 | 0:e/4/4', '0:a/4/4 | 0:e/4/4'])
    expect(barsText(guideVoices(chords, CONCERT, 4, null, BOTH))).toEqual(['0:bb/4/4b | 0:f/4/4', '0:bb/4/4b | 0:e/4/4', '0:a/4/4 | 0:e/4/4'])
  })

  it("applies the measure rule across both voices: the upper G4 cancels the lower voice's Gb4 earlier in the bar", () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Gb', start: 0, beats: 2 },
      { row: 1, chord: 'Eb', start: 2, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, BOTH))).toEqual(['0:bb/4/2b 2:g/4/2n | 0:gb/4/2b 2:eb/4/2b'])
  })

  it('writes the sharp again on a note struck after the same note was held over the barline', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'D7', start: 0, beats: 6 },
      { row: 1, chord: 'D', start: 6, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, THIRD))).toEqual(['0:f#/4/4~#', '0:f#/4/2^ 2:f#/4/2#'])
  })

  it('rests in every voice on a chord without guide tones, reports it once, and labels nothing there', () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x', 'CMaj7', 'Cm7#5#9x', '???']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:c/5/4 | 0:f/4/4', '0:rest/4 | 0:rest/4', '0:b/4/4 | 0:e/4/4', '0:rest/4 | 0:rest/4', '0:rest/4 | 0:rest/4'])
    expect([...g.labels.keys()]).toEqual([0, 2])
    expect(g.missing).toEqual(['no guide tones for Cm7#5#9x (unknown chord quality)', "no guide tones for ??? (can't read the chord)"])
  })

  it('ignores a scale it cannot read rather than the chord', () => {
    const g = guideVoices([{ row: 0, chord: 'Dm7', scale: 'D Dorain', start: 0, beats: 4 }], CONCERT, 4, null, THIRD)
    expect([[...g.labels], g.missing]).toEqual([[[0, ['3']]], []])
  })

  it('writes for the part: a Bb part a step up, a bass part inside E2-C4', () => {
    expect(barsText(guideVoices(inTurn(['Cm7', 'F7', 'BbMaj7']), TENOR, 4, null, BOTH))).toEqual(['0:c/5/4 | 0:f/4/4', '0:b/4/4 | 0:f/4/4', '0:b/4/4 | 0:e/4/4'])
    const bass = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7', 'C6', 'C7sus4', 'C']), BASS, 4, null, BOTH)
    expect(barsText(bass)).toEqual([
      '0:f/3/4 | 0:c/3/4',
      '0:f/3/4 | 0:b/2/4',
      '0:e/3/4 | 0:b/2/4',
      '0:e/3/4 | 0:a/2/4',
      '0:f/3/4 | 0:bb/2/4b',
      '0:e/3/4 | 0:c/3/4',
    ])
  })
})

describe('voiceAccidentals', () => {
  const at = (beat: number, letter: 0 | 1 | 3, acc: number, midi: number, tiedIn = false): GuideNote => ({
    pitch: { letter, acc, midi },
    beat,
    beats: 2,
    tie: false,
    tiedIn,
    accidental: null,
  })
  const C5 = (beat: number) => at(beat, 0, 0, 72)
  const D4 = (beat: number) => at(beat, 1, 0, 62)
  const accs = (voices: readonly (readonly GuideNote[])[]) => voiceAccidentals(voices, null).map((v) => v.map((n) => n.accidental))

  it('F#4 in the lower voice, then F4 in the upper: a natural', () => {
    expect(accs([[C5(0), at(2, 3, 0, 65)], [at(0, 3, 1, 66), D4(2)]])).toEqual([[null, 'n'], ['#', null]])
  })

  it('a lower note tied in puts nothing in force: the upper voice on its letter and octave writes its sharp', () => {
    expect(accs([[C5(0), at(2, 3, 1, 66)], [at(0, 3, 1, 66, true), D4(2)]])).toEqual([[null, '#'], [null, null]])
  })

  it('leaves rests without an accidental', () => {
    const rest: GuideNote = { pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }
    expect(accs([[rest], [rest]])).toEqual([[null], [null]])
  })
})

describe('guide tone voices over the library', () => {
  const charts = readdirSync('../charts')
    .filter((name) => !isSyncCopy(name))
    .map((name) => ({ name, doc: parseChart(readFileSync(`../charts/${name}`, 'utf8')).value }))
  const inputs = (doc: ChartDoc): GuideInput[] => {
    const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
    return events.map((e, i) => ({ row: i, chord: e.chord, scale: resolveScale(e.row) ?? undefined, start: e.start, beats: e.beats }))
  }
  const RANGE = { treble: [60, 81], bass: [40, 60] } as const

  for (const [name, part] of [['concert', CONCERT], ['bass', BASS]] as const) {
    it(`both on, ${name}: at least 85% of moves are steps; the voices never cross, stay a minor 3rd apart and in range`, () => {
      let moves = 0
      let steps = 0
      const faults: string[] = []
      for (const { name: chart, doc } of charts) {
        const chords = inputs(doc)
        const g = guideVoices(chords, part, chartBeats(doc), null, BOTH)
        if (g.missing.length) faults.push(`${chart}: ${g.missing.join('; ')}`)
        if (g.labels.size !== chords.length) faults.push(`${chart}: ${g.labels.size} of ${chords.length} chords labelled`)
        for (const [row, l] of g.labels) if (l[0] === l[1]) faults.push(`${chart} row ${row}: both voices labelled ${l[0]}`)
        const bars = [...g.bars.entries()].sort(([a], [b]) => a - b)
        for (const [bar, [upper = [], lower = []]] of bars) {
          if (upper.map((n) => n.beat).join() !== lower.map((n) => n.beat).join()) faults.push(`${chart} bar ${bar}: voices out of step`)
          upper.forEach((u, i) => {
            const l = lower[i]
            if (u.pitch && l?.pitch && u.pitch.midi - l.pitch.midi < 3) faults.push(`${chart} bar ${bar}: ${toVexKey(u.pitch)} over ${toVexKey(l.pitch)}`)
          })
          for (const n of [...upper, ...lower])
            if (n.pitch && (n.pitch.midi < RANGE[part.clef][0] || n.pitch.midi > RANGE[part.clef][1])) faults.push(`${chart} bar ${bar}: ${toVexKey(n.pitch)} out of range`)
        }
        for (const v of [0, 1]) {
          const struck = bars.flatMap(([, voices]) => voices[v] ?? []).filter((n) => !n.tiedIn)
          struck.slice(1).forEach((n, j) => {
            const before = struck[j]?.pitch
            if (!n.pitch || !before) return
            moves++
            if (Math.abs(n.pitch.midi - before.midi) <= 2) steps++
          })
        }
      }
      expect(faults).toEqual([])
      expect(steps / moves).toBeGreaterThanOrEqual(0.85)
    })
  }
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web && npx vitest run engine/__tests__/guideTones.test.ts`

Expected: `Tests  20 failed | 17 passed (37)`. Every new test fails with `TypeError: … is not a function`, because `voiceLeadOne`, `guideLabel`, `guideVoices` and `voiceAccidentals` don't exist yet. The 17 existing tests still pass.

- [ ] **Step 3: Add `voiceLeadOne` to `web/engine/voiceLeading.ts`**

Append after line 111 (the closing `}` of `voiceLead`):

```ts

/**
 * one line alone, on the 3rd (role 0) or the 7th (role 1) of every chord, or a rest: the smoothest such line in the
 * part's range. Both roles get the same pitch, so the pair search's line 1 is the smoothest single line.
 */
export function voiceLeadOne(tones: readonly (GuideTones | null)[], role: 0 | 1, clef: Clef): (Candidate | null)[] {
  const pick = (t: GuideTones): GuideTone => (role ? t.seventh : t.third)
  return voiceLead(tones.map((t) => t && { third: pick(t), seventh: pick(t) }), clef)[0]
    .map((c) => c && { ...c, role }) // the pair search alternates roles over identical pitches; report the one asked for
}
```

- [ ] **Step 4: Replace all 128 lines of `web/engine/guideTones.ts` with this content**

```ts
import { type Row, resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull, parseChord, writtenChordRootLenient } from './chord'
import type { Key } from './analysis/keys'
import { guideToneTimeline } from './guideToneTimeline'
import type { Part, Pitched } from './part'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { chunk, orNull } from './util'
import { type Candidate, type GuideTones, voiceLead, voiceLeadOne } from './voiceLeading'

/**
 * Guide tones (docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md): each chord's 3rd and 7th as
 * voices for the Changes sheet, one note a chord, voice-led (both on: two voices that move by step; one on: that
 * degree alone, in the nearest octave), split at barlines, with accidentals by the measure rule across both voices.
 * The old Guide tones sheet (buildGuideTones) stays until the Changes sheet replaces it. No DOM, like sheet.ts. The
 * timeline (guideToneTimeline.ts) and the voice leading (voiceLeading.ts) live in their own modules.
 */

/** canonical quality -> the degrees that stand for its "3rd" and "7th" */
const TONES: Readonly<Record<string, readonly [string, string]>> = {
  maj: ['3', '1'], // a triad has no 7th: its root resolves by step from a V7 (B -> C, F# -> G), its 5th would leap
  m: ['b3', '1'],
  Maj7: ['3', '7'],
  'Maj7#11': ['3', '7'],
  'Maj7#5': ['3', '7'],
  '6': ['3', '6'],
  m7: ['b3', 'b7'],
  m6: ['b3', '6'],
  mMaj7: ['b3', '7'],
  '7': ['3', 'b7'],
  '7sus4': ['4', 'b7'],
  '7sus4b9': ['4', 'b7'],
  '7b9': ['3', 'b7'],
  '7b13': ['3', 'b7'],
  '7b9b13': ['3', 'b7'],
  '7#11': ['3', 'b7'],
  '7alt': ['3', 'b7'],
  m7b5: ['b3', 'b7'],
  dim7: ['b3', 'bb7'],
}

/** the degrees standing for a quality's "3rd" and "7th" (canonical or extended symbol), or null if unknown */
export const guideToneDegrees = (quality: string): readonly [string, string] | null => TONES[baseQuality(quality) ?? ''] ?? null

/**
 * a chord's two guide tones, spelled from its written root; null if the chord or its quality is unknown.
 * Extended symbols count as their base quality (Maj7#11 as Maj7).
 */
export function guideTonesFor(part: Part, chord: string, scale?: string): GuideTones | null {
  try {
    const degrees = TONES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    const [third, seventh] = spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' '))
    if (!third || !seventh) return null
    return { third: { note: third, label: degrees[0] }, seventh: { note: seventh, label: degrees[1] } }
  } catch {
    return null
  }
}

/** which guide tones the Changes sheet shows */
export type GuideShow = Readonly<{ third: boolean; seventh: boolean }>
export const NO_GUIDES: GuideShow = { third: false, seventh: false }
/** how many guide tone voices are shown: 0, 1 or 2 */
export const guidesOn = (s: GuideShow): number => +s.third + +s.seventh

/** one note (or rest) of a guide tone voice, within a bar */
export type GuideNote = Readonly<{
  /** null: a rest */
  pitch: Pitched | null
  /** where it starts in the bar, from 0 */
  beat: number
  beats: 1 | 2 | 3 | 4
  /** tied into this voice's next note (in the next bar, which may be on the next line) */
  tie: boolean
  /** continues the previous note: no accidental, no label */
  tiedIn: boolean
  /** '#', 'b', 'n', '##', 'bb' or null: the measure rule across both voices, against the key signature (none: C) */
  accidental: string | null
}>

/** a degree as the label row prints it: the real degree without its flat or sharp (b3 -> 3, bb7 -> 7) */
export const guideLabel = (degree: string): string => degree.replace(/^[b#]+/, '')

/** a chord to voice: row is the caller's index for its labels; start and beats are in beats from 0 */
export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number }>

/** the Guide tones sheet's note; removed with that sheet */
export type LegacyGuideNote = Readonly<{ pitch: Pitched | null; beats: 1 | 2 | 3 | 4; tie: boolean; label: string }> // tie: into the next note
export type GuideChord = Readonly<{ beat: number; text: string; tokens: readonly ChordToken[] | null }>
export type GuideBar = Readonly<{
  keySig: string | null // the chart's key, written for the part; null: none drawn
  label: string // "A · Bar 9" where a chord starts, else ''
  chords: readonly GuideChord[]
  lines: readonly [readonly LegacyGuideNote[], readonly LegacyGuideNote[]]
}>
export type GuideSystem = Readonly<{ bars: readonly GuideBar[] }>
/** beats: a bar's beats (its time signature over 4) */
export type GuideToneSheet = Readonly<{ systems: readonly GuideSystem[]; diagnostics: readonly string[]; beats: 2 | 3 | 4 }>

/**
 * split [start, start + length) at barlines into notes, tying a held pitch across them (a rest is split untied);
 * accidentals are left for voiceAccidentals
 */
export function notesFor(c: Candidate | null, start: number, length: number, beats: number): { bar: number; note: GuideNote }[] {
  const out: { bar: number; note: GuideNote }[] = []
  const pitch = c?.pitch ?? null
  const end = start + length
  let at = start
  while (at < end) {
    const bar = Math.floor(at / beats)
    const len = Math.min(end, (bar + 1) * beats) - at
    out.push({
      bar,
      note: { pitch, beat: at - bar * beats, beats: len as 1 | 2 | 3 | 4, tie: !!pitch && at + len < end, tiedIn: !!pitch && at > start, accidental: null },
    })
    at += len
  }
  return out
}

/**
 * one bar's voices (upper first) with their accidentals: the measure rule (accidentalsInBar) over both voices
 * merged, by beat and the upper note first, so an accidental in one voice is in force for the other
 */
export function voiceAccidentals(voices: readonly (readonly GuideNote[])[], keySig: string | null): GuideNote[][] {
  const merged = voices
    .flatMap((notes, v) => notes.flatMap((n, i) => (n.pitch ? [{ v, i, n, pitch: n.pitch }] : [])))
    .sort((a, b) => a.n.beat - b.n.beat || a.v - b.v)
  const accs = accidentalsInBar(
    merged.map(({ n, pitch }) => ({ letter: pitch.letter, acc: pitch.acc, octave: octaveOf(pitch), tiedIn: n.tiedIn })),
    keySig,
  )
  const out = voices.map((notes) => [...notes])
  merged.forEach(({ v, i, n }, k) => {
    const voice = out[v]
    if (voice) voice[i] = { ...n, accidental: accs[k] ?? null }
  })
  return out
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/**
 * the guide tone voices for chords in time order: by timeline bar (Math.floor(start / beats)), each bar's voices
 * ([line] with one toggle on, [upper, lower] with both); by row, the labels top to bottom (no entry for a rest);
 * and a diagnostic for each chord without guide tones. Both on: the two lines are voice-led as a pair (each moves by
 * step where it can) and sorted by pitch at every chord; one on: that degree's smoothest line alone. A chord without
 * guide tones rests in every voice. keySig: the signature in force on every line (null: C). Nothing when both are off.
 */
export function guideVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  show: GuideShow,
): { bars: ReadonlyMap<number, readonly (readonly GuideNote[])[]>; labels: ReadonlyMap<number, readonly string[]>; missing: readonly string[] } {
  const bars = new Map<number, GuideNote[][]>()
  const labels = new Map<number, readonly string[]>()
  const missing: string[] = []
  const count = guidesOn(show)
  if (!count) return { bars, labels, missing }
  const tones = chords.map((c) => {
    const t = guideTonesFor(part, c.chord, c.scale)
    if (!t) {
      const why = `no guide tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const lines: (Candidate | null)[][] = []
  if (count === 2) {
    const [one, two] = voiceLead(tones, part.clef)
    const pairs = one.map((a, j) => {
      const b = two[j] ?? null
      return a && b && b.pitch.midi > a.pitch.midi ? [b, a] : [a, b]
    })
    lines.push(
      pairs.map((p) => p[0] ?? null),
      pairs.map((p) => p[1] ?? null),
    )
  } else lines.push(voiceLeadOne(tones, show.third ? 0 : 1, part.clef))
  chords.forEach((c, j) => {
    const here = lines.map((l) => l[j] ?? null)
    const labelled = here.flatMap((h) => (h ? [guideLabel(h.label)] : []))
    if (labelled.length === here.length) labels.set(c.row, labelled)
    here.forEach((h, v) =>
      notesFor(h, c.start, c.beats, beats).forEach(({ bar, note }) => {
        const voices = bars.get(bar) ?? lines.map((): GuideNote[] => [])
        voices[v]?.push(note)
        bars.set(bar, voices)
      }),
    )
  })
  for (const [bar, voices] of bars) bars.set(bar, voiceAccidentals(voices, keySig))
  return { bars, labels, missing }
}

/** both guide tone lines for a chart, in systems of barsPerSystem bars; key: the chart's key for every bar's signature */
export function buildGuideTones(rows: readonly Row[], part: Part, barsPerSystem = 4, beats: 2 | 3 | 4 = 4, key?: Key | null): GuideToneSheet {
  const { events, diagnostics } = guideToneTimeline(rows, beats)
  const missing: string[] = []
  const tones = events.map((e) => {
    const t = guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined)
    if (!t) {
      const why = `no guide tones for ${e.chord || 'an empty chord'} (${readable(e.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const voiced = voiceLead(tones, part.clef)
  const end = events.reduce((m, e) => Math.max(m, e.start + e.beats), 0)
  const barCount = Math.ceil(end / beats)
  // each line's notes, split at barlines once, then grouped by bar
  const byBar = ([0, 1] as const).map((l) => {
    const out: LegacyGuideNote[][] = Array.from({ length: barCount }, () => [])
    events.forEach((e, j) => {
      const c = voiced[l][j] ?? null
      notesFor(c, e.start, e.beats, beats).forEach(({ bar, note }) =>
        out[bar]?.push({ pitch: note.pitch, beats: note.beats, tie: note.tie, label: c?.label ?? '' }),
      )
    })
    return out
  })
  const keySig = key === undefined ? null : keySignature(key, part)
  const bars = Array.from({ length: barCount }, (_, i): GuideBar => {
    const starting = events.filter((e) => Math.floor(e.start / beats) === i)
    const firstRow = starting[0]?.row
    const chords = starting.map(
      (e): GuideChord => ({ beat: e.start - i * beats, text: e.chord, tokens: chordTokensOrNull(part, e.chord, resolveScale(e.row)) }),
    )
    return {
      keySig,
      label: firstRow ? `${firstRow.section} · Bar ${firstRow.bar}` : '',
      chords,
      lines: [byBar[0]?.[i] ?? [], byBar[1]?.[i] ?? []],
    }
  })
  return { systems: chunk(bars, barsPerSystem).map((b) => ({ bars: b })), diagnostics: [...diagnostics, ...missing], beats }
}
```

- [ ] **Step 5: Keep the old sheet's drawing compiling (`web/app/utils/guideToneDrawing.ts`)**

Line 1, before:
```ts
import { accidentalsInBar, accText, type GuideNote, type GuideSystem, octaveOf, toVexKey } from '~~/engine'
```
After:
```ts
import { accidentalsInBar, accText, type GuideSystem, type LegacyGuideNote, octaveOf, toVexKey } from '~~/engine'
```

Line 27, before:
```ts
export function barAccidentals(notes: readonly GuideNote[], tiedIn: (i: number) => boolean, keySig: string | null): (string | null)[] {
```
After:
```ts
export function barAccidentals(notes: readonly LegacyGuideNote[], tiedIn: (i: number) => boolean, keySig: string | null): (string | null)[] {
```

Line 37, before:
```ts
function legacyAccidentals(notes: readonly Readonly<{ pitch: NonNullable<GuideNote['pitch']>; tiedIn: boolean }>[]): (string | null)[] {
```
After:
```ts
function legacyAccidentals(notes: readonly Readonly<{ pitch: NonNullable<LegacyGuideNote['pitch']>; tiedIn: boolean }>[]): (string | null)[] {
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd web && npx vitest run engine/__tests__/guideTones.test.ts engine/__tests__/keySignature.test.ts engine/__tests__/practice.test.ts test/cropBand.test.ts test/GuideToneSheet.test.ts`

Expected: all pass, with `guideTones.test.ts` showing `37 passed`. This was checked on a scratch copy of the engine: the library step ratios are about 0.89 for concert and 0.89 for bass, with 0 crossings, a minimum gap of 3 semitones and 0 missing.

- [ ] **Step 7: Full checks**

Run from the repo root: `make test`, then `make lint`.

Expected: both green. The typecheck covers `nuxt typecheck` (the `guideToneDrawing.ts` rename) and `tsc -p tsconfig.engine.json`.

- [ ] **Step 8: Commit**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add web/engine/voiceLeading.ts web/engine/guideTones.ts web/engine/__tests__/guideTones.test.ts web/app/utils/guideToneDrawing.ts
git commit -F - <<'EOF'
Engine: voice-led guide tone voices per chord for the Changes sheet

voiceLeadOne for a single line, guideVoices (both on: the pair sorted upper
first; one on: that degree alone), notesFor exported with tiedIn, accidentals
by the measure rule across both voices, guideLabel, GuideShow/NO_GUIDES.
The old sheet's note type is LegacyGuideNote until that sheet is removed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

#### Notes
- `guideVoices` behaviour that Task 2 relies on:
  - `labels` has no entry for a row that rests.
  - `bars` has entries only for bars that some chord covers, and each entry has exactly `guidesOn(show)` voices, aligned beat for beat.
  - `chords` must be in time order and must not overlap; gaps are allowed.
  - `keySig: null` means C.
- The new `ignores a scale it cannot read rather than the chord` and the library test's same-label check replace two old-sheet tests that Task 5 deletes (`ignores a scale…` and `keeps the two lines complementary`).
- Risk: the 85% step threshold has about 4 points of headroom. A change to the cost weights in `voiceLeading.ts`, or to the library, could approach it.

---

### Task 2: Engine: the Changes model carries guide tones; share view fields

**Files:**
- Modify: `web/engine/changes.ts`:
  - imports (4–5)
  - header comment (11–15)
  - `ChangesChord` (32–34)
  - `ChangesBar` (36–38)
  - new `changesLinesPerPage` before `buildChanges` (75–77)
  - guide voicing after the blocks loop (158–161)
  - chord field (181)
  - bar fields (189–192)
  - return (219)
- Modify: `web/engine/share.ts`: `ShareView` (20–23) and `shareViewFrom` (94–96).
- Modify: `web/engine/__tests__/changes.test.ts`: header (1–9), with new `describe`s appended after line 120.
- Modify: `web/engine/__tests__/share.test.ts`: a new test inserted after line 50.

**Interfaces:**
- Consumes, from Task 1 (`web/engine/guideTones.ts`):
  - `GuideShow`, `NO_GUIDES`, `guidesOn(s: GuideShow): number`
  - `GuideNote`, `GuideInput`
  - `guideVoices(chords, part, beats, keySig, show)`
- Produces:
  - `ChangesBar.voices: readonly (readonly GuideNote[])[]` (`[]` when no guide is on)
  - `ChangesChord.guide: readonly string[]` (`[]` when no guide is on)
  - `buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false, guides: GuideShow = NO_GUIDES): ChangesSheet`
  - `export function changesLinesPerPage(guides: GuideShow, rows: Readonly<{ numerals: boolean; scales: boolean }>): number`
  - `ShareView.guideThird?: boolean` and `ShareView.guideSeventh?: boolean`

- [ ] **Step 1: Write the failing Changes tests**

Replace lines 1–9 of `web/engine/__tests__/changes.test.ts`.

Before:
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import { CONCERT, type Part } from '../part'

const library = (name: string) => parseChart(readFileSync(`../charts/${name}.txt`, 'utf8')).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const bars = (name: string, part = CONCERT) => buildChanges(library(name), part).lines.flatMap((l) => l.bars)
```
After:
```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { buildChanges, type ChangesSheet, changesLinesPerPage } from '../changes'
import { parseChart } from '../chart'
import { type GuideNote, type GuideShow, guideVoices, NO_GUIDES } from '../guideTones'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { isSyncCopy } from '../util'

// a transparent wrapper, so a test can see what buildChanges hands the voice leading
vi.mock('../guideTones', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guideTones')>()
  return { ...actual, guideVoices: vi.fn(actual.guideVoices) }
})

const library = (name: string) => parseChart(readFileSync(`../charts/${name}.txt`, 'utf8')).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const bars = (name: string, part = CONCERT) => buildChanges(library(name), part).lines.flatMap((l) => l.bars)
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
const BOTH: GuideShow = { third: true, seventh: true }
```

Append to the end of the file, after line 120:
```ts

describe('guide tones on the Changes sheet', () => {
  const sheetOf = (text: string, guides: GuideShow, barsPerLine = 4, signatures = false) =>
    buildChanges(parseChart(text).value, CONCERT, barsPerLine, signatures, guides)
  const barsOf = (text: string, guides: GuideShow) => sheetOf(text, guides).lines.flatMap((l) => l.bars)
  const labels = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars).flatMap((b) => b.chords.map((c) => c.guide))
  const SIXES = 'key: C\nA | 1 | C6\nA | 2 | C7sus4\nA | 3 | C\nA | 4 | Cm7\n'

  it('leaves the sheet as it was with both off: no voices, no labels, and no voice leading run', () => {
    vi.mocked(guideVoices).mockClear()
    const doc = library('autumn_leaves')
    const sheet = buildChanges(doc, CONCERT, 4, false, NO_GUIDES)
    expect(sheet).toEqual(buildChanges(doc, CONCERT))
    const b = sheet.lines.flatMap((l) => l.bars)
    expect(b.every((x) => x.voices.length === 0 && x.chords.every((c) => c.guide.length === 0))).toBe(true)
    expect(guideVoices).not.toHaveBeenCalled()
  })

  it('labels each chord with its real degree, flats and sharps dropped', () => {
    expect(labels(sheetOf(SIXES, THIRD))).toEqual([['3'], ['4'], ['3'], ['3']])
    expect(labels(sheetOf(SIXES, SEVENTH))).toEqual([['6'], ['7'], ['1'], ['7']])
    expect(labels(sheetOf(SIXES, BOTH)).map((l) => [...l].sort())).toEqual([['3', '6'], ['4', '7'], ['1', '3'], ['3', '7']])
  })

  it('strikes one note a chord, held for its length and tied across the barline', () => {
    const b = barsOf('key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n', THIRD) // CMaj7 runs to the end of the 4-bar phrase
    expect(b.map((x) => x.voices.length)).toEqual([1, 1, 1, 1])
    expect(b.map((x) => x.voices[0]?.map((n) => [n.beat, n.beats, n.tie, n.tiedIn]))).toEqual([
      [[0, 4, false, false]],
      [[0, 4, false, false]],
      [[0, 4, true, false]],
      [[0, 4, false, true]],
    ])
    expect(b[3]?.voices[0]?.[0]?.pitch).toEqual(b[2]?.voices[0]?.[0]?.pitch)
    expect(b[3]?.voices[0]?.[0]?.accidental).toBeNull()
  })

  it('rests where a chord has no guide tones, and says so only when a guide is on', () => {
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | CMaj7\n'
    const on = sheetOf(text, BOTH)
    expect(on.lines[0]?.bars[1]?.voices.map((v) => v.map((n) => n.pitch))).toEqual([[null], [null]])
    expect(on.diagnostics.filter((d) => d.startsWith('no guide tones for Cm7#5#9x'))).toHaveLength(1)
    expect(buildChanges(parseChart(text).value, CONCERT).diagnostics.some((d) => d.startsWith('no guide tones'))).toBe(false)
  })

  it('voices a folded repeat once: only the rows drawn, in written order', () => {
    const text = ['key: C', 'A1 | 1 | Dm7', 'A1 | 2 | G7', 'A1 | 3 | CMaj7', 'A1 | 4 | A7', '@copy A1 A2 4', 'B | 9 | Fm7', 'B | 10 | Bb7', 'B | 11 | EbMaj7', 'B | 12 | Ab7'].join('\n') + '\n'
    vi.mocked(guideVoices).mockClear()
    const sheet = sheetOf(text, BOTH)
    expect(sheet.lines.map((l) => l.bars[0]?.marker)).toEqual(['A1 · A2', 'B'])
    expect(guideVoices).toHaveBeenCalledTimes(1)
    const [inputs, , beats, keySig, show] = vi.mocked(guideVoices).mock.calls[0]!
    expect(inputs.map((c) => [c.row, c.chord, c.start, c.beats])).toEqual([
      [0, 'Dm7', 0, 4],
      [1, 'G7', 4, 4],
      [2, 'CMaj7', 8, 4],
      [3, 'A7', 12, 4],
      [8, 'Fm7', 32, 4],
      [9, 'Bb7', 36, 4],
      [10, 'EbMaj7', 40, 4],
      [11, 'Ab7', 44, 4],
    ])
    expect([beats, keySig, show]).toEqual([4, null, BOTH])
    expect(sheet.lines.flatMap((l) => l.bars).every((b) => b.voices.length === 2)).toBe(true)
  })

  it("voices a 2nd ending from the 1st ending's last chord, in written order", () => {
    const text = 'key: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Em7\nA | 4 | A7\nA | 5 | Dm7\nA | 6 | G7\nA | 7 | CMaj7\n@ending 1 A 3 4\n@ending 2 A 5 6\n'
    const b = barsOf(text, BOTH)
    expect(b.map((x) => x.volta?.n ?? 0)).toEqual([0, 0, 1, 1, 2, 2, 0, 0])
    const struck = (i: number) => b[i]?.voices.map((v) => v[0]?.pitch?.midi)
    expect([struck(3), struck(4)]).toEqual([
      [73, 67],
      [72, 65],
    ]) // A7's C#5 over G4, then Dm7's C5 over F4: a step in each voice
  })

  it('reads accidentals against the signature when it is drawn, and against C when it is not', () => {
    const text = 'key: F\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n'
    const struck = (signatures: boolean) =>
      sheetOf(text, BOTH, 4, signatures)
        .lines.flatMap((l) => l.bars)
        .flatMap((b) => b.voices.flat())
        .filter((n): n is GuideNote & { pitch: NonNullable<GuideNote['pitch']> } => !n.tiedIn && n.pitch !== null)
        .map((n) => [rootName(n.pitch), n.accidental] as const)
    expect(struck(false).filter(([name]) => name === 'Bb')).toHaveLength(2) // Gm7's 3rd, C7's 7th
    expect(struck(false).every(([name, acc]) => acc === (name === 'Bb' ? 'b' : null))).toBe(true)
    expect(struck(true).every(([, acc]) => acc === null)).toBe(true)
  })

  it('fits 8 lines a page with no guide, whatever the rows; fewer with guides; one more when both rows are off', () => {
    const rows = [
      { numerals: true, scales: true },
      { numerals: true, scales: false },
      { numerals: false, scales: true },
      { numerals: false, scales: false },
    ]
    expect(rows.map((r) => changesLinesPerPage(NO_GUIDES, r))).toEqual([8, 8, 8, 8])
    expect(rows.map((r) => changesLinesPerPage(THIRD, r))).toEqual([7, 7, 7, 8])
    expect(rows.map((r) => changesLinesPerPage(SEVENTH, r))).toEqual([7, 7, 7, 8])
    expect(rows.map((r) => changesLinesPerPage(BOTH, r))).toEqual([6, 6, 6, 7])
  })
})

describe('guide tones over the library, both on', () => {
  const LIBRARY = new URL('../../../charts/', import.meta.url)
  const docs = readdirSync(LIBRARY)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ f, doc: parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value }))
  const voicesOf = (s: ChangesSheet) => s.lines.flatMap((l) => l.bars.map((b) => b.voices))
  const plain = (s: ChangesSheet) => s.lines.map((l) => l.bars.map(({ voices: _v, ...b }) => ({ ...b, chords: b.chords.map(({ guide: _g, ...c }) => c) })))

  it('strike one note a voice per chord, on its beat, and fill every bar', () => {
    expect(docs.length).toBeGreaterThan(200)
    for (const { f, doc } of docs) {
      const sheet = buildChanges(doc, CONCERT, 4, false, BOTH)
      for (const bar of sheet.lines.flatMap((l) => l.bars)) {
        expect(bar.voices.length, f).toBe(2)
        for (const voice of bar.voices) {
          expect(voice.reduce((s, n) => s + n.beats, 0), f).toBe(sheet.beats)
          expect(voice.filter((n) => !n.tiedIn).map((n) => n.beat), f).toEqual(bar.chords.map((c) => c.beat))
          expect(voice.every((n) => n.pitch !== null), f).toBe(true)
        }
        for (const c of bar.chords) expect(c.guide.length, `${f} ${c.text}`).toBe(2)
      }
      expect(sheet.diagnostics.filter((d) => d.startsWith('no guide tones')), f).toEqual([])
    }
  })

  it('tie only inside a block: a tie lands on a tiedIn piece of the same pitch, and a block starts fresh', () => {
    for (const { f, doc } of docs) {
      const all = buildChanges(doc, CONCERT, 4, false, BOTH).lines.flatMap((l) => l.bars)
      for (const v of [0, 1]) {
        let prev: GuideNote | undefined
        for (const bar of all) {
          if (bar.marker) {
            expect(prev?.tie ?? false, `${f} ${bar.marker}`).toBe(false)
            prev = undefined
          }
          for (const n of bar.voices[v] ?? []) {
            expect(n.tiedIn, f).toBe(prev?.tie ?? false)
            if (n.tiedIn) expect(n.pitch?.midi, f).toBe(prev?.pitch?.midi)
            prev = n
          }
        }
        expect(prev?.tie ?? false, f).toBe(false)
      }
    }
  })

  it('voice the same at 2 or 4 bars a line, and change nothing but voices, labels and diagnostics', () => {
    for (const { f, doc } of docs) {
      const on4 = buildChanges(doc, CONCERT, 4, false, BOTH)
      const on2 = buildChanges(doc, CONCERT, 2, false, BOTH)
      const off = buildChanges(doc, CONCERT)
      expect(voicesOf(on2), f).toEqual(voicesOf(on4))
      expect(plain(on4), f).toEqual(plain(off))
      expect(on4.diagnostics, f).toEqual(off.diagnostics)
    }
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run engine/__tests__/changes.test.ts`

Expected: the 14 existing tests pass. The 11 new ones fail with:
- `TypeError: Cannot read properties of undefined (reading 'length')` (from `x.voices` and `bar.voices`)
- `TypeError: changesLinesPerPage is not a function`
- `expected "spy" to be called 1 times, but got 0 times`
- label `toEqual` mismatches against `[[undefined], …]`

- [ ] **Step 3: Implement the Changes model**

Edit `web/engine/changes.ts`.

Imports, lines 4–5. Before:
```ts
import { guideToneTimeline } from './guideToneTimeline'
import { keySignature } from './keySignature'
```
After:
```ts
import { guideToneTimeline } from './guideToneTimeline'
import { type GuideInput, type GuideNote, type GuideShow, guidesOn, guideVoices, NO_GUIDES } from './guideTones'
import { keySignature } from './keySignature'
```

Header comment, lines 11–15. Before:
```ts
/**
 * The Changes sheet (docs/plan-changes.md): the chart as a study lead sheet. Bars of slashes in the chart's metre,
 * each chord on its beat with its Roman numeral and its scale, a key-area label where the key changes, section
 * markers, and repeat signs for a @copy straight after its source. No DOM, like sheet.ts and guideTones.ts.
 */
```
After:
```ts
/**
 * The Changes sheet (docs/plan-changes.md): the chart as a study lead sheet. Bars of slashes in the chart's metre
 * (or, with a guide tone toggle on, each chord's 3rd and/or 7th as voice-led notes held for the chord's length),
 * each chord on its beat with its Roman numeral and its scale, a key-area label where the key changes, section
 * markers, and repeat signs for a @copy straight after its source. No DOM, like sheet.ts and guideTones.ts.
 */
```

`ChangesChord`, lines 32–34. Before:
```ts
  /** where that key came from: the key before its function's colon, an @key over its area, or the analysis */
  keyFrom: 'found' | 'area' | 'function'
}>
```
After:
```ts
  /** where that key came from: the key before its function's colon, an @key over its area, or the analysis */
  keyFrom: 'found' | 'area' | 'function'
  /** its guide tones' labels, top to bottom ("7", "3"; "4" on a sus chord); [] with no guide on or none found */
  guide: readonly string[]
}>
```

`ChangesBar`, lines 36–38. Before:
```ts
  /** the chart's key signature, written for the part; null when signatures are off or it has no key: */
  keySig: string | null
  chords: readonly ChangesChord[]
```
After:
```ts
  /** the chart's key signature, written for the part; null when signatures are off or it has no key: */
  keySig: string | null
  chords: readonly ChangesChord[]
  /** guide tones written in place of the slashes: [] with no guide on, [line] for one, [upper, lower] for both */
  voices: readonly (readonly GuideNote[])[]
```

The new function and the new signature, lines 75–77. Before:
```ts
}

export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false): ChangesSheet {
```
After:
```ts
}

/**
 * Changes lines on a printed page: 8 with no guide tones (a 32-bar AABA, one section a line pair, with its numerals
 * and scales), whatever rows are shown. Notes, stems and the label row take more height, so with numerals or scales
 * shown it's 7 for one guide and 6 for both, and one more with both rows off. print.spec checks the worst case.
 */
export function changesLinesPerPage(guides: GuideShow, rows: Readonly<{ numerals: boolean; scales: boolean }>): number {
  const on = guidesOn(guides)
  if (!on) return 8
  return (on === 1 ? 7 : 6) + (!rows.numerals && !rows.scales ? 1 : 0)
}

export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false, guides: GuideShow = NO_GUIDES): ChangesSheet {
```

Guide voicing after the blocks loop, lines 158–161. Before:
```ts
    blocks.push(run)
  }

  let lastKey = ''
```
After:
```ts
    blocks.push(run)
  }

  // guide tones, voice-led over the rows as drawn (a folded repeat is drawn once, so it's voiced once), before the
  // lines are cut, so the pitches don't depend on how many bars a line holds
  const drawn = (): GuideInput[] =>
    blocks
      .flatMap((b) => b.rows)
      .flatMap((i): GuideInput[] => {
        const e = eventAt.get(i)
        if (!e) return []
        const scale = resolveScale(e.row)
        return [{ row: i, chord: e.chord, ...(scale ? { scale } : {}), start: e.start, beats: e.beats }]
      })
  const guideLines = guidesOn(guides) ? guideVoices(drawn(), part, beats, keySig, guides) : null

  let lastKey = ''
```

Chord field, lines 181–182. Before:
```ts
            keyFrom: a?.statedKey ? 'function' : analysis.areas.findLast((x) => x.row <= i)?.stated ? 'area' : 'found',
          }
```
After:
```ts
            keyFrom: a?.statedKey ? 'function' : analysis.areas.findLast((x) => x.row <= i)?.stated ? 'area' : 'found',
            guide: guideLines?.labels.get(i) ?? [],
          }
```

Bar fields, lines 189–192. Before:
```ts
      return {
        keySig,
        chords,
        marker: j === 0 ? block.marker : '',
```
After:
```ts
      return {
        keySig,
        chords,
        voices: guideLines?.bars.get(bar) ?? [],
        marker: j === 0 ? block.marker : '',
```

Return, line 219. Before:
```ts
  return { lines: deduped, beats, diagnostics }
```
After:
```ts
  return { lines: deduped, beats, diagnostics: guideLines ? [...diagnostics, ...guideLines.missing] : diagnostics }
```

- [ ] **Step 4: Run the Changes tests and confirm they pass**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run engine/__tests__/changes.test.ts`

Expected: `25 passed`: the 14 existing tests, 8 guide tests and 3 library tests. This was checked on a scratch copy.

- [ ] **Step 5: Write the failing share test**

In `web/engine/__tests__/share.test.ts`, insert a test after line 50, the end of `'keep only the view fields they know, with valid values'`.

Before:
```ts
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { mode: 'root', bogus: true } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it('carry function cells and @key lines unchanged', async () => {
```
After:
```ts
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { mode: 'root', bogus: true } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it("carry the Changes sheet's guide tone toggles, booleans only", async () => {
    const view = { sheet: 'changes', numerals: true, guideThird: true, guideSeventh: false } as const
    expect(await decodeShare(await encodeShare({ chart: CHART, view }))).toEqual({ chart: CHART, view })
    expect(shareViewFrom({ guideThird: 'on', guideSeventh: 1 })).toBeUndefined()
    expect(shareViewFrom({ guideThird: false, guideSeventh: 'yes' })).toEqual({ guideThird: false })
  })

  it('carry function cells and @key lines unchanged', async () => {
```

- [ ] **Step 6: Run the share test and confirm it fails**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run engine/__tests__/share.test.ts`

Expected: "carry the Changes sheet's guide tone toggles…" fails with `AssertionError: expected { chart: …, view: { sheet: 'changes', numerals: true } } to deeply equal { …, guideThird: true, guideSeventh: false }`.

- [ ] **Step 7: Implement the share fields**

Edit `web/engine/share.ts`.

`ShareView`, lines 20–23. Before:
```ts
  /** the Changes sheet's numerals and scale rows */
  numerals?: boolean
  scaleNames?: boolean
  sheet?: ShareSheet
```
After:
```ts
  /** the Changes sheet's numerals and scale rows */
  numerals?: boolean
  scaleNames?: boolean
  /** the Changes sheet's guide tones: each chord's 3rd, its 7th, or both as two voices */
  guideThird?: boolean
  guideSeventh?: boolean
  sheet?: ShareSheet
```

`shareViewFrom`, lines 94–96. Before:
```ts
    ...(typeof o.numerals === 'boolean' ? { numerals: o.numerals } : {}),
    ...(typeof o.scaleNames === 'boolean' ? { scaleNames: o.scaleNames } : {}),
    ...(o.sheet === 'scales' || o.sheet === 'guideTones' || o.sheet === 'changes' ? { sheet: o.sheet } : {}),
```
After:
```ts
    ...(typeof o.numerals === 'boolean' ? { numerals: o.numerals } : {}),
    ...(typeof o.scaleNames === 'boolean' ? { scaleNames: o.scaleNames } : {}),
    ...(typeof o.guideThird === 'boolean' ? { guideThird: o.guideThird } : {}),
    ...(typeof o.guideSeventh === 'boolean' ? { guideSeventh: o.guideSeventh } : {}),
    ...(o.sheet === 'scales' || o.sheet === 'guideTones' || o.sheet === 'changes' ? { sheet: o.sheet } : {}),
```

`'guideTones'` stays in `ShareSheet` until Task 5. After this step the `sheet` line of `shareViewFrom` is line 101.

- [ ] **Step 8: Run both test files and confirm they pass**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run engine/__tests__/changes.test.ts engine/__tests__/share.test.ts`

Expected: all pass.

- [ ] **Step 9: Run the full suite and lint**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint`

Expected: green.
- Typecheck is clean. The app only reads the Changes model, and `ChangesSheet.vue:47` still calls `buildChanges` with 4 arguments.
- eslint allows the `_v`/`_g` rest siblings and the `import()` type annotation. This was checked with eslint `--stdin` against these files.

- [ ] **Step 10: Commit**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add web/engine/changes.ts web/engine/share.ts web/engine/__tests__/changes.test.ts web/engine/__tests__/share.test.ts
git commit -F - <<'EOF'
Changes model: guide tone voices and labels; share view toggles

buildChanges takes the guide toggles and voice-leads the rows as drawn (a folded
repeat once, in written order) before cutting lines, so 2 and 4 bars a line give
the same pitches. Bars carry voices, chords their labels, and missing guide tones
reach the diagnostics only when a guide is on. changesLinesPerPage gives 8 lines
with no guide, fewer with. Share links carry guideThird and guideSeventh.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

#### Notes
- This is the repo's first `vi.mock`. It wraps `guideVoices` in `vi.fn(actual)`, which keeps its behaviour. It is the only way to prove two things that a behavioural test can't tell apart: that a folded copy is voiced once, and that guides off never runs the voice leading.
- `keySig` passed to `guideVoices` is gated by signatures (`null` means C). With signatures off, the B♭s in `key: F` print a flat, and Task 6's key-signatures e2e relies on that.
- The lines-per-page numbers (8, 7/6, +1) are the spec's starting point. If Task 6's `print.spec` worst case fails, lower them here and in this test.
- Edge case: a drawn bar with no timeline events gets `voices: []` even with a guide on, so Task 3 draws slashes there. No library chart has one; the library test proves this.
- Timing: the three library tests stay well inside vitest's 5 s default. 726 `buildChanges` calls over the library take about 185 ms without guides, and the old sheet's library test already runs the same voice leading over the library under the default limit.

---

### Task 3: Drawing: guide-tone notes on the Changes staff

**Files:**
- Modify (full replacement): `web/app/utils/changesDrawing.ts`, lines 1–62, the whole file.
- Modify: `web/app/utils/guideToneDrawing.ts`. Add one import after line 2 and delete lines 9–11 (`DURATIONS`, `REST_KEY`, `INK`, which move to `changesDrawing.ts`). Line 1 belongs to Task 1.
- Modify: `web/app/components/ChangesSystem.vue`:
  - after line 17: the label row
  - line 50: the doc comment
  - line 58: the `clef` comment
  - lines 74–75: `marks`
  - after line 83: a new `guides` computed
- Create: `web/test/changesDrawing.test.ts`
- Create: `web/test/ChangesSystem.test.ts`

**Interfaces:**
- Consumes:
  - From Task 1, via `~~/engine`: `GuideNote`.
  - From `~~/engine`: `Pitched`, `Letter`, and `toVexKey(n: Pitched): string`.
  - From Task 2: `ChangesBar.voices` and `ChangesChord.guide`.
- Produces, in `web/app/utils/changesDrawing.ts`:
  - `export function drawChangesLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Readonly<{ timeSignature: boolean; beats: 2 | 3 | 4; barsPerLine: number; clef?: 'treble' | 'bass' }>): ChangesLayout`. The signature and `ChangesLayout = Readonly<{ xs: readonly (readonly number[])[] }>` are unchanged.
  - `export const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const`
  - `export const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const`
  - `export const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' }`
  - `export function voltaShift(inkTops: readonly number[], bracketBottom: number): number`
  - `export function voicedBand(inks: readonly number[], bracketTop: number | null): Readonly<{ top: number; bottom: number }>`
  - `export function beatXs(heads: ReadonlyMap<number, number>, ghostXs: readonly number[], width: number): number[]`
  - `export const tieDirection = (voices: number, v: number): number | null`
  - `export function guideAria(line: ChangesLine): string`. It returns `''` when no guide is on, otherwise `'; guide tones: C5 7 / F4 3, B4 3 / F4 7 | …'`.
- Produces, in `ChangesSystem.vue`: a label row `[data-slot="guides"]` with `aria-hidden="true"`, shown when any bar has voices. Its height is `h-4 print:h-3` for one voice and `h-7 print:h-5` for two. There is no new prop.
- Relied on by Task 4: `ChangesSheet` passes `clef` whenever a guide is on. Without it, notes are placed in treble and line 1 gets no clef.

- [ ] **Step 1: Write the failing test for the pure drawing helpers**

Create `web/test/changesDrawing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '~~/engine'
import { beatXs, guideAria, tieDirection, voicedBand, voltaShift } from '~/utils/changesDrawing'

const chord = (beat: number, text: string, guide: readonly string[]): ChangesChord => ({
  beat,
  text,
  tokens: null,
  numeral: '',
  scale: null,
  reason: '',
  stated: false,
  heardIn: '',
  keyFrom: 'found',
  guide,
})
const bar = (chords: readonly ChangesChord[], voices: readonly (readonly GuideNote[])[]): ChangesBar => ({
  keySig: null,
  chords,
  marker: '',
  keyArea: '',
  repeatStart: false,
  repeatEnd: 0,
  end: 'none',
  volta: null,
  segno: false,
  coda: false,
  nav: '',
  voices,
})
const note = (letter: Letter, acc: number, midi: number, beat: number, beats: 1 | 2 | 3 | 4, more: Partial<GuideNote> = {}): GuideNote => ({
  pitch: { letter, acc, midi },
  beat,
  beats,
  tie: false,
  tiedIn: false,
  accidental: null,
  ...more,
})
const rest = (beat: number, beats: 1 | 2 | 3 | 4): GuideNote => ({ pitch: null, beat, beats, tie: false, tiedIn: false, accidental: null })

// drawing units: staff lines at y 80-120; an ending bracket's top at 20 (getYForTopText(5)), its foot 1.5 spaces lower, at 35
describe('voltaShift', () => {
  it('leaves the bracket where it is when every note is below it', () => {
    expect(voltaShift([60, 95], 35)).toBe(0)
    expect(voltaShift([], 35)).toBe(0)
  })
  it('raises it so its foot clears the highest stem tip by a margin', () => {
    expect(voltaShift([35, 60], 35)).toBe(-4)
    expect(voltaShift([20, 150], 35)).toBe(-19)
  })
})

describe('voicedBand', () => {
  it('is at least the clef band, as on a line with a clef', () => {
    expect(voicedBand([95, 100], null)).toEqual({ top: 64, bottom: 134 })
  })
  it('grows to stem tips above and below the staff', () => {
    expect(voicedBand([35, 160], null)).toEqual({ top: 11, bottom: 178 })
  })
  it('reaches over a raised ending bracket', () => {
    expect(voicedBand([60, 95], 16)).toEqual({ top: 12, bottom: 134 })
  })
})

describe('beatXs', () => {
  it("puts a beat where a note starts at its head's centre, and the others half a head past their ghost", () => {
    expect(beatXs(new Map([[0, 0.1]]), [100, 160, 220, 280], 1200)).toEqual([0.1, 166 / 1200, 226 / 1200, 286 / 1200])
  })
})

describe('tieDirection', () => {
  it("curves two voices' ties apart, the upper above and the lower below; one voice keeps VexFlow's", () => {
    expect(tieDirection(2, 0)).toBe(-1)
    expect(tieDirection(2, 1)).toBe(1)
    expect(tieDirection(1, 0)).toBeNull()
  })
})

describe('guideAria', () => {
  it('is empty with no guide tone on', () => {
    expect(guideAria({ bars: [bar([chord(0, 'C7', [])], [])] })).toBe('')
  })

  it("names each chord's notes top to bottom with their labels, and a held bar as a dash", () => {
    const line: ChangesLine = {
      bars: [
        bar(
          [chord(0, 'Dm7', ['7', '3']), chord(2, 'G7', ['3', '7'])],
          [
            [note(0, 0, 72, 0, 2), note(6, 0, 71, 2, 2)],
            [note(3, 0, 65, 0, 2), note(3, 0, 65, 2, 2)],
          ],
        ),
        bar([chord(0, 'CMaj7', ['7', '3'])], [[note(6, 0, 71, 0, 4, { tie: true })], [note(2, 0, 64, 0, 4, { tie: true })]]),
        bar([], [[note(6, 0, 71, 0, 4, { tiedIn: true })], [note(2, 0, 64, 0, 4, { tiedIn: true })]]),
      ],
    }
    expect(guideAria(line)).toBe('; guide tones: C5 7 / F4 3, B4 3 / F4 7 | B4 7 / E4 3 | –')
  })

  it('spells accidentals and names a rest', () => {
    const line: ChangesLine = { bars: [bar([chord(0, 'Gm7', ['3']), chord(2, 'Cm7#5#9x', [])], [[note(6, -1, 70, 0, 2), rest(2, 2)]])] }
    expect(guideAria(line)).toBe('; guide tones: Bb4 3, rest')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/changesDrawing.test.ts`

Expected: FAIL. Each test errors with `TypeError: … is not a function`, because `voltaShift`, `voicedBand`, `beatXs`, `tieDirection` and `guideAria` aren't exported yet.

- [ ] **Step 3: Replace `web/app/utils/changesDrawing.ts`**

Replace the whole file (today lines 1–62) with:

```ts
import { type ChangesBar, type ChangesLine, type GuideNote, type Pitched, toVexKey } from '~~/engine'
import { BAR_UNITS, cropBand, fitSvg, headCentre, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

/**
 * Drawing a Changes line (engine/changes.ts) with VexFlow: one stave, one slash a beat, repeat and final barlines,
 * the time signature on the first line. Chords, numerals and scales are HTML placed over and under the slashes.
 * With a clef (key signatures or a guide tone on): the first line (timeSignature) starts with the clef, and with the
 * chart's key signature when a bar carries one; the rest with neither; without, no clef, as before.
 * With guide tones on (bar.voices), each chord's 3rd and/or 7th replace the slashes: one voice, or two with stems up
 * and down, each note held for its chord and tied across barlines and line ends. Drawn in two passes, so a 1st/2nd-
 * ending bracket can be raised over the highest stem tip before anything is drawn.
 */

const VOLTA_Y = 0 // shift for the 1st/2nd-ending bracket, above the staff (at getYForTopText)
const BAND = { top: 74, bottom: 126 } // just the staff (lines at 80-120): slashes sit on the middle line
const VOLTA_BAND = { top: 44, bottom: 126 } // a line with a 1st/2nd-ending bracket needs headroom above the staff
const CLEF_BAND = { top: 64, bottom: 134 } // a line with a clef (key signatures on): room for the clef above and below the staff
const VOLTA_MARGIN = 4 // guide tones: between an ending bracket's foot and the highest stem tip or accidental
const VOLTA_PAD = 4 // guide tones: shown above a bracket's top
const ACCIDENTAL_RISE = 20 // a flat's top over its note head's centre (about two spaces)
const HALF_HEAD = 6 // half a note head's width: a beat with no note starting on it sits where a head would
export const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const // 3 beats: a dotted half
export const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
export const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black

/** per bar, each beat's x (its slash's or note head's centre) as a fraction of the width */
export type ChangesLayout = Readonly<{ xs: readonly (readonly number[])[] }>

type Clef = 'treble' | 'bass'
type Opts = Readonly<{ timeSignature: boolean; beats: 2 | 3 | 4; barsPerLine: number; clef?: Clef }>
type Band = Readonly<{ top: number; bottom: number }>
type Stave = InstanceType<VexFlowModule['Stave']>
type StaveNote = InstanceType<VexFlowModule['StaveNote']>
type GhostNote = InstanceType<VexFlowModule['GhostNote']>
type Voice = InstanceType<VexFlowModule['Voice']>
type Tick = StaveNote | GhostNote

/** how far (0 or less) to raise a line's ending brackets so their foot clears its highest ink by VOLTA_MARGIN */
export function voltaShift(inkTops: readonly number[], bracketBottom: number): number {
  return inkTops.length ? Math.min(0, Math.min(...inkTops) - VOLTA_MARGIN - bracketBottom) : 0
}

/** a guide tone line's crop: its note heads and stem tips, at least the clef's band, and over its bracket (null: none) */
export function voicedBand(inks: readonly number[], bracketTop: number | null): Band {
  const band = cropBand(inks, CLEF_BAND.top, CLEF_BAND.bottom)
  return bracketTop === null ? band : { top: Math.min(band.top, bracketTop - VOLTA_PAD), bottom: band.bottom }
}

/** each beat's x as a fraction of width: the head centre of a note starting on it, else its ghost's x plus half a head */
export function beatXs(heads: ReadonlyMap<number, number>, ghostXs: readonly number[], width: number): number[] {
  return ghostXs.map((g, beat) => heads.get(beat) ?? (g + HALF_HEAD) / width)
}

/** two voices' ties curve apart (VexFlow: -1 above the heads, +1 below); null with one voice: VexFlow's own */
export const tieDirection = (voices: number, v: number): number | null => (voices < 2 ? null : v === 0 ? -1 : 1)

/** "C5", "Bb4": a pitch as a screen reader reads it */
function pitchName(p: Pitched): string {
  const [key = '', octave = ''] = toVexKey(p).split('/')
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}${octave}`
}

/** the aria-label's guide tones: each chord's notes top to bottom with their labels, "–" for a held bar; '' when off */
export function guideAria(line: ChangesLine): string {
  if (!line.bars.some((b) => b.voices.length)) return ''
  const bars = line.bars.map((bar) => {
    const chords = bar.chords.map((c) =>
      bar.voices
        .map((notes, v) => {
          const n = notes.find((x) => x.beat === c.beat && !x.tiedIn)
          return `${n?.pitch ? pitchName(n.pitch) : 'rest'} ${c.guide[v] ?? ''}`.trim()
        })
        .join(' / '),
    )
    return chords.join(', ') || '–'
  })
  return `; guide tones: ${bars.join(' | ')}`
}

const barsLabel = (line: ChangesLine): string => `Bars: ${line.bars.map((b) => b.chords.map((c) => c.text).join(' ') || '–').join(' | ')}`

/** the clef the first line starts with, its lead (clef, key and time signatures) and the bar width, so bars line up */
function geometry(vf: VexFlowModule, line: ChangesLine, opts: Opts): Readonly<{ clef: Clef | undefined; lead: number; total: number; barWidth: number }> {
  const clef = opts.timeSignature ? opts.clef : undefined // with signatures, the clef and key signature start the first line only
  const lead = (clef ? signatureLead(vf, clef, line.bars[0]?.keySig ?? null) : 0) + (opts.timeSignature ? TIME_SPACE : 0)
  const total = BAR_UNITS * opts.barsPerLine
  return { clef, lead, total, barWidth: (total - 1 - lead) / opts.barsPerLine }
}

/** a bar's stave with its signatures (first bar only) and barlines; its bracket comes from setVolta */
function staveFor(vf: VexFlowModule, bar: ChangesBar, first: boolean, x: number, width: number, clef: Clef | undefined, opts: Opts): Stave {
  const stave = new vf.Stave(x, STAVE_Y, width)
  if (first && clef) stave.addClef(clef)
  if (first && clef && bar.keySig) stave.addKeySignature(bar.keySig)
  if (first && opts.timeSignature) stave.addTimeSignature(`${opts.beats}/4`)
  if (bar.repeatStart) stave.setBegBarType(vf.BarlineType.REPEAT_BEGIN)
  if (bar.repeatEnd) stave.setEndBarType(vf.BarlineType.REPEAT_END)
  else if (bar.end === 'final') stave.setEndBarType(vf.BarlineType.END)
  else if (bar.end === 'double') stave.setEndBarType(vf.BarlineType.DOUBLE)
  return stave
}

function setVolta(vf: VexFlowModule, stave: Stave, bar: ChangesBar, y: number): void {
  const v = bar.volta
  if (!v) return
  const t = v.start && v.end ? vf.Volta.type.BEGIN_END : v.start ? vf.Volta.type.BEGIN : v.end ? vf.Volta.type.END : vf.Volta.type.MID
  stave.setVoltaType(t, v.start ? `${v.n}.` : '', y)
}

function slashes(vf: VexFlowModule, beats: number): StaveNote[] {
  return Array.from({ length: beats }, () => {
    const note = new vf.StaveNote({ keys: ['b/4'], duration: 'q', type: 's', autoStem: false })
    note.setStemStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' }) // slashes without stems
    return note
  })
}

const voiceOf = (vf: VexFlowModule, beats: number, ticks: readonly Tick[]): Voice =>
  new vf.Voice({ numBeats: beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables([...ticks])

/** room for the notes after the stave's modifiers */
const room = (stave: Stave, x: number, width: number): number => width - (stave.getNoteStartX() - x) - 20

/**
 * a guide tone (or rest) for voice v of count: stems up then down with two voices, VexFlow's choice with one.
 * With two, a rest is written once, in the upper voice; the lower holds a ghost of the same length.
 */
function tickFor(vf: VexFlowModule, n: GuideNote, v: number, count: number, clef: Clef): Tick {
  const duration = DURATIONS[n.beats]
  const dotted = (note: StaveNote): StaveNote => {
    if (n.beats === 3) vf.Dot.buildAndAttach([note], { all: true })
    return note
  }
  if (!n.pitch) return v > 0 ? new vf.GhostNote(duration) : dotted(new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${duration}r`, clef }))
  const stem = count > 1 ? { stemDirection: v === 0 ? 1 : -1 } : { autoStem: true }
  const note = dotted(new vf.StaveNote({ keys: [toVexKey(n.pitch)], duration, clef, ...stem }))
  note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
  if (n.accidental) note.addModifier(new vf.Accidental(n.accidental), 0)
  return note
}

export function drawChangesLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  if (line.bars.some((b) => b.voices.length)) return drawGuideLine(vf, el, line, opts)
  const { clef, lead, total, barWidth } = geometry(vf, line, opts)
  const ctx = svgContext(vf, el, total)
  const xs: number[][] = []
  let x = 0
  line.bars.forEach((bar, b) => {
    const width = b === 0 ? barWidth + lead : barWidth
    const stave = staveFor(vf, bar, b === 0, x, width, clef, opts)
    setVolta(vf, stave, bar, VOLTA_Y)
    stave.setContext(ctx).draw()
    const notes = slashes(vf, opts.beats)
    const voice = voiceOf(vf, opts.beats, notes)
    new vf.Formatter().joinVoices([voice]).format([voice], room(stave, x, width))
    voice.draw(ctx, stave)
    xs.push(notes.map((n) => headCentre(n, total)))
    x += width
  })
  const plain = clef ? CLEF_BAND : BAND
  const band = line.bars.some((b) => b.volta) ? { top: VOLTA_BAND.top, bottom: plain.bottom } : plain
  fitSvg(el, band, total, barsLabel(line))
  return { xs }
}

type Laid = Readonly<{
  bar: ChangesBar
  stave: Stave
  /** per voice, top first: the model's notes and their tickables */
  voices: readonly Readonly<{ model: readonly GuideNote[]; ticks: readonly Tick[] }>[]
  grid: readonly GhostNote[] // a ghost a beat, formatted with the notes: where each beat falls
  plain: readonly StaveNote[] // slashes, for a bar without guide tones
  all: readonly Voice[]
}>

/** a line with guide tones: lay out every bar, place the brackets over the stem tips, then draw */
function drawGuideLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const { clef, lead, total, barWidth } = geometry(vf, line, opts)
  const noteClef: Clef = opts.clef ?? 'treble'
  const count = Math.max(0, ...line.bars.map((b) => b.voices.length))
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): Laid => {
    const width = b === 0 ? barWidth + lead : barWidth
    const stave = staveFor(vf, bar, b === 0, x, width, clef, opts)
    const voices = bar.voices.map((model, v) => ({ model, ticks: model.map((n) => tickFor(vf, n, v, count, noteClef)) }))
    const grid = voices.length ? Array.from({ length: opts.beats }, () => new vf.GhostNote('q')) : []
    const plain = voices.length ? [] : slashes(vf, opts.beats)
    const lists: readonly (readonly Tick[])[] = voices.length ? [...voices.map((v) => v.ticks), grid] : [plain]
    const all = lists.map((ticks) => {
      ticks.forEach((t) => t.setStave(stave))
      return voiceOf(vf, opts.beats, ticks)
    })
    new vf.Formatter().joinVoices(all).format(all, room(stave, x, width))
    x += width
    return { bar, stave, voices, grid, plain, all }
  })

  // pass 2: raise the brackets over the highest stem tip or accidental, level across the line; draw staves, then notes
  const pitched = laid.flatMap((l) => l.voices.flatMap((v) => v.ticks)).filter((t): t is StaveNote => t instanceof vf.StaveNote && !t.isRest())
  const heads = pitched.flatMap((n) => n.getYs())
  const tips = pitched.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY)
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const shift = first && bracket !== null ? voltaShift([...tips, ...heads.map((y) => y - ACCIDENTAL_RISE)], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))

  // ties, one chain a voice across the line: open at its end, and a half-tie in where the line starts tied
  for (let v = 0; v < count; v++) {
    const chain = laid.flatMap((l) => {
      const voice = l.voices[v]
      return voice ? voice.model.map((m, i) => ({ m, t: voice.ticks[i] ?? null })) : []
    })
    const direction = tieDirection(count, v)
    const tie = (firstNote: Tick | null, lastNote: Tick | null): void => {
      const t = new vf.StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] })
      if (direction !== null) t.setDirection(direction)
      t.setContext(ctx).draw()
    }
    chain.forEach(({ m, t }, i) => {
      if (!m.pitch || !t) return
      if (i === 0 && m.tiedIn) tie(null, t)
      if (m.tie) tie(t, chain[i + 1]?.t ?? null)
    })
  }

  const xs = laid.map((l) => {
    const top = l.voices[0]
    if (!top) return l.plain.map((n) => headCentre(n, total))
    const starts = new Map<number, number>()
    top.model.forEach((m, i) => {
      const t = top.ticks[i]
      if (t instanceof vf.StaveNote) starts.set(m.beat, headCentre(t, total))
    })
    return beatXs(starts, l.grid.map((g) => g.getAbsoluteX()), total)
  })
  fitSvg(el, voicedBand([...heads, ...tips], bracket === null ? null : bracket + shift), total, barsLabel(line) + guideAria(line))
  return { xs }
}
```

- [ ] **Step 4: Move the shared constants out of the old guide-tone drawing (kept until Task 5)**

In `web/app/utils/guideToneDrawing.ts`, add an import after line 2.

Before (line 2):
```ts
import { BAR_UNITS, CLEF_SPACE, cropBand, fitSvg, headCentre, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'
```
After:
```ts
import { BAR_UNITS, CLEF_SPACE, cropBand, fitSvg, headCentre, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'
import { DURATIONS, INK, REST_KEY } from './changesDrawing'
```

Then delete the three constants that were at lines 9–11.

Before:
```ts
const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const // 3 beats: a dotted half
const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black
// guide tones sit near the middle of the staff, so their minimum band is just the clef: 8 systems fit a letter page
```
After:
```ts
// guide tones sit near the middle of the staff, so their minimum band is just the clef: 8 systems fit a letter page
```

- [ ] **Step 5: Run the helper tests again and watch them pass**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/changesDrawing.test.ts test/cropBand.test.ts test/GuideToneSheet.test.ts`

Expected: PASS. All 11 tests in `changesDrawing.test.ts` pass, and the old sheet's tests still pass.

- [ ] **Step 6: Write the failing test for the label row**

Create `web/test/ChangesSystem.test.ts`:

```ts
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import ChangesSystem from '~/components/ChangesSystem.vue'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '~~/engine'

vi.mock('~/utils/changesDrawing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/changesDrawing')>()),
  drawChangesLine: () => ({ xs: [[0.1, 0.3, 0.5, 0.7]] }),
}))
mockNuxtImport('loadVexFlow', () => () => Promise.resolve({}))

const chord = (beat: number, text: string, guide: readonly string[]): ChangesChord => ({
  beat,
  text,
  tokens: null,
  numeral: '',
  scale: null,
  reason: '',
  stated: false,
  heardIn: '',
  keyFrom: 'found',
  guide,
})
const bar = (chords: readonly ChangesChord[], voices: readonly (readonly GuideNote[])[]): ChangesBar => ({
  keySig: null,
  chords,
  marker: '',
  keyArea: '',
  repeatStart: false,
  repeatEnd: 0,
  end: 'none',
  volta: null,
  segno: false,
  coda: false,
  nav: '',
  voices,
})
const note = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 2, tie: false, tiedIn: false, accidental: null })
const mount = (line: ChangesLine) =>
  mountSuspended(ChangesSystem, { props: { line, first: true, beats: 4 as const, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const } })
const labelsOf = (el: Element): string[][] => [...el.children].map((m) => [...m.children].map((s) => s.textContent ?? ''))

describe('ChangesSystem guide tone labels', () => {
  it('has no label row with no guide tone on', async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', [])], [])] })
    expect(w.find('[data-slot="guides"]').exists()).toBe(false)
  })

  it("with one guide on, labels each chord under the staff at its x, hidden from screen readers (the SVG's label reads them)", async () => {
    const w = await mount({ bars: [bar([chord(0, 'C7', ['3']), chord(2, 'F7sus4', ['4'])], [[note(2, 64, 0), note(6, 70, 2)]])] })
    const row = w.find('[data-slot="guides"]')
    expect(row.attributes('aria-hidden')).toBe('true')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-4', 'print:h-3']))
    expect(labelsOf(row.element)).toEqual([['3'], ['4']])
    await vi.waitFor(() => expect(parseFloat((row.element.children[1] as HTMLElement).style.left)).toBeCloseTo(48.8))
  })

  it('with both on, stacks the labels top to bottom like the notes, in a taller row', async () => {
    const w = await mount({
      bars: [
        bar(
          [chord(0, 'Dm7', ['7', '3']), chord(2, 'G7', ['3', '7'])],
          [
            [note(0, 72, 0), note(6, 71, 2)],
            [note(3, 65, 0), note(3, 65, 2)],
          ],
        ),
      ],
    })
    const row = w.find('[data-slot="guides"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['h-7', 'print:h-5']))
    expect(labelsOf(row.element)).toEqual([
      ['7', '3'],
      ['3', '7'],
    ])
  })
})
```

- [ ] **Step 7: Run it and watch it fail**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/ChangesSystem.test.ts`

Expected: FAIL. The first test passes. The other two fail because `[data-slot="guides"]` doesn't exist yet: `row.attributes('aria-hidden')` is `undefined`, or `find` returns an empty wrapper.

- [ ] **Step 8: Add the label row to `web/app/components/ChangesSystem.vue`**

Edit 1 (template, line 17). Before:
```html
    <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
    <!-- the analysis under each chord: its numeral, then its scale -->
```
After:
```html
    <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
    <!-- with guide tones on: each chord's labels (3, 7; 4 on a sus chord, 1 on a triad, 6 on a 6 chord), top to bottom like its notes -->
    <div v-if="guides" data-slot="guides" aria-hidden="true" :class="['relative', guides > 1 ? 'h-7 print:h-5' : 'h-4 print:h-3']">
      <span
        v-for="m in marks"
        :key="`g${m.key}`"
        class="absolute flex flex-col text-xs/3.5 font-medium text-zinc-600 tabular-nums dark:text-zinc-400 print:text-[0.6rem]/2.5 print:text-black"
        :style="{ left: `${m.x * 100}%` }"
      >
        <span v-for="(g, i) in m.guide" :key="i">{{ g }}</span>
      </span>
    </div>
    <!-- the analysis under each chord: its numeral, then its scale -->
```

Edit 2 (line 50). Before:
```ts
/** one line of the Changes sheet: slashes, the chords over them and the analysis under them */
```
After:
```ts
/** one line of the Changes sheet: slashes (or guide tones), the chords over them, guide tone labels and the analysis under them */
```

Edit 3 (line 58). Before:
```ts
  clef?: 'treble' | 'bass' // with key signatures: the part's clef, drawn with the signature on the first line only
```
After:
```ts
  clef?: 'treble' | 'bass' // with key signatures or a guide tone on: the part's clef, drawn (with any signature) on the first line only
```

Edit 4 (line 74, the chord marks: replace this substring). Before:
```ts
keyFrom: c.keyFrom, marker: k === 0 ? bar.marker : ''
```
After:
```ts
keyFrom: c.keyFrom, guide: c.guide, marker: k === 0 ? bar.marker : ''
```

Edit 5 (line 75, a marker with no chord: replace this substring). Before:
```ts
keyFrom: 'found' as const, marker: bar.marker
```
After:
```ts
keyFrom: 'found' as const, guide: [] as readonly string[], marker: bar.marker
```

Edit 6 (after line 83, the end of `repeats`). Before:
```ts
const repeats = computed(() =>
  props.line.bars.flatMap((bar, b) => (bar.repeatEnd > 2 ? [{ key: b, x: Math.min(1, (xs.value[b]?.at(-1) ?? 1) + 0.03), times: bar.repeatEnd }] : [])),
)
```
After:
```ts
const repeats = computed(() =>
  props.line.bars.flatMap((bar, b) => (bar.repeatEnd > 2 ? [{ key: b, x: Math.min(1, (xs.value[b]?.at(-1) ?? 1) + 0.03), times: bar.repeatEnd }] : [])),
)
/** how many guide tone voices the line draws (0: none on, slashes), for its label row's height */
const guides = computed(() => Math.max(0, ...props.line.bars.map((b) => b.voices.length)))
```

- [ ] **Step 9: Run the component and helper tests and watch them pass**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/ChangesSystem.test.ts test/changesDrawing.test.ts test/ChangesSheet.test.ts`

Expected: PASS, 3 + 11 + 3 tests.

- [ ] **Step 10: Run the full suite and the linter**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint`

Expected: both exit 0. Slash-only lines go through the same calls as before (`staveFor`/`setVolta`/`slashes` are a straight refactor), so the existing Changes e2e is unaffected. Task 6 covers the notes path in the browser, including the tie chain and its half-ties across a line break.

- [ ] **Step 11: Commit**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add web/app/utils/changesDrawing.ts web/app/utils/guideToneDrawing.ts web/app/components/ChangesSystem.vue web/test/changesDrawing.test.ts web/test/ChangesSystem.test.ts
git commit -F - <<'EOF'
Changes: draw guide tones as notes on the chord staff

When a bar has guide tone voices, they replace the slashes: one voice, or two
with stems up and down. Each note is held for its chord and tied across
barlines and line ends (half-ties in and out), and rests are written once.
Ghost notes give the beat grid, so chords sit over their noteheads. Ending
brackets are raised over the highest stem tip, the crop takes in the stem
tips, the aria-label gets a guide tones suffix, and a label row sits under
the staff.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

#### Notes
- **Two deviations from spec §3, both deliberate (Task 6 Step 10 updates the spec to match):**
  - A guide-tone line crops to the bracket's measured top, `getYForTopText(numLines) + shift - VOLTA_PAD`, rather than `VOLTA_BAND.top + shift`. The spec's band would clip the bracket.
  - `voltaShift` also counts note heads minus `ACCIDENTAL_RISE`, because whole notes have no stem and a flat rises above its head.
- **Pre-existing issue, left alone per spec ("slash path untouched"):** on slash lines, `VOLTA_BAND.top = 44` crops VexFlow's bracket, which is drawn at y 20–35. The existing e2e still passes, because Playwright ignores SVG viewBox clipping. Fixing it (top ≈ 14) would make Stardust and It's You or No One taller and change their `print.spec` counts. That needs its own decision.
- **Lines get taller with guides on:** a two-voice treble line can crop to a bottom near 178, against 134 for slashes. This is why `changesLinesPerPage` exists; Task 6's `print.spec` checks the tallest case.
- **Dark mode:** ledger lines keep VexFlow's default `#444`, as on the scale sheets. The "no black" dark-mode e2e still passes.
- **Half-ties:** VexFlow 5 starts a half-tie in at `stave.getTieStartX()` (the note start x), at least `stave.padding` (12 units) before the first notehead, and starts a tie out at the note's `getTieRightX()`, after its head. Task 6's line-break test reads those x positions.

---

### Task 4: App: 3rd and 7th toggles, wiring, Changes as the default sheet

**Files:**
- Modify: `web/app/composables/usePreferences.ts` (whole file, lines 1–42)
- Modify: `web/app/utils/sheets.ts` (whole file, lines 1–8)
- Modify: `web/app/utils/chartReport.ts` (whole file, lines 1–20)
- Modify: `web/app/components/ChangesSheet.vue` (whole file, lines 1–55)
- Modify: `web/app/components/PreviewControls.vue` (template lines 38–41; script lines 86–87)
- Modify: `web/app/components/EditorView.vue` (lines 87–88, 134–137, 173, 178, 196, 212–213, 222–225, 327–329, 392)
- Create: `web/test/sheets.test.ts`
- Modify: `web/test/usePreferences.test.ts` (whole file, lines 1–57)
- Modify: `web/test/chartReport.test.ts` (whole file, lines 1–12)
- Modify: `web/test/ChangesSheet.test.ts` (whole file, lines 1–34)
- Modify: `web/test/EditorView.test.ts` (whole file, lines 1–174)

**Interfaces:**
- Consumes:
  - Task 1: `GuideShow`, `NO_GUIDES`, `guidesOn`.
  - Task 2: the 5-parameter `buildChanges`, `changesLinesPerPage`, `ChangesBar.voices`, `ChangesChord.guide`, and `ShareView.guideThird` / `ShareView.guideSeventh`.
  - Task 3: the `ChangesSystem` label row, which needs no new prop.
  - Existing: `encodeShare` and `decodeShare`.
- Produces:
  - `usePreferences()` and `linkPreferences(view)` return `guideThird: Ref<boolean>` (key `csm-guide-3rd`) and `guideSeventh: Ref<boolean>` (key `csm-guide-7th`). Both default to `false` and are stored as `'on'`/`'off'`.
  - `web/app/utils/sheets.ts`: `export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ guideTones: boolean; changes: boolean }>): SheetKind`. Task 5 narrows `on` to `{ changes: boolean }`.
  - `web/app/utils/chartReport.ts`: `ChartReport` gains `guides: string`, plus `export const guidesText = (g: GuideShow): string`, which returns `''`, `'3rd'`, `'7th'` or `'3rd,7th'`.
  - `PreviewControls`: `v-model:guide-third` and `v-model:guide-seventh`, both `boolean` defaulting to `false`.
  - `ChangesSheet`: an optional prop `guides?: GuideShow`, defaulting to `NO_GUIDES`.

- [ ] **Step 1: Write the failing tests**

Create `web/test/sheets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { firstSheet } from '~/utils/sheets'

const ALL = { guideTones: true, changes: true } as const

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined, ALL)).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'guideTones', 'changes'] as const) expect(firstSheet(s, ALL)).toBe(s)
  })

  it('falls back to Scales without the Changes sheet', () => {
    const noChanges = { guideTones: true, changes: false }
    expect(firstSheet(undefined, noChanges)).toBe('scales')
    expect(firstSheet('changes', noChanges)).toBe('scales')
  })

  it('opens a Guide Tones link on Changes when that sheet is off', () => {
    expect(firstSheet('guideTones', { guideTones: false, changes: true })).toBe('changes')
  })
})
```

Replace `web/test/usePreferences.test.ts` with:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { linkPreferences, usePreferences } from '~/composables/usePreferences'
import type { ShareView } from '~~/engine'

function prefs() {
  const scope = effectScope()
  const p = scope.run(() => usePreferences())
  if (!p) throw new Error('no preferences')
  return p
}

function linked(view: ShareView) {
  const scope = effectScope()
  const p = scope.run(() => linkPreferences(view))
  if (!p) throw new Error('no preferences')
  return p
}

describe('usePreferences', () => {
  afterEach(() => localStorage.clear())

  it('defaults to concert pitch starting on C, with interval labels on', () => {
    const p = prefs()
    expect([p.instrument.value, p.start.value, p.intervals.value]).toEqual(['concert', 'C', true])
  })

  it('keeps interval labels off once turned off', async () => {
    prefs().intervals.value = false
    await nextTick()
    expect(prefs().intervals.value).toBe(false)
  })

  it('shows the text editor until hidden, and remembers', async () => {
    const p = prefs()
    expect(p.textPane.value).toBe(true)
    p.textPane.value = false
    await nextTick()
    expect(prefs().textPane.value).toBe(false)
  })

  it('keeps the grid notes hidden until shown, and remembers', async () => {
    const p = prefs()
    expect(p.notes.value).toBe(false)
    p.notes.value = true
    await nextTick()
    expect(prefs().notes.value).toBe(true)
  })

  it('keeps the guide tones off until turned on, and remembers each', async () => {
    const p = prefs()
    expect([p.guideThird.value, p.guideSeventh.value]).toEqual([false, false])
    p.guideThird.value = true
    await nextTick()
    expect([localStorage.getItem('csm-guide-3rd'), localStorage.getItem('csm-guide-7th')]).toEqual(['on', null])
    const again = prefs()
    expect([again.guideThird.value, again.guideSeventh.value]).toEqual([true, false])
    again.guideThird.value = false
    await nextTick()
    expect(localStorage.getItem('csm-guide-3rd')).toBe('off')
  })

  it('remembers choices in this browser', async () => {
    const p = prefs()
    p.instrument.value = 'alto-sax'
    p.start.value = 'Eb'
    await nextTick()
    const again = prefs()
    expect([again.instrument.value, again.start.value]).toEqual(['alto-sax', 'Eb'])
  })

  it('ignores stored values it does not recognise', () => {
    localStorage.setItem('csm-instrument', 'kazoo')
    localStorage.setItem('csm-start', 'H')
    localStorage.setItem('csm-guide-3rd', 'yes')
    const p = prefs()
    expect([p.instrument.value, p.start.value, p.guideThird.value]).toEqual(['concert', 'C', false])
  })
})

describe('linkPreferences', () => {
  afterEach(() => localStorage.clear())

  it("takes a link's guide tones over your own, for this visit only", async () => {
    localStorage.setItem('csm-guide-7th', 'on')
    const p = linked({ guideThird: true })
    expect([p.guideThird.value, p.guideSeventh.value]).toEqual([true, true])
    p.guideThird.value = false
    await nextTick()
    expect(localStorage.getItem('csm-guide-3rd')).toBeNull()
  })
})
```

Replace `web/test/chartReport.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { buildChartReport, type ChartReport, guidesText } from '~/utils/chartReport'
import { NO_GUIDES } from '~~/engine'

const REPORT: ChartReport = { chart: 'key: C\nA | 1 | Dm7\n', slug: 'x', title: 'X', version: 'v1', instrument: 'Tenor Sax', sheet: 'Scales', guides: '', level: 'Standard', url: 'http://x/song?chart=x' }

describe('buildChartReport', () => {
  it('puts a prompt line, a debug block, then the chart text', () => {
    const msg = buildChartReport(REPORT)
    expect(msg).toMatch(/^What looks wrong/) // prompt first
    expect(msg).toContain('version: v1')
    expect(msg).toContain('instrument: Tenor Sax')
    expect(msg).toContain('key: C\nA | 1 | Dm7') // chart text included
  })

  it('says which guide tones were shown, after the sheet', () => {
    expect(buildChartReport({ ...REPORT, sheet: 'changes', guides: '3rd,7th' })).toContain('sheet: changes\nguides: 3rd,7th\n')
    expect(buildChartReport(REPORT)).toMatch(/^guides: $/m)
  })
})

describe('guidesText', () => {
  it('names the guide tones shown', () => {
    expect(guidesText(NO_GUIDES)).toBe('')
    expect(guidesText({ third: true, seventh: false })).toBe('3rd')
    expect(guidesText({ third: false, seventh: true })).toBe('7th')
    expect(guidesText({ third: true, seventh: true })).toBe('3rd,7th')
  })
})
```

Replace `web/test/ChangesSheet.test.ts` with:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesSheet from '~/components/ChangesSheet.vue'
import { changesLinesPerPage, type ChartDoc, type GuideShow, NO_GUIDES, parseChart } from '~~/engine'

const doc = parseChart('title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n').value
// 64 bars: more lines than any page holds, at 2 or 4 bars a line
const long = parseChart(`title: L\nkey: C\n${Array.from({ length: 64 }, (_, i) => `A | ${i + 1} | ${['Dm7', 'G7', 'CMaj7', 'A7'][i % 4]}`).join('\n')}\n`).value
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
const BOTH: GuideShow = { third: true, seventh: true }

const mountSheet = (over: Readonly<{ doc?: ChartDoc; signatures?: boolean; guides?: GuideShow; numerals?: boolean; scales?: boolean }> = {}) =>
  mountSuspended(ChangesSheet, {
    props: { doc, title: 'T', subtitle: '', part: { clef: 'bass', trans: 'C' }, instrumentLabel: '', numerals: false, scales: false, ...over },
    global: { stubs: { ChangesSystem: true } },
  })
const systemOf = async (signatures: boolean, guides?: GuideShow) =>
  (await mountSheet({ signatures, ...(guides ? { guides } : {}) })).findComponent({ name: 'ChangesSystem' })

describe('ChangesSheet', () => {
  it("with signatures, gives the lines the chart's key and the part's clef (drawn on the first line only)", async () => {
    const line = await systemOf(true)
    expect(line.props('clef')).toBe('bass')
    expect(line.props('line').bars[0].keySig).toBe('Bb')
  })

  it('without, neither (drawn as before)', async () => {
    const line = await systemOf(false)
    expect(line.props('clef')).toBeUndefined()
    expect(line.props('line').bars[0].keySig).toBeNull()
  })

  it('keeps the print gap between lines unless signatures are on', async () => {
    const gap = async (signatures: boolean) => (await systemOf(signatures)).element.parentElement?.className
    expect(await gap(false)).toContain('print:space-y-1')
    expect(await gap(true)).toContain('print:space-y-0')
    expect(await gap(true)).not.toContain('print:space-y-1')
  })

  it('with no guide, draws slashes: no voices, no labels', async () => {
    const bar = (await systemOf(false, NO_GUIDES)).props('line').bars[0]
    expect(bar.voices).toEqual([])
    expect(bar.chords[0].guide).toEqual([])
  })

  it('with a guide on, gives the first line the clef even without signatures, and the notes and labels', async () => {
    const third = await systemOf(false, THIRD)
    expect(third.props('clef')).toBe('bass')
    expect(third.props('line').bars[0].keySig).toBeNull()
    expect(third.props('line').bars[0].voices).toHaveLength(1)
    expect(third.props('line').bars[0].chords[0].guide).toEqual(['3'])
    const both = await systemOf(false, BOTH)
    expect(both.props('line').bars[0].voices).toHaveLength(2)
    expect([...both.props('line').bars[0].chords[0].guide].sort()).toEqual(['3', '7'])
  })

  it('closes the print gap when a guide is on', async () => {
    const className = (await systemOf(false, SEVENTH)).element.parentElement?.className
    expect(className).toContain('print:space-y-0')
    expect(className).not.toContain('print:space-y-1')
  })

  it('pages the lines by changesLinesPerPage', async () => {
    for (const guides of [NO_GUIDES, THIRD, BOTH])
      for (const rows of [{ numerals: true, scales: true }, { numerals: false, scales: false }]) {
        const w = await mountSheet({ doc: long, guides, ...rows })
        const per = changesLinesPerPage(guides, rows)
        const total = w.findAllComponents({ name: 'ChangesSystem' }).length
        const pages = w.findAll('section')
        expect(total, `${JSON.stringify(guides)} ${JSON.stringify(rows)}`).toBeGreaterThan(per)
        expect(pages[0]?.findAll('changes-system-stub')).toHaveLength(per)
        expect(pages).toHaveLength(Math.ceil(total / per))
        w.unmount()
      }
  })
})
```

Replace `web/test/EditorView.test.ts` with:

```ts
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EditorView from '~/components/EditorView.vue'
import { CHART_REPORT_KEY } from '~/utils/chartReport'
import { decodeShare, type ShareView } from '~~/engine'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const TEXT = 'title: T\nA | 1 | Cm7\n'
const mount = (shared?: ShareView) =>
  mountSuspended(EditorView, {
    props: { initialText: TEXT, ...(shared ? { shared } : {}) },
    global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
    attachTo: document.body,
  })
type Wrapper = Awaited<ReturnType<typeof mount>>
const sheet = (w: Wrapper) => w.findComponent({ name: 'ScaleSheet' })
const changesSheet = (w: Wrapper) => w.findComponent({ name: 'ChangesSheet' })
/** a button by its exact visible text */
const buttonCalled = (w: Wrapper, name: string) => w.findAll('button').find((b) => b.text() === name)
/** the control a toolbar label (Catalyst Field) points at */
const control = (w: Wrapper, label: string) => {
  const id = w.findAll('label').find((l) => l.text() === label)?.attributes('for')
  const el = id ? w.find(`[id="${id}"]`) : undefined
  if (!el?.exists()) throw new Error(`no ${label} control`)
  return el
}
/** open the Instrument listbox and pick an option by its visible name */
async function chooseInstrument(w: Wrapper, name: string): Promise<void> {
  await control(w, 'Instrument').trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text().startsWith(name))
  if (!option) throw new Error(`no option ${name}`)
  await option.trigger('click')
  await nextTick()
}
/** open the "Where each scale starts" listbox and pick a mode by its visible label */
async function chooseMode(w: Wrapper, label: string): Promise<void> {
  const btn = w.findAll('button').find((b) => b.attributes('aria-label') === 'Where each scale starts')
  if (!btn) throw new Error('no mode control')
  await btn.trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text() === label)
  if (!option) throw new Error(`no mode option ${label}`)
  await option.trigger('click')
  await nextTick()
}
/** open the Work on listbox and pick a sheet by its visible label */
async function chooseSheet(w: Wrapper, label: string): Promise<void> {
  await control(w, 'Work on').trigger('click')
  await nextTick()
  const option = w.findAll('[role=option]').find((o) => o.text() === label)
  if (!option) throw new Error(`no sheet ${label}`)
  await option.trigger('click')
  await nextTick()
}

describe('EditorView help', () => {
  afterEach(() => {
    useRuntimeConfig().public.features.functions = true
    localStorage.clear()
  })
  it('mentions functions and @key only with the flag on', async () => {
    useRuntimeConfig().public.features.functions = true
    const on = await mount()
    await on.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(on.html()).toContain('@key B 17 D')
    on.unmount()
    useRuntimeConfig().public.features.functions = false
    const off = await mount()
    await off.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(off.html()).not.toMatch(/function|@key/)
    expect(off.html()).toContain("Leave the scale out to use the chord's default.")
    off.unmount()
  })

  it('with functions on, gives the grid the full width and lets the text editor collapse', async () => {
    useRuntimeConfig().public.features.functions = true
    const w = await mount()
    await w.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('section[aria-labelledby="grid-heading"]').element.parentElement?.className).not.toContain('lg:grid-cols-2')
    const toggle = w.find('button[aria-controls="chart-text-body"]')
    expect([toggle.text(), toggle.attributes('aria-expanded')]).toEqual(['Hide text', 'true'])
    await toggle.trigger('click')
    await nextTick()
    expect(w.find('#chart-text-body').exists()).toBe(false)
    expect([toggle.text(), toggle.attributes('aria-expanded')]).toEqual(['Show text', 'false'])
    w.unmount()
  })

  it('with functions off, keeps the side-by-side layout and no text toggle', async () => {
    useRuntimeConfig().public.features.functions = false
    const w = await mount()
    await w.findAll('button').find((b) => b.text() === 'Edit')?.trigger('click')
    await nextTick()
    expect(w.find('section[aria-labelledby="grid-heading"]').element.parentElement?.className).toContain('lg:grid-cols-2')
    expect(w.find('button[aria-controls="chart-text-body"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('EditorView', () => {
  afterEach(() => localStorage.clear())

  it('opens on the Changes sheet', async () => {
    const w = await mount()
    expect(changesSheet(w).exists()).toBe(true)
    expect(sheet(w).exists()).toBe(false)
    w.unmount()
  })

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C', mode: 'root' })
    expect(w.text()).not.toContain('the preview is')
  })

  it('offers one spelling at a time, with Start on only for From', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    expect(w.find('[aria-label="Start on"]').exists()).toBe(false)
    await chooseMode(w, 'From C')
    expect(sheet(w).props('mode')).toBe('from')
    expect(w.find('[aria-label="Start on"]').exists()).toBe(true)
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseInstrument(w, 'Tenor Sax')
    await chooseMode(w, 'From C')
    await w.find('[aria-label="Start on"]').setValue('Eb')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: 'Tenor Sax (Bb)', start: 'Eb' })
    expect(w.text()).toContain('the preview is transposed for tenor sax')
    expect(w.text()).toContain('From E♭')
  })

  it('uses the bass clef for trombone', async () => {
    const w = await mount()
    await chooseSheet(w, 'Scales')
    await chooseInstrument(w, 'Trombone')
    expect(sheet(w).props('part')).toEqual({ clef: 'bass', trans: 'C' })
    expect(w.text()).toContain('The preview is in bass clef, concert pitch, for trombone')
  })

  it('focus mode shows the sheet alone; Escape or Exit focus leaves it, back to the Focus button', async () => {
    const w = await mount()
    const button = (name: string) => w.findAll('button').find((b) => b.text().startsWith(name))
    const dialog = () => w.find('[role=dialog]')
    button('Focus')?.element.focus()
    await button('Focus')?.trigger('click')
    await nextTick()
    expect(dialog().attributes('aria-label')).toBe('Focus mode')
    expect(dialog().find('fieldset').isVisible()).toBe(false) // the preview controls are hidden
    expect(dialog().findComponent({ name: 'ChangesSheet' }).exists()).toBe(true)
    expect(document.activeElement?.textContent).toContain('Exit focus')
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await nextTick()
    expect(dialog().exists()).toBe(false)
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false)
    expect(document.activeElement?.textContent).toBe('Focus')

    await button('Focus')?.trigger('click')
    await button('Exit focus')?.trigger('click')
    expect(dialog().exists()).toBe(false)
  })
})

describe('EditorView guide tones', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    navigate.mockClear()
  })

  it('starts with the 3rd and 7th off', async () => {
    const w = await mount()
    expect(changesSheet(w).props('guides')).toEqual({ third: false, seventh: false })
    expect(buttonCalled(w, '3rd')?.attributes('aria-pressed')).toBe('false')
    expect(buttonCalled(w, '7th')?.attributes('aria-pressed')).toBe('false')
    w.unmount()
  })

  it('turns each on, passes both to the Changes sheet, and remembers them', async () => {
    const w = await mount()
    await buttonCalled(w, '3rd')?.trigger('click')
    await nextTick()
    expect(changesSheet(w).props('guides')).toEqual({ third: true, seventh: false })
    await buttonCalled(w, '7th')?.trigger('click')
    await nextTick()
    expect(changesSheet(w).props('guides')).toEqual({ third: true, seventh: true })
    expect(buttonCalled(w, '3rd')?.attributes('aria-pressed')).toBe('true')
    expect(buttonCalled(w, '7th')?.attributes('aria-pressed')).toBe('true')
    expect([localStorage.getItem('csm-guide-3rd'), localStorage.getItem('csm-guide-7th')]).toEqual(['on', 'on'])
    w.unmount()
  })

  it('offers the 3rd and 7th on the Changes sheet only', async () => {
    const w = await mount()
    expect(buttonCalled(w, '3rd')).toBeDefined()
    await chooseSheet(w, 'Scales')
    expect(buttonCalled(w, '3rd')).toBeUndefined()
    expect(buttonCalled(w, '7th')).toBeUndefined()
    expect(buttonCalled(w, 'Intervals')).toBeDefined()
    w.unmount()
  })

  it("applies a share link's guides for the visit, and a share link carries them", async () => {
    const w = await mount({ sheet: 'changes', guideSeventh: true })
    expect(changesSheet(w).props('guides')).toEqual({ third: false, seventh: true })
    expect(localStorage.getItem('csm-guide-7th')).toBeNull()
    await buttonCalled(w, 'Share')?.trigger('click')
    const link = await vi.waitFor(() => {
      const l = w.findComponent({ name: 'ShareDialog' }).props('link')
      if (typeof l !== 'string') throw new Error('no link yet')
      return l
    })
    expect((await decodeShare(link.split('#s=')[1] ?? ''))?.view).toMatchObject({ sheet: 'changes', guideThird: false, guideSeventh: true })
    w.unmount()
  })

  it('reports the sheet and the guides with a chart error', async () => {
    const w = await mount()
    await buttonCalled(w, '7th')?.trigger('click')
    await nextTick()
    await buttonCalled(w, 'Report a chart error')?.trigger('click')
    expect(JSON.parse(sessionStorage.getItem(CHART_REPORT_KEY) ?? '{}')).toMatchObject({ sheet: 'changes', guides: '7th' })
    expect(navigate).toHaveBeenCalledWith('/contact')
    w.unmount()
  })
})

describe('EditorView key signatures', () => {
  const KEYED = 'title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\n'
  const mountWith = (shared: { sheet: 'scales' | 'guideTones' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, shared },
      global: { stubs: { ScaleSheet: true, GuideToneSheet: true, ChangesSheet: true } },
    })
  afterEach(() => {
    useRuntimeConfig().public.features.keySignatures = true
    localStorage.clear()
  })

  it("with the flag on, gives the scale and guide tone sheets the chart's key, and the Changes sheet signatures", async () => {
    useRuntimeConfig().public.features.keySignatures = true
    const scales = await mountWith({ sheet: 'scales' })
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const guide = await mountWith({ sheet: 'guideTones' })
    expect(guide.findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const changes = await mountWith({ sheet: 'changes' })
    expect(changes.findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(true)
  })

  it('with the flag off, passes no key and no signatures', async () => {
    useRuntimeConfig().public.features.keySignatures = false
    expect((await mountWith({ sheet: 'scales' })).findComponent({ name: 'ScaleSheet' }).props('homeKey')).toBeUndefined()
    expect((await mountWith({ sheet: 'guideTones' })).findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toBeUndefined()
    expect((await mountWith({ sheet: 'changes' })).findComponent({ name: 'ChangesSheet' }).props('signatures')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/sheets.test.ts test/usePreferences.test.ts test/chartReport.test.ts test/ChangesSheet.test.ts test/EditorView.test.ts`

Expected failures:
- `sheets.test.ts`: `TypeError: firstSheet is not a function`.
- `usePreferences.test.ts`: `TypeError: Cannot read properties of undefined (reading 'value')`, because `guideThird` is missing.
- `chartReport.test.ts`: `guidesText is not a function`, and there is no `guides:` line.
- `ChangesSheet.test.ts`: 3 of the 4 new tests fail.
  - `with a guide on, gives the first line the clef…`: the clef is `undefined` where `'bass'` is expected.
  - `closes the print gap when a guide is on`: the gap class is `print:space-y-1`.
  - `pages the lines by changesLinesPerPage`: with a guide on, the first page holds 8 lines where fewer are expected.
  - `with no guide, draws slashes` already passes: `buildChanges` defaults to `NO_GUIDES`, and Task 2 gave every bar `voices: []` and every chord `guide: []`.
- `EditorView.test.ts`:
  - `opens on the Changes sheet` finds no ChangesSheet;
  - the focus test finds no ChangesSheet;
  - the guide tests find no `3rd` button.

The `chooseSheet(w, 'Scales')` tests already pass.

- [ ] **Step 3: Preferences**

Replace `web/app/composables/usePreferences.ts` with:

```ts
import type { Ref } from 'vue'
import { type InstrumentName, isInstrumentName, type ShareView } from '~~/engine'

/** a ref kept in this browser's storage; a stored value that doesn't parse falls back */
function storedRef<T>(key: string, parse: (raw: string) => T | undefined, fallback: T, store: (v: T) => string = String): Ref<T> {
  const raw = readStored(key)
  const value = ref((raw === null ? undefined : parse(raw)) ?? fallback) as Ref<T>
  watch(value, (v) => writeStored(key, store(v)))
  return value
}

/** the preview's instrument, start note and interval labels, and whether the editor is shown, remembered in this browser (client-only) */
export function usePreferences() {
  const instrument = storedRef<InstrumentName>('csm-instrument', (s) => (isInstrumentName(s) ? s : undefined), 'concert')
  const start = storedRef<string>('csm-start', (s) => ((PICKER_ROOTS as readonly string[]).includes(s) ? s : undefined), 'C')
  const intervals = storedRef<boolean>('csm-intervals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off')) // on until turned off: they show each note's job over the chord
  const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off')) // the editor (grid + text): hidden until shown, song-first
  // the Changes sheet's study rows: each chord's numeral and its scale, both on until turned off
  const numerals = storedRef<boolean>('csm-numerals', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  const scaleNames = storedRef<boolean>('csm-scale-names', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  // the Changes sheet's guide tones: each chord's 3rd and 7th as notes on the staff, both off until turned on
  const guideThird = storedRef<boolean>('csm-guide-3rd', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  const guideSeventh = storedRef<boolean>('csm-guide-7th', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the editor grid's Notes column: why each scale was chosen; hidden until shown
  const notes = storedRef<boolean>('csm-grid-notes', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  // the text editor under the full-width grid (with the functions flag): shown until hidden
  const textPane = storedRef<boolean>('csm-text-pane', (s) => s === 'on', true, (v) => (v ? 'on' : 'off'))
  return { instrument, start, intervals, showEditor, numerals, scaleNames, guideThird, guideSeventh, notes, textPane }
}

/** the same choices, starting from a share link's view over your own, for this visit only (nothing is saved) */
export function linkPreferences(view: ShareView) {
  const own = usePreferences()
  const start = view.start && (PICKER_ROOTS as readonly string[]).includes(view.start) ? view.start : own.start.value
  return {
    instrument: ref<InstrumentName>(view.instrument ?? own.instrument.value),
    start: ref<string>(start),
    intervals: ref<boolean>(view.intervals ?? own.intervals.value),
    numerals: ref<boolean>(view.numerals ?? own.numerals.value),
    scaleNames: ref<boolean>(view.scaleNames ?? own.scaleNames.value),
    guideThird: ref<boolean>(view.guideThird ?? own.guideThird.value),
    guideSeventh: ref<boolean>(view.guideSeventh ?? own.guideSeventh.value),
    showEditor: own.showEditor, // whether the editor is open: yours, and remembered
    textPane: own.textPane,
    notes: own.notes, // whether the grid's Notes column is shown: yours, and remembered
  }
}
```

- [ ] **Step 4: Default sheet**

Replace `web/app/utils/sheets.ts` with:

```ts
/** the preview's sheets: chord scales (one staff per chord), guide tone lines, or the Changes (a study lead sheet) */
export type SheetKind = 'scales' | 'guideTones' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'guideTones', label: 'Guide Tones' },
  { value: 'changes', label: 'Changes' },
]

/** the sheet a chart opens on: a share link's own sheet if it's on, else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ guideTones: boolean; changes: boolean }>): SheetKind {
  if (shared === 'guideTones' && on.guideTones) return 'guideTones'
  if (shared === 'scales' || !on.changes) return 'scales'
  return 'changes'
}
```

- [ ] **Step 5: Chart report**

Replace `web/app/utils/chartReport.ts` with:

```ts
import type { GuideShow } from '~~/engine'

export const CHART_REPORT_KEY = 'csm-chart-report'
/** guides: the Changes sheet's guide tones shown, as guidesText gives them */
export type ChartReport = Readonly<{ chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; guides: string; level: string; url: string }>

/** which guide tones are shown, for a report: '', '3rd', '7th' or '3rd,7th' */
export const guidesText = (g: GuideShow): string => [g.third && '3rd', g.seventh && '7th'].filter(Boolean).join(',')

/** the contact message a chart-error report pre-fills: a prompt for the reporter, a debug block, then the chart text */
export function buildChartReport(r: ChartReport): string {
  return [
    'What looks wrong? (describe it here)',
    '',
    '--- chart details (for debugging) ---',
    `title: ${r.title}`,
    `slug: ${r.slug}`,
    `version: ${r.version}`,
    `instrument: ${r.instrument}`,
    `sheet: ${r.sheet}`,
    `guides: ${r.guides}`,
    `level: ${r.level}`,
    `url: ${r.url}`,
    '',
    r.chart.trimEnd(),
  ].join('\n')
}
```

- [ ] **Step 6: ChangesSheet**

Replace `web/app/components/ChangesSheet.vue` with:

```vue
<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" compact>
      <template #default="{ page }">
        <div :class="['space-y-4', signatures || guideOn ? 'print:space-y-0' : 'print:space-y-1']">
          <ChangesSystem
            v-for="l in page.lines"
            :key="l.index"
            :line="l.line"
            :first="l.index === 0"
            :beats="sheet.beats"
            :bars-per-line="barsPerLine"
            :numerals="numerals"
            :scales="scales"
            :clef="signatures || guideOn ? part.clef : undefined"
          />
        </div>
      </template>
    </SheetPages>
  </div>
</template>

<script setup lang="ts">
import { buildChanges, changesLinesPerPage, type ChartDoc, chunk, type GuideShow, guidesOn, NO_GUIDES, pageSubtitle, type Part } from '~~/engine'

/** the Changes sheet (docs/plan-changes.md): the chart as a study lead sheet, 4 bars a line (2 on phones) */
const props = defineProps<{
  doc: ChartDoc
  title: string
  subtitle: string
  composer?: string
  part: Part
  instrumentLabel: string // '' for concert
  numerals: boolean
  scales: boolean
  signatures?: boolean // the part's clef and the chart's key signature, once, at the start of the first line
  guides?: GuideShow // each chord's 3rd and/or 7th as notes in place of the slashes (the clef then always starts line 1)
}>()

const wide = useMediaQuery('(min-width: 640px), print')
const barsPerLine = computed(() => (wide.value ? 4 : 2))

const show = computed((): GuideShow => props.guides ?? NO_GUIDES)
const guideOn = computed(() => guidesOn(show.value) > 0)
const sheet = computed(() => buildChanges(props.doc, props.part, barsPerLine.value, props.signatures, show.value))
// 8 lines with slashes (a 32-bar AABA, one section a line pair); fewer with guide tones, whose notes and labels are taller
const linesPerPage = computed(() => changesLinesPerPage(show.value, { numerals: props.numerals, scales: props.scales }))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'))
const pages = computed(() =>
  chunk(
    sheet.value.lines.map((line, index) => ({ line, index })),
    linesPerPage.value,
  ).map((lines) => ({ subtitle: subtitleText.value, lines })),
)
</script>
```

- [ ] **Step 7: PreviewControls, the 3rd and 7th buttons (Changes only)**

In `web/app/components/PreviewControls.vue`, replace lines 38–41.

Before:
```vue
          <template v-else>
            <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :class="numerals ? '' : OFF_FILL" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
            <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :class="scaleNames ? '' : OFF_FILL" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
          </template>
```
After:
```vue
          <template v-else>
            <UiButton v-bind="numerals ? { color: 'note' } : { outline: true }" :class="numerals ? '' : OFF_FILL" :aria-pressed="numerals" title="Each chord's Roman numeral in its key" @click="numerals = !numerals">Numerals</UiButton>
            <UiButton v-bind="scaleNames ? { color: 'note' } : { outline: true }" :class="scaleNames ? '' : OFF_FILL" :aria-pressed="scaleNames" title="Each chord's scale, under its numeral" @click="scaleNames = !scaleNames">Scales</UiButton>
            <UiButton v-bind="guideThird ? { color: 'note' } : { outline: true }" :class="guideThird ? '' : OFF_FILL" :aria-pressed="guideThird" title="Each chord's 3rd (4th on sus chords), in the nearest octave; with 7th on, two voices that move by step" @click="guideThird = !guideThird">3rd</UiButton>
            <UiButton v-bind="guideSeventh ? { color: 'note' } : { outline: true }" :class="guideSeventh ? '' : OFF_FILL" :aria-pressed="guideSeventh" title="Each chord's 7th (root on triads, 6th on 6 chords), in the nearest octave; with 3rd on, two voices that move by step" @click="guideSeventh = !guideSeventh">7th</UiButton>
          </template>
```

In the same file, replace lines 86–87.

Before:
```ts
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })
```
After:
```ts
const numerals = defineModel<boolean>('numerals', { default: true })
const scaleNames = defineModel<boolean>('scaleNames', { default: true })
const guideThird = defineModel<boolean>('guideThird', { default: false })
const guideSeventh = defineModel<boolean>('guideSeventh', { default: false })
```

The `useFeature('guideTones')` sheet filter (now at :93–95) stays until Task 5.

- [ ] **Step 8: EditorView wiring**

All edits are in `web/app/components/EditorView.vue`.

(a) Lines 87–89. Before:
```vue
            v-model:numerals="prefs.numerals.value"
            v-model:scale-names="prefs.scaleNames.value"
          >
```
After:
```vue
            v-model:numerals="prefs.numerals.value"
            v-model:scale-names="prefs.scaleNames.value"
            v-model:guide-third="prefs.guideThird.value"
            v-model:guide-seventh="prefs.guideSeventh.value"
          >
```

(b) Lines 134–138. Before:
```vue
            :numerals="prefs.numerals.value"
            :scales="prefs.scaleNames.value"
            :signatures="signaturesOn"
          />
          <GuideToneSheet
```
After:
```vue
            :numerals="prefs.numerals.value"
            :scales="prefs.scaleNames.value"
            :signatures="signaturesOn"
            :guides="guides"
          />
          <GuideToneSheet
```

(c) Line 173. Before:
```ts
import { CHART_REPORT_KEY, type ChartReport } from '~/utils/chartReport'
```
After:
```ts
import { CHART_REPORT_KEY, type ChartReport, guidesText } from '~/utils/chartReport'
```

(d) Lines 178–179, inside the `~~/engine` import. Before:
```ts
  encodeShare,
  instrumentLabel,
```
After:
```ts
  encodeShare,
  type GuideShow,
  instrumentLabel,
```

(e) Line 196. Before:
```ts
import type { SheetKind } from '~/utils/sheets'
```
After:
```ts
import { firstSheet, type SheetKind } from '~/utils/sheets'
```

(f) Lines 212–213. Before:
```ts
const prefs = props.shared ? linkPreferences(props.shared) : usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
```
After:
```ts
const prefs = props.shared ? linkPreferences(props.shared) : usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** the Changes sheet's guide tones: which of each chord's 3rd and 7th are drawn */
const guides = computed((): GuideShow => ({ third: prefs.guideThird.value, seventh: prefs.guideSeventh.value }))
```

(g) Lines 222–225. Before:
```ts
const sharedSheet = props.shared?.sheet
const sheet = ref<SheetKind>(
  sharedSheet === 'guideTones' && useFeature('guideTones') ? 'guideTones' : sharedSheet === 'changes' && useFeature('changes') ? 'changes' : 'scales',
)
```
After:
```ts
const sheet = ref<SheetKind>(firstSheet(props.shared?.sheet, { guideTones: useFeature('guideTones'), changes: useFeature('changes') }))
```

(h) `openShare`, lines 327–329. Before:
```ts
    numerals: prefs.numerals.value,
    scaleNames: prefs.scaleNames.value,
    sheet: sheet.value,
```
After:
```ts
    numerals: prefs.numerals.value,
    scaleNames: prefs.scaleNames.value,
    guideThird: prefs.guideThird.value,
    guideSeventh: prefs.guideSeventh.value,
    sheet: sheet.value,
```

(i) `reportError`, lines 392–393. Before:
```ts
    sheet: sheet.value,
    level: levelsOn ? scaleLevel.level.value : '',
```
After:
```ts
    sheet: sheet.value,
    guides: guidesText(guides.value),
    level: levelsOn ? scaleLevel.level.value : '',
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/sheets.test.ts test/usePreferences.test.ts test/chartReport.test.ts test/ChangesSheet.test.ts test/EditorView.test.ts`

Expected: every test in the 5 files passes.

- [ ] **Step 10: Run the full checks**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint`

Expected:
- Typecheck is clean: `nuxt typecheck` and the engine and e2e tsconfigs.
- Every vitest test passes.
- eslint is clean.
- `make e2e` is expected to be red until Task 6, which adds `chooseSheet(page, 'Scales')` to the browser tests that assumed Scales opens first. Don't gate on it here.

- [ ] **Step 11: Commit**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add web/app/composables/usePreferences.ts web/app/utils/sheets.ts web/app/utils/chartReport.ts web/app/components/ChangesSheet.vue web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/test/sheets.test.ts web/test/usePreferences.test.ts web/test/chartReport.test.ts web/test/ChangesSheet.test.ts web/test/EditorView.test.ts
git commit -F - <<'EOF'
Changes: 3rd and 7th toggles, and the Changes sheet first

Two Show toggles on the Changes sheet (csm-guide-3rd, csm-guide-7th, off by
default) pass a GuideShow to ChangesSheet, which voices the chart through
buildChanges, starts line 1 with the clef when a guide is on, closes the print
gap and pages by changesLinesPerPage. Share links and chart-error reports carry
the guides. A chart now opens on the Changes sheet (firstSheet).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

#### Notes
- The page-count test needs `changesLinesPerPage` to stay below 16, the number of lines for 64 bars at 4 a line. Any value Task 6 tunes into the 5–8 range passes.

---

### Task 5: Remove the Guide tones sheet

Guide tones now live on the Changes sheet, so this task deletes the old sheet completely:
- its components and drawing code;
- the engine's sheet model;
- the `guideTones` flag;
- the `'guideTones'` share value and sheet value;
- its unit tests and copy.

It keeps:
- Practice's "Guide tones" preset (`practice.ts`);
- `TONES`, `guideToneDegrees`, `guideTonesFor`, `readable` and `notesFor`;
- `guideToneTimeline` and `voiceLeading.ts`.

Task 6 owns every browser test (`web/e2e/`) and the docs.

**Files:**
- Delete:
  - `web/app/components/GuideToneSheet.vue`
  - `web/app/components/GuideToneSystem.vue`
  - `web/app/utils/guideToneDrawing.ts`
  - `web/test/GuideToneSheet.test.ts`
- Create: `web/engine/__tests__/guideToneTimeline.test.ts`
- Modify (full replacement): `web/engine/guideTones.ts` (241 lines after Task 1), `web/app/utils/sheets.ts` and `web/test/sheets.test.ts` (both from Task 4)
- Modify:
  - `web/engine/__tests__/guideTones.test.ts`: lines 1–40 and 67–233 after Task 1 and this task's Step 1 import, plus an appended test.
  - `web/engine/guideToneTimeline.ts`: 3–5 (comment)
  - `web/engine/share.ts`: 14 and 96 (101 after Task 2)
  - `web/engine/chart.ts`: 17 and 181 (comments)
  - `web/engine/__tests__/share.test.ts`: 16, plus a new test before `'carry function cells and @key lines unchanged'`
  - `web/app/utils/vexflow.ts`: 33–34 (comments)
  - `web/app/components/EditorView.vue`: the `<GuideToneSheet>` block (141–152 after Task 4) and the `firstSheet(` call (228 after Task 4)
  - `web/app/components/PreviewControls.vue`: 93–95 after Task 4
  - `web/app/components/SheetPages.vue`: 28 (comment)
  - `web/app/composables/useFeature.ts`: 5
  - `web/app/composables/useChartEditor.ts`: 5 and 66–67
  - `web/app/pages/help.vue`: 28, 34–40, after 48, 162, 221–222 and 257
  - `web/app/pages/about.vue`: 17
  - `web/nuxt.config.ts`: 22 and 74
  - `web/package.json`: 16
  - `web/test/features.test.ts`: 15
  - `web/test/cropBand.test.ts`: 2 and 19–40
  - `web/test/EditorView.test.ts`: the `EditorView key signatures` describe from Task 4

**Interfaces:**
- Consumes:
  - Task 1: `guideVoices`, `GuideShow`, `NO_GUIDES`, the new `GuideNote`, the exported `notesFor`, and `LegacyGuideNote` (deleted here).
  - Task 3: `DURATIONS`, `REST_KEY` and `INK` now live in `changesDrawing.ts`, so deleting `guideToneDrawing.ts` loses nothing.
  - Task 4: `firstSheet`, `web/test/sheets.test.ts`, and the rewritten `EditorView.test.ts` and `EditorView.vue`.
- Produces:
  - `export type SheetKind = 'scales' | 'changes'`
  - `export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ changes: boolean }>): SheetKind`
  - `export type ShareSheet = 'scales' | 'changes'`. `shareViewFrom` drops `sheet: 'guideTones'`.
  - `export type Feature = 'myCharts' | 'practice' | 'scaleLevels' | 'changes' | 'functions' | 'keySignatures'`
  - `useChartEditor()` no longer returns `beats`.
  - The engine no longer exports `buildGuideTones`, `GuideToneSheet`, `GuideSystem`, `GuideBar`, `GuideChord` or `LegacyGuideNote`.
  - `runtimeConfig.public.features` has no `guideTones` key.

- [ ] **Step 1: Write the failing tests**

Replace `web/test/sheets.test.ts` (from Task 4) with:
```ts
import { describe, expect, it } from 'vitest'
import { firstSheet, SHEETS } from '~/utils/sheets'

describe('SHEETS', () => {
  it('offers Scales and Changes only: guide tones are on the Changes sheet', () => {
    expect(SHEETS.map((s) => s.value)).toEqual(['scales', 'changes'])
    expect(SHEETS.map((s) => s.label)).toEqual(['Scales', 'Changes'])
  })
})

describe('firstSheet', () => {
  it('opens on the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: true })).toBe('changes')
  })

  it("opens a share link's own sheet", () => {
    for (const s of ['scales', 'changes'] as const) expect(firstSheet(s, { changes: true })).toBe(s)
  })

  it('falls back to Scales without the Changes sheet', () => {
    expect(firstSheet(undefined, { changes: false })).toBe('scales')
    expect(firstSheet('changes', { changes: false })).toBe('scales')
  })
})
```

Edit `web/test/features.test.ts:15`.

Before:
```ts
    expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, guideTones: true, practice: true, changes: true, scaleLevels: true, functions: true, keySignatures: true })
```
After:
```ts
    expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, practice: true, changes: true, scaleLevels: true, functions: true, keySignatures: true })
```

Edit `web/engine/__tests__/share.test.ts:16`.

Before:
```ts
    const view = { instrument: 'tenor-sax', mode: 'from', start: 'Eb', intervals: false, sheet: 'guideTones', practice: { keys: ['b3', '3'] } } as const
```
After:
```ts
    const view = { instrument: 'tenor-sax', mode: 'from', start: 'Eb', intervals: false, sheet: 'changes', practice: { keys: ['b3', '3'] } } as const
```

In the same file, insert a test directly before `it('carry function cells and @key lines unchanged', …)`. That test follows the one Task 2 added.

Before:
```ts
  it('carry function cells and @key lines unchanged', async () => {
```
After:
```ts
  it('drop the retired Guide tones sheet from an old link, keeping the rest of its view', async () => {
    expect(shareViewFrom({ sheet: 'guideTones', numerals: true })).toEqual({ numerals: true })
    expect(await decodeShare(await packed({ v: 1, chart: CHART, view: { sheet: 'guideTones', mode: 'root' } }))).toEqual({ chart: CHART, view: { mode: 'root' } })
  })

  it('carry function cells and @key lines unchanged', async () => {
```

In `web/engine/__tests__/guideTones.test.ts`, append at the end of the file:
```ts

describe('the engine', () => {
  it('keeps the guide tone helpers, and has no Guide tones sheet model', () => {
    expect(engine).toHaveProperty('guideToneDegrees')
    expect(engine).toHaveProperty('guideTonesFor')
    expect(engine).toHaveProperty('guideToneTimeline')
    expect(engine).toHaveProperty('guideVoices')
    expect(engine).not.toHaveProperty('buildGuideTones')
  })
})
```
Then add `import * as engine from '../index'` on the line after `import { guideToneTimeline } from '../guideToneTimeline'` (that import is line 18 after Task 1, so the new line is 19 and everything below moves down one). Step 3 replaces the whole import block anyway.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/sheets.test.ts test/features.test.ts engine/__tests__/share.test.ts engine/__tests__/guideTones.test.ts`

Expected: 4 failures.
- `sheets.test`, `SHEETS`: received `['scales', 'guideTones', 'changes']`.
- `features.test`: the received object has an extra `guideTones: true`.
- `share.test`, "drop the retired Guide tones sheet…": received `{ numerals: true, sheet: 'guideTones' }`.
- `guideTones.test`, "the engine…": `expect(engine).not.toHaveProperty('buildGuideTones')` fails.

The `firstSheet` tests still pass, because the old `firstSheet` ignores the missing `guideTones` key.

- [ ] **Step 3: Move the timeline tests to their own file and trim `guideTones.test.ts`**

Create `web/engine/__tests__/guideToneTimeline.test.ts`.
- It holds the timeline cases moved unchanged from `guideTones.test.ts`: the `describe('timeline')` block and the timeline halves of the waltz and intro/coda tests.
- It adds a library check that replaces the deleted `buildGuideTones` library assertion on `diagnostics`.

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartBeats, expandRows, parseChart, resolveScale, type Row } from '../chart'
import { guideTonesFor } from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import { CONCERT } from '../part'
import { isSyncCopy } from '../util'

const row = (bar: string, chord: string, scale = ''): Row => ({ section: 'A', bar, chord, scale })
const rowsOf = (text: string): readonly Row[] => expandRows(parseChart(text).value).value

describe('timeline', () => {
  it('splits shared bars and holds a chord until the next change', () => {
    const t = guideToneTimeline([row('1', 'Dm7'), row('2', 'G7'), row('2', 'C7'), row('3', 'F'), row('3', 'Bb'), row('3', 'Eb'), row('5', 'Ab')])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 4],
      ['G7', 4, 2],
      ['C7', 6, 2],
      ['F', 8, 2],
      ['Bb', 10, 1],
      ['Eb', 11, 5], // to bar 5
      ['Ab', 16, 16], // the last row fills out the 4-bar phrase (bars 5-8)
    ])
    expect(t.diagnostics).toEqual([])
  })

  it('runs the last section as long as the one it repeats, in whole 4-bar phrases', () => {
    const end = (text: string) => {
      const { events } = guideToneTimeline(rowsOf(text))
      const last = events.at(-1)
      return last && last.start + last.beats
    }
    expect(end('A1 | 1 | Dm7\n@copy A1 A2 8\nB | 17 | Ebm7\n@copy A1 A3 24\n')).toBe(32 * 4) // So What: 32 bars
    expect(end('A | 1 | Cm7\nA | 5 | Fm7\nA | 7 | Cm7\nA | 9 | F#m7b5\nA | 10 | E7alt\nA | 11 | Cm7\n')).toBe(12 * 4) // 12-bar
    expect(end('A | 1 | C7\nA | 12 | G7\n')).toBe(12 * 4)
  })

  it('treats 1 and 01 as the same bar', () => {
    expect(guideToneTimeline([row('1', 'C7'), row('01', 'F7'), row('2', 'G7')]).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 2],
      ['F7', 2, 2],
      ['G7', 4, 12],
    ])
  })

  it('reports bars it cannot place and keeps going', () => {
    const t = guideToneTimeline([row('1', 'C7'), row('x', 'F7'), row('3', 'G7'), row('2', 'C7'), ...['1', '1', '1', '1', '1'].map((b) => row(b, 'D7'))])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 4],
      ['F7', 4, 4], // "x": one bar
      ['G7', 8, 4], // next bar is earlier: one bar
      ['C7', 12, 4],
      ['D7', 16, 1],
      ['D7', 17, 1],
      ['D7', 18, 1],
      ['D7', 19, 1],
    ])
    expect(t.diagnostics).toEqual(['bar "x" is not a whole number, so F7 gets one bar', 'more than 4 chords in bar 1: the 5th and later are left out'])
  })

  it('times a waltz in 3/4: three beats a bar', () => {
    const text = 'A | 1 | Dm7\nA | 2 | G7\nA | 2 | C7\nA | 3 | FMaj7\nA | 5 | Bb\n'
    expect(guideToneTimeline(rowsOf(text), 3).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 3], ['G7', 3, 2], ['C7', 5, 1], ['FMaj7', 6, 6], ['Bb', 12, 12], // Bb holds bars 5–8
    ])
  })

  it('times an intro and a coda on their own, each numbered from bar 1', () => {
    const text = 'Intro | 1 | Dm7\nIntro | 3 | G7\nA | 1 | CMaj7\nA | 3 | Am7\nA | 5 | Dm7\nA | 7 | G7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n'
    expect(guideToneTimeline(rowsOf(text)).events.map((e) => [e.chord, e.start / 4, e.beats / 4])).toEqual([
      ['Dm7', 0, 2], ['G7', 2, 2], // the intro: 4 bars
      ['CMaj7', 4, 2], ['Am7', 6, 2], ['Dm7', 8, 2], ['G7', 10, 2], // the form, from bar 1
      ['Db7', 12, 1], ['CMaj7', 13, 3], // the coda, rounded to 4 bars
    ])
  })
})

describe('the library', () => {
  it('times every chart in its own metre without a problem, and every chord has guide tones', () => {
    for (const f of readdirSync('../charts').filter((name) => !isSyncCopy(name))) {
      const doc = parseChart(readFileSync(`../charts/${f}`, 'utf8')).value
      const { events, diagnostics } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
      expect(diagnostics, f).toEqual([])
      expect(events.filter((e) => !guideTonesFor(CONCERT, e.chord, resolveScale(e.row) ?? undefined)).map((e) => e.chord), f).toEqual([])
    }
  })
})
```

Then edit `web/engine/__tests__/guideTones.test.ts` (numbering as left by Task 1 and Step 1).

(1) Replace lines 1–40 with the following. Those lines are Task 1's 1–39 plus Step 1's `engine` import: they run from `import { readdirSync, readFileSync } from 'node:fs'` through the closing `}` of the `struck` helper, and include the `row`, `rowsOf`, `TENOR` and `BASS` constants.
```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import {
  type GuideInput,
  guideLabel,
  type GuideNote,
  type GuideShow,
  guideTonesFor,
  guideVoices,
  NO_GUIDES,
  voiceAccidentals,
} from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import * as engine from '../index'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { toVexKey } from '../sheet'
import { isSyncCopy } from '../util'
import { voiceLeadOne } from '../voiceLeading'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const BASS: Part = { clef: 'bass', trans: 'C' }
```

Before the edit, line 41 is blank and line 42 is `describe('guide tones per chord', () => {`. Both stay.

(2) Delete the `describe('timeline', …)` and `describe('guide tone lines', …)` blocks and the blank line after them. In Task 1's numbering that is lines 66–232; after Step 1's import it is 67–233; after edit (1) it is 50–216. Check: `cd /Users/kevdog/Documents/code/jazz-scales/web && grep -n "^describe" engine/__tests__/guideTones.test.ts`. The expected output, in order, is exactly:
```
describe('guide tones per chord', () => {
describe('voiceLeadOne', () => {
describe('guideLabel', () => {
describe('guideVoices', () => {
describe('voiceAccidentals', () => {
describe('guide tone voices over the library', () => {
describe('the engine', () => {
```
Then run `grep -n "buildGuideTones" engine/__tests__/guideTones.test.ts`. The only line it prints is `expect(engine).not.toHaveProperty('buildGuideTones')`.

The old sheet's `ignores a scale it cannot read rather than the chord` and `keeps the two lines complementary` go with `describe('guide tone lines')`. Task 1's `guideVoices` test of the same name and the library test's same-label check cover them.

- [ ] **Step 4: Remove the sheet model from the engine**

Replace `web/engine/guideTones.ts` (241 lines after Task 1) with:

```ts
import { parseChord, writtenChordRootLenient } from './chord'
import type { Part, Pitched } from './part'
import { accidentalsInBar, octaveOf } from './keySignature'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'
import { type Candidate, type GuideTones, voiceLead, voiceLeadOne } from './voiceLeading'

/**
 * Guide tones (docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md): each chord's 3rd and 7th as
 * voices for the Changes sheet, one note a chord, voice-led (both on: two voices that move by step; one on: that
 * degree alone, in the nearest octave), split at barlines, with accidentals by the measure rule across both voices.
 * No DOM, like sheet.ts. The timeline (guideToneTimeline.ts) and the voice leading (voiceLeading.ts) live in their
 * own modules.
 */

/** canonical quality -> the degrees that stand for its "3rd" and "7th" */
const TONES: Readonly<Record<string, readonly [string, string]>> = {
  maj: ['3', '1'], // a triad has no 7th: its root resolves by step from a V7 (B -> C, F# -> G), its 5th would leap
  m: ['b3', '1'],
  Maj7: ['3', '7'],
  'Maj7#11': ['3', '7'],
  'Maj7#5': ['3', '7'],
  '6': ['3', '6'],
  m7: ['b3', 'b7'],
  m6: ['b3', '6'],
  mMaj7: ['b3', '7'],
  '7': ['3', 'b7'],
  '7sus4': ['4', 'b7'],
  '7sus4b9': ['4', 'b7'],
  '7b9': ['3', 'b7'],
  '7b13': ['3', 'b7'],
  '7b9b13': ['3', 'b7'],
  '7#11': ['3', 'b7'],
  '7alt': ['3', 'b7'],
  m7b5: ['b3', 'b7'],
  dim7: ['b3', 'bb7'],
}

/** the degrees standing for a quality's "3rd" and "7th" (canonical or extended symbol), or null if unknown */
export const guideToneDegrees = (quality: string): readonly [string, string] | null => TONES[baseQuality(quality) ?? ''] ?? null

/**
 * a chord's two guide tones, spelled from its written root; null if the chord or its quality is unknown.
 * Extended symbols count as their base quality (Maj7#11 as Maj7).
 */
export function guideTonesFor(part: Part, chord: string, scale?: string): GuideTones | null {
  try {
    const degrees = TONES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    const [third, seventh] = spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' '))
    if (!third || !seventh) return null
    return { third: { note: third, label: degrees[0] }, seventh: { note: seventh, label: degrees[1] } }
  } catch {
    return null
  }
}

/** which guide tones the Changes sheet shows */
export type GuideShow = Readonly<{ third: boolean; seventh: boolean }>
export const NO_GUIDES: GuideShow = { third: false, seventh: false }
/** how many guide tone voices are shown: 0, 1 or 2 */
export const guidesOn = (s: GuideShow): number => +s.third + +s.seventh

/** one note (or rest) of a guide tone voice, within a bar */
export type GuideNote = Readonly<{
  /** null: a rest */
  pitch: Pitched | null
  /** where it starts in the bar, from 0 */
  beat: number
  beats: 1 | 2 | 3 | 4
  /** tied into this voice's next note (in the next bar, which may be on the next line) */
  tie: boolean
  /** continues the previous note: no accidental, no label */
  tiedIn: boolean
  /** '#', 'b', 'n', '##', 'bb' or null: the measure rule across both voices, against the key signature (none: C) */
  accidental: string | null
}>

/** a degree as the label row prints it: the real degree without its flat or sharp (b3 -> 3, bb7 -> 7) */
export const guideLabel = (degree: string): string => degree.replace(/^[b#]+/, '')

/** a chord to voice: row is the caller's index for its labels; start and beats are in beats from 0 */
export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number }>

/**
 * split [start, start + length) at barlines into notes, tying a held pitch across them (a rest is split untied);
 * accidentals are left for voiceAccidentals
 */
export function notesFor(c: Candidate | null, start: number, length: number, beats: number): { bar: number; note: GuideNote }[] {
  const out: { bar: number; note: GuideNote }[] = []
  const pitch = c?.pitch ?? null
  const end = start + length
  let at = start
  while (at < end) {
    const bar = Math.floor(at / beats)
    const len = Math.min(end, (bar + 1) * beats) - at
    out.push({
      bar,
      note: { pitch, beat: at - bar * beats, beats: len as 1 | 2 | 3 | 4, tie: !!pitch && at + len < end, tiedIn: !!pitch && at > start, accidental: null },
    })
    at += len
  }
  return out
}

/**
 * one bar's voices (upper first) with their accidentals: the measure rule (accidentalsInBar) over both voices
 * merged, by beat and the upper note first, so an accidental in one voice is in force for the other
 */
export function voiceAccidentals(voices: readonly (readonly GuideNote[])[], keySig: string | null): GuideNote[][] {
  const merged = voices
    .flatMap((notes, v) => notes.flatMap((n, i) => (n.pitch ? [{ v, i, n, pitch: n.pitch }] : [])))
    .sort((a, b) => a.n.beat - b.n.beat || a.v - b.v)
  const accs = accidentalsInBar(
    merged.map(({ n, pitch }) => ({ letter: pitch.letter, acc: pitch.acc, octave: octaveOf(pitch), tiedIn: n.tiedIn })),
    keySig,
  )
  const out = voices.map((notes) => [...notes])
  merged.forEach(({ v, i, n }, k) => {
    const voice = out[v]
    if (voice) voice[i] = { ...n, accidental: accs[k] ?? null }
  })
  return out
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/**
 * the guide tone voices for chords in time order: by timeline bar (Math.floor(start / beats)), each bar's voices
 * ([line] with one toggle on, [upper, lower] with both); by row, the labels top to bottom (no entry for a rest);
 * and a diagnostic for each chord without guide tones. Both on: the two lines are voice-led as a pair (each moves by
 * step where it can) and sorted by pitch at every chord; one on: that degree's smoothest line alone. A chord without
 * guide tones rests in every voice. keySig: the signature in force on every line (null: C). Nothing when both are off.
 */
export function guideVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  show: GuideShow,
): { bars: ReadonlyMap<number, readonly (readonly GuideNote[])[]>; labels: ReadonlyMap<number, readonly string[]>; missing: readonly string[] } {
  const bars = new Map<number, GuideNote[][]>()
  const labels = new Map<number, readonly string[]>()
  const missing: string[] = []
  const count = guidesOn(show)
  if (!count) return { bars, labels, missing }
  const tones = chords.map((c) => {
    const t = guideTonesFor(part, c.chord, c.scale)
    if (!t) {
      const why = `no guide tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const lines: (Candidate | null)[][] = []
  if (count === 2) {
    const [one, two] = voiceLead(tones, part.clef)
    const pairs = one.map((a, j) => {
      const b = two[j] ?? null
      return a && b && b.pitch.midi > a.pitch.midi ? [b, a] : [a, b]
    })
    lines.push(
      pairs.map((p) => p[0] ?? null),
      pairs.map((p) => p[1] ?? null),
    )
  } else lines.push(voiceLeadOne(tones, show.third ? 0 : 1, part.clef))
  chords.forEach((c, j) => {
    const here = lines.map((l) => l[j] ?? null)
    const labelled = here.flatMap((h) => (h ? [guideLabel(h.label)] : []))
    if (labelled.length === here.length) labels.set(c.row, labelled)
    here.forEach((h, v) =>
      notesFor(h, c.start, c.beats, beats).forEach(({ bar, note }) => {
        const voices = bars.get(bar) ?? lines.map((): GuideNote[] => [])
        voices[v]?.push(note)
        bars.set(bar, voices)
      }),
    )
  })
  for (const [bar, voices] of bars) bars.set(bar, voiceAccidentals(voices, keySig))
  return { bars, labels, missing }
}
```

`web/engine/guideToneTimeline.ts:3–5`.

Before:
```ts
/**
 * When each chord of a guide tone sheet starts and how long it lasts, in beats (4/4 unless the chart says 3/4 or 2/4;
 * docs/plan-guide-tones.md):
```
After:
```ts
/**
 * When each chord of the Changes sheet starts and how long it lasts, in beats (4/4 unless the chart says 3/4 or 2/4;
 * docs/plan-guide-tones.md), for its bars and its guide tones:
```

`web/engine/share.ts:14`.

Before:
```ts
export type ShareSheet = 'scales' | 'guideTones' | 'changes'
```
After:
```ts
export type ShareSheet = 'scales' | 'changes' // a link from the retired Guide tones sheet drops its sheet and opens the default
```

`web/engine/share.ts`, the `sheet` line in `shareViewFrom` (101 after Task 2).

Before:
```ts
    ...(o.sheet === 'scales' || o.sheet === 'guideTones' || o.sheet === 'changes' ? { sheet: o.sheet } : {}),
```
After:
```ts
    ...(o.sheet === 'scales' || o.sheet === 'changes' ? { sheet: o.sheet } : {}),
```

`web/engine/chart.ts:17`.

Before:
```ts
/** `time:` 2/4, 3/4 or 4/4 (the default): beats a bar for the guide tone and Changes sheets; null if it's another */
```
After:
```ts
/** `time:` 2/4, 3/4 or 4/4 (the default): beats a bar for the Changes sheet and its guide tones; null if it's another */
```

`web/engine/chart.ts:181`.

Before:
```ts
 * they stand; the analysis and the guide tone timeline treat each as its own piece, around the repeating form.
```
After:
```ts
 * they stand; the analysis and the Changes timeline (guideToneTimeline.ts) treat each as its own piece, around the repeating form.
```

`web/engine/index.ts:13–15` stays, because all three modules survive.

- [ ] **Step 5: Remove the sheet from the app**

```bash
cd /Users/kevdog/Documents/code/jazz-scales && git rm web/app/components/GuideToneSheet.vue web/app/components/GuideToneSystem.vue web/app/utils/guideToneDrawing.ts web/test/GuideToneSheet.test.ts
```

Replace `web/app/utils/sheets.ts` (from Task 4) with:
```ts
/** the preview's sheets: chord scales (one staff per chord), or the Changes (a study lead sheet, with guide tones on request) */
export type SheetKind = 'scales' | 'changes'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'changes', label: 'Changes' },
]

/** the sheet a chart opens on: a share link's own sheet, else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ changes: boolean }>): SheetKind {
  return shared === 'scales' || !on.changes ? 'scales' : 'changes'
}
```

In `web/app/components/EditorView.vue`, delete this block (141–152 after Task 4):
```vue
          <GuideToneSheet
            v-else-if="sheet === 'guideTones'"
            :rows="editor.rows.value"
            :title="editor.meta.value.title"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="part"
            :instrument-label="instrumentLabel(prefs.instrument.value)"
            :beats="editor.beats.value"
            :intervals="prefs.intervals.value"
            :home-key="homeKey"
          />
```

In the same file (228 after Task 4).

Before:
```ts
const sheet = ref<SheetKind>(firstSheet(props.shared?.sheet, { guideTones: useFeature('guideTones'), changes: useFeature('changes') }))
```
After:
```ts
const sheet = ref<SheetKind>(firstSheet(props.shared?.sheet, { changes: useFeature('changes') }))
```

`web/app/components/PreviewControls.vue` (93–95 after Task 4).

Before:
```ts
const guideTones = useFeature('guideTones')
const changes = useFeature('changes')
const sheets = computed(() => SHEETS.filter((s) => (s.value === 'guideTones' ? guideTones : s.value === 'changes' ? changes : true)))
```
After:
```ts
const changes = useFeature('changes')
const sheets = computed(() => SHEETS.filter((s) => s.value !== 'changes' || changes))
```

`web/app/composables/useFeature.ts:5`.

Before:
```ts
export type Feature = 'myCharts' | 'guideTones' | 'practice' | 'scaleLevels' | 'changes' | 'functions' | 'keySignatures'
```
After:
```ts
export type Feature = 'myCharts' | 'practice' | 'scaleLevels' | 'changes' | 'functions' | 'keySignatures'
```

In `web/app/composables/useChartEditor.ts`, delete line 5 (`  chartBeats,`) and lines 66–67, since the only use of `beats` was the deleted `EditorView` block.
```ts
    /** beats a bar, from the chart's `time:` line */
    beats: computed(() => chartBeats(doc.value)),
```

`web/app/utils/vexflow.ts:33–34`.

Before:
```ts
export const CLEF_SPACE = 70 // lead width for a clef (guide tone systems)
export const BAR_UNITS = 300 // drawing width per bar (guide tone and Changes sheets share it, so phones' 2-bar systems draw as large as 4-bar ones)
```
After:
```ts
export const CLEF_SPACE = 70 // lead width for a clef alone (signatureLead builds on it)
export const BAR_UNITS = 300 // drawing width per bar on the Changes sheet, so phones' 2-bar lines draw as large as 4-bar ones
```

`web/app/components/SheetPages.vue:28`.

Before:
```ts
  compact?: boolean // less space under the header in print (guide tones fit 8 systems a page)
```
After:
```ts
  compact?: boolean // less space under the header in print (the Changes fits its lines a page)
```

`web/nuxt.config.ts:22`.

Before:
```ts
const DESCRIPTION = 'Practice sheets for jazz improvisation: every chord’s scale, guide tone lines and practice picks, written for your instrument.'
```
After:
```ts
const DESCRIPTION = 'Practice sheets for jazz improvisation: every chord’s scale, the changes with their guide tones, and practice picks, written for your instrument.'
```

In `web/nuxt.config.ts`, delete line 74:
```ts
        guideTones: true, // the Guide tones sheet in the preview (docs/plan-guide-tones.md); on since sign-off
```

In `web/package.json:16`, delete the substring `NUXT_PUBLIC_FEATURES_GUIDE_TONES=true ` (with its trailing space). The line becomes:
```json
    "e2e": "NUXT_PUBLIC_FEATURES_MY_CHARTS=true NUXT_PUBLIC_FEATURES_PRACTICE=true NUXT_PUBLIC_FEATURES_SCALE_LEVELS=true NUXT_PUBLIC_FEATURES_CHANGES=true NUXT_PUBLIC_FEATURES_FUNCTIONS=true NUXT_PUBLIC_FEATURES_KEY_SIGNATURES=true nuxt build && playwright test",
```

- [ ] **Step 6: Update the copy**

`web/app/pages/help.vue:28`. Before:
```vue
      <UiSubheading id="sheets">The three sheets</UiSubheading>
```
After:
```vue
      <UiSubheading id="sheets">The two sheets</UiSubheading>
```

`web/app/pages/help.vue:257`. Before:
```ts
  { id: 'sheets', title: 'The three sheets' },
```
After:
```ts
  { id: 'sheets', title: 'The two sheets' },
```

In `web/app/pages/help.vue`, delete lines 34–40:
```vue
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">Guide tones</strong> boils the tune down to the
        3rds and 7ths, the notes that tell you which chord you're on. It writes two lines on two staves, four bars to a
        system, and each line moves to the closest note it can, so you can hear how the harmony leans from one chord to
        the next. It's in 4/4 unless the chart says otherwise (<UiCode>time: 3/4</UiCode> for a waltz), and a chord lasts
        until the next bar number. Try singing or playing one line all the way through the tune; it's a great way to
        learn the changes.
      </UiText>
```

After the Changes paragraph, insert a new paragraph.

Before:
```vue
        <em>V7/ii</em> borrowing from the next. <strong class="font-semibold text-zinc-950 dark:text-white">Numerals</strong>
        and <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> turn those rows on and off.
      </UiText>
    </section>
```
After:
```vue
        <em>V7/ii</em> borrowing from the next. <strong class="font-semibold text-zinc-950 dark:text-white">Numerals</strong>
        and <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> turn those rows on and off.
      </UiText>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">3rd</strong> and
        <strong class="font-semibold text-zinc-950 dark:text-white">7th</strong> put the guide tones on the Changes staff in
        place of the slashes: each chord's 3rd (the 4th on a sus chord) and its 7th (the root on a triad, the 6th on a 6
        chord), the notes that tell you which chord you're on. There's one note per chord, held for as long as the chord
        lasts. With one on, it sits in the nearest octave; with both on, you get two voices on one staff that move by step,
        the 3rd and 7th trading places as the harmony leans from one chord to the next. Try singing or playing one line all
        the way through the tune; it's a great way to learn the changes.
      </UiText>
    </section>
```

`web/app/pages/help.vue:162`. Before:
```vue
          what you get without it). The guide tone sheet writes its rhythm in it.
```
After:
```vue
          what you get without it). With 3rd or 7th on, the Changes sheet writes its guide tones in it.
```

`web/app/pages/help.vue:221–222`. Before:
```vue
          pages, black on white whatever mode you're in: twelve staves a page for scales, eight systems a page for guide
          tones, eight lines a page for the changes. The dashed lines on screen show where each page starts. To get a PDF, pick "Save as PDF" in your
```
After:
```vue
          pages, black on white whatever mode you're in: twelve staves a page for scales, eight lines a page for the
          changes (fewer with guide tones on). The dashed lines on screen show where each page starts. To get a PDF, pick "Save as PDF" in your
```

`help.vue:99` and `:104` are Practice's guide tones and stay.

`web/app/pages/about.vue:17`. Before:
```vue
        harmony moves. Follow the guide tones, the 3rds and 7ths, through a tune. Or pick a few notes from each scale
```
After:
```vue
        harmony moves. Put the guide tones, the 3rds and 7ths, over the changes and follow them through a tune. Or pick a few notes from each scale
```

- [ ] **Step 7: Update the unit tests that named the old sheet**

In `web/test/cropBand.test.ts`:
1. Delete line 2:
   ```ts
   import { barAccidentals, GUIDE_MIN_BOTTOM, GUIDE_MIN_TOP } from '~/utils/guideToneDrawing'
   ```
2. Delete this test and the blank line before it (lines 19–23):
   ```ts

     it('takes a tighter minimum band for guide tone staves', () => {
       expect(cropBand([95, 100], GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM)).toEqual({ top: GUIDE_MIN_TOP, bottom: GUIDE_MIN_BOTTOM })
       expect(cropBand([30], GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM).top).toBe(6) // ledger lines still widen it
     })
   ```
3. Delete the whole `describe('barAccidentals', () => { … })` block and the blank line before it (lines 25–40).

In `web/test/EditorView.test.ts`, in Task 4's `describe('EditorView key signatures', …)`:

(1) Before:
```ts
  const mountWith = (shared: { sheet: 'scales' | 'guideTones' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, shared },
      global: { stubs: { ScaleSheet: true, GuideToneSheet: true, ChangesSheet: true } },
    })
```
After:
```ts
  const mountWith = (shared: { sheet: 'scales' | 'changes' }) =>
    mountSuspended(EditorView, {
      props: { initialText: KEYED, shared },
      global: { stubs: { ScaleSheet: true, ChangesSheet: true } },
    })
```

(2) Before:
```ts
  it("with the flag on, gives the scale and guide tone sheets the chart's key, and the Changes sheet signatures", async () => {
    useRuntimeConfig().public.features.keySignatures = true
    const scales = await mountWith({ sheet: 'scales' })
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const guide = await mountWith({ sheet: 'guideTones' })
    expect(guide.findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const changes = await mountWith({ sheet: 'changes' })
```
After:
```ts
  it("with the flag on, gives the scale sheet the chart's key, and the Changes sheet signatures", async () => {
    useRuntimeConfig().public.features.keySignatures = true
    const scales = await mountWith({ sheet: 'scales' })
    expect(scales.findComponent({ name: 'ScaleSheet' }).props('homeKey')).toEqual(expect.objectContaining({ name: 'Bb major' }))
    const changes = await mountWith({ sheet: 'changes' })
```

(3) Delete this line:
```ts
    expect((await mountWith({ sheet: 'guideTones' })).findComponent({ name: 'GuideToneSheet' }).props('homeKey')).toBeUndefined()
```

- [ ] **Step 8: Run the focused tests (expected: pass)**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx vitest run test/sheets.test.ts test/features.test.ts test/cropBand.test.ts test/EditorView.test.ts engine/__tests__/share.test.ts engine/__tests__/guideTones.test.ts engine/__tests__/guideToneTimeline.test.ts engine/__tests__/practice.test.ts engine/__tests__/changes.test.ts`

Expected: all pass. Practice's `preset: 'guideTones'` cases are untouched. The engine part of this step was checked on a scratch copy before Task 1 gained its `ignores a scale…` test: 25 files and 289 tests passed, and tsc and eslint were clean. With that test, expect 290.

- [ ] **Step 9: Check that nothing of the old sheet is left in the app and engine**

Run:
```bash
cd /Users/kevdog/Documents/code/jazz-scales && git grep -n -e GuideToneSheet -e GuideToneSystem -e guideToneDrawing -e buildGuideTones -e GuideSystem -e GuideBar -e GuideChord -e LegacyGuideNote -e "'guideTones'" -e "Guide Tones" -e GUIDE_TONES -e barAccidentals -e legacyAccidentals -e GUIDE_MIN -e editor.beats -e "three sheets" -e "guide tone sheet" -- web ':!web/e2e' ':!web/engine/practice.ts' ':!web/engine/__tests__/practice.test.ts' ':!web/test/PracticePanel.test.ts' ':!web/test/usePractice.test.ts' ':!web/engine/__tests__/share.test.ts' ':!web/engine/__tests__/guideTones.test.ts'
```
Expected output: nothing.
- The excluded files are Practice's `'guideTones'` preset, two tests that name the retired sheet on purpose (the share drop test, and the engine test that checks `buildGuideTones` is gone), and `web/e2e/`, which Task 6 rewrites.
- Untracked iCloud copies (`* 2.ts`) are outside `git grep`.

- [ ] **Step 10: Run the whole suite and lint**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint`

Expected: typecheck (nuxt, engine and e2e tsconfigs) and vitest pass, and eslint is clean. The e2e tsconfig still typechecks because the e2e files only call `chooseSheet(page, 'Guide Tones')` with a string. Don't run `make e2e` here; it is red until Task 6.

- [ ] **Step 11: Commit**

```bash
cd /Users/kevdog/Documents/code/jazz-scales && git add \
  web/engine/guideTones.ts web/engine/guideToneTimeline.ts web/engine/share.ts web/engine/chart.ts \
  web/engine/__tests__/guideTones.test.ts web/engine/__tests__/guideToneTimeline.test.ts web/engine/__tests__/share.test.ts \
  web/app/utils/sheets.ts web/app/utils/vexflow.ts \
  web/app/components/EditorView.vue web/app/components/PreviewControls.vue web/app/components/SheetPages.vue \
  web/app/composables/useFeature.ts web/app/composables/useChartEditor.ts \
  web/app/pages/help.vue web/app/pages/about.vue web/nuxt.config.ts web/package.json \
  web/test/sheets.test.ts web/test/features.test.ts web/test/cropBand.test.ts web/test/EditorView.test.ts
git status --short   # only the files above plus the four `git rm` deletions; no "* 2.ts" copies staged
git commit -F - <<'EOF'
Remove the Guide tones sheet

Guide tones are now the 3rd and 7th toggles on the Changes sheet. Deletes
GuideToneSheet, GuideToneSystem, guideToneDrawing and the engine's sheet model
(buildGuideTones and its types), the guideTones flag, the sheet's share-link
value and editor `beats`, and their tests; moves the timeline tests to their
own file; rewords help, about and the site description.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

#### Notes
- **Spec deviation:** an old link with `sheet: 'guideTones'` drops the field, so it opens the default view (Changes), not Scales as spec §4 says. The spec also says no links were shared. Task 6 Step 10 updates the spec line.
- **Left to Task 6:** every `web/e2e/` change (the old sheet's browser tests, the `fixtures.ts:53` comment, the `key-signatures.spec` rewrite) and every doc file.

---

### Task 6: Browser tests, print, and docs

This task brings the browser tests in line with Tasks 1–5: guide tones on the Changes sheet, the Changes sheet as the default view, and no Guide Tones sheet. Then it rewrites the docs and brings the spec in line with the two deliberate deviations.

**Files:**
- Modify: `web/e2e/fixtures.ts`:
  - line 1 (imports)
  - line 53 (the `chooseSheet` comment)
  - after line 69: add `writeChart`, `showGuides`, `guidesDrawn`, `GLYPH`, `Glyph`, `Drawn` and `drawn`
- Modify (full rewrite): `web/e2e/changes.spec.ts` (lines 1–65). The three existing tests are kept word for word, and 10 tests are added (11 runs: the four-chord-bar test runs at two widths).
- Modify (full rewrite): `web/e2e/key-signatures.spec.ts` (lines 1–85)
- Modify (full rewrite): `web/e2e/print.spec.ts` (lines 1–71)
- Modify: `web/e2e/editor.spec.ts`:
  - beforeEach (3–6)
  - intervals (81–82, 88–89)
  - delete 92–103, 119–127 and 211–219
  - practice (129–130, 134–135)
  - focus (149–150)
  - toolbar (229, 238)
  - spinner (255)
- Modify: `web/e2e/library.spec.ts:11`, `web/e2e/transposition.spec.ts:1,6,24`, `web/e2e/my-charts.spec.ts:1,91`
- Modify: `README.md:3-6,41`, `CLAUDE.md:4-7`, `docs/README.md:10,12`
- Modify: `docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md:129,133,147`
- Modify: `docs/design.md`:
  - 20–21, 44–45, 59, 64, 187–189
  - 293–325 (the Guide tone sheet and Changes sections)
  - 334, 339, 340–348
  - 387–388, 404–407, 477–479, 503–505
  - 610–611, 620, 633, 638, 664, 677, 682–683

**Interfaces:**
- Consumes:
  - Task 2:
    - The diagnostic `no guide tones for Cm7#5#9x (unknown chord quality)` appears in `ChangesSheet.vue`'s `<ul>`, and only with a guide on.
    - `changesLinesPerPage` drives the page sections.
  - Task 3:
    - The aria-label is `Bars: …; guide tones: <pitch> <label> / <pitch> <label>, … | …`, with pitches like `C5`.
    - The label row is the `<div>` right after the staff `<div>` in `ChangesSystem.vue`.
    - With two voices, upper ties curve up and lower ties curve down.
    - A tie still open at a line's end has `lastNote: null` and starts after its head; a line that starts tied gets a half-tie that starts at the stave's note start, before the first head.
    - The ending bracket comes from `setVoltaType`, drawn as direct-child `<rect>`s.
    - A rest goes in the upper voice with a `GhostNote` under it.
  - Task 4:
    - Buttons `3rd` and `7th` with `aria-pressed`.
    - A chart opens on the Changes sheet.
    - `csm-guide-3rd` and `csm-guide-7th` are remembered.
  - Task 5: the "Work on" options are exactly `Scales` and `Changes`.
- Produces (`web/e2e/fixtures.ts`):
  ```ts
  export async function writeChart(page: Page, text: string): Promise<void>
  export async function showGuides(page: Page, ...names: readonly ('3rd' | '7th')[]): Promise<void>
  export async function guidesDrawn(page: Page): Promise<void>
  export const GLYPH: { readonly flat: 0xe260; readonly natural: 0xe261; readonly sharp: 0xe262; readonly gClef: 0xe050; readonly fClef: 0xe062 }
  export type Glyph = Readonly<{ x: number; y: number; w: number; code: number }>
  export type Drawn = Readonly<{ width: number; heads: readonly Glyph[]; accidentals: readonly Glyph[]; rests: number; slashes: number; dots: number; stems: readonly Readonly<{ from: number; to: number }>[]; ties: readonly Readonly<{ x: number; y: number; control: number }>[]; clefs: readonly number[]; voltaBottom: number | null }>
  export const drawn: (svg: Locator) => Promise<Drawn>
  ```

**VexFlow 5.0.0 SVG facts the helpers rely on.** These were checked by rendering with the repo's `vexflow` package. Everything is in drawing units, and the staff lines are at y 80–120.

| What | Where in the SVG | Glyph or form |
| --- | --- | --- |
| Noteheads | `.vf-stavenote text` | U+E0A2 whole, U+E0A3 half, U+E0A4 black |
| Accidentals | the same group | U+E260 flat, U+E261 natural, U+E262 sharp. No `.vf-accidental` class. |
| Rests | the same group | U+E4E3 whole, U+E4E4 half, U+E4E5 quarter |
| Beat slashes | the same group | U+E100 |
| Augmentation dots | the same group | U+E1E7 |
| Stems | `.vf-stem path` | `d="M x yHead L x yTip"` |
| Ties | `.vf-stavetie path` | `d="M x y Q cx cy, …"` |
| Clefs | `.vf-clef text` | U+E050 G clef, U+E062 F clef |
| 1st/2nd ending bracket | `<rect>` elements that are direct children of the `<svg>` | |

- [ ] **Step 1: Run the browser suite to see what Tasks 4–5 broke**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make e2e`

Expected: FAIL. Most of these tests assume Scales opens first, or they use the deleted Guide Tones sheet.
- `library.spec.ts`, "searches the library and opens a chart": `Expected: 39, Received: 6`.
- Every `editor.spec.ts` test fails in its beforeEach (`Expected: 3`).
- `transposition.spec.ts`: "writes the sheet…" and "bass clef instruments…".
- `my-charts.spec.ts`: "a share link carries…", because `Where each scale starts` is not found.
- `key-signatures.spec.ts`: three tests.
  - "each sheet draws the clef and key signature once…": option `Guide Tones` not found.
  - "no key: line…": `staves(page).nth(1)` doesn't exist, because the two-bar chart opens on the Changes, one line.
  - "an @key draws no second signature…": `staves(page).nth(2)` doesn't exist, for the same reason.
  - "the signature is written for the instrument" and "sharp keys…" still pass: the Changes' first line is an `svg[role=img]` that carries the key signature.
- `print.spec.ts`: "prints 12 staves…" ×3, and "prints guide tones…" ×3 (option `Guide Tones` not found).

- [ ] **Step 2: Add the shared helpers to `web/e2e/fixtures.ts`**

Line 1. Before:
```ts
import { test as base, expect } from '@playwright/test'
```
After:
```ts
import { test as base, expect, type Locator, type Page } from '@playwright/test'
```

Line 53. Before:
```ts
/** choose a sheet (Scales / Guide Tones / Changes) from the toolbar's "Work on" dropdown */
```
After:
```ts
/** choose a sheet (Scales / Changes) from the toolbar's "Work on" dropdown; a chart opens on the Changes */
```

Append after line 69, the end of `openEditor`:
```ts

/** a new chart with this text, the editor open (it opens on the Changes sheet) */
export async function writeChart(page: Page, text: string): Promise<void> {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill(text)
}

/** turn on the Changes sheet's guide tone toggles, each confirmed pressed (retried: a click before hydration is lost) */
export async function showGuides(page: Page, ...names: readonly ('3rd' | '7th')[]): Promise<void> {
  for (const name of names) {
    const toggle = page.getByRole('button', { name, exact: true })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  }
}

/** wait until every Changes line has been drawn with its guide tones (each line draws on its own) */
export async function guidesDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; guide tones: '))))
    .toBe(true)
}

/** Bravura code points VexFlow draws as SVG text */
export const GLYPH = { flat: 0xe260, natural: 0xe261, sharp: 0xe262, gClef: 0xe050, fClef: 0xe062 } as const

/** a glyph's position (x: its left, y: its line) and advance width, in drawing units */
export type Glyph = Readonly<{ x: number; y: number; w: number; code: number }>
/** what VexFlow drew in one SVG, read from its glyphs and paths, in drawing units (the staff lines are at y 80-120) */
export type Drawn = Readonly<{
  width: number // the viewBox width: 300 a bar
  heads: readonly Glyph[]
  accidentals: readonly Glyph[] // on notes only (a key signature's are in .vf-keysignature)
  rests: number
  slashes: number
  dots: number
  stems: readonly Readonly<{ from: number; to: number }>[] // y at the notehead, y at the tip
  ties: readonly Readonly<{ x: number; y: number; control: number }>[] // start, and the first curve's control point y
  clefs: readonly number[]
  voltaBottom: number | null // the lowest point of a 1st/2nd-ending bracket; null for none
}>

export const drawn = (svg: Locator): Promise<Drawn> =>
  svg.evaluate((el): Drawn => {
    const code = (t: Element): number => t.textContent?.codePointAt(0) ?? 0
    const glyph = (t: Element): Glyph => ({ x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), w: (t as SVGTextElement).getBBox().width, code: code(t) })
    const within = (lo: number, hi: number) => (t: Element): boolean => code(t) >= lo && code(t) <= hi
    const nums = (p: Element): number[] => (p.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const notes = Array.from(el.querySelectorAll('.vf-stavenote text'))
    const volta = Array.from(el.querySelectorAll(':scope > rect')).map((r) => Number(r.getAttribute('y')) + Number(r.getAttribute('height')))
    return {
      width: Number(el.getAttribute('viewBox')?.split(' ')[2] ?? 0),
      heads: notes.filter(within(0xe0a0, 0xe0a4)).map(glyph),
      accidentals: notes.filter(within(0xe260, 0xe264)).map(glyph),
      rests: notes.filter(within(0xe4e0, 0xe4e7)).length,
      slashes: notes.filter(within(0xe100, 0xe10f)).length,
      dots: notes.filter(within(0xe1e7, 0xe1e7)).length,
      stems: Array.from(el.querySelectorAll('.vf-stem path')).map((p) => {
        const [, from = 0, , to = 0] = nums(p)
        return { from, to }
      }),
      ties: Array.from(el.querySelectorAll('.vf-stavetie path')).map((p) => {
        const [x = 0, y = 0, , control = 0] = nums(p)
        return { x, y, control }
      }),
      clefs: Array.from(el.querySelectorAll('.vf-clef text')).map(code),
      voltaBottom: volta.length ? Math.max(...volta) : null,
    }
  })
```

- [ ] **Step 3: Pin the tests that need the Scales sheet, and delete the old sheet's tests**

`web/e2e/editor.spec.ts`, beforeEach (3–6). Before:
```ts
test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1')
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
})
```
After:
```ts
test.beforeEach(async ({ page }) => {
  await page.goto('/song?new=1')
  await chooseSheet(page, 'Scales') // a chart opens on the Changes; these tests are about the scale sheet
  await expect(staves(page)).toHaveCount(3) // starter chart: 3 rows, from the root
})
```

`editor.spec.ts`, intervals (81–82). Before:
```ts
  await page.goto('/song?chart=footprints')
  const toggle = page.getByRole('button', { name: 'Intervals' })
```
After:
```ts
  await page.goto('/song?chart=footprints')
  await chooseSheet(page, 'Scales') // the Changes has no Intervals toggle
  const toggle = page.getByRole('button', { name: 'Intervals' })
```

`editor.spec.ts` (88–89). Before:
```ts
  await page.reload()
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveAttribute('aria-pressed', 'false') // remembered
```
After:
```ts
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveAttribute('aria-pressed', 'false') // remembered
```

In `editor.spec.ts`, delete lines 92–103, the test and the blank line after it. Its replacements are in `changes.spec`.
```ts
test('guide tones draw both lines, four bars a system, without the scale controls', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Guide Tones')
  await expect(page.getByText('Full Form, Alternate Changes · G minor · AAB (Guide Tone Lines)')).toBeVisible()
  await expect(page.locator('svg[aria-label^="Line 1:"]')).toHaveCount(8) // 32 bars
  await expect(page.locator('svg[aria-label^="Line 2:"]')).toHaveCount(8)
  await expect(page.getByLabel('Start on')).toHaveCount(0)
  await expect(page.getByText('From root', { exact: true })).toHaveCount(0)
  await chooseSheet(page, 'Scales')
  await expect(staves(page)).toHaveCount(39)
})

```

In `editor.spec.ts`, delete lines 119–127, the test and the blank line after it. It moves to `changes.spec`.
```ts
test('guide tone notation follows dark mode (no hard-coded black)', async ({ page }) => {
  await page.goto('/song?chart=f_jazz_blues')
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await chooseSheet(page, 'Guide Tones')
  await expect(page.locator('svg[aria-label^="Line 1:"]').first()).toBeVisible()
  const black = page.locator('svg[aria-label^="Line"] [stroke="black"], svg[aria-label^="Line"] [fill="black"], svg[aria-label^="Line"] [stroke="#000000"], svg[aria-label^="Line"] [fill="#000000"]')
  await expect(black).toHaveCount(0)
})

```

`editor.spec.ts`, practice (129–130). Before:
```ts
  await page.goto('/song?chart=autumn_leaves')
  const panel = page.locator('fieldset', { hasText: 'Practice' })
```
After:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // practice is on the scale sheet
  const panel = page.locator('fieldset', { hasText: 'Practice' })
```

`editor.spec.ts` (134–135). Before:
```ts
  await page.reload()
  await expect(page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })).toHaveAttribute('aria-pressed', 'true')
```
After:
```ts
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Guide tones' })).toHaveAttribute('aria-pressed', 'true')
```

`editor.spec.ts`, focus (149–150). Before:
```ts
  await page.goto('/song?chart=autumn_leaves')
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
```
After:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // 39 staves, 4 printed pages
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
```

In `editor.spec.ts`, delete lines 211–219, the test and the blank line after it. It moves to `changes.spec`.
```ts
test('a waltz’s guide tones are in 3/4: dotted halves, three beats a bar', async ({ page }) => {
  await page.goto('/song?chart=someday_my_prince_will_come')
  await chooseSheet(page, 'Guide Tones')
  const line1 = page.locator('svg[aria-label^="Line 1:"]').first()
  await expect(line1).toBeVisible()
  await expect(line1.locator('.vf-timesignature, g.vf-timesignature').first()).toBeAttached()
  await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
})

```

`editor.spec.ts`, tidy toolbar (229). Before:
```ts
  await pickOption(page, 'Where each scale starts', 'From C') // Scales with its Start on menu: the most controls
```
After:
```ts
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From C') // Scales with its Start on menu: the most controls
```

`editor.spec.ts` (238). Before:
```ts
  for (const sheet of ['Scales', 'Guide Tones', 'Changes']) {
```
After:
```ts
  for (const sheet of ['Scales', 'Changes']) {
```

`editor.spec.ts`, spinner (255). Before:
```ts
  await expect(staves(page)).toHaveCount(39) // drawn once VexFlow loads
```
After:
```ts
  await expect(staves(page)).toHaveCount(6) // drawn once VexFlow loads: Autumn Leaves opens on the Changes, six lines
```

`web/e2e/library.spec.ts:11`. Before:
```ts
  await expect(staves(page)).toHaveCount(39) // 39 rows, from the root
```
After:
```ts
  await expect(staves(page)).toHaveCount(6) // it opens on the Changes: 24 bars, four a line
```

`web/e2e/transposition.spec.ts:1`. Before:
```ts
import { chooseInstrument, expect, pickOption, staves, test } from './fixtures'
```
After:
```ts
import { chooseInstrument, chooseSheet, expect, pickOption, staves, test } from './fixtures'
```

`transposition.spec.ts` (6–7). Before:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await expect(firstStaff(page)).toContainText('C–7')
```
After:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales')
  await expect(firstStaff(page)).toContainText('C–7')
```

`transposition.spec.ts` (24–25). Before:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseInstrument(page, 'Trombone')
```
After:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // the start note is the scale sheet's
  await chooseInstrument(page, 'Trombone')
```

`web/e2e/my-charts.spec.ts:1`. Before:
```ts
import { chooseInstrument, expect, openEditor, pickOption, test } from './fixtures'
```
After:
```ts
import { chooseInstrument, chooseSheet, expect, openEditor, pickOption, test } from './fixtures'
```

`my-charts.spec.ts` (91–94). Before:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await openEditor(page)
  await page.getByLabel('chord for row 1', { exact: true }).fill('Cm9')
  await chooseInstrument(page, 'Tenor')
```
After:
```ts
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Scales') // From C and the practice picks are the scale sheet's; the link carries the sheet
  await openEditor(page)
  await page.getByLabel('chord for row 1', { exact: true }).fill('Cm9')
  await chooseInstrument(page, 'Tenor')
```

- [ ] **Step 4: Replace `web/e2e/changes.spec.ts` with this full file**

```ts
import type { Locator, Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, drawn, expect, GLYPH, guidesDrawn, openEditor, showGuides, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
/** the sheet itself, not the chart grid above it (whose menus name the same scales) */
const sheetOf = (page: Page) => lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
const guide = (page: Page, name: '3rd' | '7th') => page.getByRole('button', { name, exact: true })
/** a line's guide tone labels: the row between its staff and its numerals */
const labelRow = (line: Locator) => line.locator('xpath=../following-sibling::div[1]')
/** each chord's x on a line, as a fraction of its width (ChangesSystem sets a mark's left 0.012 before its beat) */
const chordXs = (line: Locator): Promise<number[]> =>
  line.evaluate((el) =>
    Array.from(el.closest('.break-inside-avoid')?.firstElementChild?.querySelectorAll(':scope > div') ?? []).map(
      (d) => Number.parseFloat((d as HTMLElement).style.left) / 100 + 0.012,
    ),
  )

/** every chord sits within 1% of the line's width of a notehead's centre */
async function expectChordsOnHeads(line: Locator): Promise<void> {
  const d = await drawn(line)
  const centres = d.heads.map((h) => (h.x + h.w / 2) / d.width)
  const xs = await chordXs(line)
  expect(xs.length).toBeGreaterThan(0)
  for (const x of xs) expect(Math.min(...centres.map((c) => Math.abs(c - x))), `chord at ${x.toFixed(3)}`).toBeLessThanOrEqual(0.01)
}

type Box = Readonly<{ left: number; right: number; top: number; bottom: number }>
const box = (g: Readonly<{ x: number; y: number; w: number }>, half: number): Box => ({ left: g.x, right: g.x + g.w, top: g.y - half, bottom: g.y + half })
const overlaps = (a: Box, b: Box): boolean => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

test('the Changes sheet: slashes, chords, numerals and scales, a repeat, and toggles that stick', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await chooseSheet(page, 'Changes')
  await expect(lines(page)).toHaveCount(6) // A1 · A2 played twice, then B: 24 bars, four a line
  const sheet = sheetOf(page)
  await expect(sheet.getByText('A1 · A2', { exact: true })).toBeVisible()
  await expect(sheet.getByText('ii7/♭III').first()).toBeVisible()
  await expect(sheet.getByText('D Phryg Dom').first()).toBeVisible()
  await expect(page.locator('section header p').first()).toHaveText(/\(Changes\)/)
  await expect(page.getByRole('button', { name: 'Intervals' })).toHaveCount(0) // per note: not on this sheet
  await page.getByRole('button', { name: 'Numerals' }).click()
  await expect(sheet.getByText('ii7/♭III')).toHaveCount(0)
  await page.getByRole('button', { name: 'Scales', exact: true }).click()
  await expect(sheet.getByText('D Phryg Dom')).toHaveCount(0)
  await page.reload()
  await chooseSheet(page, 'Changes')
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'false') // remembered
  await chooseInstrument(page, 'Tenor')
  await expect(sheetOf(page).getByText('A minor', { exact: true })).toBeVisible() // the key area, written for the tenor
})

test('a later copy is written out, a tag follows a double barline, and a share link opens on the sheet', async ({ page, browser }) => {
  await page.goto('/song?chart=a_night_in_tunisia')
  await chooseSheet(page, 'Changes')
  await expect(page.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await expect(page.getByText('Tag', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share' }).click()
  const link = await page.getByRole('dialog').getByLabel('Link').inputValue()
  const other = await browser.newContext()
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(lines(visitor).first()).toBeVisible()
  await expect(visitor.getByText('A3 (= A1)', { exact: true })).toBeVisible()
  await other.close()
})

test('a function from the dropdown: the Changes sheet shows it, its note opens from the keyboard, and keys change from the grid', async ({ page }) => {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n')
  const fn = page.getByLabel('function for row 2')
  await expect(fn.locator('option').first()).toHaveText('II7 → D Mixolydian')
  await page.getByRole('button', { name: 'Show notes' }).click()
  await expect(page.getByText('II7 in C, not resolving: natural tensions')).toBeVisible()
  await fn.selectOption({ label: 'V7/V (to G) → D Mixolydian' })
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 2 \| D7\s+\|\s+\| V7\/V/)
  await chooseSheet(page, 'Changes')
  const sheet = sheetOf(page)
  const numeral = sheet.getByRole('button', { name: 'V7/V' })
  await numeral.focus()
  await expect(page.getByRole('tooltip').filter({ hasText: '* V7/V in C: natural tensions' })).toBeVisible()
  await expect(page.getByRole('tooltip').filter({ hasText: 'in C major' }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip').filter({ hasText: 'V7/V in C' })).toBeHidden()
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7 | | Db: V7/ii\nA | 3 | Dm7\nA | 4 | G7\n')
  await expect(fn).toHaveAttribute('aria-invalid', 'true') // V7/ii in Db is Bb7, not D7
  await page.getByLabel('Key change at row 3').click()
  await expect(page.getByLabel('Chart text')).toHaveValue(/@key A 3 C\nA \| 3 \| Dm7/)
})

test('a chart opens on the Changes sheet, and Scales is the only other sheet', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await expect(page.getByRole('button', { name: 'Work on' })).toContainText('Changes')
  await expect(lines(page)).toHaveCount(6)
  await page.getByRole('button', { name: 'Work on' }).click()
  await expect(page.getByRole('option')).toHaveText(['Scales', 'Changes'])
  await page.keyboard.press('Escape')
})

test('the 3rd and 7th put each chord’s guide tone in place of its slashes, labelled, and stay on', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7sus4\nA | 2 | C6\nA | 2 | C\nA | 3 | Em7\nA | 3 | A7\nA | 4 | Dm7\nA | 4 | G7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7$/) // no guide tones yet
  await expect(guide(page, '3rd')).toHaveAttribute('aria-pressed', 'false') // off until turned on
  await expect(guide(page, '7th')).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await drawn(line)).slashes).toBe(16) // four bars of slashes
  await showGuides(page, '3rd')
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 G7sus4 \| C6 C \| Em7 A7 \| Dm7 G7; guide tones: /)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(8) // a half note a chord
  expect((await drawn(line)).slashes).toBe(0)
  await expect(labelRow(line)).toHaveText(/^\s*3\s*4\s*3\s*3\s*3\s*3\s*3\s*3\s*$/) // a sus chord's 4th
  await guide(page, '3rd').click()
  await showGuides(page, '7th')
  await expect(guide(page, '3rd')).toHaveAttribute('aria-pressed', 'false')
  await expect(labelRow(line)).toHaveText(/^\s*7\s*7\s*6\s*1\s*7\s*7\s*7\s*7\s*$/) // a 6 chord's 6th, a triad's root
  await showGuides(page, '3rd')
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(16)
  const both = await drawn(line)
  expect(both.stems.filter((s) => s.to < s.from)).toHaveLength(8) // the upper voice: stems up
  expect(both.stems.filter((s) => s.to > s.from)).toHaveLength(8) // the lower voice: stems down
  await expect(labelRow(line)).toHaveText(/^(\s*\d){16}\s*$/) // two labels a chord
  await expectChordsOnHeads(line)
  await page.reload()
  await expect(guide(page, '3rd')).toHaveAttribute('aria-pressed', 'true') // remembered
  await expect(guide(page, '7th')).toHaveAttribute('aria-pressed', 'true')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
})

test('both guide tones: the ii–V–I’s labels swap, and each voice’s ties curve away from the other’s', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 5 | CMaj7\n')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Dm7 \| – \| G7 \| –/)
  await showGuides(page, '3rd', '7th')
  await guidesDrawn(page)
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /; guide tones: C5 7 \/ F4 3/) // Dm7: C over F
  await expect(labelRow(line)).toHaveText(/^\s*7\s*3\s*3\s*7\s*$/) // Dm7 7 over 3, then G7 3 over 7
  await expect(labelRow(lines(page).nth(1))).toHaveText(/^\s*7\s*3\s*$/) // CMaj7: 7 over 3 again
  for (const svg of await lines(page).all()) {
    const { ties } = await drawn(svg)
    const up = ties.filter((t) => t.control < t.y)
    const down = ties.filter((t) => t.control > t.y)
    expect(up.length).toBeGreaterThan(0)
    expect(down).toHaveLength(up.length) // every held chord ties in both voices
    for (const u of up) expect(down.some((d) => Math.abs(d.x - u.x) < 3 && d.y > u.y), `the upper tie at x ${u.x} has a lower one under it`).toBe(true)
  }
})

test('a chord held over a line break: an open tie ends line 1, a half-tie starts line 2', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 3 | G7\nA | 6 | CMaj7\n') // G7: bars 3-5, across the break after bar 4
  await showGuides(page, '3rd', '7th')
  await guidesDrawn(page)
  const [one, two] = await Promise.all([lines(page).nth(0), lines(page).nth(1)].map(drawn))
  const lastHead = Math.max(...one.heads.map((h) => h.x))
  expect(one.ties.filter((t) => t.x >= lastHead - 3)).toHaveLength(2) // one open tie per voice, from bar 4's notes
  const firstHead = Math.min(...two.heads.map((h) => h.x))
  expect(two.ties.filter((t) => t.x < firstHead)).toHaveLength(2) // one half-tie in per voice, before bar 5's notes
})

test('guide tones are written for the part: a B♭ trumpet, and a bass clef within E2–C4', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await showGuides(page, '3rd', '7th')
  await chooseInstrument(page, 'Trumpet')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: (C\d 7 \/ F\d 3|F\d 3 \/ C\d 7)/) // concert C–7 is written D–7: 7th C, 3rd F
  await guidesDrawn(page)
  const trumpet = await lines(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await chooseInstrument(page, 'Trombone')
  await expect.poll(() => lines(page).evaluateAll((els, before) => els.every((e, i) => e.getAttribute('aria-label') !== before[i]), trumpet)).toBe(true)
  await expect.poll(async () => (await drawn(lines(page).first())).clefs).toEqual([GLYPH.fClef]) // line 1's clef
  await expect(page.locator('.vf-clef')).toHaveCount(1)
  const ys = (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.heads.map((h) => h.y))
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(70) // C4, a ledger line above the bass staff
  expect(Math.max(...ys)).toBeLessThanOrEqual(130) // E2, a ledger line below it
})

test('a waltz’s guide tones are in 3/4: a bar-long chord is a dotted half', async ({ page }) => {
  await page.goto('/song?chart=someday_my_prince_will_come')
  await showGuides(page, '7th')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /; guide tones: /)
  await expect(line.locator('.vf-timesignature').first()).toBeAttached()
  const d = await drawn(line)
  expect(d.heads).toHaveLength(4) // FMaj7 | B7#11 | BbMaj7 | D7alt, a bar each
  expect(d.dots).toBe(4)
  await expect(page.getByText(/Couldn.t draw/)).toHaveCount(0)
})

test('guide tone notes follow dark mode (no hard-coded black)', async ({ page }) => {
  await page.goto('/song?chart=f_jazz_blues')
  await page.getByRole('button', { name: /Switch to dark mode/ }).click()
  await showGuides(page, '3rd', '7th')
  await guidesDrawn(page)
  const black = page.locator(['stroke="black"', 'fill="black"', 'stroke="#000000"', 'fill="#000000"'].map((a) => `svg[aria-label^="Bars:"] [${a}]`).join(', '))
  await expect(black).toHaveCount(0)
})

for (const [width, bars] of [
  [1400, 4],
  [390, 2],
] as const) {
  test(`four chords a bar, both guide tones, ${bars} bars a line: no notehead or accidental collides, and each chord sits on its note`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await writeChart(page, 'title: T\nkey: C\nA | 1 | Em7\nA | 1 | A7\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | Ebm7\nA | 2 | Ab7\nA | 2 | Dbm7\nA | 2 | Gb7\nA | 3 | CMaj7\nA | 4 | C#m7b5\nA | 4 | F#7\n')
    await showGuides(page, '3rd', '7th')
    const line = lines(page).first()
    await expect(line).toHaveAttribute('aria-label', /^Bars: Em7 A7 Dm7 G7 \| Ebm7 Ab7 Dbm7 Gb7.*; guide tones: /)
    const d = await drawn(line)
    expect(d.width).toBe(300 * bars)
    expect(d.heads.length).toBeGreaterThanOrEqual(16)
    expect(d.accidentals.length).toBeGreaterThan(0)
    const boxes = [...d.heads.map((h) => box(h, 4.5)), ...d.accidentals.map((a) => box(a, 10))]
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b), `${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(false)))
    await expectChordsOnHeads(line)
  })
}

test('an unknown chord gets one rest for both voices, and a note above the sheet', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | Cm7#5#9x\nA | 3 | G7\nA | 4 | CMaj7\n')
  const line = lines(page).first()
  await expect(line).toHaveAttribute('aria-label', /^Bars: Dm7 \| Cm7#5#9x \| G7 \| CMaj7/)
  const note = page.getByRole('listitem').filter({ hasText: 'no guide tones for Cm7#5#9x (unknown chord quality)' })
  await expect(note).toHaveCount(0) // only with a guide on
  await showGuides(page, '3rd', '7th')
  await expect(line).toHaveAttribute('aria-label', /; guide tones: /)
  const d = await drawn(line)
  expect(d.rests).toBe(1) // never two stacked
  expect(d.heads).toHaveLength(6)
  await expect(note).toBeVisible()
})

test('on a line with an ending, the bracket clears the guide tones’ stems (B♭ part, both on)', async ({ page }) => {
  await page.goto('/song?chart=stardust')
  await chooseInstrument(page, 'Trumpet')
  await showGuides(page, '3rd', '7th')
  await guidesDrawn(page)
  let endings = 0
  for (const svg of await lines(page).all()) {
    const d = await drawn(svg)
    if (d.voltaBottom === null) continue
    endings += 1
    expect(d.stems.length).toBeGreaterThan(0)
    const tip = Math.min(...d.stems.map((s) => Math.min(s.from, s.to)))
    expect(d.voltaBottom, `${await svg.getAttribute('aria-label')}`).toBeLessThan(tip)
  }
  expect(endings).toBeGreaterThan(0) // the verse's 1st and 2nd endings
})
```

- [ ] **Step 5: Replace `web/e2e/key-signatures.spec.ts` with this full file**

```ts
import type { Page } from '@playwright/test'
import { chooseInstrument, chooseSheet, drawn, expect, GLYPH, guidesDrawn, showGuides, staves, test, writeChart } from './fixtures'

const lines = (page: Page) => page.locator('svg[aria-label^="Bars:"]')
const signatures = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-keysignature')
const clefs = (svg: ReturnType<Page['locator']>) => svg.locator('.vf-clef')
/** drawn glyphs in a signature group: one per sharp or flat */
const glyphs = (group: ReturnType<Page['locator']>) => group.locator('path, text')
/** the accidentals drawn on notes, every line in order (not the signature's) */
const noteAccidentals = async (page: Page): Promise<number[]> => (await Promise.all((await lines(page).all()).map(drawn))).flatMap((d) => d.accidentals.map((a) => a.code))

test('each sheet draws the clef and key signature once, at its start, guide tones or not', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).first()).toBeVisible()
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(signatures(staves(page).first())).toHaveCount(1)
  await expect(clefs(staves(page).nth(1))).toHaveCount(0)
  await expect(signatures(staves(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)

  await chooseSheet(page, 'Changes')
  await expect(lines(page).nth(1)).toBeVisible()
  await expect(clefs(lines(page).first())).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
  await expect(clefs(lines(page).nth(1))).toHaveCount(0)
  await expect(signatures(lines(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)

  // with both guide tones on: still line 1 only
  await showGuides(page, '3rd', '7th')
  await guidesDrawn(page)
  await expect(clefs(lines(page).first())).toHaveCount(1)
  await expect(signatures(lines(page).first())).toHaveCount(1)
  await expect(clefs(lines(page).nth(1))).toHaveCount(0)
  await expect(signatures(lines(page).nth(1))).toHaveCount(0)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('the signature is written for the instrument', async ({ page }) => {
  await page.goto('/song?chart=misty')
  await chooseSheet(page, 'Scales')
  const first = staves(page).first()
  await expect(signatures(first)).toHaveCount(1)
  await expect(glyphs(signatures(first))).toHaveCount(3) // E♭: three flats
  await chooseInstrument(page, 'Tenor')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(1) // F: one flat
  await expect(signatures(page.locator('body'))).toHaveCount(1)
})

test('no key: line, no signature, and the clef still once, guide tones too', async ({ page }) => {
  await writeChart(page, 'title: T\nA | 1 | C7 | C Half-Whole\nA | 2 | F7 | F Mixolydian\n')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).nth(1)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect(clefs(staves(page).first())).toHaveCount(1)
  await expect(clefs(page.locator('body'))).toHaveCount(1)
  await chooseSheet(page, 'Changes')
  await showGuides(page, '3rd', '7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: C7 \| F7.*; guide tones: /)
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect(clefs(lines(page).first())).toHaveCount(1) // a guide on: line 1 gets the clef, key or not
  await expect(clefs(page.locator('body'))).toHaveCount(1)
})

test('guide tones take their accidentals from the signature, and from C without a key:', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: F\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n')
  await showGuides(page, '3rd', '7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /^Bars: Gm7 \| C7 \| FMaj7.*; guide tones: /)
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(1) // F: one flat
  expect(await noteAccidentals(page)).toEqual([]) // the B♭s of Gm7 and C7 are in the signature
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Gm7\nA | 2 | C7\nA | 3 | FMaj7\n')
  await expect(signatures(page.locator('body'))).toHaveCount(0)
  await expect.poll(() => noteAccidentals(page)).toEqual([GLYPH.flat, GLYPH.flat]) // against C: a flat on each bar's B♭
})

test('an @key draws no second signature; the Changes sheet shows it as a key area', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | DMaj7\nA | 3 | EMaj7\n@key A 2 D\n')
  await chooseSheet(page, 'Scales')
  await expect(staves(page).nth(2)).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  await chooseSheet(page, 'Changes')
  await expect(lines(page).first()).toBeVisible()
  await expect(signatures(page.locator('body'))).toHaveCount(1)
  await showGuides(page, '3rd', '7th')
  await expect(lines(page).first()).toHaveAttribute('aria-label', /; guide tones: /)
  await expect(signatures(page.locator('body'))).toHaveCount(1) // the key change goes by accidentals, never a new signature
  const sheet = lines(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  await expect(sheet.getByText('D major', { exact: true })).toBeVisible()
})

test('sharp keys: the signature draws on the scale and Changes sheets', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: E\nA | 1 | EMaj7\nA | 2 | C#m7\nA | 3 | F#m7\nA | 4 | B7\n')
  await chooseSheet(page, 'Scales')
  await expect(glyphs(signatures(staves(page).first()))).toHaveCount(4)
  await chooseSheet(page, 'Changes')
  await expect(glyphs(signatures(lines(page).first()))).toHaveCount(4)
})
```

- [ ] **Step 6: Replace `web/e2e/print.spec.ts` with this full file**

```ts
import { chooseInstrument, chooseSheet, drawn, expect, guidesDrawn, pickOption, showGuides, staves, test } from './fixtures'

const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

// 39 rows at 12 staves per letter page, even when every staff has ledger lines (trombone from B)
for (const [instrument, start] of [
  ['Concert', null],
  ['Concert', 'C'],
  ['Trombone', 'B'],
] as const) {
  test(`prints 12 staves per letter page (${instrument}, from ${start ?? 'the root'})`, async ({ page }) => {
    await page.goto('/song?chart=autumn_leaves')
    await chooseSheet(page, 'Scales') // a chart opens on the Changes
    await chooseInstrument(page, instrument)
    if (start) {
      await pickOption(page, 'Where each scale starts', 'From C')
      await page.getByLabel('Start on').selectOption(start)
    }
    await expect(staves(page)).toHaveCount(39)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden() // editor hidden in print
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(4)
  })
}

// eight lines a page with guide tones off: a 32-bar AABA written out (Satin Doll) on one; Tunisia's nine lines (with the tag) on two
for (const [chart, pages] of [
  ['autumn_leaves', 1],
  ['satin_doll', 1],
  ['a_night_in_tunisia', 2],
  ['stardust', 2],
  ['its_you_or_no_one', 2],
] as const) {
  test(`prints the Changes eight lines a page (${chart})`, async ({ page }) => {
    await page.goto(`/song?chart=${chart}`)
    await chooseSheet(page, 'Changes')
    await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
    expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(pages)
  })
}

test('the Changes sheet shows 1st/2nd endings and a D.S. al Coda', async ({ page }) => {
  await page.goto('/song?chart=its_you_or_no_one')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.getByText('D.S. al Coda')).toBeVisible()
  await expect(page.getByLabel('Coda').first()).toBeVisible()
  await page.goto('/song?chart=stardust')
  await chooseSheet(page, 'Changes')
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.locator('svg[aria-label^="Bars:"] text', { hasText: '1.' }).first()).toBeVisible()
})

// the tallest Changes lines: both guide tones (two voices, stems both ways) with numerals and scales, a 1st/2nd ending
// raised above the stems, and a bass part below the staff (no library chart reaches E2, the range's floor: Stardust's
// trombone part goes to F♯2). Each sheet page holds changesLinesPerPage lines, so the PDF has as many pages as the
// sheet: a page that overflowed would add one
test('prints the Changes with both guide tones, a sheet page to a letter page, in the tallest case', async ({ page }) => {
  await page.goto('/song?chart=stardust')
  await chooseInstrument(page, 'Trombone')
  await showGuides(page, '3rd', '7th')
  await expect(page.getByRole('button', { name: 'Numerals' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Scales', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const all = await Promise.all((await svgs.all()).map(drawn))
  expect(all.filter((d) => d.voltaBottom !== null).length).toBeGreaterThan(0) // the verse's 1st and 2nd endings
  expect(Math.max(...all.flatMap((d) => d.heads.map((h) => h.y)))).toBeGreaterThanOrEqual(120) // on or below the bass staff's bottom line (G2)
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2) // at least one full page
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
```

- [ ] **Step 7: Run the changed browser tests**

Run: `cd /Users/kevdog/Documents/code/jazz-scales/web && npx playwright install chromium && npm run e2e -- e2e/changes.spec.ts e2e/key-signatures.spec.ts e2e/print.spec.ts e2e/editor.spec.ts e2e/library.spec.ts e2e/transposition.spec.ts e2e/my-charts.spec.ts`

This builds once with every flag on. After that, `npx playwright test <files>` reuses the build.

Expected: PASS.

If a guide tone assertion fails, the defect is in Tasks 1–4, not in the test. Use `superpowers:systematic-debugging` and fix it in the module that owns it:
- labels or the ii–V–I swap: the engine;
- tie direction, line-break ties, endings, rests or collisions: `changesDrawing.ts`;
- button state: `PreviewControls.vue`.

Adjusting the test is correct in only one place. If the tallest-case print count is off by one, Task 2's `changesLinesPerPage` numbers are too high. Lower them in `web/engine/changes.ts` and in the `fits 8 lines a page…` test in `web/engine/__tests__/changes.test.ts`, re-run `npx vitest run engine/__tests__/changes.test.ts test/ChangesSheet.test.ts`, and use the new numbers in Step 10's §6a text. Stage both changed engine files in the next commit.

- [ ] **Step 8: Typecheck and lint**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint`

Expected: PASS. `npm run typecheck` includes `tsc -p tsconfig.e2e.json` (lib `ES2023` + `DOM`), so the e2e code is typechecked.

- [ ] **Step 9: Commit the browser tests**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add web/e2e/fixtures.ts web/e2e/changes.spec.ts web/e2e/key-signatures.spec.ts web/e2e/print.spec.ts web/e2e/editor.spec.ts web/e2e/library.spec.ts web/e2e/transposition.spec.ts web/e2e/my-charts.spec.ts
git commit -F - <<'EOF'
e2e: guide tones on the Changes sheet, the Changes as the default view

Toggles, labels, two voices' stems and ties, ties over a line break, rests,
accidentals against the signature, B-flat and bass parts, a waltz, dark mode,
endings above the stems, no collisions in a 4-chord bar, and the tallest print
case. Scale-sheet tests now choose Scales; the Guide Tones sheet's tests are
gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

(If Step 7 retuned `changesLinesPerPage`, also add `web/engine/changes.ts web/engine/__tests__/changes.test.ts` to this `git add`.)

- [ ] **Step 10: Update the docs**

`README.md:3-6`. Before:
```
Chord-scale practice sheets from a chord chart, at [chordscalemaker.com](https://www.chordscalemaker.com). Each
chord in a chart gets one staff with the scale that goes with it, written for your instrument. Scales are computed
from their degree formulas, so spellings are always correct. There's also a guide tone sheet (each chord's 3rd and
7th, voice-led into two lines) and a practice mode that highlights a chosen set of notes.
```
After:
```
Chord-scale practice sheets from a chord chart, at [chordscalemaker.com](https://www.chordscalemaker.com). A chart
opens on the Changes sheet, a study lead sheet with each chord's Roman numeral and scale under it; its 3rd and 7th
toggles put each chord's guide tones on the staff, voice-led. The Scales sheet gives each chord one staff with the
scale that goes with it. Everything is written for your instrument, and scales are computed from their degree
formulas, so spellings are always correct. A practice mode highlights a chosen set of notes.
```

`README.md:41`. Before:
```
| `time: 3/4` | The metre: `2/4`, `3/4` or `4/4` (the default). The guide tone sheet writes its rhythm in it (the waltzes in the library say `3/4`). |
```
After:
```
| `time: 3/4` | The metre: `2/4`, `3/4` or `4/4` (the default). The Changes sheet writes its slashes and guide tones in it (the waltzes in the library say `3/4`). |
```

`CLAUDE.md:4-7`. Before:
```
Chord Scale Maker (www.chordscalemaker.com), a Nuxt web app in `web/` that turns a concert-pitch chord chart
(`charts/*.txt`) into chord-scale practice sheets, one staff per chord, written for a jazz instrument, plus guide
tone lines and practice highlighting. See README.md for the chart format. The original Python/LilyPond CLI was
retired after the `v1-launch` tag.
```
After:
```
Chord Scale Maker (www.chordscalemaker.com), a Nuxt web app in `web/` that turns a concert-pitch chord chart
(`charts/*.txt`) into practice sheets written for a jazz instrument: the Changes (a study lead sheet, the default
view, with optional guide tones on the staff) and the Scales (one staff per chord, with practice highlighting). See
README.md for the chart format. The original Python/LilyPond CLI was retired after the `v1-launch` tag.
```

`docs/README.md:10`. Before:
```
| [plan-guide-tones.md](plan-guide-tones.md) | Guide tone lines: the decisions, algorithm and print layout (done). |
```
After:
```
| [plan-guide-tones.md](plan-guide-tones.md) | Guide tone lines as their own sheet: the decisions, algorithm and print layout (historical: they are now two toggles on the Changes sheet). |
```

`docs/README.md:12`. Before:
```
| [plan-changes.md](plan-changes.md) | The Changes sheet: a study lead sheet with numerals and scales under the chords (done). |
```
After:
```
| [plan-changes.md](plan-changes.md) | The Changes sheet: a study lead sheet with numerals and scales under the chords (done). |
| [superpowers/specs/2026-10-10-guide-tones-on-changes-design.md](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md) | Guide tones on the Changes sheet, the Guide tones sheet removed, the Changes as the default view (done). |
```

`docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md:129`. Before:
```
  - On a line with voices and a volta: `shift = min(0, minStemTipY − MARGIN − (getYForTopText(5) + 1.5·spacing))`.
```
After:
```
  - On a line with voices and a volta: `shift = min(0, minInkY − MARGIN − (getYForTopText(5) + 1.5·spacing))`, where `minInkY` is the highest stem tip or notehead minus `ACCIDENTAL_RISE` (`voltaShift`): whole notes have no stem, and a flat rises above its head.
```

Same file, line 133. Before:
```
  - With voices: `cropBand([...headYs, ...stemTips], CLEF_BAND.top, CLEF_BAND.bottom)`. When the line has a volta, merge in `VOLTA_BAND.top + shift`.
```
After:
```
  - With voices: `cropBand([...headYs, ...stemTips], CLEF_BAND.top, CLEF_BAND.bottom)`. When the line has a volta, take in the bracket's measured top, `getYForTopText(numLines) + shift − VOLTA_PAD` (`voicedBand`); `VOLTA_BAND.top + shift` would clip it.
```

Same file, line 147. Before:
```
  - Remove `'guideTones'` from `ShareSheet` (:14) and the whitelist (:96). An old link falls back to Scales.
```
After:
```
  - Remove `'guideTones'` from `ShareSheet` (:14) and the whitelist (:96). An old link drops its `sheet` and opens the default view (Changes).
```

`docs/design.md:20-21`. Before:
```
The preview has two sheets: **Scales** (one staff per chord) and **Guide tones** (each
chord's 3rd and 7th, voice-led into two lines). Both are written for the chosen instrument.
```
After:
```
The preview has two sheets: **Changes** (the chart as a study lead sheet, the default view; its 3rd and 7th toggles
put each chord's guide tones on the staff, voice-led) and **Scales** (one staff per chord). Both are written for the
chosen instrument.
```

`docs/design.md:44-45`. Before:
```
    guideTones.ts         # guide tones per chord + the GuideToneSheet model
    guideToneTimeline.ts  #   when each chord starts and how long it lasts (4/4)
```
After:
```
    guideTones.ts         # guide tones per chord, voiced for the Changes sheet (guideVoices)
    guideToneTimeline.ts  #   when each chord starts and how long it lasts, in the chart's metre
```

`docs/design.md:59`. Before:
```
                          # GuideToneSheet, GuideToneSystem, ChordSymbol, NoteName
```
After:
```
                          # ChangesSheet, ChangesSystem, ChordSymbol, NoteName
```

`docs/design.md:64`. Before:
```
                          # vexflow (loader, scale staves, shared SVG helpers), guideToneDrawing,
```
After:
```
                          # vexflow (loader, scale staves, shared SVG helpers), changesDrawing,
```

`docs/design.md:187-189`. Before:
```
- **Metre:** a `time:` meta line, `2/4`, `3/4` or `4/4` (the default; anything else is a diagnostic). `chartBeats`
  gives the beats a bar; the guide tone timeline splits bars by it (3/4: one chord = 3 beats, two = 2 + 1) and the
  sheet draws its time signature and dotted halves. The scale sheet doesn't depend on it.
```
After:
```
- **Metre:** a `time:` meta line, `2/4`, `3/4` or `4/4` (the default; anything else is a diagnostic). `chartBeats`
  gives the beats a bar; the guide tone timeline splits bars by it (3/4: one chord = 3 beats, two = 2 + 1) and the
  Changes sheet draws its time signature, its slashes and, with guide tones on, its dotted halves. The scale sheet
  doesn't depend on it.
```

`docs/design.md:293-325`: replace everything from `### Guide tone sheet` through `share links carry them and the sheet).`. Before:
```
### Guide tone sheet

- **Model:** `engine/guideTones.ts` builds a `GuideToneSheet` (see [plan-guide-tones.md](plan-guide-tones.md)).
  - **Guide tones** come from the chord quality (3rd and 7th; 6 chords 3 + 6; sus4 4 + b7; triads 3 + root).
  - **Timeline** (`guideToneTimeline.ts`), in 4/4:
    - Rows in the same bar split it.
    - A chord lasts until the next change.
    - The last row runs to the end of the form: as long as the section it repeats, rounded up to whole 4-bar
      phrases.
  - **Voice leading** (`voiceLeading.ts`) picks both lines together, a Viterbi search over pairs, so the lines
    stay complementary (one on the 3rd, one on the 7th of every chord) with the least combined motion inside the
    part's range. Line 1 starts on the 3rd.
- **Drawing** (`utils/guideToneDrawing.ts`):
  - **Systems** have two staves, one per line, with the two voices of each bar formatted together so the bars
    line up.
  - **Notation:** the first system gets the clef and 4/4. Held chords are tied across barlines, left open at
    the end of a system. Accidentals follow bar rules.
  - **Chord symbols** sit over their beats and labels under the notes, both as HTML.
- **Width:** 4 bars a system, or 2 on phones (`useMediaQuery`), drawn at the same size per bar.

### Changes sheet ([plan-changes.md](plan-changes.md); the `changes` flag, on)

- A study lead sheet: `engine/changes.ts` `buildChanges(doc, part, barsPerLine)` lays the chart out in lines of four
  bars (two on phones), each section on a new line, one slash a beat in the chart's metre. Chords sit on their
  beats (the guide tone timeline's timing), each with its Roman numeral (`analysis/numerals.ts`) and its scale, both
  written for the part; key-area labels where the key changes; section markers; a `@copy` straight after its
  source folded into repeat signs ("A1 · A2"), a later one written out ("A3 (= A1)"); a double barline at the end
  of the form when a tag or coda follows (a coda or ending headed "after the last chorus"), a final one at the end.
- `ChangesSheet.vue` / `ChangesSystem.vue` draw it with `utils/changesDrawing.ts` (slash noteheads without stems,
  repeat and final barlines, the time signature on the first line); chords, numerals and scales are HTML placed at
  the slashes, each wrapping within the room up to the next chord. Eight lines a printed page (a 32-bar AABA).
- `Numerals` and `Scales` toggles replace Intervals on this sheet (`csm-numerals`, `csm-scale-names`, both on;
  share links carry them and the sheet).
```
After:
```
### Changes sheet ([plan-changes.md](plan-changes.md); the `changes` flag, on)

- **The default view:** a chart opens on the Changes; a share link may open it on Scales.
- A study lead sheet: `engine/changes.ts` `buildChanges(doc, part, barsPerLine, signatures, guides)` lays the chart
  out in lines of four bars (two on phones), each section on a new line, one slash a beat in the chart's metre.
  Chords sit on their beats (the guide tone timeline's timing), each with its Roman numeral (`analysis/numerals.ts`)
  and its scale, both written for the part; key-area labels where the key changes; section markers; a `@copy`
  straight after its source folded into repeat signs ("A1 · A2"), a later one written out ("A3 (= A1)"); a double
  barline at the end of the form when a tag or coda follows (a coda or ending headed "after the last chorus"), a
  final one at the end.
- **Timing** (`guideToneTimeline.ts`), in the chart's metre:
  - Rows in the same bar split it.
  - A chord lasts until the next change.
  - The last row runs to the end of the form: as long as the section it repeats, rounded up to whole 4-bar phrases.
- `ChangesSheet.vue` / `ChangesSystem.vue` draw it with `utils/changesDrawing.ts` (slash noteheads without stems,
  repeat and final barlines, the time signature on the first line); chords, numerals and scales are HTML placed at
  the slashes, each wrapping within the room up to the next chord. Eight lines a printed page (a 32-bar AABA), fewer
  with guide tones on (§6a).
- `Numerals`, `Scales`, `3rd` and `7th` toggles replace Intervals on this sheet (`csm-numerals`, `csm-scale-names`,
  both on; `csm-guide-3rd`, `csm-guide-7th`, both off; share links carry them and the sheet).

### Guide tones on Changes ([spec](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md))

- **What shows:** with **3rd** or **7th** on, each chord's slashes give way to one note, held for the chord's length
  and tied across barlines; a tie still open at a line's end continues as a half-tie on the next line. A chord with
  no guide tones gets a rest and the diagnostic `no guide tones for X (…)`.
- **Which tones** come from the chord quality (`TONES` in `engine/guideTones.ts`): the 3rd (a sus chord's 4th) and
  the 7th (a triad's root, a 6 chord's 6th).
- **Voicing:** one on: that degree alone, in the nearest octave (`voiceLeadOne`, the pair search over identical
  pitches), so it leaps where the pair would step. Both on: `voiceLead`, a Viterbi search over pairs, keeps the two
  voices complementary with the least combined motion inside the part's range (treble C4–A5, bass E2–C4); each pair
  is sorted by pitch, upper voice first. Over the library about 89% of moves are a step or less, the voices never
  cross, and they are never closer than a minor 3rd.
- **Model:** `guideVoices` voices the drawn rows before `buildChanges` splits them into lines, so 2 or 4 bars a line
  give the same pitches and a folded copy is voiced once. `ChangesBar.voices` holds each bar's `[line]` or
  `[upper, lower]` `GuideNote`s, and `ChangesChord.guide` each chord's labels, top to bottom. A 2nd ending is voiced
  from the 1st ending's last chord, in written order. Accidentals follow the measure rule over both voices together
  (`accidentalsInBar`), against the signature, or C without one.
- **Labels:** the degree without its accidental (`guideLabel`: `b3` → `3`, `bb7` → `7`), in a row under the staff,
  stacked when both are on; they print. They swap between voices as the line moves (7 over 3, then 3 over 7, through
  a ii–V–I).
- **Drawing** (`utils/changesDrawing.ts`; a line without voices draws its slashes as before):
  - Two passes: every bar's notes are formatted first; then the stem tips are read, an ending's bracket is raised
    above the highest (level across the line), and the staves and voices are drawn.
  - One note a chord, a dotted half for 3 beats, with the model's accidentals. Two voices: stems up and down, the
    upper voice's ties curving up and the lower's down; a rest goes in the upper voice with a `GhostNote` under it.
  - A third voice of `GhostNote`s keeps a position for every beat (`xs`), so chords, numerals and scales still sit
    over each chord's first note.
  - Line 1 gets the part's clef whenever a guide is on; the key signature only with signatures on.
  - The aria-label adds `; guide tones: C5 7 / F4 3, …` after `Bars: …`.
```

`docs/design.md:334`. Before:
```
- **Drawing space:** a scale staff is drawn 1200 units wide; guide tones use 300 units a bar.
```
After:
```
- **Drawing space:** a scale staff is drawn 1200 units wide; the Changes sheet uses 300 units a bar.
```

`docs/design.md:339`. Before:
```
  - Guide tone staves use a tighter one, just the clef, because their notes stay near the middle of the staff.
```
After:
```
  - Changes lines of slashes keep fixed bands (`BAND`, `CLEF_BAND`, `VOLTA_BAND`); a line with guide tones crops to
    its noteheads and stem tips, never inside `CLEF_BAND`, and takes in a raised ending bracket.
```

`docs/design.md:340-348`. Before:
```
- **Clefs and key signatures (the `keySignatures` flag, on):** the clef and the chart's key as written for the instrument
  (`keySignature` in `engine/keySignature.ts`; a minor key by its relative major, none without a `key:`), once at the
  start, as on a jazz lead sheet: the first staff of each scale sheet part (`StaffModel.showClefAndKey`), the first
  guide tone system and the first Changes line; every other staff, system and line has neither. The key is the
  chart's `key:` (`chartKeyOf`) throughout: key changes go by accidentals only, and show in the analysis (the
  Changes sheet's key-area labels), never as a new signature. Notes follow the measure rule (`accidentalsInBar`): an
  accidental shows only where it differs from what is in force in the bar; with no signature, guide tones keep the
  legacy rule (`barAccidentals`). The first Changes line uses a taller crop band (`CLEF_BAND`); guide tone sheets keep
  their own bands. With the flag off, every scale staff and guide tone system has its clef, as before.
```
After:
```
- **Clefs and key signatures (the `keySignatures` flag, on):** the clef and the chart's key as written for the instrument
  (`keySignature` in `engine/keySignature.ts`; a minor key by its relative major, none without a `key:`), once at the
  start, as on a jazz lead sheet: the first staff of each scale sheet part (`StaffModel.showClefAndKey`) and the
  first Changes line; every other staff and line has neither. With a guide tone on, the first Changes line gets the
  clef even with the flag off or without a `key:`. The key is the chart's `key:` (`chartKeyOf`) throughout: key
  changes go by accidentals only, and show in the analysis (the Changes sheet's key-area labels), never as a new
  signature. Notes follow the measure rule (`accidentalsInBar`): an accidental shows only where it differs from what
  is in force in the bar (guide tones: both voices together, against C without a signature). The first Changes line
  uses a taller crop band (`CLEF_BAND`). With the flag off, every scale staff has its clef, as before.
```

`docs/design.md:387-388`. Before:
```
  - `SegmentedControl`, the joined toggles (Scales | Guide tones, From | From root).
  - `PreviewControls`, the preview toolbar: Sheet, Instrument, From root/From X, then Intervals with the chart's actions (Transpose…, Focus, Print), a row of their own below lg and two by two on a phone.
```
After:
```
  - `SegmentedControl`, the joined toggles (From | From root).
  - `PreviewControls`, the preview toolbar: Sheet, Instrument, From root/From X, then Intervals (on the Changes: Numerals, Scales, 3rd and 7th) with the chart's actions (Transpose…, Focus, Print), a row of their own below lg and two by two on a phone.
```

`docs/design.md:404-407`. Before:
```
- **Guide tones:** 8 four-bar systems a page, so a 32-bar tune prints on one page and Milestones on two.
  - The chord row and spacing are shorter in print.
  - Print always uses 4 bars a system.
  - Systems never split across pages.
```
After:
```
- **Changes:** 8 four-bar lines a page with guide tones off, so a 32-bar AABA prints on one page.
  - With guide tones on, `changesLinesPerPage` (`engine/changes.ts`) gives fewer: 7 for one guide and 6 for both
    with numerals and scales, one more with both rows off. `print.spec.ts` prints the tallest case (both guides,
    numerals, scales, an ending and a bass part) a sheet page to a letter page.
  - The chord row and spacing are shorter in print; lines with a clef or guide tones close up (`print:space-y-0`).
  - Print always uses 4 bars a line.
  - Lines never split across pages.
```

`docs/design.md:477-479`. Before:
```
  - Immutable updates only. The sheet (scales or guide tones) and the mode are page state.
- **`usePreferences()`:** the instrument, the start note and the Intervals toggle, each a `storedRef` saved per
  browser. A stored value that isn't a known instrument or picker root falls back to the default.
```
After:
```
  - Immutable updates only. The sheet (the Changes, the default, or Scales) and the mode are page state.
- **`usePreferences()`:** the instrument, the start note, the Intervals toggle and the Changes sheet's toggles
  (Numerals, Scales, and the guide tones' 3rd and 7th, off until turned on), each a `storedRef` saved per browser. A
  stored value that isn't a known instrument or picker root falls back to the default.
```

`docs/design.md:503-505`. Before:
```
  - `myCharts` (My charts, New chart, Download/Open, share links), `guideTones` (the Guide tones sheet), `changes`
    (the Changes sheet),
    `practice` (the Practice panel) and `scaleLevels` (the Scale level control) are on, since sign-off.
```
After:
```
  - `myCharts` (My charts, New chart, Download/Open, share links), `changes` (the Changes sheet),
    `practice` (the Practice panel) and `scaleLevels` (the Scale level control) are on, since sign-off. Guide tones
    on the Changes sheet have no flag: their toggles start off.
```

`docs/design.md:610-611`. Before:
```
  - guide tones: the textbook ii–V–I, form lengths, ties, transposition, and a check that no library chart's
    lines leap more than a 5th (a 4th in the first charts)
```
After:
```
  - guide tones: the timeline (form lengths, metres), `voiceLeadOne` (the smoothest single line, its role and
    labels), the ii–V–I pair moving by step with its labels swapping, `guideVoices` (ties and `tiedIn`, dotted
    halves, the measure rule over both voices, rests for unknown chords, an unreadable scale ignored, the bass range),
    and library property tests with both on: at least 85% of moves are steps, the voices never cross, stay a minor
    3rd apart and never share a label, and no tie reaches into another block
  - the Changes sheet with guide tones: off is today's sheet, a folded copy is voiced once, a 2nd ending follows the
    1st ending's last chord, 2 and 4 bars a line give the same pitches, and `changesLinesPerPage`
```

`docs/design.md:620`. Before:
```
  - `ScaleSheet` pagination with `ScaleStaff` stubbed, and the guide tone sheet
```
After:
```
  - `ScaleSheet` pagination with `ScaleStaff` stubbed; `ChangesSheet` (the clef with a guide on, the print gap, lines
    a page) and the `ChangesSystem` label row
```

`docs/design.md:633`. Before:
```
  - guide tones
```
After:
```
  - guide tones on the Changes sheet: the 3rd and 7th toggles and their labels, two voices' stems and ties (and their
    half-ties over a line break), one rest for an unknown chord, accidentals against the signature, B♭ and bass-clef
    parts, a waltz, dark mode, endings above the stems, and no collisions in a 4-chord bar
```

`docs/design.md:638`. Before:
```
    - guide tones, 1 page for Autumn Leaves (concert and trombone) and 2 for Milestones
```
After:
```
    - the Changes, 8 lines a page with guide tones off, and the tallest guide tone lines at `changesLinesPerPage`
```

`docs/design.md:664`. Before:
```
   - Guide tone lines ([plan-guide-tones.md](plan-guide-tones.md)).
```
After:
```
   - Guide tone lines ([plan-guide-tones.md](plan-guide-tones.md)), later moved onto the Changes sheet
     ([the spec](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md)).
```

`docs/design.md:677`. Before:
```
4. **Staves per page.** 12 for scale sheets; 8 systems (32 bars) for guide tones.
```
After:
```
4. **Staves per page.** 12 for scale sheets; 8 lines for the Changes, fewer with guide tones on (`changesLinesPerPage`).
```

`docs/design.md:682-683`. Before:
```
7. **Guide tones:** 4/4 only, for now. Triads use 3 + root, because the root resolves by step from a V7 where
   the 5th would leap. The two lines are voice-led together, so they never collapse onto the same notes.
```
After:
```
7. **Guide tones** are two toggles on the Changes sheet (the separate sheet is gone), in the chart's metre. Triads
   use 3 + root, because the root resolves by step from a V7 where the 5th would leap. With both on, the two voices
   are voice-led together, so they move by step and never cross; one alone is voiced in the nearest octave.
```

- [ ] **Step 11: Check for stale mentions**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && grep -rn "GuideToneS\|Guide Tones\|guide tone sheet\|guideToneDrawing\|guide tone system\|(the Guide tones sheet)" README.md CLAUDE.md docs/design.md docs/README.md web/e2e`

Expected: no output.

Then run: `cd /Users/kevdog/Documents/code/jazz-scales && grep -n "falls back to Scales\|VOLTA_BAND.top + shift" docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md`

Expected: no output.

- [ ] **Step 12: Commit the docs**

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add README.md CLAUDE.md docs/design.md docs/README.md docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md
git commit -F - <<'EOF'
Docs: guide tones on the Changes sheet, the Changes as the default view

The spec now matches the two deliberate deviations: an old Guide tones link
opens the default view, and a voiced line crops to its bracket's measured top.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 13: Run the full suite**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint && make e2e`

Expected: all PASS.

#### Notes
- **The `keySignatures` flag off can't be tested in the browser,** because the e2e build turns every flag on. A chart without `key:` (written against C, so each B♭ gets a flat) stands in for it. Tasks 1 and 2 cover `keySig: null` and `buildChanges(…, signatures = false, guides)` in unit tests.
- **No library chart reaches E2.** Over the library in a bass part, the lowest note is F2, and Stardust (the only chart with `@ending`) goes down to F♯2. So the tallest-case print test checks for a note on or below G2.
- **The collision test is approximate.** It treats noteheads as ±4.5 units tall and accidentals as ±10, with 0.5 units of tolerance. If it fails while the drawing looks fine, check VexFlow's accidental columns before loosening the boxes.
- **The line-break test** relies on the default 1280-wide viewport (4 bars a line), so G7 (bars 3–5) crosses the break after bar 4 and CMaj7 fills bars 6–8 with no open tie at the end of line 2.

## Integrator notes

- No interface changes. Every exported signature and name is unchanged. Additions:
  - Task 1: a `guideVoices` test, `ignores a scale it cannot read rather than the chord`, and a same-label check in the library property test. These replace two old-sheet tests that Task 5 deletes.
  - Task 6: an e2e test, `a chord held over a line break…`.
  - Task 6: edits to spec lines 129, 133 and 147, staged in Step 12.
- Corrected counts and line numbers:
  - Task 1: Step 2 now expects `20 failed | 17 passed (37)` and Step 6 expects `37 passed`.
  - Task 5 Step 3 edit (1): now replaces lines 1–40, with line 41 blank and line 42 `describe`. Edit (2) is now 67–233, or 50–216 after edit (1).
  - Task 5 `share.ts`: the sheet line is 101 after Task 2.
  - Task 5 Step 8: now expects 290 engine tests.
  - Task 4 Step 2: `ChangesSheet.test.ts` has 4 new tests, and 3 of them fail.
  - Task 6: now adds 10 tests to `changes.spec`.
- Review Focus #4 now names Task 6's line-break test instead of a Task 3 tie-chain test that didn't exist.
- Rejected critique #4 (library-test timeouts): 726 `buildChanges` calls over the 242-chart library took 185 ms, measured with vite-node. The old `buildGuideTones` library test already runs voice leading over the library within vitest's default limit, so no `60_000` timeouts were added.
- Partly rejected critique #6 (key-signatures "all 5 fail"): only 3 fail. "The signature is written for the instrument" and "sharp keys" still pass, because the Changes' first line is an `svg[role=img]` (`vexflow.ts:69`) that carries the key signature. The plan's "four" was also wrong; Step 1 now says 3 and names them.
