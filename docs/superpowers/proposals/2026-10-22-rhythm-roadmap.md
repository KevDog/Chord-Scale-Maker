# Rhythm for Chord Scale Maker: roadmap

Status: proposal, 2026-10-22. Research and planning only; each phase gets its own spec under
`docs/superpowers/specs/` and its own flag before any code is written.

Sources read: Ed Saindon, *Exploration in Rhythm Vol. 1: Rhythmic Phrasing in Improvisation* (Advance Music;
`design/sources/Saindon-xploration-in-rhythm.pdf`; the file named `Bergonzi-Exploration-In-Rhythm.pdf` is a
byte-identical copy); Jerry Bergonzi, *Inside Improvisation Vol. 4: Melodic Rhythms* (Advance Music;
`design/sources/Jerry-Bergonzi-Inside-Improvisation-Vol-4-Melodic-Rhythms.pdf`); Hal Galper, *Forward Motion: From
Bach to Bebop* (Sher Music; `design/sources/Forward_Motion.pdf`). Page numbers below are the books' own.

## 1. Summary

CSM's sheets answer *which notes*: the Changes names each chord's scale, the Scales sheet writes it, the Lines
(guide tones, 7th chords, pentatonic, triad pair) pour chord material into a fixed rhythm. None of the sheets
answers *when*. The three books agree, in different words, that this is the half most players never practise, and
each gives a method that is already pitch-free or can be made so:

- **Saindon** supplies the *grammar*: a rhythmic unit (a pulse grouped in N) cycled against a metre, with a
  fixed set of variations, written in slash notation. It is a formula, so CSM can generate every page of the book
  and every page it leaves out.
- **Bergonzi** supplies the *vocabulary and the practice routine*: one-bar rhythm cards, N consecutive eighths
  displaced to each position in the bar, 3/4, 5/4 and 7/4 rhythms over 4/4, "time zones" (gears), notes-per-bar
  limits, rhythmising scale sequences, and a conceptual checklist (never start on one, anticipate by ½ to 3
  beats, resolve late).
- **Galper** supplies the *rule that joins rhythm to the harmony CSM already analyses*: strong beats (1 and 3,
  the on-beats) take chord tones, weak beats take non-chord tones; every line is a pick-up aimed at a target beat;
  "think rhythm first and let the rhythm select the notes" (pp. 47–66, 169–172).

The recommended shape is one engine model and **five phases**, each shippable on its own and laid against a sheet
CSM already has:

| Phase | Delivers | Lays against | Rough size |
| --- | --- | --- | --- |
| 0 | The *rhythm model*: a pitch-free pattern in a pulse, cycled over the chart's `Clock`; a generated library of units | engine only | M |
| 1 | **Rhythm line** on the Changes: slash-note rhythms through the form, with cycle brackets and Galper's target-beat marks | Changes | M |
| 2 | **Rhythm on the Lines**: the existing cells (arpeggio, pentatonic, triad pair, guide tones) poured into a chosen rhythm; pick-ups; anticipation | Changes Lines | M |
| 3 | **Notes per bar** and **rhythmised runs** on the Scales and Arpeggios sheets | Scales, Arpeggios | M |
| 4 | **Mixed phrasing and gears**: a rhythm that changes by section or every N bars; tuplet pulses; 7/4 | Changes, all lines | L |
| 5 | **Hear it**: the rhythm as a percussion track alongside the click (playback roadmap, Phase 2) | playback | S |

The single design rule, from the brief: **a concept that a book expresses melodically enters CSM as a rhythm
only** (slash noteheads, no pitch). The pitch side of every exercise is already on the sheet: the scale, the
practice selection, the Line. Rhythm is a third axis laid over them, a view preference like the level, never
written into chart rows.

## 2. What the books give, concept by concept

### 2a. Saindon: the rhythmic unit and its cycle

The whole of Vol. 1 is one idea applied to a grid (pp. 7–8): a **rhythmic pulse** (8ths, triplets, 16ths; Chapter
10 adds quarter-note duplets, triplets, quadruplets, quintuplets and 8th-note quintuplets), **grouped** in 3, 4, 5,
6 or 7, in a **time signature** (3/4, 4/4, 5/4). The group is the *rhythmic unit*; the **cycle** is how many bars
it takes for the unit to start on beat one again (8ths grouped in 4 in 3/4: a 2-bar cycle; triplets grouped in 4
in 4/4: a 1-bar cycle; 8ths grouped in 7 in 3/4: 7 bars). The unit is marked with a bracket under its first
statement.

Each unit is then written five ways, and these are the **variations** (p. 10 ff.):

| Variation | What changes | Pitch-free? |
| --- | --- | --- |
| With accents | every note sounds; `>` on the first of each group | yes |
| With rests | the first of each group sounds, the rest are rests (or the last is) | yes |
| With syncopation | notes tied across the group's boundary so the attack lands off the beat | yes |
| With partial subdivision | a note of the group split into two of the next pulse (an 8th into two 16ths) | yes |
| With dotted notes and ties | the group written as longer values (dotted quarter = three 8ths) | yes |
| With pitch | a melody on the rhythm (the book's, in a scale) | **no: CSM supplies the pitch from the sheet** |

Two more things the book says that shape the design:

- *How to practise it* (p. 9): "try playing various rhythm units within a specific scale ... Eventually, the goal
  is to be able to play these rhythmic units in a progression over the chord changes of a composition." That is
  the Scales sheet, then the Changes. And: "stick with a specific rhythmic unit throughout the song", or "freely mix
  up various rhythmic units based on one specific pulse and be able to start the unit on any beat". Those are
  Phases 1 and 4.
- *Mixed phrasing* (p. 12 ff.): an etude whose grouping changes, each change marked with a **circled number** over
  the bar; cycles are allowed to be left incomplete, and rests are inserted so a grouping can start on a new beat.

### 2b. Bergonzi: vocabulary, displacement, gears

Bergonzi's examples are melodies over his play-along tunes; the rhythms underneath are the material. Chapter by
chapter, what carries over:

| Chapter | Concept | As a rhythm only |
| --- | --- | --- |
| 1 Notes per bar (p. 9) | improvise with exactly N notes a bar (3, then 4, 5, 6, 7, then 2, then 1), same rhythm every bar or varied | a bar of N attacks in a chosen placement; the note count is the constraint |
| 2 22 Rhythms (p. 15) | 22 one-bar rhythms in quarters and 8ths, already in slash notation, "feel it as if you were a rhythm instrument" | one-bar **rhythm cards**, cycled through a tune |
| 3–8 Consecutive 8ths (pp. 29–50) | 4 (then 5, 6, 7, 3, 2) consecutive 8ths **starting on each of the eight positions** in the bar: 1, and-of-1, 2, … and-of-4; #5 "the last 8th would sound the next chord"; #6–8 "the harmony can be anticipated"; #9 random starts; #10–13 a 3/4, 5/4 and 7/4 pattern over 4/4 | a run of N attacks at pulse p from position k, with the anticipation flag; the odd-metre patterns are Saindon units |
| 9–13 Triplet groupings (p. 51 ff.) | the same with 5, 6, 7, 3 consecutive triplet 8ths | pulse = triplet |
| 14 Mixing groups (p. 64) | groups of different lengths in sequence | Phase 4 mixed phrasing |
| 15 Consecutive 16ths (p. 65) | the same at 16ths; "playing groups of five, six or seven 16ths is very close to playing long 8th-note lines in half time" | pulse = 16th; Galper's half-time |
| 16–19 Hemiolas; 5/4, 7/4 over 4/4; 4/4 over 3/4 (pp. 66–77) | a 5-beat unit "takes five bars of 4/4 to equal four bars of 5/4 ... the pattern should hit one on the sixth bar" | Saindon's cycle, with the **landing bar** named |
| 20 In the pocket (p. 80) | quarter-note placement; see 27 | |
| 21 Half-time quarter-note triplet feel (p. 85) | a 2/2 conception | Galper's half time |
| 22–25 Time zones, gears (pp. 87–108) | the same line in five gears: quarter-note triplet, 8th, triplet, 16th, sextuplet; switch gears mid-line; broken quintuplets, septuplets, nonuplets | **pulse** as a first-class choice on any rhythm; Phase 4 |
| 26 Contraction and expansion (p. 109) | the same figure at successively smaller or larger values | a transform on a rhythm |
| 27 Downbeat–upbeat (p. 110) | quarter-note playing on downbeats only, then upbeats only, over a slash chart | two rhythm cards (the chart's own slashes, and their offbeats) |
| 28 Half, quarter and dotted quarter (p. 113) | "less is more": solos in long values only | a long-value rhythm family |
| 29 Accents (p. 113) | play just the accents, then fill around them | the Saindon "with accents" variation, and its inverse |
| 30 Feeling the music in 1, 2 or 4 (p. 113) | the same tune conceived in four, in two (half time), in one | a **feel** on the Changes: beat grouping shown, not a new rhythm |
| 31 The metronome (p. 114) | click on 2 and 4, on 1 and 3, on 3 only, on 4 only, on the and of 2 and 4 | click patterns for playback (Phase 5) |
| 32 Rhythmising scale sequences (p. 115) | a modal scale sequence (3rds, 4-note cells) played in 8ths, then with notes left out and rests added, then in tuplets, then "rhythmised" | the Scales sheet's run poured into a rhythm; Phase 3 |
| 33 Conceptual practice (p. 119) | never start on one; never end on one; anticipate by ½, 1, 1½, 2, 2½, 3 beats; resolve late by 1–4 beats; leave space | **constraints** a generated rhythm can honour, and an **Anticipate** offset on the Lines |

### 2c. Galper: the rule that ties rhythm to the analysis

Galper's book is mostly melodic (reordered scales, added half-steps, arpeggios, appoggiaturas). What survives the
"rhythm only" filter is small and fundamental:

1. **Target beats** (pp. 47–49, 67). On-beats are *release* (1 and 3 strongest), off-beats are *tension*; chord
   tones are release, non-chord tones tension; a line sounds strong when the two are synchronised. CSM knows every
   chord's tones (`arpeggioTones`, the guide-tone table) and already lets Practice light chord tones. The rhythmic
   half is to **mark the target beats** on the Changes and to **place chord tones on them** in the Lines.
2. **Everything is a pick-up** (pp. 169–172). Every FM example starts outside the first bar; there are three
   pick-ups, a 1-note (the and-of-4), a 2-note (beat 4) and a 3-note (the and-of-3), each heard differently, and
   players mix them. A Line can start with any of the three and land its chord tone on one.
3. **Half time** (pp. 52–58). Feel 4/4 as 2/2, count two-bar phrases, conceive 8ths as 16ths at half the tempo.
   On the sheet this is a *feel* (beats grouped in pairs, phrases of two bars), shared with Bergonzi Chapter 30.
4. **Rhythm first** (pp. 61–66). "Let the rhythms select which notes you want to play": sing a head's rhythm on one
   pitch, then solo on another tune with that rhythm; keep a clave or a 6/8 figure in the head. In CSM terms: the
   rhythm line is primary, and the sheet's scale is the "continuous 8th-note line" it selects from. (A library of
   **famous heads' rhythms** is tempting here and is set aside: see §7.)

Galper's three categories of scale line (descending for 2-beat chords, ascending for 2-beat chords, both for 4-beat
chords; pp. 68–82) and the added half-step rules are melodic and stay out; the one thing to keep from them is the
*4-note group whose last note lands on 1 or 3*, which Phase 2 handles as a pick-up rule.

## 3. The main question: how the concepts lay against the sheets

Every sheet is a different object, so the same rhythm lands on each in a different way. The table is the answer
in one place; the phases build it.

| Sheet | What it has today | What the rhythm adds | Book source |
| --- | --- | --- | --- |
| **Changes** (slash lead sheet, one slash a beat, each bar in its own metre) | the time grid and the chord timeline | **a rhythm line**: slash noteheads *with* stems, rests, ties and accents replacing the beat slashes; the unit bracketed; the cycle captioned ("8ths in 5 over 4/4 · 5-bar cycle, on one at bar 6"); target beats marked | Saindon all chapters; Bergonzi 2, 3–19, 27; Galper 1 |
| **Changes Lines** (guide tones, 7th chords, pentatonic, triad pair: cells in ♩ ♪ 𝅘𝅥𝅯 by the bar's shortest chord) | pitches in a fixed rhythm | the cells' pitches **poured into the rhythm's attacks** (rests skipped, ties held); a pick-up start; an anticipation offset so the next chord's cell begins before the barline | Galper 1–2; Bergonzi 3 (#5–8), 33 |
| **Scales** (one staff a scale, whole notes, no time signature, practice highlighting) | the pitch set | a **rhythm card** under each staff (the unit in the chart's metre, slash notation) to play "within a specific scale"; or **Notes per bar**: the scale written as a run of N notes a bar in the chosen rhythm, time signature on | Saindon p. 9; Bergonzi 1, 32 |
| **Arpeggios** (the Scales' lines in 8ths, beamed by chord) | 8th-note runs | the same runs in a chosen rhythm or grouping (8ths in 3, in 5, …): the beaming shows the group, so a 5-group over a 4/4 bar reads at sight | Saindon 1–3; Bergonzi 16–19 |
| **Practice selection** | which notes are lit | a **target-beat** presentation: with Target beats on, the chord-tone preset reads as "these on 1 and 3, the rest between" | Galper 1 |
| **Playback** (planned) | click, marker, lines sounded | the rhythm line as a percussion track; click on 2 and 4, 1 and 3, 3 only, 4 only, the and of 2 and 4 | Bergonzi 31; Galper 3 |

Three things that do *not* change: charts stay concert pitch; the rhythm is a view preference and share-link
setting, never a chart row; the Scales sheet stays metre-free unless a rhythm is on.

## 4. The rhythm model (Phase 0)

Engine only, pure, golden-tested; no UI. It settles the vocabulary every later phase uses.

```text
engine/src/rhythm/
  rhythm.ts     types; a text form; validation
  units.ts      Saindon generator: pulse × grouping × variation → a unit
  cards.ts      one-bar rhythm families (Bergonzi 2, 27, 28): generated, not copied
  runs.ts       N consecutive attacks at pulse p from position k (Bergonzi 3–15), with anticipate
  cycle.ts      lay a unit over the chart's Clock (bars of differing length) → attacks in beats, cycle length, landing bars
  pour.ts       pour a Pitched[] into a rhythm's attacks → a voice (Phase 2)
  targets.ts    Galper: target beats per bar by metre; pick-up offsets
```

**Types.**

```ts
type Pulse = '4' | '8' | '8t' | '16' | '4t' | '4q5' | '8q5'     // quarter, 8th, 8th triplet, 16th, quarter triplet, quarter and 8th quintuplets
type Event = Readonly<{ dur: number; rest?: true; tie?: true; accent?: true }>   // dur in pulse units
type Rhythm = Readonly<{ pulse: Pulse; events: readonly Event[]; unit: number; name: string; source: Source }>
type Laid = Readonly<{ attacks: readonly Attack[]; cycleBars: number; landings: readonly number[] }>  // Attack: { at: beats, beats, accent, tied }
```

`unit` is the unit's length in pulse units (Saindon's bracket); `events` is one unit. `cycleRhythm(rhythm, clock)`
repeats the unit from beat 0 across the `Clock` (`metre.ts`), so a bar of `@time 5/4` inside a 4/4 chart takes its
own length and the cycle is computed, not assumed: `cycleBars` is the least number of bars after which the unit is
back on beat one, `landings` the bars where it is (Bergonzi's "hit one on the sixth bar"). A unit longer than the
form is allowed and simply never lands.

**A text form,** so a rhythm can be stated in a test, a share link and, later, by a user: one character a pulse
unit, `x` an attack, `.` a rest, `_` a tie from the previous attack, `>` before an accented attack, `|` optional and
ignored (a reading aid). `8: >xxx>xxx>xx` is Saindon's "8ths phrased in 3 with accents"; `8: x..x..x.` the same
with rests; `8: x_.x_.x_` with ties; `4: .x.x` Bergonzi's upbeats. Groups of a tuplet pulse carry the tuplet in the
pulse, not in the text.

**Generated libraries,** each entry named and sourced (`source: { book, page }` for the help text):

- *Units* (`units.ts`): every pulse × grouping (2–7) × variation (accents, rests-first, rests-last, syncopated,
  dotted/tied, partial subdivision). Saindon's pages are the test oracle for the cases he prints (8ths in 3, 4, 5, 6,
  7 in 3/4, 4/4, 5/4; triplets and 16ths likewise; Chapter 10's quintuplets in 3 and 4).
- *Runs* (`runs.ts`): N ∈ 2–7 consecutive attacks at pulse p from position k ∈ 0–7 (in 4/4 at 8ths), optionally
  `anticipate: true` (the last attack sounds the next chord: a flag the Lines read in Phase 2, a mark on the Changes
  in Phase 1).
- *Cards* (`cards.ts`): one-bar rhythms in quarters and 8ths in the chart's metre. Bergonzi's 22 are a hand-picked
  list under his copyright; CSM generates the family (all one-bar rhythms of 2–6 attacks in quarters and 8ths that
  start off one, say) and lets the user write their own. Three named presets are generic enough to ship: downbeats,
  upbeats (Bergonzi 27), long values only (28).

**Tests and fixture.** Each printed Saindon example a unit test (the book's page as the name); `cycleBars` and
`landings` for every unit over 3/4, 4/4, 5/4, 6/4 and a chart with an `@time` change; the golden fixture gains the
rhythm library (names, text forms, cycle lengths), not its application to every chart.

## 5. Phases

### Phase 1: the rhythm line on the Changes (flag `rhythm`)

- A **Rhythm** control in the Changes toolbar at Intermediate and above, beside Line: **Off** (the sheet as today),
  then a listbox grouped by family: *Units* (pulse, then "in 3 … in 7"), *Runs* (N, from position), *Cards*
  (downbeats, upbeats, long values, custom). The variation (accents · rests · syncopation · ties · subdivision) is a
  second listbox shown for a unit, as the guide line's mode is shown under Line.
- **Drawing.** The beat slashes give way to a one-voice rhythm in slash noteheads with stems, beams by the unit (so the
  grouping reads from the beams, as Saindon prints it), rests, ties across barlines and across lines as the guide
  line's half-tie does, and `>` accents. The unit's first statement gets Saindon's bracket under it; a run from
  position k gets Bergonzi's circled beat label over its first attack. With a Line on as well, the rhythm is not
  drawn (Phase 2 puts the Line *into* the rhythm instead); the control says so.
- **Caption** in the Changes subtitle: "Rhythm: 8ths in 5 · 5-bar cycle · on one at bars 6, 11, 16, 21"; for a
  chart with metre changes, "cycle 5 bars from bar 1, 7 bars from bar 9" or "no cycle" where it never lands.
- **Target beats** (Galper), a Show toggle `csm-targets`, off by default: a small filled dot over beats 1 and 3 in
  4/4 (1 in 3/4; 1 and 4 in 5/4 as 3 + 2, 1 and 4 in 6/4; the timeline's split rule), on the slash sheet and under any
  rhythm. The Help page states the rule in Galper's words: on-beats release, off-beats tension, chord tones on the
  dots.
- **Metre.** `time:` and `@time` extend to **7/4** (`2/4` to `7/4`; the diagnostic adjusts; the timeline's split
  adds 7/4 = 4 + 3 as the default, with `@time 7/4 3+4` later if a chart needs it). Saindon's 5/4 chapters and
  Bergonzi's 5/4 and 7/4 patterns then work both ways: a 5/4 unit over a 4/4 chart and a 4/4 chart written in 5/4.
- **Preferences and links:** `csm-rhythm` (a rhythm id or `custom:<text>`), `csm-rhythm-var`, `csm-targets`; share
  links carry `rhythm` and `targets`. A custom text that fails validation reads as Off.
- **Print:** the rhythm line prints like the slash sheet (eight lines a page, seven with a caption row).
- **Tests:** the model is drawn by `changesDrawing.ts` from a `ChangesBar.rhythm` voice, so the engine side is unit
  tested and the drawing e2e'd (a 5-bar cycle lands on bar 6; a tie crosses a line break; 7/4 draws its signature);
  a11y: the aria-label adds `; rhythm: 8ths in 5, 5-bar cycle`.

### Phase 2: the rhythm on the Lines (the CSM-distinctive phase)

- With a Line on and a Rhythm chosen, `cellVoices` takes the rhythm's attacks instead of the ♩ ♪ 𝅘𝅥𝅯 rule: the cell's
  pitches are **poured** in order into the attacks that fall inside the chord's span, one pitch an attack, rests
  skipped, a tied attack holding its pitch; a cell with more pitches than attacks is cut, with fewer it repeats or
  turns back as today's rules say (`turn back on the last one from its second-to-last note`). This is Galper's "the
  rhythm selects the notes" and Bergonzi's "rhythmising a sequence" on CSM's own cells.
- **Pick-ups** (Galper): a **Start** listbox, *On the beat* (today) · *1-note pick-up* (the and-of-4) · *2-note* (beat
  4) · *3-note* (the and-of-3): the run's first chord tone is placed on the chord's first target beat and the pick-up
  notes are the previous cell's last notes, or the scale notes below the target (pitch from the sheet, never a new
  melody). The first chord of a line, and a chord after a rest, takes its pick-up from outside the bar as Galper's
  examples do, drawn in the bar before.
- **Anticipate** (Bergonzi 3 #5–8, 33): an offset of ½, 1, 1½, 2, 2½ or 3 beats by which each chord's cell begins
  before the chord (`csm-anticipate`, 0 by default); the chord symbol stays where the chart has it. *Resolve late*
  is the same offset the other way and shares the control (−3 … +3 beats).
- **Target beats on the Lines:** with Target beats on, a chord tone that lands on a dot is drawn in the practice
  accent and a non-chord tone on a dot in the dimmed grey, so a player sees at once where a cell is "out of synch"
  in Galper's sense. No rule forces synchrony; the sheet shows it.
- **Guide tones:** the guide line is one note a chord and does not pour; under a rhythm it restates its note on
  each attack within the chord (Galper's "play the target note first"), which turns the long-tone line into a
  comping-style figure. Optional; off by default for guide tones.
- Preferences: `csm-rhythm-start`, `csm-anticipate`; share links carry both.

### Phase 3: the Scales and Arpeggios sheets

- **Rhythm card** (Scales): with a Rhythm chosen, each staff gets a one-line slash card under it: the unit in the
  chart's metre, one cycle long (capped at four bars, then "…"), the bracket and the caption as on the Changes.
  The staff's whole notes stay; the card says *when*, the staff *what*. Twelve staves a page still fit with the
  card at the pentatonic caption's size; the print test is the check.
- **Notes per bar** (Scales, Bergonzi 1): a listbox *Whole notes* (today) · *3 a bar* · *4* · *5* · *6* · *7* · *2*
  · *1*: the staff is rewritten as the scale run (up, or up and down past the octave as the Arpeggios do) in bars of
  N even attacks in the chart's metre, time signature on, beamed by the bar. N even attacks a bar in 4/4 is
  Saindon's "8ths in N" only when N divides the bar, so for 3, 5, 6 and 7 the attacks are a tuplet of the bar (a
  bar-long tuplet, which VexFlow draws) or, with a Rhythm chosen, that rhythm's first N attacks. Practice
  highlighting carries over: a lit note is lit wherever the run plays it.
- **Rhythmised runs** (Arpeggios; Bergonzi 32): the Arpeggio direction stays; a Rhythm pours the arpeggio's tones
  into the rhythm as Phase 2 does for cells, and *Grouping* (in 3 … in 7) re-beams a plain 8th-note run by the
  group without changing its notes (Saindon's accents variation on an existing line), so a 5-group over 4/4 is
  read from the beams.
- The Scales sheet gains a time signature only while a card or Notes per bar is on; the subtitle names the rhythm.

### Phase 4: mixed phrasing, gears and polymetre

- **Mixed phrasing** (Saindon pp. 12, 24; Bergonzi 14): the rhythm changes through the form. Reuse the pentatonic
  path's **Step** machinery (by Section · Key area · Bars 2/4/8): a *Path* of units (in 3, then 4, then 5, …; or a
  user's list) steps one unit a step; each change gets Saindon's circled number over its first attack; an incomplete
  cycle at a step boundary is cut, as the book allows. Per chart, `csm-rhythm-path:<slug>`.
- **Gears** (Bergonzi 22–25): a **Pulse** control on any rhythm: quarter-note triplet · 8th · triplet · 16th ·
  sextuplet, the same events re-timed; and a *Gear path* that changes pulse by step, the way the unit path changes
  grouping. Contraction and expansion (26) is the same transform applied within a section.
- **Feel** (Bergonzi 30; Galper's half time): a *Feel in* control, 4 · 2 · 1: the Changes groups its beat slashes
  (or the rhythm's beams) in pairs or in the whole bar, and the target beats thin to 1 and 3 (in 2) or 1 (in 1).
  Display only; it also sets the click's pattern in Phase 5.
- **Quintuplets and septuplets** (Saindon 10; Bergonzi 24): the quarter-note quintuplet pulse draws as a bar-long
  tuplet; the 8th-note quintuplet as two per bar. Both are drawing cost mostly (tuplet brackets in slash
  notation); the model is Phase 0's.

### Phase 5: hear it (with the playback roadmap)

- The rhythm line becomes a `PlanEvent` track `'rhythm'` (a rim or woodblock, unpitched) that the click plays with;
  a Line under a rhythm sounds in that rhythm through Phase 2's `voice.ts` with no further work, because the voice
  is already the poured one.
- **Click patterns** (Bergonzi 31): the metronome's *Click on* control gains 2 and 4 · 1 and 3 · 3 only · 4 only ·
  the and of 2 and 4, each a one-line pattern over the plan's bars; the Feel control (Phase 4) sets the default.
- The swing slider applies to the rhythm track's 8ths as to every other.

## 6. What the codebase already gives

- **The Clock** (`metre.ts`) and the guide tone timeline: every bar's length and every chord's span, in beats, with
  `@time` changes. `cycleRhythm` walks it; nothing new is needed to find bars, and a 5-bar cycle over a chart with a
  3/4 bar in it is computed, not special-cased.
- **Slash drawing** (`changesDrawing.ts`): slash noteheads, ties, the two-pass stem-tip read, beaming by
  `Beam.generateBeams`, the ending bracket raised over the voice. The rhythm line is a voice of slash noteheads
  with stems; the arpeggio line's drawing path is the template.
- **`cellVoices`** (shared by the arpeggio, pentatonic and triad-pair lines): one place to swap the ♩ ♪ 𝅘𝅥𝅯 rule for a
  rhythm's attacks, so Phase 2 covers three lines at once.
- **Step machinery** (`pentatonicCycle`, Path · Step by Section / Key area / Bars): Phase 4's paths reuse it.
- **Practice highlighting** (`vf-selected`, `vf-dimmed`, `vf-second`): the target-beat presentation is a third use of
  the same classes.
- **Feature flags, tiers, share links, `storedRef`:** every control follows the existing pattern; nothing in the
  rhythm needs a server or a CSP change.
- **Golden fixture:** the rhythm library freezes there; the application to charts is tested by unit tests and e2e,
  as the lines are.

## 7. Problems to expect

1. **Tuplets in slash notation.** VexFlow draws tuplet brackets, but a quarter-note quintuplet across a bar and
   a tie into the next bar's tuplet are the cases that break layout. Phase 0 includes a drawing spike before
   Phase 1 commits to quintuplets; if it is costly, Phases 1–3 ship with quarter, 8th, triplet and 16th pulses, and
   quintuplets wait for Phase 4.
2. **The Scales sheet is metre-free by design.** A rhythm needs a metre; the chart's is the obvious one, but a
   shared Scales sheet with no chart key (a pasted chart) has one too, so this is fine. The sheet must not grow a
   time signature unless a rhythm is on.
3. **Bergonzi's lists are his.** The 22 rhythms, the tunes and every notated example are copyrighted; CSM ships
   generated families and formulas, cites the books on the Help page and in each control's description, and never
   reproduces a page. Saindon's units are a formula and are safe to generate; his etudes (mixed phrasing pages) are
   not copied either, only the device.
4. **Rhythms of famous heads** (Galper's Confirmation exercise). A library of bebop heads' rhythms is the obvious
   "rhythm first" feature and is set aside: the rhythm of a melody is part of the melody, and the project keeps
   melodies on YouTube (the notable-recordings decision). The *custom rhythm* text field lets a player type a head's
   rhythm for themselves, which keeps the exercise and leaves the content with the player.
5. **Pick-ups need notes from outside the chord.** A 3-note pick-up into a chord's first target beat takes its notes
   from the previous cell or from the scale below the target; both are pitches the sheet already has, but the rule
   must be stated so the Help page can explain any pick-up it draws. The spec states it; the line's note explains it
   as the chord notes do today.
6. **Too many controls.** Rhythm, variation, start, anticipate, feel, pulse, path: at Everything this is seven
   listboxes. Phases 1–2 show Rhythm, Variation and Target beats at Intermediate; Start and Anticipate at
   Everything; Phase 4's at Everything only. The hidden-settings notice covers the rest, as for chord picks.
7. **Print density.** A rhythm line with ties and accents is taller than a slash line; measure the lines a page on
   Stardust and a 5/4 chart before the spec fixes the count.

## 8. Opportunities

- **The sheet CSM alone can make.** iReal Pro, the Real Book and the play-along books give the changes; Saindon
  and Bergonzi give rhythms over *their* tunes. A rhythm line over *any* chart in the library, in the chart's own
  metre, with the cycle computed and its landing bars named, is a practice sheet none of them makes.
- **Odd-metre charts for free.** Once 7/4 is in, the library can take *Take Five* (5/4) and the 7/4 standards, and
  the rhythm line is the odd-metre practice tool the Mel Bay etude books sell.
- **Galper on the Changes** is cheap: target-beat dots and the pick-up start are small changes to lines that
  already exist, and they make the guide-tone and arpeggio lines sound like phrases instead of exercises.
- **Teacher assignments.** A share link carrying `rhythm`, `start` and `anticipate` is a one-week assignment:
  "the 7th-chord line, 8ths in 5, 2-note pick-ups, on Stella".
- **Playback's percussion track** makes the rhythm audible before any pitch is involved, which is how all three
  books ask that it be practised first.

## 9. Decisions to make before Phase 0

1. The text form for rhythms (§4): fix it now, since share links and tests will carry it. (Recommendation: the
   `x . _ >` form with the pulse prefix; one line, no bar lines required.)
2. Which pulses ship in Phase 1: quarter, 8th, triplet, 16th only, or quintuplets too? (Recommendation: the four;
   quintuplets after the drawing spike.)
3. 7/4 in Phase 1 or later? (Recommendation: Phase 1; it is a parser range and a split rule, and Bergonzi's 7/4
   chapter has nowhere to land without it.)
4. Does a rhythm under a Line (Phase 2) replace the ♩ ♪ 𝅘𝅥𝅯 rule, or is it a third choice beside it? (Recommendation:
   replace while on; Off restores the rule, so nothing stored migrates.)
5. Target beats as a Show toggle (recommended) or always on with a rhythm?

## Sources

- Ed Saindon, *Exploration in Rhythm Vol. 1: Rhythmic Phrasing in Improvisation* (Advance Music, 2004):
  Introduction pp. 7–9; Chapters 1–3 (8ths in 3/4, 4/4, 5/4), 4–6 (triplets), 7–9 (16ths), 10 (polyrhythms, pp.
  56–63).
- Jerry Bergonzi, *Inside Improvisation Vol. 4: Melodic Rhythms* (Advance Music): Introduction p. 8; Chapters 1–3
  (pp. 9–31), 9–15 (pp. 51–65), 16–19 (pp. 66–77), 22 (pp. 87–93), 27–33 (pp. 110–119).
- Hal Galper, *Forward Motion: From Bach to Bebop* (Sher Music, 2005): Chapter 2 "Rhythmic Forward Motion" (pp.
  47–66), Chapter 3 "Scalar Forward Motion" (pp. 67–82), Chapter 10 "How to Practice Forward Motion" (pp.
  169–172).
- Repo: `docs/design.md` §4 (metre, `@time`, the timeline), §5 (Changes, Lines, `cellVoices`, Practice, chord
  picks), §6a (print); `engine/src/metre.ts`, `guideToneTimeline.ts`, `changes.ts`; project doc
  `claude/playback-roadmap.md` (Phases 1–2, §7).
