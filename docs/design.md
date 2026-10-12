# jazz-scales web app: design

Companion to [requirements.md](requirements.md). This is the current design; the `plan-*.md` files are the
records of how each phase was built (see [README.md](README.md)).

## 1. Overview

A Nuxt 4 site, styled with Tailwind CSS and built with `nuxt build`, on Vercel (`web/vercel.json`). Every page is
prerendered and served as a static file; the scale engine, chart parser and renderer all run in the browser. The chart
library is built into the site at build time from `engine/charts/*.txt` (the engine package). The only server code is one function,
`/api/contact` (the contact form). Unknown URLs are also rendered there, as the 404 page. There is no database.

```text
engine/charts/*.txt ─────┐                          ┌─> Library page (title and composer search)
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
    chart.ts              # parse/serialize chart text <-> ChartDoc, expand @copy
    edit.ts               # grid edits on a ChartDoc (pure), cell validation
    sheet.ts              # rows -> pages of StaffModel (labels, notes, intervals, errors), toVexKey
    transpose.ts          # move a whole chart to another key (editor "Transpose…")
    intervals.ts          # interval names against the chord root (b9, #11, …)
    guideTones.ts         # guide tones per chord, voiced for the Changes sheet (guideVoices)
    guideToneLines.ts     #   the two lines, from the 3rd and from the 7th, built together (guideToneLine)
    guideToneTimeline.ts  #   when each chord starts and how long it lasts, in the chart's metre
    voiceLeading.ts       #   RANGES (the clefs' default ranges), and voiceLead (Viterbi over pairs), kept only to compare
    tune.ts               # tuneSummary, tuneDescription (a tune page's text), tuneGaps/tuneAdvice (§7b)
    util.ts               # orNull, chunk
    limits.ts             # input caps
    index.ts
    __tests__/            # vitest, incl. the golden fixture and the export snapshot
data/quotes.json          # quotes for the navbar (web only)
docs/                     # this file, requirements, phase plans (docs/README.md)
web/                      # Nuxt app (Vercel root directory); imports @chord-scale-maker/engine
  app/
    pages/index.vue       # library + title/composer search
    pages/tunes/[slug].vue  # a library chart's tune page (/tunes/<name>, §7b)
    pages/song.vue        # the editor: ?chart=<slug>; with myCharts also ?mine=<id>, ?new=1 and share links (#s=…)
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
  build/                  # csp.ts, headers.ts, analytics.ts, quotes.ts (+ tests, check-headers)
  server/                 # routes/sitemap.xml.ts (prerendered, §7b), api/contact.post.ts, utils/contactMessage.ts (+ test: message and attachment checks), plugins/csp.ts
  public/theme-init.js    # applies the saved theme before first paint
  public/analytics-before-send.js  # strips a share link's #… before Web Analytics sends a page view
  public/favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest
                          # the mark (four note heads climbing a navy tile, the top one in a blue corner), drawn
                          # by scripts/icons.mjs (`npm run icons`; needs rsvg-convert and ImageMagick); the navbar
                          # shows favicon.svg before the wordmark
  public/robots.txt       # allows everything, names the sitemap
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
| `simplify_root` | `scales.ts` `simplifyRoot` | same cost tuple `(ugly, total, sameDir)`; tie order = order of `enharmonics()` |
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
  - `baseQuality(text)` reads an extended symbol as the known quality it starts with, when the rest is only
    alterations (`Maj7#11` → `Maj7`, `7(9)` → `7`). Guide tones use it.
- `chart.ts` `qualityScale(row)`: the explicit scale cell, else the default, else `null` (the UI prompts); the
  sheets read `resolveScales` (§7a).
- `chord.ts`:
  - `chordTokens` and `writtenChordRoot` throw on a scale they can't read.
  - `chordTokensOrNull` and `writtenChordRootLenient` are the display variants. They ignore an unreadable
    scale, so a typo in the scale cell never hides the chord symbol.

## 4. Chart model and text ⇄ grid sync

The text format needs a document model that preserves comments and `@copy`.

```ts
type ChartLine =
  | { kind: 'meta'; key: MetaKey; value: string }  // title, subtitle (the heading); key, bars, context (analyser hints); minor (reserved); time; composer, style, form, source
  | { kind: 'row'; section: string; bar: string; chord: string; scale: string; function?: string; comment?: string }  // scale '' = default; function: the optional fifth cell, a stated function ('V7/ii', 'D: V7/ii'); comment: a trailing # …
  | { kind: 'key'; section: string; bar: number; key: string }  // @key B 17 D: bars from there in that key, until the next @key
  | { kind: 'context'; section: string; bar: number; context: ChartContext }  // @context B 17 modal: parsed, not yet analysed
  | { kind: 'copy'; src: string; dst: string; offset: number }
  | { kind: 'ending'; n: number; section: string; from: number; to: number }  // a 1st/2nd ending (volta) on the Changes sheet
  | { kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }     // a segno 𝄋 / coda ⊕ glyph
  | { kind: 'nav'; section: string; bar: number; text: string }                // "D.S. al Coda", "To Coda", "Fine"
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }
  | { kind: 'invalid'; text: string }     // bad line, kept verbatim so text round-trips

type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>  // line 0 = whole chart
type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>
```

- **Parsing:** `parseChart(text) → Parsed<ChartDoc>` is tolerant. A bad line becomes an `invalid` line plus a
  diagnostic, never an exception.
- **Fatal diagnostics** (`isFatal`) mean a hard input limit was exceeded: length, rows or expanded rows. The UI
  must not render or write back such a chart. Non-fatal diagnostics are per-line errors shown inline.
- **Serializing:** `serializeChart(doc) → text` gives the canonical, column-aligned form.
- **Expanding:** `expandRows(doc) → Parsed<Row[]>` applies `@copy` in order, capped at 1,000 rows;
  `expandRowLines` is the same with each row's source line (a repeat points at the row it copies). `ending`, `mark`
  and `nav` lines carry no rows, so expansion ignores them.
- **Navigation directives** (`@ending`, `@segno`, `@coda`, `@nav`): read only by the Changes sheet
  (`engine/src/changes.ts`), which maps them onto per-bar `volta`/`segno`/`coda`/`nav` fields. An `@ending` section is a
  2× repeat with the two endings bracketed; `@segno`/`@coda` draw glyphs, `@nav` a printed instruction. Parsing is
  syntactic only; a directive naming a section/bar the chart lacks simply renders nothing (like a `@copy` of an
  unknown section). See docs/plan-changes.md.
- **Outside the form** (`isOutsideForm`, `formPart`): sections named `Intro`, `Coda`, `Tag` or `Ending` (with an
  optional number). They print where they stand; the analysis links an intro into the form's first chord and a coda
  after its last (the form itself wraps to its own top), and the guide tone timeline times each on its own, so their
  bars can be numbered from 1.
- **Metre:** a `time:` meta line, `2/4`, `3/4` or `4/4` (the default; anything else is a diagnostic). `chartBeats`
  gives the beats a bar; the guide tone timeline splits bars by it (3/4: one chord = 3 beats, two = 2 + 1) and the
  Changes sheet draws its time signature, its slashes and, with guide tones on, its dotted halves. The scale sheet
  doesn't depend on it.
- **Function cell and `@key`:** a row may carry a fifth cell, the function the author states (`V7/ii`, or
  `D: V7/ii` for another key); empty means unstated. A `key` line pins the key area from its bar on. Both are
  read by the analysis (§7a) and round-trip through the grid; a row with a function but no scale keeps its empty
  scale cell (`A | 2 | D7 | | V7/V`).
- **`context:` and `@context`:** `context: functional | modal | blues` states how the analysis reads the chart
  (§7a; docs/plan-analysis.md §5.4); absent, it is detected. A value that is none of the three keeps its line (like a
  bad `key:`) and is a diagnostic; the analysis then detects, and reports the bad line. `minor:` is reserved
  (accepted, kept, reported as ignored). `@context SECTION BAR CONTEXT` is parsed, validated and serialised like
  `@key`; the analysis reports it as not yet supported and keeps the chart's context. The site shows neither.
- **Trailing comments:** a row may end in `# …` (a `#` with space on both sides, so `F#m7` and `C# Lydian` are
  safe). It holds the analysis (§7a), is kept verbatim through every edit, and is column-aligned when serialized;
  the grid doesn't show it.
- **One source of truth:** the `ChartDoc` in `useChartEditor`.
  - Text edits are debounced (about 150 ms), parsed, and replace the doc. Text isn't reformatted while you type;
    the canonical form applies only after a grid edit.
  - Grid edits make a new doc (an immutable update), which is serialized back into the text.
  - The text always wins. A grid edit made from a doc older than the typed text is dropped.
  - **Undo:** ⌘Z and ⇧⌘Z (Ctrl off a Mac) in the grid or the text step through the text's history (`useChartHistory`
    over the engine's pure `history.ts`). A state is recorded each time the doc changes: a grid edit or a
    transposition at once, typing after the parse pause, so a burst of keystrokes is one step. It keeps 100 steps.
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
    (`repeatSection`: an `@copy` after the part's last section) follow the sheet; a section's marker is a button that
    renames it (`renameSection`). The toolbar's ⋯ menu also pastes bars (`parseBarLine`, then `insertBars` before or
    after the bar; refused while the text has diagnostics). The jump, the new section, the pasted bars, the repeat and
    the rename use `BarDialog`; a refused one stays open with why. The heading is edited where it prints
    (`SheetHeading` in `SheetPages`' `#heading` slot, with the time beside the key; the printed heading stays for
    print). The sheet keeps the instrument's clef and range but reads
    in concert pitch while editing, with numerals and scales shown (their toggles rest); both return on Done. Phones
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

- **Layout:** one `ScaleStaff` per expanded row. An HTML label column on the left holds section · bar, the chord
  symbol and the scale name; the VexFlow SVG stave is on the right. HTML labels give better typography and
  accessibility than VexFlow text.
- **Stave:** one stave with a clef, no time signature, and whole notes. Every altered note gets an explicit
  accidental (as LilyPond's `\accidentalStyle forget` did for the old CLI). Each staff ends with a double bar
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
  staff's `id` combines its position, its row content, the part and the mode.

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
- **Highlighting:** `drawStaff` tags each note's group `vf-selected` or `vf-dimmed`, and `main.css` colours them:
  on screen, picked notes keep the staff's ink in light mode (as the clef) and take the accent in dark mode, while
  the rest are faint (35% opacity in dark mode). In print, picked notes are black and the rest light grey.

### Changes sheet ([plan-changes.md](plan-changes.md); the `changes` flag, on)

- **The default view:** a chart opens on the Changes; a share link may open it on Scales.
- A study lead sheet: `engine/src/changes.ts` `buildChanges(doc, part, barsPerLine, signatures, guides)` lays the chart
  out in lines of four bars (two on phones), each section on a new line, one slash a beat in the chart's metre.
  Chords sit on their beats (the guide tone timeline's timing), each with its Roman numeral (`analysis/numerals.ts`)
  and its scale, both written for the part; key-area labels where the key changes; section markers; a `@copy`
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
- `Numerals` and `Scales` toggles and a **Guide Tones** segmented control (Off · From 3rd · From 7th) replace Intervals on
  this sheet (`csm-numerals`, `csm-scale-names`, both on; `csm-guide-line`, `off | third | seventh`, off; share links carry
  them and the sheet, the line as `guideLine`, absent meaning off).

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
  two-ledger-line cap, `CAPS`: treble G3–D6, bass B1–F4; vibes G3–D6 around B♭4, trumpet G3–G5, tuba C2–B♭3…), or,
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
- **Clefs and key signatures (the `keySignatures` flag, on):** the clef and the chart's key as written for the instrument
  (`keySignature` in `engine/src/keySignature.ts`; a minor key by its relative major, none without a `key:`), once at the
  start, as on a jazz lead sheet: the first staff of each scale sheet part (`StaffModel.showClefAndKey`) and the
  first Changes line; every other staff and line has neither. With a guide tone on, the first Changes line gets the
  clef even with the flag off or without a `key:`. The key is the chart's `key:` (`chartKeyOf`) throughout: key
  changes go by accidentals only, and show in the analysis (the Changes sheet's key-area labels), never as a new
  signature. Notes follow the measure rule (`accidentalsInBar`): an accidental shows only where it differs from what
  is in force in the bar (guide tones: the voice, against C without a signature). The first Changes line
  uses a taller crop band (`CLEF_BAND`). With the flag off, every scale staff has its clef, as before.
- **Shared helpers:** `svgContext`, `fitSvg` and `headCentre` in `utils/vexflow.ts`.
- **Instrument choice:** 16 presets, grouped by what they read (C treble, B♭, E♭, F, bass clef). The
  choice sets the `Part` (clef + transposition) for the whole preview, so notes, chord symbols and scale names
  are all written for that instrument. The chart stays in concert pitch.

## 6. Styling

- **Tailwind CSS v4** through `@tailwindcss/vite` in `nuxt.config.ts`. Styles are utility classes on
  components. A single `app/assets/css/main.css` holds `@import "tailwindcss"`, the theme tokens and the print
  rules.
- **Palette: Duotone Blue**, Blue Note-inspired (chosen from three mocked directions).
  - **Neutrals:** `zinc` is retuned in `main.css` to cool, navy-tinted greys (paper `#F3F6FB` to night `#08111F`).
    Catalyst's `zinc-*` class strings therefore stay verbatim and recolour together.
  - **Accent:** a `note` blue scale. `note-800` navy is the primary button (`<UiButton color="note">`). `note-500`
    marks selected toggles, the current page and focus rings. A `note-100` tint backs the library's heading tab.
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
  - It shows the quote and its author.
  - `build/quotes.ts` reduces `data/quotes.json` at build time to `cited` entries with those two fields. The
    file marks the rest "unverified".
  - The list is served as the separate `virtual:quotes` chunk, about 20 KB gzipped, fetched after mount. So the
    prerendered HTML is the same for everyone.
- **App components** compose the Catalyst ones:
  - `SheetPages`, which lays out both sheets' printed pages. On screen they form one continuous card, with a dashed
    "Page N" divider where each printed page starts and the header shown once. In print each page is a bare letter
    page with its own header.
  - `PreviewControls`, the preview toolbar: Work on, Instrument, Spell Scale (From key/From root/From X), then Show: Intervals (on the Changes, Analysis: Numerals and Scales, and Guide Tones: Off · From 3rd · From 7th) with the chart's actions (Transpose…, Focus, Print), a row of their own below lg and two by two on a phone.
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
  about 9.6in, even when every note has ledger lines (e.g. trombone from B). Autumn Leaves prints on 4 pages.
- **Changes:** 8 four-bar lines a page with guide tones off, so a 32-bar AABA prints on one page.
  - With guide tones on, `changesLinesPerPage` (`engine/src/changes.ts`) gives fewer: 6 with a line on and
    numerals and scales, one more with both rows off. `print.spec.ts` prints the tallest case (one line,
    numerals, scales, an ending and a bass part) a sheet page to a letter page.
  - The chord row and spacing are shorter in print; lines with a clef or guide tones close up (`print:space-y-0`).
  - Print always uses 4 bars a line.
  - Lines never split across pages.
- **Saving a PDF:** users choose "Save as PDF" in the browser's print dialog. There is no server-side PDF.

## 7. Library

- **Loading:** `import.meta.glob('#charts/*.txt', { query: '?raw', eager: true })` (`#charts` is the engine package's
  `charts/`) in
  `app/utils/library.ts` gives `{ slug, title, subtitle, composer, text }[]` at build time, skipping sync-tool
  copies (`giant_steps 2.txt`, `isSyncCopy`). The same parser runs, and a test fails the build if any library
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
  every occurrence of the line (`@copy` repeats too) has that scale, and never a `# keep:` row; every other written
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
  came from (a key the author set is starred), behind the `functions` flag (on).
- **The scale played** (`engine/src/resolve.ts`, [proposed scales spec](superpowers/specs/2026-10-11-proposed-scales-design.md)
  §2): `resolveScales(doc, view, analysis?)` gives each expanded row (keyed by its
  index in `expandRowLines`, so a `@copy` repeat resolves on its own row) a `Resolved` scale and its `source`:
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
  - **Dominant:** a blues I7 (derived) and IV7 (Mixolydian) are decided by their degree, D5 before D3; a V7 into a
    minor chord is Phrygian Dominant, Altered at Advanced.
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

- **Tune pages:** every library chart has one at `/tunes/<name>` (`pages/tunes/[slug].vue`; `tunePath` turns the
  slug's `_` into `-`, which search engines read as word breaks). It shows the heading fields, `aka:` titles, the
  source, and the changes as a table (section, bar, chord, function, scale) in concert pitch, with a button to the
  practice sheets (`/song?chart=<slug>`). The library links each title to its page.
  - **Text:** `tuneSummary` (engine `tune.ts`) gives the heading and one row per chord as the Changes sheet draws it;
    `tuneDescription` is the meta description, one sentence of at most 160 characters, dropping clauses to fit.
    `tuneTitle` (`utils/site.ts`) is the title: "Blue Trane (John Coltrane): changes and chord scales".
  - **The gate:** `tuneGaps` lists what a library chart's page lacks (`title:`, `key:`, `style:`, `form:`, and
    `composer:` unless `kind:` is `form` or `exercise`); `libraryMeta.test.ts` fails on any. `tuneAdvice` (no
    `source:`, no `aka:`) is only reported, by `npm run analyse`.
  - An unknown name is a 404 (`findTune` in `utils/library.ts`).
- **Head tags** (`utils/site.ts`):
  - `PAGE_HEAD` holds each fixed page's title and description; `seoMeta` turns one into `useSeoMeta` input, the
    link preview's title carrying the site name as the browser's does (`pageTitle`).
  - **Canonical** (`app.vue`, every page): `canonicalUrl(route.path)`, the production origin and the path alone,
    with no query or fragment (a share link's chart never leaks) and no trailing slash but the root's. `og:url` is
    the same.
  - **`/song`** (the editor) is `noindex`, and its canonical is `/song`: its query names a chart, not a page.
- **Structured data** (`utils/structuredData.ts`): JSON-LD for the site (`WebSite`, `WebApplication`) and each tune
  (a `MusicComposition`, or a `CreativeWork` for a form or an exercise, and a breadcrumb). It's a `<script type="application/ld+json">`, a data block the browser
  never runs, so the CSP doesn't apply and `web/build/csp.ts` doesn't hash it. `jsonLd()` escapes `<`, so chart
  text can't close the tag.
- **Sitemap and robots:**
  - `SITEMAP_PATHS` in `nuxt.config.ts`: the fixed pages and a tune page for each file in the engine's `charts/`
    (`readdirSync`, `tunePathsOf`; the config can't load the `#charts` glob), never `/song` or `/ui`. The same list
    is prerendered, and reaches the route as the `#sitemap-paths` virtual module.
  - `server/routes/sitemap.xml.ts` (`sitemapXml`, `utils/sitemap.ts`) is prerendered to a static file: each
    canonical URL once, no `lastmod` (Vercel's shallow clone has no history).
  - `public/robots.txt` allows everything and names the sitemap.
- **Privacy:** no third-party origins for any of it: no search-console tags, tracking pixels or social widgets. The
  link preview image is our own (`og-image.png`).
- **Tests:** `web/e2e/seo.spec.ts` (tune pages, canonicals, JSON-LD, the sitemap against `charts/`),
  `not-found.spec.ts` (an unknown tune), `library.spec.ts` (the editor's `noindex` and canonical).

## 8. State

- **`useChartEditor(initialText)`:**
  - State: `text`, `doc`, `diagnostics`, `fatal`, `rows`, `meta`.
  - `setText`: debounced re-parse.
  - `setDoc`: a grid edit, written back as canonical text.
  - `flush`: parse any pending typing now. It runs before printing and transposing.
- **`useChartHistory(editor)`:** undo and redo over the editor's text (§4), with `onKeydown` for ⌘Z and ⇧⌘Z.
  - Immutable updates only. The sheet (the Changes, the default, or Scales) and the mode are page state.
- **`usePreferences()`:** the instrument, the start note, the Intervals toggle and the Changes sheet's toggles
  (Numerals, Scales, and the guide tone line, Off · From 3rd · From 7th, off until chosen, as `csm-guide-line`), each a `storedRef` saved per browser. A
  stored value that isn't a known instrument or picker root falls back to the default.
- **Browser storage** goes through `utils/storage.ts` (`readStored`, `writeStored`). It's best-effort, because
  storage can be blocked or full. It holds the theme, the preferences, practice picks and My charts. Nothing is
  sent anywhere.
- **My charts** (the `myCharts` flag, on; [plan-saving.md](plan-saving.md)):
  - `utils/myCharts.ts`: an index of small records (`csm-charts`) plus one key per chart text (`csm-chart:<id>`).
    Kinds: `edited` (your version of a library chart, one per slug), `copy`, `new`. At most 200 charts of
    `LIMITS.maxChars` each; a failed write reports `full` and never leaves an index entry without its text.
  - `useSavedChart`: saves 800 ms after typing stops, on `pagehide` and when the editor closes. Editing a library
    chart back to its library text removes your version (`sameChart`: same lines, ignoring spacing and whether a
    default scale is written out). A new chart's first save moves the address to
    `?mine=<id>` without restarting the editor.
  - Download writes the text as a Blob; Open (`readChartFile`) takes a `.txt` up to the size limit.
  - Share links (`engine/src/share.ts`): `{ v: 1, chart, view }` as deflate-raw JSON in base64url after `#s=`. The view
    applies for that visit only (`linkPreferences`), and nothing is saved until **Save to My charts**. The router
    rewrites the address without its `#` while a prerendered page hydrates, so `plugins/arrivalHash.client.ts`
    keeps the original.
- **The instrument picker** only changes `part` and the subtitle label (`partFor` and `instrumentLabel` in the
  engine).
- **Feature flags:**
  - Set in `runtimeConfig.public.features` in `nuxt.config.ts`, and read with `useFeature(name)`.
  - New flags start off, and every flag is fixed at build time. `NUXT_PUBLIC_FEATURES_<NAME>=true|false`
    overrides one for a build or `make dev`.
  - `npm run e2e` builds with every flag on.
  - `myCharts` (My charts, New chart, Download/Open, share links), `changes` (the Changes sheet),
    `practice` (the Practice panel), `keySignatures` and `functions` are on, since sign-off. Guide tones on the
    Changes sheet have no flag: their toggles start off. The bar editor shipped behind `barEditor`; at its sign-off
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
- **Input:** caps in `limits.ts`: 20,000 characters of text, 500 rows, 40 characters per cell, and `@copy`
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
  - **Requests:** posts from another site are refused (403), as are bodies over about 4 MB (413): 16 KB of text
    plus one base64 attachment. Vercel's own cap is 4.5 MB.
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
    key areas and contexts, and writing back (fill, force, keep, save, rerun, `@copy` conflicts)
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
- **E2E (`web/e2e/`, Playwright with Chromium, against the production static build, all flags on):**
  - library search and open, and the staff count
  - the bar editor: Edit and Done, bars ⇄ Source sync, typing and moving, the inspector, structure, undo; tap to
    edit on the Changes sheet, and the phone's light edits
  - the mode toggle
  - My charts: auto-save and reload, your version and Revert, Save as a copy, Delete, Download and Open (file
    picker and drop), share links in a fresh browser context, damaged links
  - Transpose
  - interval labels
  - guide tones on the Changes sheet: the Off · From 3rd · From 7th control and its labels, redrawing on each choice, one voice's stems and ties (and their
    half-ties over a line break), one rest for an unknown chord, accidentals against the signature, B♭ and bass-clef
    parts, a waltz, dark mode, endings above the stems, and no collisions in a 4-chord bar
  - transposing instruments and the bass clef, and that the choices persist
  - dark mode
  - print:
    - scale sheets, 4 pages for Autumn Leaves, including the tallest staves
    - the Changes, 8 lines a page with guide tones off, and the tallest guide tone lines at `changesLinesPerPage`
  - the CSP meta on every page, and the not-found page

  Every test fails on a page error, a console error or a CSP violation. Run them with `make e2e`.
- **CI (GitHub Actions):**
  - The jobs: lint, typecheck (the engine's `tsc`, `nuxt typecheck`, the build and e2e tsconfigs) and vitest for
    both packages, then `nuxt build`, the header check, `npm audit --omit=dev` (gating), and an e2e job.
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
