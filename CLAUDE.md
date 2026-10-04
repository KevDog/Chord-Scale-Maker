# Claude Code notes for jazz-scales

## What this is
A single-file Python CLI (`jazz_scales.py`) that turns a concert-pitch chord
chart (`charts/*.txt`) into a LilyPond file and PDF of chord scales, one staff
per chord, optionally transposed for a jazz instrument. See README.md for the
chart format and options.

## Working here
- No third-party Python packages. Keep it that way unless there is a strong reason.
- LilyPond must be installed to produce PDFs; `--no-pdf` writes the `.ly` only.
- Run `python3 -m pytest tests` after changes. The tests cover scale spelling,
  transposition, enharmonic choice and chart parsing without needing LilyPond.
- Generated `.ly`/`.pdf` files belong in `output/` and are git-ignored.

## Design rules
- Charts are always concert pitch; `--from` is always a written pitch.
- Scales are computed from degree formulas in `SCALES`; never hand-type note lists.
- Enharmonic spelling is decided per scale by `simplify_root` (avoid double
  accidentals and B#/E#/Cb/Fb, then fewest accidentals, then keep the original
  sharp/flat direction). A chord symbol follows its scale's spelling when they
  share a root; a slash bass keeps its interval from the root.
- Page fitting: `--per-page` unset means the script compiles with decreasing
  staves per page until no page overflows.

## Typical requests
- "Make a chart for <tune>": create `charts/<tune>.txt` in concert pitch, one row
  per chord with a sensible scale, then run the script for the requested instrument.
- "Add scale X": add a formula to `SCALES` (and an alias if common), add a test.
- "Add instrument X": add to `INSTRUMENTS` with clef and key.
