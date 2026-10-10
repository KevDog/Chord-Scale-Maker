# Editor UI overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/editor` into a song-first `/song` page with a labelled toolbar, fix the Changes-sheet scale-label bleed, require a chart key, add a one-click chart-error report, and give re-renders a loading spinner.

**Architecture:** Nine UI changes shipped as eight independent PRs (one per task). Pure logic (scale abbreviation + de-dup, key validation, the render-busy counter) goes in the engine/composables and is unit-tested; the Vue layer renders it and is gated by Playwright e2e. Each task is a self-contained, mergeable PR.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript (strict), Vitest (`engine` + `app` projects), Playwright, Tailwind + Catalyst UI (`app/components/ui/`), VexFlow 5.

**Spec:** `docs/superpowers/specs/2026-10-09-editor-ui-overhaul-design.md`

## Global Constraints

- TypeScript strict; favour pure functions and immutability; tests alongside implementation.
- `web/engine/` is pure TS — **no Vue/DOM imports**. View logic lives in `web/app/`.
- Hashed CSP (`web/build/csp.ts`): no inline `<script>` of ours, no `eval`, no third-party origins, no remote fonts/assets. Spinner is CSS/SVG only.
- Build screens from the Catalyst UI components in `app/components/ui/` (`UiButton`, `UiListbox`, `UiSelect`, `UiField`, `UiLabel`, …).
- `make test` = typecheck + vitest; `make lint` = eslint; `make e2e` = `nuxt build && playwright test` (feature flags on). Run UI e2e via `npm run e2e -- <spec>` (it builds first); never `npx playwright test` against a stale build.
- Scale names are display-only; `golden.json` stores pre-glyph ASCII — it must stay unchanged for Tasks 1–8. Confirm with `git diff --quiet fixtures/golden.json`.
- Merge discipline: branch per task, gate merge on `gh pr checks <n> --watch` exit 0; stage files by name.
- Work on branch `editor-ui-overhaul` is the spec's home; each task cuts its own branch from `main`.
- Feature flags: `scaleLevels` gates the Work-on control; `changes`/`guideTones` gate those sheets. e2e builds with all on.

## Review Focus

- **`abbreviateScale` must replace whole words, not substrings** — "Harmonic Minor"/"Melodic Minor" collapse correctly and roots/degree suffixes (`B♭`, `b6`, `#11`) are untouched. → Task 2.
- **De-dup resets each line** — a line's first chord always shows its scale, even when it equals the previous line's last scale. → Task 2.
- **A chart with no/invalid `key:`** — Transpose is disabled with a hint, the editor flags it, and a `?new=1` blank chart (no key) still opens editably. → Tasks 3 and 5.
- **No internal link still points to `/editor`** after the rename (grep gate), and `#s=` share links build `/song`. → Task 4.
- **The chart-report blob is cleared after the contact page reads it** (revisiting `/contact` doesn't re-prefill), and a missing/oversized blob degrades gracefully. → Task 7.
- **The render counter never goes negative** if a `draw()` throws (bracket in `finally`), and a sub-150 ms redraw doesn't flash the spinner. → Task 8.

---

### Task 1: Remove the on-screen page divider (#8)

**Files:**
- Modify: `web/app/components/SheetPages.vue:8-12`
- Test: `web/e2e/print.spec.ts` (assert no on-screen separator)

**Interfaces:** none shared.

- [ ] **Step 1: Write the failing e2e assertion**

Add to the Changes/guide-tone print area of `web/e2e/print.spec.ts` a check that the screen has no page separator. In an existing on-screen test (e.g. the guide-tones one that loads a 2-page chart, `milestones`), after the sheet is visible add:

```ts
await expect(page.getByRole('separator')).toHaveCount(0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm run e2e -- e2e/print.spec.ts -g "guide tones"`
Expected: FAIL — the "Page N" separator (`role="separator"`) is present on screen.

- [ ] **Step 3: Remove the separator**

In `web/app/components/SheetPages.vue`, delete the on-screen separator block (the `<div v-if="i > 0" role="separator" …>Page {{ i + 1 }}…</div>`, lines 8–12). Keep the `print:break-after-page` / `print:last:break-after-auto` classes on the page container untouched.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npm run e2e -- e2e/print.spec.ts`
Expected: PASS (all print tests; page counts unchanged — the separator was `print:hidden`, so print layout is unaffected).

- [ ] **Step 5: Commit**

```bash
git add web/app/components/SheetPages.vue web/e2e/print.spec.ts
git commit -m "Preview: drop the on-screen page divider"
```

---

### Task 2: Scale-label abbreviation + de-dup across the line (#1, #2)

**Files:**
- Modify: `web/engine/scales.ts` (add `abbreviateScale`)
- Modify: `web/engine/changes.ts` (`writtenScale` applies it; de-dup pass over lines)
- Test: `web/engine/__tests__/scales.test.ts`, `web/engine/__tests__/changes.test.ts`

**Interfaces:**
- Produces: `export function abbreviateScale(name: string): string` (in `scales.ts`).
- `ChangesChord.scale` stays `string | null`; a suppressed repeat becomes `null`.

- [ ] **Step 1: Write the failing `abbreviateScale` test**

In `web/engine/__tests__/scales.test.ts` (import `abbreviateScale` from `../scales`):

```ts
describe('abbreviateScale', () => {
  it('shortens long scale words, leaves roots/degrees/short names alone', () => {
    expect(abbreviateScale('Mixolydian')).toBe('Mixo')
    expect(abbreviateScale('Mixolydian b6')).toBe('Mixo b6')
    expect(abbreviateScale('Lydian Dominant')).toBe('Lyd Dom')
    expect(abbreviateScale('Major Pentatonic')).toBe('Major Pent')
    expect(abbreviateScale('Harmonic Minor')).toBe('Harm min')
    expect(abbreviateScale('Melodic Minor')).toBe('Mel min')
    expect(abbreviateScale('Half-Whole Diminished')).toBe('H/W Dim')
    expect(abbreviateScale('Bebop Dominant')).toBe('Bebop Dom')
    expect(abbreviateScale('Dorian')).toBe('Dorian')
    expect(abbreviateScale('Altered')).toBe('Altered')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run --project engine engine/__tests__/scales.test.ts -t abbreviateScale`
Expected: FAIL — `abbreviateScale` is not a function.

- [ ] **Step 3: Implement `abbreviateScale`**

In `web/engine/scales.ts`:

```ts
const SCALE_ABBREV: Readonly<Record<string, string>> = {
  Mixolydian: 'Mixo',
  Pentatonic: 'Pent',
  Dominant: 'Dom',
  Diminished: 'Dim',
  Lydian: 'Lyd',
  Phrygian: 'Phryg',
  Locrian: 'Locr',
  Augmented: 'Aug',
}

/** shorten the long scale words for a tight display ("Lydian Dominant" -> "Lyd Dom"); roots and degrees untouched */
export function abbreviateScale(name: string): string {
  return name
    .replace(/Harmonic Minor/g, 'Harm min')
    .replace(/Melodic Minor/g, 'Mel min')
    .replace(/Half-Whole/g, 'H/W')
    .replace(/Whole-Half/g, 'W/H')
    .split(' ')
    .map((w) => SCALE_ABBREV[w] ?? w)
    .join(' ')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run --project engine engine/__tests__/scales.test.ts -t abbreviateScale`
Expected: PASS.

- [ ] **Step 5: Write the failing de-dup test**

In `web/engine/__tests__/changes.test.ts` (uses `buildChanges`, `parseChart`, `CONCERT`), add:

```ts
describe('scale labels', () => {
  const chords = (text: string) =>
    buildChanges(parseChart(text).value, CONCERT).lines.map((l) => l.bars.flatMap((b) => b.chords.map((c) => [c.text, c.scale])))

  it('abbreviates scale names and blanks a scale that repeats the previous chord on the same line', () => {
    // 4 bars/line (CONCERT default is 4); a line of Cm7 F7 | Cm7 F7 etc.
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | Dm7', 'A | 3 | G7', 'A | 4 | G7'].join('\n') + '\n'
    const line0 = chords(text)[0]!
    expect(line0.map((c) => c[1])).toEqual(['D Dorian', null, 'G Mixo', null]) // repeats blanked, abbreviated
  })

  it('always shows the first chord of a line, even if it repeats the previous line', () => {
    const text = ['key: C', 'A | 1 | Dm7', 'A | 2 | Dm7', 'A | 3 | Dm7', 'A | 4 | Dm7', 'A | 5 | Dm7'].join('\n') + '\n'
    const lines = chords(text)
    expect(lines[0]!.map((c) => c[1])).toEqual(['D Dorian', null, null, null])
    expect(lines[1]![0]![1]).toBe('D Dorian') // bar 5 opens a new line -> re-labelled
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd web && npx vitest run --project engine engine/__tests__/changes.test.ts -t "scale labels"`
Expected: FAIL — scales are full-length and repeats are not blanked.

- [ ] **Step 7: Apply abbreviation + de-dup in `changes.ts`**

In `web/engine/changes.ts`: (a) import `abbreviateScale` from `./scales`; (b) in `writtenScale`, abbreviate the name before glyphing — change the label return to `glyphs(\`${rootName(label.root)} ${abbreviateScale(label.name)}\`)` (leave the `scale` fallback path as-is). (c) After the `lines` array is built (end of `buildChanges`, before `return`), de-dup per line:

```ts
  const deduped = lines.map((line): ChangesLine => {
    let prev: string | null = null
    const bars = line.bars.map((bar): ChangesBar => ({
      ...bar,
      chords: bar.chords.map((c): ChangesChord => {
        if (c.scale && c.scale === prev) return { ...c, scale: null }
        prev = c.scale
        return c
      }),
    }))
    return { bars }
  })
  return { lines: deduped, beats, diagnostics }
```

- [ ] **Step 8: Run it to verify it passes + golden unchanged**

Run: `cd web && npx vitest run --project engine engine/__tests__/changes.test.ts engine/__tests__/scales.test.ts`
Expected: PASS. Then from repo root: `make test` (full), `git diff --quiet fixtures/golden.json && echo UNCHANGED`.
Expected: all green; golden UNCHANGED (scale display is not in golden).

- [ ] **Step 9: Commit**

```bash
git add web/engine/scales.ts web/engine/changes.ts web/engine/__tests__/scales.test.ts web/engine/__tests__/changes.test.ts
git commit -m "Changes: abbreviate scale labels and drop repeats within a line"
```

---

### Task 3: Required key + Transpose "From" (#6)

**Files:**
- Modify: `web/engine/chart.ts` (add `isValidKey`)
- Modify: `web/app/components/ChartGrid.vue` (add `key` to editable meta + validity)
- Modify: `web/app/components/ChartTranspose.vue` (From = chart key, read-only, disable without a key)
- Test: `web/engine/__tests__/chart.test.ts`; `web/e2e/transposition.spec.ts`

**Interfaces:**
- Consumes: `parseKey` (`engine/analysis`), `metaValue`/`setMeta` (already exported).
- Produces: `export const isValidKey = (text: string): boolean` (in `chart.ts`).

- [ ] **Step 1: Write the failing `isValidKey` test**

In `web/engine/__tests__/chart.test.ts`:

```ts
describe('isValidKey', () => {
  it('accepts a real major or minor key, rejects junk', () => {
    for (const k of ['C', 'Eb', 'F#', 'Bb', 'Am', 'F#m', 'Dm']) expect(isValidKey(k)).toBe(true)
    for (const k of ['', 'H', 'Cmaj', 'x', 'C7', '  ']) expect(isValidKey(k)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run --project engine engine/__tests__/chart.test.ts -t isValidKey`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement `isValidKey`**

In `web/engine/chart.ts` (no new import — mirror the regex already used by `keyLabel`, `^([A-G])([b#]?)(m?)$`, so the two agree on what a key is):

```ts
/** a valid chart key: a note letter, optional accidental, optional minor "m" ("Eb", "F#m"); nothing else */
export const isValidKey = (text: string): boolean => /^[A-G][b#]?m?$/.test(text.trim())
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run --project engine engine/__tests__/chart.test.ts -t isValidKey`
Expected: PASS.

- [ ] **Step 5: Add the Key field to the grid**

First, make the chart's key available to the grid: in `web/engine/chart.ts`, extend `chartMeta` (line ~140) to also return `key: metaValue(doc, 'key')`, and widen its return type to `{ title: string; subtitle: string; key: string }`. (A one-line engine change; existing callers that read `.title`/`.subtitle` are unaffected. Add a `chartMeta` assertion for `key` to `chart.test.ts`.)

Then in `web/app/components/ChartGrid.vue`: change `META_KEYS` (line 63) from `['title', 'subtitle']` to `['title', 'subtitle', 'key']` (type `Extract<MetaKey, 'title' | 'subtitle' | 'key'>`). For the `key` row, render a key picker instead of a free text cell: a `UiSelect` whose options are the valid keys `['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B','Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm']`, bound through `@update="(v) => emitDoc(setMeta(doc, 'key', v))"`. Mark the field invalid (`:invalid="!isValidKey(meta.key)"`) and show a hint ("Pick the chart's key") when empty/invalid. Import `isValidKey` from `~~/engine`.

- [ ] **Step 6: Make Transpose read the chart key, read-only, and require it**

In `web/app/components/ChartTranspose.vue`: replace the From dropdown. `from` becomes a computed read of the chart's declared key — `const from = computed(() => metaValue(props.current(), 'key'))` (import `metaValue`; if it isn't exported, export it from `chart.ts`). Render From as read-only text (`<UiText>{{ keyLabel(from) }}</UiText>`, import `keyLabel`), not a select. Disable the Transpose button and show a hint when `!isValidKey(from)`: `:disabled="!isValidKey(from)"` with title "Set the chart's key first". `to` (TRANSPOSE_KEYS) and the apply path are unchanged, but call `transposeChart(doc, from, to)` using the chart key as the source.

- [ ] **Step 7: Write/extend the e2e**

In `web/e2e/transposition.spec.ts`, add a case: open a library chart (which has a `key:`), open Transpose, assert From shows the chart's key and the button is enabled; then a `?new=1` chart (no key) — assert Transpose is disabled until a key is picked in the grid. Keep assertions resilient (role/name based).

- [ ] **Step 8: Verify**

Run: `cd web && make test` (engine + app unit), then `npm run e2e -- e2e/transposition.spec.ts`, then `make lint`, and `git diff --quiet fixtures/golden.json && echo UNCHANGED`.
Expected: all green; golden unchanged.

- [ ] **Step 9: Commit**

```bash
git add web/engine/chart.ts web/app/components/ChartGrid.vue web/app/components/ChartTranspose.vue web/engine/__tests__/chart.test.ts web/e2e/transposition.spec.ts
git commit -m "Charts: require a key, and transpose from it"
```

---

### Task 4: Rename `/editor` to `/song` (#3, route half)

**Files:**
- Rename: `web/app/pages/editor.vue` → `web/app/pages/song.vue`
- Modify: `web/app/composables/useOpenChart.ts:22`, `web/app/components/MyChartsList.vue:69`, `web/app/components/EditorView.vue:286,309,322`, `web/app/pages/song.vue:99` (the moved `router.replace`), `web/app/pages/index.vue:14,42,55`
- Test: `web/e2e/*` — update any `page.goto('/editor…')` to `/song…`

**Interfaces:** none new; this is a path rename.

- [ ] **Step 1: Rename the page and grep for all `/editor` references**

```bash
git mv web/app/pages/editor.vue web/app/pages/song.vue
grep -rn "/editor" web/app web/e2e | grep -v node_modules
```
Expected: the sites listed above, plus e2e `goto` calls.

- [ ] **Step 2: Update every builder and the share link**

Replace `'/editor'` → `'/song'` and `` `/editor?… ` `` / `` `/editor#s=…` `` → `/song…` at every site from Step 1, including the share link in `EditorView.vue:309` (`${location.origin}/song#s=…`). Update all `web/e2e/*.spec.ts` `page.goto('/editor…')` to `/song…`.

- [ ] **Step 3: Verify no `/editor` remains**

Run: `grep -rn "/editor" web/app web/e2e | grep -v node_modules || echo CLEAN`
Expected: CLEAN (no matches).

- [ ] **Step 4: Verify**

Run: `cd web && make test && make lint`, then `npm run e2e` (full — the route change touches many specs). Expected: all green; `/song?chart=…` loads, old `/editor` is gone (no redirect, by design).

- [ ] **Step 5: Commit**

```bash
git add -A web/app/pages web/app/components web/app/composables web/e2e
git commit -m "Route: rename /editor to /song"
```
(This is the one task where `git add -A` within the named paths is acceptable — it captures the rename; verify `git status` shows only the intended files first.)

---

### Task 5: Song-first show/hide editor (#3, view half)

**Files:**
- Modify: `web/app/composables/usePreferences.ts:17` (`showText` → `showEditor`)
- Modify: `web/app/components/EditorView.vue` (hide the whole editor; Edit toggle; `?new=1`/fatal force-show)
- Test: `web/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `usePreferences()` now returns `showEditor` (bool, pref key `csm-editor`, default `false`).

- [ ] **Step 1: Write the failing e2e**

In `web/e2e/editor.spec.ts`, add: open `/song?chart=autumn_leaves`; assert the chart grid/text editor is hidden by default and the sheet is visible; click **Edit**; assert the editor (grid + text) appears; click **Done**; assert it's hidden again. Use role/name (`getByRole('button', { name: 'Edit' })`). Also: `/song?new=1` opens with the editor shown.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm run e2e -- e2e/editor.spec.ts -g "Edit"`
Expected: FAIL — today the grid shows by default and the control says "Hide text".

- [ ] **Step 3: Rename the preference**

In `web/app/composables/usePreferences.ts`, replace the `showText` line with
`const showEditor = storedRef<boolean>('csm-editor', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))`
and return `showEditor` instead of `showText`.

- [ ] **Step 4: Hide the whole editor and add the Edit toggle**

In `web/app/pages/song.vue`, pass `:is-new="route.query.new === '1'"` to `EditorView` (add an `isNew?: boolean` prop). In `web/app/components/EditorView.vue`: (a) `const editorShown = computed(() => prefs.showEditor.value || props.isNew || editor.fatal.value)`. (b) Wrap BOTH the `ChartGrid` section and the `ChartText` pane in `v-if="editorShown"` (replacing today's `textShown`/`showText` gating so the grid is hidden too). (c) Replace the "Hide text"/"Show text" button with an **Edit/Done** toggle placed in the existing actions slot (Task 6 moves it into the Display group): `@click="prefs.showEditor.value = !prefs.showEditor.value"`, label `editorShown ? 'Done' : 'Edit'`.

- [ ] **Step 5: Verify**

Run: `cd web && make test && make lint`, then `npm run e2e -- e2e/editor.spec.ts`. Expected: green.

- [ ] **Step 6: Commit**

```bash
git add web/app/composables/usePreferences.ts web/app/components/EditorView.vue web/e2e/editor.spec.ts
git commit -m "Song: hide the editor by default, reveal with Edit"
```

---

### Task 6: Toolbar restructure into labelled groups (#4, #5)

**Files:**
- Modify: `web/app/components/PreviewControls.vue` (labelled groups; level → dropdown; From C/root → dropdown; Display group)
- Modify: `web/app/components/EditorView.vue` (pass the Work-on level + Edit/Focus/Print into the Display slot; move the level control out of its current spot)
- Test: `web/e2e/editor.spec.ts` (+ `print.spec.ts` for layout)

**Interfaces:**
- Consumes: the `scaleLevels` level model + options from `EditorView` (currently `LEVEL_OPTIONS`, `setLevel`, `shuffle`), the Edit toggle (Task 5), Focus/Print handlers.

- [ ] **Step 1: Write the failing e2e for the labelled groups**

In `web/e2e/editor.spec.ts`, assert the toolbar shows the group labels for the Scales sheet: `Sheet`, `Instrument`, `Work on`, `Show`, `Transposition`, `Display` (via `getByText`), and that the level control is a listbox (combobox role), not segmented buttons. Assert Focus/Print/Edit are present in the Display group.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm run e2e -- e2e/editor.spec.ts -g "toolbar"`
Expected: FAIL — labels `Work on`/`Show`/`Transposition`/`Display` don't exist yet.

- [ ] **Step 3: Restructure `PreviewControls.vue`**

Rework the template (keep all `defineModel` bindings) into labelled `UiField` groups in one `flex flex-wrap items-end` row:
- **Sheet**: wrap the existing `SegmentedControl` in a `UiField` with `<UiLabel>Sheet</UiLabel>`.
- **Instrument**: unchanged (already labelled).
- **Work on** (new slot `#workon`): a `UiField` labelled "Work on" rendered by `EditorView` (it owns the level model); `PreviewControls` exposes `<slot name="workon" />` in the row.
- **Show**: wrap the Intervals / Numerals+Scales toggles in a `UiField` labelled "Show".
- **Transposition**: a `UiField` labelled "Transposition" holding the mode as a `UiListbox` (From C / From root, Scales sheet only) + the `Start on` select (when `from`) + the `#actions`-provided `Transpose…`. Convert `mode` from `SegmentedControl` to `UiListbox` with the two `modes` options.
- **Display**: an `ml-auto` `UiField` labelled "Display" (right-justified via `ml-auto`, label left over buttons) holding `<slot name="display" />` (Edit, Focus, Print from `EditorView`).

- [ ] **Step 4: Wire `EditorView.vue`**

Move the scale-level control (today `SegmentedControl` at EditorView.vue:45-50) into `<template #workon>` as a `UiListbox` of `LEVEL_OPTIONS` with `@update:modelValue="setLevel"` and a ↻ icon `UiButton` (`@click="shuffle"`) shown when level is `random`; put its status message below the sheet. Put the Edit toggle (Task 5), Focus, and Print buttons into `<template #display>`. Remove them from the old `#actions` slot (keep `Transpose…` going to the Transposition group via `#actions` or a dedicated slot — simplest: pass `Transpose…` through a `#transpose` slot rendered inside the Transposition group).

- [ ] **Step 5: Verify (build + e2e + print budget)**

Run: `cd web && make test && make lint`, then `npm run e2e -- e2e/editor.spec.ts e2e/print.spec.ts`. Expected: green (labels present; level is a listbox; print budgets hold). Eyeball `make dev` on a phone width to confirm wrapping.

- [ ] **Step 6: Commit**

```bash
git add web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/e2e/editor.spec.ts
git commit -m "Preview: labelled toolbar groups; level and start as dropdowns"
```

---

### Task 7: Chart-error report → pre-filled contact (#7)

**Files:**
- Create: `web/app/utils/chartReport.ts` (build/read the report blob)
- Modify: `web/app/components/EditorView.vue` (a "Report a chart error" control)
- Modify: `web/app/pages/contact.vue` (read the blob on mount, pre-fill)
- Test: `web/test/chartReport.test.ts` (app project); `web/e2e/pages.spec.ts`

**Interfaces:**
- Produces: `export const CHART_REPORT_KEY = 'csm-chart-report'`; `export function buildChartReport(info): string` (the pre-filled message text); `export type ChartReport = { chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; level: string; url: string }`.

- [ ] **Step 1: Write the failing unit test for the message builder**

`web/test/chartReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildChartReport } from '~/utils/chartReport'

describe('buildChartReport', () => {
  it('puts a prompt line, a debug block, then the chart text', () => {
    const msg = buildChartReport({ chart: 'key: C\nA | 1 | Dm7\n', slug: 'x', title: 'X', version: 'v1', instrument: 'Tenor Sax', sheet: 'Scales', level: 'Standard', url: 'http://x/song?chart=x' })
    expect(msg).toMatch(/^What looks wrong/) // prompt first
    expect(msg).toContain('version: v1')
    expect(msg).toContain('instrument: Tenor Sax')
    expect(msg).toContain('key: C\nA | 1 | Dm7') // chart text included
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run --project app test/chartReport.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `chartReport.ts`**

```ts
export const CHART_REPORT_KEY = 'csm-chart-report'
export type ChartReport = Readonly<{ chart: string; slug: string; title: string; version: string; instrument: string; sheet: string; level: string; url: string }>

export function buildChartReport(r: ChartReport): string {
  return [
    'What looks wrong? (describe it here)',
    '',
    '--- chart details (for debugging) ---',
    `title: ${r.title}`,
    `slug: ${r.slug}`,
    `version: ${r.version}`,
    `instrument: ${r.instrument}`,
    `sheet: ${r.sheet}`,
    `level: ${r.level}`,
    `url: ${r.url}`,
    '',
    r.chart.trimEnd(),
  ].join('\n')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run --project app test/chartReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the report control**

In `web/app/components/EditorView.vue`, add a small "Report a chart error" `UiButton`/link (plain, in the Display group or just below the sheet). On click: build a `ChartReport` from the current state (chart text, slug/title, `version` from `useVersion`/the build version, instrument, current sheet, level), `sessionStorage.setItem(CHART_REPORT_KEY, JSON.stringify(report))`, then `navigateTo('/contact')`.

- [ ] **Step 6: Pre-fill the contact form**

In `web/app/pages/contact.vue` `onMounted`, read the blob once and clear it:

```ts
onMounted(() => {
  startedAt = Date.now()
  const raw = sessionStorage.getItem(CHART_REPORT_KEY)
  if (raw) {
    sessionStorage.removeItem(CHART_REPORT_KEY)
    try {
      form.message = buildChartReport(JSON.parse(raw))
    } catch { /* ignore a malformed/oversized blob */ }
  }
})
```
(Import `CHART_REPORT_KEY`, `buildChartReport` from `~/utils/chartReport`.) No server/validation change.

- [ ] **Step 7: Write the e2e**

In `web/e2e/pages.spec.ts`, add: open `/song?chart=autumn_leaves`, click "Report a chart error", land on `/contact`, assert the message textarea contains "version:" and the chart's first chord; reload `/contact` and assert the message is blank (blob was cleared).

- [ ] **Step 8: Verify**

Run: `cd web && make test && make lint`, then `npm run e2e -- e2e/pages.spec.ts`. Expected: green.

- [ ] **Step 9: Commit**

```bash
git add web/app/utils/chartReport.ts web/app/components/EditorView.vue web/app/pages/contact.vue web/test/chartReport.test.ts web/e2e/pages.spec.ts
git commit -m "Contact: a one-click chart-error report, pre-filled"
```

---

### Task 8: Loading spinner + navigation bar (#9)

**Files:**
- Create: `web/app/composables/useRendering.ts`, `web/app/components/ui/Spinner.vue`
- Modify: `web/app/components/ScaleStaff.vue`, `GuideToneSystem.vue`, `ChangesSystem.vue` (bracket `draw()`)
- Modify: the preview container (`EditorView.vue`) to overlay the spinner; `web/app/app.vue` (`<NuxtLoadingIndicator>`)
- Test: `web/test/useRendering.test.ts`; `web/e2e/editor.spec.ts`

**Interfaces:**
- Produces: `useRendering()` → `{ active: Readonly<Ref<number>>, busy: Readonly<Ref<boolean>>, begin(): () => void }` where `busy` is `active > 0` debounced ~150 ms. `begin()` returns a `done` callback.

- [ ] **Step 1: Write the failing `useRendering` test**

`web/test/useRendering.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { useRendering } from '~/composables/useRendering'

describe('useRendering', () => {
  it('counts concurrent renders and never goes negative', () => {
    const r = useRendering()
    const a = r.begin()
    const b = r.begin()
    expect(r.active.value).toBe(2)
    a(); b()
    expect(r.active.value).toBe(0)
    b() // double-done is a no-op
    expect(r.active.value).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run --project app test/useRendering.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `useRendering`**

A module-level shared counter (singleton across the app), with a done-guard so a callback only decrements once:

```ts
const active = ref(0)
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function sync(): void {
  if (active.value > 0) { if (!busy.value && !timer) timer = setTimeout(() => { busy.value = true; timer = undefined }, 150) }
  else { if (timer) { clearTimeout(timer); timer = undefined } busy.value = false }
}

export function useRendering() {
  const begin = (): (() => void) => {
    active.value++
    sync()
    let done = false
    return () => { if (done) return; done = true; active.value = Math.max(0, active.value - 1); sync() }
  }
  return { active: readonly(active), busy: readonly(busy), begin }
}
```
(`setTimeout` is fine under the `nuxt` test environment; guard the 150 ms debounce from flashing on fast redraws.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run --project app test/useRendering.test.ts`
Expected: PASS (the counter assertions; the debounce timing isn't asserted here).

- [ ] **Step 5: Bracket each sheet's `draw()`**

In `ScaleStaff.vue`, `GuideToneSystem.vue`, `ChangesSystem.vue`, wrap the body of `draw()`:

```ts
const rendering = useRendering()
async function draw(): Promise<void> {
  if (!el.value) return
  const done = rendering.begin()
  try {
    /* existing body: loadVexFlow, draw, set drawError = null */
  } catch (e) { /* existing catch */ } finally { done() }
}
```

- [ ] **Step 6: Create `Spinner.vue` and overlay it**

`web/app/components/ui/Spinner.vue` — a CSP-safe SVG with `animate-spin`:

```vue
<template>
  <svg class="size-6 animate-spin text-zinc-500 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
</template>
```

In `EditorView.vue`, over the sheet area add an overlay shown while rendering: `<div v-if="rendering.busy.value" class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><UiSpinner /></div>` (give the sheet container `relative`). Use `const rendering = useRendering()`.

- [ ] **Step 7: Add the navigation bar**

In `web/app/app.vue`, add `<NuxtLoadingIndicator />` inside `<AppShell>` (above `<NuxtPage />`): Nuxt drives the top progress bar on route changes.

- [ ] **Step 8: Verify**

Run: `cd web && make test && make lint`, then `npm run e2e -- e2e/editor.spec.ts`. For the spinner e2e: assert `getByRole('status', { name: 'Loading' })` appears then disappears on first load of a Changes sheet (it may be brief; if flaky, assert the spinner element exists in the DOM and the loading bar on `navigateTo`). Expected: green.

- [ ] **Step 9: Commit**

```bash
git add web/app/composables/useRendering.ts web/app/components/ui/Spinner.vue web/app/components/ScaleStaff.vue web/app/components/GuideToneSystem.vue web/app/components/ChangesSystem.vue web/app/components/EditorView.vue web/app/app.vue web/test/useRendering.test.ts web/e2e/editor.spec.ts
git commit -m "Preview: a loading spinner for re-renders and a nav progress bar"
```

---

## Final verification (whole branch, after all tasks)

- [ ] `make test` (engine + app unit) — green
- [ ] `make lint` — clean
- [ ] `make e2e` — green (route rename, toolbar, editor toggle, transpose, chart report, divider gone, spinner)
- [ ] `git diff --quiet fixtures/golden.json` — golden unchanged (all display-only)
- [ ] `grep -rn "/editor" web/app web/e2e | grep -v node_modules` — CLEAN
- [ ] Dev eyeball (`make dev`): `/song` song-first; toolbar groups read at a glance on desktop and wrap on a phone; scale labels don't collide on the Changes sheet; spinner shows on a slow first render.

Each task is its own PR, merged on green per the repo's merge discipline.
