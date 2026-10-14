# Pentatonic Ladders (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Pentatonics row on the Changes sheet that names, in each key area, the minor pentatonic at the rung and side the player chose, with a popover showing the key area's whole ladder.

**Architecture:** A generic engine module (`engine/src/ladder.ts`) ranks any pitch-class set transposed 12 ways against a scale (shared with #262, triad pairs); `engine/src/pentatonics.ts` builds a key's 12-pentatonic ladder on it, adding the fifths walk and spelling. `buildChanges` attaches each chord's key-area ladder and label; a new pure `showPentatonics` keeps a label only where the key area changes or a line starts (run after `breakLines`, so app-side line breaks are respected). The app adds a flag, three preferences, the controls, a label row in `ChangesSystem` and a `PentatonicLadder` popover.

**Tech Stack:** TypeScript (strict), Vue 3 / Nuxt, Headless UI (`@headlessui/vue` Popover), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md`

## Global Constraints

- Engine stays free of Vue/DOM imports; `engine/src/index.ts` is its public API and `engine/src/__tests__/api.test.ts` snapshots the exported names (update the snapshot with `npx vitest run -u src/__tests__/api.test.ts` in `engine/`, then read the diff).
- Never hand-type note lists: pitch classes come from `SCALES` formulas via `spellFrom`.
- Spelling via `simplifyRoot(root, 'aeolian')`: no double accidentals, no B♯/E♯/C♭/F♭.
- Flag `pentatonics` in `runtimeConfig.public.features`, **off**; e2e builds turn it on (`NUXT_PUBLIC_FEATURES_PENTATONICS=true`).
- Preferences: `csm-pentatonics` (`on|off`, off), `csm-pent-rung` (`0`–`6`, `0`), `csm-pent-side` (`flat|sharp`, `flat`); never in chart rows; not carried by share links.
- Labels: `<root>m♪` with ♭/♯ glyphs (`Gm♪`, `E♭m♪`), written for the part; no shared count, no tint.
- Rung listbox labels exactly: `Home · 5 shared`, `1 · 5 shared`, `2 · 4 shared`, `3 · 3 shared`, `4 · 2 shared`, `5 · 1 shared`, `6 · 0 shared (Outside)`. Listbox `aria-label="Pentatonic rung"`; Side `aria-label="Pentatonic side"` (legend "Side"), options ♭ / ♯, hidden at rungs 0 and 6.
- Commands: `make test` (typecheck + vitest, both packages), `make lint`, `make e2e` (builds first), `make golden`.
- Stage files by name; never `git add -A`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work in the worktree `../csm-pent` on branch `pentatonic-ladders` (already created, spec committed).

## Review Focus

1. **Relative keys** (C major → A minor area): same home (Am), so the label must not repeat at the area change, but the popover title must name the area's own key. Test in Task 3.
2. **Line breaks made by the app** (`breakLines` on a phone or a crowded bar): the first chord of each new line must get a label. Test in Task 3 (`showPentatonics` after `breakLines`).
3. **Transposing parts on far keys** (E♭ part over concert F♯ major, B♭ part over D♭): no double accidentals or B♯/E♯/C♭/F♭ in any label. Test in Task 2 (all 12 homes × 12 entries).
4. **Chords the analysis doesn't reach** (no key area, e.g. a chart of only `N.C.` or before any key is found): no label, no popover, no crash. Test in Task 3.
5. **Stored preference garbage** (`csm-pent-rung=9`, `csm-pent-side=x`): falls back to `0` / `flat`. Test in Task 4.

---

### Task 1: Generic ladder module

Per the #255 comment (2026-10-14) and #262: one engine module ranks **any** pitch-class set (a minor pentatonic now; a
triad pair, hexatonics later) transposed 12 ways against a scale. It knows nothing of pentatonics, fifths or spelling.

**Files:**
- Create: `engine/src/ladder.ts`
- Modify: `engine/src/index.ts` (add `export * from './ladder'`)
- Test: `engine/src/__tests__/ladder.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Transposition = Readonly<{ root: number; shared: number }> // root: a pitch class 0–11
  /** a formula's pitch classes on a root pc (default 0: the shape) */
  export function pitchClasses(formula: string, rootPc?: number): ReadonlySet<number>
  /** how many of a shape's notes, moved to root, are in scale */
  export function sharedCount(shape: ReadonlySet<number>, root: number, scale: ReadonlySet<number>): number
  /** the shape on all 12 roots, most shared first; ties by root pc */
  export function rankTranspositions(shape: ReadonlySet<number>, scale: ReadonlySet<number>): readonly Transposition[]
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// engine/src/__tests__/ladder.test.ts
import { describe, expect, it } from 'vitest'
import { pitchClasses, rankTranspositions, sharedCount } from '../ladder'
import { SCALES } from '../scales'

const C_MAJOR = pitchClasses(SCALES.ionian[0])
const MINOR_PENT = pitchClasses(SCALES['minor pentatonic'][0])

describe('the generic ladder', () => {
  it('reads a formula as pitch classes on a root', () => {
    expect([...pitchClasses(SCALES['minor pentatonic'][0], 9)].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]) // A C D E G
  })

  it('counts a minor pentatonic’s notes in C major on every root', () => {
    expect([9, 2, 4, 7, 11, 0, 6, 5, 1, 10, 8, 3].map((r) => sharedCount(MINOR_PENT, r, C_MAJOR))).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
  })

  it('ranks all 12 transpositions, most shared first, ties by root', () => {
    const ranked = rankTranspositions(MINOR_PENT, C_MAJOR)
    expect(ranked).toHaveLength(12)
    expect(ranked.map((t) => t.shared)).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
    expect(ranked.slice(0, 3).map((t) => t.root)).toEqual([2, 4, 9]) // Dm Em Am
  })

  it('ranks any set: a triad pair (major triads a whole step apart) over C Lydian', () => {
    const pair = new Set([0, 4, 7, 2, 6, 9]) // C and D major triads on root 0
    const lydian = pitchClasses(SCALES.lydian[0])
    const ranked = rankTranspositions(pair, lydian)
    expect(ranked[0]).toEqual({ root: 0, shared: 6 }) // C/D: all six inside C Lydian
    expect(ranked.every((t) => t.shared <= 6)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run src/__tests__/ladder.test.ts`
Expected: FAIL, `Cannot find module '../ladder'`.

- [ ] **Step 3: Implement**

```ts
// engine/src/ladder.ts
import { mod } from './pitch'
import { spellFrom } from './scales'

/**
 * Tension ladders (#255, #262): any pitch-class set (a minor pentatonic, a triad pair, a hexatonic) moved to all 12
 * roots and ranked by how many of its notes a scale holds: the most shared is home, the fewest the most outside.
 * Generic: the set is the only difference between ladders; spelling and naming belong to their callers.
 */
export type Transposition = Readonly<{ root: number; shared: number }>

/** a formula's pitch classes on a root pc (default 0: the shape itself) */
export const pitchClasses = (formula: string, rootPc = 0): ReadonlySet<number> =>
  new Set(spellFrom({ letter: 0, acc: 0 }, formula).map((n) => mod(rootPc + n.semis, 12)))

/** how many of a shape's notes, moved to root, are in scale */
export const sharedCount = (shape: ReadonlySet<number>, root: number, scale: ReadonlySet<number>): number =>
  [...shape].filter((pc) => scale.has(mod(root + pc, 12))).length

/** the shape on all 12 roots, most shared first; ties by root pc */
export function rankTranspositions(shape: ReadonlySet<number>, scale: ReadonlySet<number>): readonly Transposition[] {
  return Array.from({ length: 12 }, (_, root) => ({ root, shared: sharedCount(shape, root, scale) })).sort((a, b) => b.shared - a.shared || a.root - b.root)
}
```

Add `export * from './ladder'` to `engine/src/index.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run src/__tests__/ladder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Update the API snapshot**

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__/api.test.ts.snap`
Expected: `pitchClasses`, `rankTranspositions`, `sharedCount` added. Then `make test` from the root: green.

- [ ] **Step 6: Commit**

```bash
git add engine/src/ladder.ts engine/src/index.ts engine/src/__tests__/ladder.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: a generic tension ladder for any pitch-class set (#255, #262)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pentatonic ladder

**Files:**
- Create: `engine/src/pentatonics.ts`
- Modify: `engine/src/index.ts` (add `export * from './pentatonics'`)
- Test: `engine/src/__tests__/pentatonics.test.ts`
- Snapshot: `engine/src/__tests__/__snapshots__/api.test.ts.snap`

**Interfaces:**
- Consumes: `pitchClasses`, `sharedCount` (Task 1).
- Produces:
  ```ts
  export type PentatonicSide = 'flat' | 'sharp'
  export type PentatonicView = Readonly<{ rung: number; side: PentatonicSide }> // rung 0–6
  export type PentatonicRung = Readonly<{ rung: number; side: PentatonicSide | null; root: Spelled; name: string; shared: number }> // name: "E♭m"
  export function pentatonicLadder(home: Spelled): readonly PentatonicRung[] // 12: Home, 1♭, 1♯, … 5♭, 5♯, 6
  export function pentatonicAt(ladder: readonly PentatonicRung[], view: PentatonicView): PentatonicRung
  export function isPentatonicView(v: unknown): v is PentatonicView
  ```
  `home` is the key's tonic minor root (already written for the part). The key's scale is Aeolian on `home` (for a major key that is the major scale itself).

- [ ] **Step 1: Write the failing tests**

```ts
// engine/src/__tests__/pentatonics.test.ts
import { describe, expect, it } from 'vitest'
import { isPentatonicView, pentatonicAt, pentatonicLadder } from '../pentatonics'
import { LETTERS, parseRoot, pcOf, type Spelled } from '../pitch'

const names = (home: string) => pentatonicLadder(parseRoot(home)).map((r) => `${r.rung}${r.side === 'flat' ? '♭' : r.side === 'sharp' ? '♯' : ''} ${r.name} ${r.shared}`)
const ugly = (n: Spelled) => Math.abs(n.acc) > 1 || ['B#', 'E#', 'Cb', 'Fb'].includes(LETTERS[n.letter] + (n.acc > 0 ? '#' : n.acc < 0 ? 'b' : ''))

describe('pentatonic ladders', () => {
  it("ranks C major's ladder from Am, by fifths each side", () => {
    expect(names('A')).toEqual(['0 Am 5', '1♭ Dm 5', '1♯ Em 5', '2♭ Gm 4', '2♯ Bm 4', '3♭ Cm 3', '3♯ F♯m 3', '4♭ Fm 2', '4♯ C♯m 2', '5♭ B♭m 1', '5♯ G♯m 1', '6 E♭m 0'])
  })

  it("ranks C minor's ladder from Cm", () => {
    expect(names('C').slice(0, 3)).toEqual(['0 Cm 5', '1♭ Fm 5', '1♯ Gm 5'])
  })

  it('has the shape 5 5 4 3 2 1 0 by rung in every key', () => {
    for (const home of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']) {
      const ladder = pentatonicLadder(parseRoot(home))
      expect(ladder).toHaveLength(12)
      expect([0, 1, 2, 3, 4, 5, 6].map((r) => ladder.find((x) => x.rung === r)?.shared)).toEqual([5, 5, 4, 3, 2, 1, 0])
      expect(new Set(ladder.map((x) => pcOf(x.root))).size).toBe(12)
    }
  })

  it('spells every pentatonic without double accidentals or B♯ E♯ C♭ F♭', () => {
    for (let pc = 0; pc < 12; pc++)
      for (const home of [parseRoot(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc] ?? 'C'), parseRoot(['C', 'C#', 'D', 'D#', 'E', 'F', 'Gb', 'G', 'G#', 'A', 'A#', 'B'][pc] ?? 'C')])
        for (const r of pentatonicLadder(home)) expect(ugly(r.root), `${r.name} from ${LETTERS[home.letter]}${home.acc}`).toBe(false)
  })

  it('walks sharps on the sharp side and flats on the flat side; rung 6 from the flat walk', () => {
    expect(names('C#').filter((n) => n.startsWith('6') || n.startsWith('4'))).toEqual(['4♭ Am 2', '4♯ Fm 2', '6 Gm 0']) // E major: E♯m → Fm
    expect(names('C#').find((n) => n.startsWith('3♯'))).toBe('3♯ B♭m 3') // A♯m spells B♯ and E♯: B♭m
    expect(names('F').at(-1)).toBe('6 Bm 0') // A♭ major: C♭m → Bm
  })

  it('picks a rung and side; the side is ignored where a rung has one pentatonic', () => {
    const ladder = pentatonicLadder(parseRoot('A'))
    expect(pentatonicAt(ladder, { rung: 2, side: 'flat' }).name).toBe('Gm')
    expect(pentatonicAt(ladder, { rung: 2, side: 'sharp' }).name).toBe('Bm')
    expect(pentatonicAt(ladder, { rung: 0, side: 'sharp' }).name).toBe('Am')
    expect(pentatonicAt(ladder, { rung: 6, side: 'sharp' }).name).toBe('E♭m')
  })

  it('reads a view', () => {
    expect(isPentatonicView({ rung: 3, side: 'sharp' })).toBe(true)
    expect(isPentatonicView({ rung: 7, side: 'sharp' })).toBe(false)
    expect(isPentatonicView({ rung: 1, side: 'up' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts`
Expected: FAIL, `Cannot find module '../pentatonics'`.

- [ ] **Step 3: Implement**

```ts
// engine/src/pentatonics.ts
import { pitchClasses, sharedCount } from './ladder'
import { glyphs, pcOf, rootName, shiftBy, type Spelled } from './pitch'
import { SCALES, simplifyRoot } from './scales'

/**
 * Pentatonic tension ladders (issue #255, docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md): a key's 12
 * minor pentatonics by how many notes they share with its scale, walked round the circle of fifths from home (the
 * key's tonic minor: Am in C major, Cm in C minor). Rung d shares 5 5 4 3 2 1 0 notes for d = 0 … 6.
 */
export type PentatonicSide = 'flat' | 'sharp'
/** the player's pick: a rung 0–6 and, where a rung has two, a side */
export type PentatonicView = Readonly<{ rung: number; side: PentatonicSide }>
/** one pentatonic on a key's ladder; name: its root and "m", with glyphs ("E♭m") */
export type PentatonicRung = Readonly<{ rung: number; side: PentatonicSide | null; root: Spelled; name: string; shared: number }>

const MINOR_PENT = pitchClasses(SCALES['minor pentatonic'][0])

const entry = (rung: number, side: PentatonicSide | null, walked: Spelled, scale: ReadonlySet<number>): PentatonicRung => {
  const root = simplifyRoot(walked, 'aeolian')
  return { rung, side, root, name: glyphs(`${rootName(root)}m`), shared: sharedCount(MINOR_PENT, pcOf(root), scale) }
}

/** a key's ladder from its home (written for the part): Home, then 1♭, 1♯ … 5♭, 5♯, then 6 (both walks meet: the ♭ walk's) */
export function pentatonicLadder(home: Spelled): readonly PentatonicRung[] {
  const scale = pitchClasses(SCALES.aeolian[0], pcOf(home))
  const out: PentatonicRung[] = [entry(0, null, home, scale)]
  let flat = home
  let sharp = home
  for (let rung = 1; rung <= 5; rung++) {
    flat = shiftBy(flat, -4, -7) // a fifth down
    sharp = shiftBy(sharp, 4, 7) // a fifth up
    out.push(entry(rung, 'flat', flat, scale), entry(rung, 'sharp', sharp, scale))
  }
  out.push(entry(6, null, shiftBy(flat, -4, -7), scale))
  return out
}

/** the pentatonic at a view's rung and side (the side ignored at 0 and 6) */
export function pentatonicAt(ladder: readonly PentatonicRung[], view: PentatonicView): PentatonicRung {
  const found = ladder.find((r) => r.rung === view.rung && (r.side === null || r.side === view.side))
  if (!found) throw new Error(`no pentatonic at rung ${view.rung}`)
  return found
}

export const isPentatonicView = (v: unknown): v is PentatonicView =>
  typeof v === 'object' && v !== null && Number.isInteger((v as PentatonicView).rung) && (v as PentatonicView).rung >= 0 && (v as PentatonicView).rung <= 6 && ((v as PentatonicView).side === 'flat' || (v as PentatonicView).side === 'sharp')
```

Add to `engine/src/index.ts`, beside the other `export * from` lines: `export * from './pentatonics'`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts`
Expected: PASS (7 tests). If the E major / A♭ major spelling test fails, print `names('C#')` and compare against the spec's §Spelling before changing either.

- [ ] **Step 5: Update the API snapshot and run the engine suite**

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__/api.test.ts.snap`
Expected: only the new names added (`isPentatonicView`, `pentatonicAt`, `pentatonicLadder`).
Run: `make test` from the repo root. Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add engine/src/pentatonics.ts engine/src/index.ts engine/src/__tests__/pentatonics.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Engine: pentatonic tension ladders from scale formulas (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pentatonics in the Changes model

**Files:**
- Modify: `engine/src/changes.ts` (types near lines 22–55, `buildChanges` at line 133, `changesLinesPerPage` at line 112; add `showPentatonics`)
- Test: `engine/src/__tests__/changes.test.ts`
- Modify (fixtures that build `ChangesChord` literals): `web/test/ChangesSystem.test.ts`, `web/test/changesDrawing.test.ts`

**Interfaces:**
- Consumes: `pentatonicLadder`, `pentatonicAt`, `PentatonicView`, `PentatonicRung` (Task 2).
- Produces:
  ```ts
  export type ChangesPentatonic = Readonly<{ label: string; key: string; ladder: readonly PentatonicRung[] }> // label "Gm♪"; key "B♭ major" (written)
  // ChangesChord gains: pentatonic: ChangesPentatonic | null
  export function buildChanges(doc, part, barsPerLine = 4, signatures = false, line: SheetLine = 'off', view: ScaleView = STANDARD, pentatonic: PentatonicView | null = null): ChangesSheet
  export function showPentatonics(lines: readonly ChangesLine[]): readonly ChangesLine[]
  export function changesLinesPerPage(line: SheetLine, rows: Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean }>): number
  ```
  `buildChanges` gives **every** chord in a key area its `pentatonic` (or `null` with no view / no key). `showPentatonics` then sets `label: ''` except on a line's first labelled chord and where the label differs from the last one shown on that line (a chord with `null` resets nothing).

- [ ] **Step 1: Write the failing tests** (append inside `describe('the Changes sheet', …)` in `engine/src/__tests__/changes.test.ts`; add `breakLines` and `showPentatonics` to its import from `'../changes'`)

```ts
  const pents = (sheet: ChangesSheet) => sheet.lines.map((l) => l.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label ?? '')).filter(Boolean))

  it('names each key area’s pentatonic at a rung and side, only where the area changes or a line starts', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | Cmaj7\nA | 4 | Cmaj7\nA | 5 | F#m7b5\nA | 6 | B7\nA | 7 | Em7\nA | 8 | Em7\n@key A 5 Em').value
    const sheet = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, { rung: 2, side: 'flat' }).lines)
    expect(pents({ lines: sheet, beats: 4, diagnostics: [] })).toEqual([['Gm♪'], ['Dm♪']]) // C major ♭2 Gm; E minor (home Em) ♭2 Dm
  })

  it('writes the ladder for the part: a B♭ part over concert C major reads D major’s', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7').value
    const [chord] = buildChanges(doc, TENOR, 4, false, 'off', undefined, { rung: 0, side: 'flat' }).lines[0]?.bars[0]?.chords ?? []
    expect([chord?.pentatonic?.label, chord?.pentatonic?.key, chord?.pentatonic?.ladder.length]).toEqual(['Bm♪', 'D major', 12])
  })

  it('does not repeat the label across relative keys, but each chord keeps its own area’s key', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Am7\n@key A 2 Am').value
    const lines = showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, { rung: 0, side: 'flat' }).lines)
    const chords = lines[0]?.bars.flatMap((b) => b.chords) ?? []
    expect(chords.map((c) => c.pentatonic?.label ?? '')).toEqual(['Am♪', '']) // printed once: the same home
    expect(chords.map((c) => c.pentatonic?.key)).toEqual(['C major', 'A minor'])
  })

  it('labels the first chord of a line the app breaks off', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | C\nA | 2 | F\nA | 3 | G\nA | 4 | C').value
    const built = buildChanges(doc, CONCERT, 4, false, 'off', undefined, { rung: 1, side: 'sharp' })
    const lines = showPentatonics(breakLines(built.lines, new Set(['A 3'])))
    expect(pents({ lines, beats: 4, diagnostics: [] })).toEqual([['Em♪'], ['Em♪']])
  })

  it('has no pentatonics with no view, and none where the analysis finds no key', () => {
    expect(bars('autumn-leaves').flatMap((b) => b.chords).every((c) => c.pentatonic === null)).toBe(true)
    const doc = parseChart('title: T\nA | 1 | N.C.').value
    expect(buildChanges(doc, CONCERT, 4, false, 'off', undefined, { rung: 0, side: 'flat' }).lines.flatMap((l) => l.bars.flatMap((b) => b.chords)).every((c) => c.pentatonic === null)).toBe(true)
  })
```

And extend the existing lines-per-page test (around line 314) with a new test:

```ts
  it('counts the pentatonic row as a row: 7 with a line and every row off, else 6; 8 with no line', () => {
    expect(changesLinesPerPage('third', { numerals: false, scales: false, pentatonics: true })).toBe(6)
    expect(changesLinesPerPage('third', { numerals: false, scales: false, pentatonics: false })).toBe(7)
    expect(changesLinesPerPage('off', { numerals: true, scales: true, pentatonics: true })).toBe(8)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: FAIL: `showPentatonics` is not exported; `pentatonic` undefined.

- [ ] **Step 3: Implement**

In `engine/src/changes.ts`:

1. Imports: add `import { pentatonicAt, pentatonicLadder, type PentatonicRung, type PentatonicView } from './pentatonics'` and `shiftBy` to the `./pitch` import.
2. Above `ChangesChord`, add:
   ```ts
   /** a chord's key-area pentatonic at the player's rung (issue #255): the label, the area's key and its whole ladder, written for the part */
   export type ChangesPentatonic = Readonly<{ label: string; key: string; ladder: readonly PentatonicRung[] }>
   ```
3. In `ChangesChord`, after `guide: string`, add:
   ```ts
   /** its key area's pentatonic at the sheet's rung; null with the row off or no key. showPentatonics keeps it only where it's new */
   pentatonic: ChangesPentatonic | null
   ```
4. Below `keyName`, add:
   ```ts
   /** a key area's ladder, written for the part: home is its tonic minor (a major key's relative minor) */
   function areaLadder(name: string, part: Part): readonly PentatonicRung[] | null {
     const root = /^[A-G][b#]?/.exec(name)?.[0]
     if (!root) return null
     const tonic = parseRoot(root)
     const home = / minor$/.test(name) ? tonic : shiftBy(tonic, 5, 9) // a major 6th up: the relative minor
     return pentatonicLadder(writtenRoot(part, home, 'aeolian'))
   }
   ```
5. `buildChanges` signature: add `pentatonic: PentatonicView | null = null` as the last parameter. Before `let lastKey = ''`, add:
   ```ts
   const ladders = new Map<string, readonly PentatonicRung[] | null>()
   const pentatonicOf = (name: string | undefined): ChangesPentatonic | null => {
     if (!pentatonic || !name) return null
     if (!ladders.has(name)) ladders.set(name, areaLadder(name, part))
     const ladder = ladders.get(name)
     return ladder ? { label: `${pentatonicAt(ladder, pentatonic).name}♪`, key: keyName(name, part), ladder } : null
   }
   ```
   In the chord object literal, after `guide: …`, add `pentatonic: pentatonicOf(a?.key.name),`.
6. After `breakLines`, add:
   ```ts
   /**
    * the pentatonic row as printed (#255), run after breakLines: a chord's label stays on a line's first labelled chord
    * and wherever it differs from the last one shown on the line (relative keys share a home: shown once); elsewhere
    * its label is '' (not printed), its key and ladder kept for nothing but the model's completeness
    */
   export function showPentatonics(lines: readonly ChangesLine[]): readonly ChangesLine[] {
     return lines.map((line): ChangesLine => {
       let last: string | null = null // the label last shown on this line
       const bars = line.bars.map((bar): ChangesBar => ({
         ...bar,
         chords: bar.chords.map((c): ChangesChord => {
           if (!c.pentatonic) return c
           const shown = c.pentatonic.label !== last
           last = c.pentatonic.label
           return shown ? c : { ...c, pentatonic: { ...c.pentatonic, label: '' } }
         }),
       }))
       return { ...line, bars }
     })
   }
   ```
   Update the `ChangesChord.pentatonic` doc comment: "`label: ''` where showPentatonics leaves it unprinted".
7. `changesLinesPerPage`: change the signature's rows type to `Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean }>` and the last line to `return 6 + (!rows.numerals && !rows.scales && !rows.pentatonics ? 1 : 0)`; add "or pentatonics" to its doc comment.

- [ ] **Step 4: Fix fixtures that build `ChangesChord` literals**

Run: `grep -rn "guide," web/test/ChangesSystem.test.ts web/test/changesDrawing.test.ts`
In each `ChangesChord` literal (the `chord` helper in `web/test/ChangesSystem.test.ts` and any in `web/test/changesDrawing.test.ts`), add `pentatonic: null,` after `guide`. In `web/app/components/ChangesSystem.vue` lines 206 and 213 (the marker-only and slot marks), nothing yet: Task 6 adds the field to marks.

- [ ] **Step 5: Run to verify**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: PASS. Then `make test` from the root: all green (typecheck covers `web/` fixtures).

- [ ] **Step 6: Commit**

```bash
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts web/test/ChangesSystem.test.ts web/test/changesDrawing.test.ts
git commit -m "Changes model: each key area's pentatonic at the sheet's rung; showPentatonics (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Flag and preferences

**Files:**
- Modify: `web/app/composables/useFeature.ts:5` (the `Feature` union)
- Modify: `web/nuxt.config.ts:84-92` (features)
- Modify: `web/package.json:14` (`e2e` script env)
- Modify: `web/app/composables/usePreferences.ts` (`usePreferences` and `linkPreferences`)
- Test: `web/test/usePreferences.test.ts`

**Interfaces:**
- Produces: `usePreferences()` and `linkPreferences()` return `pentatonics: Ref<boolean>`, `pentRung: Ref<number>`, `pentSide: Ref<PentatonicSide>`; `useFeature('pentatonics')`.

- [ ] **Step 1: Write the failing tests** (in `web/test/usePreferences.test.ts`, inside `describe('usePreferences', …)`)

```ts
  it('keeps the pentatonic row off at Home, flat side, until chosen, and remembers the choice', async () => {
    const p = prefs()
    expect([p.pentatonics.value, p.pentRung.value, p.pentSide.value]).toEqual([false, 0, 'flat'])
    p.pentatonics.value = true
    p.pentRung.value = 4
    p.pentSide.value = 'sharp'
    await nextTick()
    expect([localStorage.getItem('csm-pentatonics'), localStorage.getItem('csm-pent-rung'), localStorage.getItem('csm-pent-side')]).toEqual(['on', '4', 'sharp'])
  })

  it('falls back from a stored rung or side it cannot read', () => {
    localStorage.setItem('csm-pent-rung', '9')
    localStorage.setItem('csm-pent-side', 'x')
    const p = prefs()
    expect([p.pentRung.value, p.pentSide.value]).toEqual([0, 'flat'])
  })

  it('keeps your own pentatonic choices when you open a share link', () => {
    localStorage.setItem('csm-pentatonics', 'on')
    localStorage.setItem('csm-pent-rung', '3')
    const p = linked({})
    expect([p.pentatonics.value, p.pentRung.value]).toEqual([true, 3])
  })
```

(If `linked({})` doesn't satisfy `ShareView`'s type, build the view the way the file's other `linked(…)` calls do.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/usePreferences.test.ts`
Expected: FAIL, `pentatonics` undefined.

- [ ] **Step 3: Implement**

`web/app/composables/usePreferences.ts`, in `usePreferences` after `arpeggio`:
```ts
  // the Changes sheet's pentatonic row (#255): off until turned on; its rung (0 Home … 6) and side
  const pentatonics = storedRef<boolean>('csm-pentatonics', (s) => s === 'on', false, (v) => (v ? 'on' : 'off'))
  const pentRung = storedRef<number>('csm-pent-rung', (s) => (/^[0-6]$/.test(s) ? Number(s) : undefined), 0)
  const pentSide = storedRef<PentatonicSide>('csm-pent-side', (s) => (s === 'flat' || s === 'sharp' ? s : undefined), 'flat')
```
Add `pentatonics, pentRung, pentSide` to its return object; add `type PentatonicSide` to the `@chord-scale-maker/engine` import. In `linkPreferences`'s return, add `pentatonics: own.pentatonics, pentRung: own.pentRung, pentSide: own.pentSide, // not in links: yours`.

`web/app/composables/useFeature.ts`: add `| 'pentatonics'` to `Feature`.

`web/nuxt.config.ts` features, after `functions`:
```ts
        pentatonics: false, // pentatonic tension ladders: the Changes sheet's Pentatonics row (docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md)
```

`web/package.json` `e2e` script: add `NUXT_PUBLIC_FEATURES_PENTATONICS=true ` before `nuxt build`.

- [ ] **Step 4: Run to verify**

Run: `cd web && npx vitest run test/usePreferences.test.ts` → PASS. Then `make test` → green.

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/usePreferences.ts web/app/composables/useFeature.ts web/nuxt.config.ts web/package.json web/test/usePreferences.test.ts
git commit -m "Pentatonics flag (off) and its three preferences (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Controls

**Files:**
- Create: `web/app/utils/pentatonics.ts` (rung labels)
- Modify: `web/app/components/PreviewControls.vue` (Analysis field ~lines 43–50; models ~line 122)
- Modify: `web/app/components/EditorView.vue` (~line 114: bind the new models)
- Test: `web/test/PreviewControls.test.ts` (create if absent; else add to it) and `web/test/pentatonics.test.ts`

**Interfaces:**
- Consumes: `pentatonics`, `pentRung`, `pentSide` refs (Task 4); `useFeature('pentatonics')`.
- Produces: `PreviewControls` models `v-model:pentatonics` (boolean), `v-model:pent-rung` (number), `v-model:pent-side` (`PentatonicSide`); `PENT_RUNGS: readonly { value: number; label: string }[]` and `PENT_SIDES` in `~/utils/pentatonics`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/test/pentatonics.test.ts
import { describe, expect, it } from 'vitest'
import { PENT_RUNGS, PENT_SIDES, sideShown } from '~/utils/pentatonics'

describe('pentatonic controls', () => {
  it('labels the rungs with their shared notes', () => {
    expect(PENT_RUNGS.map((r) => r.label)).toEqual(['Home · 5 shared', '1 · 5 shared', '2 · 4 shared', '3 · 3 shared', '4 · 2 shared', '5 · 1 shared', '6 · 0 shared (Outside)'])
    expect(PENT_SIDES.map((s) => s.label)).toEqual(['♭', '♯'])
  })

  it('shows the side only where a rung has two pentatonics', () => {
    expect([0, 1, 5, 6].map(sideShown)).toEqual([false, true, true, false])
  })
})
```

```ts
// web/test/PreviewControls.test.ts (new describe; reuse the file's mount helper if it exists)
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewControls from '~/components/PreviewControls.vue'

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PreviewControls, { props: { sheet: 'changes', instrument: 'concert', spell: 'key', intervals: true, keyStart: 'C', pentatonics: false, pentRung: 0, pentSide: 'flat', ...props } })

describe('the pentatonic controls', () => {
  afterEach(() => (useRuntimeConfig().public.features.pentatonics = false))

  it('hides the toggle with the flag off', async () => {
    const w = await mount()
    expect(w.text()).not.toContain('Pentatonics')
  })

  it('shows Rung, and Side away from Home and 6, once the row is on', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    expect((await mount()).find('[aria-label="Pentatonic rung"]').exists()).toBe(false)
    const home = await mount({ pentatonics: true, pentRung: 0 })
    expect(home.find('[aria-label="Pentatonic rung"]').exists()).toBe(true)
    expect(home.text()).not.toContain('♯')
    const two = await mount({ pentatonics: true, pentRung: 2 })
    expect(two.text()).toContain('♯')
  })

  it('keeps the toggle while editing, when Numerals and Scales hide', async () => {
    useRuntimeConfig().public.features.pentatonics = true
    const w = await mount({ lockLabels: true })
    expect(w.text()).toContain('Pentatonics')
    expect(w.text()).not.toContain('Numerals')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/pentatonics.test.ts test/PreviewControls.test.ts`
Expected: FAIL (module and toggle missing).

- [ ] **Step 3: Implement**

```ts
// web/app/utils/pentatonics.ts
import type { PentatonicSide } from '@chord-scale-maker/engine'

/** the Pentatonics row's controls (#255): rung 0–6 with the notes it shares with the key, and the side */
export const PENT_RUNGS = [
  { value: 0, label: 'Home · 5 shared' },
  { value: 1, label: '1 · 5 shared' },
  { value: 2, label: '2 · 4 shared' },
  { value: 3, label: '3 · 3 shared' },
  { value: 4, label: '4 · 2 shared' },
  { value: 5, label: '5 · 1 shared' },
  { value: 6, label: '6 · 0 shared (Outside)' },
] as const
export const PENT_SIDES: readonly { value: PentatonicSide; label: string; title: string }[] = [
  { value: 'flat', label: '♭', title: 'Round the circle of fifths toward the flats' },
  { value: 'sharp', label: '♯', title: 'Round the circle of fifths toward the sharps' },
]
/** Home and 6 have one pentatonic each: no side to choose */
export const sideShown = (rung: number): boolean => rung > 0 && rung < 6
export const rungLabel = (rung: number): string => PENT_RUNGS.find((r) => r.value === rung)?.label ?? ''
```

`web/app/components/PreviewControls.vue`: replace the Analysis field (`<UiField v-if="!lockLabels">` … `</UiField>`, ~lines 44–50) with:
```vue
            <UiField v-if="!lockLabels || pentatonicsOn">
              <UiLabel class="pl-3">Analysis</UiLabel>
              <div class="flex flex-col gap-2">
                <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
                  <template v-if="!lockLabels">
                    <ToggleButton v-model="numerals" title="Each chord's Roman numeral in its key">Numerals</ToggleButton>
                    <ToggleButton v-model="scaleNames" title="Each chord's scale, under its numeral">Scales</ToggleButton>
                  </template>
                  <ToggleButton v-if="pentatonicsOn" v-model="pentatonics" title="Each key area's minor pentatonic, at the rung you choose on its tension ladder">Pentatonics</ToggleButton>
                </div>
                <div v-if="pentatonicsOn && pentatonics" class="flex flex-wrap items-center gap-2">
                  <UiListbox v-model="pentRung" class="w-48" aria-label="Pentatonic rung">
                    <template #selected="{ value }"><UiListboxLabel>{{ rungLabel(value) }}</UiListboxLabel></template>
                    <UiListboxOption v-for="r in PENT_RUNGS" :key="r.value" :value="r.value"><UiListboxLabel>{{ r.label }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
                  <SegmentedControl v-if="sideShown(pentRung)" v-model="pentSide" legend="Side" name="pent-side" aria-label="Pentatonic side" :options="PENT_SIDES" />
                </div>
              </div>
            </UiField>
```
Script: add models and the flag:
```ts
import { PENT_RUNGS, PENT_SIDES, rungLabel, sideShown } from '~/utils/pentatonics'
import type { PentatonicSide } from '@chord-scale-maker/engine' // merge into the existing engine import
const pentatonics = defineModel<boolean>('pentatonics', { default: false })
const pentRung = defineModel<number>('pentRung', { default: 0 })
const pentSide = defineModel<PentatonicSide>('pentSide', { default: 'flat' })
const pentatonicsOn = useFeature('pentatonics')
```
If `SegmentedControl` doesn't pass `aria-label` through to its group, rely on its `legend="Side"` and use `getByRole('radio', { name: '♯' })` in tests instead of the aria-label (check `SegmentedControl.vue`'s props first).

`web/app/components/EditorView.vue` (beside `v-model:scale-names="prefs.scaleNames.value"`, ~line 115):
```vue
            v-model:pentatonics="prefs.pentatonics.value"
            v-model:pent-rung="prefs.pentRung.value"
            v-model:pent-side="prefs.pentSide.value"
```

- [ ] **Step 4: Run to verify**

Run: `cd web && npx vitest run test/pentatonics.test.ts test/PreviewControls.test.ts` → PASS. `make test` → green; `make lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/pentatonics.ts web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/test/pentatonics.test.ts web/test/PreviewControls.test.ts
git commit -m "Changes controls: Pentatonics toggle with Rung and Side (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The label row and the ladder popover

**Files:**
- Create: `web/app/components/PentatonicLadder.vue`
- Modify: `web/app/components/ChangesSystem.vue` (marks ~205–213; a row after the scales row ~line 135; props; emits)
- Modify: `web/app/components/ChangesSheet.vue` (props, `built`, `sheet`, `linesPerPage`, pass-through emit)
- Modify: `web/app/components/EditorView.vue` (~line 180: the `ChangesSheet` binding)
- Test: `web/test/PentatonicLadder.test.ts`, `web/test/ChangesSheet.test.ts`

**Interfaces:**
- Consumes: `ChangesChord.pentatonic: ChangesPentatonic | null` (`label === ''` means not printed), `showPentatonics`, `changesLinesPerPage(…, { pentatonics })` (Task 3); `PentatonicView`, `PentatonicRung` (Task 2); prefs (Task 4).
- Produces: `PentatonicLadder` props `{ label: string; keyName: string; ladder: readonly PentatonicRung[]; current: PentatonicView }`, emit `pick: [view: PentatonicView]`. `ChangesSystem` prop `pentatonic?: PentatonicView | null`, emit `pentatonic: [view: PentatonicView]`. `ChangesSheet` prop `pentatonic?: PentatonicView | null`, emit `pentatonic: [view: PentatonicView]`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/test/PentatonicLadder.test.ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import PentatonicLadder from '~/components/PentatonicLadder.vue'
import { parseRoot, pentatonicLadder } from '@chord-scale-maker/engine'

const props = { label: 'Gm♪', keyName: 'C major', ladder: pentatonicLadder(parseRoot('A')), current: { rung: 2, side: 'flat' as const } }

describe('the pentatonic ladder popover', () => {
  it('is a button naming the pentatonic, its shared notes and the key', async () => {
    const w = await mountSuspended(PentatonicLadder, { props })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: Gm, 4 of 5 notes in C major. Show the ladder')
    expect(w.find('button').text()).toBe('Gm♪')
  })

  it('lists all 12 by rung, marks the current one, and picks another', async () => {
    const w = await mountSuspended(PentatonicLadder, { props, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    const picks = w.findAll('[data-pent]')
    expect(picks).toHaveLength(12)
    expect(w.find('[aria-current="true"]').text()).toBe('Gm')
    await picks.find((p) => p.text() === 'F♯m')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual([{ rung: 3, side: 'sharp' }])
    w.unmount()
  })
})
```

```ts
// web/test/ChangesSheet.test.ts: add (reuse the file's existing mount helper and chart; match its props)
  it('prints the pentatonic row where the key area changes, and passes a pick up', async () => {
    const w = await mountSheet({ pentatonic: { rung: 2, side: 'flat' } }) // the file's helper, with this prop added
    const labels = w.findAll('[data-slot="pentatonic"] button').map((b) => b.text())
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every((l) => /^[A-G][♭♯]?m♪$/.test(l))).toBe(true)
  })

  it('has no pentatonic row without a view', async () => {
    const w = await mountSheet({})
    expect(w.find('[data-slot="pentatonic"]').exists()).toBe(false)
  })
```

(`mountSheet` is the file's helper, `web/test/ChangesSheet.test.ts:11`: add `pentatonic?: PentatonicView | null` to its `over` type and import `type PentatonicView` from the engine. Its chart is `key: Bb`, Cm7 F7.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run test/PentatonicLadder.test.ts test/ChangesSheet.test.ts`
Expected: FAIL (component missing; no row).

- [ ] **Step 3: Implement `PentatonicLadder.vue`**

```vue
<template>
  <!-- a key area's pentatonic on the Changes sheet (#255); a click opens its tension ladder: pick another rung -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :aria-label="`Pentatonic: ${current_.name}, ${current_.shared} of 5 notes in ${keyName}. Show the ladder`"
      class="block cursor-pointer rounded-sm text-left underline decoration-note-500/60 decoration-dotted underline-offset-[3px] hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:decoration-note-300/60 dark:hover:bg-white/5 print:no-underline"
    >{{ label }}</HPopoverButton>
    <HPopoverPanel v-slot="{ close }" role="dialog" :aria-label="`${keyName} ladder`" class="absolute top-full left-0 z-20 mt-2 w-64 rounded-paper bg-raised p-1.5 text-sm shadow-raised max-sm:w-[calc(100vw-2rem)] print:hidden">
      <p class="px-2 pt-1 pb-2 text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">{{ keyName }} ladder</p>
      <ul>
        <li v-for="r in rungs" :key="r.rung" class="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1 px-2 py-1">
          <span class="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{{ r.rung === 0 ? 'Home' : r.rung === 6 ? '6 Outside' : r.rung }} · {{ r.shared }}</span>
          <button
            v-for="p in r.picks"
            :key="p.name"
            type="button"
            data-pent
            :aria-current="isCurrent(p) ? 'true' : undefined"
            :class="['rounded-control px-2 py-0.5 text-left font-display font-semibold text-zinc-900 hover:bg-note-50 dark:text-white dark:hover:bg-white/5', isCurrent(p) && 'bg-note-100 text-note-800 dark:bg-note-300/15 dark:text-note-200', r.picks.length === 1 && 'col-span-2']"
            @click="pick(p, close)"
          >{{ p.name }}</button>
        </li>
      </ul>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { pentatonicAt, type PentatonicRung, type PentatonicView } from '@chord-scale-maker/engine'

/** a Changes label and its key area's ladder: one row a rung (Home first), ♭ side then ♯ side; a pick sets the sheet's rung */
const props = defineProps<{ label: string; keyName: string; ladder: readonly PentatonicRung[]; current: PentatonicView }>()
const emit = defineEmits<{ pick: [view: PentatonicView] }>()
const current_ = computed(() => pentatonicAt(props.ladder, props.current))
const rungs = computed(() => [0, 1, 2, 3, 4, 5, 6].map((rung) => {
  const picks = props.ladder.filter((p) => p.rung === rung)
  return { rung, shared: picks[0]?.shared ?? 0, picks }
}))
const isCurrent = (p: PentatonicRung): boolean => p.name === current_.value.name
function pick(p: PentatonicRung, close: () => void): void {
  emit('pick', { rung: p.rung, side: p.side ?? props.current.side })
  close()
}
</script>
```

- [ ] **Step 4: Implement the row in `ChangesSystem.vue`**

1. Props: add `pentatonic?: PentatonicView | null // the Pentatonics row's rung and side; null/undefined: no row`; emits: add `pentatonic: [view: PentatonicView]`. Import `type ChangesPentatonic, type PentatonicView` from the engine.
2. Marks (line 205): add `pentatonic: c.pentatonic` to each chord mark; in the marker-only (line 206) and slot (line 213) marks add `pentatonic: null`.
3. In the script, after `marks`:
```ts
/** the marks that print a pentatonic label (#255) */
const pentatonicMarks = computed(() => marks.value.flatMap((m) => (m.pentatonic?.label ? [{ key: m.key, x: m.x, room: m.room, p: m.pentatonic }] : [])))
```
4. After the scales row's closing `</div>` (~line 135), add:
```vue
    <!-- the key area's pentatonic at the sheet's rung (#255): where the area changes and at the line's start -->
    <div v-if="pentatonic" data-slot="pentatonic" class="relative h-5 print:h-3">
      <span
        v-for="m in pentatonicMarks"
        :key="`p${m.key}`"
        class="absolute text-[0.7rem]/3.5 text-zinc-600 dark:text-zinc-400 print:text-[0.6rem]/3 print:text-neutral-700"
        :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }"
      >
        <span class="hidden print:inline">{{ m.p.label }}</span>
        <PentatonicLadder class="print:hidden" :label="m.p.label" :key-name="m.p.key" :ladder="m.p.ladder" :current="pentatonic" @pick="emit('pentatonic', $event)" />
      </span>
    </div>
```

- [ ] **Step 5: Wire `ChangesSheet.vue` and `EditorView.vue`**

`ChangesSheet.vue`:
- Props: `pentatonic?: PentatonicView | null // the Pentatonics row's rung and side; null: off`. Emits: `pentatonic: [view: PentatonicView]`.
- Import `showPentatonics, type PentatonicView` from the engine.
- `built`: `buildChanges(props.doc, props.part, barsPerLine.value, props.signatures, line.value, props.view, props.pentatonic ?? null)`.
- `sheet`: `({ ...built.value, lines: showPentatonics(breakLines(built.value.lines, breaks.value)) })`.
- `linesPerPage`: pass `pentatonics: !!props.pentatonic`.
- On `<ChangesSystem>`: `:pentatonic="pentatonic"` and `@pentatonic="emit('pentatonic', $event)"`.

`EditorView.vue` at the `ChangesSheet` binding (~line 182):
```vue
            :pentatonic="pentatonicsOn && prefs.pentatonics.value ? { rung: prefs.pentRung.value, side: prefs.pentSide.value } : null"
            @pentatonic="(v) => { prefs.pentRung.value = v.rung; prefs.pentSide.value = v.side }"
```
and in its script `const pentatonicsOn = useFeature('pentatonics')`.

- [ ] **Step 6: Run to verify**

Run: `cd web && npx vitest run test/PentatonicLadder.test.ts test/ChangesSheet.test.ts test/ChangesSystem.test.ts` → PASS. `make test` → green; `make lint` → clean.

- [ ] **Step 7: Commit**

```bash
git add web/app/components/PentatonicLadder.vue web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/app/components/EditorView.vue web/test/PentatonicLadder.test.ts web/test/ChangesSheet.test.ts
git commit -m "Changes sheet: the Pentatonics row and its ladder popover (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser tests, print, docs, follow-ups

**Files:**
- Create: `web/e2e/pentatonics.spec.ts`
- Modify: `web/e2e/print.spec.ts` (a worst-case test)
- Modify: `docs/design.md` (a new subsection after "7th chord arpeggios on Changes", ~line 465)
- Modify: `docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md` (the signatures as built)

- [ ] **Step 1: Write the e2e tests**

```ts
// web/e2e/pentatonics.spec.ts
import { chooseSheet, expect, inControls, test } from './fixtures'
import type { Page } from '@playwright/test'

async function showPentatonics(page: Page): Promise<void> {
  await inControls(page, async () => {
    const toggle = page.getByRole('button', { name: 'Pentatonics', exact: true })
    await expect(async () => {
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click({ timeout: 1000 })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    }).toPass({ timeout: 10_000 })
  })
}
const labels = (page: Page) => page.locator('[data-slot="pentatonic"] button')

test('the Pentatonics row names each key area’s pentatonic, and the ladder changes the rung', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await expect(labels(page).first()).toHaveText('Gm♪') // G minor, Home
  await labels(page).first().click()
  const ladder = page.getByRole('dialog', { name: 'G minor ladder' })
  await ladder.getByRole('button', { name: 'Fm', exact: true }).click() // rung 2, ♭ side
  await expect(labels(page).first()).toHaveText('Fm♪')
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toContainText('2 · 4 shared')
})

test('the row survives a reload, and a B♭ part writes it a tone up', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await page.reload()
  await expect(labels(page).first()).toHaveText('Gm♪')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the toggle is in the Controls dialog', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    await showPentatonics(page)
    await expect(labels(page).first()).toBeVisible()
  })
})
```

Before running, check: Autumn Leaves' first key area is G minor (`changes.test.ts:27` says so) — Home is Gm, ♭2 is Fm (Gm → Cm → Fm). For the second test's B♭ part, add `await chooseInstrument(page, 'Tenor Sax')` (import it) and expect `Am♪` (concert G minor → written A minor), and rename the test to match what it checks.

- [ ] **Step 2: Add the print worst case** (in `web/e2e/print.spec.ts`, after the 7th chord line test, reusing its helpers)

```ts
// the Pentatonics row adds a row under Numerals and Scales: with a guide tone line on the tuba it's the tallest case
test('prints the Changes with a guide tone line and the Pentatonics row, a sheet page to a letter page', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseInstrument(page, 'Tuba')
  await showGuides(page, 'From 7th')
  await page.getByRole('button', { name: 'Pentatonics', exact: true }).click()
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  await guidesDrawn(page)
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Chart', exact: true })).toBeHidden()
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})

test('prints the Changes eight lines a page with Numerals, Scales and Pentatonics and no line', async ({ page }) => {
  await page.goto('/song/stardust')
  await chooseSheet(page, 'Changes')
  await page.getByRole('button', { name: 'Pentatonics', exact: true }).click()
  await expect(page.locator('[data-slot="pentatonic"]').first()).toBeVisible()
  const svgs = page.locator('svg[aria-label^="Bars:"]')
  const sheetPages = await svgs.evaluateAll((els) => new Set(els.map((e) => e.closest('section'))).size)
  await page.emulateMedia({ media: 'print' })
  expect(pdfPages(await page.pdf({ format: 'Letter' }))).toBe(sheetPages)
})
```

- [ ] **Step 3: Run e2e**

Run: `make e2e`
Expected: all pass. **If the second print test fails** (8 lines + the row overflow a letter page), change `changesLinesPerPage`'s first line in `engine/src/changes.ts` to `if (line === 'off') return rows.pentatonics && rows.numerals && rows.scales ? 7 : 8`, update the Task 3 lines-per-page test's last expectation to `7`, add `expect(changesLinesPerPage('off', { numerals: true, scales: false, pentatonics: true })).toBe(8)`, rerun `make test` and `make e2e`, and update the spec's §Print to match.

- [ ] **Step 4: Golden check**

Run: `make golden && git status --short engine/fixtures`
Expected: no change to `engine/fixtures/golden.json` (it doesn't build Changes sheets). If it changed, read the diff before committing it.

- [ ] **Step 5: Docs**

`docs/design.md`, after the "7th chord arpeggios on Changes" subsection, add:
```markdown
### Pentatonics on Changes ([spec](superpowers/specs/2026-10-13-pentatonic-ladders-design.md); the `pentatonics` flag, off)

- **Ladder** (`engine/src/pentatonics.ts`): a key area's 12 minor pentatonics round the circle of fifths from home
  (its tonic minor: Am in C major), ranked by notes shared with the key's Aeolian: rung 0–6 share 5 5 4 3 2 1 0.
  Spelled by walking fifths (♯ side sharps, ♭ side flats; rung 6 the ♭ walk's), then `simplifyRoot(…, 'aeolian')`.
- **Model:** `buildChanges(…, pentatonic)` gives each chord its area's `pentatonic` ({ label, key, ladder }, written for
  the part); `showPentatonics` (after `breakLines`) blanks the label except on a line's first chord and where it
  changes. `changesLinesPerPage` counts the row.
- **UI:** a Pentatonics toggle in Analysis (it stays while editing), Rung (`Home · 5 shared` … `6 · 0 shared
  (Outside)`) and Side (♭ | ♯, hidden at 0 and 6) under it; `csm-pentatonics`, `csm-pent-rung`, `csm-pent-side`, not in
  share links. Each label is a `PentatonicLadder` popover: the area's ladder, a pick sets the sheet's rung and side.
```
In the spec, update §Engine to the built signatures: `pentatonicLadder(home: Spelled)`, `PentatonicRung.name`, `ChangesChord.pentatonic: ChangesPentatonic | null` (`{ label, key, ladder }`, `label: ''` where not printed), and `showPentatonics`.

- [ ] **Step 6: Full verification**

Run: `make test && make lint && make e2e`
Expected: all green; paste the pass counts into the PR body.

- [ ] **Step 7: Commit, then file the follow-ups**

```bash
git add web/e2e/pentatonics.spec.ts web/e2e/print.spec.ts docs/design.md docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md
# plus engine/src/changes.ts and engine/src/__tests__/changes.test.ts if Step 3 changed them
git commit -m "Pentatonics: browser and print tests, design notes (#255)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

File the four later phases as issues (each body links #255 and the spec's §Later phases):
```bash
gh issue create --label enhancement --title "Pentatonic ladders: section rungs and path presets" --body "Phase 2 of #255 (spec: docs/superpowers/specs/2026-10-13-pentatonic-ladders-design.md, Later phases 1). A rung per section (inside, climbing, outside, returning) and presets: side-slip home → outside → home, gradual by fifths, symmetric by minor or major thirds. Labels carry their shared count once it varies."
gh issue create --label enhancement --title "Pentatonic ladders: tension contour and tint by rung" --body "Phase 3 of #255 (spec Later phases 2). A thin line along each Changes line showing the arc across the bars; labels tinted by rung. Needs section rungs first."
gh issue create --label enhancement --title "Scales sheet: Tension practice preset" --body "From #255 (spec Later phases 3). Each distinct scale's pentatonic ladder as a practice highlight, ranked against the chord's scale (any scale; labelled by rank and shared count where the best match is under 5). Reuses engine/src/ladder.ts (rankTranspositions)."
gh issue create --label enhancement --title "One layers menu for the Changes sheet" --body "From #255 open question 3 (spec Later phases 4). If the Analysis group gets crowded: one menu for guide tones, pentatonics, approach notes (#251) and enclosures (#252)."
```

Open the PR (`Closes #255` only if the user agrees phase 1 closes it; otherwise `Part of #255`).
