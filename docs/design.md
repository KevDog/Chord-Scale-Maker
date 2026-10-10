# jazz-scales web app: design

Companion to [requirements.md](requirements.md). This is the current design; the `plan-*.md` files are the
records of how each phase was built (see [README.md](README.md)).

## 1. Overview

A Nuxt 4 site, styled with Tailwind CSS and built with `nuxt build`, on Vercel (`web/vercel.json`). Every page is
prerendered and served as a static file; the scale engine, chart parser and renderer all run in the browser. The chart
library is built into the site at build time from `charts/*.txt`. The only server code is one function,
`/api/contact` (the contact form). Unknown URLs are also rendered there, as the 404 page. There is no database.

```text
charts/*.txt ───────┐                          ┌─> Library page (title and composer search)
chord_scales.json ──┼─> build (Vite raw import) ┤
                    │                          └─> Editor: text ⇄ grid ─> engine ─> VexFlow preview ─> browser print
engine ──> fixtures/golden.json (frozen answers, `make golden`) ──> vitest golden test
```

The preview has two sheets: **Changes** (the chart as a study lead sheet, the default view; its From 3rd and From 7th
toggles put guide tone lines on the staff) and **Scales** (one staff per chord). Both are written for the
chosen instrument.

## 2. Repository layout

```text
chord_scales.json         # qualities, aliases, default/alternate scales, slash readings
data/quotes.json          # quotes for the navbar (web only)
charts/*.txt              # chart library (concert pitch)
fixtures/golden.json      # the engine's frozen answers (web/engine/__tests__/goldenFixture.ts, `make golden`)
docs/                     # this file, requirements, phase plans (docs/README.md)
web/                      # Nuxt app (Vercel root directory)
  engine/                 # pure TS, no Vue/DOM imports
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
    guideToneLines.ts     #   the two greedy lines, from the 3rd and from the 7th (guideToneLines)
    guideToneTimeline.ts  #   when each chord starts and how long it lasts, in the chart's metre
    voiceLeading.ts       #   RANGES, and voiceLead (Viterbi over pairs), kept only to compare with the lines
    util.ts               # orNull, chunk
    limits.ts             # input caps
    index.ts
    __tests__/            # vitest, incl. the golden fixture
  app/
    pages/index.vue       # library + title/composer search
    pages/editor.vue      # ?chart=<slug>; with myCharts also ?mine=<id>, ?new=1 and share links (#s=…)
    pages/help.vue        # how it all works, in the owner's voice: sheets, controls, practice, editing, printing
    pages/about.vue, contact.vue, privacy.vue  # About (Jazz Lab thanks, the video, credits), the form, privacy
    pages/ui.vue          # dev-only showcase of the Catalyst components (removed from production builds)
    components/           # AppShell, EditorView, ChartGrid, GridCell, ScaleCell, ChartText, ChartTranspose,
                          # PreviewControls, SheetPages, ScaleSheet, ScaleStaff,
                          # ChangesSheet, ChangesSystem, ChordSymbol, NoteName
    components/ui/        # Catalyst ported to Vue (<UiButton>, <UiListbox>, <UiDialog>, …)
    composables/          # useChartEditor (editor state), usePreferences, useTheme, useFeature, useMediaQuery,
                          # useFocusMode, useSavedChart (auto-save), useOpenChart
    utils/                # library (build-time charts), scaleChoices, instrumentChoices, sheets,
                          # vexflow (loader, scale staves, shared SVG helpers), changesDrawing,
                          # storage (safe localStorage), myCharts (saved charts), chartFile (Download/Open),
                          # starterChart, catalyst/ (button and badge styles),
                          # field, table, interactive (Catalyst wiring)
    assets/css/main.css   # Tailwind, theme tokens, print rules
  build/                  # csp.ts, headers.ts, analytics.ts, quotes.ts (+ tests, check-headers)
  server/                 # api/contact.post.ts, utils/contactMessage.ts (+ test: message and attachment checks), plugins/csp.ts
  public/theme-init.js    # applies the saved theme before first paint
  public/analytics-before-send.js  # strips a share link's #… before Web Analytics sends a page view
  public/favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest
                          # the mark (four note heads climbing a navy tile, the top one in a blue corner), drawn
                          # by scripts/icons.mjs (`npm run icons`; needs rsvg-convert and ImageMagick); the navbar
                          # shows favicon.svg before the wordmark
  public/og-image.png     # the 1200×630 link preview (Open Graph tags in nuxt.config.ts), drawn by the same script
  test/                   # app tests (@nuxt/test-utils, happy-dom)
  e2e/                    # Playwright tests against the production build
  nuxt.config.ts, vitest.config.ts (engine + app projects), playwright.config.ts, eslint.config.mjs,
  tsconfig.json (Nuxt's generated configs), tsconfig.engine.json, tsconfig.e2e.json
```

Vercel builds from `web/` with
"include files outside root directory" enabled so `charts/` and `chord_scales.json` are importable. In
`make dev`, a small Vite plugin watches those two as well, since they sit outside Vite's root.

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
- `chart.ts` `resolveScale(row)`: the explicit scale cell, else the default, else `null` (the UI prompts).
- `chord.ts`:
  - `chordTokens` and `writtenChordRoot` throw on a scale they can't read.
  - `chordTokensOrNull` and `writtenChordRootLenient` are the display variants. They ignore an unreadable
    scale, so a typo in the scale cell never hides the chord symbol.

## 4. Chart model and text ⇄ grid sync

The text format needs a document model that preserves comments and `@copy`.

```ts
type ChartLine =
  | { kind: 'meta'; key: MetaKey; value: string }  // title, subtitle (the heading); key, bars (analyser hints); composer, style, form, source
  | { kind: 'row'; section: string; bar: string; chord: string; scale: string; function?: string; comment?: string }  // scale '' = default; function: the optional fifth cell, a stated function ('V7/ii', 'D: V7/ii'); comment: a trailing # …
  | { kind: 'key'; section: string; bar: number; key: string }  // @key B 17 D: bars from there in that key, until the next @key
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
  (`engine/changes.ts`), which maps them onto per-bar `volta`/`segno`/`coda`/`nav` fields. An `@ending` section is a
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
- **Trailing comments:** a row may end in `# …` (a `#` with space on both sides, so `F#m7` and `C# Lydian` are
  safe). It holds the analysis (§7a), is kept verbatim through every edit, and is column-aligned when serialized;
  the grid doesn't show it.
- **One source of truth:** the `ChartDoc` in `useChartEditor`.
  - Text edits are debounced (about 150 ms), parsed, and replace the doc. Text isn't reformatted while you type;
    the canonical form applies only after a grid edit.
  - Grid edits make a new doc (an immutable update), which is serialized back into the text.
  - The text always wins. A grid edit made from a doc older than the typed text is dropped.
- **The grid** shows each `ChartLine` as a row:
  - Data rows are editable cells.
  - `@copy` is a compact directive row, and invalid lines show their error.
  - Expanded copies appear in the preview, not the grid.
- **Cell validation** (`cellError`): a value may not contain `|` or line breaks, start or end with spaces, or
  start with `#`, `@`, `title:` or `subtitle:`; a row cell may not contain a `#` after a space (it would start a
  trailing comment). Otherwise the serialized text would re-parse as a different line.
  A rejected value stays visible and flagged in its cell (`GridCell`), and the doc keeps the last good value.
- **Chord cell:** free text, validated as above.
- **Scale cell** (`ScaleCell`): a dropdown with these entries.
  - The quality's default first, unlabelled (with levels, "Default" read as a level). Choosing it writes its name into the text (`C Dorian`), and a default scale follows
    when the chord changes (`setRowChord`: Cm7 → F7 takes C Dorian to F Mixolydian); a scale you chose stays.
  - The scale's formula (1, 2, ♭3, …) shows inside the select where the cell is wide enough for the whole label and
    the formula (measured with `utils/textWidth.ts`), typically with the Text pane hidden.
  - The quality's inside alternates, with their notes.
  - An "Outside (tension to resolve)" group, for options marked `outside`.
  - "Other…", which opens a dialog with a root and any of the 26 scales. Focus returns to the cell after it
    closes.

  An unknown quality gives an amber border and "Choose a scale…", with "Other…" still available.
- **Scale level** (the `scaleLevels` flag, on; `engine/levels.ts`): Basic / Standard / Advanced / Random, above the
  chart grid. Choosing one writes the scales into the chart (`relevel`), so they save, print and share with it.
  - Options in `chord_scales.json` carry `level: basic|advanced`; Standard is the default, and a quality without a
    tag keeps it. Random picks among the inside options, from a seed (Shuffle deals a new one).
  - The level **owns** the rows that played their default when the chart left Standard (`line:chord` keys), and
    moves only those, while they still play the old level's scale. So a hand-picked scale stays, even one that is
    also a level's choice (B♭ Lydian on a Maj7), and Standard puts the owned rows back.
  - A library chart's own choices (the Bird Blues' A7♭9 on Phrygian Dominant) are its Standard: levels take them
    over too, and Standard brings them back (`baseline`: the library chart, for itself and for copies of it).
  - **Ladders** (`ladders` in `chord_scales.json`, plan-analysis.md §11): a row whose Standard is not its
    quality's default climbs that scale's ladder instead of the quality's tags, so the analysis's choice keeps its
    colour: D7 on Phrygian Dominant (V7 of G minor) goes to G Minor Pentatonic at Basic and Spanish Phrygian at
    Advanced, not to D Major Pentatonic and Bebop Dominant. A ladder without a rung keeps the Standard
    (`ladderScale`).
  - A tonic minor chord (the analysis's rule m5; `relevel` runs `analyse` on the chart) is Aeolian at Basic.
  - `useScaleLevel` remembers the level, seed and owned rows per chart in this browser (Save as a copy and Save to
    My charts carry them; Revert resets them). Share links carry the level and seed; without the owned rows, a
    recipient's next change matches rows by scale.
- **Slash readings** (`slash_chords` in `chord_scales.json`): a chord whose bass makes it another
  chord takes that chord's options on the bass. DbMaj7/C is a sus♭9 on C: C Phrygian (default), C Spanish
  Phrygian, C Dorian ♭2. Only the options change; the symbol, interval labels and practice presets read DbMaj7.
- **Transpose…** (`ChartTranspose`, `engine/transpose.ts`) rewrites the whole chart in another concert key.
  - Every row moves by the key interval in letters and semitones.
  - **Spelling:** roots are spelled on the target key's side by `spellInKey`, so a Bb chart reads Dbm7 Gb7, and
    a natural beats an accidental (B, not Cb). `simplifyRoot` decides in C, or when that side would put double
    accidentals in the scale.
  - A chord follows its scale's root, and a slash bass keeps its interval.
  - Titles stay as typed. To undo, transpose back.
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
- **One spelling at a time:** "From X", where every scale starts on the Start on note, or "From root". The
  default is From root, and the Start on select only appears for From. The engine still supports `both`.
- **Subtitles** (`pageSubtitle`): "Subtitle – Tenor Sax (Bb) (Spelled from C)".
- **Interval labels:** the Intervals toggle, on by default and saved per browser, labels every note against the chord's written
  root (`engine/intervals.ts`). Labels read b9, #9, #11 and b13, a minor 3rd reads #9 on chords with a major
  3rd, sus chords get a 4, and sixth chords a 6. They are HTML placed under the note heads, on screen only, so
  the print layout doesn't change.
- **View model:** `engine/sheet.ts` builds the `StaffModel` (labels, notes, intervals, or an error such as
  "Choose a scale"), and components only draw it. The live preview re-renders only staves that changed: each
  staff's `id` combines its position, its row content, the part and the mode.

### Practice selection ([plan-practice.md](plan-practice.md))

- **What it does:** a subset of each scale's notes to improvise with. The chosen notes are highlighted on the
  Scales sheet and the rest dimmed, on screen and in print.
- **The engine** (`engine/practice.ts`) gives every staff's notes a key, a spelled interval:
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
- A study lead sheet: `engine/changes.ts` `buildChanges(doc, part, barsPerLine, signatures, guides)` lays the chart
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
  the slashes, each wrapping within the room up to the next chord. Eight lines a printed page (a 32-bar AABA), fewer
  with guide tones on (§6a).
- `Numerals`, `Scales`, `From 3rd` and `From 7th` toggles replace Intervals on this sheet (`csm-numerals`, `csm-scale-names`,
  both on; `csm-guide-3rd`, `csm-guide-7th`, both off; share links carry them and the sheet).

### Guide tones on Changes ([spec](superpowers/specs/2026-10-10-guide-tone-lines-design.md); first built as [guide tones on Changes](superpowers/specs/2026-10-10-guide-tones-on-changes-design.md))

- **What shows:** **From 3rd** and **From 7th** are two lines. Line A starts on the first chord's 3rd, line B on its
  7th, and each moves to the nearest guide tone of every chord after it. One toggle shows that line alone, both show
  both. Each chord's slashes give way to one note per line, held for the chord's length and tied across barlines; a tie
  still open at a line's end continues as a half-tie on the next line.
- **Which tones** come from the chord quality (`TONES` in `engine/guideTones.ts`): the 3rd (a sus chord's 4th) and
  the 7th (a triad's root, a 6 chord's 6th).
- **The lines** (`engine/guideToneLines.ts`, `guideToneLines`) are greedy, one chord at a time, so a reader can apply
  them by hand; the rules are numbered in the spec. The candidates are both guide tones at every octave inside the
  part's written range (`RANGES`: treble C4–A5, bass E2–C4). A line takes the smaller move (a common tone before a
  step before a leap); equal moves go to the pitch nearer the centre of the comfortable range (A4 treble), then the
  lower. A start, or a restart after a rest, takes the octave nearest the line's last sounded note (the centre with
  none).
  - **Holds:** a chord whose 3rd and 7th are spelled as the previous chord's, in the same block, holds both lines:
    the same pitch, tied, labelled again. A hold never crosses a block (section) boundary or the start of a 2nd
    ending; there the chord strikes again, untied.
  - **Rests:** a chord with no guide tones rests in both lines and ends the run; the next chord restarts by rule 1.
  - **Collisions:** the lines are always complementary. If both pick the same tone, the smaller move keeps it (equal:
    the line moving down, else A) and the other takes the remaining tone, unless that leaps more than a tritone and
    trading makes the larger move smaller: then the lines trade. Both lines are built whichever is shown, so
    a lone line still gives way where they collide. They may cross; with both on the notes are sorted by pitch at each
    chord, upper first.
  - **Form:** repeats and endings are voiced in written order, a 2nd ending from the 1st ending's last chord; the
    line neither loops nor looks ahead.
- **Check:** `voiceLead` (the Viterbi pair search) is kept only as a comparison. `npm run guide-lines` measures the
  library (common tones, steps, leaps, every move over a tritone); `npm run guide-lines -- --compare` sets the lines
  against the pair search.
- **Model:** `guideVoices` voices the drawn rows before `buildChanges` splits them into lines, so 2 or 4 bars a line
  give the same pitches and a folded copy is voiced once. `ChangesBar.voices` holds each bar's `[line]` or
  `[upper, lower]` `GuideNote`s, and `ChangesChord.guide` each chord's labels, top to bottom. `GuideShow` is
  `{ fromThird, fromSeventh }`. Accidentals follow the measure rule over both voices together
  (`accidentalsInBar`), against the signature, or C without one.
- **Labels:** the degree without its accidental (`guideLabel`: `b3` → `3`, `bb7` → `7`), in a row under the staff,
  stacked when both are on; they print. They swap between voices as the line moves (7 over 3, then 3 over 7, through
  a ii–V–I).
- **Drawing** (`utils/changesDrawing.ts`; a line without voices draws its slashes as before):
  - Two passes: every bar's notes are formatted first; then the stem tips are read, an ending's bracket is raised
    above the highest (level across the line), and the staves and voices are drawn.
  - One note a chord, a dotted half for 3 beats, with the model's accidentals. Two voices: stems up and down, the
    upper voice's ties curving up and the lower's down; a rest goes in the upper voice with a `GhostNote` under it.
  - A third voice of `GhostNote`s keeps a position for every beat (`xs`), so chords, numerals and scales still sit
    over each chord's first note.
  - Line 1 gets the part's clef whenever a guide is on; the key signature only with signatures on.
  - The aria-label adds `; guide tones: C5 7 / F4 3, …` after `Bars: …`.

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
  (`keySignature` in `engine/keySignature.ts`; a minor key by its relative major, none without a `key:`), once at the
  start, as on a jazz lead sheet: the first staff of each scale sheet part (`StaffModel.showClefAndKey`) and the
  first Changes line; every other staff and line has neither. With a guide tone on, the first Changes line gets the
  clef even with the flag off or without a `key:`. The key is the chart's `key:` (`chartKeyOf`) throughout: key
  changes go by accidentals only, and show in the analysis (the Changes sheet's key-area labels), never as a new
  signature. Notes follow the measure rule (`accidentalsInBar`): an accidental shows only where it differs from what
  is in force in the bar (guide tones: both voices together, against C without a signature). The first Changes line
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
  - `PreviewControls`, the preview toolbar: Work on, Instrument, From root/From X, then Intervals (on the Changes: Numerals, Scales, From 3rd and From 7th) with the chart's actions (Transpose…, Focus, Print), a row of their own below lg and two by two on a phone.
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
  - With guide tones on, `changesLinesPerPage` (`engine/changes.ts`) gives fewer: 6 for one guide and 5 for both
    with numerals and scales, one more with both rows off. `print.spec.ts` prints the tallest case (both guides,
    numerals, scales, an ending and a bass part) a sheet page to a letter page.
  - The chord row and spacing are shorter in print; lines with a clef or guide tones close up (`print:space-y-0`).
  - Print always uses 4 bars a line.
  - Lines never split across pages.
- **Saving a PDF:** users choose "Save as PDF" in the browser's print dialog. There is no server-side PDF.

## 7. Library

- **Loading:** `import.meta.glob('../../../charts/*.txt', { query: '?raw', eager: true })` in
  `app/utils/library.ts` gives `{ slug, title, subtitle, composer, text }[]` at build time, skipping sync-tool
  copies (`giant_steps 2.txt`, `isSyncCopy`). The same parser runs, and a test fails the build if any library
  chart has errors. Search matches the title or the composer.
- **Heading:** `chartHeading` (engine/chart.ts) gives what the library, the editor and every sheet show: the title,
  a line built from the subtitle (or, without one, `style:`), `key:` (`E♭ minor`) and `form:`, and the composer
  (right-aligned under the heading on a sheet's first page, as on a lead sheet). `chartMeta` stays the title and
  subtitle as written, which the chart grid edits.
- **Contents:** 241 charts.
  - Autumn Leaves, Blue Bossa, Stella by Starlight, All the Things You Are, Lady Bird.
  - F and B♭ blues, jazz blues and Bird blues.
  - 222 tunes transcribed (chords only; `composer:`, `style:`, `key:`, `form:`, `source:` from its index) from the
    Colorado Cookbook, a lead-sheet collection kept out of the repo in `design/leadsheets/`. Their scales are the
    qualities' defaults until the analyser (plan-analysis.md) writes them.
  - Rhythm changes.
  - Modal tunes: So What, Impressions, Milestones, Maiden Voyage, Footprints.
  - Modes of the major scale and of melodic minor.
- **Search:** a case- and accent-insensitive substring filter on the title, client-side.
- **Opening a chart** copies it into the editor's state; library files are never changed.
- **Requests:** "Request a chart" opens the contact form, where a photo or PDF of the changes can be attached.

## 7a. Harmonic analysis

The rule set in [plan-analysis.md](plan-analysis.md), built as `web/engine/analysis/` (pure TypeScript) and the
script `web/scripts/analyse.ts`. The site doesn't run it: it fills in the charts' scales, and their comments say
why.

- **Passes:** `stream.ts` (chords as heard, slash readings applied, with durations; the form wraps), `keys.ts`
  (cadences, the global key from `key:` or by score, key areas, the modal and blues contexts), `rules.ts` (each
  chord's function in its local key and its scale, by family, with the rule's id and a reason). Dominants derive
  their tensions from the key's reference scale under the symbol's pins; the other families read the scale off the
  function.
- **`analyse(doc)`** reports; **`applyAnalysis(doc, analysis, options)`** fills blank scale cells (`fill`), or
  rewrites every cell but `# keep:` rows (`force`), and with `save` writes the reason as each row's trailing
  comment, `# area:` lines where the key area changes, and an `# analysis: <date>, rules v<N>; <key>` header (kept
  as it was when nothing else changed, so a rerun is a no-op). A `@copy` repeat whose verdict differs from its
  source row is reported and noted in the source row's comment; only the source line can be written, so the
library writes such a repeat out instead.
- **The CLI:** `npm run analyse -- charts/<tune>.txt` (or `--all`) prints a report per row: ✓ agrees with the
  chart, ≠ differs, blank, ? unreached. `--write`, `--force`, `--save` as above; `--quiet` gives the summary and
  the disagreements only.
- **The library:** every chart but the two modes charts is analysed and saved (`--force --save`); Milestones'
  Aeolian bridge is a `# keep:` (the melody says so). After a rule change, `npm run analyse -- --all --force
  --save`, then `make golden`, and read both diffs.
- **Stated functions:** a row's function cell is taken as given. Virtual targets: `V7/V` is read as a dominant
  of the key's V even when no V follows. An `@key` line makes a span of key areas from its bar to the next
  `@key`, overriding the detected ones. A key prefix (`D: V7/ii`) decides that one row only. A function that does
  not fit the chord in its key, or an `@key` naming no key, is a problem (reported; the grid marks the cell
  `aria-invalid`). Rules that could only guess carry a `fallback` flag, and `--ambiguous` lists those rows with
  the functions each might have and the key areas an `@key` would pin, each with a second `@key` back to the next
  area (an `@key` holds until the next); the grid's key-change button (`insertKeyChange`) adds the same pair. The
  analyser never writes a function or an `@key`. `rowNotes` (`engine/notes.ts`) gives each row's reason and key;
  the grid's Notes column and the Changes sheet's numeral/scale tooltips show it, the tooltip with where its key
  came from (a key the author set is starred), behind the `functions` flag (on).
- **Menus:** every scale the rules give a quality is among that quality's options in `chord_scales.json`
  (Phrygian Dominant and Mixolydian ♭6 on `7`, Phrygian on minor chords, Mixolydian ♭6 on `7sus4`), so a scale
  you change can be changed back from the menu.

## 8. State

- **`useChartEditor(initialText)`:**
  - State: `text`, `doc`, `diagnostics`, `fatal`, `rows`, `meta`.
  - `setText`: debounced re-parse.
  - `setDoc`: a grid edit, written back as canonical text.
  - `flush`: parse any pending typing now. It runs before printing and transposing.
  - Immutable updates only. The sheet (the Changes, the default, or Scales) and the mode are page state.
- **`usePreferences()`:** the instrument, the start note, the Intervals toggle and the Changes sheet's toggles
  (Numerals, Scales, and the guide tone lines From 3rd and From 7th, off until turned on; the stored keys keep their older names), each a `storedRef` saved per browser. A
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
  - Share links (`engine/share.ts`): `{ v: 1, chart, view }` as deflate-raw JSON in base64url after `#s=`. The view
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
    `practice` (the Practice panel) and `scaleLevels` (the Scale level control) are on, since sign-off. Guide tones
    on the Changes sheet have no flag: their toggles start off.

## 9. Security

Pages are static, and the only server code is the contact function, so the attack surface is small. The measures:

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

- **Golden fixture:** `fixtures/golden.json` freezes the engine's answers. `web/engine/__tests__/goldenFixture.ts`
  builds it from:
  - every scale × 21 roots (7 letters × ♭/♮/♯) × 5 parts (treble in C, B♭, E♭ and F, plus bass clef in C) → written root, notes, label, or error
  - `scale_notes` for both modes, both clefs, and several start notes
  - chord-symbol tokens for a chord corpus, including slash chords
  - scale options (with `note`, `default`, `outside`) and defaults for a chord corpus
  - the parsed rows of each chart in `charts/`, and two inline charts for parser edge cases

  `fixtures/analysis.json` is the analyser's report over every library chart, one row per line (key, areas, and
  each row's scale, rule, function and reason); `make golden` rewrites both fixtures.

  The golden test compares each section with readable mismatches, then checks that the file is exactly what the
  engine writes now (so a new chart or scale can't go uncovered). After an intended change to the engine,
  `chord_scales.json` or `charts/`: `make golden`, then review the diff. The file was first written by the Python
  CLI's exporter; the TS engine reproduced it byte for byte when the CLI was retired.
- **Engine unit tests (vitest),** written test-first alongside each module. They cover what fixtures can't:
  - quality resolution, interval roots, diagnostics and limits
  - transposition spelling
  - interval names
  - guide tones: the timeline (form lengths, metres), `guideToneLines` (one test a rule, named for its number, the spec's three worked examples, and the library: complementary at every chord, every pitch in range), `guideVoices` (ties and `tiedIn`, dotted
    halves, the measure rule over both voices, rests for unknown chords, an unreadable scale ignored, the bass range),
    holds, and a library test that no tie reaches into another block
  - the Changes sheet with guide tones: off is today's sheet, a folded copy is voiced once, a 2nd ending follows the
    1st ending's last chord, 2 and 4 bars a line give the same pitches, and `changesLinesPerPage`
  - the analyser: one test per rule (`analysis.test.ts`, named for the rule, from a real tune), key finding,
    key areas and contexts, and writing back (fill, force, keep, save, rerun, `@copy` conflicts)
- **App tests (`web/test/`):** `@nuxt/test-utils` (Nuxt runtime, happy-dom) with Vue Test Utils. They cover:
  - `useChartEditor` sync and debounce
  - library build and search
  - scale choices, `ChartGrid` edits and validation, and the `ScaleCell` dropdown and dialog
  - `ChartTranspose`
  - the preview controls (`EditorView`)
  - `ScaleSheet` pagination with `ScaleStaff` stubbed; `ChangesSheet` (the clef with a guide on, the print gap, lines
    a page) and the `ChangesSystem` label row
  - feature flags, preferences, and the Catalyst components (`test/ui/`)

  VexFlow drawing needs a real browser, so the E2E tests cover it.
- **Local preview:** `make dev` (live reload) and `make preview` (the production static build, served locally).
- **E2E (`web/e2e/`, Playwright with Chromium, against the production static build, all flags on):**
  - library search and open, and the staff count
  - grid ⇄ text sync, rejected cells, and the scale prompt and dialog (with focus return)
  - the mode toggle
  - My charts: auto-save and reload, your version and Revert, Save as a copy, Delete, Download and Open (file
    picker and drop), share links in a fresh browser context, damaged links
  - Transpose
  - interval labels
  - guide tones on the Changes sheet: the From 3rd and From 7th toggles and their labels, two voices' stems and ties (and their
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
  - The jobs: lint, typecheck (`nuxt typecheck` plus the engine and e2e tsconfigs),
    vitest, `nuxt build`, the header check, `npm audit --omit=dev` (gating), and an e2e job.
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
   then comes from the quality's default in `chord_scales.json`. The editor prompts when it can't resolve a
   quality.
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
7. **Guide tones** are two lines on the Changes sheet (the separate sheet is gone), in the chart's metre, from the
   3rd and from the 7th ([spec](superpowers/specs/2026-10-10-guide-tone-lines-design.md)). Triads use 3 + root,
   because the root resolves by step from a V7 where the 5th would leap. The lines are greedy rules, not a global
   search: each steps to the nearest guide tone, they stay complementary, and a repeated chord holds. The older
   per-degree toggles and the Viterbi pair search (`voiceLead`, now only a comparison) are superseded.
8. **One spelling at a time** in the preview (From X or From root).
9. **Transpose, interval labels and guide tones** were built on the ported engine, so they inherit its spelling
   rules.
10. **Versioning: the commit is the release.** Every merge to main deploys, so there's no number to bump. The
    version is the commit's date (UTC) and short hash, e.g. `2026.10.07 · 1e2bea5` (`build/version.ts`, in
    `runtimeConfig.public.version`): shown in the footer and added to each contact-form email. Named milestones
    are annotated git tags (`v1-launch`). Revisit SemVer only if the engine is published as a package.
11. **The Python CLI is retired** (after the `v1-launch` tag). Its one unique strength was LilyPond's engraving;
    the browser's Save as PDF covers printing, and keeping two engines in step doubled every change. The golden
    fixture it wrote is kept, now regenerated by the TS engine. Revisit if LilyPond can run on Vercel.
