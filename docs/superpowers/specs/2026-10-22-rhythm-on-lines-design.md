# Rhythm on the Lines: pouring, pick-ups and anticipation (roadmap Phase 2)

Follows docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md (the roadmap), Phase 2, on top of
docs/superpowers/specs/2026-10-22-rhythm-line-design.md (the Phase 1 spec, cited as P1 §n). Phase 1 drew a rhythm only
while the Line is Off. This spec puts the Line *into* the rhythm.

## Intent

The Lines (7th Chords, Cells, Pentatonic, Triad pair, Quartal, Guide Tones) say *which notes* in a fixed rhythm: ♩ ♪ 𝅘𝅥𝅯
by the bar's shortest chord. Phase 1 gave the sheet a *when*. This spec joins them. With a Rhythm and a Line both on,
the Line's pitches are poured, in order, into the rhythm's attacks. Two more controls shape where each chord's notes
fall: a **Start** (Galper's pick-ups) and a **Timing** (Bergonzi's anticipate or resolve late). With Target beats on, a
note struck on a target beat shows whether it is a chord tone. Everything here is a view preference. Nothing is written
into chart rows, and nothing stored migrates.

## Decisions

### Settled by the roadmap (§9 item 4, §5 Phase 2, §7 items 5–7), per the roadmap's recommendation

1. **A rhythm under a Line replaces the ♩ ♪ 𝅘𝅥𝅯 rule.** While a Rhythm and a Line are both on, every line built on
   `cellVoices` takes the rhythm's attacks instead of the note-value rule (§1). Rhythm Off restores today's rule. This
   lifts P1 §8's rule that a rhythm draws only while the Line is Off: with the Line Off the rhythm line draws as now;
   with a Line on, the Line takes the rhythm and the slash rhythm line is not drawn. The description "Turn Line off to
   see the rhythm." is removed. No stored value changes meaning, so nothing migrates.
2. **Pouring.** A chord's pitches go in order into the attacks inside its span, one pitch an attack. Rests are skipped,
   and a tied attack holds its pitch. More pitches than attacks: the cell is cut. Fewer: the next cell, or the turn-back,
   by today's rules (§4).
3. **Start.** A listbox: *On the beat* (the default), *1-note pick-up* (the and of 4), *2-note pick-up* (beat 4) and
   *3-note pick-up* (the and of 3), after Galper. Pick-up notes are the previous cell's last notes, or, for a line's
   first chord or a chord after a rest, the scale notes below the target, drawn in the bar before. Pitches come only
   from the sheet: never a new melody. The sheet's very first bar takes no pick-up (§3.5). Preference `csm-rhythm-start`.
4. **Anticipate / Resolve late.** One control, −3 to +3 beats in ½-beat steps, 0 by default. The chord symbol stays
   where the chart has it. Preference `csm-anticipate`.
5. **Target tones on the Lines.** With Target beats on, a chord tone struck on a target beat takes the practice accent
   class (`vf-selected`), and a non-chord tone struck there takes the dimmed grey (`vf-dimmed`), as roadmap §6 says.
   No rule forces chord tones onto the dots: the sheet shows where a line is out of sync, in Galper's sense.
6. **Guide tones.** The guide line restates its note on each attack within the chord only when **Restate** is on. Off
   by default (§5).
7. **Tiers and flag.** Start and Timing show at Everything. Rhythm and Target beats stay at Intermediate. Share links
   carry the start, the timing and Restate. Everything sits behind the existing flag `rhythm`; there is no new flag.
8. **Print.** A poured Line counts as a voiced line in `changesLinesPerPage`, as the rhythm line already does (P1 §8).
   `print.spec` measures Stardust and a 5/4 chart with poured lines (§9).

### Decided by this spec

9. **Start, Timing and Restate need a Rhythm and a Line that takes it.** Otherwise they are hidden and change nothing.
   With Rhythm Off and Target beats off, the sheet is exactly today's. (Target beats on colors a Line's notes with or
   without a Rhythm: D18.) *Reason:* the ♩ ♪ 𝅘𝅥𝅯 rule fills every slot, so a pick-up there would have to invent a
   rhythm.
10. **Pick-up positions are pulses of the rhythm.** An N-note pick-up is the N pulses just before the target. With 8ths,
    these are exactly Galper's positions: the and of 4; 4 and the and of 4; the and of 3, 4 and the and of 4. With
    quarters they are beats; with triplets and 16ths, the pulses before the beat. *Reason:* the pick-up then always
    draws in the rhythm's own notation, and no pulse is mixed into another.
11. **Every chord change takes the pick-up, not only phrase entries.** Both the target and the pick-up pulses are struck
    even where the rhythm rests or holds there (§3.2). *Reason:* in the middle of a line, "the previous cell's last
    notes" are already sounding, so a pick-up rule limited to phrase entries would change almost nothing. Forcing the
    attacks is what makes every chord a target, which is Galper's "everything is a pick-up". On the beat leaves the
    rhythm untouched.
12. **The target is the chord's start** (after the Timing shift), not the first target beat in its span. *Reason:* a
    chord that starts on a weak beat would otherwise play the chord before's notes over its own harmony. Target-tone
    color shows when such a start falls off the dots.
13. **The sheet's first bar takes no pick-up and gets no pick-up bar.** Its first chord's target is still struck.
    *Reason:* an anacrusis bar would shift every bar of the sheet, its line breaks and its print count. When the form
    repeats, its last bar already leads back into bar 1 the way any cell leads into the next.
14. **No pick-up or anticipation across a break** (a 2nd or later ending, P1's `breaks`). The ending's first chord
    starts on its beat. *Reason:* the bar drawn before a 2nd ending is the 1st ending's, which the player has jumped
    over.
15. **Under a rhythm, cells count by chord across barlines.** A cell runs on over the barline, and the turn-back happens
    at the chord's end, as `carry` and `turn: 'chord'` do today. *Reason:* a rhythm ignores barlines (P1 §4), so
    restarting a cell at each barline would cut the unit's grouping for no reason.
16. **Scale-below pick-ups follow the target chord's shown scale** (`shown ?? scale`, as the Approach's diatonic steps
    do). Where the chord has no scale, or a note would fall outside the part's range, that attack rests.
17. **Guide Tones without Restate ignore the rhythm.** The guide line holds its notes as today, and the rhythm is not
    drawn. The Rhythm control's description says so: "Guide tones hold each chord's note. Turn on Restate to play it in
    the rhythm." Restate is a toggle in the Line options, shown with Guide Tones while a Rhythm is on, at Intermediate
    (with the Rhythm, so that its description never points at a hidden control). Preference `csm-guide-restate`.
18. **Target tones compare against the chart's chord at that beat,** not the chord whose cell the note belongs to, and
    only on struck notes (a tied-in note is never colored). Target colors on the Lines need Target beats on, with or
    without a Rhythm, on every Line including the guide line. With Target beats off, nothing is colored. *Reason:*
    synchrony is about the harmony sounding at that moment, and Target beats is a Show toggle independent of the rhythm
    since Phase 1.
19. **A poured Line draws the rhythm's accents and triplet brackets but not Saindon's bracket.** *Reason:* the beams
    already show the grouping. The bracket sits under the staff, where low notes and the label rows are.
20. **The caption names the start and the timing:** "Rhythm: 8ths in 5, with accents · back on one every 5 bars ·
    2-note pick-ups · anticipate 1½ beats". The defaults add nothing.
21. **Share-link field names.** `rhythmStart`, `anticipate` and `restate`. `start` is already the spelling's note.
22. **One control id for Start and Timing:** `rhythm-phrasing`, at Everything. It is listed as a hidden setting when
    either is away from its default while a rhythm is on and the Line takes it (`takesRhythm`), so the notice never
    names a setting that does nothing.
23. **The golden fixture gains nothing.** Poured lines are tested by unit tests and e2e, as the Lines are. `make golden`
    still runs after the `cellVoices` change, to show that no answer moved with Rhythm Off.
24. **The Approach still applies under a rhythm.** Its figure takes the pitches of the chord before's last attacks in
    the rhythm's own values, as the 7th Chords and Cells lines do today (`withApproach`). It never replaces a
    scale-below pick-up. The guide line's Approach under Restate works the same way.

## Goals

1. The rhythm's attacks drive every line built on `cellVoices`, and drive the guide line under Restate.
2. Start: pick-ups into each chord's target, with pitches from the sheet.
3. Timing: anticipate or resolve late by up to 3 beats, in ½ beats.
4. Target tones on the Lines.
5. Controls, preferences and links; print and a11y.

## Non-goals

- The Scales and Arpeggios sheets (Phase 3). Mixed phrasing, gears and quintuplets (Phase 4). Sound (Phase 5).
- A melody of any kind: every pitch comes from the sheet's cells, guide tones or scales.
- A pick-up bar before the sheet's first bar (Decision 13).
- Reproducing anything from the three books. The Help page cites them by title and page.
- A release note: the item is held until the `rhythm` flag flips. The PR body says
  "Release notes: none — the rhythm flag is off".

## Design

### 1. Which lines take the rhythm

| Line (`ChangesLineChoice`) | Built by | Under a rhythm |
| --- | --- | --- |
| 7th Chords (an `ArpeggioPattern`) | `arpeggioVoices` → `cellVoices` | pours |
| Cells (`kind: 'cells'`) | `cellsVoices` → `cellVoices` | pours |
| Pentatonic (`kind: 'pentatonic'`) | `pentatonicVoices` → `cellVoices` | pours |
| Triad pair (`kind: 'triad-pair'`) | `triadPairVoices` → `cellVoices` | pours |
| Quartal (`kind: 'quartal'`) | `quartalVoices` → `cellVoices` | pours |
| Guide Tones (`'third'`, `'seventh'`) | `guideVoices` | with Restate on, pours its one note a chord through `cellVoices` (§5); otherwise as today |

`takesRhythm(line: ChangesLineChoice, restate: boolean)`, exported by the engine (`changes.ts`), is true for the first
five rows, and for a guide line with `restate`. It is the only copy: the web calls it on the line it already builds
(`changesLineOf` in `EditorView`). When it is true and
the rhythm is not Off, `ChangesBar.rhythm` is `[]` and the bars draw the Line. When it is false, Phase 1 holds: with the
Line Off the rhythm line draws, and with Guide Tones (Restate off) nothing of the rhythm draws.

### 2. Sheet beats, spans and the Timing

Everything below counts in **sheet beats**: beats along the drawn bars from the start of the sheet's first one. These
are the bars `layRhythm` is laid over (P1 §4). A repeat drawn with repeat signs counts once, and an undrawn copy has no
sheet beats. A chord's `at` is its start in sheet beats. Its drawn bar is found from its clock bar, so a gap in the
clock left by a folded repeat closes up.

With a Timing of `a` beats (positive anticipates, negative resolves late), each chord's **boundary** is
`b_j = at_j − a`, except that:
- the first chord's boundary is its own start;
- a chord whose start is the first beat of a break bar keeps its boundary there (Decision 14);
- a boundary is clamped to `[0, total]`, and never passes the next boundary: right to left, `b_j = min(b_j, b_{j+1})`.

Chord j's **span** is `[b_j, b_{j+1})`, and the last chord's runs to the sheet's end. An empty span plays nothing.
Interior spans keep their length, so the shift moves every chord change by the same amount. The first chord's span
shrinks (anticipate) or grows (resolve late), and the last chord's does the opposite. The chord symbols, numerals and
scale labels stay at `at_j`.

A boundary can fall between pulses: ½ beat under triplets, or under quarters. An attack belongs to the span that holds
its start.

**Steps:** `ANTICIPATE_STEPS = [3, 2.5, 2, 1.5, 1, 0.5, 0, −0.5, −1, −1.5, −2, −2.5, −3]`, the listbox's order.
`isAnticipate(n)` holds for those 13 numbers only. `anticipateLabel(n)` reads:

| n | Label |
| --- | --- |
| 0 | On time |
| 0.5 | Anticipate ½ beat |
| 1 | Anticipate 1 beat |
| 1.5 | Anticipate 1½ beats |
| −0.5 | Resolve late ½ beat |
| −2 | Resolve late 2 beats |

### 3. Start: targets and pick-ups

**3.1 Values.** `RhythmStart = 'beat' | 'pickup-1' | 'pickup-2' | 'pickup-3'`, with these labels: On the beat, 1-note
pick-up, 2-note pick-up, 3-note pick-up. N is 0, 1, 2 or 3.

**3.2 Forced attacks** (when N > 0). For each chord that sounds (one its line has notes for: not a rest, and not a chord
whose `cellsOf` gives null) and whose span is not empty:
- its **target** is the first pulse at or after `b_j`. If that pulse is not inside the span, the chord takes no target
  and no pick-up;
- the target, and each of the N pulses before it, become attacks. In the cell stream, the cell becomes `x`, and an
  accented `>x` stays accented. A rest or a hold there becomes a fresh attack. The cells after it are unchanged, so a
  `_` that follows now holds the new attack;
- a pick-up pulse is dropped when it is before pulse 0, or when the first pulse of a break bar lies after it and at or
  before the target.

`layRhythm` takes the forced pulses as a fourth argument (`force`, in stream pulses), applied to the stream's cells
before they become notes. The rhythm line itself (Line Off) never forces anything.

**3.3 Who plays each attack.** After the forced rhythm is laid and split into notes (`rhythmNotes`):
- a rest has no owner;
- an attack in a span whose chord sounds belongs to that chord, poured (`below: 0`). This is "the previous cell's last
  notes": a pick-up pulse in the span of the chord before is part of that chord's pour;
- an attack that is chord k's m-th pick-up pulse (m = 1 nearest the target), in a span whose chord does not sound,
  belongs to chord k as a **scale-below pick-up** (`below: m`);
- any other attack in a span whose chord does not sound has no owner, and the line rests there;
- a tied-in piece has the owner of the attack it continues.

**3.4 Scale-below pitches.** A pick-up with `below: m` plays the m-th note below chord k's first poured pitch, in
diatonic steps of chord k's shown scale (`shown ?? scale`, written for the part), spelled as the scale spells it. That
is the Approach's `diatonic` step, applied m times. For example, into a C of C Ionian, a 3-note pick-up is G A B. If
there is no scale, or chord k has no poured attack, or the note is outside the part's range, that attack rests.

**3.5 The sheet's first bar.** Its first chord's pick-up pulses are before pulse 0, so they drop. Its target, pulse 0,
is still struck. No bar is added before it (Decision 13).

### 4. Pouring

`cellVoices` keeps its cell logic: `next()`, the run's count, `prev`, `last`, `nth`, `follows`, `turn` and the Approach.
What changes under a rhythm is what a slot is:

- **Today:** a segment is a chord's part of one bar, and its slots are `length / value` notes of one value.
- **Under a rhythm:** a segment is one chord's whole span, and its slots are that chord's poured attacks (§3.3), in
  order, each at its own beat and length. Every segment counts by chord (Decision 15): the turn-back test uses the
  chord's attacks left, and `followsAt` counts attacks. `carry` is moot, because a segment never stops at a barline.

A slot's pitch goes to its attack's note and to every tied-in piece after it. Each rest, and each note with no owner,
draws as a rest of the rhythm's own value. A pick-up note's pitch is set once its chord's first pitch is known (§3.4).
Then `withApproach` runs over the played notes in time order. It finds each chord's target among poured notes only, and
never touches a pick-up note.

**Worked examples** (concert, 7th Chords Up · root, one chord a bar, letters only), the tests' oracle. The pick-up row
needs a range reaching G3 (piano's, lo F3): in the concert treble range (lo C4) CMaj7 after a rest sits at C4, so G3 A3
B3 fall below it and rest (§3.4).

| Chart | Rhythm | Start, Timing | Bar 1 | Bar 2 |
| --- | --- | --- | --- | --- |
| CMaj7 | `unit:8:3:accents` | beat, 0 | C E G B C E G B (8ths) | |
| CMaj7 | `unit:8:3:rests` | beat, 0 | C r r E r G r | |
| CMaj7 | `unit:8:3:tied` | beat, 0 | C E E(tied in) G | |
| CMaj7 Dm7 (2 + 2 beats) | `card:downbeats` | beat, 0 | C E D F (cut) | |
| CMaj7 in 3/4 | `unit:8:2:accents` | beat, 0 | C E G B G E (turn-back) | |
| CMaj7 \| Dm7 | `card:downbeats` | pickup-1, 0 | C E G B G (q q q 8 8) | D F A C |
| N.C. \| CMaj7 (C Ionian; range lo F3) | `card:downbeats` | pickup-3, 0 | r r r G A B (q q 8 8 8 8) | C E G B |
| CMaj7 \| Dm7 | `card:downbeats` | beat, 1 | C E G D | F A C A |
| CMaj7 \| Dm7 | `card:downbeats` | beat, −1 | C E G B | G D F A |

### 5. Guide tones: Restate

With Restate on and a rhythm on, `guideVoices` works out the guide line's notes exactly as today (`guideToneLine`, its
labels and its diagnostics). It then pours them through `cellVoices`. Each chord's cell is its one guide note, already
placed: `{ tones: [note], next: () => ({ order: [0], up: true, midi: [note.midi] }) }`. Every attack in the chord's span
restates it, a chord without guide tones rests, and Start and Timing apply as for any line. A guide tone held over from
the chord before is restated at the next attack, not tied. The Approach works as in Decision 24: the guide line's own
inserted eighths are not used under a rhythm.

### 6. Target tones

`markTargets(voice, targets, tonesAt)` (engine, pure) returns the bar's voice with `target` set on each note that:
- has a pitch;
- is not tied in;
- starts exactly on one of the bar's `targets` beats.

`tonesAt(beat)` gives the pitch classes of the arpeggio tones (`arpeggioTones(part, chord, scale)`) of the chart's chord
sounding at that beat: the last of the line's `GuideInput`s (`drawn()`: concert chord text and scale, start in clock
beats) starting at or before it. Not `ChangesChord.scale`, which is the written display label. A note whose pitch class is among
them is `'tone'`, otherwise `'other'`. With no readable chord (a rest, an unknown quality), the note gets no mark.
`buildChanges` applies it to every bar's voice when `targets` is on.

The drawing adds `vf-selected` for `'tone'` and `vf-dimmed` for `'other'` to the note's SVG element, as Practice
highlighting does (`web/app/utils/vexflow.ts`). Example, oracle for the tests: CMaj7 | Dm7, 7th Chords Up · root,
`card:downbeats`, Anticipate 2 beats. Bar 1 plays C E D F, and bar 2 plays A C A F. Bar 1 beat 1 C is `tone`, bar 1
beat 3 D (against CMaj7) is `other`, and bar 2 beats 1 and 3 (A, A) are `tone`.

### 7. The model

**Engine, `engine/src/rhythm/phrasing.ts`:**
- `RhythmStart`, `RHYTHM_STARTS`, `RHYTHM_START_LABELS`, `isRhythmStart`;
- `pickupNotes(start): 0 | 1 | 2 | 3`;
- `ANTICIPATE_STEPS`, `isAnticipate`, `anticipateLabel`;
- `phrasingCaption(caption: string, start: RhythmStart, anticipate: number): string`. It appends
  ` · N-note pick-ups` and ` · anticipate …` or ` · resolve late …` (the label, lower-cased) when they are not the
  defaults.

**Engine, `engine/src/rhythm/pour.ts`:**
```ts
/** a chord on the sheet, for the rhythm: its start in sheet beats, and whether its line plays it */
type LineSpan = Readonly<{ at: number; sounds: boolean }>
/** who plays a note: chord, and 0 for a poured note or m for its m-th scale-below pick-up (§3.3) */
type Owner = Readonly<{ chord: number; below: number }>
type LineRhythm = Readonly<{
  laid: Laid                                         // the forced rhythm, for its caption and landings
  bars: readonly (readonly RhythmNote[])[]           // per drawn bar
  owners: readonly (readonly (Owner | null)[])[]     // per drawn bar, one per note
}>
function lineRhythm(id: RhythmId, bars: readonly number[], breaks: readonly number[], chords: readonly LineSpan[], start: RhythmStart, anticipate: number): LineRhythm | null
/** what a line builder needs to pour: the rhythm and how drawn bars map to clock bars */
type RhythmPlan = Readonly<{ id: RhythmId; start: RhythmStart; anticipate: number; bars: readonly number[]; clockBars: readonly number[]; breaks: readonly number[] }>
```

**`GuideNote`** (`engine/src/guideTones.ts`):
- `beats` widens from `NoteBeats` to `number`, because a poured note can be 0.75, 1.5 or ⅓ of a beat.
  `notesFor` and `drawnLengths` still give `NoteBeats`.
- It gains `mark?: RhythmMark`, where `RhythmMark = Pick<RhythmNote, 'value' | 'tuplet' | 'beam' | 'accent'>`. A poured
  note's notation comes from the mark; a note without one draws as today.
- It gains `target?: 'tone' | 'other'` (§6).
- `guideTones.ts` and `engine/src/rhythm/` import each other's types only (`import type`), so no runtime cycle.

**`cellVoices`, `arpeggioVoices`, `cellsVoices`, `pentatonicVoices`, `triadPairVoices`, `quartalVoices`** each take a
trailing optional `rhythm?: RhythmPlan`. Absent means today's rule. **`guideVoices`** takes `rhythm?: RhythmPlan` and
`restate = false`.

**`buildChanges`** options grow to `{ rhythm, targets, start = 'beat', anticipate = 0, restate = false }`. It works out
the drawn bars once (their clock bars, lengths and breaks) before the voices. It passes a `RhythmPlan` to the line when
`takesRhythm(line, restate)` and the rhythm is not Off. `rhythmCaption` is set whenever a rhythm is drawn, on the
slashes or in a Line, and through `phrasingCaption` when a Line took it. It stays `null` for a guide line without
Restate.

### 8. Drawing

`drawGuideLine` (`web/app/utils/changesDrawing.ts`) draws poured lines. For a note with a `mark`:
- its duration is `mark.value`, and `${value}r` for a rest. It is dotted exactly when `mark.value` ends in `d`
  (today's 3-and-6-beat rule applies only to notes without a mark, so a poured `hd` gets one dot, not two). The dot and
  accent code is shared with `drawRhythmLine`'s `rhythmTick`;
- an accent is `Articulation('a>')`;
- one `Tuplet` per `mark.tuplet` index in the bar, rests included;
- beams: runs of consecutive pitched notes with the same `mark.beam` (a rest on the Line splits a group, and a run of
  one has no beam), grouped with the file's `groupsOf`. These replace `generateBeams` for that bar;
- ties as today, from `tie` and `tiedIn`;
- the ink tops that raise a volta bracket and set the target row include the accents (`ACCENT_RISE`) and the tuplets
  (`TUPLET_RISE`), as `drawRhythmLine` counts them;
- `xs` reads only notes on whole beats (`onBeat`), as the rhythm line does;
- after drawing, a note with `target` gets its class.

The aria-label keeps the line's own part (`arpeggioAria` / `guideAria`: rests read "rest") and adds
`rhythmAria(caption)`. Target-tone color is not announced, like Practice highlighting.

### 9. Print

**The rule:** a poured line counts as a voiced line in `changesLinesPerPage` (5, 6 or 7 lines by rows), as the rhythm
line does. Nothing new is counted, and no existing sheet's page count changes. This follows from three facts:
- a poured line's heads are placed by the same rules as the Line's today (`placeWhole`, the range and comfort band),
  so the head span is the same as the voiced lines measured on Stardust (tuba);
- its stems and beams are the arpeggio line's;
- what it adds over the stem tips is the accent and the triplet bracket, which the rhythm line also adds, and the
  rhythm line already prints within the voiced budget (P1's print tests).

**The check:** `print.spec` prints, at Numerals and Scales on, a sheet page to a letter page (the PDF has as many pages
as the sheet):
- Stardust, tuba, 7th Chords Up · root, `unit:8:3:accents`, 3-note pick-ups, Target beats on;
- the 5/4 chart (`BARS_5_4`), 7th Chords Up · root, `unit:8t:4:accents`, Anticipate 1½ beats.

**If either overflows,** `changesLinesPerPage` gains `poured = false` as a fourth argument, giving one line fewer than
the voiced budget for a poured line, and both tests then pass with it. Only poured sheets, which are new, change.

**Measured:** Stardust (tuba) fit the voiced budget; the 5/4 chart (triplets, Anticipate 1½ beats) printed 4 pages for a 2-page
sheet. So `poured` is in: a Line on with a rhythm caption gives voiced − 1 (4, 5 or 6), and both tests pass.

### 10. Controls, preferences and links

- **Flag:** `rhythm` (existing). The e2e build has it on.
- **Tiers:** `CONTROL_TIERS['rhythm-phrasing'] = 'everything'` for Start and Timing. Restate uses `rhythm`
  (Intermediate).
- **Placement:** all inside the Line options popover, in the Rhythm group under the rhythm's own detail, so the rail
  keeps its two rows:
  - **Start** listbox (`aria-label="Start"`, selected "Start: On the beat"; title "Where each chord's line begins: on
    its first beat, or with a pick-up of 1, 2 or 3 notes into it (after Galper)");
  - **Timing** listbox (`aria-label="Timing"`, selected `anticipateLabel`; title "Begin each chord's notes early
    (anticipate) or late (resolve late); the chord symbols stay put (after Bergonzi)");
  - both shown when the rhythm is not Off, the Line takes it, and `shows('rhythm-phrasing')`;
  - **Restate** toggle (title "Play each chord's guide tone again on every attack of the rhythm"), shown when the Line
    is Guide Tones and the rhythm is not Off.
- **Description:** "Turn Line off to see the rhythm." is removed. With Guide Tones, Restate off and a rhythm on, the
  Rhythm listbox is described by "Guide tones hold each chord's note. Turn on Restate to play it in the rhythm."
- **Preferences** (each reads its default with the flag off, and stays stored):
  - `csm-rhythm-start`: a `RhythmStart`, else `beat`;
  - `csm-anticipate`: the number's text (`1.5`, `-0.5`), else 0 when `isAnticipate` fails;
  - `csm-guide-restate`: `on` or `off`.
- **Share links:** `ShareView` gains `rhythmStart?: RhythmStart` (absent: beat), `anticipate?: number` (absent: 0;
  present only when `isAnticipate` and not 0) and `restate?: true`. Invalid values are dropped. The editor writes them
  only on the Changes sheet with a rhythm on and a value away from its default. `linkPreferences` reads them as it reads
  `rhythm`.
- **Hidden settings:** `HiddenSetting` gains `'rhythm-phrasing'`, needing Everything, when the rhythm is not Off, the
  Line takes it, and the start or the timing is away from its default. `ViewSettings` gains `rhythmStart`,
  `anticipate` and `rhythmLine` (the engine's `takesRhythm` on the drawn line, computed by `EditorView`). Restate adds
  no rule of its own: it acts only with a rhythm on, which already lists `'rhythm'` at the same level. The reset clears
  start, timing and Restate with the rest.

### 11. Docs

- **The Help page** (`#rhythm`):
  - the Rhythm entry loses "draws only while the Line is Off" and says that a Line takes the rhythm;
  - new entries: **Rhythm on a Line** (`#rhythm-pour`: pouring, cutting and turning back), **Start**
    (`#rhythm-pickups`: the rule of §3 in plain words, including the first bar and endings; Galper, *Forward Motion*,
    pp. 169–172), **Timing** (`#rhythm-anticipate`; Bergonzi, *Inside Improvisation Vol. 4*, p. 119), **Restate**,
    and target tones under Target beats (`#rhythm-target-tones`; Galper, pp. 47–49).
- **`DECISIONS`:** four rows, page `help`: `rhythm.pour`, `rhythm.pickups`, `rhythm.anticipate` and
  `rhythm.target-tones`, with the anchors above. The existing `arp.line` row (and its how-it-decides section), which
  says the 7th Chords line "keeps its rhythm", says a chosen Rhythm replaces it.
- **`docs/design.md`:** the rhythm section gains the Lines and loses "Turn Line off to see the rhythm."; the 7th Chords
  and Triad pair entries note that a rhythm replaces their note-value rule.
- **Release notes:** none (Non-goals).

## Tests

**Engine unit tests:**
- phrasing: the labels, `isAnticipate`, `phrasingCaption`;
- `layRhythm`'s `force`;
- `lineRhythm`: owners, anticipation (including ½ a beat under triplets), pick-ups into a sounding chord and after a
  rest, the first bar, a break;
- `cellVoices` under a rhythm: §4's table row by row, plus the Approach with pick-ups;
- `guideVoices` with Restate;
- `markTargets`, and §6's example through `buildChanges`;
- `buildChanges`: a Line takes the rhythm (`ChangesBar.rhythm` is `[]`, the caption is set), Start and Timing are
  inert without a rhythm, a guide line without Restate ignores it.

**Engine-wide:** the API snapshot gains the new names (an intended snapshot edit). `make golden` shows no diff.

**Existing tests that change:** `web/test/interface.test.ts` (its `CONTROL_TIERS` equality gains
`'rhythm-phrasing': 'everything'`; its `DEFAULTS: ViewSettings` gains `rhythmStart: 'beat', anticipate: 0,
rhythmLine: false`); `engine/src/__tests__/api.test.ts` (snapshot); `changes.test.ts`'s "draws no rhythm with a Line on"
(renamed for the guide line without Restate, assertions unchanged). No existing test asserts "Turn Line off to see the
rhythm."; it lives only in `PreviewControls.vue`, `help.vue` and `docs/design.md`.

**Web unit tests:** preferences, share links, hidden settings, drawing helpers. (`takesRhythm` is tested in the engine.)

**e2e (flag on):**
- a 7th Chords line in `unit:8:3:rests` reads "C… rest rest E… rest G… rest" in its aria-label, which carries
  "; rhythm: …";
- 3-note pick-ups after N.C. draw G A B in the bar before;
- Anticipate 2 beats with Target beats on gives 3 `.vf-dimmed` and 5 `.vf-selected` on the first line;
- Guide Tones shows the Restate description, and Restate restates;
- a share link with a Line (`line: 'up-root'`) opens with its start and timing chosen;
- the print checks of §9.

**a11y:** the Changes with 7th Chords, a rhythm, 2-note pick-ups and Target beats, scanned with `expectAccessible` in
light and dark.
