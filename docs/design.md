# jazz-scales web app: design

Companion to [requirements.md](requirements.md). This is the current design; the `plan-*.md` files are the
records of how each phase was built (see [README.md](README.md)).

## 1. Overview

A Nuxt 4 site, styled with Tailwind CSS and built with `nuxt build`, on Vercel (`web/vercel.json`). Every page is
prerendered and served as a static file; the scale engine, chart parser and renderer all run in the browser. The chart
library is built into the site at build time from `engine/charts/*.txt` (the engine package). The only server code is one function,
`/api/contact` (the contact form). Unknown URLs are also rendered there, as the 404 page. There is no database.

```text
engine/charts/*.txt ─────┐                          ┌─> Home page (tune search) and Library page
engine/chord_scales.json ┼─> build (Vite raw import) ┤
                         │                          └─> Editor: text ⇄ grid ─> engine ─> VexFlow preview ─> browser print
engine ──> engine/fixtures/golden.json (frozen answers, `make golden`) ──> vitest golden test
```

The preview has two sheets: **Changes** (the chart as a study lead sheet, the default view; its From 3rd and From 7th
control puts a guide tone line on the staff) and **Scales** (one staff per chord). Both are written for the
chosen instrument.

## 2. Repository layout

```text
package.json              # npm workspaces (engine, web), overrides; package-lock.json beside it
engine/                   # @chord-scale-maker/engine (superpowers/specs/2026-10-11-engine-ui-split-design.md)
  chord_scales.json       # qualities, aliases, default/alternate scales, slash readings
  charts/*.txt            # chart library (concert pitch)
  fixtures/               # golden.json, analysis.json: the engine's frozen answers (`make golden`)
  scripts/                # analyse.ts, fixtureScales.ts, guideLines.ts (npm run analyse | fixture-scales | guide-lines)
  package.json, tsconfig.json, vitest.config.ts, eslint.config.mjs (the boundary rule)
  src/                    # pure TS, no Vue/DOM imports; index.ts is the public API
    pitch.ts              # letters, pitch classes, accFor, enharmonics, glyphs (b -> ♭)
    scales.ts             # SCALES, ALIASES, spellFrom, simplifyRoot, spellScale, parseScale
    instruments.ts        # TRANSPOSITIONS, INSTRUMENTS, clef ranges
    part.ts               # writtenRoot, scaleNotes, scaleLabel, lilyNote, resolveStart (functional "Part")
    chord.ts              # parseChord -> ChordParts, chordTokens (+ lenient display variants)
    qualities.ts          # quality lookup via chord_scales.json, options + defaults, baseQuality
    chart.ts              # parse/serialize chart text <-> ChartDoc (section blocks)
    layout.ts             # sectionLayout: blocks resolved (rows, lengths, copies, stated keys)
    migrate.ts            # migrateChart: the retired row format to section blocks
    edit.ts               # grid edits on a ChartDoc (pure), cell validation
    sheet.ts              # rows -> pages of StaffModel (labels, notes, intervals, errors), toVexKey
    transpose.ts          # move a whole chart to another key (editor "Transpose…")
    intervals.ts          # interval names against the chord root (b9, #11, …)
    guideTones.ts         # guide tones per chord, voiced for the Changes sheet (guideVoices)
    guideToneLines.ts     #   the two lines, from the 3rd and from the 7th, built together (guideToneLine)
    guideToneTimeline.ts  #   when each chord starts and how long it lasts, in the chart's metre
    arpeggios.ts          # 7th chord arpeggios for the Changes sheet (arpeggioVoices)
    voiceLeading.ts       #   RANGES (the clefs' default ranges), and voiceLead (Viterbi over pairs), kept only to compare
    tune.ts               # tuneSummary, tuneDescription (a song page's text), tuneGaps/tuneAdvice (§7b)
    decisions.ts          # DECISIONS (every heuristic's id and doc anchor), decisionHref, decisionOf (§5 Documentation)
    util.ts               # orNull, chunk
    limits.ts             # input caps
    index.ts
    __tests__/            # vitest, incl. the golden fixture and the export snapshot
data/quotes.json          # quotes for the navbar (web only)
docs/                     # this file, requirements, phase plans (docs/README.md)
web/                      # Nuxt app (Vercel root directory); imports @chord-scale-maker/engine
  app/
    pages/index.vue       # home: one large tune search (live suggestions, keys written for your instrument), recently opened (§7)
    pages/library.vue     # the library, A–Z, with title/composer search (/library?q=…)
    pages/song/[[slug]].vue  # one URL per tune: /song/<name> is the prerendered, indexable page and the editor (§7b; old ?chart=<name> moves there); also ?mine=<id>, ?new=1 and share links (#s=…)
    pages/help.vue        # how it all works, in the owner's voice: sheets, controls, practice, editing, printing
    pages/about.vue, contact.vue, privacy.vue  # About (Jazz Lab thanks, the video, credits), the form, privacy
    pages/ui.vue          # dev-only showcase of the Catalyst components (removed from production builds)
    components/           # AppShell, EditorView, ChordChoices, SheetChordEditor, BarDialog,
                          # SheetChord, SheetLabelPicker, SheetBarToolbar, SheetHeading (the sheet as the editor),
                          # ChartHeadingFields, MetaInput, ChartText, ChartTranspose,
                          # PreviewControls, SheetPages, ScaleSheet, ScaleStaff,
                          # ChangesSheet, ChangesSystem, ChordSymbol, NoteName
    components/ui/        # Catalyst ported to Vue (<UiButton>, <UiListbox>, <UiDialog>, …)
    composables/          # useChartEditor (editor state), useChartHistory (undo), usePreferences, useTheme, useFeature, useMediaQuery,
                          # useFocusMode, useSavedChart (auto-save), useOpenChart
    utils/                # library (build-time charts), scaleChoices, instrumentChoices, sheets,
                          # vexflow (loader, scale staves, shared SVG helpers), changesDrawing,
                          # storage (safe localStorage), myCharts (saved charts), chartFile (Download/Open),
                          # starterChart, catalyst/ (button and badge styles),
                          # field, table, interactive (Catalyst wiring),
                          # site (canonical URLs, page heads), structuredData (JSON-LD), sitemap (§7b)
    assets/css/main.css   # Tailwind, theme tokens, print rules
  build/                  # csp.ts, headers.ts, analytics.ts, quotes.ts, sw.ts + service-worker.js (+ tests, check-headers);
                          # links.ts + check-links (the link check), docsGate.ts + check-docs (the docs gate) (§5 Documentation)
  server/                 # routes/sitemap.xml.ts (prerendered, §7b), api/contact.post.ts, utils/contactMessage.ts (+ test: message and attachment checks), plugins/csp.ts
  public/theme-init.js    # applies the saved theme before first paint
  public/analytics-before-send.js  # strips a share link's #… before Web Analytics sends a page view
  public/favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest
                          # the mark (four note heads climbing a navy tile, the top one in a blue corner), drawn
                          # by scripts/icons.mjs (`npm run icons`; needs rsvg-convert and ImageMagick); the navbar
                          # shows favicon.svg before the wordmark
  public/robots.txt       # allows everything, names the sitemap
  public/<key>.txt        # the IndexNow key (§7b)
  public/og-image.png     # the 1200×630 link preview (Open Graph tags in nuxt.config.ts), drawn by the same script
  test/                   # app tests (@nuxt/test-utils, happy-dom)
  e2e/                    # Playwright tests against the production build
  nuxt.config.ts, vitest.config.ts (node + app projects), playwright.config.ts, eslint.config.mjs,
  tsconfig.json (Nuxt's generated configs), tsconfig.build.json, tsconfig.e2e.json
```

Vercel builds from `web/` with "include files outside root directory" enabled, so the engine package (`engine/`)
and `data/` are in the build; it installs from the workspace root (the root `package-lock.json`). The library comes
from the engine package through the `#charts` alias (`nuxt.config.ts`), and `make dev` watches the engine's charts
and `chord_scales.json`, since they sit outside Vite's root.

## 3. Engine

Pure functions over immutable data, with no Vue or DOM imports. The core began as a one-to-one port of the
Python CLI's `jazz_scales.py` (retired after `v1-launch`), and keeps its names and behaviour. Transposing a chart,
interval labels and guide tones are built on top of it in their own modules.

### Types

```ts
type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6        // C..B
type Spelled = Readonly<{ letter: Letter; acc: number }>
type ScaleNote = Readonly<Spelled & { semis: number }>
type Pitched = Readonly<Spelled & { midi: number }>
type ScaleKey = keyof typeof SCALES
type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
type Clef = 'treble' | 'bass'
type Part = Readonly<{ clef: Clef; trans: Transposition }>
type Mode = 'from' | 'root'

type ChordParts = Readonly<{
  root: Spelled
  quality: string          // raw text between root and /bass, e.g. "m7b5", "6/9"
  bass?: Spelled
}>
// display tokens, rendered by ChordSymbol.vue (replaces LilyPond markup)
type ChordToken =
  | { kind: 'text'; text: string }
  | { kind: 'acc'; acc: 'b' | '#' }
```

### Port map (from the retired Python CLI, for reading `v1-launch`)

| Python | TS | Notes |
|---|---|---|
| `parse_root`, `root_name`, `pc_of`, `acc_for`, `enharmonics` | `pitch.ts` | identical arithmetic; JS `%` needs a `mod()` helper for negatives |
| `simplify_root` | `scales.ts` `simplifyRoot` | same cost tuple `(ugly, total, sameDir)`; tie order = order of `enharmonics()`; a relettered scale (below) uses `(ugly, sameDir)` |
| `spell_from`, `spell_scale`, `parse_scale`, `norm` | `scales.ts` | formulas copied verbatim from `SCALES`; `norm` accepts ♭/♯/♮ so page labels parse back |
| `Part.written_root/scale/scale_notes/scale_label` | `part.ts` | functions taking a `Part` value |
| `Part.chord_markup` | `chord.ts` `chordTokens(part, chord, scaleText?)` | returns `ChordToken[]`, not LilyPond |
| `lily_note` | `part.ts` `lilyNote` | the golden fixture's note spelling; `sheet.ts` `toVexKey` turns `{letter, acc, midi}` into `"eb/4"` |
| `parse_start` + start logic in `main()` | `part.ts` `parseStart`, `resolveStart` | |
| `read_chart` | `chart.ts` | returns errors, never exits |
| `scale_options`, `default_scale` | `qualities.ts` `resolveQuality`, `defaultScale` | options carry `note`, `default` and `outside` |

### Beyond the port

- `qualities.ts`:
  - `resolveQuality(chord)` looks the quality up in the `chord_scales.json` aliases. It returns
    `{ quality, options: { scale, note, default, outside }[] }`, or `null` for an unknown quality, and throws
    on a chord it can't parse.
  - An option's scale root is the chord root plus an interval, by letter-step arithmetic: `b3` over C → Eb.
    Interval-derived roots are respelled by `simplifyRoot` for their scale: `b2` over Bb → B, not Cb.
- `scales.ts` `spellScale` (#279): the half-whole and whole-half diminished scales, where their formula spells badly on a
  root, take another lettering of the same notes (a letter repeated or skipped): the fewest double accidentals, then
  B♯/E♯/C♭/F♭, then accidentals, then accidentals against the root's side, then closest to the formula. D♭ half-whole
  is D♭ D E F G A♭ B♭ B, not D♭ E𝄫 F♭ F G A♭ B♭ C♭. The root stays as written whenever a lettering is clean (F♯°7 keeps
  F♯). Intervals and practice keys from the root still read the formula's degrees (`part.ts` `writtenScale().degrees`),
  so the B above is still the ♭7 and lights with the chord tones.
  - `baseQuality(text)` reads an extended symbol as the known quality it starts with, when the rest is only
    alterations (`Maj7#11` → `Maj7`, `7(9)` → `7`). Guide tones use it.
- `chart.ts` `qualityScale(row)`: the explicit scale cell, else the default, else `null` (the UI prompts); the
  sheets read `resolveScales` (§7a).
- `chord.ts`:
  - `chordTokens` and `writtenChordRoot` throw on a scale they can't read.
  - `chordTokensOrNull` and `writtenChordRootLenient` are the display variants. They ignore an unreadable
    scale, so a typo in the scale cell never hides the chord symbol.

## 4. Chart model and text ⇄ grid sync

The text format needs a document model that preserves comments and blocks (#329, the
[section blocks spec](superpowers/specs/2026-10-16-section-blocks-design.md)): a header of song fields, then one block
per section, opened by a `section:` line, with the section's own fields straight under it, then its rows and
directives, until the next `section:`. Bars count from 1 in each section.

```ts
type ChartLine =
  | { kind: 'meta'; key: MetaKey; value: string }  // the header: title, subtitle; key, bars, context (analyser hints); minor (reserved); time; composer, style, form, source, aka, kind
  | { kind: 'section'; name: string }              // opens a block
  | { kind: 'sectionMeta'; field: 'key' | 'time' | 'context' | 'bars' | 'outside' | 'copy'; value: string }
  | { kind: 'row'; bar: string; chord: string; scale: string; function?: string; comment?: string }  // bar from 1 in its section; scale '' = default; function: a stated function ('V7/ii', 'D: V7/ii'); comment: a trailing # …
  | { kind: 'key'; bar: number; key: string }  // @key 5 D: from that bar to the section's end
  | { kind: 'time'; bar: number; time: string }  // @time 5 3/4: the metre from that bar to the section's end
  | { kind: 'context'; bar: number; context: ChartContext }  // @context 5 modal: parsed, not yet analysed
  | { kind: 'ending'; n: number; from: number; to: number }  // a 1st/2nd ending (volta) on the Changes sheet
  | { kind: 'mark'; mark: 'segno' | 'coda'; bar: number }     // a segno 𝄋 / coda ⊕ glyph
  | { kind: 'nav'; bar: number; text: string }                // "D.S. al Coda", "To Coda", "Fine"
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }
  | { kind: 'invalid'; text: string }     // bad line, kept verbatim so text round-trips

type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>  // line 0 = whole chart
type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>
```

- **Parsing:** `parseChart(text) → Parsed<ChartDoc>` is tolerant. A bad line becomes an `invalid` line plus a
  diagnostic, never an exception. Block rules are diagnostics too: a song field after the first `section:`, a section
  field after the block's first row or directive, a second section of one name, a row or directive in the header (an
  old-format row says so), `bars:` under the last written bar, a `copy:` block with rows, a `copy:` of a section not
  above it. `lineSections(doc)`
  names each line's block.
- **Rests:** a row whose chord is `N.C.` (`isRest`: "NC", "N.C", any case; #336) is a bar with no chord. It takes its
  bars on the Changes sheet (its symbol over slashes, no numeral or scale, every line rests there), gets no staff on
  the Scales sheet, no entry in the analysis stream (the chords around it are neighbours, the one before it lasts
  through it: `resolveScales` gives it `{ scale: null, source: 'rest' }`), no scale or function picker, and
  transposes as itself.
- **Fatal diagnostics** (`isFatal`) mean a hard input limit was exceeded: length, rows or expanded rows. The UI
  must not render or write back such a chart. Non-fatal diagnostics are per-line errors shown inline.
- **Serializing:** `serializeChart(doc) → text` gives the canonical form, rows column-aligned across the chart.
- **Layout** (`sectionLayout(doc)`, `engine/src/layout.ts`): the one place blocks are resolved. Each section's rows
  with its name filled in and `at`, its bar counted through its part (Intro, form, Coda) from 1; its length (`bars:`,
  else a copy's source's, else its last written bar); its part (by name, or `outside: yes`: before the form if it
  comes first, after it otherwise); its stated `key:` and `context:` at bar 1; its metre at bar 1 and each bar's
  (`metre`, `layout.metres`: `time:`, then each `@time` to the section's end); its copy source. And a flat list of
  directives with their section. A `copy:` repeats its source's rows (pointing at the source's lines), `key:`,
  `time:`, `context:`, `bars:` and in-block `@key`/`@time`/`@context`, except where it sets its own field (its own
  `key:` or `time:` replaces the source's in-block changes too); not endings, marks or nav. `statedKeyAt(layout, section, bar)` is
  the key an author stated there, else null. `expandRows`/`expandRowLines` are views of the layout's rows, capped
  at 1,000.
- **Timing:** the guide tone timeline times sections one after another, each from its bar 1; a chord lasts until the
  next change in its section, and a section's last chord lasts to the section's length. Each bar is in its own metre
  (#235): the timeline also gives the chart's `Clock` (`engine/src/metre.ts`: each bar's length; `barAt`, `barStart`,
  `barLength`), which the bar view, the Changes sheet and every line's voices read instead of dividing by one metre.
- **Navigation directives** (`@ending`, `@segno`, `@coda`, `@nav`): read only by the Changes sheet
  (`engine/src/changes.ts`) and the bar view, from the layout, which map them onto per-bar `volta`/`segno`/`coda`/`nav`
  fields. An `@ending` section is a 2× repeat with the two endings bracketed; `@segno`/`@coda` draw glyphs, `@nav` a
  printed instruction. A directive on a bar the section lacks renders nothing and is listed by the bar view.
- **Outside the form** (`formPart`, or `outside: yes`): sections named `Intro`, `Coda`, `Tag` or `Ending` (with an
  optional number). They print where they stand; the analysis links an intro into the form's first chord and a coda
  after its last (the form itself wraps to its own top), and each is timed on its own.
- **Metre:** a `time:` header line, `2/4` to `6/4` (`4/4` the default; anything else is a diagnostic); a section's
  own `time:`, and `@time BAR METRE` from a bar to its section's end (#235, #234). `chartBeats` gives the song's;
  each bar has its own (`ChartBar.beats`, `ChangesBar.beats`). The guide tone timeline splits a bar by its metre (3/4:
  two chords = 2 + 1; 5/4: 3 + 2; 6/4: 3 + 3, three = 2 + 2 + 2), and the Changes sheet draws a time signature on its
  first bar and wherever the metre changes (`ChangesBar.timeSignature`), its slashes and, with a line on, dotted
  halves and dotted wholes (a 5-beat note is a dotted half tied to a half, `drawnLengths`). The bar menu's Bar in
  2/4 … 6/4 (`setBarMetre`) puts one bar in a metre, the bars after it keeping theirs. The scale sheet doesn't
  depend on it.
- **Function cell, `key:` and `@key`:** a row may carry a fourth cell, the function the author states (`V7/ii`, or
  `D: V7/ii` for another key); empty means unstated. A section's `key:` states its key from its bar 1, an `@key` from
  its bar, each to the section's end; the next section is analysed afresh. Read by the analysis (§7a); a row with a
  function but no scale keeps its empty scale cell (`2 | D7 | | V7/V`).
- **`context:` and `@context`:** `context: functional | modal | blues` in the header states how the analysis reads
  the chart (§7a; docs/plan-analysis.md §5.4); absent, it is detected. A value that is none of the three keeps its
  line (like a bad `key:`) and is a diagnostic; the analysis then detects, and reports the bad line. `minor:` is
  reserved (accepted, kept, reported as ignored). A section's `context:` and `@context BAR CONTEXT` are parsed,
  validated and serialised; the analysis reports them as not yet supported and keeps the chart's context.
- **Bar labels are section-relative everywhere** (`A2, bar 1`; a chord pick's popover lists `A1 bar 6, A2 bar 6`); no
  display shows absolute bar numbers (decided 2026-10-16, #329).
- **The retired row format** (`SECTION | BAR | CHORD …`, absolute bars, `@copy SRC DST OFFSET`) is migrated, never
  read: `migrateChart(text)` (`engine/src/migrate.ts`) replays the old timing and `@key` rule into blocks (`bars:`
  where a section's last chord was held into the next, `key:` on each section an old `@key` ran into), with a line map
  for the Scale-level migration. The editor runs it on every chart it opens (a saved chart, an old draft, a file);
  version-1 share links (old charts) no longer open.
- **Trailing comments:** a row may end in `# …` (a `#` with space on both sides, so `F#m7` and `C# Lydian` are
  safe). It holds the analysis (§7a), is kept verbatim through every edit, and is column-aligned when serialized;
  the grid doesn't show it.
- **One source of truth:** the `ChartDoc` in `useChartEditor`.
  - Text edits are debounced (about 150 ms), parsed, and replace the doc. Text isn't reformatted while you type;
    the canonical form applies only after a grid edit.
  - Grid edits make a new doc (an immutable update), which is serialized back into the text.
  - The text always wins. A grid edit made from a doc older than the typed text is dropped.
  - **Undo (#315):** ⌘Z and ⇧⌘Z (Ctrl off a Mac) anywhere on the song page (a text field outside the editor keeps
    its own), and Undo/Redo, step through one history of the chart's text and its note choices: chord picks, the
    pentatonic path and step, Rung, Side, Ranked against, Built on, and the Practice selection per mode. View
    preferences (level, instrument, spelling, sheet, overlay…) are not steps. `useChartHistory` over the engine's
    pure `history.ts`: a step holds only the fields it changed (before and after), so undoing it leaves the rest as
    they are now. A step is recorded each time the doc or a choice changes: a sheet edit or a transposition at once,
    typing after the parse pause (a burst of keystrokes is one step); what changes in the same moment (an edit and
    the picks it carries) is one step. It keeps 100 steps, per chart in this browser under `csm-undo:<key>` (shortened
    from the oldest when storage is full), dropped on opening if the chart or a choice moved on since; a shared chart's
    lasts for the visit.
- **Cell validation** (`cellError`): a value may not contain `|` or line breaks, start or end with spaces, or
  start with `#`, `@`, `title:` or `subtitle:`; a row cell may not contain a `#` after a space (it would start a
  trailing comment). Otherwise the serialized text would re-parse as a different line. The bar editor and the
  sheet's chord editor refuse such a chord and say why; a rejected heading value stays visible and flagged in its
  field (`MetaInput`), and the doc keeps the last good value.
- **Scales follow the chord:** a default scale is written into the text by name (`C Dorian`), and follows when the
  chord changes (`setRowChord`, `setBarChords`: Cm7 → F7 takes C Dorian to F Mixolydian); a scale you chose stays.
- **Bar editor: deleted** (2026-10-12, [#141](https://github.com/KevDog/Chord-Scale-Maker/issues/141)). The sheet is the
  editor from `md` up (the lead-sheet editor, below), which took over the grid's own actions (Paste bars, Repeat a
  section, Rename section, Time; [#142](https://github.com/KevDog/Chord-Scale-Maker/issues/142)); the Details are in
  the Source there. Edit, next to the
  title, opens the editor, and Done closes it. The Chart pane (heading, Undo/Redo/Save/⋯, heading fields) is
  rendered only below `md` and on a chart over a size limit (the notice, and the Source). The heading fields are
  `ChartHeadingFields`, with the time and, under Details, the composer, style and form (`chartDetails`); the text is
  the Source (in the banner from `md` up, under the ⋯ menu below; remembered, `csm-source`). Concert pitch always.
  - **Phones (below `md`): light edits only.** The note "Full editing works on a larger screen" sits under the
    title, and the heading fields, Undo, the Source under ⋯ and Transpose stay. Each chord on the Changes sheet is
    a button ("Edit Dm7, A bar 3"; a transposed part's adds "(concert C7)") that opens `SheetChordEditor`, a
    Headless UI dialog as a bottom sheet: the chord in concert pitch (`setLineChord`: blank takes it out and `%` is
    the bar before; refused with why) and its `ChordChoices` (Scale, Function, Why; shared with the sheet's label
    pickers). Each drawn chord carries its chart `line` (`ChangesChord.line`); a repeat's points at the row it
    repeats, and the editor says a change there changes the section it repeats. The library hides New chart there.
  - **Lead-sheet editor** ([spec](superpowers/specs/2026-10-11-lead-sheet-editor-design.md)): from `md` up, with
    the editor open, the Changes sheet is the editor,
    under a banner ("Editing the sheet", Undo, Redo, Source, Save, Done editing). A chord is a button that
    opens into a field on its beat (`SheetChord`) with completions that read each candidate in that bar
    (`chordCompletions`, `chordPreview`: numeral → scale at the sheet's level, labelled as the sheet labels scales,
    `sheetScale`); Enter and Tab commit (Tab to the next bar's first chord, ⇧Tab the previous; → at the end of the
    text and ← at its start to the next or previous chord, through the bar and then into the next bar's: both
    `nextChordLine`, by bar or by chord, skipping held bars; inside the text the arrows move the caret), Space adds a
    chord slot, Esc cancels, blank takes the chord out, `%` is the bar before; a refused draft keeps the field open
    with why. The numeral and
    scale under each chord open the function and scale lists (`SheetLabelPicker` over `ChordChoices`, with its why);
    a function the rules only guessed is underlined amber, and its list offers Accept guess (`FunctionChoice.accept`
    on Auto: the candidate that reads and sounds like Auto, named only where the decision is a `fallback` and the row
    states nothing), which writes that function and leaves the scale cell blank; under the function list an Other
    function field takes any function in full (`cellError`, then `parseFunction`, live: a draft that reads shows the
    scale it would give from a trial doc, Enter writes it with its key prefix as typed, and one that doesn't read stays
    with the parser's own message); a pinned scale shows its pin. The bar under the pointer
    gets a toolbar (`SheetBarToolbar`: the inspector's actions by name; Write out alone on a written-out repeat); a
    ghost "+ bar" ends each section (`ChangesLine.sectionEnd`, `ChangesBar.at`); + Section and Repeat a section…
    (`repeatSection`: a `copy:` block after the part's last section) follow the sheet; a section's marker is a button that
    renames it (`renameSection`). The toolbar's ⋯ menu also pastes bars (`parseBarLine`, then `insertBars` before or
    after the bar; refused while the text has diagnostics). The jump, the new section, the pasted bars, the repeat and
    the rename use `BarDialog`; a refused one stays open with why. The heading is edited where it prints
    (`SheetHeading` in `SheetPages`' `#heading` slot, with the time beside the key; the printed heading stays for
    print). The sheet keeps the instrument's clef and range but reads
    in concert pitch while editing, with numerals and scales shown (their toggles hide); both return on Done. Phones
    keep the bottom sheet alone. Every mark is hidden in print.
- **Scale level** (`engine/src/levels.ts`): Basic / Standard / Advanced / Random, in the
  preview's toolbar. The level is a **view preference**, like the instrument: it is never written into the rows, so
  changing it is no edit (no undo step, the chart stays clean). The sheets play every blank scale cell at it
  (`resolveScales`, §7a); a written scale is a pin and plays as written at every level.
  - Options in `chord_scales.json` carry `level: basic|advanced`; Standard is the default, and a quality without a
    tag keeps it. Random picks among the inside options, from a seed (Shuffle deals a new one).
  - The level once wrote its scales into the chart, and a browser kept which rows it **owned** (`LevelState.owned`).
    A saved chart with owned rows is migrated once as it opens (`unlevel`, in `EditorView`, with the library chart it
    came from as `baseline`, whose own choices were its Standard): each owned cell still holding the level's scale is
    blanked, so it follows the level; then `owned` is dropped.
  - **Ladders** (`ladders` in `chord_scales.json`, plan-analysis.md §11): a row whose Standard is not its
    quality's default climbs that scale's ladder instead of the quality's tags, so the analysis's choice keeps its
    colour: D7 on Phrygian Dominant (V7 of G minor) goes to G Minor Pentatonic at Basic and Altered at
    Advanced (Spanish Phrygian stays in the menu: a rung holds one scale), not to D Major Pentatonic and Bebop
    Dominant. A ladder without a rung keeps the Standard (`ladderScale`). `quality_ladders` overrides a ladder for
    one chord quality: `m` and `m7` on Phrygian (iii, or v of a minor key) are Dorian at Advanced, not Dorian ♭2;
    `m6` on Melodic Minor stays there. The Level control's Random pool leaves out options marked `functional: true`
    (the °7 scales that fit one function only).
  - A tonic minor chord (the analysis's rule m5) is Aeolian at Basic.
  - Over a blues (`context: blues`), a chord the blues rules decide (D9, M6, m10, s4) plays the key's Blues scale at
    Basic (`atLevel`, `engine/src/resolve.ts`); Standard plays the rule's own scale.
  - `useScaleLevel` remembers the level and seed per chart in this browser (Save as a copy and Save to My charts
    carry them; Revert keeps them). Share links carry the level and seed, as a view preference for the recipient.
- **Slash readings** (`slash_chords` in `chord_scales.json`): a chord whose bass makes it another
  chord takes that chord's options on the bass. DbMaj7/C is a sus♭9 on C: C Phrygian (default), C Spanish
  Phrygian, C Dorian ♭2. Only the options change; the symbol, interval labels and practice presets read DbMaj7.
- **Transpose…** (`ChartTranspose`, `engine/src/transpose.ts`) rewrites the whole chart in another concert key.
  - Every row moves by the key interval in letters and semitones.
  - **The mode stays:** the To list (`transposeKeys`) is every major for a major chart, and for a minor one the
    twelve minors as their signatures spell them (`TRANSPOSE_MINOR_KEYS`: C♯ and G♯ minor, E♭ and B♭ minor). It
    starts at the chart's key, or its enharmonic twin there (`offeredKey`: D♯ minor → E♭ minor).
  - **Spelling:** roots are spelled on the target key's side by `spellInKey`, so a Bb chart reads Dbm7 Gb7, and
    a natural beats an accidental (B, not Cb). A minor key's side is its own signature's (C minor is a flat key:
    Gb7, not F#7). `simplifyRoot` decides in C and A minor, or when that side would put double accidentals in the
    scale.
  - A chord follows its scale's root, and a slash bass keeps its interval.
  - **A saved analysis follows:** a chart with an `# analysis:` header has its analysis re-run in the new key and
    written back (`refreshAnalysis`): the header, `# area:` lines and row reasons name the new key, and the header
    keeps its date. `# keep:` comments stay as written. A chart without the header keeps its comments: they are the
    user's own.
  - Titles stay as typed. ⌘Z in the editor undoes it.
- **Focus** (`useFocusMode`) shows the current sheet alone, over the whole page, with its practice highlighting.
  - A dialog (`aria-modal`) holding the preview section itself, so the sheet isn't drawn twice; the toolbar and
    practice panel are hidden, and the page behind doesn't scroll.
  - **Exit focus** (it takes keyboard focus) or Escape leaves, and focus goes back to the Focus button.
  - Printing from focus mode prints the usual pages.

## 5. Rendering

### Scale sheet

- **Layout:** one `ScaleStaff` per line: each scale a chart uses, once (`scaleLines`: the scale, the written
  chord's root and canonical quality; first-appearance order). An HTML label column on the left holds the scale name
  and, under it, the chord symbols the line covers (`Cm7 · Cm9`); the VexFlow SVG stave is on the right. HTML labels
  give better typography and accessibility than VexFlow text.
- **Stave:** one stave with a clef, no time signature, and whole notes. Accidentals follow the bar rule (`accidentalsInBar`):
  one shows only where a note differs from what is in force (the key signature, if any, or an earlier note on the
  same letter and octave), and a natural cancels an earlier one. Each staff ends with a double bar
  line, the last with a final one.
- **One spelling at a time,** from one picker ("Where each scale starts"): "From key (X)", the default, where every
  scale starts on the chart's `key:` tonic written for the part (`keyStart`; a minor key's own tonic; C with no key),
  following the chart and instrument; "From root"; or "From X" for any of the 17 written notes. Remembered as
  `csm-spell` (`root`, `key` or a note; the old `csm-start` is ignored). Share links carry `mode` and, for a picked
  note, `start` (from without a start: the key). The engine still supports `both`.
- **Subtitles** (`pageSubtitle`): "Subtitle – Tenor Sax (Bb) (Spelled from C)".
- **Interval labels:** the Intervals toggle, on by default and saved per browser, labels every note against the chord's written
  root (`engine/src/intervals.ts`). Labels read b9, #9, #11 and b13, a minor 3rd reads #9 on chords with a major
  3rd, sus chords get a 4, and sixth chords a 6. They are HTML placed under the note heads, on screen only, so
  the print layout doesn't change.
- **View model:** `engine/src/sheet.ts` builds the `StaffModel` (labels, notes, intervals, or an error such as
  "Choose a scale"), and components only draw it. The live preview re-renders only staves that changed: each
  staff's `id` combines its line's chords and scale, the part and the mode, not its position.

### Patterns sheet (flag `patterns`, on; [spec](superpowers/specs/2026-10-17-practice-patterns-design.md))

- **What:** a pattern (moves between neighbouring notes of the scale or the chord tones, e.g. `+2 −1`) run over each
  scale line, one stave a line, drawn by the Arpeggios sheet's staff. `buildPatternSheet` (`engine/src/patterns.ts`)
  builds the model; `ArpeggioSheet` takes `moves` and draws it, headed Patterns.
- **Controls (Pattern group, only on this sheet):** a listbox of the 14 library patterns plus Custom… (`aria-label="Pattern"`;
  the shown entry is the library pattern whose canonical text equals the stored one, else Custom); under Custom, a text
  box (`Custom pattern`) that writes the pattern only when `parsePattern` accepts it, else shows the error in
  `#pattern-error` (its `aria-describedby`); Notes: Scale · Chord tones; direction listbox (`Pattern direction`).
- **Preferences and links:** `csm-pattern` (canonical text), `csm-pattern-notes`, `csm-pattern-dir`; share links carry
  `sheet: 'patterns'`, `pattern`, `patternNotes`, `patternDir`.

### Arpeggios sheet ([spec](superpowers/specs/2026-10-12-arpeggios-sheet-design.md))

- **Lines:** exactly the Scales sheet's (`scaleLines`), in eighth notes, one stave each, no time signature. 12 lines a
  printed page. Controls (Arpeggio group): 7th Chord · Extended, and a direction listbox Up · Down · Up & down
  (`aria-label="Arpeggio direction"`); Show: Intervals as on the Scales; no Spell Scale, no practice panel.
- **Notes:** the line's first chord's tones (`arpeggioTones`: 1 3 5 7). 7th Chord mode runs them over two octaves, closing
  on the root (1 3 5 7 1 3 5 7 1; a triad 1 3 5 1 3 5 1; #227), beamed a chord at a time with the top root alone. Extended
  plays them once and stacks the scale's other notes above (`tensionsOf`): 7ths (triads and 6 chords only), then 9s, 11s, 13s by compound
  degree of the interval label, ties by pitch.
- **Direction:** Up is chord tones then tensions, each the next of its pitch class above the last; Down reverses it; Up &
  down plays both without repeating the top note. Placed as one run by `placeRun` (fewest notes out of range, then
  nearest the range's centre); two octaves outrun most ranges, so the rest go on ledger lines.
- **Drawing:** `drawArpeggioStaff` beams eighths by group (7th Chord: each octave's chord tones, then the closing root; Extended: the chord tones, then the tensions; a group of one gets a
  flag; each beamed group takes one stem direction); accidentals by the measure rule over the whole line, with or
  without a key signature. `buildArpeggioSheet` (`engine/src/arpeggioSheet.ts`)
  builds the model; the components only draw it.
- **Preferences and links:** `csm-arp-notes` (`seventh` | `extended`), `csm-arp-dir` (`up` | `down` | `up-down`); share
  links carry `sheet: 'arpeggios'`, `arpNotes`, `arpDir`, and open on the sheet.

### Practice selection ([plan-practice.md](plan-practice.md))

- **What it does:** a subset of each scale's notes to improvise with. The chosen notes are highlighted on the
  Scales sheet and the rest dimmed, on screen and in print.
- **The engine** (`engine/src/practice.ts`) gives every staff's notes a key, a spelled interval:
  - **From root:** from each chord's written root, so ♭3 and 3, and ♯4 and ♭5, are separate keys.
  - **From X:** from the start note, so "♭3" is E♭ from C.

  `buildSheet` takes the selection and sets `StaffModel.selected`.
- **Presets** (From root only) work per chord, from the chord quality: chord tones, guide tones (the guide tone
  table), and tensions (the rest). From X mode has All.
- **Storage:** `usePractice` remembers a selection per library chart and per mode in this browser.
- **Pentatonic** (#266, #286; both modes): **Built on** a degree of each chord (`{ preset: 'pentatonic', degree }`,
  `degree` `'auto'` or 0–11 semitones above the written chord root, 0 = on the 1; stored and shared like any pick).
  The listbox (`aria-label="Pentatonic built on"`, showing `Built on: ♭3`) offers Auto, then 1, ♭2, 2, ♭3, 3, 4, ♯4,
  5, ♭6, 6, ♭7, 7 (`PENTATONIC_DEGREE_LABELS`). Each staff ranks the 12 minor pentatonics against its own scale
  (`pentatonicRanking`: most shared, then fewest fifths from the written chord root, ♭ side first; each spelled by
  walking the fifths from the chord root, then `simplifyRoot`); Auto is the first, else the one on the degree. It
  lights the scale notes that one shares (`pentatonicPick`) and captions the staff with its name and shared count,
  always (`Dm pent · 5 shared`). Its other notes join the staff (#308, `outsideNotes`): spelled from the pentatonic,
  in pitch order within the staff's octave (from the root, or from the start note), lit in the second accent
  (`vf-second`, mid-grey in print), flagged in `StaffModel.outside` and named in the staff's accessible label; they
  are not the scale's, so they make no practice box and aren't among the lit keys a custom pick starts from. Under
  Pentatonic and Hexatonic the boxes show no pressed state (each staff lights its own degrees); a click starts a
  custom pick from the lit keys, with that box on. The usual inside choices (all five shared): on 2, 3 or 6 over Ionian, 1, 2 or 5
  over Dorian, 2, 5 or 6 over Mixolydian (the Practice panel and Help say so). `pentatonicDegreeFrom` reads untrusted
  data: a bad degree, and the old `{ preset: 'pentatonic', rank }` (#266's 1–12 rank, stored or in a link), read as
  Auto. In print the caption is 10px on one line, so 12 staves still fit a page. At Everything the caption opens the
  staff's choices (see Chord picks). Spec:
  docs/superpowers/specs/2026-10-14-pentatonic-practice-design.md (its rank superseded by #286).
- **Hexatonic** (both modes): `{ preset: 'hexatonic', pair, grouping }`, pair 0 (Auto) or 1–8,
  grouping Triad pair, Chord tones + color, Pentatonic + 1 or Trichords 3+3. After Gary Campbell, *Triad Pairs for
  Jazz* (2001), pp. 4–8: each staff's candidates are the valid links of its scale's triad chain (`triadChain`: on a
  seven-note scale the triads on degrees 1–7; otherwise from the first major, else minor, triad; each note up a step,
  as many times as the scale has notes), a link valid when both triads are major, minor, diminished or augmented and
  share no note (`hexatonicPairs`). Pair *n* is the staff's *n*th pair, wrapping round (`resolvePair`): on a
  seven-note scale the triads on degrees *n* and *n* + 1, leaving out degree *n* − 1. Auto (`hexatonicAuto`): most
  chord tones covered, then both triads major or minor, then fewest fifths from the chord root to the lower root (♭
  side first), then chain position. `hexatonicPick` lights the six notes as group A and group B (`StaffModel.selected`
  and `second`) and captions the staff (`G/Am hex`, or `no triad pair`; 10px on one line in print; a pick's
  popover, see Chord picks). Pair listbox Auto,
  1 … 8 (plain numbers; the help text says what *n* means), a grouping listbox, and a legend of the two groups. Spec:
  docs/superpowers/specs/2026-10-14-hexatonic-practice-design.md.
- **Highlighting:** `drawStaff` tags each note's group `vf-selected` or `vf-dimmed` (and a hexatonic's group B
  `vf-second` too), and `main.css` colours them: on screen, picked notes keep the staff's ink in light mode (as the
  clef) and take the accent in dark mode, group B a second accent, while the rest are faint (35% opacity in dark
  mode). In print, picked notes are black, group B mid-grey and the rest light grey.

### Changes sheet ([plan-changes.md](plan-changes.md))

- **The default view:** a chart opens on the Changes; a share link may open it on Scales.
- A study lead sheet: `engine/src/changes.ts` `buildChanges(doc, part, barsPerLine, signatures, guides)` lays the chart
  out in lines of four bars (two on phones), each section on a new line, one slash a beat in the chart's metre.
  Chords sit on their beats (the guide tone timeline's timing), each with its Roman numeral (`analysis/numerals.ts`)
  and its scale, both written for the part (a written function that doesn't read or fit its chord is set aside: the
  rules' numeral, marked ⚠, its note saying why first; #144); key-area labels where the key changes; section markers; a `copy:`
  straight after its source folded into repeat signs ("A1 · A2"), a later one written out ("A3 (= A1)"); a double
  barline at the end of the form when a tag or coda follows (a coda or ending headed "after the last chorus"), a
  final one at the end.
- **Timing** (`guideToneTimeline.ts`), in the chart's metre:
  - Rows in the same bar split it.
  - A chord lasts until the next change.
  - The last row runs to the end of the form: as long as the section it repeats, rounded up to whole 4-bar phrases.
- `ChangesSheet.vue` / `ChangesSystem.vue` draw it with `utils/changesDrawing.ts` (slash noteheads without stems,
  repeat and final barlines, the time signature on the first line); chords, numerals and scales are HTML placed at
  the slashes, each wrapping within the room up to the next chord (a button while the bar editor is shown: tap to
  edit, §4). Eight lines a printed page (a 32-bar AABA), fewer
  with a guide tone line on (§6a).
- Chord names never run into each other (#145): `ChangesSystem` measures each name (with the marker or key area over
  it) against the line as drawn or as printed, whichever is tighter, and `fitBars` widens a bar its names crowd (a
  beat is its bar's width over its beats), the others sharing the rest evenly; bars stay even when nothing is
  crowded. Names that still don't fit shrink (to 60% at least); a line whose names would shrink below 80% breaks
  before the bar that doesn't fit (`breakLines`, until the chart changes), so on a phone a bar of four chords may get
  a line of its own.
- `Numerals` and `Scales` toggles and a **Line** segmented control (Off · Guide Tones · 7th Chords) with the mode's
  listbox beneath it, so the control stays where it was clicked (From 3rd · From 7th; or the ten arpeggio patterns) replace Intervals on this sheet (`csm-numerals`,
  `csm-scale-names`, both on; `csm-line` `off | guide | arpeggio`, off; `csm-guide-line` `third | seventh`;
  `csm-arpeggio`, `up-root`; share links carry the sheet's line as `line`, absent meaning off). Under the
  Pentatonic overlay the 7th Chords slot reads **Pentatonic** (see Pentatonic line), under the Hexatonic **Triad pair**
  (see Triad pair line).

### Guide tones on Changes ([spec](superpowers/specs/2026-10-10-guide-tone-lines-design.md), amended by [independent lines](superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md) and [the diverge note](superpowers/specs/2026-10-11-guide-lines-diverge-note.md); first built as [guide tones on Changes](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md))

- **What shows:** at most one line, chosen **Off**, **From 3rd** or **From 7th**. Line A starts on the first chord's
  3rd, line B on its 7th, and the line moves to the nearest guide tone of every chord after it. Each chord's slashes
  give way to one note, held for the chord's length and tied across barlines; a tie still open at a line's end
  continues as a half-tie on the next line. Both lines are always built, together, so the notes don't depend on which
  is shown; each moves on its own except where they meet (below), and they may cross or briefly share a tone.
- **Which tones** come from the chord quality (`TONES` in `engine/src/guideTones.ts`): the 3rd (a sus chord's 4th) and
  the 7th (a triad's root, a 6 chord's 6th).
- **The lines** (`engine/src/guideToneLines.ts`; `guideToneLine` returns one of the pair) move one chord at a time; only a
  run's starting octave looks ahead, as far as the next rest. The rules are numbered in the spec (rule 7, the lines
  taking different tones, is gone; G1–G3, D3 and P are the diverge note's). The candidates are both guide tones at every octave inside the
  part's written range, `rangeOf(part)`: its instrument's range from `INSTRUMENTS` (`{ lo, hi, centre }`, inside a
  ledger-line cap, `CAPS`: treble E3–F6 (three lines), bass B1–F4 (two); piano F3–E6 around B♭4, vibes F3–F6 (all of it), trumpet G3–G5, tuba C2–B♭3…), or,
  for a part without one (`CONCERT`), its clef's default (`RANGES`: treble C4–A5 around A4, bass E2–C4 around C♯3).
  A line takes the smaller move (a common tone before a step before a leap); equal moves go to the pitch nearer the
  centre, then the lower ([ranges](superpowers/specs/2026-10-10-guide-tone-ranges-design.md)).
  - **Placing a run (P):** a start, or a restart after a rest, tries each octave of the line's degree in range: the
    run is built from it, alone, up to the next rest, and the octave whose run averages nearest the centre is kept (a
    tie, compared exactly: the higher). So a line doesn't start at the centre and sink to the floor.
  - **Meeting (G1–G3, D3), the gentle diverge:** when the two lines land on one pitch, they part at the next new
    chord, and neither moves more than a tritone (6 semitones) because of the other. If the pitch is a guide tone of
    that chord (G1), the line that was below before they met keeps it (struck again) and the other goes to the chord's
    other guide tone: its nearest octave above if within a tritone, else its nearest either way if within a tritone,
    else (G3) it stays with the keeper. If not (G2), the line that was above takes the nearest guide tone strictly
    above, the other the nearest strictly below, each only within a tritone; a line with none moves as it would alone,
    and the lines may coincide again. Together since a restart, line A counts as the one below. Apart, each moves on
    its own; a held chord holds both, and the same chord in a new block counts as new.
  - **Holds:** a chord whose 3rd and 7th are spelled as the previous chord's, in the same block, holds the line:
    the same pitch, tied, labelled again. The same pitches in swapped roles (Dm7 → G7sus4) strike again. A hold never crosses a block (section) boundary or the start of a 2nd
    ending; there the chord strikes again, untied.
  - **Rests:** a chord with no guide tones rests and ends the run; the next chord restarts by rule 1.
  - **Form:** repeats and endings are voiced in written order, a 2nd ending from the 1st ending's last chord; the
    line doesn't loop, and nothing past a rest changes it.
- **Check:** `voiceLead` (the Viterbi pair search) is kept only as a comparison. `npm run guide-lines` measures the
  library (common tones, steps, leaps, where the lines share a pitch, how they part after meeting, each line's height, every move over a tritone) for each line; `npm run guide-lines -- --compare`
  sets each line against the pair search; `-- --check` confirms the library's labels.
- **Model:** `guideVoices` voices the drawn rows before `buildChanges` splits them into lines, so 2 or 4 bars a line
  give the same pitches and a folded copy is voiced once. `ChangesBar.voice` holds each bar's one voice of
  `GuideNote`s, and `ChangesChord.guide` the chord's label (empty for none). `GuideLine` is `'off' | 'third' | 'seventh'`.
  Accidentals follow the measure rule over the voice (`accidentalsInBar`), against the signature, or C without one.
- **Labels:** the degree without its accidental (`guideLabel`: `b3` → `3`, `bb7` → `7`), in one row under the staff; they print. They alternate as
  the line moves (3, then 7, through a ii–V–I).
- **Drawing** (`utils/changesDrawing.ts`; a line without a voice draws its slashes as before):
  - Two passes: every bar's notes are formatted first; then the stem tips are read, an ending's bracket is raised
    above the highest (level across the line), and the staves and voices are drawn.
  - One note a chord, a dotted half for 3 beats, with the model's accidentals, stems set automatically, one tie chain.
  - A second voice of `GhostNote`s keeps a position for every beat (`xs`), so chords, numerals and scales still sit
    over each chord's first note.
  - Line 1 gets the part's clef whenever a line is on; the key signature only with signatures on.
  - The aria-label adds `; guide tones: F4 3, F4 7, …` after `Bars: …`.

### 7th chord arpeggios on Changes ([spec](superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md))

- **Tones:** each chord's four chord tones from its base quality (`DEGREES` in `engine/src/arpeggios.ts`): altered 5ths
  kept, extensions dropped; a triad's three, its first tone again as the fourth.
- **Patterns** (ten): Up and Down from the root or the 1st, 2nd or 3rd inversion (Down reverses Up), Up & down
  (alternating per arpeggio across the run; after the run's first, a Down starts on the chord tone just below the last
  note and an Up on the one just above, never that note, so the line keeps going its way: #356), Voice-led (Up from the chord tone nearest the last note).
- **Note value, per bar:** the longest of ♩ ♪ 𝅘𝅥𝅯 giving the bar's shortest chord four notes or more (4/4: one chord ♩,
  two ♪, three or four 𝅘𝅥𝅯; 3/4 and 2/4: one ♪, more 𝅘𝅥𝅯). Timing is the guide tone timeline's, so a last chord holds
  through the empty bars after it.
- **Filling:** a chord's slots repeat its pattern from the start, again in each bar it lasts into; slots too few for
  another whole arpeggio turn back on the last one from its second-to-last note (6 eighths in 3/4: 1 3 5 7 5 3, #348),
  its own pitches, not counted as an arpeggio (Up & down). The Pentatonic and Triad Pair lines' 7th chord fallback
  does the same; their own cells don't.
- **Octave:** each arpeggio placed whole, its first note nearest the previous note among the octaves inside the part's
  range (`rangeOf`); a run's first nearest the centre. Before nearness (`placeWhole`, cells too): the octave with
  the fewest notes outside the comfort band (`comfortBand`: the range less a 4th below and a major 3rd above, vibes
  B♭3–C♯6, at least an octave), counted only when half the figure's notes or more are outside, so a line moving one
  way turns back instead of drifting to the range's edge.
- **Rests:** a chord without chord tones (N.C.) rests and ends the run.
- **Model:** `arpeggioVoices` fills `ChangesBar.voice` (guide labels stay empty); `buildChanges` and
  `changesLinesPerPage` take a `SheetLine` (`off`, `third`, `seventh` or a pattern id).
- **Drawing:** the guide tone line's two passes, the notes beamed by the beat (`Beam.generateBeams`, post-formatted before
  the stem tips are read for the crop and the ending's bracket); no label row; the aria-label adds
  `; 7th chords: C4 E4 G4 B4 | …` after `Bars: …`.

### Pentatonic line on Changes (#284)

- **What:** while Superimpose is Pentatonic, the Line's 7th Chords slot is **Pentatonic** (`lineModes`): each chord
  plays exactly the pentatonic its label shows (`ChangesChord.pentatonic`: basis, rung/side/path, Built on and chord
  picks), written for the part. Superimpose off → 7th Chords again; Hexatonic → Triad pair (below).
- **Cells** (`engine/src/pentatonicLine.ts`): the minor pentatonic less one note (`pentatonicCell`), the degree picked
  by **Leave out** (1, ♭3, 4, 5, ♭7 in the minor pentatonic's degrees, `PENTATONIC_LEAVES`; default 1: ♭3-4-5-♭7, the
  relative major's 1-2-3-5). Direction: the Arpeggios sheet's Up · Down · Up & down (`arpDir`; Up & down alternates per
  cell across the run). A run's first cell starts on its bottom (Up) or top (Down) note. Every later cell starts on
  its note nearest the last note played (never that note itself; a tie: the lower) and goes the way chosen if the
  whole cell fits the part's range, else the other way from that note (a turn at the range's wall, so a held
  pentatonic keeps turning instead of repeating). Only if neither fits: the in-range placement nearest the last note
  that differs from the last cell; with none, the arpeggio's range-first rule. Up & down keeps its alternation: the
  nearest placement that fits, the way its turn says.
- **Rhythm, octave, rests:** the arpeggio line's (`cellVoices`, shared with `arpeggioVoices`): ♩ ♪ 𝅘𝅥𝅯 by the bar's
  shortest chord. A chord with no pentatonic (no
  scale, no key area, unreadable) plays its 7th chord arpeggio in the stored pattern; one with no tones either rests.
- **Model:** `buildChanges` takes a `ChangesLineChoice`: a `SheetLine` or `{ kind: 'pentatonic', leave, dir,
  arpeggio }` (`changesLineOf` in `utils/sheetLine.ts` builds it); it works out each chord's pentatonic before the line
  (`pentatonicVoices` gets the written roots by row). No label row; the aria-label adds `; pentatonic: C4 D4 E4 G4 | …`.
- **Preferences:** the stored line is unchanged (`csm-line` `arpeggio`, `csm-arpeggio` its pattern): it reads as
  Pentatonic under the overlay and 7th Chords otherwise, no migration. `csm-pent-leave` (`1`); the direction is
  `csm-arp-dir`. The Line shows Direction (`aria-label="Pentatonic direction"`) in place of the pattern, and Leave out
  (`aria-label="Leave out"`, `Leave out: ♭3`) where the Superimpose shows (interface tier `pentatonics`). A share link
  with an arpeggio line on the Changes carries `arpDir` and `pentLeave` (an old link has none: the visitor's own); the
  overlay stays the receiver's own. Print: lines a page as for an arpeggio line.

### Triad pair line on Changes (#325)

- **What:** while Superimpose is Hexatonic, the Line's 7th Chords slot is **Triad pair** (`lineModes`): each chord
  plays exactly the pair its label shows (`ChangesChord.hexatonic`: Auto or its chord pick), written for the part.
- **Cells** (`engine/src/triadPairLine.ts`): three notes, the pair's lower triad then its upper in turn, each chord
  starting on its lower (`triadTones` spells each from its root). Direction, the run's first cell, the nearest-note
  start and the turn at the range's wall: the Pentatonic line's (`nextCell`). A cell the bar line cuts goes on into
  the chord's next bar (`Cells.carry`); one the chord's end cuts is dropped.
- **Rhythm, rests, model:** `cellVoices`, which steps by each cell's length; a chord with no pair plays its 7th chord
  arpeggio in the stored pattern. `ChangesLineChoice` adds `{ kind: 'triad-pair', dir, arpeggio }`; `buildChanges`
  works out each chord's pair before the line. Aria-label `; triad pair: G4 B4 D5 C5 | …`.
- **Preferences:** none new: the stored arpeggio line reads as Triad pair under the overlay; Direction
  (`aria-label="Triad pair direction"`) is `csm-arp-dir`, shared as `arpDir`; no Leave out. Print: lines a page as for
  an arpeggio line.

### Cells line on Changes (#298, flag `cells`, on)

- **What:** melodic cells in the 7th Chords slot's **Arpeggio pattern** listbox (no fourth Line mode: a fourth radio
  pushed the rail past two rows at 1440 px, so the spec's fallback applies). Choosing a cell sets `LineMode` `cells`
  (and the `cells` pref); choosing an arpeggio pattern sets `arpeggio`. The radio reads 7th Chords for both (`lineModes(overlay)`
  has three modes); picking that radio from another mode sets `arpeggio`, and the cell stays stored. A four-note cell on each
  chord, a cell per two beats (`engine/src/cells.ts`, after Randy Vincent's *Building Solo Lines From Cells*).
  `changesLineOf` gives `{ kind: 'cells', id }` only with the Superimpose off; under Pentatonic or Hexatonic the slot is
  the overlay line, whatever is stored.
- **UI:** with the flag on, the listbox (`aria-label="Arpeggio pattern"`) adds, after the patterns, the groups Cell systems
  (Root to root, 3rd to 3rd, 3rd to 5th, 3rd to root: cells A and B in turn) and Cells (ten single cells, every slot the same).
  `CONTROL_TIERS.cells` is `intermediate`. The rail keeps two rows with a cell chosen (`editor.spec.ts`).
- **Preferences:** `csm-line` also takes `cells`; `csm-cells` is a `CellId` (`3rd-3rd`). Share links carry
  `line: 'cells:<id>'` (dropped if the id is unknown). A stored `cells` mode with the flag off reads as Off.
  Aria-label `; cells: C5 D5 E♭5 G5 | …`; the report's `guides` reads `cells: <label>`.

### Approaches on the guide tone line (#298, flag `approaches`, on)

- **What:** under Guide Tones, a figure of eighths leads into each chord's guide tone from the end of the chord before
  (`engine/src/approaches.ts` the figures, `guideVoices` places them; `buildChanges(..., approach)`). The target keeps its
  beat 1; the chord before gives up the figure's beats, and a held target's tie is broken. None for the first chord, after a
  rest, across a gap, or where the chord before would keep under an eighth. Diatonic steps follow the scale the sheet shows
  over the chord before; consecutive equal notes collapse (delayed into F over C is G E), across the join too: a figure's
  first note that is the chord before's guide tone is left to it (Dm7 G7 CMaj7 from the 3rd, chromatic above: G7 holds
  its F, no figure into E). No figure where any of its notes is outside the part's range. A chromatic note is never
  B♯/E♯/C♭/F♭ (into B♭ above: B).
- **UI:** a second listbox (`aria-label="Approach"`) in the Line group under the Guide tone line listbox, shown only with
  Guide Tones chosen, the flag on and `CONTROL_TIERS.approaches` (`intermediate`). It sits inside the Line group, `w-0
  min-w-full` (`w-full` let the longest figure name widen the group, to 327px), so a long name truncates and its tooltip
  is the whole name; never a rail group of its own: the rail stays at two rows on CI's wider fonts (`editor.spec.ts`
  measures the Line group with Line Off, then with Guide Tones and the enclosure).
- **Preferences:** `csm-approach` is an `Approach` (`none`); with the flag off a stored one reads as None and stays stored.
  Share links carry `approach` (only with a guide line, absent: None; dropped if unknown). Away from None it raises the
  hidden-settings notice below Intermediate (`setAway`, `approaches`).

### Pentatonics on Changes ([spec](superpowers/specs/2026-10-13-pentatonic-ladders-design.md))

- **Ladder** (`engine/src/pentatonics.ts`): a key area's 12 minor pentatonics round the circle of fifths from home
  (its tonic minor: Am in C major), ranked by notes shared with the key's Aeolian: rung 0–6 share 5 5 4 3 2 1 0.
  Spelled by walking fifths (♯ side sharps, ♭ side flats; rung 6 the ♭ walk's), then `simplifyRoot(…, 'aeolian')`.
- **Model:** `buildChanges(…, pentatonic)` gives each chord its area's `pentatonic` ({ label, key, ladder }, written for
  the part); `showPentatonics` (after `breakLines`) blanks the label except on a line's first *labelled* chord and
  wherever it differs from the last one shown (relative keys share a home, so print once). `changesLinesPerPage`
  counts the row: with no guide line 8 a page, 7 with numerals, scales and pentatonics all shown; with a line 7 with no
  row, 6 with any row, 5 with all three (the 5 and 7 measured on Stardust, tuba, From 7th).
- **UI:** the Superimpose listbox in Analysis (it stays while editing): Off | Pentatonic | Hexatonic
  (`utils/overlay.ts`). Under Pentatonic, Rung (`Home · 5 shared`
  … `6 · 0 shared (Outside)`) and Side (♭ | ♯, hidden at 0 and 6); Hexatonic adds no control and puts each chord's Auto
  pair (`G/Am`) in the row's place, blank where its scale has none (`showHexatonics`). `csm-overlay` (an old
  `csm-pentatonics: on` with none reads Pentatonic), `csm-pent-rung`, `csm-pent-side`, not in share links. Each
  pentatonic label is a `PentatonicLadder` popover: the area's ladder, a pick covers that label's run (see Chord picks).
- **Paths** (#264, #276, [spec](superpowers/specs/2026-10-13-pentatonic-paths-design.md), [steps](superpowers/specs/2026-10-14-pentatonic-path-steps-design.md)): Path listbox: One rung (Rung + Side, as before), Side-slip, Fifths, Minor thirds, Major thirds. A preset cycles from Home one step a unit (`pentatonicCycle`): Step by Section (each form section), Key area (each run of one key area; a revisit takes the next step) or Bars (every 2, 4 or 8 bars of the form, through section breaks); outside the form, Home. `buildChanges` lays it over the units (`PentatonicPlan.path`/`step`) and names it in the Changes subtitle (`ChangesSheet.pentatonicCaption`). A pick in a label's ladder doesn't change the path (see Picks); a stored Custom still plays its sections. Per chart, with its step: `csm-pent-path:<slug>` (`usePentatonicPath`). Labels carry the shared count (`B♭m♪ 1`) off One rung.
- **Tint** (#265, #277): off One rung, labels take their rung's tint (`--color-rung-0…6`, Home slate → 6 rust; dark
  values on screen only), ordered by lightness (darker each rung on light paper, brighter on dark) so the ramp reads
  without hue. The shared count printed after each label (and in its accessible name) is the non-colour cue, so there
  is no rung-number setting. The contour band #265 drew under the row was removed (#277); triad pairs (#262) follow.
- **Ranked against** (#272, [spec](superpowers/specs/2026-10-14-pentatonic-per-chord-design.md)): Key (the area's
  ladder, as above) or Chord (each chord ranks the 12 against its own scale, `pentatonicRanking`, and plays the one
  **Built on** the sheet's degree, Auto or 1 … 7 as on the Scales sheet (#286; `PentatonicPlan.degree`,
  `ChangesPentatonic.degree`, null on the key basis); its popover lists the ranking, each row the degree it's built on
  and its shared count; counts and tints by shared count, `level`). Preferences `csm-pent-basis`, `csm-pent-degree`
  (`auto` or 0–11; the old `csm-pent-rank` is ignored, so it reads as Auto).
- **Picks** (#272, now chord picks, below): a label's popover pick covers its `run` (that chord and those its label
  stands for). Picks no longer clear on a change of Path, Rung, Side, Step, Built on or basis; a pick doesn't make the
  path Custom (a stored Custom still plays). An edit carries picks with their chords (#275): `carryPicks` lines up the
  chords drawn before and after (`drawnChords`, the longest common run of chord texts), so a bar put in or taken out
  moves a pick to its chord's new key; a pick on a chord removed or written over goes (undoing the edit brings it back: #315).

### Chord picks ([spec](superpowers/specs/2026-10-15-chord-picks-design.md), #303)

- **What it does:** a player overrides the sheet's choice for one chord: the pentatonic or the triad pair. Click a
  chord's pentatonic or hexatonic label (Changes, under Superimpose) or a staff's caption (Scales, under the Pentatonic
  or Hexatonic preset), and a popover lists that chord's choices from inside to outside.
- **Positions:** a pick belongs to one drawn chord, `ChordAt` (`${section}:${bar}:${k}`), per kind (`pentatonic`
  `{ pc, for? }`, the concert root; `hexatonic` `{ roots: [lower, upper], for? }`, both triads' concert roots, chain
  order). `chordPositions(doc)` maps each expanded row to its position, from the same keys as `drawnChords`: a folded
  repeat (`A1 · A2`) has none of its own (Changes draws it once, as its source); ending bars and written-out copies
  (`A3 (= A1)`) have theirs. A Scales staff covers every position its rows have (`ScaleLine.rows`,
  `linePositions`); a staff with none has a plain caption.
- **`for` matching:** a pick records `for: "<chord>|<scale>"` (concert chord text and resolved scale, `pickTarget`).
  A pick whose position no longer plays that chord and scale (the chord rewritten, or the scale level changed its
  scale) is ignored, and comes back if the level does; it is dropped the next time a pick is written (`withPick`,
  `withoutPicks` run `livePicks` first), never by a watcher. A legacy #272 pick (a bare number) has no `for` and
  applies as before; `chordPicksFrom` reads it (storage only) and drops damaged entries (`__proto__`, bad pcs, equal
  roots, a long `for`, more than `LIMITS.maxExpandedRows` per kind).
- **One set for both sheets:** `useChordPicks` keeps them in `csm-pent-picks:<slug>` as `{ pentatonic, hexatonic }`
  (a legacy object of numbers reads as pentatonic picks; with no chart key, a shared chart, they last for the visit).
  `buildChanges` (`PentatonicPlan.picks`, `OverlayPlan.picks`) and `buildSheet` (`SheetPicks = { picks, at }`) match
  against the same resolved scales, so a pick made on one sheet plays on the other; Practice's boxes seed from it too.
- **The Scales tie-break and `varies`:** a staff plays its first position's pick. Where its positions' picks differ (a
  pick and none differ), `StaffModel.varies` adds ` · varies` to the caption (`Dm pent · 5 shared · varies`,
  `E♭+/F hex · varies`), and the footer says the pick replaces them.
- **The popover** (`ChordPickPopover`; the Key basis keeps `PentatonicLadder`, its ladder rows under the same header
  and footer, with the ladder's title as a sub-line): the header is the chord and its scale, written for the part,
  and its bars (`D♭7 Mixolydian · bars 6, 22`, `bar 6` for one; a chord with no scale shows the chord alone), and
  names the dialog. The first row, **Sheet's choice (Dm)**, clears the pick; then the choices from
  `pentatonicChoices` (`A♭m pent · on 5 · 5 shared`) or `hexatonicChoices` (`G/Am · covers 4`), inside to outside, the
  current one marked. Footers: Changes `Sets bar 6.` / `Sets bars 6 and 7.`; Scales `Sets bars 6 and 22 on the
  Changes sheet too.`, or under `varies` `Replaces the different picks in bars 6 and 22.`. Every `pick` event carries
  concert values; a transposing part sees written names. A trigger's accessible name says the label in words
  (`Pentatonic: D minor, built on 1, 5 of 5 notes in D Dorian, your pick. Show the choices`). In print the trigger is
  plain text and the popover never shows; Scales captions stay one line (tracking tightened in print, so
  `F♯m pent · 4 shared · varies` fits 8.5rem), 12 staves a page.
- **What survives, what clears:** picks survive Built on, Path, Rung, Side, Step and Ranked against, and either basis
  plays them. Only the popover's **Sheet's choice**, ⋯ More actions → **Reset chord picks** (`reset-picks`, listed
  while there are live picks) and the hidden-settings notice's Reset clear them. A change of the chart's key still
  clears them all (a legacy pick has no `for` to catch it). An edit carries them (`carryChordPicks`, keeping `for`).
  They are never written into chart rows or the saved analysis.
- **Share links:** `view.picks` (a `ChordPicks`), only when there are live picks; opened for the visit, never stored.
  Where picks would make a link too big to open, `encodeShare` leaves them out. Old links open with none.
- **Tier:** the popovers are at Everything (`CONTROL_TIERS` `chord-picks`); picks in force at a lower level are named
  by the notice (`HiddenSetting` `chord-picks`).

### Documentation ([spec](superpowers/specs/2026-10-17-user-docs-restructure-design.md), Phases 1–2)

- **Decision registry:** `DECISIONS` (`engine/src/decisions.ts`) names every heuristic the app applies when it chooses
  something for the user (`guide.move`, `pent.auto`, `spell.transpose`, …), each with its page and anchor. The analysis
  rules keep their own ids and rows (`rule-M3` → `/functions#rule-M3`). `decisionHref` / `decisionOf` give the link;
  `<DecisionLink id="…">` renders it with the summary as its title. Every entry's anchor is its own id on
  `/how-it-decides`. Adding a heuristic adds a row and a section.
- **How it decides** (`pages/how-it-decides.vue`): the disclaimer, then seven groups (Scales, Keys, Guide tone lines,
  The other lines, Superimposing, Spelling, Ranges; the `PageIndex` lists these), each holding a `<DecisionSection
  id="…">` per decision, its heading the registry's title and its element `data-decision`. Each section: what it
  decides, the rule, an example, what you can change. The examples that can drift come from the engine at render
  (`scaleAtLevel` for G7 and D7 at each level, `pentatonicChoices` / `hexatonicChoices` over Cmaj7, the ranges from
  `INSTRUMENTS`). A flag-gated section keeps its heading and anchor with the flag off. Help is the how-to: its
  controls are grouped by task, each group ending with its link here, and `#guide-lines` stays as a stub pointing
  here so old links hold. In the navigation beside Help, and in the sitemap.
- **Release notes** (`pages/release-notes.vue`, spec §12): `RELEASE_NOTES` (`utils/releaseNotes.ts`), newest first,
  a date (`YYYY-MM-DD`, its section's id, written out as 18 October 2026) and one line per change with its PR number,
  linked to its pull request; the index by month. In the footer and linked from Help's Odds and ends, not the top
  navigation.
- **Checks:** `web/test/docs/decisions.test.ts` mounts each page and finds each decision's anchor once, and warns of
  a section on How it decides the registry doesn't name (in `make test`); `npm run check:links` walks `.output/public` after the build and fails on an internal link whose page or
  `#fragment` is missing (CI's `engine` job); `make docs` runs both, and the pre-push hook runs it when a push touches
  the docs pages, `decisions.ts` or `rules.ts`.
- **Docs gate:** `.github/workflows/docs.yml` (its own workflow, so editing the PR description re-runs only it): a PR
  touching `engine/src/` (not its tests), `chord_scales.json`, `web/app/components/`, `composables/` or
  `pages/song/` must touch a docs page (`help`, `how-it-decides`, `functions`, `chart-format`, `glossary`) or
  `decisions.ts`, or carry `Docs: none — <reason>` (or `--`) on a line of its description, outside a comment; and
  must add a release note (`releaseNotes.ts`) or carry `Release notes: none — <reason>`. The docs files themselves
  (`decisions.ts`) don't count as user-facing.
  Dependabot is skipped. The PR template offers both lines.

### Shared

- **Loading VexFlow:** it loads client-only, by dynamic import of `vexflow/bravura` on the editor page only. It's
  bundled, not taken from a CDN, so the CSP stays `script-src 'self'`.
  - Its Bravura font is embedded as a `data:` URL, so the CSP needs `font-src 'self' data:`.
  - Drawing waits for `document.fonts.load`.
- **Colour:** the SVG uses `currentColor`, so it follows light and dark mode and prints black.
- **Drawing space:** a scale staff is drawn 1200 units wide; the Changes sheet uses 300 units a bar.
- **Cropping:** each SVG's viewBox is cropped to its notes' vertical range by `cropBand`. The range comes from
  VexFlow's note-head positions plus room for accidentals; SVG `getBBox` can't be used, because it measures glyphs
  by font ascent, not ink.
  - A minimum band keeps ordinary staves aligned.
  - Changes lines of slashes keep fixed bands (`BAND`, `CLEF_BAND`, `VOLTA_BAND`); a line with guide tones crops to
    its noteheads and stem tips, never inside `CLEF_BAND`, and takes in a raised ending bracket.
- **Clefs and key signatures:** the clef and the chart's key as written for the instrument
  (`keySignature` in `engine/src/keySignature.ts`; a minor key by its relative major, none without a `key:`), once at the
  start, as on a jazz lead sheet, on the Changes: its first line has them, every other line neither. The Scales,
  Arpeggios and Patterns sheets (`StaffModel.showClefAndKey`) start every line with them, since each line is read on
  its own; a Patterns line whose run continues onto further staves has them on its first staff only (#446). The first Changes line always gets the clef, even
  without a `key:`. The key is the chart's `key:` (`chartKeyOf`) throughout: key
  changes go by accidentals only, and show in the analysis (the Changes sheet's key-area labels), never as a new
  signature. Notes follow the measure rule (`accidentalsInBar`): an accidental shows only where it differs from what
  is in force in the bar (guide tones: the voice, against C without a signature). The first Changes line
  uses a taller crop band (`CLEF_BAND`).
- **Shared helpers:** `svgContext`, `fitSvg` and `headCentre` in `utils/vexflow.ts`.
- **Instrument choice:** 15 presets, grouped by what they read (C treble, B♭, E♭, F, bass clef). The
  choice sets the `Part` (clef + transposition) for the whole preview, so notes, chord symbols and scale names
  are all written for that instrument. The chart stays in concert pitch. Piano is the default (#332 retired the
  "Concert" choice: a stored or linked `concert` reads as `piano`); the subtitle names the instrument on every sheet.

## 6. Styling

The interface system (surfaces, depth, radius, button roles, type, spacing and the component recipes: the sheet's
paper and its focus-mode pages, the rail, the More menu, the header, the library, the On this page index) is in
`.interface-design/system.md` (from #200); this section covers the tooling and history.

- **Tailwind CSS v4** through `@tailwindcss/vite` in `nuxt.config.ts`. Styles are utility classes on
  components. A single `app/assets/css/main.css` holds `@import "tailwindcss"`, the theme tokens and the print
  rules.
- **Palette: Duotone Blue**, Blue Note-inspired (chosen from three mocked directions).
  - **Neutrals:** `zinc` is retuned in `main.css` to cool, navy-tinted greys (paper `#F3F6FB` to night `#08111F`).
    Catalyst's `zinc-*` class strings therefore stay verbatim and recolour together.
  - **Accent:** a `note` blue scale. `note-800` navy is the one primary button of a view (`<UiButton color="note">`)
    and the header's band (the sleeve); the accent (`note-600`, dark `note-300`) marks the selected state, focus
    and links.
  - **Dark mode:** a brighter `note-600` for buttons, and `note-300` for selected toggles, links and the brand.
  - **Contrast** (AA): white on `note-500` is 4.7:1, `note-600` text on paper 5.9:1, `zinc-500` text on white 5.0:1.
- **Headings:** Jost, a geometric typeface in the style of Futura (`font-display`). It's bundled from
  `@fontsource-variable/jost` (OFL), so the CSP's `font-src 'self'` covers it. Body text stays the system font.
- **Print** stays black on white. Its few grey labels use `neutral`, not the tinted `zinc`.
- **Components:** Tailwind Plus Catalyst, ported to Vue in `components/ui/` on `@headlessui/vue` and
  `@heroicons/vue`.
  - Catalyst's class strings are kept verbatim. The `v-interactive` directive (`utils/interactive.ts`) sets the
    `data-hover`, `data-focus` and `data-active` attributes they rely on, which Headless UI Vue doesn't emit.
  - Field, Label and Description wire ids through provide/inject (`utils/field.ts`).
  - The licensed kits live git-ignored in `design/tailwind-plus/` and are never committed.
  - A dev-only `/ui` page shows every component; it's removed from the production build.
- **Header quote:** a random quote in the navbar on tablet and desktop widths, kept for the visit
  (`HeaderQuote`, `useQuote`).
  - It shows the whole quote (two lines at most) and its author under it, inside the header's fixed 64 px.
  - `build/quotes.ts` reduces `data/quotes.json` at build time to `cited` entries with those two fields. The
    file marks the rest "unverified".
  - The list is served as the separate `virtual:quotes` chunk, about 20 KB gzipped, fetched after mount. So the
    prerendered HTML is the same for everyone.
- **App components** compose the Catalyst ones:
  - `SheetPages`, which lays out a sheet's printed pages. On screen they form one paper, the header shown once (its
    title the page's `h1`); in focus mode each page is its own paper, fitted to the window; in print each page is a
    bare letter page with its own header.
  - `PreviewControls` in `SheetRail`, the control rail: Work on (Changes, Scales, Arpeggios), Instrument, Level, the
    sheet's own controls (on the Changes, Analysis: Numerals and Scales, and Line: Off · Guide Tones · 7th Chords;
    on the Scales, Intervals and Spell Scale), Transposition; at right Edit, Share, Focus, Print and More
    (`MoreMenu`). On a phone the rail is compact: the rest sit in the Controls dialog.
- **Dark mode** is a `.dark` class on `<html>`, toggled in the navbar.
  - The default is light, and the choice is saved per browser.
  - `public/theme-init.js` applies it before first paint. It's a file, not an inline script, so the CSP needs no
    `unsafe-inline` for scripts.
  - Print is always light.
- **CSS delivery:** Tailwind generates its CSS at build time and serves it as a static file, so the CSP stays the
  same.

## 6a. Print / PDF

- **Page:** `@page { size: letter; margin: 0.5in 10mm 10mm }`. The print stylesheet hides the editor and the
  toolbar, and each page of `SheetPages` breaks after itself with its own header. On screen the pages run
  together as one card, with "Page N" dividers marking the breaks.
- **Scale sheets:** 12 staves a page, with 8px between staves. A full page fills
  about 9.6in, even when every note has ledger lines (e.g. trombone from B). Autumn Leaves prints on 2 pages.
- **Changes:** 8 four-bar lines a page with guide tones off, so a 32-bar AABA prints on one page.
  - With a line on, `changesLinesPerPage` (`engine/src/changes.ts`) gives fewer: 6 with a line on and
    numerals and scales, one more with both rows off; an arpeggio or Pentatonic line the same. `print.spec.ts` prints the tallest
    case (one line, numerals, scales, an ending and a bass part, guide tones or 7th chords) a sheet page to a letter page.
  - The chord row and spacing are shorter in print; lines with a clef or guide tones close up (`print:space-y-0`).
  - Print always uses 4 bars a line.
  - Lines never split across pages.
- **Saving a PDF:** users choose "Save as PDF" in the browser's print dialog. There is no server-side PDF.

## 7. Library

- **Loading:** `import.meta.glob('#charts/*.txt', { query: '?raw', eager: true })` (`#charts` is the engine package's
  `charts/`) in
  `app/utils/library.ts` gives `{ slug, title, subtitle, composer, text }[]` at build time, skipping sync-tool
  copies (`giant-steps 2.txt`, `isSyncCopy`). The same parser runs, and a test fails the build if any library
  chart has errors. Search matches the title or the composer.
- **Heading:** `chartHeading` (engine/src/chart.ts) gives what the library, the editor and every sheet show: the title,
  a line built from the subtitle (or, without one, `style:`), `key:` (`E♭ minor`) and `form:`, and the composer
  (right-aligned under the heading on a sheet's first page, as on a lead sheet). `chartMeta` stays the title and
  subtitle as written, which the heading fields edit.
- **Contents:** 241 charts.
  - Autumn Leaves, Blue Bossa, Stella by Starlight, All the Things You Are, Lady Bird.
  - F and B♭ blues, jazz blues and Bird blues.
  - 222 tunes transcribed (chords only; `composer:`, `style:`, `key:`, `form:`, `source:` from its index) from the
    Colorado Cookbook, a lead-sheet collection kept out of the repo in `design/leadsheets/`. Their scale cells are
    blank: they play the analysis (§7a).
  - Rhythm changes.
  - Modal tunes: So What, Impressions, Milestones, Maiden Voyage, Footprints.
  - Modes of the major scale and of melodic minor.
- **Search:** a case- and accent-insensitive substring filter on the title, client-side.
- **Home page** (`/`, issue #243): one large search (`TuneSearch`, a Headless UI combobox). As you type, the top 6
  matches (`suggestTunes`: title starts, then a title word's start, then other matches, then composers), each with
  its key written for this browser's instrument (`csm-instrument`, shared with the song page; `writtenKey` in the
  engine) and the concert key under it; "See all N in the library" when there are more (`/library?q=…`). Enter
  opens the first. Under it, Recently opened (`csm-recent`, `utils/recentCharts.ts`: the song page records each
  library tune or My chart it opens, at most 5). The library moved to `/library`; old `/#letter-X` links follow it.
- **Opening a chart** copies it into the editor's state; library files are never changed.
- **Requests:** "Request a chart" opens the contact form, where a photo or PDF of the changes can be attached.

## 7a. Harmonic analysis

The rule set in [plan-analysis.md](plan-analysis.md), built as `engine/src/analysis/` (pure TypeScript) and the
script `engine/scripts/analyse.ts`. The site runs it on every revision of the chart: a blank scale cell plays its
choice (`resolveScales`, below), and the Changes sheet's numerals and notes read it. The script reports, and saves
its reasons into a chart as comments.

- **Passes:** `stream.ts` (chords as heard, slash readings applied, with durations; the form wraps), `keys.ts`
  (cadences, the global key from `key:` or by score, key areas, the modal and blues contexts), `rules.ts` (each
  chord's function in its local key and its scale, by family, with the rule's id and a reason). Dominants derive
  their tensions from the key's reference scale under the symbol's pins; the other families read the scale off the
  function.
- **`analyse(doc)`** reports; **`applyAnalysis(doc, analysis, { scales: 'strip' | 'none', save, date })`** returns
  `{ doc, changes, conflicts, overrides }`. `strip` blanks a written scale the rules reproduce at Standard, only when
  every occurrence of the line (`copy:` repeats too) has that scale, and never a `# keep:` row; every other written
  scale that differs lands in `overrides`. `save` writes the reason as each row's trailing comment, `# area:` lines
  where the key area changes, and an `# analysis: <date>, rules v<N>; <key>` header (kept as it was when nothing
  else changed, so a rerun is a no-op). There is no fill: a blank cell already plays the analysis.
- **The CLI** (in `engine/`): `npm run analyse -- charts/<tune>.txt` (or `--all`) prints a report per row: ✓ agrees with the
  chart, ≠ differs, blank, ? unreached. `--strip` and `--save` as above (`--strip` prints the overrides under "left
  as written, without # keep:"); `--quiet` gives the summary and the disagreements only; `--ambiguous` below.
- **The library:** chords, functions, `@key`s and the true overrides; the scales the rules give were stripped
  (`--all --strip --save`). Each written scale left is a `# keep:` with its reason: Milestones' Aeolian bridge (the
  melody says so), Stardust's intro B♭7 (V7/ii in D♭ like the chorus), three rows of the melodic-minor modes chart,
  the Coltrane-cycle tonic B Ionian in Baby Steps. The golden fixture (`playedRows`: `resolveScales` at Standard)
  keeps the per-row record, so after a rule change `make golden` and its diff is the review; the library follows
  the rules by itself.
- **Stated functions:** a row's function cell is taken as given. Virtual targets: `V7/V` is read as a dominant
  of the key's V even when no V follows. An `@key` line makes a span of key areas from its bar to the next
  `@key`, overriding the detected ones. A key prefix (`D: V7/ii`) decides that one row only. A function that does
  not fit the chord in its key, or an `@key` naming no key, is a problem (reported; the inspector shows it
  under the function). Rules that could only guess carry a `fallback` flag, and `--ambiguous` lists those rows with
  the functions each might have and the key areas an `@key` would pin, each with a second `@key` back to the next
  area (an `@key` holds until the next); the bar editor's Key change here (`insertKeyChange`) adds the same pair. The
  analyser never writes a function, an `@key` or a `context:`. The report's second line says which context
  decided and why (`context: modal (stated)`, `context: modal (detected: 0 of 8 chords in cadences, median chord 2
  bars)`); `--ambiguous` also names a detection within one chord of a threshold. `rowNotes` (`engine/src/notes.ts`) gives each row's reason, key,
  the scale played and its `source`; it says "analyser: X (reason); you chose Y" only of a written scale that differs;
  the inspector's Why and the Changes sheet's numeral/scale notes show it, the note with where its key
  came from (a key the author set is starred).
- **The scale played** (`engine/src/resolve.ts`, [proposed scales spec](superpowers/specs/2026-10-11-proposed-scales-design.md)
  §2): `resolveScales(doc, view, analysis?)` gives each expanded row (keyed by its
  index in `expandRowLines`, so a `copy:` repeat resolves on its own row) a `Resolved` scale and its `source`:
  `written` (the cell, at every level) > `function` (a stated function's scale) > `rules` > `default` (the quality's,
  where the analysis doesn't reach the row); null for a chord that can't be read. An analysed scale is moved to the
  view's level as the Level control moves one (`scaleAtLevel` on it, Aeolian for a tonic minor at Basic, Random by
  `line:chord`). The level is the view's, never the chart's.
  `buildSheet` takes the map (without it, each row's own scale or its quality's default), `buildChanges` and
  `rowNotes` the view (Standard by default; sharing their one `analyse`); the guide tones read the cell or the
  quality's default, untouched. `qualityScale(row)` (once
  `resolveScale`) is the one-row lookup for places with no document.
- **Numerals** (`analysis/numerals.ts`; the degree itself in `analysis/degrees.ts`, shared with the rules and the
  grammar): lower case for the minor family (`ii7`, `V7/ii`, `viiø7`), as Terefenko writes them. A dominant into the
  local key's own V7 prints `V7/V`, and the links before it in a chain of three or more print `→` (a display mark, not
  a function); a chain that never reaches the key's V7, or one a sus breaks (`A7 D7sus4 G7`), keeps each chord's own
  degree. A related ii that is diatonic to a major key area prints its degree (`iii7`, `vi7`, `viiø7`; the report
  adds "also iii of C"). An ascending `vii°7 of X` prints sharp-side (`♯i°7`), a descending or auxiliary one
  flat-side. A sus prints `V7sus4`. The labels and their sources: [function labels spec](superpowers/specs/2026-10-10-function-labels-design.md).
- **The function grammar** (`analysis/functions.ts`, `parseFunction`): the sheet's numerals read back, lenient on
  input and canonical on output: glyph or ASCII accidentals; `-`/`–` for minor (`II-7`, `I-(maj7)`);
  `-7(♭5)`, `m7(b5)`, `Ø7` for ø7; `7(sus4)`, `sus4`; `Sub`/`sub` with or without the 7 (`SubV/III` reads
  `subV7/III`); `Δ` or `∆` (U+0394, U+2206) for maj7; a glyph flat in the key prefix (`B♭: V7/ii`). A function in
  parentheses, `(V7/ii)`, is deceptive (`StatedFunction.deceptive`): its resolution doesn't come, its scale is still
  the expected target's (the target and the scale ignore the flag, and the fit doesn't ask for the resolution), and
  the sheet prints the parentheses. A target keeps the case written: upper case is a major chord, lower case a
  minor one, as the sheet prints them (`(V7/II)` stays `(V7/II)`; reading an upper-case target's quality from the key,
  G6 in the function labels spec, is deferred). Every numeral the analyser gives the library reads back to itself, and in
  parentheses to itself in parentheses (`functions.test.ts`). `chord_scales.json` lists `∆` wherever it lists `Δ`.
- **The reason note** (`ChangesNote.vue`): a click-to-open Headless UI popover (role dialog, "Why: <chord>", the chord as
  drawn for the part: `ChangesChord.written`), not
  a hover tooltip; Escape or a click outside closes it, and a clamp keeps the panel 16px inside the viewport. It
  gives the reason and key, and the rule's id linked to `/functions#rule-<id>`. A `fallback` the author didn't state
  reads "a guess — an @key or a function would settle it". Report issue (`utils/issueReport.ts`) puts the
  chord, its bar and section (the same chord can be analysed differently in another bar), function, scale, rule,
  reason and key on the clipboard and navigates nowhere. A library chart as published is named by its slug and gets no
  share link; an edited, new or shared chart carries one. On a transposing part it names
  the instrument (`Instrument: B♭ Trumpet`), gives the chord as drawn with its concert symbol (`A7 (concert G7)`),
  labels the key area and scale "written for" the part and the rule's reason "in concert pitch"; a concert-pitch part
  gets none of that. The report and any share link are made as the note opens, so the click writes to the clipboard
  at once (Safari allows it only within the click); clicked before the link is ready, or with no link to be had, it
  shows the text to copy by hand. It then offers both "Send it
  with the contact form" (the text passed through sessionStorage `csm-issue-text`) first and "Open a GitHub issue"
  second (a link; the text goes in its URL up to 8000 characters, then the title only). `analyse()` keeps `fallback` on stated
  rows. Rule ids carry no primes (`m7'` became `m9`, `D3'` became `D8`).
- **The functions page** (`/functions`, `pages/functions.vue`; prerendered in C major): the reference for what
  `analyse` does. Sections `#writing` (the function syntax, its errors taken from `FUNCTION_ERRORS` and
  `parseFunction`, never paraphrased), `#table` (every function in `FUNCTION_GROUPS` (`group-diatonic`,
  `group-secondary`, `group-substitutes`, `group-chromatic`) with the chord, scale, rule and reason the engine
  gives), `#rules` (every rule in `RULES`, by `TIERS`, one row `rule-<id>` each; `ruleParts` and
  `dominantScaleTable` in `analysis/rules.ts`) and `#report` (the Report issue route). Nothing on it is
  hand-typed: `functionsTable(key)` (`analysis/catalogue.ts`) runs one-row charts (`bars: 1`; `bars: 2` with a tonic row first for the chromatic diminished function) through
  `analyse`, in the page's key (`FUNCTIONS_KEYS`, `utils/functionsKey.ts`: the Transpose majors, then the twelve minors
  as their signatures spell them, C♯ and G♯ minor rather than D♭ and G♭ minor, whose tables need double flats; all
  within the wider `CATALOGUE_KEYS` the engine tests sweep), at prerender and again
  on a key change. The chosen key is kept in the URL as `?key=` in step with the router's history state, and
  remembered as `csm-functions-key`. A sticky group nav follows the scroll (an IntersectionObserver). Rules that
  only read the chord symbol are covered in tests by chord-symbol examples. Linked from the footer ("Functions"),
  Help, the editor and the grid ("How to write a function"). Prose glyphs (♭ ♯) go through `proseGlyphs`
  (`pitch.ts`).
- **The rules on one page** (the second pass, "analysis rules from sources", checked against Nettles and Graf,
  Mulholland and Hojnacki, Levine and Chediak; [spec](superpowers/specs/2026-10-10-analysis-rules-from-sources-design.md),
  decisions in plan-analysis.md §10, 11–17):
  - **Dominant:** a blues I7, IV7 and (in a major key, outside a ii–V) V7 are Mixolydian, decided by their degree (D9,
    before D3); a V7 into a minor chord is Phrygian Dominant, Altered at Advanced.
  - **Major:** a IV reached by its own dominant (V7/IV, or subV7/IV) is Ionian, otherwise Lydian; ♭VII of a minor key
    is Ionian. The rule reads the previous chord and wraps the form, so a bar-1 IV is prepared by the last chord.
  - **Minor:** iii7 is Phrygian (also as a related ii), Dorian at Advanced; the tonic m6 of a minor key is Melodic
    Minor, any other m6 Dorian. A ø7 is Locrian, in a modal chart too (h1 is gone); ♮2 is its Advanced rung.
  - **Reasons:** they say "the key's own notes" and name the passing note rather than call an avoid note "in the
    key". A chart comment is at most 120 characters (`LIMITS.maxMeta`): `fitComment` drops a reason's "(X its ii)"
    aside, then cuts with "…".
  - **The °7 scale family** (`SCALES`, `engine/src/scales.ts`; the figures are M&H pp. 152–161): `Diatonic Diminished`
    (ascending: the V7♭9♯9♭13 of the chord it leads to, from the °7's root; alias `leading tone diminished`), and the
    function variants `… #IV` (♯IV°7 → I), `… bIII`, `… bVI`, `… I`, `… V`, with `optional` forms for ♯IV, ♭III and I
    (in the menu only). A °7 a half step below the next chord's **root or bass** ascends to it (R16; ♯IV°7 → I is
    tested first). At Standard a °7 takes its function's scale; any other °7 keeps Whole-Half, with the reason "not
    functioning diatonically: the symmetric scale"; Whole-Half is the Basic and Advanced rung and Harmonic Minor a
    half step up stays in the menu. `dim7`'s quality default stays Whole-Half, and the Level control compares it by
    pitch, so a Whole-Half the analysis respelled (F♯ on G♭°7) is still the default. ♭III°7 follows M&H (fig. 7.22)
    where N&G p. 116 reaches it by enharmonic equivalence with ♯II°7; where no root spells a function's scale without
    double accidentals or B♯/E♯/C♭/F♭, the equivalent figure's lettering is used. The scale root is spelled per scale
    by `simplifyRoot`. One helper, `cleanLettering` (`scales.ts`), makes that choice for the analyser, for a
    transposed chart and for the `dim7` menu's diatonic diminished options. A few rows keep a single C♭ or F♭ for want
    of a clean root. A dim7's interval labels and practice presets are by semitone, not by degree.
  - **Libraries:** Wave follows the *Songbook Tom Jobim* in full; The Girl from Ipanema's bars 7–8 and bridge do;
    Solar opens on CmMaj7.
- **Menus:** every scale the rules give a quality is among that quality's options in `chord_scales.json`
  (Phrygian Dominant and Mixolydian ♭6 on `7`, Phrygian on minor chords, Mixolydian ♭6 on `7sus4`, the diatonic
  diminished family on `dim7`, lettered as the analysis letters them), so a scale you change can be changed back
  from the menu. A written scale is matched with the menu's entries by pitch (`samePitchScale`, R18): the same scale
  on an enharmonically equal root is that entry, so F♯ Whole-Half on G♭°7 selects the default, and its spelling is
  never changed by the match (the scale cell, a chord change's default following, and the Level control).

## 7b. Search and discoverability ([plan](superpowers/plans/2026-10-12-seo-discoverability.md))

- **Chart file names** match `[a-z0-9]+(-[a-z0-9]+)*.txt` (`web/test/library.test.ts`); the name is the address.
- **One URL per tune:** every library chart lives at `/song/<name>` (`pages/song/[[slug]].vue`; `<name>` is the chart's
  file name: lowercase, hyphens, which search engines read as word breaks). It is prerendered with the head, the
  JSON-LD and a fallback (`<h1>` title, composer, "Loading the practice sheets…") that the sheets replace once the
  script runs; there is no separate tune page. The library links each title to `songPath(slug)`. `/tunes/**` is
  a 301 to `/song/**` (`routeRules` in `nuxt.config.ts`), for old links and search results.
  - **Text:** `tuneSummary` (engine `tune.ts`) gives the heading fields (title, subtitle, composer, aka, kind, key, style, form);
    `tuneDescription` is the meta description, at most 160 characters, dropping clauses to fit but always saying
    "lead-sheet style" (and "Chords only, no melody" where it fits). `tuneTitle` (`utils/site.ts`) is the title:
    "Blue Trane (John Coltrane): Chord Changes and Lead Sheet Practice Charts"; the preview's is "Blue Trane (John
    Coltrane) · Chord Scale Maker", and robots is `index, follow, max-image-preview:large`. The head comes from
    `songHead` (`utils/songHead.ts`), with the text under the sheet: a "Chord changes (lead-sheet style)" heading
    and a sentence that the page gives the changes, not the melody (its other titles too), prerendered (#310).
  - **The gate:** `tuneGaps` lists what a library chart's song page lacks (`title:`, `key:`, `style:`, `form:`, and
    `composer:` unless `kind:` is `form` or `exercise`); `libraryMeta.test.ts` fails on any. `tuneAdvice` (no
    `source:`, no `aka:`) is only reported, by `npm run analyse`.
  - **Versions** (#411, docs/superpowers/specs/2026-10-18-tune-versions-design.md): `version: <label>` marks a
    second chart of a tune (file `<title>-<version>.txt`); a chart without one is the tune's main chart. `tuneGroups`
    (engine `versions.ts`) gathers charts by `tuneKey` of their title or `aka:`; `versionProblems` (two mains, a repeated
    label, a version titled unlike its main) fails `libraryMeta.test.ts`.
    The Library lists one row per tune (`TUNES`, `utils/library.ts`). A version's page is titled "Summertime (Jazz Mind
    Accelerator)" with its canonical on the main chart; it's prerendered but left out of the sitemap and IndexNow
    (`songSlugs`, `utils/sitemap.ts`), and its OG card carries the label. Scale pages list a tune once. The song page's
    version picker (`SongVersions.vue`, `versionChoices`) (flag `versions`, on) lists the library's charts ("Main"
    first), then a "Mine" group of your saved charts of the tune (`basedOn` one of its charts, or titled as its main),
    oldest first, by their `version:` or "My chart" ("(mine)" after a label the library has, numbered when several
    share one), re-read on each save (`savedRevision`); it shows on those charts' `?mine=` pages too. Your edits
    of a library chart are left out: that chart's own page shows them.
  - An unknown name (`findChart` in `utils/library.ts`) goes to the library.
- **Head tags** (`utils/site.ts`):
  - The tagline is `SITE_TAGLINE`, "Endless improvisation practice sheets for jazz standards"; it opens
    `SITE_DESCRIPTION` (the home page's and the fallback description), the manifest, the README and the two banners
    `scripts/icons.mjs` draws (`og-image.png`, the brand cover).
  - `PAGE_HEAD` holds each fixed page's title and description; `seoMeta` turns one into `useSeoMeta` input, the
    link preview's title carrying the site name as the browser's does (`pageTitle`; a title that leads with the site
    name, the home page's, stands alone), or its own `ogTitle`. Site-wide (`nuxt.config.ts`): `og:locale`, the
    Open Graph and Twitter image with its alt text, `application-name`. No `meta keywords` (search engines ignore it).
  - **Canonical** (`app.vue`, every page): `canonicalUrl(route.path)`, the production origin and the path alone,
    with no query or fragment (a share link's chart never leaks) and no trailing slash but the root's. `og:url` is
    the same.
  - **`/song/<name>`** for a library chart is indexable, with its own title, description and canonical (never a query
    or share link). **`/song`** itself, `?new=1`, and a chart that is not a library chart (`?mine=`, a share link)
    are `noindex`.
- **Structured data** (`utils/structuredData.ts`): JSON-LD for the site (`WebSite`, `WebApplication`) and each tune
  (a `MusicComposition`, or a `CreativeWork` for a form or an exercise, and a breadcrumb). It's a `<script type="application/ld+json">`, a data block the browser
  never runs, so the CSP doesn't apply and `web/build/csp.ts` doesn't hash it. `jsonLd()` escapes `<`, so chart
  text can't close the tag.
- **Sitemap and robots:**
  - `SITEMAP_PATHS` in `nuxt.config.ts`: the fixed pages and a song page (`songPath`) for each file in the engine's
    `charts/` (`readdirSync`; the config can't load the `#charts` glob), never `/song` or `/ui`. The same list
    is prerendered, and reaches the route as the `#sitemap-paths` virtual module.
  - `server/routes/sitemap.xml.ts` (`sitemapXml`, `utils/sitemap.ts`) is prerendered to a static file: each
    canonical URL once, no `lastmod` (Vercel's shallow clone has no history).
  - `public/robots.txt` allows everything and names the sitemap.
- **Notable recordings** ([spec](superpowers/specs/2026-10-17-notable-recordings.md), behind the `recordings` flag): a
  chart's `recording:` (artist; album; label; year) and `youtube:` (an official upload's ID, only with `recording:`),
  checked by the parser and read by `chartRecording`. The song page's Recording section (`SongRecording.vue`, outside
  `<ClientOnly>`, so prerendered) reads "Artist, *Album* (Label, Year)."; with a video, a `<VideoEmbed>` that loads
  nothing until played and a new-tab "Watch on YouTube" link (the fallback when a label blocks embedding). The
  `MusicComposition` gains `recordedAs` (a `MusicRecording`, `url` with a video). `tuneAdvice` hints at tunes with none.
  `npm run check-recordings -w engine` (by hand: it needs the network) asks YouTube's oEmbed whether each video still
  plays embedded.
- **Contributors** (#153): a chart's `contributor:` names who sent it for the library (the contact form's credit,
  written by the owner when adding the chart). `tuneSummary.contributor` and `songHead` carry it; the song page says
  "Chart contributed by <name>" under the Recording section, prerendered.
- **IndexNow** (#167): after each production deploy, `.github/workflows/indexnow.yml` (on `deployment_status`)
  POSTs the changed pages to `api.indexnow.org` (Bing and others recrawl them). `public/<key>.txt` holds the key
  and proves the pings are ours. `build/indexnow.ts` (`urlsFor`) picks the URLs from `git diff` against the previous
  production deploy: a chart → its song, composer and scale pages; `engine/src/` or `chord_scales.json` → every song
  and scale page; a `web/app/pages/` file → the sitemap pages it draws; always `/sitemap.xml`; no previous deploy →
  the whole sitemap (≤ 10,000 URLs). `npm run indexnow -- --from <sha>` prints them; a failed ping only warns.
- **Privacy:** no third-party origins for any of it: no search-console tags, tracking pixels or social widgets. The
  link preview image is our own (`og-image.png`).
- **Tests:** `web/e2e/seo.spec.ts` (song pages, canonicals, JSON-LD, the `/tunes` 301, the sitemap against `charts/`),
  `library.spec.ts` (a song's canonical, the title link, an unknown song going to the library).

## 8. State

- **`useChartEditor(initialText)`:**
  - State: `text`, `doc`, `diagnostics`, `fatal`, `rows`, `meta`.
  - `setText`: debounced re-parse.
  - `setDoc`: a grid edit, written back as canonical text.
  - `flush`: parse any pending typing now. It runs before printing and transposing.
- **`useChartHistory(editor)`:** undo and redo over the editor's text (§4), with `onKeydown` for ⌘Z and ⇧⌘Z.
  - Immutable updates only. The sheet (the Changes, the default, or Scales) and the mode are page state.
- **`usePreferences()`:** the instrument, the start note, the Intervals toggle and the Changes sheet's toggles
  (Numerals, Scales, and the Line, off until chosen, as `csm-line`, with `csm-guide-line` and `csm-arpeggio`), each a `storedRef` saved per browser. A
  stored value that isn't a known instrument or picker root falls back to the default (the instrument's is `piano`;
  the retired `concert` reads as `piano`).
- **Browser storage** goes through `utils/storage.ts` (`readStored`, `writeStored`). It's best-effort, because
  storage can be blocked or full. It holds the theme, the preferences, practice picks and My charts. Nothing is
  sent anywhere.
- **My charts** ([plan-saving.md](plan-saving.md)):
  - `utils/myCharts.ts`: an index of small records (`csm-charts`) plus one key per chart text (`csm-chart:<id>`).
    Kinds: `edited` (your version of a library chart, one per slug), `copy`, `new`. At most 200 charts of
    `LIMITS.maxChars` each; a failed write reports `full` and never leaves an index entry without its text.
  - `useSavedChart`: saves 800 ms after typing stops, on `pagehide` and when the editor closes. Editing a library
    chart back to its library text removes your version (`sameChart`: same lines, ignoring spacing and whether a
    default scale is written out). A new chart's first save moves the address to
    `?mine=<id>` without restarting the editor.
  - Charts once had underscore names. `plugins/chartNames.client.ts` runs `migrateChartNames` (`utils/myCharts.ts`) on
    load: it moves `csm-practice:` and `csm-level:` keys and an edited chart's `basedOn` from the old names. `mine:`
    keys are untouched; a key that can't be written stays.
  - Download writes the text as a Blob; Open (`readChartFile`) takes a `.txt` up to the size limit.
  - Share links (`engine/src/share.ts`): `{ v: 1, chart, view }` as deflate-raw JSON in base64url after `#s=`. The view
    applies for that visit only (`linkPreferences`), and nothing is saved until **Save to My charts**. Chord picks
    in a link (`view.picks`) go through `chordPicksFrom`, which drops any damaged entry. The router
    rewrites the address without its `#` while a prerendered page hydrates, so `plugins/arrivalHash.client.ts`
    keeps the original.
- **Interface levels** ([spec](superpowers/specs/2026-10-14-interface-levels-design.md), #273):
  Essentials / Intermediate / Everything, chosen in the More actions menu and kept as `csm-interface`, never in share
  links. `utils/interface.ts` holds the tier table (`CONTROL_TIERS`), `shows`, `hiddenSettings` and `initialLevel`;
  `useInterface()` shares the level, decided once at start by `plugins/interface.client.ts` (Essentials, or
  Everything when the browser already holds a `csm-*` key). Components add `shows('<id>') &&` to a control's `v-if`;
  nothing moves. Settings in force whose controls are hidden still render, with `InterfaceNotice` (Show controls /
  Reset) above the sheet. e2e specs start at Everything (`interfaceLevel` fixture, `chooseInterface` for new contexts).
- **The instrument picker** only changes `part` and the subtitle label (`partFor` and `instrumentLabel` in the
  engine). Each option's line is the instrument's full written range, `compass` (`F3–F6`, named by `noteName`), with
  a note only where it tells the player something (`F3–E6 · right hand`); the lines keep to `range` inside it.
- **The player's range** (#359, flag `playerRange`, on): two pickers under the Instrument, Lowest note and Highest note,
  set the written range the lines keep to (`partFor(name, range)`, so guide tones, 7th chords, pentatonic and triad pair
  lines and the Arpeggios sheet follow). `fitRange` (engine, `playerRange.ts`) keeps it inside the full range and the
  staff's cap, two octaves at least (`MIN_SPAN`), or the preset's span where that is less (tuba 22, bass 20: presets
  unchanged); moving one end pushes the other. The centre stays the preset's: every range the pickers allow holds it.
  `rangeChoices` lists each end's notes. Kept per instrument in this browser (`csm-range-<name>`, `"58-82"`, fitted
  when read); a share link carries none (it's the player's), and a link's instrument reads your range for it.
- **Feature flags:**
  - Set in `runtimeConfig.public.features` in `nuxt.config.ts`, and read with `useFeature(name)`.
  - New flags start off, and every flag is fixed at build time. `NUXT_PUBLIC_FEATURES_<NAME>=true|false`
    overrides one for a build or `make dev`.
  - `npm run e2e` builds with every flag on.
  - Now: `chartSubmissions` (off; Send to the library, §9) and `analyticsEvents` (off), and `offline`, `cells`,
    `approaches`, `patterns`, `recordings`, `playerRange`, `ireal` (on).
  - There are none now: #296 turned the last ones on for good and removed them with their flag-off code (`myCharts`,
    `practice`, `changes`, `keySignatures`, `arpeggios`, `compactRail`, `functions`, `pentatonics`, `hexatonics`,
    `interfaceLevels`); `Feature` is `never` until a new flag names itself. The bar editor shipped behind `barEditor`; at its sign-off
    the old row grid went, and the flag with it. `scaleLevels` (the Scale level control), `proposedScales` (a blank
    scale cell plays the analysis, §7a) and `leadSheetEditor` (the Changes sheet as the editor; at its sign-off the
    bar grid went, #141) went the same way at theirs.

## 9. Security

Pages are static, and the only server code is the contact function (the sitemap route is prerendered to a
static file, §7b), so the attack surface is small. The measures:

- **Edge:** Vercel's automatic DDoS mitigation in front of everything. Pages are static files on the CDN, so they need
  no rate limit of their own. The plan allows one rate-limit rule, and it guards the contact form (below).
- **Analytics:** Vercel Web Analytics (`web/build/analytics.ts`).
  - It's cookieless, with no cross-site tracking or advertising IDs, so there's no cookie banner. Visitors are
    counted with a daily-rotating hash.
  - It's one deferred script tag served from the site's own origin, under `VERCEL_OBSERVABILITY_BASEPATH` or
    `/_vercel`, so the CSP needs no new sources.
  - It's added to Vercel production builds only, so local builds and the e2e tests never request it.
  - It sends the full page address, so `public/analytics-before-send.js` (deferred, before it) queues a
    `beforeSend` that removes the `#…`: a share link's chart never leaves the browser.
  - It's written as a plain tag because `@vercel/analytics` declares a peer dependency on vue-router 4, which
    conflicts with Nuxt 4's vue-router 5.
  - Web Analytics has to be enabled for the project in the Vercel dashboard.
  - Page views carry routes (#149): the tag has `data-disable-auto-track`, and `app/plugins/analytics.client.ts`
    sends `va('pageview', { route, path })` on each `page:finish`, the route in Vercel's form
    (`utils/analyticsRoute.ts`: `/song/:slug?` → `/song/[slug]`). Pages still lists each song; Routes groups them.
    `analytics-before-send.js` also defines the `window.va` queue stub (the package's would be inline).
  - Six anonymous custom events (`utils/analytics.ts`: share created and opened, sheet, instrument once per song
    visit, print, transpose), at most 2 properties each, the chart named only by library slug or `own`, never on
    load. Behind the `analyticsEvents` flag, off until the project is on Pro (Hobby has no custom events; Pro bills
    about $0.03 per 1K events from the usage credit). The privacy page mentions them only with the flag on.
    Spec: `docs/superpowers/specs/2026-10-12-analytics-routes-events-design.md`.
- **Content-Security-Policy:**
  - **Where:** `web/build/csp.ts`, run by a Nitro `prerender:generate` hook, gives each prerendered page a
    `<meta http-equiv="Content-Security-Policy">` as the first element of `<head>`:
    `default-src 'self'; script-src 'self' <sha256 of each inline script>; style-src 'self' 'unsafe-inline';
    img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none';
    form-action 'none'; upgrade-insecure-requests`.
  - **Scripts:** Nuxt's two inline scripts (the import map and the runtime config) change per build, so they are
    hashed at build time. There is no `'unsafe-inline'` for scripts.
  - **Styles:** `style-src` allows inline styles, because Vue and VexFlow set style attributes.
  - **Tests:** the E2E tests fail on any CSP violation.
  - **Offline worker (#324, flag `offline`, on):** `public/sw.js` is written after prerendering by `web/build/sw.ts`
    (from `build/service-worker.js` and the precache list: the `/_nuxt` chunks, the non-song pages and payloads, the
    icons and `/200.html`, Nuxt's client-only shell). Same origin and registered from a plugin file
    (`plugins/serviceWorker.client.ts`), so the CSP is unchanged: `worker-src` and `manifest-src` fall back to `'self'`.
    Chunks are cache-first; pages and the rest network-first, cached as they arrive. Offline, a song not yet visited
    opens from `/200.html` (its chart is in the chunks). The version hashes the precached files, so a new build
    replaces the cache. The other e2e specs block service workers (`playwright.config.ts`); `e2e/offline.spec.ts` allows them.
  - **Error pages:** not-found and error pages use `app/error.vue`, because Nuxt's built-in error page injects an
    inline script, which the CSP blocks.
- **Headers:**
  - **Where:** `web/build/headers.ts`, applied by `routeRules` to `/**` and `/_nuxt/**`. Both are needed because
    Nitro's separate asset cache route would otherwise end Vercel's routing first.
  - **Checked:** Nitro writes the headers into Vercel's build output, and CI checks that output with `npm run
    check:headers`, since `nuxt preview` ignores `routeRules`.
  - **The headers:**
    - HSTS (2 years, subdomains).
    - `X-Content-Type-Options: nosniff`.
    - `Referrer-Policy: strict-origin-when-cross-origin`.
    - A `Permissions-Policy` that denies camera, microphone, geolocation, payment and USB.
    - `X-Frame-Options: DENY`.
    - `Content-Security-Policy: frame-ancestors 'none'`, which `<meta>` can't express.
- **Input:** caps in `limits.ts`: 20,000 characters of text, 500 rows, 40 characters per cell, and `copy:`
  expansion of at most 1,000 rows. They're enforced in the parser before any work runs.
- **XSS:** no `v-html` anywhere (lint rule `vue/no-v-html: error`). Chart text is only ever rendered as text nodes
  or VexFlow-escaped SVG text.
- **Supply chain:**
  - The lockfile is committed, versions are exact, and CI actions are pinned to commit SHAs.
  - Dependabot updates npm weekly, with minor and patch updates grouped, and the Actions. It skips TypeScript
    major updates until typescript-eslint and vue-tsc support TypeScript 7.
  - `npm audit --omit=dev` gates CI.
  - Runtime `dependencies` are only what ships to browsers: `vue`, `vexflow`, `@headlessui/vue`,
    `@heroicons/vue` and `@fontsource-variable/jost` (the heading font). Everything else (Nuxt, Tailwind, the test and lint tools) is a build-time `devDependency`.
- **The contact function** (`server/api/contact.post.ts`):
  - **Validation:** a pure, tested `checkContact` checks the length and form of name, email and message.
  - **Requests:** posts from another site are refused (403), as are bodies over about 4 MB (413): 16 KB of text,
    90 KB for a chart, plus one base64 attachment. Vercel's own cap is 4.5 MB.
  - **A chart for the library** ([spec](superpowers/specs/2026-10-12-chart-submissions-design.md), #153, flag
    `chartSubmissions`): the More menu's **Send to the library** (a new, My charts or shared chart, beside Report a
    chart error) or **Suggest these changes** (a library chart you've edited, in place of the report;
    `submissionAction`, `utils/chartSubmission.ts`) hands the chart to the contact page through sessionStorage
    (`csm-chart-submission`), read once. The page pre-fills the first line, shows the chart as a card (title, lines,
    the file name; Remove goes back to a plain message), a "Credit me as <name> on the tune page" checkbox
    (unticked) and the permission line, and posts `chart: { text, title, slug?, credit }`. `checkChart` takes text
    of 1 to `LIMITS.maxChars` (20,000) characters, a one-line title of at most 120 ("Untitled" when empty), a
    library slug (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, at most 80) for a suggestion only, and `credit` true or false.
    The email's subject is `Chord Scale Maker: chart for the library: <title>` or `…: suggested changes to <slug>`;
    the chart is attached first, UTF-8 base64, as `<slug>.txt` (`chartFilename`: a suggestion's slug, else the title
    folded to ASCII, apostrophes dropped, the rest to `-`, at most 60, `chart` when empty), beside the form's own
    file; the body adds `Credit: <name>` or `Credit: none`. The owner adds the chart by hand; nothing is published.
  - **Attachment** (optional, `FileDrop`, `utils/attachment.ts`): one JPG, PNG or PDF, browsed for or dropped,
    up to 10 MB as chosen. At most 3 MB is sent: the browser shrinks a bigger photo (2500 px on its long side,
    JPEG on white, the best quality that fits) and turns away a bigger PDF. The server checks the type against the
    file's first bytes, the size, and the base64, and makes the file name header-safe (`checkAttachment`). It's
    attached through Resend and never stored. Everything is in the browser and the function, with no storage
    service and no extra CSP origin.
  - **Bots:** a honeypot field, and a minimum time between showing the form and submitting it. Bots get a quiet
    200, so they learn nothing.
  - **The email:** plain text only, a one-line subject (no header injection), and the sender as reply-to.
  - **Secrets:** the destination address, sender and Resend API key are server-only runtime config
    (`NUXT_CONTACT_*`), never in the page. `NUXT_CONTACT_DRY_RUN=true` validates without sending (local builds and
    e2e).
  - **Rate limit:** the Vercel Firewall's one rate-limit rule. Path equals `/api/contact`, 2 requests per 60 s per IP
    (fixed window), answered with 429. Resend's free plan (100 emails a day) is the hard ceiling behind it.
  - **If spam gets through anyway:** Vercel BotID, or a daily send cap in the function (it needs a small store).
- **Pages rendered at request time** (the 404 page) get the same hashed CSP meta from `server/plugins/csp.ts`.
- **Error pages** (`app/error.vue`) cover unknown addresses and server errors in the site's own look:
  - an "Error 404" tab, a large status code, and plain words on what happened;
  - the way back to the library, plus "Try again" and a contact link for errors other than 404;
  - a quote from the library at heading size, different from the navbar's (`useQuote` slots).

  Nuxt's built-in page is never used, because it injects an inline script the CSP blocks. The one exception is
  Nuxt's last-resort fallback, shown only if rendering this page itself fails.
- **The one framed origin:** the About video, from `https://www.youtube-nocookie.com` (`frame-src`). It loads only
  when played (`VideoEmbed`).

## 10. Testing

- **Golden fixture:** `engine/fixtures/golden.json` freezes the engine's answers. `engine/src/__tests__/goldenFixture.ts`
  builds it from:
  - every scale × 21 roots (7 letters × ♭/♮/♯) × 5 parts (treble in C, B♭, E♭ and F, plus bass clef in C) → written root, notes, label, or error
  - `scale_notes` for both modes, both clefs, and several start notes
  - chord-symbol tokens for a chord corpus, including slash chords
  - scale options (with `note`, `default`, `outside`) and defaults for a chord corpus
  - the parsed rows of each chart in `engine/charts/`, and two inline charts for parser edge cases

  `engine/fixtures/analysis.json` is the analyser's report over every library chart, one row per line (key, areas, and
  each row's scale, rule, function and reason); `make golden` rewrites both fixtures. `npm run fixture-scales -w engine [--
  <ref>]` (`engine/scripts/fixtureScales.ts`) compares only their scales with a ref's (default `main`) and exits 1 on any
  difference: the check for a change meant to move text but no scale.

  The golden test compares each section with readable mismatches, then checks that the file is exactly what the
  engine writes now (so a new chart or scale can't go uncovered). After an intended change to the engine,
  `chord_scales.json` or `engine/charts/`: `make golden`, then review the diff. The file was first written by the Python
  CLI's exporter; the TS engine reproduced it byte for byte when the CLI was retired.
- **Engine unit tests (vitest),** written test-first alongside each module. They cover what fixtures can't:
  - quality resolution, interval roots, diagnostics and limits
  - transposition spelling
  - interval names
  - guide tones: the timeline (form lengths, metres), `guideToneLine` (one test a rule, named for its number, the spec's worked examples, and the library: every pitch in range, each line alone), `guideVoices` (ties and `tiedIn`, dotted
    halves, the measure rule over the voice, rests for unknown chords, an unreadable scale ignored, the bass range),
    holds, and a library test that no tie reaches into another block
  - the Changes sheet with guide tones: off is today's sheet, a folded copy is voiced once, a 2nd ending follows the
    1st ending's last chord, 2 and 4 bars a line give the same pitches, and `changesLinesPerPage`
  - the analyser: one test per rule (`analysis.test.ts`, named for the rule, from a real tune), key finding,
    key areas and contexts, and writing back (fill, force, keep, save, rerun, `copy:` conflicts)
- **App tests (`web/test/`):** `@nuxt/test-utils` (Nuxt runtime, happy-dom) with Vue Test Utils. They cover:
  - `useChartEditor` sync and debounce, and `useChartHistory` undo
  - library build and search
  - scale choices (`ChordChoices`, `SheetChordEditor`), the sheet editor (`SheetChord`, `SheetLabelPicker`,
    `SheetBarToolbar`, `SheetHeading`, `SheetPages`, `BarDialog`) and the heading fields' validation
  - `ChartTranspose`
  - the preview controls (`EditorView`)
  - `ScaleSheet` pagination with `ScaleStaff` stubbed; `ChangesSheet` (the clef with a guide on, the print gap, lines
    a page) and the `ChangesSystem` label row
  - feature flags, preferences, and the Catalyst components (`test/ui/`)

  VexFlow drawing needs a real browser, so the E2E tests cover it.
- **Local preview:** `make dev` (live reload) and `make preview` (the production static build, served locally).
- **E2E (`web/e2e/`, Playwright with Chromium, against the production static build, any flags on):**
  - library search and open, and the staff count
  - the bar editor: Edit and Done, bars ⇄ Source sync, typing and moving, the inspector, structure, undo; tap to
    edit on the Changes sheet, and the phone's light edits
  - the mode toggle
  - My charts: auto-save and reload, your version and Revert, Save as a copy, Delete, Download and Open (file
    picker and drop), share links in a fresh browser context, damaged links
  - Transpose
  - interval labels
  - guide tones on the Changes sheet: the Line control with From 3rd · From 7th and its labels, redrawing on each choice, one voice's stems and ties (and their
    half-ties over a line break), one rest for an unknown chord, accidentals against the signature, B♭ and bass-clef
    parts, a waltz, dark mode, endings above the stems, and no collisions in a 4-chord bar
  - 7th chords on the Changes sheet: quarters, eighths and sixteenths by chords a bar, beamed, no label row, a 3/4
    bar of eighths, the pattern remembered and carried by a share link
  - transposing instruments and the bass clef, and that the choices persist
  - dark mode
  - print:
    - scale sheets, 2 pages for Autumn Leaves, including the tallest staves
    - the Changes, 8 lines a page with guide tones off, and the tallest guide tone and 7th chord lines at `changesLinesPerPage`
  - the CSP meta on every page, and the not-found page

  Every test fails on a page error, a console error or a CSP violation. Run them with `make e2e`.
- **Accessibility:** `eslint-plugin-vuejs-accessibility` checks the templates (in `make lint`); axe scans
  (`@axe-core/playwright`, `web/e2e/a11y/*.a11y.ts`, their own Playwright project, kept out of `make e2e`) check the
  pages, the Changes and Scales sheets and their popovers (why notes, label pickers, the ladder, chord picks), in light
  and dark, and at phone width. A serious or critical violation fails unless `EXCEPTIONS` in `web/e2e/a11y/axe.ts`
  lists it with its reason and issue. `make a11y` runs both; the pre-push hook (`.githooks/`, set by `make setup`)
  runs it when the pushed commits touch `web/app/`, and CI's a11y job (not required) on PRs that do.
- **CI (GitHub Actions):**
  - The jobs: lint, typecheck (the engine's `tsc`, `nuxt typecheck`, the build and e2e tsconfigs) and vitest for
    every package (engine, web, cli), then `nuxt build`, the header check, `npm audit --omit=dev` (gating), and an e2e job.
  - The Playwright report is uploaded when the e2e job fails.
  - A full `npm audit` is reported but doesn't block, because build-tooling advisories don't ship.
  - Vercel's Git integration builds a preview deploy per PR.

## 11. Phases

1. **Engine:** fixtures exporter, TS engine, parity and unit tests (against the Python CLI). No UI.
2. **App:** library, editor (text ⇄ grid), quality defaults and alternates, scale prompt, live preview, print.
   Concert pitch only.
3. **Transposition:** instrument picker, clef, start note.
4. **Hardening:** CSP and security headers, the Firewall rate limit, Playwright E2E in CI, SHA-pinned actions,
   and Dependabot.
5. **UI redesign:** Catalyst ported to Vue, the stacked layout, zinc + teal ([plan-ui-redesign.md](plan-ui-redesign.md)).
6. **Features:**
   - Transpose a chart.
   - The blues, rhythm changes and modal library charts.
   - Dorian ♭2 and Mixolydian ♭6.
   - Inside and outside pentatonics, and interval labels.
   - Feature flags.
   - Guide tone lines ([plan-guide-tones.md](plan-guide-tones.md)), later moved onto the Changes sheet
     ([the spec](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md)).
   - One spelling at a time on the scale sheet.

## 12. Decisions

1. **Optional scale column.** Rows may omit the scale (3 cells, or an empty 4th cell). The scale
   then comes from the analysis at the sheet's level (§7a), or the quality's default in `chord_scales.json` where
   the analysis doesn't reach. A written scale is a pin. The editor prompts when it can't resolve a quality.
2. **Triads.** `chord_scales.json` has `maj` (`""`, `M`, `ma`, `major` → Ionian) and `m` (`-`, `mi`, `min` →
   Dorian).
3. **Slash-bass parsing.** `CHORD_RE` takes the quality lazily and the bass only as `/` + a note letter at the
   end. So `C6/9` gives quality `6/9`, and `D7/F#` gives quality `7` with bass F#. The quality is then matched
   exactly against the aliases.
4. **Staves per page.** 12 for scale sheets; 8 lines for the Changes, fewer with guide tones on (`changesLinesPerPage`).
5. **Transpose spells for the target key** (Dbm7 Gb7 in B♭, even with Cb/Fb in the scale). Instrument parts keep
   plain `simplifyRoot`.
6. **Mixolydian ♭6 is its own scale** (1 2 3 4 5 b6 b7). It used to be an alias of Phrygian Dominant, which has a
   b2 and no 2.
7. **Guide tones** are one line at a time on the Changes sheet (the separate sheet is gone), in the chart's metre, from the
   3rd or from the 7th ([spec](superpowers/specs/2026-10-10-guide-tone-lines-design.md), made independent by
   [this one](superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md), then amended by
   [the diverge note](superpowers/specs/2026-10-11-guide-lines-diverge-note.md)). Triads use 3 + root,
   because the root resolves by step from a V7 where the 5th would leap. The lines are local rules, not a global
   search: each steps to the nearest guide tone and a repeated chord holds; a run's starting octave is placed so the
   run averages nearest the centre, and lines that meet part gently: one keeps the shared note if the next chord has
   it, or they go one up and one down, neither more than a tritone because of the other (strict diverge, always one
   up and one down, had the fewest meetings but far more leaps over a tritone than the independent lines of #102:
   about 6× on concert treble, 4–8× across the parts measured; gentle keeps meetings near strict's and cuts those
   leaps below #102's on five of six parts, trombone the exception). The older
   per-degree toggles and the Viterbi pair search (`voiceLead`, now only a comparison) are superseded.
8. **One spelling at a time** in the preview (From key, From X or From root).
9. **Transpose, interval labels and guide tones** were built on the ported engine, so they inherit its spelling
   rules.
10. **Versioning: the commit is the release.** Every merge to main deploys, so there's no number to bump. The
    version is the commit's date (UTC) and short hash, e.g. `2026.10.07 · 1e2bea5` (`build/version.ts`, in
    `runtimeConfig.public.version`): shown in the footer and added to each contact-form email. Named milestones
    are annotated git tags (`v1-launch`). Revisit SemVer only if the engine is published as a package.
11. **The Python CLI is retired** (after the `v1-launch` tag). Its one unique strength was LilyPond's engraving;
    the browser's Save as PDF covers printing, and keeping two engines in step doubled every change. The golden
    fixture it wrote is kept, now regenerated by the TS engine. Revisit if LilyPond can run on Vercel.
12. **Two packages, one repo.** The engine is the workspace package `@chord-scale-maker/engine` (`engine/`), with its
    data and tools; the app depends on it by name, through its `exports` map. A separate engine repo waits for a
    reason to exist: a second consumer, outside work on the analysis, or a release cadence of its own
    ([spec](superpowers/specs/2026-10-11-engine-ui-split-design.md), Phase 2). Until then a change that spans both
    is one PR, and the commit is still the release (decision 10).
13. **One line per scale on the Scales sheet** (#189): the sheet is a tune's scale vocabulary; the Changes sheet
    follows the form. Lines merge by scale, chord root and canonical quality, so interval labels and presets hold for
    every chord on a line.
