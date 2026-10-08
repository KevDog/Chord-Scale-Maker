# jazz-scales

Generate chord-scale practice sheets from a chord chart. Each chord in the
chart becomes one staff of whole notes (no time signature), labelled with the
chord symbol and scale name. Scales are computed from their names, so spellings
are always correct. Parts can be transposed for any common jazz instrument.

## Requirements

- Python 3.8 or later (standard library only)
- [LilyPond](https://lilypond.org) 2.24 or later on your `PATH`
  - macOS: `brew install lilypond`
  - Debian/Ubuntu: `sudo apt install lilypond`
- `pdfinfo` (poppler) is optional; it improves automatic page fitting

## Quick start

```bash
python3 jazz_scales.py charts/autumn_leaves.txt
python3 jazz_scales.py charts/autumn_leaves.txt -i tenor-sax
python3 jazz_scales.py charts/autumn_leaves.txt -i trombone --from Eb
```

Each run writes a `.ly` file and a `.pdf` next to the script (use `-o output/name`
to choose the location and basename).

## Chart format

Charts are plain text, always written in **concert pitch**:

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
| `section \| bar \| chord \| scale` | One row per chord. Two chords in a bar are two rows with the same bar number. |
| `section \| bar \| chord` | Scale omitted: the chord quality's default from `chord_scales.json` is used (e.g. `Cm7` → `C Dorian`). |
| `@copy SRC DST OFFSET` | Repeat section `SRC` as `DST`, adding `OFFSET` to each bar number. |
| `title:`, `subtitle:` | Printed at the top of each page. |
| `#` | Comment line. |

Chord symbols accepted: `Cm7`, `C-7`, `Cmi7`, `Bbm7`, `Am7b5`, `D7#5`, `G7#9b13`,
`EbMaj7`, `C9`, `D7/F#`, `Cm6/Eb`. Minor chords are printed with an en dash (`C–7`).

Scales are written as `<root> <name>`, for example `Bb Dorian`, `D Half-Whole`,
`G Altered`. Run `python3 jazz_scales.py --list-scales` for the full list (26
scales plus aliases).

A slash chord can take its scales from another chord on its bass: `DbMaj7/C` is a sus♭9 chord on C, so it
defaults to `C Phrygian` (rules in `chord_scales.json` under `slash_chords`). The symbol prints as written.

## Output

By default the PDF contains two parts:

1. **Spelled from a fixed note.** Every scale is written in the octave starting
   at middle C (`--from` changes the note; `--from F#3` sets the octave). If the
   start note is not in a scale, the scale begins on the next note above it.
2. **Spelled from the root.** Each scale is written from its own root.

`--mode from` or `--mode root` produces one part only.

## Instruments

```
python3 jazz_scales.py --list-instruments
```

| Preset | Clef | Key |
| --- | --- | --- |
| `concert` (default), `piano`, `vibes`, `flute`, `guitar` | treble | C |
| `trumpet`, `flugelhorn`, `clarinet`, `soprano-sax`, `tenor-sax` | treble | Bb |
| `alto-sax`, `bari-sax` | treble | Eb |
| `horn` | treble | F |
| `trombone`, `tuba`, `bass` | bass | C |

For transposing instruments the notes, chord symbols and scale names are all
transposed. `--from` is always a *written* pitch. `--clef` and `--transpose`
override a preset. Enharmonic spellings are chosen per scale to avoid
double accidentals and B#/E#/Cb/Fb (for example, concert Bm7 becomes C#m7 on a
Bb instrument, not Dbm7). Octave transpositions (tenor, bari, guitar, bass) do
not affect the output because every scale is placed in a comfortable written
range.

## Options

```
-o, --output NAME       output basename (default: derived from title and instrument)
-i, --instrument NAME   instrument preset (default: concert)
--clef {treble,bass}    override the preset's clef
--transpose {C,Bb,Eb,F} override the preset's transposition
--mode {from,root,both} which part(s) to produce (default: both)
--from NOTE             written start note for the "from" part (default: C4 treble, C3 bass)
--per-page N            force N staves per page (default: automatic)
--no-pdf                write the LilyPond file only
--list-scales           show supported scales and aliases
--list-instruments      show instrument presets
--version               the commit this copy is from, with its date (e.g. 2026.10.07 · 1e2bea5)
```

## Adding a scale or instrument

Both live in dictionaries near the top of `jazz_scales.py`:

- `SCALES`: `"name": ("degree formula", "Printed label")`, e.g.
  `"lydian dominant": ("1 2 3 #4 5 6 b7", "Lydian Dominant")`.
- `INSTRUMENTS`: `"name": ("clef", "key", "description")`.

The web app has its own copy in `web/engine/scales.ts` and `web/engine/instruments.ts`. Add the same entry there,
then run `make fixtures` and `make test`: the parity test fails until the two engines agree. Default and
alternate scales per chord quality live in `chord_scales.json`, which both engines read.

## Web app

The web version lives in `web/` (Nuxt 4, Tailwind CSS, VexFlow) and is deployed as a static site.

```bash
make setup     # once
make dev       # live-reloading dev server at http://localhost:3000
make preview   # build the production static site and serve it locally
make e2e       # browser tests (Playwright, Chromium) against the production build
```

What the editor does:

- **Library:** every chart in `charts/`. Add a `.txt` file there and it appears on the next build (or at once in
  `make dev`). **Request a chart** opens a GitHub issue labelled `Add Chart`.
- **Editing:** a grid and the chart text side by side, kept in sync. Each chord gets its quality's default scale
  or one of its alternates. **Outside** options (tension to resolve, such as a pentatonic off the b5) are listed
  separately, and **Other…** picks any root and scale.
- **Instrument:** the sheet is written for the chosen instrument (clef, key, chord symbols); the chart itself
  stays in concert pitch.
- **Transpose…** rewrites the chart's chords and scale roots in another concert key, spelled for that key: flats
  in flat keys, sharps in sharp keys. The CLI has no equivalent.
- **Scales sheet:** one staff per chord, either every scale from one start note (**From C**) or each from its
  root (**From root**). **Intervals** labels every note against the chord root (b9, #11, b13…) on screen.
- **Guide tones sheet:** each chord's 3rd and 7th, voice-led into two complementary lines (one starting on the
  3rd, one on the 7th), in 4/4 systems of 4 bars (2 on phones).
- **Print / Save PDF:** the browser's print dialog, 12 staves or 8 guide tone systems a letter page.

The live site counts page views with Vercel Web Analytics (cookieless, no cross-site tracking), in production
builds only.
Unfinished features are behind flags, off by default: `NUXT_PUBLIC_FEATURES_NEW_CHART=true make dev` shows
**New chart**. The design is in [docs/design.md](docs/design.md).

## Tests

```bash
make setup   # once: .venv with pytest, npm ci in web/
make test    # pytest + the TypeScript engine (typecheck, vitest)
```

`web/engine/` is a TypeScript port of the engine for the web app. `fixtures/golden.json`
records the Python engine's answers and the TS tests must match them; run `make fixtures`
after changing `jazz_scales.py`, `chord_scales.json` or `charts/`.
