# 7th chord arpeggios on Changes: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Builds on
[the guide tone lines spec](2026-10-10-guide-tone-lines-design.md) and its amendments.

## Goal

A second practice line on the Changes sheet: each chord's four chord tones, arpeggiated in time with the chart, so a
player can run the changes as 7th chords. Today the sheet offers one line, guide tones (From 3rd · From 7th); the user
picks between the two kinds of line.

## What changes in the product

- The **Guide Tones** segmented control becomes **Line: Off · Guide Tones · 7th Chords**, with a `<UiListbox>`
  beside it whose options follow the mode:
  - Guide Tones: From 3rd, From 7th (today's lines, unchanged).
  - 7th Chords: Up · root, Up · 1st inv, Up · 2nd inv, Up · 3rd inv, Down · root, Down · 1st inv, Down · 2nd inv,
    Down · 3rd inv, Up & down, Voice-led. Default Up · root.
  - Off: no listbox.
- No labels under the notes (the chord symbol is above; 16ths would crowd).
- Behind a new feature flag, `arpeggios` (off; e2e builds with it on).

## Definitions

- **Chord tones.** Four, from the chord's canonical quality, reduced from `CHORD_TONES` (`engine/src/practice.ts`):
  - a 7th chord: 1 3 5 7 as spelled (m7b5 keeps b5, 7#5 keeps #5, dim7 keeps bb7);
  - a triad: 1 3 5 8; a 6 chord: 1 3 5 6; a sus chord: 1 4 5 b7;
  - extensions and alterations other than the 5th are dropped (7#9 → 1 3 5 b7; Maj7#11 → 1 3 5 7);
  - an alt chord (no 5th in `CHORD_TONES`): 1 3 #5 b7.
  - A slash chord uses the chord as written; its bass is ignored (as guide tones).
  - Spelling follows the part's spelling of the chord (as the guide tones do).
- **Pattern.** The order of the four tones within one arpeggio:
  - Up · root 1 3 5 7; Up · 1st inv 3 5 7 1; Up · 2nd inv 5 7 1 3; Up · 3rd inv 7 1 3 5 — each note above the last.
  - Down · root 7 5 3 1 (down to the root); Down · 1st inv 1 7 5 3; Down · 2nd inv 3 1 7 5; Down · 3rd inv 5 3 1 7 —
    each note below the last, so each Down pattern ends on the tone its Up inversion starts on.
  - A triad has three tones; its fourth note is the arpeggio's first tone an octave on (Up · root 1 3 5 8,
    Up · 1st inv 3 5 8 3); it has no 3rd inversion (Up · 3rd inv plays root position).
  - Up & down: root position, alternating Up · root and Down · root each arpeggio (not each chord), starting Up.
  - Voice-led: ascending, starting on the chord tone nearest the previous note (ties: the lower).
- **Range** and **centre.** `rangeOf(part)`, as guide tones (`{ lo, hi, centre }`).

## Rules

1. **Timing.** Chords start and last as `guideToneTimeline` says (4/4: 1 chord = 4 beats, 2 = 2 + 2, 3 = 2 + 1 + 1,
   4 = 1 each; 3/4: 3, 2 + 1, 1 each; 2/4: 2, 1 + 1).
2. **Note value, per bar.** The longest of ♩, ♪, 𝅘𝅥𝅯 that gives the bar's shortest chord at least 4 notes. So in 4/4:
   one chord ♩, two ♪, three or four 𝅘𝅥𝅯; in 3/4 and 2/4: one chord ♪, more 𝅘𝅥𝅯. Every note in a bar has that value.
   A chord held over several bars is a one-chord bar in each.
3. **Filling.** A chord's slots in a bar are filled by repeating its pattern from the start (6 eighths in 3/4:
   1 3 5 7 1 3; 8 sixteenths over 2 beats: the arpeggio twice). A chord continuing into the next bar starts its pattern
   again there. Up & down alternates per arpeggio across the whole run, including repeats.
4. **Octave.** Each arpeggio is placed whole: its first note in the octave nearest the previous note, among the
   octaves that keep all its notes inside the range; if none does, the octave whose notes fall furthest inside (the
   fewest out). Equal distances: nearer the centre, then the lower. A repeat of the pattern within a chord is placed
   again by the same rule (so Up · root may restart an octave down, not climb off the range).
5. **Start.** A run's first arpeggio (the chart's start, or after a rest) is placed nearest the centre: the octave
   whose notes average nearest it (a tie: the higher).
6. **Rests.** A chord with no chord tones (N.C.) rests for its length and ends the run.
7. **Form.** Repeats and endings are voiced in written order, a 2nd ending from the 1st ending's last note; a folded
   `@copy` is voiced once (as guide tones).
8. **Accidentals.** The measure rule over the voice (`accidentalsInBar`), against the signature, or C without one.

## Engine

- `engine/src/arpeggios.ts` (pure): `arpeggioTones(quality)`, `noteValue(chordBeats, barBeats)`, `ARPEGGIO_PATTERNS`,
  `arpeggioVoices(input, pattern)` returning each drawn bar's notes. Reuses `guideToneTimeline`, `rangeOf` and the
  guide tones' spelling.
- `GuideNote.beats` widens to `0.25 | 0.5 | 1 | 2 | 3 | 4`. `SheetLine = GuideLine | ArpeggioPattern` (`'off'`,
  `'third'`, `'seventh'` or a pattern id); `buildChanges` and `changesLinesPerPage` take it in place of `GuideLine`;
  `ChangesBar.voice` holds the bar's notes either way; `ChangesChord.guide` stays empty for arpeggios.
- `changesLinesPerPage` gives the arpeggio line the same count as a guide tone line, unless a measured line needs
  fewer (16ths with ledger lines).
- New exports go into `index.ts` and the `api.test.ts` snapshot. Golden fixtures change only if they include voices;
  run `make golden` and review.

## Web

- `PreviewControls.vue`: the segmented control and the mode's listbox, using `ui/` components; phone layout as today.
- Preferences: `csm-line` (`off | guide | arpeggio`, default off), `csm-guide-line` (`third | seventh`, default third),
  `csm-arpeggio` (pattern id, default `up-root`). `csm-guide-line` loses its `off` value. No migration: nothing has
  been shared yet.
- Share links: `line` (a `SheetLine`, absent meaning off) replaces `guideLine`; no compatibility with the old field.
- `utils/changesDrawing.ts`: many notes a bar, beamed per beat (`Beam.generateBeams`, groups of a beat), stems
  automatic, no ties; the ghost voice still marks every beat so chords sit over their first note; the crop takes in
  noteheads, stems and beams. Line 1 gets the clef whenever a line is on.
- Aria-label: `; 7th chords: C4 E4 G4 B4, …` after `Bars: …`, one group a chord.

## Testing

- Engine unit tests first (TDD): chord tones per quality (triad, 6, sus, alt, m7b5, dim7, extensions), note value for
  every split in every metre, each pattern's order, filling and repeating, Up & down alternation across chords,
  voice-led nearest-tone start, octave placement against range edges, run start, rests, repeats and endings.
- Web unit: preference and share-link round trips.
- e2e: switch to 7th Chords, pick a pattern, beamed notes render, a 3/4 chart, print.

## Out of scope

Labels under notes, extensions (9ths, 13ths), patterns beyond the ten listed, playback.
