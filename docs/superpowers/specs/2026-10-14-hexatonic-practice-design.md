# Hexatonics: a practice preset on the Scales sheet and an Overlay on the Changes sheet (issue TBD)

## Goal

A player choosing notes for a solo over one chord gets two things from a hexatonic (a six-note set made of two
triads): *which* triad pair to use from the chord's scale, and *how* to divide its six notes into groups to practise
from. The Scales sheet lights a chosen pair on every staff, in one of four groupings, with the two groups tinted apart.
The Changes sheet labels each chord with its best pair, in place of the Pentatonics row when the player prefers.

This follows the pentatonic work (#255, #264, #265, #266) and reuses its machinery where it fits: a per-staff caption,
the fifths distance from `ladder.ts`, and an Analysis row on the Changes sheet.

The source is Gary Campbell, *Triad Pairs for Jazz* (2001), "Applying Triad Pairs", pp. 4–8.

## Decisions (from the brainstorm, 2026-10-14)

- **Hexatonic is the *what*, grouping is the *how*.** The pair chooses the six notes; the grouping chooses how they
  are divided and which notes are tinted as each group. Triad pair is one grouping, not the definition.
- **Candidates follow Campbell: triad pairs inside the staff's own scale.** "Use any two adjacent diatonic triads
  within a parent scale" (p. 4); on the symmetrical scales, any two of its triads "that do not share a common tone"
  (pp. 7–8). A hexatonic is therefore always inside the staff's scale: on a seven-note scale it is the scale less one
  note, on an eight-note scale less two. The parent scale is the staff's resolved scale, so a player reaches an
  outside sound by choosing the scale (the analysis level, or a written scale), not by a hexatonic control. Decided
  2026-10-14 over a fixed pool of 48 major/minor pairs a whole step apart (too narrow: it missed Em/F, Am/B°, B°/C in
  major) and over a pool of every parent scale's pairs with a Fit control (228 sets; too many choices to show).
- **One Pair control, not Fit and Pick.** The player chooses the *n*th link of the staff's triad chain (below), or
  Auto. On a seven-note scale link *n* is the pair on degree *n* (1 is the pair on the root), so the same setting
  reads alike on every staff. Decided 2026-10-14: the UI stays uncluttered, and a degree is a musical choice where a
  rank number was not.
- **Four groupings:** Triad pair, Chord tones + color, Pentatonic + 1, Trichords 3+3. Intervallic diads, rotation and
  omission are playing techniques or already covered (rotation is From X), and stay out.
- **Grouping is a second control, shown only while the Hexatonic preset is on.** Default Triad pair.
- **Overlay replaces the Pentatonics toggle on the Changes sheet:** Off | Pentatonic | Hexatonic. Showing both at once
  would be confusing. Each option is offered only when its flag is on. The Hexatonic overlay always shows Auto.
- **Derived, never stored.** The hexatonic is computed from the resolved scale of each chord, as the pentatonics are:
  it is not written into chart rows or the saved analysis reasons, so no chart file changes.
- **Version 1 has one setting for the whole sheet.** Per-section choices are a later phase.

## The triad chain

Campbell builds each scale's pairs from a chain of triads: start from a triad on the scale's root and move each of its
three notes up one step in the scale; repeat until the chain returns to its start. Adjacent triads in the chain are the
candidate pairs, with the last linking back to the first.

- **Start triad.** On a seven-note scale, the triad stacked on degree 1 (degrees 1, 3, 5), whatever its quality. On
  any other scale, the first major triad on a scale note from the root upward, else the first minor one; if the scale
  holds neither, it has no chain.
- **Length.** The chain has as many triads as the scale has notes: 7 links on a seven-note scale, 8 on an eight-note
  one.
- **Valid links.** A link is a pair when both triads are major, minor, diminished or augmented, and they share no
  note. Other links are skipped. The staff's pairs are its valid links in chain order, numbered 1, 2, 3 … from the
  start.

On a seven-note scale the chain is the scale's own triads in order, and stacked triads on neighbouring degrees never
share a note, so every link whose triads are standard is valid. Examples (pitch classes relative to the scale's root):

| Scale | Chain (C as root) | Pairs |
| --- | --- | --- |
| Major (Ionian) | C Dm Em F G Am B° | C/Dm, Dm/Em, Em/F, F/G, G/Am, Am/B°, B°/C |
| Melodic minor | Cm Dm E♭+ F G A° B° | 7, two with E♭+ |
| Harmonic minor | Cm D° E♭+ Fm G A♭ B° | 7 |
| Harmonic major | C D° Em Fm G A♭+ B° | 7 |
| Half-whole diminished | C F♯m E♭ Am F♯ Cm A E♭m (Campbell p. 7) | 8: C/F♯m, F♯m/E♭, E♭/Am, Am/F♯, F♯/Cm, Cm/A, A/E♭m, E♭m/C |
| Whole-half diminished | D A♭m F Bm A♭ Dm B Fm (starts on degree 2's major triad) | 8, as half-whole on D |
| Bebop major (C D E F G A♭ A B) | C D° · F° · A♭° Am B° (· not a triad) | 4: C/D°, A♭°/Am, Am/B°, B°/C |
| Whole tone, blues, pentatonics | no major or minor triad (whole tone), or no valid link | none |

Each pair on a seven-note scale leaves out one note: the pair on degree *n* drops degree *n* − 1 (G/Am in C major drops
F). The help text says so: "leave out the 4th" is the choice a player is making.

On the half-whole scale Campbell also allows the four same-quality tritone pairs off the chain (C/F♯, Cm/F♯m, E♭/A,
E♭m/Am). They are out of scope: the chain is the stepwise method he teaches, and eight choices are enough.

**Spelling.** Triad roots are scale notes, so each takes the staff's own spelling of that note (the staff's scale is
already spelled by `simplifyRoot`, and written for a transposing part). Names are `glyphs(root)` plus `m`, `°` or `+`,
joined by `/` in chain order (`G/Am`, `B°/C`, `E♭+/F`).

## Auto

Auto picks one of the staff's pairs, by:

1. **Chord-tone coverage**, most first: how many of the chord's tones (the `CHORD_TONES` table in `practice.ts`, by the
   chord's base quality) the six notes contain. An unknown quality scores 0 for all, so this rule drops out.
2. **Major and minor triads**, both first: a pair with a diminished or augmented triad ranks after one without.
   Campbell's case for triads is their "stand alone" sound (p. 3), which the major and minor triads carry best.
3. **Nearest lower root**, fewest fifths first: `fifthsFrom(lowerRoot, chordRoot)`, ♭ side first on a tie, as for the
   pentatonics.
4. **Chain position**, so the order is total.

Worked examples, scale = the chord's own default scale, hand-derived (the tests check them against the computed pick):

| Staff | Coverage 4 | Auto | Leaves out |
| --- | --- | --- | --- |
| Cmaj7, C Ionian | Em/F, G/Am, B°/C | G/Am | F, the avoid note |
| Dm7, D Dorian | F/G, Am/B°, C/Dm | C/Dm | B |
| G7, G Mixolydian | B°/C, Dm/Em, F/G | Dm/Em | C, the avoid note |
| C7, C half-whole | E♭/Am, E♭m/C | E♭/Am | D♭, F♯ |

## Pair resolution

The selection's `pair` is 0 (Auto) or 1–8. Each staff resolves it on its own:

1. No pairs (no chain, or no valid link): no hexatonic; the caption says `no triad pair`.
2. Auto: the pick above.
3. *n*: the staff's pair at position `((n − 1) mod count) + 1`, so a number past the end of a seven-link chain wraps
   round (8 on a seven-note staff is its pair 1). The caption names the pair used, so the wrap is visible.

## The groupings

A grouping maps the six notes to group A, group B, or (for scale notes outside the hexatonic) dimmed. Only the staff's
own scale notes are drawn, so the one or two dimmed notes show what the pair leaves out.

| Grouping | Group A | Group B |
| --- | --- | --- |
| Triad pair | the lower triad (first in the chain) | the upper triad |
| Chord tones + color | the hexatonic's notes that are chord tones of the staff's chord | its other notes |
| Pentatonic + 1 | the minor pentatonic with most notes inside the hexatonic (ties: `rankByFifths` from the chord root) | the hexatonic's notes outside that pentatonic (usually one) |
| Trichords 3+3 | the lowest three notes ascending from the lower root | the highest three |

Where a chord's quality is unknown, Chord tones + color lights all six as group A. Trichord examples: `C/Dm` gives
`C D E | F G A`; `Em/F` gives `E F G | A B C`.

## Engine

- `hexatonics.ts` (new):
  - `TriadQuality = 'maj' | 'min' | 'dim' | 'aug'`; `HexPair = { link, lower, upper, name, tones, coverage }`, `lower`
    and `upper` as `{ root: Spelled; quality: TriadQuality; pcs }`.
  - `triadChain(scale)`: the chain for a spelled scale, in order from its start triad (empty if none).
  - `hexatonicPairs(scale, chordRoot, quality)`: the valid links, numbered from 1, with coverage.
  - `hexatonicAuto(pairs, chordRoot)`, `HEX_PAIRS = 8`, `resolvePair(pairs, pair, chordRoot)`.
  - `HexGrouping = 'triads' | 'tones' | 'pent' | 'trichords'`, `HEX_GROUPINGS`,
    `hexatonicPick(scale, chordRoot, quality, pair, grouping)` returning `{ hexatonic: StaffHexatonic | null; lit:
    boolean[]; second: boolean[] }` (`second`: the lit notes in group B), and `hexatonicCaption`.
- `CHORD_TONES` is exported from `practice.ts`, or moved to `qualities.ts` if `practice.ts` must import
  `hexatonics.ts` (no import cycle).
- `practice.ts`:
  - `Preset` gains `'hexatonic'`; `PRESETS.root` and `PRESETS.from` end with it; `PRESET_LABELS.hexatonic = 'Hexatonic'`.
  - `PracticeSelection` gains `{ preset: 'hexatonic'; pair: number; grouping: HexGrouping }`.
  - `practiceSelectionFrom`: an integer `pair` 0–8, else 0; a `grouping` in the list, else `triads`.
  - `selectedNotes` lights nothing under a hexatonic selection (staves light it through `hexatonicPick`, as for the
    pentatonics); `isHexatonicSelection`.
- `sheet.ts`: `StaffModel.hexatonic: StaffHexatonic | null` and `StaffModel.second: boolean[] | null`, set by
  `practiceFor` under the preset, null otherwise and for error staves. `selected` stays the lit set (so `litKeys` and
  box editing work unchanged); `second` marks group B inside it. The staff `id` gains nothing: `selected` and `second`
  redraw.
- `changes.ts`: `ChangesChord.hexatonic: { label: string; name: string } | null`, the Auto pair of the chord's
  resolved scale; `buildChanges` takes an overlay plan (`{ kind: 'pentatonic', … } | { kind: 'hexatonic' } | null`) in
  place of the pentatonic plan. `showHexatonics` prints a label where it changes from the previous chord on the line,
  as `showPentatonics` does. `changesLinesPerPage` counts the overlay row exactly as it counts the pentatonics row. The
  contour band (#265) belongs to the Pentatonic overlay and is absent from Hexatonic.
- `index.ts` exports the new names; `api.test.ts` snapshot updated.
- `engine/fixtures/golden.json`: the golden input set gains `hexatonicPairs` for every scale in `SCALES` on C, and the
  Auto pick for each quality's default scale, so a change to a rule shows in the diff. Run `make golden`; review it.

## Web

- **Flag** `hexatonics` (off; e2e on). Off: the Hexatonic preset and the Hexatonic overlay option are absent, and a
  stored or shared hexatonic selection is ignored (`EditorView` treats it as none).
- **`PracticePanel`**: the Hexatonic `ToggleButton` after the Pentatonic one. While it is the selection, two
  `UiListbox`es beneath, in one row (wrapping on phones): `aria-label="Hexatonic pair"` (Auto, 1 … 8) and
  `aria-label="Hexatonic grouping"` (Triad pair, Chord tones + color, Pentatonic + 1, Trichords 3+3), plus a legend of
  two swatches matching the tints, named for the grouping's two groups. Picks emit `{ preset: 'hexatonic', pair,
  grouping }`. Help text gains two sentences: pair *n* is the triads on degrees *n* and *n* + 1 of each staff's scale,
  and it leaves out degree *n* − 1.
- **`ScaleStaff`**: a caption under the chord symbols: `G/Am hex`, or `no triad pair`. One line in print at 10px, as
  the pentatonic caption.
- **Tints.** `drawStaff` tags group B notes `vf-second` beside `vf-selected`. On screen group A keeps the staff's ink in
  light mode and the accent in dark mode (as selected notes do now); group B takes a second accent token from the
  theme, distinct in light and dark, with the dimmed notes as today. In print group A is black, group B mid-grey
  (darker than the dimmed light grey), and the caption does not depend on colour.
- **Overlay.** In `PreviewControls`, the Analysis group's Pentatonics toggle becomes a `UiListbox`
  (`aria-label="Overlay"`): Off | Pentatonic | Hexatonic, each option present only with its flag. Rung, Side and Path
  show only for Pentatonic; Hexatonic adds no control. Preference `csm-overlay` (`off` | `pentatonic` | `hexatonic`),
  not in share links; a stored `csm-pentatonics: true` with no `csm-overlay` reads as `pentatonic`.
- **`ChangesSystem`**: the hexatonic label sits in the pentatonic row's position under each chord, `G/Am`; blank where
  the chord's scale has no pair; no popover in version 1.

## Testing

- Engine (test first): `triadChain` for major, melodic minor, harmonic minor, harmonic major (7 triads, the table's
  qualities), half-whole (Campbell's chain, p. 7), whole-half (starts on degree 2), bebop major (valid links only),
  whole tone, blues and the pentatonics (none); every valid pair is two disjoint triads inside the scale; on a
  seven-note scale pair *n* leaves out degree *n* − 1; the worked Auto table; the major/minor rule breaks a coverage
  tie that fifths alone would order the other way (Cmaj7: G/Am over B°/C); an unknown quality drops the coverage rule;
  pair resolution (Auto, exact, wrap on a seven-link chain, none); each grouping's A and B for a known pair; Pentatonic
  + 1 where the best pentatonic is not wholly inside; names spell with the staff's scale (`B°/C`, `E♭+/F`, a B♭ tenor
  part's written names); `practiceSelectionFrom` round-trips and clamps pair and grouping; `buildSheet` sets
  `hexatonic` and `second` only under the preset, and not for error staves; share-link round-trip; `buildChanges`
  labels, `showHexatonics` dedupe, `changesLinesPerPage` unchanged for the overlay row.
- Web unit: `PracticePanel` shows the preset and its two controls only with the flag, emits picks; `ScaleStaff`
  caption both forms and the `vf-second` tag; `PreviewControls` Overlay options by flag, controls per option,
  preference migration from `csm-pentatonics`.
- e2e: Scales sheet, Practice on, Hexatonic, each grouping: captions present, group A and B counts per staff match
  the caption's pair; Pair 5 on a C major staff captions `G/Am hex`. Changes sheet: Overlay Hexatonic shows labels and
  no contour; switching to Pentatonic restores the rung controls. `print.spec`: lines per page unchanged on the Scales
  and Changes sheets.
- `make test`, `make lint`, `make e2e`, `make golden` with its diff reviewed.

## Out of scope

- Pairs from outside the staff's scale, and a Fit control for them.
- Campbell's off-chain pairs on the diminished scale (C/F♯, Cm/F♯m, E♭/A, E♭m/Am).
- The augmented scale (Campbell p. 8; not in `SCALES`: it would need its own chord pairing first) and the whole-tone
  scale (no major or minor triad; C+/D+ is not Campbell's material).
- Campbell's pentatonic material.
- Per-section choices and a tension contour for hexatonics (the pentatonic phases 2 and 3 of the Changes sheet).
- A popover on the Changes label to pick a different pair for one chord.
- Writing the hexatonic into chart rows or the saved analysis reasons.
- Intervallic diads, rotation and omission as groupings.

## Open questions

1. **Pair labels.** Plain numbers (1 … 8) read as degrees on seven-note staves. If players find them opaque, label the
   first seven `1–2` … `7–1`; decide at the browser check.
2. **Print legend.** Group A and B differ by grey level in print. If that is too faint on paper, add a suffix to the
   caption (`G/Am hex · A|B`) or a legend line in the sheet heading. Decide at the print check.
3. **Where the Changes label draws its scale.** The overlay needs each chord's resolved scale at the sheet's level
   (`resolve.ts`, as the Scales row uses it); confirm in `changes.ts` that it is available at the label's point.
