# Chord Scale Maker

Chord-scale practice sheets from a chord chart, at [chordscalemaker.com](https://www.chordscalemaker.com). Each
chord in a chart gets one staff with the scale that goes with it, written for your instrument. Scales are computed
from their degree formulas, so spellings are always correct. There's also a guide tone sheet (each chord's 3rd and
7th, voice-led into two lines) and a practice mode that highlights a chosen set of notes.

The web app lives in `web/` (Nuxt 4, Tailwind CSS, VexFlow). Pages are prerendered and served by Vercel; the only
server code is the contact form.

> The original Python CLI, `jazz_scales.py`, which typeset the sheets with LilyPond, was retired after
> `v1-launch`. `git checkout v1-launch` brings it back.

## Charts

Charts live in `charts/`, one plain-text file each, always in **concert pitch**. Every file there appears in the
library on the next build (or at once in `make dev`).

```
title: Autumn Leaves
subtitle: Full Form, Alternate Changes

# section | bar | chord | scale
A1 | 1 | Cm7   | C Dorian
A1 | 2 | F7    | F Mixolydian
A1 | 3 | Bm7   | B Dorian
A1 | 3 | E7    | E Mixolydian
@copy A1 A2 8
```

| Element | Meaning |
| --- | --- |
| `section \| bar \| chord \| scale \| function` | One row per chord. Two chords in a bar are two rows with the same bar number. A chord lasts until the next bar number. |
| `section \| bar \| chord` | Scale omitted: the chord quality's default from `chord_scales.json` (`Cm7` → `C Dorian`). |
| `… \| function` | Optional: what the chord does, as the Changes sheet writes it (`V7/ii`, `subV7`, `ii7/V`, `♭VII7`, `IVmaj7`), in the key area, or in another key before a colon (`D: V7/ii`). The analyser takes it as given when it picks the scale; it never writes one. |
| `@key SECTION BAR KEY` | The key from that bar until the next `@key` (`@key B 17 D`), where the analyser's own key areas would be wrong. It never writes one. |
| `@copy SRC DST OFFSET` | Repeat section `SRC` as `DST`, adding `OFFSET` to each bar number. |
| `@ending N SECTION FIRST [LAST]` | A 1st/2nd ending (volta) over `SECTION` bars `FIRST`..`LAST`; the section is played twice on the Changes sheet — repeat signs with the two endings bracketed. Write the two endings as sequential bars (e.g. 7–8 then 9–10). |
| `@segno SECTION BAR` / `@coda SECTION BAR` | A segno (𝄋) or coda (⊕) glyph above that bar on the Changes sheet (the coda marks both the "to the coda" departure and the coda arrival). |
| `@nav SECTION BAR TEXT` | A navigation instruction above that bar on the Changes sheet: `D.S. al Coda`, `D.C. al Fine`, `To Coda`, `Fine`. |
| `time: 3/4` | The metre: `2/4`, `3/4` or `4/4` (the default). The guide tone sheet writes its rhythm in it (the waltzes in the library say `3/4`). |
| `Intro`, `Coda`, `Tag`, `Ending` sections | Outside the form (`Tag 2` too): they print where they stand, but the form's turnaround goes back to its own bar 1, and each is analysed and timed on its own (its bars may be numbered from 1). `form:` counts only the form. |
| `title:`, `subtitle:` | The heading on each page. |
| `composer:`, `style:`, `key:`, `form:`, `source:` | About the tune: who wrote it, the feel (`Ballad`, `Medium up`, `Latin`…), the key (`Eb`, `Fm`), the form (`AABA, 32 bars`) and where the chart came from. Kept with the chart, not shown; `key:` is the analyser's starting point. |
| `#` | Comment line. A row may also end in a comment: `A \| 6 \| D7 \| D Phrygian Dominant  # V7 of G minor: b9 and b13 are in the key` (the `#` needs a space before it). |

Chord symbols: `Cm7`, `C-7`, `Cmi7`, `Bbm7`, `Am7b5`, `D7#5`, `G7#9b13`, `EbMaj7`, `C9`, `Csus`, `C7sus4b9`,
`D7/F#`, `Cm6/Eb`. Minor chords are shown with an en dash (`C–7`).

Scales are written `<root> <name>`, such as `Bb Dorian`, `D Half-Whole` or `G Altered`: 26 scales plus aliases, in
`web/engine/scales.ts`. Each chord quality's default and alternate scales are in `chord_scales.json`, with
**outside** options (tension to resolve) marked. A slash chord can take its scales from another chord on its
bass: `DbMaj7/C` is a sus♭9 chord on C, so it defaults to `C Phrygian` (`slash_chords` in `chord_scales.json`).

## Filling in the scales

The library's scales come from a harmonic analysis of each chart (the rules are in
[docs/plan-analysis.md](docs/plan-analysis.md)): each chord's function in its key decides its scale, and the
reason is saved as the row's comment. To fill in a new chart written with chords only:

```sh
cd web && npm run analyse -- ../charts/<tune>.txt --write --save
```

`--write` fills blank scale cells only; `--force` rewrites every cell the rules reach except rows whose comment
starts `# keep:`; `--save` writes the comments; `--all` runs over every chart. Without flags it only reports.
`--ambiguous` lists the chords the rules could only guess at, each with the functions it might have, and the key areas
an `@key` would pin.

## Instruments

| Instrument | Clef | Key |
| --- | --- | --- |
| Concert, piano, vibes, flute, guitar | treble | C |
| Trumpet, flugelhorn, clarinet, soprano sax, tenor sax | treble | B♭ |
| Alto sax, bari sax | treble | E♭ |
| Horn | treble | F |
| Trombone, tuba, bass | bass | C |

For transposing instruments the notes, chord symbols and scale names are all transposed, and the start note is a
*written* pitch. Enharmonic spellings are chosen per scale to avoid double accidentals and B♯/E♯/C♭/F♭ (concert
Bm7 becomes C♯m7 on a B♭ instrument, not D♭m7). Octave transpositions don't matter: every scale sits in a
comfortable written range.

Every sheet starts with a clef and the key signature as written for your instrument (a chart with no `key:` gets none;
an `@key` draws a new one mid-line on the Changes sheet). Accidentals the signature already supplies aren't repeated,
and one that is cancelled within a bar shows a natural.

## Developing

```bash
make setup     # once: npm ci in web/
make dev       # live-reloading dev server at http://localhost:3000
make preview   # build the production site and serve it locally
make test      # typecheck and unit tests (vitest)
make lint
make e2e       # browser tests (Playwright, Chromium) against the production build
make golden    # rewrite fixtures/golden.json after an intended engine change
```

- **Add a scale:** a degree formula in `SCALES` in `web/engine/scales.ts` (`'lydian dominant': ['1 2 3 #4 5 6 b7',
  'Lydian Dominant']`), pair it with chord qualities in `chord_scales.json`, add tests, then `make golden` and
  review the fixture's diff.
- **Add an instrument:** `INSTRUMENTS` in `web/engine/instruments.ts`.
- **Add a chart:** a `.txt` file in `charts/`, then `make golden` (the fixture covers every library chart).

`fixtures/golden.json` freezes the engine's answers over a wide set of scales, chords, start notes and charts. It
began as the Python engine's answers, and the TypeScript engine reproduces them exactly; any change in behaviour
now shows up as a diff to review.

Unfinished features are behind flags, off by default: `NUXT_PUBLIC_FEATURES_MY_CHARTS=true make dev` shows
**New chart**. The design is in [docs/design.md](docs/design.md).
