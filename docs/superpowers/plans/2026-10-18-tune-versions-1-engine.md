# Tune versions, step 1: engine + `csm add --version` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chart format gains `version:`; the engine groups charts into tunes (`tuneKey`, `tuneGroups`) and checks the library's versions (`versionProblems`); `csm add --version` writes a version.

**Architecture:** Pure engine functions in a new `engine/src/versions.ts`, exported through the public API. The library test runs `versionProblems` over `engine/charts/`. The CLI's header flags gain `version`, which also names the file.

**Tech Stack:** TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-tune-versions-design.md` (steps 2–4 get their own plans)

## Global Constraints
- Engine stays pure: no Vue/DOM, no fs outside tests.
- No library chart gets `version:` in this step; `make golden` must not change (run it to confirm).
- `api.test.ts` snapshot gains exactly `tuneGroups`, `tuneKey`, `versionProblems`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name.

## Review Focus
1. A title differing only in case/punctuation/accents (`'Round Midnight` vs `Round Midnight`, `Café` vs `Cafe`) → same key (Task 2 test).
2. A chart whose `aka:` matches another chart's title → same group, the title-matched group wins over an aka match (Task 2 test).
3. A group with only versions, no main → first by label is main, no problem reported (Task 2 test).
4. `--version ""` → treated as not given: no `version:` line, plain slug (Task 3 test).
5. `version:` with surrounding spaces → trimmed (metaValue trims; Task 1 test).

---

### Task 1: the `version:` header

**Files:** Modify `engine/src/chart.ts:20-21` (MetaKey, META_KEYS), `engine/src/tune.ts` (TuneSummary, tuneSummary), `README.md` (the header table), `docs/design.md` (the chart format's header list: grep `aka:` there). Test: `engine/src/__tests__/tune.test.ts`.

**Interfaces:** Produces `MetaKey` including `'version'`; `TuneSummary.version: string`.

- [ ] **Step 1: failing test** — add to `tune.test.ts`'s describe:
```ts
  it('reads the version, trimmed; none is the main chart', () => {
    expect(tuneSummary('title: Summertime\nversion:  Jazz Lab Accelerator \n\nsection: A\nbars: 4\n1 | C').version).toBe('Jazz Lab Accelerator')
    expect(tuneSummary('title: Summertime\n\nsection: A\nbars: 4\n1 | C').version).toBe('')
  })
```
And a round-trip test in the same file:
```ts
  it('keeps version: through parse and serialize', () => {
    const text = 'title: Summertime\nversion: Jazz Lab Accelerator\n\nsection: A\nbars: 4\n1 | C\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })
```
(import `parseChart`, `serializeChart` from `../chart` if not already.)
- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/tune.test.ts` → FAIL (version undefined / not a meta key).
- [ ] **Step 3:** `chart.ts`: add `'version'` after `'subtitle'` in both `MetaKey` and `META_KEYS`. `tune.ts`: `version: string` in `TuneSummary` (after `subtitle`, doc comment `/** which version of the tune ('' : the main chart) */`), `version: metaValue(doc, 'version'),` in `tuneSummary`.
- [ ] **Step 4:** test → PASS; `npx tsc -p tsconfig.json` clean.
- [ ] **Step 5:** README row after `aka:`: `` | `version:` | Which version of the tune this chart is, when the library holds several: `version: Jazz Lab Accelerator`. A chart without one is the tune's main chart; a version's file is named `<title>-<version>.txt`. | ``; the same line in `docs/design.md`'s header list.
- [ ] **Step 6:** commit `chart.ts tune.ts tune.test.ts README.md docs/design.md`: "Chart format: version: (#411)".

---

### Task 2: `tuneKey`, `tuneGroups`, `versionProblems`

**Files:** Create `engine/src/versions.ts`, `engine/src/__tests__/versions.test.ts`. Modify `engine/src/index.ts`, `engine/src/__tests__/libraryMeta.test.ts`, the API snapshot.

**Interfaces:**
```ts
export const tuneKey: (title: string) => string
export type TuneVersion = Readonly<{ slug: string; label: string }>   // label '' for a main chart
export type TuneGroup = Readonly<{ key: string; main: string; versions: readonly TuneVersion[] }>
export function tuneGroups(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly TuneGroup[]
export function versionProblems(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly string[]
```

- [ ] **Step 1: failing test** — `versions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { tuneGroups, tuneKey, versionProblems } from '../versions'

const chart = (slug: string, head: string) => ({ slug, text: `${head}\n\nsection: A\nbars: 4\n1 | C\n` })
const main = chart('summertime', 'title: Summertime')
const jla = chart('summertime-jazz-lab-accelerator', 'title: Summertime\nversion: Jazz Lab Accelerator')
const alt = chart('summertime-alt', 'title: Summertime\nversion: Alt')

describe('tuneKey', () => {
  it('ignores case, accents, apostrophes and punctuation', () => {
    expect(tuneKey("'Round Midnight")).toBe(tuneKey('Round Midnight'))
    expect(tuneKey('Here’s That Rainy Day')).toBe('heres that rainy day')
    expect(tuneKey('Café  Society!')).toBe('cafe society')
  })
})

describe('tuneGroups', () => {
  it('gathers a main and its versions, main first, then by label', () => {
    expect(tuneGroups([jla, chart('autumn-leaves', 'title: Autumn Leaves'), alt, main])).toEqual([
      { key: 'summertime', main: 'summertime', versions: [{ slug: 'summertime', label: '' }, { slug: 'summertime-alt', label: 'Alt' }, { slug: 'summertime-jazz-lab-accelerator', label: 'Jazz Lab Accelerator' }] },
      { key: 'autumn leaves', main: 'autumn-leaves', versions: [{ slug: 'autumn-leaves', label: '' }] },
    ])
  })

  it('joins by aka, a title match first', () => {
    const blueTrain = chart('blue-train', 'title: Blue Train')
    const trane = chart('blue-trane', 'title: Blue Trane\naka: Blue Train\nversion: Book')
    expect(tuneGroups([blueTrain, trane]).map((g) => g.versions.map((v) => v.slug))).toEqual([['blue-train', 'blue-trane']])
  })

  it('a group of versions only: the first by label is its main', () => {
    expect(tuneGroups([jla, alt])[0]!.main).toBe('summertime-alt')
  })
})

describe('versionProblems', () => {
  it('is quiet for a main and distinct versions', () => {
    expect(versionProblems([main, jla, alt])).toEqual([])
  })
  it('names two mains, a repeated label, and a version titled unlike its main', () => {
    expect(versionProblems([main, chart('summertime-2', 'title: Summertime')])).toEqual(['summertime, summertime-2: two charts of "Summertime" without version: (give all but one a version:)'])
    expect(versionProblems([main, jla, chart('summertime-jla', 'title: Summertime\nversion: Jazz Lab Accelerator')])).toEqual(['summertime-jazz-lab-accelerator, summertime-jla: two versions of "Summertime" labelled "Jazz Lab Accelerator"'])
    expect(versionProblems([main, chart('summertime-x', "title: Summertime!\nversion: X")])).toEqual(['summertime-x: title "Summertime!" differs from its main chart\'s "Summertime"'])
  })
})
```
- [ ] **Step 2:** `npx vitest run src/__tests__/versions.test.ts` → FAIL (no module).
- [ ] **Step 3: implement** — `versions.ts`:
```ts
import { chartAka, metaValue, parseChart } from './chart'

/** a tune's title as compared across charts: no case, accents, apostrophes or punctuation */
export const tuneKey = (title: string): string =>
  title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export type TuneVersion = Readonly<{ slug: string; label: string }>
export type TuneGroup = Readonly<{ key: string; main: string; versions: readonly TuneVersion[] }>
type Read = Readonly<{ slug: string; title: string; label: string; keys: readonly string[] }>

const read = (c: Readonly<{ slug: string; text: string }>): Read => {
  const doc = parseChart(c.text).value
  const title = metaValue(doc, 'title', 'Untitled')
  return { slug: c.slug, title, label: metaValue(doc, 'version'), keys: [title, ...chartAka(doc)].map(tuneKey) }
}

/** charts gathered into tunes (#411): by title, else by aka:, in the order their first chart comes */
function grouped(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly (readonly [string, readonly Read[]])[] {
  const all = charts.map(read)
  const groups = new Map<string, Read[]>(all.map((c) => [c.keys[0]!, []]))
  for (const c of all) groups.get(groups.get(c.keys[0]!)!.length || !c.keys.slice(1).some((k) => groups.has(k)) ? c.keys[0]! : c.keys.slice(1).find((k) => groups.has(k))!)!.push(c)
  return [...groups].filter(([, cs]) => cs.length).map(([k, cs]) => [k, [...cs].sort((a, b) => (a.label ? 1 : 0) - (b.label ? 1 : 0) || a.label.localeCompare(b.label))] as const)
}

export function tuneGroups(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly TuneGroup[] {
  return grouped(charts).map(([key, cs]) => ({ key, main: cs[0]!.slug, versions: cs.map((c) => ({ slug: c.slug, label: c.label })) }))
}

/** what breaks the library's versions: libraryMeta.test.ts fails on any */
export function versionProblems(charts: readonly Readonly<{ slug: string; text: string }>[]): readonly string[] {
  return grouped(charts).flatMap(([, cs]) => {
    const mains = cs.filter((c) => !c.label)
    const out: string[] = []
    if (mains.length > 1) out.push(`${mains.map((c) => c.slug).join(', ')}: two charts of "${mains[0]!.title}" without version: (give all but one a version:)`)
    const byLabel = Map.groupBy(cs.filter((c) => c.label), (c) => c.label)
    for (const [label, same] of byLabel) if (same.length > 1) out.push(`${same.map((c) => c.slug).join(', ')}: two versions of "${cs[0]!.title}" labelled "${label}"`)
    const head = mains[0]
    if (head) for (const c of cs) if (c.label && c.title !== head.title && c.keys[0] === head.keys[0]) out.push(`${c.slug}: title "${c.title}" differs from its main chart's "${head.title}"`)
    return out
  })
}
```
Rule: every title key opens a group (in order); a chart joins its own title's group, unless that group is still empty and one of its `aka:` keys names another group, which it joins instead (so `Blue Trane` aka `Blue Train` joins Blue Train's group). Empty groups are dropped. If that one-liner reads badly, write it as a plain loop with the same rule. A version titled unlike its main is only reported when the titles share a key (an aka-joined chart with another title is fine). Check `Map.groupBy` is in lib ES2023 typings; if not, use a plain loop.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** `index.ts`: `export * from './versions'` (after `./prepare`). `npx vitest run -u src/__tests__/api.test.ts`; diff shows exactly `tuneGroups`, `tuneKey`, `versionProblems` (and types aren't runtime names).
- [ ] **Step 6:** `libraryMeta.test.ts`: add
```ts
  it('keep their versions apart: one main per tune, distinct labels', () => {
    const charts = readdirSync('charts')
      .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
      .map((f) => ({ slug: f.slice(0, -4), text: readFileSync(`charts/${f}`, 'utf8') }))
    expect(versionProblems(charts)).toEqual([])
  })
```
(import `versionProblems` from `../versions`). Run it. If it reports existing library charts (two charts already sharing a title or an aka-title collision), stop and report them: that's data for the user, not a test to loosen.
- [ ] **Step 7:** `npx vitest run && npx tsc -p tsconfig.json && npx eslint .` (engine) → green. Commit: "Engine: tuneKey, tuneGroups, versionProblems; the library test checks versions (#411)".

---

### Task 3: `csm add --version`

**Files:** Modify `cli/src/args.ts` (HeaderFlag, HEADER_FLAGS, USAGE), `cli/src/add.ts` (the slug). Tests: `cli/src/__tests__/args.test.ts`, `cli/src/__tests__/add.test.ts`.

**Interfaces:** `HeaderFlag` gains `'version'`.

- [ ] **Step 1: failing tests** — `args.test.ts`, in 'takes the header flags as overrides': add `'--version', 'JLA'` to argv and `version: 'JLA'` to the expected overrides. `add.test.ts`:
```ts
  it('--version: writes version: and names the file after it', () => {
    const { fx, log } = fake()
    expect(add(args({ overrides: { version: 'Jazz Lab Accelerator' } }), fx)).toBe(0)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune-jazz-lab-accelerator.txt'])
    expect(log.written['/repo/engine/charts/tune-jazz-lab-accelerator.txt']).toContain('version: Jazz Lab Accelerator\n')
  })

  it('an empty --version is not given', () => {
    const { fx, log } = fake()
    expect(add(args({ overrides: { version: '' } }), fx)).toBe(0)
    expect(Object.keys(log.written)).toEqual(['/repo/engine/charts/tune.txt'])
    expect(log.written['/repo/engine/charts/tune.txt']).not.toMatch(/^version:/m)
  })
```
- [ ] **Step 2:** `cd cli && npx vitest run` → FAIL (unknown option `--version`; slug `tune.txt`).
- [ ] **Step 3:** `args.ts`: `'version'` appended to `HeaderFlag` and `HEADER_FLAGS`; USAGE's second line gains `[--version …]`. `add.ts`: `const named = saveName(args.overrides.version ? `${song.title} ${args.overrides.version}` : song.title)`.
- [ ] **Step 4:** `npx vitest run && npx tsc -p tsconfig.json && npx eslint .` → green.
- [ ] **Step 5:** CLAUDE.md "Import <tune> from iReal": add `--version …` to the flags with "(a second chart of a tune already in the library)". Commit: "csm add --version (#411)".

---

### Finish
From the repo root: `make test`, `make lint`, `make golden` (expect no diff: `git status` clean).
