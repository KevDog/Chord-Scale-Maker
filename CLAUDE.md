# Claude Code notes for jazz-scales

## What this is
Chord Scale Maker (www.chordscalemaker.com), a Nuxt web app in `web/` that turns a concert-pitch chord chart
(`engine/charts/*.txt`) into practice sheets written for a jazz instrument: the Changes (a study lead sheet, the default
view, with optional guide tones on the staff) and the Scales (one staff per chord, with practice highlighting). See
README.md for the chart format. The original Python/LilyPond CLI was retired after the `v1-launch` tag.

## Working here
- `make setup` once, then `make test` after changes (typecheck + vitest); `make lint`; `make e2e` (Playwright);
  `make a11y` (template lint + axe scans in `web/e2e/a11y/`, not in `make e2e`; the pre-push hook runs it when a push
  touches `web/app/`; known violations are exceptions in `web/e2e/a11y/axe.ts`, each with an issue); `make dev` / `make preview`.
- The design is in `docs/design.md` (kept current; the `docs/plan-*.md` files are historical).
- Two npm workspace packages: `engine/` (`@chord-scale-maker/engine`: the engine in `engine/src/`, pure TypeScript,
  with its data `chord_scales.json`, `charts/`, `fixtures/` and its tools in `engine/scripts/`) and `web/` (the Nuxt
  app). The app imports the engine only as `@chord-scale-maker/engine`; `engine/src/index.ts` is its public API, and
  `engine/src/__tests__/api.test.ts` snapshots the exported names. `engine/fixtures/golden.json` freezes its answers
  over a wide input set (`engine/src/__tests__/goldenFixture.ts`); after an intended change to the engine,
  `chord_scales.json` or `charts/`, run `make golden` and review the fixture's diff. The golden test fails until then.
- App code is in `web/app/`, its unit tests in `web/test/`, browser tests in `web/e2e/`. Pages must run under the
  hashed CSP (`web/build/csp.ts`): no inline executable `<script>` of our own (JSON-LD data blocks are fine), no `eval`, no third-party origins (one
  exception: the About video's frame from `youtube-nocookie.com`). Pages are prerendered; the only server code is
  `web/server/` (the contact form, and the sitemap, prerendered). Keep `engine/` free of Vue/DOM imports (its lint rule bars Vue, VexFlow and app imports; its tsconfig has no DOM); put view logic that can be pure in
  the engine (`sheet.ts`, `edit.ts`).
- Runtime `dependencies` are only what ships to browsers (`vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`,
  `@fontsource-variable/jost`, and the workspace's own `@chord-scale-maker/engine`, which has no dependencies);
  CI gates on `npm audit --omit=dev`. `overrides` are in the root `package.json`; the lockfile is the root `package-lock.json`.
- Feature flags: `runtimeConfig.public.features` + `useFeature()`; new flags start off; e2e builds with all on.
- Versions are the commit's date and hash (`web/build/version.ts`); no number to bump.
  Milestones are annotated tags (`v1-launch`).
- UI is Tailwind Plus Catalyst ported to Vue in `web/app/components/ui/` (`<UiButton>`, `<UiListbox>`, …); build
  screens from these. The licensed kits live git-ignored in `design/tailwind-plus/`; never commit them.

## Design rules
- Charts are always concert pitch; the start note ("From X") is always a written pitch.
- Scales are computed from degree formulas in `SCALES` (`engine/src/scales.ts`); never hand-type note lists.
- Enharmonic spelling is decided per scale by `simplifyRoot` (avoid double accidentals and B#/E#/Cb/Fb, then
  fewest accidentals, then keep the original sharp/flat direction). A chord symbol follows its scale's spelling
  when they share a root; a slash bass keeps its interval from the root. A slash chord may take its scale options
  from another chord on its bass (`slash_chords` in `chord_scales.json`: DbMaj7/C → C 7sus4b9); its symbol,
  labels and practice presets still read the chord as written.
- Transposing a chart to another key (`engine/src/transpose.ts`) spells roots on the target key's side (Dbm7 Gb7
  in Bb, even with Cb/Fb in the scale); `simplifyRoot` decides in C, or if that side needs double accidentals.
  Instrument parts still use `simplifyRoot` alone.
- Chart rows may omit the scale; the analysis is used (the stated function's scale, else the rules', at the sheet's
  level), and the quality's default from `chord_scales.json` only where the analysis doesn't reach. A written scale
  is a pin and plays at every level. The level is a view preference, never written into rows.

## Typical requests
- "Make a chart for <tune>": create `engine/charts/<tune-name>.txt` (lowercase, hyphens: `round-midnight.txt`) in concert pitch, chords only: a header with
  `key:`, `composer:`, `style:`, `form:` (and `source:` when known, `aka:` for its other common titles; `kind: form`
  or `kind: exercise` for a chart with no composer, like F Blues), then a `section: A1` block per section, one
  `bar | chord` row per chord change with bars from 1 in each section, a repeat as `section: A2` + `copy: A1`, and
  `bars: N` where a section's last chord is held past its last written bar (README "Charts"); then `cd engine && npm run analyse --
  charts/<tune-name>.txt --save` to save the reasons, read the report (its Song page section must show no gaps: they
  fail `make test`), then `--ambiguous`, `make golden` (the fixtures cover every library chart), and `make og` (its link preview image; a test fails until it's drawn). Leave the scale cells blank: they play the analysis. A scale the melody
  demands over the rules: write it, with `# keep: …`. Otherwise, where the analyser can only guess, write the
  function (`| | V7/ii`), a section `key:` or an `@key` rather than a scale: a function lets the rules still choose the tensions.
- Changing an analysis rule (`engine/src/analysis/`, docs/plan-analysis.md): a test first, then `make golden`, and
  read the fixture's diff (it is the review: the library's blank cells follow the rules by themselves).
  `cd engine && npm run analyse -- --all --strip --save` re-saves the reasons and blanks any written scale the new
  rule now gives.
- "Add scale X": add a formula to `SCALES` in `engine/src/scales.ts` (and an alias if common), pair it with chord
  qualities in `chord_scales.json`, add tests, then `make golden`.
- "Add instrument X": add to `INSTRUMENTS` in `engine/src/instruments.ts` with clef and key.
