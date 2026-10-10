# Chart functions, key areas and live notes: design

Date: 2026-10-09. Status: approved in brainstorming; implementation plan to follow.

## Goal

Let a chart's author settle the harmonic function the analyser should use when it chooses a scale, where the
rules can't tell (a dominant that doesn't resolve, a chromatic chord, a key area found only by scoring), and let
anyone viewing a chart see why each scale was chosen.

## Decisions

| Question | Decision |
| --- | --- |
| What a written function does | It is input to the analyser: the scale is derived from it, and the Changes sheet prints it as the numeral. |
| Where it goes | An optional fifth cell after the scale. Existing three- and four-cell rows are unchanged. |
| What key it is relative to | The row's local key area, as the analyser finds it, unless the cell has a key prefix (`D: V7/ii`). The prefix applies to that row only. |
| Author key areas | A directive, `@key SECTION BAR KEY`. It holds from that bar until the next `@key`. |
| Notes (the reason for each scale) | Computed live from `analyse()` on every view. Stored `#` comments stay as the library's record, and the app ignores them. |
| Migration | None. The column is optional and existing charts parse unchanged. Notes are computed when a chart loads. |
| Who writes function cells and `@key` | Only the author. The analyser never writes either one. |
| Finding the rows that need a function | An ambiguity report from the CLI. |

## 1. Format

### Row

```
section | bar | chord | scale | function   # comment
B  | 23 | Bb7 | Bb Mixolydian | V7/V
B  | 23 | Bb7 |               | V7/V       ← default/analysed scale, stated function
B  | 19 | B7  |               | D: V7/ii   ← this row only, in D major
```

- `RowLine` gains `function?: string`. A row with no function serialises exactly as today: the cell and its
  `|` are left out.
- A function that won't parse is a row error, with the same tolerance as a bad scale: the editor shows it and
  the analyser ignores it.
- When rows are aligned (`wsc` in `chart.ts`), the function column lines up the same way the comments do.

### Function grammar

The numerals the Changes sheet already prints (`numerals.ts`), read back in. Both glyph and ASCII spellings are
accepted:

- **Accidentals:** `♭`/`b` and `♯`/`#`.
- **Qualities:** `°7`/`o7`, `ø7`/`m7b5`, `maj7`/`Maj7`/`Δ7`.
- **Degree:** Roman numeral, with case giving the quality where it matters: `I`…`VII`, `ii`, `iii`, `vi`….
- **Suffix:** `maj7`, `7`, `6`, `ø7`, `°7`, `7sus`, `(maj7)`, `maj7♯5`, or nothing.
- **Target:** `/X`, where X is a degree (`V7/ii`, `ii7/V`, `iiø7/vi`, `vii°7/ii`).
- **Prefix:** `subV7` (tritone substitute), `subV7/IV`.
- **Key prefix:** `KEY: ` with a key as `key:` takes it (`D`, `Bbm`, `C#m`).

Examples: `V7/V`, `subV7/IV`, `ii7/V`, `iiø7/vi`, `♭VII7`, `vii°7/ii`, `IVmaj7`, `I6`, `D: Imaj7`.

The function's spelling is normalised to glyphs for display. The file keeps whatever the author wrote.

### `@key`

```
@key A2 16 D
@key B 25 Db
```

`@key SECTION BAR KEY` is parsed like `@segno`, with KEY as `key:` takes it. Its error message is
`use  @key SECTION BAR KEY`.

## 2. Analyser

### `analysis/functions.ts` (new)

`parseFunction(text): StatedFunction | string` returns either the parsed function or an error string. A
`StatedFunction` is `{ key?: Key; degree: number; family: Family; suffix: string; target?: { degree: number;
minor: boolean }; sub: boolean }`. This is the inverse of `numerals.ts`: `parseFunction(numeral(…))` gives back
the same function, and a test checks that over every library chart.

### Key areas

- `@key` spans replace `localKeys()`'s output for their bars. Cadences and scoring still run for the rest of
  the chart.
- A row's key prefix replaces the key for that row only. A prefix doesn't open a key area: `RowAnalysis.key` stays
  the area, `statedKey` is the prefix.
- `Area` gains `stated: boolean`, so reports and the tooltip can say who decided it.

### Rules

- `Context` gains `stated: readonly (StatedFunction | undefined)[]`, indexed like the stream.
- Today the rules read "where does this chord go" from the stream (`nextOf`, `downFifth`, `downHalf`). That
  reading goes behind one helper. When the row has a stated target, the helper returns that target, built as a
  virtual `Entry` with a `pc` and `family`. Otherwise it returns the neighbour as today. Each family rule then
  decides through its normal path. There is no second rule table.
  Example: `D7 | | V7/V` in C, where D7 goes on to Dm7. The target is G major, so the V7 rule (D4) applies with
  natural tensions, where today the D7 is "II7 in C, not resolving" (D5).
- A stated `sub` selects the tritone-substitute rule (D2). A stated `♭VII7` with a major target selects the
  back-door rule.
- **Contradictions:** the function doesn't fit the chord when its family disagrees with the chord's (`ii7` on
  `Bb7`), or when its degree's root isn't the chord's root in the row's key. The analyser reports it with the
  row and ignores the function for that row.
- `Decision` gains `stated: boolean`, and its reason is marked, e.g. `V7/V in C: natural tensions (stated)`.
- `numeral()` returns the stated function in normalised form when a row has one.

### Writing back

`applyAnalysis` never writes the function cell or `@key`. `--force` treats them as inputs: a stated row gets its
scale rewritten from the stated function. `# keep:` still pins a scale.

### Ambiguity report

`npm run analyse -- --ambiguous [file | --all]` lists:

- rows decided by fallback rules, such as "V7 … not resolving", "a chromatic dominant with nowhere to go", or
  any other fallback rule, each with a suggested function;
- found key areas other than the home key, each with the `@key` line that would pin it; a missing `key:` line.

Rules mark a guess with `fallback: true` on their `Decision`.

## 3. App (`functions` feature flag, off; on in e2e builds)

- **Parser:** independent of the flag. The column and `@key` are accepted everywhere, so a chart reads the same
  wherever it's opened.
- **Editor grid (`ChartGrid.vue`):**
  - A **Function** column after Scale.
    - **Editing:** a dropdown: Auto (the analyser's reading), then every function that fits the chord in its key
      area, each with the scale it gives; a key-prefixed function from the text shows as its current value.
    - **Auto:** the first option, showing the analyser's numeral and scale.
    - **Invalid values:** a key-prefixed or non-fitting function typed in the text shows as the current value,
      marked invalid, with the problem as its title.
  - A **Show notes** toggle above the table, off by default and remembered per viewer in `localStorage`. It
    shows a read-only **Notes** column computed live:
    - the reason;
    - when the row's scale differs from the analyser's, `analyser: <scale> (<reason>); you chose <scale>`.
  - **`@key` rows:** a key select on each `@key` row, and a 'Key change at row N' button on each chord row.
- **Changes sheet (`ChangesSystem.vue`):** each numeral and scale is the trigger of a tooltip in `HelpTip.vue`'s pattern.
  - **Contents:** reason, key area (marked stated or found), and "stated" when the author wrote the function.
  - **Access:** opens on hover, tap or keyboard focus; `print:hidden`.
  - **Data:** comes from `buildChanges`, which gains `reason`, `stated` and `keyArea` per chord.
- **Transposing (`transpose.ts`):**
  - **`@key` and key prefixes:** move to the target key, spelled on the target key's side like the roots.
  - **Function text:** relative to the key, so it never changes.
  - **Instrument parts:** show keys through the existing `keyName(name, part)`.
- **Share links:** carry the chart text, so they include the new column and `@key` unchanged. A test confirms the
  round trip.
- **Help (`EditorView.vue`):** the format line becomes `section | bar | chord | scale | function`, and `@key` is
  described next to `@copy`.

## 4. Testing

TDD for the engine (the `tdd-for-non-drawing` rule):

1. **Parser:** a row with and without a function; a key-prefixed function; `@key` and its errors; the text →
   doc → text round trip; aligned serialisation.
2. **`functions.ts`:** the grammar in glyph and ASCII spellings; errors; `numeral` ↔ `parseFunction` round trip
   over the library.
3. **Analyser:**
   - a stated target overrides the neighbour (`D7 | | V7/V` in C: D5 becomes D4);
   - `sub` and `♭VII7` route to their rules;
   - `@key` spans replace found areas;
   - a prefix affects only its row;
   - contradictions are reported and ignored;
   - `applyAnalysis` never writes a function or `@key`;
   - `--force` respects stated rows.
4. **Ambiguity report:** its fallback rows and scored-only areas, with suggestions.
5. **Transposing:** `@key` and prefixes move; function text doesn't.
6. **App unit tests (`web/test/`):** the Function cell's validation and placeholder, the Notes toggle and its
   "you chose" text, and the tooltip's content.
7. **Playwright (`web/e2e/`):** editing a function updates the Changes sheet's numeral and scale; the tooltip
   opens by keyboard; axe still reports 0 violations; the page still runs under the hashed CSP.
8. **Golden:** existing charts' answers must not change. The analysis fixture gains `stated` fields, and the
   diff is reviewed.

## 5. Rollout

1. Merge the engine, CLI and app work with the flag off.
2. Run `npm run analyse -- --ambiguous --all`. Add functions and `@key` lines to library charts in their own
   PRs, each followed by `--force --save`, `make golden` and a review of both diffs.
3. Turn the `functions` flag on.
4. Update the docs: `docs/design.md` §4 (format) and §7a (analysis), the README format table, and CLAUDE.md's
   "Typical requests" (author functions over `# keep:` when the function, not the melody, is the reason).

## Out of scope

- Showing notes on the scale sheet or in print.
- The analyser suggesting functions anywhere but the CLI report.
