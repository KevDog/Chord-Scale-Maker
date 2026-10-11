# Lead-sheet editor: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Changes sheet an editing surface: a chord field on its beat with analysis-driven completions, the
numeral and scale labels as function and scale pickers, a bar toolbar, ghost bars, and the heading edited where it
prints; behind the `leadSheetEditor` flag, from `md` up.

**Architecture:** Two pure engine functions (`chordCompletions`, `chordPreview`) and one pure web util
(`nextChordLine`) do the thinking; four small Vue components (`SheetChord`, `SheetLabelPicker`, `SheetBarToolbar`,
`SheetHeading`) sit in `ChangesSystem` / `SheetPages` where the sheet already places HTML over the drawing; `EditorView`
owns the one editing state (`sheetEdit`) and the existing `editor.setDoc` path. Every structure action is the
inspector's engine call by name, so the grid and the sheet never disagree. Nothing changes the format, the analysis or
`fixtures/golden.json`.

**Tech Stack:** TypeScript strict; Nuxt 3 / Vue 3; Headless UI (`Popover`, `Menu`); Tailwind + Catalyst `Ui*`;
Vitest (`mountSuspended`); Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md` (decisions D1–D12 accepted by the user,
2026-10-11). Mockup: `docs/superpowers/proposals/editor-ux/mockup-a-lead-sheet.html`.

**PR boundaries** (one PR per session; `make test`, `make lint`, `make e2e` green on each): Task 1 · Tasks 2–5 ·
Task 6 · Task 7 · Task 8 · Task 9. Each PR's branch is cut in the worktree: `git -C ../csm-proposed-scales fetch &&
git -C ../csm-proposed-scales switch -c <branch> origin/main`.

## Global Constraints

- `engine/` has no Vue, DOM or app imports (lint rule; its tsconfig has no DOM). View logic that can be pure goes there.
- Pages run under the hashed CSP: no inline `<script>`, no `eval`, no third-party origins. Inline `style` attributes
  are allowed (the sheet places HTML with `left: x%` already).
- Runtime `dependencies` don't change: `vue`, `vexflow`, `@headlessui/vue`, `@heroicons/vue`, `@fontsource-variable/jost`,
  the workspace engine.
- New flags start **off** (`web/nuxt.config.ts` `runtimeConfig.public.features`); the e2e script in `web/package.json`
  turns every flag on with `NUXT_PUBLIC_FEATURES_<NAME>=true`; `web/test/features.test.ts` asserts the exact flag set.
- `engine/src/index.ts` is the public API; `engine/src/__tests__/api.test.ts` snapshots its exported names
  (`npx vitest run -u src/__tests__/api.test.ts` from `engine/` after an intended change; review the diff).
- The golden fixture must not change: no `make golden` in this plan.
- Charts are concert pitch; the sheet editor shows and takes concert pitch (D2).
- Phones (below `md`, 768 px): nothing in this plan appears; `SheetChordEditor` (the bottom sheet) stays the editor (D8).
- Every editing mark is `print:hidden` (D11).
- Test names: no straight apostrophe inside a single-quoted `it('…')` (the oxc parser); use `’`.
- UI from the Catalyst port in `web/app/components/ui/` (`UiButton`, `UiInput`, `UiBadge`, `UiText`, `UiErrorMessage`,
  `UiDropdown*`, …); Headless UI for popovers and menus.
- Commits end with the session's attribution line (currently `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`).

## Review Focus

Inputs the spec implies but no task's tests exercised at first; each now has its test in the task named.

1. **A bar already holding `beats` chords, Space pressed** → no slot opens; the live region says "A bar holds at most 4
   chords." (the grid's message). Task 4.
2. **Tab from the last chord of the chart** → the field closes and focus lands on that section's ghost bar (Task 7);
   until Task 7, on the chord's button. `nextChordLine` returns `null` there. Task 3, Task 5.
3. **Tab into a held bar** (no chord of its own) → skipped: Tab lands on the next bar that has a chord. Task 3.
4. **A draft with a `|`, a leading `#` or `@`** (`cellError`) → refused in the field with the message, never written.
   Task 4.
5. **The editor open on a chart over a size limit** (`editor.fatal`) → no field, no toolbar: `sheetEditing` is already
   false there; the banner isn't shown either. Task 5.

---

### Task 1: Engine: `chordCompletions` and `chordPreview`

**Files:**
- Create: `engine/src/completions.ts`
- Create: `engine/src/__tests__/completions.test.ts`
- Modify: `engine/src/index.ts` (add `export * from './completions'` after `./barLine`)
- Modify: `engine/src/__tests__/__snapshots__/api.test.ts.snap` (regenerated)
- Modify: `docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md` §2 (the `chordPreview` signature below
  replaces the spec's line-based one: a preview is of a **bar's chords**, so the new-chord slot after Space previews
  the same way as a chord that exists)

**Interfaces:**
- Consumes: `QUALITY_NAMES`, `readChord`, `defaultScaleOrNull` (`qualities.ts`); `setBarChords` (`edit.ts`); `rowNotes`
  (`notes.ts`); `ScaleView` (`resolve.ts`).
- Produces:
  ```ts
  export function chordCompletions(text: string, limit?: number): readonly string[]            // limit 6
  export type ChordPreview = Readonly<{ numeral: string | null; scale: string | null; readable: boolean }>
  export function chordPreview(doc: ChartDoc, section: string, bar: number, chords: readonly string[], index: number, view?: ScaleView): ChordPreview
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// engine/src/__tests__/completions.test.ts
import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { chordCompletions, chordPreview } from '../completions'

const C = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const GM = parseChart('title: T\nkey: Gm\nA | 1 | Am7b5\nA | 2 | D7\nA | 3 | Gm7\n').value

describe('chordCompletions', () => {
  it('puts the typed text first, then the root with each quality that starts with the suffix typed', () => {
    expect(chordCompletions('D7')).toEqual(['D7', 'D7sus4', 'D7sus4b9', 'D7b9', 'D7b9b13', 'D7b13'])
    expect(chordCompletions('D7b')).toEqual(['D7b', 'D7b9', 'D7b9b13', 'D7b13'])
    expect(chordCompletions('D7b9')).toEqual(['D7b9', 'D7b9b13'])
  })

  it('offers the common qualities for a bare root, and keeps the root’s own spelling', () => {
    expect(chordCompletions('Bb')).toEqual(['Bb', 'Bb7', 'Bbm7', 'BbMaj7', 'Bbm7b5', 'Bb7b9'])
    expect(chordCompletions('F#', 3)).toEqual(['F#', 'F#7', 'F#m7'])
  })

  it('matches qualities without regard to case', () => {
    expect(chordCompletions('Cma')).toEqual(['Cma', 'Cmaj', 'CMaj7', 'CMaj7#11', 'CMaj7#5']) // the data's order
  })

  it('leaves a slash bass alone', () => {
    expect(chordCompletions('D7/F#')).toEqual(['D7/F#', 'D7sus4/F#', 'D7sus4b9/F#', 'D7b9/F#', 'D7b9b13/F#', 'D7b13/F#'])
  })

  it('offers nothing for an empty draft, and only the text for one with no root', () => {
    expect(chordCompletions('')).toEqual([])
    expect(chordCompletions('%')).toEqual(['%'])
    expect(chordCompletions('xyz')).toEqual(['xyz'])
  })
})

describe('chordPreview', () => {
  it('reads a candidate in its bar: the numeral and scale the analysis gives', () => {
    expect(chordPreview(C, 'A', 2, ['G7'], 0)).toEqual({ numeral: 'V7', scale: 'G Mixolydian', readable: true })
    expect(chordPreview(GM, 'A', 2, ['D7'], 0)).toEqual({ numeral: 'V7', scale: 'D Phrygian Dominant', readable: true })
    expect(chordPreview(GM, 'A', 2, ['D7b9'], 0)).toMatchObject({ numeral: 'V7', scale: 'D Phrygian Dominant' })
  })

  it('previews a new chord added to a bar, at its index', () => {
    const p = chordPreview(C, 'A', 1, ['Dm7', 'A7'], 1)
    expect(p.readable).toBe(true)
    expect(p.scale).toMatch(/^A /)
    expect(p.numeral).toBe('V7/ii') // "V7 of the Dm7 before it" (rule D4), checked against the engine while planning
  })

  it('reads at the view’s level', () => {
    expect(chordPreview(GM, 'A', 2, ['D7'], 0, { level: 'basic', seed: 0 }).scale).toBe('G Minor Pentatonic')
  })

  it('falls back to the quality’s default where the analysis doesn’t reach, and says when a chord can’t be read', () => {
    const NOKEY = parseChart('title: T\nA | 1 | Cm7\n').value
    expect(chordPreview(NOKEY, 'A', 1, ['Cm7'], 0)).toMatchObject({ scale: 'C Dorian', readable: true })
    expect(chordPreview(C, 'A', 2, ['Gxyz'], 0)).toEqual({ numeral: null, scale: null, readable: false })
    expect(chordPreview(C, 'A', 2, [''], 0)).toEqual({ numeral: null, scale: null, readable: false })
  })

  it('previews the row as it is when the chart refuses the chords', () => {
    expect(chordPreview(C, 'A', 1, [], 0)).toEqual({ numeral: 'ii7', scale: 'D Dorian', readable: false }) // a section’s first bar can’t be emptied
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd engine && npx vitest run src/__tests__/completions.test.ts`
Expected: FAIL, "Failed to resolve import '../completions'".

- [ ] **Step 3: Write `completions.ts`**

```ts
// engine/src/completions.ts
import type { ChartDoc } from './chart'
import { setBarChords } from './edit'
import { rowNotes } from './notes'
import { defaultScaleOrNull, QUALITY_NAMES, readChord } from './qualities'
import type { ScaleView } from './resolve'

/**
 * The lead-sheet editor's chord field (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.2): what
 * completes a half-typed chord, and how the chart would read a candidate in its bar. Pure: no DOM.
 */

/** the qualities offered for a bare root, most common first */
const COMMON = ['7', 'm7', 'Maj7', 'm7b5', '7b9'] as const
const ROOT_RE = /^([A-G][b#]?)([^/]*)(\/.*)?$/

/** chord symbols that complete `text`: the typed text first, then the root with each matching quality; at most `limit` */
export function chordCompletions(text: string, limit = 6): readonly string[] {
  const t = text.trim()
  if (!t) return []
  const m = ROOT_RE.exec(t)
  if (!m) return [t]
  const [, root = '', suffix = '', bass = ''] = m
  const typed = suffix.toLowerCase()
  const pool = typed ? QUALITY_NAMES.filter((q) => q.toLowerCase().startsWith(typed)) : COMMON
  const out = [t, ...pool.map((q) => `${root}${q}${bass}`)]
  return out.filter((c, i) => out.indexOf(c) === i).slice(0, limit)
}

export type ChordPreview = Readonly<{ numeral: string | null; scale: string | null; readable: boolean }>

/** the doc lines of the rows written for a bar, in order */
const rowsOf = (doc: ChartDoc, section: string, bar: number): number[] =>
  doc.lines.flatMap((l, i) => (l.kind === 'row' && l.section === section && l.bar === String(bar) ? [i] : []))

/**
 * how the chart would read a bar once its chords are `chords`: the numeral and scale of the one at `index`, at the
 * view's level. The quality's default where the analysis doesn't reach; nulls for a chord that can't be read. When
 * the chart refuses the chords (the same doc back), the row as it is.
 */
export function chordPreview(doc: ChartDoc, section: string, bar: number, chords: readonly string[], index: number, view?: ScaleView): ChordPreview {
  const chord = chords[index]?.trim() ?? ''
  if (!chord) return { numeral: null, scale: null, readable: false }
  const readable = readChord(chord) !== null
  const next = setBarChords(doc, section, bar, chords)
  const line = rowsOf(next, section, bar)[index]
  if (next === doc || line === undefined) {
    const kept = line === undefined ? undefined : rowNotes(doc, view).get(line)
    return kept ? { numeral: kept.numeral || null, scale: kept.scale || null, readable: false } : { numeral: null, scale: null, readable: false }
  }
  if (!readable) return { numeral: null, scale: null, readable: false }
  const n = rowNotes(next, view).get(line)
  return { numeral: n?.numeral || null, scale: n?.scale || defaultScaleOrNull(chord), readable }
}
```

If the refused-chords test's `readable` reads awkwardly, keep the test (the field uses `readable` to blank the
preview labels; a refused edit shows the row's own labels, which `numeral`/`scale` carry).

- [ ] **Step 4: Export, run, snapshot**

Add `export * from './completions'` to `engine/src/index.ts` after `export * from './barLine'`.
Run: `cd engine && npx vitest run src/__tests__/completions.test.ts` → PASS.
Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__` → exactly two
names added: `chordCompletions`, `chordPreview`.
If a `chordCompletions` expectation differs only in order, check `Object.keys(DATA.qualities)` order in
`chord_scales.json` (`6 7 maj m Maj7 Maj7#11 Maj7#5 m7 m6 mMaj7 7sus4 7sus4b9 7b9 7b9b13 7b13 7#11 7alt m7b5 dim7`) and
fix the **test**, not the data.

- [ ] **Step 5: Amend the spec's §2 signature** to the bar-based one above (one paragraph), then `make test`,
  `make lint`.

- [ ] **Step 6: Commit**

```bash
git add engine/src/completions.ts engine/src/__tests__/completions.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md
git commit -m "Engine: chordCompletions and chordPreview for the lead-sheet editor"
```

---

### Task 2: The `leadSheetEditor` flag

**Files:**
- Modify: `web/app/composables/useFeature.ts:5` (the `Feature` union)
- Modify: `web/nuxt.config.ts:81-87` (`features`)
- Modify: `web/package.json:14` (`e2e` script)
- Modify: `web/test/features.test.ts:15`

**Interfaces:**
- Produces: `useFeature('leadSheetEditor'): boolean`.

- [ ] **Step 1: Make the flag test fail**

In `web/test/features.test.ts` line 15, the expected object gains `leadSheetEditor: true`:
```ts
expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, practice: true, changes: true, functions: true, keySignatures: true, leadSheetEditor: true })
```
Run: `cd web && npx vitest run test/features.test.ts` → FAIL (the key is missing).

- [ ] **Step 2: Add the flag**

`useFeature.ts`: `export type Feature = 'myCharts' | 'practice' | 'changes' | 'functions' | 'keySignatures' | 'leadSheetEditor'`.
`nuxt.config.ts`, inside `features`, after `functions`:
```ts
        leadSheetEditor: false, // edit chords where they print on the Changes sheet (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md); off until sign-off
```
`web/package.json` `e2e`: append ` NUXT_PUBLIC_FEATURES_LEAD_SHEET_EDITOR=true` to the env list before `nuxt build`.
Check how vitest gets its flags: `grep -rn "NUXT_PUBLIC_FEATURES\|features:" web/vitest.config.ts web/test/setup*.ts`
and add the new flag the same way the other five are set there.

- [ ] **Step 3: Run, commit**

Run: `cd web && npx vitest run test/features.test.ts` → PASS.
```bash
git add web/app/composables/useFeature.ts web/nuxt.config.ts web/package.json web/test/features.test.ts web/vitest.config.ts
git commit -m "Lead-sheet editor: the leadSheetEditor flag, off"
```

---

### Task 3: `nextChordLine` (Tab moves by bars)

**Files:**
- Modify: `web/app/utils/sheetChordEdit.ts`
- Modify: `web/test/sheetChordEdit.test.ts`

**Interfaces:**
- Consumes: `barView`, `moveInGrid`, `posOfLine`, `GridPos` (engine).
- Produces: `nextChordLine(doc: ChartDoc, line: number, dir: 'next' | 'prev'): number | null` — the doc line of the
  first chord of the next (previous) bar that has a chord of its own; `null` off either end.

- [ ] **Step 1: Write the failing tests** (append to `web/test/sheetChordEdit.test.ts`)

```ts
import { parseChart } from '@chord-scale-maker/engine'
import { nextChordLine } from '~/utils/sheetChordEdit'

describe('nextChordLine', () => {
  // lines: 0 title, 1 key, 2 A1 Dm7, 3 A1 G7 (2nd chord), 4 A2 CMaj7, 6 A4 Am7 (bar 3 held), 7 B1 Fm7, 8 @copy
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | CMaj7\n\nA | 4 | Am7\nB | 1 | Fm7\n@copy A A2 8\n').value

  it('moves to the next bar’s first chord, past the other chords in this bar', () => {
    expect(nextChordLine(doc, 2, 'next')).toBe(4)
    expect(nextChordLine(doc, 3, 'next')).toBe(4)
  })

  it('skips a held bar, and crosses into the next section', () => {
    expect(nextChordLine(doc, 4, 'next')).toBe(6)
    expect(nextChordLine(doc, 6, 'next')).toBe(7)
  })

  it('moves back to the previous bar’s first chord', () => {
    expect(nextChordLine(doc, 4, 'prev')).toBe(2)
    expect(nextChordLine(doc, 7, 'prev')).toBe(6)
  })

  it('is null off either end, and for a line that isn’t a chord', () => {
    expect(nextChordLine(doc, 7, 'next')).toBeNull()
    expect(nextChordLine(doc, 2, 'prev')).toBeNull()
    expect(nextChordLine(doc, 0, 'next')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd web && npx vitest run test/sheetChordEdit.test.ts` → FAIL, `nextChordLine` is not exported.

- [ ] **Step 3: Implement** (append to `web/app/utils/sheetChordEdit.ts`; add the engine imports at the top)

```ts
import { barView, type ChartDoc, type GridPos, moveInGrid, posOfLine } from '@chord-scale-maker/engine'

/**
 * where Tab (⇧Tab) takes the chord field: the first chord of the next (previous) bar that has one of its own, over
 * line and section ends; null off either end (the field then closes). Held bars have nothing to edit and are skipped.
 */
export function nextChordLine(doc: ChartDoc, line: number, dir: 'next' | 'prev'): number | null {
  const view = barView(doc)
  const from = posOfLine(view, line)
  if (!from) return null
  const chordAt = (p: GridPos): number | undefined => view.sections.find((s) => s.name === p.section)?.bars.find((b) => b.bar === p.bar)?.chords[0]?.line
  let p: GridPos | null = from
  for (;;) {
    p = moveInGrid(view, p, dir === 'next' ? 'next' : 'prev')
    if (!p) return null
    if (p.section === from.section && p.bar === from.bar) continue // another chord of the same bar
    const found = chordAt(p)
    if (found !== undefined) return found
  }
}
```

- [ ] **Step 4: Run, lint, commit**

Run: `cd web && npx vitest run test/sheetChordEdit.test.ts` → PASS. `make lint`.
```bash
git add web/app/utils/sheetChordEdit.ts web/test/sheetChordEdit.test.ts
git commit -m "Lead-sheet editor: nextChordLine, Tab moves by bars"
```

---

### Task 4: `SheetChord`: the chord as a button, or a field with completions

**Files:**
- Create: `web/app/components/SheetChord.vue`
- Create: `web/test/SheetChord.test.ts`
- Modify: `web/app/utils/sheetChordEdit.ts` (the `SheetEdit` type)

**Interfaces:**
- Consumes: `chordCompletions`, `chordPreview`, `chordsAfterTyping`, `barView`, `posOfLine`, `setBarChords`,
  `cellError`, `ChordSymbol` (existing component), `UiTouchTarget`, `UiErrorMessage`, `SCALE_VIEW` (`~/utils/scaleView`).
- Produces, in `sheetChordEdit.ts`:
  ```ts
  /** what the sheet is editing: a chord by its doc line, or a new chord slot after a bar's chords */
  export type SheetEdit = Readonly<{ kind: 'chord'; line: number } | { kind: 'slot'; section: string; bar: string }>
  ```
  and the component:
  ```ts
  props: { doc: ChartDoc; line: number; section: string; bar: string; text: string; tokens: readonly ChordToken[] | null; label: string;
           editing: SheetEdit | null; selected: boolean; slot?: boolean }
  emits: { 'edit': [SheetEdit]; 'update:doc': [ChartDoc]; 'said': [string]; 'preview': [ChordPreview | null];
           'done': [then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'] }
  ```
  `editing` matches this chord when `editing.kind === 'chord' && editing.line === line`, or, for a slot instance
  (`slot` true), when `editing.kind === 'slot'` and section/bar match. `preview` reports the draft's reading (null when
  not editing) so `ChangesSystem` can show it under the chord.

- [ ] **Step 1: Write the failing tests**

```ts
// web/test/SheetChord.test.ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetChord from '~/components/SheetChord.vue'
import type { SheetEdit } from '~/utils/sheetChordEdit'

// lines: 0 title, 1 key, 2 A1 Dm7, 3 A2 G7, 4 A3 CMaj7
const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const rows = (d: ChartDoc | undefined): string[] => (d ? serializeChart(d).split('\n').filter((l) => /^A \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()) : [])
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const mount = (editing: SheetEdit | null, over: Partial<{ line: number; bar: string; text: string; slot: boolean }> = {}) =>
  mountSuspended(SheetChord, {
    props: { doc, line: 3, section: 'A', bar: '2', text: 'G7', tokens: null, label: 'Edit G7, A bar 2', editing, selected: false, ...over },
    attachTo: document.body,
  })
type W = Awaited<ReturnType<typeof mount>>
const field = (w: W) => w.find<HTMLInputElement>('input')
async function type(w: W, value: string) {
  await field(w).setValue(value)
  await settle()
}
const lastDoc = (w: W): ChartDoc | undefined => (w.emitted('update:doc')?.at(-1) as [ChartDoc] | undefined)?.[0]

describe('SheetChord', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('is a labelled button when not editing, and asks to edit on click', async () => {
    const w = await mount(null)
    const b = w.find('button')
    expect(b.attributes('aria-label')).toBe('Edit G7, A bar 2')
    await b.trigger('click')
    expect(w.emitted('edit')?.[0]).toEqual([{ kind: 'chord', line: 3 }])
  })

  it('is a field with the chord selected when editing', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await settle()
    const el = field(w)
    expect(el.attributes('aria-label')).toBe('Chord, A bar 2')
    expect(el.element.value).toBe('G7')
    expect(document.activeElement).toBe(el.element)
    expect(el.element.selectionStart).toBe(0)
    expect(el.element.selectionEnd).toBe(2)
  })

  it('lists completions with each one’s reading in this bar, the typed text first', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b')
    const options = w.findAll('[role=option]').map((o) => o.text().replace(/\s+/g, ' '))
    expect(options[0]).toMatch(/^G7b/)
    expect(options[1]).toMatch(/^G7♭9 .*→ G /)
    expect(w.find('[role=listbox]').attributes('aria-label')).toBe('Completions')
  })

  it('reports the draft’s reading as it changes, and nothing once done', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b9')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ numeral: 'V7', readable: true })
    await type(w, 'Gxyz')
    expect(w.emitted('preview')?.at(-1)?.[0]).toMatchObject({ readable: false })
  })

  it('commits on Enter once, and says so', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['A | 1 | Dm7', 'A | 2 | Db7', 'A | 3 | CMaj7'])
    expect(w.emitted('update:doc')).toHaveLength(1)
    expect(w.emitted('said')?.[0]).toEqual(['A, bar 2: Db7'])
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('takes the active completion on Enter', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7b')
    await field(w).trigger('keydown', { key: 'ArrowDown' })
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | G7b9')
  })

  it('commits and moves on Tab and ⇧Tab, commits and adds on Space', async () => {
    for (const [key, shift, then] of [['Tab', false, 'next'], ['Tab', true, 'prev'], [' ', false, 'add']] as const) {
      document.body.innerHTML = ''
      const w = await mount({ kind: 'chord', line: 3 })
      await type(w, 'G13')
      await field(w).trigger('keydown', { key, shiftKey: shift })
      await settle()
      expect(rows(lastDoc(w))[1], key).toBe('A | 2 | G13')
      expect(w.emitted('done')?.[0], key).toEqual([then])
    }
  })

  it('cancels on Escape without writing', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')?.[0]).toEqual(['cancel'])
  })

  it('refuses a draft the chart can’t hold, and keeps the field open with why', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, 'G7 | x')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.emitted('done')).toBeUndefined()
    expect(w.text()).toContain('can’t go in a chart')
  })

  it('refuses taking out a section’s first chord', async () => {
    const w = await mount({ kind: 'chord', line: 2 }, { line: 2, bar: '1', text: 'Dm7' })
    await type(w, '')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.text()).toContain('first bar needs a chord')
  })

  it('% is the bar before', async () => {
    const w = await mount({ kind: 'chord', line: 3 })
    await type(w, '%')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))[1]).toBe('A | 2 | Dm7')
  })

  it('a slot: opens empty, commits as the bar’s added chord, adds nothing on an empty commit', async () => {
    const w = await mount({ kind: 'slot', section: 'A', bar: '2' }, { slot: true, text: '' })
    await settle()
    expect(field(w).element.value).toBe('')
    await type(w, 'Db7')
    await field(w).trigger('keydown', { key: 'Enter' })
    await settle()
    expect(rows(lastDoc(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 2 | Db7', 'A | 3 | CMaj7'])
    document.body.innerHTML = ''
    const w2 = await mount({ kind: 'slot', section: 'A', bar: '2' }, { slot: true, text: '' })
    await field(w2).trigger('keydown', { key: 'Enter' })
    expect(w2.emitted('update:doc')).toBeUndefined()
    expect(w2.emitted('done')?.[0]).toEqual(['stay'])
  })

  it('refuses a fifth chord in a 4/4 bar on Space (Review Focus 1)', async () => {
    const full = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 1 | Em7\nA | 1 | A7\nA | 2 | CMaj7\n').value
    const w = await mountSuspended(SheetChord, { props: { doc: full, line: 5, section: 'A', bar: '1', text: 'A7', tokens: null, label: 'Edit A7, A bar 1', editing: { kind: 'chord', line: 5 }, selected: false }, attachTo: document.body })
    await settle()
    await field(w).trigger('keydown', { key: ' ' })
    await settle()
    expect(w.emitted('done')?.[0]).toEqual(['stay'])
    expect(w.emitted('said')?.at(-1)).toEqual(['A bar holds at most 4 chords.'])
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd web && npx vitest run test/SheetChord.test.ts` → FAIL (no component).

- [ ] **Step 3: Add `SheetEdit` to `sheetChordEdit.ts`** (the type above, exported beside `SheetChordEdit`).

- [ ] **Step 4: Write the component**

```vue
<!-- web/app/components/SheetChord.vue -->
<template>
  <!-- a chord on the Changes sheet while the editor is shown: a button, or the field it opens into, in place -->
  <div v-if="!isEditing" class="text-base font-semibold print:text-sm/4">
    <button
      type="button"
      :aria-label="label"
      :class="['relative -mx-1 cursor-pointer rounded px-1 hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10', selected && 'ring-2 ring-note-600 dark:ring-note-400', unknown && 'underline decoration-amber-500 decoration-2 underline-offset-4']"
      @click="emit('edit', slot ? { kind: 'slot', section, bar } : { kind: 'chord', line })"
    >
      <UiTouchTarget><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>{{ text }}</span></UiTouchTarget>
    </button>
  </div>
  <div v-else class="relative print:hidden">
    <input
      ref="input"
      v-model="draft"
      type="text"
      :aria-label="`Chord, ${section} bar ${bar}`"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="options.length > 0"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="active >= 0 ? `${id}-${active}` : undefined"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :style="{ width: `max(3ch, ${draft.length + 1}ch)` }"
      class="-mx-1 rounded bg-white px-1 text-base font-semibold text-zinc-950 ring-2 ring-note-500 outline-none dark:bg-zinc-900 dark:text-white"
      @keydown="onKey"
      @blur="onBlur"
    />
    <div class="absolute top-full left-0 z-30 mt-1 w-72 rounded-lg bg-white text-sm shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
      <ul v-if="options.length" :id="`${id}-list`" role="listbox" aria-label="Completions">
        <li
          v-for="(o, i) in options"
          :id="`${id}-${i}`"
          :key="o.text"
          role="option"
          :aria-selected="i === active"
          :class="['flex justify-between gap-3 px-3 py-1.5', i === active ? 'bg-note-500 text-white' : 'text-zinc-950 dark:text-white']"
          @mousedown.prevent="take(o.text)"
        >
          <b><ChordSymbol v-if="o.tokens" :tokens="o.tokens" /><span v-else>{{ o.text }}</span></b>
          <span :class="['truncate text-xs/5', i === active ? 'opacity-90' : 'text-zinc-600 dark:text-zinc-400']">{{ readingOf(o.preview) }}</span>
        </li>
      </ul>
      <UiErrorMessage v-if="error" class="px-3 py-1.5">{{ error }}</UiErrorMessage>
      <UiText v-if="repeatOf" role="note" class="px-3 py-1.5 text-xs/5!">{{ section }} repeats {{ repeatOf }}: a change here changes {{ repeatOf }} and every repeat of it.</UiText>
      <p class="border-t border-zinc-950/5 px-3 py-1.5 text-xs/5 text-zinc-600 dark:border-white/5 dark:text-zinc-400"><kbd>Tab</kbd> next bar · <kbd>Space</kbd> add a chord · <kbd>Esc</kbd> cancel</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { barView, cellError, type ChartDoc, chordCompletions, chordPreview, type ChordPreview, chordsAfterTyping, type ChordToken, chordTokens, CONCERT, type GridPos, posOfLine, setBarChords } from '@chord-scale-maker/engine'
import type { SheetEdit } from '~/utils/sheetChordEdit'
import { DEFAULT_VIEW, SCALE_VIEW } from '~/utils/scaleView'

/**
 * A chord on the Changes sheet while the editor is shown (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md
 * §1.1–1.2): a button ("Edit G7, A bar 2"), or, when `editing` names it, a field in its place with completions that
 * read each candidate in this bar. Enter and Tab commit (Tab then asks to move), Space commits and asks for a new chord
 * slot, Esc cancels, blank takes the chord out, % is the bar before. A slot instance (`slot`) is the new chord after
 * the bar's: it opens empty and commits as an added chord. The doc is written once, on commit.
 */
const props = defineProps<{ doc: ChartDoc; line: number; section: string; bar: string; text: string; tokens: readonly ChordToken[] | null; label: string; editing: SheetEdit | null; selected: boolean; slot?: boolean }>()
const emit = defineEmits<{ edit: [edit: SheetEdit]; 'update:doc': [doc: ChartDoc]; said: [text: string]; preview: [preview: ChordPreview | null]; done: [then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'] }>()

const id = useId()
const input = ref<HTMLInputElement | null>(null)
const scaleView = inject(SCALE_VIEW, shallowRef(DEFAULT_VIEW))
const isEditing = computed(() => {
  const e = props.editing
  if (!e) return false
  return props.slot ? e.kind === 'slot' && e.section === props.section && e.bar === props.bar : e.kind === 'chord' && e.line === props.line
})
const unknown = computed(() => !props.slot && !!props.text && !scaleChoices(props.text).known)

const view = computed(() => barView(props.doc))
/** the chord's place on the grid; a slot's is after the bar's last chord (insert) */
const pos = computed((): GridPos | null => {
  if (props.slot) {
    const bars = view.value.sections.find((s) => s.name === props.section)?.bars
    const b = bars?.find((x) => String(x.bar) === props.bar)
    return b ? { section: props.section, bar: b.bar, chord: b.chords.length } : null
  }
  return posOfLine(view.value, props.line)
})
const barChords = computed((): string[] => (pos.value ? chordsAfterTyping(view.value, pos.value, props.slot ? '' : props.text, false) : []))
/** the section a repeat's chord is written in (the drawn section differs): changing it changes that section */
const repeatOf = computed(() => {
  const l = props.doc.lines[props.line]
  return l?.kind === 'row' && l.section !== props.section ? l.section : ''
})

const draft = ref('')
const refused = ref('')
const active = ref(0)
let settled = false // the field closed by a key, so blur writes nothing twice
watch(isEditing, (on) => {
  if (!on) return
  draft.value = props.slot ? '' : props.text
  refused.value = ''
  active.value = 0
  settled = false
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}, { immediate: true })
watch(draft, () => {
  refused.value = ''
  active.value = 0
})

const error = computed(() => {
  const t = draft.value.trim()
  const bad = t && t !== '%' ? cellError(t) : null
  return bad ? `“${t}” can’t go in a chart: ${bad}.` : refused.value
})

/** the bar's chords once the draft is written at pos */
const chordsWith = (text: string): string[] => (pos.value ? chordsAfterTyping(view.value, pos.value, text, !!props.slot) : [])
const previewOf = (text: string): ChordPreview | null => {
  const p = pos.value
  if (!p || !text.trim()) return null
  const chords = chordsWith(text)
  return chordPreview(props.doc, p.section, p.bar, chords, text.trim() === '%' ? Math.max(0, chords.length - 1) : Math.min(p.chord, chords.length - 1), scaleView.value)
}
const readingOf = (p: ChordPreview | null): string => (p?.readable ? [p.numeral, p.scale].filter(Boolean).join(' → ') : '')
const options = computed(() => (isEditing.value ? chordCompletions(draft.value).map((text) => ({ text, tokens: tokensOf(text), preview: previewOf(text) })) : []))
function tokensOf(text: string): readonly ChordToken[] | null {
  try {
    return chordTokens(CONCERT, text) // the sheet edits in concert pitch (D2)
  } catch {
    return null
  }
}
watch([draft, isEditing], () => emit('preview', isEditing.value ? previewOf(draft.value) : null))

/** the draft into its bar; false (and the field stays) when the chart can't take it */
function commit(text = draft.value): boolean {
  const p = pos.value
  if (!p) return true
  const t = text.trim()
  if (error.value) return false
  const chords = chordsWith(t)
  if (chords.length === barChords.value.length && chords.every((c, k) => c === barChords.value[k])) return true // nothing changed, or an empty slot
  const next = setBarChords(props.doc, p.section, p.bar, chords)
  if (next === props.doc) {
    refused.value = chords.length ? `“${t}” can’t go in a chart: it’s not a chord.` : 'A section’s first bar needs a chord.'
    return false
  }
  emit('update:doc', next)
  emit('said', `${p.section}, bar ${p.bar}: ${chords.join(', ') || 'held'}`)
  return true
}
function finish(then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'): void {
  settled = true
  emit('preview', null)
  emit('done', then)
}
function take(text: string): void {
  draft.value = text
  if (commit(text)) finish('stay')
}
function onKey(e: KeyboardEvent): void {
  const n = options.value.length
  if (e.key === 'ArrowDown' && n) return void (e.preventDefault(), (active.value = (active.value + 1) % n))
  if (e.key === 'ArrowUp' && n) return void (e.preventDefault(), (active.value = (active.value - 1 + n) % n))
  if (e.key === 'Escape') return void (e.preventDefault(), finish('cancel'))
  if (e.key === 'Enter') {
    e.preventDefault()
    const chosen = options.value[active.value]?.text ?? draft.value
    if (active.value > 0) draft.value = chosen
    if (commit(chosen)) finish('stay')
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    if (commit()) finish(e.shiftKey ? 'prev' : 'next')
    return
  }
  if (e.key === ' ') {
    e.preventDefault()
    const p = pos.value
    if (!commit()) return
    const after = chordsWith(draft.value).length
    if (p && after >= view.value.beats) return void (emit('said', `A bar holds at most ${view.value.beats} chords.`), finish('stay'))
    finish('add')
  }
}
function onBlur(): void {
  if (settled || !isEditing.value) return
  if (commit()) finish('stay')
  else finish('cancel')
}
</script>
```

Notes for the implementer:
- `chordTokens(part, chord, scaleText?)` (`engine/src/chord.ts:73`) is the function behind `ChordSymbol`; `CONCERT`
  (`engine/src/part.ts:21`, `{ clef: 'treble', trans: 'C' }`) is the concert part.
- `scaleChoices` is auto-imported from `~/utils/scaleChoices.ts` (Nuxt auto-imports `utils/`).
- The slot's `chordsWith` passes `insert: true` with `pos.chord === chords.length`, which appends; for an existing chord `insert` is false (replace), as the grid does.
- A blur after a refused commit cancels (the chord goes back to its button) rather than leaving a dangling field; the live region already said why.

- [ ] **Step 5: Run the tests; fix until green**

Run: `cd web && npx vitest run test/SheetChord.test.ts` → PASS. Then `make lint`.
If `role="combobox"` on an `<input>` with a `<ul role=listbox>` sibling trips the a11y lint rule, keep the roles (the
WAI-ARIA combobox pattern) and `aria-controls` as written.

- [ ] **Step 6: Commit**

```bash
git add web/app/components/SheetChord.vue web/test/SheetChord.test.ts web/app/utils/sheetChordEdit.ts
git commit -m "Lead-sheet editor: SheetChord, a chord's button or its field with completions"
```

---

### Task 5: Wire the field into the sheet: banner, concert pitch, moves, e2e

**Files:**
- Modify: `web/app/components/ChangesSystem.vue:12-25` (the chord button → `SheetChord`; the slot; the preview labels)
- Modify: `web/app/components/ChangesSheet.vue` (props `editing`, `preview`; emits)
- Modify: `web/app/components/EditorView.vue` (banner; `sheetEdit` state; concert part; forced numerals/scales; handlers)
- Modify: `web/app/components/PreviewControls.vue` (a `lockLabels` prop that disables the Numerals/Scales toggles with a title)
- Modify: `web/test/ChangesSystem.test.ts`, `web/test/EditorView.test.ts`
- Modify: `web/e2e/sheet-edit.spec.ts`

**Interfaces:**
- Consumes: `SheetChord`, `SheetEdit`, `nextChordLine`, `useFeature('leadSheetEditor')`, `useMediaQuery('(min-width: 768px)')`
  (as `SheetChordEditor` uses it), `partFor` (engine) for the concert part.
- Produces: `ChangesSheet` / `ChangesSystem` props `editing: SheetEdit | null` and emits `'update:doc'`, `said`,
  `edit: [SheetEdit]`, `done: [then]`, `preview: [ChordPreview | null]`; the existing `edit: [SheetChordEdit]` emit is
  kept for the flag-off / phone path (renamed `tap`).

- [ ] **Step 1: Failing unit tests**

In `web/test/ChangesSystem.test.ts`, add (the existing `chord()`/`bar()` helpers; add `line`, `written`, `rule`, `fallback`
fields to `chord()` if the type now requires them):
```ts
describe('ChangesSystem as the editor', () => {
  const line = (): ChangesLine => ({ bars: [bar([{ ...chord(0, 'Dm7', ''), line: 2, at: { section: 'A', bar: '1' } }, { ...chord(2, 'G7', ''), line: 3, at: { section: 'A', bar: '1' } }], [])] })
  it('renders each chord as a SheetChord while editable, with the one being edited a field', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { line: line(), first: true, beats: 4 as const, barsPerLine: 4, numerals: true, scales: true, editable: true, editing: { kind: 'chord', line: 3 }, doc } })
    expect(w.findAllComponents({ name: 'SheetChord' })).toHaveLength(2)
    expect(w.find('input[aria-label="Chord, A bar 1"]').exists()).toBe(true)
  })
  it('adds a slot after the bar’s chords when editing one, at the next beat', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { line: line(), first: true, beats: 4 as const, barsPerLine: 4, numerals: true, scales: true, editable: true, editing: { kind: 'slot', section: 'A', bar: '1' }, doc } })
    const slot = w.findAllComponents({ name: 'SheetChord' }).find((c) => c.props('slot'))
    expect(slot?.find('input').exists()).toBe(true)
    expect(slot?.element.parentElement?.style.left).toBe('70%') // xs[0][3] from the mocked drawing (the beat after G7's), minus nothing
  })
  it('shows the draft’s reading under the chord being edited, italic and muted', async () => {
    const w = await mountSuspended(ChangesSystem, { props: { line: line(), first: true, beats: 4 as const, barsPerLine: 4, numerals: true, scales: true, editable: true, editing: { kind: 'chord', line: 3 }, preview: { numeral: 'V7', scale: 'G Altered', readable: true }, doc } })
    expect(w.find('[data-slot=numeral][data-draft]').text()).toBe('V7')
    expect(w.find('[data-slot=scale][data-draft]').text()).toBe('G Altered')
  })
})
```
`doc` here is `parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\n').value`; `ChangesSystem` gains a `doc` prop (needed by `SheetChord`).
Adjust the `70%` expectation to the mocked `xs` (`[[0.1, 0.3, 0.5, 0.7]]`): the slot's beat is the last chord's beat + 1 → index 3 → `0.7 - 0.012` → `68.8%`. Write `'68.8%'`.

In `web/test/EditorView.test.ts`, in a new `describe('EditorView lead-sheet editor')`:
```ts
it('shows the banner with concert pitch for a transposing instrument while the editor is open, from md up', async () => {
  // mock useMediaQuery true (see how SheetChordEditor.test.ts or other tests stub it; else set window.matchMedia)
  const w = await mount()
  await buttonCalled(w, 'Edit')?.trigger('click')
  await chooseInstrument(w, 'Tenor')
  expect(w.text()).toContain('Concert pitch while you edit')
  expect(changesSheet(w).props('part').trans).toBe('C') // Part = { clef, trans: 'C' | 'Bb' | 'Eb' | 'F' }
  await buttonCalled(w, 'Done')?.trigger('click')
  expect(w.text()).not.toContain('Concert pitch while you edit')
})
it('forces numerals and scales on while editing, without changing the preferences', async () => {
  localStorage.setItem('csm-numerals', 'off')
  const w = await mount()
  await buttonCalled(w, 'Edit')?.trigger('click')
  expect(changesSheet(w).props('numerals')).toBe(true)
  expect(localStorage.getItem('csm-numerals')).toBe('off')
})
```
The instrument names are the keys of `INSTRUMENTS` (`engine/src/instruments.ts`): `concert`, `piano`, …; `Tenor` in
`chooseInstrument` matches the tenor sax's label.

- [ ] **Step 2: Run to see them fail**: `cd web && npx vitest run test/ChangesSystem.test.ts test/EditorView.test.ts`.

- [ ] **Step 3: `ChangesSystem.vue`**

Replace the chord `<div class="text-base font-semibold …">…</div>` block (lines 12–25) with:
```vue
<SheetChord
  v-if="editing !== undefined && m.line >= 0"
  :doc="doc!"
  :line="m.line"
  :section="m.row.section"
  :bar="m.row.bar"
  :text="m.text"
  :tokens="m.tokens"
  :label="editLabel(m)"
  :editing="editing"
  :selected="m.line === selectedLine"
  @edit="emit('edit', $event)"
  @update:doc="emit('update:doc', $event)"
  @said="emit('said', $event)"
  @preview="emit('preview', $event)"
  @done="emit('done', $event)"
/>
<div v-else class="text-base font-semibold print:text-sm/4"> …the existing button / plain symbol, its @click now emit('tap', …)… </div>
```
Add the slot: in `marks`, when `props.editing?.kind === 'slot'` and a bar's chords are `at` that section/bar, push one
more mark after the bar's last chord: `{ key: `${b}-slot`, line: -2, slot: true, x: at(Math.min(lastBeat + 1, beats - 1)), text: '', tokens: null, row: lastChord.at, … }`
and render it with `<SheetChord slot …>` (same props, `line` = the bar's last chord's line). Give the numeral and
scale spans `data-slot="numeral"` / `data-slot="scale"`, and when `editing?.kind === 'chord' && m.line === editing.line && preview`
render `preview.numeral` / `preview.scale` with `data-draft` and `class="italic text-zinc-500 dark:text-zinc-400"`
(blank when `!preview.readable`). Props added: `doc?: ChartDoc`, `editing?: SheetEdit | null`, `preview?: ChordPreview | null`.
Emits added: `tap: [SheetChordEdit]` (the old `edit`), `edit: [SheetEdit]`, `'update:doc'`, `said`, `preview`, `done`.

- [ ] **Step 4: `ChangesSheet.vue`**: pass the new props through to every `ChangesSystem` and re-emit the new events; keep `edit`→ rename to `tap` for the dialog path.

- [ ] **Step 5: `EditorView.vue`**

```ts
const leadSheetOn = useFeature('leadSheetEditor')
const wide = useMediaQuery('(min-width: 768px)')
/** the sheet is the editor: the flag, a large screen, and the editor open on a chart the sheet can draw */
const sheetEditor = computed(() => leadSheetOn && wide.value && sheetEditing.value)
const sheetEdit = ref<SheetEdit | null>(null)
const sheetPreview = ref<ChordPreview | null>(null)
const sheetPart = computed(() => (sheetEditor.value ? CONCERT : part.value)) // CONCERT from the engine
const concertNote = computed(() => (sheetEditor.value && part.value.trans !== 'C' ? `Concert pitch while you edit · your ${instrumentLabel(prefs.instrument.value)} part comes back when you’re done` : ''))
function openSheetEdit(e: SheetEdit): void {
  editor.flush()
  sheetEdit.value = e
  if (e.kind === 'chord') { selectedLine.value = e.line; barEditor.value?.selectLine(e.line) }
}
function sheetDone(then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'): void {
  const e = sheetEdit.value
  sheetPreview.value = null
  if (!e) return
  if (then === 'add') {
    const l = e.kind === 'chord' ? editor.doc.value.lines[e.line] : null
    const at = l?.kind === 'row' ? { section: l.section, bar: l.bar } : e.kind === 'slot' ? { section: e.section, bar: e.bar } : null
    sheetEdit.value = at ? { kind: 'slot', ...at } : null
    return
  }
  if ((then === 'next' || then === 'prev') && e.kind === 'chord') {
    const line = nextChordLine(editor.doc.value, e.line, then)
    sheetEdit.value = line === null ? null : { kind: 'chord', line }
    if (line !== null) selectedLine.value = line
    return
  }
  sheetEdit.value = null
}
```
Template: the banner above the preview section when `sheetEditor`:
```vue
<div v-if="sheetEditor" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-note-800 px-4 py-2 text-sm text-white print:hidden">
  <span class="font-semibold">Editing the sheet</span>
  <span v-if="concertNote" class="text-note-100">{{ concertNote }}</span>
  <span class="flex gap-2">
    <UiButton plain class="text-white!" :disabled="!chartHistory.canUndo.value" @click="chartHistory.undo"><ArrowUturnLeftIcon data-slot="icon" />Undo</UiButton>
    <UiButton plain class="text-white!" :aria-pressed="prefs.source.value" @click="prefs.source.value = !prefs.source.value">Source</UiButton>
    <UiButton color="white" @click="toggleEditor">Done</UiButton>
  </span>
</div>
```
(`useChartHistory` returns `{ undo, redo, canUndo, canRedo, onKeydown }`; `UiButton`'s `color="white"` is a Catalyst
colour (`web/app/utils/catalyst/button.ts` `colors`).)
`ChangesSheet` gets `:part="sheetPart" :numerals="sheetEditor || prefs.numerals.value" :scales="sheetEditor || prefs.scaleNames.value"
:editing="sheetEditor ? sheetEdit : undefined" :preview="sheetPreview" :doc="editor.doc.value"
@edit="openSheetEdit" @update:doc="editor.setDoc" @said="said = $event" @preview="sheetPreview = $event" @done="sheetDone" @tap="editSheetChord"`.
`PreviewControls` gets `:lock-labels="sheetEditor"`; inside, the Numerals and Scales buttons get `:disabled="lockLabels"`
and `:title="lockLabels ? 'Shown while you edit: they are the pickers' : <existing title>"`.
When `sheetEditor` turns false (Done, or the window narrows), clear `sheetEdit`: `watch(sheetEditor, (on) => { if (!on) sheetEdit.value = null })`.

- [ ] **Step 6: Run the unit tests → PASS; `make lint`.**

- [ ] **Step 7: e2e** (append to `web/e2e/sheet-edit.spec.ts`; the `beforeEach` already opens `/song?new=1` and the editor)

```ts
test('the sheet is the editor: type into a chord with completions that read the bar, Tab moves, Space adds', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.getByText('Editing the sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  const field = page.getByRole('combobox', { name: 'Chord, A bar 2' })
  await expect(field).toHaveValue('G7')
  await field.fill('G7b')
  const options = page.getByRole('listbox', { name: 'Completions' }).getByRole('option')
  await expect(options.first()).toHaveText(/^G7b/)
  await expect(options.nth(1)).toContainText('→ G ')
  const reading = (await options.nth(1).textContent())?.split('→')[1]?.trim() ?? ''
  await field.press('ArrowDown')
  await field.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7b9/)
  // the label under the chord now reads what the completion promised
  await expect(page.locator('[data-slot=scale]', { hasText: reading }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 1' }).press('Tab')
  await expect(page.getByRole('combobox', { name: 'Chord, A bar 2' })).toBeFocused()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit Dm7, A bar 1' }).click()
  await page.getByRole('combobox', { name: 'Chord, A bar 1' }).press(' ')
  const slot = page.getByRole('combobox', { name: 'Chord, A bar 1' })
  await expect(slot).toHaveValue('')
  await slot.fill('A7')
  await slot.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Dm7\nA \| 1 \| A7/)
  await expect(page.getByRole('button', { name: 'Edit A7, A bar 1' })).toBeVisible()
})

test('a transposing part is shown in concert pitch while editing, and comes back on Done', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await chooseInstrument(page, 'Tenor')
  await expect(page.getByText(/Concert pitch while you edit/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit G7, A bar 2' })).toBeVisible() // not A7, the tenor's
  await page.getByRole('button', { name: 'Done', exact: true }).first().click()
  await expect(page.getByText(/Concert pitch while you edit/)).toBeHidden()
  await expect(page.getByText('A7').first()).toBeVisible()
})

test('a refused chord keeps the field open and says why; Escape restores the chord', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).click()
  const field = page.getByRole('combobox', { name: 'Chord, A bar 2' })
  await field.fill('G7 | x')
  await field.press('Enter')
  await expect(page.getByText(/can’t go in a chart/)).toBeVisible()
  await expect(field).toBeVisible()
  await field.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit G7, A bar 2' })).toBeVisible()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7\n/)
})
```
Import `chooseInstrument` from `./fixtures`. The phone test already in the file must still pass unchanged (D8).
Run: `make e2e`; check `$?`.

- [ ] **Step 8: Commit**

```bash
git add web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/app/components/EditorView.vue web/app/components/PreviewControls.vue web/test/ChangesSystem.test.ts web/test/EditorView.test.ts web/e2e/sheet-edit.spec.ts
git commit -m "Lead-sheet editor: the chord field on the sheet, concert pitch and the banner (leadSheetEditor flag)"
```
Open the PR for Tasks 2–5.

---

### Task 6: The labels as pickers (`SheetLabelPicker`)

**Files:**
- Modify: `web/app/components/ChordChoices.vue` (a `part` prop; a `fallbackNote` prop)
- Create: `web/app/components/SheetLabelPicker.vue`
- Create: `web/test/SheetLabelPicker.test.ts`
- Modify: `web/app/components/ChangesSystem.vue` (numeral/scale spans → `SheetLabelPicker` while `editing !== undefined`)
- Modify: `web/e2e/sheet-edit.spec.ts`

**Interfaces:**
- `ChordChoices` gains `part?: 'function' | 'scale' | 'all'` (default `'all'`; `'function'` shows the function section
  and Why; `'scale'` the scale section and Why) and `fallbackNote?: string` (a line shown above the function list).
- `SheetLabelPicker` props: `{ doc: ChartDoc; line: number; kind: 'numeral' | 'scale'; chord: string; fallback: boolean; pinned: boolean }`,
  emits `'update:doc'`, `said`; slot: the label text.

- [ ] **Step 1: Failing tests**

```ts
// web/test/SheetLabelPicker.test.ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { parseChart } from '@chord-scale-maker/engine'
import SheetLabelPicker from '~/components/SheetLabelPicker.vue'

const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').value
const settle = async () => { for (let i = 0; i < 3; i++) await nextTick() }
const mount = (kind: 'numeral' | 'scale', over: Partial<{ fallback: boolean; pinned: boolean }> = {}) =>
  mountSuspended(SheetLabelPicker, { props: { doc, line: 3, kind, chord: 'G7', fallback: false, pinned: false, ...over }, slots: { default: () => (kind === 'numeral' ? 'V7' : 'G Mixolydian') }, attachTo: document.body })

describe('SheetLabelPicker', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('the numeral opens the function list, with Why under it', async () => {
    const w = await mount('numeral')
    await w.find('button').trigger('click')
    await settle()
    const panel = document.querySelector('[role=dialog]')
    expect(panel?.getAttribute('aria-label')).toBe('Function: G7')
    expect(panel?.querySelector('[role=radiogroup][aria-label=Function]')).not.toBeNull()
    expect(panel?.querySelector('[role=radiogroup][aria-label=Scale]')).toBeNull()
    expect(panel?.textContent).toContain('Why')
  })

  it('the scale opens the scale list', async () => {
    const w = await mount('scale')
    await w.find('button').trigger('click')
    await settle()
    const panel = document.querySelector('[role=dialog]')
    expect(panel?.getAttribute('aria-label')).toBe('Scale: G7')
    expect(panel?.querySelector('[role=radiogroup][aria-label=Scale]')).not.toBeNull()
    expect(panel?.querySelector('[role=radiogroup][aria-label=Function]')).toBeNull()
  })

  it('marks a guessed function in amber and says stating it settles it', async () => {
    const w = await mount('numeral', { fallback: true })
    expect(w.find('button').classes()).toContain('decoration-amber-500')
    await w.find('button').trigger('click')
    await settle()
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('could only guess here')
  })

  it('shows the pin before a pinned scale', async () => {
    const w = await mount('scale', { pinned: true })
    expect(w.find('svg[data-pin]').exists()).toBe(true)
  })

  it('writes a chosen scale into the row', async () => {
    const w = await mount('scale')
    await w.find('button').trigger('click')
    await settle()
    const alt = [...document.querySelectorAll('[role=dialog] [role=radio]')].find((r) => r.textContent?.includes('G Altered')) as HTMLElement
    alt.click()
    await settle()
    const next = (w.emitted('update:doc')?.[0] as [typeof doc])[0]
    expect(next.lines[3]).toMatchObject({ kind: 'row', scale: 'G Altered' })
  })
})
```
In `web/test/ChangesSystem.test.ts` add one: with `editing: null` (editor shown, nothing being edited) and
`numerals: true`, the numeral is a `SheetLabelPicker`, not a `ChangesNote`; with `editing: undefined` it is a `ChangesNote` as before.

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: `ChordChoices.vue`**: add `part` and `fallbackNote` props; `const parts = computed(() => props.part === 'function' ? ['function', 'why'] : props.part === 'scale' ? ['scale', 'why'] : ['function', 'scale', 'why'])`
  (the template's `v-for="part in parts"` stays); the Why section's `scaleOpen` condition becomes `(scaleOpen || props.part === 'function')`;
  render `<UiText v-if="fallbackNote" class="text-sm/6! text-amber-800! dark:text-amber-400!">{{ fallbackNote }}</UiText>` above the function radiogroup.

- [ ] **Step 4: `SheetLabelPicker.vue`**

```vue
<template>
  <!-- a numeral or scale under a chord while the sheet is the editor: it opens the function or the scale list for the chord -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :class="['block max-w-full cursor-pointer truncate rounded-sm text-left underline decoration-dotted underline-offset-[3px] hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:hover:bg-white/5 print:no-underline', fallback && kind === 'numeral' ? 'decoration-amber-500' : 'decoration-note-500/60 dark:decoration-note-300/60']"
      :title="fallback && kind === 'numeral' ? 'The rules could only guess here' : undefined"
      @click="place"
    >
      <MapPinIcon v-if="pinned && kind === 'scale'" data-pin class="mr-0.5 inline size-3 text-note-600 dark:text-note-400" aria-hidden="true" />
      <slot />
    </HPopoverButton>
    <HPopoverPanel role="dialog" :style="{ left: `${shift}px` }" :aria-label="`${kind === 'numeral' ? 'Function' : 'Scale'}: ${chord}`" class="absolute top-full left-0 z-20 mt-2 w-80 rounded-lg bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden">
      <ChordChoices :doc="doc" :line="line" :part="kind === 'numeral' ? 'function' : 'scale'" :fallback-note="fallback && kind === 'numeral' ? 'The rules could only guess here; stating the function settles it.' : undefined" @update:doc="emit('update:doc', $event)" @said="emit('said', $event)" />
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { MapPinIcon } from '@heroicons/vue/16/solid'
import type { ChartDoc } from '@chord-scale-maker/engine'
import ChordChoices from './ChordChoices.vue'
import { panelShift } from '~/utils/notePlacement'

const props = defineProps<{ doc: ChartDoc; line: number; kind: 'numeral' | 'scale'; chord: string; fallback: boolean; pinned: boolean }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string] }>()
const shift = ref(0)
/** keep the panel inside the window, as ChangesNote does */
function place(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement
  shift.value = panelShift(el.getBoundingClientRect().left, 320, window.innerWidth)
}
</script>
```
`pinned` comes from `ChangesChord`: add `pinned: boolean` to `ChangesChord` in `engine/src/changes.ts` **only if** it
isn't derivable; it is: `ChangesSystem` can compute it from `rowNotes(doc, view).get(m.line)?.source === 'written'`
once per line (`const notes = computed(() => props.doc && props.editing !== undefined ? rowNotes(props.doc, scaleView) : null)`).
Prefer that; the engine stays as it is.

- [ ] **Step 5: `ChangesSystem.vue`**: when `editing !== undefined`, the numeral and scale spans render
  `<SheetLabelPicker :doc="doc!" :line="m.line" kind="numeral" :chord="m.text" :fallback="m.fallback" :pinned="false" @update:doc=… @said=…>{{ m.numeral }}</SheetLabelPicker>`
  and the scale one with `kind="scale"` and `:pinned="notes?.get(m.line)?.source === 'written'"`; the draft preview
  (Task 5) still takes precedence for the chord being edited; `ChangesNote` stays for `editing === undefined`.

- [ ] **Step 6: Run the unit tests → PASS; `make lint`.**

- [ ] **Step 7: e2e** (append to `sheet-edit.spec.ts`)

```ts
test('the numeral opens the function list and the scale label the scale list; a pinned scale shows its pin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'V7', exact: true }).first().click()
  const fn = page.getByRole('dialog', { name: 'Function: G7' })
  await expect(fn.getByRole('radiogroup', { name: 'Function' })).toBeVisible()
  await expect(fn).toContainText('Why')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'G Mixolydian' }).first().click()
  const sc = page.getByRole('dialog', { name: 'Scale: G7' })
  await sc.getByRole('radiogroup', { name: 'Scale' }).getByRole('radio', { name: /^G Altered/ }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7 \| G Altered/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'G Altered' }).first().locator('svg[data-pin]')).toBeVisible()
})
```
Run `make e2e`.

- [ ] **Step 8: Commit; open the PR.**

```bash
git add web/app/components/ChordChoices.vue web/app/components/SheetLabelPicker.vue web/app/components/ChangesSystem.vue web/test/SheetLabelPicker.test.ts web/test/ChangesSystem.test.ts web/e2e/sheet-edit.spec.ts
git commit -m "Lead-sheet editor: the numeral and scale labels open the function and scale lists"
```

---

### Task 7: The bar toolbar, the ghost bar and + section

**Files:**
- Create: `web/app/components/SheetBarToolbar.vue`
- Create: `web/test/SheetBarToolbar.test.ts`
- Modify: `web/app/components/ChangesSystem.vue` (toolbar per hovered/focused bar; the ghost bar on a section's last line)
- Modify: `web/app/components/ChangesSheet.vue` (+ section under the last line)
- Modify: `web/app/components/EditorView.vue` (the `BarDialog` for Jump and New section; `addSection` via the grid's dialog)
- Modify: `web/e2e/sheet-edit.spec.ts`

**Interfaces:**
- `SheetBarToolbar` props `{ doc: ChartDoc; section: string; bar: number; repeatOf: string | null }`, emits
  `'update:doc'`, `said`, `refused: [string]`, `dialog: [kind: 'section' | 'nav', section: string, bar: number]`.
- `ChangesBar` needs the bar's identity for a held bar (no chord carries `at`): add `at: Readonly<{ section: string; bar: string }> | null`
  to `ChangesBar` in `engine/src/changes.ts`, filled from the bar's row or the held bar's number; test in
  `engine/src/__tests__/changes.test.ts`; golden untouched (`ChangesLine` isn't in the fixture: check with
  `git grep -n "buildChanges" engine/src/__tests__/goldenFixture.ts`; if it is, the fixture changes and `make golden`
  is the review, contrary to the plan's constraint: then derive `at` in the web layer from `barView` instead).

- [ ] **Step 1: Failing unit test**

```ts
// web/test/SheetBarToolbar.test.ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart, serializeChart } from '@chord-scale-maker/engine'
import SheetBarToolbar from '~/components/SheetBarToolbar.vue'

const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n@copy A B 4\n').value
const rows = (d: ChartDoc) => serializeChart(d).split('\n').filter((l) => /^A \|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim())
const mount = (over: Partial<{ bar: number; repeatOf: string | null }> = {}) => mountSuspended(SheetBarToolbar, { props: { doc, section: 'A', bar: 2, repeatOf: null, ...over } })
const next = (w: Awaited<ReturnType<typeof mount>>): ChartDoc => (w.emitted('update:doc')?.at(-1) as [ChartDoc])[0]
const press = async (w: Awaited<ReturnType<typeof mount>>, name: string) => {
  const b = w.findAll('button').find((x) => x.attributes('aria-label') === name || x.text() === name)
  if (!b) throw new Error(`no ${name}`)
  await b.trigger('click')
}

describe('SheetBarToolbar', () => {
  it('inserts a held bar before and after, labelled with the bar', async () => {
    const w = await mount()
    await press(w, 'Insert a held bar before A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 3 | G7', 'A | 4 | CMaj7'])
    await press(w, 'Insert a held bar after A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 4 | CMaj7'])
  })
  it('splits a bar into the chord twice', async () => {
    const w = await mount()
    await press(w, 'Split A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | G7', 'A | 2 | G7', 'A | 3 | CMaj7'])
  })
  it('deletes a bar, and refuses to delete a section’s first with why', async () => {
    const w = await mount()
    await press(w, 'Delete A bar 2')
    expect(rows(next(w))).toEqual(['A | 1 | Dm7', 'A | 2 | CMaj7'])
    const first = await mount({ bar: 1 })
    await press(first, 'Delete A bar 1')
    expect(first.emitted('update:doc')).toBeUndefined()
    expect(first.emitted('refused')?.[0]?.[0]).toMatch(/can’t start with a held bar/)
  })
  it('on a repeat’s bar offers Write out only', async () => {
    const w = await mount({ repeatOf: 'A' })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Write out'])
  })
  it('offers the rest under ⋯, and asks for the dialogs for a jump and a new section', async () => {
    document.body.innerHTML = '' // the menu renders through a Headless UI portal
    const w = await mountSuspended(SheetBarToolbar, { props: { doc, section: 'A', bar: 2, repeatOf: null }, attachTo: document.body })
    await press(w, 'More actions for A bar 2')
    await nextTick()
    const items = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
    expect(items.map((m) => m.textContent?.trim())).toEqual(['Key change here', '1st ending', '2nd ending', 'Segno', 'Coda', 'Jump…', 'New section here…'])
    items.at(-1)?.click()
    await nextTick()
    expect(w.emitted('dialog')?.[0]).toEqual(['section', 'A', 2])
  })
})
```
(`nextTick` from `vue`; the file's other tests mount without `attachTo`, which is fine for buttons rendered inline.)

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: The component**

```vue
<!-- web/app/components/SheetBarToolbar.vue -->
<template>
  <div role="toolbar" :aria-label="`Bar ${bar} of ${section}`" class="flex items-center gap-0.5 rounded-lg bg-white p-0.5 text-xs font-semibold text-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 print:hidden">
    <template v-if="repeatOf">
      <button type="button" :class="ITEM" :aria-label="`Write out ${section}, which repeats ${repeatOf}`" @click="change(writeOutCopy(doc, section), `${section} written out`, `${section} can’t be written out.`)">Write out</button>
    </template>
    <template v-else>
      <button type="button" :class="ITEM" :aria-label="`Insert a held bar before ${section} bar ${bar}`" @click="change(insertHeldBar(doc, section, bar), `bar ${bar} added`, 'A section can’t start with a held bar.')">+ before</button>
      <button type="button" :class="ITEM" :aria-label="`Insert a held bar after ${section} bar ${bar}`" @click="change(insertHeldBar(doc, section, bar + 1), `bar ${bar + 1} added`, 'No bar can go there.')">+ after</button>
      <button type="button" :class="ITEM" :aria-label="`Split ${section} bar ${bar}`" @click="split">Split</button>
      <button type="button" :class="ITEM" :aria-label="`Delete ${section} bar ${bar}`" @click="change(deleteBar(doc, section, bar), `bar ${bar} deleted`, 'A section can’t start with a held bar: give the next bar a chord first.')">Delete</button>
      <UiDropdown>
        <UiDropdownButton plain :class="ITEM" :aria-label="`More actions for ${section} bar ${bar}`">⋯</UiDropdownButton>
        <UiDropdownMenu anchor="bottom start">
          <UiDropdownItem v-if="chordLine !== null" @click="change(insertKeyChange(doc, chordLine), 'key change added', '')">Key change here</UiDropdownItem>
          <UiDropdownItem v-for="n in ENDINGS" :key="n" @click="change(toggleEnding(doc, section, n, bar), `${n === 1 ? '1st' : '2nd'} ending ${ending === n ? 'off' : 'on'}`, 'An ending can’t go over the other one.')">{{ n === 1 ? '1st' : '2nd' }} ending</UiDropdownItem>
          <UiDropdownItem v-for="m in MARKS" :key="m" @click="change(setMark(doc, section, bar, m, !hasMark(m)), `${MARK_LABELS[m]} ${hasMark(m) ? 'off' : 'on'}`, '')">{{ MARK_LABELS[m] }}</UiDropdownItem>
          <UiDropdownItem @click="emit('dialog', 'nav', section, bar)">Jump…</UiDropdownItem>
          <UiDropdownItem @click="emit('dialog', 'section', section, bar)">New section here…</UiDropdownItem>
        </UiDropdownMenu>
      </UiDropdown>
    </template>
  </div>
</template>

<script setup lang="ts">
import { barView, type ChartDoc, deleteBar, insertHeldBar, insertKeyChange, setBarChords, setMark, toggleEnding, writeOutCopy } from '@chord-scale-maker/engine'

/**
 * The lead-sheet editor's bar toolbar (spec §1.4): the inspector's bar actions by name, for the hovered or focused
 * bar. A refused change leaves the doc and says why. On a repeat's bar, Write out alone.
 */
const props = defineProps<{ doc: ChartDoc; section: string; bar: number; repeatOf: string | null }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string]; refused: [text: string]; dialog: [kind: 'section' | 'nav', section: string, bar: number] }>()

const ITEM = 'rounded px-2 py-1 hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10'
const ENDINGS = [1, 2] as const
const MARKS = ['segno', 'coda'] as const
const MARK_LABELS = { segno: 'Segno', coda: 'Coda' } as const
const cell = computed(() => barView(props.doc).sections.find((s) => s.name === props.section)?.bars.find((b) => b.bar === props.bar) ?? null)
const chordLine = computed(() => cell.value?.chords[0]?.line ?? null)
const ending = computed(() => cell.value?.ending?.n ?? null)
const hasMark = (m: 'segno' | 'coda'): boolean => !!cell.value?.marks.some((x) => x.mark === m)

function change(next: ChartDoc, said: string, refused: string): void {
  if (next === props.doc) return emit('refused', refused || 'The chart can’t take that here.')
  emit('update:doc', next)
  emit('said', `${props.section}: ${said}`)
}
/** the bar's chord twice, so the second half can be typed */
function split(): void {
  const chords = cell.value?.chords.map((c) => c.chord) ?? []
  const last = chords.at(-1)
  if (last === undefined) return emit('refused', 'A held bar has no chord to split.')
  change(setBarChords(props.doc, props.section, props.bar, [...chords, last]), `bar ${props.bar} split`, `A bar holds at most ${barView(props.doc).beats} chords.`)
}
</script>
```
The `nav` dialog: `BarDialog` has no `nav` kind today; the inspector uses a `UiSelect`. Add `kind: 'nav'` to `BarDialog`
(`BarDialogKind` and `BarDialogSubmit` gain `{ kind: 'nav'; text: string }`, a `UiSelect` of the inspector's `NAVS`
list with None; `TITLES.nav = 'Jump at the end of the bar'`, `ACTIONS.nav = 'Set'`), handled in `EditorView` by
`setNav(doc, section, bar, text)`; and `kind: 'section'` already exists (name + chords) — for a split, `EditorView`
calls `splitSection(doc, section, bar, name)` when the dialog came from the toolbar (track `dialogFrom = 'toolbar'`).

- [ ] **Step 4: `ChangesSystem.vue`**: a `hoverBar` ref (the bar index under the pointer, from `@pointerenter` on an
  invisible per-bar strip over the staff: `<div class="absolute inset-y-0" :style="{ left: `${barLeft(b)}%`, width: `${barWidth(b)}%` }">`
  computed from `xs[b][0]` and the next bar's first x) and a `focusBar` (the bar of the chord with focus or being edited);
  render `<SheetBarToolbar>` absolutely above the bar's first beat (`top: -2.25rem`) for `hoverBar ?? focusBar`, in the
  DOM right after that bar's chord buttons so it is next in the Tab order. The **ghost bar**: when `line.bars` is the
  last line of its section (ChangesLine needs `sectionEnd: boolean`: compute in `ChangesSheet` by comparing the next
  line's first bar's marker/section, or add the field in `buildChanges` with a unit test in `changes.test.ts`), render
  after the staff `<button type="button" class="absolute top-2 h-9 rounded-md border border-dashed border-zinc-400 text-xs font-semibold text-zinc-500 hover:border-note-500 hover:text-note-700 focus-visible:border-note-500 print:hidden" :style="{ left: `${lastX}%`, width: `${100 / barsPerLine}%` }" :aria-label="`Add a bar at the end of ${section}`" @click="emit('addBar', section)">+ bar</button>`
  where `lastX` is `100%` of the staff when the line is full, else the x after the last bar. `EditorView` handles
  `addBar(section)` as the grid's + Bar does (`insertHeldBar` after the section's last bar; find the call in
  `BarEditor.vue` ~line 440 and reuse its message).
- `ChangesSheet.vue`: under the pages, `<UiButton v-if="editing !== undefined" plain class="print:hidden" @click="emit('addSection')">+ section</UiButton>`;
  `EditorView` opens the grid's `BarDialog` with `kind: 'section'` (`openDialog('section')` is in `BarEditor`; lift the
  dialog to `EditorView` or expose `openDialog` on `BarEditor` with `defineExpose` and call it; prefer expose).

- [ ] **Step 5: Unit tests → PASS; `make lint`.**

- [ ] **Step 6: e2e**

```ts
test('the bar toolbar inserts and deletes bars, the ghost bar adds one, + section adds a section', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).hover()
  await page.getByRole('button', { name: 'Insert a held bar after A bar 2' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 2 \| G7\nA \| 4 \| CMaj7/)
  await page.getByRole('button', { name: 'Edit CMaj7, A bar 4' }).hover()
  await page.getByRole('button', { name: 'Delete A bar 4' }).click()
  await expect.poll(() => plain(page)).not.toMatch(/CMaj7/)
  await page.getByRole('button', { name: 'Add a bar at the end of A' }).click()
  await expect.poll(() => plain(page)).toMatch(/A \| 1 \| Dm7\nA \| 2 \| G7\nA \| 4 \| G7/) // the sounding chord written at the part's end, as the grid's + Bar does; adjust to what insertHeldBar writes
  await page.getByRole('button', { name: '+ section' }).click()
  const dialog = page.getByRole('dialog', { name: /section/i })
  await dialog.getByLabel('Section name').fill('B')
  await dialog.getByLabel(/chords/i).fill('Fm7 Bb7')
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect.poll(() => plain(page)).toMatch(/B \| 1 \| Fm7\nB \| 1 \| Bb7/)
})
```
Check the `BarDialog` labels and button text in `web/e2e/editor.spec.ts` (it already drives this dialog for the grid) and
copy them exactly. Run `make e2e`.

- [ ] **Step 7: Commit; open the PR.**

```bash
git add web/app/components/SheetBarToolbar.vue web/app/components/BarDialog.vue web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/app/components/EditorView.vue web/app/components/BarEditor.vue web/test/SheetBarToolbar.test.ts web/e2e/sheet-edit.spec.ts engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Lead-sheet editor: the bar toolbar, the ghost bar and + section"
```

---

### Task 8: The heading, where it prints

**Files:**
- Create: `web/app/components/SheetHeading.vue`
- Create: `web/test/SheetHeading.test.ts`
- Modify: `web/app/components/SheetPages.vue` (a `#heading` slot, rendered instead of the printed title block when given)
- Modify: `web/app/components/ChangesSheet.vue`, `web/app/components/EditorView.vue`
- Modify: `web/e2e/sheet-edit.spec.ts`

**Interfaces:**
- `SheetHeading` props `{ doc: ChartDoc }`, emits `'update:doc'`. Fields: title (`MetaInput` styled `font-display text-2xl/8 font-bold`),
  subtitle and composer (`MetaInput`, `text-sm`), key (the grid's `UiSelect` of `KEY_OPTIONS` with "Pick the chart's key").
  All with `border-b border-dashed border-note-400 bg-transparent` and no box; `print:hidden` is not needed because
  `SheetPages` renders the printed heading in print (`print:block`) and the fields `print:hidden`.

- [ ] **Step 1: Failing test**

```ts
// web/test/SheetHeading.test.ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart } from '@chord-scale-maker/engine'
import SheetHeading from '~/components/SheetHeading.vue'

const doc = parseChart('title: Autumn Leaves\nsubtitle: Full Form\nkey: Gm\ncomposer: Joseph Kosma\nA | 1 | Cm7\n').value
const mount = (d = doc) => mountSuspended(SheetHeading, { props: { doc: d } })

describe('SheetHeading', () => {
  it('shows the title, subtitle, key and composer as fields reading as the printed heading', async () => {
    const w = await mount()
    expect(w.find('input[aria-label=Title]').element).toHaveProperty('value', 'Autumn Leaves')
    expect(w.find('input[aria-label=Subtitle]').element).toHaveProperty('value', 'Full Form')
    expect(w.find('input[aria-label=Composer]').element).toHaveProperty('value', 'Joseph Kosma')
    expect(w.find('select[aria-label=Key]').element).toHaveProperty('value', 'Gm')
  })
  it('writes a changed title into the doc', async () => {
    const w = await mount()
    const t = w.find('input[aria-label=Title]')
    await t.setValue('Les Feuilles Mortes')
    await t.trigger('change')
    const next = (w.emitted('update:doc')?.[0] as [ChartDoc])[0]
    expect(next.lines[0]).toMatchObject({ kind: 'meta', key: 'title', value: 'Les Feuilles Mortes' })
  })
  it('keeps a refused value visible and flagged, and the doc unchanged', async () => {
    const w = await mount()
    const t = w.find('input[aria-label=Title]')
    await t.setValue('# nope')
    await t.trigger('change')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(w.text()).toMatch(/can’t/)
  })
  it('asks for a key when the chart has none', async () => {
    const w = await mount(parseChart('title: T\nA | 1 | Cm7\n').value)
    expect(w.text()).toContain('Pick the chart’s key')
  })
})
```
Check `MetaInput`'s refusal text and whether it takes an `aria-label`/`id` (`sed -n 1,40p web/app/components/MetaInput.vue`);
add an `ariaLabel` prop if it has none, used by `ChartHeadingFields` too (its `UiLabel` already labels it; the prop is optional).

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Component and wiring.** `SheetHeading.vue` lays the four fields out as `SheetPages`' heading does
  (title centred, subtitle under, composer right-aligned italic, the key beside the subtitle), each `MetaInput` with
  `class="w-full border-0 border-b border-dashed border-note-400 bg-transparent text-center focus:border-note-600 focus:outline-none"`
  and `setMeta(doc, key, v)` on `update`. `SheetPages.vue`: `<slot name="heading" :page="page" :i="i">…the existing h2/p block…</slot>`
  with the default content unchanged; `ChangesSheet.vue` passes `<template v-if="editing !== undefined" #heading><SheetHeading class="print:hidden" :doc="doc" @update:doc="emit('update:doc', $event)" /><!-- the printed heading for print --><div class="hidden print:block">…</div></template>`
  (simplest: render both, the fields `print:hidden`, the default block `hidden print:block` while editing; the test
  for `SheetPages` asserts both are in the DOM with those classes).

- [ ] **Step 4: Unit tests → PASS; `make lint`.**

- [ ] **Step 5: e2e**

```ts
test('the heading is edited where it prints', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const title = page.getByRole('textbox', { name: 'Title' })
  await title.fill('My Tune')
  await title.press('Enter')
  await expect.poll(() => plain(page)).toMatch(/^title: My Tune/)
  await expect(page.getByRole('heading', { name: 'My Tune' })).toBeVisible() // the page's heading follows
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeHidden()
  await expect(page.getByText('Editing the sheet')).toBeHidden()
  await expect(page.getByRole('toolbar')).toHaveCount(0)
})
```
Run `make e2e`.

- [ ] **Step 6: Commit; open the PR.**

```bash
git add web/app/components/SheetHeading.vue web/app/components/SheetPages.vue web/app/components/ChangesSheet.vue web/app/components/EditorView.vue web/app/components/MetaInput.vue web/test/SheetHeading.test.ts web/e2e/sheet-edit.spec.ts
git commit -m "Lead-sheet editor: the heading edited where it prints"
```

---

### Task 9: Sign-off

**Files:**
- Modify: `web/nuxt.config.ts` (`leadSheetEditor: true, // … on since sign-off`)
- Modify: `docs/design.md` §4 (after the "Phones (below `md`)" bullet) and the flags paragraph (~line 697)
- Modify: `docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md` (status: shipped, date)
- Modify: `web/test/EditorView.test.ts` if any test assumed the flag off (vitest runs with every flag on already)

- [ ] **Step 1:** Use the app: `make preview`, open *Autumn Leaves*, Edit, type into bar 6, Tab through a line, Space a
  second chord, open a numeral and a scale label, insert and delete a bar, rename the title; at 390 px confirm nothing
  of it shows and the bottom sheet works; print preview shows a clean sheet. Fix what you find (its own commit).
- [ ] **Step 2:** Flag on in `nuxt.config.ts`. `make test && make lint && make e2e`.
- [ ] **Step 3:** `docs/design.md` §4, a new bullet:

  ```markdown
  - **Lead-sheet editor** ([spec](superpowers/specs/2026-10-11-lead-sheet-editor-design.md); the `leadSheetEditor`
    flag, on): from `md` up, with the editor open, the Changes sheet is itself an editing surface beside the bar grid.
    A chord is a button that opens into a field on its beat (`SheetChord`) with completions that read each candidate
    in that bar (`chordCompletions`, `chordPreview`: numeral → scale at the sheet's level); Enter and Tab commit (Tab
    to the next bar's first chord, `nextChordLine`), Space adds a chord slot, Esc cancels, blank takes the chord out,
    `%` is the bar before. The numeral and scale under each chord open the function and scale lists
    (`SheetLabelPicker` over `ChordChoices`); a function the rules only guessed is underlined amber; a pinned scale
    shows its pin. A bar's toolbar (`SheetBarToolbar`) has the inspector's actions by name; a ghost "+ bar" ends each
    section; "+ section" follows the last line; the heading is edited where it prints (`SheetHeading`). The sheet
    shows concert pitch while editing, under a banner, and the numerals and scales are shown; both return on Done.
    Phones keep the bottom sheet alone. Every mark is hidden in print.
  ```
  and `leadSheetEditor` added to the flags paragraph's list.
- [ ] **Step 4:** Spec status line → `shipped (flag on, <date>)`. Commit, PR.

```bash
git add web/nuxt.config.ts docs/design.md docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md
git commit -m "Lead-sheet editor: sign-off, flag on; design.md"
```

---

## Self-review

- **Spec coverage:** §1 banner/concert/forced labels → Task 5; §1.1 field → Task 4; §1.2 completions → Tasks 1, 4;
  §1.3 pickers, guess mark, pin → Task 6; §1.4 toolbar → Task 7; §1.5 ghost / + section → Task 7; §1.6 heading →
  Task 8; §1.7 phones unchanged → the existing phone e2e stays in every PR; §2 engine → Task 1 (signature amended);
  §3 file table → Tasks 4–8 (`SheetChordEditor` untouched; `ChordChoices` `part` prop in Task 6; `nextChordLine` in
  Task 3; flag in Task 2; design.md in Task 9); §4 tests → each task; the spec's "Axe runs … as the other screens have
  it" has no basis (no axe in `web/e2e`): dropped from the spec in this plan's PR; §5 rollout → PR boundaries; D11
  print → Task 8's print e2e.
- **Type consistency:** `SheetEdit` (Task 4) is what `ChangesSystem`/`ChangesSheet`/`EditorView` pass (Task 5) and
  `SheetChord` matches; `ChordPreview` is the engine's type everywhere; `done` carries `'stay' | 'next' | 'prev' | 'add' | 'cancel'`
  in Task 4 and Task 5; `chordPreview(doc, section, bar, chords, index, view?)` in Tasks 1 and 4.
- **Placeholders:** none; where a name must be checked against the code (`chordTokens`, `Part`'s concert field,
  `useChartHistory`'s names, `BarDialog` labels), the step says which command shows it.
