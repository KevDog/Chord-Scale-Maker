# Guide tone ranges per instrument: design

Status: implemented (branch guide-tone-ranges).

Date: 2026-10-10. Approved in conversation (approach A, the cap, the range table, a centre note in place of
the comfortable zone, vibes G3–D6 centre B♭4); written spec awaiting review. Builds on
[2026-10-10-guide-tone-lines-design.md](2026-10-10-guide-tone-lines-design.md) and the roadmap entry "Guide tone
ranges per instrument".

## Goal

The guide tone lines take their written range and their centre from the instrument, not the clef alone, so each
instrument's lines sit where it plays them, and the leaps forced by the treble C4 floor (most of the 18 moves over a
tritone left in treble) go away where the instrument reaches lower.

## How the two values are used

- **Line range** (`lo`–`hi`): the only limit on pitch. A guide tone is a candidate only in octaves inside it (rule 4);
  at its edges a line turns. Within it the line moves freely, always to the nearer tone.
- **Centre** (one note): where a line starts (rule 1, and rule 6's restart with nothing sounded before) and which of two
  equally near candidates wins (rule 3). Nothing else: it doesn't pull a line back.

The earlier "comfortable zone" is replaced by its centre: the lines only ever used the zone's midpoint.

## Decisions

| Question | Decision |
| --- | --- |
| Centre, not a zone | The user's: one centre note per instrument; a player's visual marker (vibes: the middle B♭, B♭4). |
| Scales sheet | Keeps its fixed written range; unchanged (the user's). |
| Where the ranges come from | Proposed from standard practical ranges and reviewed by the user (the user's choice); vibes set by the user: G3–D6, centre B♭4. |
| Approach | A range on `Part` (the user's): `partFor(instrument)` carries it; the lines read `part.range`. |
| Readability cap | A line never needs more than two ledger lines: treble G3–D6, bass B1–F4 (written). Every instrument's range lies inside its clef's cap. |
| Fallback | A part without a range (`CONCERT`, a part built by hand) uses today's clef range and centre (treble C4–A5, A4; bass E2–C4, C♯3). |
| The rules | Unchanged. |

## The ranges (written pitch)

MIDI numbers in brackets (C4 = 60). The other instruments' centres are the midpoints of the zones proposed earlier;
the user may move any of them to a better marker, as for vibes.

| Instrument | Clef | Line range | Centre |
| --- | --- | --- | --- |
| concert | treble | C4–A5 (60–81) | A4 (69, today's) |
| piano | treble | C4–C6 (60–84) | B♭4 (70) |
| vibes | treble | G3–D6 (55–86) | B♭4 (70) |
| flute | treble | C4–C6 (60–84) | C♯5 (73) |
| guitar | treble | A3–A5 (57–81) | D♯4 (63) |
| trumpet, flugelhorn | treble | C4–G5 (60–79) | B♭4 (70) |
| clarinet | treble | A3–C6 (57–84) | F♯4 (66) |
| soprano, alto, tenor, bari sax | treble | B♭3–C6 (58–84) | A♭4 (68) |
| horn | treble | C4–G5 (60–79) | B♭4 (70) |
| trombone | bass | B♭2–E4 (46–64) | A♭3 (56) |
| tuba | bass | C2–B♭3 (36–58) | B2 (47) |
| bass | bass | E2–C4 (40–60) | C♯3 (49, today's) |

Guitar and bass are written an octave above where they sound, and so are tenor and bari sax beyond their key
transposition; the table is the written staff, which is what the lines are drawn on.

## 1. Engine

- `engine/instruments.ts`: `Range = Readonly<{ lo: number; hi: number; centre: number }>` (MIDI, written); each
  `INSTRUMENTS` entry gains `range: Range` from the table. `CAPS: Record<Clef, { lo, hi }>` = treble 55–86, bass
  35–65.
- `engine/part.ts`: `Part` gains `range?: Range`; `partFor(name)` returns `{ clef, trans, range }`. `rangeOf(part)`:
  `part.range` or the clef default (`RANGES[clef]` as `{ lo, hi, centre }`). `CONCERT` is unchanged.
- `engine/guideToneLines.ts`: `guideToneLines(tones, range, blocks)` takes a `Range` instead of a `Clef` (octaves and
  centre); `guideVoices` and `buildChanges` pass `rangeOf(part)`.
- `engine/voiceLeading.ts`: `RANGES` becomes the clef defaults `{ lo, hi, centre }`. `voiceLead` (the comparison
  script's pair search) takes a `Range`; its comfort cost uses a band of the centre ± 5 semitones (today's treble band
  exactly; bass one semitone narrower each side), so the comparison stays like for like.
- `scripts/guideLines.ts`: `--instrument <name>` measures with `partFor(name)` (`--part bass` stays: concert bass
  clef).

## 2. App

Nothing to wire: the Changes sheet already builds with `partFor(instrument)`. Share links carry the instrument, so
they pick up the range. A part's range changes the drawn pitches only; the drawing already places ledger lines and
crops to what is drawn.

## 3. Testing

- Unit (TDD): every instrument's range lies inside its clef's cap and its centre inside its range;
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
