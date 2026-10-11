# Proposed scales: the function decides, the scale cell overrides

Date: 2026-10-11. Status: proposed (the workflow in §Goal is the user's; the decisions below follow from it and want
sign-off). Builds on the chart-functions spec (2026-10-09) and the editor UI overhaul (2026-10-09, the bar editor
and its inspector); lands after the engine/UI split.

## Goal

The editor's workflow for a chord should be:

1. The user writes the chord.
2. The app proposes a function and the scale that goes with it.
3. The user may override the function; the proposed scale follows.
4. The user may override the scale.

Today the chart format, the engine and the grid already hold every piece of this, but not connected to each other:

- A blank scale cell plays the **chord quality's default** (`resolveScale`, `engine/src/chart.ts`), never the
  analysis. The Scales and Changes sheets both read it (`sheet.ts`, `changes.ts`; the latter runs `analyse()` too,
  but only for the numerals and notes).
- Choosing a function in the grid or the inspector writes **only the function cell** (`ChartGrid.vue`,
  `BarInspector.vue` → `setRowField(doc, i, 'function', v)`). The option is labelled `V7/ii → D Phrygian Dominant`,
  yet after choosing it the sheet still plays D Mixolydian, and the Notes column reports "analyser: D Phrygian
  Dominant …; you chose D Mixolydian" when the user chose nothing.
- `applyAnalysis`, which writes analysed scales into the cells, is called by the CLI alone; the app never runs it.
  The library's 7,378 rows all carry a written scale because `analyse --write` filled them; 8 carry a function.
- The scale level (`relevel`, `engine/src/levels.ts`) writes scales into the rows and must then keep a record of
  which rows it "owns" (`LevelState.owned`, per chart in the browser and in share links), comparing scales by pitch
  to tell its own choices from the user's. The bookkeeping exists only because the cell conflates the computed scale
  with the chosen one.

The two cells therefore read as peers when one is the cause of the other, which is the redundancy the user feels.
Neither can go: function → scale is one-to-many (the level picks a rung within a function; `# keep:` rows are
scales the melody demands over a correct function; modal charts have no functions). What changes is what a blank
cell means.

## Decisions

| Question | Decision |
| --- | --- |
| A blank scale cell | Plays the **analysed** scale: the stated function's scale if there is one, else the rules', at the current level; the quality's default only where the analysis does not reach the row (a modal chart's chords take their mode as today, through the rules). |
| A written scale cell | Is the user's override and plays as written at every level. Any written scale is a keep; `# keep: …` stays as the reason, nothing more. |
| Precedence | written scale > stated function's scale > rules' scale > quality default. One resolver, in the engine. |
| The level | Stays a view preference (like the instrument), not chart text and not written into rows. The resolver takes it as a parameter. `relevel`, `LevelState.owned` and `baseline` are retired. |
| Choosing a function | Still writes only the function cell. The scale follows because the resolver reads it; nothing else to write. |
| Choosing a scale | Writes the cell (pins). A "Follow the analysis" option blanks it. |
| The library | Scrubbed once: every written scale the rules reproduce at Standard is blanked, so the library charts carry chords, functions, `@key`s and the true overrides. The golden fixture keeps the per-row record. |
| Rejected: `level:` meta line | A chart is the tune; the level is the player's. The same chart serves one student at Basic and another at Advanced. |
| Rejected: a level written into cells | The present design; its cost is the ownership bookkeeping and the library's frozen scales. |

## 1. Format

No change to the grammar. The row table in README.md changes one line:

| Form | Meaning |
| --- | --- |
| `section \| bar \| chord` | Scale omitted: the analyser's choice — the function's scale when one is stated, else the rules', at the sheet's level; where the analysis does not reach the chord, the quality's default from `chord_scales.json`. |
| `section \| bar \| chord \| scale` | The scale as written, at every level. |

The `# keep:` convention is unchanged in form; `--force` no longer needs it to protect a cell, since `--force` goes
(§4). The `# analysis:` and `# area:` comments the CLI saves are unchanged.

## 2. Engine

### `resolveScales(doc, level): ReadonlyMap<number, Resolved>` (`chart.ts` → a new `resolve.ts`)

```ts
export type Resolved = Readonly<{
  scale: string | null            // null: the chord can't be parsed yet ("ask the user", as today)
  source: 'written' | 'function' | 'rules' | 'default'
  rule?: string                    // the rule id when source is 'function' | 'rules'
  reason?: string
}>
```

Keyed by doc line, computed once per document revision from one `analyse(doc)` (shared with `rowNotes` and
`functionChoices`; `changes.ts` already calls `analyse`, so there is no new cost per keystroke, and the three
should share the result through one memo in the app). Rules:

- `line.scale` non-empty → `{ scale: canonicalScale(line.scale), source: 'written' }`.
- Else the analysis row for the line, `r`: `r.scale` non-null → the level applied to it (below), `source`
  `'function'` when `r.stated`, else `'rules'`, with `r.rule` and `r.reason`.
- Else `defaultScaleOrNull(chord)` → `source: 'default'`; null stays null.
- A `@copy` repeat resolves on its own row (the analysis already analyses each repeat; the `Conflict` type and
  "only the source line can be written" go with `applyAnalysis`). A written scale on the source copies with the row,
  as today.

**The level**, applied to analysed rows only: Standard plays `r.scale`; Basic and Advanced play
`ladderScale(r.scale, level, quality) ?? r.scale`, with the tonic-minor (`m5`) Aeolian rule at Basic; Random draws
from the quality's options by `seededUnit(seed, rowKey)` as `scaleAtLevel` does now, leaving out `functional: true`.
`scaleAtLevel` loses its `standard` parameter and becomes this; `relevel` is deleted.

`resolveScale(row)` (one row, quality default) stays for the places that have no document — the Level control's
comparison of a quality's default, `scaleChoices` — and is renamed `qualityScale(row)` so no sheet can reach for it
by habit. `engine/src/index.ts` exports change accordingly (`api.test.ts` snapshot).

### Sheets

`sheet.ts` (`buildSheet`) and `changes.ts` (`buildChanges`) take the level and read `resolveScales`. The Changes
sheet's numerals and notes already come from the same analysis. The guide-tone timeline reads chord symbols only and
is untouched. The practice presets read the resolved scale.

### Notes (`notes.ts`)

`RowNote.note` reads "analyser: X (reason); you chose Y" **only** when `source === 'written'` and the written scale
differs from the analysed one. When the row follows the analysis the note is the reason alone, as today for rows
that agree. `RowNote` gains `source`.

### CLI (`engine/scripts/analyse`)

- `--write` and `--force` go. `--save` (the comments) and `--ambiguous` stay. `--strip` is added for §4 and then kept:
  it blanks every scale cell equal to the row's analysed scale at Standard, lists the rest (written scales that
  differ: a `# keep:` or an undocumented override to review), and never touches a `# keep:` row's cell.
- The report's per-row line shows the resolved source.

## 3. Site

### Inspector (`BarInspector.vue`)

Sections reorder to follow the workflow: **Function** first (when the `functions` flag is on), then **Scale**, then
**Why**. In the Scale group the first option is the analysed scale, labelled with its numeral and rule
("D Phrygian Dominant — V7/ii, rule d3"), and selecting it blanks the cell (`setRowField(doc, i, 'scale', '')`); the
"the usual choice" option becomes "the quality's usual" and is listed with the alternates. Any other selection, or a
search result, writes the cell. A pinned row shows a pin glyph beside the Scale heading with the text "your choice;
the analyser says X" and an "Unpin" button that blanks the cell.

### Grid (`ChartGrid.vue`, `ScaleCell.vue`)

The scale cell's placeholder is the resolved scale, greyed (`aria-description="proposed"`), with the function cell
to its left. Typed text pins the row and the cell drops the grey. The Function cell's options keep their `→ scale`
labels; now they are true. The Notes column reads `RowNote.note` as §2 defines it.

### Level control (`EditorView.vue`, `useScaleLevel.ts`)

Changing the level no longer edits the document, so it is no longer an undoable edit and no longer dirties the chart.
`useScaleLevel` keeps `level` and `seed` per chart; `owned` is read once for migration (below) and then dropped from
the stored shape and from share links (`share.ts` already ignores unknown fields).

**Migration of saved charts.** A chart in My charts whose stored level state has `owned` rows was written by
`relevel`: those cells hold the old level's scale, not the user's. On first open under the new resolver, blank each
owned row's scale cell when it equals what `relevel` would have written (`samePitchScale` against the old
`scaleAtLevel` at the stored level and seed), then delete `owned`. One pass, logged to the console under the flag.
Rows the user pinned are untouched, since `relevel` never owned them.

### Feature flag

`proposedScales`, off by default (CLAUDE.md), on in e2e. Off: the resolver treats every analysed row as `'default'`
(today's behaviour) and the inspector keeps its present order. The migration runs only when on. Remove the flag after
sign-off, with `scaleLevels`.

## 4. The library

After the engine lands: `cd engine && npm run analyse -- --all --strip --save`, then `make golden`.

- Acceptance: the per-row scales in `golden.json` and the analysis fixture do **not** change, since every blanked
  cell resolves to the scale it held. Any diff is a strip bug or a row whose written scale disagreed with the rules
  without a `# keep:` — the report lists those; each gets a `# keep:` with its reason or loses its scale, by hand.
- From then on a rule change updates the library by itself; the fixture diff is the review, and
  `analyse --all --force --save` is no longer a step (CLAUDE.md "Changing an analysis rule" and "Make a chart"
  change accordingly; a new chart is chords, `key:` and the metadata, then `--save --ambiguous`).
- User charts saved with chords only follow rule improvements too; pinned rows do not.

## 5. Tests

Engine, first: `resolve.test.ts` — the four sources in precedence; a stated function changes the resolved scale
without a written cell; the level moves analysed rows and leaves written ones; Random is stable for a seed; a
`@copy` repeat resolves on its own; a modal chart's rows resolve by the rules to their modes; a half-typed chord is
null; `qualityScale` unchanged. `notes.test.ts` — the "you chose" wording only on a pinned, differing row.
`sheet.test.ts`, `changes.test.ts` — a blank cell plays the analysed scale; a written cell plays as written at every
level. `levels.test.ts` — `relevel` tests become `resolveScales` level tests. `api.test.ts` snapshot updated.

Site: `BarInspector.test.ts` — section order; the analysed option blanks the cell; a search result pins; Unpin.
`ScaleCell` placeholder. `EditorView.test.ts` — a level change leaves `doc` identical and the chart clean; the
migration blanks owned rows and only those. E2E (`editor.spec.ts`, `changes.spec.ts`): pick a function in the
inspector, the Changes sheet's scale label changes; pin a scale, change the level, the label stays.

## 6. Rollout

Independent PRs, in order: (a) engine `resolveScales` + sheets read it, flag off; (b) levels on the resolver,
`relevel`/`owned` retired behind the flag, migration; (c) inspector and grid; (d) library strip + golden
(`--strip`, drop `--write`/`--force`); (e) README, docs/design.md §7a and the levels section, the /functions page's
writing section, CLAUDE.md typical requests. Then flag on, sign-off, flag removed.

## Out of scope

- Marking pinned rows on the printed sheets (the sheets are for playing; the editor marks them).
- `@context` support in the analyser (the chart-context spec).
- The rule-explainer modal (roadmap).
