# Chord Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any chord's pentatonic or triad pair can be picked from a popover, on the Changes sheet (its label) or the
Scales sheet (a staff's caption). The popover lists that chord's choices from inside to outside. One set of picks
serves both sheets, survives control changes and rides share links.

**Architecture:** The engine does the work, in pure functions. A new `chordPicks.ts` holds the pick values: parsing,
legacy reads, `for` matching, and pure write helpers. `chordChoices.ts` gives the popover rows. `changes.ts` gives each
drawn chord's position and pick target. `sheet.ts` maps a Scales line to positions and fills `positions`, `varies`
and `source` on each staff. `buildChanges` and `buildSheet` both apply live picks. `share.ts` carries them. On the web,
`useChordPicks` stores the picks and one `ChordPickPopover` draws the popover. `EditorView` sends the same picks to both
sheets, puts them in share links and resets them.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4 / Vue 3, Headless UI, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-15-chord-picks-design.md` (binding). It builds on
`docs/superpowers/specs/2026-10-14-pentatonic-per-chord-design.md` (#272).

## Global Constraints

- Engine stays free of Vue/DOM imports; pure functions, readonly types; `make lint` enforces it.
- A pick belongs to one `ChordAt` (`${section}:${bar}:${k}`, the drawn position); picks are per kind: `pentatonic`, `hexatonic`.
- Pentatonic pick: `{ pc, for? }`: the root, concert pitch class 0–11. Hexatonic pick: `{ roots: [lower, upper], for? }`:
  both triads' roots, concert pitch classes, lower (chain order) first, distinct. `for: "<chord>|<scale>"`, concert, the
  position's chord text and resolved scale when picked. A legacy #272 pick (a bare number) has no `for` and applies as before.
- A pick whose position no longer plays the chord and scale in its `for` is ignored. It is dropped the next time a
  pick is written (`pick`, `clear`), and never by a watcher.
- Picks survive changes to Built on, Path, Rung, Side, Step and Ranked against. Only the popover's per-chord
  **Sheet's choice** row, More actions → **Reset chord picks**, and the hidden-settings notice's **Reset** clear them.
  A change of the chart's key still clears them (kept from #272: a legacy pick has no `for` to catch a transposition).
- Picks apply on both pentatonic bases (Key and Chord) and to the Hexatonic overlay. They are never written into chart
  rows or the saved analysis.
- Storage: `csm-pent-picks:<chart>` holds `{ "pentatonic": {…}, "hexatonic": {…} }`. A legacy object of bare numbers
  reads as pentatonic picks. With no chart key (a shared chart), picks last for the visit.
- Share links: `view.picks` (a `ChordPicks`), only when there are live picks. Old links open with none.
- Interface tier: the popovers (both kinds, both sheets) are at Everything, `CONTROL_TIERS` id `chord-picks`. Picks
  in force at a lower level are named by the hidden-settings notice (`HiddenSetting` `chord-picks`).
- Copy: header `D♭7 Mixolydian · bars 6, 22` (`bar 6` for one). Footers: Changes `Sets bar 6.` / `Sets bars 6 and 7.`.
  Scales `Sets bars 6 and 22 on the Changes sheet too.` (`Sets bar 6 on the Changes sheet too.`). Scales under
  `varies`: `Replaces the different picks in bars 6 and 22.`. The first row is `Sheet’s choice (Dm)`, naming what
  the sheet plays without a pick. Pentatonic rows `A♭m pent · on 5 · 5 shared`; hexatonic rows `G/Am · covers 4`;
  captions add ` · varies`.
- The Changes overlay control is labelled **Superimpose** in user-facing text (PR #306 renames it; internal names
  `overlay`, `OverlayPlan` and `csm-overlay` are unchanged). Help text and docs say "Superimpose".
- Print never shows a popover; a caption or label that triggers one prints as plain text. The Scales sheet keeps 12
  staves a page, each caption on one line.
- Tests come first in every task (TDD skill). `make test`, `make lint` and `make e2e` must be green; run `make golden`
  once, in Task 6, and review its diff (new sections only). Commits end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by name, never `git add -A`.

## Decisions the spec left to the plan

1. **Which positions a Scales line covers.** `ScaleLine` gains `rows`: every row index (into `expandRowLines`) that
   joined the line. `chordPositions(doc)` maps each row index to its `ChordAt`. It is built from the same `chordKeys`
   as `drawnChords`. A folded repeat (`A1 · A2`, a `@copy` straight after its source) has no positions for its own
   rows, because the Changes sheet draws them once, as the source's. Ending bars and written-out copies (`A3 (= A1)`)
   do have their own positions. `linePositions(line, at)` returns the line's positions in row (form) order, deduped,
   skipping rows with none. A staff with no positions shows a plain caption, not a trigger.
2. **Where pick targets come from.** `pickTargets(doc, resolved)` maps each position to `pickTarget(chord, scale)`.
   `buildChanges` works the same out internally from its own rows and `resolveScales`. `buildSheet` takes
   `SheetPicks = { picks, at }` (`at` = `chordPositions(doc)`) and works out targets from its rows and `scaleOf`. So
   `buildSheet` stays doc-free, and both sheets match `for` against the same resolved scales (EditorView passes one
   `resolved`).
3. **Where legacy picks are read.** Only in `chordPicksFrom`, which reads storage (`useChordPicks`) and share links
   (links never carried legacy picks, so it is a no-op there). Inside the engine every pick is the object form.
4. **"Dropped on the next write"** means `withPick` and `withoutPicks` run `livePicks` first. Carry across an edit
   (`carryChordPicks`) moves keys and keeps `for`. A scale-level change makes picks stale, and they come back when the
   level returns. Neither drops anything.
5. **"More actions → Reset"** does not exist yet. A new More action, `reset-picks` ("Reset chord picks"), is listed
   while the chart has live picks.
6. **Changes popovers.** The Chord basis and the Hexatonic label use the new `ChordPickPopover`. The Key basis keeps
   `PentatonicLadder` (its ladder rows, as the spec says), which gains the same header, footer and Sheet's choice row,
   and keeps the ladder's title as a sub-heading. Each dialog's accessible name becomes the header. Every `pick`
   event carries concert values. The ladder's written pc is converted in `ChangesSystem`, which gains a `part` prop.
7. **The current row in a popover** is matched by name (written spelling from the same ranking), so the staff and
   label models need no pitch classes.
8. **`practiceStaves`** (the Practice panel's boxes and `litKeys`) is built with the picks too, so a custom
   selection seeded from the Pentatonic preset keeps the picked notes.

## Review Focus

1. **A stale pick:** a chord's text is rewritten, or the scale level changes its scale. Expected: the pick is ignored
   (the sheet's choice plays, nothing is marked picked, no counts appear because of it). Nothing crashes, and it
   comes back when the level does. (Task 4 and Task 5 tests.)
2. **A hexatonic pick whose roots are not among the position's pairs**, or a chord whose scale has no pairs (whole
   tone, blues). Expected: the sheet's choice or `no triad pair`, `picked: false`, and no wrong pair lit. (Task 4 and
   Task 5 tests.)
3. **A transposing part.** A pick made in the concert sheet editor (`sheetPart` is concert while editing) and then
   viewed on a B♭ tenor part, or the reverse. Expected: the same sounding pentatonic or pair, spelled for the part.
   (Task 3, Task 4 and Task 5 tests.)
4. **A Scales staff whose rows are all in a folded repeat**, possible when the copy resolves to a different scale
   from its source. Expected: `positions: []`, a plain caption with no trigger, and no `varies`. Also: a staff
   covering an ending bar and a written-out copy lists both. (Task 2 and Task 5 tests.)
5. **Hostile or damaged picks** from storage or a share link: thousands of entries, `__proto__` or `constructor`
   keys, a pc of 12 or 1.5, equal hex roots, a 10 kB `for`. Expected: every bad entry dropped, at most
   `LIMITS.maxExpandedRows` kept per kind, and nothing thrown. (Task 1 and Task 6 tests.)

## File Map

| Area | File | Change |
| --- | --- | --- |
| Engine | `engine/src/chordPicks.ts` (new) | types, `pickTarget`, `chordPicksFrom`, `livePicks`, `livePick`, `withPick`, `withoutPicks`, `hasPicks`, `pickBars` |
| Engine | `engine/src/picks.ts` | `carryPicks` generic; `carryChordPicks` |
| Engine | `engine/src/changes.ts` | `chordPositions`, `pickTargets`; pick objects in `PentatonicPlan`; `HexatonicPlan.picks`; `ChangesPentatonic.sheet/source`; `ChangesHexatonic` chord/picked/run/sheet/source; `showHexatonics` runs |
| Engine | `engine/src/sheet.ts` | `ScaleLine.rows`, `linePositions`, `SheetPicks`; `StaffModel.positions/varies/source`; picks in `practiceFor` |
| Engine | `engine/src/pentatonics.ts`, `hexatonics.ts` | `pentatonicPick`/`hexatonicPick` take a pick; `picked`, `sheet` on staff models; captions take `varies`; `hexatonicRanking` |
| Engine | `engine/src/chordChoices.ts` (new) | `pentatonicChoices`, `hexatonicChoices`, `pickHeading` |
| Engine | `engine/src/share.ts` | `ShareView.picks` |
| Engine | `engine/src/index.ts`, `__tests__/api.test.ts` snapshot, `__tests__/goldenFixture.ts`, `fixtures/golden.json` | exports, golden `pentatonics` (#305) and `hexatonics.choices` |
| Web | `web/app/composables/useChordPicks.ts` (renamed from `usePentatonicPicks.ts`) | both kinds, legacy read, write helpers |
| Web | `web/app/utils/chordPicks.ts` (new) | `barList`, `pickHeader`, `pickFooter`, `choiceId` |
| Web | `web/app/components/ChordPickPopover.vue` (new) | the popover |
| Web | `web/app/components/PentatonicLadder.vue` | Key basis only; header, footer, Sheet's choice row |
| Web | `web/app/components/ScaleStaff.vue`, `ScaleSheet.vue` | caption trigger, picks wiring |
| Web | `web/app/components/ChangesSystem.vue`, `ChangesSheet.vue` | chord-basis and hexatonic popovers; `pick` event; `part` prop |
| Web | `web/app/components/EditorView.vue`, `utils/interface.ts`, `utils/moreMenu.ts`, `MoreMenu.vue` | wiring, share, tier, notice, Reset chord picks |
| Docs | `docs/design.md`, `web/app/pages/help.vue` | Chord picks section; help text |
| e2e | `web/e2e/chord-picks.spec.ts` (new), `pentatonics.spec.ts`, `print.spec.ts`, `fixtures.ts` | flows, dialog names, print |

`web/app/components/PreviewControls.vue` does not change: picks have no rail control.

---

### Task 1: Pick values, parsing, live matching, carry

**Files:**
- Create: `engine/src/chordPicks.ts`, `engine/src/__tests__/chordPicks.test.ts`
- Modify: `engine/src/picks.ts`, `engine/src/__tests__/picks.test.ts`, `engine/src/index.ts`, `engine/src/__tests__/__snapshots__/api.test.ts.snap`

**Interfaces:**
- Consumes: `ChordAt`, `DrawnChord` (`changes.ts`, type-only import); `LIMITS` (`limits.ts`).
- Produces:
  ```ts
  export type PickKind = 'pentatonic' | 'hexatonic'
  export type PentPick = Readonly<{ pc: number; for?: string }>
  export type HexPick = Readonly<{ roots: readonly [number, number]; for?: string }>
  export type ChordPicks = Readonly<{ pentatonic: Readonly<Record<ChordAt, PentPick>>; hexatonic: Readonly<Record<ChordAt, HexPick>> }>
  export type PickValue = Readonly<{ pentatonic: number; hexatonic: readonly [number, number] }>
  export const NO_PICKS: ChordPicks
  export const pickTarget: (chord: string, scale: string | null) => string
  export function chordPicksFrom(v: unknown): ChordPicks
  export function livePicks(picks: ChordPicks, targets: ReadonlyMap<ChordAt, string>): ChordPicks
  export function livePick<T extends { for?: string }>(m: Readonly<Record<ChordAt, T>>, at: ChordAt, target: string): T | null
  export function withPick<K extends PickKind>(picks: ChordPicks, kind: K, positions: readonly ChordAt[], value: PickValue[K], targets: ReadonlyMap<ChordAt, string>): ChordPicks
  export function withoutPicks(picks: ChordPicks, kind: PickKind, positions: readonly ChordAt[], targets: ReadonlyMap<ChordAt, string>): ChordPicks
  export const hasPicks: (p: ChordPicks, kind?: PickKind) => boolean
  export function pickBars(positions: readonly ChordAt[]): readonly string[]
  // picks.ts
  export function carryPicks<T>(before: readonly DrawnChord[], after: readonly DrawnChord[], picks: Readonly<Record<ChordAt, T>>): Record<ChordAt, T>
  export function carryChordPicks(before: readonly DrawnChord[], after: readonly DrawnChord[], picks: ChordPicks): ChordPicks
  ```

- [ ] **Step 1: Write the failing tests** (`chordPicks.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { chordPicksFrom, hasPicks, livePick, livePicks, NO_PICKS, pickBars, pickTarget, withoutPicks, withPick } from '../chordPicks'

const T = new Map([['A:1:0', 'Cmaj7|C Ionian'], ['A:2:0', 'Dm7|D Dorian'], ['B:5:0', 'Cmaj7|C Ionian']])

describe('chordPicksFrom', () => {
  it('reads both kinds', () => {
    const v = { pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: { 'A:2:0': { roots: [0, 2], for: 'Dm7|D Dorian' } } }
    expect(chordPicksFrom(v)).toEqual(v)
  })
  it('reads a #272 map of bare numbers as pentatonic picks with no for', () => {
    expect(chordPicksFrom({ 'A:1:0': 7, 'A:2:0': 2 })).toEqual({ pentatonic: { 'A:1:0': { pc: 7 }, 'A:2:0': { pc: 2 } }, hexatonic: {} })
  })
  it('drops bad entries and never throws', () => {
    const bad = { pentatonic: { 'A:1:0': 12, 'A:2:0': { pc: 1.5 }, __proto__x: 3, constructor: { pc: 1 }, 'A:3:0': { pc: 4, for: 'x'.repeat(10_000) } }, hexatonic: { 'A:1:0': { roots: [2, 2] }, 'A:2:0': { roots: [1] }, 'A:3:0': { roots: [0, 13] } } }
    expect(chordPicksFrom(bad)).toEqual({ pentatonic: { 'A:3:0': { pc: 4 } }, hexatonic: {} }) // an overlong for is dropped, the pick kept
    for (const v of [null, 3, 'x', [], { pentatonic: [] }]) expect(chordPicksFrom(v)).toEqual(NO_PICKS)
  })
  it('keeps at most LIMITS.maxExpandedRows picks a kind', () => {
    const many = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`A:${i}:0`, 1]))
    expect(Object.keys(chordPicksFrom(many).pentatonic).length).toBeLessThanOrEqual(1000) // LIMITS.maxExpandedRows: check the value and use it
  })
})

describe('livePicks', () => {
  it('keeps a pick whose for matches its position, and a legacy one anywhere drawn', () => {
    const p = { pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'A:2:0': { pc: 2, for: 'Dm7|D Aeolian' }, 'B:5:0': { pc: 4 }, 'Z:9:0': { pc: 1 } }, hexatonic: {} }
    expect(livePicks(p, T).pentatonic).toEqual({ 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'B:5:0': { pc: 4 } })
    expect(livePick(p.pentatonic, 'A:2:0', 'Dm7|D Dorian')).toBeNull()
  })
})

describe('withPick / withoutPicks', () => {
  it('stamps each position with its own target and drops stale picks on the write', () => {
    const stale = { pentatonic: { 'A:2:0': { pc: 2, for: 'Dm7|D Aeolian' } }, hexatonic: {} }
    expect(withPick(stale, 'pentatonic', ['A:1:0', 'B:5:0', 'Z:9:0'], 9, T)).toEqual({ pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'B:5:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: {} })
    expect(withPick(NO_PICKS, 'hexatonic', ['A:2:0'], [0, 2], T).hexatonic).toEqual({ 'A:2:0': { roots: [0, 2], for: 'Dm7|D Dorian' } })
  })
  it('clears one kind at the positions given', () => {
    const p = withPick(withPick(NO_PICKS, 'pentatonic', ['A:1:0', 'B:5:0'], 9, T), 'hexatonic', ['A:1:0'], [7, 9], T)
    expect(withoutPicks(p, 'pentatonic', ['A:1:0'], T)).toEqual({ pentatonic: { 'B:5:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: p.hexatonic })
    expect(hasPicks(p, 'hexatonic')).toBe(true)
    expect(hasPicks(NO_PICKS)).toBe(false)
  })
})

it('names the bars positions cover, once each, in order', () => {
  expect(pickBars(['A1:6:0', 'A1:6:1', 'A3:22:0'])).toEqual(['6', '22'])
  expect(pickTarget('Db7', null)).toBe('Db7|')
})
```

Add to `picks.test.ts`:

```ts
it('carries both kinds of chord picks, for and all', () => {
  const picks = { pentatonic: { 'A:3:0': { pc: 7, for: 'G7|G Mixolydian' } }, hexatonic: { 'B:6:0': { roots: [0, 2] as const } } }
  expect(carryChordPicks(drawnChords(C4), drawnChords(insertBar(C4, 'A', 2, ['F7'])), picks)).toEqual({ pentatonic: { 'A:4:0': { pc: 7, for: 'G7|G Mixolydian' } }, hexatonic: { 'B:7:0': { roots: [0, 2] } } })
})
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `cd engine && npx vitest run src/__tests__/chordPicks.test.ts src/__tests__/picks.test.ts`
Expected: FAIL (`../chordPicks` not found; `carryChordPicks` not exported).

- [ ] **Step 3: Implement `chordPicks.ts`**

```ts
import type { ChordAt } from './changes'
import { LIMITS } from './limits'

/**
 * Chord picks (#303, docs/superpowers/specs/2026-10-15-chord-picks-design.md): a player's own pentatonic or triad pair
 * for one drawn chord, overriding the sheet's choice on both sheets. Each pick remembers the chord and scale it was
 * made for; where its position now plays something else it is ignored.
 */
export type PickKind = 'pentatonic' | 'hexatonic'
export type PentPick = Readonly<{ pc: number; for?: string }>
export type HexPick = Readonly<{ roots: readonly [number, number]; for?: string }>
export type ChordPicks = Readonly<{ pentatonic: Readonly<Record<ChordAt, PentPick>>; hexatonic: Readonly<Record<ChordAt, HexPick>> }>
export type PickValue = Readonly<{ pentatonic: number; hexatonic: readonly [number, number] }>
export const NO_PICKS: ChordPicks = { pentatonic: {}, hexatonic: {} }

/** what a pick was made for: the position's chord text and resolved scale, concert */
export const pickTarget = (chord: string, scale: string | null): string => `${chord}|${scale ?? ''}`

const AT = /^\S{1,64}:\d{1,4}:\d{1,2}$/
const isPc = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 12
const forOf = (v: unknown): { for?: string } => (typeof v === 'string' && v.length <= 200 && v.includes('|') ? { for: v } : {})
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const pentFrom = (v: unknown): PentPick | null => (isPc(v) ? { pc: v } : isObject(v) && isPc(v.pc) ? { pc: v.pc, ...forOf(v.for) } : null)
function hexFrom(v: unknown): HexPick | null {
  if (!isObject(v) || !Array.isArray(v.roots) || v.roots.length !== 2) return null
  const [a, b] = v.roots as unknown[]
  return isPc(a) && isPc(b) && a !== b ? { roots: [a, b], ...forOf(v.for) } : null
}
function entries<T>(v: unknown, read: (x: unknown) => T | null): Readonly<Record<ChordAt, T>> {
  if (!isObject(v)) return {}
  const out: [ChordAt, T][] = []
  for (const [k, x] of Object.entries(v)) {
    if (out.length >= LIMITS.maxExpandedRows) break
    const p = AT.test(k) ? read(x) : null
    if (p) out.push([k, p])
  }
  return Object.fromEntries(out)
}

/** picks read from untrusted data (storage, a share link): bad entries dropped; a #272 map of bare numbers is pentatonic picks */
export function chordPicksFrom(v: unknown): ChordPicks {
  if (!isObject(v)) return NO_PICKS
  if ('pentatonic' in v || 'hexatonic' in v) return { pentatonic: entries(v.pentatonic, pentFrom), hexatonic: entries(v.hexatonic, hexFrom) }
  return { pentatonic: entries(v, (x) => (isPc(x) ? { pc: x } : null)), hexatonic: {} }
}

/** a position's pick, if it still plays what the pick was made for (a legacy pick, with no for, always does) */
export const livePick = <T extends { for?: string }>(m: Readonly<Record<ChordAt, T>>, at: ChordAt, target: string): T | null => {
  const p = Object.hasOwn(m, at) ? m[at] : undefined
  return p && (p.for === undefined || p.for === target) ? p : null
}
const keepLive = <T extends { for?: string }>(m: Readonly<Record<ChordAt, T>>, targets: ReadonlyMap<ChordAt, string>): Readonly<Record<ChordAt, T>> =>
  Object.fromEntries(Object.entries(m).filter(([at]) => targets.has(at) && livePick(m, at, targets.get(at)!) !== null))
/** the picks whose positions are drawn and still play what they were made for */
export const livePicks = (picks: ChordPicks, targets: ReadonlyMap<ChordAt, string>): ChordPicks => ({ pentatonic: keepLive(picks.pentatonic, targets), hexatonic: keepLive(picks.hexatonic, targets) })

/** `value` picked at each drawn position, stamped with its target; stale picks go on the write */
export function withPick<K extends PickKind>(picks: ChordPicks, kind: K, positions: readonly ChordAt[], value: PickValue[K], targets: ReadonlyMap<ChordAt, string>): ChordPicks {
  const live = livePicks(picks, targets)
  const made = Object.fromEntries(
    positions.flatMap((at) => {
      const t = targets.get(at)
      if (t === undefined) return []
      return [[at, kind === 'pentatonic' ? { pc: value as number, for: t } : { roots: value as readonly [number, number], for: t }]]
    }),
  )
  return { ...live, [kind]: { ...live[kind], ...made } }
}
/** the sheet's choice again at these positions; stale picks go on the write */
export function withoutPicks(picks: ChordPicks, kind: PickKind, positions: readonly ChordAt[], targets: ReadonlyMap<ChordAt, string>): ChordPicks {
  const live = livePicks(picks, targets)
  return { ...live, [kind]: Object.fromEntries(Object.entries(live[kind]).filter(([at]) => !positions.includes(at))) }
}
export const hasPicks = (p: ChordPicks, kind?: PickKind): boolean => (kind ? Object.keys(p[kind]).length > 0 : hasPicks(p, 'pentatonic') || hasPicks(p, 'hexatonic'))

/** the bar numbers positions are in, once each, in order */
export const pickBars = (positions: readonly ChordAt[]): readonly string[] => [...new Set(positions.flatMap((at) => /:(\d+):\d+$/.exec(at)?.[1] ?? []))]
```

- [ ] **Step 4: Make `carryPicks` generic and add `carryChordPicks`** in `picks.ts`. Change the signature to
`carryPicks<T>(before, after, picks: Readonly<Record<ChordAt, T>>): Record<ChordAt, T>`, with `const moved: Record<ChordAt, T> = {}`
and `const p = picks[before[i]!.at]`. Then:

```ts
/** both kinds carried across an edit; each pick keeps what it was made for */
export const carryChordPicks = (before: Drawn, after: Drawn, picks: ChordPicks): ChordPicks => ({
  pentatonic: carryPicks(before, after, picks.pentatonic),
  hexatonic: carryPicks(before, after, picks.hexatonic),
})
```

- [ ] **Step 5: Export and update the API snapshot.** Add `export * from './chordPicks'` to `index.ts`. Run
`cd engine && npx vitest run -u src/__tests__/api.test.ts` and check that the snapshot diff only adds the new names.
- [ ] **Step 6: Run the tests** (`cd engine && npx vitest run src/__tests__/chordPicks.test.ts src/__tests__/picks.test.ts src/__tests__/api.test.ts`). Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add engine/src/chordPicks.ts engine/src/__tests__/chordPicks.test.ts engine/src/picks.ts engine/src/__tests__/picks.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: chord pick values, legacy read, for matching (#303)"
```

---

### Task 2: Positions and targets; the positions a Scales line covers

**Files:**
- Modify: `engine/src/changes.ts` (`chordPositions`, `pickTargets`, `drawnChords` via `chordPositions`), `engine/src/sheet.ts` (`ScaleLine.rows`, `linePositions`)
- Test: `engine/src/__tests__/sheet.test.ts`, `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: `pickTarget` (Task 1); `Resolved` (`resolve.ts`).
- Produces:
  ```ts
  // changes.ts
  export function chordPositions(doc: ChartDoc): ReadonlyMap<number, ChordAt> // row index in expandRowLines(doc) → its drawn position
  export function pickTargets(doc: ChartDoc, resolved: ReadonlyMap<number, Resolved>): ReadonlyMap<ChordAt, string>
  // sheet.ts
  export type ScaleLine = Readonly<{ row: number; rows: readonly number[]; chords: readonly string[] }>
  export function linePositions(line: ScaleLine, at: ReadonlyMap<number, ChordAt>): readonly ChordAt[]
  ```

The test chart has a folded repeat, endings and a written-out copy. Its scales are written, so the lines don't depend
on the analysis:

```ts
const FORM = [
  'title: T', 'key: C',
  'A1 | 1 | Dm7 | D Dorian', 'A1 | 2 | G7 | G Mixolydian',
  '@copy A1 A2 2', // straight after its source: folded, drawn once as A1 · A2
  'B | 5 | Dm7 | D Dorian', 'B | 6 | E7 | E Phrygian Dominant', 'B | 7 | Am7 | A Aeolian', 'B | 8 | G7 | G Mixolydian',
  '@ending 1 B 7 7', '@ending 2 B 8 8',
  '@copy A1 A3 8', // after B: written out, A3 (= A1)
].join('\n') + '\n'
```

- [ ] **Step 1: Write the failing tests.** In `changes.test.ts`:

```ts
describe('chordPositions', () => {
  it('gives each drawn row its position; a folded repeat’s rows have none', () => {
    const doc = parseChart(FORM).value
    const rows = expandRowLines(doc).value
    const at = chordPositions(doc)
    expect(rows.map((r, i) => `${r.section}:${r.bar}=${at.get(i) ?? '-'}`)).toEqual([
      'A1:1=A1:1:0', 'A1:2=A1:2:0', 'A2:3=-', 'A2:4=-',
      'B:5=B:5:0', 'B:6=B:6:0', 'B:7=B:7:0', 'B:8=B:8:0',
      'A3:9=A3:9:0', 'A3:10=A3:10:0',
    ])
    expect(drawnChords(doc).map((d) => d.at)).toEqual([...at.values()]) // drawnChords still agrees
  })
  it('targets each position with its chord and resolved scale', () => {
    const doc = parseChart(FORM).value
    expect(pickTargets(doc, resolveScales(doc, { level: 'standard', seed: 0 })).get('B:6:0')).toBe(pickTarget('E7', 'E Phrygian Dominant'))
  })
})
```

(If the resolver normalises the written scale's case, `pickTarget` uses whatever `resolved` holds, so assert against
`resolveScales(...).get(5)?.scale`, not a literal.)

In `sheet.test.ts`:

```ts
describe('linePositions', () => {
  const doc = parseChart(FORM).value
  const rows = expandRowLines(doc).value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const lines = scaleLines(rows, (_, i) => res.get(i)?.scale ?? null)
  const at = chordPositions(doc)
  const of = (chord: string) => linePositions(lines.find((l) => l.chords.includes(chord))!, at)

  it('covers every drawn position of its chord and scale, in form order: the source, a 2nd ending, a written-out copy', () => {
    expect(of('Dm7')).toEqual(['A1:1:0', 'B:5:0', 'A3:9:0'])
    expect(of('G7')).toEqual(['A1:2:0', 'B:8:0', 'A3:10:0'])
  })
  it('lists each row on its line', () => {
    expect(lines.find((l) => l.chords.includes('Dm7'))!.rows).toEqual([0, 2, 4, 8]) // A2's row 2 is folded: no position
  })
  it('gives a line whose rows are all in a folded repeat no positions', () => {
    const text = 'title: T\nkey: C\nA1 | 1 | Dm7 | D Dorian\n@copy A1 A2 1\n'
    const d = parseChart(text).value
    const only = { row: 1, rows: [1], chords: ['Dm7'] } // the copy's row alone, as a level could make it
    expect(linePositions(only, chordPositions(d))).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to make sure they fail** (`cd engine && npx vitest run src/__tests__/changes.test.ts src/__tests__/sheet.test.ts -t "chordPositions|linePositions"`). Expected: FAIL.
- [ ] **Step 3: Implement.** In `changes.ts`, factor `drawnChords`' body into:

```ts
/** each drawn chord's position by its row in expandRowLines(doc); a folded repeat's rows have none (the sheet draws its source's) */
export function chordPositions(doc: ChartDoc): ReadonlyMap<number, ChordAt> {
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const t = timing(rows, guideToneTimeline(rows, beats).events, beats)
  const withEndings = new Set(doc.lines.flatMap((l) => (l.kind === 'ending' ? [l.section] : [])))
  return chordKeys(rows, drawnBlocks(doc, rows, t, withEndings), t.barOf)
}
export function drawnChords(doc: ChartDoc): readonly DrawnChord[] {
  const rows = expandRowLines(doc).value
  return [...chordPositions(doc)].sort(([a], [b]) => a - b).map(([i, at]) => ({ at, text: rows[i]?.chord ?? '' }))
}
/** what a pick at each drawn position is made for: its chord and the scale it plays at this view (#303) */
export function pickTargets(doc: ChartDoc, resolved: ReadonlyMap<number, Resolved>): ReadonlyMap<ChordAt, string> {
  const rows = expandRowLines(doc).value
  return new Map([...chordPositions(doc)].map(([i, at]) => [at, pickTarget(rows[i]?.chord ?? '', resolved.get(i)?.scale ?? null)]))
}
```

In `sheet.ts`, `scaleLines` pushes `i` onto `rows` for every row (new line: `rows: [i]`). Then:

```ts
/** the drawn positions a line covers (#303): its rows' positions on the Changes sheet, in form order, once each */
export const linePositions = (line: ScaleLine, at: ReadonlyMap<number, ChordAt>): readonly ChordAt[] =>
  [...new Set(line.rows.flatMap((i) => at.get(i) ?? []))]
```

`sheet.ts` imports `type ChordAt` from `./changes` (type-only, so there is no runtime cycle).

- [ ] **Step 4: Run the tests** (the two files in full). Expected: PASS. Update the API snapshot (`-u`) and check that it adds only `chordPositions`, `linePositions` and `pickTargets`.
- [ ] **Step 5: Commit**

```bash
git add engine/src/changes.ts engine/src/sheet.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: chord positions, pick targets, the positions a Scales line covers (#303)"
```

---

### Task 3: The popover's choices

**Files:**
- Create: `engine/src/chordChoices.ts`, `engine/src/__tests__/chordChoices.test.ts`
- Modify: `engine/src/hexatonics.ts` (`hexatonicRanking`; `hexatonicAuto` reads it), `engine/src/__tests__/hexatonics.test.ts`, `engine/src/index.ts`, API snapshot

**Interfaces:**
- Consumes: `pentatonicRanking`, `PENTATONIC_DEGREE_LABELS` (`pentatonics.ts`); `hexatonicPairs` (`hexatonics.ts`); `writtenScale`, `scaleLabel`, `concertPc` (`part.ts`); `writtenChordRootLenient`, `writtenChordTextOrNull`, `parseChord` (`chord.ts`); `baseQuality`.
- Produces:
  ```ts
  // hexatonics.ts
  export function hexatonicRanking(pairs: readonly HexPair[], chordRoot: Spelled): readonly HexPair[] // Auto order; hexatonicAuto = [0] ?? null
  // chordChoices.ts
  export type PentChoice = Readonly<{ pc: number; name: string; degree: number; shared: number; label: string }> // pc concert; name written
  export type HexChoice = Readonly<{ roots: readonly [number, number]; name: string; coverage: number; label: string }> // roots concert, lower first
  export function pentatonicChoices(chord: string, scale: string, part: Part): readonly PentChoice[] // [] if the scale can't be read
  export function hexatonicChoices(chord: string, scale: string, part: Part): readonly HexChoice[] // [] if none
  export function pickHeading(part: Part, chord: string, scale: string): string // 'D♭7 Mixolydian'
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { hexatonicChoices, pentatonicChoices, pickHeading } from '../chordChoices'
import { CONCERT, type Part } from '../part'
const TENOR: Part = { clef: 'treble', trans: 'Bb' }

describe('pentatonicChoices', () => {
  it('lists all 12 in pentatonicRanking order, labelled with degree and shared count', () => {
    const c = pentatonicChoices('Cmaj7', 'C Ionian', CONCERT)
    expect(c).toHaveLength(12)
    expect(c[0]).toMatchObject({ name: 'Am', degree: 9, shared: 5, pc: 9, label: 'Am pent · on 6 · 5 shared' })
    expect(c.map((x) => x.shared)).toEqual([...c.map((x) => x.shared)].sort((a, b) => b - a))
  })
  it('orders inside → outside per chord: the minor pentatonic on 6 leads on Cmaj7, on 1 on Cm7', () => {
    expect(pentatonicChoices('Cmaj7', 'C Ionian', CONCERT)[0]?.degree).toBe(9)
    expect(pentatonicChoices('Cm7', 'C Dorian', CONCERT)[0]?.degree).toBe(0)
  })
  it('writes names for a B♭ part, keeps pitch classes concert', () => {
    const c = pentatonicChoices('Cmaj7', 'C Ionian', TENOR)[0]!
    expect([c.name, c.pc]).toEqual(['Bm', 9])
  })
  it('gives nothing for a scale it cannot read', () => {
    expect(pentatonicChoices('Cmaj7', 'C Nonsense', CONCERT)).toEqual([])
  })
})

describe('hexatonicChoices', () => {
  it('lists the pairs in Auto order with coverage', () => {
    const c = hexatonicChoices('Cmaj7', 'C Ionian', CONCERT)
    expect(c[0]).toMatchObject({ name: 'G/Am', roots: [7, 9], label: expect.stringMatching(/^G\/Am · covers \d$/) })
    expect(c.map((x) => x.name)).toHaveLength(7)
  })
  it('keeps concert roots on a B♭ part', () => {
    expect(hexatonicChoices('Cmaj7', 'C Ionian', TENOR)[0]).toMatchObject({ name: 'A/Bm', roots: [7, 9] })
  })
  it('gives nothing where the scale has no pairs', () => {
    expect(hexatonicChoices('C7#5', 'C Whole Tone', CONCERT)).toEqual([])
  })
})

it('heads a popover with the written chord and its scale’s name', () => {
  expect(pickHeading(CONCERT, 'Db7', 'Db Mixolydian')).toBe('D♭7 Mixolydian')
  expect(pickHeading(TENOR, 'Db7', 'Db Mixolydian')).toBe('E♭7 Mixolydian')
})
```

(Scale texts are capitalised as in `sheet.test.ts` (`C Dorian`); check `C Whole Tone` against `SCALES` aliases, and
use it. Work out the expected coverage digits with `hexatonicPairs` before pinning a number.)

In `hexatonics.test.ts`: `hexatonicRanking` puts `hexatonicAuto`'s pair first on the worked Auto table (Cmaj7 → G/Am,
Dm7 → C/Dm, G7 → Dm/Em, C7 half-whole → E♭/Am). It is a permutation of the pairs, and it is `[]` for none.

- [ ] **Step 2: Run the tests to make sure they fail.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** `hexatonics.ts`:

```ts
/** the pairs in Auto's order (most chord tones, major/minor, fewest fifths ♭ first, chain position) */
export function hexatonicRanking(pairs: readonly HexPair[], chordRoot: Spelled): readonly HexPair[] {
  const ref = pcOf(chordRoot)
  const key = (p: HexPair): readonly number[] => {
    const fifths = fifthsFrom(pcOf(p.lower.root), ref)
    return [-p.coverage, standard(p.lower) && standard(p.upper) ? 0 : 1, Math.abs(fifths), fifths, p.link]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((d, x, j) => d || x - b[j]!, 0)
  return [...pairs].sort((a, b) => cmp(key(a), key(b)))
}
export const hexatonicAuto = (pairs: readonly HexPair[], chordRoot: Spelled): HexPair | null => hexatonicRanking(pairs, chordRoot)[0] ?? null
```

`chordChoices.ts`:

```ts
import { parseChord, writtenChordRootLenient, writtenChordTextOrNull } from './chord'
import { hexatonicPairs, hexatonicRanking } from './hexatonics'
import { concertPc, type Part, scaleLabel, writtenScale } from './part'
import { PENTATONIC_DEGREE_LABELS, pentatonicRanking } from './pentatonics'
import { glyphs, mod, pcOf } from './pitch'
import { baseQuality } from './qualities'
import { orNull } from './util'

/** a popover's rows (#303): one chord's choices from inside to outside, written for the part; pitch classes concert, as picks store them */
export type PentChoice = Readonly<{ pc: number; name: string; degree: number; shared: number; label: string }>
export type HexChoice = Readonly<{ roots: readonly [number, number]; name: string; coverage: number; label: string }>

const read = (chord: string, scale: string, part: Part) => orNull(() => {
  const w = writtenScale(part, scale)
  return { w, root: orNull(() => writtenChordRootLenient(part, chord, scale)) ?? w.root }
})

export function pentatonicChoices(chord: string, scale: string, part: Part): readonly PentChoice[] {
  const r = read(chord, scale, part)
  if (!r) return []
  const pcs = new Set(r.w.notes.map((n) => mod(pcOf(r.w.root) + n.semis, 12))) // as buildChanges ranks
  return pentatonicRanking(pcs, r.root).map((p) => ({ pc: concertPc(part, pcOf(p.root)), name: p.name, degree: p.degree, shared: p.shared, label: `${p.name} pent · on ${PENTATONIC_DEGREE_LABELS[p.degree]} · ${p.shared} shared` }))
}

export function hexatonicChoices(chord: string, scale: string, part: Part): readonly HexChoice[] {
  const r = read(chord, scale, part)
  if (!r) return []
  const quality = orNull(() => baseQuality(parseChord(chord).quality))
  return hexatonicRanking(hexatonicPairs(r.w.notes, r.root, quality), r.root).map((p) => ({
    roots: [concertPc(part, pcOf(p.lower.root)), concertPc(part, pcOf(p.upper.root))] as const,
    name: p.name,
    coverage: p.coverage,
    label: `${p.name} · covers ${p.coverage}`,
  }))
}

export const pickHeading = (part: Part, chord: string, scale: string): string =>
  orNull(() => `${glyphs(writtenChordTextOrNull(part, chord, scale) ?? chord)} ${scaleLabel(part, scale).name}`) ?? glyphs(chord)
```

- [ ] **Step 4: Export and update the snapshot.** Add `export * from './chordChoices'` to `index.ts` and run `-u` on `api.test.ts`. Run the hexatonics, chordChoices and api tests. Expected: PASS, with `hexatonics.test.ts` unchanged otherwise.
- [ ] **Step 5: Commit**

```bash
git add engine/src/chordChoices.ts engine/src/__tests__/chordChoices.test.ts engine/src/hexatonics.ts engine/src/__tests__/hexatonics.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: the popover's choices, inside to outside, per chord (#303)"
```

---

### Task 4: Changes sheet applies both kinds of picks

**Files:**
- Modify: `engine/src/changes.ts`
- Test: `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: `PentPick`, `HexPick`, `livePick`, `pickTarget` (Task 1); `hexatonicRanking` (Task 3).
- Produces:
  ```ts
  export type PentatonicPlan = Readonly<{ …; picks?: Readonly<Record<ChordAt, PentPick>> }> // was Record<ChordAt, number>
  export type HexatonicPlan = Readonly<{ kind: 'hexatonic'; picks?: Readonly<Record<ChordAt, HexPick>> }>
  type PickSource = Readonly<{ chord: string; scale: string }> | null // concert; null when the chord has no scale
  ChangesPentatonic gains: sheet: string /* the name it plays without a pick */; source: PickSource
  //   and `scale` is now set on the Key basis too (the chord's scale, written; '' when it has none)
  export type ChangesHexatonic = Readonly<{ label: string; name: string; chord: ChordAt; picked: boolean; run: readonly ChordAt[]; sheet: string; source: PickSource }>
  ```

- [ ] **Step 1: Update the existing `picks` tests to the object form.** In `changes.test.ts`, write
  `keyPlan = (picks: Record<string, number> = {}) => ({ …, picks: Object.fromEntries(Object.entries(picks).map(([k, pc]) => [k, { pc }])) })`
  and the same in the `preset('minor-thirds', …, { picks: { 'B:2:0': { pc: 9 } } })` call (line ~255). These legacy
  picks have no `for`, so every existing expectation stands.
- [ ] **Step 2: Write the failing tests**

```ts
describe('chord picks (#303)', () => {
  const C4 = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | Cmaj7'
  const doc = parseChart(C4).value
  const target = (at: string) => pickTargets(doc, resolveScales(doc, { level: 'standard', seed: 0 })).get(at)!
  const chordPlan = (picks: Record<string, { pc: number; for?: string }>): PentatonicPlan => ({ kind: 'pentatonic', bySection: {}, fallback: PENTATONIC_HOME, counts: false, basis: 'chord', degree: 'auto', picks })
  const hex = (picks: Record<string, { roots: readonly [number, number]; for?: string }> = {}, part = CONCERT) =>
    flat(showHexatonics(buildChanges(doc, part, 4, false, 'off', undefined, { kind: 'hexatonic', picks }).lines)).map((c) => c.hexatonic)

  it('applies a pentatonic pick made for its position’s chord and scale, on its run only', () => {
    const chords = flat(showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({ 'A:2:0': { pc: 4, for: target('A:2:0') } })).lines))
    expect(chords.map((c) => [c.pentatonic?.name, c.pentatonic?.picked, c.pentatonic?.sheet])).toEqual([['Am', false, 'Am'], ['Em', true, 'Dm'], ['Dm', false, 'Dm'], ['Am', false, 'Am']])
  })

  it('ignores a pick made for another chord or scale (a stale pick): the sheet’s choice, nothing picked', () => {
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({ 'A:2:0': { pc: 4, for: 'Dm7|D Aeolian' } })).lines)
    expect(chords[1]?.pentatonic).toMatchObject({ name: 'Dm', picked: false })
  })

  it('gives each label its source, concert', () => {
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan({})).lines)
    expect(chords[2]?.pentatonic?.source).toEqual({ chord: 'G7', scale: resolveScales(doc, { level: 'standard', seed: 0 }).get(2)?.scale })
  })

  it('applies a hexatonic pick on its chord; the Auto pair elsewhere; runs like the pentatonic row', () => {
    const h = hex({ 'A:1:0': { roots: [0, 2], for: target('A:1:0') } }) // C/Dm on Cmaj7
    expect(h.map((x) => [x?.name, x?.picked, x?.sheet])).toEqual([['C/Dm', true, 'G/Am'], ['C/Dm', false, 'C/Dm'], ['Dm/Em', false, 'Dm/Em'], ['G/Am', false, 'G/Am']])
    expect(h[0]?.run).toEqual(['A:1:0', 'A:2:0']) // Dm7's Auto is C/Dm too: its label merges into the pick's
    expect(h[1]?.label).toBe('')
  })

  it('ignores a hexatonic pick whose roots are not among the chord’s pairs', () => {
    expect(hex({ 'A:1:0': { roots: [1, 3], for: target('A:1:0') } })[0]).toMatchObject({ name: 'G/Am', picked: false })
  })

  it('keeps a hexatonic pick’s sounding pair on a B♭ part', () => {
    expect(hex({ 'A:1:0': { roots: [0, 2], for: target('A:1:0') } }, TENOR)[0]).toMatchObject({ name: 'D/Em', picked: true })
  })
})
```

(Work each expected Auto name out with `hexatonicAuto` before pinning it. The values above follow the worked table:
Cmaj7 → G/Am, Dm7 → C/Dm, G7 → Dm/Em.)

- [ ] **Step 3: Run the tests to make sure they fail.** Expected: FAIL (type errors on `picks`, missing `sheet`, `source`, `run` and `picked` on hexatonics).
- [ ] **Step 4: Implement in `buildChanges`.**
  - `pentatonicOf(…)` gains a `target: string` argument, passed as `pickTarget(row.chord, scale)` (concert
    `scale`, before `sheetScale`). The pick is `livePick(pentatonic.picks ?? {}, chord, target)?.pc`, and the rest of
    the `want` logic is unchanged.
  - Chord basis: `sheet` is the name of the entry chosen without the pick
    (`(degree === 'auto' ? undefined : r.entries.find(…)) ?? r.entries[0]!`). Key basis: `sheet` is
    `pentatonicAt(area.ladder, sectionView).name`.
  - Both bases set `source: scale ? { chord: chordText, scale } : null`. The Key basis sets `scale` to
    `sheetScale(part, scale) ?? ''`; it was `''` before. Grep the web code for `p.scale` / `.pentatonic.scale` and
    check that nothing relied on `''` there.
  - `hexatonicOf(scale, chordText, at, target)`: cache `{ pairs, ranking, chordRoot }` by `${scale}|${chordText}`. The
    pick is `livePick(overlay.picks ?? {}, at, target)`. Its written roots are `mod(pc + toWritten, 12)` for each root,
    and the chosen pair is the one whose `pcOf(lower.root)` and `pcOf(upper.root)` match, else `ranking[0]`. Return
    `{ label: used.name, name: used.name, chord: at, picked: !!found, run: [], sheet: ranking[0].name, source: { chord: chordText, scale } }`,
    or `null` when there are no pairs.
  - `showHexatonics` mirrors `showPentatonics`. Each line keeps a `printed` array (the name differs from the last shown
    on the line, and a chord with none resets it). An unprinted label gets `label: ''`. A printed label gets
    `run` (its chord and the following unprinted ones up to a chord with none) and `picked` (any in its run). It stays
    idempotent.
- [ ] **Step 5: Run the whole changes test file.** Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Engine: Changes sheet honours pentatonic and hexatonic picks per chord (#303)"
```

---

### Task 5: Scales sheet takes the first position's pick; positions, varies, source

**Files:**
- Modify: `engine/src/sheet.ts`, `engine/src/pentatonics.ts`, `engine/src/hexatonics.ts`
- Test: `engine/src/__tests__/sheet.test.ts`, `pentatonics.test.ts`, `hexatonics.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  ```ts
  // pentatonics.ts
  export type StaffPentatonic = Readonly<{ name: string; degree: number; shared: number; picked: boolean; sheet: string }>
  export function pentatonicPick(pcs, chordRoot, degree, picked?: number | null /* written pc */): Readonly<{ pentatonic: StaffPentatonic; lit: boolean[] }>
  export const pentatonicCaption: (p: StaffPentatonic, varies?: boolean) => string // '… · varies'
  // hexatonics.ts
  export type StaffHexatonic = Readonly<{ name: string; link: number; picked: boolean; sheet: string }>
  export function hexatonicPick(scale, chordRoot, quality, pair, grouping, pcs?, picked?: readonly [number, number] | null /* written */)
  export const hexatonicCaption: (h: StaffHexatonic | null, varies?: boolean) => string
  // sheet.ts
  export type SheetPicks = Readonly<{ picks: ChordPicks; at: ReadonlyMap<number, ChordAt> }>
  StaffModel gains: positions: readonly ChordAt[]; varies: boolean; source: Readonly<{ chord: string; scale: string }> | null
  export function buildSheet(rows, part, choice, startText, perPage, practice?, key?, resolved?, picks?: SheetPicks): SheetPart[]
  ```

- [ ] **Step 1: Write the failing tests.** In `pentatonics.test.ts`, `pentatonicPick` with `picked` set to a written
  pc in the ranking lights that pentatonic, reports `picked: true`, and gives `sheet` as the name the degree would
  play. With `picked: null` it reports `picked: false`. Also test the caption with `varies`:
  `'Dm pent · 5 shared · varies'`. In `hexatonics.test.ts`, test the same shape for `hexatonicPick`; roots not among
  the pairs mean the Pair control's pair and `picked: false`; and `hexatonicCaption(h, true)` is `'G/Am hex · varies'`.
  In `sheet.test.ts`:

```ts
describe('chord picks on the Scales sheet (#303)', () => {
  const doc = parseChart(FORM).value // Task 2's chart
  const rows = expandRows(doc).value
  const res = resolveScales(doc, { level: 'standard', seed: 0 })
  const at = chordPositions(doc)
  const targets = pickTargets(doc, res)
  const PENT = { preset: 'pentatonic', degree: 'auto' } as const
  const staves = (picks: ChordPicks, practice: PracticeSelection = PENT, part = CONCERT) =>
    buildSheet(rows, part, 'root', 'C', 12, practice, undefined, res, { picks, at })[0]!.pages.flat()
  const dm = (s: readonly StaffModel[]) => s.find((x) => x.chords[0]?.some((t) => t.text.startsWith('D')))! // the Dm7 staff; match how other tests find a staff

  it('lists the positions it covers and its concert source', () => {
    expect(dm(staves(NO_PICKS))).toMatchObject({ positions: ['A1:1:0', 'B:5:0', 'A3:9:0'], varies: false, source: { chord: 'Dm7', scale: res.get(0)?.scale } })
  })
  it('takes its first position’s pick', () => {
    const picks = withPick(NO_PICKS, 'pentatonic', ['A1:1:0'], 4, targets) // Em
    expect(dm(staves(picks)).pentatonic).toMatchObject({ name: 'Em', picked: true, sheet: 'Dm' })
  })
  it('varies where its positions’ picks differ (a pick and none count as different)', () => {
    const picks = withPick(NO_PICKS, 'pentatonic', ['B:5:0'], 4, targets)
    const s = dm(staves(picks))
    expect([s.pentatonic?.name, s.pentatonic?.picked, s.varies]).toEqual(['Dm', false, true]) // first position A1:1:0 has none
  })
  it('does not vary when every position has the same pick', () => {
    expect(dm(staves(withPick(NO_PICKS, 'pentatonic', ['A1:1:0', 'B:5:0', 'A3:9:0'], 4, targets))).varies).toBe(false)
  })
  it('ignores a stale pick and the other kind’s picks', () => {
    expect(dm(staves({ pentatonic: { 'A1:1:0': { pc: 4, for: 'Dm7|D Aeolian' } }, hexatonic: {} })).pentatonic?.picked).toBe(false)
    expect(dm(staves(withPick(NO_PICKS, 'hexatonic', ['A1:1:0'], [0, 2], targets))).varies).toBe(false)
  })
  it('applies a hexatonic pick under the Hexatonic preset', () => {
    const s = dm(staves(withPick(NO_PICKS, 'hexatonic', ['A1:1:0', 'B:5:0', 'A3:9:0'], [5, 7], targets), { preset: 'hexatonic', pair: 0, grouping: 'triads' }))
    expect(s.hexatonic).toMatchObject({ name: 'F/G', picked: true })
  })
  it('keeps the sounding pick on a B♭ part', () => {
    expect(dm(staves(withPick(NO_PICKS, 'pentatonic', ['A1:1:0'], 4, targets), PENT, { clef: 'treble', trans: 'Bb' })).pentatonic).toMatchObject({ name: 'F♯m', picked: true })
  })
  it('without picks or positions, staves have positions [] and varies false; error staves too', () => {
    const s = buildSheet(rows, CONCERT, 'root', 'C', 12, PENT, undefined, res)[0]!.pages.flat()
    expect(s.every((x) => x.positions.length === 0 && !x.varies)).toBe(true)
  })
})
```

(Work out the B♭ spelling, `F♯m` or `G♭m`, with `pentatonicRanking` before pinning it. Also check that D Dorian has
the pair F/G.)

- [ ] **Step 2: Run the tests to make sure they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `pentatonicPick`: `const auto = (isDegree(degree) ? find : undefined) ?? ranked[0]!`, then
    `const found = picked == null ? undefined : ranked.find((p) => pcOf(p.root) === picked)` and `at = found ?? auto`.
    Return `picked: !!found, sheet: auto.name`.
  - `hexatonicPick`: `const auto = resolvePair(pairs, pair, chordRoot)`. `found` is the pair whose lower and upper
    root pcs equal `picked`, and `used = found ?? auto`. Return `picked: !!found, sheet: auto.name` (when `auto` is
    `null` and `used` is a pick, `sheet` is `''`).
  - Captions: append `' · varies'` when `varies` is true.
  - `buildSheet`: when `picks` is given, build `targets` as a Map from each row `i` with `picks.at.get(i)` to
    `pickTarget(rows[i].chord, scaleOf(rows[i], i))`. Then take `live = livePicks(picks.picks, targets)` and
    `toWritten = pcOf(writtenRoot(part, parseRoot('C'), 'ionian'))`. For each line:
    `positions = picks ? linePositions(l, picks.at) : []`. The kind is `isPentatonicSelection(practice)` ?
    `'pentatonic'` : `isHexatonicSelection(practice)` ? `'hexatonic'` : `null`. `vals` is
    `positions.map((p) => live[kind]?.[p])`, `varies` is true when the vals' keys
    (`pc` / `roots.join()` / `'-'`) form more than one distinct value, and `first = vals[0]`. Hand `practiceFor` the
    first value, written: `mod(pc + toWritten, 12)`, or the two roots mapped the same way.
  - `staff(…)` gains `positions`, `varies` and `source` (`scale === null ? null : { chord: row.chord, scale }`). An error
    staff keeps `positions` but has `varies: false`. `StaffModel.id` is unchanged, because picks change `selected` and
    the redraw already watches it.
- [ ] **Step 4: Run the engine tests** (`cd engine && npx vitest run`). Expected: PASS, apart from the API snapshot. Update it with `-u` and review it (`SheetPicks` is a type, so only value exports appear).
- [ ] **Step 5: Commit**

```bash
git add engine/src/sheet.ts engine/src/pentatonics.ts engine/src/hexatonics.ts engine/src/__tests__/sheet.test.ts engine/src/__tests__/pentatonics.test.ts engine/src/__tests__/hexatonics.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: Scales staves take their first position's pick, with positions and varies (#303)"
```

---

### Task 6: Share links and the golden fixture

**Files:**
- Modify: `engine/src/share.ts`, `engine/src/__tests__/share.test.ts`, `engine/src/__tests__/goldenFixture.ts`, `engine/fixtures/golden.json`

**Interfaces:**
- Consumes: `ChordPicks`, `chordPicksFrom`, `hasPicks` (Task 1); `pentatonicRanking`, `hexatonicChoices`.
- Produces: `ShareView.picks?: ChordPicks`. In the golden file: `Golden.pentatonics` and `Hexatonics.choices`.

- [ ] **Step 1: Write the failing share tests**

```ts
it('carry chord picks, keyed by position', async () => {
  const picks = { pentatonic: { 'A:6:0': { pc: 1, for: 'G7#5#9|G Altered' } }, hexatonic: { 'B:14:0': { roots: [1, 3] as const, for: 'G7#5#9|G Altered' } } }
  expect((await decodeShare(await encodeShare({ chart: CHART, view: { picks } })))?.view?.picks).toEqual(picks)
})
it('open an old link with no picks', async () => {
  expect((await decodeShare(await encodeShare({ chart: CHART, view: { sheet: 'changes' } })))?.view?.picks).toBeUndefined()
})
it('drop damaged picks, and the field when none survive', () => {
  expect(shareViewFrom({ picks: { pentatonic: { 'A:1:0': 99 } } })).toBeUndefined()
  expect(shareViewFrom({ picks: { pentatonic: { 'A:1:0': 3, nope: 2 } } })?.picks).toEqual({ pentatonic: { 'A:1:0': { pc: 3 } }, hexatonic: {} })
})
```

(Use the file's existing chart constant in place of `CHART`.)

- [ ] **Step 2: Run them to make sure they fail; implement** (`const picks = chordPicksFrom(o.picks)` and `...(hasPicks(picks) ? { picks } : {})`). Run them again. Expected: PASS.
- [ ] **Step 3: Extend the golden input (closes #305).** In `goldenFixture.ts`:

```ts
/** ranking: every scale on C, its 12 minor pentatonics as [degree, name, shared]; auto: each quality's Auto pentatonic over its default scale on C */
export type Pentatonics = { ranking: Record<string, [number, string, number][]>; auto: Record<string, { scale: string | null; name: string | null }> }
export function pentatonicCases(): Pentatonics {
  const C = parseRoot('C')
  const ranking = Object.fromEntries((Object.keys(SCALES) as ScaleKey[]).map((k) => [k, pentatonicRanking(new Set(spellScale(C, k).map(pcOf)), C).map((p): [number, string, number] => [p.degree, p.name, p.shared])]))
  const auto = Object.fromEntries(QUALITY_NAMES.map((q) => {
    const chord = `C${q}`
    const scale = attempt(() => defaultScale(chord))
    return [chord, { scale, name: scale === null ? null : (pentatonicChoices(chord, scale, CONCERT)[0]?.name ?? null) }]
  }))
  return { ranking, auto }
}
```

Then add `pentatonics: Pentatonics` to `Golden` and `pentatonics: pentatonicCases()` to `buildGolden`. Add
`choices: Record<string, string[]>` to `Hexatonics`: for each quality's default scale on C, the names from
`hexatonicChoices(chord, scale, CONCERT)`, filled in `hexatonicCases`.
- [ ] **Step 4: Run `make golden`.** Review `git diff engine/fixtures/golden.json`. Expected: only the new
  `pentatonics` key and `hexatonics.choices`; nothing existing changes. Spot-check three rows by hand: C Ionian ranks
  Am first (on 6, 5 shared), C Dorian ranks Cm first, and Cmaj7's choices start with G/Am. Then run `make test`.
  Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add engine/src/share.ts engine/src/__tests__/share.test.ts engine/src/__tests__/goldenFixture.ts engine/fixtures/golden.json
git commit -m "Engine: chord picks in share links; golden pentatonics and hexatonic choices (#303, closes #305)"
```

---

### Task 7: `useChordPicks` and the popover's wording

**Files:**
- Rename: `web/app/composables/usePentatonicPicks.ts` → `web/app/composables/useChordPicks.ts`; `web/test/usePentatonicPicks.test.ts` → `web/test/useChordPicks.test.ts` (`git mv`)
- Create: `web/app/utils/chordPicks.ts`, `web/test/chordPicks.test.ts`

**Interfaces:**
- Consumes: the engine's `ChordPicks`, `chordPicksFrom`, `livePicks`, `withPick`, `withoutPicks`, `hasPicks`, `carryChordPicks`, `NO_PICKS`, `PickKind`, `PickValue`, `DrawnChord`.
- Produces:
  ```ts
  export function useChordPicks(chartKey: string | undefined, targets: Readonly<Ref<ReadonlyMap<ChordAt, string>>>, seed?: ChordPicks): {
    picks: Readonly<Ref<ChordPicks>>
    live: ComputedRef<ChordPicks>
    pick<K extends PickKind>(kind: K, positions: readonly ChordAt[], value: PickValue[K]): void
    clear(kind: PickKind, positions: readonly ChordAt[]): void
    clearAll(): void
    carry(before: readonly DrawnChord[], after: readonly DrawnChord[]): void
    carryTo(otherKey: string): void
  }
  // utils/chordPicks.ts
  export const barList: (bars: readonly string[]) => string // '6', '6 and 22', '6, 14 and 22'
  export const pickHeader: (heading: string, bars: readonly string[]) => string // 'D♭7 Mixolydian · bars 6, 22'
  export const pickFooter: (sheet: 'changes' | 'scales', bars: readonly string[], varies: boolean) => string
  export const choiceId: { pent: (pc: number) => string; hex: (roots: readonly [number, number]) => string }
  ```

- [ ] **Step 1: Write the failing tests.** `chordPicks.test.ts`:

```ts
it('names one bar, two, or more', () => {
  expect([barList(['6']), barList(['6', '22']), barList(['6', '14', '22'])]).toEqual(['6', '6 and 22', '6, 14 and 22'])
})
it('heads with the chord, scale and bars', () => {
  expect(pickHeader('D♭7 Mixolydian', ['6', '22'])).toBe('D♭7 Mixolydian · bars 6, 22')
  expect(pickHeader('D♭7 Mixolydian', ['6'])).toBe('D♭7 Mixolydian · bar 6')
})
it('says what a pick changes: all three footers', () => {
  expect(pickFooter('changes', ['6'], false)).toBe('Sets bar 6.')
  expect(pickFooter('changes', ['6', '7'], false)).toBe('Sets bars 6 and 7.')
  expect(pickFooter('scales', ['6', '22'], false)).toBe('Sets bars 6 and 22 on the Changes sheet too.')
  expect(pickFooter('scales', ['6'], false)).toBe('Sets bar 6 on the Changes sheet too.')
  expect(pickFooter('scales', ['6', '22'], true)).toBe('Replaces the different picks in bars 6 and 22.')
})
```

`useChordPicks.test.ts` (adapt the existing file's `effectScope` harness):
  - It stores both kinds under `csm-pent-picks:<key>` as `{ pentatonic, hexatonic }` and removes the key when
    `clearAll()` leaves none.
  - A legacy `{"A:1:0": 7}` reads as `{ pentatonic: { 'A:1:0': { pc: 7 } }, hexatonic: {} }`; bad JSON reads as none.
  - `pick('pentatonic', ['A:1:0','A:2:0'], 9)` stamps each position's `for` from `targets`, and
    `clear('pentatonic', ['A:1:0'])` leaves `A:2:0`.
  - A pick made after `targets` changed drops a now-stale one, while `live` alone (no write) leaves storage as it is.
  - `seed` with no key fills memory only and writes nothing.
  - `carry` moves both kinds; `carryTo` copies to another key.

- [ ] **Step 2: Run them to make sure they fail** (`cd web && npx vitest run test/chordPicks.test.ts test/useChordPicks.test.ts`). Expected: FAIL.
- [ ] **Step 3: Implement.**

```ts
// utils/chordPicks.ts
export const barList = (bars: readonly string[]): string => (bars.length < 2 ? (bars[0] ?? '') : `${bars.slice(0, -1).join(', ')} and ${bars.at(-1)}`)
const bars = (b: readonly string[], list: string): string => `${b.length === 1 ? 'bar' : 'bars'} ${list}`
export const pickHeader = (heading: string, b: readonly string[]): string => `${heading} · ${bars(b, b.join(', '))}`
export const pickFooter = (sheet: 'changes' | 'scales', b: readonly string[], varies: boolean): string =>
  sheet === 'changes' ? `Sets ${bars(b, barList(b))}.` : varies ? `Replaces the different picks in ${bars(b, barList(b))}.` : `Sets ${bars(b, barList(b))} on the Changes sheet too.`
export const choiceId = { pent: (pc: number): string => `p${pc}`, hex: (r: readonly [number, number]): string => `h${r[0]}-${r[1]}` }
```

```ts
// composables/useChordPicks.ts
import type { Ref } from 'vue'
import { carryChordPicks, type ChordAt, type ChordPicks, chordPicksFrom, type DrawnChord, hasPicks, livePicks, NO_PICKS, type PickKind, type PickValue, withoutPicks, withPick } from '@chord-scale-maker/engine'

const parse = (raw: string | null): ChordPicks => {
  if (raw === null) return NO_PICKS
  try { return chordPicksFrom(JSON.parse(raw)) } catch { return NO_PICKS }
}
/**
 * chord picks (#272, #303): each drawn chord's own pentatonic or triad pair, per chart in this browser under
 * `csm-pent-picks:<key>` (the #272 name, kept: its old bare-number maps still read). Without a key (a shared chart) they last
 * for the visit. targets: what each drawn position plays now, so a pick knows what it was made for.
 */
export function useChordPicks(chartKey: string | undefined, targets: Readonly<Ref<ReadonlyMap<ChordAt, string>>>, seed?: ChordPicks) {
  const storeKey = chartKey ? `csm-pent-picks:${chartKey}` : null
  const picks: Ref<ChordPicks> = ref(seed ?? (storeKey ? parse(readStored(storeKey)) : NO_PICKS))
  watch(picks, (p) => {
    if (!storeKey) return
    if (hasPicks(p)) writeStored(storeKey, JSON.stringify(p))
    else removeStored(storeKey)
  })
  return {
    picks: readonly(picks),
    live: computed(() => livePicks(picks.value, targets.value)),
    pick<K extends PickKind>(kind: K, positions: readonly ChordAt[], value: PickValue[K]): void {
      picks.value = withPick(picks.value, kind, positions, value, targets.value)
    },
    clear(kind: PickKind, positions: readonly ChordAt[]): void {
      picks.value = withoutPicks(picks.value, kind, positions, targets.value)
    },
    clearAll(): void {
      if (hasPicks(picks.value)) picks.value = NO_PICKS
    },
    carry(before: readonly DrawnChord[], after: readonly DrawnChord[]): void {
      if (hasPicks(picks.value)) picks.value = carryChordPicks(before, after, picks.value)
    },
    carryTo(otherKey: string): void {
      if (hasPicks(picks.value)) writeStored(`csm-pent-picks:${otherKey}`, JSON.stringify(picks.value))
    },
  }
}
```

- [ ] **Step 4: Run the tests.** Expected: PASS. (`EditorView` still imports `usePentatonicPicks`. Task 11 switches
  it, so `make test`'s typecheck fails until then. Note this in the commit body and run `vitest` only for these two
  files.) To keep each commit green instead, update the import in `EditorView.vue` in this task too: replace
  `usePentatonicPicks(props.practiceKey)` with
  `useChordPicks(props.practiceKey, computed(() => pickTargets(editor.doc.value, resolved.value)))`, moving
  `resolved` above it, and adapt `onPentatonic` to `chordPicks.pick('pentatonic', run, concertPc(...))` /
  `chordPicks.clear('pentatonic', run)`. Then run `make test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add web/app/composables/useChordPicks.ts web/test/useChordPicks.test.ts web/app/utils/chordPicks.ts web/test/chordPicks.test.ts web/app/components/EditorView.vue
git commit -m "Web: useChordPicks for both kinds, and the popover's wording (#303)"
```

(`git mv` already staged the two deletions.)

---

### Task 8: `ChordPickPopover`, and the ladder's header, footer and Sheet's choice

**Files:**
- Create: `web/app/components/ChordPickPopover.vue`, `web/test/ChordPickPopover.test.ts`
- Modify: `web/app/components/PentatonicLadder.vue` (Key basis only), `web/test/PentatonicLadder.test.ts`

**Interfaces:**
- Consumes: `panelShift` (`~/utils/notePlacement`), `PAGE_ZOOM`, Headless UI `Popover`.
- Produces:
  ```ts
  // ChordPickPopover.vue
  export type ChoiceRow = Readonly<{ id: string; label: string; current: boolean }>
  props: { text: string /* the trigger's visible text */; ariaLabel: string; header: string; footer: string; sheetChoice: string; picked: boolean; rows: readonly ChoiceRow[]; triggerClass?: string }
  emits: { choose: [id: string]; clear: [] }
  // PentatonicLadder.vue (Key basis)
  props: { p: ChangesPentatonic; header: string; footer: string }
  emits: { pick: [written: number]; reset: [] } // unchanged
  ```

- [ ] **Step 1: Write the failing tests** (`ChordPickPopover.test.ts`, with `mountSuspended`; open by clicking the trigger):
  - The trigger shows `text` and has `aria-label` = `ariaLabel`, plus `, your pick` when `picked`. Its class has a
    dotted underline, or solid when `picked`, and `print:no-underline`.
  - The dialog is named by `header`. It shows the header, then `Sheet’s choice (Dm)` (`data-sheet-choice`, with
    `aria-current="true"` when not picked), then one button per row (`data-choice`, with `aria-current` on the
    current one), then the footer.
  - A row click emits `choose` with its id and closes. Sheet's choice emits `clear` and closes.
  - The panel has `print:hidden`.
  - `PentatonicLadder.test.ts`: the dialog's accessible name is `header`, the ladder's `p.title` shows as a
    sub-heading, the footer shows, and the old "Reset to the path" button is replaced by the Sheet's choice row
    (`Sheet’s choice (Am)` from `p.sheet`), which emits `reset`. Chord-basis fixtures leave this test (the ladder is
    Key basis only now).
- [ ] **Step 2: Run them to make sure they fail.**
- [ ] **Step 3: Implement `ChordPickPopover.vue`.** Copy `PentatonicLadder.vue`'s popover shell: `HPopover`, the
  `place()` measuring with `panelShift`, `PAGE_ZOOM` un-zoom, and the panel classes
  `w-72 rounded-paper bg-raised p-1.5 text-sm shadow-raised max-sm:w-[calc(100vw-2rem)] print:hidden`. Body:

```vue
<p class="px-2 pt-1 pb-2 text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">{{ header }}</p>
<ul class="border-y border-zinc-950/5 py-1 dark:border-white/10">
  <li><button type="button" data-sheet-choice :aria-current="picked ? undefined : 'true'" :class="rowClass(!picked)" @click="clear(close)">Sheet’s choice ({{ sheetChoice }})</button></li>
  <li v-for="r in rows" :key="r.id"><button type="button" data-choice :aria-current="r.current ? 'true' : undefined" :class="rowClass(r.current)" @click="choose(r.id, close)">{{ r.label }}</button></li>
</ul>
<p class="px-2 pt-2 pb-1 text-xs/4 text-zinc-600 dark:text-zinc-300">{{ footer }}</p>
```

  `rowClass(on)` reuses PentatonicLadder's row classes (`rounded-control w-full px-2 py-0.5 text-left …`, with
  `bg-note-100 text-note-800 dark:bg-note-300/15 dark:text-note-200` when on). Keyboard handling comes from Headless
  UI (Escape closes, Tab moves through the rows), as in the existing popovers.
- [ ] **Step 4: Update `PentatonicLadder.vue`.** Remove the chord-basis branch (`rows` keeps only the ladder) and
  take the `header` and `footer` props. Name the dialog with `:aria-label="header"`, render the header, then
  `p.title` in a muted sub-line, then the Sheet's choice row (`Sheet’s choice ({{ p.sheet }})`, emitting `reset`),
  then the rung rows, then the footer. The trigger's `ariaLabel` keeps its Key-basis text.
- [ ] **Step 5: Run `cd web && npx vitest run test/ChordPickPopover.test.ts test/PentatonicLadder.test.ts`. Expected: PASS.**
- [ ] **Step 6: Commit**

```bash
git add web/app/components/ChordPickPopover.vue web/test/ChordPickPopover.test.ts web/app/components/PentatonicLadder.vue web/test/PentatonicLadder.test.ts
git commit -m "Web: one chord pick popover, with header, Sheet's choice and footer (#303)"
```

---

### Task 9: Scales sheet: the caption opens the popover

**Files:**
- Modify: `web/app/components/ScaleStaff.vue`, `web/app/components/ScaleSheet.vue`
- Test: `web/test/ScaleStaff.test.ts`, `web/test/ScaleSheet.test.ts`

**Interfaces:**
- Consumes: `StaffModel.positions/varies/source` (Task 5), `pentatonicChoices`, `hexatonicChoices`, `pickHeading`, `pickBars` (engine), `pickHeader`, `pickFooter`, `choiceId` (Task 7), `ChordPickPopover` (Task 8).
- Produces:
  ```ts
  // ScaleStaff props add: part?: Part; pickable?: boolean
  // ScaleStaff / ScaleSheet emit: pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null]
  // ScaleSheet props add: picks?: ChordPicks; positions?: ReadonlyMap<number, ChordAt>; pickable?: boolean
  ```

- [ ] **Step 1: Write the failing tests** (`ScaleStaff.test.ts`). Build the staff with
  `buildSheet(..., { picks, at: chordPositions(doc) })` from a small chart with Dm7 in bars 1 and 5:
  - With `pickable` and `positions`, the pentatonic caption is a button with the caption's text
    (`Dm pent · 5 shared`). Clicking it opens a dialog named `Dm7 Dorian · bars 1, 5` with footer
    `Sets bars 1 and 5 on the Changes sheet too.` and 12 rows, the first `Dm pent · on 1 · 5 shared`.
  - Choosing `Em pent …` emits `pick` with `('pentatonic', ['A:1:0','B:5:0'], 4)`; Sheet's choice emits `pick` with
    `(…, null)`.
  - With `varies`, the caption reads `… · varies` and the footer reads
    `Replaces the different picks in bars 1 and 5.`
  - The hexatonic caption works the same way: rows `C/Dm · covers N` and value `[0, 2]`.
  - Without `pickable`, or with `positions: []`, the caption is a plain `div` with no button.
  - The caption keeps `data-slot="pentatonic"` / `"hexatonic"` on its wrapper and `print:whitespace-nowrap` sizing,
    and the trigger has `print:no-underline`.

  `ScaleSheet.test.ts`: `picks` and `positions` reach `buildSheet` (a picked staff's caption shows the pick), and a
  staff's `pick` is re-emitted.
- [ ] **Step 2: Run them to make sure they fail.**
- [ ] **Step 3: Implement.** In `ScaleStaff.vue`:

```ts
const kind = computed((): PickKind | null => (props.staff.pentatonic ? 'pentatonic' : props.staff.second ? 'hexatonic' : null))
const canPick = computed(() => !!props.pickable && !!props.part && !!props.staff.source && props.staff.positions.length > 0)
const bars = computed(() => pickBars(props.staff.positions))
const header = computed(() => (props.staff.source && props.part ? pickHeader(pickHeading(props.part, props.staff.source.chord, props.staff.source.scale), bars.value) : ''))
const footer = computed(() => pickFooter('scales', bars.value, props.staff.varies))
const pentRows = computed(() => (props.staff.source && props.part ? pentatonicChoices(props.staff.source.chord, props.staff.source.scale, props.part) : []))
const hexRows = computed(() => (props.staff.source && props.part ? hexatonicChoices(props.staff.source.chord, props.staff.source.scale, props.part) : []))
const rows = computed(() => kind.value === 'pentatonic'
  ? pentRows.value.map((c) => ({ id: choiceId.pent(c.pc), label: c.label, current: c.name === props.staff.pentatonic?.name }))
  : hexRows.value.map((c) => ({ id: choiceId.hex(c.roots), label: c.label, current: c.name === props.staff.hexatonic?.name })))
function choose(id: string): void {
  if (kind.value === 'pentatonic') emit('pick', 'pentatonic', props.staff.positions, pentRows.value.find((c) => choiceId.pent(c.pc) === id)!.pc)
  else emit('pick', 'hexatonic', props.staff.positions, hexRows.value.find((c) => choiceId.hex(c.roots) === id)!.roots)
}
```

In the template, the caption `div` (same `data-slot` and print classes) holds either `ChordPickPopover` (`text`
being the caption, `trigger-class="text-right"`, `sheet-choice` being `staff.pentatonic.sheet` or
`staff.hexatonic?.sheet ?? 'no triad pair'`) or the plain caption. Captions call
`pentatonicCaption(staff.pentatonic, staff.varies)` and `hexatonicCaption(staff.hexatonic, staff.varies)`.
`ScaleSheet.vue` passes `picks` to `buildSheet` as `{ picks, at: positions }` when both are set, and passes `part`
and `pickable` down.
- [ ] **Step 4: Run the tests. Expected: PASS.**
- [ ] **Step 5: Commit**

```bash
git add web/app/components/ScaleStaff.vue web/app/components/ScaleSheet.vue web/test/ScaleStaff.test.ts web/test/ScaleSheet.test.ts
git commit -m "Web: a Scales staff's caption picks for every bar it covers (#303)"
```

---

### Task 10: Changes sheet: chord-basis and hexatonic labels open the popover

**Files:**
- Modify: `web/app/components/ChangesSystem.vue`, `web/app/components/ChangesSheet.vue`
- Test: `web/test/ChangesSystem.test.ts`, `web/test/ChangesSheet.test.ts`

**Interfaces:**
- Consumes: Task 4's models, Tasks 7–8.
- Produces: `ChangesSystem` takes a new `part: Part` prop. Both components emit
  `pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null]`,
  concert, in place of `pentatonic: [run, written | null]`.

- [ ] **Step 1: Write the failing tests** (`ChangesSystem.test.ts`):
  - Chord basis: the label opens `ChordPickPopover`, named `Dm7 Dorian · bar 2`, with footer `Sets bar 2.` (or
    `Sets bars 2 and 3.` for a two-chord run). Choosing a row emits `pick` with `('pentatonic', run, pc)`, concert;
    on a B♭ part the emitted pc is still concert.
  - Key basis: the ladder's dialog is named by the header, and a ladder pick emits a concert pc
    (`concertPc(part, written)`), not the written one.
  - Hexatonic overlay: each printed label is a trigger (`data-chord`, a dotted underline, `, your pick` when picked).
    Its popover lists `hexatonicChoices` rows, and choosing one emits `('hexatonic', run, roots)`. Sheet's choice
    emits `null`.
  - At Intermediate (`shows('chord-picks')` false) every label is plain text, as the pentatonic labels are today.
  - In print the labels are plain text: the existing `hidden print:inline` pattern.
- [ ] **Step 2: Run them to make sure they fail.**
- [ ] **Step 3: Implement.** The pentatonic row: `shows('chord-picks')` (not `'pentatonics'`) gates the trigger.
  `m.p.basis === 'chord' && m.p.source` uses `ChordPickPopover`: rows come from
  `pentatonicChoices(m.p.source.chord, m.p.source.scale, part)`, current matches `c.name === m.p.name`, the header is
  `pickHeader(pickHeading(part, src.chord, src.scale), pickBars(m.p.run))` and the footer is
  `pickFooter('changes', pickBars(m.p.run), false)`. Otherwise `PentatonicLadder` gets the same header and footer,
  and `@pick="emit('pick', 'pentatonic', m.p.run, concertPc(part, $event))"`. The hexatonic marks carry `h`, the
  whole `ChangesHexatonic`, and render the same way, with `data-chord` on the span. `ChangesSheet` passes `:part` and
  re-emits `pick`. Write the trigger's `ariaLabel`s as
  `Pentatonic: D minor, built on 1, 5 of 5 notes in D Dorian, your pick. Show the choices` (the chord basis's
  existing words, ending "Show the choices") and `Triad pair: C/Dm, covers 3 chord tones, your pick. Show the choices`.
- [ ] **Step 4: Run the tests. Expected: PASS.**
- [ ] **Step 5: Commit**

```bash
git add web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/test/ChangesSystem.test.ts web/test/ChangesSheet.test.ts
git commit -m "Web: Changes labels pick per chord for both kinds, with header and footer (#303)"
```

---

### Task 11: EditorView wiring, share links, tier, notice, Reset chord picks

**Files:**
- Modify: `web/app/components/EditorView.vue`, `web/app/utils/interface.ts`, `web/app/utils/moreMenu.ts`, `web/app/components/MoreMenu.vue`
- Test: `web/test/EditorView.test.ts`, `web/test/interface.test.ts`, `web/test/moreMenu.test.ts`, `web/test/InterfaceNotice.test.ts` (if wording lists settings)

**Interfaces:**
- Consumes: everything above.
- Produces: `CONTROL_TIERS['chord-picks'] = 'everything'`; `HiddenSetting` adds `'chord-picks'`; `ViewSettings`
  adds `picks: boolean` (live picks of the kind the current sheet shows); `MoreAction` adds `'reset-picks'`;
  `MoreMenuState` adds `picks: boolean`.

- [ ] **Step 1: Write the failing tests.**
  - `interface.test.ts`: at Intermediate, `{ sheet: 'scales', picks: true, … }` gives
    `{ settings: ['chord-picks'], needs: 'everything' }`. At Everything it gives null. On the Arpeggios sheet, picks
    are never "in force".
  - `moreMenu.test.ts`: `reset-picks` appears after `revert` only when `picks` is true.
  - `EditorView.test.ts`:
    1. Changing Built on (`prefs.pentDegree`), Path, Rung, Side or Ranked against keeps the picks (the #272 clearing
       watchers are gone). Changing the chart's key still clears them.
    2. A Scales staff's `pick` reaches the Changes sheet's `overlay.picks` for every position.
    3. The share link's view carries `picks` when there are live picks and omits it when there are none.
    4. Opening with `shared.picks` applies them with nothing written to storage.
    5. More → Reset chord picks clears them.
    6. At Essentials, with picks in force, `InterfaceNotice` shows, and its Reset clears the picks.
- [ ] **Step 2: Run them to make sure they fail.**
- [ ] **Step 3: Implement.**
  - `interface.ts`: add `'chord-picks': 'everything', // the chord pick popovers on both sheets (#303)` to
    `CONTROL_TIERS`, `picks: boolean` to `ViewSettings`, and
    `...((changes || scales) && v.picks ? [['chord-picks', 'everything'] as const] : [])` to `setAway`.
  - `moreMenu.ts` / `MoreMenu.vue`: add `reset-picks: { label: 'Reset chord picks', icon: ArrowPathIcon }`, listed
    when `s.picks`.
  - `EditorView.vue`:
    - Move `resolved` above the picks. Add
      `const pickTargetsNow = computed(() => pickTargets(editor.doc.value, resolved.value))` and
      `const positionsNow = computed(() => chordPositions(editor.doc.value))`.
    - `const chordPicks = useChordPicks(props.practiceKey, pickTargetsNow, props.shared?.picks)`.
    - Remove the watcher on `[pentPath.path, step, pentRung, pentSide, pentDegree, pentBasis, chartKey]`. Keep
      `watch(() => JSON.stringify(chartKeyOf(editor.doc.value)), () => chordPicks.clearAll())`, commented "a
      transposed chart: a legacy pick has no for to catch it". Keep the carry watcher, calling `chordPicks.carry`.
    - `pentatonicPlan` gets `picks: chordPicks.picks.value.pentatonic`. Replace `HEXATONIC_PLAN` with
      `computed(() => ({ kind: 'hexatonic', picks: chordPicks.picks.value.hexatonic }))`.
    - `function onPick(kind, positions, value)` calls `chordPicks.clear(kind, positions)` when `value === null`,
      else `chordPicks.pick(kind, positions, value)`. Wire `@pick="onPick"` on both sheets; `ChangesSheet` drops
      `@pentatonic`.
    - `ScaleSheet` gets `:picks="chordPicks.picks.value" :positions="positionsNow" :pickable="ui.shows('chord-picks')"`.
      `practiceStaves` passes `{ picks: chordPicks.picks.value, at: positionsNow.value }` (Decision 8).
    - `picksInForce` (computed): for the kind the sheet shows (Changes: `prefs.overlay` when not `off`; Scales: the
      practice preset's kind), `hasPicks(chordPicks.live.value, kind)`. Pass it as `picks` to `hiddenSettings`.
      `RESETS['chord-picks'] = () => chordPicks.clearAll()`.
    - `moreItems` passes `picks: hasPicks(chordPicks.live.value)`. `onMore('reset-picks')` runs
      `chordPicks.clearAll(); said.value = 'Chord picks reset'`.
    - `shareUrl` adds `...(hasPicks(chordPicks.live.value) ? { picks: chordPicks.live.value } : {})`.
    - `saveCopy` and `saveShared` call `chordPicks.carryTo(…)` (renamed from `pentPicks`).
- [ ] **Step 4: Run `make test` and `make lint`. Expected: PASS.**
- [ ] **Step 5: Commit**

```bash
git add web/app/components/EditorView.vue web/app/utils/interface.ts web/app/utils/moreMenu.ts web/app/components/MoreMenu.vue web/test/EditorView.test.ts web/test/interface.test.ts web/test/moreMenu.test.ts
git commit -m "Web: one set of chord picks for both sheets, in share links, with Reset (#303)"
```

---

### Task 12: Docs, e2e, print, verification

**Files:**
- Modify: `docs/design.md`, `web/app/pages/help.vue`, `web/e2e/pentatonics.spec.ts`, `web/e2e/print.spec.ts`, `web/e2e/fixtures.ts`
- Create: `web/e2e/chord-picks.spec.ts`

- [ ] **Step 1: Docs.** In `docs/design.md`, add a "Chord picks" section beside the Pentatonic and Hexatonic
  sections. It covers: positions (`ChordAt`, folded repeats, endings, written-out copies), `for` matching, one set
  for both sheets, the Scales tie-break and `varies`, what survives and what clears, share links, and the tier.
  Replace the #272 sentences that say picks clear on control changes and never go in share links. In `help.vue`,
  under the Superimpose and Practice help: "Click a chord's pentatonic or triad pair (Changes) or a staff's caption
  (Scales) to pick another for that chord; the list runs from inside to outside. A pick on the Scales sheet sets every
  bar that staff covers. Sheet's choice undoes it; More → Reset chord picks undoes them all." (Shown at Everything,
  like the controls.)
- [ ] **Step 2: Fix the existing e2e.** In `pentatonics.spec.ts`, the dialog names change to headers: replace
  `{ name: 'A1 · G minor pentatonic ladder' }` with `{ name: /^Cm7 .* · bar 1$/ }` (read the actual header in a
  browser first), `/pentatonic ranking$/` with `/· bars? [\d, ]+$/`, and the `data-reset` click with
  `data-sheet-choice`. Any test asserting that a Path or Rung change clears picks now asserts that the pick survives.
- [ ] **Step 3: Write `chord-picks.spec.ts`** on Blue Bossa (concert; G7♯5♯9 G Altered in bars 6 and 14, one Scales
  staff; Changes positions `A:6:0` and `B:14:0`). Add `pentatonicPreset(page)` to `fixtures.ts` beside `hexatonicPreset`.

```ts
test('a pick on Changes bar 6 changes only that run', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  const at = (c: string) => page.locator(`[data-slot="pentatonic"] [data-chord="${c}"] button`).first()
  const before = await page.locator('[data-slot="pentatonic"] button').allTextContents()
  await at('A:6:0').click()
  const dialog = page.getByRole('dialog', { name: /· bar 6$/ })
  await expect(dialog).toContainText('Sets bar 6.')
  await dialog.locator('[data-choice]').nth(2).click()
  const after = await page.locator('[data-slot="pentatonic"] button').allTextContents()
  expect(after.filter((t, i) => t !== before[i])).toHaveLength(1)
})

test('a pick on a Scales staff sets both Changes bars, and the footer named them', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  await pentatonicPreset(page)
  const caption = page.locator('[data-slot="pentatonic"] button', { hasText: /pent/ }).nth(5) // the G7♯5♯9 staff: find it by its chord row instead of an index when writing
  await caption.click()
  const dialog = page.getByRole('dialog', { name: /bars 6, 14$/ })
  await expect(dialog).toContainText('Sets bars 6 and 14 on the Changes sheet too.')
  await dialog.locator('[data-choice]').nth(1).click()
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await rankedAgainstChord(page)
  for (const c of ['A:6:0', 'B:14:0']) await expect(page.locator(`[data-chord="${c}"] button`)).toHaveAttribute('aria-label', /your pick/)
})

test('different picks in the staff’s bars show varies', async ({ page }) => { /* pick on the staff, then a different one on Changes B:14:0; back on Scales the caption ends "· varies" and its footer reads "Replaces the different picks in bars 6 and 14." */ })

test('a share link reproduces the picks', async ({ page }) => { /* pick on the staff; open Share; read the link from the dialog; goto it; Changes A:6:0 and B:14:0 are picks, with the same label text */ })

test('picks survive a Built on change; Reset chord picks clears them', async ({ page }) => { /* change Pentatonic built on; still "your pick"; More actions → Reset chord picks; none */ })

test('the hexatonic label picks too', async ({ page }) => { /* Superimpose: Hexatonic; click the bar 6 label; choose the 2nd row; label changes and reads "your pick" */ })
```

  Write out each stub test's body in full while implementing, using the existing helpers (`chooseSheet`,
  `showPentatonics`, `rankedAgainstChord`, `hexatonicPreset`, `openShare`). This task is the place to write them,
  not a later one.
- [ ] **Step 4: Print.** In `print.spec.ts`, add a case: Scales sheet, Pentatonic preset, a `varies` caption made on
  the longest-caption chart the hexatonic case already uses. Then check that the print media keeps 12 staves a page
  and every `[data-slot="pentatonic"]` stays one line high (reuse the hexatonic case's height check). Repeat with the
  Hexatonic preset and `E♭+/F hex · varies`. If a `varies` caption wraps at 8.5rem, tighten only the print caption's
  letter-spacing (`print:tracking-tight`). Don't drop the word: the spec fixes the text.
- [ ] **Step 5: Verify.** Run `make test`, `make lint` and `make e2e`, then `make golden` once more. Expected: no
  diff. Check in a browser (the `run` skill, `make preview`): the popover's header and footer on both sheets, the
  keyboard (Tab through the rows, Escape closes and focus returns to the trigger), and the phone width (the popover
  fits at 375px).
- [ ] **Step 6: Commit**

```bash
git add docs/design.md web/app/pages/help.vue web/e2e/chord-picks.spec.ts web/e2e/pentatonics.spec.ts web/e2e/print.spec.ts web/e2e/fixtures.ts
git commit -m "Docs, e2e, print: chord picks on both sheets (#303)"
```

---

## Sequencing

Tasks 1–6 are engine-only and change nothing a user sees. The only behaviour change is `buildChanges` honouring
`for`, which existing legacy-form tests cover. Task 6 is the one `make golden`. Tasks 7–11 are web, in order: 7
(storage, with the EditorView import switched so every commit typechecks), 8 (the component), 9 and 10 (the sheets,
independent of each other), then 11 (wiring, which needs 9 and 10). Task 12 closes. There are no feature flags (#296
removed them), so the tier gate (`chord-picks`, Everything) is what keeps the popovers away from new players. Each
task is one commit, and the branch merges as one PR. A merge with PR #306 (Superimpose) touches `PreviewControls.vue`
and the e2e fixtures' overlay helper only: rebase and keep both.
