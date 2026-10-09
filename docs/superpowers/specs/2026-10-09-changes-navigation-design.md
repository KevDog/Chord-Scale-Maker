# Changes sheet: endings and navigation — design

**Goal:** Finish the Changes sheet's roadmap item — render 1st/2nd endings, D.C./segno navigation and coda
symbols as compact, standard lead-sheet notation.

**Status:** design, approved in brainstorming 2026-10-09. Supersedes the "comes later" note in
[plan-changes.md](../../plan-changes.md) §3.

## Intent

The Changes sheet is a study sheet: the chart laid out as a lead sheet, each chord on its beat with its Roman
numeral and scale. Today it prints a `@copy` straight after its source as repeat signs, writes a later copy out
("A3 (= A1)"), and prints a coda after the form headed "(after the last chorus)". It has no 1st/2nd endings and no
segno/coda/D.S. navigation.

This adds them, as **compact, real notation**: the form prints once, with repeat signs, 1st/2nd ending brackets,
segno (𝄋) and coda (⊕) glyphs, and a written instruction ("D.S. al Coda", "To Coda", "Fine"). The learner reads
the roadmap the way a player reads a lead sheet. The intros and codas just transcribed from the Colorado Cookbook
(Stardust's two endings, It's You or No One's D.S. al Coda, Dance of the Infidels' tag, …) are the motivating
cases; several currently write one path out or note the other in a comment.

Decisions taken in brainstorming:
1. **Scope:** all three — endings, D.C./segno navigation, coda symbols — in one spec.
2. **Layout:** compact real notation (not linearized play-order; not endings-written-out).
3. **Representation:** explicit `@`-directives in the chart text (not derived from structure, not one `@form` block).

## Chart directives

Four new directives, parsed like `@copy` (a leading `@word`, whitespace-split). They carry no pitches, so
`transpose.ts` passes them through unchanged, and they round-trip verbatim.

```
@ending N SECTION FIRST [LAST]   a 1st/2nd ending (volta) over SECTION bars FIRST..LAST; implies a 2× repeat
@segno  SECTION BAR              a segno glyph 𝄋 above that bar
@coda   SECTION BAR              a coda glyph ⊕ above that bar (used at both the "To Coda" departure and the arrival)
@nav    SECTION BAR  TEXT…       a printed instruction above that bar: "D.S. al Coda", "D.C. al Fine", "To Coda", "Fine"
```

- `N` is `1` or `2` (a 1-digit volta number). `SECTION` matches an existing section name. `FIRST`/`LAST` are bar
  numbers within that section; `LAST` defaults to `FIRST` (a one-bar ending). `LAST >= FIRST`.
- `BAR` is a bar number within `SECTION`.
- `@nav`'s `TEXT…` is the rest of the line, kept verbatim (it may contain spaces and dots).
- A directive that names a missing section, an out-of-range bar, or a malformed number is an `invalid` line,
  reported like a bad `@copy` and kept verbatim so the text round-trips.

**Endings** are written as two sequential runs of bars (they time and analyse as ordinary rows). The drawing
places the 2nd ending after the 1st on the stave, with the repeat-end barline between them — which is exactly how
they are read — so sequential bar numbers match the page. Stardust's intro (common bars 1–6, then the endings as
7–8 and 9–10):

```
Intro | 6  | Fm7
Intro | 6  | Bb7
Intro | 7  | Gm7      # 1st ending
Intro | 7  | C7
Intro | 8  | Ebm7
Intro | 8  | Ab7
Intro | 9  | Ebm7     # 2nd ending
Intro | 9  | Ab7
Intro | 10 | DbMaj7
Intro | 10 | Db7
@ending 1 Intro 7 8
@ending 2 Intro 9 10
```

Renders: bars 1–6, a repeat-start barline at bar 1, `|1.⌐ 7–8 ⌐| :‖ |2.⌐ 9–10 ⌐|`, then into the form.

**D.S. al Coda** (It's You or No One: segno at A, "To Coda ⊕" at the end of D, the Coda section after the form):

```
@segno A 1
@coda  D 8
@nav   D 8  To Coda
@nav   D 8  D.S. al Coda
@coda  Coda 1
```

(The departure ⊕ and the arrival ⊕ are both `@coda`; the words come from `@nav`. The Coda section still prints
after the form with its existing "(after the last chorus)" marker.)

## Data model

`chart.ts` — three new `ChartLine` kinds (the parser keeps them verbatim for round-trip; `expandRowLines` ignores
them, as it does comments):

```ts
| { kind: 'ending'; n: number; section: string; from: number; to: number }
| { kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }
| { kind: 'nav'; section: string; bar: number; text: string }
```

`changes.ts` — `ChangesBar` gains four optional fields; `repeatStart`/`repeatEnd`/`end` are unchanged:

```ts
volta: { n: number; start: boolean; end: boolean } | null   // a 1st/2nd-ending bracket on this bar
segno: boolean                                              // 𝄋 above this bar
coda:  boolean                                              // ⊕ above this bar
nav:   string                                               // a navigation instruction above this bar ('' = none)
```

`ChangesChord`, `ChangesLine`, `ChangesSheet` are unchanged.

## Engine: `buildChanges`

1. **Collect directives** from `doc.lines` into lookups keyed by `(section, bar)`: endings per section, marks per
   bar, nav text per bar. (Directive lines are read straight from `doc.lines`, like the `@copy` detection already
   does, not from the expanded rows.)
2. **A section with `@ending` directives is a 2× repeat.** Set its run's `times = 2`, `repeatStart` on its first
   bar, and `repeatEnd` on the **last bar of ending 1** (the larger `to` of the `n === 1` directive), not the
   section end — so the `:‖` lands between the two endings. Do **not** run the existing `@copy`-fold path for such a
   section (its passes are not identical copies).
3. **Map voltas:** for each `@ending n SECTION from to`, set `volta = { n, start: bar === from, end: bar === to }`
   on each of that section's bars in `from..to`; other bars get `volta: null`.
4. **Map marks and nav:** for each bar, `segno`/`coda` from the mark lookup, `nav` from the nav lookup (joined with
   " · " if a bar carries more than one `@nav`). Looked up by the same `barOf()` the chords already use.
5. The Coda/Ending/Tag sections keep their current placement and markers; `@coda`/`@nav` only add the glyph and
   text. Key areas, numerals and scales are untouched — the ending bars are ordinary rows that the guide-tone
   timeline and the analysis already reach.

Stays pure (no Vue/DOM), per the engine rule.

## Drawing

Split by layer, by what each does best.

**VexFlow** (`app/utils/changesDrawing.ts`) — marks that must sit on the stave:
- **Volta brackets:** `new vf.Volta(type, number, x, width)` for each bar whose `volta` is set — `BEGIN_REPEAT` on
  `volta.start`, `END` on `volta.end`, `MID` between. The one genuinely new VexFlow piece.
- **Repeat barlines:** already rendered from `repeatStart`/`repeatEnd`; now endings drive them, so a repeat-end
  can fall mid-line between the two endings (VexFlow supports an end-repeat that is not the last barline).

**HTML overlay** (`app/components/ChangesSystem.vue`) — reusing the above/below-stave positioning that already
places section markers and key areas at a bar's x:
- **𝄋 segno and ⊕ coda** as small inline SVG glyphs above the bar (not unicode text glyphs, which font-render
  unreliably; inline SVG needs no third-party origin and passes the hashed CSP).
- **`nav` text** ("D.S. al Coda", "To Coda", "Fine") as a styled label above the bar, aligned to its end barline.

Keeping segno/coda/nav in the HTML layer (only the volta goes on the VexFlow stave) matches how every other
annotation is placed and avoids VexFlow glyph-font/CSP concerns.

**Print:** a volta bracket adds a little height above the stave. Verify the "eight lines a page" budget in the
print e2e still holds; if needed, tuck the volta into the existing marker band or add a few px to the line-height
constant. No new page-break logic.

## Consumers / ripple

- **`transpose.ts`** — no change needed: it already returns any non-`row` line untouched (`if (l.kind !== 'row')
  return l`, transpose.ts:87), so the new directive lines are preserved verbatim. A regression test guards this.
- **`edit.ts` / grid editor** — the directives are non-row lines (like `@copy` and comments): shown and
  round-tripped, **not** editable as grid cells in this pass. A malformed directive reports a line error. Grid-level
  authoring of navigation is out of scope (YAGNI).
- **`analysis`, `guideToneTimeline`, `sheet.ts`, `levels.ts`** — unaffected: they read expanded rows, which ignore
  the directive lines; the ending bars are ordinary rows already.
- **Docs** — document the four directives in `README.md` (the chart-format table) and `docs/design.md` (§4 chart
  model); flip the plan-changes.md §3 "comes later" note to done.
- **Fixtures** — regenerate golden/analysis for any chart that gains directives (purely additive: no existing
  row's scale changes).

## Testing (TDD)

- **`chart.ts` unit:** each directive parses to its `ChartLine` kind; round-trips through `serializeChart`; a bad
  section/bar/number becomes `invalid` and is kept verbatim. Transposing a chart with directives preserves them.
- **`changes.ts` unit:** a fixture chart with 1st/2nd endings → `volta`, `repeatStart`, `repeatEnd` on the right
  bars (repeat-end between the endings); a D.S.-al-Coda chart → `segno`/`coda`/`nav` on the right bars and the Coda
  section still after the form. Use small inline charts plus the two real conversions.
- **e2e:** extend `e2e/print.spec.ts` "prints the Changes eight lines a page" to a chart with endings and a coda
  jump; assert the volta, segno, coda and nav render and the eight-lines budget holds.

## Charts converted in this PR

Two canonical examples, to prove the feature end to end and keep the PR reviewable:
- **Stardust** — 1st/2nd endings on the intro.
- **It's You or No One** — D.S. al Coda (segno + To Coda + coda + instruction).

The rest (Four, Dance of the Infidels' tag, I Remember You, Joy Spring, On the Trail) convert in a fast
follow-up PR.

## Out of scope

- Grid-cell editing of navigation directives (they round-trip as text lines only).
- `@nav` beyond free text (no modelling of the exact jump semantics — the sheet shows the instruction, it does not
  simulate the playback order).
- Converting every cookbook chart's endings/codas in this PR.
