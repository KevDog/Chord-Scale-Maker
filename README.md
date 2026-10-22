# Chord Scale Maker

Endless improvisation practice sheets for jazz standards, at [chordscalemaker.com](https://www.chordscalemaker.com). A chart
opens on the Changes sheet, a study lead sheet with each chord's Roman numeral and scale under it; its Line control
(Off · Guide Tones · 7th Chords) puts one line on the staff at a time. Guide Tones (From 3rd · From 7th) starts on the
first chord's 3rd or 7th and moves to the nearest guide tone of each chord; 7th Chords arpeggiates each chord's four
chord tones in one of ten patterns, in quarters, eighths or sixteenths by how many chords share the bar. The Scales sheet gives each chord one staff with the
scale that goes with it. Everything is written for your instrument, and scales are computed from their degree
formulas, so spellings are always correct. A practice mode highlights a chosen set of notes.

The web app lives in `web/` (Nuxt 4, Tailwind CSS, VexFlow). Pages are prerendered and served by Vercel; the only
server code is the contact form.

The engine — chart parsing, harmonic analysis, scales and spelling, guide tones, the sheet models — is its own
package, `@chord-scale-maker/engine` in `engine/`, with the chart library, `chord_scales.json`, its fixtures and the
analyser. It is pure TypeScript with no dependencies; the app imports it by name.

> The original Python CLI, `jazz_scales.py`, which typeset the sheets with LilyPond, was retired after
> `v1-launch`. `git checkout v1-launch` brings it back.

## Charts

Charts live in `engine/charts/`, one plain-text file each, always in **concert pitch**. Every file there appears in the
library on the next build (or at once in `make dev`).

```
title: Autumn Leaves
subtitle: Full Form, Alternate Changes
key: Gm

section: A1
# bar | chord | scale
1 | Cm7   | C Dorian
2 | F7    | F Mixolydian
3 | Bm7   | B Dorian
3 | E7    | E Mixolydian
…

section: A2
copy: A1

section: B
bars: 16
1 | Am7b5
…
```

The lines before the first `section:` are the header (the song's fields below). Each `section:` line opens a block:
its own fields straight under it, then its rows and directives, until the next `section:`. Bars count from 1 in each
section.

| Element | Meaning |
| --- | --- |
| `section: NAME` | Opens a section block (a name without spaces). A second section of the same name is an error. |
| `bar \| chord \| scale \| function` | One row per chord, its bar counted from 1 in its section. Two chords in a bar are two rows with the same bar number. A chord lasts until the next bar number in the section; the section's last chord lasts to the section's end. |
| `bar \| chord` | Scale omitted: the analyser's choice, at the sheet's level: the stated function's scale if the row has one, else the rules'. Where the analysis doesn't reach the chord, the quality's default from `chord_scales.json` (`Cm7` → `C Dorian`). |
| `… \| scale` | The scale as written, at every level: a pin, the player's choice over the analyser's. Say why with a `# keep: …` comment. |
| `… \| function` | Optional: what the chord does, as the Changes sheet writes it (`V7/ii`, `subV7`, `ii7/V`, `♭VII7`, `IVmaj7`), in the key area, or in another key before a colon (`D: V7/ii`). The analyser takes it as given when it picks the scale; it never writes one. |
| `bars: N` (in a section) | The section's length, when its last chord is held past its last written bar (`bars: 8` with the last chord on bar 7). Without it, the section ends with its last written bar. |
| `key: KEY` (in a section) | The section's key area, from its bar 1 to its end, where the analyser's own key areas would be wrong; then the analysis finds the key again. It never writes one. |
| `@key BAR KEY` | A key change inside a section, from that bar to the section's end (`@key 5 D`). |
| `copy: SRC` (in a section) | The section repeats section `SRC` (above it): its rows, and its `key:`, `time:`, `context:`, `bars:`, key and metre changes, unless this section sets its own `key:` or `time:` (which replaces the source's changes of it too). It has no rows of its own; it may have its own endings, marks and nav. |
| `outside: yes` (in a section) | The section is outside the form, as an `Intro` or `Coda` is: before the form if it comes before the first section in it, after it otherwise. |
| `alt BAR \| chord …` | An alternate row, in the same section and bar numbering as the rows: the alternate set's chords for that bar (`alt 8 \| Abm7`, with the same optional scale and function cells). A bar with any `alt` rows plays exactly those chords in the alternate set; bars with none are shared. `copy:` carries them; an `alt` row past the section's end, or in a `copy:` section, is an error. The player chooses which set is main; a chart is never written with that choice. |
| `time: 3/4` (in a section) | The section's metre, from its bar 1; carried by `copy:`. |
| `@time BAR METRE` | A metre change inside a section, from that bar to the section's end (`@time 11 2/4`, then `@time 12 4/4` for one 2/4 bar). |
| `context: modal` | How the analyser reads the chart: `functional` (cadences and key areas, the usual), `modal` (each chord its own mode, no key areas) or `blues` (no key areas; the I, IV and V by their degree: Mixolydian, a minor blues' i and iv Dorian, the key's Blues scale at Basic; the I is `key:`, else bar 1). A 12- or 24-bar blues is found by itself; write `context: blues` for any other blues form (9, 13, 16 bars). Without it the analyser decides by detection, and says which in its report; write it where the detection is wrong or borderline (`npm run analyse -- … --ambiguous` names those). `minor:` is reserved: accepted and ignored. |
| `context:` (in a section) / `@context BAR CONTEXT` | The context for a section, or from a bar to its section's end. Parsed and checked; the analyser does not use them yet (its report says so) and keeps the chart's context. |
| `@ending N FIRST [LAST]` | A 1st/2nd ending (volta) over the section's bars `FIRST`..`LAST`; the section is played twice on the Changes sheet — repeat signs with the two endings bracketed. Write the two endings as sequential bars (e.g. 7–8 then 9–10). |
| `@segno BAR` / `@coda BAR` | A segno (𝄋) or coda (⊕) glyph above that bar on the Changes sheet (the coda marks both the "to the coda" departure and the coda arrival). |
| `@nav BAR TEXT` | A navigation instruction above that bar on the Changes sheet: `D.S. al Coda`, `D.C. al Fine`, `To Coda`, `Fine`. |
| `time: 3/4` | The song's metre: `2/4`, `3/4`, `4/4` (the default), `5/4`, `6/4` or `7/4`. The Changes sheet writes its slashes and guide tones in it (the waltzes in the library say `3/4`), with a time signature wherever a bar's metre changes. |
| `Intro`, `Coda`, `Tag`, `Ending` sections | Outside the form (`Tag2` too): they print where they stand, but the form's turnaround goes back to its own bar 1, and each is analysed and timed on its own. `form:` counts only the form. |
| `title:`, `subtitle:` | The heading on each page. |
| `composer:`, `style:`, `key:`, `form:`, `source:` | About the tune: who wrote it, the feel (`Ballad`, `Medium up`, `Latin`…), the key (`Eb`, `Fm`), the form (`AABA, 32 bars`) and where the chart came from. Kept with the chart, not shown; `key:` is the analyser's starting point. |
| `aka:` | The tune's other titles, `;` between them (a title may hold a comma): `aka: Blue Train`. Shown on its song page and found by the library search. |
| `version:` | Which version of the tune this chart is, when the library holds several: `version: Jazz Mind Accelerator`. A chart without one is the tune's main chart; a version's file is named `<title>-<version>.txt`. |
| `recording:` | One notable recording: artist; album; label; year, `;` between them (an album may hold a comma); the label and year may be left empty: `recording: John Coltrane; Blue Train; Blue Note; 1958`. The year is the release year. Shown on its song page. |
| `youtube:` | The 11-character YouTube video ID of that recording, from an official upload (`youtube: AbCdEfGhIjK`); `(link only)` after one that won't play embedded (`youtube: AbCdEfGhIjK (link only)`): the song page then links to it, with no player. Only with `recording:`. |
| `contributor:` | Who sent the chart for the library (the contact form's credit, when they asked for it): `contributor: Bill Evans`. Shown on its song page as "Chart contributed by …". |
| `kind:` | `tune` (the default), `form` (a progression with no composer: F Blues, Rhythm Changes) or `exercise`. A library chart needs `title:`, `key:`, `style:` and `form:`, and a tune its `composer:`; `make test` fails without them. |
| `#` | Comment line. A row may also end in a comment: `6 \| D7 \| D Phrygian Dominant  # V7 of G minor: b9 and b13 are in the key` (the `#` needs a space before it). |

Chord symbols: `Cm7`, `C-7`, `Cmi7`, `Bbm7`, `Am7b5`, `D7#5`, `G7#9b13`, `EbMaj7`, `C9`, `Csus`, `C7sus4b9`,
`D7/F#`, `Cm6/Eb`. Minor chords are shown with an en dash (`C–7`). `N.C.` (no chord) is a rest: it is drawn on the
Changes sheet, with no scale and no staff on the Scales sheet, and the analysis reads the chords around it as neighbours.

Scales are written `<root> <name>`, such as `Bb Dorian`, `D Half-Whole` or `G Altered`: 26 scales plus aliases, in
`engine/src/scales.ts`. Each chord quality's default and alternate scales are in `chord_scales.json`, with
**outside** options (tension to resolve) marked. A slash chord can take its scales from another chord on its
bass: `DbMaj7/C` is a sus♭9 chord on C, so it defaults to `C Phrygian` (`slash_chords` in `chord_scales.json`).

## Choosing the scales

A blank scale cell plays a harmonic analysis of the chart (the rules are in
[docs/plan-analysis.md](docs/plan-analysis.md)): each chord's function in its key decides its scale, at the level
the sheet is set to (Basic, Standard, Advanced, Random). The level is the player's, not the chart's: it is never
written into the rows. So a chart is written with chords only, plus a function (`| | V7/ii`), a section `key:` or an `@key` where the
analyser would guess, and a scale only where the tune demands one over the rules. The analyser explains itself:

```sh
cd engine && npm run analyse -- charts/<tune>.txt --save
```

Without flags it only reports. `--save` writes the reasons into the chart as comments; `--all` runs over every
chart. `--ambiguous` lists the chords the rules could only guess at, each with the functions it might have, and the
key areas a section `key:` or `@key` would pin. `--strip` blanks every written scale the rules already give (never a `# keep:` row)
and lists the rest.

## Instruments

| Instrument | Clef | Key |
| --- | --- | --- |
| Piano, vibes, flute, guitar (violin, oboe: choose Flute) | treble | C |
| Trumpet, flugelhorn, clarinet, soprano sax, tenor sax | treble | B♭ |
| Alto sax, bari sax | treble | E♭ |
| Horn | treble | F |
| Trombone, tuba, bass | bass | C |

For transposing instruments the notes, chord symbols and scale names are all transposed, and the start note is a
*written* pitch. Enharmonic spellings are chosen per scale to avoid double accidentals and B♯/E♯/C♭/F♭ (concert
Bm7 becomes C♯m7 on a B♭ instrument, not D♭m7). Octave transpositions don't matter: every scale sits in a
comfortable written range.

Every sheet starts with a clef and the key signature as written for your instrument, once, at the start, as on a jazz
lead sheet (a chart with no `key:` gets no signature). Key changes are written with accidentals only, and shown in the
analysis: the Changes sheet labels each key area. Accidentals the signature already supplies aren't repeated, and
one that is cancelled within a bar shows a natural.

## Developing

```bash
make setup     # once: npm ci at the root (installs the packages: engine/, web/ and cli/), and the git hooks
make dev       # live-reloading dev server at http://localhost:3000
make preview   # build the production site and serve it locally
make test      # typecheck and unit tests (vitest), every package
make lint
make e2e       # browser tests (Playwright, Chromium) against the production build
make a11y      # accessibility: the template lint and axe scans (the pre-push hook runs it when web/app/ changed)
make golden    # rewrite engine/fixtures/golden.json after an intended engine change
```

- **Add a scale:** a degree formula in `SCALES` in `engine/src/scales.ts` (`'lydian dominant': ['1 2 3 #4 5 6 b7',
  'Lydian Dominant']`), pair it with chord qualities in `chord_scales.json`, add tests, then `make golden` and
  review the fixture's diff.
- **Add an instrument:** `INSTRUMENTS` in `engine/src/instruments.ts`.
- **Add a chart:** a `.txt` file in `engine/charts/`, named in lowercase with hyphens (`round-midnight.txt`), then `make golden` (the fixture covers every library chart).

`engine/fixtures/golden.json` freezes the engine's answers over a wide set of scales, chords, start notes and charts. It
began as the Python engine's answers, and the TypeScript engine reproduces them exactly; any change in behaviour
now shows up as a diff to review.

Unfinished features go behind flags, off by default (none at the moment): `NUXT_PUBLIC_FEATURES_<NAME>=true make dev`
turns one on. The design is in [docs/design.md](docs/design.md).
