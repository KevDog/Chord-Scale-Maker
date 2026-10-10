# Guide tone ranges per instrument: design

Date: 2026-10-10. Status: approved in conversation (approach A, the cap, and the range table, with the user's vibes
edits); written spec awaiting review. Builds on
[2026-10-10-guide-tone-lines-design.md](2026-10-10-guide-tone-lines-design.md) and the roadmap entry "Guide tone
ranges per instrument".

## Goal

The guide tone lines take their written range and comfortable zone from the instrument, not the clef alone, so each
instrument's lines sit where it plays them, and the leaps forced by the treble C4 floor (most of the 18 moves over a
tritone left in treble) go away where the instrument reaches lower.

## Decisions

| Question | Decision |
| --- | --- |
| Comfortable zone | Moves with the instrument (the user's). |
| Scales sheet | Keeps its fixed written range; unchanged (the user's). |
| Where the ranges come from | Proposed from standard practical ranges and reviewed by the user (the user's choice); vibes edited by the user: range G3–D6, comfortable zone a fifth either side of C4–C5, clamped to the range (G3–G5). |
| Approach | A range on `Part` (the user's): `partFor(instrument)` carries it; the lines read `part.range`. |
| Readability cap | A line never needs more than two ledger lines: treble G3–D6, bass B1–F4 (written). Every instrument's range lies inside its clef's cap. |
| Fallback | A part without a range (`CONCERT`, a part built by hand) uses today's clef range (`RANGES`). |
| The rules | Unchanged: rule 1's start octave and rule 3's tie-break use the centre of the comfortable zone, rule 4 the range. |

## The ranges (written pitch)

"Line range" is the practical range for a guide tone line, inside the cap; the centre is the middle of the
comfortable zone. MIDI numbers in brackets (C4 = 60).

| Instrument | Clef | Line range | Comfortable | Centre |
| --- | --- | --- | --- | --- |
| concert | treble | C4–A5 (60–81) | E4–D5 (64–74) | A4 (today's) |
| piano | treble | C4–C6 (60–84) | E4–E5 (64–76) | B♭4 |
| vibes | treble | G3–D6 (55–86) | G3–G5 (55–79) | G4 |
| flute | treble | C4–C6 (60–84) | G4–G5 (67–79) | C♯5 |
| guitar | treble | A3–A5 (57–81) | A3–A4 (57–69) | D♯4 |
| trumpet, flugelhorn | treble | C4–G5 (60–79) | E4–E5 (64–76) | B♭4 |
| clarinet | treble | A3–C6 (57–84) | C4–C5 (60–72) | F♯4 |
| soprano, alto, tenor, bari sax | treble | B♭3–C6 (58–84) | D4–D5 (62–74) | A♭4 |
| horn | treble | C4–G5 (60–79) | E4–E5 (64–76) | B♭4 |
| trombone | bass | B♭2–E4 (46–64) | D3–D4 (50–62) | A♭3 |
| tuba | bass | C2–B♭3 (36–58) | F2–F3 (41–53) | B2 |
| bass | bass | E2–C4 (40–60) | G2–G3 (43–55) | C♯3 (today's) |

Guitar and bass are written an octave above where they sound, and so are tenor and bari sax beyond their key
transposition; the table is the written staff, which is what the lines are drawn on.

## 1. Engine

- `engine/instruments.ts`: `Range = Readonly<{ lo: number; hi: number; comfortLo: number; comfortHi: number }>` (MIDI,
  written); each `INSTRUMENTS` entry gains `range: Range` from the table. `CAPS: Record<Clef, { lo, hi }>` = treble
  55–86, bass 35–65.
- `engine/part.ts`: `Part` gains `range?: Range`; `partFor(name)` returns `{ clef, trans, range }`. `rangeOf(part)`:
  `part.range ?? RANGES[part.clef]`. `CONCERT` is unchanged (no range: today's clef range).
- `engine/guideToneLines.ts`: `guideToneLines(tones, range, blocks)` takes a `Range` instead of a `Clef` (octaves,
  centre, every use of `RANGES[clef]`); `guideVoices` and `buildChanges` pass `rangeOf(part)`.
- `engine/voiceLeading.ts`: `RANGES` keeps the clef defaults; `voiceLead` (used only by the comparison script) takes a
  `Range` too, so the comparison is like for like.
- `scripts/guideLines.ts`: `--instrument <name>` measures with `partFor(name)` (`--part bass` stays: concert bass
  clef).

## 2. App

Nothing to wire: the Changes sheet already builds with `partFor(instrument)`. Share links carry the instrument, so
they pick up the range. A part's range changes the drawn pitches only; the drawing already places ledger lines and
crops to what is drawn.

## 3. Testing

- Unit (TDD): every instrument's range lies inside its clef's cap and its comfortable zone inside its range;
  `partFor` carries the range; `rangeOf` falls back for `CONCERT`; `guideToneLines` with a vibes range goes below C4
  where the treble range turned up (e.g. the rule 4 floor case: C7 Ab Db7 — line A at C4 now steps down, not up);
  the existing rule tests keep `CONCERT`/bass and their pitches.
- Library test: both lines inside the part's range, for every instrument.
- e2e: on vibes, a chart whose line falls below C4 draws ledger lines below the staff and nothing collides (the
  existing collision check), at 4 and 2 bars a line.
- Measurement, before and after, in the PR: `npm run guide-lines -- --instrument <name>` for vibes, trumpet, tenor sax,
  guitar and trombone: shares, moves over a tritone, the largest move.
- Golden: no fixture change expected (the fixture doesn't cover guide tones).

## Out of scope

- The Scales sheet's range.
- A range the user sets by hand.
- Changing any guide tone rule.
