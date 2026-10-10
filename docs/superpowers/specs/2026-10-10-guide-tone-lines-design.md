# Guide tone lines from the 3rd or the 7th: design

Date: 2026-10-10. Status: approved (toggle semantics decided by the user; see "What changes in the product"). Builds on
[2026-10-10-guide-tones-on-changes-design.md](2026-10-10-guide-tones-on-changes-design.md).

## Goal

A guide tone line, as the exercise is taught, is a single voice that starts on the 3rd or the 7th of the first chord
and moves to the nearest guide tone of each chord that follows, so that it steps or holds almost everywhere. Today's
single-toggle line is the 3rd (or the 7th) of *every* chord, which cannot move by step (ii–V–I 3rds go F → B → E;
28% of its moves are steps). This spec gives the rules for the two classic lines — **from the 3rd** and **from the
7th** — so that they can be constructed deterministically from any chart.

## Definitions

- **Guide tones.** Each chord has two, taken from `TONES` in `engine/guideTones.ts` by its base quality: the "3rd"
  (3, b3, or 4 on a sus chord) and the "7th" (7, b7, bb7; 6 on a 6 chord; 1 on a triad). A slash chord uses the chord
  as written; its bass is ignored.
- **Move.** The distance in semitones from the line's current note to a candidate, measured to every octave of the
  candidate's pitch class that lies inside the part's written range (`RANGES` in `engine/voiceLeading.ts`). A move of
  0 is a *common tone*; 1 or 2 is a *step*; anything more is a *leap*.
- **Comfortable range** and **centre.** The comfortable sub-range of the clef (treble E4–D5, bass G2–G3) and its
  midpoint.
- **Line A** starts on the 3rd; **line B** starts on the 7th. Both are always constructed together (rule 7), whichever
  the reader has chosen to see.

## Rules

1. **Start.** Line A begins on the "3rd" of the first voiced chord, line B on its "7th", each in the octave nearest
   the centre of the comfortable range. Candidates outside the written range are never used (rule 4).

2. **Next note.** At each following chord, the line moves to whichever of that chord's two guide tones is the
   smaller move: a common tone before a step, a half step before a whole step, a step before a leap. The role of the
   note (3rd or 7th) is a consequence, not a constraint: the line alternates roles wherever roots move by 4th or 5th
   and keeps a role wherever that is nearer.

3. **Ties between candidates.** When both guide tones are the same distance away, take, in order:
   1. the one nearer the centre of the comfortable range;
   2. the lower one (the falling resolution is the idiom; 7ths fall).

4. **Range.** Only pitches inside the written range are candidates, so at the edge of the range the nearest octave of
   a tone may lie back toward the middle and the line turns there. No other octave displacement is made within a
   run: the line never re-strikes a tone an octave away on its own.

5. **Holds.** A chord that repeats the previous chord's guide tones (the same chord again, or a change of extension
   only — `C7` to `C7b9`) holds the note. A held note is tied across barlines and line ends, as today.

6. **Rests and unknown chords.** A chord with no guide tones rests in both lines and ends the run. After it, the lines
   restart by rule 1, in the octave nearest the last sounded note of each line (or the centre, if there is none).

7. **The two lines together.** The lines are complementary: at every chord they take different guide tones.
   1. Each line first chooses by rules 2–4 independently.
   2. If both choose the same tone, the line with the smaller move keeps it and the other takes the remaining tone in
      its nearest octave. If the moves are equal, the line moving down keeps it; if neither or both move down, line A
      keeps it.
   3. The lines may cross; on the staff the voices are sorted by pitch at each chord, as today.

8. **Labels.** Each note is labelled with the real degree, accidental dropped, as today (`3`, `7`, `4`, `6`, `1`).
   Because the role changes along the line, the labels under one line read, for a ii–V–I, `3 7 3` or `7 3 7`.

9. **Form.** Repeats and endings are voiced in written order; the second ending continues from the last chord of the
   first. The line does not loop: the last chord is not voiced with regard to the first.

10. **Spelling.** A guide tone keeps the spelling given by its chord (`guideTonesFor`), whatever octave rule 2 chose;
    accidentals follow the measure rule across both voices, as today.

## Worked examples (treble, concert)

**ii–V–I in C** — `Dm7 | G7 | Cmaj7 | Cmaj7`

| | Dm7 | G7 | Cmaj7 | Cmaj7 |
| --- | --- | --- | --- | --- |
| Line A | F4 (3) | F4 (7) | E4 (3) | E4 (3) |
| Line B | C5 (7) | B4 (3) | B4 (7) | B4 (7) |

Line A: F is the b7 of G7 (common tone), then falls a half step to E. Line B: C falls to B, the 3rd of G7, which
holds as the 7th of Cmaj7.

**Rhythm changes, bars 1–4** — `Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7`

| | Bb6 | G7 | Cm7 | F7 | Dm7 | G7 | Cm7 | F7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Line A | D5 (3) | B4 (3) | Bb4 (7) | A4 (3) | C5 (7) | B4 (3) | Bb4 (7) | A4 (3) |
| Line B | G4 (6) | F4 (7) | Eb4 (3) | Eb4 (7) | F4 (3) | F4 (7) | Eb4 (3) | Eb4 (7) |

Two rules show here. At `Bb6 → G7` line A has a tie (B4 and F5 are both 3 semitones from D5): rule 3 takes B4, nearer
the centre. At `F7 → Dm7` nothing is within a step of A4 (F4 is 4 below, C5 is 3 above), so the line leaps to C5, the
smaller move. Line B steps or holds throughout.

**A collision** — `Cmaj7 | Ebmaj7`

From E4 (line A) the nearer tone of Ebmaj7 is D4 (its 7th, a whole step down); from B4 (line B) it is also D (a minor
3rd up). Rule 7.2: line A's move is smaller, so A takes D4 and B takes G4, the 3rd, a major 3rd down.

## What changes in the product

- **Decision (the user's):** the toggles become **From 3rd** and **From 7th**: a line that starts there, rather than
  that degree on every chord. There is no toggle for "both degrees"; two lines on the staff means both start points.
  With both on, the display is unchanged in kind (two voices on one staff, sorted by pitch) and will be close to
  today's voice-led pair, since that pair is also complementary and nearly always stepwise.
- With one on, the single line steps or holds nearly everywhere, and its label row alternates `3` and `7`.
- `voiceLeadOne` is replaced by the rules above; `voiceLead` (the Viterbi pair search) can be replaced by the same
  rules or kept as a check against them. The golden fixture will change for every chart.

## Open questions

1. **Looping the form.** Rule 9 leaves the join from the last chord back to the first unvoiced. A lookahead could
   choose the starting octave so that the line also steps into its own repeat; worth measuring over the library.
2. **Greedy against global.** These rules are greedy, one chord at a time, so that a reader can apply them by hand.
   The pair search finds the globally smoothest lines. Measuring how often they differ over the 8,300 library chords
   would show whether the greedy lines ever paint themselves into a corner (a leap that a different earlier choice
   would have avoided).
3. **Tie-break order.** Rule 3 prefers the centre of the range before the falling resolution. The reverse is
   defensible; the two disagree only when the lower candidate is the one further from the centre.
