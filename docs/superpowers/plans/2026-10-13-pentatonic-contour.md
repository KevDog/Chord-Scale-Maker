# Pentatonic contour and tint by rung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With a pentatonic path other than One rung, tint each Changes label by its rung and draw a thin step line (the tension contour) under each line, with a riser where the rung changed from the line before.

**Architecture:** A pure engine function `pentatonicContour(lines)` turns the built Changes lines into runs of one rung per line plus an entry rung; `ChangesSheet` computes it and hands each `ChangesSystem` its line's contour, which maps chord refs to x and draws an SVG band. Seven `--color-rung-*` tokens tint labels and strokes.

**Tech Stack:** TypeScript (strict), Vue 3 / Nuxt, Tailwind v4 (`@theme` tokens), Vitest (`@nuxt/test-utils` `mountSuspended`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-pentatonic-contour-design.md`

## Global Constraints

- Worktree `/Users/kevdog/code/csm-contour`, branch `pentatonic-contour`. Stage files by name, never `git add -A`.
- `engine/` stays pure: no Vue, DOM or app imports.
- Contour and tint show only when the plan's `counts` is true (any path but One rung); with One rung or `pentatonic` null the sheet is exactly as before.
- Preferences only: nothing new in chart rows, share links or storage.
- Pages run under the hashed CSP: no inline `<script>`, no `eval`. Inline SVG and `:style` bindings are fine (already used).
- The `pentatonics` feature flag gates it all already (the row isn't built without it); e2e builds have it on.
- Toolbar rail unchanged (no new control).
- Tint contrast ≥ 4.5:1 against paper: light `#ffffff`, dark `#0f1c30` (`zinc-900`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verify with `make test`, `make lint`, `make e2e`, `make golden` (expect no golden diff).

## Review Focus

1. **Dark mode printing:** print forces light colours (`main.css` `@media print { html.dark … }`), so the dark rung tokens must not apply in print or labels print pastel on white. Task 3 scopes the dark tokens to `@media screen` and tests it.
2. **Held bars and markers:** a bar with no chords (a held chord) or a marker-only mark must not end a run or become a run end; the run's right end is the next *chord's* x. Task 4 tests a held bar.
3. **Editing:** the new-chord slot mark (`slot: true`) while editing must not be treated as a chord in the x mapping. Task 4 filters `slot` and marker marks and tests it.
4. **Wrapped section:** a section broken over two lines by `breakLines` (names don't fit) keeps its rung: no riser on the second line. Task 1 tests it.
5. **Gap at a line edge:** a no-key chord first or last on a line clears the entry riser for the next line, and a chordless line resets it. Task 1 tests both.

---

### Task 1: Engine `pentatonicContour`

**Files:**
- Modify: `engine/src/changes.ts` (types near `PentatonicPlan`, line ~28; function after `showPentatonics`, line ~180)
- Test: `engine/src/__tests__/changes.test.ts` (inside `describe` that holds the pentatonic tests, after "gives a merged repeat’s chords the first section’s rung", line ~195)
- Modify: `engine/src/__tests__/__snapshots__/api.test.ts.snap` (regenerated)

**Interfaces:**
- Consumes: `ChangesLine`, `ChangesChord.pentatonic.view.rung` (existing), `showPentatonics`, `breakLines`, `buildChanges`, `PentatonicPlan`.
- Produces (exported from `@chord-scale-maker/engine` via `export * from './changes'`):
  ```ts
  export type ChordRef = Readonly<{ bar: number; chord: number }>
  export type ContourRun = Readonly<{ from: ChordRef; to: ChordRef; rung: number }> // to inclusive
  export type ContourLine = Readonly<{ entry: number | null; runs: readonly ContourRun[] }>
  export function pentatonicContour(lines: readonly ChangesLine[]): readonly ContourLine[]
  ```

- [ ] **Step 1: Write the failing tests**

Add `pentatonicContour` to the import from `'../changes'` at the top of `changes.test.ts`, then add:

```ts
  describe('pentatonicContour', () => {
    const side = (rung: number): PentatonicPlan => ({ bySection: { B: { rung, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true })
    const contour = (text: string, plan: PentatonicPlan | null, breaks: readonly string[] = []) =>
      pentatonicContour(showPentatonics(breakLines(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines, new Set(breaks))))
    const AABA = 'title: T\nkey: C\nA1 | 1 | Cmaj7\nA2 | 2 | Cmaj7\nB | 3 | Dm7 G7\nA3 | 4 | Cmaj7'

    it('gives each line one run at its section’s rung, and a riser where the rung changed from the line before', () => {
      expect(contour(AABA, side(5))).toEqual([
        { entry: null, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
        { entry: null, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
        { entry: 0, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 1 }, rung: 5 }] },
        { entry: 5, runs: [{ from: { bar: 0, chord: 0 }, to: { bar: 0, chord: 0 }, rung: 0 }] },
      ])
    })

    it('ignores blanked labels: a run spans chords whose label showPentatonics left unprinted', () => {
      const runs = contour('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\nA | 3 | G7', side(5))[0]?.runs
      expect(runs).toEqual([{ from: { bar: 0, chord: 0 }, to: { bar: 2, chord: 0 }, rung: 0 }])
    })

    it('keeps a wrapped section’s rung with no riser on its second line', () => {
      const text = 'title: T\nkey: C\nB | 1 | Cmaj7\nB | 2 | Cmaj7\nB | 3 | Cmaj7\nB | 4 | Cmaj7'
      const lines = contour(text, side(5), ['B 3'])
      expect(lines.map((l) => [l.entry, l.runs.map((r) => r.rung)])).toEqual([[null, [5]], [null, [5]]])
    })

    it('breaks a run at a chord with no key, and gives no riser across a gap at a line’s edge', () => {
      // N.C. has no key: a gap
      const text = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | N.C.\nA | 3 | Cmaj7\nB | 4 | N.C.\nB | 5 | Cmaj7'
      const lines = contour(text, side(5))
      expect(lines[0]?.runs.map((r) => [r.from.bar, r.to.bar, r.rung])).toEqual([[0, 0, 0], [2, 2, 0]])
      expect(lines[1]).toEqual({ entry: null, runs: [{ from: { bar: 1, chord: 0 }, to: { bar: 1, chord: 0 }, rung: 5 }] })
    })

    it('steps mid-line where the rung changes inside a line', () => {
      // a hand-built line: two chords at different rungs
      const [line] = showPentatonics(buildChanges(parseChart('title: T\nkey: C\nA | 1 | Cmaj7 Dm7').value, CONCERT, 4, false, 'off', undefined, side(0)).lines)
      const bar = line!.bars[0]!
      const second = bar.chords[1]!
      const stepped = { ...line!, bars: [{ ...bar, chords: [bar.chords[0]!, { ...second, pentatonic: { ...second.pentatonic!, view: { rung: 3, side: 'sharp' as const } } }] }] }
      expect(pentatonicContour([stepped])[0]?.runs.map((r) => [r.from.chord, r.to.chord, r.rung])).toEqual([[0, 0, 0], [1, 1, 3]])
    })

    it('has no runs with the row off, and resets the riser across a line with no chords', () => {
      expect(contour(AABA, null).every((l) => l.entry === null && l.runs.length === 0)).toBe(true)
      expect(pentatonicContour([{ bars: [], sectionEnd: true }])).toEqual([{ entry: null, runs: [] }])
    })
  })
```

Note: if `N.C.` does not parse as a chord with no key in this chart format, use whichever chord the existing test "has no pentatonics … none where the analysis finds no key" (line ~197) uses for a no-key chord, and keep the same expectations.

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/kevdog/code/csm-contour/engine && npx vitest run src/__tests__/changes.test.ts -t pentatonicContour`
Expected: FAIL, `pentatonicContour is not a function` (or an import error).

- [ ] **Step 3: Implement**

In `engine/src/changes.ts`, after the `PentatonicPlan` type:

```ts
/** a chord on a line: its bar's index in the line and its index in the bar */
export type ChordRef = Readonly<{ bar: number; chord: number }>
/** chords in a row, across bars, at one rung (`to` inclusive) */
export type ContourRun = Readonly<{ from: ChordRef; to: ChordRef; rung: number }>
/** a line's tension contour (#265): its runs, and the rung the line before ended on where this one starts on another */
export type ContourLine = Readonly<{ entry: number | null; runs: readonly ContourRun[] }>
```

After `showPentatonics`:

```ts
/**
 * the tension contour (#265), run on the lines as drawn: each line's runs of one rung (a chord with no pentatonic is a
 * gap; blanked labels still have their view), and its entry, the previous line's last rung where this line's first
 * chord sits on another
 */
export function pentatonicContour(lines: readonly ChangesLine[]): readonly ContourLine[] {
  let before: number | null = null // the rung the previous line ended on; null: a gap, or no line yet
  return lines.map((line): ContourLine => {
    const rungs = line.bars.flatMap((bar, b) => bar.chords.map((c, k) => ({ at: { bar: b, chord: k }, rung: c.pentatonic?.view.rung ?? null })))
    const runs = rungs.reduce<ContourRun[]>((acc, { at, rung }, i) => {
      if (rung === null) return acc
      const last = acc.at(-1)
      return last && last.rung === rung && rungs[i - 1]?.rung === rung ? [...acc.slice(0, -1), { ...last, to: at }] : [...acc, { from: at, to: at, rung }]
    }, [])
    const first = rungs[0]?.rung ?? null
    const entry = before !== null && first !== null && first !== before ? before : null
    before = rungs.at(-1)?.rung ?? null
    return { entry, runs }
  })
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/kevdog/code/csm-contour/engine && npx vitest run src/__tests__/changes.test.ts`
Expected: PASS (all, old tests unchanged).

- [ ] **Step 5: Update the API snapshot and review it**

Run: `cd /Users/kevdog/code/csm-contour/engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__/`
Expected: exactly one added name, `"pentatonicContour"` (types aren't runtime keys).

- [ ] **Step 6: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonic contour: runs of one rung per line, and the entry riser (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `changesLinesPerPage` takes the contour

**Files:**
- Modify: `engine/src/changes.ts:138-142` (`changesLinesPerPage` and its doc comment above)
- Test: `engine/src/__tests__/changes.test.ts:203-210`

**Interfaces:**
- Produces: `changesLinesPerPage(line: SheetLine, rows: Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean; contour?: boolean }>): number`

The counts here are provisional: one line fewer than the same rows without the contour whenever all three rows are on, else unchanged. Task 6 measures them on the print worst case and corrects both this function and its test.

- [ ] **Step 1: Write the failing test**

Append to the test at line ~203 (keep the existing expectations):

```ts
    expect(changesLinesPerPage('seventh', { numerals: true, scales: true, pentatonics: true, contour: true })).toBe(4)
    expect(changesLinesPerPage('seventh', { numerals: false, scales: false, pentatonics: true, contour: true })).toBe(6)
    expect(changesLinesPerPage('off', { numerals: true, scales: true, pentatonics: true, contour: true })).toBe(6)
    expect(changesLinesPerPage('off', { numerals: true, scales: false, pentatonics: true, contour: true })).toBe(8)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/kevdog/code/csm-contour/engine && npx vitest run src/__tests__/changes.test.ts -t "counts the pentatonic row"`
Expected: FAIL (`expected 5 to be 4`).

- [ ] **Step 3: Implement**

```ts
export function changesLinesPerPage(line: SheetLine, rows: Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean; contour?: boolean }>): number {
  const all = rows.pentatonics && rows.numerals && rows.scales
  const less = all && rows.contour ? 1 : 0 // the contour band under all three rows (#265)
  if (line === 'off') return (all ? 7 : 8) - less
  if (all) return 5 - less
  return 6 + (!rows.numerals && !rows.scales && !rows.pentatonics ? 1 : 0)
}
```

Add one sentence to the doc comment above it: `With the pentatonic contour (#265) under all three rows, one line fewer.`

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/kevdog/code/csm-contour/engine && npx vitest run src/__tests__/changes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Pentatonic contour: count its band in lines per page (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rung tint tokens

**Files:**
- Modify: `web/app/assets/css/main.css` (`@theme` block after `--color-accent-strong`, line ~43; `@layer base` after the `html.dark` rule, line ~83)
- Create: `web/test/rungTints.test.ts`

**Interfaces:**
- Produces: Tailwind utilities `text-rung-0` … `text-rung-6` (from `--color-rung-0` … `--color-rung-6`), dark values on screen only.

- [ ] **Step 1: Write the failing test**

`web/test/rungTints.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
const PAPER = { light: '#ffffff', dark: '#0f1c30' } // --color-paper; dark: zinc-900

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** the rung tokens a block of CSS sets, in order */
const tints = (block: string): string[] => [...block.matchAll(/--color-rung-(\d): (#[0-9a-f]{6});/g)].sort((a, b) => Number(a[1]) - Number(b[1])).map((m) => m[2]!)
const theme = css.slice(css.indexOf('@theme'), css.indexOf('@layer base'))
const screenDark = css.match(/@media screen \{\s*html\.dark \{([^}]*)\}/)?.[1] ?? ''

describe('rung tints (#265)', () => {
  it('defines seven, all different, in each theme', () => {
    for (const t of [tints(theme), tints(screenDark)]) {
      expect(t).toHaveLength(7)
      expect(new Set(t).size).toBe(7)
    }
  })

  it('reads as small text on the paper: at least 4.5:1 in light and dark', () => {
    for (const c of tints(theme)) expect(contrast(c, PAPER.light)).toBeGreaterThanOrEqual(4.5)
    for (const c of tints(screenDark)) expect(contrast(c, PAPER.dark)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the dark tints off the page in print (print is light)', () => {
    expect(css).toMatch(/@media screen \{\s*html\.dark \{[^}]*--color-rung-0/)
    const print = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    expect(print).not.toMatch(/--color-rung/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/kevdog/code/csm-contour/web && npx vitest run test/rungTints.test.ts`
Expected: FAIL (`expected [] to have a length of 7`).

- [ ] **Step 3: Implement**

In `@theme`, after `--color-accent-strong`:

```css
  /* the pentatonic rungs (#265), Home → Outside: muted ink, blue, violet, rose, red-orange; each ≥ 4.5:1 on the paper */
  --color-rung-0: #4a5a75;
  --color-rung-1: #2f6fe0;
  --color-rung-2: #1d4aa3;
  --color-rung-3: #7c3aed;
  --color-rung-4: #9333ea;
  --color-rung-5: #be185d;
  --color-rung-6: #c2410c;
```

In `@layer base`, right after the `html.dark { … }` rule:

```css
  /* dark rung tints on screen only: print is light (below), so it keeps the light ones */
  @media screen {
    html.dark {
      --color-rung-0: #8395b1;
      --color-rung-1: #8fb4f8;
      --color-rung-2: #6393ec;
      --color-rung-3: #a78bfa;
      --color-rung-4: #c084fc;
      --color-rung-5: #f472b6;
      --color-rung-6: #fb923c;
    }
  }
```

(Measured: light 6.98 4.70 8.20 5.70 5.38 6.04 5.18; dark 5.61 8.18 5.63 6.28 6.47 6.45 7.55.)

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/kevdog/code/csm-contour/web && npx vitest run test/rungTints.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add web/app/assets/css/main.css web/test/rungTints.test.ts
git commit -m "Pentatonic contour: rung tint tokens, light and dark (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `ChangesSystem`: tinted labels and the contour band

**Files:**
- Modify: `web/app/components/ChangesSystem.vue` (template: pentatonic row at line ~140–152 and a new band after it; script: props at line ~187, a computed after `pentatonicMarks` at line ~235)
- Test: `web/test/ChangesSystem.test.ts` (the `describe('ChangesSystem pentatonic ladders')` block, line ~228)

**Interfaces:**
- Consumes: `ContourLine`, `ChordRef`, `pentatonicContour` (Task 1); `text-rung-N` (Task 3); existing `marks` (fields `barIndex`, `k`, `x`, `slot`, `line`).
- Produces: prop `contour?: ContourLine | null`; DOM: `[data-slot="contour"]` containing `svg > line[data-kind="run"|"riser"|"step"][data-rung]`; label wrapper `span[data-section]` gets class `text-rung-<rung>` when `pentatonic.counts`.

- [ ] **Step 1: Write the failing tests**

Add `pentatonicContour` to the engine import in `ChangesSystem.test.ts`, then inside `describe('ChangesSystem pentatonic ladders')`:

```ts
  const mountLine = async (text: string, plan: PentatonicPlan, index: number, editing?: unknown) => {
    const lines = showPentatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines)
    const contour = plan.counts ? pentatonicContour(lines)[index] : null
    return mountSuspended(ChangesSystem, { props: { line: lines[index]!, first: index === 0, beats: 4 as const, barsPerLine: 4, numerals: false, scales: false, clef: 'treble' as const, pentatonic: plan, contour, ...(editing ? { editing } : {}) }, attachTo: document.body })
  }
  const slip: PentatonicPlan = { bySection: { B: { rung: 5, side: 'flat' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
  const AB = 'title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Dm7 G7\nB | 3 | Cmaj7'

  it('tints a label by its rung, and draws its line’s contour with a riser from the line before', async () => {
    const w = await mountLine(AB, slip, 1)
    expect(w.find('[data-slot="pentatonic"] [data-section="B"]').classes()).toContain('text-rung-5')
    const band = w.find('[data-slot="contour"]')
    expect(band.attributes('aria-hidden')).toBe('true')
    const runs = band.findAll('line[data-kind="run"]')
    expect(runs.map((r) => r.attributes('data-rung'))).toEqual(['5'])
    expect(Number(runs[0]!.attributes('x2'))).toBe(1000) // the run reaches the line's end
    const riser = band.find('line[data-kind="riser"]')
    expect([riser.attributes('data-rung'), riser.attributes('y1'), riser.attributes('y2')]).toEqual(['5', '54', '14']) // from Home up to 5
    w.unmount()
  })

  it('draws no band and no tint with One rung', async () => {
    const one: PentatonicPlan = { bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false }
    const w = await mountLine(AB, one, 0)
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
    expect(w.find('[data-slot="pentatonic"] [data-section]').classes().some((c) => c.startsWith('text-rung-'))).toBe(false)
    w.unmount()
  })

  it('ends a run at the next chord, across a held bar, not at a marker or the new-chord slot', async () => {
    const text = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | %\nA | 3 | N.C.\nA | 4 | Cmaj7'
    const w = await mountLine(text, slip, 0, { kind: 'slot', section: 'A', bar: '1' })
    const runs = w.findAll('[data-slot="contour"] line[data-kind="run"]')
    expect(runs).toHaveLength(2)
    const [a, b] = runs.map((r) => [Number(r.attributes('x1')), Number(r.attributes('x2'))])
    expect(a![1]).toBeGreaterThan(400) // past the held bar 2, up to N.C. in bar 3
    expect(a![1]).toBeLessThanOrEqual(b![0]!)
    w.unmount()
  })
```

Notes for the implementer: use the held-bar notation and no-key chord the chart format actually supports (see README.md's chart format and the existing `changes.test.ts` tests; `%` and `N.C.` are guesses); keep the expectations' meaning. `PentatonicPlan` is a type import from `@chord-scale-maker/engine`. If the `editing` prop's shape differs (`SheetChordEdit` in `~/utils/sheetChordEdit`), build one with `kind: 'slot'` on bar 1 as `marks` reads it (`e.kind`, `e.section`, `e.bar`).

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/kevdog/code/csm-contour/web && npx vitest run test/ChangesSystem.test.ts -t "pentatonic ladders"`
Expected: FAIL (no `text-rung-5` class; no `[data-slot="contour"]`).

- [ ] **Step 3: Implement**

Props (next to `pentatonic?:`):

```ts
  contour?: ContourLine | null // the line's tension contour (#265); null/undefined: no band
```

Import `ContourLine` as a type from `@chord-scale-maker/engine` alongside the existing engine imports.

Script, after `pentatonicMarks`:

```ts
/** the rung tints (#265), spelled out so Tailwind sees them */
const RUNG_TINT = ['text-rung-0', 'text-rung-1', 'text-rung-2', 'text-rung-3', 'text-rung-4', 'text-rung-5', 'text-rung-6'] as const
const tint = (rung: number): string => (props.pentatonic?.counts ? (RUNG_TINT[rung] ?? '') : '')
/** a rung's height in the band's 1000 × 60 box: Home on the bottom, 6 on the top, inset for the stroke */
const rungY = (rung: number): number => 54 - rung * 8
/** the contour's strokes (#265): each run from its first chord to the next chord (or the line's end), a step where two runs meet, the entry riser */
const contourLines = computed(() => {
  const c = props.contour
  if (!c || !props.pentatonic?.counts) return []
  const chords = marks.value.filter((m) => !m.slot && m.line >= 0)
  const at = (r: ChordRef) => chords.findIndex((m) => m.barIndex === r.bar && m.k === r.chord)
  const runs = c.runs.map((run) => {
    const end = at(run.to)
    return { rung: run.rung, x1: Math.round((chords[at(run.from)]?.x ?? 0) * 1000), x2: Math.round((chords[end + 1]?.x ?? 1) * 1000) }
  })
  const steps = runs.slice(1).flatMap((r, i) => (runs[i]!.x2 === r.x1 && runs[i]!.rung !== r.rung ? [{ kind: 'step', rung: r.rung, x1: r.x1, x2: r.x1, y1: rungY(runs[i]!.rung), y2: rungY(r.rung) }] : []))
  const riser = c.entry !== null && runs[0] ? [{ kind: 'riser', rung: runs[0].rung, x1: runs[0].x1, x2: runs[0].x1, y1: rungY(c.entry), y2: rungY(runs[0].rung) }] : []
  return [...runs.map((r) => ({ kind: 'run', ...r, y1: rungY(r.rung), y2: rungY(r.rung) })), ...steps, ...riser]
})
```

Import `ChordRef` as a type too.

Template: on the pentatonic label wrapper span (line ~142), make the class array depend on the tint, keeping today's colours when there is none:

```vue
        :class="['absolute whitespace-nowrap text-[0.7rem]/3.5 print:text-[0.6rem]/3', tint(m.p.view.rung) || 'text-zinc-600 dark:text-zinc-400 print:text-neutral-700']"
```

(remove those colour classes from its static `class`). Check that `PentatonicLadder`'s button inherits the colour (no text colour of its own on `HPopoverButton`); if it sets one, make it `text-inherit` there.

After the pentatonic row's closing `</div>`:

```vue
    <!-- the tension contour (#265): the line's rung as a step line, Home low, 6 high, with a riser from the line before -->
    <div v-if="contourLines.length" data-slot="contour" aria-hidden="true" class="relative h-3 print:h-2">
      <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 60" preserveAspectRatio="none">
        <line
          v-for="(s, i) in contourLines"
          :key="i"
          :data-kind="s.kind"
          :data-rung="s.rung"
          :x1="s.x1"
          :x2="s.x2"
          :y1="s.y1"
          :y2="s.y2"
          :class="[RUNG_TINT[s.rung], '[stroke-width:1.5] print:[stroke-width:1]']"
          stroke="currentColor"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/kevdog/code/csm-contour/web && npx vitest run test/ChangesSystem.test.ts test/changesDrawing.test.ts`
Expected: PASS (new and existing).

- [ ] **Step 5: Typecheck and lint**

Run: `cd /Users/kevdog/code/csm-contour && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add web/app/components/ChangesSystem.vue web/test/ChangesSystem.test.ts
git commit -m "Pentatonic contour: tint labels by rung and draw the band (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Also add `web/app/components/PentatonicLadder.vue` if it needed `text-inherit`.)

---

### Task 5: `ChangesSheet` computes the contour and counts it per page

**Files:**
- Modify: `web/app/components/ChangesSheet.vue` (template `<ChangesSystem>` at line ~14–44; script imports line ~59, `sheet`/`linesPerPage` at lines ~111–113)
- Test: `web/test/ChangesSheet.test.ts`

**Interfaces:**
- Consumes: `pentatonicContour`, `ContourLine` (Task 1); `changesLinesPerPage(…, { contour })` (Task 2); `ChangesSystem` prop `contour` (Task 4).

- [ ] **Step 1: Write the failing test**

Add to `ChangesSheet.test.ts` (follow how the file already mounts `ChangesSheet`, with its required props; reuse its helper if there is one):

```ts
describe('ChangesSheet pentatonic contour (#265)', () => {
  const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nB | 2 | Cmaj7\nA | 3 | Cmaj7').value
  const plan = (counts: boolean): PentatonicPlan => ({ bySection: counts ? { B: { rung: 5, side: 'flat' } } : {}, fallback: { rung: 0, side: 'flat' }, counts })

  it('gives each line its contour, with the riser carried across lines', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, part: CONCERT, numerals: true, scales: true, pentatonic: plan(true) } })
    const bands = w.findAll('[data-slot="contour"]')
    expect(bands).toHaveLength(3)
    expect(bands.map((b) => b.findAll('line[data-kind="riser"]').length)).toEqual([0, 1, 1])
  })

  it('has no band with One rung', async () => {
    const w = await mountSuspended(ChangesSheet, { props: { doc, part: CONCERT, numerals: true, scales: true, pentatonic: plan(false) } })
    expect(w.find('[data-slot="contour"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/kevdog/code/csm-contour/web && npx vitest run test/ChangesSheet.test.ts -t contour`
Expected: FAIL (`expected [] to have a length of 3`).

- [ ] **Step 3: Implement**

Add `pentatonicContour` to the engine import. After `sheet`:

```ts
/** the tension contour (#265), over the lines as drawn, with a path that varies by section */
const contour = computed(() => (props.pentatonic?.counts ? pentatonicContour(sheet.value.lines) : null))
```

`linesPerPage`:

```ts
const linesPerPage = computed(() => changesLinesPerPage(line.value, { numerals: props.numerals, scales: props.scales, pentatonics: !!props.pentatonic, contour: !!props.pentatonic?.counts }))
```

Template, on `<ChangesSystem>` after `:pentatonic="pentatonic"`:

```vue
            :contour="contour?.[l.index] ?? null"
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/kevdog/code/csm-contour && make test`
Expected: PASS (typecheck + all vitest).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add web/app/components/ChangesSheet.vue web/test/ChangesSheet.test.ts
git commit -m "Pentatonic contour: the sheet hands each line its contour (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Browser tests, measured print counts, design doc

**Files:**
- Modify: `web/e2e/pentatonics.spec.ts` (after the Side-slip test, line ~50)
- Modify: `web/e2e/print.spec.ts` (after the Pentatonics print tests, line ~133)
- Modify (if measurement says so): `engine/src/changes.ts` `changesLinesPerPage`, `engine/src/__tests__/changes.test.ts` its test
- Modify: `docs/design.md` (§ Pentatonics on Changes, after the Paths bullet, line ~498)

**Interfaces:**
- Consumes: everything above; e2e helpers `chooseSheet`, `showPentatonics`, `showGuides`, `chooseInstrument`, `guidesDrawn` from `./fixtures`; `choosePath` (local to `pentatonics.spec.ts`).

- [ ] **Step 1: Write the e2e for the contour**

In `pentatonics.spec.ts`:

```ts
test('a path that varies tints the labels and draws the contour: the bridge high, with a riser', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(page.locator('[data-slot="contour"]')).toHaveCount(0) // One rung: no band
  await choosePath(page, 'Side-slip')
  await expect(page.locator('[data-slot="contour"]').first()).toBeAttached()
  const bridge = page.locator('[data-slot="system"]').filter({ has: sectionLabels(page, 'B') }).first()
  await expect(bridge.locator('[data-slot="contour"] line[data-kind="run"]').first()).toHaveAttribute('data-rung', '5')
  await expect(bridge.locator('[data-slot="contour"] line[data-kind="riser"]')).toHaveCount(1)
  await expect(page.locator('[data-slot="pentatonic"] [data-section="B"]').first()).toHaveClass(/text-rung-5/)
  await expect(page.locator('[data-slot="pentatonic"] [data-section="A1"]').first()).toHaveClass(/text-rung-0/)
})
```

- [ ] **Step 2: Write the print worst case with the contour**

In `print.spec.ts`, add a local helper and two tests (mirroring the Pentatonics ones):

```ts
async function sideSlip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pentatonic path' }).click()
  await page.getByRole('option', { name: 'Side-slip' }).click()
  await expect(page.locator('[data-slot="contour"]').first()).toBeAttached()
}

// the contour band (#265) under Numerals, Scales and Pentatonics, with a guide tone line on the tuba: the tallest case
test('prints the Changes with a guide tone line and the pentatonic contour, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, 'From 7th')
  await showPentatonics(page)
  await sideSlip(page)
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

test('prints the Changes with the pentatonic contour and no line, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await sideSlip(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  await expect(svgs.first()).toBeVisible()
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  expect(sheetPages).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ media: 'print' })
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
```

Import `Page` as a type from `@playwright/test` if the file doesn't already. Confirm Numerals and Scales are on by default on these pages (the existing Pentatonics print tests assume so); if not, turn them on as those tests do.

- [ ] **Step 3: Measure**

Run: `cd /Users/kevdog/code/csm-contour/web && npm run build && npx playwright test e2e/print.spec.ts e2e/pentatonics.spec.ts` (or `make e2e`, which builds).

- If a contour print test fails with more PDF pages than sheet pages: the count is too high; lower that case in `changesLinesPerPage` by one, update the matching expectation in `changes.test.ts`, rerun.
- If both pass: also try the provisional count plus one (temporarily) for each case; if it still passes, the band didn't need the line, so drop `less` for that case (both function and test). Keep the largest count that passes. Record the measured counts in `changesLinesPerPage`'s doc comment ("measured on Stardust, tuba, From 7th, with the contour").

Expected end state: both new print tests and the pentatonics e2e PASS.

- [ ] **Step 4: Design doc**

In `docs/design.md`, after the Paths bullet (line ~498), add:

```markdown
- **Contour and tint** (#265, [spec](superpowers/specs/2026-10-13-pentatonic-contour-design.md)): off One rung, labels take
  their rung's tint (`--color-rung-0…6`, Home muted → 6 red-orange; dark values on screen only) and a band under the row
  draws the rung as a step line (`pentatonicContour`: runs of one rung per line, a gap where no key, a riser from the
  previous line's rung). The band prints; `changesLinesPerPage` takes `contour`.
```

- [ ] **Step 5: Full verification**

Run: `cd /Users/kevdog/code/csm-contour && make test && make lint && make golden && git status --short engine/fixtures && make e2e`
Expected: all pass; `make golden` leaves `engine/fixtures/` unchanged (no output from `git status --short engine/fixtures`); `editor.spec` "stays tidy" passes (rail unchanged).

- [ ] **Step 6: Commit**

```bash
cd /Users/kevdog/code/csm-contour
git add web/e2e/pentatonics.spec.ts web/e2e/print.spec.ts docs/design.md engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Pentatonic contour: browser tests, measured print counts, design notes (#265)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add the engine files only if Step 3 changed them.)
