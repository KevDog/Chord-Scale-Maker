# Changes-sheet endings and navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render 1st/2nd endings, D.C./segno navigation and coda symbols on the Changes sheet as compact lead-sheet notation, driven by four new chart directives.

**Architecture:** Four `@`-directives (`@ending`, `@segno`, `@coda`, `@nav`) parse into new `ChartLine` kinds (`chart.ts`). `buildChanges` (`changes.ts`) reads them straight from `doc.lines` and writes per-bar `volta`/`segno`/`coda`/`nav` fields onto `ChangesBar`, and makes an ending-bearing section a 2× repeat. The drawing layer splits: VexFlow draws the volta brackets on the stave (`changesDrawing.ts`); segno/coda glyphs (inline SVG) and nav text ride in the existing HTML overlay (`ChangesSystem.vue`). Two cookbook charts are converted to prove it end to end.

**Tech Stack:** TypeScript (strict), Vitest, Playwright, Vue 3 / Nuxt 4, VexFlow 5 (`vexflow/bravura`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-changes-navigation-design.md`

## Global Constraints

- TypeScript strict mode; favour pure functions and immutability; tests alongside implementation.
- `web/engine/` is pure TypeScript — **no Vue or DOM imports** (`chart.ts`, `changes.ts`). View code lives in `web/app/`.
- Pages run under a hashed CSP (`web/build/csp.ts`): no inline `<script>` of ours, no `eval`, no third-party origins. Glyphs must be inline SVG, not remote fonts.
- Scales are never hand-typed; after any chart/engine change run `make golden` and review the fixture diff (`fixtures/golden.json`, `fixtures/analysis.json`). The golden test fails until regenerated.
- `make test` = typecheck + vitest; `make lint` = eslint; `make e2e` = Playwright. All must pass before the branch is done.
- Charts are concert pitch; chords follow their scale's spelling. Don't change existing analysed rows when converting charts — only add/restructure.
- Relevant `LIMITS` (`web/engine/limits.ts`): `maxCell: 40`, `maxMeta: 120`.
- Work on branch `changes-navigation` (already created; the spec is committed there).
- The grid editor (`app/components/ChartGrid.vue`) renders only `row`/`copy`/`invalid` lines via a `v-if` chain (not an exhaustive switch), so the new directive kinds add no typecheck burden there and are **intentionally not shown as grid rows** — they live in and round-trip through the text view, like `comment`/`blank` lines. This is the spec's "round-trip as text, not editable in the grid". No `ChartGrid.vue` change in this plan. (`MyChartsList.vue`'s `kind` is `SavedMeta.kind`, unrelated to `ChartLine`.)

## Review Focus

Inputs the spec implies but which no "happy-path" task centres on — each gets a test in the owning task:

- **A directive referencing a section/bar the chart lacks** renders nothing and never throws (lenient, like `@copy` of an unknown section). → Task 2.
- **A malformed directive** (`@ending 3 …`, `@nav` with no text, non-numeric bar) becomes an `invalid` line with a diagnostic and round-trips verbatim; it does not crash the parser. → Task 1.
- **A transposed chart** keeps every directive line byte-for-byte (they carry no pitch). → Task 1.
- **Two `@nav` on the same bar** both show, joined, rather than one clobbering the other. → Task 2.
- **A volta bracket's extra height** does not push the Changes sheet past its 8-lines-a-page print budget. → Task 5.

---

### Task 1: Parse and serialize the four directives (`chart.ts`)

**Files:**
- Modify: `web/engine/chart.ts` (the `ChartLine` union ~24-31; `parseLine` ~41-70; `serializeChart` switch ~98-118)
- Test: `web/engine/__tests__/chart.test.ts`, `web/engine/__tests__/transpose.test.ts`

**Interfaces:**
- Produces, on `ChartLine`:
  - `{ kind: 'ending'; n: number; section: string; from: number; to: number }`
  - `{ kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }`
  - `{ kind: 'nav'; section: string; bar: number; text: string }`
- Consumes: existing `parseChart`, `serializeChart`, `LIMITS` (`web/engine/limits.ts`), `INT_RE` (already in `chart.ts`).

- [ ] **Step 1: Write the failing parse/round-trip tests**

In `web/engine/__tests__/chart.test.ts`, add (match the file's existing import of `parseChart`/`serializeChart`):

```ts
describe('navigation directives', () => {
  const round = (text: string) => serializeChart(parseChart(text).value)

  it('parses @ending with an explicit and a defaulted last bar', () => {
    const lines = parseChart('@ending 1 Intro 7 8\n@ending 2 Intro 9\n').value.lines
    expect(lines[0]).toEqual({ kind: 'ending', n: 1, section: 'Intro', from: 7, to: 8 })
    expect(lines[1]).toEqual({ kind: 'ending', n: 2, section: 'Intro', from: 9, to: 9 })
  })

  it('parses @segno, @coda and @nav', () => {
    const lines = parseChart('@segno A 1\n@coda Coda 1\n@nav D 8 D.S. al Coda\n').value.lines
    expect(lines[0]).toEqual({ kind: 'mark', mark: 'segno', section: 'A', bar: 1 })
    expect(lines[1]).toEqual({ kind: 'mark', mark: 'coda', section: 'Coda', bar: 1 })
    expect(lines[2]).toEqual({ kind: 'nav', section: 'D', bar: 8, text: 'D.S. al Coda' })
  })

  it('round-trips every directive (one-bar ending drops its LAST)', () => {
    const text = '@ending 1 Intro 7 8\n@ending 2 Intro 9\n@segno A 1\n@coda Coda 1\n@nav D 8 D.S. al Coda\n'
    expect(round(text)).toBe(text)
  })

  it('rejects malformed directives as invalid lines, kept verbatim', () => {
    for (const bad of ['@ending 3 A 1 2', '@ending 1 A x', '@segno A', '@coda A 1 extra', '@nav A 8']) {
      const { value, diagnostics } = parseChart(bad + '\n')
      expect(value.lines[0]).toEqual({ kind: 'invalid', text: bad })
      expect(diagnostics.length).toBe(1)
      expect(serializeChart(value)).toBe(bad + '\n')
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run --project engine engine/__tests__/chart.test.ts -t "navigation directives"`
Expected: FAIL — directives parse to `invalid` (not yet handled) / wrong shape.

- [ ] **Step 3: Add the three `ChartLine` kinds**

In `web/engine/chart.ts`, extend the union (after the `'copy'` line, before `'comment'`):

```ts
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'ending'; n: number; section: string; from: number; to: number }>
  | Readonly<{ kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }>
  | Readonly<{ kind: 'nav'; section: string; bar: number; text: string }>
  | Readonly<{ kind: 'comment'; text: string }>
```

- [ ] **Step 4: Parse the directives**

In `parseLine`, immediately after the `@copy` block (after line ~59, before the trailing-comment handling):

```ts
  if (low.startsWith('@ending')) {
    const [, n = '', section = '', from = '', to = from, ...extra] = line.split(/\s+/)
    if (extra.length > 0 || (n !== '1' && n !== '2') || !INT_RE.test(from) || !INT_RE.test(to)) return 'use  @ending N SECTION FIRST [LAST]'
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    if (Number(to) < Number(from)) return '@ending LAST must be at least FIRST'
    return { kind: 'ending', n: Number(n), section, from: Number(from), to: Number(to) }
  }
  if (low.startsWith('@segno') || low.startsWith('@coda')) {
    const [word = '', section = '', bar = '', ...extra] = line.split(/\s+/)
    if (extra.length > 0 || !section || !INT_RE.test(bar)) return 'use  @segno SECTION BAR  or  @coda SECTION BAR'
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'mark', mark: word.toLowerCase() === '@coda' ? 'coda' : 'segno', section, bar: Number(bar) }
  }
  if (low.startsWith('@nav')) {
    const m = /^@nav\s+(\S+)\s+(\S+)\s+(.+)$/.exec(line)
    if (!m || !INT_RE.test(m[2] ?? '')) return 'use  @nav SECTION BAR TEXT'
    const [, section = '', bar = '', text = ''] = m
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    if (text.trim().length > LIMITS.maxMeta) return `nav text longer than ${LIMITS.maxMeta} characters`
    return { kind: 'nav', section, bar: Number(bar), text: text.trim() }
  }
```

- [ ] **Step 5: Serialize the directives**

In `serializeChart`'s `switch (l.kind)`, add after the `'copy'` case:

```ts
      case 'ending':
        return `@ending ${l.n} ${l.section} ${l.from}${l.to !== l.from ? ` ${l.to}` : ''}`
      case 'mark':
        return `@${l.mark} ${l.section} ${l.bar}`
      case 'nav':
        return `@nav ${l.section} ${l.bar} ${l.text}`
```

- [ ] **Step 6: Run the parse/round-trip tests to verify they pass**

Run: `cd web && npx vitest run --project engine engine/__tests__/chart.test.ts -t "navigation directives"`
Expected: PASS (4 tests).

- [ ] **Step 7: Write and run the transpose-preservation test**

In `web/engine/__tests__/transpose.test.ts`, add this test. The signature is `transposeChart(doc: ChartDoc, from: string, to: string): { doc; skipped }` (`transpose.ts:82`) — pass both keys. Ensure `parseChart` and `serializeChart` (from `../chart`) and `transposeChart` (from `../transpose`) are imported at the top of the file (add any that aren't):

```ts
it('keeps navigation directives verbatim when transposing', () => {
  const text = 'key: C\nA | 1 | Dm7 | D Dorian\n@ending 1 A 1\n@segno A 1\n@coda A 1\n@nav A 1 D.S. al Coda\n'
  const out = serializeChart(transposeChart(parseChart(text).value, 'C', 'Eb').doc)
  for (const d of ['@ending 1 A 1', '@segno A 1', '@coda A 1', '@nav A 1 D.S. al Coda']) expect(out).toContain(d)
})
```

Run: `cd web && npx vitest run --project engine engine/__tests__/transpose.test.ts -t "navigation directives"`
Expected: PASS — `transposeChart` returns non-`row` lines untouched (`transpose.ts:87`). If the import name or return shape differs, adjust the call to match the file's existing usage; do not change `transpose.ts`.

- [ ] **Step 8: Typecheck and commit**

Run: `cd web && npm run typecheck && npx vitest run --project engine engine/__tests__/chart.test.ts engine/__tests__/transpose.test.ts`
Expected: PASS.

```bash
git add web/engine/chart.ts web/engine/__tests__/chart.test.ts web/engine/__tests__/transpose.test.ts
git commit -m "Changes: parse @ending/@segno/@coda/@nav directives"
```

---

### Task 2: Map directives onto `ChangesBar` (`changes.ts`)

**Files:**
- Modify: `web/engine/changes.ts` (the `ChangesBar` type ~25-36; `buildChanges` ~57-136)
- Test: `web/engine/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: `ChartLine` kinds `'ending'`/`'mark'`/`'nav'` from Task 1; existing `buildChanges(doc, part, barsPerLine)`, `expandRowLines`, `barOf`, `Run`, `ChangesBar`.
- Produces, on `ChangesBar` (added fields, existing ones unchanged):
  - `volta: { n: number; start: boolean; end: boolean } | null`
  - `segno: boolean`
  - `coda: boolean`
  - `nav: string`  (`''` = none; multiple `@nav` on a bar joined with `' · '`)

- [ ] **Step 1: Write the failing engine tests**

In `web/engine/__tests__/changes.test.ts` (it already imports `buildChanges`, `parseChart`, `CONCERT`), add:

```ts
describe('endings and navigation', () => {
  const barsOf = (text: string) => buildChanges(parseChart(text).value, CONCERT).lines.flatMap((l) => l.bars)

  it('makes a section with @ending a 2x repeat and brackets each ending', () => {
    // common bars 1-2, 1st ending bar 3, 2nd ending bar 4
    const text = [
      'key: C',
      'A | 1 | Dm7', 'A | 2 | G7', 'A | 3 | CMaj7', 'A | 4 | Am7',
      '@ending 1 A 3 3', '@ending 2 A 4 4',
    ].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.repeatStart).toBe(true)                               // repeat opens at bar 1
    expect(b[2]?.repeatEnd).toBe(2)                                    // :| after the 1st ending (bar 3)
    expect(b[3]?.repeatEnd).toBe(0)                                    // not after the 2nd ending
    expect(b.map((x) => x.volta)).toEqual([
      null, null, { n: 1, start: true, end: true }, { n: 2, start: true, end: true },
    ])
  })

  it('maps @segno, @coda and @nav onto their bars; two @nav join', () => {
    const text = [
      'key: C',
      'A | 1 | Dm7', 'A | 2 | G7',
      'Coda | 1 | CMaj7',
      '@segno A 1', '@coda Coda 1', '@nav A 2 To Coda', '@nav A 2 D.S. al Coda',
    ].join('\n') + '\n'
    const b = barsOf(text)
    expect(b[0]?.segno).toBe(true)
    expect(b[1]?.nav).toBe('To Coda · D.S. al Coda')
    expect(b.find((x) => x.marker.startsWith('Coda'))?.coda).toBe(true)
  })

  it('ignores a directive whose section or bar is absent, without throwing', () => {
    const text = 'key: C\nA | 1 | Dm7\n@segno ZZ 9\n@nav A 99 x\n@ending 1 ZZ 1\n'
    const b = barsOf(text)
    expect(b.every((x) => !x.segno && x.nav === '' && x.volta === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run --project engine engine/__tests__/changes.test.ts -t "endings and navigation"`
Expected: FAIL — `volta`/`segno`/`coda`/`nav` are not on `ChangesBar` (type error / undefined).

- [ ] **Step 3: Extend the `ChangesBar` type**

In `web/engine/changes.ts`, add to the `ChangesBar` type (keep all existing fields):

```ts
  /** a 1st/2nd-ending bracket on this bar; null for none. start/end mark the bracket's first/last bar */
  volta: { n: number; start: boolean; end: boolean } | null
  /** a segno glyph above this bar */
  segno: boolean
  /** a coda glyph above this bar (the "To Coda" departure and the Coda arrival both use it) */
  coda: boolean
  /** a navigation instruction above this bar ("D.S. al Coda"); '' = none; several joined with " · " */
  nav: string
```

- [ ] **Step 4: Collect the directives in `buildChanges`**

Near the top of `buildChanges`, after `const rows = expandRowLines(doc).value` and the `barOf` helper are available, add directive lookups keyed by `"section|bar"` (a plain string key — directives reference the written bar number, which is the row's `bar`, so resolve a directive's bar to a layout bar via the same rows/`barOf` path the chords use):

```ts
  // directives read straight from doc.lines (like the @copy detection), keyed by section+written-bar
  const key = (section: string, bar: number | string) => `${section}|${bar}`
  const rowIndexAt = new Map<string, number>() // first expanded-row index for a (section, written bar)
  rows.forEach((r, i) => { const k = key(r.section, r.bar); if (!rowIndexAt.has(k)) rowIndexAt.set(k, i) })
  const layoutBar = (section: string, bar: number): number | undefined => {
    const i = rowIndexAt.get(key(section, bar))
    return i === undefined ? undefined : barOf(i)
  }
  const endings = doc.lines.filter((l): l is Extract<ChartLine, { kind: 'ending' }> => l.kind === 'ending')
  const segnoBars = new Set<number>()
  const codaBars = new Set<number>()
  const navAt = new Map<number, string[]>()
  for (const l of doc.lines) {
    if (l.kind === 'mark') { const bar = layoutBar(l.section, l.bar); if (bar !== undefined) (l.mark === 'segno' ? segnoBars : codaBars).add(bar) }
    if (l.kind === 'nav') { const bar = layoutBar(l.section, l.bar); if (bar !== undefined) navAt.set(bar, [...(navAt.get(bar) ?? []), l.text]) }
  }
```

(`ChartLine` is already imported via `./chart`; add it to that import if not: `import { type ChartLine, … } from './chart'`.)

- [ ] **Step 5: Make an ending-bearing section a 2× repeat, and compute per-bar voltas**

Build a per-layout-bar volta map, and a set of sections that have endings (to force the repeat and skip `@copy` folding):

```ts
  const sectionsWithEndings = new Set(endings.map((e) => e.section))
  const voltaAt = new Map<number, { n: number; start: boolean; end: boolean }>()
  const repeatEndBars = new Set<number>()   // last layout bar of each section's 1st ending
  for (const e of endings) {
    for (let w = e.from; w <= e.to; w++) {
      const bar = layoutBar(e.section, w)
      if (bar !== undefined) voltaAt.set(bar, { n: e.n, start: w === e.from, end: w === e.to })
    }
    if (e.n === 1) { const last = layoutBar(e.section, e.to); if (last !== undefined) repeatEndBars.add(last) }
  }
```

In the run/block construction, a run whose `section` is in `sectionsWithEndings` must **not** be folded as a `@copy` repeat (it has none) and must render as a 2× repeat. In the block-folding loop, guard the fold so it never folds into or past such a section, and when emitting that block set its `times = 2`. Concretely: where the block's `times`/`repeatStart`/`repeatEnd` are decided, for a block whose section is in `sectionsWithEndings`, set `repeatStart` on its first bar and set `repeatEnd` only on the bar in `repeatEndBars` (not the block's last bar).

In the final `ChangesBar` object construction (the `return { chords, marker, keyArea, repeatStart, repeatEnd, end }` at ~124-131), compute the new fields and override repeatStart/repeatEnd for ending sections:

```ts
      const hasEndings = sectionsWithEndings.has(block.section)
      return {
        chords,
        marker: j === 0 ? block.marker : '',
        keyArea,
        repeatStart: hasEndings ? j === 0 : j === 0 && block.times > 1,
        repeatEnd: hasEndings ? (repeatEndBars.has(bar) ? 2 : 0) : last && block.times > 1 ? block.times : 0,
        end: !last ? 'none' : k === blocks.length - 1 ? 'final' : k === lastForm || block.part === 'before' ? 'double' : 'none',
        volta: voltaAt.get(bar) ?? null,
        segno: segnoBars.has(bar),
        coda: codaBars.has(bar),
        nav: (navAt.get(bar) ?? []).join(' · '),
      }
```

Also make sure the block-folding loop at ~87-99 does not merge an ending section into a prior block: add `&& !sectionsWithEndings.has(run.section) && !sectionsWithEndings.has(prev.section)` to the `if (run.copyOf && prev && …)` fold condition. (An ending section is authored once, not via `@copy`, so this is a safety guard.)

- [ ] **Step 6: Run the engine tests to verify they pass**

Run: `cd web && npx vitest run --project engine engine/__tests__/changes.test.ts -t "endings and navigation"`
Expected: PASS (3 tests). Then run the whole changes file to catch regressions in the existing markers/repeats tests:
Run: `cd web && npx vitest run --project engine engine/__tests__/changes.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Typecheck and commit**

Run: `cd web && npm run typecheck`
Expected: PASS.

```bash
git add web/engine/changes.ts web/engine/__tests__/changes.test.ts
git commit -m "Changes: volta/segno/coda/nav fields from directives"
```

---

### Task 3: Draw volta brackets (`changesDrawing.ts`)

**Files:**
- Modify: `web/app/utils/changesDrawing.ts` (the per-bar stave loop ~28-47; the `BAND` constant ~11)
- Test: verified via Task 5's e2e (drawing has no unit test here; this task's gate is typecheck + a manual dev check)

**Interfaces:**
- Consumes: `ChangesLine`/`ChangesBar.volta` from Task 2; `VexFlowModule = typeof import('vexflow/bravura')` (`web/app/utils/vexflow.ts`), which exposes `vf.Stave`, `vf.BarlineType`, `vf.Volta`.
- Produces: no new exported symbols; `drawChangesLine` now also draws voltas.

- [ ] **Step 1: Draw the volta per bar**

In `web/app/utils/changesDrawing.ts`, inside `line.bars.forEach`, after the barline block (after line ~35, before `stave.setContext(ctx).draw()`), add:

```ts
    if (bar.volta) {
      const t = bar.volta.start && bar.volta.end ? vf.Volta.type.BEGIN_END
        : bar.volta.start ? vf.Volta.type.BEGIN
        : bar.volta.end ? vf.Volta.type.END
        : vf.Volta.type.MID
      stave.setVoltaType(t, bar.volta.start ? `${bar.volta.n}.` : '', VOLTA_Y)
    }
```

`setVoltaType(type, label, y)` is a `Stave` method in VexFlow 5; `Volta.type` is `{ NONE, BEGIN, MID, END, BEGIN_END }`. If TypeScript cannot find `Volta.type` on the bravura module, import the enum alongside the type usage already there and reference it; do not fall back to magic numbers in a way that loses the names — look up the exact export in `node_modules/vexflow/…` and use it.

- [ ] **Step 2: Reserve height for the volta bracket**

The volta draws above the staff. Add the constant near the other layout constants (~9-11) and raise the drawn band's top so the bracket isn't clipped:

```ts
const VOLTA_Y = 20 // the volta bracket sits here, above the staff (lines at 80-120)
```

Change `BAND` so its `top` includes the volta band:

```ts
const BAND = { top: 20, bottom: 126 } // volta bracket at 20, then the staff (lines at 80-120)
```

(Only widen `top`; leave `bottom`. `fitSvg` uses `BAND` to size the SVG viewBox — see `web/app/utils/vexflow.ts:59`.)

- [ ] **Step 3: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual dev check (volta renders)**

Run `make dev`, open `/editor?chart=autumn_leaves`, switch to the Changes sheet, and confirm existing charts still draw (no volta yet on them). Then temporarily add `@ending 1 A1 8` / `@ending 2 A1 8` is not needed — the real check is Task 5. Confirm no console errors and the staff still renders. (No automated assertion here; Task 5's e2e is the gate.)

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/changesDrawing.ts
git commit -m "Changes: draw 1st/2nd-ending volta brackets"
```

---

### Task 4: Segno/coda glyphs and nav text in the overlay (`ChangesSystem.vue`)

**Files:**
- Modify: `web/app/components/ChangesSystem.vue` (the top overlay `<div class="relative h-12 …">` ~4-15; the `marks` computed ~50-58)
- Create: `web/app/components/ChangesMarks.vue` (a tiny presentational component holding the inline-SVG segno/coda glyphs and nav label)
- Test: verified via Task 5's e2e; this task's gate is typecheck + lint + dev check

**Interfaces:**
- Consumes: `ChangesBar.segno`/`coda`/`nav` from Task 2; the existing `marks`/`xs` layout in `ChangesSystem.vue`.
- Produces: `ChangesMarks.vue` taking props `{ segno: boolean; coda: boolean; nav: string }`.

- [ ] **Step 1: Create the glyph/label component**

Create `web/app/components/ChangesMarks.vue`. Inline SVG keeps it CSP-safe (no font/origin). Minimal, legible segno and coda marks:

```vue
<template>
  <span class="inline-flex items-center gap-1 align-middle text-zinc-700 dark:text-zinc-300 print:text-black">
    <svg v-if="segno" viewBox="0 0 16 16" class="h-4 w-4" aria-label="Segno" role="img">
      <path d="M11 3c-3 0-4 2-4 3.5C7 8 8.5 9 10 10s3 2 3 3.5C13 15 11.5 16 10 16" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="4" y1="2" x2="12" y2="14" stroke="currentColor" stroke-width="1.4" />
      <circle cx="4.5" cy="4" r="1" fill="currentColor" />
      <circle cx="11.5" cy="12" r="1" fill="currentColor" />
    </svg>
    <svg v-if="coda" viewBox="0 0 16 16" class="h-4 w-4" aria-label="Coda" role="img">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1.4" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <span v-if="nav" class="text-xs font-semibold italic whitespace-nowrap">{{ nav }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ segno: boolean; coda: boolean; nav: string }>()
</script>
```

- [ ] **Step 2: Carry the marks through `ChangesSystem.vue`'s layout**

In the `marks` computed (~50-58), include the bar-level marks on the bar's first mark object. Change the per-bar mapping so each bar contributes its `segno`/`coda`/`nav` on the first chord (or the marker-only fallback). Update the two mapping branches:

```ts
    const chords = bar.chords.map((c, k) => ({ key: `${b}-${k}`, x: at(c.beat), tokens: c.tokens, text: c.text, numeral: c.numeral, scale: c.scale, marker: k === 0 ? bar.marker : '', keyArea: k === 0 ? bar.keyArea : '', segno: k === 0 && bar.segno, coda: k === 0 && bar.coda, nav: k === 0 ? bar.nav : '' }))
    if (!chords.length && (bar.marker || bar.keyArea || bar.segno || bar.coda || bar.nav)) return [{ key: `${b}-m`, x: at(0), tokens: null, text: '', numeral: '', scale: null, marker: bar.marker, keyArea: bar.keyArea, segno: bar.segno, coda: bar.coda, nav: bar.nav }]
    return chords
```

- [ ] **Step 3: Render the marks above the chord row**

In the top overlay block, add `<ChangesMarks>` above the marker/keyArea line, inside the existing per-`m` `<div>` (after line ~6's opening `<div>`, before the `marker || keyArea` div):

```vue
        <div class="absolute bottom-0 whitespace-nowrap" :style="{ left: `${m.x * 100}%` }">
          <ChangesMarks v-if="m.segno || m.coda || m.nav" :segno="m.segno" :coda="m.coda" :nav="m.nav" />
          <div v-if="m.marker || m.keyArea" class="flex items-baseline gap-2 text-[0.65rem] print:text-[0.55rem]/3">
```

(Nuxt auto-imports components, so no explicit import is needed. Confirm by typecheck/build.)

- [ ] **Step 4: Typecheck, lint, dev check**

Run: `cd web && npm run typecheck && npm run lint`
Expected: PASS.
Dev check (`make dev`): existing charts render unchanged (no segno/coda/nav on them yet). Task 5 proves the glyphs on a converted chart.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/ChangesSystem.vue web/app/components/ChangesMarks.vue
git commit -m "Changes: segno/coda glyphs and nav text in the overlay"
```

---

### Task 5: Convert Stardust and It's You or No One; e2e, golden, docs

**Files:**
- Modify: `charts/stardust.txt` (add `@ending` to the intro already present)
- Modify: `charts/its_you_or_no_one.txt` (add `@segno`/`@coda`/`@nav`)
- Modify: `web/e2e/print.spec.ts` (the "Changes eight lines a page" loop ~43-56)
- Modify: `README.md` (chart-format table), `docs/design.md` (§4 chart model), `docs/plan-changes.md` (§3), `docs/roadmap.md`
- Regenerate: `fixtures/golden.json`, `fixtures/analysis.json`

**Interfaces:**
- Consumes: directives (Task 1), engine fields (Task 2), drawing (Tasks 3-4).
- Produces: two converted library charts; a new e2e case that gates the volta/segno/coda/nav render and the print budget.

- [ ] **Step 1: Add the endings to Stardust's intro**

Stardust's intro is already bars 1-10 (common 1-6, then the two endings as 7-8 and 9-10). Append the directives after the intro rows (and before/after any comment is fine — directives are order-independent). Use the Edit tool to add two lines in the `# section | bar | chord | scale` block of `charts/stardust.txt`:

```
@ending 1 Intro 7 8
@ending 2 Intro 9 10
```

- [ ] **Step 2: Add the D.S. al Coda navigation to It's You or No One**

The chart has a `Coda` section and form sections A-D. From the lead sheet: segno at A bar 1, "To Coda ⊕" at the end of D, the coda after the form. Open `charts/its_you_or_no_one.txt`, find the last bar number of section D and the first bar of `Coda`, and add (adjust the D bar number to the section's actual last bar):

```
@segno A 1
@coda D <last D bar>
@nav D <last D bar> To Coda
@nav D <last D bar> D.S. al Coda
@coda Coda 1
```

Read the chart first to get D's last bar number; do not guess it.

- [ ] **Step 3: Re-analyse the two charts and regenerate golden**

The directives don't add rows, but regenerate to keep fixtures honest and confirm nothing in the analysed rows shifted:

Run: `cd web && npm run analyse -- ../charts/stardust.txt ../charts/its_you_or_no_one.txt --write --save --quiet`
Then: `make golden`
Then confirm additive-only (no existing row's scale changed):

```bash
cd /Users/kevdog/Documents/code/jazz-scales && git show HEAD:fixtures/golden.json > /tmp/g.json && python3 - <<'PY'
import json
old=json.load(open('/tmp/g.json'))['charts']; new=json.load(open('fixtures/golden.json'))['charts']
bad=[(k,[r for r in old.get(k,{}).get('rows',[]) if r not in new[k]['rows']]) for k in new if [r for r in old.get(k,{}).get('rows',[]) if r not in new[k]['rows']]]
print('removed/changed rows:', bad or 'NONE')
PY
```
Expected: `NONE` (directives are not rows; only the chart `text` field changes).

- [ ] **Step 4: Write the failing e2e for endings + a coda jump**

In `web/e2e/print.spec.ts`, add `stardust` and `its_you_or_no_one` to the "Changes eight lines a page" loop with their expected page counts, and add an assertion that the new marks render. First extend the data loop (pick the page counts by running the sheet once in dev; Stardust's chorus+verse and It's You's form+coda each fit on one page — verify and set accordingly):

```ts
for (const [chart, pages] of [
  ['autumn_leaves', 1],
  ['satin_doll', 1],
  ['a_night_in_tunisia', 2],
  ['stardust', 1],
  ['its_you_or_no_one', 1],
] as const) {
```

Then add a dedicated test after the loop asserting the marks exist on screen (the nav text and the volta label are in the DOM/SVG):

```ts
test('the Changes sheet shows endings and a D.S. al Coda', async ({ page }) => {
  await page.goto('/editor?chart=its_you_or_no_one')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.getByText('D.S. al Coda')).toBeVisible()
  await expect(page.getByLabel('Coda').first()).toBeVisible()
  await page.goto('/editor?chart=stardust')
  await page.getByRole('group', { name: 'Sheet' }).getByText('Changes', { exact: true }).click()
  await expect(page.locator('svg[aria-label^="Bars:"]').first()).toBeVisible()
  await expect(page.locator('text=1.').first()).toBeVisible() // the 1st-ending volta label
})
```

Run: `cd web && npx playwright test e2e/print.spec.ts -g "endings and a D.S"`
Expected: FAIL first if charts/drawing not wired; once Tasks 1-4 and Steps 1-2 are in, it should pass. If the volta label selector (`text=1.`) is brittle against VexFlow's SVG text, assert on the nav text and the `aria-label="Coda"` glyph only, and rely on the page-count budget test for the volta.

- [ ] **Step 5: Run the full print e2e**

Run: `cd web && npx playwright test e2e/print.spec.ts`
Expected: PASS, including the two new page-count cases (budget holds with the volta height) and the marks test. If a page count is 2 not 1, set it to the real value and note why (the chart genuinely needs two pages).

- [ ] **Step 6: Update the docs**

- `README.md` — in the chart-format table, add rows for the four directives, mirroring the `@copy` row's style:
  - `@ending N SECTION FIRST [LAST]` — a 1st/2nd ending (volta) over those bars; the section is played twice (repeat signs with the two endings).
  - `@segno SECTION BAR` / `@coda SECTION BAR` — a segno 𝄋 / coda ⊕ above that bar.
  - `@nav SECTION BAR TEXT` — a printed instruction ("D.S. al Coda", "To Coda", "Fine") above that bar.
- `docs/design.md` §4 — add the three new `ChartLine` kinds to the `ChartLine` union listing and a line on how the Changes sheet renders them.
- `docs/plan-changes.md` §3 — replace "1st and 2nd endings, and D.C./segno navigation, come later." with a done note pointing at this spec.
- `docs/roadmap.md` — move "Next for the Changes sheet" to Done (the sheet is feature-complete), referencing the spec.

- [ ] **Step 7: Full suite and commit**

Run: `cd /Users/kevdog/Documents/code/jazz-scales && make test && make lint && make e2e`
Expected: all PASS.

```bash
cd /Users/kevdog/Documents/code/jazz-scales
git add charts/stardust.txt charts/its_you_or_no_one.txt fixtures/golden.json fixtures/analysis.json web/e2e/print.spec.ts README.md docs/design.md docs/plan-changes.md docs/roadmap.md
git commit -m "Changes: convert Stardust and It's You or No One; e2e, docs, roadmap"
```

---

## Final verification (whole branch)

- [ ] `make test` (typecheck + 310-ish vitest) — PASS
- [ ] `make lint` — clean
- [ ] `make e2e` — PASS (print budget holds with voltas; marks render)
- [ ] `make golden` diff is additive-only (no existing analysed row changed)
- [ ] Visual spot-check in `make dev`: Stardust's intro shows `|1.| :‖ |2.|`; It's You or No One shows 𝄋 at A, ⊕ at the To-Coda bar and the Coda, and "D.S. al Coda" text.

Then finish via superpowers:finishing-a-development-branch (PR, merge only on green per the repo's merge discipline).
