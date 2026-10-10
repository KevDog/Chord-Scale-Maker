# Functions and Analysis Rules Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A prerendered `/functions` reference page (how to write a function, every function's scale in a chosen key, every analysis rule by id, how to report a disagreement), with the rule id linked from the Changes sheet's reason note and a "Copy for an issue" flow.

**Architecture:** Everything factual comes from `web/engine/` at prerender (and again in the browser when the key changes): a `RULES` table in `engine/analysis/rules.ts`, a `functionsTable(key)` in a new `engine/analysis/catalogue.ts` that runs the real `analyse` pipeline over one-row charts, and exported spellings, error messages and the dominant slot table. The app adds `pages/functions.vue`, turns `ChangesNote.vue` from a hover tooltip into a Headless UI popover carrying the rule link and the copy button, and links in from Help, the footer and the editor grid.

**Tech Stack:** Nuxt 4 (prerendered pages), Vue 3 `<script setup>`, TypeScript strict, Tailwind, Catalyst components in `web/app/components/ui/`, `@headlessui/vue` (already a runtime dependency), Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-10-functions-help-page-design.md

## Global Constraints

- No feature flag: the page and the popover ship on.
- No new runtime `dependencies`; `@headlessui/vue` and `@heroicons/vue` are already there.
- Pages run under the hashed CSP (`web/build/csp.ts`): no inline `<script>` of our own, no `eval`, no third-party origins loaded. A link (navigation) to `https://github.com/KevDog/Chord-Scale-Maker/issues/new` is allowed; nothing is fetched from it.
- `web/engine/` stays free of Vue/DOM imports.
- Build screens from the Catalyst components in `web/app/components/ui/` and the Help page's patterns (`UiSubheading`, `UiText`, `UiTextLink`, `UiTable*`, `UiListbox`, `UiButton`).
- Section 1.1 ("Writing a function") is short and formal.
- Never paraphrase an engine error message on the page: produce it by calling `parseFunction` (or the exported `FUNCTION_ERRORS`) and test it against `functions.ts`.
- Anchors: `#writing`, `#table`, `#rules`, `#report`; rule rows `id="rule-<id>"` (e.g. `rule-m4`); groups `id="group-diatonic"`, `group-secondary`, `group-substitutes`, `group-chromatic`.
- Fallback wording, verbatim: `a guess — an @key or a function would settle it`.
- The reason note is a click-to-open panel (Headless UI `Popover`); Escape or a click outside closes it.
- Rule ids after this plan: no primes. `m7'` → `m9`, `D3'` → `D8`.
- Vitest: `cd web && npx vitest run <file>` (no `--project`). Gates: `make test`, `make lint`, `make e2e`, `make golden` from the repo root.
- Stage files by name; never `git add -A` (iCloud `* 2.*` copies sit untracked in the tree). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pure logic gets a failing test first (TDD); drawing/layout may be e2e-gated.

## Review Focus

1. **JavaScript off, or before hydration:** `/functions` is prerendered for C major, so every section, the table and the rule anchors are in the HTML; the sub-navigation links are plain anchors. → Task 8 e2e: load with `javaScriptEnabled: false` and assert the table rows and `#rule-m4` exist.
2. **A bad or stale key:** `/functions?key=H`, `?key=` or a stored preference that no longer parses falls back to C major without an error, and the query is rewritten to the shown key. → Task 6 unit test of `functionsKeyFrom`.
3. **Clipboard unavailable or refused** (permission denied, insecure context): the copy button shows the text in a selectable read-only box instead of failing silently. → Task 5 unit test with `navigator.clipboard` undefined, and with `writeText` rejecting.
4. **A long share link:** the GitHub link would exceed the URL limit, so it carries the title only and the panel says to paste the copied text. → Task 5 unit test of `issueUrl` at the boundary.
5. **The popover on a phone:** at 390px wide the open panel fits inside the viewport and closes on Escape and on a click outside, and keyboard focus can reach its links. → Task 8 e2e at 390×844.

---

## File map

| File | Change | Task |
| --- | --- | --- |
| `web/engine/analysis/rules.ts` | rename ids; export `Slots`, `dominantScale`, `RULES`, `RuleInfo`, `TIERS`, `ruleParts`, `dominantScaleTable` | 1, 2 |
| `web/engine/analysis/functions.ts` | export `SUFFIXES`, `FUNCTION_ERRORS`, `spellings()` | 2 |
| `web/engine/analysis/catalogue.ts` | new: `functionsTable`, `FunctionRow`, `FunctionGroup`, `CATALOGUE_KEYS` | 3 |
| `web/engine/analysis/index.ts`, `web/engine/index.ts` | re-exports | 2, 3 |
| `web/engine/changes.ts` | `ChangesChord.rule`, `ChangesChord.fallback` | 4 |
| `web/engine/__tests__/analysis.test.ts` | renamed ids | 1 |
| `web/engine/__tests__/rules.test.ts` | new | 2 |
| `web/engine/__tests__/catalogue.test.ts` | new | 3 |
| `web/engine/__tests__/changes.test.ts` | rule/fallback on chords | 4 |
| `web/app/components/ChangesNote.vue` | popover, rule links, fallback wording, copy flow | 4, 5 |
| `web/app/components/ChangesSystem.vue` | pass rule, fallback, chord | 4 |
| `web/app/utils/issueReport.ts` | new: `issueText`, `issueTitle`, `issueUrl`, `ISSUE_TEXT_KEY`, `ISSUE_CONTEXT` | 5 |
| `web/app/components/EditorView.vue` | `shareUrl()` shared by Share and the issue context; `provide(ISSUE_CONTEXT)` | 5 |
| `web/app/pages/contact.vue` | pre-fill from `ISSUE_TEXT_KEY` | 5 |
| `web/app/utils/functionsKey.ts` | new: `FUNCTIONS_KEYS`, `functionsKeyFrom` | 6 |
| `web/app/composables/usePreferences.ts` | `functionsKey` | 6 |
| `web/app/pages/functions.vue` | new | 6 |
| `web/nuxt.config.ts` | prerender `/functions` | 6 |
| `web/app/components/AppShell.vue` | footer link | 6 |
| `web/app/pages/help.vue` | Editing, Odds and ends, preview controls | 7 |
| `web/app/components/ChartGrid.vue` | "How to write a function" links | 7 |
| `web/test/*.test.ts` | unit tests | 4–7 |
| `web/e2e/functions.spec.ts` | new | 8 |
| `web/e2e/changes.spec.ts` | tooltip assertions → popover | 4 |
| `docs/design.md`, `docs/plan-analysis.md`, the spec | docs | 1, 9 |

---

### Task 1: Rename the primed rule ids (`m7'` → `m9`, `D3'` → `D8`)

This commit stands alone, as the user asked.

**Files:**
- Modify: `web/engine/analysis/rules.ts:170,177,251`
- Modify: `web/engine/__tests__/analysis.test.ts:53,55,129`
- Modify: `docs/plan-analysis.md` (§8 "The rules on one page", and every other mention of `m7'` or `D3'`)
- Possibly modify: `fixtures/golden.json` (via `make golden`)

**Interfaces:**
- Produces: rule ids `m9` (iii in major: Dorian) and `D8` (extended dominant into a minor key, including the chain's last link). `D1+D8` replaces `D1+D3'`.

- [ ] **Step 1: Change the tests first**

In `web/engine/__tests__/analysis.test.ts`:
- line 53: the test name `"D3' a chain into a minor chord takes that key, last link included (Stella)"` → `'D8 a chain into a minor chord takes that key, last link included (Stella)'`
- line 55: `["D Phrygian Dominant (D3')", "G Altered (D1+D3')"]` → `['D Phrygian Dominant (D8)', 'G Altered (D1+D8)']`
- line 129: `"E Dorian (m7')", // iii` → `'E Dorian (m9)', // iii`

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run engine/__tests__/analysis.test.ts`
Expected: 2 failures, received `(D3')` / `(m7')`.

- [ ] **Step 3: Rename in the engine**

In `web/engine/analysis/rules.ts`, the two `dominantDecision(e, "D3'", …)` calls (lines 170 and 177) become `dominantDecision(e, 'D8', …)`, and line 251's `rule: "m7'"` becomes `rule: 'm9'`.

- [ ] **Step 4: Rename in the docs**

Run: `grep -n "m7'\|D3'" docs/plan-analysis.md docs/design.md README.md` and replace each rule-id mention (`m7'` → `m9`, `D3'` → `D8`), keeping §8's order and wording otherwise. Leave chord names such as `Dm7'` alone (there are none today, but check each hit).

- [ ] **Step 5: Run the tests, the analyser and the golden fixture**

```bash
cd web && npx vitest run engine/__tests__/analysis.test.ts   # PASS
cd web && npm run analyse -- --all --force --save           # rewrites charts/ only if a saved line changed
cd .. && git status --short charts/                          # expected: no change (rule ids aren't saved in charts)
make golden && git diff --stat fixtures/                     # expected: no change, or only the renamed ids
```

If `charts/` or `fixtures/golden.json` changed, read the diff: only `m7'`→`m9` and `D3'`→`D8` may differ. Anything else is a bug; stop and report it.

- [ ] **Step 6: Commit (this commit alone)**

```bash
git add web/engine/analysis/rules.ts web/engine/__tests__/analysis.test.ts docs/plan-analysis.md
# plus docs/design.md, README.md, fixtures/golden.json, charts/<files> only if they changed
git commit -m "Analysis: rule m7' is m9 and D3' is D8, so every rule id is a letter and a number

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The rules table, spellings, error messages and slot table, exported from the engine

**Files:**
- Modify: `web/engine/analysis/rules.ts` (export `Slots`, `dominantScale`; add `RuleInfo`, `TIERS`, `RULES`, `ruleParts`, `dominantScaleTable`)
- Modify: `web/engine/analysis/functions.ts` (export `SUFFIXES`; add `FUNCTION_ERRORS`, `Spelling`, `spellings`; `parseFunction` uses `FUNCTION_ERRORS`)
- Modify: `web/engine/analysis/index.ts` and `web/engine/index.ts` (re-export the new names; follow how `pins` and `parseKey` are re-exported today, and check `web/engine/index.ts` for how `analysis` is re-exported)
- Create: `web/engine/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: rule ids from Task 1.
- Produces:
  - `type RuleInfo = Readonly<{ id: string; family: Family; tier: 1 | 2 | 3 | 4 | 5; scale: string; looksAt: string; summary: string; guess?: string }>`
  - `const TIERS: Readonly<Record<1 | 2 | 3 | 4 | 5, string>>`
  - `const RULES: readonly RuleInfo[]` (each family's rules in the order the engine tries them)
  - `ruleParts(rule: string): string[]` (`'D1+D4'` → `['D1', 'D4']`)
  - `type Slots`, `dominantScale(s: Slots): string`
  - `dominantScaleTable(): readonly (Slots & Readonly<{ scale: string }>)[]` (all 12 slot combinations)
  - `SUFFIXES`, `FUNCTION_ERRORS`, `type Spelling = Readonly<{ family: Family; written: string; spellings: readonly string[] }>`, `spellings(): readonly Spelling[]`

- [ ] **Step 1: Write the failing tests**

Create `web/engine/__tests__/rules.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { FUNCTION_ERRORS, parseFunction, spellings } from '../analysis/functions'
import { dominantScaleTable, ruleParts, RULES, TIERS } from '../analysis/rules'
import { parseChart } from '../chart'
import { isSyncCopy } from '../util'

const LIBRARY = new URL('../../../charts/', import.meta.url)
const libraryRuleIds = (): Set<string> => {
  const ids = new Set<string>()
  for (const f of readdirSync(LIBRARY).filter((f) => f.endsWith('.txt') && !isSyncCopy(f))) {
    for (const r of analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows) for (const id of ruleParts(r.rule)) ids.add(id)
  }
  return ids
}

describe('RULES', () => {
  it('has one entry per id, each with a tier, a scale, what it looks at and a summary', () => {
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RULES) {
      expect(r.id).toMatch(/^[DMmhds]\d$/)
      expect(Object.keys(TIERS)).toContain(String(r.tier))
      expect(r.scale && r.looksAt && r.summary).toBeTruthy()
    }
  })

  it('knows every rule the library produces (a compound id like D1+D4 by its parts)', () => {
    const known = new Set(RULES.map((r) => r.id))
    expect([...libraryRuleIds()].filter((id) => id !== '?' && !known.has(id))).toEqual([])
  })

  it('splits a compound id into the rules that made it', () => {
    expect(ruleParts('D1+D4')).toEqual(['D1', 'D4'])
    expect(ruleParts('m4')).toEqual(['m4'])
  })

  it('has no primed ids', () => {
    expect(RULES.map((r) => r.id).filter((id) => id.includes("'"))).toEqual([])
  })
})

describe('the dominant slot table', () => {
  it('covers every combination of 9, 11 and 13 once, and names §7.1’s scales', () => {
    const t = dominantScaleTable()
    expect(t).toHaveLength(12)
    const at = (n9: string, n11: string, n13: string) => t.find((r) => r.n9 === n9 && r.n11 === n11 && r.n13 === n13)?.scale
    expect(at('9', '11', '13')).toBe('Mixolydian')
    expect(at('9', '#11', '13')).toBe('Lydian Dominant')
    expect(at('b9', '11', 'b13')).toBe('Phrygian Dominant')
    expect(at('b9#9', '#11', 'b13')).toBe('Altered')
  })
})

describe('function spellings and errors', () => {
  it('groups the accepted quality spellings by family and by how the sheet writes them', () => {
    const find = (family: string, written: string) => spellings().find((s) => s.family === family && s.written === written)?.spellings
    expect(find('major', 'maj7')).toEqual(['maj7', 'Maj7', 'M7', 'maj'])
    expect(find('dominant', '7')).toEqual(['7'])
    expect(find('minor', '7')).toEqual(['7', 'm7'])
    expect(find('minor', '(maj7)')).toEqual(['(maj7)', 'mMaj7'])
    expect(find('halfdim', 'ø7')).toEqual(['ø7', 'ø', 'm7b5'])
    expect(find('dim', '°7')).toEqual(['o7', 'o', 'dim7'])
    expect(find('sus', '7sus')).toEqual(['7sus4', '7sus', 'sus'])
    expect(spellings().some((s) => s.family === 'major' && s.spellings.includes('m'))).toBe(false)
  })

  it('the four error messages are the ones parseFunction gives', () => {
    expect(parseFunction('H: V7')).toBe(FUNCTION_ERRORS.notAKey('H'))
    expect(parseFunction('V7/x')).toBe(FUNCTION_ERRORS.notAFunction('V7/x'))
    expect(parseFunction('subii7')).toBe(FUNCTION_ERRORS.subNotDominant())
    expect(parseFunction('iimaj7')).toBe(FUNCTION_ERRORS.majorOnLowerCase('iimaj7'))
  })
})
```

(`isSyncCopy` lives in `web/engine/util.ts`; the guide tone lines test imports it the same way.)

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run engine/__tests__/rules.test.ts`
Expected: FAIL — `RULES`, `ruleParts`, `TIERS`, `dominantScaleTable`, `spellings`, `FUNCTION_ERRORS` are not exported.

- [ ] **Step 3: Implement in `rules.ts`**

Export the existing type and function: `export type Slots = …` (line 58) and `export function dominantScale(…)` (line 99). Then add, after `decide`:

```ts
// —— the rules, for the reference page (/functions) ——

/** what a rule looks at, from the least to the most contextual */
export const TIERS = {
  1: 'The chord symbol alone',
  2: 'The chart’s mode',
  3: 'The chord’s degree in its key',
  4: 'The chords around it',
  5: 'A guess',
} as const

/** one rule as the reference page lists it; guess: when its verdict is only a guess (fallback) */
export type RuleInfo = Readonly<{ id: string; family: Family; tier: keyof typeof TIERS; scale: string; looksAt: string; summary: string; guess?: string }>

/** every rule id decide() can give, each family's in the order it tries them */
export const RULES: readonly RuleInfo[] = [
  { id: 'D1', family: 'dominant', tier: 1, scale: 'from the symbol (Altered for alt)', looksAt: 'the tensions written in the symbol', summary: 'An alt dominant is Altered; written tensions (b9, #9, #11, b13) override any other rule’s, shown as D1+ before that rule.' },
  { id: 'D7', family: 'dominant', tier: 3, scale: 'Mixolydian', looksAt: 'a modal chart, or a dominant held four bars or more', summary: 'A static or modal dominant is its own mode: Mixolydian.' },
  { id: 'D2', family: 'dominant', tier: 4, scale: 'Lydian Dominant', looksAt: 'the next chord, a half step down', summary: 'A tritone substitute resolves down a half step: Lydian Dominant.' },
  { id: 'D3', family: 'dominant', tier: 4, scale: 'Mixolydian', looksAt: 'the next chord, another dominant a fifth down', summary: 'An extended dominant (V7 of another V7) keeps natural tensions: Mixolydian.' },
  { id: 'D8', family: 'dominant', tier: 4, scale: 'derived from the minor key', looksAt: 'a chain of dominants that ends on a minor chord', summary: 'An extended dominant on its way into a minor key takes its tensions from that key.' },
  { id: 'D4', family: 'dominant', tier: 4, scale: 'derived from the key', looksAt: 'the chord it resolves to, a fifth down (or the ii before it)', summary: 'A resolving dominant takes each tension (9, 11, 13) in the form the key holds.' },
  { id: 'D5', family: 'dominant', tier: 3, scale: 'derived from the key', looksAt: 'its degree: the back door, the blues, or a diatonic dominant', summary: 'A back-door ♭VII7, a blues I7 or IV7, or a diatonic dominant that does not resolve takes its tensions from the key.', guess: 'a diatonic dominant that does not resolve' },
  { id: 'D6', family: 'dominant', tier: 4, scale: 'Lydian Dominant', looksAt: 'a chromatic dominant with nowhere to go', summary: 'A chromatic dominant that does not resolve is its own key: Lydian Dominant.', guess: 'always' },
  { id: 'M1', family: 'major', tier: 1, scale: 'Lydian', looksAt: 'a #11 in the symbol', summary: 'A maj7#11 is Lydian.' },
  { id: 'M2', family: 'major', tier: 1, scale: 'Lydian Augmented', looksAt: 'a #5 in the symbol', summary: 'A maj7#5 is Lydian Augmented.' },
  { id: 'M5', family: 'major', tier: 2, scale: 'Lydian', looksAt: 'a modal chart', summary: 'A major chord in a modal chart is Lydian.' },
  { id: 'M3', family: 'major', tier: 3, scale: 'Ionian (Mixolydian for a V triad)', looksAt: 'its degree: the tonic', summary: 'The tonic major chord (or ♭III, the relative major, in a minor key) is Ionian; a V triad without its 7th is Mixolydian.' },
  { id: 'M4', family: 'major', tier: 3, scale: 'Lydian', looksAt: 'its degree: any other major chord', summary: 'Any other major chord is Lydian (on IV, the #4 is the key’s 7th).' },
  { id: 'm1', family: 'minor', tier: 1, scale: 'Melodic Minor', looksAt: 'a major 7th in the symbol', summary: 'A minor-major 7th is Melodic Minor.' },
  { id: 'm2', family: 'minor', tier: 1, scale: 'Dorian', looksAt: 'a 6 in the symbol', summary: 'A minor sixth chord is Dorian.' },
  { id: 'm3', family: 'minor', tier: 1, scale: 'Aeolian', looksAt: 'a b6 or b13 in the symbol', summary: 'A minor chord with a written b6 is Aeolian.' },
  { id: 'm6', family: 'minor', tier: 2, scale: 'Dorian', looksAt: 'a modal chart', summary: 'A minor chord in a modal chart is Dorian.' },
  { id: 'm4', family: 'minor', tier: 4, scale: 'Dorian', looksAt: 'the next chord, a dominant a fourth up', summary: 'The ii of a ii–V is Dorian.' },
  { id: 'm5', family: 'minor', tier: 3, scale: 'Dorian', looksAt: 'its degree: the tonic of a minor key', summary: 'The tonic minor chord is Dorian, by convention.' },
  { id: 'm9', family: 'minor', tier: 3, scale: 'Dorian', looksAt: 'its degree: iii in a major key', summary: 'iii in a major key is Dorian (its Phrygian would put a b9 over the root).' },
  { id: 'm7', family: 'minor', tier: 3, scale: 'Dorian, Aeolian or Phrygian', looksAt: 'its degree: another diatonic minor chord', summary: 'A diatonic minor chord takes the key’s own notes: ii Dorian, vi Aeolian, v of a minor key Phrygian.' },
  { id: 'm8', family: 'minor', tier: 5, scale: 'Dorian', looksAt: 'a minor chord the key does not hold', summary: 'A borrowed or chromatic minor chord is Dorian, its own key.', guess: 'always' },
  { id: 'h1', family: 'halfdim', tier: 2, scale: 'Locrian natural 2', looksAt: 'a modal chart', summary: 'A half-diminished chord in a modal chart is Locrian ♮2.' },
  { id: 'h2', family: 'halfdim', tier: 4, scale: 'Locrian', looksAt: 'the next chord, a dominant a fourth up', summary: 'A half-diminished chord is Locrian; with a dominant after it, it is the iiø7 of that minor ii–V.', guess: 'no related dominant follows' },
  { id: 'd1', family: 'dim', tier: 4, scale: 'Whole-Half Diminished', looksAt: 'the chords on either side', summary: 'A diminished seventh chord (a vii°7 leading up a half step, or an auxiliary) is Whole-Half Diminished.', guess: 'a passing diminished chord' },
  { id: 's1', family: 'sus', tier: 1, scale: 'Phrygian', looksAt: 'a b9 in the symbol', summary: 'A sus b9 is Phrygian.' },
  { id: 's2', family: 'sus', tier: 4, scale: 'Mixolydian or Mixolydian b6', looksAt: 'the next chord, a fifth down', summary: 'A resolving sus takes its 13 from the key: Mixolydian, or Mixolydian b6 when the key holds the b13.' },
  { id: 's3', family: 'sus', tier: 4, scale: 'Mixolydian', looksAt: 'no resolution', summary: 'A static sus is Mixolydian.' },
]

/** the rules a verdict's id names: "D1+D4" -> D1, D4 */
export const ruleParts = (rule: string): string[] => rule.split('+').filter(Boolean)

/** §7.1 in full: every combination of the three tension slots, and the dominant scale it names */
export function dominantScaleTable(): readonly (Slots & Readonly<{ scale: string }>)[] {
  const n9s: Slots['n9'][] = ['9', 'b9', 'b9#9']
  const n11s: Slots['n11'][] = ['11', '#11']
  const n13s: Slots['n13'][] = ['13', 'b13']
  return n9s.flatMap((n9) => n11s.flatMap((n11) => n13s.map((n13) => ({ n9, n11, n13, scale: dominantScale({ n9, n11, n13 }) }))))
}
```

Add `import type { Family } from './stream'` if it isn't already imported (it is not today: `stream` is imported for values only; add `type Family` to that import). Check each summary against the code paths in `decide` as you write it; a summary must never claim something the code does not do. If one is wrong, correct the summary, not the code.

- [ ] **Step 4: Implement in `functions.ts`**

`export const SUFFIXES` (line 39; add `export`). Add, before `parseFunction`:

```ts
/** the messages parseFunction gives, so the reference page can show them verbatim */
export const FUNCTION_ERRORS = {
  notAKey: (keyPart: string): string => `"${keyPart}" isn't a key (Eb, Cm)`,
  notAFunction: (body: string): string => `"${body}" isn't a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)`,
  subNotDominant: (): string => 'sub only goes on a dominant (subV7)',
  majorOnLowerCase: (body: string): string => `${body}: a major quality on a lower-case numeral`,
} as const
```

and replace the four literal messages in `parseFunction` with `FUNCTION_ERRORS.notAKey(keyPart)`, `FUNCTION_ERRORS.notAFunction(body)`, `FUNCTION_ERRORS.subNotDominant()`, `FUNCTION_ERRORS.majorOnLowerCase(body)`.

Then add, after `parseFunction`:

```ts
/** one family's quality spellings, grouped by how the sheet writes them ("maj7" <- maj7, Maj7, M7, maj) */
export type Spelling = Readonly<{ family: Family; written: string; spellings: readonly string[] }>

/** every spelling the grammar accepts, on an upper- and a lower-case numeral, minus the one it rejects (a major quality on lower case) */
export function spellings(): readonly Spelling[] {
  const groups = new Map<string, { family: Family; written: string; spellings: string[] }>()
  for (const [spelling, written] of Object.entries(SUFFIXES)) {
    for (const upper of [true, false]) {
      const family = familyOf(spelling, upper)
      if (!upper && family === 'major') continue
      const k = `${family}|${written}`
      const g = groups.get(k) ?? { family, written, spellings: [] }
      if (!g.spellings.includes(spelling)) g.spellings.push(spelling)
      groups.set(k, g)
    }
  }
  return [...groups.values()]
}
```

`Object.entries` keeps `SUFFIXES`' insertion order, so the spellings come out in the order the test expects.

- [ ] **Step 5: Re-export**

In `web/engine/analysis/index.ts`, next to `export { pins } from './rules'`:

```ts
export { dominantScale, dominantScaleTable, ruleParts, type RuleInfo, RULES, type Slots, TIERS } from './rules'
export { FUNCTION_ERRORS, parseFunction, type Spelling, spellings, SUFFIXES } from './functions'
```

(If `parseFunction` is already exported from `index.ts` or `engine/index.ts`, don't export it twice; `npm run typecheck` will say.) Make sure `web/engine/index.ts` re-exports these names too (it re-exports `analysis`; follow its pattern).

- [ ] **Step 6: Run the tests**

Run: `cd web && npx vitest run engine/__tests__/rules.test.ts engine/__tests__/functions.test.ts engine/__tests__/ambiguity.test.ts`
Expected: PASS. If "knows every rule the library produces" lists an id, add it to `RULES` (with a summary true to the code).

- [ ] **Step 7: Commit**

```bash
git add web/engine/analysis/rules.ts web/engine/analysis/functions.ts web/engine/analysis/index.ts web/engine/index.ts web/engine/__tests__/rules.test.ts
git commit -m "Engine: the rules table, quality spellings, function error messages and dominant slot table, for the reference page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `functionsTable(key)`: every function's chord and scale in a key, from the real pipeline

**Files:**
- Create: `web/engine/analysis/catalogue.ts`
- Modify: `web/engine/analysis/index.ts`, `web/engine/index.ts` (re-export)
- Create: `web/engine/__tests__/catalogue.test.ts`

**Interfaces:**
- Consumes: `analyse` (`analysis/index.ts`), `parseFunction`, `functionRoot` (`functions.ts`), `parseKey`, `keyCode`, `type Key` (`keys.ts`), `parseChart` (`../chart`), `rootName` (`../pitch`), `RULES`, `ruleParts` (Task 2).
- Produces:
  - `type FunctionGroup = 'diatonic' | 'secondary' | 'substitutes' | 'chromatic'`
  - `const FUNCTION_GROUPS: readonly Readonly<{ id: FunctionGroup; title: string }>[]` (titles: `Diatonic`, `Secondary`, `Substitutes and borrowings`, `Chromatic`)
  - `type FunctionRow = Readonly<{ group: FunctionGroup; fn: string; chord: string; scale: string | null; rule: string; reason: string; fallback: boolean }>`
  - `functionsTable(key: Key): readonly FunctionRow[]`
  - `const CATALOGUE_KEYS: readonly string[]` (the 30 keys: 15 major, 15 minor)

- [ ] **Step 1: Write the failing tests**

Create `web/engine/__tests__/catalogue.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { CATALOGUE_KEYS, functionsTable } from '../analysis/catalogue'
import { parseKey } from '../analysis/keys'
import { ruleParts, RULES } from '../analysis/rules'
import { parseChart } from '../chart'
import { isSyncCopy } from '../util'

const table = (k: string) => functionsTable(parseKey(k) ?? (() => { throw new Error(k) })())
const row = (k: string, fn: string) => table(k).find((r) => r.fn === fn)

describe('functionsTable', () => {
  it('every row is reached by a rule (none is "?")', () => {
    for (const k of CATALOGUE_KEYS) expect(table(k).filter((r) => r.rule === '?').map((r) => r.fn), k).toEqual([])
  })

  it('C major has the textbook rows', () => {
    expect(row('C', 'V7')).toMatchObject({ chord: 'G7', scale: 'G Mixolydian' })
    expect(row('C', 'ii7')).toMatchObject({ chord: 'Dm7', scale: 'D Dorian' })
    expect(row('C', 'V7/ii')).toMatchObject({ chord: 'A7', scale: 'A Mixolydian b6' })
    expect(row('C', 'subV7')).toMatchObject({ chord: 'Db7', scale: 'Db Lydian Dominant' })
    expect(row('C', '♭VII7')).toMatchObject({ chord: 'Bb7', scale: 'Bb Lydian Dominant' })
    expect(row('C', 'viiø7')).toMatchObject({ chord: 'Bm7b5', scale: 'B Locrian' })
    expect(row('C', 'iiø7/vi')).toMatchObject({ chord: 'Bm7b5', scale: 'B Locrian' })
  })

  it('groups the rows: diatonic, secondary, substitutes and borrowings, chromatic', () => {
    const groups = [...new Set(table('C').map((r) => r.group))]
    expect(groups).toEqual(['diatonic', 'secondary', 'substitutes', 'chromatic'])
  })

  it('marks the guesses (fallback rows) and shows at least one per guessing family', () => {
    const guesses = table('C').filter((r) => r.fallback)
    expect(guesses.map((r) => ruleParts(r.rule).at(-1))).toEqual(expect.arrayContaining(['m8', 'h2', 'd1']))
  })

  it('every major key lists the same functions as C, and every minor key the same as A minor', () => {
    const fns = (k: string) => table(k).map((r) => r.fn)
    expect(CATALOGUE_KEYS).toHaveLength(30)
    for (const k of CATALOGUE_KEYS) expect(fns(k), k).toEqual(fns(parseKey(k)?.minor ? 'Am' : 'C'))
  })

  it('each chord is spelled from its function in the key (V7/V in Eb is F7, subV7/IV in C is Gb7)', () => {
    expect(row('Eb', 'V7/V')?.chord).toBe('F7')
    expect(row('C', 'subV7/IV')?.chord).toBe('Gb7')
  })

  it('reasons read as the sheet gives them, without the stated-function star', () => {
    for (const r of table('C')) expect(r.reason.startsWith('* ')).toBe(false)
  })
})

describe('RULES against what the engine produces', () => {
  it('every rule in RULES is reached by the library or by the catalogue in some key', () => {
    const seen = new Set<string>()
    const LIBRARY = new URL('../../../charts/', import.meta.url)
    for (const f of readdirSync(LIBRARY).filter((f) => f.endsWith('.txt') && !isSyncCopy(f)))
      for (const r of analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows) ruleParts(r.rule).forEach((id) => seen.add(id))
    for (const k of CATALOGUE_KEYS) for (const r of table(k)) ruleParts(r.rule).forEach((id) => seen.add(id))
    expect(RULES.map((r) => r.id).filter((id) => !seen.has(id))).toEqual([])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && npx vitest run engine/__tests__/catalogue.test.ts`
Expected: FAIL, module `../analysis/catalogue` not found.

- [ ] **Step 3: Implement `catalogue.ts`**

```ts
import { parseChart } from '../chart'
import { rootName } from '../pitch'
import { functionRoot, parseFunction } from './functions'
import { analyse } from './index'
import { type Key, keyCode } from './keys'
import type { Family } from './stream'

/**
 * The reference page's table (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §1.2): each function the
 * rules know, in a key, with the chord it puts there and the scale the rules give it. Not a lookup: each row is a
 * one-row chart `<chord> | <function>` through analyse(), so the page can't drift from the engine. Pure.
 */

export type FunctionGroup = 'diatonic' | 'secondary' | 'substitutes' | 'chromatic'
export const FUNCTION_GROUPS: readonly Readonly<{ id: FunctionGroup; title: string }>[] = [
  { id: 'diatonic', title: 'Diatonic' },
  { id: 'secondary', title: 'Secondary' },
  { id: 'substitutes', title: 'Substitutes and borrowings' },
  { id: 'chromatic', title: 'Chromatic' },
]
/** fn: as the sheet writes it; fallback: the rules could only guess */
export type FunctionRow = Readonly<{ group: FunctionGroup; fn: string; chord: string; scale: string | null; rule: string; reason: string; fallback: boolean }>

/** the 30 keys: every major and minor key signature */
export const CATALOGUE_KEYS: readonly string[] = [
  ...['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  ...['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'],
]

/** a function's chord quality as a chart writes it, by family and by the sheet's written suffix */
const QUALITY: Readonly<Record<Family, Readonly<Record<string, string>>>> = {
  major: { '': '', maj7: 'Maj7', 'maj7♯5': 'Maj7#5', '6': '6' },
  dominant: { '7': '7' },
  minor: { '': 'm', '7': 'm7', '6': 'm6', '(maj7)': 'mMaj7' },
  halfdim: { ø7: 'm7b5' },
  dim: { '°7': 'dim7' },
  sus: { '7sus': '7sus4' },
}

const MAJOR_DIATONIC = ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']
const MINOR_DIATONIC = ['i7', 'iiø7', '♭IIImaj7', 'iv7', 'v7', 'V7', '♭VImaj7', '♭VII7', 'vii°7']
/** the diatonic chords a secondary function can lead to: not the tonic, not a ø7 or °7 */
const MAJOR_TARGETS = ['ii', 'iii', 'IV', 'V', 'vi']
const MINOR_TARGETS = ['♭III', 'iv', 'v', '♭VI', '♭VII']
const isMinorTarget = (t: string): boolean => t === t.toLowerCase()

function rowsFor(key: Key): readonly (readonly [FunctionGroup, string])[] {
  const targets = key.minor ? MINOR_TARGETS : MAJOR_TARGETS
  return [
    ...(key.minor ? MINOR_DIATONIC : MAJOR_DIATONIC).map((fn) => ['diatonic', fn] as const),
    // a minor target takes the minor ii–V's iiø7 (iiø7/vi); a major one the major ii–V's ii7 (ii7/IV)
    ...targets.flatMap((t) => [['secondary', `V7/${t}`] as const, ['secondary', `${isMinorTarget(t) ? 'iiø7' : 'ii7'}/${t}`] as const]),
    ...[
      'subV7',
      ...targets.map((t) => `subV7/${t}`),
      ...(key.minor ? [] : ['♭VII7', '♭VImaj7', '♭IIImaj7']),
      '♭IImaj7',
      'IV7',
      'I7',
      '♯iv°7',
      ...targets.map((t) => `vii°7/${t}`),
      'V7sus',
    ].map((fn) => ['substitutes', fn] as const),
    ...['♭vi7', '♯ivø7', '♭iii°7', 'II7', '♯IV7'].map((fn) => ['chromatic', fn] as const),
  ]
}
```

```ts
/** one function in the key, through the real pipeline; null when the function won't read */
function rowOf(group: FunctionGroup, text: string, key: Key): FunctionRow | null {
  const f = parseFunction(text)
  if (typeof f === 'string') return null
  const written = f.text.replace(/^(sub)?[♭♯]?[ivIV]+/, '').replace(/\/.*$/, '')
  const quality = QUALITY[f.family][written] ?? ''
  const chord = `${rootName(functionRoot(f, key))}${quality}`
  const doc = parseChart(`key: ${keyCode(key)}\nA | 1 | ${chord} | | ${text}\n`).value
  const a = analyse(doc).rows[0]
  if (!a) return null
  return { group, fn: f.text, chord, scale: a.scale, rule: a.rule, reason: a.reason.replace(/^\* /, ''), fallback: !!a.fallback }
}

export function functionsTable(key: Key): readonly FunctionRow[] {
  return rowsFor(key).flatMap(([group, text]) => rowOf(group, text, key) ?? [])
}
```

Notes for the implementer:
- `analyse()` drops `fallback` from a stated row's decision (`index.ts` line ~170: `s ? { ...ruled, reason: … }` without `fallback`). The table needs the guess flag, so change that line to keep it: `const decision: Decision = s ? { ...ruled, reason: \`* ${ruled.reason}\`, ...(fallback ? { fallback } : {}) } : fallback ? { ...ruled, fallback } : ruled`. Run `npx vitest run engine/__tests__/analysis.test.ts engine/__tests__/changes.test.ts` after it: a stated row that falls back was not marked before; if a test pinned that, update the expectation and say why in the report.
- The chord root follows the key's spelling (`functionRoot` shifts the key's tonic): `rootName` gives `Db`, `F#`, etc. If a root would need a double accidental in a remote key (e.g. `subV7/♭VI` in Cb), keep it: the test only checks that every key reads and no row is `'?'`.
- A row whose chord the chart parser can't read gives `rule: '?'` and fails the first test: fix the `QUALITY` map, don't drop the row.
- Functions in the spec's list that the one-row chart can't produce as named (e.g. `I7`/`IV7` as blues: the blues context needs a 12-bar form) still get a row with whatever the rules give. List each in your report with its rule and why, for the PR description.

- [ ] **Step 4: Re-export**

`web/engine/analysis/index.ts`: `export { CATALOGUE_KEYS, FUNCTION_GROUPS, type FunctionGroup, type FunctionRow, functionsTable } from './catalogue'`; and the same names from `web/engine/index.ts` if it lists names explicitly. Watch for a circular import: `catalogue.ts` imports `analyse` from `./index`, and `index.ts` re-exports `catalogue`. ES modules handle this because `functionsTable` only calls `analyse` at call time; if the typecheck or a test reports `analyse is not a function`, move the re-export into `web/engine/index.ts` only.

- [ ] **Step 5: Run the tests**

Run: `cd web && npx vitest run engine/__tests__/catalogue.test.ts engine/__tests__/analysis.test.ts`
Expected: PASS. If the "every rule in RULES is reached" test lists an id, look at why: either add a catalogue row that reaches it, or (for modal rules M5, m6, h1) confirm the library reaches it.

- [ ] **Step 6: Print the C-major table for the PR**

```bash
cd web && npx vite-node -e "import { functionsTable, parseKey } from './engine'; for (const r of functionsTable(parseKey('C')!)) console.log(['', r.group, r.fn, r.chord, r.scale, r.rule + (r.fallback ? ' (guess)' : ''), r.reason, ''].join(' | '))" > ../.superpowers/sdd/functions-page/c-major-table.md
```

(If `vite-node -e` isn't supported, write the two lines to a scratch file outside the repo and run it.) Keep the file for the PR; don't commit it.

- [ ] **Step 7: Commit**

```bash
git add web/engine/analysis/catalogue.ts web/engine/analysis/index.ts web/engine/index.ts web/engine/__tests__/catalogue.test.ts
# plus web/engine/__tests__/analysis.test.ts or changes.test.ts only if Step 3's fallback change moved an expectation
git commit -m "Engine: functionsTable, every function's chord and scale in a key, run through analyse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The reason note becomes a popover with the rule link

**Files:**
- Modify: `web/engine/changes.ts` (`ChangesChord`: add `rule`, `fallback`)
- Modify: `web/engine/__tests__/changes.test.ts`
- Modify: `web/app/components/ChangesNote.vue`
- Modify: `web/app/components/ChangesSystem.vue:38,49,85,86`
- Create or modify: `web/test/ChangesNote.test.ts`
- Modify: `web/e2e/changes.spec.ts:78-84` (tooltip assertions → popover)

**Interfaces:**
- Consumes: `ruleParts` (Task 2).
- Produces:
  - `ChangesChord.rule: string` (`''` when the analysis doesn't reach the chord) and `ChangesChord.fallback: boolean`. No other type widens.
  - `ChangesNote` props: `{ reason: string; heardIn: string; keyFrom: ChangesChord['keyFrom']; rule: string; fallback: boolean; chord: string; numeral: string; scale: string | null; wrap?: boolean }`.
  - In the open panel: `role="dialog"` with `aria-label="Why: <chord>"`; rule links `href="/functions#rule-<id>"`.

- [ ] **Step 1: Failing engine test**

In `web/engine/__tests__/changes.test.ts`, add (reuse the file's helpers for building a doc and calling `buildChanges`; read the top of the file first):

```ts
it('each chord carries the rule behind its scale, and whether the rules only guessed', () => {
  const chords = changesOf('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\nA | 4 | Abm7\n').flatMap((b) => b.chords)
  expect(chords.map((c) => [c.text, c.rule, c.fallback])).toEqual([
    ['Dm7', 'm4', false],
    ['G7', 'D4', false],
    ['CMaj7', 'M3', false],
    ['Abm7', 'm8', true],
  ])
})
```

(`changesOf` stands for however the file builds bars from a chart text; use its existing helper and adapt the access path to its shape.)

Run: `cd web && npx vitest run engine/__tests__/changes.test.ts` → FAIL (`rule` undefined).

- [ ] **Step 2: Thread `rule` and `fallback`**

In `web/engine/changes.ts`, add to `ChangesChord` (after `reason`):

```ts
  /** the rule id behind its scale ("m4", "D1+D4"); '' when the analysis doesn't reach it */
  rule: string
  /** the rules could only guess its scale (an @key or a function would settle it) */
  fallback: boolean
```

and where chords are built (line ~220): `rule: a?.rule && a.rule !== '?' ? a.rule : '', fallback: !!a?.fallback,`. Run the test → PASS. Run `npm run typecheck` (from `web/`) and fix every place that constructs a `ChangesChord` literal (tests included).

- [ ] **Step 3: Failing component test**

Create `web/test/ChangesNote.test.ts` (mirror how other `web/test/*.test.ts` mount components with `@vue/test-utils` / `mountSuspended`; read one, e.g. `web/test/ChangesSystem.test.ts`, first):

```ts
it('opens on click and shows the reason, the key, and the rule as a link', async () => {
  const w = await mountNote({ reason: 'ii of the ii–V to C', heardIn: 'C major', keyFrom: 'found', rule: 'm4', fallback: false, chord: 'Dm7', numeral: 'ii7', scale: 'D Dorian' })
  expect(w.find('[role=dialog]').exists()).toBe(false)
  await w.find('button').trigger('click')
  const panel = w.find('[role=dialog]')
  expect(panel.text()).toContain('ii of the ii–V to C')
  expect(panel.text()).toContain('in C major')
  expect(panel.find('a[href="/functions#rule-m4"]').text()).toBe('m4')
})

it('links each part of a compound rule', async () => {
  const w = await mountNote({ reason: 'V7 of C: the 13 from the symbol', heardIn: 'C major', keyFrom: 'found', rule: 'D1+D4', fallback: false, chord: 'G7b9', numeral: 'V7', scale: 'G Half-Whole Diminished' })
  await w.find('button').trigger('click')
  expect(w.findAll('[role=dialog] a[href^="/functions#rule-"]').map((a) => a.attributes('href'))).toEqual(['/functions#rule-D1', '/functions#rule-D4'])
})

it('says when the rules only guessed', async () => {
  const w = await mountNote({ reason: 'a borrowed minor chord: Dorian, its own key', heardIn: 'C major', keyFrom: 'found', rule: 'm8', fallback: true, chord: 'Abm7', numeral: '♭vi7', scale: 'Ab Dorian' })
  await w.find('button').trigger('click')
  expect(w.find('[role=dialog]').text()).toContain('rule m8, a guess — an @key or a function would settle it')
})
```

Run: `cd web && npx vitest run test/ChangesNote.test.ts` → FAIL.

- [ ] **Step 4: Rewrite `ChangesNote.vue` as a popover**

```vue
<template>
  <!-- a numeral or scale on the Changes sheet; a click or tap opens why the analysis chose it, with the rule behind it -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :class="wrap ? 'whitespace-normal' : 'truncate'"
      class="block max-w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500"
    >
      <slot />
    </HPopoverButton>
    <HPopoverPanel
      role="dialog"
      :aria-label="`Why: ${chord}`"
      class="absolute top-full left-0 z-20 mt-2 w-72 rounded-lg max-sm:-left-12 max-sm:w-[calc(100vw-2rem)] bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden"
    >
      <span class="block">
        {{ reason }}<template v-if="rule">
          · rule <template v-for="(id, k) in parts" :key="id"><template v-if="k">+</template><NuxtLink :to="`/functions#rule-${id}`" class="underline decoration-zinc-950/30 hover:decoration-zinc-950 dark:decoration-white/30 dark:hover:decoration-white">{{ id }}</NuxtLink></template><template v-if="fallback">, a guess — an @key or a function would settle it</template>
        </template>
      </span>
      <span class="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{{ keyFrom === 'found' ? '' : '* ' }}in {{ heardIn }}</span>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { type ChangesChord, ruleParts } from '~~/engine'

/**
 * why the analysis gave a chord its function and scale (engine/changes.ts reason, rule, heardIn, keyFrom), opened by a
 * click or tap; Escape or a click outside closes it. A key the author set, by an @key or the function's own key, is
 * starred, as in the grid's Function dropdown. The rule id links to its row on /functions.
 */
const props = withDefaults(
  defineProps<{ reason: string; heardIn: string; keyFrom: ChangesChord['keyFrom']; rule: string; fallback: boolean; chord: string; numeral: string; scale: string | null; wrap?: boolean }>(),
  { wrap: false },
)
const parts = computed(() => ruleParts(props.rule))
</script>
```

Task 5 adds the copy flow after the "in …" line.

- [ ] **Step 5: Pass the new props from `ChangesSystem.vue`**

At line 85 add `rule: c.rule, fallback: c.fallback` to each mark, and at line 86 `rule: '', fallback: false`. At lines 38 and 49 pass `:rule="m.rule" :fallback="m.fallback" :chord="m.text" :numeral="m.numeral" :scale="m.scale"`.

- [ ] **Step 6: Run the unit tests**

Run: `cd web && npx vitest run test/ChangesNote.test.ts test/ChangesSystem.test.ts test/ChangesSheet.test.ts`
Expected: PASS. Fix any existing test that looked for `role="tooltip"` inside the Changes sheet: it now clicks the button and looks for `role="dialog"`.

- [ ] **Step 7: Update the e2e assertions**

In `web/e2e/changes.spec.ts` (the test at ~line 67, "a function from the dropdown…"), replace lines 79–84:

```ts
  const numeral = sheet.getByRole('button', { name: 'V7/V' })
  await numeral.click()
  const note = page.getByRole('dialog', { name: 'Why: D7' })
  await expect(note).toContainText('* V7/V in C: natural tensions')
  await expect(note).toContainText('in C major')
  await expect(note.getByRole('link', { name: 'D4' })).toHaveAttribute('href', '/functions#rule-D4')
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
```

Run: `cd web && npx playwright test e2e/changes.spec.ts` (after `make e2e` has built once, or run `make e2e`). Expected: PASS. Also run `grep -rn "tooltip" web/e2e` and update any other assertion on the Changes sheet's note (the editor's `HelpTip` tooltips stay tooltips).

- [ ] **Step 8: Commit**

```bash
git add web/engine/changes.ts web/engine/__tests__/changes.test.ts web/app/components/ChangesNote.vue web/app/components/ChangesSystem.vue web/test/ChangesNote.test.ts web/e2e/changes.spec.ts
# plus any test file Step 2's typecheck or Step 6 made you update, by name
git commit -m "Changes sheet: the reason note opens on a click, and names the rule with a link to it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Copy for an issue": the text, the contact form, a GitHub issue

**Files:**
- Create: `web/app/utils/issueReport.ts`
- Create: `web/test/issueReport.test.ts`
- Modify: `web/app/components/ChangesNote.vue` (the copy flow)
- Modify: `web/app/components/EditorView.vue:305-327` (`shareUrl()`; `provide(ISSUE_CONTEXT, …)`)
- Modify: `web/app/pages/contact.vue:73-84` (pre-fill from `ISSUE_TEXT_KEY`)
- Modify: `web/test/ChangesNote.test.ts`

**Interfaces:**
- Consumes: `ChangesNote` props (Task 4).
- Produces:
  - `type IssueFields = Readonly<{ title: string; chord: string; numeral: string; heardIn: string; scale: string | null; rule: string; reason: string; link: string }>`
  - `issueTitle(f: IssueFields): string`, `issueText(f: IssueFields): string`
  - `issueUrl(title: string, body: string): Readonly<{ url: string; full: boolean }>` (`full`: the body fits in the URL)
  - `const ISSUE_TEXT_KEY = 'csm-issue-text'`
  - `const ISSUE_CONTEXT: InjectionKey<Readonly<{ title: () => string; shareUrl: () => Promise<string> }>>`
  - `const ISSUE_REPO = 'https://github.com/KevDog/Chord-Scale-Maker'`
  - `const URL_LIMIT = 8000`

- [ ] **Step 1: Failing tests for the pure helpers**

`web/test/issueReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { issueText, issueTitle, issueUrl, URL_LIMIT } from '~/utils/issueReport'

const F = { title: 'Autumn Leaves', chord: 'Am7b5', numeral: 'iiø7', heardIn: 'G minor', scale: 'A Locrian', rule: 'h2', reason: 'iiø7 of the ii–V to G minor: the b9 is in the key', link: 'https://www.chordscalemaker.com/song#s=abc' }

describe('issue report', () => {
  it('the text names the chord, its function, key area, scale, rule and the link, and asks what was expected', () => {
    expect(issueText(F)).toBe(
      [
        'Chart: Autumn Leaves',
        'Chord: Am7b5',
        'Function: iiø7',
        'Key area: G minor',
        'Scale shown: A Locrian',
        'Rule: h2 (iiø7 of the ii–V to G minor: the b9 is in the key)',
        'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
        'Link: https://www.chordscalemaker.com/song#s=abc',
      ].join('\n'),
    )
  })

  it('the title names the chart, the chord and the rule', () => {
    expect(issueTitle(F)).toBe('Autumn Leaves: Am7b5 (iiø7), rule h2')
  })

  it('the GitHub link carries the title and the text while it fits', () => {
    const { url, full } = issueUrl('T', 'body')
    expect(full).toBe(true)
    expect(url).toBe('https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T&body=body')
  })

  it('a body too long for the URL leaves the link with the title only', () => {
    const { url, full } = issueUrl('T', 'x'.repeat(URL_LIMIT))
    expect(full).toBe(false)
    expect(url).toBe('https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T')
  })

  it('the limit is on the whole URL', () => {
    const base = 'https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T&body='.length
    expect(issueUrl('T', 'x'.repeat(URL_LIMIT - base)).full).toBe(true)
    expect(issueUrl('T', 'x'.repeat(URL_LIMIT - base + 1)).full).toBe(false)
  })
})
```

Run: `cd web && npx vitest run test/issueReport.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `issueReport.ts`**

```ts
import type { InjectionKey } from 'vue'

/** "Copy for an issue" on the Changes sheet's reason note (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §1.4) */

export const ISSUE_REPO = 'https://github.com/KevDog/Chord-Scale-Maker'
/** a URL GitHub's new-issue page reliably accepts */
export const URL_LIMIT = 8000
/** the contact form's pre-fill, set just before going there (sessionStorage) */
export const ISSUE_TEXT_KEY = 'csm-issue-text'
/** what the note needs from the editor: the chart's title, and a share link of the chart as it is now */
export const ISSUE_CONTEXT: InjectionKey<Readonly<{ title: () => string; shareUrl: () => Promise<string> }>> = Symbol('issue context')

export type IssueFields = Readonly<{ title: string; chord: string; numeral: string; heardIn: string; scale: string | null; rule: string; reason: string; link: string }>

export const issueTitle = (f: IssueFields): string => `${f.title}: ${f.chord} (${f.numeral}), rule ${f.rule}`

export function issueText(f: IssueFields): string {
  return [
    `Chart: ${f.title}`,
    `Chord: ${f.chord}`,
    `Function: ${f.numeral}`,
    `Key area: ${f.heardIn}`,
    `Scale shown: ${f.scale ?? '(none)'}`,
    `Rule: ${f.rule} (${f.reason})`,
    'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
    `Link: ${f.link}`,
  ].join('\n')
}

/** a new GitHub issue with the title and the text; the title only when the text would make the URL too long */
export function issueUrl(title: string, body: string): Readonly<{ url: string; full: boolean }> {
  const base = `${ISSUE_REPO}/issues/new?title=${encodeURIComponent(title)}`
  const full = `${base}&body=${encodeURIComponent(body)}`
  return full.length <= URL_LIMIT ? { url: full, full: true } : { url: base, full: false }
}
```

Run the tests → PASS.

- [ ] **Step 3: `EditorView.vue`: one share-URL builder, provided to the notes**

Split `openShare` (lines ~308–327): move the `view` object and the `encodeShare` call into `async function shareUrl(): Promise<string>` (it calls `editor.flush()` and `saved?.flush()` first), and make `openShare` set `shareLink.value = await shareUrl()`. Then:

```ts
provide(ISSUE_CONTEXT, { title: () => editor.heading.value.title, shareUrl })
```

with `import { ISSUE_CONTEXT } from '~/utils/issueReport'`.

- [ ] **Step 4: Failing component tests for the copy flow**

Add to `web/test/ChangesNote.test.ts` (mount with `global: { provide: { [ISSUE_CONTEXT as symbol]: { title: () => 'T', shareUrl: async () => 'https://x/song#s=1' } } }`):

```ts
it('Copy for an issue puts the report on the clipboard, then offers the contact form and GitHub', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const w = await mountNote(M4_PROPS)
  await w.find('button').trigger('click')
  await w.find('button[data-copy]').trigger('click')
  await flushPromises()
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Rule: m4 (ii of the ii–V to C)'))
  expect(w.text()).toContain('Copied.')
  expect(w.find('a[href^="https://github.com/KevDog/Chord-Scale-Maker/issues/new?title="]').exists()).toBe(true)
  expect(w.find('button[data-contact]').text()).toBe('Send it with the contact form')
})

it('without a clipboard, shows the text to copy by hand', async () => {
  vi.stubGlobal('navigator', {})
  const w = await mountNote(M4_PROPS)
  await w.find('button').trigger('click')
  await w.find('button[data-copy]').trigger('click')
  await flushPromises()
  expect((w.find('textarea[readonly]').element as HTMLTextAreaElement).value).toContain('Rule: m4')
})

it('a refused clipboard also shows the text', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
  const w = await mountNote(M4_PROPS)
  await w.find('button').trigger('click')
  await w.find('button[data-copy]').trigger('click')
  await flushPromises()
  expect(w.find('textarea[readonly]').exists()).toBe(true)
})
```

(`M4_PROPS` is the props object from Task 4's first test; define it once at the top of the file. `vi.unstubAllGlobals()` in an `afterEach`.)

Run → FAIL.

- [ ] **Step 5: Implement the copy flow in `ChangesNote.vue`**

Inside the panel, after the "in …" line:

```vue
      <div v-if="context" class="mt-2 space-y-2 border-t border-zinc-950/5 pt-2 dark:border-white/5">
        <UiButton plain data-copy class="text-sm!" @click="copy">Copy for an issue</UiButton>
        <template v-if="state === 'copied' || state === 'manual'">
          <p v-if="state === 'copied'" class="text-xs text-zinc-500 dark:text-zinc-400" role="status">Copied.</p>
          <template v-else>
            <p class="text-xs text-zinc-500 dark:text-zinc-400" role="status">Copy it from here:</p>
            <textarea readonly rows="6" class="w-full rounded-md border border-zinc-950/10 bg-transparent p-2 font-mono text-xs dark:border-white/10" :value="text" @focus="($event.target as HTMLTextAreaElement).select()" />
          </template>
          <div class="flex flex-col items-start gap-1">
            <UiButton plain data-contact class="text-sm!" @click="toContact">Send it with the contact form</UiButton>
            <UiTextLink :href="github.url" external>Open a GitHub issue</UiTextLink>
            <p v-if="!github.full" class="text-xs text-zinc-500 dark:text-zinc-400">The link is too long to carry the details: paste them into the issue.</p>
          </div>
        </template>
      </div>
```

Script additions:

```ts
import { ISSUE_CONTEXT, ISSUE_TEXT_KEY, issueText, issueTitle, issueUrl } from '~/utils/issueReport'

const context = inject(ISSUE_CONTEXT, null)
const state = ref<'idle' | 'copied' | 'manual'>('idle')
const text = ref('')
const title = ref('')
const github = computed(() => issueUrl(title.value, text.value))

async function copy(): Promise<void> {
  if (!context) return
  const fields = { title: context.title(), chord: props.chord, numeral: props.numeral, heardIn: props.heardIn, scale: props.scale, rule: props.rule, reason: props.reason, link: await context.shareUrl() }
  text.value = issueText(fields)
  title.value = issueTitle(fields)
  try {
    if (!navigator.clipboard) throw new Error('no clipboard')
    await navigator.clipboard.writeText(text.value)
    state.value = 'copied'
  } catch {
    state.value = 'manual'
  }
}

function toContact(): void {
  sessionStorage.setItem(ISSUE_TEXT_KEY, text.value)
  navigateTo('/contact')
}
```

Check how `UiTextLink` renders `external` (target and rel); it must open in a new tab with `rel="noopener noreferrer"`. If it doesn't, pass the attributes explicitly.

- [ ] **Step 6: Contact form pre-fill**

In `web/app/pages/contact.vue`'s `onMounted`, after the chart-report block:

```ts
  // a scale disagreement (the Changes sheet's Copy for an issue) pre-fills the message, once, then is cleared
  const issue = sessionStorage.getItem(ISSUE_TEXT_KEY)
  if (issue && !form.message) {
    sessionStorage.removeItem(ISSUE_TEXT_KEY)
    form.message = issue.slice(0, CONTACT_LIMITS.message)
  }
```

(`CONTACT_LIMITS` is already imported there; check that a `message` limit exists in it and use the right property name.) Add a unit test only if `web/test/` already has one for contact.vue's pre-fill; otherwise Task 8's e2e covers it.

- [ ] **Step 7: Run the tests**

Run: `cd web && npx vitest run test/issueReport.test.ts test/ChangesNote.test.ts test/EditorView.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/app/utils/issueReport.ts web/test/issueReport.test.ts web/app/components/ChangesNote.vue web/test/ChangesNote.test.ts web/app/components/EditorView.vue web/app/pages/contact.vue
git commit -m "Changes sheet: Copy for an issue, then the contact form or a GitHub issue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The `/functions` page

**Files:**
- Create: `web/app/utils/functionsKey.ts`, `web/test/functionsKey.test.ts`
- Modify: `web/app/composables/usePreferences.ts` (`functionsKey`)
- Create: `web/app/pages/functions.vue`
- Modify: `web/nuxt.config.ts:92` (prerender `/functions`)
- Modify: `web/app/components/AppShell.vue:~54` (footer link "Functions" after "Help")

**Interfaces:**
- Consumes: `functionsTable`, `FUNCTION_GROUPS`, `RULES`, `TIERS`, `spellings`, `FUNCTION_ERRORS`, `parseFunction`, `dominantScaleTable`, `parseKey`, `TRANSPOSE_KEYS`, `keyLabel` (engine).
- Produces:
  - `FUNCTIONS_KEYS: readonly string[]` (`TRANSPOSE_KEYS` majors, then the same roots as minors: `C`, `Db`, …, `B`, `Cm`, `Dbm`, …, `Bm`)
  - `functionsKeyFrom(query: unknown, stored: string | null): string` (the first valid of query, stored, `'C'`)
  - `usePreferences().functionsKey: Ref<string>` (`csm-functions-key`, default `'C'`)

- [ ] **Step 1: Failing tests for the key choice**

`web/test/functionsKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FUNCTIONS_KEYS, functionsKeyFrom } from '~/utils/functionsKey'

describe('the functions page key', () => {
  it('offers every Transpose key, major then minor', () => {
    expect(FUNCTIONS_KEYS.slice(0, 3)).toEqual(['C', 'Db', 'D'])
    expect(FUNCTIONS_KEYS).toContain('Ebm')
    expect(FUNCTIONS_KEYS).toHaveLength(26)
  })
  it('takes the query, then the stored choice, then C', () => {
    expect(functionsKeyFrom('Eb', 'Am')).toBe('Eb')
    expect(functionsKeyFrom(undefined, 'Am')).toBe('Am')
    expect(functionsKeyFrom(undefined, null)).toBe('C')
  })
  it('ignores a key that does not read, or is not offered', () => {
    expect(functionsKeyFrom('H', 'Am')).toBe('Am')
    expect(functionsKeyFrom('', null)).toBe('C')
    expect(functionsKeyFrom(['Eb', 'F'], null)).toBe('C')
    expect(functionsKeyFrom('Cb', 'zz')).toBe('C')
  })
})
```

Run → FAIL.

- [ ] **Step 2: Implement `functionsKey.ts` and the preference**

```ts
import { TRANSPOSE_KEYS } from '~~/engine'

/** the /functions page's key picker: every Transpose key, major then minor (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §3) */
export const FUNCTIONS_KEYS: readonly string[] = [...TRANSPOSE_KEYS, ...TRANSPOSE_KEYS.map((k) => `${k}m`)]

const offered = (v: unknown): v is string => typeof v === 'string' && FUNCTIONS_KEYS.includes(v)

/** the key to show: the link's ?key=, else this browser's last choice, else C major */
export const functionsKeyFrom = (query: unknown, stored: string | null): string => (offered(query) ? query : offered(stored) ? stored : 'C')
```

In `usePreferences.ts` add `const functionsKey = storedRef<string>('csm-functions-key', (s) => (FUNCTIONS_KEYS.includes(s) ? s : undefined), 'C')` and return it. Run the tests → PASS.

- [ ] **Step 3: The page**

`web/app/pages/functions.vue`. Follow `help.vue`'s structure (header with the small tag, `UiHeading`, intro `UiText`, an "On this page" nav, then `<section class="scroll-mt-6 space-y-4" aria-labelledby="…">` blocks). The sections:

1. `#writing` "Writing a function" (§1.1, short and formal):
   - The grammar in a `UiCode` block: `[Key:] [sub] [♭|♯] NUMERAL [quality] [/ [♭|♯] NUMERAL]`.
   - The rules as a short list (case follows the family; `sub` only on a dominant; after the slash the target as a degree of the key; degrees count from the tonic as in a major key, so `♭III` in C minor is E♭; the key before a colon).
   - The spellings table from `spellings()`: columns Family, Written on the sheet, Accepted spellings. Family names: `major`, `dominant`, `minor`, `half-diminished`, `diminished`, `sus`.
   - The error messages: a table of example → message, where the message is `parseFunction(example)` for `H: V7`, `V7/x`, `subii7`, `iimaj7`, and a one-line meaning each, written by hand.
   - What a function changes and what it doesn't (one short paragraph, spec §1.1's last bullet).
2. `#table` "Functions and their scales":
   - The key picker: `<UiListbox v-model="keyCode" aria-label="Key">` with `FUNCTIONS_KEYS` options labelled `keyLabel(k)` (check `keyLabel`'s signature in `web/engine/`; it labels "Eb" as "E♭ major" in the Transpose control).
   - A sticky sub-navigation: `<nav aria-label="Groups" class="sticky top-0 z-10 -mx-2 flex flex-wrap gap-x-4 bg-white/90 px-2 py-2 text-sm/6 backdrop-blur dark:bg-zinc-900/90 print:hidden">` with one `<a :href="`#group-${g.id}`">` per `FUNCTION_GROUPS` entry; the active one gets `aria-current="true"` and `font-semibold`, set by an `IntersectionObserver` over the four group headings (created in `onMounted`, disconnected in `onBeforeUnmount`). Without JavaScript they are plain anchors.
   - Per group: `<h3 :id="`group-${g.id}`" class="scroll-mt-14 …">{{ g.title }}</h3>` and a `UiTable` (`dense`, `grid`) with columns Function, Chord, Scale, Rule, Why. The rule cell links each `ruleParts(row.rule)` part to `#rule-<id>`; a fallback row adds "(guess)" after the rule.
3. `#rules` "How the engine chooses a scale" (§1.3):
   - One sentence: the rules are tried within a family in the order listed; the first that applies decides.
   - Per tier (from `TIERS`), a table of its `RULES`: Rule, Family, Scale, Looks at, What it does. Each row is `<tr :id="`rule-${r.id}`" class="scroll-mt-14 target:bg-note-50 dark:target:bg-note-950">`. A rule with `guess` gets a line under its summary: "A guess when: {{ r.guess }}" (for `always`: "Always a guess.").
   - The try order per family, compact: one line per family listing its ids in `RULES` order (`dominant: D1 → D7 → D2 → …`).
   - Dominants: a short paragraph on the slots (9 / ♭9 / ♭9♯9, 11 / ♯11, 13 / ♭13), how each is read from the key's reference scale, and how written tensions override them (`D1+D4`), then the `dominantScaleTable()` as a table: 9th, 11th, 13th, Scale.
4. `#report` "Reporting a disagreement" (§1.4): the checklist (the chart row: chord, function, key area; the scale shown; the rule id; the scale you expected and why), how Copy for an issue on a note gives exactly that, and that it goes to the [contact form](/contact) or a GitHub issue.

Script:

```ts
import { dominantScaleTable, FUNCTION_GROUPS, functionsTable, parseFunction, parseKey, ruleParts, RULES, spellings, TIERS } from '~~/engine'
import { FUNCTIONS_KEYS, functionsKeyFrom } from '~/utils/functionsKey'

useHead({ title: 'Functions and rules' }) // follow how help.vue sets its title and description
const route = useRoute()
const router = useRouter()
const prefs = usePreferences()
const keyCode = ref(functionsKeyFrom(route.query.key, null)) // prerender: the query or C; the stored choice applies after mount
onMounted(() => {
  keyCode.value = functionsKeyFrom(route.query.key, prefs.functionsKey.value)
})
watch(keyCode, (k) => {
  prefs.functionsKey.value = k
  if (route.query.key !== k) router.replace({ query: { ...route.query, key: k }, hash: route.hash })
})
const rows = computed(() => functionsTable(parseKey(keyCode.value) ?? parseKey('C')!))
```

Read `usePreferences`' comment: it is client-only. If calling it during prerender reads storage on the server, guard with `import.meta.client` the way `help.vue` or `EditorView.vue` do.

Printing: add `print:` classes so tables keep their borders (`print:border print:border-zinc-400` on each `UiTable`'s cells, or a scoped `@media print` rule in the page's `<style>`) and the sticky nav and the key picker's dropdown arrow hide.

- [ ] **Step 4: Prerender and the footer link**

`web/nuxt.config.ts` line 92: `routes: ['/', '/song', '/help', '/functions', '/about', '/contact', '/privacy']`. In `AppShell.vue`'s footer, after the Help `NuxtLink` (line ~54), add a "Functions" `NuxtLink to="/functions"` with the same classes. (There is no sitemap file in the repo; the prerender list is the site's route list.)

- [ ] **Step 5: Build and look at it**

```bash
cd web && npm run build && npm run check:headers
```

Expected: the build prerenders `/functions` and the headers check passes (CSP). Then `make preview` (from the repo root) and open `/functions`, `/functions?key=Ebm`, `/functions#rule-m4`. Take a screenshot at 1440 and at 390 wide with a throwaway Playwright script outside `web/e2e/`, and look at both.

- [ ] **Step 6: Run the unit tests and the typecheck**

Run: `cd web && npx vitest run test/functionsKey.test.ts test/usePreferences.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/utils/functionsKey.ts web/test/functionsKey.test.ts web/app/composables/usePreferences.ts web/app/pages/functions.vue web/nuxt.config.ts web/app/components/AppShell.vue
# plus web/test/usePreferences.test.ts if you added the new preference to it
git commit -m "Functions and rules: a reference page, the table recomputed for any key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Help catch-up and the editor's "How to write a function" links

**Files:**
- Modify: `web/app/pages/help.vue` (`#controls`, `#editing`, `#odds`)
- Modify: `web/app/components/ChartGrid.vue:26,76`
- Modify: `web/test/ChartGrid.test.ts`

**Interfaces:**
- Consumes: the anchors `/functions#writing` and `/functions#rules` (Task 6).

- [ ] **Step 1: Failing grid test**

In `web/test/ChartGrid.test.ts` (functions on), add:

```ts
it('links the Function column to how to write a function, and a function that will not read to the same place', async () => {
  const w = await mountGrid('title: T\nkey: C\nA | 1 | D7 | | X7\n')
  expect(w.find('thead a[href="/functions#writing"]').attributes('aria-label')).toBe('How to write a function')
  expect(w.find('tbody a[href="/functions#writing"]').text()).toBe('How to write a function')
})
```

(`mountGrid` stands for the file's own way of mounting `ChartGrid` with a chart; use it.) Run → FAIL.

- [ ] **Step 2: Implement the links**

`ChartGrid.vue` line 26: inside the Function header, after the text, `<NuxtLink to="/functions#writing" aria-label="How to write a function" title="How to write a function" class="ml-1 inline-flex align-middle text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"><QuestionMarkCircleIcon class="size-4" aria-hidden="true" /></NuxtLink>` (import `QuestionMarkCircleIcon` from `@heroicons/vue/16/solid`, as `HelpTip.vue` does). Line 76: after the problem text inside `UiErrorMessage`, ` <NuxtLink to="/functions#writing" class="underline">How to write a function</NuxtLink>`.

Run the test → PASS.

- [ ] **Step 3: Help**

- `#controls` "The preview controls": read the current `<dl>`. Bring it up to date with the toolbar: on the Changes sheet, **Analysis** (Numerals, Scales) and **Guide Tones** (From 3rd, From 7th); on the Scales sheet, **Show** (Intervals). Keep the existing voice; replace, don't append, any sentence that now says "Show" for the Changes toggles.
- `#editing` "Editing a chart": two sentences and a link, e.g. "A row's Function cell takes a Roman numeral such as `V7/ii` or `subV7`, which tells the rules what the chord does. [Functions and rules](/functions#writing) shows how to write one and the scale each gives."
- `#odds` "Odds and ends": a new `<li>`: "Wondering why a chord got its scale? Click its numeral or scale on the Changes sheet: the note says why and names the rule, and [Functions and rules](/functions#rules) lists them all. If you'd choose differently, **Copy for an issue** in that note collects the details for the contact form."

Use `UiTextLink` for links and the page's `<strong class="font-semibold text-zinc-950 dark:text-white">` for UI names, as the page does.

- [ ] **Step 4: Run and commit**

Run: `cd web && npx vitest run test/ChartGrid.test.ts && npm run lint`

```bash
git add web/app/pages/help.vue web/app/components/ChartGrid.vue web/test/ChartGrid.test.ts
git commit -m "Help and the editor point to Functions and rules; Help's controls match the Changes toolbar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Browser tests

**Files:**
- Create: `web/e2e/functions.spec.ts`

**Interfaces:**
- Consumes: everything above; e2e helpers from `web/e2e/fixtures.ts` (`test`, `expect`, `writeChart`, `chooseSheet`).

- [ ] **Step 1: Write the tests**

```ts
import { RULES } from '../engine'
import { expect, test, writeChart } from './fixtures'

test('the functions page renders its four sections and the C major table', async ({ page }) => {
  await page.goto('/functions')
  for (const id of ['writing', 'table', 'rules', 'report']) await expect(page.locator(`#${id}`)).toBeVisible()
  await expect(page.getByRole('row', { name: /V7\/ii\s+A7\s+A Mixolydian b6/ })).toBeVisible()
})

test('every rule has an anchor', async ({ page }) => {
  await page.goto('/functions')
  for (const r of RULES) await expect(page.locator(`#rule-${r.id}`), r.id).toHaveCount(1)
})

test('without JavaScript the table and the rule anchors are in the page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/functions#rule-m4')
  await expect(page.locator('#rule-m4')).toBeVisible()
  await expect(page.getByRole('row', { name: /subV7\s+Db7/ })).toBeVisible()
  await context.close()
})

test('the key picker recomputes the table and keeps the key in the link', async ({ page }) => {
  await page.goto('/functions')
  await page.getByRole('button', { name: 'Key' }).click()
  await page.getByRole('option', { name: /E♭ major/ }).click()
  await expect(page).toHaveURL(/[?&]key=Eb/)
  await expect(page.getByRole('row', { name: /V7\/V\s+F7/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('row', { name: /V7\/V\s+F7/ })).toBeVisible()
})

test('a bad key in the link falls back to C major', async ({ page }) => {
  await page.goto('/functions?key=H')
  await expect(page.getByRole('row', { name: /V7\/V\s+D7/ })).toBeVisible()
})

test('a rule link from the Changes sheet lands on its row', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  await page.getByRole('button', { name: 'ii7' }).first().click()
  await page.getByRole('dialog', { name: 'Why: Dm7' }).getByRole('link', { name: 'm4' }).click()
  await expect(page).toHaveURL(/\/functions#rule-m4$/)
  await expect(page.locator('#rule-m4')).toBeInViewport()
})

test('Copy for an issue copies the report and offers the contact form and GitHub', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  await page.getByRole('button', { name: 'ii7' }).first().click()
  const note = page.getByRole('dialog', { name: 'Why: Dm7' })
  await note.getByRole('button', { name: 'Copy for an issue' }).click()
  await expect(note.getByRole('status')).toHaveText('Copied.')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Chord: Dm7')
  expect(copied).toContain('Rule: m4')
  expect(copied).toMatch(/Link: http.*\/song#s=/)
  await expect(note.getByRole('link', { name: 'Open a GitHub issue' })).toHaveAttribute('href', /^https:\/\/github\.com\/KevDog\/Chord-Scale-Maker\/issues\/new\?title=/)
  await note.getByRole('button', { name: 'Send it with the contact form' }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(page.getByLabel('Message')).toHaveValue(/Rule: m4/)
})

test('on a phone the note fits the screen and closes on Escape and outside clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n')
  await page.getByRole('button', { name: 'ii7' }).first().click()
  const note = page.getByRole('dialog', { name: 'Why: Dm7' })
  const box = await note.boundingBox()
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true)
  await page.keyboard.press('Tab')
  await expect(note.getByRole('link', { name: 'm4' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
  await page.getByRole('button', { name: 'ii7' }).first().click()
  await page.mouse.click(5, 5)
  await expect(note).toBeHidden()
})

test('the editor links to how to write a function', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | D7 | | X7\n')
  await page.getByRole('link', { name: 'How to write a function' }).first().click()
  await expect(page).toHaveURL(/\/functions#writing$/)
})

test('printed, the tables keep their borders', async ({ page }) => {
  await page.goto('/functions')
  await page.emulateMedia({ media: 'print' })
  const cell = page.locator('#table td').first()
  await expect(cell).toHaveCSS('border-top-style', 'solid')
})
```

Adjust selectors to what the page actually renders (labels, the Listbox button's accessible name, the contact form's message label, and whether `writeChart` leaves the editor open so the grid is visible); keep each test's intent. If the Tab-focus order in the phone test lands elsewhere first, press Tab until the link and assert it is reachable.

- [ ] **Step 2: Run**

Run: `make e2e` (repo root)
Expected: all pass, the existing suites included.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/functions.spec.ts
git commit -m "e2e: the functions page, its anchors and key, the rule link, Copy for an issue, the editor link, print

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs and the final gates

**Files:**
- Modify: `docs/design.md` (a section on the reference page and the reason note)
- Modify: `docs/superpowers/specs/2026-10-10-functions-help-page-design.md` (Status: implemented)

- [ ] **Step 1: `design.md`**

Add a short section (follow the file's voice and wrap at ~120 columns): `/functions` (what it shows; computed from the engine at prerender and on a key change; anchors), `RULES` and `functionsTable` in the engine, the reason note as a popover with the rule link and Copy for an issue (contact form first, GitHub second), and the renamed ids `m9` and `D8`. Update any existing paragraph that describes the reason note as a hover tooltip.

- [ ] **Step 2: Spec status**

First line after the title: `Status: implemented (branch functions-page).`, keeping the decisions note.

- [ ] **Step 3: Gates**

```bash
make test && make lint && make golden && git status --short fixtures/ && make e2e
```

Expected: all green; `fixtures/` unchanged after Task 1 (if `make golden` changes anything now, read the diff and stop if it isn't explained by Task 1's rename).

- [ ] **Step 4: Commit**

```bash
git add docs/design.md docs/superpowers/specs/2026-10-10-functions-help-page-design.md
git commit -m "Docs: the functions and rules page, the reason note's popover; spec implemented

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The PR (opened by the controller, not the implementer) carries: the C-major table (`.superpowers/sdd/functions-page/c-major-table.md`) as markdown, the §1.2 functions that the rules can't produce as named and why (from Task 3's report), and the golden diff summary (expected: none).
