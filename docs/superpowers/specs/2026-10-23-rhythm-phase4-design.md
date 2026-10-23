# Mixed phrasing, gears, Feel and tuplet pulses (roadmap Phase 4)

Follows docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md (the roadmap), §5 Phase 4, §2a–2b and §7 item 1, on
top of docs/superpowers/specs/2026-10-22-rhythm-line-design.md (P1 §n),
docs/superpowers/specs/2026-10-22-rhythm-on-lines-design.md (P2 §n) and
docs/superpowers/specs/2026-10-22-rhythm-scales-arpeggios-design.md (P3 §n).

## Intent

Phases 1–3 give one rhythm a sheet, from its first bar to its last. Players don't practise that way for long. Saindon's
mixed-phrasing etudes (*Rhythmic Patterns*, p. 12 ff.) change the grouping through the tune, with a circled number
where each grouping starts. Bergonzi changes the *gear* (*Inside Improvisation Vol. 4*, chs. 22–25: the same line as
quarter-note triplets, 8ths, triplets, 16ths, sextuplets) and the *feel* (ch. 30: the same tune in 4, in 2, in 1).
This spec adds those three things, plus the tuplet pulses the gears need (quintuplets, sextuplets, septuplets).
Everything is a view preference, and nothing is written into chart rows.

## Decisions

### Settled by the roadmap (§5 Phase 4, §7 item 6)

1. **Paths step by the pentatonic path's Step**: Section · Key area · every 2 / 4 / 8 bars of the form.
2. **Mixed phrasing**: a path of groupings, one a step, with Saindon's circled number over each new grouping. A
   statement still running at a step boundary is cut there, as the book allows.
3. **Gears**: a path of pulses, one a step, that plays the same cells at another pulse. Contraction and expansion
   (Bergonzi ch. 26) is a gear path by 2 bars, and gets no control of its own.
4. **Feel in 4 · 2 · 1**: display only. It sets how the Changes groups slashes and beat-grouped beams and thins the
   target beats. In Phase 5 it also sets the click's default pattern.
5. **Quintuplets and septuplets** are pulses. The quarter-note quintuplet draws as a bar-long tuplet in 4/4, and the
   8th-note quintuplet as two tuplets a bar.
6. **Phase 4's controls show at Everything only.**
7. **Per chart:** the path is stored under `csm-rhythm-path:<key>`.

### Decided by this spec

8. **One flag, `rhythmGears`, off**, covers the new pulses, the paths and Feel. Add it to
   `runtimeConfig.public.features`, `web/test/features.test.ts` (as off), and the `e2e` and `a11y` npm scripts (as on).
   With the flag off, the web reads an id with a Phase 4 pulse as invalid (so it falls back to Off), ignores a stored
   path and Feel, and shows none of the new controls.
9. **No separate Pulse control.** Today a unit's, run's or custom rhythm's pulse is already part of its id
   (`unit:8t:5:accents`) and the Rhythm listbox's families (*8ths*, *Triplets*, …). The new pulses join that listbox
   as new Units families. The roadmap's "Pulse on any rhythm" is the Gears path (§3), and a path of one pulse is a
   Pulse. *Reason:* a second pulse control would duplicate the one in the id, and every pair of the two would need a
   rule for which one wins.
10. **The new pulses** (§1) are these, in this order:
    - quarter-note triplets `4t`
    - quarter-note quintuplets `4q`
    - 8th-note quintuplets `8q`
    - 16th quintuplets `16q`
    - sextuplets `16t`
    - septuplets `16s`

    They join `PULSES`, so they work as units and as custom rhythms on all three sheets (P3's runs pour them as they
    pour any rhythm). Runs (`run:`) keep 8 · 8t · 16. *My call:* the six spellings for the text form.
11. **A pulse's group must fit the bar.** Each tuplet pulse has a group of beats: 2 for `4t` and `8q`, 4 for `4q`,
    and 1 for the rest. A bar whose length isn't a whole number of groups is laid entirely at the pulse's
    **fallback**: quarters for `4t` and `4q`, 8ths for `8q`. That covers a 3/4 bar in a 4/4 tune, and every bar of a
    3/4 or 5/4 tune under `4q`. The stream keeps counting cells through that bar. *Reason:* a quarter-note triplet
    that crosses a barline is legal, but slash notation can't draw it legibly (roadmap §7.1). A bar at one pulse
    keeps each bar's notation self-contained, as it is today. `DECISIONS` row: `rhythm.tuplet-fallback`.
12. **Paths act on repeating rhythms only.**
    - The Groups path changes a unit's group. A custom rhythm has no group, so it ignores the Groups path.
    - The Gears path changes the pulse of a unit or a custom rhythm.
    - Per-bar rhythms (runs and cards) take no path, and the path controls hide for them.

    *Reason:* Saindon's and Bergonzi's paths are about a continuous unit. A run's "4 from the and of 2" is a
    placement, and re-timing it would move the placement.
13. **Paths and Feel are Changes-only.** The Scales and Arpeggios sheets keep playing the rhythm as chosen (the id
    alone). *Reason:* their staves have no form to step through. Feel is about the chart's beat and has no meaning
    on a staff.
14. **Each step starts fresh**: a step boundary works like a break (P1's 2nd-ending rule). The new step's stream
    starts at its first cell on its first bar's beat 1, and a note held into it is cut, with no tie. With a Line
    poured (P2), forced pick-ups don't reach back across a step boundary, as they don't across a break.
15. **Bars outside the form** (intro, ending) take step 0's rhythm. *Reason:* the pentatonic path plays Home there.
16. **One Step for both paths.** Step *i* plays `groups[i mod G]` and `gears[i mod P]`, so paths of different lengths
    cycle independently. *Reason:* two Steps would be two more listboxes for a case nobody practises.
17. **Marks at a step:**
    - When the group changes (and on step 0, whenever a Groups path is on), a circled numeral ②–⑦ goes over the step's
      first bar.
    - When the pulse changes, the pulse's short name goes in italics over the same bar (*Triplets*, *Sextuplets*).
    - When both change, both show, with the numeral first.

    Saindon's bracket marks the first statement of each step (P1 §6.5 applies per step).
18. **Feel's slashes.** With no rhythm line, the plain slashes group by the bar's target-beat split:
    - in 4, one slash a beat (today);
    - in 2, one slash a group;
    - in 1, one slash the bar long.

    A bar under 4 beats is in 1 when Feel is 2, because `targetBeats` gives it one group. A slash longer than a
    whole note is split as `restPieces` splits a length, and the pieces are tied. *Reason:* "in 2" on a chart is
    played as half-note slashes, so the sheet should show it that way.
19. **Feel's beams.** Notes that beam by the beat today keep doing so in 4. In 2 they beam by the group, and in 1
    by the bar. That covers per-bar rhythms (runs and cards) and the straight beats of a poured Line. Beams by a
    unit's statement (Saindon), and tuplet beams by their group, don't change.
20. **Feel's target beats:** in 4 and in 2, today's `targetBeats` (1 and 3 in 4/4). In 1, the downbeat only.
21. **Feel's mark:** "in 2" or "in 1" shows in italics over the sheet's first bar, and "in 4" shows nothing. The
    rhythm caption gains ` · feel in 2` or ` · feel in 1` ("feel" so it can't be read as a grouping next to a Groups
    path's "in 3 → 4 → 5").
22. **Tiers:** a new id, `rhythm-gears` (Everything), covers the new pulse families in the Rhythm listbox and the
    Groups, Gears and Step controls. A second new id, `feel` (Everything), covers Feel. A stored id at a new pulse
    still plays at a lower tier, and the hidden-settings notice lists it under `rhythm-gears`.
23. **Golden:** `LIBRARY_IDS` gains the new pulses' units (6 pulses × 6 groups × 5 variations), so `rhythmCases`
    changes: `make golden`, and the review reads the new rows only. The charts' answers don't change.
24. **Release notes** are held for the flag PR: "Release notes: none — the rhythmGears flag is off".

## Goals

1. Six tuplet pulses, drawn with their tuplets, on all three sheets.
2. A Groups path and a Gears path on the Changes, stepping by Section, Key area or Bars, with Saindon's marks.
3. Feel in 4 · 2 · 1 on the Changes.
4. Controls, preferences, links, hidden settings, print and a11y.

## Non-goals

- Paths and Feel on the Scales and Arpeggios sheets (Decision 13). Paths on runs, cards and Notes per bar.
- Starting a unit on any beat (Saindon's "rests inserted so a grouping can start on a new beat"): P2's Start and
  Timing already shift the line, and a per-step offset is left for later.
- Nonuplets and tuplets that cross a barline (Decision 11). Sound (Phase 5).
- Reproducing any etude or example from the books: the Help page cites them by title and page only.

## Design

### 1. Pulses as ratios

`PULSE_PER_BEAT` (one number) becomes a grid per pulse:

```ts
type PulseGrid = Readonly<{ n: number; beats: number; value: RhythmValue; tuplet: Readonly<{ notes: number; of: number }> | null; fallback: Pulse | null }>
const PULSE_GRID: Readonly<Record<Pulse, PulseGrid>>
```

| Pulse | Label | n per beats | Value | Tuplet | Fallback |
| --- | --- | --- | --- | --- | --- |
| `4` | Quarters | 1 / 1 | q | none | none |
| `8` | 8ths | 2 / 1 | 8 | none | none |
| `8t` | Triplets | 3 / 1 | 8 | 3:2 | none |
| `16` | 16ths | 4 / 1 | 16 | none | none |
| `4t` | Quarter-note triplets | 3 / 2 | q | 3:2 | `4` |
| `4q` | Quarter-note quintuplets | 5 / 4 | q | 5:4 | `4` |
| `8q` | 8th-note quintuplets | 5 / 2 | 8 | 5:4 | `8` |
| `16q` | 16th quintuplets | 5 / 1 | 16 | 5:4 | none |
| `16t` | Sextuplets | 6 / 1 | 16 | 6:4 | none |
| `16s` | Septuplets | 7 / 1 | 16 | 7:4 | none |

These rules follow from the table:

- **A bar's pulse:** `barPulse(p, beats)` is `p` when `beats` is a multiple of the pulse's group (`grid.beats`),
  else `grid.fallback`. A bar of `b` beats then holds `b / grid.beats × grid.n` pulses.
- **A pulse's beat:** for pulse index `i` in a bar, the beat is `i × grid.beats / grid.n`. This replaces each
  `at / per`.
- **Keeping the old API:** `PULSE_PER_BEAT` stays exported for the four old pulses only, and every rhythm module
  moves to `PULSE_GRID`.
- **Text form:** `parseRhythm` accepts the six new spellings. A custom rhythm's length is still 1–64 cells.

### 2. Tuplet notation

`rhythmNotes` generalizes P1 §6.3's triplet rule to any tuplet pulse. A tuplet bar is cut into groups (`grid.n`
pulses each). An event's pieces are cut at every group boundary, and then:

- **Whole groups merge.** A piece that starts on a group boundary and covers whole groups merges into straight
  values of the groups' length, outside any tuplet. Five 16th quintuplets tied through a beat make a quarter, and a
  whole `4q` bar is a whole note.
- **Anything else is in the group's tuplet.** A piece of `L` pulses gets `L × value`: the longest of 4×, 3×
  (dotted 2×), 2× and 1× that fits, and the rest tied. Some examples:
  - `8q`, L = 3: a dotted quarter;
  - `16t`, L = 2: an 8th;
  - `16s`, L = 5: a quarter tied to a 16th.

`RhythmNote` gains `ratio: Readonly<{ notes: number; of: number }> | null`, set on every tuplet note. Today's triplets
get 3:2, so drawing reads the ratio instead of assuming 3:2. Tuplet notes beam by their group, and a group's rests
stay inside its bracket. The drawing (`rhythmTick`, `tripletsOf` renamed `tupletsOf`, `drawRunStaff`) passes
`numNotes: ratio.notes, notesOccupied: ratio.of` to `vf.Tuplet`.

**Worked examples** (4/4; the tests' oracle):

| Rhythm | Bar 1 as drawn |
| --- | --- |
| `unit:4t:3:accents` | (3:2 q) >q q q · (3:2 q) >q q q |
| `unit:4q:5:accents` | (5:4 q) >q q q q q |
| `unit:4q:5:tied` | w (the whole bar merges) |
| `unit:8q:5:accents` | (5:4 8) >8 8 8 8 8 · (5:4 8) >8 8 8 8 8 |
| `custom:8q:x_x__` | (5:4 8) q q. · (5:4 8) q q. |
| `unit:16q:5:tied` | q q q q |
| `unit:16t:3:rests` | (6:4 16) 16 r16 r16 16 r16 r16 ×4 (the rests in each group merge as P1 §6.2's do: 16 r8 16 r8) |
| `unit:16s:7:accents` | (7:4 16) >16 16 16 16 16 16 16 ×4 |
| `unit:4t:3:accents` in 3/4 | q q q (the bar falls back to quarters, Decision 11), accent where the stream's statement starts |

### 3. Paths

```ts
type RhythmStepUnit = PentatonicStepUnit // 'section' | 'key-area' | 'bars'
type RhythmStep = PentatonicStep          // { unit, bars: 2 | 4 | 8 }
type RhythmPath = Readonly<{ groups: readonly number[] | null; gears: readonly Pulse[] | null; step: RhythmStep }>
```

- **Groups:** every entry is in `UNIT_GROUPS` (2–7), with 1–8 entries. The presets are:
  - *One* (null: the unit's own group);
  - *Up* (3 4 5 6 7);
  - *Down* (7 6 5 4 3);
  - *Your list…*, a text field of numbers separated by spaces.
- **Gears:** every entry is in `PULSES`, with 1–8 entries. The presets are:
  - *One* (null: the rhythm's own pulse);
  - *Up the gears* (4t 8 8t 16 16t, Bergonzi's five);
  - *Down the gears* (16t 16 8t 8 4t);
  - *Your list…*.
- **Step:** the pentatonic path's control and its default (`section`, 4 bars).
- **The stored path** is `csm-rhythm-path:<key>`, keyed as `usePentatonicPath` keys it: a library slug or
  `mine:<id>`, or for the visit only when there is no key. A stored path with both lists null is removed.

**Step units.** `changes.ts`'s inline `unitOf` (`sectionUnit`, `formStart`, `areaUnit`) moves into one exported
function, `stepUnits(blocks, byRow, step)`, which gives each drawn bar its unit, or null outside the form. Both the
pentatonic path and the rhythm path call it. Moving it changes no pentatonic answer, and the golden test proves that.

**The plan.** `rhythmSteps(id, path, units)` returns `RhythmSteps = readonly Readonly<{ from: number; id: RhythmId }>[]`.
That is one entry per run of drawn bars with the same step, each entry's id being `id` with step *i*'s group and pulse
put in. Some details:

- Runs of equal ids merge.
- A bar with a null unit takes step 0's id (Decision 15).
- With no path, or a per-bar `id`, the plan is `[{ from: 0, id }]`.
- With a custom id, the Groups path is ignored and only the pulse changes (`custom:16:x.x` → `custom:8t:x.x`).

**Laying.** `layRhythm` takes `RhythmId | RhythmSteps`, and a bare id is a one-entry plan, so every Phase 1–3 caller
is unchanged.

- Each entry is laid over its own bars as today. Its first bar is a break (Decision 14), and its stream starts at
  its first bar.
- Each bar takes `barPulse` of its entry's pulse.
- `Laid` gains `pulses: readonly Pulse[]` (each bar's) and `steps: readonly Readonly<{ from: number; id: RhythmId;
  unit: number }>[]`.
- `Laid.pulse` and `Laid.unit` keep step 0's values for the callers that read them.
- Landings, statements and Saindon's bracket are counted per step.

**Lines** (P2). `lineRhythm` takes the plan too. Its `force` and owners keep working in stream pulses, whose bar
starts are now sums of each bar's own pulse count. The step boundaries join `breaks`.

**Worked examples** (4/4, step every 2 bars, 6 bars; `>` is an accent and `|` a barline; the oracle):

| Rhythm and path | Bars |
| --- | --- |
| `unit:8:3:accents`, Groups 3 4 5 | ③ `>xxx>xxx>xx` · `x>xxx>xxx>x` (cut) · ④ `>xxxx>xxxx` · `>xxxx>xxxx` · ⑤ `>xxxxx>xxx` · `xx>xxxxx>x` |
| `unit:8:3:rests`, Groups 3 4 | ③ `x..x..x.` · `.x..x..x` · ④ `x...x...` · `x...x...` · ③ `x..x..x.` · `.x..x..x` |
| `unit:8:4:accents`, Gears 8 8t 16 | `>xxxx>xxxx` ×2 · *Triplets* 12 a bar, accents at pulses 0, 4, 8 (beat 1, the trip of 2, the let of 3) ×2 · *16ths* `>xxxx` a beat ×2 |
| `unit:8:4:accents`, Groups 3 5 + Gears 8 16 | ③ 8ths in 3 · ⑤ *16ths* in 5 · ③ *8ths* in 3 |
| `unit:8:3:accents`, Groups Up, by section, AABA | A1 ③ · A2 ④ · B ⑤ · A3 ⑥ |

The circled numeral and the gear name show on the step's first bar (Decision 17), so the first row's ③ shows
because a Groups path is on.

**Caption.** With a path, `rhythmCaption` names the path and the step, and drops "back on one", because the marks
say where each grouping starts:

> Rhythm: 8ths, with accents · in 3 → 4 → 5 · by section
>
> Rhythm: Units in 4, with accents · 8ths → triplets → 16ths · every 2 bars

If only Gears is on, the label keeps the group and drops the pulse (the second example). If only Groups is on, it
keeps the pulse and drops the group (the first example).

### 4. Feel

```ts
type Feel = 4 | 2 | 1
function feelGroups(beats: number, feel: Feel): readonly number[]   // each group's first beat
```

`feelGroups` gives `[0..beats−1]` in 4, `targetBeats(beats)` in 2, and `[0]` in 1. `buildChanges` takes `feel`
(default 4) and changes three things:

- each `ChangesBar` gains `slashes: readonly Readonly<{ beat: number; value: RhythmValue; tie: boolean }>[]`
  (Decision 18);
- `targets` uses `feel === 1 ? [0] : targetBeats(beats)`;
- `rhythmNotes`'s beat-grouped beams group by `feelGroups` (Decision 19).

**Worked examples** (the oracle):

| Bar | in 4 | in 2 | in 1 |
| --- | --- | --- | --- |
| 4/4 slashes | q q q q | h h | w |
| 3/4 slashes | q q q | hd | hd |
| 5/4 slashes | q ×5 | hd h | w tied q |
| 4/4 `run:8:4:0` beams | (8 8)(8 8) r r | (8 8 8 8) r r | (8 8 8 8) r r (rests as today: Feel doesn't change them) |
| 4/4 `card:downbeats` | q q q q (no beams; unchanged) | same | same |
| 4/4 `unit:8:3:accents` | beams by statement (unchanged) | same | same |
| 4/4 target beats | 1, 3 | 1, 3 | 1 |

### 5. Model and API

New in the engine's public API (the `api.test.ts` snapshot gains these):

- **Pulses:** `PULSE_GRID`, `barPulse`.
- **Paths:** `RhythmPath`, `RhythmStep`, `RhythmSteps`, `rhythmSteps`, `isRhythmPath`, `RHYTHM_GROUP_PRESETS`,
  `RHYTHM_GEAR_PRESETS`.
- **Shared step units:** `stepUnits`.
- **Feel:** `Feel`, `FEELS`, `isFeel`, `feelGroups`.

`buildChanges` options gain `rhythmPath?: RhythmPath` and `feel?: Feel`. `ChangesBar` gains `slashes` and a `step` mark:
`Readonly<{ group: number | null; pulse: Pulse | null }> | null` (Decision 17), which is non-null only on a step's
first bar.

### 6. Drawing

The drawing changes are in `web/app/utils/changesDrawing.ts`:

- **`slashes`** draws `bar.slashes`: half and whole slash noteheads (hollow), dotted where needed, tied.
- **The step mark** is drawn over the bar's first note, in the band where the target dots sit, so no line grows.
  The circled numeral is the Unicode ②–⑦. The gear name is in small italics. Its aria-label is
  "grouping in 5, 16ths". Both go in the line's aria-label as ", from bar N: in 5, 16ths".
- **The Feel mark** goes over the sheet's first bar, in the same band.
- **Tuplets:** `vf.Tuplet` takes the ratio from `RhythmNote.ratio` (§2), in the rhythm line, the cards and
  `drawRunStaff`.

### 7. Controls, preferences and links

- **Flag:** `rhythmGears`, off (Decision 8).
- **The Rhythm listbox** lists the six new pulses as Units families when the flag is on and
  `shows('rhythm-gears')`. The unit detail's In and Variation work at any pulse.
- **Rhythm options** (the popover in `RhythmControls.vue`) gains, on the Changes only, for a unit or custom rhythm,
  with the flag on and `shows('rhythm-gears')`:
  - **Groups** (aria-label "Groups", title "Change the grouping at each step (Saindon's mixed phrasing)"), hidden
    for a custom rhythm;
  - **Gears** (aria-label "Gears", title "Change the pulse at each step (after Bergonzi)");
  - **Step** (aria-label "Step"), shown when either path is on.

  *Your list…* reveals a text field validated as the custom rhythm field is, with an error under it.
- **Feel:** a listbox in Line options, under the rhythm (the Changes rhythm controls' home; the rail has no Rhythm group) (aria-label "Feel", options *In 4*, *In 2*, *In 1*, title
  "Group the beats in 4, in 2 (half time) or in 1"), with the flag on and `shows('feel')`. It is shown with or
  without a rhythm, because it changes the plain slashes and the target beats too.
- **Preferences:**
  - `csm-feel` holds `4`, `2` or `1`, else 4. It is global, like the rhythm.
  - `csm-rhythm-path:<key>` is per chart (§3).
- **Share links:**
  - `feel?: 2 | 1`;
  - `rhythmPath?: { groups?: number[]; gears?: Pulse[]; step?: RhythmStep }`, written only with a path on.

  Invalid values drop.
- **Hidden settings:** `rhythm-gears` is listed when the rhythm's pulse is new or a path is on, and `feel` when
  Feel isn't 4. `ViewSettings` gains `feel` and `rhythmPath`. The reset clears both, removing the chart's stored
  path.
- **`CONTROL_TIERS`:** `'rhythm-gears': 'everything'` and `feel: 'everything'`.

### 8. Print

**Rule:** the counts stay as measured in Phases 1–3: Changes poured lines are voiced − 1, Scales with a card 8 a page,
and Arpeggios with a run 11.

**Checks** (`print.spec`, letter, flag on):

- Autumn Leaves, trombone from B, `unit:8:3:accents` with Groups Up by section (the step marks);
- the same with `unit:16s:7:accents` (the densest tuplets);
- the F Blues Scales sheet with `unit:8q:5:accents` (the card and run tuplets).

**If one overflows:** first make the step mark smaller. If it still overflows, the Changes drops one more line a page
when a path is on, and the spec's §8 records the measurement.

**Measured (Task 3.2):**

- Tuplet lines are taller: their numbers stand over the beams.
  - Measured on Autumn Leaves, trombone from B: a line is 164–175 px with tuplets and 146–156 px without.
  - 6 rhythm lines with tuplets took about 1,030–1,140 px, past a letter page's about 970 px printable.
- So a rhythm line that draws tuplets prints one line fewer a page (`changesLinesPerPage(…, tuplets)`, from
  `drawsTuplets`). At 5 lines a page the worst case is 919 px, which leaves 51 px.
- A poured Line already drops one line, so it doesn't drop a second.
- `print.spec` covers three cases, each at 5 lines a page:
  - `8t:7`;
  - `16s:7`;
  - `8t:7` with Groups Up by section.

**Crowded notes (Task 3.2):**

- A bar takes its notes' room. VexFlow never sets notes closer than their glyphs, so the bars widen to fit them.
- Where a line still can't hold its notes, only that line splits, balanced: 4 bars become 2 2, else 1 1 1 1, never 3 1.
  3 bars become 2 1, else 1 1 1.
- Every other line keeps its bars, and the page budget counts the lines drawn.
- Straight 16ths are set close, and they keep 4 bars a line, except a first line crowded by its clef and a key
  signature of 2 or more accidentals. That line splits 2 2, which adds 1 line over 8ths.

### 9. Docs

- **Help** (`#rhythm`) gains:
  - **Tuplet pulses** (`#rhythm-tuplets`), with Decision 11's fallback in words;
  - **Mixed phrasing** (`#rhythm-groups`; Saindon, *Rhythmic Patterns*, p. 12);
  - **Gears** (`#rhythm-gears`; Bergonzi, *Inside Improvisation Vol. 4*, chs. 22–26);
  - **Feel** (`#rhythm-feel`; Bergonzi ch. 30; Galper's half time).
- **`DECISIONS`:** `rhythm.tuplet-fallback` (Decision 11), `rhythm.path-step` (Decisions 14–16) and `rhythm.feel`
  (Decisions 18–20), page `help`.
- **`docs/design.md`:** the Changes rhythm section gains paths and Feel, and the rhythm model gains the pulse grid.

## Tests

**Engine:**

- `PULSE_GRID` and `barPulse`, including the 3/4 and 5/4 fallbacks;
- `parseRhythm` with the new spellings;
- `rhythmNotes` against §2's table;
- `stepUnits`, with the pentatonic path's existing tests unchanged;
- `rhythmSteps` and `layRhythm` with steps, against §3's table (cuts, fresh starts, marks);
- `lineRhythm` with a plan, where a pick-up doesn't cross a step boundary;
- `rhythmCaption` with paths;
- `feelGroups`, slashes, targets and beams against §4's table;
- `buildChanges` defaults unchanged;
- the API snapshot, and golden (Decision 23).

**Web unit:** preferences (`csm-feel`, `csm-rhythm-path:`), share links, hidden settings and `CONTROL_TIERS`,
`features.test.ts` (`rhythmGears: false`), and a Phase 4 pulse read as Off with the flag off.

**e2e (flag on):**

- Groups Up by section on an AABA chart shows ③④⑤⑥ in the line's aria-labels;
- Gears Up the gears by 2 bars shows the pulse names;
- `unit:4q:5:accents` draws one 5:4 tuplet a bar;
- Feel in 2 draws half slashes and its caption says "in 2";
- a share link carries `rhythmPath` and `feel`;
- §8's print checks.

**a11y:** the Changes with a path and its marks, Feel in 1, and a Scales card at `8q`, in light and dark.

## PRs

1. **Tuplet pulses:** the flag, `PULSE_GRID`, the six pulses, tuplet notation (§1, §2), drawing on all three
   sheets, the listbox families, Help, the golden update and a print check.
2. **Mixed phrasing:** `stepUnits` moved out of `changes.ts`, steps in `layRhythm` and `lineRhythm`, the Groups path,
   step marks, caption, storage, controls and links.
3. **Gears:** the Gears path on the same plan, the gear marks and the second print check.
4. **Feel:** `feelGroups`, slashes, beams, targets, the control, preference, link and mark.
5. **Flag on:** the release notes, as #551 did.
