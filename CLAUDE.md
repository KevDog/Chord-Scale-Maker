# Claude Code notes for jazz-scales

## What this is
Chord Scale Maker (www.chordscalemaker.com), a Nuxt web app in `web/` that turns a concert-pitch chord chart
(`charts/*.txt`) into practice sheets written for a jazz instrument: the Changes (a study lead sheet, the default
view, with optional guide tones on the staff) and the Scales (one staff per chord, with practice highlighting). See
README.md for the chart format. The original Python/LilyPond CLI was retired after the `v1-launch` tag.

## Working here
- `make setup` once, then `make test` after changes (typecheck + vitest); `make lint`; `make e2e` (Playwright);
  `make dev` / `make preview`.
- The design is in `docs/design.md` (kept current; the `docs/plan-*.md` files are historical).
- `web/engine/` is the engine, pure TypeScript. `fixtures/golden.json` freezes its answers over a wide input set
  (`web/engine/__tests__/goldenFixture.ts`); after an intended change to the engine, `chord_scales.json` or
  `charts/`, run `make golden` and review the fixture's diff. The golden test fails until then.
- App code is in `web/app/`, its unit tests in `web/test/`, browser tests in `web/e2e/`. Pages must run under the
  hashed CSP (`web/build/csp.ts`): no inline `<script>` of our own, no `eval`, no third-party origins (one
  exception: the About video's frame from `youtube-nocookie.com`). Pages are prerendered; the only server code is
  `web/server/` (the contact form). Keep `web/engine/` free of Vue/DOM imports; put view logic that can be pure in
  the engine (`sheet.ts`, `edit.ts`).
- Runtime `dependencies` are only what ships to browsers (`vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`,
  `@fontsource-variable/jost`); CI gates on `npm audit --omit=dev`.
- Feature flags: `runtimeConfig.public.features` + `useFeature()`; new flags start off; e2e builds with all on.
- Versions are the commit's date and hash (`web/build/version.ts`); no number to bump.
  Milestones are annotated tags (`v1-launch`).
- UI is Tailwind Plus Catalyst ported to Vue in `web/app/components/ui/` (`<UiButton>`, `<UiListbox>`, …); build
  screens from these. The licensed kits live git-ignored in `design/tailwind-plus/`; never commit them.

## Design rules
- Charts are always concert pitch; the start note ("From X") is always a written pitch.
- Scales are computed from degree formulas in `SCALES` (`web/engine/scales.ts`); never hand-type note lists.
- Enharmonic spelling is decided per scale by `simplifyRoot` (avoid double accidentals and B#/E#/Cb/Fb, then
  fewest accidentals, then keep the original sharp/flat direction). A chord symbol follows its scale's spelling
  when they share a root; a slash bass keeps its interval from the root. A slash chord may take its scale options
  from another chord on its bass (`slash_chords` in `chord_scales.json`: DbMaj7/C → C 7sus4b9); its symbol,
  labels and practice presets still read the chord as written.
- Transposing a chart to another key (`web/engine/transpose.ts`) spells roots on the target key's side (Dbm7 Gb7
  in Bb, even with Cb/Fb in the scale); `simplifyRoot` decides in C, or if that side needs double accidentals.
  Instrument parts still use `simplifyRoot` alone.
- Chart rows may omit the scale; the quality's default from `chord_scales.json` is used.

## Typical requests
- "Make a chart for <tune>": create `charts/<tune>.txt` in concert pitch, one row per chord change, chords only, with
  `key:` (and `composer:`, `style:`, `form:`, `source:` when known); then `cd web && npm run analyse --
  ../charts/<tune>.txt --write --save` to fill the scales and their reasons, read the report, and `make golden`
  (the fixtures cover every library chart). A scale the melody demands over the rules: write it, with `# keep: …`.
  Where the analyser can only guess (`npm run analyse -- ../charts/<tune>.txt --ambiguous`), write the function
  (`| V7/ii`) or an `@key` rather than a `# keep:` scale: a function lets the rules still choose the tensions.
- Changing an analysis rule (`web/engine/analysis/`, docs/plan-analysis.md): a test first, then
  `npm run analyse -- --all --force --save`, `make golden`, and read both diffs.
- "Add scale X": add a formula to `SCALES` in `web/engine/scales.ts` (and an alias if common), pair it with chord
  qualities in `chord_scales.json`, add tests, then `make golden`.
- "Add instrument X": add to `INSTRUMENTS` in `web/engine/instruments.ts` with clef and key.
