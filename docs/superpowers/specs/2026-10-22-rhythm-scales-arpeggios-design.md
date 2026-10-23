# Rhythm on the Scales and Arpeggios sheets (roadmap Phase 3)

Follows docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md (the roadmap), §5 Phase 3 and §3's rows for the
Scales and Arpeggios sheets, on top of docs/superpowers/specs/2026-10-22-rhythm-line-design.md (cited as P1 §n) and
docs/superpowers/specs/2026-10-22-rhythm-on-lines-design.md (cited as P2 §n).

## Intent

The Scales sheet says *which notes*: each staff is a scale in whole notes, with no metre. The Arpeggios sheet plays
each line's arpeggio as a barless run of 8ths. Phases 1 and 2 gave the Changes a *when*. This spec gives it to the
other two sheets in the three ways the books practise a scale: under a **rhythm card** (the staff says what, the
card says when), as **Notes per bar** (Bergonzi, *Inside Improvisation Vol. 4*, ch. 1: the scale as a run of N
notes a bar), and as a **rhythmised run** (Bergonzi ch. 32: the run poured into a rhythm). Everything is a view
preference. Nothing is written into chart rows, and nothing stored migrates.

## Decisions

### Settled by the roadmap (§5 Phase 3, §7 item 2)

1. **Rhythm card** (Scales): with a Rhythm chosen and Notes per bar at *Whole notes*, each staff gets a slash card
   under it, one cycle long, capped at four bars and then "…". The whole notes stay.
2. **Notes per bar** (Scales): *Whole notes* (today) · 1 · 2 · 3 · 4 · 5 · 6 · 7. Any value but Whole notes
   rewrites the staff as the scale run in bars of N attacks, time signature on, beamed by the bar (§2).
3. **Rhythmised runs** (Arpeggios): a Rhythm pours the arpeggio's notes into the rhythm (§4).
4. **The time signature** shows on the Scales sheet only while a card or Notes per bar is on, and on the Arpeggios
   sheet only while a Rhythm is on. With both off, both sheets are exactly today's.
5. **The page subtitle names the rhythm** (§6).

### Decided by this spec

6. **One Rhythm across the sheets.** The Scales and Arpeggios sheets read the same `csm-rhythm` preference as the
   Changes. *Reason:* a player practising "8ths in 5" on a tune practises it on all three sheets; a rhythm per sheet
   would be three settings to keep in step. Phase 2's Start, Timing and Restate stay Changes-only.
7. **A new flag, `rhythmSheets`, off.** With it off, the Scales and Arpeggios sheets ignore the Rhythm and show no
   Rhythm or Notes per bar control, whatever the preference holds. The e2e build has it on;
   `web/test/features.test.ts` lists it off.
8. **Each staff's metre** is the length in beats of the bar that holds its line's first row (`ScaleLine.row`), in
   the chart's clock (a section's `time:`, an `@time`). A chart with no time signature is in 4. The time signature is
   `<beats>/4`, as every metre the chart format takes counts in quarters (P1 §4). *Reason:* a staff joins rows that
   may sit in different sections; its first row is the one its labels already name. `DECISIONS` row
   `rhythm.staff-metre`.
9. **The run** (Notes per bar) is the staff's notes up, the octave above its first note, and back down to its first
   note: 2K + 1 notes for a staff of K notes (15 for a seven-note scale). It starts on the staff's first note, in
   today's octave, so the run's top is exactly an octave above the staff's lowest note. Notes added by the Pentatonic
   preset (#308) are staff notes and join the run. *Reason:* the roadmap's "up and down past the octave", as the
   Arpeggios' Up & down; one shape for every N keeps the bars predictable. It answers the handoff's range question:
   the run never leaves the octave the staff already draws, plus its top note, so it needs no range rule.
10. **Notes per bar with a Rhythm**: the run is poured into the rhythm laid over the staff's bars, taking at most the
    first N attacks of each bar; a bar's later attacks rest. No card draws (the staff carries the rhythm).
11. **Grouping is not a second control.** The roadmap's Grouping (in 3 … in 7, re-beaming the plain 8th run) is the
    Rhythm *8ths in N · with accents* (`unit:8:N:accents`) poured into the run: every 8th an attack, beamed by
    the unit, its first note accented, which is Saindon's accents variation. The Arpeggios sheet has one Rhythm
    control; the Help page's Grouping entry says to choose it. *Reason:* two controls would both re-time the same
    8ths, and every combination of the two would need a rule.
12. **Triad pairs' Block** plays chords, so it takes no rhythm: the Rhythm control hides there, and the staff is
    today's. The Patterns sheet is a non-goal (it keeps today's run).
13. **The card shows no caption.** It carries the rhythm's accents, tuplets and Saindon's bracket (P1 §6.5). The
    caption is the page subtitle's (§6), once a page. *Reason:* twelve copies of one caption cost twelve rows of print
    height for one fact.
14. **A card bar is a quarter of the staff's notes width,** so a one-bar card is a quarter wide and a four-bar card
    spans the staff. It is left-aligned under the notes.
15. **Practice highlighting maps by staff note**: a run note takes the `selected`, `second` and `outside` flags of
    the staff note it repeats (the top octave note takes the first note's). The on-screen interval labels repeat the
    same way.
16. **Tiers:** the Rhythm on these sheets uses the existing `rhythm` id (Intermediate). Notes per bar is a new id,
    `notes-per-bar`, at Intermediate (Bergonzi's first exercise).
17. **No golden change.** Defaults draw today's sheets; `make golden` still runs to show it.
18. **Release notes** are held for the flag PR, as Phases 1 and 2 did: each PR says
    "Release notes: none — the rhythmSheets flag is off".

## Goals

1. A rhythm card under each Scales staff.
2. Notes per bar: the scale run in bars of N, with or without a Rhythm.
3. A Rhythm on the Arpeggios sheet's runs (and with it, Grouping).
4. Controls, preferences, links, hidden settings; print and a11y.

## Non-goals

- The Patterns sheet; Triad pairs' Block.
- Start, Timing, Restate and Target beats on these sheets (they are about chord changes, which a staff has none of).
- Mixed phrasing, gears, Feel, quintuplet pulses (Phase 4). Sound (Phase 5).
- Reproducing anything from the books: the Help page cites Bergonzi and Saindon by title and page only.

## Design

### 1. The rhythm card

With a Rhythm (not Off) and Notes per bar *Whole notes*, each staff with notes (no `error`) gets a card.

- **Bars:** `cardBars(laid)`. A repeating rhythm's cycle is `unit / gcd(unit, barPulses)` bars (as `rhythmCaption`
  counts it); a per-bar rhythm's is 1. The card is `min(cycle, 4)` bars of the staff's metre, laid with `layRhythm`
  over that many bars, then `rhythmNotes`. When the cycle is longer than 4, `cut` is true.
- **Drawing:** a one-line stave of slash notes in the card's bars (`drawRhythmCard`, sharing `rhythmTick`,
  `tripletsOf`, `groupsOf` and the bracket code with `drawRhythmLine` in `web/app/utils/changesDrawing.ts`); the
  time signature at its start; "…" after its last barline when `cut`. Its aria-label is
  `Rhythm card: <rhythm label>, <n> bars` and ", continues" when cut.
- **Examples** (4/4; the oracle):

| Rhythm | Cycle | Card |
| --- | --- | --- |
| `unit:8:3:accents` | 3 bars | 3 bars, no "…" |
| `unit:8:5:accents` | 5 bars | 4 bars, "…" |
| `unit:8:4:accents` | 1 bar | 1 bar |
| `card:downbeats` | 1 bar | 1 bar |
| `run:8:3:0` | 1 bar | 1 bar |
| `unit:8:3:accents` in 3/4 | 1 bar | 1 bar |

### 2. Notes per bar: the notation of N even attacks

`NotesPerBar = 'whole' | 1 | 2 | 3 | 4 | 5 | 6 | 7`, labels *Whole notes*, *1 a bar*, … *7 a bar*. For a bar of
`b` beats, `evenBar(b, n)` gives the value of each attack and its tuplet, if any:

1. `n = 1`: one note the bar long, split as `restPieces` splits a length (tied where needed: 5/4 is a whole tied to a
   quarter).
2. `b / n` is an undotted value (4, 2, 1, ½, ¼ beats), or `n = 2` and `b / n` is a dotted value: even, no tuplet.
3. Otherwise a tuplet: the longest undotted value `v` (half, quarter, 8th, 16th) with `b ≤ n·v < 2b` and `b / v` a
   whole number; the bar is one tuplet of `n` notes of `v` in the time of `b / v`.
4. No such `v` (only in 5/4 and 7/4, for n = 2, 3, 4): quarters, `n` in the time of `b`.

Notes of a value that beams (8th, 16th) beam as one group a bar. The table is the tests' oracle:

| n | 3/4 | 4/4 | 5/4 |
| --- | --- | --- | --- |
| 1 | hd | w | w + q (tied) |
| 2 | qd qd | h h | 2:5 quarters |
| 3 | q q q | 3:2 halves | 3:5 quarters |
| 4 | 4:3 quarters | q ×4 | 4:5 quarters |
| 5 | 5:3 quarters | 5:4 quarters | q ×5 |
| 6 | 8 ×6 | 6:4 quarters | 6:5 quarters |
| 7 | 7:6 8ths | 7:4 quarters | 7:5 quarters |

**Filling the bars.** The run's 2K + 1 notes go into consecutive bars of `n` attacks; the last bar's unused attacks
are rests of the same value, inside its tuplet if it has one (a 4/4 bar of 7:4 holding one note draws the note and
six tuplet quarter rests; an even bar's rests merge by `restPieces`). The last bar ends with the final barline.

**Worked examples** (C Ionian from C, treble; the oracle):

| Metre, n | Bars |
| --- | --- |
| 4/4, 4 | C D E F · G A B C · B A G F · E D C r |
| 4/4, 5 | (5:4) C D E F G · A B C B A · G F E D C |
| 4/4, 2 | C D · E F · G A · B C · B A · G F · E D · C r(h) |
| 3/4, 6 | C D E F G A · B C B A G F · E D C r r r (8ths; rests merge: r(8) r(q)) |
| 4/4, 4, `unit:8:3:accents` | C D E F r(h) · G A B C r(h) · … (first 4 of 8 attacks a bar, as 8ths) |
| 4/4, 3, `card:downbeats` | C D E r · F G A r · … |

The 4/4 n = 4 rest is a quarter rest; with a Rhythm, a bar's resting attacks merge as P2 §4's unowned rests do.

### 3. Notes per bar with a Rhythm

The rhythm is laid with `layRhythm` over enough bars of the staff's metre to hold the run (bars are added until the
first-N attacks number 2K + 1, at most 64 bars; a rhythm with no attack in 64 bars draws today's staff). Each bar keeps
its first `n` attacks; later attacks in the bar become rests. Notes are poured in order, one an attack; a tied-in
piece holds its attack's pitch. Bars after the run's last note are dropped; the last bar's attacks after it rest. The
rhythm's own notation stands: its values, tuplets, accents and beams (`rhythmNotes`), not §2's.

### 4. The Arpeggios sheet: a Rhythm on the run

With a Rhythm on and the Arpeggio shape not Block, each staff's notes (`arpeggioLine`'s, unchanged: the same order,
octaves and length) are poured into the rhythm laid over the staff's metre as in §3, but with every attack kept (no
`n`). The arpeggio's beam groups (`groups`) give way to the rhythm's beams. Accents and triplet brackets draw;
Saindon's bracket does not (P2 Decision 19).

Examples (Cmaj7, 7th Chord, Up; 9 notes C E G B C E G B C, 4/4):

| Rhythm | Bars |
| --- | --- |
| `unit:8:3:accents` (Grouping in 3) | >C E G >B C E >G B (beamed C E G · B C E · G B) · C r(8) r(q) r(h): pulse 8 is mid-statement, so no accent |
| `unit:8:3:rests` | C r r E r G r … (as P2 §4's row) until the 9th note |
| `card:downbeats` | C E G B · C E G B · C r r r |

### 5. The model

**Engine, `engine/src/rhythm/run.ts`** (new):
```ts
type NotesPerBar = 'whole' | 1 | 2 | 3 | 4 | 5 | 6 | 7
const NOTES_PER_BAR: readonly NotesPerBar[]; const NOTES_PER_BAR_LABELS; function isNotesPerBar(x: unknown): x is NotesPerBar
/** one bar's tuplet: n notes in the time of `of` notes of their value */
type BarTuplet = Readonly<{ notes: number; of: number }>
function evenBar(beats: number, n: number): Readonly<{ values: readonly RhythmValue[]; tuplet: BarTuplet | null }>  // §2's table
/** a run note: its value and marks, and the index of the note it plays (null: a rest) */
type RunNote = Readonly<{ note: number | null; mark: Omit<RhythmNote, 'beat'> & { beat: number } }>
type RunBar = Readonly<{ notes: readonly RunNote[]; tuplet: BarTuplet | null }>
type StaffRun = Readonly<{ beats: number; bars: readonly RunBar[] }>
function evenRun(count: number, beats: number, n: number): StaffRun                       // §2
function pourRun(count: number, id: RhythmId, beats: number, perBar: number | null): StaffRun | null  // §3, §4 (null: Off)
function cardBars(id: RhythmId, beats: number): Readonly<{ bars: readonly (readonly RhythmNote[])[]; cut: boolean }> | null  // §1
```
`RunNote.note` indexes the notes the caller gives (the run for Scales, the arpeggio's for Arpeggios). Bar-long
tuplets reuse `RhythmNote.tuplet` as the bar's tuplet index 0; `RunBar.tuplet` gives the ratio, which the triplets'
3:2 default does not.

**`buildSheet`** (`engine/src/sheet.ts`) gains a trailing options object `{ rhythm?: RhythmId; notesPerBar?:
NotesPerBar; beatsOf?: (row: number) => number }` (defaults: Off, Whole notes, 4 beats). `StaffModel` gains:
- `run: (StaffRun & { notes: readonly Pitched[]; accidentals: readonly (string | null)[] }) | null`: the run's
  pitches (2K + 1) with accidentals by bar (`accidentalsInBar` per bar, against the key signature); null with
  Whole notes;
- `card: ReturnType<typeof cardBars> & { beats: number } | null`;
- `timeSig: string | null`: `"<beats>/4"` on a staff with a run or a card, drawn after the clef and key on every such
  staff;
- its `id` gains the rhythm, the notes per bar and the beats, so a change redraws it.

**`buildArpeggioSheet`** gains `{ rhythm?: RhythmId; beatsOf?: (row: number) => number }` in its options;
`ArpeggioStaffModel` gains `run: StaffRun | null` (null when Off, Block, or an error) and `timeSig`. The note list,
`accidentals` (re-figured by bar when a run is on) and `intervals` stay.

`beatsOf` is computed by `EditorView` from the chart's clock (the Changes sheet's `Metre`: `barLength(metre,
barAt(...))` at the row's first beat). The engine API snapshot gains the new names.

### 6. Subtitle

`pageSubtitle(subtitle, instrument, heading, rhythm?)` appends ` · Rhythm: <rhythmLabel>` when a rhythm draws on the
sheet, and ` · <n> a bar` for Notes per bar: "Stella – Tenor Sax (Bb) (Spelled from C) · Rhythm: 8ths in 3, with
accents · 4 a bar". The Arpeggios subtitle takes the rhythm only.

### 7. Drawing

- **`drawStaff`** (`web/app/utils/vexflow.ts`): with `staff.run`, one stave per bar across the staff width (bar
  widths by note count, as `fitBars` shares them), the time signature on the first; notes from each `RunNote.mark`
  (the `rhythmTick` value and dot rules, real pitches, stems by `autoStem`); one `vf.Tuplet` per bar with a
  `RunBar.tuplet` (`numNotes`, `notesOccupied: of`, rests included); beams by `mark.beam` (as `drawGuideLine` does);
  ties. Practice classes go on each run note from its `note` index (Decision 15). The returned xs are per run note.
  Without a run it is today's code.
- **The card** draws in its own `<div>` under the staff's (`drawRhythmCard`, §1), in `ScaleStaff.vue`.
- **`drawArpeggioStaff`**: with `staff.run`, the same bar-by-bar path as `drawStaff`'s run (one shared helper,
  `drawRun`); else today's.
- **aria-labels:** the run's note names in order with "rest" for rests, then `rhythmAria`, then the practice part as
  today.

### 8. Print

**The rule:** 12 staves a page, unchanged, with a card or a run. **The check** (`print.spec`, letter, flag on):
- the F Blues Scales sheet, piano, `unit:8:5:accents` (a four-bar card with "…"): as many PDF pages as sheet pages;
- the same sheet, Notes per bar 7 (tuplets) and Notes per bar 1 (15 bars on a staff);
- the Arpeggios sheet, Extended, Up & down, `unit:8t:4:accents`.

**If one overflows,** `buildSheet`'s `perPage` drops to 10 for a sheet with a card or a run (`ScaleSheet`'s caller),
and to the Arpeggios' own count less one for a poured Arpeggios sheet; only sheets with the new options change. If
Notes per bar 1 crowds its 15 bars so that a note's head and its neighbour's accidental collide, its run plays up
only (K + 1 notes); the Help says so.

### 9. Controls, preferences and links

- **Flag:** `rhythmSheets`, off (`runtimeConfig.public.features`, `useFeature('rhythmSheets')`).
- **The Rhythm controls** move from the Line options popover into a component, `RhythmControls.vue` (the Rhythm
  listbox, its unit/run/custom detail), used there unchanged and in a new **Rhythm** rail group on the Scales and
  Arpeggios sheets. The group holds the Rhythm listbox, its detail behind a *Rhythm options* popover (as Line options,
  so the rail keeps its rows), and, on Scales, the **Notes per bar** listbox (`aria-label="Notes per bar"`, title
  "Play the scale up and down in bars of this many notes (after Bergonzi)"). The group shows when the flag is on,
  `shows('rhythm')`, and the Arpeggio shape is not Block; Notes per bar needs `shows('notes-per-bar')`.
- **Preferences:** `csm-rhythm` (shared, Decision 6); `csm-notes-per-bar`: `whole` or `1`…`7`, else `whole`.
- **Share links:** `rhythm` is written on the Scales and Arpeggios sheets too when the flag is on;
  `notesPerBar?: 1…7` on Scales (absent: Whole notes). Invalid values drop.
- **Hidden settings:** `setAway` lists `'rhythm'` on the Scales and Arpeggios sheets when the flag is on and the
  rhythm is not Off, and a new `'notes-per-bar'` (Intermediate) on Scales when it is not Whole notes. `ViewSettings`
  gains `notesPerBar`; the reset clears it.
- **Tiers:** `CONTROL_TIERS['notes-per-bar'] = 'intermediate'`.

### 10. Docs

- **Help** (`#rhythm`): **Rhythm card** (`#rhythm-card`), **Notes per bar** (`#notes-per-bar`: the run, §2's rule in
  words, a Rhythm's first N attacks; Bergonzi, *Inside Improvisation Vol. 4*, ch. 1), **Rhythm on the Arpeggios**
  (`#rhythm-arpeggios`) and **Grouping** (`#rhythm-grouping`: choose 8ths in N, with accents; Saindon, *Rhythmic
  Patterns*, p. 12).
- **`DECISIONS`:** `rhythm.staff-metre` (Decision 8) and `rhythm.notes-per-bar` (§2's rule), page `help`.
- **`docs/design.md`:** the Scales and Arpeggios sections gain the rhythm.

## Tests

**Engine:** `evenBar` against §2's table (all 21 cells); `evenRun` and `pourRun` against §2's and §4's examples;
`cardBars` against §1's table; `buildSheet` (a run's notes and practice flags by index, `timeSig`, a staff in a
3/4 section of a 4/4 chart, defaults unchanged); `buildArpeggioSheet` (a run; Block ignores the rhythm); `pageSubtitle`.
API snapshot.

**Web unit:** preferences, share links, hidden settings (`interface.test.ts`'s `CONTROL_TIERS` and `ViewSettings`
defaults gain the new entries), `features.test.ts` (`rhythmSheets: false`).

**e2e (flag on):** a Scales staff with `unit:8:5:accents` has a card with "…" and the subtitle names the rhythm;
Notes per bar 4 gives 4 bars with the time signature and the lit notes repeat on the way down; the Arpeggios sheet
with `unit:8:3:accents` reads its notes and "; rhythm:" in its aria-label; a share link carries `notesPerBar`; the
print checks of §8.

**a11y:** the Scales sheet with a card and with Notes per bar 5 and Practice on, the Arpeggios sheet with a rhythm,
in light and dark.

## PRs

1. **Rhythm card**: the flag, `RhythmControls.vue`, the Scales Rhythm group, `cardBars`, `beatsOf`, the card, the
   subtitle, its print check.
2. **Notes per bar**: `run.ts`'s `evenBar`, `evenRun`, `pourRun`; the run on the Scales staff; its control,
   preference, link, hidden setting and print checks.
3. **Arpeggios**: the Rhythm group there, the poured run, Grouping's Help entry, its print check.
4. **Flag on**: the release notes, as #544 did.
