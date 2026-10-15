# Chord picks: pick one chord's pentatonic or triad pair, on either sheet (issue #303)

**Status:** built (branch `chord-picks`).

## Goal

A player can override the sheet-wide choice for one chord: click a chord's pentatonic or hexatonic label (Changes
sheet) or a staff's caption (Scales sheet), and a popover lists that chord's choices ordered inside → outside, each
with how much it shares with the chord's scale. A sheet-wide order can't run inside → outside for every chord (the
minor pentatonic on 6 is inside on Cmaj7, on 1 on Cm7); a per-chord list can.

This extends the per-label pentatonic picks of #272 (`docs/superpowers/specs/2026-10-14-pentatonic-per-chord-design.md`)
to the Scales sheet, to hexatonics, and to share links. It builds on #286's **Built on** picker and #295's hexatonics.

## Decisions (from the brainstorm, 2026-10-15)

- **A pick belongs to one chord position** (`ChordAt`: section, bar, chord index), as #272's do. Picks are per kind:
  pentatonic and hexatonic.
- **One set of picks serves both sheets.** A pick made on either sheet shows on the other.
- **Scales sheet tie-break:** a staff covers every position that plays its chord and scale (`scaleLines`). It shows the
  pick of its first position in the form; where the covered positions' picks differ, its caption adds `· varies`.
- **A pick made on a Scales staff sets every position the staff covers** (and so clears `varies`).
- **Say what a pick touches.** Each popover's header names the chord, scale and bars (`D♭7 Mixolydian · bars 6, 22`);
  its footer says what the pick changes: on Scales, "Sets bars 6 and 22 on the Changes sheet too." (or, under
  `varies`, "Replaces the different picks in bars 6 and 22."); on Changes, the bar(s) its label's run covers.
- **Picks ride share links**, keyed by position. A pick whose position no longer plays the chord and scale it was made
  for is ignored (and dropped on the next write).
- **Picks survive changes to Built on, Path, Rung, Side and Ranked against** (a change from #272, which cleared them).
  They are cleared by the popover's per-chord **Sheet's choice** row and by More actions → Reset.
- **Picks apply on both pentatonic bases** (Key and Chord), as #272's do now.
- **Never in chart rows** or the saved analysis.
- **Interface tier:** the popovers are at Everything (`CONTROL_TIERS` id `chord-picks`); picks in force at a lower
  level are named by the hidden-settings notice, like other settings away from their default.

## The popover

One component for both kinds and both sheets, built on the existing pentatonic popover (`PentatonicLadder.vue`'s
Chord-basis list) and the `SheetLabelPicker` / `RailPopover` patterns:

```
D♭7 Mixolydian · bars 6, 22
──────────────
  Sheet's choice (Auto)
✓ A♭m pent · 5 shared
  E♭m pent · 5 shared
  …
──────────────
Sets bars 6 and 22 on the Changes sheet too.
```

- **Pentatonic rows:** the 12 minor pentatonics in `pentatonicRanking` order (most shared, then fewest fifths from the
  chord root, ♭ side first), labelled with name, degree and shared count (`A♭m pent · on 5 · 5 shared`). On the Key
  basis on the Changes sheet the rows stay the ladder, as now.
- **Hexatonic rows:** the staff's pairs in Auto order (`hexatonicAuto`'s ranking: coverage, major/minor, fifths, chain),
  labelled `G/Am · covers 4` (chord tones covered).
- **Sheet's choice** drops the pick for the positions the popover covers; its label names what the sheet would play.
- Keyboard and screen reader behaviour as the existing popovers; print never shows a popover.

## Engine

- **Pick values.** A pentatonic pick stores the pentatonic's root, concert pitch class (as #272). A hexatonic pick
  stores its two triads' roots, concert pitch classes, lower first; it applies when a pair with those roots is among
  the chord's pairs. Each pick also stores the chord and scale it was made for (`for: "<chord>|<scale>"`, concert); a
  pick whose position now plays something else is ignored. A legacy #272 pick (a bare number) has no `for` and applies
  as before.
- `ChordPicks = { pentatonic: Record<ChordAt, PentPick>; hexatonic: Record<ChordAt, HexPick> }`;
  `chordPicksFrom(unknown)` parses and clamps (bad entries dropped); `livePicks(picks, positions)` keeps those whose
  `for` matches.
- `buildChanges`: the hexatonic overlay honours `picks.hexatonic` per chord as the pentatonic plan honours its picks.
- `buildSheet`: under the Pentatonic or Hexatonic preset, each staff takes its first covered position's live pick;
  `StaffModel.varies: boolean`; `StaffModel.positions: readonly ChordAt[]` (the positions the staff covers, in form
  order, so the web can set them all and name their bars).
- The positions a Scales line covers are the Changes sheet's chord positions whose row belongs to that line; expose one
  pure function for it (`linePositions`), tested on a chart with repeats, endings and a written-out section.
- `pentatonicChoices` / `hexatonicChoices(chord, scale, part)`: the popover rows, written for the part.
- `share.ts`: `picks?: ChordPicks`; old links without it open with none; round-trip tested.
- `index.ts` exports and the `api.test.ts` snapshot; the golden fixture gains the pentatonic ranking per scale on C
  (closing the gap in #305) and the hexatonic choice order per quality's default scale.

## Web

- `usePentatonicPicks` becomes `useChordPicks(chartKey)`: `csm-pent-picks:<chart>` holds both kinds (a legacy object of
  bare numbers reads as pentatonic picks). `pick(kind, positions, value)`, `clear(kind, positions)`, `clearAll()`.
  Watchers that cleared picks on Path / Rung / Side / Rank / basis changes are removed.
- `EditorView` passes picks to both sheets, includes them in share links, and reads them from a link.
- **Scales:** the staff caption becomes the popover's trigger (a button styled as the caption; plain text in print);
  caption `A♭m pent · 5 shared · varies`, one line at 12 staves in print.
- **Changes:** the pentatonic label's popover gains the header/footer; the hexatonic label becomes a trigger too.
- **Reset** (More actions) clears the chart's picks.

## Testing

- Engine (test first): parsing and `for` matching; legacy picks; Changes applies a pick to its run only; Scales takes
  the first position's pick, sets `varies`, and exposes `positions`; `linePositions` with repeats and endings;
  choice order and labels for both kinds, transposed for a B♭ part; share-link round-trip and old links.
- `make golden`, its diff reviewed (new sections only).
- Web unit: popover header/footer wording (all three footers); `useChordPicks` storage and legacy read; picks survive a
  Built on change; tier gating and the hidden-settings notice.
- e2e: pick on Changes bar 6 → only that run changes; pick on a Scales staff → both Changes bars change and the
  footer named them; make them differ → the staff shows `varies`; a share link reproduces the picks; print keeps 12
  staves a page with `varies` captions.

## Out of scope

- Per-section picks, and choosing a pick for every chord of one quality at once.
- Picks for the Arpeggios sheet or the guide tone line.
