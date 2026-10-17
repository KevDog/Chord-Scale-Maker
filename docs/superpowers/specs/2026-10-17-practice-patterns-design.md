# Practice patterns, melodic cells, approach notes and enclosures (#298)

Status: design. Supersedes [2026-10-14-practice-patterns-design.md](2026-10-14-practice-patterns-design.md) (its
pattern rules are kept here, with the open questions settled) and absorbs #251 (approach notes), #252 (enclosures)
and #258 (melodic cells). Curated ii–V–I licks stay out of scope.

## Why

The app writes scales, arpeggios, guide tone lines and pentatonic cells for a tune. The next things a player practises
from a chart are the vocabulary that sits between those: scale sequences (a pattern run up and down each scale),
melodic cells over the changes (1-2-3-5, 3-5-7-9 …), and the chromatic moves that lead into a target (approach notes,
enclosures). Each is a short pattern of moves computed from what the engine already knows about a chord: its written
root, its chord tones, its scale, and the part's range. Nothing is hand-typed per tune.

## Goals

- **Patterns sheet:** a fourth sheet beside Scales and Arpeggios: each scale line run through a sequence pattern
  (`+1 +1 +1 −2` …), over its scale or its chord tones, up, down or up and down.
- **Melodic cells line** on the Changes sheet: each chord plays a cell (1-2-3-5, 3-5-7-9 …) in the arpeggio line's
  rhythm, each cell placed nearest the last note.
- **Approach notes and enclosures** on the Changes sheet: the guide tone line, with each target note approached from a
  chosen figure (chromatic below, diatonic above, enclosures …) in the previous chord's last beat.
- Everything spelled per instrument and per scale like the rest of the app, inside the player's range
  (`rangeOf(part)`), carried by share links, remembered per browser.

## Non-goals

- Curated licks, ii–V–I phrases, or any per-tune hand-written material.
- Rhythmic variety beyond what the sheets already draw (quarters, eighths, sixteenths by bar; beamed groups on the
  Patterns sheet).
- Audio playback.
- A pattern editor beyond one free-text box.

## Anti-goals (a failure even if it works)

- A wrong note: a cell or approach that names a degree the chord's scale doesn't have, or a chromatic note spelled so
  it reads as a different degree (an approach to E written E♭ rather than D♯).
- A toolbar that grows a third row (`e2e/editor.spec.ts`: "at most two rows").
- Notes outside the player's range where the range could have held them.
- Inline script, `eval`, or anything the CSP refuses.

## Constraints

- Engine code is pure TypeScript in `engine/src/` (no Vue, DOM or VexFlow); its public API is `engine/src/index.ts`,
  snapshotted by `api.test.ts`: export only what the app uses.
- Scales come from `SCALES` formulas; never hand-typed note lists. Chord tones come from `arpeggioTones`.
- Spelling: a scale's notes by `spellFrom` from the written root; enharmonics by `simplifyRoot`.
- Each stage ships behind its own flag (`runtimeConfig.public.features` + `useFeature()`, off; e2e and a11y builds
  turn it on): `patterns`, `cells`, `approaches`.
- UI from the Catalyst components in `web/app/components/ui/`; tests alongside (engine unit tests first, web unit
  tests, one e2e per stage, an a11y scan of each new control).

## Part 1: the Patterns sheet (flag `patterns`)

### The pattern

A pattern is a cycle of **moves** between neighbouring notes of a **collection**, counted in that collection's steps.
`+1 +1 +1 −2`: step up, up, up, then back two. From 1: 1 2 3 4, 2 3 4 5, 3 4 5 6 … The moves' count is a group's
length; their sum is how far each group starts above the last.

- 2 to 8 moves, each a whole number of steps, 1 to 7, up or down (never 0); the sum is 1 to 4.
- A group never goes below its first note (Up starts on each group's lowest note).
- Text form: `+1 +1 +1 −2`. Parsed with a hyphen, minus or en dash, spaces or commas; a missing `+` is up. The parser
  returns the moves or a reason (`parsePattern(text): { moves } | { error }`); `formatPattern(moves)` writes the
  canonical text. A custom pattern is stored and shared as that text.

### Collections

- **Scale:** the line's scale, written for the part (`writtenScale`). Pentatonics and hexatonics just have fewer steps.
- **Chord tones:** `arpeggioTones` (four; a triad's three).

### Direction

- **Up:** a group starting on every *sum*-th step of one octave of the collection (sum 1: every step; `+2 +2 −2`, sum
  2: on 1, 3, 5, 7 of a seven-note scale), each start below the octave, then the octave note alone. Groups reach past
  the octave (7 1 2 3). A collection of *n* notes has ⌈n / sum⌉ groups.
- **Down:** Up reflected: from the octave down to the first note, every move negated.
- **Up & down:** Up, then Down, the octave note shared, no group cut short.

### Placement and drawing

The whole run is placed by the arpeggios' rule (`placeRun`): the octave with the fewest notes out of range, then the
average nearest the range's centre (a tie: the higher). Each staff is drawn by the Arpeggios sheet's staff
(`ArpeggioStaff.vue`): beamed groups (`groups`, one per pattern group, the closing octave note alone), interval labels
against the chord root, accidentals by the measure rule. The engine builds the sheet as `buildArpeggioSheet` does
(`buildPatternSheet(rows, part, perPage, pattern, collection, dir, key, resolved)` returning the same staff model), so
the drawing needs no change beyond taking the new model.

### Library (13)

Stepwise: 1 2 3 · 1 2 3 4 · 1 2 3 4 5 · 1 2 3 5 · 1 2 4 3 · 1 2 3 1 · 1 3 2 1 · 1 3 2 4.
Skips and chords: thirds (`+2 −1`) · fourths (`+3 −2`) · triads (`+2 +2 −3`) · triads with a turn (`+2 +2 −2 −1`) ·
sevenths (`+2 +2 +2 −5`).
Each library entry is stored as its moves; its label is its first group from 1 (`1 2 3 4`) or its name (`Thirds`).

### Controls

On the Patterns sheet, one group, **Pattern**, in the rail (it replaces the Arpeggio group's place, which only shows on
the Arpeggios sheet): a listbox of the library plus **Custom…**; when Custom is chosen, a text box beneath it
(`UiInput`, the pattern's text, with the parse error shown under it and `aria-describedby`); a SegmentedControl
**Scale / Chord tones**; the direction listbox (Up, Down, Up & down). Stored as `csm-pattern` (the text),
`csm-pattern-notes`, `csm-pattern-dir`; share links carry `pattern`, `patternNotes`, `patternDir`, and
`sheet: 'patterns'`.

## Part 2: melodic cells on the Changes sheet (flag `cells`)

Source: Randy Vincent, *Building Solo Lines From Cells* (Sher Music, 2015); page numbers are the book's.

### What a cell is

Four notes in eighths, two beats long, at least three of them chord tones (p.1). A cell is written as degrees from
the chord's root (`3 2 1 7`) and read through the chord's **scale**: degree *d* is the scale's note *d − 1* letters
above the written root (9, 11, 13 are 2, 4, 6 an octave up). So one cell serves every quality, as the book converts a
dominant cell to a II by its 3rd (p.11): `3 2 1 7` is B A G F over G7 (Mixolydian), F E D C over Dm7 (Dorian),
E D C B over Cmaj7 (Ionian). A degree the scale has no letter for (a pentatonic's 2, a diminished scale's doubled
letter) falls back to the chord tone of that number (`arpeggioTones`), and if there is none the chord plays its 7th
chord arpeggio (`up-root`) instead, as the Pentatonic line does for a chord with no pentatonic.

A cell also carries its **contour**: up or down for each of its three moves, part of its definition (the degrees alone
don't say whether 7 is above or below 1). Each note is the next of its pitch class that way from the last (the
pentatonic line's `pitchesFrom`, with a direction per move rather than one for the cell). The table and list below give
each cell's contour as `u`/`d`.

Version 1 is diatonic only: no chromatic cell degrees (the book's b9 passing tone, #5 approach, the chromatic II–V
cells of pp.29–40). Chromatic leading into a target is Part 3's job.

### Systems: cells chained by their targets

The book's core is a cell per two-beat slot whose last note steps into the next chord's starting degree, the
**target** (p.2). In a cycle of 4ths a cell descending by step from a chord tone lands on the same chord tone of the
next chord. Each system is a pair of cells, A and B; the line's slots alternate A, B, A, B … (p.8: 3rd to 5th then 5th
to 3rd):

| System (Line choice) | A | B | Over G7 → C7 → F7 (A, B, A) |
|---|---|---|---|
| Root to root | 1 2 3 5 `uuu` | 1 7 6 5 `ddd` | G A B D · C B♭ A G · F G A C |
| 3rd to 3rd | 3 2 1 7 `ddd` | 3 5 1 7 `uud` | B A G F · E G C B♭ · A G F E♭ |
| 3rd to 5th | 3 5 7 9 `uuu` | 5 3 1 7 `ddd` | B D F A · G E C B♭ · A C E♭ G |
| 3rd to root | 3 1 7 5 `ddd` | 1 3 5 7 `uuu` | B G F D · C E G B♭ · A F E♭ C |

(The last column is pitch classes; placement picks octaves.) Outside a cycle of 4ths the chain still alternates and
each cell is placed nearest the last note; the step into the target is the book's ideal, not a rule the app enforces.

### Single cells

Every slot plays the same cell, a quick way to drill one shape over the changes:
1 2 3 5 `uuu` · 5 3 2 1 `ddd` · 1 3 5 7 `uuu` · 3 5 7 9 `uuu` · 7 1 3 5 `uuu` · 5 6 7 9 `uuu` · 1 3 5 3 `uud` ·
1 5 3 5 `udu` · 1 6 5 3 `ddd` · 1 2 3 1 `uud` (pp.1–3, Ch.2).

### Rhythm and placement

- Eighths, one cell per two beats from the chord's first beat (a cell starts on beat 1 or 3, p.1); a four-beat chord
  plays two cells, a bar of two chords one each.
- The note value is per chord, not per bar: a chord shorter than two beats plays its cell in sixteenths, the others
  in eighths, so a bar of 1 + 3 beats mixes them (the drawing already takes each note's own length). A slot left with fewer than four eighths (a three-beat chord's second slot) turns back on the
  last cell, as the 7th chord line does in 3/4 (`turn`, #348).
- Each cell is placed whole, its first note nearest the last note, in the part's range (the arpeggio line's `place`:
  fewest notes out of range, then nearest, then nearer the centre, then the lower). A run's first cell: the octave
  averaging nearest the centre. This is the register clamp the book asks for (pp.3–5): at the floor or ceiling the
  next cell is placed back inside, so the line turns.
- This differs from the 7th chord line, which fits four notes to the chord whatever its length; `cellVoices` takes
  the note value per bar from its caller (the arpeggio line's `noteValue`, or this line's two-beat rule).

### Controls

A fourth Line mode, **Cells**, beside Off, Guide Tones and 7th Chords, with one listbox beneath it: the four systems,
then the single cells (two `UiListboxGroup`s, "Systems" and "Cells"). Under a Pentatonic or Hexatonic overlay the mode
stays Cells (the overlay replaces only the 7th Chords slot). Stored as `csm-cells` (an id: `root-root`, `3rd-3rd`,
`3rd-5th`, `3rd-root`, or a cell's degrees `1-2-3-5`); share links carry it in `line` as `cells:<id>`.
If the fourth mode pushes the rail past two rows at 1440 px (`editor.spec.ts`), the cells move into the 7th Chords
pattern listbox as a "Cells" group instead and the mode is not added.

### Later (file as issues, not in this work)

Octave displacement (pp.6–8), reversals and permutations, the chromatic cells (b9, #5, the chromatic II–V set),
tritone and minor-3rd substitute cells over a long V7 (pp.87–103), four-beat II–V chains (Ch.3), turnaround systems
(Ch.2).

## Part 3: approach notes and enclosures (flag `approaches`)

### What it plays

The guide tone line (From 3rd or From 7th), with each target note (the guide tone each chord lands on) approached by a
figure that ends on it. The figure's notes are eighths at the end of the previous chord (a two-note figure takes its
last beat, a three-note figure its last beat and a half), so the target still sounds on the chord's first beat and is
held as the guide tone line holds it; the previous chord's own guide tone is shortened to make room (tied as
`notesFor` already splits lengths). The line's first chord, and a chord after a rest, has no approach. Where the
previous chord isn't longer than the figure (its guide tone would get less than an eighth), the target is not
approached. Vincent aims approaches at the next chord's root, 3rd or 5th (pp.23–28); version 1 aims them at the guide
tone line's notes only (chord-tone targets: later).

### Figures (moves from the target; c: chromatic, a semitone; d: diatonic, a step of the previous chord's scale)

| Figure | Notes before the target | Into E (over C) |
|---|---|---|
| Chromatic below | −1c | D♯ E |
| Chromatic above | +1c | F E |
| Diatonic above | +1d | F E |
| Double chromatic below | −2c −1c | D D♯ E |
| Double chromatic above | +2c +1c | F♯ F E |
| Above and below (chromatic) | +1c −1c | F D♯ E |
| Diatonic above, chromatic below (enclosure) | +1d −1c | F D♯ E |
| Below and above (chromatic) | −1c +1c | D♯ F E |
| Delayed resolution | +1d −1d −1c | F D D♯ E |

- A chromatic note below the target is spelled on the letter below, with the accidental that puts it a semitone
  under (into E: D♯; into B♭: A); above, on the letter above (into E: F; into C♯: D). A double chromatic figure's
  outer note is a semitone further out on the same side, spelled on its own nearest letter (into E from below: D D♯).
  A diatonic note is the scale's own note a step from the target, from the scale of the chord the figure sounds over
  (the previous chord).
- The target is the guide tone line's note, so the line's voice leading stays as it is; the figure only borrows time.
- A target the line holds over from the last chord (a common tone, tied) is approached too: the tie is broken, the
  figure leaves the held note and returns to it. Otherwise about half the targets of a ii–V would go bare.

### Controls

In the Line group, under Guide Tones: a second listbox, **Approach** (None and the figures). Stored as `csm-approach`;
share links carry `approach`.

## Interface levels

Each new control takes the level of the control it sits with (`CONTROL_TIERS`, `web/app/utils/interface.ts`): the
Patterns sheet in Work on and its Pattern group, the Cells mode and its listbox, and the Approach listbox all at the
Line's level. A share link that opens one of them below that level raises the existing hidden-settings notice
(`setAway`), as a link with a line does today.

## Order of work

1. Part 1 engine: the pattern parser, library and run generator (`engine/src/patterns.ts`), then `buildPatternSheet`.
2. Part 1 app: the Patterns sheet, its controls, storage, share link; flag `patterns`.
3. Part 2: cells engine (`engine/src/cells.ts`: degrees through the scale, contour, systems), the per-chord note value
   in `cellVoices`, the Cells line mode; flag `cells`.
4. Part 3: approach figures (`engine/src/approaches.ts`) applied to the guide tone line's notes, the Approach listbox;
   flag `approaches`.
Each is its own PR; after 4, file the "Later" items as issues.

## Calls made in writing this (not the user's)

- One spec for all three parts, three flags and PRs (Part 1, 2, 3 in that order: the spec that existed first, then
  the book's core, then the figures that decorate an existing line).
- Cells read degrees through the chord's scale; diatonic only in version 1.
- Each cell's contour is written into its definition (`u`/`d` per move), chosen to match the book's shapes.
- Cells are eighths per two beats, the note value per chord.
- A pattern with a sum above 1 starts a group every *sum* steps.
- Approaches: eighths only (no triplets), at the end of the previous chord; held targets approached too; guide tone
  targets only; delayed resolution is `+1d −1d −1c`.
- New controls sit at the Line's interface level.
- Cells get a fourth Line mode, with a fallback into the 7th Chords listbox if the rail grows a third row.
