# The rhythm line: the rhythm model and the Changes rhythm (roadmap Phases 0–1)

Follows docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md (the roadmap), Phases 0 and 1. Phase 0 is engine only
and ships nothing visible on its own, so this spec includes Phase 1 with it: the first PR a player can see. Phases 2–5
get their own specs later.

## Intent

CSM's sheets say *which notes* to play, never *when*. This spec adds the **when**: a pitch-free rhythm drawn on the
Changes sheet in place of the beat slashes, laid over the chart's own metre, with its cycle computed and Galper's
target beats marked. The rhythm is a view preference, like the level. It is never written into chart rows.

## Decisions (the roadmap's §9, settled)

1. **Text form:** the `x . _ >` form with a pulse prefix (§2). It is one line and needs no barlines.
2. **Pulses:** quarter, 8th, 8th triplet and 16th. Quintuplets and the other tuplet pulses wait for Phase 4.
3. **7/4:** ships in this spec (§5).
4. **A rhythm under a Line:** Phase 2's question. In this spec, a rhythm is drawn only while Line is Off (§6).
5. **Target beats:** a Show toggle, off by default.
6. **Changes from the roadmap's text:**
   - **One stored value:** the rhythm and its variation are a single id (`unit:8:5:accents`). The roadmap had a
     separate `csm-rhythm-var`; a single id means the preference and the link can't drift apart.
   - **Partial subdivision moves to Phase 4.** It mixes two pulses in one rhythm, so it belongs with the gears.
   - **Anticipation moves to Phase 2.** A run that spills over the barline is simply drawn in the next bar.

## Goals

1. **The rhythm model** (`engine/src/rhythm/`): pure and DOM-free, with a library of rhythms generated from formulas
   and a validated text form for the player's own rhythm.
2. **The rhythm line on the Changes sheet:** slash noteheads with stems, beams, rests, ties, accents and triplet
   brackets, plus Saindon's bracket under the unit and a caption that names the cycle.
3. **Target beats:** a dot over each strong beat, by metre, on the slashes or the rhythm.
4. **7/4** in `time:` and `@time`.

## Non-goals

- Pouring the Lines' pitches into a rhythm, pick-ups and anticipation (Phase 2).
- The Scales and Arpeggios sheets (Phase 3).
- Mixed phrasing, gears, the Feel control and quintuplets (Phase 4).
- Sound (Phase 5).
- Bergonzi's 22 rhythms and any printed example from the three books: they are copyrighted (roadmap §7.3). CSM
  generates rhythms from formulas and cites the books.
- A library of famous heads' rhythms (roadmap §7.4). A player can type one as a custom rhythm.

## Design

### 1. Pulses

| Pulse | Text prefix | Pulses a beat | Label |
| --- | --- | --- | --- |
| quarter | `4` | 1 | Quarters |
| 8th | `8` | 2 | 8ths |
| 8th triplet | `8t` | 3 | Triplets |
| 16th | `16` | 4 | 16ths |

A beat is a quarter note in every metre (`Beats`). A bar of B beats holds B × (pulses a beat) pulses, always a whole
number.

### 2. The text form

`<pulse>: <cells>`, for example `8: >xx.x_`. Each cell is one pulse:

- `x` is an attack.
- `.` is a rest.
- `_` holds the note before it (a tie).
- `>` comes immediately before an `x` and accents it.
- `|` and spaces are ignored; they only help reading.

**Valid** means:
- the prefix is one of the four pulses;
- there are 1 to 64 cells after `|` and spaces are removed;
- there is at least one `x`;
- every `>` is followed by an `x`;
- no `_` comes straight after a `.`.

A leading `_` is allowed: it holds the previous statement's last note. At the very start of the sheet, where there is
nothing to hold, it sounds as an attack, and the same holds where that last cell is a rest. `parseRhythm` returns null for anything that isn't valid.
`formatRhythm(parseRhythm(s))` gives the canonical spelling: `|` and spaces removed, one space after the colon.

### 3. The rhythm library and its ids

A **RhythmId** is the one string that the preference, the share link and the listboxes all carry.

**Units** (Saindon), `unit:<pulse>:<g>:<variation>`, with g from 2 to 7. A unit is one group of g pulses, repeated
from the sheet's first beat. Its cells by variation:

| Variation | id | Cells | Label |
| --- | --- | --- | --- |
| with accents | `accents` | `>x` then g−1 `x` | with accents |
| with rests | `rests` | `x` then g−1 `.` | with rests |
| rest last | `rest-last` | g−1 `x` then `.` | rest last |
| syncopated | `syncopated` | `_` then g−1 `x` | syncopated |
| tied | `tied` | `x` then g−1 `_` | tied |

The label is "<pulse label> in <g>, <variation label>", for example "8ths in 5, with accents".

**Runs** (Bergonzi), `run:<pulse>:<n>:<k>`, with pulse `8`, `8t` or `16`, n from 2 to 7, and k from 0 to (pulses in a
4/4 bar) − 1. A run is a per-bar rhythm: in each bar, n attacks start at pulse k and the rest of the bar is rests.
Attacks that run past the barline are drawn in the next bar, where they merge with that bar's own run (the union of
attacks). A bar with fewer than k + 1 pulses plays only what spills into it.

The label is "<n> <pulse label> from <position>". Positions read as the count:
- 8ths: `1`, `the and of 1`, `2`, and so on;
- triplets: `1`, `the trip of 1`, `the let of 1`, and so on;
- 16ths: `1`, `the e of 1`, `the and of 1`, `the a of 1`, and so on.

For example, "4 8ths from the and of 2".

**Cards** (per bar, laid by beats):

| id | Each beat | Label |
| --- | --- | --- |
| `card:downbeats` | `8: x_` (a quarter) | Downbeats |
| `card:upbeats` | `8: .x` | Upbeats |
| `card:halves` | `8: x___` for each pair of beats; an odd last beat is `x_` | Half notes |

**Custom**, `custom:<pulse>:<cells>`: the text form with its colon taken out. It repeats like a unit. Its label is
"Your rhythm (<text form>)". An invalid custom rhythm reads as Off.

`off` means no rhythm. `isRhythmId(s)` accepts exactly the ids above with values in range. `rhythmLabel(id)` gives the
label.

### 4. Laying a rhythm over the sheet

`layRhythm(id, bars)` takes `bars`, each drawn bar's length in beats in sheet order: the Changes sheet's bars as
drawn, so a repeated section drawn with repeat signs counts once.

- A **repeating** rhythm (a unit or a custom one) runs as one stream from pulse 0 of the first bar, ignoring
  barlines.
- A **per-bar** rhythm (a run or a card) starts again at each bar.

The result has two parts:
- each bar's **events**: start pulse, length in pulses, rest, accent, tied in from the bar before, tied on into the
  next. A note held over a barline is split there and the two pieces are tied.
- for a repeating rhythm, the **landings**: the bars, from 0, whose first pulse starts a statement of the unit.
  Bar 0 is always a landing.

**The cycle caption** (repeating rhythms only), from the landings:
- every bar has the same length: "back on one every n bars" ("every bar" when n is 1), where n is the least
  common multiple of the unit and the bar (both in pulses) divided by the bar, even on a sheet shorter than n bars
  (#505);
- the metre changes and only bar 0 is a landing: "never back on one";
- the metre changes: "back on one at bars 1, 5, 12", counting sheet bars from 1. It lists six at most, then "…".

Examples (the tests' oracle):

| Rhythm | Bars | Landings |
| --- | --- | --- |
| 8ths in 5 | eight bars of 4/4 | 0, 5 (every 5 bars) |
| 8ths in 4 | four bars of 3/4 | 0, 2 (every 2 bars) |
| Triplets in 4 | two bars of 4/4 | 0, 1 (every bar) |
| 8ths in 7 | fourteen bars of 3/4 | 0, 7 |
| 8ths in 5 | bars of 4, 4, 3, 4 and 4 beats | 0, 4 (pulse 30 starts bar 4): "at bars 1, 5" |

The **sheet caption** joins the label and the cycle: "Rhythm: 8ths in 5, with accents · back on one every 5 bars".
A per-bar rhythm's caption is just "Rhythm: 4 8ths from the and of 2".

### 5. 7/4

- `beatsPerBar` accepts `2/4` to `7/4`, and `Beats` gains 7. The diagnostics' text becomes "2/4, 3/4, 4/4, 5/4, 6/4
  or 7/4".
- The timeline splits a 7/4 bar's chords as 4 + 3. With 1 to 7 chords in the bar:
  `[7]`, `[4,3]`, `[2,2,3]`, `[2,2,2,1]`, `[2,2,1,1,1]`, `[2,1,1,1,1,1]`, `[1,1,1,1,1,1,1]`.
- `drawnLengths(7)` returns `[4, 3]`, the bar's grouping (today it would give `[6, 1]`).

### 6. Notation: events to notes

`rhythmNotes(laid)` turns each bar's events into notes the sheet can draw. This is pure and in the engine,
so the drawing is only a mapping.

A **RhythmNote** has these fields:

| Field | What it is |
| --- | --- |
| `beat` | where it starts in its bar, in beats |
| `value` | `w`, `hd`, `h`, `qd`, `q`, `8d`, `8` or `16` |
| `rest` | it is a rest |
| `accent` | it carries an accent |
| `tie` | it is tied on to the next note |
| `tiedIn` | it continues the note before |
| `tuplet` | its triplet group's index in the bar, or null |
| `beam` | its beam group's index in the bar, or null |
| `bracket` | `start`, `end`, `both` or null |

Splitting runs in this order:

1. **Barlines.** An event is cut at each barline (§4).
2. **Straight pulses** (4, 8, 16):
   - A piece that starts off a beat is cut at the next beat.
   - A piece that starts on a beat takes the longest value from 4, 3, 2, 1.5 and 1 beats that fits the length left.
     Under one beat, it takes 0.75, 0.5 or 0.25.
   - Whatever is left continues as a new piece, tied, and the same rules apply to it.
   - Rests split the same way but never tie.
3. **Triplets** (8t):
   - Every piece is cut at every beat.
   - A whole beat's piece starting on the beat is a `q` with no tuplet.
   - Any other beat's content is one tuplet of three 8th-triplet pulses: one pulse is an `8`, two are a `q`.
   - Consecutive whole beats of one held note merge, as in rule 2.
4. **Beams.** Consecutive non-rest `8`, `8d` and `16` notes in the same bar share a beam group when they are in the
   same group, never across a rest. A group of one note has no beam (`beam: null`). The group is:
   - for a repeating rhythm, the same statement of the unit (so the beams show the grouping, as Saindon prints it);
   - for a per-bar rhythm, the same beat;
   - for triplets, the same tuplet.
5. **Brackets** (repeating rhythms only). Saindon's bracket spans the first statement of the unit on the sheet, and
   again the first statement at each landing bar. It marks only the part inside that bar.

### 7. Target beats (Galper)

`targetBeats(beats)` gives the strong beats of a bar, counting beats from 0:

| Metre | 2/4 | 3/4 | 4/4 | 5/4 | 6/4 | 7/4 |
| --- | --- | --- | --- | --- | --- | --- |
| Target beats | 0 | 0 | 0, 2 | 0, 3 | 0, 3 | 0, 4 |

### 8. The Changes sheet

- `buildChanges` takes a `rhythm: RhythmId` option (default `off`) and a `targets: boolean` option (default false).
- `ChangesBar` gains:
  - `rhythm: readonly RhythmNote[]`: empty with the rhythm off, or with a Line on;
  - `targets: readonly number[]`: empty with target beats off.
- `ChangesSheet` gains `rhythmCaption: string | null`.
- **With a Line on**, no rhythm is drawn, and the Rhythm control's description says why: "Turn Line off to see the
  rhythm."

**Drawing** (`changesDrawing.ts`). A bar with `rhythm` notes draws them in place of the slashes:
- noteheads: VexFlow slash noteheads on the middle line, with stems up and visible;
- rests in the voice;
- `vf.Articulation('a>')` for accents;
- `vf.Tuplet` per triplet group;
- `vf.Beam` per beam group;
- ties, as one chain across the line with a half-tie at the line's ends, as the guide line draws them;
- Saindon's bracket: a thin line under the staff with feet at both ends.

The two-pass volta read covers the stem tips, as it does for the guide line. The aria-label adds
"; rhythm: <caption>".

**Target dots** are HTML, placed like the chord names: one filled dot (`size-1.5 rounded-full bg-current`) centred
on each target beat's x from `ChangesLayout.xs`, above the staff. They are drawn on slashes and on the rhythm alike.

**Print:** a rhythm line counts as a voiced line in `changesLinesPerPage`: the same rule as a guide line.
`print.spec` measures Stardust and a 5/4 chart with "8ths in 5, syncopated". If those leave room, the count is raised
in the same PR.

### 9. Controls, preferences and links

- **Flag:** `rhythm`, off. The e2e build turns it on.
- **Tier:** `CONTROL_TIERS.rhythm` is `intermediate`, for both the Rhythm controls and the Target beats toggle.
- **The Rhythm group** sits in the Changes rail beside Line. It holds:
  - a **Rhythm** listbox: Off, then the families *Units* (by pulse), *Runs* (by pulse), *Cards* and *Your
    rhythm…*;
  - for a unit, an **In** listbox (in 2 … in 7) and a **Variation** listbox;
  - for a run, an **Attacks** listbox (2–7) and a **From** listbox (the positions);
  - for *Your rhythm…*, a text field. It validates as the player types; an invalid rhythm shows the error
    "Use x, ., _ and > after 4:, 8:, 8t: or 16:" and plays Off.
- **Target beats** is a toggle in the Show group.
- **Preferences:**
  - `csm-rhythm`: a RhythmId; anything else reads as `off`. With the flag off, a stored one reads as Off but stays
    stored.
  - `csm-targets`: `on` or `off`.
- **Share links:** `ShareView` gains `rhythm?: RhythmId` (absent means off) and `targets?: boolean`. Invalid values
  are dropped.
- **Hidden settings:** a rhythm or target beats that are on, at Essentials, list as hidden settings (`rhythm`), as
  the Approach does.

### 10. Docs

- **The Help page:** a "Rhythm" section that explains:
  - units, cycles and landings (Saindon);
  - runs (Bergonzi);
  - the text form;
  - target beats, in Galper's terms: on-beats release, off-beats tension, chord tones on the dots.

  It cites the three books.
- **`DECISIONS`:** two rows, `rhythm.cycle` (where a rhythm is back on one) and `rhythm.targets` (which beats are
  targets, by metre).
- **`docs/design.md`:** §4 gains 7/4; §5 gains the rhythm line.
- **Release notes:** one item.

## Tests

**Engine unit tests:**
- the text form's parse and format, validity, and the leading tie;
- every unit variation's cells;
- run positions and labels, and a run spilling over the barline;
- the cards in 3/4, 4/4 and 5/4;
- §4's landing table and the three caption forms;
- §6's splitting: a dotted quarter from the beat; an off-beat 1.5 split as an 8th tied to a quarter; triplet `q` +
  `8` in one tuplet; beams by statement;
- `targetBeats`;
- 7/4: parse, splits, `drawnLengths`.

**Engine-wide checks:**
- the golden fixture gains `rhythms`: every library RhythmId with its label, its text form and its landings over
  sixteen bars of 4/4 and of 3/4;
- the API snapshot gains the new names.

**Web unit tests:** preferences, share links and hidden settings.

**e2e (flag on):**
- "8ths in 5" on a 4/4 chart draws a bracket again at sheet bar 6;
- a tie crosses a line break;
- a 7/4 chart draws its signature;
- the target dots count two a bar in 4/4;
- a link with `rhythm` opens with it chosen.

**a11y:** a Changes sheet with a rhythm and target beats on.
