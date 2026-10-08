# Claude Code notes for jazz-scales

## What this is
A single-file Python CLI (`jazz_scales.py`) that turns a concert-pitch chord
chart (`charts/*.txt`) into a LilyPond file and PDF of chord scales, one staff
per chord, optionally transposed for a jazz instrument. See README.md for the
chart format and options.

## Working here
- No third-party Python packages. Keep it that way unless there is a strong reason.
- LilyPond must be installed to produce PDFs; `--no-pdf` writes the `.ly` only.
- `make setup` once, then `make test` after changes: pytest (scale spelling, transposition,
  enharmonic choice, chart parsing, fixture freshness) plus the TS engine's typecheck and vitest.
- The web app's design is in `docs/design.md` (kept current; the `docs/plan-*.md` files are historical).
- `web/engine/` is a TS port of the Python engine. After changing `jazz_scales.py`,
  `chord_scales.json` or `charts/`, run `make fixtures` and port the change to TS. The golden
  parity test (`web/engine/__tests__/golden.test.ts`) fails until both agree. A stale fixture also makes pytest
  very slow (it diffs the large JSON), so run `make fixtures` first.
- Generated `.ly`/`.pdf` files belong in `output/` and are git-ignored.
- Web app: `make dev` / `make preview`; `make lint`; `make e2e` (Playwright). App code is in `web/app/`, its unit
  tests in `web/test/`, browser tests in `web/e2e/`. Pages must run under the hashed CSP (`web/build/csp.ts`):
  no inline `<script>` of our own, no `eval`, no third-party origins (one exception: the About video's frame from
  `youtube-nocookie.com`). Pages are prerendered; the only server code is `web/server/` (the contact form).
  Keep `web/engine/` free of Vue/DOM imports; put view logic that can be pure in the engine (`sheet.ts`, `edit.ts`).
- Runtime `dependencies` are only what ships to browsers (`vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`, `@fontsource-variable/jost`);
  CI gates on `npm audit --omit=dev`.
- Feature flags: `runtimeConfig.public.features` + `useFeature()`; new flags start off; e2e builds with all on.
- Versions are the commit's date and hash (`web/build/version.ts`); no number to bump.
  Milestones are annotated tags (`v1-launch`).
- UI is Tailwind Plus Catalyst ported to Vue in `web/app/components/ui/` (`<UiButton>`, `<UiListbox>`, …); build
  screens from these. The licensed kits live git-ignored in `design/tailwind-plus/`; never commit them.

## Design rules
- Charts are always concert pitch; `--from` is always a written pitch.
- Scales are computed from degree formulas in `SCALES`; never hand-type note lists.
- Enharmonic spelling is decided per scale by `simplify_root` (avoid double
  accidentals and B#/E#/Cb/Fb, then fewest accidentals, then keep the original
  sharp/flat direction). A chord symbol follows its scale's spelling when they
  share a root; a slash bass keeps its interval from the root. A slash chord may take its scale options from
  another chord on its bass (`slash_chords` in `chord_scales.json`: DbMaj7/C → C 7sus4b9); its symbol, labels and
  practice presets still read the chord as written.
- Page fitting: `--per-page` unset means the script compiles with decreasing
  staves per page until no page overflows.
- Transposing a chart to another key (editor only, `web/engine/transpose.ts`) spells roots on the target key's
  side (Dbm7 Gb7 in Bb, even with Cb/Fb in the scale); `simplify_root` decides in C, or if that side needs double
  accidentals. Instrument parts still use `simplify_root` alone.
- Chart rows may omit the scale; both engines use the quality's default from `chord_scales.json`.

## Typical requests
- "Make a chart for <tune>": create `charts/<tune>.txt` in concert pitch, one row
  per chord with a sensible scale, then run the script for the requested instrument.
- "Add scale X": add a formula to `SCALES` in both `jazz_scales.py` and `web/engine/scales.ts` (and an alias if
  common), add tests in both, then `make fixtures`.
- "Add instrument X": add to `INSTRUMENTS` with clef and key.
