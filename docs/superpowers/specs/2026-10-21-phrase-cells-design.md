# Phrase cells: from one bar to a phrase (#376–#380)

Follows Part 2 of the practice-patterns spec (docs/superpowers/specs/2026-10-17-practice-patterns-design.md, "melodic
cells"), whose "Later" list this takes up, all but octave displacement (#375).

## Intent

The Cells line thinks one chord at a time: each two-beat slot plays its system's A or B cell through the chord's
scale, and only placement ("nearest the last note") ties one cell to the next. Vincent's systems chain by their
targets only in a cycle of 4ths. The owner's aim is completeness, taking the line **from one bar to a phrase**: a line
whose cells lead into the next chord whatever the progression, that colours a long dominant, and whose cells can be
turned around or bent chromatically.

Five issues, two kinds:
- **Phrase** (#379 four-beat II–V chains, #380 turnaround systems, #378 substitute cells over a long V7): the line
  looks past the current chord.
- **Vocabulary** (#376 reversals and permutations, #377 chromatic cells): what a cell can be, wherever it lands.

**Source.** The cells, orders, targets and substitutions below are **this spec's own design** (marked *ours*), from
general jazz practice, not transcribed from Vincent's chapters (the owner's call: no quoting from the book). Where they
echo Vincent's ideas the issue names the chapter.

## Goals

1. **Phrase on by default.** With a system chosen, each cell is picked to step into the next chord's target, so II–V,
   II–V–I, turnarounds (I–VI–II–V, iii–VI–II–V, I–♭III–♭VI–♭II) and four-beat II–Vs come out as chained lines with no
   per-progression choice. One switch turns it off (the line as it is today).
2. **Long dominants.** In phrase mode a dominant lasting two or more slots plays some slots through a substitute: the
   tritone sub, and on a long one also the minor-3rd-related dominant.
3. **Order.** One listbox to play every cell as written, reversed, rotated or with its pairs swapped.
4. **Chromatic cells.** A third group in the Cells listbox: four dominant cells with altered or passing degrees, and a
   chromatic II–V.

## Non-goals

- Octave displacement (#375): separate.
- Recognising II–V or turnaround spans as named objects: targeting is generic, so no span detection is needed for 1
  (*ours*: simpler and covers variants a recogniser would miss). The long-dominant rule (2) reads root motion too.
- Curated licks; cells longer than four notes (a "four-beat chain" is two cells per chord, each aimed at the next).

## Anti-goals

- A single cell (the "Cells" group) is a drill: phrase mode never changes it. Phrase applies to systems only.
- No new wrong notes: a chromatic degree is spelled from the chord's root by its degree number (♭9 of G is A♭, never
  G♯); a substitute's cells are spelled through the substitute's scale.
- Existing share links keep opening (old `cells:<id>` reads as Order "as written", phrase on).

## Design

### 1. Phrase: each cell aimed at the next target (#379, #380) — *ours*

Terms (from Part 2): a system is a pair of cells A, B, alternating slot by slot; each cell's **first degree** is its
slot's **target** (3rd to 5th: A starts on 3, B on 5).

With phrase on and a system chosen, for each slot *s* whose next slot *s+1* is in the same run (no rest between):
1. The next target pitch class *T* = the first degree of the system's cell for slot *s+1* (by its A/B parity), read
   through slot *s+1*'s chord and scale (for a substitute slot, its substitute's, see 2).
2. **Keep** the system's own cell for *s* if its last note is a **step** from *T*: 1 or 2 semitones, either way. A
   common tone (0) is not a step.
3. Else take the first cell in the **palette** whose first degree equals the system cell's first degree (the slot
   keeps the target the last cell aimed at) and whose last note is a step from *T*.
4. None: the system's own cell (the chain breaks there, as today).

The last slot of a run (before a rest or the end) plays the system's cell.

**Palette** (in this order; each with its contour, after Order is applied, see 3): `3 2 1 7` ddd, `1 3 5 7` uuu,
`3 5 7 9` uuu, `1 2 3 5` uuu, `5 3 2 1` ddd, `3 5 1 7` uud, `3 1 7 5` ddd, `1 7 6 5` ddd, `5 3 1 7` ddd, `7 1 3 5` uuu,
`5 6 7 9` uuu, `1 6 5 3` ddd, `1 3 5 3` uud, `1 5 3 5` udu, `1 2 3 1` uud: the systems' cells first, by how often a
system uses them, then the single cells in their listbox order. Chromatic cells are not in the palette.

A four-beat chord has two slots: its first slot aims at its own second slot's target, the second at the next chord's.
That is #379's four-beat chain: eight notes over the II leading into the V.

Worked examples (pitch classes; acceptance tests, computed, not hand-picked):
A and B still alternate by the run's count, as today (`cellsOf`, `count % 2`).
- II–V–I in C, two beats each, 3rd to 3rd: Dm7 A `3 2 1 7` F E D C · G7 B `3 5 1 7` B D G F · E… (both system cells
  already step: kept).
- I–VI–II–V in C (C A7 Dm7 G7), two beats each, 3rd to 3rd: E D C B · C♯ E A G · F E D C · B D G F: every system cell
  already steps into the next 3rd (B→C♯, G→F, C→B, F→E), and the chain closes back onto I's E.

**Which slots are targeted** (*ours*): only a full four-note cell. A slot cut short, turned back (a 3/4 bar, a
three-beat chord's second slot), carried across a bar line, or in sixteenths under a short chord plays the system's
cell, as today; the next full slot is targeted from wherever the line is. A cell followed by its own turn-back, or by
a cut cell, is not aimed either (the join into the next chord is then the turn-back's note); `cellVoices` tells each
slot what follows it. A/B parity and a dominant's slot count
(section 2) count every slot, full or not (`count` and `nth`, as `Cells.next` receives them).

**With Approach** (*ours*): both run. Phrase picks the cells; an approach figure (#381, `withApproach`) then replaces
the tail of a chord's last cell as it does today. The figure leads into the next chord's first note, which is the
target phrase aimed at, so they agree; the controls sit side by side.
- The builder writes the expected lines for: the same under each of the four systems; iii–VI–II–V; I–♭III–♭VI–♭II
  (where some slots find no cell and break: the test pins which); a four-beat II–V (Dm7 4 beats, G7 4 beats).

### 2. Substitutes over a long dominant (#378) — *ours*

In phrase mode, a dominant chord (the engine's dominant quality family; not sus) lasting **two or more slots** that
**resolves**, its next chord's root a perfect 5th or a half step below its own, plays its slots, counting from its
first (*ours*: root motion, not the analysis's numerals, which can't tell a resolving `III7` from a blues `I7`; a blues
`C7 → F7` resolves and takes substitutes, as jazz players do). The last chord of a run, or one before a rest, has no
next chord: no substitutes. A dominant whose scale the chart writes (a pin, `# keep:` or not) plays its pinned scale in
every slot: substitutes only replace a scale the app chose (analysis or quality default).

| slot | read through |
|---|---|
| 1st, and every slot 4n+1 | its own chord and scale |
| 2nd, 4th, … (even) | the **tritone sub**: root a tritone away, scale Lydian Dominant (over G7: D♭7, the notes of G Altered) |
| 3rd, 4n+3 | the **minor-3rd dominant**: root a minor 3rd up, scale Half-Whole Dim. (over G7: B♭7, the notes of G Half-Whole) |

So a two-slot V7 plays own then tritone (resolving by half step into I), four slots own, tritone, minor-3rd, tritone.
The cell's degrees are read from the substitute's root (`3 5 7 9` over the D♭7 slot of G7: F A♭ C♭ E♭). Targeting (1)
uses the substitute as that slot's chord. The chord symbol above the staff stays as written; a slot's substitute is
shown nowhere else in version 1 (*ours*: a small "D♭7" above the slot is a later idea).

The cells need, per chord, whether its scale is written (a pin): `buildChanges` (engine/src/changes.ts) knows it where
it builds the `GuideInput`s; pass it on `GuideInput` or as a lookup by `row`. Builder's call which.

### 3. Order (#376) — *ours*

A listbox **Order** applied to every cell before anything else (systems, singles, chromatic, the palette):

| Order | degrees `a b c d` become | contour |
|---|---|---|
| As written | `a b c d` | as written |
| Reversed | `d c b a` | the moves reversed and flipped (`uud` → `udd`) |
| Rotated | `b c d a` | moves 2, 3 kept; the new last move the nearer way (≤ 6 semitones; a tritone goes up) |
| Pairs swapped | `b a d c` | each move the nearer way, as above |

"The nearer way" is decided on the chord's actual notes, per slot.

### 4. Chromatic cells (#377) — *ours*

A third group, **Chromatic**, in the Cells listbox (after Systems and Cells). A chromatic degree carries an accidental
and is **absolute** from the root (♭9 = 1 semitone, ♯5 = 8, ♮7 = 11 above it), spelled on the letter its number names;
a plain degree is read through the scale as now.

| Cell | over G7 | plays over |
|---|---|---|
| `1 ♮7 7 6` ddd | G F♯ F E | dominants |
| `5 ♯5 6 7` uuu | D D♯ E F | dominants |
| `♭9 1 3 5` duu | A♭ G B D | dominants |
| `3 5 7 ♭9` uuu | B D F A♭ | dominants |
| II–V chromatic | Dm7: `1 3 5 7` D F A C · G7: `3 5 7 ♭9` B D F A♭ | every chord: dominants `3 5 7 ♭9`, others `1 3 5 7` |

A dominant-only cell over a chord that isn't a dominant plays that chord's 7th chord arpeggio up from the root, as a
cell with no tones does today. Chromatic entries are single cells: phrase mode leaves them as chosen.

### Controls

In the Line options popover, under `EaseReveal :show="lineMode === 'cells'"` beside the Approach listbox
(web/app/components/PreviewControls.vue):
- **Order** listbox (the four rows above).
- **Phrase** `ToggleButton`, on by default, shown only while a system is chosen; its title: "Aim each cell at the next
  chord, and colour long dominants".
- The Cells listbox gains the **Chromatic** group.

Stored like `csm-cells`: `csm-cells-order` (`as-written` | `reversed` | `rotated` | `swapped`), `csm-cells-phrase`
(boolean, default true). Chromatic ids: `1-n7-7-6`, `5-s5-6-7`, `b9-1-3-5`, `3-5-7-b9`, `ii-v-chromatic`. Share links:
`line=cells:<id>` with optional `~<order>` and `~free` (phrase off), e.g. `cells:3rd-3rd~reversed~free`; a bare
`cells:<id>` is as written, phrase on. Interface level: intermediate, as the cell choice (web/app/utils/interface.ts).
The rail must not grow a row at 1440 px or on a phone (`editor.spec.ts`, `phone.spec.ts`).

### Flag

A new flag **`phraseCells`**, off (CLAUDE.md: new flags start off; `cells` is already on in production, and phrase-on
by default changes what today's Cells lines play). Under it: the phrase switch and its behaviour, substitutes, Order,
the Chromatic group. Off: the Cells line exactly as today. The last PR turns it on.

## Docs

Help (the Cells line), How it decides (how phrase picks a cell, the substitutes), each with the flag; release notes
per PR as the flag's PRs land (the flag-on PR carries the user-facing note).

## Build order (each its own PR)

1. Order (#376): engine transform + listbox + storage/share. Smallest, and the palette needs it.
2. Phrase targeting (#379, #380): engine selection + switch + storage/share; the worked examples as tests.
3. Substitutes over a long dominant (#378): needs the analysis passed to the cells.
4. Chromatic cells (#377): degree notation with accidentals, the group, ids.
5. Turn `phraseCells` on; release note; close #376–#380.

## Decided

- Phrase is the default, with one switch to turn it off (owner).
- Cells, orders and substitutions are designed here, not quoted from the book, and marked *ours* (owner).
- Order is one listbox applied to every cell; chromatic cells are a listbox group (owner, on the cleaner interface).
- Targeting is generic (no II–V / turnaround recogniser); phrase never touches single cells; a new flag
  `phraseCells` (*ours*).
- Only full four-note slots are targeted; Approach and phrase both run, Approach last; substitutes go to a dominant
  that resolves by root motion (5th or half step down) and never replace a written scale (*ours*).

## Left to the builder

- How a pinned scale reaches the cells (a field on `GuideInput` or a lookup) and how "dominant quality" is tested.
- The exact expected lines in the tests beyond the two worked examples, computed and reviewed.
- Help/How-it-decides wording.
