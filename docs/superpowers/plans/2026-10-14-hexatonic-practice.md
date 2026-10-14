# Hexatonics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hexatonic practice preset on the Scales sheet (a Pair control chooses a triad pair from each staff's scale,
a grouping divides its six notes into two tinted groups) and a Hexatonic option in a new Overlay control on the Changes
sheet that labels each chord with its Auto pair.

**Architecture:** Pure engine first: the triad chain, the pairs, Auto and the four groupings in `hexatonics.ts`; a new
selection variant in `practice.ts`; `StaffModel.hexatonic` and `second` filled by `sheet.ts`; a per-chord label in
`changes.ts`. The web side only draws: a preset and two listboxes in `PracticePanel`, a caption and a second tint in
`ScaleStaff`, an Overlay control in `PreviewControls`, a label in `ChangesSystem`, flag gating in `EditorView`.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4 / Vue 3, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-14-hexatonic-practice-design.md`

## Global Constraints

- Engine stays free of Vue/DOM imports; pure functions, readonly types.
- Flag `hexatonics` (off by default; e2e builds with it on). Flag off: no Hexatonic preset or overlay option, and a
  stored or shared hexatonic selection is ignored.
- Selection shape: `{ preset: 'hexatonic', pair, grouping }`: pair an integer 0–8, 0 = Auto (bad reads as 0), grouping
  one of `triads | tones | pent | trichords` (bad reads as `triads`).
- Candidates (Campbell, *Triad Pairs for Jazz* pp. 4–8): the valid links of the staff's triad chain. Seven-note scale:
  start on the triad stacked on degree 1; other scales: the first major triad on a scale note from the root, else the
  first minor; none → no chain. Step each note up one scale step, as many times as the scale has notes. A link is
  valid when both triads are major, minor, diminished or augmented and share no note.
- Auto: chord-tone coverage (most first), both triads major or minor first, fewest fifths from the chord root to the
  lower root (♭ side first), chain position.
- Pair *n*: the staff's pair at `((n − 1) mod count) + 1`; no pairs → no hexatonic.
- Names: the staff's own spelling of each triad root, plus `m`, `°` or `+`, joined by `/` in chain order (`G/Am`,
  `B°/C`, `E♭+/F`).
- Caption: `G/Am hex`, or `no triad pair`.
- Pair listbox `aria-label="Hexatonic pair"` (Auto, 1 … 8); grouping listbox `aria-label="Hexatonic grouping"`; overlay
  listbox `aria-label="Overlay"`. Button label "Hexatonic". Both modes.
- Hexatonics are never written into chart rows, saved reasons, or share links (the practice selection excepted, as for
  the pentatonics).
- Tests alongside each change; `make test`, `make lint`, `make e2e` green; `make golden` after the engine tasks, its
  diff reviewed. Commits end with the `Co-Authored-By` trailer for the model doing the work. Stage files by name,
  never `git add -A`.

## Review Focus

1. Flag off with a hexatonic selection in storage or a share link → no highlight, no caption, no Hexatonic button
   (Task 6 test).
2. A staff whose chord cannot be read, or an error staff → no crash; Auto drops the coverage rule; error staves have
   `hexatonic: null` (Task 4 test).
3. Scales with no chain or no valid link (whole tone, blues, the pentatonics) → no lit notes, caption `no triad pair`;
   scales with some invalid links (bebop) → only the valid ones, and pair numbers wrap over them (Task 1 test).
4. A transposing part (B♭ tenor) → the caption names the written pair, and the same scale degrees light as in concert
   (Task 4 test).
5. Pentatonic + 1 where no minor pentatonic lies wholly inside the hexatonic → group A is the best partial fit, group B
   the rest, no crash (Task 3 test).
6. Overlay migration: a stored `csm-pentatonics: true` still shows the Pentatonic overlay after upgrade (Task 7 test).
7. Print: lines per page unchanged on both sheets; the 10px caption stays on one line at 12 staves (Task 8).

## File Map

| Area | File | Change |
| --- | --- | --- |
| Engine | `engine/src/hexatonics.ts` | new: chain, pairs, Auto, resolution, groupings, pick, caption |
| Engine | `engine/src/practice.ts` | preset, selection variant, parsing, labels; export `CHORD_TONES` |
| Engine | `engine/src/sheet.ts` | `StaffModel.hexatonic`, `second`; `practiceFor` |
| Engine | `engine/src/changes.ts` | `ChangesChord.hexatonic`, overlay plan, `showHexatonics`, lines per page |
| Engine | `engine/src/index.ts`, `__tests__/api.test.ts`, `goldenFixture.ts` | exports, snapshot, golden input |
| Web | `web/nuxt.config.ts`, `composables/useFeature.ts` | flag `hexatonics` |
| Web | `components/PracticePanel.vue` | preset, pair and grouping listboxes, legend |
| Web | `components/ScaleStaff.vue`, `assets/css/main.css` | caption, `vf-second` tint (screen, print) |
| Web | `components/PreviewControls.vue`, `composables/usePreferences.ts` | Overlay control, `csm-overlay`, migration |
| Web | `components/ChangesSystem.vue`, `ChangesSheet.vue`, `EditorView.vue` | label, wiring, flag gating |
| Docs | `docs/design.md`, `web/app/pages/help.vue` | Practice and Changes sections; help text |

## Task 1: Triad chain and pairs

**Files:** `engine/src/hexatonics.ts`, `engine/src/__tests__/hexatonics.test.ts`

- [ ] Test first: `triadChain` on C for major (C Dm Em F G Am B°), melodic minor, harmonic minor, harmonic major (the
      spec table's qualities), half-whole (C F♯m E♭ Am F♯ Cm A E♭m, Campbell p. 7), whole-half (D A♭m F Bm A♭ Dm B Fm),
      bebop major (4 valid links: C/D°, A♭°/Am, Am/B°, B°/C), whole tone, blues, major and minor pentatonic (empty).
- [ ] Test first: for every scale in `SCALES`, every pair is two disjoint triads inside the scale; on every seven-note
      scale with standard triads, 7 pairs, and pair *n* leaves out degree *n* − 1.
- [ ] Test first: names spelled with the staff's scale (`B°/C`, `E♭+/F` in C melodic minor, sharps on an F♯ staff).
- [ ] Implement `TriadQuality`, `HexPair`, `triadChain`, `hexatonicPairs` (with coverage).

## Task 2: Auto and pair resolution

**Files:** `engine/src/hexatonics.ts`, `engine/src/__tests__/hexatonics.test.ts`

- [ ] Test first: the worked Auto table (Cmaj7/C Ionian → G/Am, Dm7/D Dorian → C/Dm, G7/G Mixolydian → Dm/Em, C7/C
      half-whole → E♭/Am), computed.
- [ ] Test first: the major/minor rule breaks a coverage tie that fifths alone would order the other way (Cmaj7: G/Am
      over B°/C); an unknown quality drops the coverage rule.
- [ ] Test first: `resolvePair`: 0 → Auto; *n* within the count → that pair; 8 on a seven-pair staff → pair 1; 3 on a
      four-pair bebop staff → its third valid pair; no pairs → null.
- [ ] Implement `hexatonicAuto`, `resolvePair`, `HEX_PAIRS`, reusing `fifthsFrom` from `ladder.ts` and `CHORD_TONES`
      (export it from `practice.ts`, or move it to `qualities.ts` if `practice.ts` must import this file).

## Task 3: Groupings and pick

**Files:** `engine/src/hexatonics.ts`, `engine/src/__tests__/hexatonics.test.ts`

- [ ] Test first, per grouping on `C/Dm`, `Em/F`, `B°/C` and `E♭/Am` (half-whole): group A and B pitch classes as in the
      spec table.
- [ ] Test first: Pentatonic + 1 where two pentatonics lie inside (`C/Dm`: Dm and Am; the fifths rule picks), and where
      none does.
- [ ] Test first: Chord tones + color with a known and an unknown quality.
- [ ] Test first: `hexatonicPick` lights only the staff's notes in the hexatonic, `second` is a subset of `lit`, and
      the caption in both forms.
- [ ] Implement `HexGrouping`, `HEX_GROUPINGS`, `hexatonicPick`, `hexatonicCaption`.

## Task 4: Practice selection and the staff model

**Files:** `engine/src/practice.ts`, `engine/src/sheet.ts`, `engine/src/index.ts`, tests

- [ ] Test first: `practiceSelectionFrom` round-trips a hexatonic selection, clamps pair, defaults grouping;
      `selectedNotes` lights nothing under it; `PRESETS` lists it for both modes.
- [ ] Test first: `buildSheet` sets `hexatonic` and `second` only under the preset, null for error staves, null with
      another preset; Auto measures from the written chord root, else the scale's root; a B♭ tenor part names the
      written pair; share-link round-trip (`share.test.ts`).
- [ ] Implement; update the exports and the `api.test.ts` snapshot.
- [ ] `make golden` after Task 5's golden input is added, not before (one diff to review).

## Task 5: Changes sheet label and golden input

**Files:** `engine/src/changes.ts`, `engine/src/__tests__/changes.test.ts`, `engine/src/__tests__/goldenFixture.ts`

- [ ] Read `buildChanges` around the pentatonic label (the `pentatonicOf` helper and the chord model) and confirm the
      chord's resolved scale is available there (spec, open question 3). If it is not, add it to the chord model first,
      with a test.
- [ ] Test first: with the overlay plan `hexatonic`, each chord carries its Auto pair's label; null with no plan, no
      scale, or no pairs; the pentatonic plan still behaves as before.
- [ ] Test first: `showHexatonics` prints a label where it changes from the previous chord on the line; blank
      otherwise; `changesLinesPerPage` returns the pentatonic row's values for the hexatonic row.
- [ ] Add `hexatonicPairs` over every scale in `SCALES` on C, and the Auto pair per quality's default scale, to the
      golden input set. Run `make golden`; read the diff as the review.

## Task 6: Flag, Practice panel, Scales staff

**Files:** `web/nuxt.config.ts`, `useFeature.ts`, `PracticePanel.vue`, `ScaleStaff.vue`, `main.css`, `EditorView.vue`

- [ ] Add the flag (off; e2e on); `EditorView` ignores a stored or shared hexatonic selection with it off.
- [ ] Test first (`PracticePanel.test.ts`): the Hexatonic button only with the flag; the two listboxes only while it is
      the selection; picks emit `{ preset: 'hexatonic', pair, grouping }`; the legend names the grouping's groups.
- [ ] Test first (`ScaleStaff.test.ts`): caption both forms; group B notes carry `vf-second`; none when the staff has no
      hexatonic.
- [ ] Implement; add the `vf-second` tint (light, dark and print) and a second accent token to the theme.
- [ ] Box edits while the preset is on seed a custom selection from `litKeys`, as for every preset (test).

## Task 7: Overlay control and Changes label

**Files:** `PreviewControls.vue`, `usePreferences.ts`, `ChangesSheet.vue`, `ChangesSystem.vue`

- [ ] Test first (`usePreferences.test.ts`): `csm-overlay` reads and writes; a stored `csm-pentatonics: true` with no
      `csm-overlay` reads as `pentatonic`; an invalid value reads as `off`.
- [ ] Test first (`PreviewControls.test.ts`): Overlay options by flag; Rung, Side and Path only for Pentatonic; no extra
      control for Hexatonic; neither flag on → no Overlay control, as today.
- [ ] Test first (`ChangesSystem.test.ts`, `ChangesSheet.test.ts`): the hexatonic label under each chord, blank where
      a chord has no pair, no contour band under the Hexatonic overlay, the Pentatonic overlay unchanged.
- [ ] Implement; keep `csm-overlay` out of share links.

## Task 8: Docs, e2e, print, verification

**Files:** `docs/design.md`, `web/app/pages/help.vue`, `web/e2e/hexatonics.spec.ts`, `web/e2e/print.spec.ts`

- [ ] Document the Practice preset and the Overlay in `design.md` beside the Pentatonic sections, citing Campbell;
      help text for both (pair *n* is the triads on degrees *n* and *n* + 1, and leaves out degree *n* − 1).
- [ ] e2e: Scales sheet, each grouping, group A and B counts per staff match the caption; Pair 5 on a C major staff
      captions `G/Am hex`; Changes sheet Overlay switching.
- [ ] Print check: lines per page unchanged on both sheets; the caption on one line at 12 staves; decide the print
      legend (spec, open question 2).
- [ ] Browser check of the Pair labels (spec, open question 1).
- [ ] `make test`, `make lint`, `make e2e`; `make golden` once more and confirm no unexpected diff.

## Sequencing

Tasks 1–5 are engine-only and ship dark. Tasks 6–7 are web, behind the flag. Task 8 closes. Each task is one commit
(or one small PR); the flag stays off in production until the print check passes.
