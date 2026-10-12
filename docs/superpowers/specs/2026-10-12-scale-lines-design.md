# Scales sheet, one line per scale: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Issue: #189.

## Goal

The Scales sheet becomes a tune's scale vocabulary: each scale it uses, once, so it is short to practise. Today it
follows the chart bar for bar, one staff per chord change (Autumn Leaves: 39 staves), drawing a recurring scale every
time. The Changes sheet already follows the form, so the bar-for-bar Scales sheet is replaced, not kept as an option.

## What changes in the product

- **One line per distinct scale use**, in order of first appearance in the chart.
- **The label column** shows the scale name in large type (`C Dorian`) and, under it in small type, the chord symbols
  the line covers, in first-appearance order, separated by ` · ` (`Cm7 · Cm9`). Section and bar numbers go.
- No flag: it ships on.

Unchanged: Spell Scale (From key / From root / From X), instruments and transposition, key signatures, interval
labels, practice selection (boxes, presets, storage), share links (they carry no layout), 12 staves a printed page,
the Changes sheet.

## Definitions

- **Line identity.** Two rows share a line when all of these match:
  - the scale each plays (`resolveScales` at the sheet's level, else its quality's default, as today), compared by
    `parseScale`'s root pitch class and canonical key, so the concert spelling doesn't split a line;
  - the written chord's root pitch class (C♯m7 and D♭m7 merge);
  - the written chord's canonical quality (`baseQuality`): Cm7 and Cm9 merge (both m7); CmMaj7 and Cm6 over
    C melodic minor stay two lines; C7 and C7♭9 stay two lines even on one scale.
- A slash chord counts as written (its root and quality, not its bass reading): D♭Maj7/C, playing C 7sus4♭9, is not
  merged with C7sus4♭9. Its labels and presets already read it as written.
- **Chord list.** The distinct chord symbols (by text) of the line's rows, in first-appearance order.
- **Representative.** A line's first row. Its notes, interval labels, practice keys and preset picks are the line's.
  They hold for every chord on it, since all are defined by the scale, chord root and quality.
- **Rows that can't be drawn** ("Choose a scale", "Can't read this chord", a start error) are lines too. They merge
  only with rows of the same chord text and the same error, and sit in first-appearance order like the rest.

## Engine (`engine/src/sheet.ts`)

- New pure `scaleLines(rows, scaleOf): ScaleLine[]`, where
  `ScaleLine = Readonly<{ row: number; chords: readonly string[] }>` (`row`: the representative's index). It's
  exported for #188 (Arpeggios), which will lay its bars out the same way.
- `buildSheet` keeps its signature. It maps lines, not rows, to staves; `last` is the last line, `showClefAndKey` the
  first line when signatures are on.
- `StaffModel`:
  - drops `section` and `bar`;
  - `chord: readonly ChordToken[] | null` becomes `chords: readonly (readonly ChordToken[] | null)[]`, one entry per
    chord on the line, each tokenised for the part as today;
  - `id` is built from the line's identity and chord list (plus part, mode, start, key signature and clef flag as
    today), not the row index, so the live preview redraws only lines that changed.
- `practiceBoxes`, `litKeys` and the editor's practice staves (`EditorView.vue`) take the merged staves unchanged: the
  set of keys is the same.
- `index.ts` exports `scaleLines` and `ScaleLine`; the `api.test.ts` snapshot updates.

## App

- `ScaleStaff.vue`: the label column becomes the scale (large, italic dropped), then the chord list (small, muted,
  each `<ChordSymbol>`, ` · ` between, wrapping). A line whose scale is missing shows its chord list and the error.
- `ScaleSheet.vue`: unchanged apart from types.
- `docs/design.md` §Scale sheet: the layout, label and view-model bullets rewritten; the decision recorded in §12.

## Testing

- Engine, test first (`engine/src/__tests__/sheet.test.ts`):
  - `scaleLines`: repeats merge; order is first appearance; Cm7 + Cm9 merge; CmMaj7 + Cm6 split; C7 + C7♭9 split;
    C♯m7 + D♭m7 merge; the slash chord stays apart; error rows merge only with the same chord and error; an empty
    chart gives no lines; the chord list keeps first-appearance order without duplicates.
  - `buildSheet`: Autumn Leaves (library chart) gives its distinct-line count, not 39; pages split lines; the last
    line is `last`; ids are stable when a repeat is added further on; `chords` holds every symbol.
  - `practice.test.ts`: presets on a merged line light the representative's picks.
- `web/test/ScaleSheet.test.ts`: the label shows the scale and the chord list; no bar text.
- e2e: re-pin the stave counts on the Scales sheet (`transposition.spec.ts`, `print.spec.ts`). The print test's
  "12 staves a page with ledger lines" needs a chart with more than 12 distinct lines; write one in the test
  (`writeChart`) rather than relying on a library chart.
- `make golden` is unaffected (the fixture holds scales per row, not sheet layout); confirm it stays green.
