# Pentatonic paths (phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each section of the Changes sheet its own pentatonic rung, with presets (Side-slip, Fifths, Minor thirds, Major thirds) that fill the sections and a per-section edit from the label's popover (#264).

**Architecture:** The engine gains `pentatonicStep`/`pentatonicPreset` (pure, in `pentatonics.ts`) and `changesSections` plus a `PentatonicPlan` parameter for `buildChanges` (in `changes.ts`). The app keeps each chart's path in `localStorage` through a new composable `usePentatonicPath`, turns it into a `PentatonicPlan`, and passes it down to `ChangesSheet` → `ChangesSystem` → `PentatonicLadder`. A Path listbox joins the Analysis group.

**Tech Stack:** TypeScript (strict), Vue 3 / Nuxt, Vitest (`@nuxt/test-utils`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-pentatonic-paths-design.md` (phase 1: `docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md`)

## Global Constraints

- Work in the worktree `/Users/kevdog/code/csm-pent-paths` (branch `pentatonic-paths`); run `make setup` there once.
- `engine/` stays free of Vue/DOM imports; the app imports the engine only as `@chord-scale-maker/engine`.
- New engine exports go through `engine/src/index.ts`; `engine/src/__tests__/api.test.ts` snapshots them (update the snapshot).
- Preferences only: never written into chart rows or share links.
- Everything stays behind the `pentatonics` feature flag (off; e2e builds have it on).
- The toolbar rail stays ≤ 2 rows at 1440 (`web/e2e/editor.spec.ts` "stays tidy").
- Storage key: `csm-pent-path:<practiceKey>` (a library slug or `mine:<id>`); no key → memory only.
- Path names: `'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'`; labels: One rung, Side-slip, Fifths, Minor thirds, Major thirds, Custom.
- Labels: `Am♪` with One rung; `B♭m♪ 1` (name, `♪`, space, shared count) with any other path.
- Stage files by name (never `git add -A`). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verify: `make test`, `make lint`, `make e2e`, `make golden` (expect no golden diff).

## Review Focus

1. A chart edit that renames or deletes a section with a stored Custom path: the stale entry is ignored, the new section plays Home (Custom) or the preset's value; nothing throws. → Task 3 test "ignores stale sections".
2. Stored junk under `csm-pent-path:<key>` (bad JSON, unknown path, rung 9): falls back to One rung, no crash. → Task 3 test "ignores junk".
3. A chart with only Intro + one form section, or no form sections at all: presets give Home everywhere, no exception. → Task 1 test "tiny forms".
4. The popover's current pick under a preset is the section's view, not the global Rung/Side. → Task 4 ChangesSystem test.
5. A section played twice with endings (`@ending`) and a merged repeat (`A1 · A2`) are one section each. → Task 2 `changesSections` test.

---

### Task 1: Engine — path presets

**Files:**
- Modify: `engine/src/pentatonics.ts`
- Modify: `engine/src/index.ts` (export the new names)
- Test: `engine/src/__tests__/pentatonics.test.ts`, `engine/src/__tests__/api.test.ts` (snapshot)

**Interfaces:**
- Consumes: `PentatonicView`, `PentatonicSide` (pentatonics.ts); `FormPart` from `./chart` (`'before' | 'form' | 'after'`).
- Produces:
  - `type PentatonicPathName = 'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'`
  - `const PENTATONIC_PATHS: readonly PentatonicPathName[]`
  - `isPentatonicPathName(v: unknown): v is PentatonicPathName`
  - `const PENTATONIC_HOME: PentatonicView` (`{ rung: 0, side: 'flat' }`)
  - `type PentatonicSection = Readonly<{ key: string; part: FormPart }>`
  - `pentatonicStep(semitones: number): PentatonicView`
  - `pentatonicPreset(path: PentatonicPathName, sections: readonly PentatonicSection[]): Readonly<Record<string, PentatonicView>>` (`{}` for `'one'` and `'custom'`)

- [ ] **Step 1: Write the failing tests** (append to `engine/src/__tests__/pentatonics.test.ts`; add the imports to its import line)

```ts
import { isPentatonicPathName, PENTATONIC_HOME, pentatonicPreset, pentatonicStep, type PentatonicSection } from '../pentatonics'

const form = (...keys: string[]): PentatonicSection[] => keys.map((key) => ({ key, part: 'form' }))
const show = (r: Readonly<Record<string, { rung: number; side: string }>>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.rung === 0 || v.rung === 6 ? String(v.rung) : `${v.rung}${v.side === 'flat' ? '♭' : '♯'}`]))

describe('pentatonic paths', () => {
  it('steps by semitones round the circle of fifths', () => {
    expect([0, 1, 3, 6, 9, 4, 8].map((s) => show({ s: pentatonicStep(s) }).s)).toEqual(['0', '5♭', '3♭', '6', '3♯', '4♯', '4♭'])
    expect(pentatonicStep(12)).toEqual(PENTATONIC_HOME)
    expect(pentatonicStep(-3)).toEqual(pentatonicStep(9))
  })

  it('lays each preset over AABA by role (A1 · A2 merged: three sections)', () => {
    const s = form('A1', 'B', 'A3')
    expect(show(pentatonicPreset('side-slip', s))).toEqual({ A1: '0', B: '5♭', A3: '0' })
    expect(show(pentatonicPreset('fifths', s))).toEqual({ A1: '0', B: '6', A3: '0' })
    expect(show(pentatonicPreset('minor-thirds', s))).toEqual({ A1: '0', B: '3♭', A3: '0' })
    expect(show(pentatonicPreset('major-thirds', s))).toEqual({ A1: '0', B: '4♯', A3: '0' })
  })

  it('lays each preset over AABA written out (four sections)', () => {
    const s = form('A1', 'A2', 'B', 'A3')
    expect(show(pentatonicPreset('side-slip', s))).toEqual({ A1: '0', A2: '0', B: '5♭', A3: '0' })
    expect(show(pentatonicPreset('fifths', s))).toEqual({ A1: '0', A2: '3♯', B: '6', A3: '0' })
    expect(show(pentatonicPreset('minor-thirds', s))).toEqual({ A1: '0', A2: '3♭', B: '6', A3: '0' })
    expect(show(pentatonicPreset('major-thirds', s))).toEqual({ A1: '0', A2: '4♯', B: '4♭', A3: '0' })
  })

  it('spreads the fifths climb over more sections', () => {
    expect(show(pentatonicPreset('fifths', form('A', 'B', 'C', 'D', 'E')))).toEqual({ A: '0', B: '2♯', C: '4♯', D: '6', E: '0' })
  })

  it('tiny forms: one section is Home, two are inside and outside; Intro and Coda are Home', () => {
    expect(show(pentatonicPreset('fifths', form('A')))).toEqual({ A: '0' })
    expect(show(pentatonicPreset('side-slip', form('A', 'B')))).toEqual({ A: '0', B: '5♭' })
    expect(show(pentatonicPreset('minor-thirds', form('A', 'B')))).toEqual({ A: '0', B: '3♭' })
    const withIntro: PentatonicSection[] = [{ key: 'Intro', part: 'before' }, ...form('A', 'B', 'C'), { key: 'Coda', part: 'after' }]
    expect(show(pentatonicPreset('side-slip', withIntro))).toEqual({ Intro: '0', A: '0', B: '5♭', C: '0', Coda: '0' })
    expect(pentatonicPreset('side-slip', [{ key: 'Intro', part: 'before' }])).toEqual({ Intro: PENTATONIC_HOME })
    expect(pentatonicPreset('fifths', [])).toEqual({})
  })

  it('has no preset for One rung or Custom, and knows its path names', () => {
    expect(pentatonicPreset('one', form('A', 'B'))).toEqual({})
    expect(pentatonicPreset('custom', form('A', 'B'))).toEqual({})
    expect(['one', 'fifths', 'custom'].every(isPentatonicPathName)).toBe(true)
    expect([undefined, 'thirds', 3].some(isPentatonicPathName)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts`
Expected: FAIL (`pentatonicStep` is not exported).

- [ ] **Step 3: Implement** (append to `engine/src/pentatonics.ts`; add `import type { FormPart } from './chart'` at the top)

```ts
/** how a chart's sections take their rungs (#264): one rung for all, a preset laid over the form, or edited by hand */
export type PentatonicPathName = 'one' | 'side-slip' | 'fifths' | 'minor-thirds' | 'major-thirds' | 'custom'
export const PENTATONIC_PATHS: readonly PentatonicPathName[] = ['one', 'side-slip', 'fifths', 'minor-thirds', 'major-thirds', 'custom']
export const isPentatonicPathName = (v: unknown): v is PentatonicPathName => typeof v === 'string' && (PENTATONIC_PATHS as readonly string[]).includes(v)
export const PENTATONIC_HOME: PentatonicView = { rung: 0, side: 'flat' }
/** a section of the Changes sheet as a preset sees it: its key (the block's section) and whether it is in the form */
export type PentatonicSection = Readonly<{ key: string; part: FormPart }>

/** the rung and side of the pentatonic `semitones` above home: 7s mod 12 fifths, ♯ side up to 6, ♭ side past it */
export function pentatonicStep(semitones: number): PentatonicView {
  const d = (((7 * semitones) % 12) + 12) % 12
  if (d === 0) return PENTATONIC_HOME
  if (d === 6) return { rung: 6, side: 'flat' }
  return d < 6 ? { rung: d, side: 'sharp' } : { rung: 12 - d, side: 'flat' }
}

/**
 * each section's view under a preset (none for 'one' or 'custom'). The form's sections take roles by position:
 * the first is inside and the last returning (both Home), the one before last outside, any between climbing; with
 * two, inside and outside. Sections outside the form are Home. The thirds presets step section i by i thirds.
 */
export function pentatonicPreset(path: PentatonicPathName, sections: readonly PentatonicSection[]): Readonly<Record<string, PentatonicView>> {
  if (path === 'one' || path === 'custom') return {}
  const form = sections.filter((s) => s.part === 'form').map((s) => s.key)
  const n = form.length
  const outside = n === 2 ? 1 : n - 2
  const climbers = Math.max(0, n - 3)
  const viewAt = (i: number): PentatonicView => {
    if (i === 0 || (n >= 3 && i === n - 1)) return PENTATONIC_HOME
    if (path === 'minor-thirds') return pentatonicStep(3 * i)
    if (path === 'major-thirds') return pentatonicStep(4 * i)
    if (i === outside) return path === 'side-slip' ? pentatonicStep(1) : { rung: 6, side: 'flat' }
    if (path === 'side-slip') return PENTATONIC_HOME
    return { rung: Math.round((6 * i) / (climbers + 1)), side: 'sharp' } // climber i of climbers (i = 1 … climbers)
  }
  const views = new Map(form.map((key, i) => [key, viewAt(i)]))
  return Object.fromEntries(sections.map((s) => [s.key, views.get(s.key) ?? PENTATONIC_HOME]))
}
```

Then export from `engine/src/index.ts` alongside the existing pentatonics exports: `isPentatonicPathName`, `PENTATONIC_HOME`, `PENTATONIC_PATHS`, `pentatonicPreset`, `pentatonicStep`, and the types `PentatonicPathName`, `PentatonicSection`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts src/__tests__/api.test.ts -u`
Expected: PASS; the api snapshot gains the new names (review the diff: only additions).

- [ ] **Step 5: Commit**

```bash
git add engine/src/pentatonics.ts engine/src/index.ts engine/src/__tests__/pentatonics.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonic paths: presets laid over the form by role (#264)"
```

(If the snapshot lives elsewhere, `git status` shows it; add it by name.)

---

### Task 2: Engine — sections and per-section plans on the Changes sheet

**Files:**
- Modify: `engine/src/changes.ts`
- Modify: `engine/src/index.ts`
- Test: `engine/src/__tests__/changes.test.ts`, api snapshot

**Interfaces:**
- Consumes: `PentatonicView`, `PentatonicSection`, `pentatonicAt`, `PentatonicRung` (Task 1 / phase 1).
- Produces:
  - `type ChangesSection = Readonly<{ key: string; marker: string; part: FormPart }>` (assignable to `PentatonicSection`)
  - `changesSections(doc: ChartDoc): readonly ChangesSection[]`
  - `type PentatonicPlan = Readonly<{ bySection: Readonly<Record<string, PentatonicView>>; fallback: PentatonicView; counts: boolean }>`
  - `buildChanges(doc, part, barsPerLine?, signatures?, line?, view?, pentatonic: PentatonicPlan | null = null)`
  - `ChangesPentatonic = Readonly<{ label: string; key: string; ladder: readonly PentatonicRung[]; section: string; view: PentatonicView; shared: number }>`

- [ ] **Step 1: Write the failing tests** in `engine/src/__tests__/changes.test.ts`

First, at the top of the file, add `changesSections` and `type PentatonicPlan` to the `../changes` import and a helper under `bars`:

```ts
const one = (rung: number, side: 'flat' | 'sharp'): PentatonicPlan => ({ bySection: {}, fallback: { rung, side }, counts: false })
```

Replace every existing `{ rung: N, side: 'S' }` passed as `buildChanges`'s last argument with `one(N, 'S')` (lines ~128–165; the expectations stay). Then add:

```ts
  it('lists the sections it draws: a repeat drawn once and a section with endings are one each', () => {
    expect(changesSections(library('autumn-leaves')).map((s) => [s.key, s.marker, s.part])).toEqual([['A1', 'A1 · A2', 'form'], ['B', 'B', 'form']])
    expect(changesSections(library('take-the-a-train')).map((s) => [s.key, s.part])).toEqual([['Intro', 'before'], ['A1', 'form'], ['A2', 'form'], ['B', 'form'], ['A3', 'form']])
    expect(changesSections(library('stardust')).filter((s) => s.key === 'Intro')).toHaveLength(1) // played twice, with endings
  })

  it('plays each section at its own rung, with the shared count when asked', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Cmaj7\nB | 3 | Cmaj7\nB | 4 | Cmaj7').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Am♪ 5'], ['B♭m♪ 1']]) // each section starts a line, so its label prints
    const b = lines[1]?.bars[0]?.chords[0]?.pentatonic
    expect([b?.section, b?.view, b?.shared]).toEqual(['B', { rung: 5, side: 'flat' }, 1])
  })

  it('keeps a section’s rung in the key of its own area', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Gmaj7\n@key B 2 G').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Am♪ 5'], ['B♭m♪ 0']]) // G major's home Em, its rung 6 B♭m
  })

  it('gives a merged repeat’s chords the first section’s rung', () => {
    const plan: PentatonicPlan = { bySection: { A1: { rung: 2, side: 'flat' }, A2: { rung: 6, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: false }
    const first = buildChanges(library('autumn-leaves'), CONCERT, 4, false, 'off', undefined, plan).lines[0]?.bars[0]?.chords[0]?.pentatonic
    expect([first?.section, first?.view.rung]).toEqual(['A1', 2])
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: FAIL (`changesSections` not exported; type errors on `one(…)` plans in `npx tsc` too).

- [ ] **Step 3: Implement in `engine/src/changes.ts`**

1. Types, beside `ChangesPentatonic` (replace it):

```ts
/** a chord's key-area pentatonic at its section's rung (#255, #264): the label, the area's key, its whole ladder, and the section, view and shared count behind the label */
export type ChangesPentatonic = Readonly<{ label: string; key: string; ladder: readonly PentatonicRung[]; section: string; view: PentatonicView; shared: number }>
/** a section the Changes sheet draws (a block): its key (its first section's name), its marker, its place in the form */
export type ChangesSection = Readonly<{ key: string; marker: string; part: FormPart }>
/** the pentatonic row's rungs (#264): a section's own view, else fallback; counts: the shared count follows each label */
export type PentatonicPlan = Readonly<{ bySection: Readonly<Record<string, PentatonicView>>; fallback: PentatonicView; counts: boolean }>
```

2. Move the block-building out of `buildChanges` into two module-level helpers so `changesSections` and `buildChanges` share it. Cut, unchanged in logic, from `buildChanges`:
   - the `index` / `eventAt` / `barOf` / `totalBars` lines → `timing(rows, events, beats)`:

```ts
type Timing = Readonly<{ eventAt: ReadonlyMap<number, TimelineEvent>; barOf: (i: number) => number | undefined; totalBars: number }>
function timing(rows: readonly LinedRow[], events: readonly TimelineEvent[], beats: number): Timing {
  const index = new Map<LinedRow, number>(rows.map((r, i) => [r, i]))
  const eventAt = new Map(events.map((e) => [index.get(e.row as LinedRow) ?? -1, e]))
  const barOf = (i: number): number | undefined => {
    const e = eventAt.get(i)
    return e ? Math.floor(e.start / beats) : undefined
  }
  const totalBars = Math.ceil(events.reduce((m, e) => Math.max(m, e.start + e.beats), 0) / beats)
  return { eventAt, barOf, totalBars }
}
```

   (`TimelineEvent`: use the element type of `guideToneTimeline(...).events`, i.e. `type TimelineEvent = ReturnType<typeof guideToneTimeline>['events'][number]`.)
   - the `runs` and `blocks` code (from `// runs of rows in one section` to the end of the `for (const run of runs)` loop) → `drawnBlocks(doc, rows, t, sectionsWithEndings): Run[]`, returning `blocks`. Its body is the cut code with `barOf`/`totalBars` read from `t`.

   In `buildChanges`, replace the cut code with `const t = timing(rows, events, beats)`, `const { eventAt, barOf, totalBars } = t` (keep `index` only if still used), and `const blocks = drawnBlocks(doc, rows, t, sectionsWithEndings)` at the point the loop used to be.

3. `changesSections`:

```ts
/** the sections the Changes sheet draws, in order: a repeat drawn once (A1 · A2) or a section with endings is one (#264) */
export function changesSections(doc: ChartDoc): readonly ChangesSection[] {
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const t = timing(rows, guideToneTimeline(rows, beats).events, beats)
  const withEndings = new Set(doc.lines.flatMap((l) => (l.kind === 'ending' ? [l.section] : [])))
  return drawnBlocks(doc, rows, t, withEndings).map((b) => ({ key: b.section, marker: b.marker, part: b.part }))
}
```

4. In `buildChanges`: change the last parameter to `pentatonic: PentatonicPlan | null = null`, and replace `pentatonicOf` so it takes the block's section:

```ts
  const pentatonicOf = (name: string | undefined, section: string): ChangesPentatonic | null => {
    if (!pentatonic || !name) return null
    if (!ladders.has(name)) ladders.set(name, areaLadder(name, part))
    const area = ladders.get(name)
    if (!area) return null
    const view = pentatonic.bySection[section] ?? pentatonic.fallback
    const p = pentatonicAt(area.ladder, view)
    return { label: `${p.name}♪${pentatonic.counts ? ` ${p.shared}` : ''}`, key: area.key, ladder: area.ladder, section, view, shared: p.shared }
  }
```

   and at the chord: `pentatonic: pentatonicOf(a?.key.name, block.section),`. Update `buildChanges`'s doc comment: `pentatonic: the row's rungs by section (null: no row)`.

5. Export `changesSections`, `type ChangesSection`, `type PentatonicPlan` from `engine/src/index.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts src/__tests__/api.test.ts -u && npx tsc --noEmit -p .`
Expected: PASS; snapshot gains `changesSections` (types aren't in the runtime snapshot if it lists values only).

- [ ] **Step 5: Golden check**

Run (repo root): `make golden && git diff --stat engine/fixtures/golden.json`
Expected: no diff.

- [ ] **Step 6: Commit**

```bash
git add engine/src/changes.ts engine/src/index.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonic paths: the Changes sheet's sections, a rung per section (#264)"
```

(The web app won't typecheck until Task 4 changes the `buildChanges` call; that's expected between tasks. Run `make test` only after Task 4.)

---

### Task 3: App — the per-chart path (`usePentatonicPath`)

**Files:**
- Create: `web/app/composables/usePentatonicPath.ts`
- Modify: `web/app/utils/pentatonics.ts` (path labels)
- Test: `web/test/usePentatonicPath.test.ts`, `web/test/pentatonics.test.ts`

**Interfaces:**
- Consumes: `pentatonicPreset`, `PENTATONIC_HOME`, `isPentatonicPathName`, `isPentatonicView`, `type PentatonicPathName`, `type PentatonicView`, `type ChangesSection`, `type PentatonicPlan` (engine); `readStored`, `writeStored`, `removeStored` (`~/utils/storage`, auto-imported).
- Produces:
  - `usePentatonicPath(key: string | undefined, sections: Ref<readonly ChangesSection[]>, fallback: Ref<PentatonicView>)` returning `{ path: Readonly<Ref<PentatonicPathName>>, plan: ComputedRef<PentatonicPlan>, setPath(name: PentatonicPathName): void, setSection(key: string, view: PentatonicView): void }`
  - `PENT_PATHS: readonly { value: PentatonicPathName; label: string }[]` and `pathLabel(p: PentatonicPathName): string` in `~/utils/pentatonics`

- [ ] **Step 1: Write the failing tests**

`web/test/pentatonics.test.ts`, add inside the describe (and import `PENT_PATHS, pathLabel`):

```ts
  it('names the paths', () => {
    expect(PENT_PATHS.map((p) => p.label)).toEqual(['One rung', 'Side-slip', 'Fifths', 'Minor thirds', 'Major thirds', 'Custom'])
    expect(pathLabel('minor-thirds')).toBe('Minor thirds')
  })
```

`web/test/usePentatonicPath.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { ChangesSection, PentatonicView } from '@chord-scale-maker/engine'
import { usePentatonicPath } from '~/composables/usePentatonicPath'

const AABA: ChangesSection[] = ['A1', 'A2', 'B', 'A3'].map((key) => ({ key, marker: key, part: 'form' }))
const make = (key: string | undefined, sections = AABA, fallback: PentatonicView = { rung: 2, side: 'flat' }) => {
  const s = effectScope().run(() => usePentatonicPath(key, ref(sections), ref(fallback)))
  if (!s) throw new Error('no path')
  return s
}

describe('usePentatonicPath', () => {
  afterEach(() => localStorage.clear())

  it('starts at One rung: the sheet’s rung everywhere, no counts', () => {
    const p = make('satin-doll')
    expect(p.path.value).toBe('one')
    expect(p.plan.value).toEqual({ bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false })
  })

  it('fills the sections from a preset, with counts, and remembers it per chart', async () => {
    const p = make('satin-doll')
    p.setPath('side-slip')
    expect(p.plan.value.bySection.B).toEqual({ rung: 5, side: 'flat' })
    expect(p.plan.value.counts).toBe(true)
    await nextTick()
    expect(make('satin-doll').path.value).toBe('side-slip')
    expect(make('autumn-leaves').path.value).toBe('one')
  })

  it('edits one section into Custom, seeding the rest with what they played', async () => {
    const p = make('satin-doll')
    p.setSection('A2', { rung: 3, side: 'sharp' })
    expect(p.path.value).toBe('custom')
    expect(p.plan.value.bySection).toEqual({ A1: { rung: 2, side: 'flat' }, A2: { rung: 3, side: 'sharp' }, B: { rung: 2, side: 'flat' }, A3: { rung: 2, side: 'flat' } })
    p.setPath('one')
    await nextTick()
    expect(localStorage.getItem('csm-pent-path:satin-doll')).toBeNull()
  })

  it('ignores stale sections and plays a new one Home under Custom', async () => {
    localStorage.setItem('csm-pent-path:x', JSON.stringify({ path: 'custom', sections: { Gone: { rung: 4, side: 'flat' }, A1: { rung: 1, side: 'sharp' } } }))
    const p = make('x')
    expect(p.plan.value.bySection.A1).toEqual({ rung: 1, side: 'sharp' })
    expect(p.plan.value.bySection.B ?? p.plan.value.fallback).toEqual({ rung: 0, side: 'flat' })
  })

  it('ignores junk', () => {
    for (const junk of ['{', '{"path":"thirds"}', '{"path":"custom","sections":{"A1":{"rung":9,"side":"flat"}}}']) {
      localStorage.setItem('csm-pent-path:j', junk)
      const p = make('j')
      expect(p.plan.value.bySection.A1).toBeUndefined()
    }
    localStorage.setItem('csm-pent-path:j', '{"path":"thirds"}')
    expect(make('j').path.value).toBe('one')
  })

  it('keeps the path for the visit only with no chart key', async () => {
    const p = make(undefined)
    p.setPath('fifths')
    await nextTick()
    expect(localStorage.length).toBe(0)
    expect(p.path.value).toBe('fifths')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/usePentatonicPath.test.ts test/pentatonics.test.ts`
Expected: FAIL (module not found / `PENT_PATHS` undefined).

- [ ] **Step 3: Implement**

Append to `web/app/utils/pentatonics.ts` (extend its engine import with `type PentatonicPathName`):

```ts
/** the Path listbox (#264); Custom is listed only while it is the current path */
export const PENT_PATHS: readonly { value: PentatonicPathName; label: string }[] = [
  { value: 'one', label: 'One rung' },
  { value: 'side-slip', label: 'Side-slip' },
  { value: 'fifths', label: 'Fifths' },
  { value: 'minor-thirds', label: 'Minor thirds' },
  { value: 'major-thirds', label: 'Major thirds' },
  { value: 'custom', label: 'Custom' },
]
export const pathLabel = (p: PentatonicPathName): string => PENT_PATHS.find((x) => x.value === p)?.label ?? ''
```

`web/app/composables/usePentatonicPath.ts`:

```ts
import type { ComputedRef, Ref } from 'vue'
import { type ChangesSection, isPentatonicPathName, isPentatonicView, PENTATONIC_HOME, pentatonicPreset, type PentatonicPathName, type PentatonicPlan, type PentatonicView } from '@chord-scale-maker/engine'

type Stored = Readonly<{ path: PentatonicPathName; sections: Readonly<Record<string, PentatonicView>> }>
const ONE: Stored = { path: 'one', sections: {} }

/** a stored path, if it is one; its invalid section views dropped */
function parse(raw: string | null): Stored {
  if (raw === null) return ONE
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || !('path' in v) || !isPentatonicPathName(v.path)) return ONE
    const given = 'sections' in v && v.sections && typeof v.sections === 'object' ? Object.entries(v.sections as Record<string, unknown>) : []
    return { path: v.path, sections: Object.fromEntries(given.filter((e): e is [string, PentatonicView] => isPentatonicView(e[1]))) }
  } catch {
    return ONE
  }
}

/**
 * the chart's pentatonic path (#264), per chart in this browser under `csm-pent-path:<key>` (a library slug or
 * mine:<id>); without a key it lasts for the visit. One rung plays `fallback` (the sheet's Rung and Side) everywhere;
 * a preset fills every section; an edit to one section makes the path Custom. Never in the chart or a share link.
 */
export function usePentatonicPath(key: string | undefined, sections: Ref<readonly ChangesSection[]>, fallback: Ref<PentatonicView>) {
  const storeKey = key ? `csm-pent-path:${key}` : null
  const state = ref<Stored>(storeKey ? parse(readStored(storeKey)) : ONE)
  watch(state, (s) => {
    if (!storeKey) return
    if (s.path === 'one') removeStored(storeKey)
    else writeStored(storeKey, JSON.stringify(s))
  })
  const plan: ComputedRef<PentatonicPlan> = computed(() => {
    const s = state.value
    if (s.path === 'one') return { bySection: {}, fallback: fallback.value, counts: false }
    const known = new Set(sections.value.map((x) => x.key))
    const own = Object.fromEntries(Object.entries(s.sections).filter(([k]) => known.has(k)))
    return { bySection: { ...pentatonicPreset(s.path, sections.value), ...own }, fallback: PENTATONIC_HOME, counts: true }
  })
  return {
    path: computed(() => state.value.path),
    plan,
    /** a preset fills every section; One rung forgets them */
    setPath(name: PentatonicPathName): void {
      state.value = name === 'one' || name === 'custom' ? { path: name, sections: name === 'custom' ? state.value.sections : {} } : { path: name, sections: pentatonicPreset(name, sections.value) }
    },
    /** one section's rung and side: the path becomes Custom, every other section keeping what it played */
    setSection(section: string, view: PentatonicView): void {
      const p = plan.value
      const seeded = Object.fromEntries(sections.value.map((x) => [x.key, p.bySection[x.key] ?? p.fallback]))
      state.value = { path: 'custom', sections: { ...seeded, [section]: view } }
    },
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npx vitest run test/usePentatonicPath.test.ts test/pentatonics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/usePentatonicPath.ts web/app/utils/pentatonics.ts web/test/usePentatonicPath.test.ts web/test/pentatonics.test.ts
git commit -m "Pentatonic paths: each chart's path kept in this browser (#264)"
```

---

### Task 4: App — Path control, per-section popover, wiring

**Files:**
- Modify: `web/app/components/PreviewControls.vue` (Path listbox; Rung/Side only with One rung)
- Modify: `web/app/components/ChangesSheet.vue` (prop `pentatonic?: PentatonicPlan | null`; emit `pentatonic: [section: string, view: PentatonicView]`)
- Modify: `web/app/components/ChangesSystem.vue` (same prop/emit; current from the mark; `data-section`)
- Modify: `web/app/components/PentatonicLadder.vue` (optional `section` prop in the title)
- Modify: `web/app/components/EditorView.vue` (compose it)
- Modify: `docs/design.md` (§Pentatonics on Changes)
- Test: `web/test/PreviewControls.test.ts`, `web/test/ChangesSystem.test.ts`, `web/test/PentatonicLadder.test.ts`

**Interfaces:**
- Consumes: `usePentatonicPath` (Task 3), `PENT_PATHS`, `pathLabel` (Task 3), `changesSections`, `PentatonicPlan`, `ChangesPentatonic.section/view` (Task 2).
- Produces: `PreviewControls` model `pentPath` (`v-model:pent-path`); `ChangesSheet`/`ChangesSystem` emit `pentatonic(section, view)`; `PentatonicLadder` prop `section?: string`.

- [ ] **Step 1: Write the failing tests**

`web/test/PreviewControls.test.ts`: add `pentPath: 'one'` to the default props in `mount`, then add:

```ts
  it('offers the paths, Custom only while current, and Rung and Side only with One rung', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const one = await mount({ pentatonics: true, pentPath: 'one' })
    expect(one.find('[aria-label="Pentatonic path"]').exists()).toBe(true)
    expect(one.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    const slip = await mount({ pentatonics: true, pentPath: 'side-slip', pentRung: 2 })
    expect(slip.find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic side"]').exists()).toBe(false)
    expect(slip.find('[aria-label="Pentatonic path"]').text()).toContain('Side-slip')
    const custom = await mount({ pentatonics: true, pentPath: 'custom' })
    expect(custom.find('[aria-label="Pentatonic path"]').text()).toContain('Custom')
  })
```

`web/test/PentatonicLadder.test.ts`, add:

```ts
  it('names the section in the ladder’s title', async () => {
    const w = await mountSuspended(PentatonicLadder, { props: { ...props, section: 'B' }, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('B · C major ladder')
    w.unmount()
  })
```

`web/test/ChangesSystem.test.ts`: read how its existing `line`/props fixture is built (around line 23, `pentatonic: null`), then add a test that mounts a line built by `buildChanges` with a plan and checks the popover's current pick and emit:

```ts
  it('opens a label’s ladder at its section’s rung, and a pick names the section', async () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Cmaj7').value
    const plan = { bySection: { B: { rung: 5, side: 'flat' as const } }, fallback: { rung: 0, side: 'flat' as const }, counts: true }
    const line = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)[1]!
    const w = await mountSuspended(ChangesSystem, { props: { ...baseProps, line, pentatonic: plan }, attachTo: document.body })
    const label = w.find('[data-slot="pentatonic"] [data-section="B"] button')
    expect(label.text()).toBe('B♭m♪ 1')
    await label.trigger('click')
    await flushPromises()
    expect(w.find('[aria-current="true"]').text()).toBe('B♭m')
    await w.findAll('[data-pent]').find((p) => p.text() === 'Gm')?.trigger('click')
    expect(w.emitted('pentatonic')?.[0]).toEqual(['B', { rung: 2, side: 'flat' }])
    w.unmount()
  })
```

(`baseProps`: the file's existing props object for mounting `ChangesSystem`; if it is inline, lift it into a `const baseProps` first. Import `buildChanges`, `CONCERT`, `parseChart`, `showPentatonics` from `@chord-scale-maker/engine` and `flushPromises` from `@vue/test-utils` if not already imported.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/PreviewControls.test.ts test/PentatonicLadder.test.ts test/ChangesSystem.test.ts`
Expected: FAIL (no Path listbox; title without section; emit has one argument).

- [ ] **Step 3: Implement**

`PentatonicLadder.vue`: props become `{ label: string; keyName: string; ladder: readonly PentatonicRung[]; current: PentatonicView; section?: string }`; add `const title = computed(() => (props.section ? `${props.section} · ${props.keyName} ladder` : `${props.keyName} ladder`))`; use `title` for the panel's `:aria-label` and its `<p>` heading. Update its doc comment: "a pick sets the section's rung".

`ChangesSystem.vue`:
- import `type PentatonicPlan` (drop `PentatonicView` from the import if unused, keep it if the emit type needs it).
- prop: `pentatonic?: PentatonicPlan | null // the Pentatonics row's rungs; null/undefined: no row`
- emit: `pentatonic: [section: string, view: PentatonicView] // a rung picked in a label's ladder, for its section`
- the mark span gets `:data-section="m.p.section"`; the ladder becomes
  `<PentatonicLadder class="print:hidden" :label="m.p.label" :key-name="m.p.key" :ladder="m.p.ladder" :current="m.p.view" :section="m.p.section" @pick="emit('pentatonic', m.p.section, $event)" />`
- update the row's comment: "the key area's pentatonic at its section's rung (#255, #264)".

`ChangesSheet.vue`: prop `pentatonic?: PentatonicPlan | null`, emit `pentatonic: [section: string, view: PentatonicView]`, forward with `@pentatonic="(s, v) => emit('pentatonic', s, v)"`; `buildChanges(…, props.pentatonic ?? null)` is unchanged in shape. Update the import (`type PentatonicPlan`).

`PreviewControls.vue`:
- `const pentPath = defineModel<PentatonicPathName>('pentPath', { default: 'one' })`
- import `PENT_PATHS, pathLabel` from `~/utils/pentatonics` and `type PentatonicPathName` from the engine.
- `const pathChoices = computed(() => PENT_PATHS.filter((p) => p.value !== 'custom' || pentPath.value === 'custom'))`
- inside `<div v-if="pentatonicsOn && pentatonics" …>`, first:

```vue
                  <UiListbox v-model="pentPath" class="w-48" aria-label="Pentatonic path">
                    <template #selected="{ value }"><UiListboxLabel>{{ pathLabel(value) }}</UiListboxLabel></template>
                    <UiListboxOption v-for="p in pathChoices" :key="p.value" :value="p.value"><UiListboxLabel>{{ p.label }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
```

  then wrap the existing Rung listbox and Side control in `<template v-if="pentPath === 'one'">…</template>`.
- The toggle's title: "Each key area's minor pentatonic, at a rung of its tension ladder: one for the sheet, or a path through the form".

`EditorView.vue`:
- imports: `changesSections`, `type PentatonicPlan` from the engine (drop `type PentatonicView` if unused).
- replace `pentatonicView` with:

```ts
/** the chart's sections as the Changes sheet draws them, for the path presets (#264) */
const pentSections = computed(() => changesSections(editor.doc.value))
const pentPath = usePentatonicPath(props.practiceKey, pentSections, computed(() => ({ rung: prefs.pentRung.value, side: prefs.pentSide.value })))
const pentPathModel = computed({ get: () => pentPath.path.value, set: (v) => pentPath.setPath(v) })
/** the sheet's Pentatonics plan; null with the row off */
const pentatonicPlan = computed((): PentatonicPlan | null => (pentatonicsOn && prefs.pentatonics.value ? pentPath.plan.value : null))
```

- `<PreviewControls … v-model:pent-path="pentPathModel" …>` (next to `v-model:pent-side`).
- `<ChangesSheet … :pentatonic="pentatonicPlan" @pentatonic="(section, view) => pentPath.setSection(section, view)" …>`.
- If `ChangesSheet` is also rendered in focus mode or elsewhere in `EditorView.vue` (`grep -n ':pentatonic=' app/components/EditorView.vue`), change each the same way.

`docs/design.md` §Pentatonics on Changes: add a bullet:
`- **Paths** (#264, [spec](superpowers/specs/2026-10-13-pentatonic-paths-design.md)): a rung per section (a block as drawn, keyed by its first section). Path listbox: One rung (Rung + Side, as before), Side-slip, Fifths, Minor thirds, Major thirds; a preset fills every section by role (\`pentatonicPreset\`), a pick in a label's ladder sets its section and makes the path Custom. Per chart: \`csm-pent-path:<slug>\` (\`usePentatonicPath\`). Labels carry the shared count (\`B♭m♪ 1\`) off One rung.`
and change "a pick sets the sheet's rung and side" to "a pick sets its section's rung and side".

- [ ] **Step 4: Run all unit tests and the typecheck**

Run (repo root): `make test && make lint`
Expected: PASS (fix any other caller of `buildChanges`'s last argument or of the old `pentatonic` emit that typecheck reports, the same way).

- [ ] **Step 5: Commit**

```bash
git add web/app/components/PreviewControls.vue web/app/components/ChangesSheet.vue web/app/components/ChangesSystem.vue web/app/components/PentatonicLadder.vue web/app/components/EditorView.vue docs/design.md web/test/PreviewControls.test.ts web/test/ChangesSystem.test.ts web/test/PentatonicLadder.test.ts
git commit -m "Pentatonic paths: Path listbox, a section's rung from its ladder (#264)"
```

---

### Task 5: Browser tests

**Files:**
- Modify: `web/e2e/pentatonics.spec.ts`

**Interfaces:**
- Consumes: the UI from Task 4 (`aria-label="Pentatonic path"`, `[data-slot="pentatonic"] [data-section]`, ladder dialog `"<section> · <key> ladder"`); fixtures `chooseSheet`, `showPentatonics`, `chooseInstrument` from `./fixtures`.

- [ ] **Step 1: Update the phase-1 test and add the path tests**

In the first test, the dialog's name is now `'A1 · G minor ladder'`, and a pick no longer changes the Rung listbox; it makes the path Custom. Replace its last three lines with:

```ts
  const ladder = page.getByRole('dialog', { name: 'A1 · G minor ladder' })
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side, for A1 only
  await expect(labels(page).first()).toHaveText('Fm♪ 4')
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Custom')
```

Add:

```ts
const sectionLabels = (page: Page, section: string) => page.locator(`[data-slot="pentatonic"] [data-section="${section}"] button`)

async function choosePath(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name }).click()
}

test('Side-slip takes the bridge a half step out, and comes home', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Side-slip')
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toHaveCount(0)
  for (const s of ['A1', 'A2', 'A3']) await expect(sectionLabels(page, s).first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 1$/)
  await page.reload()
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 1$/) // kept for this chart
})

test('a pick in one section’s ladder changes that section only', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const before = await sectionLabels(page, 'A1').first().textContent()
  await sectionLabels(page, 'B').first().click()
  await page.getByRole('dialog', { name: /^B · / }).locator('[data-pent]').first().click() // Home
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'A1').first()).toHaveText(before ?? '')
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Custom')
})
```

(If the second-test pick list's first `[data-pent]` is not Home, pick by the Home row instead: `ladder.locator('li').first().locator('[data-pent]')`.)

- [ ] **Step 2: Run the browser tests**

Run (repo root): `make e2e`
Expected: PASS, including `editor.spec.ts` "stays tidy" (the Path listbox replaces Rung + Side off One rung, so the stack is no taller) and `print.spec`.

If "stays tidy" fails with One rung on (Path + Rung + Side stacked), move Side beside Rung in one row (`flex gap-2`) rather than shrinking anything else; rerun.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/pentatonics.spec.ts
git commit -m "Pentatonic paths: browser tests (#264)"
```

---

### Task 6: Verify and open the PR

- [ ] **Step 1:** Run (repo root): `make test && make lint && make e2e && make golden && git status --short` — all pass, golden unchanged, nothing unstaged but expected files.
- [ ] **Step 2:** Push and open the PR:

```bash
git push -u origin pentatonic-paths
gh pr create --title "Pentatonic paths: a rung per section, and presets (#264)" --body "$(cat <<'EOF'
Closes #264. Phase 2 of #255 ([spec](docs/superpowers/specs/2026-10-13-pentatonic-paths-design.md)).

- Path listbox under Pentatonics: One rung (as before), Side-slip, Fifths, Minor thirds, Major thirds; Custom once a section is edited.
- A preset fills each section by its role in the form; a pick in a label's ladder sets that section only.
- Per chart in this browser (`csm-pent-path:<slug>`), never in the chart or share links.
- Labels carry the shared count (`B♭m♪ 1`) off One rung.
- Behind the `pentatonics` flag (off).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3:** `gh pr checks <n> --watch` (not piped); report. Merge only on the user's word.
