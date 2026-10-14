# Pentatonic paths: step by section, key area or N bars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pentatonic path preset moves across the whole form from its second unit on, stepping by section, key area or every 2/4/8 bars, and the sheet's subtitle names the path.

**Architecture:** The engine owns the cycle (`pentatonicCycle`) and the units: `buildChanges` gives each chord's key-basis view from the preset and the chord's unit, and returns a caption. The web stores `{ path, step }` per chart (`usePentatonicPath`), adds a Step by control under Path, and appends the caption to the Changes subtitle.

**Tech Stack:** TypeScript strict, Vitest (engine + web unit), Vue 3 / Nuxt, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-14-pentatonic-path-steps-design.md`

## Global Constraints

- Engine stays free of Vue/DOM imports; `engine/src/index.ts` already re-exports `./pentatonics` (`export *`), so new exports there are public; update the API snapshot (`engine/src/__tests__/api.test.ts`, `npx vitest run src/__tests__/api.test.ts -u` in `engine/`).
- Labels: `Section`, `Key area`, `Bars`; bars choices `2`, `4`, `8`; default step `{ unit: 'section', bars: 4 }`.
- Caption text exactly: `Pentatonics: <path label> · by section` | `· by key area` | `· every N bars`. Path labels: `One rung`, `Side-slip`, `Fifths`, `Minor thirds`, `Major thirds`, `Custom`.
- Caption null for: no plan, chord basis, One rung, Custom.
- The `pentatonics` feature flag (off; e2e on) gates all of this UI; Tailwind literal classes only.
- Rail ≤ 2 rows at 1440 wide (`web/e2e/editor.spec.ts` "stays tidy").
- Anything run per chord must be cheap: units are precomputed once per `buildChanges` (Map lookups per chord), no per-chord scans (the #280 CI timeout lesson).
- Never in the chart or a share link: the step lives in `csm-pent-path:<key>` with the path.
- Stage files by name; commit on branch `pent-path-steps` (worktree `../csm-pent-steps`); end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Caption placement: the spec allows the caption on the subtitle's line; this plan takes that form (`<subtitle> · <caption>`), so `changesLinesPerPage` is unchanged and print.spec's worst case cannot overflow.

## Review Focus

- A chart with no form section (only an Intro): every chord Home, caption still given, no throw. → Task 2 test "a chart with no form plays Home".
- A path stored before #276 (no `step`, or junk `step`): reads as section, 4. → Task 3 test "reads an old stored path as Section".
- A key area run that starts on chords with no analysed key: unit 0 until the first key, no NaN/undefined unit. → Task 2 `areaUnit` starts at run 0; test "a revisit takes the next step" plus the default `?? 0`.
- A transposing part (B♭ tenor): units and rungs identical to concert, only spellings change. → Task 2 test "steps the same for a B♭ part".
- A repeat drawn once (Autumn Leaves' A1 · A2): counted once, as drawn; B's first bar is form bar 8. → Task 2 test "counts a repeat drawn once by its drawn bars".

---

### Task 1: Engine — the cycle, the step type, labels and caption

**Files:**
- Modify: `engine/src/pentatonics.ts` (after `pentatonicStep`, ~line 66)
- Test: `engine/src/__tests__/pentatonics.test.ts`
- Snapshot: `engine/src/__tests__/__snapshots__/api.test.ts.snap`

**Interfaces:**
- Produces:
  - `type PentatonicStepUnit = 'section' | 'key-area' | 'bars'`
  - `type PentatonicStep = Readonly<{ unit: PentatonicStepUnit; bars: 2 | 4 | 8 }>`
  - `const PENTATONIC_STEP_UNITS: readonly PentatonicStepUnit[]`, `const PENTATONIC_STEP_BARS: readonly [2, 4, 8]`, `const PENTATONIC_STEP: PentatonicStep` (`{ unit: 'section', bars: 4 }`)
  - `isPentatonicStep(v: unknown): v is PentatonicStep`
  - `PENTATONIC_PATH_LABELS: Readonly<Record<PentatonicPathName, string>>`
  - `isPentatonicPreset(p: PentatonicPathName | undefined): boolean` (true for side-slip, fifths, minor-thirds, major-thirds)
  - `pentatonicCycle(path: PentatonicPathName, i: number): PentatonicView`
  - `pentatonicPathCaption(path: PentatonicPathName, step?: PentatonicStep): string | null`
  - `pentatonicPreset` stays for now (removed in Task 3, when its last caller goes).

- [ ] **Step 1: Write the failing tests** — append inside `describe('pentatonic paths', …)` in `engine/src/__tests__/pentatonics.test.ts`, and add the new names to its import from `'../pentatonics'` (`isPentatonicPreset, isPentatonicStep, PENTATONIC_PATH_LABELS, PENTATONIC_STEP, pentatonicCycle, pentatonicPathCaption`):

```ts
  const cycle = (path: Parameters<typeof pentatonicCycle>[0], n: number) => Array.from({ length: n }, (_, i) => show({ s: pentatonicCycle(path, i) }).s)

  it('cycles each preset from Home, one step a unit, wrapping round (#276)', () => {
    expect(cycle('side-slip', 4)).toEqual(['0', '5♭', '0', '5♭'])
    expect(cycle('fifths', 13)).toEqual(['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6', '5♭', '4♭', '3♭', '2♭', '1♭', '0'])
    expect(cycle('minor-thirds', 5)).toEqual(['0', '3♭', '6', '3♯', '0'])
    expect(cycle('major-thirds', 4)).toEqual(['0', '4♯', '4♭', '0'])
    expect(cycle('one', 3)).toEqual(['0', '0', '0'])
    expect(cycle('custom', 2)).toEqual(['0', '0'])
  })

  it('knows a step: a unit and 2, 4 or 8 bars, by default each section', () => {
    expect(PENTATONIC_STEP).toEqual({ unit: 'section', bars: 4 })
    expect([{ unit: 'section', bars: 4 }, { unit: 'key-area', bars: 2 }, { unit: 'bars', bars: 8 }].every(isPentatonicStep)).toBe(true)
    expect([null, {}, { unit: 'chord', bars: 4 }, { unit: 'bars', bars: 3 }, { unit: 'bars' }, 'bars'].some(isPentatonicStep)).toBe(false)
  })

  it('names the path playing, for a preset only', () => {
    expect(pentatonicPathCaption('minor-thirds', { unit: 'bars', bars: 4 })).toBe('Pentatonics: Minor thirds · every 4 bars')
    expect(pentatonicPathCaption('side-slip')).toBe('Pentatonics: Side-slip · by section')
    expect(pentatonicPathCaption('fifths', { unit: 'key-area', bars: 2 })).toBe('Pentatonics: Fifths · by key area')
    expect(pentatonicPathCaption('one')).toBeNull()
    expect(pentatonicPathCaption('custom')).toBeNull()
    expect(PENTATONIC_PATH_LABELS['major-thirds']).toBe('Major thirds')
    expect(['side-slip', 'fifths', 'minor-thirds', 'major-thirds'].every((p) => isPentatonicPreset(p as never))).toBe(true)
    expect([undefined, 'one', 'custom'].some((p) => isPentatonicPreset(p as never))).toBe(false)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts`
Expected: FAIL (`pentatonicCycle` etc. not exported).

- [ ] **Step 3: Implement** — in `engine/src/pentatonics.ts`, after `pentatonicStep`:

```ts
/** what a preset steps by (#276): each section of the form, each run of one key area, or every `bars` bars of the form */
export type PentatonicStepUnit = 'section' | 'key-area' | 'bars'
export type PentatonicStep = Readonly<{ unit: PentatonicStepUnit; bars: 2 | 4 | 8 }>
export const PENTATONIC_STEP_UNITS: readonly PentatonicStepUnit[] = ['section', 'key-area', 'bars']
export const PENTATONIC_STEP_BARS = [2, 4, 8] as const
export const PENTATONIC_STEP: PentatonicStep = { unit: 'section', bars: 4 }
export const isPentatonicStep = (v: unknown): v is PentatonicStep => {
  if (typeof v !== 'object' || v === null) return false
  const { unit, bars } = v as Partial<PentatonicStep>
  return (PENTATONIC_STEP_UNITS as readonly unknown[]).includes(unit) && (PENTATONIC_STEP_BARS as readonly unknown[]).includes(bars)
}

export const PENTATONIC_PATH_LABELS: Readonly<Record<PentatonicPathName, string>> = {
  one: 'One rung',
  'side-slip': 'Side-slip',
  fifths: 'Fifths',
  'minor-thirds': 'Minor thirds',
  'major-thirds': 'Major thirds',
  custom: 'Custom',
}
/** a path laid over the form by the cycle (not One rung, not a stored Custom) */
export const isPentatonicPreset = (p: PentatonicPathName | undefined): boolean => p !== undefined && p !== 'one' && p !== 'custom'

/** unit i's view under a preset (#276): i steps of it from Home, wrapping round; Home for One rung and Custom */
export function pentatonicCycle(path: PentatonicPathName, i: number): PentatonicView {
  switch (path) {
    case 'side-slip':
      return i % 2 === 1 ? pentatonicStep(1) : PENTATONIC_HOME
    case 'fifths':
      return pentatonicStep(7 * i)
    case 'minor-thirds':
      return pentatonicStep(3 * i)
    case 'major-thirds':
      return pentatonicStep(4 * i)
    default:
      return PENTATONIC_HOME
  }
}

/** "Pentatonics: Minor thirds · every 4 bars"; null for One rung and Custom */
export function pentatonicPathCaption(path: PentatonicPathName, step: PentatonicStep = PENTATONIC_STEP): string | null {
  if (!isPentatonicPreset(path)) return null
  const unit = step.unit === 'bars' ? `every ${step.bars} bars` : step.unit === 'section' ? 'by section' : 'by key area'
  return `Pentatonics: ${PENTATONIC_PATH_LABELS[path]} · ${unit}`
}
```

- [ ] **Step 4: Run tests, update the API snapshot**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts && npx vitest run src/__tests__/api.test.ts -u`
Expected: PASS; snapshot gains the new names. Read the snapshot diff: only additions.

- [ ] **Step 5: Commit**

```bash
git add engine/src/pentatonics.ts engine/src/__tests__/pentatonics.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonics: a cycle per preset, a step by unit, and a caption (#276)"
```

---

### Task 2: Engine — `buildChanges` lays a preset over units, and returns the caption

**Files:**
- Modify: `engine/src/changes.ts` (imports line 10; `PentatonicPlan` ~line 49; `ChangesSheet` line 129; `pentatonicOf` ~line 412; `lines` ~line 438; return ~line 511)
- Test: `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes (Task 1): `pentatonicCycle`, `isPentatonicPreset`, `pentatonicPathCaption`, `PENTATONIC_STEP`, `type PentatonicStep`, `type PentatonicPathName` from `./pentatonics`.
- Produces:
  - `PentatonicPlan` gains `path?: PentatonicPathName` and `step?: PentatonicStep`. With `isPentatonicPreset(path)`, each key-basis chord's view is `pentatonicCycle(path, unit)` (Home outside the form) and `bySection`/`fallback` are ignored; otherwise unchanged.
  - `ChangesSheet` gains `pentatonicCaption: string | null`.

- [ ] **Step 1: Write the failing tests** — in `engine/src/__tests__/changes.test.ts`: change the `pents` helper's parameter to `(sheet: Pick<ChangesSheet, 'lines'>)`; add to the imports `import { PENTATONIC_HOME, type PentatonicPathName, type PentatonicStep } from '../pentatonics'`; then add after the test "gives a merged repeat’s chords the first section’s rung":

```ts
  describe('a preset’s steps (#276)', () => {
    const tag = (v: { rung: number; side: string } | undefined): string => (!v ? '' : v.rung === 0 || v.rung === 6 ? String(v.rung) : `${v.rung}${v.side === 'flat' ? '♭' : '♯'}`)
    const rungs = (sheet: ChangesSheet) => sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => tag(c.pentatonic?.view))))
    const preset = (path: PentatonicPathName, step?: PentatonicStep, extra: Partial<PentatonicPlan> = {}): PentatonicPlan => ({ bySection: {}, fallback: PENTATONIC_HOME, counts: true, path, ...(step ? { step } : {}), ...extra })
    const build = (text: string, plan: PentatonicPlan, part = CONCERT) => buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan)
    const ABC = 'title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Cmaj7\nC | 3 | Cmaj7\n'
    const bars = (section: string, from: number, n: number) => Array.from({ length: n }, (_, i) => `${section} | ${from + i} | Cmaj7`).join('\n')

    it('by section, moves every section after the first: A B C is Home, then out, then further', () => {
      const sheet = build(ABC, preset('minor-thirds', { unit: 'section', bars: 4 }))
      expect(rungs(sheet)).toEqual(['0', '3♭', '6'])
      expect(pents({ lines: showPentatonics(sheet.lines) })).toEqual([['Am♪ 5'], ['Cm♪ 3'], ['E♭m♪ 0']])
    })

    it('steps by section when the plan has no step', () => {
      expect(rungs(build(ABC, preset('fifths')))).toEqual(['0', '1♯', '2♯'])
    })

    it('plays Home outside the form, and counts only the form', () => {
      const text = 'title: T\nkey: C\nIntro | 1 | Cmaj7\nA | 2 | Cmaj7\nB | 3 | Cmaj7\nCoda | 4 | Cmaj7\n'
      expect(rungs(build(text, preset('fifths', { unit: 'section', bars: 4 })))).toEqual(['0', '0', '1♯', '0'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '0', '0'])
    })

    it('a chart with no form plays Home', () => {
      const sheet = build('title: T\nkey: C\nIntro | 1 | Cmaj7\n', preset('fifths', { unit: 'bars', bars: 2 }))
      expect(rungs(sheet)).toEqual(['0'])
      expect(sheet.pentatonicCaption).toBe('Pentatonics: Fifths · every 2 bars')
    })

    it('every N bars counts on through a section break', () => {
      const text = `title: T\nkey: C\n${bars('A', 1, 3)}\n${bars('B', 4, 3)}\n`
      expect(rungs(build(text, preset('side-slip', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '5♭', '5♭', '0', '0'])
    })

    it('every 2, 4 or 8 bars', () => {
      const text = `title: T\nkey: C\n${bars('A', 1, 8)}\n`
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 2 })))).toEqual(['0', '0', '1♯', '1♯', '2♯', '2♯', '3♯', '3♯'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 4 })))).toEqual(['0', '0', '0', '0', '1♯', '1♯', '1♯', '1♯'])
      expect(rungs(build(text, preset('fifths', { unit: 'bars', bars: 8 })))).toEqual(Array(8).fill('0'))
    })

    it('counts a repeat drawn once by its drawn bars', () => {
      const sheet = buildChanges(library('autumn-leaves'), CONCERT, 4, false, 'off', undefined, preset('fifths', { unit: 'bars', bars: 4 }))
      expect(sheet.lines.slice(0, 3).map((l) => tag(l.bars[0]?.chords[0]?.pentatonic?.view))).toEqual(['0', '1♯', '2♯']) // A1 · A2's 8 bars, then B at form bar 8
    })

    it('by key area, a revisit takes the next step', () => {
      const text = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Fmaj7\nA | 3 | Cmaj7\n@key A 2 F\n@key A 3 C\n'
      expect(rungs(build(text, preset('minor-thirds', { unit: 'key-area', bars: 4 })))).toEqual(['0', '3♭', '6'])
    })

    it('steps the same for a B♭ part', () => {
      expect(rungs(build(ABC, preset('minor-thirds'), TENOR))).toEqual(['0', '3♭', '6'])
    })

    it('a pick still wins over the preset', () => {
      const [, b] = build(ABC, preset('minor-thirds', undefined, { picks: { 'B:2:0': 9 } })).lines.flatMap((l) => l.bars.flatMap((x) => x.chords)) // concert A: Am, Home
      expect([tag(b?.pentatonic?.view), b?.pentatonic?.picked]).toEqual(['0', true])
    })

    it('names the path for a preset on the key basis only', () => {
      expect(build(ABC, preset('minor-thirds', { unit: 'bars', bars: 4 })).pentatonicCaption).toBe('Pentatonics: Minor thirds · every 4 bars')
      expect(build(ABC, preset('fifths', undefined, { basis: 'chord' })).pentatonicCaption).toBeNull()
      expect(build(ABC, one(2, 'flat')).pentatonicCaption).toBeNull()
      expect(build(ABC, preset('custom')).pentatonicCaption).toBeNull()
      expect(buildChanges(parseChart(ABC).value, CONCERT).pentatonicCaption).toBeNull()
    })
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: FAIL — rungs follow `fallback` (all `'0'`), `pentatonicCaption` undefined.

- [ ] **Step 3: Implement** in `engine/src/changes.ts`:

Import (line 10) — add `isPentatonicPreset, PENTATONIC_STEP, pentatonicCycle, pentatonicPathCaption, type PentatonicPathName, type PentatonicStep`.

`PentatonicPlan` — add after `picks`:

```ts
  path?: PentatonicPathName // a preset (#276): each chord plays its unit's step of it; bySection and fallback then unused
  step?: PentatonicStep // what a preset steps by; default PENTATONIC_STEP
```

`ChangesSheet` (line 129):

```ts
/** pentatonicCaption: the path a preset plays (#276), "Pentatonics: Fifths · every 4 bars"; null otherwise */
export type ChangesSheet = Readonly<{ lines: readonly ChangesLine[]; beats: 2 | 3 | 4; diagnostics: readonly string[]; pentatonicCaption: string | null }>
```

Before `const ladders = new Map…`, after `rankingOf`:

```ts
  // a preset's units over the form (#276), worked out once: each form block, each run of one key area, its bars as drawn
  const step = pentatonic?.step ?? PENTATONIC_STEP
  const preset = isPentatonicPreset(pentatonic?.path)
  const formBlocks = blocks.flatMap((b, k) => (b.part === 'form' ? [k] : []))
  const sectionUnit = new Map(formBlocks.map((k, n) => [k, n]))
  const barStart = new Map<number, number>() // block → its first bar's index in the form
  const areaUnit = new Map<number, number>() // row → its run of one key area
  {
    let formBars = 0
    let run = 0
    let key: string | undefined
    for (const k of formBlocks) {
      const b = blocks[k]!
      barStart.set(k, formBars)
      formBars += Math.max(1, b.to - b.from + 1)
      for (const i of b.rows) {
        const here = byRow.get(i)?.key.name
        if (here !== undefined && key !== undefined && here !== key) run++
        if (here !== undefined) key = here
        areaUnit.set(i, run)
      }
    }
  }
  /** a chord's unit: its block k, its bar j in the block, its row i; null outside the form */
  const unitOf = (k: number, j: number, i: number): number | null => {
    const n = sectionUnit.get(k)
    if (n === undefined) return null
    if (step.unit === 'section') return n
    if (step.unit === 'bars') return Math.floor(((barStart.get(k) ?? 0) + j) / step.bars)
    return areaUnit.get(i) ?? 0
  }
```

`pentatonicOf` — add a last parameter `unit: number | null` and replace the `sectionView` line with:

```ts
    const sectionView = preset
      ? unit === null ? PENTATONIC_HOME : pentatonicCycle(pentatonic.path!, unit)
      : (Object.hasOwn(pentatonic.bySection, section) ? pentatonic.bySection[section] : undefined) ?? pentatonic.fallback
```

In `const lines = blocks.flatMap((block, k) => {`, first line of the body (the inner `.map((i, k)` shadows `k`):

```ts
    const unitAt = (j: number, i: number): number | null => unitOf(k, j, i)
```

and the chord's `pentatonic:` field becomes:

```ts
            pentatonic: pentatonicOf(a?.key.name, block.section, `${block.section}:${firstBar + j}:${k}`, written, scale, row.chord, unitAt(j, i)),
```

Return:

```ts
  const pentatonicCaption = pentatonic && basis === 'key' ? pentatonicPathCaption(pentatonic.path ?? 'one', step) : null
  return { lines: counted, beats, diagnostics: voices ? [...diagnostics, ...voices.missing] : diagnostics, pentatonicCaption }
```

- [ ] **Step 4: Run the engine tests and typecheck**

Run: `cd engine && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS. If a test builds a `ChangesSheet` literal, give it `pentatonicCaption: null` or a `Pick<>` parameter. Then `make golden` from the root: expect no diff (the fixture has no preset); if it changes, read the diff before keeping it.

- [ ] **Step 5: Commit**

```bash
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Changes: a preset steps by section, key area or N bars, and names itself (#276)"
```

---

### Task 3: Web — store the step with the path; drop `pentatonicPreset`

**Files:**
- Modify: `web/app/composables/usePentatonicPath.ts`
- Modify: `web/app/utils/pentatonics.ts:21-30`
- Modify: `engine/src/pentatonics.ts` (remove `pentatonicPreset` and `PentatonicSection`), `engine/src/__tests__/pentatonics.test.ts` (remove the five preset tests at lines ~65-94 and `pentatonicPreset`/`PentatonicSection`/`form` from them; keep the `isPentatonicPathName` assertions by moving them into the cycle test), API snapshot
- Test: `web/test/usePentatonicPath.test.ts`, `web/test/pentatonics.test.ts`

**Interfaces:**
- Consumes: Task 1's `PENTATONIC_STEP`, `isPentatonicStep`, `PENTATONIC_PATH_LABELS`, `PENTATONIC_STEP_BARS`, `type PentatonicStep`, `type PentatonicStepUnit`; Task 2's `PentatonicPlan.path/step`.
- Produces:
  - `usePentatonicPath(...)` returns `{ path, step: ComputedRef<PentatonicStep>, plan, setPath, setStep(step: PentatonicStep): void, carryTo }`.
  - For a preset, `plan` is `{ bySection: {}, fallback: PENTATONIC_HOME, counts: true, path, step }`; One rung unchanged; Custom `{ bySection: own, fallback: PENTATONIC_HOME, counts: true }`.
  - `setPath('custom')` from a preset starts Custom empty (all Home); Custom is only listed while stored, so this is not reachable from the UI.
  - `web/app/utils/pentatonics.ts`: `PENT_STEP_UNITS: readonly { value: PentatonicStepUnit; label: string; title: string }[]`, `PENT_STEP_BARS: readonly { value: '2' | '4' | '8'; label: string }[]`; `PENT_PATHS` labels read from `PENTATONIC_PATH_LABELS`.

- [ ] **Step 1: Write the failing tests** — in `web/test/usePentatonicPath.test.ts`, replace the tests "treats a section named after an Object built-in…", "fills the sections from a preset…", "stores a preset without its sections…" and "switching from a preset to Custom keeps what the preset played" with:

```ts
  it('treats a Custom section named after an Object built-in as an ordinary one', () => {
    localStorage.setItem('csm-pent-path:b', JSON.stringify({ path: 'custom', sections: { constructor: { rung: 2, side: 'flat' } } }))
    const p = make('b', ['constructor', 'toString', 'B'].map((key) => ({ key, marker: key, part: 'form' as const })))
    expect(p.plan.value.bySection.constructor).toEqual({ rung: 2, side: 'flat' })
    expect(Object.hasOwn(p.plan.value.bySection, 'toString')).toBe(false)
  })

  it('hands a preset to the engine with its step, with counts, and remembers both per chart', async () => {
    const p = make('satin-doll')
    p.setPath('side-slip')
    expect(p.plan.value).toEqual({ bySection: {}, fallback: PENTATONIC_HOME, counts: true, path: 'side-slip', step: { unit: 'section', bars: 4 } })
    p.setStep({ unit: 'bars', bars: 8 })
    expect(p.plan.value.step).toEqual({ unit: 'bars', bars: 8 })
    await nextTick()
    expect(JSON.parse(localStorage.getItem('csm-pent-path:satin-doll') ?? '{}')).toEqual({ path: 'side-slip', step: { unit: 'bars', bars: 8 }, sections: {} })
    const again = make('satin-doll')
    expect([again.path.value, again.step.value]).toEqual(['side-slip', { unit: 'bars', bars: 8 }])
    expect(make('autumn-leaves').path.value).toBe('one')
  })

  it('keeps the step when the path changes, and carries it to another chart', async () => {
    const p = make('satin-doll')
    p.setStep({ unit: 'key-area', bars: 4 })
    p.setPath('fifths')
    expect(p.step.value).toEqual({ unit: 'key-area', bars: 4 })
    await nextTick()
    p.carryTo('mine:3')
    expect(make('mine:3').step.value).toEqual({ unit: 'key-area', bars: 4 })
  })

  it('reads an old stored path as Section, every 4 bars', () => {
    for (const raw of [{ path: 'fifths', sections: {} }, { path: 'fifths', step: { unit: 'chord', bars: 4 }, sections: {} }, { path: 'fifths', step: { unit: 'bars', bars: 5 } }]) {
      localStorage.setItem('csm-pent-path:old', JSON.stringify(raw))
      expect(make('old').step.value).toEqual({ unit: 'section', bars: 4 })
    }
  })

  it('starts Custom empty from a preset', () => {
    const p = make('satin-doll')
    p.setPath('fifths')
    p.setPath('custom')
    expect(p.plan.value).toEqual({ bySection: {}, fallback: PENTATONIC_HOME, counts: true })
  })
```

and in `web/test/pentatonics.test.ts` add (import `PENT_PATHS, PENT_STEP_BARS, PENT_STEP_UNITS` from `~/utils/pentatonics`):

```ts
describe('the Step by choices (#276)', () => {
  it('offers Section, Key area and Bars, then 2, 4 and 8; the path labels are the engine’s', () => {
    expect(PENT_STEP_UNITS.map((u) => [u.value, u.label])).toEqual([['section', 'Section'], ['key-area', 'Key area'], ['bars', 'Bars']])
    expect(PENT_STEP_BARS.map((b) => b.value)).toEqual(['2', '4', '8'])
    expect(PENT_PATHS.map((p) => p.label)).toEqual(['One rung', 'Side-slip', 'Fifths', 'Minor thirds', 'Major thirds', 'Custom'])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/usePentatonicPath.test.ts test/pentatonics.test.ts`
Expected: FAIL (`setStep`/`step` missing, `PENT_STEP_UNITS` undefined).

- [ ] **Step 3: Implement `usePentatonicPath.ts`** — full file:

```ts
import type { ComputedRef, Ref } from 'vue'
import { type ChangesSection, isPentatonicPathName, isPentatonicStep, isPentatonicView, PENTATONIC_HOME, PENTATONIC_STEP, type PentatonicPathName, type PentatonicPlan, type PentatonicStep, type PentatonicView } from '@chord-scale-maker/engine'

type Stored = Readonly<{ path: PentatonicPathName; step: PentatonicStep; sections: Readonly<Record<string, PentatonicView>> }>
const ONE: Stored = { path: 'one', step: PENTATONIC_STEP, sections: {} }

/** a stored path, if it is one; its invalid section views dropped, a missing or invalid step read as Section */
function parse(raw: string | null): Stored {
  if (raw === null) return ONE
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || !('path' in v) || !isPentatonicPathName(v.path)) return ONE
    const step = 'step' in v && isPentatonicStep(v.step) ? v.step : PENTATONIC_STEP
    const given = 'sections' in v && v.sections && typeof v.sections === 'object' ? Object.entries(v.sections as Record<string, unknown>) : []
    return { path: v.path, step, sections: Object.fromEntries(given.filter((e): e is [string, PentatonicView] => isPentatonicView(e[1]))) }
  } catch {
    return ONE
  }
}

/**
 * the chart's pentatonic path (#264, #276), per chart in this browser under `csm-pent-path:<key>` (a library slug or
 * mine:<id>); without a key it lasts for the visit. One rung plays `fallback` (the sheet's Rung and Side) everywhere;
 * a preset goes to the engine with its step, which lays it over the form; a stored Custom path (from before #272)
 * still plays its sections. Never in the chart or a share link.
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
    if (s.path !== 'custom') return { bySection: {}, fallback: PENTATONIC_HOME, counts: true, path: s.path, step: s.step }
    const known = new Set(sections.value.map((x) => x.key))
    return { bySection: Object.fromEntries(Object.entries(s.sections).filter(([k]) => known.has(k))), fallback: PENTATONIC_HOME, counts: true }
  })
  return {
    path: computed(() => state.value.path),
    step: computed(() => state.value.step),
    plan,
    /** the step stays with the chart whatever the path; Custom keeps its own sections, and starts empty from anything else */
    setPath(name: PentatonicPathName): void {
      state.value = { path: name, step: state.value.step, sections: name === 'custom' && state.value.path === 'custom' ? state.value.sections : {} }
    },
    setStep(step: PentatonicStep): void {
      state.value = { ...state.value, step }
    },
    /** the same path for another chart (a copy, or a shared chart once saved) */
    carryTo(otherKey: string): void {
      if (state.value.path !== 'one') writeStored(`csm-pent-path:${otherKey}`, JSON.stringify(state.value))
    },
  }
}
```

Note: One rung removes the stored entry, so a step chosen and then One rung picked is forgotten for that chart — acceptable (the step only shows for presets).

- [ ] **Step 4: Implement `web/app/utils/pentatonics.ts`** — replace the `PENT_PATHS` block and add the step choices (import `PENTATONIC_PATH_LABELS, PENTATONIC_PATHS, PENTATONIC_STEP_BARS, type PentatonicStepUnit` from the engine):

```ts
/** the Path listbox (#264); Custom is listed only while it is the current path */
export const PENT_PATHS: readonly { value: PentatonicPathName; label: string }[] = PENTATONIC_PATHS.map((value) => ({ value, label: PENTATONIC_PATH_LABELS[value] }))
export const pathLabel = (p: PentatonicPathName): string => PENTATONIC_PATH_LABELS[p] ?? ''

/** what a preset steps by (#276) */
export const PENT_STEP_UNITS: readonly { value: PentatonicStepUnit; label: string; title: string }[] = [
  { value: 'section', label: 'Section', title: 'The next step at each section of the form' },
  { value: 'key-area', label: 'Key area', title: 'The next step at each change of key area' },
  { value: 'bars', label: 'Bars', title: 'The next step every few bars, through the form' },
]
export const PENT_STEP_BARS: readonly { value: '2' | '4' | '8'; label: string }[] = PENTATONIC_STEP_BARS.map((n) => ({ value: String(n) as '2' | '4' | '8', label: String(n) }))
```

- [ ] **Step 5: Remove `pentatonicPreset` and `PentatonicSection`** from `engine/src/pentatonics.ts` (the function, its doc comment, the type), and from `engine/src/__tests__/pentatonics.test.ts` the tests "lays each preset over AABA by role…", "lays each preset over AABA written out…", "spreads the fifths climb…", "tiny forms…", and "has no preset for One rung or Custom…" (move its two `isPentatonicPathName` lines into the cycle test), plus the `form` helper and the removed imports. Update the snapshot: `cd engine && npx vitest run src/__tests__/api.test.ts -u` (diff: `pentatonicPreset` gone only). `grep -rn "pentatonicPreset\|PentatonicSection" engine web/app web/test` → no hits.

- [ ] **Step 6: Run** `make test`
Expected: PASS (typecheck + vitest, engine and web).

- [ ] **Step 7: Commit**

```bash
git add web/app/composables/usePentatonicPath.ts web/app/utils/pentatonics.ts web/test/usePentatonicPath.test.ts web/test/pentatonics.test.ts engine/src/pentatonics.ts engine/src/__tests__/pentatonics.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonic path: store its step, hand presets to the engine (#276)"
```

---

### Task 4: Web — the Step by control, pick clearing, and the caption on the sheet

**Files:**
- Modify: `web/app/components/PreviewControls.vue` (template ~lines 59-71; script ~lines 133-155)
- Modify: `web/app/components/EditorView.vue` (~lines 121, 372-376)
- Modify: `web/app/components/ChangesSheet.vue:120`
- Test: `web/e2e/pentatonics.spec.ts`, `web/e2e/editor.spec.ts` ("stays tidy", ~line 347)

**Interfaces:**
- Consumes: Task 3's `pentPath.step`, `pentPath.setStep`, `PENT_STEP_UNITS`, `PENT_STEP_BARS`; Task 2's `ChangesSheet.pentatonicCaption`.
- Produces: PreviewControls v-models `pentStepUnit: PentatonicStepUnit` (default `'section'`) and `pentStepBars: 2 | 4 | 8` (default `4`); radio groups with accessible names `Pentatonic step` and `Bars a step`.

- [ ] **Step 1: Write the failing e2e tests** — append to `web/e2e/pentatonics.spec.ts`:

```ts
/** check a SegmentedControl's radio (sr-only: click its label; retried, a click before hydration is lost) */
async function checkRadio(page: Page, group: string, name: string): Promise<void> {
  const radio = page.getByRole('group', { name: group }).getByRole('radio', { name, exact: true })
  await expect(async () => {
    if (!(await radio.isChecked())) await page.locator('label').filter({ has: radio }).click({ timeout: 1000 })
    await expect(radio).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

test('a preset moves every section after the first: Waltz for Debby’s A B C', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.getByRole('group', { name: 'Pentatonic step' })).toHaveCount(0) // One rung: no step
  await choosePath(page, 'Minor thirds')
  await expect(sectionLabels(page, 'A').first()).toHaveText(/♪ 5$/)
  await expect(sectionLabels(page, 'B').first()).toHaveText(/♪ 3$/)
  await expect(sectionLabels(page, 'C').first()).toHaveText(/♪ 0$/)
  await expect(page.getByText('Pentatonics: Minor thirds · by section').first()).toBeVisible()
})

test('every 4 bars moves page 1’s second line, prints the path, and is kept over a reload', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Minor thirds')
  await checkRadio(page, 'Pentatonic step', 'Bars')
  await checkRadio(page, 'Bars a step', '4')
  const at = (chord: string) => page.locator(`[data-slot="pentatonic"] [data-chord="${chord}"]`) // by chord, not by line: a line the app breaks early would shift a line count
  await expect(at('A1:1:0')).toHaveText(/♪ 5$/)
  await expect(at('A1:5:0')).toHaveText(/♪ 3$/) // bars 5–8: the second unit, 3♭
  await page.reload()
  await expect(at('A1:5:0')).toHaveText(/♪ 3$/)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByText('Pentatonics: Minor thirds · every 4 bars').first()).toBeVisible()
})

test('a change of step clears the picks', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const target = sectionLabels(page, 'B').first()
  const before = await target.textContent()
  await target.click()
  await page.getByRole('dialog', { name: /^B · / }).locator('li').last().locator('[data-pent]').click() // rung 6
  await expect(target).not.toHaveText(before ?? '')
  await checkRadio(page, 'Pentatonic step', 'Key area')
  await checkRadio(page, 'Pentatonic step', 'Section')
  await expect(target).toHaveText(before ?? '')
})
```

and in `web/e2e/editor.spec.ts`'s "stays tidy" test, after the `pent.rows` assertion:

```ts
  // a preset's Step by, with Bars and its count, stacks under Path too (#276)
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name: 'Fifths' }).click()
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Bars', exact: true }) }).click()
  await expect(page.getByRole('group', { name: 'Bars a step' })).toBeVisible()
  const stepped = await layout()
  expect(stepped.rows, `Changes, Pentatonics stepped (${stepped.widths})`).toBeLessThanOrEqual(2)
```

- [ ] **Step 2: Run to verify they fail**

Run: `make e2e` (or `cd web && npx playwright test e2e/pentatonics.spec.ts e2e/editor.spec.ts -g "preset moves|every 4 bars|change of step|stays tidy"`)
Expected: FAIL (no `Pentatonic step` group, no caption).

- [ ] **Step 3: PreviewControls.vue** — in the template, after the `<template v-if="pentPath === 'one'">…</template>` block (inside the `v-else` key-basis template), add:

```vue
                    <template v-else-if="pentPath !== 'custom'">
                      <SegmentedControl v-model="pentStepUnit" legend="Step by" name="pent-step" aria-label="Pentatonic step" :options="PENT_STEP_UNITS" />
                      <SegmentedControl v-if="pentStepUnit === 'bars'" v-model="pentStepBarsText" legend="Bars" name="pent-step-bars" aria-label="Bars a step" :options="PENT_STEP_BARS" />
                    </template>
```

In the script: add `type PentatonicStepUnit` to the engine import, `PENT_STEP_BARS, PENT_STEP_UNITS` to the `~/utils/pentatonics` import, and after `pathChoices`:

```ts
const pentStepUnit = defineModel<PentatonicStepUnit>('pentStepUnit', { default: 'section' })
const pentStepBars = defineModel<2 | 4 | 8>('pentStepBars', { default: 4 })
/** SegmentedControl's values are strings */
const pentStepBarsText = computed({ get: () => String(pentStepBars.value) as '2' | '4' | '8', set: (v) => (pentStepBars.value = Number(v) as 2 | 4 | 8) })
```

- [ ] **Step 4: EditorView.vue** — after `pentPathModel` (line 373):

```ts
const pentStepUnit = computed({ get: () => pentPath.step.value.unit, set: (unit) => pentPath.setStep({ ...pentPath.step.value, unit }) })
const pentStepBars = computed({ get: () => pentPath.step.value.bars, set: (bars) => pentPath.setStep({ ...pentPath.step.value, bars }) })
```

add `() => JSON.stringify(pentPath.step.value)` to the `watch([...], () => pentPicks.clear())` sources (line 376), and after `v-model:pent-path="pentPathModel"` (line 121):

```vue
            v-model:pent-step-unit="pentStepUnit"
            v-model:pent-step-bars="pentStepBars"
```

If `PreviewControls` is also rendered elsewhere with `v-model:pent-path` (`grep -rn "v-model:pent-path" web/app`), add the same two bindings there.

- [ ] **Step 5: ChangesSheet.vue** — line 120:

```ts
const subtitleText = computed(() => [pageSubtitle(props.subtitle, props.instrumentLabel, 'Changes'), built.value.pentatonicCaption].filter(Boolean).join(' · '))
```

- [ ] **Step 6: Run** `make test && make lint && make e2e`
Expected: all PASS, including the existing pentatonics specs (Satin Doll's Side-slip by section is still A1 · A2 Home, B 5♭, A3 Home).

- [ ] **Step 7: Commit**

```bash
git add web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/app/components/ChangesSheet.vue web/e2e/pentatonics.spec.ts web/e2e/editor.spec.ts
git commit -m "Pentatonics: a Step by control, and the path in the sheet's subtitle (#276)"
```

---

### Task 5: Docs and final verification

**Files:**
- Modify: `docs/design.md:510` (the **Paths** bullet)

- [ ] **Step 1: Update the Paths bullet** to:

```markdown
- **Paths** (#264, #276, [spec](superpowers/specs/2026-10-13-pentatonic-paths-design.md), [steps](superpowers/specs/2026-10-14-pentatonic-path-steps-design.md)): Path listbox: One rung (Rung + Side, as before), Side-slip, Fifths, Minor thirds, Major thirds. A preset cycles from Home one step a unit (`pentatonicCycle`): Step by Section (each form section), Key area (each run of one key area; a revisit takes the next step) or Bars (every 2, 4 or 8 bars of the form, through section breaks); outside the form, Home. `buildChanges` lays it over the units (`PentatonicPlan.path`/`step`) and names it in the Changes subtitle (`ChangesSheet.pentatonicCaption`). A pick in a label's ladder doesn't change the path (see Picks); a stored Custom still plays its sections. Per chart, with its step: `csm-pent-path:<slug>` (`usePentatonicPath`). Labels carry the shared count (`B♭m♪ 1`) off One rung.
```

- [ ] **Step 2: Full verification**

Run: `make test && make lint && make e2e && make golden && git status --short`
Expected: all pass; `make golden` leaves `engine/fixtures/golden.json` unchanged (if it changed, read the diff and explain it in the PR).

- [ ] **Step 3: Commit**

```bash
git add docs/design.md
git commit -m "Design: pentatonic paths step by section, key area or N bars (#276)"
```
