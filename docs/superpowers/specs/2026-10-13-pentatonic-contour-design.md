# Pentatonic ladders, phase 3: tension contour and tint by rung (#265)

Phase 1 (#263, `2026-10-13-pentatonic-ladders-design.md`) gave the Changes sheet one rung for the whole sheet; phase 2
(#268, `2026-10-13-pentatonic-paths-design.md`) a rung per section and path presets. Phase 3 makes the path visible:
labels tinted by rung, and a thin step line under each line showing the rung, so reading down the page shows the arc
(inside, climbing, outside, returning).

## Decisions (from the brainstorm, 2026-10-13)

- **A step line, not a curve:** height is the rung (Home at the bottom, 6 at the top), flat while the rung holds, a
  vertical step where it changes. Exact, and it agrees with the labels.
- **The rung is the measure**, not the shared count: 7 levels (Home and 1 both share 5 notes but are different
  distances), the same scale the Rung control uses.
- **Cool → warm tint:** Home muted ink, climbing through blue and violet to a warm red-orange at 6 (Outside).
- **Its own thin band, and it prints.**
- **Shown only for a path that varies:** any path but One rung (`PentatonicPlan.counts` is true). With One rung a
  flat line and one tint say nothing, so the sheet is phase 1's. No new control.
- **Flat per line, with an entry riser.** Every section starts a line and a rung is per section, so within a line the
  rung doesn't change; the arc reads down the page. Each line starts with a short riser from the previous
  line's last rung where it differs, so each climb and drop is drawn.
- Settled earlier, unchanged: ladders rank against the key area; labels print where they change; preferences only,
  never in chart rows or share links; the `pentatonics` flag gates it all.

## What the player sees

### Tint

- With a path other than One rung, each pentatonic label's text takes its rung's colour; the contour takes it too.
- Seven tokens in `main.css`, `--color-rung-0` … `--color-rung-6`, redefined under `html.dark`:

  | Rung | 0 (Home) | 1 | 2 | 3 | 4 | 5 | 6 (Outside) |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Hue | muted ink (as now) | blue | blue | violet | violet | rose | red-orange |

  Neighbouring rungs that share a hue step in lightness so all seven differ. Each is at least 4.5:1 against
  `--color-paper` in its theme (the labels are small text); a unit test checks the ratios from the token values.
- Tint is never the only cue: the label's shared count and its `aria-label` say the same.
- Print keeps the tint; on a greyscale printer the band's height still carries it.

### The contour band

- A row under the pentatonic labels, `data-slot="contour"`, `aria-hidden="true"`: `h-3` on screen, `h-2` in print.
  It is present only when the pentatonic row is and the path isn't One rung.
- An inline SVG stretched to the line's width; y is the rung (Home on the bottom edge, 6 on the top edge, the stroke
  inset so it isn't clipped). Stroke about 1.5px on screen, 1px in print, `vector-effect: non-scaling-stroke`.
- **Runs:** consecutive chords with a pentatonic at one rung make a run, drawn from its first chord's x to the x of
  the chord after its last (or the line's right edge). A chord with no pentatonic (no key) breaks the line: a gap.
  Where two runs meet at different rungs, a vertical step joins them.
- **Entry riser:** if the previous line's last run ended at another rung, a vertical stroke at the line's left edge
  from that rung's height to this line's. The first line, or a line after a gap at the previous line's end, has none.
  A page break doesn't change this (the riser still says where the rung came from).
- Each segment is stroked in its rung's tint; a riser or step in the destination rung's.

### Print

The band costs no line: `changesLinesPerPage(line, rows)` is unchanged and takes no contour option. The counts were
measured with the band drawn, on Stardust (tuba, From 7th, Side-slip), and held: 7 with no line and 5 with a guide line,
all three rows; 8 and 6 with Pentatonics plus one other row. `print.spec` gains that case.

## Engine

Pure TypeScript in `engine/src/changes.ts`, exported from `index.ts` (the API snapshot changes).

```ts
/** a chord on a line: its bar's index in the line and its index in the bar */
export type ChordRef = Readonly<{ bar: number; chord: number }>
export type ContourRun = Readonly<{ from: ChordRef; to: ChordRef; rung: number }> // `to` inclusive
export type ContourLine = Readonly<{ entry: number | null; runs: readonly ContourRun[] }>

/** the tension contour (#265): each line's runs of one rung, and the rung the previous line ended on where it differs */
export function pentatonicContour(lines: readonly ChangesLine[]): readonly ContourLine[]
```

- A run is a maximal sequence of chords, across bars, with `pentatonic !== null` and the same `view.rung`. Labels
  blanked by `showPentatonics` still have their `view`, so the contour ignores `label`.
- `entry` is the previous line's last chord's rung when that chord has a pentatonic, this line's first chord has one,
  and the two differ; else `null`.
- Lines with no pentatonics give `{ entry: null, runs: [] }`.
- `changesLinesPerPage(line, rows)`: unchanged; the band costs no line.

## App

- `ChangesSheet` (where the lines are built) computes `pentatonicContour(lines)` when the plan's `counts` is true and
  passes each `ChangesSystem` its `ContourLine` as a `contour` prop (`null`/absent: no band).
- `ChangesSystem` maps a `ChordRef` to x through its existing `marks` (the chord's `x`; the next mark's `x`, or 1, for a
  run's end) and draws the band.
- Labels: with the plan's `counts` true, the label's text class is its rung's tint (`text-rung-0` … `text-rung-6`,
  print included); otherwise as now.
- Print: `changesLinesPerPage` is called as before; the band takes no line.

## Testing

Tests first (TDD), engine before app:

- `pentatonicContour`: one run per line at the section's rung (Side-slip over AABA: A lines 0, B line 5); entry riser
  values across lines (0 → 5, 5 → 0) and none where equal or on the first line; a gap for chords with no key (two
  runs, and no entry when the gap is at a line edge); a mid-line step if rungs differ inside a line; a section wrapped
  over two lines (breakLines) gives no riser; labels blanked by `showPentatonics` don't break runs; no pentatonics →
  empty runs.
- `changesLinesPerPage` at the measured counts (the band costs no line).
- Token contrast: every `--color-rung-*` ≥ 4.5:1 on paper in light and dark.
- App unit: band and tint only with a path other than One rung; band absent with the row off or the flag off; tint
  class per rung; ChordRef → x mapping (run end at the next chord, or the line's end); riser drawn from `entry`.
- e2e: Side-slip on an AABA tune → the B line's band sits higher than an A line's and has a riser, labels carry
  different tints; One rung → no band; the rail is unchanged (`editor.spec` "stays tidy"); `print.spec` worst case with
  the contour.
- `make golden`: expect no change (the fixture's sheets are built with the plan `null`).

## Later

#266 Scales sheet Tension preset; #267 one layers menu.
