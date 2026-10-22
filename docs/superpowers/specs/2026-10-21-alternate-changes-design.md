# Alternate changes on a chart (#215)

## Intent

Real Books print a tune's common substitutions small above the staff: a tritone sub in a turnaround, Coltrane
changes in bars 1–4, a different bridge cadence. Players practise both. Today the app holds one set of changes per
chart; a whole reharm can be a second chart (versions, #411), but a spot substitution has nowhere to go.

This feature lets a library chart carry **one set of alternate changes** next to its standard ones. Unlike iReal Pro,
the alternates are first-class: the player can make them the **main** changes, and then every sheet plays them.

## Goals

- A chart may carry one alternate set. It covers only the bars that differ; every other bar is shared.
- One chart-wide toggle, **Standard ⇄ Alternate**, picks which set is main. The main set drives everything that reads
  the changes: the Changes sheet's staff, chord symbols and guide tones, the Scales sheet, Arpeggios, Patterns, Cells,
  triad pairs, the analysis and practice.
- The other set can be **shown** small above the Changes staff, Real Book style, or **hidden**. Flipping the toggle
  swaps which set is drawn large and which small.
- A chart without alternates shows no toggle and looks exactly as it does today.
- Standard main + alternates hidden looks exactly as today.
- `npx csm add` maps iReal's alternate chords (`( )`) into the chart's alternate set instead of reporting them as left
  out.

## Non-goals

- Several named alternate sets per chart. A tune with several distinct reharms uses versions (#411).
- Choosing standard or alternate bar by bar. The toggle is chart-wide.
- Adding or editing alternates in the sheet editor, on the player's own charts. Library charts only at first;
  editor support is #469. (A user chart copied from a library chart keeps its alternates and its toggle; it just
  can't edit them yet. See "Left to the builder".)

## Anti-goals

- Charts without alternates change in any visible way.
- The toggle or show/hide state is written into the chart file. Like the level, they are the player's view
  preferences.
- The alternate set is a second-class citizen: anything that works on the standard changes (analysis, scales,
  guide tones, practice, transposition, instrument parts, print) must work on the alternates when they are main.

## Decided

- **One set, chart-wide toggle, swap on flip.** (User.)
- **Library-only first;** editor support → #469. (User.)
- **iReal import maps alternates now.** (User.)
- **Granularity is the bar.** (My call.) An alternate replaces all of a bar's chords, so it may change the bar's
  rhythm (one chord → two, two → one). A bar with no alternate rows is shared.
- **View preferences, remembered per chart** in this browser, like the level (`useScaleLevel`). Share links carry
  them in `ShareView`. (My call.)
- **Defaults:** Standard main, alternates shown. (My call: the chart's author put them there to be seen.)
- **The small set is drawn on the Changes sheet only.** Other sheets (Scales, Arpeggios, …) show only the main set;
  a second set of staves there would be noise. (My call.)
- **Print follows the screen.** Transposition and instrument parts transpose the alternates with the rest. (My call.)
- **Feature flag `alternates`,** off at first per project rule; e2e builds with it on. With the flag off, a chart
  with `alt` rows plays standard only, with no small line and no toggle, identical to today. The engine (parser,
  analysis, golden) always treats alt rows as real; only the app's view is gated. (My call.)
- **Prerendered and SEO surfaces use the standard set:** OG image, song page text and JSON-LD, library, search.
  They can't follow a browser preference. (My call.)
- **Chord picks and other position-keyed player state are kept per set.** A pick on "A1 bar 8, chord 1" means Dm7 in
  one set and Abm7 in the other, so picks are stored and shared under the set they were made in. Flipping shows that
  set's picks; nothing is cleared. A shared bar's picks are still per set (simpler, and rarely matters). Undo history
  is per chart as today; the toggle is a preference, not an undo step. Share links carry the main set's picks with
  its name; an old link without a set name means standard. (My call.)

## Chart format (my call; the builder may refine the spelling, not the model)

An alternate row is a normal row prefixed with `alt`, in the same section, same bar numbering:

```
section: A1
5 | Dm7
6 | G7
7 | Cmaj7
8 | Dm7
8 | G7
alt 8 | Abm7
alt 8 | Db7
```

- If a section has any `alt N` rows, the alternate set's bar N is exactly those rows; bars with none are shared.
- Alt rows take the same cells as rows (scale pin, function) and `# keep:` comments.
- `copy:` carries a section's alt rows with its rows.
- An alt row for a bar past the section's end, or in a section that is a `copy:`, is a diagnostic.
- `bars:`, endings, key and metre directives belong to the section and apply to both sets.
- README "Charts" gains a row for `alt`.

## Engine

- The parsed chart exposes both sets; a pure function (e.g. `changesFor(chart, 'standard' | 'alternate')`) returns
  an ordinary single-set chart with the chosen set's rows. Everything downstream (analysis, `sheet.ts`, transpose,
  part, practice) consumes that result, so it needs no knowledge of alternates. The Changes sheet additionally gets
  the other set's bars for the small line.
- The analyser runs on each set separately. `--ambiguous` and the Song page gap check cover both sets (a gap in
  either fails `make test`).
- Saved reasons (`--save`, my call): rows and `# area:` lines carry the **standard** set's reasons, as today; `alt`
  rows carry the alternate set's. A shared row whose reason differs in the alternate set is not annotated twice: the
  saved comments document the standard reading, and the analysis is recomputed at runtime anyway.
- `--strip` blanks a written scale on a shared row only when **both** sets' rules give it; on an `alt` row, when the
  alternate set's rules give it. `# keep:` rows are never stripped, as today.
- `golden.json` covers both sets of every chart that has alternates.
- Exported API names change → update the `api.test.ts` snapshot.

## iReal import

`engine/src/ireal/music.ts` already parses alternates (`alt` on a chord, or a stand-alone `{ kind: 'alt' }`), and
`toChart.ts` reports them as left out. Instead, for each bar holding any alternate: the alternate bar is the bar's
chords with each chord's alternate in its place, and a stand-alone alternate in its beat position. Emit `alt` rows;
stop reporting them. Update the existing tests that expect the "left out" message.

## App

- Toggle (Standard / Alternate) and show/hide live with the other view preferences in the rail; shown only when
  the chart has alternates. Built from Catalyst components (`web/app/components/ui/`).
- Changes sheet: the small set drawn above its bars, chord symbols only (no staff, no guide tones), legible in print.
- The song page states which set is playing (e.g. a small "Alternate changes" label) so a printed sheet is
  unambiguous.

## Docs and release

- Help page: what alternates are, the toggle, show/hide.
- README "Charts": the `alt` row.
- `docs/design.md`: a section on alternates.
- `releaseNotes.ts` item.
- At least one library chart with alternates, so the feature is visible and covered by golden and e2e.

## Tests

- Engine (TDD): parsing `alt` rows and their diagnostics, `copy:` carrying them, `changesFor`, transpose, analysis of
  each set, iReal mapping.
- App unit: the preference, its persistence and share-link round trip.
- e2e: toggle swaps the large and small sets; hide removes the small set; a chart without alternates has no toggle.
- a11y: the toggle passes axe.

## Left to the builder

- Exact placement and styling of the small chord line and the toggle.
- Names of types and functions.
- How a user chart copied from a library chart round-trips its `alt` rows until #469 lands (keep them in the text
  verbatim is enough).
- Which library chart(s) get alternates first.
