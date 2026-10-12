# Scales sheet, one line per scale: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Scales sheet draws each scale use once (Autumn Leaves: 14 lines, not 39 staves), labelled with the scale and the chords it covers.

**Architecture:** a pure engine function `scaleLines` groups the chart's rows into lines (scale + chord root + canonical quality) in first-appearance order; `buildSheet` builds one `StaffModel` per line from its first row; `ScaleStaff.vue` shows the scale, then the chord list.

**Tech Stack:** TypeScript (strict), Vitest, Vue 3 / Nuxt 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-scale-lines-design.md` (issue #189).

## Global Constraints

- Replaces the bar-for-bar Scales sheet; no feature flag.
- `engine/` stays free of Vue/DOM imports; the grouping lives in the engine.
- Lines: first-appearance order; identity = scale (root pitch class + canonical key from `parseScale`) + written chord root pitch class + `baseQuality` of its quality; a row whose scale or chord can't be read keys on its chord text + scale text.
- Label: the scale name large, then the chord symbols small, ` · ` between; no section, no bar.
- Unchanged: Spell Scale, transposition, key signatures, intervals, practice (boxes, presets, storage), share links, 12 staves a printed page, the Changes sheet.
- `make test` (typecheck + vitest) green after every task; `make lint` and `make e2e` green at the end.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by name.

## Review Focus

- **Same chord, two scales** (Autumn Leaves' E7 plays two scales): two lines, both listing `E7` — Task 1 test "keeps one chord on two lines when it plays two scales".
- **Enharmonic chord roots** (C♯m7 and D♭m7 in one chart): one line, both symbols listed — Task 1 test.
- **Unreadable rows among readable ones** (`Xyz`, an unknown scale, a blank scale on an unknown quality): each its own line in place, never merged into a readable line — Task 1 test.
- **Live editing**: adding a repeat of an existing chord further on must not change earlier lines' ids (no needless redraws) — Task 2 test "keeps ids when a repeat is added".
- **Long scale names in the 8rem label column** ("Phrygian Dominant", "Diatonic Diminished ♭VI"): wrap, not overflow into the staff — Task 2 Step 7 (no `whitespace-nowrap` on the scale) and the 390px-wide e2e check in `editor.spec.ts` keeps passing.

---

### Task 1: `scaleLines` in the engine

**Files:**
- Modify: `engine/src/sheet.ts`
- Test: `engine/src/__tests__/sheet.test.ts`
- Snapshot: `engine/src/__tests__/__snapshots__/api.test.ts.snap`

**Interfaces:**
- Produces: `export type ScaleLine = Readonly<{ row: number; chords: readonly string[] }>` and
  `export function scaleLines(rows: readonly Row[], scaleOf: (row: Row, index: number) => string | null): ScaleLine[]`
  (exported from `@chord-scale-maker/engine` via `export * from './sheet'`). `row` is the line's first row's index; `chords` the distinct chord texts in first-appearance order.

- [ ] **Step 1: Write the failing tests** — add to `engine/src/__tests__/sheet.test.ts` (import `scaleLines` from `'../sheet'` and `qualityScale` from `'../chart'`):

```ts
describe('scaleLines', () => {
  const lines = (rows: readonly Row[]) => scaleLines(rows, (r) => qualityScale(r))

  it('gives each scale use one line, in order of first appearance', () => {
    expect(lines([row('Cm7'), row('F7'), row('Cm7'), row('BbMaj7'), row('F7')])).toEqual([
      { row: 0, chords: ['Cm7'] },
      { row: 1, chords: ['F7'] },
      { row: 3, chords: ['BbMaj7'] },
    ])
    expect(lines([])).toEqual([])
  })

  it('merges chords of one root and canonical quality over one scale, listing each symbol once', () => {
    expect(lines([row('Cm9'), row('Cm7'), row('Cm9')])).toEqual([{ row: 0, chords: ['Cm9', 'Cm7'] }])
    expect(lines([row('C#m7', 'C# Dorian'), row('Dbm7', 'Db Dorian')])).toEqual([{ row: 0, chords: ['C#m7', 'Dbm7'] }])
    expect(lines([row('D7'), row('D7/F#')])).toEqual([{ row: 0, chords: ['D7', 'D7/F#'] }])
  })

  it('splits a scale over different qualities or roots', () => {
    expect(lines([row('CmMaj7', 'C Melodic Minor'), row('Cm6', 'C Melodic Minor')])).toHaveLength(2)
    expect(lines([row('C7', 'C Half-Whole'), row('C7b9', 'C Half-Whole')])).toHaveLength(2)
    expect(lines([row('DbMaj7/C', 'C Phrygian'), row('C7sus4b9', 'C Phrygian')])).toHaveLength(2) // a slash chord counts as written
  })

  it('keeps one chord on two lines when it plays two scales', () => {
    expect(lines([row('E7', 'E Mixolydian'), row('E7', 'E Altered'), row('E7', 'E Mixolydian')])).toEqual([
      { row: 0, chords: ['E7'] },
      { row: 1, chords: ['E7'] },
    ])
  })

  it('keeps rows it cannot read apart, merging only the same chord and scale text', () => {
    expect(lines([row('Cm7'), row('Xyz'), row('Cm7', 'C Dorain'), row('Xyz'), row('Cm7#5#9x'), row('Cm7', 'C Dorain')])).toEqual([
      { row: 0, chords: ['Cm7'] },
      { row: 1, chords: ['Xyz'] },
      { row: 2, chords: ['Cm7'] },
      { row: 4, chords: ['Cm7#5#9x'] },
    ])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/sheet.test.ts -t scaleLines`
Expected: FAIL, `scaleLines` is not exported.

- [ ] **Step 3: Implement** in `engine/src/sheet.ts`. Add imports `parseChord` (from `'./chord'`), `baseQuality` (from `'./qualities'`), `parseScale` (from `'./scales'`), `pcOf` (from `'./pitch'`). Then, after `StaffModel`:

```ts
/** one line of the scale sheet: the rows that play one scale over one chord (row: the first; chords: as written, once each) */
export type ScaleLine = Readonly<{ row: number; chords: readonly string[] }>

/** what puts two rows on one line: the scale and the written chord's root and canonical quality; text when either can't be read */
function lineKey(chord: string, scale: string | null): string {
  const read = orNull(() => {
    const s = parseScale(scale ?? '')
    const c = parseChord(chord)
    const quality = baseQuality(c.quality)
    return quality === null ? null : [pcOf(s.root), s.key, pcOf(c.root), quality].join(' ')
  })
  return read ?? `?${chord}|${scale ?? ''}`
}

/** the chart's rows as scale sheet lines, in order of first appearance */
export function scaleLines(rows: readonly Row[], scaleOf: (row: Row, index: number) => string | null): ScaleLine[] {
  const lines = new Map<string, { row: number; chords: string[] }>()
  rows.forEach((r, i) => {
    const key = lineKey(r.chord, scaleOf(r, i))
    const line = lines.get(key)
    if (!line) lines.set(key, { row: i, chords: [r.chord] })
    else if (!line.chords.includes(r.chord)) line.chords.push(r.chord)
  })
  return [...lines.values()]
}
```

(`orNull` from `./util` returns the function's result, or null if it throws; a null quality passes through as null.)

- [ ] **Step 4: Run to verify they pass**

Run: `cd engine && npx vitest run src/__tests__/sheet.test.ts -t scaleLines`
Expected: PASS.

- [ ] **Step 5: Update the API snapshot and review its diff** (one name added, `scaleLines`; types aren't runtime names)

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__/`
Expected: one added line, `"scaleLines",`.

- [ ] **Step 6: `make test`**, expect green.

- [ ] **Step 7: Commit**

```bash
git add engine/src/sheet.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "scaleLines: a chart's rows as scale sheet lines (#189)"
```

---

### Task 2: one staff per line, labelled with the scale and its chords

**Files:**
- Modify: `engine/src/sheet.ts` (`StaffModel`, `staff`, `buildSheet`)
- Modify: `web/app/components/ScaleStaff.vue` (label column)
- Test: `engine/src/__tests__/sheet.test.ts`, `engine/src/__tests__/practice.test.ts` (only if a test relied on repeats), `web/test/ScaleSheet.test.ts`, new `web/test/ScaleStaff.test.ts`

**Interfaces:**
- Consumes: `scaleLines`, `ScaleLine` (Task 1).
- Produces: `StaffModel` without `section`/`bar`; `chord` replaced by `chords: readonly (readonly ChordToken[] | null)[]`. `buildSheet`'s signature is unchanged.

- [ ] **Step 1: Rewrite the sheet tests that assumed one staff per row.** In `engine/src/__tests__/sheet.test.ts` add a helper under `row`:

```ts
/** n rows that are n different lines: m7 chords on the 12 roots, then 7ths */
const distinct = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => row(`${['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][i % 12]}${i < 12 ? 'm7' : '7'}`, '', String(i + 1)))
```

Then:
- 'builds one part per mode with pages of perPage staves': `const rows = distinct(13)` in place of 13 × Cm7.
- 'fills in default scales and spells the notes': `expect(s.chords).toEqual([[{ kind: 'text', text: 'C–7' }]])`.
- 'reports staves that need attention': `expect(unknown?.chords[0]).not.toBeNull()`, `expect(bad).toMatchObject({ chords: [null], error: "Can't read this chord" })`, `typo` → `chords: [[{ kind: 'text', text: 'C–7' }]]`.
- 'gives staves stable ids…': replace the `[a, b]` lines with
  ```ts
  const [a, b] = id([row('Cm7'), row('F7')])
  expect(a).not.toBe(b)
  ```
- Add:

```ts
  it('draws each line once, listing its chords', () => {
    const s = staves([row('Cm7'), row('F7'), row('Cm9'), row('F7')])
    expect(s.map((st) => st.chords.length)).toEqual([2, 1])
    expect(s[0]?.chords[1]).toEqual([{ kind: 'text', text: 'C–9' }])
    expect(s.map((st) => st.last)).toEqual([false, true])
  })

  it('keeps ids when a repeat is added', () => {
    const ids = (rows: readonly Row[]) => staves(rows).map((s) => s.id)
    expect(ids([row('Cm7'), row('F7'), row('Cm7')])).toEqual(ids([row('Cm7'), row('F7')]))
  })

  it('gives Autumn Leaves 14 lines', () => {
    const doc = parseChart(readFileSync(new URL('../../charts/autumn-leaves.txt', import.meta.url), 'utf8')).value
    const sheet = buildSheet(expandRows(doc).value, CONCERT, 'root', 'C', 12, null, undefined, resolveScales(doc, { level: 'standard', seed: 0 }))
    expect(sheet[0]?.pages.map((p) => p.length)).toEqual([12, 2])
  })
```
(`import { readFileSync } from 'node:fs'`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/sheet.test.ts`
Expected: FAIL (no `chords`; 39 staves).

- [ ] **Step 3: Change `StaffModel`** in `engine/src/sheet.ts`: delete `section` and `bar`; replace `chord` with

```ts
  chords: readonly (readonly ChordToken[] | null)[] // the line's chord symbols, as written, once each (null: can't be read)
```
and update the `id` comment: `// unique per sheet; stable while the line's scale, chords and the view are unchanged`. Update the file comment: "every scale sheet line (`scaleLines`) becomes a StaffModel".

- [ ] **Step 4: Change `staff` and `buildSheet`.** `staff` takes the line's chords and drops `index`:

```ts
function staff(
  row: Row,
  chordTexts: readonly string[],
  scale: string | null,
  part: Part,
  mode: Mode,
  start: Start,
  last: boolean,
  startText: string,
  practice: PracticeSelection | null,
  key: Key | null | undefined,
  showClefAndKey: boolean,
): StaffModel {
  const startKey = 'midi' in start ? start.midi : start.error
  const keySig = key === undefined ? null : keySignature(key, part)
  const id = [chordTexts.join(' '), scale, part.clef, part.trans, mode, startKey, keySig, showClefAndKey ? '' : 'bare'].join('|')
  const base = { id, last, keySig, showClefAndKey }
  const chords = chordTexts.map((c) => chordTokensOrNull(part, c, scale))
  const none = { notes: [], accidentals: [], intervals: null, keys: null, selected: null }
  if (scale === null) return { ...base, ...none, chords, scale: null, error: chords[0] ? 'Choose a scale' : "Can't read this chord" }
```
and in the rest of the body replace `chord,` with `chords,` (three places). In `buildSheet`:

```ts
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  return modesFor(choice).map((mode) => {
    const start = startFor(part, mode, startText)
    return {
      mode,
      heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
      pages: chunk(
        lines.map((l, n) => {
          const r = rows[l.row] as Row
          return staff(r, l.chords, scaleOf(r, l.row), part, mode, start, n === lines.length - 1, startText, practice, key, key === undefined || n === 0)
        }),
        perPage,
      ),
    }
  })
```
Update `buildSheet`'s doc comment: "one part per mode, each split into pages of perPage lines (`scaleLines`)".

- [ ] **Step 5: Run the engine tests**

Run: `cd engine && npx vitest run`
Expected: PASS. If a `practice.test.ts` case now merges rows it meant as separate staves, make its rows distinct (different roots); don't change expected picks.

- [ ] **Step 6: Write the failing component test** `web/test/ScaleStaff.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { buildSheet, CONCERT, type Row } from '@chord-scale-maker/engine'
import ScaleStaff from '~/components/ScaleStaff.vue'

const row = (chord: string, bar: string): Row => ({ section: 'A', bar, chord, scale: '' })

describe('ScaleStaff', () => {
  it('labels a line with its scale, then every chord on it, and no bar', async () => {
    const [staff] = buildSheet([row('Cm7', '1'), row('Cm9', '5')], CONCERT, 'root', 'C', 12)[0]?.pages.flat() ?? []
    const w = await mountSuspended(ScaleStaff, { props: { staff, clef: 'treble' } })
    const label = w.find('.text-right').text()
    expect(label).toMatch(/^C\s*Dorian/)
    expect(label).toContain('C–7 · C–9')
    expect(label).not.toContain('Bar')
  })
})
```
If VexFlow fails to load under the test DOM, stub the draw the way `web/test/ChangesSystem.test.ts` does (it mocks `loadVexFlow`); copy that pattern.

- [ ] **Step 7: Run it to verify it fails** (`cd web && npx vitest run test/ScaleStaff.test.ts`, expect FAIL: `staff.section` undefined / no ` · `). Then change the label column in `web/app/components/ScaleStaff.vue`:

```vue
    <div class="text-right leading-tight">
      <div v-if="staff.scale" class="text-base font-semibold"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400 print:text-neutral-600">
        <template v-for="(tokens, i) in staff.chords" :key="i"><span v-if="i" aria-hidden="true"> · </span><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>—</span></template>
      </div>
    </div>
```
(No `whitespace-nowrap`: a long scale name wraps inside the label column.)

- [ ] **Step 8: Update `web/test/ScaleSheet.test.ts`.** Its `rows` (13 × Cm7) are now one line: replace with 13 distinct rows

```ts
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const rows: Row[] = Array.from({ length: 13 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: `${ROOTS[i % 12]}${i < 12 ? 'm7' : '7'}`, scale: '' }))
```
Keep `rows.slice(0, 1)` tests (still Cm7). Expected page split `[12, 1, 12, 1]` stays.

- [ ] **Step 9: `make test` and `make lint`**, expect green (the typecheck catches any remaining `staff.chord`/`section`/`bar` use; there should be none outside `ScaleStaff.vue`).

- [ ] **Step 10: Commit**

```bash
git add engine/src/sheet.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/practice.test.ts web/app/components/ScaleStaff.vue web/test/ScaleStaff.test.ts web/test/ScaleSheet.test.ts
git commit -m "Scales sheet: one line per scale, labelled with its chords (#189)"
```
(Leave `practice.test.ts` out if unchanged.)

---

### Task 3: browser tests and design notes

**Files:**
- Modify: `web/e2e/print.spec.ts`, `web/e2e/transposition.spec.ts`, `web/e2e/editor.spec.ts`
- Modify: `docs/design.md` (§Scale sheet, §Practice selection where it says "per staff", the page-count notes near lines 932 and 973, §12 Decisions)

**Interfaces:** consumes Task 2's sheet as drawn.

- [ ] **Step 1: Re-pin Autumn Leaves on the Scales sheet** (14 lines; 12 a printed page → 2 pages):
  - `print.spec.ts`: comment → `// 14 lines at 12 staves per letter page, even when every staff has ledger lines (trombone from B)`; `toHaveCount(39)` → `14`; `toBe(4)` → `2`.
  - `transposition.spec.ts:33`: `39` → `14`.
  - `editor.spec.ts`: practice test `78` → `28` (both places; comment `// two per staff, 14 lines`), its pdf `toBe(4)` → `toBe(2)`; focus test title "still prints 4 pages" → "still prints 2 pages", comment `// 14 lines, 2 printed pages`, `toHaveCount(39)` → `14`, `.length).toBe(4)` → `2`.

- [ ] **Step 2: Add an e2e check of the label** in `editor.spec.ts`, after `scaleStaves`:

```ts
test('the Scales sheet draws each scale once, naming the chords it covers', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: Bb\nA | 1 | Cm7\nA | 2 | F7\nA | 3 | Cm9\nA | 4 | F7\n')
  await chooseSheet(page, 'Scales')
  await expect(scaleStaves(page)).toHaveCount(2)
  await expect(scaleStaves(page).nth(0)).toContainText('C–7 · C–9')
  await expect(scaleStaves(page).nth(0)).not.toContainText('Bar')
})
```

- [ ] **Step 3: Run the browser tests**

Run: `make e2e`
Expected: PASS. Any other failure that counts Scales sheet staves: re-pin it only after checking the new count is the chart's distinct lines (run the Task 2 sheet with that chart), and say so in the commit message.

- [ ] **Step 4: Update `docs/design.md`:**
  - §Scale sheet, **Layout:** "one `ScaleStaff` per line: each scale a chart uses, once (`scaleLines`: the scale, the written chord's root and canonical quality; first-appearance order). An HTML label column on the left holds the scale name and, under it, the chord symbols the line covers (`Cm7 · Cm9`)…"
  - **View model:** "…each staff's `id` combines its line's chords and scale, the part and the mode", not its position.
  - The page-count notes (Autumn Leaves 4 pages → 2).
  - §12 Decisions: add "**One line per scale on the Scales sheet** (#189): the sheet is a tune's scale vocabulary; the Changes sheet follows the form. Lines merge by scale, chord root and canonical quality, so interval labels and presets hold for every chord on a line."

- [ ] **Step 5: Commit**

```bash
git add web/e2e/print.spec.ts web/e2e/transposition.spec.ts web/e2e/editor.spec.ts docs/design.md
git commit -m "Browser tests and design notes for one line per scale (#189)"
```
