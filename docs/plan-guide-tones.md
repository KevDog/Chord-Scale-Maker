# Guide tone lines: plan

Status: **phase 1 (engine) built.** Web-only, like Transpose; the Python CLI is unchanged. Behind a `guideTones` feature flag
until it is signed off.

## Decisions

| | Decision |
|---|---|
| Lines | Both classic lines: line 1 starts on the first chord's 3rd, line 2 on its 7th |
| Rhythm | From bar numbers: a chord lasts until the next change |
| Meter | 4/4 for every chart (no time signature in charts yet; see "Time signatures") |
| Display | Two staves per system, one per line, with chord symbols above |
| Scope | Two-note lines (3rds and 7ths) only; no colour tones or approach notes yet |
| Triads, 6, sus | Defaults below, in one table so they're easy to change |

## 1. Engine: `web/engine/guideTones.ts` (pure, unit-tested)

**Guide tones per chord quality** (canonical qualities from `resolveQuality`):

| Quality | "3rd" | "7th" |
|---|---|---|
| Maj7 | 3 | 7 |
| 7, 7b9, 7#11, 7alt | 3 | b7 |
| m7, m7b5 | b3 | b7 |
| mMaj7 | b3 | 7 |
| dim7 | b3 | bb7 |
| 6 / m6 | 3 / b3 | 6 |
| 7sus4 | 4 | b7 |
| maj / m (triads) | 3 / b3 | 1: a triad has no 7th, and its root resolves by step from a V7 (F#→G), where the 5th would leap |
| extended symbols | their base quality when the rest is only alterations (Maj7#11 → Maj7, 7sus4b9 → 7sus4) |
| unknown quality | none: the chord gets no guide tones (shown as a rest with a note) |

Notes are spelled by letter from the chord's written root (`writtenChordRoot`), so transposing instruments and the
spelling rules are handled already.

**Timeline.** Rows come from `expandRows`, so `@copy` sections are included.
- **Start:** each chord starts at its bar. Rows with the same bar split it evenly: 2 chords make half notes, and 3
  make a half and two quarters. 4 make quarters, and more than 4 is a diagnostic.
- **Length:** a chord lasts until the next row's bar. In So What, Dm7 at bar 1 lasts 16 bars, until Ebm7 at bar 17.
- **Gaps and the last row:** a row whose next bar isn't later lasts one bar. Charts have no end marker, so the last
  row runs until the form ends: a final section that repeats an earlier one (A3 = A1) lasts as long as that one did,
  and the form rounds up to whole 4-bar phrases. So What comes out at 32 bars, Milestones 40, Footprints 12.
- **Bad bars:** a bar that isn't a whole number gets a diagnostic, and that row is treated as one bar.

**Voice leading.** The goal is the smoothest line. Each chord offers its two guide tones in every octave within the
part's range: treble written C4–A5 (comfortable E4–D5), bass written E2–C4 (comfortable G2–G3).
- **Search:** a best-path search (Viterbi) over those candidates finds the line with the least total motion.
- **Cost of a move:** the semitones moved, plus a penalty for a leap of more than 2 semitones, plus a penalty for
  each semitone outside the comfortable range.
- **Ties:** a common tone wins, then a step, then staying nearer the middle of the range.
- **Two runs:** line 1 must start on the 3rd and line 2 on the 7th. After that, the cheapest path decides, which
  gives the familiar 3rd↔7th trade on ii–V–I.

**Output.** One `GuideToneSheet` per part:
- **Systems** of 4 bars each. Every bar has chord symbols with their beat positions, and notes for both lines.
- **Notes:** each note has a pitch, a duration (w, h or q), a tie into the next bar when a chord is held, and a
  label (3, b7, …).
- **Long holds:** a chord held for many bars is drawn as one tied note per bar. That shows the length, and you can
  re-strike instead.
- **No DOM:** like `sheet.ts`, so all of this is unit-tested.

**Tests:**
- ii–V–I in C, which must give F F E and C B B as in the theory.
- Autumn Leaves, checking that no line moves more than 2 semitones on standard ii–Vs.
- So What, checking the long holds and ties.
- Two and three chords in one bar.
- Transposition: for tenor, the written line is a major 9th above concert.
- Bass clef range.
- Unknown qualities, gaps, and bars that aren't whole numbers.

## 2. Rendering: `drawGuideToneSystem` in `app/utils/vexflow.ts`

- **Layout:** a two-stave system, 4 measures wide, with barlines aligned across both staves. Each stave has a clef
  and a 4/4 time signature on the first system only.
- **Notes:** half, quarter and whole notes; ties across barlines.
- **Chord symbols:** above the top stave, at each chord's beat. VexFlow `ChordSymbol` gives the same glyphs as
  `ChordSymbol.vue`.
- **Labels:** small labels under each note (3, b7). These use the Intervals toggle. They show on screen only, as
  on the scale sheets.
- **Cropping:** each system is cropped to its notes, as `cropBand` does now.

## 3. UI

- **Sheet choice:** the preview gets **Scales | Guide tones**. Instrument, Start on (not used by guide tones) and
  Intervals work as now. Guide tones shows "Line 1 (from the 3rd)" and "Line 2 (from the 7th)" as the two staves.
- **Flag:** all of this is behind `useFeature('guideTones')`, off in production until sign-off. E2E builds with it
  on.

## 4. Print

- **Pages:** guide tone pages hold 8 systems (32 bars) each, under the chart's title.
- **Header:** the subtitle reads "Guide Tone Lines (Concert)", or the instrument's name for a transposing part.
- **Tests:** a new print test, Autumn Leaves guide tones, checks the page count and that nothing overflows.
  Scale-sheet printing stays unchanged.

## 5. Phases (each one a PR)

1. Engine: guide-tone table, timeline, voice leading, the sheet model, and tests.
2. Renderer and UI behind the flag, with screenshots in light, dark and at 375px.
3. Print layout and print E2E.
4. Sign-off, then turn the flag on in production.

## Time signatures

A time signature isn't needed to draw guide tone lines, but the rhythm depends on it. In 3/4, two chords in a bar
are a half plus a quarter, and in 6/4 they're dotted halves. Assuming 4/4 is right for most of the library.
Footprints (6/4) is the exception: its bars would show as 4/4 bars.

When a chart needs a different meter, add an optional `time: 3/4` meta line. Both engines would have to read it,
because the Python CLI otherwise rejects unknown lines, and the golden fixtures would test it. It isn't needed for
the first version.
