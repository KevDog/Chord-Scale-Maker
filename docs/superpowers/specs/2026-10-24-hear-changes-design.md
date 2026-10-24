# Hear changes: a piano and a bass under the click (#508, #539)

Roadmap Phase 3. The Changes sheet already knows each chord's scale at the sheet's level; this phase sounds the chart's
harmony from it, so a player can practise a Line (or play alone) over a rhythm section that follows the chart, the
level and a transposition.

## Decided (on autopilot; the owner may revisit)

- **Samples, not synthesis** (#508's open decision, #539): VSCO 2 CE, CC0. Piano: the Upright Piano used for the lead
  (#538), its softest dynamic, A2–A5 every major third, 4 s (`/sounds/comp/`, 1.8 MB). Bass: Solo Contrabass pizzicato,
  E1–E3 (`/sounds/bass/`, 1.0 MB). The synthesized tone stands in until a set loads or if it fails. Provenance:
  `design/sounds/README.md`. The orchestral pizzicato was replaced by D. Smolken's jazz upright (CC0, `/sounds/upright-bass/`).
- **Rootless voicings** (Levine, *The Jazz Piano Book*, ch. 4), pure in `engine/src/harmony.ts`:
  - four notes, form A from the 3rd (3 x 7 y) or form B from the 7th (7 y 3 x);
  - dominant 3 13 7 9; sus 4 5 7 9; major 7th 3 5 7 9 (♯11 for the 5 where the scale has it); minor 7th ♭3 5 ♭7 9 (11
    without a 9); half-diminished ♭3 ♭5 ♭7 9 or 11; diminished 7th ♭3 ♭5 𝄫7 9; 6 chords 3 5 6 9; triads 3 5 (6) 9;
  - each tension the one the chord's scale has (`ChangesChord.concertScale`, the scale the sheet plays at its level;
    the quality's default where the analysis doesn't reach): 9 prefers ♮9 then ♭9 then ♯9, 13 prefers ♮13 then ♭13;
  - voice leading: each chord's form and octave with the least total motion from the last (a light pull to the centre),
    its lowest note C3–C♯4, its top ≤ G5; the first chord nearest the centre.
- **Bass:** roots (a slash chord's bass), the octave nearest the last within E1–C3 (pulled to D2); Two-feel in an even
  metre: a whole-bar chord plays root on 1 and the 5th below on 3; odd metres play the root for the bar.
- **Timing:** a chord struck at its start, held to the next chord, struck again each bar it is held through (samples
  decay); both booked from the click's clock with `scheduleVoice`, so they follow the form's order, count-in and swing
  (beats are on the beat: swing leaves them).
- **Transposition:** the sheet's bars are built from the transposed document, so the changes play in the new key. No
  soft (semitone-offset) transposition exists in the app yet; when one does, it adds its offset to every midi here.
- **Controls:** under the click's ⋯ on the Changes sheet: **Piano** (checkbox) and **Bass** (Off / Roots / Two-feel),
  remembered in this browser (`csm-click`). Start waits for the sets (up to 1 s) when either is on.
- **Flag:** `harmony`, off; on in the e2e and a11y builds. Help (Piano and Bass), How it decides (`hear.harmony`).

## Left for later

- Comping rhythm (Charleston, anticipations), voicings by style, a walking line: #509's pattern sets.
- A mixer (levels per track): #509.
