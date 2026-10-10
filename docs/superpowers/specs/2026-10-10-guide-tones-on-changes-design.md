# Guide tones on the chord sheet: design

Date: 2026-10-10. Status: approved in brainstorming (decisions below); the design came from a planning workflow
(four code readers, three independent designs judged and merged, a completeness critic) and was measured against
the whole library (8,300 chords).

## Goal

The separate Guide tones sheet is redundant now that the Changes (chord chart) sheet exists. Guide tones become two
optional displays on the Changes sheet — each chord's 3rd and 7th as notes on the chord staff — and the Guide tones
sheet is removed. The Changes sheet becomes the default view.

## Decisions

| Question | Decision (the user's) |
| --- | --- |
| Display | Notes on the chord staff, in place of the beat slashes, timed to each chord. |
| Toggles | Two: **3rd** and **7th**. The register is always voice-led. Both on: two voices on one staff (stems up/down) that move by step; one on: that degree only, correctly labelled. |
| A lone line | Voiced on its own in the nearest octave (smoothest alone). A single line cannot move by step (ii–V–I 3rds go F→B→E); about 13% of its notes change octave when the other toggle is turned on. |
| Rhythm | One note per chord, held for the chord's length and tied across barlines and line ends. |
| Labels | The real degree: `3`/`7`, `4` on a sus chord, `1` on a triad, `6` on a 6 chord; accidentals dropped (`b3`→`3`). They print. |
| Clef and key signature | First line only, as for slashes; accidentals are against the signature on every line. |
| Old sheet | Removed outright. No redirects or backward compatibility (no links were shared). |
| Default view | The Changes sheet. |
| 2nd ending | Voiced from the 1st ending's last chord, in written order. |
| Rollout | One PR, no flag (the toggles default off). |

## What the measurements showed

- Both on: 89% of moves are a step or less (mean 1.2 semitones); the voices never cross and are never closer than a
  minor 3rd, so no notehead displacement is needed.
- One on: 28–29% of moves are steps; the median move is a 4th.
- The labels swap between voices as the line moves (upper voice 7, 3, 7… through ii–V–I): that is the exercise.
- With notes, numerals and scales all on, 8 lines no longer fit a printed page; lines per page drop to 6–7.

## 1. What the reader sees
- **Both toggles off:** today's sheet (`voices: []`, `guide: []`, slashes).
- **3rd on:** the slashes give way to one note per chord, held for the chord's length and tied across barlines.
  - A tie still open at a line's end continues as a half-tie into the next line.
  - A small label row under the staff shows `3`, or `4` on a sus chord.
- **7th on:** the same, labelled `7`, or `1` on a triad and `6` on a 6 chord.
- **Both on:** two voices on one staff, the upper with stems up and the lower with stems down.
  - Upper-voice ties curve up and lower-voice ties curve down.
  - Labels stack top to bottom, e.g. `7` over `3`, then `3` over `7`.
- **Labels** drop the flat or sharp: `b3`→`3`, `b7`/`bb7`→`7`. They print.
- **Clef:** line 1 always gets one when a guide is on, even with signatures off or a chart without `key:`. The key signature appears on line 1 only, and only with signatures on. Later lines have neither.
- **Endings:** on a line with an ending, the bracket is raised above the highest stem tip.
- **Everything else stays:** chord symbols, numerals, scales, markers and `×N` keep their places over each chord's first note.
- **Unknown chord:** a single rest, plus the diagnostic `no guide tones for X (…)`.

## 2. Engine
**`engine/guideTones.ts`** (slimmed):
```ts
export type GuideShow = Readonly<{ third: boolean; seventh: boolean }>
export const NO_GUIDES: GuideShow = { third: false, seventh: false }
export const guidesOn = (s: GuideShow): number => +s.third + +s.seventh
export type GuideNote = Readonly<{
  pitch: Pitched | null        // null: rest
  beat: number                 // start within the bar
  beats: 1 | 2 | 3 | 4
  tie: boolean                 // into this voice's next note (next bar or next line)
  tiedIn: boolean              // continues the previous note: no accidental, no label
  accidental: string | null    // measure rule across both voices; keySig null = C
}>
export const guideLabel = (degree: string): string => degree.replace(/^[b#]+/, '')
export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number }>
export function guideVoices(chords: readonly GuideInput[], part: Part, beats: 2|3|4, keySig: string | null, show: GuideShow): {
  bars: ReadonlyMap<number, readonly (readonly GuideNote[])[]>  // timeline bar → [line] | [upper, lower]
  labels: ReadonlyMap<number, readonly string[]>                 // row → labels top→bottom
  missing: readonly string[]
}
```
- **Keep** `TONES`, `guideToneDegrees` (Practice), `guideTonesFor`, `readable` and `notesFor`. Export `notesFor` and have it set `tiedIn`.
- **Delete** `GuideChord`, `GuideBar`, `GuideSystem`, `GuideToneSheet`, `buildGuideTones` and the old `GuideNote`.
- **`guideVoices` steps:**
  1. Run `guideTonesFor` on each chord.
  2. Both on: run `voiceLead`, then sort each pair by MIDI so the upper note comes first. One on: run `voiceLeadOne`.
  3. Split each note at barlines with `notesFor`.
  4. Bucket the pieces by `floor(start/beats)`.
  5. In each bar, run `accidentalsInBar` (`keySignature.ts:29`) over both voices merged: by beat, upper note first, `tiedIn` passed through. This is the only accidental rule.
  6. A null tone gives a rest in every shown voice and adds to `missing`.

**`engine/voiceLeading.ts`:** unchanged, plus one wrapper with no new search code:
```ts
/** one role alone: give both roles the same pitch, so the pair search's line 1 is the smoothest single line */
export function voiceLeadOne(tones: readonly (GuideTones | null)[], role: 0 | 1, clef: Clef): (Candidate | null)[] {
  const pick = (t: GuideTones) => (role ? t.seventh : t.third)
  return voiceLead(tones.map((t) => t && { third: pick(t), seventh: pick(t) }), clef)[0]
    .map((c) => c && { ...c, role }) // the pair search alternates roles over identical pitches; report the one asked for
}
```
My experiment ran exactly this wrapper, without the final `.map`.

**`engine/changes.ts`:**
- `ChangesBar.voices: readonly (readonly GuideNote[])[]` and `ChangesChord.guide: readonly string[]`.
- `buildChanges(doc, part, barsPerLine = 4, signatures = false, guides = NO_GUIDES)`:
  - After the blocks are built (:159), take the drawn rows: `blocks.flatMap(b => b.rows).filter(i => eventAt.has(i))`. A folded copy is absent, so what is drawn is what was voice-led.
  - Call `guideVoices` **before** `chunk`, so the pitches don't depend on 2 or 4 bars a line.
  - Fill `voices` from `bars.get(block.from + j)` and `guide` from `labels.get(i)`.
  - Add `missing` to the diagnostics only when a guide is on.
- `export function changesLinesPerPage(guides: GuideShow, rows: Readonly<{ numerals: boolean; scales: boolean }>): number`:
  - No guide: 8, whatever the rows (today's count).
  - With numerals and scales: start at 7 for one guide and 6 for both.
  - One more line when both rows are off.
  - Tune the numbers with `print.spec`.
- Edit the comment at `changes.ts:14`.

## 3. Drawing (`app/utils/changesDrawing.ts`)
- **Slash path:** when `!bar.voices.length`, today's code at :47-55 runs untouched.
- **Two passes for lines with voices:**
  1. Build every bar's stave and notes, `setStave`, and format.
  2. Read the stem tips with `getStemExtents()`.
  3. Set voltas using the line's shift.
  4. Draw the staves, then the voices.
- **Notes:**
  - `StaveNote({ keys:[toVexKey(p)], duration: DURATIONS[beats], clef, autoStem: one voice, stemDirection: ±1 for two })`.
  - `Dot.buildAndAttach` for 3 beats, `new Accidental(acc)` from the model, and `setStemStyle(INK)`.
  - A rest goes on `REST_KEY[clef]`. With two voices, the rest goes in the upper voice and a `GhostNote` of the same length fills the lower, so rests never stack.
  - `DURATIONS`, `REST_KEY` and `INK` move here.
- **Beat grid:** a third voice of `beats` × `GhostNote('q')`, formatted with `new Formatter().joinVoices(all).format(all, room)`.
  - `xs[bar][beat]` is the note's `headCentre` where a note starts. Otherwise it's the ghost's `getAbsoluteX()` plus half a notehead.
  - The `ChangesLayout` contract and `ChangesSystem.vue:73` don't change.
- **Ties:**
  - One `StaveTie` chain per voice across the line.
  - An open end gets `lastNote: null` (the pattern at guideToneDrawing.ts:120-128).
  - A line starting with a `tiedIn` note gets a `firstNote: null` stub.
  - With two voices, call `tie.setDirection(-stemDir)` on every tie and half-tie. VexFlow puts direction +1 below the head, so this makes upper ties curve up and lower ties curve down. With one voice, keep VexFlow's default.
- **Volta:**
  - On a line with voices and a volta: `shift = min(0, minStemTipY − MARGIN − (getYForTopText(5) + 1.5·spacing))`.
  - Apply the same shift to every bar's `setVoltaType(…, VOLTA_Y + shift)`, so the bracket stays level across the line.
- **Clef:** `opts.clef` stays one value. `ChangesSheet.vue:18` passes `part.clef` when `signatures || guide on`. The staff clef goes on line 1 only (`changesDrawing.ts:25`), and the key signature only when `bar.keySig` is set.
- **Crop:**
  - With voices: `cropBand([...headYs, ...stemTips], CLEF_BAND.top, CLEF_BAND.bottom)`. When the line has a volta, merge in `VOLTA_BAND.top + shift`.
  - Slash lines keep `BAND`/`CLEF_BAND` exactly.
- **Width and phones:** `lead`, `BAR_UNITS` and widths are unchanged. On phones, 2 bars a line only moves line breaks, giving more open ties at line ends.
- **aria-label:** keep the `Bars: …` prefix (tests use it) and append `; guide tones: C5 7 / F4 3, B4 3 / F4 7 | …`.
- **`ChangesSystem.vue` label row:**
  - A new row between the staff and the numerals, shown when a guide is on.
  - `aria-hidden`, small tabular digits at `m.x`.
  - Height `h-4 print:h-3` for one guide, `h-7 print:h-5` for two.
  - It redraws because `line` changes.

## 4. App
- **`usePreferences.ts`:** `guideThird` → `csm-guide-3rd` and `guideSeventh` → `csm-guide-7th`, stored as `'on'`/`'off'`, default **off**. Add both to `linkPreferences`.
- **`engine/share.ts`:**
  - Add optional `guideThird` and `guideSeventh` booleans, validated at :93-95. `VERSION` stays 1.
  - Remove `'guideTones'` from `ShareSheet` (:14) and the whitelist (:96). An old link falls back to Scales.
- **`PreviewControls.vue`:**
  - `defineModel('guideThird', { default: false })` and `defineModel('guideSeventh', …)`.
  - Buttons **3rd** and **7th** after Scales (:40), using the existing toggle pattern with `aria-pressed`.
  - Titles:
    - 3rd: "Each chord's 3rd (4th on sus chords), in the nearest octave; with 7th on, two voices that move by step"
    - 7th: "Each chord's 7th (root on triads, 6th on 6 chords), in the nearest octave; with 3rd on, two voices that move by step"
  - Drop the `guideTones` flag from the sheet filter (:89-91).
- **`EditorView.vue`:**
  - Add `v-model:guide-third/seventh` (:87-88) and `:guides` on `<ChangesSheet>` (:134).
  - Add both fields in `openShare` (:326-328).
  - Add `guides` in `reportError` (:392).
- **`app/utils/chartReport.ts`:** `ChartReport` gains `guides: string` (`''`, `'3rd'`, `'7th'` or `'3rd,7th'`), and `buildChartReport` prints a `guides:` line. Today a bug report can't reproduce a guide view.
- **`ChangesSheet.vue`:**
  - A `guides: GuideShow` prop, passed to `buildChanges` (:47).
  - The clef rule above (:18).
  - Gap class at :8 becomes `signatures || guidesOn(guides) ? 'print:space-y-0' : 'print:space-y-1'`.
  - `changesLinesPerPage(guides, { numerals, scales })` replaces `LINES_PER_PAGE` (:42).
- **Default sheet:** the Changes sheet is the default view (the sheet picker's fallback and a new chart's first view are `'changes'`, not `'scales'`). Any test that assumes Scales opens first is updated.
- **Flag: none.** Delete `guideTones`. The toggles default off, so the sheet looks the same until someone opts in.

## 5. Removal
- **Engine:**
  - Delete the sheet parts of `guideTones.ts` (above).
  - `index.ts:13,15` stay, since both modules survive.
  - Comments at `changes.ts:14` and `chart.ts:17,181`; `share.ts:14,96`.
- **App:**
  - Delete `components/GuideToneSheet.vue`, `components/GuideToneSystem.vue` and `utils/guideToneDrawing.ts`. That deletion also removes `legacyAccidentals` (:37).
  - `utils/sheets.ts:1-2,6`: remove the entry.
  - `EditorView.vue`: delete :138-149 and the guide branch at :224.
  - `useChartEditor.ts:66-67`: delete `beats` (its only use is EditorView:146).
  - `useFeature.ts:5`: remove `'guideTones'`.
  - Comments at `vexflow.ts:33-34` and `SheetPages.vue:28`.
  - Copy:
    - `help.vue:34-40`: delete.
    - `help.vue:162`: reword. The rhythm is now written on Changes when a guide is on.
    - `help.vue:221`: "eight systems a page for guide tones, eight lines a page for the changes" becomes "eight lines a page for the changes (fewer with guide tones on)".
    - `about.vue:17`: reword.
    - `help.vue:99` is Practice's guide tones and stays.
  - `nuxt.config.ts:22` DESCRIPTION, and the flag at `:74`.
  - `package.json:16`: remove `NUXT_PUBLIC_FEATURES_GUIDE_TONES=true`.
- **Tests:**
  - Delete `test/GuideToneSheet.test.ts`.
  - `test/cropBand.test.ts`: drop :2 and :20-40 (`GUIDE_MIN_*`, `barAccidentals`).
  - `test/EditorView.test.ts:148-172`: drop the guide stub and asserts.
  - `test/features.test.ts:15`.
  - `engine/__tests__/guideTones.test.ts`: move the timeline cases to `guideToneTimeline.test.ts` and delete the `buildGuideTones` cases.
  - `share.test.ts:16`: `'guideTones'` → `'changes'`.
  - e2e:
    - `editor.spec.ts`: :92-103, :119-126, :211-217, and `'Guide Tones'` at :238.
    - `print.spec.ts:24-42`.
    - `key-signatures.spec.ts:26-36,71-72`: rewritten, see section 6.
    - The `fixtures.ts:53` comment.
- **Docs:**
  - `README.md:5-6,41`; `CLAUDE.md:5-6`; the `docs/README.md:10` link.
  - `docs/design.md`: rewrite the guide sheet section as "Guide tones on Changes", move the timeline bullets under Changes, and fix the crop, print, flag and test lists.
  - `plan-guide-tones.md` stays as history.
- **Untouched:** Practice's "Guide tones" preset (`practice.ts:81`) and `guideToneDegrees`. `golden.json` doesn't cover guide tones or Changes, so no `make golden`.

## 6. Testing and rollout
- **Engine (TDD first):**
  - `voiceLeadOne` gives the smoothest single line. Every result's `role` is the one requested, and labels come from `pick(t).label`: `bb7`→`7` on dim7, `1` on a triad.
  - Both on: the ii–V–I pair moves by step, and its labels swap 7/3 → 3/7 → 7/3.
  - Sorted pairs never cross.
  - `guideLabel`.
  - `guideVoices`:
    - ties and `tiedIn`; a 3/4 dotted half;
    - merged accidentals: F#4 lower then F4 upper gives `n`;
    - F#4 held over the barline, then F#4 struck again in the same bar, gives `#`;
    - a lower note tied in, then an upper note on the same letter and octave, prints its accidental;
    - no key means C; an unknown chord (`Cm7#5#9x`) gives a rest and a diagnostic; bass range E2–C4.
  - `buildChanges`:
    - guides off equals today's output plus empty `voices`/`guide` (`changes.test.ts` has no whole-object `toEqual`);
    - a folded copy is voiced once;
    - 2 and 4 bars a line give the same pitches;
    - labels for C6, C7sus4 and a C triad.
  - Library property tests, both on:
    - at least 85% of moves are steps;
    - no crossings;
    - pairs are at least 3 semitones apart;
    - no `tie` reaches into another block, and every `tiedIn` piece's previous piece is in the same block.
  - `changesLinesPerPage`: 8 with no guide for all row combinations; fewer with guides.
  - `share.test`: the new fields round-trip, and `'guideTones'` is dropped.
- **App:**
  - Preference keys and defaults.
  - The buttons show on Changes only.
  - EditorView passes `guides`; `reportError` includes them; `chartReport` prints `guides:`.
  - The ChangesSystem label row.
  - `test/ChangesSheet.test.ts`: the clef prop is set when a guide is on and signatures are off; the gap class is `print:space-y-0` when a guide is on; the page count follows `changesLinesPerPage`.
- **e2e:**
  - `changes.spec.ts`:
    - the toggles replace the slashes; both on gives stems in both directions; `aria-pressed` survives a reload; label text;
    - a Bb trumpet part and a bass-clef part; a 3/4 waltz; dark mode (Changes has no dark-mode test today); chord x within 1% of the notehead.
    - Both on, tie paths curve away from each other: the upper tie's control point is above its ends, the lower tie's below.
    - A 4-chord bar with both on, on 2- and 4-bar lines: no notehead or accidental boxes overlap, and chord x is within 1%.
    - An unknown chord with both on: exactly one rest in the bar, and the diagnostic in `ChangesSheet`'s list.
    - `charts/stardust.txt` on a Bb part with both on: the volta bracket's box is above every stem tip on that line.
  - `key-signatures.spec` (rewrite :26-36 and :71-72 on Changes with both on):
    - one `.vf-clef` and one key signature on the page (line 1 only);
    - `key: F` with `Gm7 C7 FMaj7` draws no accidental glyph on its notes with signatures on, and a flat on the Bbs with signatures off (assert on the engine's `accidental` fields or on the SVG's accidental glyphs; VexFlow does not emit a `.vf-accidental` class here);
    - an `@key` draws no second signature.
  - `print.spec`:
    - today's counts with guides off;
    - worst case: both on + numerals + scales + a volta + a bass part with E2s fits `changesLinesPerPage` lines a page.
- **Rollout:** one PR from a branch. Run `make test`, `make lint` and `make e2e`, check the Vercel preview, and merge only on green.
