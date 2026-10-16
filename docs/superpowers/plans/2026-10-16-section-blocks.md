# Section Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chart format's per-row `section` cell and absolute bars with `section:` blocks (section-relative
bars, section-level `key:`/`time:`/`context:`/`bars:`/`outside:`/`copy:`), migrate the 379 library charts and users'
saved charts, and drop the old format (issue #329).

**Architecture:** `ChartDoc` stays a flat list of lines (text round-trips), with new `section` and `sectionMeta` line
kinds; rows and directives lose their section argument. One pure function, `sectionLayout(doc)`
(`engine/src/layout.ts`), resolves blocks into sections (rows with section filled in, length, part, key, context,
copy source) and a flat directive list carrying section names, so most consumers swap `doc.lines` scans for the
layout and keep their `(section, bar)` logic. A pure `migrateChart(text)` (`engine/src/migrate.ts`) converts old text
with its own reader, replaying the old timing and `@key` rules so the golden fixture proves nothing but bar numbering
changed.

**Tech Stack:** TypeScript (strict), Vitest, Nuxt 3/Vue 3 app, Playwright e2e, npm workspaces (`engine/`, `web/`).

**Spec:** `docs/superpowers/specs/2026-10-16-section-blocks-design.md` (read it first; this plan argues from it).

## Global Constraints

- TypeScript strict; pure functions, immutable data (`Readonly<…>`, new arrays, never mutate a `ChartDoc`).
- `engine/` has no Vue/DOM/VexFlow imports; view logic that can be pure goes in the engine.
- Section names: non-empty, no whitespace, at most `LIMITS.maxCell` (40) characters.
- Section fields and canonical order: `key`, `time`, `context`, `bars`, `outside`, `copy`.
- `time:` values: `2/4`, `3/4`, `4/4` only. A section metre that differs from the song's gets the diagnostic
  `time: drawn in the song's metre until #235` and plays in the song's metre.
- `outside:` values: `yes` or `no`.
- `bars:` in a section = section length (whole number ≥ the last written bar); header `bars:` keeps its analyser-hint
  meaning.
- Labels are section-relative everywhere: `A2, bar 1`; chord-pick lists `A1 bar 6, A2 bar 6`.
- Area comments: `# area: F major (A 1–5)`, single bar `(A 3)`, across sections `(A 11 – B 5)`.
- Share payload `VERSION = 2`; v1 decodes to `null`.
- Stage files by name (never `git add -A`). Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verification gates before the PR: `make test`, `make lint`, `make e2e`, `make a11y`.
- Run one engine test file: `cd engine && npx vitest run src/__tests__/<file>.test.ts`. One web test:
  `cd web && npx vitest run test/<file>.test.ts`. One e2e spec on the last build: `cd web && npx playwright test
  --project=chromium <spec-substring>`.

## Review Focus

1. **A user's saved chart in the old format opens** (My charts, the draft, a `.txt` opened from disk): it must open
   migrated, play the same, and be saved back — not show a wall of invalid lines. Test: Task 8 (EditorView opening).
2. **Old text pasted or typed into Source** gets one clear diagnostic per old row naming the change ("old chart format:
   put rows under a section: line, numbered from 1"), not a generic parse error. Test: Task 3.
3. **A Scale-level migration (`unlevel`) and the format migration on the same opening**: `owned` keys are line indices,
   which move; the rows must still be found. Test: Task 2 (`lineMap`) and Task 8 (`remapOwned`).
4. **Bar edits at a section's end** (append a held bar, delete the last written bar, empty the last bar's chords) must
   keep the section's length via `bars:` rather than silently shortening the form. Test: Task 7.
5. **A `copy:` of a section that has in-block `@key` lines** (and a copy of a copy) must carry the key plan, and the
   copy's own `key:` must replace it. Test: Task 4.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `engine/src/migrate.ts` (new) | `migrateChart(text): Migration`: old text → new text, line map, prose list, problems. Own reader for old lines. |
| `engine/src/chart.ts` | Line kinds, tolerant parser with block state, serializer, `lineSections`, `expandRowLines` (view over layout). |
| `engine/src/layout.ts` (new) | `sectionLayout(doc)`, `statedKeyAt`, the `Layout`/`LayoutSection`/`Directive` types. |
| `engine/src/guideToneTimeline.ts` | Timing per section with lengths; `finalBars` heuristic removed. |
| `engine/src/bars.ts` | `barView` from the layout; `implied` kind removed. |
| `engine/src/changes.ts` | Copy detection, endings/marks/nav from the layout; timeline with lengths. |
| `engine/src/analysis/{index,stream,ambiguity}.ts` | Stream timing by `at`; stated keys from the layout; area labels. |
| `engine/src/{notes,completions,transpose,chordPicks}.ts` | Small consumer updates. |
| `engine/src/edit.ts` | Bar/section operations on blocks; `bars:` upkeep. |
| `engine/src/levels.ts` | `remapOwned` for the opening migration. |
| `engine/src/share.ts` | `VERSION = 2`. |
| `engine/scripts/migrate-charts.ts` (new) | Rewrites `engine/charts/*.txt`; prints prose comments. |
| `engine/scripts/compare-golden.ts` (new) | Old vs new golden: equal modulo bar numbering. |
| `web/app/components/EditorView.vue` | Migrate on open, remap `owned`, save back. |
| `web/app/utils/chordPicks.ts` | Wording for section-relative bar lists. |
| `README.md`, `docs/design.md`, `CLAUDE.md` | Format docs. |

---

### Task 1: Golden fixture records timing, keys and areas (old engine)

The fixture freezes rows and played scales, not timing; once the old engine is gone nothing would show a timing
change. Record it now, on the old engine, so Task 9 can compare.

**Files:**
- Modify: `engine/src/__tests__/goldenFixture.ts` (type `Golden.charts`, `buildGolden`)
- Regenerate: `engine/fixtures/golden.json`

**Interfaces:**
- Produces: each `golden.json` chart entry gains `timing: [start, beats, keyName, keyStated][]` (one per expanded row,
  aligned with `rows`) and `areas: [keyName, section, from, to, stated][]`. Task 9's compare script reads these.

- [ ] **Step 1: Add the fields**

In `goldenFixture.ts`, import `analyse` from `'../analysis'`, `guideToneTimeline` from `'../guideToneTimeline'` and
`chartBeats`, `expandRows` from `'../chart'` (or via `'..'` if exported there). Change the chart type and builder:

```ts
  charts: Record<string, { text: string; title: string; subtitle: string; key: string; rows: (string | null)[][]; timing: (number | string | boolean)[][]; areas: (string | boolean)[][] }> // a null scale: unresolved
```

```ts
/** each expanded row's start and length in beats, and the key it is analysed in (stated or found) */
export function chartTiming(doc: ChartDoc): Readonly<{ timing: (number | string | boolean)[][]; areas: (string | boolean)[][] }> {
  const rows = expandRows(doc).value
  const { events } = guideToneTimeline(rows, chartBeats(doc))
  const eventOf = new Map(events.map((e) => [e.row, e]))
  const a = analyse(doc)
  const byRow = new Map(a.rows.map((r) => [r.row, r]))
  // the area a row is in: the last one starting at or before it (areas start on a row: `row`)
  const areaOf = (i: number) => a.areas.filter((ar) => ar.row <= i).at(-1)
  const timing = rows.map((r, i) => {
    const e = eventOf.get(r)
    return [e?.start ?? -1, e?.beats ?? 0, byRow.get(i)?.key.name ?? '', areaOf(i)?.stated ?? false]
  })
  const areas = a.areas.map((x) => [x.key.name, x.section, x.from, x.to, x.stated])
  return { timing, areas }
}
```

and in `buildGolden`:

```ts
      return [name, { text, title: meta.title, subtitle: meta.subtitle, key: meta.key, rows: playedRows(doc), ...chartTiming(doc) }]
```

(`RowAnalysis.stated` means "function stated", not "key stated", hence the area lookup. If `Area.row` turns out to be a
stream index rather than a row index, map it through `a.rows` first — check where areas are pushed in
`engine/src/analysis/index.ts`, ~line 237.)

- [ ] **Step 2: Regenerate and check only the new fields changed**

Run: `make golden && git diff --stat engine/fixtures/` then
`git diff engine/fixtures/golden.json | grep '^[-+]' | grep -v '"timing"\|"areas"\|^\(---\|+++\)' | head`
Expected: the diff only adds `timing`/`areas` arrays; the grep prints nothing beyond JSON punctuation lines of those
arrays. `make test` passes.

- [ ] **Step 3: Commit**

```bash
git add engine/src/__tests__/goldenFixture.ts engine/fixtures/golden.json
git commit -m "Golden: record each chart's timing, keys and areas (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `migrateChart` (old text → section blocks)

Runs against the old engine (still present), so its library test can compare old-engine facts. It has its own reader
for old lines; it must not import the old parser's row/directive kinds (they disappear in Task 3).

**Files:**
- Create: `engine/src/migrate.ts`
- Test: `engine/src/__tests__/migrate.test.ts`
- Modify: `engine/src/index.ts` (export `migrateChart`, `type Migration`), `engine/src/__tests__/__snapshots__/api.test.ts.snap` (update with `npx vitest run src/__tests__/api.test.ts -u`)

**Interfaces:**
- Consumes: `formPart(section: string): FormPart` and `META_KEYS` from `./chart` (both survive Task 3 unchanged).
- Produces:
  ```ts
  export type Migration = Readonly<{ text: string; lineMap: readonly number[]; prose: readonly string[]; problems: readonly string[] }>
  export function migrateChart(text: string): Migration
  ```
  `lineMap[oldIndex]` = index in the new text (lines split on `\n`), `-1` for a dropped line. Text is not
  column-aligned (Task 9 runs it through `serializeChart(parseChart(…))`, which keeps line positions).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { migrateChart } from '../migrate'

const lines = (t: string): string[] => t.trimEnd().split('\n')

describe('migrateChart', () => {
  it('leaves a chart that already has section blocks, or has no rows, as it is', () => {
    const blocks = 'title: T\n\nsection: A\n1 | C\n'
    expect(migrateChart(blocks)).toEqual({ text: blocks, lineMap: [0, 1, 2, 3], prose: [], problems: [] })
    expect(migrateChart('title: T\n').text).toBe('title: T\n')
  })

  it('groups rows into blocks with bars from 1', () => {
    const m = migrateChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nB | 3 | CMaj7\nB | 4 | A7\n')
    expect(lines(m.text)).toEqual(['title: T', 'key: C', '', 'section: A', '1 | Dm7', '2 | G7', '', 'section: B', '1 | CMaj7', '2 | A7'])
    expect(m.lineMap).toEqual([0, 1, 4, 5, 8, 9])
  })

  it('writes bars: where the last chord is held into the next section', () => {
    const m = migrateChart('A | 1 | Dm7\nA | 3 | G7\nB | 5 | C\nB | 6 | C\nB | 7 | C\nB | 8 | C\n')
    expect(lines(m.text)).toEqual(['section: A', 'bars: 4', '1 | Dm7', '3 | G7', '', 'section: B', '1 | C', '2 | C', '3 | C', '4 | C'])
  })

  it("gives the form's last section the old engine's length (rounded up to a 4-bar phrase)", () => {
    const m = migrateChart('A | 1 | C\nA | 2 | F\nA | 3 | G7\n')
    expect(lines(m.text)).toContain('bars: 4')
  })

  it('turns @copy into copy:, with bars: on the copy only when its length differs', () => {
    const m = migrateChart('A1 | 1 | C\nA1 | 8 | G7\n@copy A1 A2 8\nB | 17 | F\nB | 24 | G7\n')
    const t = lines(m.text)
    expect(t).toContain('section: A2')
    expect(t[t.indexOf('section: A2') + 1]).toBe('copy: A1')
    expect(t.filter((l) => l.startsWith('bars:'))).toEqual([]) // A1 and A2 are 8 bars, B rounds up to 8
    expect(m.lineMap[2]).toBe(-1)
  })

  it('moves directives into their block with relative bars', () => {
    const m = migrateChart('A | 1 | C\nA | 2 | G7\nB | 3 | F\nB | 4 | C\n@ending 1 B 3\n@segno A 1\n@coda B 4\n@nav B 4 D.S. al Coda\n')
    const t = lines(m.text)
    const b = t.indexOf('section: B')
    expect(t.slice(b)).toEqual(expect.arrayContaining(['@ending 1 1', '@coda 2', '@nav 2 D.S. al Coda']))
    expect(t.slice(t.indexOf('section: A'), b)).toContain('@segno 1')
  })

  it('replays @key: holds through later sections (key: on each), a mid-section change is an in-block @key', () => {
    const m = migrateChart('key: F\nA | 1 | F\nA | 2 | C7\nB | 3 | Gm7\n@key B 4 Db\nB | 4 | Ab7\nC | 5 | Db\nC | 6 | Db\n')
    const t = lines(m.text)
    const a = t.indexOf('section: A'), b = t.indexOf('section: B'), c = t.indexOf('section: C')
    expect(t.slice(a, b).some((l) => l.startsWith('key:'))).toBe(false) // before the first @key: found
    expect(t.slice(b, c)).toContain('@key 2 Db')
    expect(t.slice(c)).toContain('key: Db') // the old @key held on
  })

  it('makes an @key on a section start its key:', () => {
    const t = lines(migrateChart('A | 1 | C\nA | 2 | C\n@key B 3 Eb\nB | 3 | Eb\nB | 4 | Eb\n').text)
    expect(t[t.indexOf('section: B') + 1]).toBe('key: Eb')
  })

  it('gives a copy its own key: where the old key ran on through it (replacing the source’s @key lines)', () => {
    const t = lines(migrateChart('A1 | 1 | C\n@key A1 2 Eb\nA1 | 2 | Eb\n@copy A1 A2 2\n').text)
    const a2 = t.indexOf('section: A2')
    expect(t.slice(a2, a2 + 3)).toEqual(['section: A2', 'key: Eb', 'copy: A1'])
  })

  it('writes a repeat out as rows when it had an @key of its own (a copy: block takes none)', () => {
    const t = lines(migrateChart('A1 | 1 | C\nA1 | 2 | D\n@copy A1 A2 2\n@key A2 4 Eb\n').text)
    const a2 = t.indexOf('section: A2')
    expect(t.slice(a2)).toEqual(['section: A2', '1 | C', '2 | D', '@key 2 Eb'])
  })

  it('keeps header comments in the header; an # alt: line follows its bar, relative', () => {
    const m = migrateChart('title: T\n# analysis: x\n\n# section | bar | chord\nA | 1 | C\nA | 2 | G7\n# alt: bar 2 (Dm7)\nB | 3 | C\nB | 4 | C\n')
    const t = lines(m.text)
    expect(t.slice(0, t.indexOf('section: A'))).toEqual(['title: T', '# analysis: x', '', '# bar | chord', ''])
    expect(t.slice(t.indexOf('section: A'), t.indexOf('section: B'))).toContain('# alt: bar 2 (Dm7)')
  })

  it('rewrites an # alt: bar in a later section to its relative number', () => {
    const t = lines(migrateChart('A | 1 | C\nA | 2 | C\nB | 3 | F\n# alt: bars 3–4 (F7)\nB | 4 | F\n').text)
    expect(t).toContain('# alt: bars 1–2 (F7)')
  })

  it('lists prose comments that name a bar, and leaves them', () => {
    const m = migrateChart('A | 1 | C\n# the coda after bar 27\nA | 2 | C\n')
    expect(m.prose).toEqual(['line 2: # the coda after bar 27'])
    expect(m.text).toContain('# the coda after bar 27')
  })

  it('reports what it cannot carry: a section that comes back, a directive on a missing section', () => {
    expect(migrateChart('A | 1 | C\nB | 2 | F\nA | 3 | C\n').problems).toContain('section A appears again after another section (line 3)')
    expect(migrateChart('A | 1 | C\n@segno Z 1\n').problems).toContain('@segno names no section Z (line 2)')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/migrate.test.ts`
Expected: FAIL (`Cannot find module '../migrate'`).

- [ ] **Step 3: Implement `engine/src/migrate.ts`**

```ts
import { formPart, META_KEYS } from './chart'

/**
 * The one-way migration from the retired row format (`SECTION | BAR | CHORD …` with absolute bars, `@copy SRC DST
 * OFFSET`, directives naming a section) to section blocks (docs/design.md §4, issue #329). Text in, text out; it reads
 * the old lines itself. Lengths, keys and contexts come out as the old engine played them: a section started at its
 * first row, ran to the next section's first row (the last of a part to the old engine's rounded end), and an @key
 * held, in play order, until the next.
 */
export type Migration = Readonly<{
  text: string
  /** each old line's index in the new text; -1 for a line folded away (a body blank, @copy, an @key that became key:) */
  lineMap: readonly number[]
  /** comment lines that name a bar in prose, left as written, for a person to fix ("line 12: # …") */
  prose: readonly string[]
  /** what it couldn't carry over exactly */
  problems: readonly string[]
}>

const INT = /^[+-]?\d{1,6}$/
type Item =
  | { t: 'row'; section: string; bar: number; cells: string[]; comment?: string; line: number }
  | { t: 'copy'; src: string; dst: string; offset: number; line: number }
  | { t: 'key' | 'context'; section: string; bar: number; value: string; line: number }
  | { t: 'ending'; section: string; n: string; from: number; to: number; line: number }
  | { t: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number; line: number }
  | { t: 'nav'; section: string; bar: number; text: string; line: number }
  | { t: 'comment' | 'other'; text: string; line: number }
  | { t: 'meta' | 'blank'; text: string; line: number }

function read(text: string, line: number): Item {
  const t = text.trim()
  if (!t) return { t: 'blank', text: t, line }
  if (t.startsWith('#')) return { t: 'comment', text: t, line }
  const low = t.toLowerCase()
  if (META_KEYS.some((k) => low.startsWith(`${k}:`))) return { t: 'meta', text: t, line }
  const words = t.split(/\s+/)
  if (low.startsWith('@copy') && words.length === 4 && INT.test(words[3] ?? ''))
    return { t: 'copy', src: words[1] ?? '', dst: words[2] ?? '', offset: Number(words[3]), line }
  const kc = /^@(key|context)\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(t)
  if (kc && INT.test(kc[3] ?? '')) return { t: kc[1]?.toLowerCase() === 'key' ? 'key' : 'context', section: kc[2] ?? '', bar: Number(kc[3]), value: (kc[4] ?? '').trim(), line }
  if (low.startsWith('@ending')) {
    const [, n = '', section = '', from = '', to = from] = words
    if (INT.test(from) && INT.test(to)) return { t: 'ending', section, n, from: Number(from), to: Number(to), line }
  }
  if ((low.startsWith('@segno') || low.startsWith('@coda')) && words.length === 3 && INT.test(words[2] ?? ''))
    return { t: 'mark', mark: low.startsWith('@coda') ? 'coda' : 'segno', section: words[1] ?? '', bar: Number(words[2]), line }
  const nav = /^@nav\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(t)
  if (nav && INT.test(nav[2] ?? '')) return { t: 'nav', section: nav[1] ?? '', bar: Number(nav[2]), text: (nav[3] ?? '').trim(), line }
  const hash = /\s#(?=\s|$)/.exec(t)
  const body = hash ? t.slice(0, hash.index) : t
  const cells = body.split('|').map((c) => c.trim())
  if (cells.length >= 3 && cells.length <= 5 && cells[0] && INT.test(cells[1] ?? ''))
    return { t: 'row', section: cells[0], bar: Number(cells[1]), cells: cells.slice(2), ...(hash ? { comment: t.slice(hash.index + 2).trim() } : {}), line }
  return { t: 'other', text: t, line }
}

type Played = { section: string; bar: string; chord: string; scale: string }
const WHOLE = /^[+-]?\d{1,6}$/
const shapeStart = (rows: readonly Played[], section: string): number => Math.min(...rows.filter((r) => r.section === section).map((r) => Number(r.bar)))
const shape = (rows: readonly Played[], section: string): string => {
  const start = shapeStart(rows, section)
  return rows.filter((r) => r.section === section).map((r) => `${Number(r.bar) - start}|${r.chord}|${r.scale}`).join(';')
}
/** the old engine's length for a part's last row (guideToneTimeline's finalBars before #329), verbatim */
function legacyFinalBars(rows: readonly Played[]): number {
  const last = rows.at(-1)
  if (!last || !rows.every((r) => WHOLE.test(r.bar))) return 1
  const first = Number(rows[0]?.bar)
  const order = [...new Set(rows.map((r) => r.section))]
  let end = Number(last.bar) + 1
  const twin = order.slice(0, -1).find((s) => s !== last.section && shape(rows, s) === shape(rows, last.section))
  const twinNext = twin === undefined ? undefined : order[order.indexOf(twin) + 1]
  if (twin !== undefined && twinNext !== undefined) end = shapeStart(rows, last.section) + shapeStart(rows, twinNext) - shapeStart(rows, twin)
  const length = Math.ceil((end - first) / 4) * 4
  return Math.max(1, first + length - Number(last.bar))
}

type Plan = { key: string | null; changes: { bar: number; value: string }[] }
const samePlan = (a: Plan, b: Plan): boolean => a.key === b.key && JSON.stringify(a.changes) === JSON.stringify(b.changes)

export function migrateChart(text: string): Migration {
  const raw = text.split(/\r?\n/)
  if (raw.at(-1) === '') raw.pop()
  const items = raw.map(read)
  const identity = (): Migration => ({ text, lineMap: raw.map((_, i) => i), prose: [], problems: [] })
  if (raw.some((l) => /^section:/i.test(l.trim())) || !items.some((x) => x.t === 'row')) return identity()

  const problems: string[] = []
  // sections in order, from rows and @copy destinations
  const order: string[] = []
  const copyOf = new Map<string, Extract<Item, { t: 'copy' }>>()
  for (const x of items) {
    const name = x.t === 'row' ? x.section : x.t === 'copy' ? x.dst : null
    if (name === null) continue
    if (x.t === 'copy') copyOf.set(x.dst, x)
    if (order.at(-1) === name) continue
    if (order.includes(name)) problems.push(`section ${name} appears again after another section (line ${x.line + 1})`)
    else order.push(name)
  }
  // the rows as the old engine played them, @copy expanded
  const played: Played[] = []
  for (const x of items) {
    if (x.t === 'row') played.push({ section: x.section, bar: String(x.bar), chord: x.cells[0] ?? '', scale: x.cells[1] ?? '' })
    if (x.t === 'copy') played.push(...played.filter((r) => r.section === x.src).map((r) => ({ ...r, section: x.dst, bar: String(Number(r.bar) + x.offset) })))
  }
  const start = new Map(order.map((s) => [s, Number(played.find((r) => r.section === s)?.bar ?? 1)]))
  const lastBar = (s: string): number => Math.max(...played.filter((r) => r.section === s).map((r) => Number(r.bar)))
  const length = new Map<string, number>()
  order.forEach((s, k) => {
    const next = order[k + 1]
    const from = start.get(s) ?? 1
    let end: number
    if (next !== undefined && formPart(next) === formPart(s)) end = start.get(next) ?? from + 1
    else {
      const part = played.filter((r) => formPart(r.section) === formPart(s))
      end = Number(part.at(-1)?.bar ?? from) + legacyFinalBars(part)
    }
    const min = lastBar(s) - from + 1
    if (end - from < min) problems.push(`section ${s} is shorter than its rows (bars out of order?)`)
    length.set(s, Math.max(end - from, min))
  })
  const rel = (s: string, bar: number): number => bar - (start.get(s) ?? 1) + 1
  const known = new Set(order)

  // key and context plans, replaying the old rule: a change holds, in play order, until the next
  const planOf = (kind: 'key' | 'context'): Map<string, Plan> => {
    const changes = items
      .filter((x): x is Extract<Item, { t: 'key' | 'context' }> => x.t === kind && known.has(x.section))
      .map((x) => ({ k: order.indexOf(x.section), bar: x.bar, value: x.value }))
      .sort((a, b) => a.k - b.k || a.bar - b.bar)
    const plans = new Map<string, Plan>()
    let running: string | null = null
    order.forEach((s, k) => {
      const own = changes.filter((c) => c.k === k)
      const atStart = own.filter((c) => rel(s, c.bar) <= 1).at(-1)
      const plan: Plan = { key: atStart?.value ?? running, changes: own.filter((c) => rel(s, c.bar) > 1).map((c) => ({ bar: rel(s, c.bar), value: c.value })) }
      plans.set(s, plan)
      running = plan.changes.at(-1)?.value ?? plan.key
    })
    return plans
  }
  const keys = planOf('key')
  const contexts = planOf('context')
  // a copy: carries its source's plan unless it writes its own key:; write the repeat out where that can't match
  const sourcePlan = (plans: Map<string, Plan>, s: string): Plan => plans.get(s) ?? { key: null, changes: [] }
  const writtenOut = new Set<string>()
  for (const [dst, c] of copyOf) {
    for (const plans of [keys, contexts]) {
      const want = sourcePlan(plans, dst)
      const carried = sourcePlan(plans, c.src)
      if (want.changes.length || (want.key === null && !samePlan(carried, { key: null, changes: [] }))) writtenOut.add(dst)
    }
  }

  // which block each line goes in; comments and stray lines go with the next body line, an # alt: with the bar it names
  const isBody = (x: Item): boolean => !['comment', 'other', 'meta', 'blank'].includes(x.t)
  const firstBody = items.findIndex(isBody)
  const sectionOfItem = (x: Item): string | null =>
    x.t === 'row' || x.t === 'key' || x.t === 'context' || x.t === 'ending' || x.t === 'mark' || x.t === 'nav' ? x.section : x.t === 'copy' ? x.dst : null
  const blockLines = new Map<string, Item[]>(order.map((s) => [s, []]))
  const header: Item[] = []
  const prose: string[] = []
  let pending: Item[] = []
  let prev: string | null = null
  const contains = (s: string | null, bar: number): boolean => s !== null && rel(s, bar) >= 1 && rel(s, bar) <= (length.get(s) ?? 0)
  items.forEach((x, i) => {
    if (i < firstBody) {
      if (x.t === 'comment' && /^#\s*area:/.test(x.text)) pending.push(x)
      else header.push(x)
      return
    }
    if (x.t === 'blank') return
    if (x.t === 'comment' && /^#\s*alt:\s*bars?\s+\d/.test(x.text)) {
      const n = Number(/(\d+)/.exec(x.text.replace(/^#\s*alt:\s*bars?\s+/, ''))?.[1])
      if (contains(prev, n) && prev !== null) return void blockLines.get(prev)?.push(x)
      pending.push(x)
      return
    }
    if (x.t === 'comment' || x.t === 'other' || x.t === 'meta') {
      if (x.t === 'comment' && !/^#\s*area:/.test(x.text) && /\bbars?\s+\d/i.test(x.text)) prose.push(`line ${i + 1}: ${x.text}`)
      if (x.t === 'other') problems.push(`can't read line ${i + 1}: ${x.text}`)
      pending.push(x)
      return
    }
    const s = sectionOfItem(x)
    if (s === null || !known.has(s)) {
      problems.push(`@${x.t === 'mark' ? x.mark : x.t} names no section ${s ?? ''} (line ${i + 1})`)
      return
    }
    blockLines.get(s)?.push(...pending, x)
    pending = []
    prev = s
  })
  if (pending.length) blockLines.get(order.at(-1) ?? '')?.push(...pending)

  // write it out
  const out: { text: string; line?: number }[] = []
  let headerEnd = header.length
  while (headerEnd > 0 && header[headerEnd - 1]?.t === 'blank') headerEnd--
  for (const x of header.slice(0, headerEnd)) {
    const t = x.t === 'comment' ? x.text.replace(/^#\s*section\s*\|\s*/i, '# ') : 'text' in x ? x.text : ''
    out.push({ text: t, line: x.line })
  }
  const rowText = (bar: number, cells: readonly string[], comment?: string): string =>
    `${bar} | ${cells.join(' | ')}${comment !== undefined ? `  #${comment ? ` ${comment}` : ''}` : ''}`
  const altText = (s: string, t: string): string =>
    t.replace(/^(#\s*alt:\s*bars?\s+)(\d+)(?:–(\d+))?/, (_m, p: string, a: string, b?: string) => `${p}${rel(s, Number(a))}${b ? `–${rel(s, Number(b))}` : ''}`)
  for (const s of order) {
    const copy = copyOf.get(s)
    const out1 = writtenOut.has(s)
    const k = keys.get(s)
    const c = contexts.get(s)
    if (out.length) out.push({ text: '' }) // no blank line above the first section when there is no header
    out.push({ text: `section: ${s}` })
    const own = !copy || out1
    const srcLength = copy ? (length.get(copy.src) ?? 0) : 0
    if (k?.key && (own || k.key !== keys.get(copy?.src ?? '')?.key || keys.get(copy?.src ?? '')?.changes.length)) out.push({ text: `key: ${k.key}` })
    if (c?.key && (own || c.key !== contexts.get(copy?.src ?? '')?.key || contexts.get(copy?.src ?? '')?.changes.length)) out.push({ text: `context: ${c.key}` })
    const len = length.get(s) ?? 1
    const written = own ? (copy ? lastBar(copy.src) - (start.get(copy.src) ?? 1) + 1 : lastBar(s) - (start.get(s) ?? 1) + 1) : srcLength
    if (len !== written) out.push({ text: `bars: ${len}` })
    if (copy && !out1) out.push({ text: `copy: ${copy.src}`, line: copy.line })
    if (copy && out1) {
      for (const r of played.filter((p) => p.section === s)) out.push({ text: rowText(rel(s, Number(r.bar)), r.scale ? [r.chord, r.scale] : [r.chord]) })
    }
    if (own) for (const ch of k?.changes ?? []) out.push({ text: `@key ${ch.bar} ${ch.value}` })
    if (own) for (const ch of c?.changes ?? []) out.push({ text: `@context ${ch.bar} ${ch.value}` })
    for (const x of blockLines.get(s) ?? []) {
      if (x.t === 'row') out.push({ text: rowText(rel(s, x.bar), x.cells, x.comment), line: x.line })
      else if (x.t === 'ending') out.push({ text: `@ending ${x.n} ${rel(s, x.from)}${x.to !== x.from ? ` ${rel(s, x.to)}` : ''}`, line: x.line })
      else if (x.t === 'mark') out.push({ text: `@${x.mark} ${rel(s, x.bar)}`, line: x.line })
      else if (x.t === 'nav') out.push({ text: `@nav ${rel(s, x.bar)} ${x.text}`, line: x.line })
      else if (x.t === 'comment') out.push({ text: altText(s, x.text), line: x.line })
      else if (x.t === 'other' || x.t === 'meta') out.push({ text: x.text, line: x.line })
      // key, context and copy items were folded into the block's fields above
    }
  }
  const lineMap = raw.map(() => -1)
  out.forEach((o, i) => {
    if (o.line !== undefined) lineMap[o.line] = i
  })
  return { text: `${out.map((o) => o.text).join('\n')}\n`, lineMap, prose, problems }
}
```

Notes for the implementer:
- `written` is the length a block would get without `bars:`: its last written bar, or for a `copy:` the source's
  length as the layout will carry it. Compare with the old length; write `bars:` only when they differ.
- A copy that is written out loses its `copy:` line (`lineMap` → -1 for the old `@copy`).
- If a test's exact expected lines disagree with this code on harmless ordering (e.g. where a pending comment lands),
  fix the code to match the test, not the other way round; the tests encode the spec.

- [ ] **Step 4: Run the unit tests**

Run: `cd engine && npx vitest run src/__tests__/migrate.test.ts`
Expected: PASS. Fix and rerun until green.

- [ ] **Step 5: Library smoke test (old engine still here)**

Append to `migrate.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { isSyncCopy } from '../util'

const CHARTS = new URL('../../charts/', import.meta.url)
const library = readdirSync(CHARTS).filter((f) => f.endsWith('.txt') && !isSyncCopy(f))

describe('migrateChart over the library', () => {
  it.each(library)('%s migrates with no problems', (f) => {
    const m = migrateChart(readFileSync(new URL(f, CHARTS), 'utf8'))
    expect(m.problems).toEqual([])
    expect(m.text).toMatch(/^section: /m)
  })
})
```

(After Task 9 converts the library, these charts already have blocks; `migrateChart` returns them unchanged and the
second assertion still holds.)

Run: `cd engine && npx vitest run src/__tests__/migrate.test.ts`
Expected: PASS for all 379. For any failure, read the chart and fix the migrator (not the chart) unless the chart is
genuinely malformed; if so, fix the chart in this commit and say so in the commit message.

- [ ] **Step 6: Export and snapshot**

Add to `engine/src/index.ts`: `export { migrateChart, type Migration } from './migrate'`. Run
`cd engine && npx vitest run src/__tests__/api.test.ts -u`, then `make test` (all green: nothing else changed).

- [ ] **Step 7: Commit**

```bash
git add engine/src/migrate.ts engine/src/__tests__/migrate.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "migrateChart: old row charts to section blocks (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

> **Tasks 3–8 switch the format.** The full suite is red between them; each task's own named tests are green at its
> end. Keep each task in its own commit. `make test` is green again at the end of Task 9.

### Task 3: Line kinds, parser and serializer

**Files:**
- Modify: `engine/src/chart.ts`
- Test: `engine/src/__tests__/chart.test.ts` (rewrite the parser/serializer/expand cases for the new format)

**Interfaces:**
- Produces (in `chart.ts`):
  ```ts
  export type SectionField = 'key' | 'time' | 'context' | 'bars' | 'outside' | 'copy'
  export const SECTION_FIELDS: readonly SectionField[]
  export type ChartLine =
    | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
    | Readonly<{ kind: 'section'; name: string }>
    | Readonly<{ kind: 'sectionMeta'; field: SectionField; value: string }>
    | Readonly<{ kind: 'row'; bar: string; chord: string; scale: string; function?: string; comment?: string }>
    | Readonly<{ kind: 'ending'; n: number; from: number; to: number }>
    | Readonly<{ kind: 'mark'; mark: 'segno' | 'coda'; bar: number }>
    | Readonly<{ kind: 'nav'; bar: number; text: string }>
    | Readonly<{ kind: 'key'; bar: number; key: string }>
    | Readonly<{ kind: 'context'; bar: number; context: ChartContext }>
    | Readonly<{ kind: 'comment'; text: string }>
    | Readonly<{ kind: 'blank' }>
    | Readonly<{ kind: 'invalid'; text: string }>
  /** the section each line belongs to (null in the header) */
  export function lineSections(doc: ChartDoc): readonly (string | null)[]
  export const isSectionName = (name: string): boolean
  ```
  `Row` keeps `{ section, bar, chord, scale, function? }`. `LinedRow = Row & { line: number; at: number }` (`at`
  filled by Task 4's layout). `expandRowLines`/`expandRows` are re-implemented in Task 4; in this task leave them
  compiling against the new kinds by delegating to a temporary `throw new Error('Task 4')` only if unavoidable — better:
  implement Task 3 and Task 4 back to back and run Task 3's parser tests only.

- [ ] **Step 1: Write the failing parser/serializer tests**

Replace `SAMPLE` and the parse/serialize/expand cases in `chart.test.ts` (keep the `isValidKey`, `keyLabel`,
`beatsPerBar`, `parseContext`, meta helpers tests, converting any chart text in them to blocks). New cases:

```ts
const SAMPLE = `title: T
subtitle: S

# bar | chord | scale
section: A
1 | Cm7 | C Dorian
2 | F7

section: B
copy: A
`

describe('parseChart: section blocks', () => {
  it('reads the header, section lines, section fields and rows', () => {
    const { value, diagnostics } = parseChart(SAMPLE)
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'meta', key: 'title', value: 'T' },
      { kind: 'meta', key: 'subtitle', value: 'S' },
      { kind: 'blank' },
      { kind: 'comment', text: '# bar | chord | scale' },
      { kind: 'section', name: 'A' },
      { kind: 'row', bar: '1', chord: 'Cm7', scale: 'C Dorian' },
      { kind: 'row', bar: '2', chord: 'F7', scale: '' },
      { kind: 'blank' },
      { kind: 'section', name: 'B' },
      { kind: 'sectionMeta', field: 'copy', value: 'A' },
    ])
  })

  it('round-trips, aligning rows across the chart', () => {
    const text = 'section: A\nkey: Eb\nbars: 4\n1  | Cm7   | C Dorian | ii\n12 | F7\n@key 3 Bb\n@ending 1 3 4\n@segno 1\n@nav 4 D.S.\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('reads in-block directives without a section argument', () => {
    const lines = parseChart('section: A\n1 | C\n@key 2 Eb\n@context 2 modal\n@ending 2 3 4\n@coda 4\n@nav 4 Fine\n').value.lines
    expect(lines.slice(2)).toEqual([
      { kind: 'key', bar: 2, key: 'Eb' },
      { kind: 'context', bar: 2, context: 'modal' },
      { kind: 'ending', n: 2, from: 3, to: 4 },
      { kind: 'mark', mark: 'coda', bar: 4 },
      { kind: 'nav', bar: 4, text: 'Fine' },
    ])
  })

  it.each([
    ['a song field after the first section:', 'section: A\ntitle: X\n1 | C\n', 2, 'title: belongs in the header, before the first section:'],
    ['a section field after a row', 'section: A\n1 | C\nkey: Eb\n', 3, 'section fields go straight under section:, before its bars'],
    ['a section field after a directive', 'section: A\n@segno 1\nbars: 4\n1 | C\n', 3, 'section fields go straight under section:, before its bars'],
    ['a second section with one name', 'section: A\n1 | C\nsection: A\n1 | F\n', 3, 'section A is already in the chart'],
    ['a row in the header', 'title: T\n1 | C\n', 2, 'bars go in a section: add  section: A  above'],
    ['an old-format row', 'A | 1 | C\n', 1, 'old chart format: put rows under a section: line, numbered from 1'],
    ['a directive in the header', '@segno 1\nsection: A\n1 | C\n', 1, 'directives go in a section: add  section: A  above'],
    ['bars: under the last bar', 'section: A\nbars: 2\n1 | C\n3 | F\n', 2, 'bars: 2 is shorter than the section (its last bar is 3)'],
    ['rows in a copy', 'section: A\n1 | C\nsection: B\ncopy: A\n1 | F\n', 5, 'a section with copy: has no bars of its own'],
    ['copy: of a later section', 'section: B\ncopy: A\nsection: A\n1 | C\n', 2, 'copy: A must name a section above it'],
    ['copy: of no section', 'section: B\ncopy: Z\n', 2, 'copy: Z must name a section above it'],
    ['outside: other than yes/no', 'section: V\noutside: maybe\n1 | C\n', 2, 'outside: yes or no'],
    ['a bad section name', 'section: A 1\n1 | C\n', 1, 'section: a name without spaces, at most 40 characters'],
    ['outside: in the header', 'outside: yes\nsection: A\n1 | C\n', 1, 'outside: belongs to a section'],
  ])('reports %s', (_, text, line, message) => {
    expect(parseChart(text).diagnostics).toContainEqual({ line, message })
  })

  it('keeps a section metre that differs from the song, with a diagnostic', () => {
    const { value, diagnostics } = parseChart('time: 4/4\nsection: B\ntime: 3/4\n1 | C\n')
    expect(value.lines[2]).toEqual({ kind: 'sectionMeta', field: 'time', value: '3/4' })
    expect(diagnostics).toEqual([{ line: 3, message: "time: drawn in the song's metre until #235" }])
  })

  it('reads key:, bars: and context: as section fields inside a block and as meta in the header', () => {
    const lines = parseChart('key: F\nbars: 32\nsection: A\nkey: Db\nbars: 8\ncontext: modal\n1 | C\n').value.lines
    expect(lines.slice(0, 2).map((l) => l.kind)).toEqual(['meta', 'meta'])
    expect(lines.slice(3, 6)).toEqual([
      { kind: 'sectionMeta', field: 'key', value: 'Db' },
      { kind: 'sectionMeta', field: 'bars', value: '8' },
      { kind: 'sectionMeta', field: 'context', value: 'modal' },
    ])
  })
})

describe('lineSections', () => {
  it('names each line’s block', () => {
    expect(lineSections(parseChart('title: T\nsection: A\n1 | C\n\nsection: B\n1 | F\n').value)).toEqual([null, 'A', 'A', 'A', 'B', 'B'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/chart.test.ts -t "section blocks|lineSections"`
Expected: FAIL.

- [ ] **Step 3: Implement the parser and serializer**

In `chart.ts`:

1. Replace the `ChartLine` union with the one in **Interfaces** (rows and directives lose `section`; `copy` kind gone).
   Add `SectionField`, `SECTION_FIELDS = ['key', 'time', 'context', 'bars', 'outside', 'copy']`, and
   `export const isSectionName = (name: string): boolean => !!name && !/\s/.test(name) && name.length <= LIMITS.maxCell`.
2. `parseLine(line)` becomes `parseLine(line, inSection: boolean)`:
   - meta keys: if `inSection` and key ∈ `key | time | context | bars` → `sectionMeta` (validate: `key` with
     `matchKeyText` → `'key: a key like Eb or Cm'`; `time` with `beatsPerBar` → `'time: 2/4, 3/4 or 4/4'`; `bars` with
     `/^\d{1,4}$/` and > 0 → `'bars: a whole number of bars'`; `context` kept even if bad, diagnosed like the header's).
     If `inSection` and key is any other meta key → `'${key}: belongs in the header, before the first section:'`.
   - `section:` → `{ kind: 'section', name }` if `isSectionName(name)`, else
     `'section: a name without spaces, at most 40 characters'`.
   - `outside:` / `copy:`: in a section → `sectionMeta` (`outside` must be `yes`/`no` case-blind, stored lowercase →
     `'outside: yes or no'`; `copy` must pass `isSectionName`); in the header → `'outside: belongs to a section'` /
     `'copy: belongs to a section'`.
   - `@ending N FIRST [LAST]`, `@segno BAR`, `@coda BAR`, `@nav BAR TEXT`, `@key BAR KEY`, `@context BAR CONTEXT`:
     the old parsing minus the section word; usage messages lose `SECTION` (`'use  @ending N FIRST [LAST]'`, etc.).
     In the header → `'directives go in a section: add  section: A  above'`.
   - `@copy …` → `'@copy is gone: write  copy: SRC  under the section’s section: line'`.
   - rows: cells `bar | chord [| scale [| function]]` (2–4 cells) → row. In the header: if the line has 3–5 cells and
     the second is a whole number → `'old chart format: put rows under a section: line, numbered from 1'`, otherwise
     `'bars go in a section: add  section: A  above'`. In a section with 5 cells or a non-matching shape →
     `'expected  bar | chord [| scale [| function]]'`.
3. `parseChart` walks the lines with state: `inSection`, `names: Set<string>`, the current block's `{ name, copy,
   bodyStarted, lastBar, barsLine, barsValue }`, and `songTime` (the header's `time:` value). Extra block rules,
   each pushing `{ line: i + 1, message }`:
   - section field when `bodyStarted` → line becomes `invalid`, `'section fields go straight under section:, before its bars'`
   - a `section:` whose name is in `names` → `invalid`, `'section A is already in the chart'`
   - `copy: X` with `X` not in `names` → keep the line, diagnostic `'copy: X must name a section above it'`
   - a row in a block with `copy` → keep the line, diagnostic `'a section with copy: has no bars of its own'`
   - at a block's end (next `section:` or EOF): `barsValue < lastBar` → diagnostic on `barsLine`:
     `'bars: N is shorter than the section (its last bar is M)'`
   - section `time:` whose `beatsPerBar` differs from `beatsPerBar(songTime)` → keep, diagnostic
     `"time: drawn in the song's metre until #235"`
   Rows and directives set `bodyStarted`. Keep the existing size limits (`maxChars`, `maxRows`, cell lengths).
4. `serializeChart`: `section` → `section: ${name}`; `sectionMeta` → `${field}: ${value}`; rows aligned with widths over
   all rows of `bar`, `chord`, scale-where-followed, function-where-followed (the old logic minus the section column);
   directives as before minus the section word.
5. Add:
   ```ts
   /** the section each line belongs to: the name of the block it is in, null in the header */
   export function lineSections(doc: ChartDoc): readonly (string | null)[] {
     let name: string | null = null
     return doc.lines.map((l) => (l.kind === 'section' ? (name = l.name) : name))
   }
   ```
6. `LinedRow` becomes `Row & Readonly<{ line: number; at: number }>`. Leave `expandRowLines`/`expandRows` signatures;
   their bodies are replaced in Task 4.
7. Update the header comment of `chart.ts` (the format summary) to describe blocks.

- [ ] **Step 4: Run the parser tests**

Run: `cd engine && npx vitest run src/__tests__/chart.test.ts -t "section blocks|lineSections|isValidKey|keyLabel|beatsPerBar|parseContext"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/src/chart.ts engine/src/__tests__/chart.test.ts
git commit -m "Chart format: section blocks in the parser and serializer (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `sectionLayout`, expansion and timing

**Files:**
- Create: `engine/src/layout.ts`
- Modify: `engine/src/chart.ts` (`expandRowLines`, `expandRows`), `engine/src/guideToneTimeline.ts`
- Test: `engine/src/__tests__/layout.test.ts` (new), `engine/src/__tests__/guideToneTimeline.test.ts` (rewrite charts to blocks), `chart.test.ts` (expand cases)

**Interfaces:**
- Consumes: Task 3's `ChartLine`, `SectionField`, `lineSections`, `LinedRow`, `formPart`, `chartBeats`, `beatsPerBar`,
  `parseContext`.
- Produces (`layout.ts`):
  ```ts
  export type Directive =
    | Readonly<{ kind: 'ending'; section: string; n: number; from: number; to: number; line: number }>
    | Readonly<{ kind: 'mark'; section: string; mark: 'segno' | 'coda'; bar: number; line: number }>
    | Readonly<{ kind: 'nav'; section: string; bar: number; text: string; line: number }>
    | Readonly<{ kind: 'key'; section: string; bar: number; key: string; line: number }>
    | Readonly<{ kind: 'context'; section: string; bar: number; context: ChartContext; line: number }>
  export type LayoutSection = Readonly<{
    name: string
    line: number               // its section: line
    part: FormPart
    copyOf: string | null      // the copy: source, null for a written section
    copyLine: number | null    // the copy: line
    beats: 2 | 3 | 4           // its metre as written or carried (the timing still uses the song's; see Global Constraints)
    length: number             // bars
    start: number              // bars before it in its part
    key: string | null         // stated at bar 1: own key:, else carried from its copy source; null = none stated
    context: ChartContext | null
    rows: readonly LinedRow[]
  }>
  export type Layout = Readonly<{
    sections: readonly LayoutSection[]
    rows: readonly LinedRow[]                  // every section's rows, in order (what expandRowLines returns)
    directives: readonly Directive[]           // own and carried (copy) directives, in chart order
    lengths: ReadonlyMap<string, number>
  }>
  export function sectionLayout(doc: ChartDoc): Parsed<Layout>
  /** the key stated at a bar of a section: its last in-block @key at or before the bar, else its key:, else null */
  export function statedKeyAt(layout: Layout, section: string, bar: number): string | null
  ```
  `guideToneTimeline(rows: readonly Row[], beats?: 2 | 3 | 4, lengths?: ReadonlyMap<string, number>)` (same return).

- [ ] **Step 1: Write the failing layout tests** (`layout.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { sectionLayout, statedKeyAt } from '../layout'

const layout = (text: string) => sectionLayout(parseChart(text).value).value

describe('sectionLayout', () => {
  it('fills in each row’s section and its bar counted through the part', () => {
    const l = layout('section: A\n1 | C\n2 | F\nsection: B\n1 | G7\n')
    expect(l.rows.map((r) => [r.section, r.bar, r.at])).toEqual([['A', '1', 1], ['A', '2', 2], ['B', '1', 3]])
    expect(l.sections.map((s) => [s.name, s.start, s.length])).toEqual([['A', 0, 2], ['B', 2, 1]])
  })

  it('takes a length from bars:, else the last written bar', () => {
    const l = layout('section: A\nbars: 8\n1 | C\n5 | F\nsection: B\n1 | G7\n')
    expect([...l.lengths]).toEqual([['A', 8], ['B', 1]])
    expect(l.rows[2]?.at).toBe(9)
  })

  it('numbers an intro and a coda from their own start', () => {
    const l = layout('section: Intro\n1 | C\n2 | C\nsection: A\n1 | F\nsection: Coda\n1 | C\n')
    expect(l.rows.map((r) => r.at)).toEqual([1, 2, 1, 1])
    expect(l.sections.map((s) => s.part)).toEqual(['before', 'form', 'after'])
  })

  it('puts an outside: yes section before or after the form', () => {
    const l = layout('section: Vamp\noutside: yes\n1 | Dm7\nsection: A\n1 | C\nsection: Out\noutside: yes\n1 | C\n')
    expect(l.sections.map((s) => s.part)).toEqual(['before', 'form', 'after'])
  })

  it('repeats a copy’s source rows, pointing at the source lines, with its key, time, context and length', () => {
    const l = layout('section: A1\nkey: Eb\ntime: 3/4\ncontext: modal\nbars: 4\n1 | Cm7\n@key 3 Bb\nsection: A2\ncopy: A1\n')
    const a2 = l.sections[1]
    expect(a2?.rows.map((r) => [r.section, r.bar, r.line])).toEqual([['A2', '1', 5]])
    expect([a2?.key, a2?.beats, a2?.context, a2?.length, a2?.copyOf]).toEqual(['Eb', 3, 'modal', 4, 'A1'])
    expect(l.directives.filter((d) => d.section === 'A2')).toEqual([{ kind: 'key', section: 'A2', bar: 3, key: 'Bb', line: 6 }])
  })

  it('lets a copy’s own key: replace the source’s key: and its in-block @key lines', () => {
    const l = layout('section: A1\nkey: Eb\n1 | Cm7\n@key 2 Bb\n2 | F7\nsection: A2\nkey: G\ncopy: A1\n')
    expect(l.sections[1]?.key).toBe('G')
    expect(l.directives.filter((d) => d.section === 'A2')).toEqual([])
  })

  it('carries through a copy of a copy', () => {
    const l = layout('section: A\nkey: Eb\n1 | C\nsection: B\ncopy: A\nsection: C\ncopy: B\n')
    expect(l.sections[2]?.rows.map((r) => r.line)).toEqual([2])
    expect(l.sections[2]?.key).toBe('Eb')
  })

  it('does not carry endings, marks or nav into a copy', () => {
    const l = layout('section: A\n1 | C\n2 | F\n@ending 1 2\n@segno 1\nsection: B\ncopy: A\n@coda 2\n')
    expect(l.directives.map((d) => [d.kind, d.section])).toEqual([['ending', 'A'], ['mark', 'A'], ['mark', 'B']])
  })

  it('states keys that revert at the section’s end', () => {
    const l = layout('key: F\nsection: A\n1 | F\n2 | C7\nsection: B\nkey: Db\n1 | Db\n@key 3 E\n3 | E\nsection: C\n1 | F\n')
    expect([statedKeyAt(l, 'A', 1), statedKeyAt(l, 'B', 1), statedKeyAt(l, 'B', 2), statedKeyAt(l, 'B', 3), statedKeyAt(l, 'C', 1)]).toEqual([null, 'Db', 'Db', 'E', null])
  })

  it('stops at maxExpandedRows with a fatal diagnostic', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `${i + 1} | C`).join('\n')
    const copies = Array.from({ length: 120 }, (_, i) => `section: C${i}\ncopy: A`).join('\n')
    const { diagnostics } = sectionLayout(parseChart(`section: A\n${rows}\n${copies}\n`).value)
    expect(diagnostics.some((d) => d.fatal)).toBe(true)
  })
})
```

- [ ] **Step 2: Write the failing timeline tests**

Rewrite `guideToneTimeline.test.ts` so every chart is in blocks and section bars restart; add:

```ts
it('starts each section where the last ended, and holds a last chord to the section’s length', () => {
  const l = sectionLayout(parseChart('section: A\nbars: 4\n1 | Dm7\n3 | G7\nsection: B\n1 | C\n').value).value
  const { events } = guideToneTimeline(l.rows, 4, l.lengths)
  expect(events.map((e) => [e.chord, e.start, e.beats])).toEqual([['Dm7', 0, 8], ['G7', 8, 8], ['C', 16, 4]])
})

it('without lengths, a section lasts to its last written bar', () => {
  const rows = [{ section: 'A', bar: '1', chord: 'C', scale: '' }, { section: 'A', bar: '2', chord: 'F', scale: '' }, { section: 'B', bar: '1', chord: 'G', scale: '' }]
  expect(guideToneTimeline(rows, 4).events.map((e) => e.start)).toEqual([0, 4, 8])
})

it('splits a shared bar by the metre, as before', () => {
  const l = sectionLayout(parseChart('time: 3/4\nsection: A\n1 | Dm7\n1 | G7\n2 | C\n').value).value
  expect(guideToneTimeline(l.rows, 3, l.lengths).events.map((e) => [e.start, e.beats])).toEqual([[0, 2], [2, 1], [3, 3]])
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/layout.test.ts src/__tests__/guideToneTimeline.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `layout.ts`**

```ts
import { beatsPerBar, type ChartContext, type ChartDoc, chartBeats, type Diagnostic, formPart, type FormPart, type LinedRow, parseContext, type Parsed, type SectionField } from './chart'
import { LIMITS } from './limits'

/**
 * Section blocks resolved (docs/design.md §4, issue #329): each section's rows with its name filled in and its bar
 * counted through its part (`at`), its length, part, stated key and context, and what a copy: carries. Every view of a
 * chart reads this rather than walking doc.lines. Pure; no analysis.
 */
// (types as in Interfaces)

const WHOLE = /^\d{1,6}$/

export function sectionLayout(doc: ChartDoc): Parsed<Layout> {
  type Block = { name: string; line: number; fields: Partial<Record<SectionField, Readonly<{ value: string; line: number }>>>; rows: LinedRow[]; directives: Directive[] }
  const blocks: Block[] = []
  doc.lines.forEach((l, line) => {
    if (l.kind === 'section') return void blocks.push({ name: l.name, line, fields: {}, rows: [], directives: [] })
    const b = blocks.at(-1)
    if (!b) return
    if (l.kind === 'sectionMeta') b.fields[l.field] = { value: l.value, line }
    else if (l.kind === 'row') b.rows.push({ section: b.name, bar: l.bar, chord: l.chord, scale: l.scale, ...(l.function ? { function: l.function } : {}), line, at: 0 })
    else if (l.kind === 'ending' || l.kind === 'mark' || l.kind === 'nav' || l.kind === 'key' || l.kind === 'context') {
      b.directives.push({ ...l, section: b.name, line } as Directive)
    }
  })

  const songBeats = chartBeats(doc)
  const diagnostics: Diagnostic[] = []
  const sections: LayoutSection[] = []
  const directives: Directive[] = []
  const byName = new Map<string, LayoutSection & Readonly<{ ownDirectives: readonly Directive[] }>>()
  const partBars: Record<FormPart, number> = { before: 0, form: 0, after: 0 }
  let seenForm = false
  let total = 0
  for (const b of blocks) {
    if (byName.has(b.name)) continue // the parser reported it
    const outside = b.fields.outside?.value === 'yes'
    const part: FormPart = outside ? (seenForm ? 'after' : 'before') : formPart(b.name)
    if (part === 'form') seenForm = true
    const copy = b.fields.copy ? byName.get(b.fields.copy.value) : undefined
    const source = copy ? [] : b.rows
    const rowsBase = copy ? copy.rows.map((r) => ({ ...r, section: b.name })) : source
    if (total + rowsBase.length > LIMITS.maxExpandedRows) {
      diagnostics.push({ line: b.line + 1, message: `more than ${LIMITS.maxExpandedRows} rows after copy:`, fatal: true })
      break
    }
    total += rowsBase.length
    const lastBar = Math.max(1, ...rowsBase.filter((r) => WHOLE.test(r.bar)).map((r) => Number(r.bar)))
    const own = b.fields.bars ? Number(b.fields.bars.value) : copy ? copy.length : lastBar
    const length = Math.max(own, lastBar)
    const start = partBars[part]
    partBars[part] += length
    const rows = rowsBase.map((r) => ({ ...r, at: start + (WHOLE.test(r.bar) ? Number(r.bar) : 1) }))
    const key = b.fields.key?.value ?? (copy ? copy.key : null)
    const context = b.fields.context ? parseContext(b.fields.context.value) : copy ? copy.context : null
    const beats = b.fields.time ? (beatsPerBar(b.fields.time.value) ?? songBeats) : copy ? copy.beats : songBeats
    const carried = copy
      ? copy.ownDirectives.filter((d) => (d.kind === 'key' && !b.fields.key) || (d.kind === 'context' && !b.fields.context)).map((d) => ({ ...d, section: b.name }))
      : []
    const section = { name: b.name, line: b.line, part, copyOf: b.fields.copy?.value ?? null, copyLine: b.fields.copy?.line ?? null, beats, length, start, key, context, rows }
    const keyPlan = [...carried, ...b.directives.filter((d) => d.kind === 'key' || d.kind === 'context')]
    byName.set(b.name, { ...section, ownDirectives: keyPlan })
    sections.push(section)
    directives.push(...carried, ...b.directives)
  }
  directives.sort((a, b) => a.line - b.line) // carried ones sit at their source's lines; stable for ties
  return {
    value: { sections, rows: sections.flatMap((s) => s.rows), directives, lengths: new Map(sections.map((s) => [s.name, s.length])) },
    diagnostics,
  }
}

export function statedKeyAt(layout: Layout, section: string, bar: number): string | null {
  const change = layout.directives.filter((d): d is Extract<Directive, { kind: 'key' }> => d.kind === 'key' && d.section === section && d.bar <= bar).sort((a, b) => a.bar - b.bar).at(-1)
  return change?.key ?? layout.sections.find((s) => s.name === section)?.key ?? null
}
```

Note: `directives.sort` by line puts carried copy directives at their source's line, i.e. before the copy block's own
lines. Consumers group by `section`, so order only matters within a section; if a test shows otherwise, sort by
(section order, bar) instead and adjust the "does not carry endings" test expectation accordingly.

- [ ] **Step 5: Re-implement expansion in `chart.ts`**

```ts
/** chart rows in order with copy: applied, each with its source line index and its bar through its part; at most maxExpandedRows */
export function expandRowLines(doc: ChartDoc): Parsed<readonly LinedRow[]> {
  const { value, diagnostics } = sectionLayout(doc)
  return { value: value.rows, diagnostics }
}
```

`chart.ts` importing `layout.ts` and vice versa is a cycle; break it by moving `expandRowLines`/`expandRows` into
`layout.ts` and re-exporting them from `chart.ts`'s callers' perspective via `engine/src/index.ts` (update every
`import { expandRowLines } from './chart'` to `'./layout'` — grep shows ~60 call sites across engine and scripts; web
imports from the package root, unaffected). `expandRows` keeps returning plain `Row`s (`{ section, bar, chord, scale }`).

- [ ] **Step 6: Re-implement `guideToneTimeline`**

```ts
import { type Row } from './chart'

/**
 * When each chord of the Changes sheet starts and how long it lasts, in beats (docs/plan-guide-tones.md): sections
 * are timed one after another, each from its own bar 1; a chord lasts until the next change in its section, rows that
 * share a bar split it, and a section's last chord lasts to the section's length (bars:, else its last written bar).
 */
// SPLITS, WHOLE, sameBar, GuideEvent unchanged; sectionStart, shape and finalBars removed

export function guideToneTimeline(rows: readonly Row[], beats: 2 | 3 | 4 = BEATS, lengths?: ReadonlyMap<string, number>): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[] }> {
  const sections: Row[][] = []
  for (const r of rows) {
    const last = sections.at(-1)
    if (last?.[0]?.section === r.section) last.push(r)
    else sections.push([r])
  }
  const events: GuideEvent[] = []
  const diagnostics: string[] = []
  let cursor = 0
  for (const rs of sections) {
    const name = rs[0]?.section ?? ''
    const lastBar = Math.max(1, ...rs.filter((r) => WHOLE.test(r.bar)).map((r) => Number(r.bar)))
    const length = Math.max(lengths?.get(name) ?? lastBar, lastBar)
    const t = timeSection(rs, cursor, beats, length)
    events.push(...t.events)
    diagnostics.push(...t.diagnostics)
    cursor += length * beats
  }
  return { events, diagnostics }
}

function timeSection(rows: readonly Row[], from: number, beats: 2 | 3 | 4, length: number): Readonly<{ events: GuideEvent[]; diagnostics: string[] }> {
  const groups: Row[][] = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last?.[0] && sameBar(last[0].bar, r.bar)) last.push(r)
    else groups.push([r])
  }
  const diagnostics: string[] = []
  const events: GuideEvent[] = []
  const firstBar = groups[0]?.[0]?.bar ?? '1'
  let cursor = from + (WHOLE.test(firstBar) && Number(firstBar) > 1 ? (Number(firstBar) - 1) * beats : 0)
  groups.forEach((group, g) => {
    const first = group[0]
    if (!first) return
    if (group.length > beats) diagnostics.push(`more than ${beats} chords in bar ${first.bar}: the ${beats + 1}th and later are left out`)
    const kept = group.slice(0, beats)
    const next = groups[g + 1]?.[0]?.bar
    let bars = 1
    if (!WHOLE.test(first.bar)) diagnostics.push(`bar "${first.bar}" is not a whole number, so ${first.chord} gets one bar`)
    else if (next !== undefined && WHOLE.test(next) && Number(next) > Number(first.bar)) bars = Number(next) - Number(first.bar)
    else if (next === undefined) bars = Math.max(1, length - Number(first.bar) + 1)
    const split = SPLITS[beats][kept.length - 1] ?? [beats]
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats: i === kept.length - 1 ? slot + (bars - 1) * beats : slot })
      offset += slot
    })
    cursor += bars * beats
  })
  return { events, diagnostics }
}
```

(`WHOLE` here must accept the same strings as before: keep `/^[+-]?\d{1,6}$/`.)

- [ ] **Step 7: Run the task's tests**

Run: `cd engine && npx vitest run src/__tests__/layout.test.ts src/__tests__/guideToneTimeline.test.ts src/__tests__/chart.test.ts`
Expected: PASS (rewrite `chart.test.ts`'s `expandRows`/`expandRowLines` cases to blocks: copy rows point at source
lines; `at` values; the fatal row limit).

- [ ] **Step 8: Commit**

```bash
git add engine/src/layout.ts engine/src/chart.ts engine/src/guideToneTimeline.ts engine/src/__tests__/layout.test.ts engine/src/__tests__/guideToneTimeline.test.ts engine/src/__tests__/chart.test.ts
git commit -m "sectionLayout: resolve section blocks; time sections by their lengths (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Include every file whose `expandRowLines` import moved.)

---

### Task 5: Sheets read the layout (`bars.ts`, `changes.ts`, `barGrid.ts`, `chordPicks.ts`)

**Files:**
- Modify: `engine/src/bars.ts`, `engine/src/changes.ts`, `engine/src/chordPicks.ts`, `engine/src/barGrid.ts` (only if it reads removed fields)
- Test: `engine/src/__tests__/bars.test.ts`, `changes.test.ts`, `chordPicks.test.ts`, `barGrid.test.ts`, `arpeggioSheet.test.ts`, `sheet.test.ts` (charts → blocks; expectations → relative bars)

**Interfaces:**
- Consumes: `sectionLayout`, `Layout`, `Directive` (Task 4); `guideToneTimeline(rows, beats, lengths)`.
- Produces: `ChartBar.kind: 'chords' | 'held'` (no `implied`); `BarSection.copy: { of: string; line: number } | null`
  where `line` is the `copy:` line; `pickBars(positions)` returns `"A1 bar 6"` strings.

- [ ] **Step 1: Failing tests**

In `bars.test.ts` add:

```ts
it('numbers each section’s bars from 1 and holds bars up to bars:', () => {
  const v = barView(parseChart('section: A\nbars: 4\n1 | Dm7\n2 | G7\nsection: B\ncopy: A\n').value)
  expect(v.sections.map((s) => [s.name, s.bars.map((b) => `${b.bar}${b.kind[0]}`).join(' '), s.copy?.of ?? null])).toEqual([
    ['A', '1c 2c 3h 4h', null],
    ['B', '1c 2c 3h 4h', 'A'],
  ])
  expect(v.sections[1]?.copy?.line).toBe(5)
})

it('places in-block directives on their bars', () => {
  const v = barView(parseChart('section: A\n1 | C\n2 | F\n@ending 1 2\n@segno 1\n@nav 2 Fine\n@key 2 Eb\n').value)
  const [b1, b2] = v.sections[0]?.bars ?? []
  expect([b1?.marks.map((m) => m.mark), b2?.ending?.n, b2?.nav.map((n) => n.text), b2?.key?.key]).toEqual([['segno'], 1, ['Fine'], 'Eb'])
})

it('lists a directive on a bar past the section as unplaced', () => {
  expect(barView(parseChart('section: A\n1 | C\n@segno 3\n').value).unplaced).toContainEqual({ line: 2, reason: 'no bar 3 in A' })
})
```

In `chordPicks.test.ts`: `expect(pickBars(['A1:6:0', 'A2:6:0', 'A2:6:1'])).toEqual(['A1 bar 6', 'A2 bar 6'])`.

In `changes.test.ts` add a folded-repeat case (`section: A1 … section: A2\ncopy: A1` draws one block marked `A1 · A2`)
and a written-out case (a copy not straight after its source is marked `A3 (= A1)`), converting the existing cases.

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/bars.test.ts src/__tests__/chordPicks.test.ts src/__tests__/changes.test.ts`
Expected: FAIL.

- [ ] **Step 3: `bars.ts`**

Replace the body of `barView` after `const beats = chartBeats(doc)` with a layout-driven build:

```ts
  const unplaced: Unplaced[] = []
  doc.lines.forEach((l, i) => {
    if (l.kind === 'invalid') unplaced.push({ line: i, reason: "can't read this line" })
  })
  const { value: layout, diagnostics } = sectionLayout(doc)
  for (const d of diagnostics) unplaced.push({ line: d.line - 1, reason: d.message })
  const rows = orderedRows(layout.rows, unplaced)
  const { events } = guideToneTimeline(rows, beats, layout.lengths)
  const timed = new Set(events.map((e) => e.row))
  for (const r of rows) if (!timed.has(r)) unplaced.push({ line: r.line, reason: `more than ${beats} chords in bar ${r.bar} of ${r.section}` })
  const barOf = (start: number): number => Math.floor(start / beats)

  const at = new Map<string, Mutable<ChartBar>>()
  let first = 0 // the bar index (through the whole chart) of each section's bar 1
  const sections = layout.sections.map((s): BarSection => {
    const own = events.filter((e) => e.row.section === s.name)
    const bars = Array.from({ length: s.length }, (_, j): Mutable<ChartBar> => {
      const chords = own
        .filter((e) => barOf(e.start) === first + j)
        .map((e): BarChord => ({ chord: e.chord, beat: e.start - (first + j) * beats, line: (e.row as LinedRow).line }))
      const bar = { bar: j + 1, kind: chords.length ? 'chords' : 'held', chords, ending: null, marks: [], nav: [], key: null, context: null } as Mutable<ChartBar>
      at.set(`${s.name}|${bar.bar}`, bar)
      return bar
    })
    first += s.length
    return { name: s.name, part: s.part, copy: s.copyOf !== null && s.copyLine !== null ? { of: s.copyOf, line: s.copyLine } : null, bars }
  })
```

and the directive placement loop iterates `layout.directives` (each has `section`), with `ChartLine` field access
replaced by the `Directive` fields (`d.section`, `d.bar`, `d.from`, `d.to`, `d.line`). Remove the `implied` kind from
`ChartBar`, `runs`, `lastChordBar`, `copies` and the `isCopy` detection. Keep the `once` de-duplication.

- [ ] **Step 4: `changes.ts`**

1. Add near the top of `chordPositions`, `changesSections`, `buildChanges`:
   ```ts
   const { value: layout } = sectionLayout(doc)
   const rows = layout.rows
   ```
   and pass `layout.lengths` to every `guideToneTimeline(rows, beats, layout.lengths)` call.
2. `drawnBlocks(doc, rows, t, withEndings)` → `drawnBlocks(layout, t, withEndings)`; inside, replace
   ```ts
   const source = doc.lines[r.line]
   const copyOf = source?.kind === 'row' && source.section !== r.section ? source.section : null
   ```
   with `const copyOf = copyOfName.get(r.section) ?? null` where
   `const copyOfName = new Map(layout.sections.flatMap((s) => (s.copyOf ? [[s.name, s.copyOf] as const] : [])))`.
3. `withEndings`/`endings`/marks/nav: read `layout.directives` instead of `doc.lines`:
   ```ts
   const endings = layout.directives.filter((d): d is Extract<Directive, { kind: 'ending' }> => d.kind === 'ending')
   const withEndings = new Set(endings.map((e) => e.section))
   for (const d of layout.directives) { if (d.kind === 'mark') … if (d.kind === 'nav') … }
   ```
4. `layoutBar(section, bar)` stays (it keys `rowIndexAt` by `${section}|${bar}`, now relative); but a directive on a
   held bar (no row there) is lost by `rowIndexAt`. Replace `layoutBar` with the section's first bar index plus
   `bar - 1`, using the timing: compute `const sectionFirst = new Map<string, number>()` by walking
   `layout.sections` with a running sum of `length` (all parts are timed in sequence), then
   `const layoutBar = (section: string, bar: number): number | undefined => { const f = sectionFirst.get(section); return f === undefined ? undefined : f + bar - 1 }`.
   Add a test in `changes.test.ts`: a `@segno` on a held bar draws its glyph.
5. `chordKeys` is unchanged (its `firstBar` is the block's first row's relative bar).

- [ ] **Step 5: `chordPicks.ts`**

```ts
/** the bars a pick covers, as the popover names them: "A1 bar 6" */
export const pickBars = (positions: readonly ChordAt[]): readonly string[] =>
  [...new Set(positions.flatMap((at) => {
    const m = /^(.*):(\d+):\d+$/.exec(at)
    return m ? [`${m[1]} bar ${m[2]}`] : []
  }))]
```

- [ ] **Step 6: Convert the remaining sheet tests' charts**

For each of `barGrid.test.ts`, `arpeggioSheet.test.ts`, `sheet.test.ts`, `arpeggios.test.ts`,
`guideToneLines.test.ts`, `pentatonicLine.test.ts`, `triadPairLine.test.ts`, `practice.test.ts`, `tune.test.ts`:
rewrite each inline chart into blocks by hand (bars from 1 per section; `@copy A B 8` → `section: B\ncopy: A`), then
update expectations that name absolute bars. To find them:
`grep -nE "[A-Za-z0-9]+ *\| *[0-9]+ *\|" engine/src/__tests__/*.test.ts`.

- [ ] **Step 7: Run**

Run: `cd engine && npx vitest run src/__tests__/bars.test.ts src/__tests__/changes.test.ts src/__tests__/chordPicks.test.ts src/__tests__/barGrid.test.ts src/__tests__/arpeggioSheet.test.ts src/__tests__/sheet.test.ts src/__tests__/arpeggios.test.ts src/__tests__/guideToneLines.test.ts src/__tests__/pentatonicLine.test.ts src/__tests__/triadPairLine.test.ts src/__tests__/practice.test.ts src/__tests__/tune.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add engine/src/bars.ts engine/src/changes.ts engine/src/chordPicks.ts engine/src/barGrid.ts engine/src/__tests__/bars.test.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/chordPicks.test.ts engine/src/__tests__/barGrid.test.ts engine/src/__tests__/arpeggioSheet.test.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/arpeggios.test.ts engine/src/__tests__/guideToneLines.test.ts engine/src/__tests__/pentatonicLine.test.ts engine/src/__tests__/triadPairLine.test.ts engine/src/__tests__/practice.test.ts engine/src/__tests__/tune.test.ts
git commit -m "Sheets read sections from the layout; bars count from 1 per section (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Analysis, notes, completions, transpose

**Files:**
- Modify: `engine/src/analysis/index.ts`, `engine/src/analysis/stream.ts`, `engine/src/analysis/ambiguity.ts`, `engine/src/notes.ts`, `engine/src/completions.ts`, `engine/src/transpose.ts`, `engine/scripts/analyse.ts` (only if it formats bars itself), `engine/src/__tests__/analysis.fixture.test.ts` (area string)
- Test: `analysis.test.ts`, `ambiguity.test.ts`, `context.test.ts`, `functions.test.ts`, `functionLabels.test.ts`, `rules.test.ts`, `resolve.test.ts`, `levels.test.ts`, `notes.test.ts`, `completions.test.ts`, `transpose.test.ts`, `catalogue.test.ts`

**Interfaces:**
- Consumes: `sectionLayout`, `Directive`, `LinedRow.at`.
- Produces: `Area` gains `toSection: string`; `export function areaSpan(a: Area): string` in `analysis/index.ts`
  (`"A 1–5"`, `"A 3"`, `"A 11 – B 5"`), used by `applyAnalysis`, the analysis fixture and `ambiguities`.

- [ ] **Step 1: Failing tests**

`analysis.test.ts`:

```ts
it('states a section’s key: for that section only; the next section is found again', () => {
  const a = analyse(parseChart('key: C\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\nsection: B\nkey: Eb\n1 | Fm7\n2 | Bb7\n3 | EbMaj7\n4 | EbMaj7\nsection: C\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n').value)
  expect(a.areas.map((x) => [x.key.name, x.section, x.from, x.toSection, x.to, x.stated])).toEqual([
    ['C major', 'A', '1', 'A', '4', false],
    ['Eb major', 'B', '1', 'B', '4', true],
    ['C major', 'C', '1', 'C', '4', false],
  ])
})

it('applies an in-block @key on a held bar to the chord held through it', () => {
  const a = analyse(parseChart('key: C\nsection: A\n1 | CMaj7\n3 | Ab7\n@key 4 Db\n5 | DbMaj7\n').value)
  expect(a.rows.find((r) => r.chord === 'Ab7')?.key.name).toBe('Db major')
})

it('names areas by section in # area: comments', () => {
  const doc = parseChart('key: C\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\nsection: B\nkey: Eb\n1 | Fm7\n2 | Bb7\n3 | EbMaj7\n').value
  const text = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'none', save: true, date: '2026-10-16' }).doc)
  expect(text).toContain('# area: C major (A 1–3)')
  expect(text).toContain('# area: Eb major (B 1–3)')
})

it('reports a section context: as not yet supported, like @context', () => {
  const a = analyse(parseChart('section: A\ncontext: modal\n1 | Dm7\n').value)
  expect(a.problems.map((p) => p.message)).toContain("context: modal in section A: not yet supported: using the chart's context")
})
```

`ambiguity.test.ts`: a found area starting mid-section suggests `in section B: @key 3 Db`; at a section's bar 1,
`in section B: key: Db`.

`transpose.test.ts`: a section `key: Eb` and an `@key 3 Bb` both move (C → D gives `key: F`, `@key 3 C`).

`notes.test.ts` (`insertKeyChange`): on a row at bar 1 it sets the section's `key:`; elsewhere it inserts `@key BAR K`
above the row; it adds a returning `@key` only when the next found area starts later in the same section.

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/analysis.test.ts src/__tests__/ambiguity.test.ts src/__tests__/transpose.test.ts src/__tests__/notes.test.ts`
Expected: FAIL.

- [ ] **Step 3: `analysis/stream.ts`**

In `timing(rows, formBars)`, replace `const bars = rows.map((r) => Number(r.bar))` with
`const bars = rows.map((r) => r.at)`. Nothing else in the stream changes (it already times each part on its own).

- [ ] **Step 4: `analysis/index.ts`**

1. `analyse(doc)`: `const layout = sectionLayout(doc).value; const rows = layout.rows` (instead of `expandRowLines`).
2. `sectionLengths(rows, formBars)`: replace `Number(r.bar)` with `r.at`.
3. Replace `statedAreas(doc, rows, stream, found, problems)` with:
   ```ts
   /**
    * stated keys (docs/design.md §4): a section's key: from its bar 1, an in-block @key from its bar, each until the
    * section ends; elsewhere the areas as found. A change on a bar a chord is held through states the chord held there.
    */
   function statedAreas(layout: Layout, rows: readonly LinedRow[], stream: readonly Entry[], found: readonly Key[], problems: Problem[]): { keys: Key[]; stated: boolean[] } {
     for (const d of layout.directives) {
       if (d.kind !== 'key') continue
       const s = layout.sections.find((x) => x.name === d.section)
       if (!s || d.bar < 1 || d.bar > s.length) addProblem(problems, { line: d.line, message: `@key ${d.bar}: no bar ${d.bar} in section ${d.section}` })
       else if (!parseKey(d.key)) addProblem(problems, { line: d.line, message: `@key ${d.bar} ${d.key}: not a key` })
     }
     // each row's stated key: the last change before the next row's bar in its section, else the section's key:
     const rowKey = rows.map((r, i): string | null => {
       if (!/^\d+$/.test(r.bar)) return null
       const nextBar = rows.slice(i + 1).find((x) => x.section === r.section && Number(x.bar) > Number(r.bar))?.bar
       const before = nextBar === undefined ? (layout.lengths.get(r.section) ?? Number(r.bar)) : Number(nextBar) - 1
       return statedKeyAt(layout, r.section, before)
     })
     const keys = [...found]
     const stated = stream.map(() => false)
     stream.forEach((e, i) => {
       const k = e.rows.map((r) => rowKey[r] ?? null).filter((x): x is string => x !== null).at(-1)
       const key = k ? parseKey(k) : null
       if (!key) return
       keys[i] = key
       stated[i] = true
     })
     return { keys, stated }
   }
   ```
   Call it with `layout` instead of `doc`.
4. Where areas are built (`areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: …, section: firstRow.section, stated })`
   and `areas[areas.length - 1] = { ...area, to: row.bar }`), add `toSection: firstRow.section` initially and
   `toSection: row.section` on extension. Add `toSection: string` to the `Area` type.
5. Add:
   ```ts
   /** an area's bars as comments and reports name them: "A 1–5", "A 3", "A 11 – B 5" */
   export const areaSpan = (a: Area): string =>
     a.section !== a.toSection ? `${a.section} ${a.from} – ${a.toSection} ${a.to}` : a.from === a.to ? `${a.section} ${a.from}` : `${a.section} ${a.from}–${a.to}`
   ```
   and in `applyAnalysis`: ``areaAt.set(line, `# area: ${a.key.name} (${areaSpan(a)})`)``.
6. `statedContext`: replace the `@context` problem with one per context directive and per section `context:` field:
   `` `@context ${d.bar} ${d.context} in section ${d.section}: not yet supported: using the chart's context` `` and
   `` `context: ${value} in section ${s.name}: not yet supported: using the chart's context` `` (line = the field's line;
   find it by scanning `doc.lines` with `lineSections`).
7. The "repeat at bar N" reason text (`the repeat at bar ${repeat.bar} would be …`): name the section too:
   `` `the repeat at ${sectionOfRow} bar ${repeat.bar} …` `` (the conflict's row has `section` via `rows[r.row]`).
8. Export `areaSpan` and `type Area` from `engine/src/index.ts` if `Area` is not already exported; update the API
   snapshot.

- [ ] **Step 5: `analysis.fixture.test.ts`**

`areas: a.areas.map((x) => `${x.key.name} ${areaSpan(x)}`)`, and rows: prefix each with the section:
`` `${rowsSection[r.row]} ${r.bar} ${r.chord} …` `` where `rowsSection` comes from `sectionLayout(doc).value.rows`.

- [ ] **Step 6: `ambiguity.ts`**

```ts
  const pin = (x: Area): string => `in section ${x.section}: ${x.from === '1' ? `key: ${keyCode(x.key)}` : `@key ${x.from} ${keyCode(x.key)}`}`
```
and ``out.push(`key area ${keyText(x.key)}, ${areaSpan(x)}, found by cadence: pin it with  ${pin(x)}…`)``. Since a stated
key now reverts at the section's end, only add the `and  ${pin(next)}` part when `next.section === x.toSection` (the
next area starts inside the same section).

- [ ] **Step 7: `notes.ts` `insertKeyChange`**

```ts
export function insertKeyChange(doc: ChartDoc, i: number): ChartDoc {
  const a = analyse(doc)
  const r = a.rows.find((x) => x.line === i)
  const pinned = insertKeyBefore(doc, i, r ? keyCode(r.key) : 'C')
  if (pinned === doc || !r) return pinned
  // a stated key reverts at its section's end; within the section, return to the next found area where it starts
  const next = a.areas.find((x) => x.row > r.row)
  const section = lineSections(doc)[i]
  if (!next || next.section !== section || next.stated || !/^\d{1,6}$/.test(next.from)) return pinned
  const first = a.rows.find((x) => x.row === next.row)?.line
  if (first === undefined) return pinned
  return insertKeyBefore(pinned, first > i ? first + 1 : first, keyCode(next.key))
}
```

(`insertKeyBefore` is rewritten in Task 7 to write `key:` at bar 1, `@key` elsewhere; until then this test fails —
run `notes.test.ts` at the end of Task 7.)

- [ ] **Step 8: `completions.ts` and `transpose.ts`**

`completions.ts`:
```ts
const rowsOf = (doc: ChartDoc, section: string, bar: number): number[] => {
  const sections = lineSections(doc)
  return doc.lines.flatMap((l, i) => (l.kind === 'row' && sections[i] === section && l.bar === String(bar) ? [i] : []))
}
```
If `completions.ts` offers line-start keywords for Source, add `section:` and the section fields (check the file;
add a test in `completions.test.ts` if it does).

`transpose.ts` `transposeChart`:
```ts
    if (l.kind === 'key') return { ...l, key: transposeKeyText(l.key, s, side) }
    if (l.kind === 'sectionMeta' && l.field === 'key') return { ...l, value: transposeKeyText(l.value, s, side) }
```

- [ ] **Step 9: Convert the remaining analysis-side tests**

The new tests in Step 1 encode the semantics (revert at section end, held-bar changes, area names); if the analyser
finds a different key for musical reasons, change the chords in the test, not the expected semantics.


`analysis.test.ts`, `context.test.ts`, `functions.test.ts`, `functionLabels.test.ts`, `rules.test.ts`,
`resolve.test.ts`, `levels.test.ts`, `completions.test.ts`, `catalogue.test.ts`, `ambiguity.test.ts`: charts → blocks
by hand; absolute-bar expectations → relative. Where a test used `@key` across sections, decide per the new rule
(revert at section end) and write section `key:` lines so the test keeps testing what it was for.

- [ ] **Step 10: Run**

Run: `cd engine && npx vitest run src/__tests__/analysis.test.ts src/__tests__/ambiguity.test.ts src/__tests__/context.test.ts src/__tests__/functions.test.ts src/__tests__/functionLabels.test.ts src/__tests__/rules.test.ts src/__tests__/resolve.test.ts src/__tests__/levels.test.ts src/__tests__/completions.test.ts src/__tests__/transpose.test.ts src/__tests__/catalogue.test.ts`
Expected: PASS (`notes.test.ts` waits for Task 7).

- [ ] **Step 11: Commit**

```bash
git add engine/src/analysis/index.ts engine/src/analysis/stream.ts engine/src/analysis/ambiguity.ts engine/src/notes.ts engine/src/completions.ts engine/src/transpose.ts engine/src/index.ts engine/src/__tests__/analysis.fixture.test.ts engine/src/__tests__/analysis.test.ts engine/src/__tests__/ambiguity.test.ts engine/src/__tests__/context.test.ts engine/src/__tests__/functions.test.ts engine/src/__tests__/functionLabels.test.ts engine/src/__tests__/rules.test.ts engine/src/__tests__/resolve.test.ts engine/src/__tests__/levels.test.ts engine/src/__tests__/completions.test.ts engine/src/__tests__/transpose.test.ts engine/src/__tests__/catalogue.test.ts engine/src/__tests__/notes.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Analysis: stated keys per section, areas named by section (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Editor operations on blocks (`edit.ts`)

**Files:**
- Modify: `engine/src/edit.ts`
- Test: `engine/src/__tests__/barEdit.test.ts`, `engine/src/__tests__/edit.test.ts`, `engine/src/__tests__/notes.test.ts`

**Interfaces:**
- Consumes: `lineSections`, `isSectionName`, `SectionField`, `sectionLayout`, `barView` (Task 5).
- Produces: unchanged exported signatures, except `RowField = 'bar' | 'chord' | 'scale' | 'function'` (no
  `'section'`). New internal helpers: `blockRange(doc, name)`, `setSectionField(doc, name, field, value | null)`,
  `tidyBars(doc, name, length)`.

Rules for every operation (from the spec): bars are section-relative; inserting or deleting a bar renumbers only within
the section (and its copies' endings/marks/nav, which mirror it); a section's length is kept with `bars:` only when it
differs from the last written bar.

- [ ] **Step 1: Failing tests** (`barEdit.test.ts`; convert existing cases, add these)

```ts
const doc = (t: string) => parseChart(t).value
const text = (d: ChartDoc) => serializeChart(d)

describe('bar edits on section blocks', () => {
  it('insertBar renumbers only its own section', () => {
    const d = insertBar(doc('section: A\n1 | C\n2 | F\nsection: B\n1 | G7\n'), 'A', 2, ['Dm7'])
    expect(text(d)).toBe('section: A\n1 | C\n2 | Dm7\n3 | F\nsection: B\n1 | G7\n')
  })

  it('a held bar appended to a section keeps counting through bars:', () => {
    expect(text(insertBar(doc('section: A\n1 | C\n2 | F\n'), 'A', 3))).toBe('section: A\nbars: 3\n1 | C\n2 | F\n')
  })

  it('deleting the last written bar keeps the length; deleting a held bar shortens it', () => {
    expect(text(deleteBar(doc('section: A\nbars: 4\n1 | C\n3 | F\n'), 'A', 4))).toBe('section: A\n1 | C\n3 | F\n')
    expect(text(setBarChords(doc('section: A\n1 | C\n2 | F\n'), 'A', 2, []))).toBe('section: A\nbars: 2\n1 | C\n')
  })

  it('shifts directives in the section and in its copies', () => {
    const d = insertBar(doc('section: A\n1 | C\n2 | F\n@segno 2\nsection: B\ncopy: A\n@ending 1 2\n'), 'A', 1, ['G'])
    expect(text(d)).toBe('section: A\n1 | G\n2 | C\n3 | F\n@segno 3\nsection: B\ncopy: A\n@ending 1 3\n')
  })

  it('renameSection edits the section: line and copy: lines only', () => {
    expect(text(renameSection(doc('section: A\n1 | C\nsection: B\ncopy: A\n'), 'A', 'A1'))).toBe('section: A1\n1 | C\nsection: B\ncopy: A1\n')
  })

  it('repeatSection writes a copy block after the last section of its part', () => {
    expect(text(repeatSection(doc('section: A\n1 | C\nsection: Coda\n1 | C\n'), 'A', 'A2'))).toBe('section: A\n1 | C\n\nsection: A2\ncopy: A\nsection: Coda\n1 | C\n')
  })

  it('addSection writes a block with its chords on bar 1', () => {
    expect(text(addSection(doc('section: A\n1 | C\n'), 'B', ['F', 'G7']))).toBe('section: A\n1 | C\n\nsection: B\n1 | F\n1 | G7\n')
  })

  it('splitSection opens a block, renumbers from 1, and carries the key in force and the length', () => {
    const d = splitSection(doc('section: A\nbars: 8\n1 | C\n@key 3 Eb\n3 | Fm7\n5 | Bb7\n@segno 5\n'), 'A', 5, 'B')
    expect(text(d)).toBe('section: A\nbars: 4\n1 | C\n@key 3 Eb\n3 | Fm7\n\nsection: B\nkey: Eb\nbars: 4\n1 | Bb7\n@segno 1\n')
  })

  it('writeOutCopy materialises the rows and what the copy carried', () => {
    const d = writeOutCopy(doc('section: A\nkey: Eb\nbars: 4\n1 | Cm7\n@key 2 Bb\n2 | F7\nsection: B\ncopy: A\n'), 'B')
    expect(text(d)).toBe('section: A\nkey: Eb\nbars: 4\n1 | Cm7\n@key 2 Bb\n2 | F7\nsection: B\nkey: Eb\nbars: 4\n1 | Cm7\n2 | F7\n@key 2 Bb\n')
  })

  it('insertKeyBefore writes key: on a section’s bar 1, @key elsewhere', () => {
    const d = doc('section: A\n1 | C\n2 | F\n')
    expect(text(insertKeyBefore(d, 1, 'Eb'))).toBe('section: A\nkey: Eb\n1 | C\n2 | F\n')
    expect(text(insertKeyBefore(d, 2, 'Eb'))).toBe('section: A\n1 | C\n@key 2 Eb\n2 | F\n')
  })

  it('setEnding, setMark and setNav write in-block directives at the block’s end', () => {
    let d = doc('section: A\n1 | C\n2 | F\nsection: B\n1 | G\n')
    d = setEnding(d, 'A', 1, { from: 2, to: 2 })
    d = setMark(d, 'A', 1, 'segno', true)
    d = setNav(d, 'B', 1, 'Fine')
    expect(text(d)).toBe('section: A\n1 | C\n2 | F\n@ending 1 2\n@segno 1\nsection: B\n1 | G\n@nav 1 Fine\n')
  })

  it('deleting a section’s only bar removes the block, unless a copy: names it', () => {
    expect(text(deleteBar(doc('section: A\n1 | C\nsection: B\n1 | F\n'), 'B', 1))).toBe('section: A\n1 | C\n')
    const copied = doc('section: A\n1 | C\nsection: B\ncopy: A\n')
    expect(deleteBar(copied, 'A', 1)).toBe(copied)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/barEdit.test.ts src/__tests__/edit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers**

```ts
/** a section's block: its section: line and the index just past its last line (the next section: or the end) */
function blockRange(doc: ChartDoc, name: string): Readonly<{ start: number; end: number }> | null {
  const start = doc.lines.findIndex((l) => l.kind === 'section' && l.name === name)
  if (start < 0) return null
  const next = doc.lines.findIndex((l, i) => i > start && l.kind === 'section')
  let end = next < 0 ? doc.lines.length : next
  while (end > start + 1 && doc.lines[end - 1]?.kind === 'blank') end-- // a blank before the next section belongs to neither
  return { start, end }
}

const fieldIndex = (doc: ChartDoc, name: string, field: SectionField): number => {
  const r = blockRange(doc, name)
  return r ? doc.lines.findIndex((l, i) => i > r.start && i < r.end && l.kind === 'sectionMeta' && l.field === field) : -1
}

/** set a section field (null removes it); a new one goes in canonical order among the block's fields */
function setSectionField(doc: ChartDoc, name: string, field: SectionField, value: string | null): ChartDoc {
  const r = blockRange(doc, name)
  if (!r) return doc
  const i = fieldIndex(doc, name, field)
  if (value === null) return i < 0 ? doc : removeLine(doc, i)
  const line: ChartLine = { kind: 'sectionMeta', field, value }
  if (i >= 0) return { lines: replaceAt(doc.lines, i, line) }
  const rank = SECTION_FIELDS.indexOf(field)
  let at = r.start + 1
  while (at < r.end) {
    const l = doc.lines[at]
    if (l?.kind !== 'sectionMeta' || SECTION_FIELDS.indexOf(l.field) > rank) break
    at++
  }
  return { lines: [...doc.lines.slice(0, at), line, ...doc.lines.slice(at)] }
}

/** keep a section `length` bars long: bars: only where that differs from its last written bar */
function tidyBars(doc: ChartDoc, name: string, length: number): ChartDoc {
  if (fieldIndex(doc, name, 'copy') >= 0) {
    const src = sectionLayout(doc).value.sections.find((s) => s.name === name)
    return setSectionField(doc, name, 'bars', src && src.length !== length ? String(length) : null)
  }
  const sections = lineSections(doc)
  const last = Math.max(0, ...doc.lines.flatMap((l, i) => (l.kind === 'row' && sections[i] === name && WHOLE.test(l.bar) ? [Number(l.bar)] : [])))
  return setSectionField(doc, name, 'bars', length > last ? String(length) : null)
}
```

(`tidyBars` on a copy compares with the length the copy would carry without its own `bars:`; compute that with the
field removed first: `sectionLayout(setSectionField(doc, name, 'bars', null))`.)

- [ ] **Step 4: Rewrite the operations**

Replace `barShift`/`shiftBars` with a section-local shift:

```ts
/** the section and every copy: that repeats it (directly or through another copy) */
function withCopies(doc: ChartDoc, name: string): ReadonlySet<string> {
  const names = new Set([name])
  for (const s of sectionLayout(doc).value.sections) if (s.copyOf && names.has(s.copyOf)) names.add(s.name)
  return names
}

/** bar `at` of `section` gained (+1) or lost (−1): its rows and its and its copies' directives move along */
function shiftBars(doc: ChartDoc, view: BarView, section: string, at: number, delta: 1 | -1): ChartLine[] {
  const sections = lineSections(doc)
  const moved = withCopies(doc, section)
  const map = (n: number): number | null => (n < at ? n : n === at && delta < 0 ? null : n + delta)
  const bars = new Map(view.sections.map((s) => [s.name, s.bars] as const))
  return doc.lines.flatMap((l, i): ChartLine[] => {
    const s = sections[i]
    if (s === null || s === undefined || !moved.has(s)) return [l]
    switch (l.kind) {
      case 'row': {
        if (s !== section || !WHOLE.test(l.bar)) return [l]
        const n = map(Number(l.bar))
        return n === null ? [] : [{ ...l, bar: String(n) }]
      }
      case 'mark':
      case 'nav': {
        const n = map(l.bar)
        return n === null ? [] : [{ ...l, bar: n }]
      }
      case 'key':
      case 'context': {
        const n = map(l.bar)
        if (n !== null) return [{ ...l, bar: n }]
        // on a deleted bar: it starts on the bar after, if that bar has none of its own
        const next = bars.get(s)?.find((b) => b.bar === l.bar + 1)
        return next && next[l.kind] === null ? [{ ...l, bar: l.bar }] : []
      }
      case 'ending': {
        if (delta < 0 && l.from === at && l.to === at) return []
        const from = delta > 0 ? (l.from >= at ? l.from + 1 : l.from) : l.from > at ? l.from - 1 : l.from
        const to = delta > 0 ? (l.to >= at ? l.to + 1 : l.to) : l.to >= at ? l.to - 1 : l.to
        return [{ ...l, from, to }]
      }
      case 'sectionMeta':
        return l.field === 'bars' ? [{ ...l, value: String(Number(l.value) + delta) }] : [l]
      default:
        return [l]
    }
  })
}

const rowsFor = (bar: number, chords: readonly string[]): RowLine[] => chords.map((chord) => ({ kind: 'row', bar: String(bar), chord, scale: '' }))

/** where a bar's new rows go: before the block's first row on a later bar, else after its last row (or its fields) */
function rowSlot(doc: ChartDoc, section: string, bar: number): number {
  const r = blockRange(doc, section)
  if (!r) return doc.lines.length
  const inBlock = (i: number): boolean => i > r.start && i < r.end
  const later = doc.lines.findIndex((l, i) => inBlock(i) && l.kind === 'row' && WHOLE.test(l.bar) && Number(l.bar) > bar)
  if (later >= 0) return later
  const lastRow = doc.lines.findLastIndex((l, i) => inBlock(i) && l.kind === 'row')
  if (lastRow >= 0) return lastRow + 1
  const lastField = doc.lines.findLastIndex((l, i) => inBlock(i) && l.kind === 'sectionMeta')
  return (lastField >= 0 ? lastField : r.start) + 1
}

export function insertBar(doc: ChartDoc, section: string, bar: number, chords: readonly string[] = []): ChartDoc {
  const view = barView(doc)
  const s = view.sections.find((x) => x.name === section)
  const length = s?.bars.length ?? 0
  if (!s || s.copy || bar < 1 || bar > length + 1 || chordsError(chords) || (bar === 1 && !chords.length)) return doc
  const shifted: ChartDoc = { lines: shiftBars(doc, view, section, bar, 1) }
  const at = rowSlot(shifted, section, bar)
  const next: ChartDoc = { lines: [...shifted.lines.slice(0, at), ...rowsFor(bar, chords), ...shifted.lines.slice(at)] }
  return tidyBars(next, section, length + 1)
}

export function deleteBar(doc: ChartDoc, section: string, bar: number): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  if (!found) return doc
  const bars = found.section.bars
  if (bar === 1 && bars[1]?.kind === 'held') return doc
  if (bars.length === 1) {
    if (view.sections.some((s) => s.copy?.of === section)) return doc
    const r = blockRange(doc, section)
    if (!r) return doc
    let start = r.start
    while (start > 0 && doc.lines[start - 1]?.kind === 'blank') start--
    return { lines: [...doc.lines.slice(0, start), ...doc.lines.slice(r.end)] }
  }
  return tidyBars({ lines: shiftBars(doc, view, section, bar, -1) }, section, bars.length - 1)
}
```

`setBarChords`: replace `rowsFor(section, bar, …)`/`rowSlot(next.lines, section, bar)` with the new forms and end
with `return tidyBars(result, section, found.section.bars.length)`.

`insertHeldBar(doc, section, bar)`: `return insertBar(doc, section, bar)` (a held bar at the end now counts through
`bars:`). Keep `insertBars` as is.

`renameSection`:
```ts
export function renameSection(doc: ChartDoc, from: string, to: string): ChartDoc {
  const view = barView(doc)
  const names = new Set(view.sections.map((s) => s.name))
  const outside = fieldIndex(doc, from, 'outside') >= 0
  if (!names.has(from) || names.has(to) || !isSectionName(to) || (!outside && formPart(to) !== formPart(from))) return doc
  return {
    lines: doc.lines.map((l): ChartLine =>
      l.kind === 'section' && l.name === from ? { ...l, name: to } : l.kind === 'sectionMeta' && l.field === 'copy' && l.value === from ? { ...l, value: to } : l,
    ),
  }
}
```

`partEnd(doc, view, part)` → returns only the insertion line: the end of the part's last block, else (empty part) the
first block of a later part (`before` → first block; `form` → first `after` block), else the end. Insert new sections
as `[{ kind: 'blank' }, { kind: 'section', name }, …]` there.

`addSection(doc, name, chords)`: lines `blank, section, ...rowsFor(1, chords)`.

`repeatSection(doc, src, dst)`: lines `blank, section dst, sectionMeta copy src`.

`writeOutCopy(doc, section)`:
```ts
export function writeOutCopy(doc: ChartDoc, section: string): ChartDoc {
  const layout = sectionLayout(doc).value
  const s = layout.sections.find((x) => x.name === section)
  const i = fieldIndex(doc, section, 'copy')
  if (!s || i < 0 || !s.rows.length) return doc
  const src = layout.sections.find((x) => x.name === s.copyOf)
  const rows = s.rows.map(({ line: _l, at: _a, section: _s, ...r }): RowLine => ({ kind: 'row', ...r }))
  // key and context changes the copy carried from its source (the layout gives them to it; its own block has none)
  const sections = lineSections(doc)
  const carried = layout.directives
    .filter((d) => d.section === section && (d.kind === 'key' || d.kind === 'context') && sections[d.line] !== section)
    .map(({ section: _s, line: _l, ...d }) => d as ChartLine)
  let next: ChartDoc = { lines: [...doc.lines.slice(0, i), ...rows, ...carried, ...doc.lines.slice(i + 1)] }
  if (s.key && fieldIndex(next, section, 'key') < 0) next = setSectionField(next, section, 'key', s.key)
  if (src && s.beats !== chartBeats(doc) && fieldIndex(next, section, 'time') < 0) next = setSectionField(next, section, 'time', `${s.beats}/4`)
  if (s.context && fieldIndex(next, section, 'context') < 0) next = setSectionField(next, section, 'context', s.context)
  return tidyBars(next, section, s.length)
}
```

`splitSection(doc, section, bar, name)`:
```ts
export function splitSection(doc: ChartDoc, section: string, bar: number, name: string): ChartDoc {
  const view = barView(doc)
  const found = writtenBar(view, section, bar)
  if (!found || found.bar.kind !== 'chords' || bar === 1) return doc
  if (view.sections.some((s) => s.name === name) || !isSectionName(name) || formPart(name) !== found.section.part) return doc
  const sections = lineSections(doc)
  const mine = (i: number): boolean => sections[i] === section
  if (doc.lines.some((l, i) => mine(i) && l.kind === 'ending' && l.from < bar && l.to >= bar)) return doc
  if (view.sections.some((s) => s.copy?.of === section)) return doc
  const r = blockRange(doc, section)
  if (!r) return doc
  const layout = sectionLayout(doc).value
  const length = found.section.bars.length
  const moves = (l: ChartLine, i: number): boolean =>
    mine(i) && ((l.kind === 'row' && WHOLE.test(l.bar) && Number(l.bar) >= bar) || (l.kind === 'ending' && l.from >= bar) || ((l.kind === 'key' || l.kind === 'context' || l.kind === 'mark' || l.kind === 'nav') && l.bar >= bar))
  const renumber = (l: ChartLine): ChartLine =>
    l.kind === 'row' ? { ...l, bar: String(Number(l.bar) - bar + 1) } : l.kind === 'ending' ? { ...l, from: l.from - bar + 1, to: l.to - bar + 1 } : 'bar' in l ? { ...l, bar: (l.bar as number) - bar + 1 } : l
  const moved = doc.lines.flatMap((l, i) => (moves(l, i) ? [renumber(l)] : []))
  const kept = doc.lines.filter((l, i) => !moves(l, i))
  const key = statedKeyAt(layout, section, bar)
  const time = doc.lines.find((l, i) => mine(i) && l.kind === 'sectionMeta' && l.field === 'time')
  const block: ChartLine[] = [
    { kind: 'blank' },
    { kind: 'section', name },
    ...(key ? [{ kind: 'sectionMeta', field: 'key', value: key } as ChartLine] : []),
    ...(time ? [time] : []),
    ...moved,
  ]
  const end = r.end - moved.length
  let next: ChartDoc = { lines: [...kept.slice(0, end), ...block, ...kept.slice(end)] }
  next = tidyBars(next, section, bar - 1)
  return tidyBars(next, name, length - bar + 1)
}
```
(If the moved key directive sat on the split bar itself, `statedKeyAt` already returns it, so drop a moved `@key 1 …`:
filter `moved` to remove `key` lines with `bar === 1` after renumbering — the `key:` field says it.)

`addDirective(doc, section, line)`: insert at `blockRange(doc, section)?.end ?? doc.lines.length`.

`setEnding`/`setMark`/`setNav`/`toggleEnding`: match lines by `lineSections(doc)[i] === section` instead of
`l.section === section`; build directive lines without `section`.

`insertKeyBefore(doc, i, key)`:
```ts
export function insertKeyBefore(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  const section = lineSections(doc)[i]
  if (line?.kind !== 'row' || !section || !/^\d{1,6}$/.test(line.bar)) return doc
  if (Number(line.bar) === 1) return setSectionField(doc, section, 'key', key)
  return { lines: [...doc.lines.slice(0, i), { kind: 'key', bar: Number(line.bar), key }, ...doc.lines.slice(i)] }
}
```

`setKeyLine(doc, i, key)`: also accept a `sectionMeta` `key` line (`{ ...line, value: key }`).

`insertRowAfter(doc, i)`: the row has no section; if `lineSections(doc)[i + 1]` (or `[i]`) is null (header), insert
`{ kind: 'section', name: 'A' }` before the row.

`RowField`: drop `'section'`. Grep the web app for `setRowField(` with `'section'` (none today) and for `RowField`.

- [ ] **Step 5: Run**

Run: `cd engine && npx vitest run src/__tests__/barEdit.test.ts src/__tests__/edit.test.ts src/__tests__/notes.test.ts`
Expected: PASS. Then `cd engine && npx vitest run` — everything except `golden.test.ts`, `analysis.fixture.test.ts`,
`libraryMeta.test.ts` and `migrate.test.ts`'s library block (the library is still old-format) should pass.

- [ ] **Step 6: Commit**

```bash
git add engine/src/edit.ts engine/src/__tests__/barEdit.test.ts engine/src/__tests__/edit.test.ts engine/src/__tests__/notes.test.ts
git commit -m "Editor operations on section blocks; bars: keeps a section's length (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The app: migrate on open, share v2, wording, tests

**Files:**
- Modify: `engine/src/levels.ts` (`remapOwned`), `engine/src/share.ts` (`VERSION = 2`), `engine/src/index.ts`,
  `web/app/components/EditorView.vue` (`openingText`, the `'implied'` use at ~line 618),
  `web/app/utils/chordPicks.ts`, `web/app/components/BarDialog.vue` and any component text naming bars
- Test: `engine/src/__tests__/levels.test.ts`, `engine/src/__tests__/share.test.ts`, `web/test/EditorView.test.ts`,
  `web/test/chordPicks*.test.ts` (or the test covering `utils/chordPicks.ts`), every web test and e2e spec with
  old-format charts

**Interfaces:**
- Consumes: `migrateChart` (Task 2), `unlevel` (existing).
- Produces: `export function remapOwned(owned: readonly string[], lineMap: readonly number[]): string[]` in `levels.ts`.

- [ ] **Step 1: Failing engine tests**

`levels.test.ts`:
```ts
it('remapOwned follows rows to their new lines and drops lines that went', () => {
  expect(remapOwned(['2:Cm7', '5:F7', '9:G7'], [0, 1, 4, -1, 5, 6, 7, 8, 9, -1])).toEqual(['4:Cm7', '6:F7'])
})
```
`share.test.ts`: a payload encoded with `v: 1` (build it by hand: deflate `JSON.stringify({ v: 1, chart: 'A | 1 | C\n' })`
the way the existing tests build raw payloads) decodes to `null`; a fresh `encodeShare` round-trips with `v: 2`.

- [ ] **Step 2: Implement**

```ts
/** `owned` keys (`line:chord`) moved to the lines a migration put their rows on; a key whose line went is dropped */
export function remapOwned(owned: readonly string[], lineMap: readonly number[]): string[] {
  return owned.flatMap((k) => {
    const m = /^(\d+):(.*)$/.exec(k)
    const to = m ? lineMap[Number(m[1])] : undefined
    return m && to !== undefined && to >= 0 ? [`${to}:${m[2]}`] : []
  })
}
```
`share.ts`: `const VERSION = 2` with the comment "2: section blocks (#329); a version-1 link's chart is in the retired
row format and is not opened". Export `remapOwned` from `index.ts`; update the API snapshot.

- [ ] **Step 3: EditorView opening**

```ts
/**
 * what opens in the editor: a chart in the retired row format (a saved chart, the draft, a file from disk) migrated
 * to section blocks (#329), then the Scale-level migration (docs/superpowers/specs/2026-10-11-proposed-scales-design.md §3):
 * cells a level once wrote are blank again, so they follow the level. Either change is saved back.
 */
const openingText = ((): string => {
  const migrated = migrateChart(props.initialText)
  if (migrated.problems.length) console.info(`Chart format: ${migrated.problems.join('; ')}`)
  const owned = scaleLevel.owned.value
  if (!owned) return migrated.text
  scaleLevel.owned.value = undefined
  const state: LevelState = { level: scaleLevel.level.value, seed: scaleLevel.seed.value, owned: remapOwned(owned, migrated.lineMap) }
  const { doc, blanked } = unlevel(parseChart(migrated.text).value, state, baseline)
  if (!blanked) return migrated.text
  console.info(`Scale level: ${blanked === 1 ? '1 scale' : `${blanked} scales`} a level wrote into this chart now follow the level`)
  return serializeChart(doc)
})()
```
Line ~627 (`if (openingText !== props.initialText) saved?.saveNow()`) already saves a migrated chart back. At ~line 618
replace `bars.findLast((b) => b.kind !== 'implied')?.bar` with `bars.at(-1)?.bar`.

Test in `web/test/EditorView.test.ts`: mount with `initialText: 'title: T\nA | 1 | Cm7\nA | 2 | F7\n'` and a
`saveTarget` of kind `mine`; expect the editor text to equal `'title: T\n\nsection: A\n1 | Cm7\n2 | F7\n'` (after
serialize alignment) and `saveNow` to have been called (follow how the existing unlevel test spies on it).

- [ ] **Step 4: Wording**

`web/app/utils/chordPicks.ts`: the bar strings from `pickBars` already read `A1 bar 6`; drop the `bar`/`bars` prefix:

```ts
export const pickHeader = (heading: string, b: readonly string[]): string => (b.length ? `${heading} · ${b.join(', ')}` : heading)
export const pickFooter = (sheet: 'changes' | 'scales', b: readonly string[], varies: boolean): string =>
  sheet === 'changes' ? `Sets ${barList(b)}.` : varies ? `Replaces the different picks in ${barList(b)}.` : `Sets ${barList(b)} on the Changes sheet too.`
```
Remove `barsOf`. Update its test: `pickHeader('D♭7 Mixolydian', ['A1 bar 6', 'A2 bar 6'])` →
`'D♭7 Mixolydian · A1 bar 6, A2 bar 6'`; footer → `'Sets A1 bar 6 and A2 bar 6.'`.

Grep the components for other bar wording (`grep -rn "bar \${" web/app`): `BarDialog.vue` ("Bar N and the rest of S
become a section of their own" stays correct), `EditorView.vue` (`starts at bar`), `SheetChord.vue`,
`SheetChordEditor.vue`, `ChangesSystem.vue` aria labels, `issueReport.ts` — all already say section + bar; with
relative bars they read right. No change unless a string says "bar" without the section.

- [ ] **Step 4b: Stored practice state**

Check what `csm-practice:<slug>:<mode>` holds (`web/app/composables/usePractice.ts`, its `parse` and the
`PracticeSelection` type in the engine's `practice.ts`). If it stores bar numbers or `ChordAt` keys, apply the
chord-picks rule: a stored entry whose position no longer exists in the chart is ignored and dropped on the next write
(add a unit test for that). If it stores only modes, presets or scale names, no change; say so in the commit message.
`csm-pent-picks` needs nothing (its picks fail their target check).

- [ ] **Step 5: Convert web unit tests and e2e specs**

Charts in `web/test/*.test.ts` and `web/e2e/*.spec.ts` (list: `grep -rlE "[A-Za-z0-9]+ \| [0-9]+ \| " web/test web/e2e`)
→ blocks, by hand; fix assertions naming absolute bars. e2e specs that type chart text into Source must type the new
format. Keep one e2e check that the editor round-trips a chart with `section:`, `copy:` and `bars:`
(`web/e2e/editor.spec.ts`).

- [ ] **Step 6: Run**

Run: `cd engine && npx vitest run src/__tests__/levels.test.ts src/__tests__/share.test.ts src/__tests__/api.test.ts && cd ../web && npx vitest run`
Expected: PASS (web tests that load library charts may still fail until Task 9; note which).

- [ ] **Step 7: Commit**

```bash
git add engine/src/levels.ts engine/src/share.ts engine/src/index.ts engine/src/__tests__/levels.test.ts engine/src/__tests__/share.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap web/app/components/EditorView.vue web/app/utils/chordPicks.ts web/test web/e2e
git commit -m "App: migrate old charts as they open; share links v2; bar wording (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add web/test web/e2e` stages only tracked/new files in those dirs; check `git status` first for stray sync
copies.)

---

### Task 9: Convert the library; golden and compare

**Files:**
- Create: `engine/scripts/migrate-charts.ts`, `engine/scripts/compare-golden.ts`
- Modify: `engine/charts/*.txt` (379), `engine/src/__tests__/goldenFixture.ts` (`CHART_TEXTS` → blocks), `engine/fixtures/golden.json`, `engine/fixtures/analysis.json`
- Modify: `engine/package.json` (scripts `migrate-charts`, `compare-golden`)

**Interfaces:**
- Consumes: `migrateChart`, `parseChart`, `serializeChart`; Task 1's golden fields.

- [ ] **Step 1: Save the old golden**

Find Task 1's commit: `T1=$(git log --format=%h --grep 'Golden: record each chart' -1)`. Then
`git show "$T1":engine/fixtures/golden.json > "$TMPDIR/golden-old.json"` and
`git show "$T1":engine/fixtures/analysis.json > "$TMPDIR/analysis-old.json"`.

- [ ] **Step 2: Write `engine/scripts/migrate-charts.ts`**

```ts
/**
 * One-off (issue #329): rewrite every library chart from the retired row format to section blocks, column-aligned,
 * and list the prose comments that name a bar (for a person to fix).  npm run migrate-charts -w engine
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { migrateChart, parseChart, serializeChart } from '../src'
import { isSyncCopy } from '../src/util'

const dir = new URL('../charts/', import.meta.url)
let failed = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt') && !isSyncCopy(x)).sort()) {
  const url = new URL(f, dir)
  const m = migrateChart(readFileSync(url, 'utf8'))
  if (m.problems.length) {
    failed++
    console.error(`${f}: ${m.problems.join('; ')}`)
    continue
  }
  const parsed = parseChart(m.text)
  if (parsed.diagnostics.length) {
    failed++
    console.error(`${f}: ${parsed.diagnostics.map((d) => `line ${d.line}: ${d.message}`).join('; ')}`)
    continue
  }
  writeFileSync(url, serializeChart(parsed.value))
  for (const p of m.prose) console.log(`${f} ${p}`)
}
process.exitCode = failed ? 1 : 0
```
`package.json`: `"migrate-charts": "vite-node scripts/migrate-charts.ts"`.

- [ ] **Step 3: Run it**

Run: `cd engine && npm run migrate-charts > "$TMPDIR/prose.txt"; echo exit $?; wc -l "$TMPDIR/prose.txt"`
Expected: `exit 0`; about 361 prose lines. A non-zero exit lists charts to fix in the migrator (preferred) or by hand.

- [ ] **Step 4: Convert the fixture's inline charts**

In `goldenFixture.ts`:
```ts
const CHART_TEXTS: Record<string, string> = {
  inline_defaults: 'TITLE: Defaults\r\nsection: A\r\n1 | Cm7\r\n2 | F7 |\r\n3 | Bbmaj7 | Bb Lydian\r\n',
  inline_copy: 'title: Copy\nsubtitle: Neg\n# c\nsection: A\n1 | Dm7b5\n2 | G7alt\nsection: B\ncopy: A\nsection: C\ncopy: B\n',
}
```
(`inline_copy` used a negative offset and a zero offset to reach parser paths; the new paths are a copy and a copy of
a copy.)

- [ ] **Step 5: Re-save the analysis, then golden**

Run: `cd engine && npm run analyse -- --all --save && cd .. && make golden`
Expected: `# area:` lines rewritten as `(A 1–5)` style; golden regenerated.

- [ ] **Step 6: Write `engine/scripts/compare-golden.ts`**

```ts
/**
 * One-off (issue #329): the golden fixture before and after the section-blocks migration must agree in everything
 * but bar numbering and chart text.  npm run compare-golden -w engine -- OLD.json NEW.json
 */
import { readFileSync } from 'node:fs'

type Chart = { rows: (string | null)[][]; timing: unknown[][]; areas: unknown[][]; title: string; subtitle: string; key: string }
const [oldPath, newPath] = process.argv.slice(2)
const load = (p: string | undefined): Record<string, unknown> & { charts: Record<string, Chart> } => JSON.parse(readFileSync(p ?? '', 'utf8'))
const before = load(oldPath)
const after = load(newPath)
let bad = 0
const fail = (msg: string): void => {
  bad++
  console.log(msg)
}
for (const k of Object.keys(before)) if (k !== 'charts' && JSON.stringify(before[k]) !== JSON.stringify(after[k])) fail(`${k} differs`)
for (const [name, o] of Object.entries(before.charts)) {
  const n = after.charts[name]
  if (!n) {
    fail(`${name}: missing`)
    continue
  }
  if (o.title !== n.title || o.subtitle !== n.subtitle || o.key !== n.key) fail(`${name}: heading differs`)
  if (o.rows.length !== n.rows.length) {
    fail(`${name}: ${o.rows.length} rows before, ${n.rows.length} after`)
    continue
  }
  // each old (section, bar) must map to one new bar; everything else equal
  const map = new Map<string, string>()
  o.rows.forEach((r, i) => {
    const m = n.rows[i] ?? []
    const key = `${r[0]}|${r[1]}`
    if (r[0] !== m[0] || r[2] !== m[2] || r[3] !== m[3]) fail(`${name} row ${i}: ${JSON.stringify(r)} → ${JSON.stringify(m)}`)
    if (map.has(key) && map.get(key) !== m[1]) fail(`${name} row ${i}: bar ${key} maps to two bars`)
    map.set(key, String(m[1]))
    if (JSON.stringify(o.timing[i]) !== JSON.stringify(n.timing[i])) fail(`${name} row ${i}: timing ${JSON.stringify(o.timing[i])} → ${JSON.stringify(n.timing[i])}`)
  })
  const areaKey = (a: unknown[]): string => `${a[0]}|${a[1]}|${map.get(`${a[1]}|${a[2]}`) ?? `?${a[2]}`}|${a[4]}`
  const newArea = (a: unknown[]): string => `${a[0]}|${a[1]}|${a[2]}|${a[4]}`
  if (o.areas.map(areaKey).join(';') !== n.areas.map(newArea).join(';')) fail(`${name}: areas ${o.areas.map(areaKey).join(';')} → ${n.areas.map(newArea).join(';')}`)
}
console.log(bad ? `${bad} differences` : 'golden agrees modulo bar numbering')
process.exitCode = bad ? 1 : 0
```
(Old areas are `[key, section, from, to, stated]`, new ones `[key, section, from, to, stated]` with `toSection`
possibly added after `to` by Task 6's fixture change — if so, adjust `newArea` to index `stated` correctly. The area
check compares key, section, mapped start bar and stated; the end bar is covered by timing.)

`package.json`: `"compare-golden": "vite-node scripts/compare-golden.ts --"`.

- [ ] **Step 7: Compare**

Run: `cd engine && npm run compare-golden -- "$TMPDIR/golden-old.json" fixtures/golden.json`
Expected: `golden agrees modulo bar numbering`. Every difference is a bug in the migrator or the new engine: fix it
(re-run Steps 3, 5, 7 from a `git checkout engine/charts` reset), unless it is an intended change the spec names — then
list it in the PR body. Also diff `analysis.json` rows ignoring the leading `section bar`:
`diff <(jq -r '.[]|.rows[]' "$TMPDIR/analysis-old.json" | cut -d' ' -f2-) <(jq -r '.[]|.rows[]' fixtures/analysis.json | cut -d' ' -f3-)`
Expected: no output (reasons that name "the repeat at bar N" will differ by the section name; check each by eye).

- [ ] **Step 8: Full suite**

Run: `make test && make lint`
Expected: PASS. (`migrate.test.ts`'s library block now sees converted charts and returns them unchanged.)

- [ ] **Step 9: Commit**

```bash
git add engine/scripts/migrate-charts.ts engine/scripts/compare-golden.ts engine/package.json engine/charts engine/src/__tests__/goldenFixture.ts engine/fixtures/golden.json engine/fixtures/analysis.json
git commit -m "Library: every chart in section blocks; golden agrees modulo bar numbering (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docs, follow-ups, gates, PR

**Files:**
- Modify: `README.md` (chart format table and example), `docs/design.md` §4, `CLAUDE.md` ("Typical requests → Make a
  chart"), `docs/superpowers/specs/2026-10-16-section-blocks-design.md` (Status: built)

- [ ] **Step 1: README.md**

Replace the chart format section's example with a block chart (header, `section: A1`, rows `bar | chord [| scale [|
function]]`, `section: A2` / `copy: A1`, a `bars:` line with its reason) and the table rows: `section:`; section
fields `key:`, `time:`, `context:`, `bars:`, `outside:`, `copy:`; in-block `@key BAR KEY`, `@context BAR CONTEXT`,
`@ending N FIRST [LAST]`, `@segno BAR`, `@coda BAR`, `@nav BAR TEXT`. Remove `@copy` and the "@key holds through @copy"
gotcha. State that a section's key/time/context revert at its end.

- [ ] **Step 2: docs/design.md §4**

Rewrite the format subsection to match the spec's "Format and semantics" (rules 1–10), the layout (`sectionLayout`,
`at`), and add: "Bar labels are section-relative everywhere (`A2, bar 1`); no display shows absolute bar numbers
(decided 2026-10-16, #329)." Update the cell-validation note if it mentions the section cell.

- [ ] **Step 3: CLAUDE.md**

In "Make a chart": "one `section:` block per section, rows `bar | chord` numbered from 1 in each section, a repeat as
`section: A2` + `copy: A1`, and `bars: N` when a section's last chord is held past its last written bar". In "Design
rules", replace any mention of the section cell. Keep the rest.

- [ ] **Step 4: Follow-up issues**

```bash
gh issue create --title "Charts: fix prose comments that name absolute bars (after #329)" --label enhancement --body "$(cat <<'EOF'
The section-blocks migration (#329) rewrote `# alt:` lines but left prose comments that name a bar as written; their bar numbers are now absolute in a section-relative chart. List from `npm run migrate-charts` (one per line, `chart line N: text`):

<paste $TMPDIR/prose.txt here>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh issue edit 235 --body-file - <<'EOF'
<the current #235 body, plus a section:>
## Also: section metres (from #329)
#329 parses a section-level `time:` and carries it through `copy:`, but a section whose metre differs from the song's
gets the diagnostic "time: drawn in the song's metre until #235" and plays in the song's metre. This issue draws both:
per-bar beats through the timeline (`guideToneTimeline`), the bar index (`bars.ts`, `changes.ts`), arpeggio rhythms,
every line's `cellVoices`, VexFlow bars (`drawChangesLine`, `fitBars`) and a time signature wherever the metre changes.
Then remove that diagnostic.
EOF
```
(Read #235's current body with `gh issue view 235 --json body -q .body` and keep it, appending the section.)

- [ ] **Step 5: Gates**

Run: `make test && make lint && make e2e && make a11y`
Expected: all PASS. Report any failure with its output; don't push past one.

- [ ] **Step 6: Commit, push, PR**

```bash
git add README.md docs/design.md CLAUDE.md docs/superpowers/specs/2026-10-16-section-blocks-design.md docs/superpowers/plans/2026-10-16-section-blocks.md
git commit -m "Docs: the section-block chart format (#329)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin section-blocks
gh pr create --title "Chart format: section blocks (#329)" --body "$(cat <<'EOF'
Closes #329.

- `section:` blocks with section-relative bars and section fields (`key:`, `time:`, `context:`, `bars:`, `outside:`, `copy:`); in-block directives drop their section argument; `@copy` is gone.
- `sectionLayout` resolves blocks for timing, sheets, the editor and the analysis; a section's key and context revert at its end.
- `migrateChart` converts old text: the 379 library charts (golden agrees modulo bar numbering: `npm run compare-golden`), and saved charts, drafts and opened files as they open. Old share links (v1) no longer open.
- Section `time:` is parsed and carried but drawn in the song's metre until #235.
- Follow-up: prose comments naming absolute bars (#NNN).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Merge gate**

`gh pr checks <N> --watch` must exit 0 before `gh pr merge <N> --merge --delete-branch` (and only with the user's go).
