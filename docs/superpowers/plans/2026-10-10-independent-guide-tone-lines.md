# Independent Guide Tone Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build each guide tone line on its own (no rule 7) and show one at a time, chosen by an Off · From 3rd · From 7th control.

**Architecture:** One single-line builder, `guideToneLine`, replaces the pair builder. The show setting becomes `GuideLine = 'off' | 'third' | 'seventh'`, carried through `guideVoices`, `buildChanges`, the share view, the preference and the toolbar. The Changes model holds one voice per bar and one label per chord, so the drawing loses its two-voice paths.

**Tech Stack:** TypeScript engine (`web/engine/`), Vue 3 / Nuxt app (`web/app/`), VexFlow drawing, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md (and, for rules 1–6 and 8–10, docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md). Branch `independent-guide-lines` (worktree `../jazz-scales-gtl` until PR 3 of the theory work merges; then rebase onto main).

## Global Constraints

- Rule 7 is removed: no "the lines take different tones", no collision rule or trade, no crossing logic. Rules 1–6 and 8–10 unchanged.
- At most one line drawn; no "both" anywhere (engine, share view, preference, control).
- Control: `SegmentedControl` under the Guide Tones heading, options exactly **Off**, **From 3rd**, **From 7th**; default Off.
- Preference key `csm-guide-line`, values `off | third | seventh`. Share view field `guideLine` (absent = off).
- No backward compatibility: remove `csm-guide-3rd`/`csm-guide-7th`, `fromThird`/`fromSeventh` and the legacy `guideThird`/`guideSeventh` decoding.
- Chart-error report `guides:` value: `from 3rd`, `from 7th` or empty.
- Per-instrument ranges (`rangeOf(part)`) unchanged. Scales sheet unchanged.
- web/engine free of Vue/DOM; hashed CSP; no new deps; no feature flag.
- Vitest `cd web && npx vitest run <file>`; gates `make test`, `make lint`, `make e2e`, `make golden` (golden doesn't cover guide tones: no fixture change expected).
- Stage by name; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A line alone at the range floor:** without the trade, a line that meets its floor must still turn by rule 4 and stay in range. → Task 1 library test for every instrument, both lines.
2. **Holds and ties with one voice across a line break and a 2nd ending:** the tie chain must still open/close correctly. → Task 2 drawing/model tests (port the existing two-voice tie tests to one voice).
3. **Switching the control while a sheet is drawn** (Off → From 3rd → From 7th → Off): the sheet redraws each time, the labels row appears and disappears. → Task 3 e2e.
4. **A chord with no guide tones** under one line: one rest, the diagnostic note above the sheet. → Task 2 test (ported).
5. **Print with one line** in the tallest case: fits the page. → Task 3 print e2e.

---

### Task 1: The single-line builder

**Files:** `web/engine/guideToneLines.ts`, `web/engine/__tests__/guideToneLines.test.ts`, `web/scripts/guideLines.ts`.

**Interfaces:**
- Produces: `guideToneLine(tones: readonly (GuideTones | null)[], range: Range, from: 'third' | 'seventh', blocks?: readonly number[]): (LineNote | null)[]`. `LineNote` unchanged. `guideToneLines` (the pair) is deleted at the end of Task 2 (its last caller is `guideVoices`); in this task keep it only as a thin wrapper `[guideToneLine(…, 'third'), guideToneLine(…, 'seventh')]` so the app still compiles, with a comment that Task 2 removes it.

- [ ] **Step 0: Measure before.** In the worktree, before any change: `cd web && npm run guide-lines > /tmp/gtl-before-treble.txt; npm run guide-lines -- --part bass > …bass…; for i in vibes trumpet tenor-sax trombone; do npm run guide-lines -- --instrument $i > …$i…; done` (use the scratchpad, not /tmp, if one is given). Keep the summary tables for the PR.
- [ ] **Step 1: Tests first.** Rewrite `guideToneLines.test.ts` around `guideToneLine`:
  - the helper becomes `lineOf(chords, part = CONCERT, from = 'third', blocks?)` returning text per chord; `linesOf` (both) is removed;
  - independence: `lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'third')` → `['E4 (3)', 'D4 (7)']` and `lineOf(['CMaj7', 'EbMaj7'], CONCERT, 'seventh')` → `['B4 (7)', 'D5 (7)']` (both take D: no collision rule);
  - a line's notes don't depend on the other line: `guideToneLine` takes no information about the other line by construction; pin it with the ii–V–I, Rhythm changes and collision examples computed by hand for each `from`;
  - keep every rule 1–6, 8–10 test, rewritten for one line (rule 1 for each `from`; rule 2/3/4/5/6/9/10 on line A or B as each test needs); delete the rule 7 tests (7.1, 7.2 ×4 including the trade tests, 7.3, "complementary");
  - the worked examples: ii–V–I and Rhythm changes per line; recompute any row that changed because rule 7 no longer applies, and say which in the report;
  - the per-instrument tests (vibes floor, vibes start, trumpet range) per line;
  - library: for CONCERT, BASS, TENOR and every `INSTRUMENTS` part, and for each `from`, the line sounds at every voiced chord (null exactly where the chord has no guide tones), stays in `rangeOf(part)`, and every note is the chord's own guide tone.
  Watch them fail (the function doesn't exist).
- [ ] **Step 2: Implement** `guideToneLine`: rule 1 start (`from`'s degree in the octave nearest `range.centre`, or nearest the line's last sounded note after a rest), rule 2/3 `nearest` over both degrees' octaves in range, rule 5 holds by block, rule 6 rests, as the pair builder does for one line — minus `together`. Delete `together`, `TRITONE`, the trade.
- [ ] **Step 3: The script.** `guideLines.ts` measures each line built alone (two `guideToneLine` calls per chart); `--check` compares the sheet's labels for one line at a time (run it for both `from`s); `--compare` keeps `voiceLead` as a reference column only.
- [ ] **Step 4: Run** `cd web && npx vitest run engine/__tests__/guideToneLines.test.ts`, `npm run typecheck`, `npm run guide-lines -- --check`; then **measure after** (same commands as Step 0) and put before/after side by side in the report.
- [ ] **Step 5: Commit** "Guide tone lines: each line built on its own (rule 7 removed)".

### Task 2: One line end to end — engine model, share view, drawing, app

**Files:** `web/engine/guideTones.ts`, `web/engine/changes.ts`, `web/engine/share.ts`, `web/engine/guideToneLines.ts` (drop the pair wrapper), `web/app/utils/changesDrawing.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`, `web/app/components/ChangesSheet.vue`, `web/app/composables/usePreferences.ts`, `web/app/utils/chartReport.ts`, tests: `web/engine/__tests__/{guideTones,changes,share}.test.ts`, `web/test/{changesDrawing,ChangesSheet,EditorView,usePreferences,chartReport,PreviewControls?}.test.ts`.

**Interfaces:**
- Consumes: `guideToneLine` (Task 1).
- Produces:
  - `type GuideLine = 'off' | 'third' | 'seventh'` (engine/guideTones.ts; replaces `GuideShow`, `NO_GUIDES`, `guidesOn`).
  - `guideVoices(chords, part, beats, keySig, line: GuideLine): { bars: ReadonlyMap<number, readonly GuideNote[]>; labels: ReadonlyMap<number, string>; missing: readonly string[] }` — one voice per bar, one label per row.
  - `ChangesBar.voice: readonly GuideNote[]` (`[]` = no guide tones in this bar) replacing `voices`; `ChangesChord.guide: string` (`''` = none) replacing `guide: string[]`.
  - `changesLinesPerPage(line: GuideLine, rows)`: 8 with `'off'`, else 6 (+1 with both study rows off) — the "5 for both" case goes.
  - `buildChanges(doc, part, barsPerLine, signatures, line: GuideLine = 'off')`.
  - `ShareView.guideLine?: GuideLine` replacing `fromThird`/`fromSeventh`; the decoder accepts only `'third' | 'seventh'` (anything else = off); the legacy names are removed.
  - `usePreferences().guideLine: Ref<GuideLine>` (`csm-guide-line`, default `'off'`); `linkPreferences(view).guideLine`.
  - `guidesText(line: GuideLine): string` → `'from 3rd' | 'from 7th' | ''`.
  - `PreviewControls` `v-model:guide-line` replacing `v-model:from-third` / `v-model:from-seventh`.
- [ ] **Step 1: Tests first** for each produced interface (engine: `guideVoices` one voice and one label, a tie across a bar and across a line break, a rest for a chord without guide tones, `'off'` → empty; `changesLinesPerPage`; `buildChanges(…, 'third')` voices; share round-trip of `guideLine` and rejection of other values; app: the segmented control renders three radios labelled Off / From 3rd / From 7th under "Guide Tones" with the right one checked; the preference parses/stores `csm-guide-line` and falls back to off on junk; `guidesText`; EditorView passes `guideLine` to the sheet and the share view). Port every existing two-voice test to one voice or delete it if it only tested two voices (stems apart, ties curving apart, the pitch sort, the two-label rows) — list deletions in the report.
- [ ] **Step 2: Implement** the engine changes, then the drawing: `changesDrawing.ts` loses `tieDirection` and the `count > 1` paths (stems forced apart, the ghost lower-voice rest, per-voice tie chains, `voices[0]` "top" logic); a guide line is one voice with VexFlow's own stems (`autoStem: true`); `voiceAccidentals` takes one voice. Then the app: `PreviewControls` replaces the two `UiButton`s with
  ```vue
  <SegmentedControl v-model="guideLine" legend="Guide tones" name="guide-line" :options="GUIDE_LINES" />
  ```
  with `const GUIDE_LINES = [{ value: 'off', label: 'Off' }, { value: 'third', label: 'From 3rd' }, { value: 'seventh', label: 'From 7th' }] as const` and `const guideLine = defineModel<GuideLine>('guideLine', { default: 'off' })`; keep the Guide Tones `UiLabel` heading and the existing `title`/`aria-description` wording per option where it fits (or as the control's description). `usePreferences`, `EditorView`, `ChangesSheet`, `chartReport` as in Interfaces. Delete the pair wrapper `guideToneLines`.
- [ ] **Step 3: Run** `make test` and `make lint` (repo root). `make golden`: no fixture change.
- [ ] **Step 4: Commit(s)** — engine; drawing; app (separate commits are fine).

### Task 3: Browser tests, print, help and docs, the measurement

**Files:** `web/e2e/changes.spec.ts`, `web/e2e/print.spec.ts`, `web/e2e/fixtures.ts` (`showGuides` helper), `web/app/pages/help.vue`, `web/app/pages/functions.vue` (only if it mentions both lines), `docs/design.md`, `docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md`, `docs/superpowers/specs/2026-10-10-independent-guide-tone-lines-design.md`.

- [ ] **Step 1: e2e.** `showGuides(page, 'From 3rd' | 'From 7th' | 'Off')` picks the radio. Rewrite the guide tone tests for one line (labels row, one voice's stems, ties over a line break, waltz, dark mode, the B♭ trumpet / bass range test, vibes ledger lines, the four-chords collision test with one voice, the unknown-chord rest, the ending bracket over one voice's stems). New: switching Off → From 3rd → From 7th → Off redraws each time (labels appear, change, disappear); the choice survives a reload; a share link carries it. Print: the tallest case with one line still fits (`print.spec.ts`); update the comment that says "two voices". Run `make e2e` (all green) and the guide tone specs with `--repeat-each 3`.
- [ ] **Step 2: Help and docs.** Help ("The preview controls", "The two sheets") and any functions-page mention: one line at a time, chosen Off / From 3rd / From 7th. docs/design.md: the lines (rule 7 gone), the model (one voice), the drawing, the control and preference. The guide tone lines spec: mark rule 7 and the "both on" display superseded by the independent-lines spec. The independent-lines spec: `Status: implemented`.
- [ ] **Step 3: Gates** `make test`, `make lint`, `make golden` (no change), `make e2e`. Commit.
- [ ] **PR description** (controller): before/after measurement tables from Task 1; the rows of the spec's worked examples that changed; the deleted two-voice tests.
