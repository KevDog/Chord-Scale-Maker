# Chart format: section blocks (issue #329)

**Status:** spec (branch `section-blocks`).

## Goal

Replace the leading `section` cell on every chart row with section blocks. A `section:` line opens a block, and the
rows after it belong to it until the next `section:`. A block can set its own `key:`, `time:`, `context:`, `bars:`,
`outside:` and `copy:`. Bar numbers restart at 1 in each section. The old row format is migrated and then dropped.

This is a prerequisite for #234 and #235 (metre), which need a per-section `time:`. #261's importers will write this
format.

```
title: Autumn Leaves
key: Gm
form: AAB

section: A1
1 | Cm7
2 | F7
3 | Bm7
3 | E7
…
7 | Gm

section: A2
copy: A1

section: B
key: Bb
time: 3/4
bars: 16
1 | Am7b5
…
```

## Decisions (from the brainstorm, 2026-10-16)

- **Section length is explicit when it has to be.** Bars restart at 1, so the next section's first bar no longer says
  where a section ends: 173 section boundaries in 112 library charts end on a held chord. A section-level `bars: N`
  gives the length. Without it, the length is the section's last written bar. The header's `bars:` keeps its present
  meaning (the analyser's hint for the form's length).
- **Approach A:** blocks live in `ChartDoc` as lines (text still round-trips), and one pure function,
  `sectionLayout(doc)`, resolves them for timing, the sheets, the editor and the analysis. Rejected: translating to
  the old absolute-bar model at parse (section `time:` and `copy:` carrying settings can't be represented in it), and
  a new song tree for every consumer (too large for now).
- **One PR**, ordered commits. The parser can't read the old format once it switches, so the engine, the library, the
  editor and the saved-chart migration land together.
- **Comments:** the converter rewrites the 351 structured `# alt: bar N (…)` lines to section-relative bars. It leaves
  prose comments that name bars (about 361) as written and prints a list of them. A follow-up issue tracks fixing
  them by hand.
- **Bar labels are section-relative everywhere** ("A2, bar 1"). No display keeps absolute bar numbers. This also covers
  the chord-pick popover (#303), whose header and footer list bars: `D♭7 Mixolydian · A1 bar 6, A2 bar 6`. Recorded in
  `docs/design.md` §4.
- **No new editor UI** for a section's key, time or context. They are set in Source. The existing "key change at a
  bar" action writes the section's `key:` at bar 1, and `@key` at any other bar.

## Format and semantics

1. **Header.** Lines before the first `section:` are the song header (the present meta keys). A song-level field
   (`title:`, `composer:`, …) after the first `section:` is a diagnostic.
2. **`section: NAME`** opens a block. NAME follows the present section-name rule and length limit. A second block with
   the same name is a diagnostic.
3. **Section fields:** `key:`, `time:`, `context:`, `bars:`, `outside:`, `copy:`. They may appear only before the
   block's first row or directive; a later one is a diagnostic. The serializer writes them in that order, directly
   under `section:`.
4. **Rows** are `bar | chord [| scale [| function]]` with the trailing `# …` comment as today. Bars count from 1 in
   each section and must not go backwards (as today).
5. **`bars: N`** is the section's length in bars. It must be a whole number at least the last written bar, or it is a
   diagnostic. Without it, the length is the last written bar.
6. **Directives in a block** drop their section argument: `@key BAR KEY`, `@context BAR CONTEXT`,
   `@ending N FIRST [LAST]`, `@segno BAR`, `@coda BAR`, `@nav BAR TEXT`. A directive in the header is a diagnostic.
   `@copy` is gone: `copy:` replaces it.
7. **Reverting.** A section starts in its own `key:`, `time:` and `context:`, or the song's where it sets none. An
   in-block `@key` or `@context` holds from its bar to the section's end. The next section starts afresh by rule 7.
8. **`copy: SRC`** repeats section SRC. The block has no rows of its own (a row in it is a diagnostic); it may have its
   own endings, marks and nav. It carries SRC's rows, its `key:`, `time:`, `context:` and `bars:`, and its in-block
   `@key` and `@context`, except where the copying block sets its own field. A copying block's own `key:` replaces
   both SRC's `key:` and SRC's in-block `@key` lines (the same for `context:`). SRC may itself be a copy. SRC's endings, marks and nav are not
   carried: they are form navigation and are written per block. SRC must come earlier in the chart, or it is a
   diagnostic.
9. **`time:`** is 2/4, 3/4 or 4/4, as the song-level `time:` is (5/4 and 6/4 stay with #234). It is parsed, kept and
   carried by `copy:`, but a section whose metre differs from the song's gets a diagnostic ("drawn in the song's metre
   until #235") and plays in the song's metre. Drawing a metre change (timing, arpeggio rhythms, every line's voices,
   VexFlow bars and time signatures) is #235's work, for section and bar metres together. *(Changed while planning,
   2026-10-16: per-bar metre runs through the whole drawing stack, which is #235's body, not a format change.)*
10. **Outside the form.** Intro, Coda, Tag and Ending (with an optional number) stay outside the form by name, as
    today. `outside: yes` puts any other section outside it: before the form if it comes before the first section in
    the form, after it otherwise.

## Engine

### ChartDoc lines (`engine/src/chart.ts`)

- New kinds: `section { name }` and `sectionMeta { field: 'key' | 'time' | 'context' | 'bars' | 'outside' | 'copy';
  value }`.
- `row` loses `section`. `key`, `context`, `ending`, `mark` and `nav` lose `section`. The `copy` kind is removed.
- The parser stays tolerant: bad lines become `invalid` lines plus a diagnostic. It tracks the open block to report
  rules 1, 2, 3, 6 and 8.
- The serializer writes only the new form. Rows stay column-aligned across the chart (bar, chord, scale, function),
  as today, without the section column.
- `beatsPerBar` and `parseContext` are reused for the section fields. `chartBeats` becomes the song's default metre.

### sectionLayout (`engine/src/layout.ts`, new)

`sectionLayout(doc): Parsed<Layout>` is the one place that resolves blocks. For each section, in chart order:

- `name`, `line` (the `section:` line's index), `part` (`FormPart`), `copyOf` (the source's name, or null)
- `beats` (2 | 3 | 4), `length` (bars), `key` and `context` at bar 1
- `rows: LinedRow[]`, with `section` filled in and bars relative. A copy's rows point at the source rows' lines, as
  `@copy` rows do today.
- `keys` and `contexts`: the in-block changes (bar → value)
- `endings`, `marks`, `nav`: its own, with their lines
- the `maxExpandedRows` limit, as `expandRowLines` checks it now

`expandRowLines` and `expandRows` become thin views over the layout's rows, so `Row` keeps its shape
(`section`, `bar`, `chord`, `scale`, `function`).

### Timing (`engine/src/guideToneTimeline.ts`)

- The timeline takes the layout's rows and each section's length. Each section starts where the one before ended. A
  chord lasts until the next change in its section, and the section's last chord lasts to the section's `length`.
  Rows sharing a bar split it, as today, by that section's metre.
- Intro, form and coda are still timed one after another.
- The `finalBars` heuristic (the twin-section rule and rounding up to 4-bar phrases) is removed. The converter writes
  `bars:` wherever that heuristic gave a different length, so the library's timing does not change.
- The whole chart is timed in the song's metre (rule 9). Each layout row also carries `at`, its bar counted from the
  start of its form part (Intro, form, Coda), for the analysis stream, which times by bar position.

### Consumers

- `barView` (`bars.ts`) and `buildChanges` (`changes.ts`) read sections, lengths and directives from the layout,
  not from `doc.lines` and absolute bars. A bar's kind is `chords` or `held`: with lengths explicit, the `implied` kind
  (bars the sheet rounded a part up to) is gone.
- **Analysis** (`engine/src/analysis/`) reads each bar's stated key and context from the layout (rule 7). `# area:`
  comments name section-relative spans: `# area: F major (A 1–5)`, `# area: Db major (A 6 – B 2)`. The `--ambiguous`
  report suggests a pin as the section's `key:` (at bar 1) or as `@key BAR KEY` in the named section.
- **`edit.ts`** keeps its `(section, bar)` signatures, with relative bars:
  - `insertBar`, `deleteBar`, `insertBars` and `insertHeldBar` renumber only within the section, and update its
    `bars:` if set
  - `renameSection` edits the `section:` line and any `copy:` that names it
  - `repeatSection` writes `section: DST` and `copy: SRC`
  - `splitSection` opens a new block and renumbers the moved rows from 1
  - `writeOutCopy` replaces `copy:` with the source's rows
  - `setEnding`, `setMark`, `setNav` and `toggleEnding` write in-block directives
  - `insertKeyBefore` and `setKeyLine` write the section's `key:` at bar 1, else `@key BAR KEY`
- `parseBarLine` is unchanged (it reads one bar's chords). `completions.ts` offers `section:` and the section fields.
- `ChordAt` (`section:bar:k`) keeps its shape; its bar is now relative.
- `engine/src/index.ts` exports change (layout, migration). `api.test.ts`'s snapshot is updated.

## Migration

### migrateChart (`engine/src/migrate.ts`, new)

`migrateChart(text): string` turns old-format text into new-format text. It returns the text unchanged if the chart
already has a `section:` line or has no rows. It is pure and is shared by the library script and the app.

- Rows are grouped into blocks by section, in order. Header lines (meta, and comments before the first row) stay in
  the header. A comment between rows stays in the block it sits in.
- **Start and length**, by the old timing: a section starts at its first row's bar (the chord before holds until it).
  Its length is the next section's start minus its own within the same form part. The last section of a part takes
  the old `finalBars` result. `bars:` is written only where the length differs from the last relative bar.
- **`@copy SRC DST OFFSET`** becomes `section: DST` and `copy: SRC`. Where the offset disagrees with the old timing,
  the source gets a `bars:` that makes them agree, or the chart is reported.
- **Keys and contexts.** The converter replays the old rule: an `@key` holds, in play order, through later sections
  and `@copy` repeats until the next `@key`, and before the first one the areas are found. A section that starts
  inside an old `@key`'s span gets `key:` with that key, even when it equals the song's key: a stated key and a found
  one analyse differently. A change inside a section becomes an in-block `@key`. Where a `copy:` would carry the
  source's in-block `@key` lines into a different key plan from the old one, the converter writes that repeat out as
  rows. Contexts follow the same rule. The analysis therefore does not change.
- `@ending`, `@segno`, `@coda` and `@nav` move into their section's block with relative bars.
- `# alt: bar N (…)` and `# alt: bars N–M (…)` are rewritten with relative bars. The header comment
  `# section | bar | chord…` becomes `# bar | chord…`. Other comments are left as written; those that name a bar are
  returned in a list for the report.

### Library

0. **First, before any format change:** the golden fixture's `charts` entries gain each row's timing (start beat and
   beats, from `guideToneTimeline`) and its stated key and context. Then `make golden` is run on the old engine. Today
   the fixture freezes rows and played scales but not timing, so nothing would show a change in timing once the old
   engine is gone. The new fields stay in the fixture afterwards.
1. `engine/scripts/migrate-charts.ts` rewrites all 379 charts in `engine/charts/` and prints the prose-comment list.
   The fixture's inline charts (`CHART_TEXTS` in `goldenFixture.ts`) are converted by hand into the new format,
   covering the same parser paths.
2. `cd engine && npm run analyse -- --all --save` rewrites the `# area:` lines.
3. `make golden`.
4. **Golden review:** `engine/scripts/compare-golden.ts` maps each old `(section, absolute bar)` to
   `(section, relative bar)`. It checks that the old and new `golden.json` agree in everything else: rows, played
   scales, timing, stated keys and contexts (chart `text` excepted). Any remainder is reviewed by hand.

### The app

- **Every chart that opens in the editor** is migrated as it opens: saved My charts (`csm-chart:<id>`), the draft
  (`csm-draft`) and a `.txt` file opened from disk. A saved chart is saved back in the new format (the pattern of
  `unlevel`). `migrateChart` also returns a map from old line numbers to new ones, so the Scale-level migration
  (`unlevel`, whose `owned` keys are `line:chord`) still finds its rows when both run on one opening.
- **Share links:** the payload `VERSION` becomes 2. A version-1 payload decodes to `null`, which takes the existing
  "can't open this link" path.
- **Undo history** for a migrated chart is dropped on opening (existing behaviour when the text moved on).
- **Chord picks** (`csm-pent-picks:<key>`) keyed by old absolute bars fail their target check and drop, as picks do
  when the chart changes. The plan checks `csm-practice` for bar keys and migrates or drops them likewise.
- A follow-up GitHub issue lists the prose comments for hand-fixing.

## Testing

TDD for the engine (it has no drawing).

- **Parser and serializer:** every rule above, including a song-level field after the first `section:`, a section
  field after a row, a duplicate section, `bars:` below the last bar, a directive in the header, `copy:` with rows, and
  `copy:` naming a later or missing section. Round trip, and canonical field order.
- **sectionLayout:** lengths with and without `bars:`, per-section beats, key and context reverting (section field and
  in-block directive), `copy:` carrying and overriding, `outside: yes` before and after the form.
- **Timing:** sections in mixed metres; a held last chord with `bars:`; intro and coda from bar 1.
- **migrateChart:** unit cases (a held boundary, `@key` across sections and across `@copy`, a `@copy` whose offset
  disagrees, endings, alt comments, a header comment). Every library chart migrates and parses with no diagnostics.
  Its timing, keys and scales equal the old engine's, checked through the golden fixture (Library, steps 0 and 4).
- **edit.ts:** each action with relative bars, including `bars:` updates and `copy:` renames.
- **Web unit tests:** saved-chart migration on open; a version-1 share link returns `null`; the chord-pick wording.
- **e2e:** charts and fixtures in the old format are converted. The editor's rename, repeat, split and insert-bar flows
  are the browser check.
- **Gates:** `make test`, `make lint`, `make e2e`, `make a11y`.

## Docs

- `README.md`: the chart format table and example.
- `docs/design.md` §4: section blocks, section fields, `bars:`, the reverting rules, and section-relative labels.
- `CLAUDE.md`: the "Make a chart" workflow (section blocks, no section cell, `bars:` for a held last chord).

## Commit order

1. Golden gains timing, stated keys and contexts (old engine), via `make golden`
2. `migrateChart`, with its own reader for the old rows, and its unit tests
3. Format tests, then the parser and serializer
4. `sectionLayout` and timing
5. Consumers: bars, changes, arpeggios, analysis
6. `edit.ts` and the web app
7. The library conversion, analysis re-save, golden and compare
8. Docs

Commits 3–6 switch the format, so the suite may be red between them. Commits 1, 2, 7 and 8, and the PR as a whole,
are green.

## Out of scope

- Bar-level metre changes (#235) and 5/4 or 6/4 (#234)
- Editor UI for a section's key, time or context
- Hand-fixing prose comments (follow-up issue)
