# Chart functions, `@key` areas and live notes: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chart authors can state a row's harmonic function (`| V7/V`, `| D: V7/ii`) and pin key areas (`@key B 17 D`).
The analyser decides scales from those statements. Every chart shows live notes on why each scale was chosen.

**Architecture:**
- **Parser (`chart.ts`):** reads an optional fifth cell, `function`, and an `@key` line.
- **`analysis/functions.ts`:** reads a function and checks it against its chord.
- **Analyser:** turns a stated function into a *virtual target*: extra stream entries after the real ones, wired as
  the stated row's `next`. Every existing rule then decides through its usual path.
- **Views:** live notes and each row's function choices (Auto plus every function that fits, with the scale each
  gives) come from pure engine helpers (`notes.ts`, `functionChoices`) and new `buildChanges` fields. The grid edits
  functions with a dropdown and `@key` lines with a key select; the Changes sheet shows the notes. All of it is
  behind the `functions` flag.

**Tech Stack:** TypeScript (strict), Vitest (`--project engine` and the Nuxt project), Nuxt 4 / Vue 3, Tailwind,
Catalyst UI ports in `web/app/components/ui/`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-chart-functions-design.md`

## Global Constraints

- Run every command from `web/` unless shown otherwise. `make test` (from the repo root) = typecheck + vitest.
- `web/engine/` stays free of Vue/DOM imports. View logic that can be pure goes in the engine.
- No new runtime dependencies. Pages must run under the hashed CSP: no inline scripts, no `eval`.
- New feature flags start off. The `e2e` npm script turns every flag on.
- The analyser **never writes** a function cell or an `@key` line.
- After any engine change that moves answers, run `make golden` and review `fixtures/` diffs. None are expected:
  no library chart has a function yet.
- TDD: write the test, watch it fail, implement, watch it pass, commit. Stage files by name, never `git add -A`.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comment density and voice: match the surrounding file (short `/** … */` docs on exports, few inline comments).

## Review Focus

1. **An existing five-cell "bad line" is now a valid row.** `e2e/editor.spec.ts:18` uses
   `A | 1 | Cm7 | C Dorian | extra` as its broken line, and it must become six cells or the test stops testing
   anything. *Task 1.*
2. **Clearing the Function cell must remove the fifth cell entirely,** not leave `| |` behind. Clearing the scale
   on a row with a function must keep the function. *Task 1.*
3. **A function on a chord the analyser can't read** (`Hm7 | | ii7`) is reported, never thrown. *Task 3.*
4. **An `@key` naming a bar that doesn't exist** is reported, and the key areas stay as found. *Task 3.*
5. **Held chords (`D7 | D7`) whose functions differ must not merge into one stream entry.** A later row with no
   function still merges. *Task 3.*

## Changes from the spec

Found while planning. These are applied to the spec in Task 0.

- **Spec example:** the spec's Misty example was wrong: `V7/V` in E♭ is F7, not B♭7. The examples now use
  `D7 | | V7/V` in C, and Misty bar 23 `Bb7 | | V7`.
- **Fallback flag:** "Fallback" is a flag on `Decision` (`fallback?: true`), set where those rules return. A list of
  rule ids can't express it: `D5` covers both the back door (sure) and "not resolving" (a guess).
- **Key areas in the report:** the ambiguity report lists every *found* key area that differs from the home key,
  each with the `@key` line that would pin it, plus a missing `key:` line. The analyser has no "scored-only" area to
  report: every area comes from a cadence.
- **Tooltip:** the Changes sheet uses a tooltip in `HelpTip.vue`'s pattern (hover, focus and tap, Escape closes),
  not a Headless UI `Popover`. It's the pattern the app already uses, and it's accessible.
- **Key prefix:** a row's key prefix (`D:`) decides that row only and does not open a key area. `RowAnalysis` keeps
  the area's `key` and adds `statedKey`.
- **Reason format:** a stated row's reason is the rule's reason plus ` (stated)`.
- **Grid editing:** the grid edits a function with a dropdown, not free text. The dropdown holds Auto (the
  analyser's reading) and every function that fits the chord in its key area, each with the scale it gives. A
  key-prefixed function is written in the text editor; the dropdown keeps it as its current value.
- **`@key` in the grid:** `@key` rows have a key select, and each chord row has a "Key change at row N" button that
  inserts an `@key` above it. Moving an `@key` line stays in the text.
- **Suggestions:** the ambiguity report's suggestions are the dropdown's list without the chord's own degree.

---

### Task 0: Bring the spec in line

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-chart-functions-design.md`

- [ ] **Step 1: Apply the "Changes from the spec" list above.**
  - **Example:** in §2 "Rules", replace the Misty example with: "Example: `D7 | | V7/V` in C, where D7 goes on to
    Dm7. The target is G major, so the V7 rule (D4) applies with natural tensions, where today the D7 is 'II7 in
    C, not resolving' (D5)."
  - **Fallback:** in "Ambiguity report", replace "The fallback rule ids are listed as a constant…" with "Rules mark
    a guess with `fallback: true` on their `Decision`."
  - **Key areas:** replace the key-area bullet with: "found key areas other than the home key, each with the
    `@key` line that would pin it; a missing `key:` line."
  - **Tooltip:** in §3 "Changes sheet", replace "Headless UI `Popover`" with "a tooltip in `HelpTip.vue`'s pattern".
  - **Key prefix:** in §2 "Key areas", add "A prefix doesn't open a key area: `RowAnalysis.key` stays the area,
    `statedKey` is the prefix."
  - **Reason:** in §2 "Rules", change the reason example to `V7/V in C: natural tensions (stated)`.
  - **Grid:** in §3 "Editor grid", replace the Function column's free-text cell with "a dropdown: Auto (the
    analyser's reading), then every function that fits the chord in its key area, each with the scale it gives; a
    key-prefixed function from the text shows as its current value." Replace the `@key` bullet with "a key select
    on each `@key` row, and a 'Key change at row N' button on each chord row." Drop "Editing `@key` lines in the
    grid" from Out of scope.
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-09-chart-functions-design.md
git commit -m "Spec: corrections found while planning chart functions"
```

---

### Task 1: The format: a function cell and `@key` lines

**Files:**
- Modify: `web/engine/chart.ts` (types at :24-38, `parseLine` :44-94, `serializeChart` :117-150, `expandRowLines`
  :212)
- Modify: `web/engine/analysis/keys.ts:17-22` (`parseKey` reuses the shared key regex)
- Modify: `web/engine/edit.ts:8`, `:28-32` (`RowField`, `setRowField`)
- Modify: `web/e2e/editor.spec.ts:18` (the broken line needs six cells now)
- Test: `web/engine/__tests__/chart.test.ts`, `web/engine/__tests__/edit.test.ts`,
  `web/engine/__tests__/share.test.ts`

**Interfaces:**
- Produces:
  - `ChartLine` row gains `function?: string`, which is absent when not written and never `''`.
  - New line `{ kind: 'key'; section: string; bar: number; key: string }`.
  - `Row` gains `function?: string`, and `LinedRow` gets it through `expandRowLines`.
  - `export const KEY_TEXT_RE: RegExp` in `chart.ts`.
  - `RowField` gains `'function'`, and `setRowField(doc, i, 'function', '')` removes the field.
  - `setKeyLine(doc: ChartDoc, i: number, key: string): ChartDoc` and
    `insertKeyBefore(doc: ChartDoc, i: number, key: string): ChartDoc`, both in `edit.ts`.

- [ ] **Step 1: Write the failing tests** (append to `web/engine/__tests__/chart.test.ts`; add `expandRowLines` to
  its import from `'../chart'` if it isn't there)

```ts
describe('the function cell and @key lines', () => {
  it('reads an optional fifth cell as the function, with or without a scale', () => {
    const { value, diagnostics } = parseChart('A | 1 | F7 | F Mixolydian | V7/V\nA | 2 | Bb7 |  | D: V7/ii\nA | 3 | F7\nA | 4 | F7 | |\n')
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'row', section: 'A', bar: '1', chord: 'F7', scale: 'F Mixolydian', function: 'V7/V' },
      { kind: 'row', section: 'A', bar: '2', chord: 'Bb7', scale: '', function: 'D: V7/ii' },
      { kind: 'row', section: 'A', bar: '3', chord: 'F7', scale: '' },
      { kind: 'row', section: 'A', bar: '4', chord: 'F7', scale: '' }, // an empty fifth cell is no function
    ])
  })

  it('rejects a sixth cell', () => {
    expect(parseChart('A | 1 | Cm7 | C Dorian | ii7 | extra\n').diagnostics[0]?.message).toBe('expected  section | bar | chord [| scale [| function]]')
  })

  it('writes functions back aligned, with comments after them', () => {
    const text =
      'A | 1 | F7     | F Mixolydian | V7/V  # x\n' +
      `A | 2 | Bb7    | ${' '.repeat(12)} | V7    # y\n` +
      'A | 3 | EbMaj7 | Eb Ionian\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('reads @key SECTION BAR KEY and writes it back', () => {
    const { value, diagnostics } = parseChart('@key B 17 D\n@key A3 25 Bb minor\n')
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'key', section: 'B', bar: 17, key: 'D' },
      { kind: 'key', section: 'A3', bar: 25, key: 'Bb minor' },
    ])
    expect(serializeChart(value)).toBe('@key B 17 D\n@key A3 25 Bb minor\n')
  })

  it('rejects a malformed @key', () => {
    for (const bad of ['@key B 17', '@key B x D', '@key B 17 H', '@key B 17 Dorian', '@key B 17 d'])
      expect(parseChart(bad).diagnostics[0]?.message, bad).toBe('use  @key SECTION BAR KEY  (a key like Eb or Cm)')
  })

  it("copies a row's function to its @copy repeats", () => {
    const rows = expandRowLines(parseChart('A | 1 | D7 |  | V7/V\n@copy A B 8\n').value).value
    expect(rows.map((r) => `${r.section} ${r.bar} ${r.function}`)).toEqual(['A 1 V7/V', 'B 9 V7/V'])
  })
})
```

Append to `web/engine/__tests__/edit.test.ts` (import `serializeChart` from `'../chart'`, and `insertKeyBefore` and
`setKeyLine` from `'../edit'`):

```ts
describe('the function cell', () => {
  it('sets a function, and clearing it drops the fifth cell', () => {
    const set = setRowField(parseChart('A | 1 | D7\n').value, 0, 'function', 'V7/V')
    expect(serializeChart(set)).toBe('A | 1 | D7 |  | V7/V\n')
    const cleared = setRowField(set, 0, 'function', '')
    expect(cleared.lines[0]).not.toHaveProperty('function')
    expect(serializeChart(cleared)).toBe('A | 1 | D7\n')
  })

  it('keeps the function when the scale is cleared', () => {
    const doc = parseChart('A | 1 | D7 | D Mixolydian | V7/V\n').value
    expect(serializeChart(setRowField(doc, 0, 'scale', ''))).toBe('A | 1 | D7 |  | V7/V\n')
  })
})

describe('@key lines', () => {
  it('starts a key change at a row, and changes its key', () => {
    const doc = parseChart('A | 1 | Cm7\nB | 9 | DMaj7\n').value
    const added = insertKeyBefore(doc, 1, 'D')
    expect(serializeChart(added)).toBe('A | 1 | Cm7\n@key B 9 D\nB | 9 | DMaj7\n')
    expect(serializeChart(setKeyLine(added, 1, 'Eb'))).toBe('A | 1 | Cm7\n@key B 9 Eb\nB | 9 | DMaj7\n')
  })

  it('leaves the doc alone for a line that is not a row, or a bar that is not a whole number', () => {
    const doc = parseChart('# note\nA | 1a | Cm7\n').value
    expect(insertKeyBefore(doc, 0, 'D')).toBe(doc)
    expect(insertKeyBefore(doc, 1, 'D')).toBe(doc)
    expect(setKeyLine(doc, 1, 'D')).toBe(doc)
  })
})
```

Append inside the existing `describe` in `web/engine/__tests__/share.test.ts`:

```ts
  it('carry function cells and @key lines unchanged', async () => {
    const chart = 'title: T\nA | 1 | D7 |  | V7/V\n@key A 1 D\n'
    expect((await decodeShare(await encodeShare({ chart })))?.chart).toBe(chart)
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project engine engine/__tests__/chart.test.ts engine/__tests__/edit.test.ts engine/__tests__/share.test.ts`
Expected: FAIL. Five cells give "expected  section | bar | chord [| scale]", `@key` gives an invalid line, and
`setRowField` rejects `'function'` at typecheck. (The share test may already pass; it is a guard.)

- [ ] **Step 3: Implement** in `web/engine/chart.ts`:

```ts
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  // scale '' = default; function: the author's harmonic function (V7/ii, D: V7/ii), absent when not written;
  // comment: a trailing "# …" (the analysis, docs/plan-analysis.md §12.1), kept verbatim
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string; function?: string; comment?: string }>
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'ending'; n: number; section: string; from: number; to: number }>
  | Readonly<{ kind: 'mark'; mark: 'segno' | 'coda'; section: string; bar: number }>
  | Readonly<{ kind: 'nav'; section: string; bar: number; text: string }>
  // the author's key area, from this bar until the next @key
  | Readonly<{ kind: 'key'; section: string; bar: number; key: string }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
```

```ts
export type Row = Readonly<{ section: string; bar: string; chord: string; scale: string; function?: string }>
```

Next to `INT_RE`:

```ts
/** a key as `key:` and `@key` take it: "Eb", "F#m", "Bb minor", "C-" */
export const KEY_TEXT_RE = /^([A-G][b#]?)\s*(m|-|min|minor|major|maj)?$/i
```

In `parseLine`, after the `@nav` block:

```ts
  if (low.startsWith('@key')) {
    const m = /^@key\s+(\S+)\s+(\S+)\s+(.+)$/i.exec(line)
    const k = (m?.[3] ?? '').trim()
    // KEY_TEXT_RE is case-blind for its suffix (Bb Minor); the note letter must still be a capital
    if (!m || !INT_RE.test(m[2] ?? '') || !KEY_TEXT_RE.test(k) || !/^[A-G]/.test(k)) return 'use  @key SECTION BAR KEY  (a key like Eb or Cm)'
    const [, section = '', bar = '', key = ''] = m
    if (section.length > LIMITS.maxCell) return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'key', section, bar: Number(bar), key: key.trim() }
  }
```

The row branch:

```ts
  const cells = body.split('|').map((c) => c.trim())
  if (cells.length < 3 || cells.length > 5) return 'expected  section | bar | chord [| scale [| function]]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  if (comment !== undefined && comment.length > LIMITS.maxMeta) return `comment longer than ${LIMITS.maxMeta} characters`
  const [section = '', bar = '', chord = '', scale = '', fn = ''] = cells
  return { kind: 'row', section, bar, chord, scale, ...(fn ? { function: fn } : {}), ...(comment === undefined ? {} : { comment }) }
```

In `serializeChart`, replace the `wsc` line and the `'row'` case, and add a `'key'` case:

```ts
  // scales line up where a comment or a function follows them; functions where a comment follows
  const wsc = Math.max(0, ...rows.filter((r) => r.comment !== undefined || r.function !== undefined).map((r) => r.scale.length))
  const wf = Math.max(0, ...rows.filter((r) => r.function !== undefined && r.comment !== undefined).map((r) => (r.function ?? '').length))
```

```ts
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
        const tail = l.comment !== undefined ? `  #${l.comment ? ` ${l.comment}` : ''}` : ''
        if (l.function !== undefined) {
          const fn = l.comment !== undefined ? l.function.padEnd(wf) : l.function
          return `${head}${l.chord.padEnd(wc)} | ${l.scale.padEnd(wsc)} | ${fn}${tail}`
        }
        if (l.comment !== undefined) {
          const cells = l.scale ? `${l.chord.padEnd(wc)} | ${l.scale.padEnd(wsc)}` : l.chord.padEnd(wc)
          return `${head}${cells}${tail}`
        }
        return l.scale ? `${head}${l.chord.padEnd(wc)} | ${l.scale}` : `${head}${l.chord}`
      }
```

```ts
      case 'key':
        return `@key ${l.section} ${l.bar} ${l.key}`
```

In `expandRowLines`:

```ts
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale, ...(l.function ? { function: l.function } : {}), line: i })
```

In `web/engine/analysis/keys.ts`, add `import { KEY_TEXT_RE } from '../chart'` and change the first line of
`parseKey`:

```ts
  const m = KEY_TEXT_RE.exec(text.trim())
```

In `web/engine/edit.ts`:

```ts
export type RowField = 'section' | 'bar' | 'chord' | 'scale' | 'function'
```

```ts
/** set one field of the row at line index i (a no-op if that line is not a row); an empty function removes it */
export function setRowField(doc: ChartDoc, i: number, field: RowField, value: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row') return doc
  if (field === 'function' && !value) {
    const { function: _, ...rest } = line
    return { lines: replaceAt(doc.lines, i, rest) }
  }
  return { lines: replaceAt(doc.lines, i, { ...line, [field]: value }) }
}

/** set an @key line's key (a no-op if line i isn't one) */
export function setKeyLine(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  return line?.kind === 'key' ? { lines: replaceAt(doc.lines, i, { ...line, key }) } : doc
}

/** an @key line just above the row at line i, from its section and bar (a no-op for a non-row or a bar like "1a") */
export function insertKeyBefore(doc: ChartDoc, i: number, key: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row' || !/^\d{1,6}$/.test(line.bar)) return doc
  return { lines: [...doc.lines.slice(0, i), { kind: 'key', section: line.section, bar: Number(line.bar), key }, ...doc.lines.slice(i)] }
}
```

In `web/e2e/editor.spec.ts:18`, make the broken line six cells:

```ts
  await page.getByLabel('Chart text').fill('title: T\nA | 1 | Cm7 | C Dorian | ii7 | extra\n')
```

- [ ] **Step 4: Run the tests and the full suite**

Run: `npx vitest run --project engine engine/__tests__/chart.test.ts engine/__tests__/edit.test.ts engine/__tests__/share.test.ts`
Expected: PASS.
Run (repo root): `make test`
Expected: PASS. `serializeChart`'s switch must still be exhaustive (typecheck); `golden.test.ts` and
`analysis.fixture.test.ts` unchanged.

- [ ] **Step 5: Commit**

```bash
git add web/engine/chart.ts web/engine/analysis/keys.ts web/engine/edit.ts web/e2e/editor.spec.ts web/engine/__tests__/chart.test.ts web/engine/__tests__/edit.test.ts web/engine/__tests__/share.test.ts
git commit -m "Chart format: an optional function cell and @key lines"
```

---

### Task 2: Reading a function: `analysis/functions.ts`

**Files:**
- Create: `web/engine/analysis/functions.ts`
- Modify: `web/engine/analysis/numerals.ts:24-28` (export `glyph`; `own` becomes the exported `ownNumeral`)
- Modify: `web/engine/analysis/stream.ts:13-33` (export `familyOf`)
- Test: `web/engine/__tests__/functions.test.ts`

**Interfaces:**
- Consumes: `parseKey`, `sameKey`, `Key`, `keyText` from `./keys`; `roman` from `./rules`; `Family` and `Entry` from
  `./stream`; `parseRoot`, `rootName`, `shiftBy`, `pcOf`, `mod`, `Spelled` from `../pitch`.
- Produces:
  - **Types:** `type Degree = Readonly<{ steps: number; semis: number }>`;
    `type Target = Degree & Readonly<{ minor: boolean }>`;
    `type StatedFunction = Readonly<{ text: string; key: Key | null; sub: boolean; degree: Degree; family: Family; target: Target | null }>`
  - **Reading:** `parseFunction(text: string): StatedFunction | string`, where a string is an error;
    `sameFunction(a: string, b: string): boolean`.
  - **Targets and roots:** `impliedTarget(f: StatedFunction, key: Key): Target | null`; `tonicOf(key: Key): Spelled`;
    `functionRoot(f: StatedFunction, key: Key): Spelled`.
  - **Checking:**
    `fitError(f: StatedFunction, chord: Readonly<{ chord: string; pc: number; family: Family | null }>, key: Key): string | null`
  - **Offering:**
    `functionCandidates(e: Readonly<{ pc: number; family: Family | null; quality: string }>, key: Key): string[]`.
    These are the functions that fit the chord in its key area, in the order the grid's dropdown lists them, ending
    with the chord's own degree.
  - **Exports from neighbouring files:** `numerals.ts` exports `glyph` and
    `ownNumeral(e: Pick<Entry, 'pc' | 'family' | 'quality'>, key: Key): string`; `stream.ts` exports
    `familyOf(quality: string): Family | null`.

- [ ] **Step 1: Write the failing tests** (`web/engine/__tests__/functions.test.ts`)

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { fitError, functionCandidates, functionRoot, impliedTarget, parseFunction, sameFunction, type StatedFunction } from '../analysis/functions'
import { type Key, parseKey } from '../analysis/keys'
import { familyOf } from '../analysis/stream'
import { parseChart } from '../chart'
import { pcOf, rootName } from '../pitch'
import { readChord } from '../qualities'
import { isSyncCopy } from '../util'

const fn = (text: string): StatedFunction => {
  const f = parseFunction(text)
  if (typeof f === 'string') throw new Error(f)
  return f
}
const key = (text: string): Key => {
  const k = parseKey(text)
  if (!k) throw new Error(text)
  return k
}
const LIBRARY = new URL('../../../charts/', import.meta.url)
const libraryRows = () =>
  readdirSync(LIBRARY)
    .filter((x) => x.endsWith('.txt') && !isSyncCopy(x))
    .flatMap((f) => analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows.map((r) => ({ f, r })))

describe('parseFunction', () => {
  it("reads the Changes sheet's numerals and their ASCII spellings into one form", () => {
    const cases: [string, string][] = [
      ['V7/ii', 'V7/ii'],
      ['subV7/IV', 'subV7/IV'],
      ['ii7/V', 'ii7/V'],
      ['iim7b5/vi', 'iiø7/vi'],
      ['bVII7', '♭VII7'],
      ['viio7/ii', 'vii°7/ii'],
      ['IVMaj7', 'IVmaj7'],
      ['IΔ7', 'Imaj7'],
      ['I6', 'I6'],
      ['V7sus4', 'V7sus'],
      ['#ivø', '♯ivø7'],
      ['i(maj7)', 'i(maj7)'],
      ['♭VI7', '♭VI7'],
    ]
    for (const [input, text] of cases) expect(fn(input).text, input).toBe(text)
  })

  it('reads the family from the case and the quality', () => {
    expect(['V7', 'ii7', 'iiø7', 'vii°7', 'IVmaj7', 'vi', 'V7sus', 'I'].map((t) => fn(t).family)).toEqual([
      'dominant', 'minor', 'halfdim', 'dim', 'major', 'minor', 'sus', 'major',
    ])
  })

  it('reads a key before a colon, and keeps it out of the text', () => {
    expect([fn('D: V7/ii').key?.name, fn('D: V7/ii').text]).toEqual(['D major', 'V7/ii'])
    expect(fn('Bbm: iiø7').key?.name).toBe('Bb minor')
    expect(fn('V7').key).toBeNull()
  })

  it('says what is wrong with a function it cannot read', () => {
    expect(parseFunction('X7')).toBe('"X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)')
    expect(parseFunction('subii7')).toBe('sub only goes on a dominant (subV7)')
    expect(parseFunction('ivmaj7')).toBe('ivmaj7: a major quality on a lower-case numeral')
    expect(parseFunction('H: V7')).toBe('"H" isn\'t a key (Eb, Cm)')
  })

  it('knows two spellings of one function', () => {
    expect(sameFunction('bVII7/III', '♭VII7/III')).toBe(true)
    expect(sameFunction('D: V7/ii', 'D:V7/ii')).toBe(true)
    expect(sameFunction('V7/ii', 'D: V7/ii')).toBe(false)
    expect(sameFunction('X7', 'X7')).toBe(false) // not a function at all
  })
})

describe('where a function puts its chord', () => {
  it('names the root', () => {
    expect(rootName(functionRoot(fn('V7/V'), key('Eb')))).toBe('F')
    expect(rootName(functionRoot(fn('subV7/IV'), key('C')))).toBe('Gb')
    expect(rootName(functionRoot(fn('ii7/V'), key('C')))).toBe('A')
    expect(rootName(functionRoot(fn('♭VII7'), key('C')))).toBe('Bb')
    expect(rootName(functionRoot(fn('vii°7/ii'), key('C')))).toBe('C#')
    expect(rootName(functionRoot(fn('V7'), key('Db')))).toBe('Ab')
  })

  it('implies the tonic for V7, subV7, ♭VII7, ii and vii°7 without a target', () => {
    expect(impliedTarget(fn('V7'), key('Cm'))).toEqual({ steps: 0, semis: 0, minor: true })
    expect(impliedTarget(fn('subV7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('♭VII7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('ii7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('iiø7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: true })
    expect(impliedTarget(fn('vii°7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('V7/ii'), key('C'))).toEqual({ steps: 1, semis: 2, minor: true })
    expect(impliedTarget(fn('III7'), key('C'))).toBeNull()
  })

  it("says when a function doesn't fit its chord", () => {
    expect(fitError(fn('V7/V'), { chord: 'D7', pc: 2, family: 'dominant' }, key('C'))).toBeNull()
    expect(fitError(fn('V7/V'), { chord: 'D7sus4', pc: 2, family: 'sus' }, key('C'))).toBeNull()
    expect(fitError(fn('V7/V'), { chord: 'Bb7', pc: 10, family: 'dominant' }, key('C'))).toBe('V7/V in C is on D, not Bb7')
    expect(fitError(fn('ii7'), { chord: 'G7', pc: 7, family: 'dominant' }, key('C'))).toBe('ii7 is a minor chord, G7 a dominant one')
    expect(fitError(fn('ii7'), { chord: 'Hm7', pc: -1, family: null }, key('C'))).toBe("Hm7 can't be read, so its function can't be checked")
  })
})

describe('functionCandidates', () => {
  it("lists what a chord can do in its key, ending with its own degree", () => {
    expect(functionCandidates({ pc: 2, family: 'dominant', quality: '7' }, key('C'))).toEqual(['V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III', 'II7'])
    expect(functionCandidates({ pc: 7, family: 'dominant', quality: '7' }, key('C'))).toEqual(['V7', 'V7/i', 'subV7/♯IV', 'subV7/♯iv', '♭VII7/VI', 'V7'].filter((x, i, a) => a.indexOf(x) === i))
    expect(functionCandidates({ pc: 9, family: 'minor', quality: 'm7' }, key('C'))).toEqual(['ii7/V', 'vi7'])
    expect(functionCandidates({ pc: 11, family: 'dim', quality: 'dim7' }, key('C'))).toEqual(['vii°7', 'vii°7/i'])
    expect(functionCandidates({ pc: 5, family: 'major', quality: 'Maj7' }, key('C'))).toEqual(['IVmaj7'])
    expect(functionCandidates({ pc: -1, family: null, quality: '' }, key('C'))).toEqual([])
  })

  it('offers only functions that read and fit, for every chord in the library', () => {
    for (const { f, r } of libraryRows()) {
      const c = readChord(r.chord)
      if (!c) continue
      const chord = { chord: r.chord, pc: pcOf(c.root), family: familyOf(c.quality), quality: c.quality }
      for (const text of functionCandidates(chord, r.key)) {
        const parsed = parseFunction(text)
        expect(typeof parsed === 'string' ? parsed : fitError(parsed, chord, r.key), `${f} bar ${r.bar} ${r.chord}: ${text}`).toBeNull()
      }
    }
  })
})

describe('the round trip with the Changes sheet', () => {
  it('reads back every numeral the analyser gives the library, in the same spelling', () => {
    for (const { f, r } of libraryRows()) {
      if (r.numeral === '?') continue
      const back = parseFunction(r.numeral)
      expect(typeof back === 'string' ? back : back.text, `${f} bar ${r.bar} ${r.chord}`).toBe(r.numeral)
    }
  })
})
```

How the candidate lists in the test work out:
- **G7 in C:** the second dominant list is G7 in C, where `V7/I` collapses to `V7`. The `filter` keeps the expected
  list free of the duplicate that `functionCandidates` itself removes.
- **`V7/i`:** the target is the tonic chord, but minor in a major key, so the slash part is kept.
- **`♯IV`:** `roman()` spells pc 6 `#IV` (its `DEGREES` table), so the half-step-below target of G7 is `♯IV`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project engine engine/__tests__/functions.test.ts`
Expected: FAIL: cannot resolve `../analysis/functions`.

- [ ] **Step 3: Implement**

In `web/engine/analysis/numerals.ts`, export `glyph` and turn `own` into `ownNumeral`. Use it at every place `own(`
was called in the file: the modal return and the three `return own(e, key)` lines.

```ts
/** "bVII" -> "♭VII" */
export const glyph = (r: string): string => r.replace(/^b/, '♭').replace(/^#/, '♯')
const degreeOf = (e: Pick<Entry, 'pc' | 'family'>, key: Key): string => glyph(roman(e, key))
/** the chord's own degree and quality in the key: "II7", "vi7", "IVmaj7", "vii°7" */
export const ownNumeral = (e: Pick<Entry, 'pc' | 'family' | 'quality'>, key: Key): string =>
  degreeOf(e, key) + (e.family === 'dominant' ? '7' : (SUFFIX[e.quality] ?? ''))
```

In `web/engine/analysis/stream.ts`, after the `FAMILY` table, add the export below and use it in `buildStream`
(`family: reading ? familyOf(reading.quality) : null`):

```ts
/** a chord quality's family; null for one the analyser doesn't know */
export const familyOf = (quality: string): Family | null => FAMILY[quality] ?? null
```

Create `web/engine/analysis/functions.ts`:

```ts
import { mod, parseRoot, pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { type Key, keyText, parseKey, sameKey } from './keys'
import { glyph, ownNumeral } from './numerals'
import { roman } from './rules'
import type { Family } from './stream'

/**
 * An author's harmonic function for a row, the chart's fifth cell (docs/superpowers/specs/2026-10-09-chart-functions-
 * design.md): the numerals the Changes sheet prints, read back. Relative to the row's key area, or to the key before
 * a colon ("D: V7/ii"). Degrees count from the key's tonic as in a major key (roman()): ♭III in C minor is E♭.
 */

export type Degree = Readonly<{ steps: number; semis: number }>
export type Target = Degree & Readonly<{ minor: boolean }>
export type StatedFunction = Readonly<{
  /** in the Changes sheet's spelling: "V7/ii", "♭VII7", "iiø7/vi" (without the key) */
  text: string
  /** the key before a colon; null: the row's key area */
  key: Key | null
  /** a tritone substitute: subV7 */
  sub: boolean
  degree: Degree
  family: Family
  /** the chord it leads to, as a degree of the key; null when it names none */
  target: Target | null
}>

const ROMAN: Readonly<Record<string, Degree>> = {
  I: { steps: 0, semis: 0 },
  II: { steps: 1, semis: 2 },
  III: { steps: 2, semis: 4 },
  IV: { steps: 3, semis: 5 },
  V: { steps: 4, semis: 7 },
  VI: { steps: 5, semis: 9 },
  VII: { steps: 6, semis: 11 },
}
const NUMERAL = 'VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i'
/** each quality spelling, and how the Changes sheet writes it */
const SUFFIXES: Readonly<Record<string, string>> = {
  '': '',
  maj7: 'maj7',
  Maj7: 'maj7',
  M7: 'maj7',
  maj: 'maj7',
  'maj7#5': 'maj7♯5',
  '6': '6',
  m: '',
  m7: '7',
  m6: '6',
  '(maj7)': '(maj7)',
  mMaj7: '(maj7)',
  '7': '7',
  ø7: 'ø7',
  ø: 'ø7',
  m7b5: 'ø7',
  o7: '°7',
  o: '°7',
  dim7: '°7',
  '7sus4': '7sus',
  '7sus': '7sus',
  sus: '7sus',
}
const SUFFIX = Object.keys(SUFFIXES)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)
  .map((s) => s.replace(/[()]/g, '\\$&'))
  .join('|')
const FUNCTION_RE = new RegExp(`^(sub)?([b#]?)(${NUMERAL})(${SUFFIX})?(?:/([b#]?)(${NUMERAL}))?$`)

/** glyphs to the ASCII the pattern reads: ♭ ♯ ° Δ */
const ascii = (s: string): string => s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/°/g, 'o').replace(/Δ7?/g, 'maj7')
const isUpper = (numeral: string): boolean => numeral === numeral.toUpperCase()
const degreeOf = (acc: string, numeral: string): Degree => {
  const d = ROMAN[numeral.toUpperCase()] ?? { steps: 0, semis: 0 }
  return { steps: d.steps, semis: d.semis + (acc === 'b' ? -1 : acc === '#' ? 1 : 0) }
}

function familyOf(suffix: string, upper: boolean): Family {
  if (/^(ø7?|m7b5)$/.test(suffix)) return 'halfdim'
  if (/^(o7?|dim7)$/.test(suffix)) return 'dim'
  if (/sus/.test(suffix)) return 'sus'
  if (/^(\(maj7\)|mMaj7|m|m7|m6)$/.test(suffix)) return 'minor'
  if (/^(maj7|Maj7|M7|maj|maj7#5)$/.test(suffix)) return 'major'
  if (suffix === '7') return upper ? 'dominant' : 'minor'
  return upper ? 'major' : 'minor' // a triad, or a sixth chord
}

const LOWER: ReadonlySet<Family> = new Set(['minor', 'halfdim', 'dim'])

export function parseFunction(text: string): StatedFunction | string {
  const colon = text.indexOf(':')
  const keyPart = colon >= 0 ? text.slice(0, colon).trim() : ''
  const body = (colon >= 0 ? text.slice(colon + 1) : text).trim()
  const key = keyPart ? parseKey(keyPart) : null
  if (keyPart && !key) return `"${keyPart}" isn't a key (Eb, Cm)`
  const m = FUNCTION_RE.exec(ascii(body))
  if (!m) return `"${body}" isn't a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)`
  const [, sub = '', acc = '', num = '', suffix = '', tacc = '', tnum = ''] = m
  const family = familyOf(suffix, isUpper(num))
  if (sub && family !== 'dominant') return 'sub only goes on a dominant (subV7)'
  if (!isUpper(num) && family === 'major') return `${body}: a major quality on a lower-case numeral`
  const cased = LOWER.has(family) ? num.toLowerCase() : num.toUpperCase()
  const target = tnum ? { ...degreeOf(tacc, tnum), minor: !isUpper(tnum) } : null
  return {
    text: `${sub ? 'sub' : ''}${glyph(acc)}${cased}${SUFFIXES[suffix] ?? ''}${tnum ? `/${glyph(tacc)}${tnum}` : ''}`,
    key,
    sub: !!sub,
    degree: degreeOf(acc, num),
    family,
    target,
  }
}

/** two texts that state the same function in the same key ("bVII7" and "♭VII7"); false if either won't read */
export function sameFunction(a: string, b: string): boolean {
  const x = parseFunction(a)
  const y = parseFunction(b)
  if (typeof x === 'string' || typeof y === 'string') return false
  return x.text === y.text && (x.key === null ? y.key === null : y.key !== null && sameKey(x.key, y.key))
}

const TONIC: Target = { steps: 0, semis: 0, minor: false }

/** the chord a function leads to: its target, or the tonic for V7, subV7, ♭VII7, ii(ø)7 and vii°7; null for none */
export function impliedTarget(f: StatedFunction, key: Key): Target | null {
  if (f.target) return f.target
  const s = mod(f.degree.semis, 12)
  if ((f.family === 'dominant' || f.family === 'sus') && (f.sub || s === 7)) return { ...TONIC, minor: key.minor }
  if (f.family === 'dominant' && s === 10) return TONIC // the back door
  if (f.family === 'minor' && s === 2) return TONIC
  if (f.family === 'halfdim' && s === 2) return { ...TONIC, minor: true }
  if (f.family === 'dim' && s === 11) return { ...TONIC, minor: key.minor }
  return null
}

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
/** the key's tonic as spelled ("Eb major" -> Eb); from its pitch for a key made without a name */
export const tonicOf = (key: Key): Spelled => parseRoot(/^[A-G][b#]?/.exec(key.name)?.[0] ?? FLAT_NAMES[key.tonic] ?? 'C')

/** the root the function puts its chord on: V7/V in Eb is F, subV7/IV in C is Gb */
export function functionRoot(f: StatedFunction, key: Key): Spelled {
  const t = f.target ?? TONIC
  const d = f.sub ? { steps: 1, semis: 1 } : f.degree
  return shiftBy(tonicOf(key), t.steps + d.steps, t.semis + d.semis)
}

const FAMILY_NAME: Readonly<Record<Family, string>> = { major: 'major', minor: 'minor', dominant: 'dominant', halfdim: 'half-diminished', dim: 'diminished', sus: 'sus' }
const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a')

/** why the function can't be this chord's, or null when it fits (a sus chord can be a dominant's function) */
export function fitError(f: StatedFunction, chord: Readonly<{ chord: string; pc: number; family: Family | null }>, key: Key): string | null {
  if (!chord.family) return `${chord.chord} can't be read, so its function can't be checked`
  const dominantLike = (x: Family): boolean => x === 'dominant' || x === 'sus'
  if (f.family !== chord.family && !(dominantLike(f.family) && dominantLike(chord.family)))
    return `${f.text} is ${article(FAMILY_NAME[f.family])} ${FAMILY_NAME[f.family]} chord, ${chord.chord} ${article(FAMILY_NAME[chord.family])} ${FAMILY_NAME[chord.family]} one`
  const root = functionRoot(f, key)
  return pcOf(root) === chord.pc ? null : `${f.text} in ${keyText(key)} is on ${rootName(root)}, not ${chord.chord}`
}

/**
 * the functions that fit a chord in its key, for the grid's dropdown and the --ambiguous report: where it could lead
 * (a fifth down, a half step down as a tritone substitute, a step up by the back door; for a ii, the chord a step
 * down), then its own degree
 */
export function functionCandidates(e: Readonly<{ pc: number; family: Family | null; quality: string }>, key: Key): string[] {
  if (!e.family || e.pc < 0) return []
  const at = (base: string, pc: number, minor: boolean): string => {
    const to = mod(pc, 12)
    return to === key.tonic && minor === key.minor ? base : `${base}/${glyph(roman({ pc: to, family: minor ? 'minor' : 'major' }, key))}`
  }
  const leads: Readonly<Record<Family, readonly string[]>> = {
    dominant: [at('V7', e.pc + 5, false), at('V7', e.pc + 5, true), at('subV7', e.pc - 1, false), at('subV7', e.pc - 1, true), at('♭VII7', e.pc + 2, false)],
    sus: [at('V7sus', e.pc + 5, false), at('V7sus', e.pc + 5, true)],
    minor: [at('ii7', e.pc - 2, false)],
    halfdim: [at('iiø7', e.pc - 2, true)],
    dim: [at('vii°7', e.pc + 1, false), at('vii°7', e.pc + 1, true)],
    major: [],
  }
  return [...new Set([...leads[e.family], ownNumeral({ pc: e.pc, family: e.family, quality: e.quality }, key)])]
}
```

`glyph` operates on the start of a string: `glyph('b')` gives `'♭'` and `glyph('')` gives `''`, which is all
`parseFunction` needs.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project engine engine/__tests__/functions.test.ts`
Expected: PASS. If a round-trip numeral or a library candidate fails, extend the grammar (`SUFFIXES`, `NUMERAL`) or
fix `functionCandidates`. Don't weaken the test.

- [ ] **Step 5: Commit**

```bash
git add web/engine/analysis/functions.ts web/engine/analysis/numerals.ts web/engine/analysis/stream.ts web/engine/__tests__/functions.test.ts
git commit -m "Analysis: read an author's function, check it against its chord, and list the ones that fit"
```

---

### Task 3: The analyser takes stated functions and `@key`

**Files:**
- Modify: `web/engine/analysis/stream.ts` (`Entry.function`; held chords merge only when the later row states nothing
  new)
- Modify: `web/engine/analysis/rules.ts` (`Decision.fallback`, set at five returns)
- Modify: `web/engine/analysis/index.ts` (types, `analyse()`, three helpers)
- Test: `web/engine/__tests__/analysis.test.ts`

**Interfaces:**
- Consumes: Task 1 (`ChartLine` `'key'`, `LinedRow.function`) and Task 2 (`parseFunction`, `impliedTarget`,
  `fitError`, `tonicOf`).
- Produces:
  - `Decision` gains `fallback?: true`.
  - `RowAnalysis` gains `stated: boolean` and `statedKey?: Key`.
  - `Area` gains `section: string` and `stated: boolean`.
  - `Analysis` gains `problems: readonly Problem[]`.
  - `export type Problem = Readonly<{ line: number; message: string }>`, where `line` is a 0-based doc line index,
    the same as `RowAnalysis.line`.
  - `Entry` gains `function: string` (`''` = none).

- [ ] **Step 1: Write the failing tests** (append to `web/engine/__tests__/analysis.test.ts`, which already has the
  `verdict` helper and imports `analyse`, `applyAnalysis`, `parseChart`, `serializeChart`)

```ts
describe('stated functions and @key (docs/superpowers/specs/2026-10-09-chart-functions-design.md)', () => {
  const lines = (key: string, rows: readonly string[], extra = ''): string => `title: T\nkey: ${key}\n${extra}${rows.join('\n')}\n`
  const rowOf = (text: string, barChord: string) => analyse(parseChart(text).value).rows.find((r) => `${r.bar} ${r.chord}` === barChord)
  const C_TUNE = ['A | 1 | CMaj7', 'A | 2 | D7', 'A | 3 | Dm7', 'A | 4 | G7', 'A | 5 | Am7', 'A | 6 | Dm7', 'A | 7 | G7', 'A | 8 | CMaj7']

  it('a stated target overrides the neighbour: D7 going nowhere, stated V7/V', () => {
    const plain = lines('C', C_TUNE)
    expect(verdict(plain, '2 D7')).toBe('D Mixolydian (D5)')
    expect(rowOf(plain, '2 D7')?.fallback).toBe(true)
    const r = rowOf(plain.replace('A | 2 | D7', 'A | 2 | D7 | | V7/V'), '2 D7')
    expect([r?.scale, r?.rule, r?.numeral, r?.stated, r?.fallback]).toEqual(['D Mixolydian', 'D4', 'V7/V', true, undefined])
    expect(r?.reason).toBe('V7/V in C: natural tensions (stated)')
  })

  it('a key prefix decides its row only, and opens no key area', () => {
    const plain = lines('D', ['A | 1 | DMaj7', 'A | 2 | Em7', 'A | 3 | Bb7', 'A | 4 | DMaj7'])
    expect(verdict(plain, '3 Bb7')).toBe('Bb Lydian Dominant (D6)')
    const a = analyse(parseChart(plain.replace('A | 3 | Bb7', 'A | 3 | Bb7 | | Db: V7/ii')).value)
    const r = a.rows.find((x) => x.chord === 'Bb7')
    expect([r?.scale, r?.rule, r?.statedKey?.name, r?.key.name]).toEqual(['Bb Mixolydian b6', 'D4', 'Db major', 'D major'])
    expect(a.areas.map((x) => x.key.name)).toEqual(['D major'])
  })

  it('subV7 and ♭VII7 reach their own rules', () => {
    const sub = lines('C', ['A | 1 | CMaj7', 'A | 2 | Db7 | | subV7', 'A | 3 | Am7', 'A | 4 | Dm7', 'A | 5 | G7', 'A | 6 | CMaj7'])
    expect(verdict(sub, '2 Db7')).toBe('Db Lydian Dominant (D2)')
    const back = lines('C', ['A | 1 | CMaj7', 'A | 2 | Bb7 | | ♭VII7', 'A | 3 | Am7', 'A | 4 | Dm7', 'A | 5 | G7', 'A | 6 | CMaj7'])
    expect(verdict(back, '2 Bb7')).toBe('Bb Lydian Dominant (D5)')
    expect(rowOf(back, '2 Bb7')?.fn).toBe('back door bVII7 to C')
  })

  it('the ii of a stated ii–V is named for its target', () => {
    const text = lines('C', ['A | 1 | CMaj7', 'A | 2 | Am7 | | ii7/V', 'A | 3 | FMaj7', 'A | 4 | G7'])
    const r = rowOf(text, '2 Am7')
    expect([r?.scale, r?.rule, r?.fn]).toEqual(['A Dorian', 'm4', 'ii of the ii–V to G'])
  })

  it('@key holds from its bar until the next', () => {
    const rows = ['A | 1 | EbMaj7', 'A | 2 | Cm7', 'B | 3 | DMaj7', 'B | 4 | Em7', 'B | 5 | DMaj7', 'C | 6 | EbMaj7', 'C | 7 | Fm7', 'C | 8 | Bb7']
    const text = lines('Eb', rows, '@key B 3 D\n@key C 6 Eb\n')
    const a = analyse(parseChart(text).value)
    expect(a.areas.map((x) => `${x.key.name} ${x.section} ${x.from}–${x.to} ${x.stated ? 'stated' : 'found'}`)).toEqual([
      'Eb major A 1–2 found',
      'D major B 3–5 stated',
      'Eb major C 6–8 stated',
    ])
    expect(verdict(text, '3 DMaj7')).toBe('D Ionian (M3)')
    expect(a.problems).toEqual([])
  })

  it("reports a function that won't read, doesn't fit, or sits on a chord it can't read, and ignores it", () => {
    const text = lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | X7', 'A | 3 | Bb7 | | V7/V', 'A | 4 | Hm7 | | ii7'])
    const a = analyse(parseChart(text).value)
    expect(a.problems.map((p) => `${p.line} ${p.message}`)).toEqual([
      '3 "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)',
      '4 V7/V in C is on D, not Bb7',
      "5 Hm7 can't be read, so its function can't be checked",
    ])
    expect(a.rows.filter((r) => r.stated)).toEqual([])
  })

  it('an @key on a bar that is not there is a problem; the areas stay as found', () => {
    const text = lines('C', C_TUNE, '@key B 99 D\n')
    const a = analyse(parseChart(text).value)
    expect(a.problems).toEqual([{ line: 2, message: '@key B 99: no bar 99 in section B' }])
    expect(a.areas.map((x) => x.key.name)).toEqual(analyse(parseChart(lines('C', C_TUNE)).value).areas.map((x) => x.key.name))
  })

  it('a function on a @copy source states its repeats too, and a bad one is reported once', () => {
    const good = analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | V7/V', 'A | 3 | Dm7', 'A | 4 | G7', '@copy A B 4'])).value)
    expect(good.rows.filter((r) => r.chord === 'D7').map((r) => `${r.bar} ${r.stated}`)).toEqual(['2 true', '6 true'])
    const bad = analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | X7', 'A | 3 | Dm7', 'A | 4 | G7', '@copy A B 4'])).value)
    expect(bad.problems).toHaveLength(1)
  })

  it('held chords merge unless the later one states a different function', () => {
    const held = (second: string) => analyse(parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | | V7/V', second, 'A | 4 | G7'])).value).rows.filter((r) => r.chord === 'D7').map((r) => r.held)
    expect(held('A | 3 | D7')).toEqual([false, true])
    expect(held('A | 3 | D7 | | II7')).toEqual([false, false])
  })

  it('applyAnalysis never writes a function or an @key, and --force rewrites a stated row from its function', () => {
    const doc = parseChart(lines('C', ['A | 1 | CMaj7', 'A | 2 | D7 | D Lydian Dominant | V7/V', 'A | 3 | Dm7', 'A | 4 | G7'], '@key A 1 C\n')).value
    const out = serializeChart(applyAnalysis(doc, analyse(doc), { scales: 'force', save: true, date: '2026-10-10' }).doc)
    expect(out).toContain('@key A 1 C\n')
    expect(out).toMatch(/A \| 2 \| D7\s+\| D Mixolydian\s+\| V7\/V\s+# V7\/V in C: natural tensions \(stated\)\n/)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project engine engine/__tests__/analysis.test.ts -t "stated functions"`
Expected: FAIL: `fallback`, `stated`, `problems` and `statedKey` are undefined, and the functions are ignored.

- [ ] **Step 3a: Implement the stream** (`web/engine/analysis/stream.ts`)

Add to `Entry`, after `symbol`:

```ts
  /** the author's function on its first row (the chart's fifth cell); '' = none */
  function: string
```

In `buildStream`, merge a held chord only when the later row states nothing new, and carry the function:

```ts
    if (prev && prev.chord === row.chord && prev.part === part && (!row.function || row.function === prev.function)) {
```

```ts
      symbol: reading?.symbol ?? '',
      function: row.function ?? '',
```

- [ ] **Step 3b: Implement the fallback flag** (`web/engine/analysis/rules.ts`)

```ts
/** one chord's verdict: null scale when no rule reaches it; fallback: the rules could only guess (an author's function would settle it) */
export type Decision = Readonly<{ scale: string | null; rule: string; fn: string; reason: string; fallback?: true }>
```

Set the flag at the five guesses:

```ts
  if (reference(key).includes(e.pc) || reference(key, true).includes(e.pc)) {
    const fn = `${roman(e, key)}7 in ${keyText(key)}, not resolving`
    return { ...dominantDecision(e, 'D5', fn, derive(e, key), fn, true), fallback: true }
  }
  return { ...dominantDecision(e, 'D6', 'chromatic dominant', LYDIAN_DOMINANT, 'a chromatic dominant with nowhere to go: Lydian Dominant, its own key', false), fallback: true }
```

```ts
  return { scale: named(e, NAME.dorian), rule: 'm8', fn: `borrowed ${roman(e, key)} in ${keyText(key)}`, reason: 'a borrowed minor chord: Dorian, its own key', fallback: true }
```

In `halfDiminished`:

```ts
  return { scale: named(e, NAME.locrian), rule: 'h2', fn, reason: `${fn}: the b9 is in the key`, ...(related ? {} : { fallback: true as const }) }
```

In `diminished`:

```ts
  return { scale: named(e, NAME.wholeHalf), rule: 'd1', fn, reason: `${fn}: the rootless V7b9 of the next chord`, ...(fn === 'passing diminished' ? { fallback: true as const } : {}) }
```

- [ ] **Step 3c: Implement `analyse()`** (`web/engine/analysis/index.ts`)

Imports to add:

```ts
import type { LinedRow } from '../chart'
import { pcOf, rootName, shiftBy, type Spelled } from '../pitch'
import { fitError, impliedTarget, parseFunction, type StatedFunction, tonicOf } from './functions'
import { type Entry, type Family } from './stream'
```

(`parseKey` is already imported from `./keys`. Merge `Entry` and `Family` into the existing `./stream` import.)

Types:

```ts
export type RowAnalysis = Readonly<
  Decision & { row: number; line: number; bar: string; chord: string; key: Key; held: boolean; numeral: string; stated: boolean; statedKey?: Key }
>
export type Area = Readonly<{ key: Key; from: string; to: string; row: number; section: string; stated: boolean }>
/** something in the chart the analysis couldn't use: a function that won't read or doesn't fit, an @key with no bar. line: the doc line */
export type Problem = Readonly<{ line: number; message: string }>
export type Analysis = Readonly<{
  key: Key | null
  keyFrom: 'key:' | 'blues' | 'scored' | 'none'
  context: 'functional' | 'modal' | 'blues'
  areas: readonly Area[]
  rows: readonly RowAnalysis[]
  problems: readonly Problem[]
}>
```

Helpers, placed above `analyse`:

```ts
type Stated = Readonly<{ fn: StatedFunction; key: Key }>
const addProblem = (problems: Problem[], p: Problem): void => {
  if (!problems.some((q) => q.line === p.line && q.message === p.message)) problems.push(p)
}

/** `@key` lines: each holds from its bar until the next; before the first, the areas as found */
function statedAreas(doc: ChartDoc, rows: readonly LinedRow[], stream: readonly Entry[], found: readonly Key[], problems: Problem[]): { keys: Key[]; stated: boolean[] } {
  const starts: { at: number; key: Key }[] = []
  doc.lines.forEach((l, line) => {
    if (l.kind !== 'key') return
    const r = rows.findIndex((x) => x.section === l.section && x.bar === String(l.bar))
    const at = stream.findIndex((e) => e.rows.includes(r))
    const key = parseKey(l.key)
    if (r < 0 || at < 0 || !key) return void addProblem(problems, { line, message: `@key ${l.section} ${l.bar}: no bar ${l.bar} in section ${l.section}` })
    starts.push({ at, key })
  })
  starts.sort((a, b) => a.at - b.at)
  const keys = [...found]
  const stated = stream.map(() => false)
  starts.forEach(({ at, key }, k) => {
    for (let i = at; i < (starts[k + 1]?.at ?? stream.length); i++) {
      keys[i] = key
      stated[i] = true
    }
  })
  return { keys, stated }
}

/** each entry's function, when it reads and fits its chord; otherwise a problem, and none */
function statedFunctions(stream: readonly Entry[], rows: readonly LinedRow[], keys: readonly Key[], global: Key, problems: Problem[]): (Stated | undefined)[] {
  return stream.map((e, i) => {
    if (!e.function) return undefined
    const line = rows[e.rows[0] ?? 0]?.line ?? 0
    const fn = parseFunction(e.function)
    if (typeof fn === 'string') return void addProblem(problems, { line, message: fn })
    const key = fn.key ?? keys[i] ?? global
    const misfit = fitError(fn, e, key)
    if (misfit) return void addProblem(problems, { line, message: misfit })
    return { fn, key }
  })
}

/**
 * the stream the rules read: a stated row's target as a chord after it (with its V7 between, for a ii), so each rule
 * decides through its usual path. The extra entries follow the real ones and are never reported.
 */
function withTargets(stream: readonly Entry[], keys: readonly Key[], stated: readonly (Stated | undefined)[]): { stream: Entry[]; keys: Key[] } {
  const out = [...stream]
  const outKeys = [...keys]
  stream.forEach((e, i) => {
    const s = stated[i]
    const t = s ? impliedTarget(s.fn, s.key) : null
    if (!s || !t || e.family === 'major') return
    const add = (root: Spelled, quality: string, family: Family, next: number | null): number => {
      const chord = `${rootName(root)}${quality === 'maj' ? '' : quality}`
      out.push({ ...e, rows: [], next, prev: i, chord, root, pc: pcOf(root), quality, family, symbol: '', start: e.start + e.bars, bars: 1, function: '' })
      outKeys.push(s.key)
      return out.length - 1
    }
    const root = shiftBy(tonicOf(s.key), t.steps, t.semis)
    let next = add(root, t.minor ? 'm' : 'maj', t.minor ? 'minor' : 'major', null)
    if (e.family === 'minor' || e.family === 'halfdim') next = add(shiftBy(root, 4, 7), '7', 'dominant', next)
    out[i] = { ...e, next }
  })
  return { stream: out, keys: outKeys }
}
```

The body of `analyse()` from `const keys = …` on, replacing the old body there:

```ts
  if (!global) return { key: null, keyFrom, context: 'functional', areas: [], rows: [], problems: [] }
  const found = modal || blues ? stream.map(() => global) : localKeys(stream, cadences, global)
  const problems: Problem[] = []
  const areaKeys = statedAreas(doc, rows, stream, found, problems)
  const stated = statedFunctions(stream, rows, areaKeys.keys, global, problems)
  const virtual = withTargets(
    stream,
    stream.map((_, i) => stated[i]?.key ?? areaKeys.keys[i] ?? global),
    stated,
  )
  const ctx: Context = { stream: virtual.stream, keys: virtual.keys, global, blues, modal }
  const out: RowAnalysis[] = []
  const areas: Area[] = []
  stream.forEach((e, i) => {
    const key = areaKeys.keys[i] ?? global
    const s = stated[i]
    const { fallback, ...ruled } = decide(ctx, i)
    const decision: Decision = s ? { ...ruled, reason: `${ruled.reason} (stated)` } : fallback ? { ...ruled, fallback } : ruled
    const roman = s ? s.fn.text : numeral(ctx, i, decision)
    const prevKey = i > 0 ? areaKeys.keys[i - 1] : undefined
    const firstRow = rows[e.rows[0] ?? 0]
    if (firstRow && (!prevKey || !sameKey(prevKey, key)))
      areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: e.rows[0] ?? 0, section: firstRow.section, stated: areaKeys.stated[i] ?? false })
    const area = areas.at(-1)
    for (const [j, r] of e.rows.entries()) {
      const row = rows[r]
      if (!row) continue
      out.push({ ...decision, row: r, line: row.line, bar: row.bar, chord: row.chord, key, held: j > 0, numeral: roman, stated: !!s, ...(s?.fn.key ? { statedKey: s.key } : {}) })
      if (area) areas[areas.length - 1] = { ...area, to: row.bar }
    }
  })
  return { key: global, keyFrom, context: blues ? 'blues' : modal ? 'modal' : 'functional', areas, rows: out, problems }
```

- [ ] **Step 4: Run the new tests, then the whole engine**

Run: `npx vitest run --project engine engine/__tests__/analysis.test.ts`
Expected: PASS. If `'Eb major A 1–2 found'` comes out differently, print `analyse(...).areas` and check
`localKeys`'s answer for bars 1–2 without the `@key` lines. The test is about the stated spans, so pin the first
area to what the analyser finds there today.
Run (repo root): `make test`
Expected: PASS, and `fixtures/analysis.json` and `golden.json` unchanged. The fixture strings don't include the new
fields, and no library chart states anything yet.

- [ ] **Step 5: Commit**

```bash
git add web/engine/analysis/stream.ts web/engine/analysis/rules.ts web/engine/analysis/index.ts web/engine/__tests__/analysis.test.ts
git commit -m "Analysis: stated functions and @key areas decide the scale; problems and guesses reported"
```

---

### Task 4: The ambiguity report and problems in the CLI

**Files:**
- Create: `web/engine/analysis/ambiguity.ts`
- Modify: `web/engine/analysis/keys.ts` (`keyCode`)
- Modify: `web/engine/analysis/index.ts` (re-export `ambiguities`)
- Modify: `web/scripts/analyse.ts` (`--ambiguous`, problems in every report, usage text)
- Test: `web/engine/__tests__/ambiguity.test.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `Analysis`, `RowAnalysis.fallback`, `stated`, `statedKey`, `Area.section`, `Area.stated`, `problems`;
  - from Task 2: `functionCandidates`, `ownNumeral`, `familyOf`;
  - from `../qualities`: `readChord`.
- Produces:
  - `ambiguities(a: Analysis): string[]`
  - `keyCode(k: Key): string`, a key as `key:` and `@key` write it ("D", "Bbm"). Task 6 uses it too.

- [ ] **Step 1: Write the failing tests** (`web/engine/__tests__/ambiguity.test.ts`)

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ambiguities, analyse } from '../analysis'
import { keyCode, parseKey } from '../analysis/keys'
import { parseChart } from '../chart'

const report = (text: string): string[] => ambiguities(analyse(parseChart(text).value))
const C_TUNE = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | Am7\nA | 6 | Dm7\nA | 7 | G7\nA | 8 | CMaj7\n'

describe('the ambiguity report', () => {
  it('writes keys as key: and @key take them', () => {
    expect(['D', 'Bb minor', 'F#m'].map((k) => keyCode(parseKey(k) ?? { tonic: 0, minor: false, name: '' }))).toEqual(['D', 'Bbm', 'F#m'])
  })

  it('lists the rows the rules could only guess at, with functions to try', () => {
    expect(report(C_TUNE)).toEqual([
      "bar 2 D7: II7 in C, not resolving: natural tensions; if it's V7/V, V7/v, subV7/♭II, subV7/♭ii or ♭VII7/III, choose that as its function",
    ])
  })

  it('leaves out a row whose function is stated', () => {
    expect(report(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | V7/V'))).toEqual([])
  })

  it('offers an @key for each found key area away from home, and a key: line when there is none', () => {
    const body = report(readFileSync('../charts/body_and_soul.txt', 'utf8'))
    expect(body).toContain('key area D, bars 16–24, found by cadence: pin it with  @key A2 16 D')
    expect(report(C_TUNE.replace('key: C\n', ''))[0]).toBe('no key: line; the analysis guessed C: add  key: C')
  })

  it('ends with the problems, by line number', () => {
    expect(report(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | X7')).at(-1)).toBe('line 4: "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project engine engine/__tests__/ambiguity.test.ts`
Expected: FAIL: `ambiguities` and `keyCode` are not exported.

- [ ] **Step 3: Implement**

In `web/engine/analysis/keys.ts`, after `keyText`:

```ts
/** a key as `key:` and `@key` write it: "D", "Bbm" */
export const keyCode = (key: Key): string => `${key.name.split(' ')[0] ?? ''}${key.minor ? 'm' : ''}`
```

`web/engine/analysis/ambiguity.ts`:

```ts
import { pcOf } from '../pitch'
import { readChord } from '../qualities'
import { functionCandidates } from './functions'
import type { Analysis } from './index'
import { keyCode, keyText, sameKey } from './keys'
import { ownNumeral } from './numerals'
import { familyOf } from './stream'

/**
 * The --ambiguous report (docs/superpowers/specs/2026-10-09-chart-functions-design.md §2): what an author could
 * settle with a function or an @key line, then the problems with the ones already written.
 */
export function ambiguities(a: Analysis): string[] {
  const out: string[] = []
  const home = a.key
  if (a.keyFrom === 'scored' && home) out.push(`no key: line; the analysis guessed ${keyText(home)}: add  key: ${keyCode(home)}`)
  for (const x of a.areas)
    if (home && !x.stated && !sameKey(x.key, home)) out.push(`key area ${keyText(x.key)}, bars ${x.from}–${x.to}, found by cadence: pin it with  @key ${x.section} ${x.from} ${keyCode(x.key)}`)
  const seen = new Set<number>()
  for (const r of a.rows) {
    if (!r.fallback || r.stated || r.held || seen.has(r.line)) continue
    seen.add(r.line)
    const c = readChord(r.chord)
    const key = r.statedKey ?? r.key
    const chord = c ? { pc: pcOf(c.root), family: familyOf(c.quality), quality: c.quality } : null
    const ideas = chord ? functionCandidates(chord, key).filter((t) => t !== ownNumeral(chord, key)) : []
    const list = ideas.length < 2 ? (ideas[0] ?? '') : `${ideas.slice(0, -1).join(', ')} or ${ideas.at(-1)}`
    out.push(`bar ${r.bar} ${r.chord}: ${r.reason}${list ? `; if it's ${list}, choose that as its function` : ''}`)
  }
  for (const p of a.problems) out.push(`line ${p.line + 1}: ${p.message}`)
  return out
}
```

`ownNumeral`'s `family` parameter is `Family`, but `familyOf` returns `Family | null`. `functionCandidates` returns
`[]` for null, so guard the filter with `chord.family ? ownNumeral({ ...chord, family: chord.family }, key) : ''`
if the typecheck asks for it.

In `web/engine/analysis/index.ts`, next to the other re-exports:

```ts
export { ambiguities } from './ambiguity'
```

In `web/scripts/analyse.ts`:
- **Header comment:** add the line
  `*   --ambiguous   list what a function or an @key could settle, and problems with the ones written`.
- **Usage string:** add `[--ambiguous]` to the usage line.
- **Flag:** after `const quiet = flag('--quiet')`, add `const ambiguous = flag('--ambiguous')`.
- **Loop:** right after `const lines = report(name, a)`, add

```ts
  if (ambiguous) {
    const found = ambiguities(a)
    if (found.length) console.log([`${name}:`, ...found.map((l) => `  ${l}`)].join('\n') + '\n')
    continue
  }
```

- **Problems:** after the `for (const r of a.rows)` loop, add

```ts
  for (const p of a.problems) lines.push(`  ! line ${p.line + 1}: ${p.message}`)
```

- **Import:** add `ambiguities` to the import from `'../engine/analysis'`.

- [ ] **Step 4: Run the tests and try the CLI**

Run: `npx vitest run --project engine engine/__tests__/ambiguity.test.ts`
Expected: PASS.
Run: `npm run -s analyse -- --ambiguous ../charts/misty.txt`
Expected: a `misty:` block that includes `bar 23 Bb7: V7 in Eb, not resolving: natural tensions; if it's …` and
`bar 17 Bbm7: a borrowed minor chord: …`.
Run (repo root): `make test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/engine/analysis/ambiguity.ts web/engine/analysis/keys.ts web/engine/analysis/index.ts web/scripts/analyse.ts web/engine/__tests__/ambiguity.test.ts
git commit -m "Analyse CLI: --ambiguous lists what a function or @key could settle; problems in every report"
```

---

### Task 5: Transposing moves `@key` and key prefixes

**Files:**
- Modify: `web/engine/transpose.ts` (`transposeRow`, `transposeChart`, a new `transposeKeyText`)
- Test: `web/engine/__tests__/transpose.test.ts`

**Interfaces:**
- Consumes: `KEY_TEXT_RE` (Task 1), the `'key'` line and the `function` field (Task 1).
- Produces: `transposeChart` leaves a function's text unchanged, moves the key before its colon, and moves every
  `@key`.

- [ ] **Step 1: Write the failing test** (append inside the `describe('transpose', …)` block; add `parseChart` and
  `serializeChart` to the imports if they aren't there)

```ts
  it("moves @key lines and a function's key, on the target key's side; the function itself is relative and stays", () => {
    const doc = parseChart('A | 1 | D7 |  | V7/V\nA | 2 | Bb7 |  | Db: V7/ii\n@key A 2 Am\n').value
    const out = serializeChart(transposeChart(doc, 'C', 'Eb').doc)
    expect(out).toBe('A | 1 | F7  |  | V7/V\nA | 2 | Db7 |  | E: V7/ii\n@key A 2 Cm\n')
  })
```

The expected text works out as follows:
- **Chords:** C → Eb is up a minor third. D7 → F7 and Bb7 → Db7.
- **The `Db:` prefix:** Db moves up to Fb, and spellInKey respells it on the flat side as E, since E has fewer
  accidentals than Fb and fits.
- **`@key`:** Am → Cm.
- **Columns:** the scales are empty, so the scale column is width 0 and every row reads `|  |`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project engine engine/__tests__/transpose.test.ts`
Expected: FAIL: the prefix stays `Db:` and `@key` stays `Am`.

- [ ] **Step 3: Implement** in `web/engine/transpose.ts`

Add `KEY_TEXT_RE` to the import from `'./chart'`, then:

```ts
/** a key moved by the shift, spelled on the target key's side, its suffix as written ("Am" -> "Cm" up a minor 3rd) */
function transposeKeyText(text: string, s: KeyShift, side: KeySide): string {
  const t = text.trim()
  const m = KEY_TEXT_RE.exec(t)
  if (!m) return text
  const minor = /^(m|-|min|minor)$/i.test(m[2] ?? '')
  const root = spellInKey(shiftNote(parseRoot(m[1] ?? 'C'), s), minor ? 'aeolian' : 'ionian', side)
  return rootName(root) + t.slice((m[1] ?? '').length)
}

/** a function is relative to its key, so only the key before its colon moves ("Db: V7/ii") */
function transposeFunction(fn: string, s: KeyShift, side: KeySide): string {
  const colon = fn.indexOf(':')
  return colon < 0 ? fn : transposeKeyText(fn.slice(0, colon), s, side) + fn.slice(colon)
}
```

In `transposeRow`, change the return:

```ts
  return { ...row, chord, scale, ...(row.function ? { function: transposeFunction(row.function, s, side) } : {}) }
```

In `transposeChart`'s `map`, before `if (l.kind !== 'row') return l`:

```ts
    if (l.kind === 'key') return { ...l, key: transposeKeyText(l.key, s, side) }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project engine engine/__tests__/transpose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/engine/transpose.ts web/engine/__tests__/transpose.test.ts
git commit -m "Transpose: move @key lines and a function's key"
```

---

### Task 6: Live notes and function choices for views; the Changes sheet's data

**Files:**
- Modify: `web/engine/analysis/index.ts` (split `analyse()` into `prepare` and `contextFor`; add `functionChoices`)
- Create: `web/engine/notes.ts`
- Modify: `web/engine/index.ts` (export `./notes`)
- Modify: `web/engine/changes.ts` (`ChangesChord` gains `reason`, `stated`, `heardIn`)
- Test: `web/engine/__tests__/notes.test.ts`, `web/engine/__tests__/changes.test.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `analyse` and its `problems`, `stated`, `statedKey`; the helpers `statedAreas`,
    `statedFunctions`, `withTargets`; the `Stated` type;
  - from Task 2: `functionCandidates`, `parseFunction`, `fitError`, `impliedTarget`, `tonicOf`;
  - from Task 4: `keyCode`.
- Produces:
  - **From `analysis/index.ts`:** `type FunctionChoice = Readonly<{ value: string; label: string; scale: string | null }>`
    and `functionChoices(doc: ChartDoc): ReadonlyMap<number, readonly FunctionChoice[]>`.
    - It is keyed by 0-based doc line. The first choice is always `{ value: '', label: 'Auto: <numeral>' }`.
    - Each later choice is a fitting function: its label reads "V7/V (to G)", and its scale is what the rules give
      when it's stated.
  - **From `notes.ts`:** `type RowNote = Readonly<{ note: string; problem: string | null; key: string }>` and
    `rowNotes(doc: ChartDoc): ReadonlyMap<number, RowNote>`.
    - `key` is the row's key area as `keyCode` writes it ("D", "Bbm"), or `''`.
    - The map also covers `@key` lines that have a problem.
    - It re-exports `functionChoices` and `FunctionChoice` for the app.
  - **`ChangesChord`:** gains `reason: string`, `stated: boolean`, and `heardIn: string`, the key written for the part
    ("B♭ major").

- [ ] **Step 1: Write the failing tests**

`web/engine/__tests__/notes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { functionChoices, rowNotes } from '../notes'

const notes = (text: string) => rowNotes(parseChart(text).value)
const C_TUNE = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | Am7\nA | 6 | Dm7\nA | 7 | G7\nA | 8 | CMaj7\n'

describe('rowNotes', () => {
  it('gives each row its reason and key area, keyed by doc line', () => {
    expect(notes('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n').get(3)).toEqual({ note: 'V7 of C: natural tensions', problem: null, key: 'C' })
  })

  it("says when your scale isn't the analyser's", () => {
    expect(notes('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7 | G Altered\nA | 3 | CMaj7\n').get(3)?.note).toBe(
      'analyser: G Mixolydian (V7 of C: natural tensions); you chose G Altered',
    )
  })

  it("carries a row's function problem, and an @key's", () => {
    const n = notes('title: T\nkey: C\n@key Z 9 D\nA | 1 | Dm7\nA | 2 | G7 | | ii7\nA | 3 | CMaj7\n')
    expect(n.get(4)?.problem).toBe('ii7 is a minor chord, G7 a dominant one')
    expect(n.get(2)).toEqual({ note: '', problem: '@key Z 9: no bar 9 in section Z', key: '' })
  })
})

describe('functionChoices', () => {
  it('offers Auto, then each function that fits, with the scale it would give', () => {
    const d7 = functionChoices(parseChart(C_TUNE).value).get(3) ?? []
    expect(d7[0]).toEqual({ value: '', label: 'Auto: II7', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' })
    expect(d7).toContainEqual({ value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' })
    expect(d7.map((c) => c.value)).toEqual(['', 'V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III', 'II7'])
  })

  it("shows Auto as the analyser's own reading even when the row states a function", () => {
    const stated = functionChoices(parseChart(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | subV7/♭II')).value).get(3) ?? []
    expect(stated[0]).toEqual({ value: '', label: 'Auto: II7', scale: 'D Mixolydian' })
  })

  it('gives a held row the choices of the chord it holds', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | D7\nA | 2 | D7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    expect(functionChoices(doc).get(3)).toEqual(functionChoices(doc).get(2))
  })
})
```

Append to `web/engine/__tests__/changes.test.ts`, inside `describe('the Changes sheet', …)`:

```ts
  it('gives each chord its reason, the key it is heard in, and whether its function was stated', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Bb7 | | D: ♭VI7\nA | 3 | G7\nA | 4 | CMaj7\n').value
    const chords = buildChanges(doc, CONCERT).lines.flatMap((l) => l.bars).flatMap((b) => b.chords)
    const bb7 = chords.find((c) => c.text === 'Bb7')
    expect([bb7?.numeral, bb7?.stated, bb7?.heardIn]).toEqual(['♭VI7', true, 'D major'])
    expect(bb7?.reason).toMatch(/\(stated\)$/)
    expect(chords.find((c) => c.text === 'G7')).toMatchObject({ stated: false, heardIn: 'C major', reason: 'V7 of C: natural tensions' })
  })
```

`♭VI7` in D is B♭ (D + 8 semitones, a sixth up as letters), so the function fits. It has no target, so the rules
decide B♭7 in D through their usual path.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project engine engine/__tests__/notes.test.ts engine/__tests__/changes.test.ts`
Expected: FAIL: there's no `../notes` module, and `stated` and `heardIn` are undefined.

- [ ] **Step 3a: Split `analyse()`** (`web/engine/analysis/index.ts`)

The analysis and the choices read the same prepared chart, so compute it once in `prepare`. Above `analyse`:

```ts
type Prepared = Readonly<{
  rows: readonly LinedRow[]
  stream: readonly Entry[]
  areaKeys: readonly Key[]
  areaStated: readonly boolean[]
  stated: readonly (Stated | undefined)[]
  global: Key
  blues: Key | null
  modal: boolean
  keyFrom: Analysis['keyFrom']
  problems: readonly Problem[]
}>

/** everything the rules read before they decide: the stream, its key areas, the stated functions; global null without a key */
function prepare(doc: ChartDoc): Prepared | Readonly<{ global: null; keyFrom: Analysis['keyFrom'] }> {
  const rows = expandRowLines(doc).value
  const bars = formBars(doc)
  const stream = buildStream(rows, bars)
  const cadences = findCadences(stream)
  const form = stream.filter((e) => e.part === 'form')
  const span = form.length ? Math.round((form.at(-1)?.start ?? 0) + (form.at(-1)?.bars ?? 0) - (form[0]?.start ?? 0)) : 0
  const blues = bluesKey(form, bars ?? span)
  const stated = parseKey(meta(doc, 'key'))
  const global = blues ?? stated ?? scoreKey(stream, cadences)
  const keyFrom = blues ? 'blues' : stated ? 'key:' : global ? 'scored' : 'none'
  if (!global) return { global: null, keyFrom }
  const modal = !blues && isModal(stream, cadences)
  const found = modal || blues ? stream.map(() => global) : localKeys(stream, cadences, global)
  const problems: Problem[] = []
  const areas = statedAreas(doc, rows, stream, found, problems)
  const fns = statedFunctions(stream, rows, areas.keys, global, problems)
  return { rows, stream, areaKeys: areas.keys, areaStated: areas.stated, stated: fns, global, blues, modal, keyFrom, problems }
}

/** the rules' context under these statements: each stated row's target wired in after it */
function contextFor(p: Prepared, stated: readonly (Stated | undefined)[]): Context {
  const v = withTargets(p.stream, p.stream.map((_, i) => stated[i]?.key ?? p.areaKeys[i] ?? p.global), stated)
  return { stream: v.stream, keys: v.keys, global: p.global, blues: p.blues, modal: p.modal }
}
```

These lines are the start of `analyse()` as it stands, moved. Keep their order, and check them against the file.

`analyse` becomes:

```ts
export function analyse(doc: ChartDoc): Analysis {
  const p = prepare(doc)
  if (p.global === null) return { key: null, keyFrom: p.keyFrom, context: 'functional', areas: [], rows: [], problems: [] }
  const ctx = contextFor(p, p.stated)
  const out: RowAnalysis[] = []
  const areas: Area[] = []
  p.stream.forEach((e, i) => {
    const key = p.areaKeys[i] ?? p.global
    const s = p.stated[i]
    const { fallback, ...ruled } = decide(ctx, i)
    const decision: Decision = s ? { ...ruled, reason: `${ruled.reason} (stated)` } : fallback ? { ...ruled, fallback } : ruled
    const roman = s ? s.fn.text : numeral(ctx, i, decision)
    const prevKey = i > 0 ? p.areaKeys[i - 1] : undefined
    const firstRow = p.rows[e.rows[0] ?? 0]
    if (firstRow && (!prevKey || !sameKey(prevKey, key)))
      areas.push({ key, from: firstRow.bar, to: firstRow.bar, row: e.rows[0] ?? 0, section: firstRow.section, stated: p.areaStated[i] ?? false })
    const area = areas.at(-1)
    for (const [j, r] of e.rows.entries()) {
      const row = p.rows[r]
      if (!row) continue
      out.push({ ...decision, row: r, line: row.line, bar: row.bar, chord: row.chord, key, held: j > 0, numeral: roman, stated: !!s, ...(s?.fn.key ? { statedKey: s.key } : {}) })
      if (area) areas[areas.length - 1] = { ...area, to: row.bar }
    }
  })
  return { key: p.global, keyFrom: p.keyFrom, context: p.blues ? 'blues' : p.modal ? 'modal' : 'functional', areas, rows: out, problems: p.problems }
}
```

Run: `npx vitest run --project engine engine/__tests__/analysis.test.ts engine/__tests__/analysis.fixture.test.ts`
Expected: PASS with no change. This step is a pure refactor.

- [ ] **Step 3b: Add `functionChoices`** (`web/engine/analysis/index.ts`, after `analyse`)

Add `functionCandidates` to the import from `./functions`.

```ts
/** one option of the grid's Function dropdown: value '' is Auto (the analyser's own reading) */
export type FunctionChoice = Readonly<{ value: string; label: string; scale: string | null }>

/**
 * each row's Function options, keyed by doc line: Auto, then every function that fits the chord in its key area,
 * each with the scale the rules give when it's stated (the other rows' statements stand)
 */
export function functionChoices(doc: ChartDoc): ReadonlyMap<number, readonly FunctionChoice[]> {
  const out = new Map<number, readonly FunctionChoice[]>()
  const p = prepare(doc)
  if (p.global === null) return out
  const verdict = (i: number, s: Stated | undefined): { scale: string | null; numeral: string } => {
    const ctx = contextFor(p, p.stated.map((x, j) => (j === i ? s : x)))
    const d = decide(ctx, i)
    return { scale: d.scale, numeral: s ? s.fn.text : numeral(ctx, i, d) }
  }
  p.stream.forEach((e, i) => {
    if (!e.family) return
    const key = p.areaKeys[i] ?? p.global
    const auto = verdict(i, undefined)
    const choices: FunctionChoice[] = [{ value: '', label: auto.numeral === '?' ? 'Auto' : `Auto: ${auto.numeral}`, scale: auto.scale }]
    for (const text of functionCandidates(e, key)) {
      const fn = parseFunction(text)
      if (typeof fn === 'string' || fitError(fn, e, key)) continue
      const t = impliedTarget(fn, key)
      const to = t ? ` (to ${rootName(shiftBy(tonicOf(key), t.steps, t.semis))}${t.minor ? 'm' : ''})` : ''
      choices.push({ value: text, label: `${fn.text}${to}`, scale: verdict(i, { fn, key }).scale })
    }
    for (const r of e.rows) {
      const line = p.rows[r]?.line
      if (line !== undefined && !out.has(line)) out.set(line, choices)
    }
  })
  return out
}
```

- [ ] **Step 3c: `notes.ts` and the Changes data**

`web/engine/notes.ts`:

```ts
import { analyse, functionChoices, type FunctionChoice } from './analysis'
import { keyCode } from './analysis/keys'
import { type ChartDoc, resolveScale } from './chart'
import { sameScale } from './scales'

export { functionChoices, type FunctionChoice }

/**
 * What the editor shows beside each row (docs/superpowers/specs/2026-10-09-chart-functions-design.md §3): why the
 * analyser chose the scale it did, any problem with the row's function, and the key area (where a key change from
 * this row would start). Live, from analyse(), so every chart has notes, not only those the CLI saved. Keyed by doc
 * line.
 */
export type RowNote = Readonly<{ note: string; problem: string | null; key: string }>

export function rowNotes(doc: ChartDoc): ReadonlyMap<number, RowNote> {
  const a = analyse(doc)
  const problemAt = (line: number): string | null => a.problems.find((p) => p.line === line)?.message ?? null
  const out = new Map<number, RowNote>()
  for (const r of a.rows) {
    if (out.has(r.line)) continue // a @copy repeat: its source row speaks for it
    const line = doc.lines[r.line]
    const chosen = line?.kind === 'row' ? resolveScale(line) : null
    const differs = !!r.scale && !!chosen && !sameScale(chosen, r.scale)
    out.set(r.line, {
      note: differs ? `analyser: ${r.scale} (${r.reason}); you chose ${chosen}` : r.reason,
      problem: problemAt(r.line),
      key: keyCode(r.key),
    })
  }
  for (const p of a.problems) if (!out.has(p.line)) out.set(p.line, { note: '', problem: p.message, key: '' })
  return out
}
```

In `web/engine/index.ts`, add `export * from './notes'`.

In `web/engine/changes.ts`, add to `ChangesChord`:

```ts
  /** why the analysis gave it its scale ('' when it doesn't reach it) */
  reason: string
  /** its function was written in the chart, not found */
  stated: boolean
  /** the key it's heard in, written for the part ("B♭ major"); '' when the analysis doesn't reach it */
  heardIn: string
```

In the chord `map` in `buildChanges`:

```ts
            numeral: a?.numeral && a.numeral !== '?' ? a.numeral : '',
            scale: writtenScale(part, scale),
            reason: a?.reason ?? '',
            stated: a?.stated ?? false,
            heardIn: a ? keyName((a.statedKey ?? a.key).name, part) : '',
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project engine engine/__tests__/notes.test.ts engine/__tests__/changes.test.ts`
Expected: PASS.
Run (repo root): `make test`. Expected: PASS (`golden.json` and `analysis.json` unchanged).

- [ ] **Step 5: Commit**

```bash
git add web/engine/analysis/index.ts web/engine/notes.ts web/engine/index.ts web/engine/changes.ts web/engine/__tests__/notes.test.ts web/engine/__tests__/changes.test.ts
git commit -m "Engine: function choices with their scales, live row notes, each Changes chord's reason and key"
```

---

### Task 7: The `functions` flag and the remembered notes toggle

**Files:**
- Modify: `web/nuxt.config.ts:72-78` (`features`)
- Modify: `web/app/composables/useFeature.ts:5`
- Modify: `web/package.json:16` (the `e2e` script)
- Modify: `web/app/composables/usePreferences.ts` (`notes`)
- Test: `web/test/features.test.ts`, `web/test/usePreferences.test.ts`

**Interfaces:**
- Produces:
  - `useFeature('functions')`, which is off by default.
  - `usePreferences().notes: Ref<boolean>`, stored as `csm-grid-notes`, default `false`.
  - `linkPreferences(view).notes`, the viewer's own setting.

- [ ] **Step 1: Write the failing tests**

In `web/test/features.test.ts`, change the expectation in `'reads flags from runtime config'`:

```ts
    expect(useRuntimeConfig().public.features).toEqual({ myCharts: true, guideTones: true, practice: true, changes: true, scaleLevels: true, functions: false })
```

Append to `web/test/usePreferences.test.ts` (inside its `describe`):

```ts
  it('keeps the grid notes hidden until shown, and remembers', async () => {
    const p = prefs()
    expect(p.notes.value).toBe(false)
    p.notes.value = true
    await nextTick()
    expect(prefs().notes.value).toBe(true)
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/features.test.ts test/usePreferences.test.ts`
Expected: FAIL: `functions` is missing and `notes` is undefined.

- [ ] **Step 3: Implement**

`web/nuxt.config.ts`, inside `features`:

```ts
        functions: false, // author functions, @key areas and live analysis notes (docs/superpowers/specs/2026-10-09-chart-functions-design.md); off until the library has its functions
```

`web/app/composables/useFeature.ts`:

```ts
export type Feature = 'myCharts' | 'guideTones' | 'practice' | 'scaleLevels' | 'changes' | 'functions'
```

`web/package.json` `e2e` script: add `NUXT_PUBLIC_FEATURES_FUNCTIONS=true` after `NUXT_PUBLIC_FEATURES_CHANGES=true`.

`web/app/composables/usePreferences.ts`, in `usePreferences` before its `return`:

```ts
  // the editor grid's Notes column: why each scale was chosen; hidden until shown
  const notes = storedRef<boolean>('csm-grid-notes', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
```

Then add `notes` to its returned object. In `linkPreferences`, add `notes: own.notes,` next to `showEditor`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/features.test.ts test/usePreferences.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/nuxt.config.ts web/app/composables/useFeature.ts web/package.json web/app/composables/usePreferences.ts web/test/features.test.ts web/test/usePreferences.test.ts
git commit -m "Feature flag: functions (off); remember the grid's notes toggle"
```

---

### Task 8: The editor grid: a Function dropdown, notes, and `@key` rows with a key select

**Files:**
- Create: `web/app/components/FunctionCell.vue`
- Modify: `web/app/components/ChartGrid.vue`
- Test: `web/test/FunctionCell.test.ts`, `web/test/ChartGrid.test.ts`

**Interfaces:**
- Consumes:
  - from Task 6: `functionChoices`, `FunctionChoice`, `rowNotes`, `RowNote`;
  - from Task 2: `sameFunction` (export it from `web/engine/notes.ts` next to `functionChoices`:
    `export { sameFunction } from './analysis/functions'`);
  - from Task 1: `setRowField(…, 'function', …)`, `setKeyLine`, `insertKeyBefore`;
  - from Task 7: `useFeature('functions')`, `usePreferences().notes`;
  - `keyLabel` from `~~/engine`.
- Produces:
  - `<FunctionCell :choices :value :problem :label @update>`, a native `UiSelect` like `ScaleCell`. Each option reads
    "V7/V (to G) → D Mixolydian".
    - **Auto:** the first option, `Auto: II7 → D Mixolydian`, which emits `''`.
    - **Current value:** a value the list doesn't hold (a key-prefixed function typed in the text) shows as one more
      option, selected. It is marked invalid with `problem` in its title.
  - **Grid:** a "Show notes" / "Hide notes" toggle (`aria-pressed`) and a Notes cell per row.
  - **`@key` rows:** each gets a key select, `aria-label="Key from SECTION BAR"`.
  - **Chord rows:** each gets a "Key change at row N" button that inserts `@key SECTION BAR <the row's key area>`
    above the row.

- [ ] **Step 1: Write the failing tests**

`web/test/FunctionCell.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import FunctionCell from '~/components/FunctionCell.vue'

const CHOICES = [
  { value: '', label: 'Auto: II7', scale: 'D Mixolydian' },
  { value: 'V7/V', label: 'V7/V (to G)', scale: 'D Mixolydian' },
  { value: 'subV7/♭II', label: 'subV7/♭II (to Db)', scale: 'D Lydian Dominant' },
]
const mount = (value: string, problem: string | null = null) => mountSuspended(FunctionCell, { props: { choices: CHOICES, value, problem, label: 'function for row 2' } })

describe('FunctionCell', () => {
  it('offers Auto and each function that fits, with the scale it gives', async () => {
    const w = await mount('')
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Auto: II7 → D Mixolydian', 'V7/V (to G) → D Mixolydian', 'subV7/♭II (to Db) → D Lydian Dominant'])
    expect((w.find('select').element as HTMLSelectElement).value).toBe('')
  })

  it('emits the chosen function, and Auto as empty', async () => {
    const w = await mount('V7/V')
    await w.find('select').setValue('subV7/♭II')
    await w.find('select').setValue('')
    expect(w.emitted('update')).toEqual([['subV7/♭II'], ['']])
  })

  it('shows a function written another way as the matching option', async () => {
    const w = await mount('subV7/bII')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('subV7/♭II')
    expect(w.findAll('option')).toHaveLength(3)
  })

  it('keeps a function the list does not hold, and marks a problem', async () => {
    const w = await mount('Db: V7/ii', 'V7/ii in Db is on Bb, not D7')
    const select = w.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('Db: V7/ii')
    expect(w.findAll('option').at(-1)?.text()).toBe('Db: V7/ii')
    expect(select.attributes('aria-invalid')).toBe('true')
    expect(select.attributes('title')).toBe('V7/ii in Db is on Bb, not D7')
  })
})
```

Append to `web/test/ChartGrid.test.ts` (add `afterEach` and `beforeEach` to the vitest import):

```ts
describe('ChartGrid with functions', () => {
  beforeEach(() => {
    useRuntimeConfig().public.features.functions = true
    localStorage.clear()
  })
  afterEach(() => {
    useRuntimeConfig().public.features.functions = false
  })
  const fdoc = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n@key A 9 D\n').value

  it("offers each row's functions and writes the one chosen", async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    const select = w.find('select[aria-label="function for row 2"]')
    expect(select.find('option').text()).toBe('Auto: II7 → D Mixolydian')
    await select.setValue('V7/V')
    expect(lastDoc(w)?.lines[3]).toMatchObject({ kind: 'row', chord: 'D7', function: 'V7/V' })
  })

  it('shows notes on demand', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    expect(w.text()).not.toContain('not resolving: natural tensions')
    await w.find('button[aria-pressed]').trigger('click')
    expect(w.text()).toContain('II7 in C, not resolving: natural tensions')
  })

  it('edits an @key line with a key select, and shows its problem', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    expect(w.text()).toContain('@key A 9: no bar 9 in section A')
    await w.find('select[aria-label="Key from A 9"]').setValue('Eb')
    expect(lastDoc(w)?.lines[6]).toEqual({ kind: 'key', section: 'A', bar: 9, key: 'Eb' })
  })

  it('starts a key change at a row, in that row’s key area', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc: fdoc } })
    await w.find('[aria-label="Key change at row 3"]').trigger('click')
    expect(lastDoc(w)?.lines.slice(4, 6)).toEqual([
      { kind: 'key', section: 'A', bar: 3, key: 'C' },
      { kind: 'row', section: 'A', bar: '3', chord: 'Dm7', scale: '' },
    ])
  })
})

describe('ChartGrid without functions', () => {
  it('has no Function column and no key-change buttons', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    expect(w.find('[aria-label="function for row 1"]').exists()).toBe(false)
    expect(w.find('[aria-label="Key change at row 1"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/FunctionCell.test.ts test/ChartGrid.test.ts`
Expected: FAIL: there's no `FunctionCell` and no function select.

- [ ] **Step 3: Implement**

`web/app/components/FunctionCell.vue`:

```vue
<template>
  <UiSelect
    :model-value="selected"
    :aria-label="label"
    :invalid="!!problem"
    :title="problem ?? undefined"
    class="sm:py-1 sm:text-sm/5"
    @update:model-value="(v) => emit('update', String(v))"
  >
    <option v-for="c in choices" :key="c.value" :value="c.value">{{ c.label }}{{ c.scale ? ` → ${c.scale}` : '' }}</option>
    <option v-if="!matching && value" :value="value">{{ value }}</option>
  </UiSelect>
</template>

<script setup lang="ts">
import { type FunctionChoice, sameFunction } from '~~/engine'

/**
 * A row's function: Auto (the analyser's reading), or one of the functions that fit the chord in its key, each with
 * the scale it gives (engine functionChoices). A function written in the text that isn't among them (another key's,
 * "Db: V7/ii") stays, as one more option.
 */
const props = defineProps<{ choices: readonly FunctionChoice[]; value: string; problem: string | null; label: string }>()
const emit = defineEmits<{ update: [value: string] }>()

const matching = computed(() => (props.value ? props.choices.find((c) => c.value && sameFunction(c.value, props.value)) : props.choices[0]))
const selected = computed(() => matching.value?.value ?? props.value)
</script>
```

In `web/app/components/ChartGrid.vue`:
- **Toggle:** above `<UiTable …>`, add

```vue
    <div v-if="functionsOn" class="flex justify-end">
      <UiButton plain :aria-pressed="notes" @click="notes = !notes">{{ notes ? 'Hide notes' : 'Show notes' }}</UiButton>
    </div>
```

- **Headers:** after `<UiTableHeader>Scale</UiTableHeader>`, add

```vue
          <UiTableHeader v-if="functionsOn" class="w-56">Function</UiTableHeader>
          <UiTableHeader v-if="functionsOn && notes">Notes</UiTableHeader>
```

- **Row cells:** after the `ScaleCell` cell, add

```vue
            <UiTableCell v-if="functionsOn" class="min-w-48 px-1! py-1!">
              <FunctionCell
                :choices="choicesByLine.get(i) ?? []"
                :value="line.function ?? ''"
                :problem="notesByLine.get(i)?.problem ?? null"
                :label="`function for row ${rowNumber[i]}`"
                @update="(v) => emitDoc(setRowField(doc, i, 'function', v))"
              />
            </UiTableCell>
            <UiTableCell v-if="functionsOn && notes" class="px-1! py-1! text-sm/5 whitespace-normal text-zinc-600 dark:text-zinc-400">{{ notesByLine.get(i)?.note }}</UiTableCell>
```

- **Row actions:** in the chord row's actions cell, before the plus button, add

```vue
              <UiButton v-if="functionsOn" plain :aria-label="`Key change at row ${rowNumber[i]}`" title="Start a key change here" @click="emitDoc(insertKeyBefore(doc, i, notesByLine.get(i)?.key || meta.key || 'C'))"><KeyIcon data-slot="icon" /></UiButton>
```

- **Spans:** replace the `@copy` row's `colspan="4"` with `:colspan="columns - 1"`, and the invalid row's
  `colspan="5"` with `:colspan="columns"`.
- **`@key` rows:** after the `@copy` row, add

```vue
          <UiTableRow v-else-if="line.kind === 'key'">
            <UiTableCell :colspan="columns - 1" class="text-zinc-500 dark:text-zinc-400">
              <div class="flex flex-wrap items-center gap-2">
                <UiBadge color="sky">@key</UiBadge>
                <span>from <UiStrong>{{ line.section }} {{ line.bar }}</UiStrong> in</span>
                <UiSelect :model-value="line.key" :aria-label="`Key from ${line.section} ${line.bar}`" class="w-40 sm:py-1 sm:text-sm/5" @update:model-value="(v) => emitDoc(setKeyLine(doc, i, String(v)))">
                  <option v-for="k in KEY_OPTIONS" :key="k" :value="k">{{ keyLabel(k) }}</option>
                  <option v-if="!(KEY_OPTIONS as readonly string[]).includes(line.key)" :value="line.key">{{ line.key }}</option>
                </UiSelect>
              </div>
              <UiErrorMessage v-if="notesByLine.get(i)?.problem">{{ notesByLine.get(i)?.problem }}</UiErrorMessage>
            </UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton plain :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
```

- **Script:**
  - Add `KeyIcon` to the `@heroicons/vue/16/solid` import.
  - Add `functionChoices`, `type FunctionChoice`, `insertKeyBefore`, `rowNotes`, `type RowNote` and `setKeyLine` to
    the `~~/engine` import.
  - Then add

```ts
const functionsOn = useFeature('functions')
const { notes } = usePreferences()
/** the live analysis beside each row (engine/notes.ts): its note, its problem, its key area; and its function options */
const notesByLine = computed<ReadonlyMap<number, RowNote>>(() => (functionsOn ? rowNotes(props.doc) : new Map()))
const choicesByLine = computed<ReadonlyMap<number, readonly FunctionChoice[]>>(() => (functionsOn ? functionChoices(props.doc) : new Map()))
/** section, bar, chord, scale, [function], [notes], actions */
const columns = computed(() => 5 + (functionsOn ? 1 : 0) + (functionsOn && notes.value ? 1 : 0))
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/FunctionCell.test.ts test/ChartGrid.test.ts`
Expected: PASS. If mutating `useRuntimeConfig().public.features` doesn't reach `useFeature` in this test setup,
mock it the way `features.test.ts` mocks Nuxt imports:

```ts
mockNuxtImport('useFeature', () => (name: string) => name === 'functions' ? flags.functions : true)
```

Use a hoisted `flags` object for this. Keep the assertions the same.
Run (repo root): `make test && make lint`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/FunctionCell.vue web/app/components/ChartGrid.vue web/engine/notes.ts web/test/FunctionCell.test.ts web/test/ChartGrid.test.ts
git commit -m "Editor grid: a Function dropdown of what fits, notes on demand, @key rows with a key select"
```

---

### Task 9: The Changes sheet: a note on each numeral and scale

**Files:**
- Create: `web/app/components/ChangesNote.vue`
- Modify: `web/app/components/ChangesSystem.vue` (marks carry `reason`, `stated`, `heardIn`; numeral and scale rows
  use `ChangesNote` when the flag is on)
- Test: `web/test/ChangesNote.test.ts`

**Interfaces:**
- Consumes: `ChangesChord.reason`, `stated`, `heardIn` (Task 6); `useFeature('functions')` (Task 7).
- Produces: `<ChangesNote :reason :heard-in :stated>` with a default slot (the trigger text).

- [ ] **Step 1: Write the failing test** (`web/test/ChangesNote.test.ts`)

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ChangesNote from '~/components/ChangesNote.vue'

describe('ChangesNote', () => {
  it('is a button described by a tooltip with the reason and the key', async () => {
    const w = await mountSuspended(ChangesNote, { props: { reason: 'V7/V in C: natural tensions (stated)', heardIn: 'C major', stated: true }, slots: { default: () => 'V7/V' } })
    const button = w.find('button')
    expect(button.text()).toBe('V7/V')
    const tip = w.find(`#${button.attributes('aria-describedby')}`)
    expect(tip.attributes('role')).toBe('tooltip')
    expect(tip.text()).toContain('V7/V in C: natural tensions (stated)')
    expect(tip.text()).toContain('in C major · function stated in the chart')
    expect(tip.classes()).toContain('print:hidden')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/ChangesNote.test.ts`
Expected: FAIL: the component doesn't exist.

- [ ] **Step 3: Implement**

`web/app/components/ChangesNote.vue` follows `HelpTip.vue`'s pattern: it shows on hover, focus and tap, and Escape
hides it. Copy the tooltip `<span>`'s full class list from `HelpTip.vue`, changing three things: the group name
`group/tip` → `group/note` (and the matching `group-hover/…` and `group-focus-within/…` classes), `w-80` → `w-72`,
and `print:hidden` added. In the result below, the `class` attribute on the tooltip `<span>` is a placeholder:
replace it with that list.

```vue
<template>
  <!-- a numeral or scale on the Changes sheet, with why the analysis chose it; hover, focus or tap shows it, Escape hides it -->
  <span class="group/note relative inline-block max-w-full" @keydown.escape="dismissed = true" @pointerleave="dismissed = false" @focusout="dismissed = false">
    <button type="button" :aria-describedby="id" class="block max-w-full truncate rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500">
      <slot />
    </button>
    <span
      :id="id"
      role="tooltip"
      :class="['HELP_TIP_TOOLTIP_CLASSES', !dismissed && 'group-hover/note:visible group-hover/note:opacity-100 group-focus-within/note:visible group-focus-within/note:opacity-100']"
    >
      <span class="block">{{ reason }}</span>
      <span class="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">in {{ heardIn }}{{ stated ? ' · function stated in the chart' : '' }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
/** why the analysis gave a chord its function and scale (engine/changes.ts reason, heardIn, stated) */
defineProps<{ reason: string; heardIn: string; stated: boolean }>()
const id = useId()
const dismissed = ref(false)
</script>
```

`web/app/components/ChangesSystem.vue`:
- **Marks:** in `marks`, add `reason: c.reason, stated: c.stated, heardIn: c.heardIn` to each chord's object, and
  `reason: '', stated: false, heardIn: ''` to the marker-only object.
- **Script:** add `const notesOn = useFeature('functions')`.
- **Numeral row:** replace the `<span v-for="m in marks" :key="`n${m.key}`" …>` with the version below. The outer
  span loses `truncate` when notes are on, so the tooltip isn't clipped; the button truncates instead.

```vue
      <span
        v-for="m in marks"
        :key="`n${m.key}`"
        :class="['absolute text-sm font-medium text-zinc-800 dark:text-zinc-200 print:text-xs/3.5 print:text-black', !(notesOn && m.reason) && 'truncate']"
        :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }"
        :title="notesOn && m.reason ? undefined : m.numeral"
      >
        <ChangesNote v-if="notesOn && m.reason && m.numeral" :reason="m.reason" :heard-in="m.heardIn" :stated="m.stated">{{ m.numeral }}</ChangesNote>
        <template v-else>{{ m.numeral }}</template>
      </span>
```

- **Scale row:** do the same, keeping its existing classes and adding the same `truncate` condition:
  `<ChangesNote v-if="notesOn && m.reason && m.scale" …>{{ m.scale }}</ChangesNote>`, with `{{ m.scale }}`
  otherwise.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/ChangesNote.test.ts`
Expected: PASS.
Run (repo root): `make test && make lint`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/ChangesNote.vue web/app/components/ChangesSystem.vue web/test/ChangesNote.test.ts
git commit -m "Changes sheet: each numeral and scale explains itself"
```

---

### Task 10: Help text, docs, and the browser test

**Files:**
- Modify: `web/app/components/EditorView.vue:54-55` (format help)
- Modify: `README.md` (format table), `docs/design.md` §4 and §7a, `CLAUDE.md` ("Typical requests")
- Test: `web/e2e/changes.spec.ts`

**Interfaces:**
- Consumes: everything above. The e2e build turns the flag on (Task 7).

- [ ] **Step 1: Write the failing browser test** (append to `web/e2e/changes.spec.ts`; add `openEditor` to its
  import from `'./fixtures'`)

```ts
test('a function from the dropdown: the Changes sheet shows it, its note opens from the keyboard, and keys change from the grid', async ({ page }) => {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\n')
  const fn = page.getByLabel('function for row 2')
  await expect(fn.locator('option').first()).toHaveText('Auto: II7 → D Mixolydian')
  await page.getByRole('button', { name: 'Show notes' }).click()
  await expect(page.getByText('II7 in C, not resolving: natural tensions')).toBeVisible()
  await fn.selectOption({ label: 'V7/V (to G) → D Mixolydian' })
  await expect(page.getByLabel('Chart text')).toHaveValue(/A \| 2 \| D7\s+\|\s+\| V7\/V/)
  await chooseSheet(page, 'Changes')
  const sheet = sheetOf(page)
  const numeral = sheet.getByRole('button', { name: 'V7/V' })
  await numeral.focus()
  await expect(page.getByRole('tooltip').filter({ hasText: 'V7/V in C: natural tensions (stated)' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip').filter({ hasText: 'V7/V in C' })).toBeHidden()
  await page.getByLabel('Chart text').fill('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7 | | Db: V7/ii\nA | 3 | Dm7\nA | 4 | G7\n')
  await expect(fn).toHaveAttribute('aria-invalid', 'true') // V7/ii in Db is Bb7, not D7
  await page.getByLabel('Key change at row 3').click()
  await expect(page.getByLabel('Chart text')).toHaveValue(/@key A 3 C\nA \| 3 \| Dm7/)
})
```

- [ ] **Step 2: Run it to see it fail, then see it pass**

Run (repo root): `make e2e`
Expected: this test passes. Tasks 8 and 9 built the grid and the sheet, and the e2e build turns the flag on. If it
fails, fix the app, not the test. Every other spec must still pass, including `editor.spec.ts` with its six-cell
line, `pages.spec.ts` and `print.spec.ts`.

- [ ] **Step 3: Update the help and the docs**

`web/app/components/EditorView.vue:54`: the format line reads

```vue
<span class="block">One line per chord: <code class="font-mono text-xs whitespace-nowrap">section | bar | chord | scale | function</code>, in concert pitch. Leave the scale out to use the chord's default; the function (<code class="font-mono text-xs">V7/ii</code>, or <code class="font-mono text-xs">D: V7/ii</code> in another key) is optional and tells the analysis what the chord does; the grid offers the ones that fit.</span>
```

Line 55: after the `@copy A B 8` sentence, add ``, and <code class="font-mono text-xs">@key B 17 D</code> puts
bars from B 17 in D until the next @key``.

`README.md`, the chart-format table: change the first two rows' element to `section \| bar \| chord \| scale \|
function` and add these rows:

```markdown
| `… \| function` | Optional: what the chord does, as the Changes sheet writes it (`V7/ii`, `subV7`, `ii7/V`, `♭VII7`, `IVmaj7`), in the key area, or in another key before a colon (`D: V7/ii`). The analyser takes it as given when it picks the scale; it never writes one. |
| `@key SECTION BAR KEY` | The key from that bar until the next `@key` (`@key B 17 D`), where the analyser's own key areas would be wrong. It never writes one. |
```

Also in `README.md`, under "Filling in the scales", add a sentence: "`--ambiguous` lists the chords the rules could
only guess at, each with the functions it might have, and the key areas an `@key` would pin."

`docs/design.md`:
- **§4:** document the optional fifth cell and the `'key'` line in the chart model.
- **§7a:** add a "Stated functions" bullet: virtual targets, `@key` spans, a prefix decides one row, problems, the
  `fallback` flag and `--ambiguous`, and `rowNotes` and the Changes notes behind the `functions` flag.

`CLAUDE.md` "Typical requests", after the `# keep:` sentence of "Make a chart for <tune>": "Where the analyser can
only guess (`npm run analyse -- ../charts/<tune>.txt --ambiguous`), write the function (`| V7/ii`) or an `@key`
rather than a `# keep:` scale: a function lets the rules still choose the tensions."

- [ ] **Step 4: Full verification**

Run (repo root): `make test && make lint && make e2e`
Expected: all PASS. `git status` shows only the files in this task's commit.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/EditorView.vue README.md docs/design.md CLAUDE.md web/e2e/changes.spec.ts
git commit -m "Docs and help for function cells and @key; browser test for the Changes notes"
```

---

## After the plan (rollout, separate PRs)

1. Merge this branch with the `functions` flag off.
2. Run `cd web && npm run analyse -- --ambiguous --all`. Write functions and `@key` lines into library charts, a few
   charts per PR, each followed by `npm run analyse -- <charts> --force --save`, `make golden`, and a review of both
   diffs.
3. Turn the flag on: `functions: true` in `nuxt.config.ts` and `features.test.ts`.
