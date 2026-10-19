# Blues-aware Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chart read as a blues gets blues scales at every level (Basic: the key's Blues scale; Standard: Mixolydian / Dorian per chord; Advanced: the ladder) with no false ❓ questions, and a chart can declare itself a blues whatever its form.

**Architecture:** Four new rules (D9, M6, m10, s4) in `engine/src/analysis/rules.ts`, each gated on "a blues chord" (blues context, global key, root on I/IV/V). The Basic override lives in `engine/src/resolve.ts` beside the existing m5 special case. `context: blues` (existing header) is the switch; the iReal mapper writes it from a Blues style, `csm add --context` overrides, and the editor gets a "Read as" listbox.

**Tech Stack:** TypeScript (strict), Vitest, Nuxt 4 / Vue 3, Catalyst UI (`UiListbox`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-blues-analysis-design.md`

## Global Constraints

- The Blues scale is `1 b3 4 b5 5 b7` (existing `blues` in `SCALES`), spelled ♭5; no major blues scale.
- `style:` never affects the analysis.
- A written scale and a stated function win over every new rule.
- A chord under `@key` or a section `key:` is not a blues chord.
- `RULES_VERSION` becomes 2.
- No feature flag; the golden fixture diff is the gate.
- `engine/` stays free of Vue/DOM imports; `engine/src/index.ts` is the public API (`api.test.ts` snapshots exports).
- Stage files by name, never `git add -A`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Use `git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 …` (no `cd … && git`).

## Review Focus

1. A jazz blues ii–V–I (Gm7 C7 | F7) inside a blues: Gm7 and C7 must keep m4/D4, not become blues rules. → Task 1 test.
2. A minor blues' V7 (G7 in C minor) must stay on the minor-key rules, at Basic too (not the Blues scale). → Tasks 1 and 2 tests.
3. A chart with `@key` over a bridge inside a blues: those chords get ordinary rules and ordinary Basic. → Tasks 1 and 2 tests.
4. A written-tension dominant (F7#9) in a blues: D1+D9, and still the Blues scale at Basic (the rule id carries `D1+`). → Tasks 1 and 2 tests.
5. "Read as: Auto" on a chart that has no `context:` line must not add one; on a chart with one it must remove it. → Task 4 test.

---

### Task 1: The blues rules (D9, M6, m10, s4)

**Files:**
- Create: `engine/src/__tests__/blues.test.ts`
- Modify: `engine/src/analysis/rules.ts` (imports; `dominant()` ~179–245; `majorRules()` ~267; `minor()` ~307; `sus()` ~433; `RULES` ~491)
- Modify: `engine/src/analysis/index.ts:26` (`RULES_VERSION = 2`)
- Modify: existing tests that assert `(D5)` on a blues I7/IV7: `engine/src/__tests__/context.test.ts`, `engine/src/__tests__/rules.test.ts`, `engine/src/__tests__/analysis.test.ts` (find with `grep -n "of the blues\|D5" engine/src/__tests__/*.ts`)

**Interfaces:**
- Produces: rule ids `'D9' | 'M6' | 'm10' | 's4'` on `Analysis.rows[].rule` (a dominant whose symbol moves its scale reads `'D1+D9'`). Task 2 matches them with `/(^|\+)(D9|M6|m10|s4)$/`.

- [ ] **Step 1: Write the failing tests**

`engine/src/__tests__/blues.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ambiguities, analyse, type Analysis } from '../analysis'
import { parseChart } from '../chart'
import { migrateChart } from '../migrate'

/** blues-aware analysis (docs/superpowers/specs/2026-10-18-blues-analysis-design.md §2) */

const read = (text: string): Analysis => analyse(parseChart(migrateChart(text).text).value)
const verdict = (text: string, barChord: string): string | undefined => {
  const r = read(text).rows.find((x) => `${x.bar} ${x.chord}` === barChord)
  return r && `${r.scale} (${r.rule})`
}
/** a chart from `key`, extra header lines and `bar chord` pairs: "1 F7, 5 Bb7" */
const chart = (key: string, rows: string, extra = ''): string =>
  `title: T\n${key ? `key: ${key}\n` : ''}${extra}` +
  rows
    .split(',')
    .map((r) => r.trim().split(/\s+/))
    .map(([bar, chord]) => `A | ${bar} | ${chord}`)
    .join('\n') +
  '\n'
const BLUES = 'context: blues\nform: A, 12 bars\n'

describe('D9: the blues dominants', () => {
  const f = chart('F', '1 F7, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 F7', BLUES)
  it('I7, IV7 and an unresolved V7 are Mixolydian', () => {
    expect(verdict(f, '1 F7')).toBe('F Mixolydian (D9)')
    expect(verdict(f, '5 Bb7')).toBe('Bb Mixolydian (D9)')
    expect(verdict(f, '9 C7')).toBe('C Mixolydian (D9)')
  })
  it('the bar-9 V7 is not a guess, so no ❓', () => {
    expect(read(f).rows.find((r) => r.bar === '9')?.fallback).toBeUndefined()
    expect(ambiguities(read(f)).some((l) => l.includes('C7'))).toBe(false)
  })
  it('a written tension moves it: D1+D9', () => {
    expect(verdict(chart('F', '1 F7#9, 5 Bb7, 7 F7, 9 C7, 10 Bb7, 11 F7', BLUES), '1 F7#9')).toMatch(/\(D1\+D9\)$/)
  })
  it('a stated V7/IV on the I7 goes the usual way', () => {
    const text = 'title: T\nkey: F\ncontext: blues\nform: A, 12 bars\nA | 1 | F7 | | V7/IV\nA | 5 | Bb7\nA | 7 | F7\nA | 9 | C7\nA | 11 | F7\n'
    expect(verdict(text, '1 F7')).not.toMatch(/D9/)
  })
  it('a resolving ii–V inside a jazz blues keeps its rules', () => {
    const jazz = chart('F', '1 F7, 5 Bb7, 7 F7, 9 Gm7, 10 C7, 11 F7', BLUES)
    expect(verdict(jazz, '9 Gm7')).toMatch(/\(m4\)$/)
    expect(verdict(jazz, '10 C7')).toMatch(/\(D4\)$/)
  })
})

describe('M6: triads in a blues', () => {
  const e = chart('E', '1 E, 5 A, 7 E, 9 B, 10 A, 11 E', BLUES)
  it('a major triad on I, IV or V is Mixolydian', () => {
    expect(verdict(e, '1 E')).toBe('E Mixolydian (M6)')
    expect(verdict(e, '5 A')).toBe('A Mixolydian (M6)')
    expect(verdict(e, '9 B')).toBe('B Mixolydian (M6)')
  })
  it('a 6 chord too; a maj7 keeps the major rules', () => {
    expect(verdict(chart('E', '1 E6, 5 A, 7 E, 9 B, 11 E', BLUES), '1 E6')).toBe('E Mixolydian (M6)')
    expect(verdict(chart('E', '1 EMaj7, 5 A, 7 E, 9 B, 11 E', BLUES), '1 EMaj7')).not.toMatch(/M6/)
  })
  it('a major I in a minor-key blues is a blues chord', () => {
    expect(verdict(chart('Em', '1 Em, 5 Am, 7 E, 9 B7, 11 Em', BLUES), '7 E')).toBe('E Mixolydian (M6)')
  })
})

describe('m10: the minor blues', () => {
  const c = chart('Cm', '1 Cm7, 5 Fm7, 7 Cm7, 9 G7, 11 Cm7', BLUES)
  it('i and iv are Dorian', () => {
    expect(verdict(c, '1 Cm7')).toBe('C Dorian (m10)')
    expect(verdict(c, '5 Fm7')).toBe('F Dorian (m10)')
  })
  it('a tonic m6 is Dorian too', () => {
    expect(verdict(chart('Cm', '1 Cm6, 5 Fm7, 7 Cm7, 9 G7, 11 Cm7', BLUES), '1 Cm6')).toBe('C Dorian (m10)')
  })
  it('its V7 keeps the minor-key rules', () => {
    expect(verdict(c, '9 G7')).not.toMatch(/D9|m10/)
  })
})

describe('s4: sus in a blues', () => {
  it('a sus on I, IV or V is Mixolydian', () => {
    expect(verdict(chart('F', '1 F7, 5 Bb7, 7 F7, 9 C7sus4, 11 F7', BLUES), '9 C7sus4')).toBe('C Mixolydian (s4)')
  })
})

describe('what is not a blues chord', () => {
  it('a chord under @key gets the ordinary rules', () => {
    const text = 'title: T\nkey: F\ncontext: blues\nform: A, 12 bars\nA | 1 | F7\nA | 5 | Bb7\n@key 7 Ab\nA | 7 | AbMaj7\nA | 9 | C7\nA | 11 | F7\n'
    expect(verdict(text, '7 AbMaj7')).not.toMatch(/M6|D9/)
  })
  it('a 13-bar form reads as a blues only when stated', () => {
    const rows = '1 E7, 5 A7, 7 E7, 9 B7, 10 A7, 11 E7, 13 B7'
    expect(verdict(chart('E', rows, 'context: blues\nform: A, 13 bars\n'), '9 B7')).toBe('B Mixolydian (D9)')
    expect(verdict(chart('E', rows, 'form: A, 13 bars\n'), '9 B7')).not.toMatch(/D9/)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/blues.test.ts`
Expected: FAIL — I7/IV7 read `(D5)`, the bar-9 C7 is a D5 fallback, triads read Lydian/Ionian (M3/M4), Cm7 reads m5.

- [ ] **Step 3: Implement the rules**

In `engine/src/analysis/rules.ts`, add `sameKey` to the `./keys` import and, after `named`:

```ts
/** the blues key when this chord is a blues chord's home: a blues context, and the chord not under an @key or section key: */
const bluesAt = (ctx: Context, i: number): Key | null => (ctx.blues && sameKey(ctx.keys[i] ?? ctx.global, ctx.blues) ? ctx.blues : null)
/** the chord's step above the blues tonic, named when it is the I, IV or V */
const BLUES_STEP: Readonly<Record<number, 'I' | 'IV' | 'V'>> = { 0: 'I', 5: 'IV', 7: 'V' }
```

In `dominant()`, replace the `const blues = …` line and its two `if (blues …)` returns (the D5 I7/IV7 clause) with:

```ts
  // D9: the blues I7 and IV7 are decided by their degree before the chords around them (M&H p. 137: "I7 should not be
  // confused with V7/IV"): Mixolydian, though the key holds the IV7's #11 (principle 4 yields, N&G p. 105). A stated
  // function that names a target wins (principle 1): a stated V7/IV goes the usual way, to its target
  const blues = ctx.statedTarget[i] ? null : bluesAt(ctx, i)
  const step = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (step === 'I' || step === 'IV') return bluesDominant(e, step)
```

and, immediately before `if (e.bars >= 4) return dominantDecision(e, 'D7', 'static dominant', …)`:

```ts
  // D9: a blues V7 that resolves nowhere is the blues' own V, not a guess (a resolving one took D4 above); a minor
  // blues' V7 keeps the minor key's rules
  if (step === 'V' && !blues?.minor) return bluesDominant(e, 'V')
```

and add above `dominant()`:

```ts
const BLUES_ROLE = { I: 'a tonic with dominant colour', IV: 'a subdominant with dominant colour', V: 'a dominant that needn’t resolve' } as const
/** D9: a blues dominant, Mixolydian; written tensions still move it (D1+D9) */
function bluesDominant(e: Entry, step: 'I' | 'IV' | 'V'): Decision {
  const why = `${step}7 of the blues: ${BLUES_ROLE[step]}`
  const moved = dominantScale({ ...NATURAL, ...pins(e.symbol) }) !== NAME.mixolydian // the symbol's notes then name the scale
  const extra = step === 'IV' ? ' (the #11 is an extra colour)' : ''
  return dominantDecision(e, 'D9', `${step}7 of the blues`, NATURAL, moved ? why : `${why}, Mixolydian${extra}`, false)
}
```

In `majorRules()`, after the `aug` line (before `if (ctx.modal)`):

```ts
  const blues = bluesAt(ctx, i)
  const bluesStep = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (bluesStep && (e.quality === 'maj' || e.quality === '6')) {
    return { scale: named(e, NAME.mixolydian), rule: 'M6', fn: `${bluesStep} of the blues`, reason: `${bluesStep} of the blues: a triad here implies its ♭7, Mixolydian` }
  }
```

In `minor()`, after the `mMaj7` line (before the `m6` block):

```ts
  const blues = bluesAt(ctx, i)
  const bluesStep = blues?.minor ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if ((bluesStep === 'I' || bluesStep === 'IV') && ['m', 'm7', 'm6'].includes(e.quality) && !/b6|b13/.test(e.symbol)) {
    const which = bluesStep === 'I' ? 'i' : 'iv'
    return { scale: named(e, NAME.dorian), rule: 'm10', fn: `${which} of the minor blues`, reason: `${which} of the minor blues: Dorian` }
  }
```

In `sus()`, after the `7sus4b9` line:

```ts
  const blues = bluesAt(ctx, i)
  const bluesStep = blues ? BLUES_STEP[interval(blues.tonic, e.pc)] : undefined
  if (bluesStep) return { scale: named(e, NAME.mixolydian), rule: 's4', fn: `${bluesStep}7sus of the blues`, reason: `${bluesStep}7sus of the blues: Mixolydian` }
```

In `RULES`: replace the `D5` row and the `D3` row's "(a blues I7 before its IV7 is not one: D5)" with D9, and add the new rows (each after its family's last rule of the same tier):

```ts
  { id: 'D5', family: 'dominant', tier: 3, scale: 'derived from the key', looksAt: 'its degree: the back door, or a diatonic dominant', summary: 'A dominant a whole step below a major chord (the back door, ♭VII7), or a diatonic dominant that does not resolve, takes its tensions from the key.', guess: 'a diatonic dominant that does not resolve' },
  { id: 'D9', family: 'dominant', tier: 3, scale: 'Mixolydian', looksAt: 'a blues: its degree, the I7 or IV7 (before the chords around it), or a V7 that does not resolve', summary: 'In a blues the I7 (a tonic with dominant colour), the IV7 and a V7 with nowhere it must go are Mixolydian; at Basic they play the key’s Blues scale. A minor blues’ V7 keeps the minor key’s rules.' },
  { id: 'M6', family: 'major', tier: 2, scale: 'Mixolydian', looksAt: 'a blues: a major triad or 6 chord on I, IV or V', summary: 'In a blues a triad on I, IV or V implies its ♭7: Mixolydian (a maj7 says otherwise, and keeps the major rules); at Basic, the key’s Blues scale.' },
  { id: 'm10', family: 'minor', tier: 2, scale: 'Dorian', looksAt: 'a minor blues: the i or iv (triad, m7 or m6)', summary: 'In a minor blues the i and iv are Dorian; at Basic, the key’s Blues scale.' },
  { id: 's4', family: 'sus', tier: 2, scale: 'Mixolydian', looksAt: 'a blues: a sus chord on I, IV or V', summary: 'In a blues a sus chord on I, IV or V is Mixolydian; at Basic, the key’s Blues scale.' },
```

In `engine/src/analysis/index.ts`: `export const RULES_VERSION = 2`.

- [ ] **Step 4: Run the new tests**

Run: `cd engine && npx vitest run src/__tests__/blues.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Update the older assertions and run the engine suite**

Run: `cd engine && npx vitest run 2>&1 | tail -30`
Expected: failures only where an old test asserts `(D5)` / "I7 of the blues: … natural tensions" on a blues, `rules v1`, or the golden/analysis fixtures. Change each blues `(D5)` to `(D9)` and its reason text to the new one; leave the fixture failures for Step 6. Do not change any non-blues D5 assertion.

- [ ] **Step 6: Regenerate the fixtures and read the diff**

Run: `make golden && git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 diff --stat engine/fixtures`
Expected: changes only in charts whose context is blues (about 40). Spot-check `git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 diff engine/fixtures/analysis.json | grep '^+' | grep -v -E 'D9|M6|m10|s4' | head -40`: what's left should be only reason-text changes on blues charts, nothing from a non-blues chart.

- [ ] **Step 7: Commit**

```bash
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 add engine/src/analysis/rules.ts engine/src/analysis/index.ts engine/src/__tests__/blues.test.ts engine/src/__tests__/context.test.ts engine/src/__tests__/rules.test.ts engine/src/__tests__/analysis.test.ts engine/fixtures
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 commit -m "Analysis: blues rules D9, M6, m10, s4 (rules v2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Basic plays the key's Blues scale

**Files:**
- Modify: `engine/src/resolve.ts` (`atLevel`, `resolveScales`; new `bluesTonic`)
- Modify: `engine/src/notes.ts:51` (pass the blues tonic)
- Modify: `engine/src/changes.ts` (the row type ~110–125 gains `levelNote`; filled ~640–650)
- Modify: `engine/src/index.ts` (export `bluesTonic` beside `resolveScales`), `engine/src/__tests__/api.test.ts` snapshot
- Test: `engine/src/__tests__/resolve.test.ts`, `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: rule ids from Task 1.
- Produces: `bluesTonic(a: Analysis): string` ('' unless blues); `atLevel(view, chord, scale, rule, line, blues = '')`; `ChangesRow.levelNote: string` ('' or "Basic: the E Blues scale over the whole blues"). Task 4 reads `levelNote`.

- [ ] **Step 1: Write the failing tests**

Append to `engine/src/__tests__/resolve.test.ts` (reuse its imports; add `parseChart`/`migrateChart`/`analyse` if missing):

```ts
describe('Basic over a blues (blues spec §3)', () => {
  const doc = (text: string) => parseChart(migrateChart(text).text).value
  const blues = doc('title: T\nkey: E\ncontext: blues\nform: A, 12 bars\nA | 1 | E7\nA | 5 | A7\nA | 7 | E7\nA | 9 | B7#9\nA | 10 | A7\nA | 11 | E7\nA | 12 | C#7\n')
  const scales = (d: ReturnType<typeof doc>, level: 'basic' | 'standard' | 'advanced') => [...resolveScales(d, { level, seed: 0 }).values()].map((r) => r.scale)
  it('plays the key’s Blues scale on every blues chord, D1+D9 included', () => {
    expect(scales(blues, 'basic').slice(0, 6)).toEqual(['E Blues', 'E Blues', 'E Blues', 'E Blues', 'E Blues', 'E Blues'])
  })
  it('leaves a chord outside the blues on its ladder', () => {
    expect(scales(blues, 'basic')[6]).not.toBe('E Blues')
  })
  it('Advanced of a D9 row is Bebop Dominant', () => {
    expect(scales(blues, 'advanced')[0]).toBe('E Bebop Dominant')
  })
  it('a minor blues’ V7 is not a blues chord at Basic', () => {
    const minor = doc('title: T\nkey: Cm\ncontext: blues\nform: A, 12 bars\nA | 1 | Cm7\nA | 5 | Fm7\nA | 7 | Cm7\nA | 9 | G7\nA | 11 | Cm7\n')
    const s = scales(minor, 'basic')
    expect(s[0]).toBe('C Blues')
    expect(s[3]).not.toBe('C Blues')
  })
  it('a chord under @key is not either', () => {
    const d = doc('title: T\nkey: F\ncontext: blues\nform: A, 12 bars\nA | 1 | F7\nA | 5 | Bb7\n@key 7 Ab\nA | 7 | AbMaj7\nA | 9 | C7\nA | 11 | F7\n')
    expect(scales(d, 'basic')[2]).not.toBe('F Blues')
  })
})
```

Append to `engine/src/__tests__/changes.test.ts` a test using that file's existing builder for a Changes view at Basic on the E blues above, asserting the I7 row's `levelNote` is `'Basic: the E Blues scale over the whole blues'` and that at Standard it is `''`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/resolve.test.ts src/__tests__/changes.test.ts`
Expected: FAIL — Basic gives E Major Pentatonic; `levelNote` undefined.

- [ ] **Step 3: Implement**

`engine/src/resolve.ts`:

```ts
/** the rules a blues chord gets (blues spec §2), with any D1+ prefix */
const BLUES_RULE = /(^|\+)(D9|M6|m10|s4)$/

/** the blues key's note ("E", "Bb") when the chart reads as a blues; '' otherwise */
export const bluesTonic = (a: Analysis): string => (a.context === 'blues' && a.key ? (a.key.name.split(' ')[0] ?? '') : '')

/** an analysed scale at a level: Standard as analysed; at Basic a blues chord plays the key's Blues scale and a tonic
 * minor (rule m5) Aeolian; else its ladder or a Random pick */
export function atLevel(view: ScaleView, chord: string, scale: string, rule: string, line: number, blues = ''): string {
  if (view.level === 'standard') return scale
  if (view.level === 'basic' && blues && BLUES_RULE.test(rule)) return `${blues} Blues`
  const root = readChord(chord)?.root
  if (view.level === 'basic' && rule === 'm5' && root) return `${rootName(root)} Aeolian`
  return scaleAtLevel(chord, view.level, view.seed, `${line}:${chord}`, scale) ?? scale
}
```

and in `resolveScales`, before `expandRowLines`: `const blues = bluesTonic(analysis)`, passing `blues` as `atLevel`'s sixth argument. Export `isBluesRule = (rule: string): boolean => BLUES_RULE.test(rule)` too.

`engine/src/notes.ts:51`: `atLevel(view, r.chord, r.scale, r.rule, r.line, bluesTonic(a))` (import `bluesTonic`).

`engine/src/changes.ts`: add to the row type, after `heardIn`:

```ts
  /** at Basic, a blues chord's level note ("Basic: the E Blues scale over the whole blues"); '' otherwise */
  levelNote: string
```

and where the row is built (beside `heardIn:`), with `const blues = bluesTonic(analysis)` computed once beside `resolved`:

```ts
            levelNote: view.level === 'basic' && blues && a && !a.stated && resolved.get(i)?.source !== 'written' && isBluesRule(a.rule) ? `Basic: the ${blues} Blues scale over the whole blues` : '',
```

(use the view variable that file already passes to `resolveScales`; spell `blues` for the part as `heardIn` is, via the same helper that file uses for key names, so a B♭-instrument part reads its written note.)

`engine/src/index.ts`: `export { bluesTonic, type Resolved, resolveScales, type ScaleView } from './resolve'`; update the `api.test.ts` snapshot (`cd engine && npx vitest run src/__tests__/api.test.ts -u`) and check its diff adds only `bluesTonic`.

- [ ] **Step 4: Run the tests**

Run: `cd engine && npx vitest run src/__tests__/resolve.test.ts src/__tests__/changes.test.ts src/__tests__/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Full engine suite, fixtures**

Run: `make golden && make test 2>&1 | grep -E "Tests |FAIL"`
Expected: all pass; `git -C … diff --stat engine/fixtures` shows Basic answers changing only on blues charts.

- [ ] **Step 6: Commit**

```bash
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 add engine/src/resolve.ts engine/src/notes.ts engine/src/changes.ts engine/src/index.ts engine/src/__tests__/resolve.test.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/api.test.ts engine/src/__tests__/__snapshots__ engine/fixtures
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 commit -m "Levels: Basic plays the key's Blues scale over a blues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `context:` from iReal, `csm add --context`, `clearMeta`

**Files:**
- Modify: `engine/src/edit.ts` (new `clearMeta` after `setMeta`, ~117)
- Modify: `engine/src/ireal/toChart.ts:264` (header)
- Modify: `engine/src/prepare.ts:11` (`auto` clears)
- Modify: `cli/src/args.ts` (`context` flag), `cli/src/add.ts` only if it lists flags in messages
- Test: `engine/src/__tests__/edit.test.ts`, `engine/src/ireal/__tests__/` (the toChart test file there), `engine/src/__tests__/prepare.test.ts`, `cli/src/__tests__/args.test.ts`
- Modify: `engine/src/__tests__/api.test.ts` snapshot (`clearMeta`, exported by `export * from './edit'`)

**Interfaces:**
- Produces: `clearMeta(doc: ChartDoc, key: MetaKey): ChartDoc` (removes every `key:` meta line; the same doc when there is none). Task 4 uses it.

- [ ] **Step 1: Write the failing tests**

`edit.test.ts`:

```ts
describe('clearMeta', () => {
  it('removes the line, and leaves a chart without one as it is', () => {
    const doc = parseChart('title: T\ncontext: blues\nkey: F\n').value
    expect(serializeChart(clearMeta(doc, 'context'))).not.toMatch(/context:/)
    const none = parseChart('title: T\nkey: F\n').value
    expect(clearMeta(none, 'context')).toBe(none)
  })
})
```

In the toChart test file: a song with `style: 'Medium Blues'` gives a chart containing `context: blues`; one with `style: 'Medium Swing'` doesn't (build songs the way that file already does).

`prepare.test.ts`: `prepareChart(textWithContextBlues, { context: 'auto' }, '2026-10-18').chart` has no `context:` line; `{ context: 'modal' }` writes `context: modal`.

`args.test.ts`: `parseAddArgs(['x.html', '--context', 'blues'])` has `overrides.context === 'blues'`; `--context jazz` returns a string containing `--context is auto, functional, modal or blues`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --root engine src/__tests__/edit.test.ts src/__tests__/prepare.test.ts src/ireal && npx vitest run --root cli`
Expected: FAIL (`clearMeta` not exported; no `context:` line; unknown option `--context`).

- [ ] **Step 3: Implement**

`engine/src/edit.ts`:

```ts
/** remove a header line (every copy of it): a chart without one comes back as it was */
export function clearMeta(doc: ChartDoc, key: MetaKey): ChartDoc {
  const lines = doc.lines.filter((l) => !(l.kind === 'meta' && l.key === key))
  return lines.length === doc.lines.length ? doc : { lines }
}
```

`engine/src/ireal/toChart.ts` header, after the `style:` line:

```ts
    ...(song.style && /blues/i.test(song.style) ? ['context: blues'] : []), // a blues whatever its form (blues spec §1)
```

`engine/src/prepare.ts`:

```ts
  const doc = Object.entries(overrides).reduce((d, [k, v]) => (!v ? d : k === 'context' && v === 'auto' ? clearMeta(d, 'context') : setMeta(d, k as MetaKey, v)), parseChart(text).value)
```

`cli/src/args.ts`: add `'context'` to `HeaderFlag` and `HEADER_FLAGS`; `USAGE` second line gains `[--context auto|functional|modal|blues]`; after the `--kind` check:

```ts
  const context = str('context')
  if (context !== undefined && !['auto', 'functional', 'modal', 'blues'].includes(context)) return `--context is auto, functional, modal or blues\n${USAGE}`
```

Update the api snapshot: `cd engine && npx vitest run src/__tests__/api.test.ts -u` (diff: `clearMeta` only).

- [ ] **Step 4: Run the tests**

Run: `make test 2>&1 | grep -E "Tests |FAIL"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 add engine/src/edit.ts engine/src/ireal/toChart.ts engine/src/prepare.ts engine/src/__tests__/edit.test.ts engine/src/__tests__/prepare.test.ts engine/src/ireal/__tests__ engine/src/__tests__/api.test.ts engine/src/__tests__/__snapshots__ cli/src/args.ts cli/src/__tests__/args.test.ts
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 commit -m "Import: a Blues style writes context: blues; csm add --context; clearMeta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Read as, and the Why note's Basic line

**Files:**
- Modify: `web/app/components/ChartHeadingFields.vue` (a "Read as" listbox in `#chart-details`)
- Modify: `web/app/components/ChangesNote.vue` (prop `levelNote`), `web/app/components/ChangesSystem.vue:122,137` (pass it)
- Test: `web/test/ChartHeadingFields.test.ts`, `web/test/ChangesNote.test.ts`, `web/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `clearMeta` (Task 3), `ChangesRow.levelNote` (Task 2), `setMeta`, `parseChart`'s meta lines.

- [ ] **Step 1: Write the failing unit tests**

`web/test/ChartHeadingFields.test.ts` (follow the file's mount helper; open Details first):

```ts
it('Read as writes context:, and Auto removes it (or adds nothing)', async () => {
  const w = mountFields('title: T\nkey: F\n')
  await openDetails(w)
  await chooseListbox(w, 'Read as', 'Blues')
  expect(lastDocText(w)).toMatch(/^context: blues$/m)
  const v = mountFields('title: T\nkey: F\ncontext: blues\n')
  await openDetails(v)
  await chooseListbox(v, 'Read as', 'Auto')
  expect(lastDocText(v)).not.toMatch(/context:/)
  const n = mountFields('title: T\nkey: F\n')
  await openDetails(n)
  await chooseListbox(n, 'Read as', 'Auto')
  expect(n.emitted('update:doc')).toBeUndefined() // already Auto: nothing to write
})
```

(`mountFields`, `openDetails`, `chooseListbox`, `lastDocText`: use the file's existing helpers; where one is missing, add it at the top of the file: `lastDocText = (w) => serializeChart(w.emitted('update:doc')!.at(-1)![0])`, `chooseListbox` clicks the button named by its `aria-label`, then the option by name.)

`web/test/ChangesNote.test.ts`: mounting with `levelNote: 'Basic: the E Blues scale over the whole blues'` and opening it shows that text; without it, no such line.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --root web test/ChartHeadingFields.test.ts test/ChangesNote.test.ts`
Expected: FAIL (no "Read as" button; no level note).

- [ ] **Step 3: Implement**

`ChartHeadingFields.vue`, inside `#chart-details` after the `DETAIL_KEYS` fields:

```vue
      <UiField>
        <UiLabel>Read as</UiLabel>
        <UiListbox :model-value="readAs" aria-label="Read as" @update:model-value="setReadAs">
          <template #selected="{ value }"><UiListboxLabel>{{ READ_AS_LABELS[value] }}</UiListboxLabel></template>
          <UiListboxOption v-for="r in READ_AS" :key="r" :value="r"><UiListboxLabel>{{ READ_AS_LABELS[r] }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
      </UiField>
```

script:

```ts
/** how the analysis reads the chart (context:): Auto leaves it to the detection */
const READ_AS = ['auto', 'functional', 'modal', 'blues'] as const
type ReadAs = (typeof READ_AS)[number]
const READ_AS_LABELS: Readonly<Record<ReadAs, string>> = { auto: 'Auto', functional: 'Functional', modal: 'Modal', blues: 'Blues' }
const readAs = computed<ReadAs>(() => {
  const v = props.doc.lines.findLast((l) => l.kind === 'meta' && l.key === 'context')
  const value = v?.kind === 'meta' ? v.value.trim().toLowerCase() : ''
  return READ_AS.find((r) => r === value) ?? 'auto'
})
function setReadAs(v: ReadAs): void {
  if (v === readAs.value) return
  emitDoc(v === 'auto' ? clearMeta(props.doc, 'context') : setMeta(props.doc, 'context', v))
}
```

(import `clearMeta` from `@chord-scale-maker/engine`; update the component's doc comment: "…and, folded away, the composer, style, form and Read as".)

`ChangesNote.vue`: add `levelNote?: string` to its props and, after the `pinned` line:

```vue
      <span v-if="levelNote" class="mt-1 block"><DecisionLink id="scale.blues">{{ levelNote }}</DecisionLink></span>
```

`ChangesSystem.vue` lines 122 and 137: add `:level-note="m.levelNote"`.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run --root web test/ChartHeadingFields.test.ts test/ChangesNote.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the e2e test**

Append to `web/e2e/editor.spec.ts`:

```ts
test('Read as Blues reads a 13-bar chart as a blues; at Basic its labels are the key’s Blues scale', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: /chart/i }).fill('title: T\nkey: E\nform: A, 13 bars\n\nsection: A\n1 | E\n5 | A\n7 | E\n9 | B\n10 | A\n11 | E\n13 | B\n')
  await page.getByRole('button', { name: 'Details' }).click()
  await page.getByRole('button', { name: 'Read as' }).click()
  await page.getByRole('option', { name: 'Blues' }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'A Mixolydian', exact: true }).first()).toBeVisible()
  await setScaleLevel(page, 'Basic')
  await expect(page.getByRole('button', { name: 'E Blues', exact: true }).first()).toBeVisible()
})
```

(use the spec file's existing helpers for the chart text box and `setScaleLevel`; match the textbox's real accessible name from `ChartText.vue`.)

- [ ] **Step 6: Build and run it**

Run: `npm run e2e -w web -- e2e/editor.spec.ts -g "Read as Blues"`
Expected: PASS. Then `npm run e2e -w web` (all) and `make a11y`: PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 add web/app/components/ChartHeadingFields.vue web/app/components/ChangesNote.vue web/app/components/ChangesSystem.vue web/test/ChartHeadingFields.test.ts web/test/ChangesNote.test.ts web/e2e/editor.spec.ts
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 commit -m "Editor: Read as (context:); the Why note names Basic's Blues scale

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs, and the library re-saved at rules v2

**Files:**
- Modify: `engine/src/decisions.ts` (row `scale.blues`)
- Modify: `web/app/pages/how-it-decides.vue` (a `DecisionSection id="scale.blues"` under Scales, after the level section)
- Modify: `web/app/pages/help.vue` (Read as sentence in the editor section)
- Modify: `web/app/components/ChartText.vue` (help tip names `context:`)
- Modify: `web/app/utils/releaseNotes.ts`
- Modify: `docs/plan-analysis.md` (§5.4 table, §7 per family, §8, §10 #4, §11), `README.md` ("Charts": `context: blues`), `docs/design.md` if it names the levels' special cases (`grep -n "m5\|Aeolian" docs/design.md`)
- Modify: `engine/charts/*.txt` (re-saved reasons), `engine/fixtures/*`
- Test: `web/test/docs/decisions.test.ts` (existing anchor check), `make docs`

- [ ] **Step 1: The DECISIONS row and the anchor test (fails first)**

Add to `DECISIONS` in `engine/src/decisions.ts` (same shape as its neighbours):

```ts
  { id: 'scale.blues', title: 'A blues', page: 'how-it-decides', anchor: 'scale.blues', summary: 'In a blues the I, IV and V (and a minor blues’ i and iv) play Mixolydian or Dorian at Standard and the key’s Blues scale at Basic.' },
```

Run: `npx vitest run --root web test/docs/decisions.test.ts`
Expected: FAIL (no `scale.blues` anchor on the page).

- [ ] **Step 2: The how-it-decides section**

In `web/app/pages/how-it-decides.vue`, under the Scales subheading after the levels section, a `DecisionSection id="scale.blues"` in that page's existing prose style, saying:
- A chart reads as a blues when its form is a 12- or 24-bar blues, or its header says `context: blues` (Read as: Blues in the editor's Details).
- In a blues the I7, IV7 and a V7 with nowhere it must go are Mixolydian; a triad or 6 chord on I, IV or V too (a maj7 keeps the major rules); a minor blues' i and iv are Dorian, its V7 the minor key's.
- At Basic each of those plays the key's Blues scale (1 ♭3 4 ♭5 5 ♭7): E Blues over E7, A7 and B7. Advanced climbs each chord's own ladder (Mixolydian → Bebop Dominant).
- Chords that leave the blues (a ii–V, a turnaround) keep their own rules at every level.
- "What you can change: Read as, a written scale, or a function."

Run: `npx vitest run --root web test/docs/decisions.test.ts && make docs`
Expected: PASS; links ok.

- [ ] **Step 3: Help, the text tip, release note, README, plan-analysis**

- `help.vue`: in the editor's heading-fields paragraph, "Details also holds **Read as** (Auto, Functional, Modal, Blues): how the analysis reads the chart; Blues reads it as a blues whatever its form (<DecisionLink id="scale.blues">how</DecisionLink>)."
- `ChartText.vue` help tip: add "`context:` functional, modal or blues".
- `releaseNotes.ts`, under today's date at the top: `{ text: 'Blues read as blues: Mixolydian on the I, IV and V (Dorian in a minor blues), the key’s Blues scale at Basic, and Read as in the editor to say a chart is a blues whatever its form.', pr: <this PR's number> }` (fill the number once the PR is open, as in #429).
- `README.md` "Charts": "`context: blues` reads a chart as a blues whatever its form (a 12- or 24-bar blues is found by itself)."
- `docs/plan-analysis.md`: §5.4 table's blues row → "D9 (I7, IV7, unresolved V7), M6 (triads on I/IV/V), m10 (minor blues i, iv), s4 (sus)"; remove the "minor blues takes the minor-key rules on purpose" sentence, replacing it with m10's; §7.1/7.2/7.3/7.6 each gain its rule; §8's list; §10 #4 retitled "The blues chords: Mixolydian (Dorian in a minor blues)"; §11 levels: "at Basic, a blues chord (D9, M6, m10, s4) plays the key's Blues scale, beside m5's Aeolian".

- [ ] **Step 4: Re-save the library at rules v2 and read the diff**

Run: `cd engine && npm run analyse -- --all --strip --save && cd .. && make golden`
Then: `git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 diff --stat engine/charts | tail -3`
Expected: every chart's `# analysis:` header goes to `rules v2`; reason changes only in blues charts (the ~40 listed in the spec §7). Read `git -C … diff engine/charts/west-coast-blues.txt engine/charts/unit-seven.txt engine/charts/your-mind-is-on-vacation.txt engine/charts/f-blues.txt` and confirm the M6/D9 readings.

- [ ] **Step 5: Everything**

Run: `make test && make lint && npm run e2e -w web && make a11y && make docs`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 add engine/src/decisions.ts web/app/pages/how-it-decides.vue web/app/pages/help.vue web/app/components/ChartText.vue web/app/utils/releaseNotes.ts README.md docs/plan-analysis.md engine/charts engine/fixtures
git -C /Users/kevdog/code/Chord-Scale-Maker/.claude/worktrees/recordings-batch-1 commit -m "Docs: blues analysis; the library re-saved at rules v2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(add `docs/design.md` to the `git add` if Step 3 changed it.)
