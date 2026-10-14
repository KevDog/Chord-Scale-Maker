# Pentatonic Practice Preset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Pentatonic practice preset on the Scales sheet: a rank 1–12 picks, per staff, the minor pentatonic at that
rank against the staff's own scale, lights the scale notes it shares, and captions the staff with its name.

**Architecture:** Pure engine first: a fifths-ordered ranking in `ladder.ts`, the spelled ranking and per-staff pick in
`pentatonics.ts`, a new selection variant in `practice.ts`, `StaffModel.pentatonic` filled by `sheet.ts`. The web
side only draws: a toggle and rank listbox in `PracticePanel`, a caption in `ScaleStaff`, flag gating in
`EditorView`.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4 / Vue 3, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-14-pentatonic-practice-design.md`

## Global Constraints

- Engine stays free of Vue/DOM imports; pure functions, readonly types.
- Flag `pentatonics` (off by default; e2e builds with it on). Flag off: no Pentatonic preset, a stored or shared
  pentatonic selection is ignored.
- Selection shape: `{ preset: 'pentatonic', rank }`, rank an integer 1–12; a missing or bad rank reads as 1.
- Ranking: shared count (most first), then fewest fifths from the staff's written chord root, ♭ side first on equal
  distance; the tritone (6 fifths) is the ♭ walk.
- Pentatonic names: `simplifyRoot(walked, 'aeolian')`, `glyphs(rootName + 'm')` ("F♯m").
- Caption: `Dm pent`; where the staff's best shares fewer than 5: `F♯m pent · #2 · 3 shared`.
- Rank listbox: `aria-label="Pentatonic rank"`, options `1 · closest`, `2` … `11`, `12 · farthest`.
- Button label "Pentatonic". Both modes (From root, From X).
- Tests alongside each change; `make test`, `make lint`, `make e2e` green. Commits end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by name, never `git add -A`.

## Review Focus

1. Flag off with a pentatonic selection in storage or a share link → no highlight, no caption, no Pentatonic button
   (Task 5 test).
2. A staff whose chord can't be read (or an error staff) → no crash; ranking falls back to the scale's root; error
   staves have `pentatonic: null` (Task 4 test).
3. Scales that aren't 7 notes (whole tone, half-whole, blues) → 12 ranks, captions show rank and shared when best < 5
   (Task 2 test).
4. A transposing part (B♭ tenor) → the caption names the written pentatonic (Dm7 concert, written Em7 → `Em pent`), and the same scale degrees light as in concert (Task 4 test).
5. Editing a box while Pentatonic is on → a custom `{ keys }` selection seeded from what it lit (existing `litKeys`
   path; Task 5 test).

---

### Task 1: Fifths-ordered ranking in `ladder.ts`

**Files:**
- Modify: `engine/src/ladder.ts`
- Test: `engine/src/__tests__/ladder.test.ts`

**Interfaces:**
- Produces: `export type FifthsTransposition = Readonly<{ root: number; shared: number; fifths: number }>` (fifths:
  signed steps from refPc, + ♯ side, − ♭ side, −6 for the tritone); `export const fifthsFrom = (root: number, refPc:
  number): number`; `export function rankByFifths(shape: ReadonlySet<number>, scale: ReadonlySet<number>, refPc:
  number): readonly FifthsTransposition[]`.

- [ ] **Step 1: Write the failing tests** (append to `ladder.test.ts`; add `fifthsFrom, rankByFifths` to its import)

```ts
describe('ranking by fifths from a reference', () => {
  it('signs the fifths: ♯ side up to 5, ♭ side past it, the tritone ♭', () => {
    expect([0, 7, 2, 5, 10, 6, 11, 1].map((r) => fifthsFrom(r, 0))).toEqual([0, 1, 2, -1, -2, -6, 5, -5])
    expect(fifthsFrom(9, 2)).toBe(1) // A is one fifth above D
  })

  it('orders C major’s pentatonics from C: most shared, then fewest fifths', () => {
    const ranked = rankByFifths(MINOR_PENT, C_MAJOR, 0)
    expect(ranked.map((t) => t.root)).toEqual([2, 9, 4, 7, 11, 0, 6, 5, 1, 10, 8, 3]) // Dm Am Em, Gm Bm, Cm F♯m …
    expect(ranked.map((t) => t.shared)).toEqual([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0])
  })

  it('puts the ♭ side first on equal distance', () => {
    const all = new Set(Array.from({ length: 12 }, (_, i) => i)) // every root shares 5
    expect(rankByFifths(MINOR_PENT, all, 0).map((t) => t.fifths)).toEqual([0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6])
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd engine && npx vitest run src/__tests__/ladder.test.ts`
Expected: FAIL, `fifthsFrom` / `rankByFifths` not exported.

- [ ] **Step 3: Implement** (append to `ladder.ts`)

```ts
/** a transposition with its signed distance round the circle of fifths from a reference (+ ♯ side, − ♭ side, −6 the tritone) */
export type FifthsTransposition = Readonly<{ root: number; shared: number; fifths: number }>

/** the fifths from refPc to root: 1–5 up (♯ side), −1 … −6 down (♭ side, the tritone included) */
export const fifthsFrom = (root: number, refPc: number): number => {
  const d = mod(7 * (root - refPc), 12)
  return d < 6 ? d : d - 12
}

/** the shape on all 12 roots, most shared first; ties by fewest fifths from refPc, ♭ side first (#266) */
export function rankByFifths(shape: ReadonlySet<number>, scale: ReadonlySet<number>, refPc: number): readonly FifthsTransposition[] {
  return Array.from({ length: 12 }, (_, root) => ({ root, shared: sharedCount(shape, root, scale), fifths: fifthsFrom(root, refPc) })).sort(
    (a, b) => b.shared - a.shared || Math.abs(a.fifths) - Math.abs(b.fifths) || a.fifths - b.fifths,
  )
}
```

- [ ] **Step 4: Run to see it pass**

Run: `cd engine && npx vitest run src/__tests__/ladder.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/src/ladder.ts engine/src/__tests__/ladder.test.ts
git commit -m "Pentatonic practice: rank a ladder by fifths from a root (#266)"
```

---

### Task 2: Spelled ranking, per-staff pick and caption in `pentatonics.ts`

**Files:**
- Modify: `engine/src/pentatonics.ts`
- Test: `engine/src/__tests__/pentatonics.test.ts`

**Interfaces:**
- Consumes: `rankByFifths`, `pitchClasses` (Task 1 / `ladder.ts`); `shiftBy(n, steps, semis)`, `pcOf`, `rootName`,
  `glyphs` (`pitch.ts`); `simplifyRoot(n, 'aeolian')` (`scales.ts`).
- Produces:
  - `export const PENTATONIC_RANKS = 12`
  - `export type PentatonicRank = Readonly<{ rank: number; root: Spelled; name: string; shared: number }>`
  - `export function pentatonicRanking(scale: ReadonlySet<number>, chordRoot: Spelled): readonly PentatonicRank[]`
  - `export type StaffPentatonic = Readonly<{ name: string; rank: number; shared: number; best: number }>`
  - `export function pentatonicPick(pcs: readonly number[], chordRoot: Spelled, rank: number): Readonly<{ pentatonic: StaffPentatonic; lit: boolean[] }>`
    (pcs: the staff's notes' pitch classes in order; lit: per note)
  - `export const pentatonicCaption = (p: StaffPentatonic): string`

- [ ] **Step 1: Write the failing tests** (append; extend imports with `pentatonicCaption, pentatonicPick,
  pentatonicRanking, PENTATONIC_RANKS` from `../pentatonics`, `pitchClasses` from `../ladder`, `parseRoot` from
  `../pitch`, `SCALES` from `../scales` as needed)

```ts
describe('pentatonics ranked against any scale (#266)', () => {
  const on = (name: keyof typeof SCALES, root: string): ReadonlySet<number> => pitchClasses(SCALES[name][0]!, pcOf(parseRoot(root)))
  const names = (scale: ReadonlySet<number>, root: string): string[] => pentatonicRanking(scale, parseRoot(root)).map((p) => p.name)

  it('ranks the spec’s examples by fifths from the chord root', () => {
    expect(names(on('dorian', 'D'), 'D').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
    expect(names(on('ionian', 'C'), 'C').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
    expect(names(on('mixolydian', 'G'), 'G').slice(0, 3)).toEqual(['Dm', 'Am', 'Em'])
  })

  it('gives every scale 12 distinct pentatonics, ranks 1–12, shared never rising', () => {
    for (const name of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
      const ranked = pentatonicRanking(on(name, 'C'), parseRoot('C'))
      expect(ranked.map((p) => p.rank)).toEqual(Array.from({ length: PENTATONIC_RANKS }, (_, i) => i + 1))
      expect(new Set(ranked.map((p) => pcOf(p.root))).size).toBe(12)
      ranked.slice(1).forEach((p, i) => expect(p.shared).toBeLessThanOrEqual(ranked[i]!.shared))
    }
  })

  it('spells on the chord’s side and without double accidentals', () => {
    expect(names(on('dorian', 'Eb'), 'Eb')[0]).toBe('E♭m')
    expect(names(on('ionian', 'F#'), 'F#').every((n) => !/𝄪|𝄫/.test(n))).toBe(true)
  })

  it('picks a staff’s pentatonic and lights the notes it shares', () => {
    const pcs = [...on('dorian', 'D')].sort((a, b) => a - b) // C D E F G A B as pcs
    const top = pentatonicPick(pcs, parseRoot('D'), 1)
    expect(top.pentatonic).toEqual({ name: 'Dm', rank: 1, shared: 5, best: 5 })
    expect(top.lit.filter(Boolean)).toHaveLength(5)
    const far = pentatonicPick(pcs, parseRoot('D'), 12)
    expect(far.pentatonic.shared).toBe(0)
    expect(far.lit.every((l) => !l)).toBe(true)
  })

  it('reports a best match under 5 on scales a pentatonic can’t fit', () => {
    const wt = [...on('whole tone', 'C')]
    expect(pentatonicPick(wt, parseRoot('C'), 1).pentatonic.best).toBe(3)
    expect(pentatonicPick([...on('half whole diminished', 'C')], parseRoot('C'), 1).pentatonic.best).toBeLessThan(5)
  })

  it('captions by name, adding rank and shared count where the best is under 5', () => {
    expect(pentatonicCaption({ name: 'Dm', rank: 1, shared: 5, best: 5 })).toBe('Dm pent')
    expect(pentatonicCaption({ name: 'Gm', rank: 7, shared: 3, best: 5 })).toBe('Gm pent')
    expect(pentatonicCaption({ name: 'F♯m', rank: 2, shared: 3, best: 3 })).toBe('F♯m pent · #2 · 3 shared')
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts` → FAIL (missing exports).

- [ ] **Step 3: Implement** (add to `pentatonics.ts`; import `rankByFifths` beside `pitchClasses, sharedCount`)

```ts
/** the Scales sheet's Pentatonic practice preset (#266): ranks 1 (closest to the staff's scale) to 12 */
export const PENTATONIC_RANKS = 12
export type PentatonicRank = Readonly<{ rank: number; root: Spelled; name: string; shared: number }>

/** the chord root walked `fifths` round the circle (+ up, − down), spelled as the ladder spells */
const walkFifths = (from: Spelled, fifths: number): Spelled => {
  let n = from
  for (let i = 0; i < Math.abs(fifths); i++) n = fifths > 0 ? shiftBy(n, 4, 7) : shiftBy(n, -4, -7)
  return simplifyRoot(n, 'aeolian')
}

/** the 12 minor pentatonics against a scale (any), most shared first, ties by fewest fifths from the chord root, ♭ side first */
export function pentatonicRanking(scale: ReadonlySet<number>, chordRoot: Spelled): readonly PentatonicRank[] {
  return rankByFifths(MINOR_PENT, scale, pcOf(chordRoot)).map((t, i) => {
    const root = walkFifths(chordRoot, t.fifths)
    return { rank: i + 1, root, name: glyphs(`${rootName(root)}m`), shared: t.shared }
  })
}

/** a staff's pentatonic under the preset: best is rank 1's shared count */
export type StaffPentatonic = Readonly<{ name: string; rank: number; shared: number; best: number }>

/** the pentatonic at `rank` against a staff's notes (their pitch classes, in order), and which notes it lights */
export function pentatonicPick(pcs: readonly number[], chordRoot: Spelled, rank: number): Readonly<{ pentatonic: StaffPentatonic; lit: boolean[] }> {
  const ranked = pentatonicRanking(new Set(pcs), chordRoot)
  const at = ranked[Math.min(Math.max(rank, 1), PENTATONIC_RANKS) - 1]!
  const shape = pitchClasses(SCALES['minor pentatonic'][0]!, pcOf(at.root))
  return { pentatonic: { name: at.name, rank: at.rank, shared: at.shared, best: ranked[0]!.shared }, lit: pcs.map((pc) => shape.has(pc)) }
}

/** "Dm pent"; with the rank and shared count where no pentatonic fits the scale whole ("F♯m pent · #2 · 3 shared") */
export const pentatonicCaption = (p: StaffPentatonic): string => `${p.name} pent${p.best < 5 ? ` · #${p.rank} · ${p.shared} shared` : ''}`
```

If the file's existing `SCALES['minor pentatonic'][0]` use has no `!`, match it (the repo's `noUncheckedIndexedAccess`
setting decides; follow the line already at the top of the file).

- [ ] **Step 4: Run to see it pass**

Run: `cd engine && npx vitest run src/__tests__/pentatonics.test.ts` → PASS. If the whole-tone best is not 3 or the
example rows differ, recheck `rankByFifths`, not the test: the spec's table and whole tone's 3 are computed by hand
from the formulas (whole tone shares 3 with a pentatonic on an odd root, 2 on an even).

- [ ] **Step 5: Commit**

```bash
git add engine/src/pentatonics.ts engine/src/__tests__/pentatonics.test.ts
git commit -m "Pentatonic practice: rank pentatonics against any scale, pick and caption (#266)"
```

---

### Task 3: The selection variant in `practice.ts`

**Files:**
- Modify: `engine/src/practice.ts`
- Test: `engine/src/__tests__/practice.test.ts`, `engine/src/__tests__/share.test.ts`

**Interfaces:**
- Consumes: `PENTATONIC_RANKS` (Task 2).
- Produces: `Preset` gains `'pentatonic'`; `PracticeSelection = Readonly<{ preset: Exclude<Preset, 'pentatonic'> }> |
  Readonly<{ preset: 'pentatonic'; rank: number }> | Readonly<{ keys: readonly string[] }>`;
  `PRESETS = { root: ['chordTones', 'guideTones', 'tensions', 'pentatonic'], from: ['all', 'pentatonic'] }`;
  `PRESET_LABELS.pentatonic = 'Pentatonic'`; `export const isPentatonicSelection = (s: PracticeSelection | null): s is
  Readonly<{ preset: 'pentatonic'; rank: number }>`. `selectedNotes` lights nothing under a pentatonic selection
  (staves light it through `pentatonicPick`, Task 4).

- [ ] **Step 1: Write the failing tests** (append to `practice.test.ts`; import `isPentatonicSelection,
  practiceSelectionFrom, PRESETS` from `../practice`)

```ts
describe('the Pentatonic selection (#266)', () => {
  it('is offered in both modes, last', () => {
    expect(PRESETS.root.at(-1)).toBe('pentatonic')
    expect(PRESETS.from).toEqual(['all', 'pentatonic'])
  })

  it('reads from untrusted data with a rank 1–12; a missing or bad rank reads as 1', () => {
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 7 })).toEqual({ preset: 'pentatonic', rank: 7 })
    expect(practiceSelectionFrom({ preset: 'pentatonic' })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 13 })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'pentatonic', rank: 2.5 })).toEqual({ preset: 'pentatonic', rank: 1 })
    expect(practiceSelectionFrom({ preset: 'guideTones', rank: 3 })).toEqual({ preset: 'guideTones' })
  })

  it('is told apart from the other selections', () => {
    expect(isPentatonicSelection({ preset: 'pentatonic', rank: 2 })).toBe(true)
    expect(isPentatonicSelection({ preset: 'all' })).toBe(false)
    expect(isPentatonicSelection({ keys: ['1'] })).toBe(false)
    expect(isPentatonicSelection(null)).toBe(false)
  })
})
```

In `share.test.ts`, beside the existing practice round-trip test, add:

```ts
it('carries a Pentatonic practice selection', () => {
  const link = encodeShare({ ...BASE, practice: { preset: 'pentatonic', rank: 4 } })
  expect(decodeShare(link)?.practice).toEqual({ preset: 'pentatonic', rank: 4 })
})
```

Match the file's own encode/decode helper names and base fixture (read the existing practice test there first and
copy its shape; `BASE`, `encodeShare`, `decodeShare` above stand for whatever it uses).

- [ ] **Step 2: Run to see it fail**

Run: `cd engine && npx vitest run src/__tests__/practice.test.ts src/__tests__/share.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `practice.ts`

```ts
import { PENTATONIC_RANKS } from './pentatonics'

export type Preset = 'chordTones' | 'guideTones' | 'tensions' | 'all' | 'pentatonic'
/** a preset, or explicit keys; keys are relative to the mode's reference, so they survive instrument changes. Pentatonic: a rank 1–12 on each staff's ladder (#266) */
export type PracticeSelection =
  | Readonly<{ preset: Exclude<Preset, 'pentatonic'> }>
  | Readonly<{ preset: 'pentatonic'; rank: number }>
  | Readonly<{ keys: readonly string[] }>

export const isPentatonicSelection = (s: PracticeSelection | null): s is Readonly<{ preset: 'pentatonic'; rank: number }> =>
  s !== null && 'preset' in s && s.preset === 'pentatonic'

const rankFrom = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= PENTATONIC_RANKS ? (v as number) : 1)

export function practiceSelectionFrom(v: unknown): PracticeSelection | null {
  if (!v || typeof v !== 'object') return null
  if ('preset' in v && v.preset === 'pentatonic') return { preset: 'pentatonic', rank: rankFrom('rank' in v ? v.rank : undefined) }
  if ('preset' in v && typeof v.preset === 'string' && Object.values(PRESETS).flat().includes(v.preset as Preset)) return { preset: v.preset as Exclude<Preset, 'pentatonic'> }
  // … keys branch unchanged
}

export const PRESETS = { root: ['chordTones', 'guideTones', 'tensions', 'pentatonic'], from: ['all', 'pentatonic'] } // keep the Readonly<Record<Mode, readonly Preset[]>> annotation
// PRESET_LABELS: add  pentatonic: 'Pentatonic',
```

`presetKeys` takes `Exclude<Preset, 'pentatonic'>`. In `selectedNotes`:

```ts
/** per note of one staff: is it selected? (a Pentatonic selection lights per staff, in buildSheet: here, nothing) */
export function selectedNotes(selection: PracticeSelection, chord: string, keys: readonly string[]): boolean[] {
  if (isPentatonicSelection(selection)) return keys.map(() => false)
  const lit = 'preset' in selection ? presetKeys(selection.preset, chord, keys) : new Set(selection.keys)
  return keys.map((k) => lit.has(k))
}
```

Check `pentatonics.ts` does not import `practice.ts` (it doesn't today), so no cycle.

- [ ] **Step 4: Run to see it pass**

Run: `cd engine && npx vitest run src/__tests__/practice.test.ts src/__tests__/share.test.ts` → PASS. Then
`cd engine && npx tsc --noEmit -p .` → no errors.

- [ ] **Step 5: Commit**

```bash
git add engine/src/practice.ts engine/src/__tests__/practice.test.ts engine/src/__tests__/share.test.ts
git commit -m "Pentatonic practice: the selection, stored and shared with its rank (#266)"
```

---

### Task 4: `StaffModel.pentatonic` in `sheet.ts`, public API

**Files:**
- Modify: `engine/src/sheet.ts` (`StaffModel`, `practiceFor`, `staff`'s `none`)
- Modify: `engine/src/__tests__/__snapshots__/api.test.ts.snap` (regenerated)
- Test: `engine/src/__tests__/practice.test.ts`

**Interfaces:**
- Consumes: `pentatonicPick`, `StaffPentatonic` (Task 2); `isPentatonicSelection` (Task 3); `scaleLabel(part,
  scale).root` (`part.ts`); `writtenChordRootLenient(part, chord, scale)` (`chord.ts`).
- Produces: `StaffModel.pentatonic: StaffPentatonic | null` (null unless the selection is Pentatonic and the staff
  has notes).

- [ ] **Step 1: Write the failing tests** (append to `practice.test.ts`; uses its `row`, `staves`, `picked`, `TENOR`)

```ts
describe('the Pentatonic preset on the Scales sheet (#266)', () => {
  const pent = (rank: number): PracticeSelection => ({ preset: 'pentatonic', rank })

  it('lights each staff’s pentatonic at the rank and names it', () => {
    const [d, g] = staves([row('Dm7'), row('G7', '', '2')], 'root', pent(1))
    expect(d?.pentatonic).toEqual({ name: 'Dm', rank: 1, shared: 5, best: 5 })
    expect(picked([d!])[0]).toEqual(['D', 'F', 'G', 'A', 'C'])
    expect(g?.pentatonic?.name).toBe('Dm')
  })

  it('lights fewer notes farther down the ladder, in From X mode too', () => {
    const [far] = staves([row('Dm7')], 'from', pent(12))
    expect(far?.pentatonic?.shared).toBe(0)
    expect(far?.selected?.every((s) => !s)).toBe(true)
  })

  it('names the written pentatonic for a transposing part, lighting the same degrees', () => {
    const [concert] = staves([row('Dm7')], 'root', pent(1))
    const [tenor] = staves([row('Dm7')], 'root', pent(1), 'C', TENOR)
    expect(tenor?.pentatonic?.name).toBe('Em')
    expect(tenor?.selected).toEqual(concert?.selected)
  })

  it('is null under other selections and on staves that can’t be drawn', () => {
    expect(staves([row('Dm7')], 'root', { preset: 'guideTones' })[0]?.pentatonic).toBeNull()
    expect(staves([row('Dm7')], 'root')[0]?.pentatonic).toBeNull()
    expect(staves([row('Xq7')], 'root', pent(1))[0]?.pentatonic).toBeNull()
  })

  it('ranks from the scale’s root when the chord can’t be read', () => {
    const [s] = staves([row('Xq7', 'D Dorian')], 'root', pent(1))
    expect(s?.pentatonic?.name).toBe('Dm')
  })

  it('reports a best under 5 on a whole-tone staff', () => {
    expect(staves([row('C7#5', 'C Whole Tone')], 'root', pent(1))[0]?.pentatonic?.best).toBe(3)
  })
})
```

If `Xq7` with a written scale makes an error staff rather than a staff with notes (check `staff()`: a scale but an
unreadable chord), drop the last-but-one test's expectation to whatever `buildSheet` really gives (`pentatonic: null`
on an error staff) and note it in the commit message; don't change `staff()`'s error rules.

- [ ] **Step 2: Run to see it fail**

Run: `cd engine && npx vitest run src/__tests__/practice.test.ts` → FAIL (`pentatonic` undefined).

- [ ] **Step 3: Implement** in `sheet.ts`

- `StaffModel` gains, after `selected`:
  `pentatonic: StaffPentatonic | null // the Pentatonic preset's pick for this staff (#266); null otherwise`
- `none` (in `staff()`) gains `pentatonic: null`.
- `practiceFor` returns `Pick<StaffModel, 'keys' | 'selected' | 'pentatonic'>`:

```ts
  const reference = mode === 'from' ? startReference(startText) : orNull(() => writtenChordRootLenient(part, row.chord, scale))
  const keys = reference ? practiceKeys(reference, notes, mode === 'root' ? (resolveQuality(row.chord)?.quality ?? null) : null) : null
  if (isPentatonicSelection(practice)) {
    const chordRoot = orNull(() => writtenChordRootLenient(part, row.chord, scale)) ?? scaleLabel(part, scale).root
    const { pentatonic, lit } = pentatonicPick(notes.map((n) => pcOf(n)), chordRoot, practice.rank)
    return { keys, selected: keys ? lit : null, pentatonic }
  }
  return { keys, selected: practice && keys ? selectedNotes(practice, row.chord, keys) : null, pentatonic: null }
```

Import `isPentatonicSelection` from `./practice`, `pentatonicPick, type StaffPentatonic` from `./pentatonics`, `pcOf`
from `./pitch`, `scaleLabel` from `./part` (whichever aren't imported yet). `Pitched` extends `Spelled`, so `pcOf(n)`
takes a note.

- [ ] **Step 4: Run, update the API snapshot, run the engine suite**

```bash
cd engine && npx vitest run src/__tests__/practice.test.ts
cd engine && npx vitest run src/__tests__/api.test.ts -u   # new names: fifthsFrom, rankByFifths, PENTATONIC_RANKS, pentatonicRanking, pentatonicPick, pentatonicCaption, isPentatonicSelection
cd .. && make test
```

Expected: all PASS; the snapshot diff adds exactly those seven names. `make test` also runs the golden test: it
must pass unchanged (the fixture freezes no practice output); if it fails, stop and report the diff.

- [ ] **Step 5: Commit**

```bash
git add engine/src/sheet.ts engine/src/__tests__/practice.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Pentatonic practice: each staff ranks against its own scale (#266)"
```

---

### Task 5: `PracticePanel` toggle and rank listbox; flag gating in `EditorView`

**Files:**
- Modify: `web/app/components/PracticePanel.vue`
- Modify: `web/app/components/EditorView.vue` (the `selection` computed near line 398; the `<PracticePanel>` at
  ~line 158)
- Test: `web/test/PracticePanel.test.ts`, `web/test/EditorView.test.ts`

**Interfaces:**
- Consumes: `PRESETS`, `PRESET_LABELS`, `isPentatonicSelection`, `PENTATONIC_RANKS` (engine).
- Produces: `PracticePanel` prop `pentatonic?: boolean` (the flag; default false). Emits `{ preset: 'pentatonic',
  rank }`.

- [ ] **Step 1: Write the failing tests** (append to `PracticePanel.test.ts`)

```ts
describe('PracticePanel’s Pentatonic preset (#266)', () => {
  it('is offered only with the flag', async () => {
    expect((await mount({})).findAll('button').map((b) => b.text())).not.toContain('Pentatonic')
    expect((await mount({ pentatonic: true })).findAll('button').map((b) => b.text())).toEqual(['Chord tones', 'Guide tones', 'Tensions', 'Pentatonic', 'Clear'])
    expect((await mount({ pentatonic: true, mode: 'from', startText: 'Eb' })).findAll('button').map((b) => b.text())).toEqual(['All', 'Pentatonic', 'Clear'])
  })

  it('starts at rank 1 and shows the rank picker while on', async () => {
    const off = await mount({ pentatonic: true })
    expect(off.find('[aria-label="Pentatonic rank"]').exists()).toBe(false)
    await off.findAll('button').find((b) => b.text() === 'Pentatonic')?.trigger('click')
    expect(off.emitted('update:selection')).toEqual([[{ preset: 'pentatonic', rank: 1 }]])
    const on = await mount({ pentatonic: true, selection: { preset: 'pentatonic', rank: 12 }, lit: ['1'] })
    expect(on.find('[aria-label="Pentatonic rank"]').text()).toContain('12 · farthest')
    expect(on.find('button[aria-pressed=true]').text()).toBe('Pentatonic')
  })

  it('edits a box into a custom selection from what it lit', async () => {
    const w = await mount({ pentatonic: true, selection: { preset: 'pentatonic', rank: 1 }, lit: ['1', 'b3'] })
    await w.findAll('input[type=checkbox]')[3]?.trigger('change') // ♭7
    expect(w.emitted('update:selection')).toEqual([[{ keys: ['1', 'b3', 'b7'] }]])
  })
})
```

Picking a rank from the listbox goes through Headless UI; cover it in e2e (Task 7), not here.

In `EditorView.test.ts`, following how that file mounts the editor with feature flags and a `shared` practice
selection (read it first; reuse its helpers), add a test: with `pentatonics` off and `shared.practice = { preset:
'pentatonic', rank: 1 }` on the Scales sheet, the Practice panel shows no pressed button and no `Pentatonic` button.
If the file has no practice-on mount helper, put this case in `web/e2e` instead (Task 7) and say so in the commit.

- [ ] **Step 2: Run to see it fail**

Run: `cd web && npx vitest run test/PracticePanel.test.ts test/EditorView.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`PracticePanel.vue` template, the preset row:

```vue
    <div class="flex flex-wrap items-center gap-2">
      <ToggleButton v-for="p in presets" :key="p" :model-value="activePreset === p" @update:model-value="pickPreset(p)">{{ PRESET_LABELS[p] }}</ToggleButton>
      <UiButton plain :disabled="!selection" @click="emit('update:selection', null)">Clear</UiButton>
    </div>
    <UiListbox v-if="isPentatonicSelection(selection)" :model-value="selection.rank" class="w-44" aria-label="Pentatonic rank" @update:model-value="emit('update:selection', { preset: 'pentatonic', rank: $event })">
      <template #selected="{ value }"><UiListboxLabel>{{ rankLabel(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="r in RANKS" :key="r" :value="r"><UiListboxLabel>{{ rankLabel(r) }}</UiListboxLabel></UiListboxOption>
    </UiListbox>
```

Help text: after the mode sentence add
`<template v-if="pentatonic"> Pentatonic lights the notes each scale shares with a minor pentatonic: rank 1 the closest, 12 the farthest.</template>`.

Script:

```ts
import { compareKeys, isPentatonicSelection, type Mode, noteText, PENTATONIC_RANKS, type PracticeBox, type PracticeSelection, type Preset, PRESET_LABELS, PRESETS } from '@chord-scale-maker/engine'

const props = defineProps<{
  mode: Mode
  startText: string
  boxes: readonly PracticeBox[]
  selection: PracticeSelection | null
  lit: readonly string[]
  pentatonic?: boolean // the pentatonics flag: offer the Pentatonic preset (#266)
}>()

const presets = computed(() => PRESETS[props.mode].filter((p) => p !== 'pentatonic' || props.pentatonic))
const RANKS = Array.from({ length: PENTATONIC_RANKS }, (_, i) => i + 1)
const rankLabel = (r: number): string => (r === 1 ? '1 · closest' : r === PENTATONIC_RANKS ? `${r} · farthest` : String(r))

function pickPreset(p: Preset): void {
  if (activePreset.value === p) emit('update:selection', null)
  else emit('update:selection', p === 'pentatonic' ? { preset: 'pentatonic', rank: 1 } : { preset: p })
}
```

Update the component's doc comment to mention Pentatonic.

`EditorView.vue`:

```ts
/** a Pentatonic selection (stored or shared) plays only with the pentatonics flag (#266) */
const selection = computed(() => {
  const s = practiceOn ? practice.selection(mode.value) : null
  return isPentatonicSelection(s) && !pentatonicsOn ? null : s
})
```

and on `<PracticePanel …>` add `:pentatonic="pentatonicsOn"`. Import `isPentatonicSelection` with the other engine
names in that file.

- [ ] **Step 4: Run to see it pass**

Run: `cd web && npx vitest run test/PracticePanel.test.ts test/EditorView.test.ts` → PASS; then `make lint`.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/PracticePanel.vue web/app/components/EditorView.vue web/test/PracticePanel.test.ts web/test/EditorView.test.ts
git commit -m "Pentatonic practice: the preset and its rank in the Practice panel, behind the flag (#266)"
```

---

### Task 6: The staff caption in `ScaleStaff`

**Files:**
- Modify: `web/app/components/ScaleStaff.vue`
- Test: `web/test/ScaleStaff.test.ts`

**Interfaces:**
- Consumes: `StaffModel.pentatonic` (Task 4), `pentatonicCaption` (Task 2).

- [ ] **Step 1: Write the failing test** (append inside `describe('ScaleStaff')`)

```ts
  it('captions the staff with its pentatonic under the Pentatonic preset', async () => {
    const sheet = (scale: string, rank: number) =>
      buildSheet([{ section: 'A', bar: '1', chord: 'C7#5', scale }], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', rank })[0]?.pages.flat()[0]
    const fits = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12, { preset: 'pentatonic', rank: 1 })[0]?.pages.flat()[0], clef: 'treble' } })
    expect(fits.find('[data-slot="pentatonic"]').text()).toBe('Dm pent')
    const wt = await mountSuspended(ScaleStaff, { props: { staff: sheet('C Whole Tone', 2), clef: 'treble' } })
    expect(wt.find('[data-slot="pentatonic"]').text()).toMatch(/ pent · #2 · \d shared$/)
    const none = await mountSuspended(ScaleStaff, { props: { staff: buildSheet([row('Dm7', '1')], CONCERT, 'root', 'C', 12)[0]?.pages.flat()[0], clef: 'treble' } })
    expect(none.find('[data-slot="pentatonic"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run to see it fail**

Run: `cd web && npx vitest run test/ScaleStaff.test.ts` → FAIL.

- [ ] **Step 3: Implement**: in the left column, after the chords `<div>`:

```vue
      <div v-if="staff.pentatonic" data-slot="pentatonic" class="text-sm text-zinc-500 dark:text-zinc-400 print:text-neutral-600">{{ pentatonicCaption(staff.pentatonic) }}</div>
```

and import `pentatonicCaption` beside `glyphs`. The watch key needs nothing new: `selected` already
redraws, and the caption is template-reactive.

- [ ] **Step 4: Run to see it pass**

Run: `cd web && npx vitest run test/ScaleStaff.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/ScaleStaff.vue web/test/ScaleStaff.test.ts
git commit -m "Pentatonic practice: caption each staff with its pentatonic (#266)"
```

---

### Task 7: Browser test, print, docs

**Files:**
- Modify: `web/e2e/pentatonics.spec.ts`
- Modify: `docs/design.md` (§Practice selection)

- [ ] **Step 1: Write the e2e test** (append to `pentatonics.spec.ts`; add `pickOption` to its fixtures import)

```ts
test('the Pentatonic practice preset ranks each scale’s pentatonics, remembers the rank, and prints', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  const panel = page.locator('fieldset', { hasText: 'Practice' })
  await panel.getByRole('button', { name: 'Pentatonic' }).click()
  const captions = page.locator('[data-slot="pentatonic"]')
  await expect(captions).toHaveCount(14) // one per line
  await expect(captions.first()).toHaveText(/ pent/)
  const closest = await page.locator('.vf-selected').count()
  await pickOption(page, 'Pentatonic rank', '12 · farthest')
  await expect.poll(() => page.locator('.vf-selected').count()).toBeLessThan(closest)
  await page.reload()
  await chooseSheet(page, 'Scales')
  await expect(page.getByRole('button', { name: 'Pentatonic rank' })).toContainText('12 · farthest')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'Letter' })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2) // 14 lines, 12 a page, as without the caption
})
```

The Practice panel needs the `practice` flag too; e2e builds have every flag on. If the "Where each scale starts"
choice is already remembered as From root by an earlier step, `pickOption` still works.

- [ ] **Step 2: Run it**

Run: `make e2e` (or `cd web && npm run e2e -- pentatonics.spec.ts` for this file first). Expected: PASS. If the
page count is 3, the caption pushed a staff over: report it (spec says the caption prints; don't hide it) and stop.

- [ ] **Step 3: Docs**: in `docs/design.md` §Practice selection add one bullet:

```markdown
- **Pentatonic** (#266, flag `pentatonics`; both modes): a rank 1–12 (`{ preset: 'pentatonic', rank }`, stored and
  shared like any pick). Each staff ranks the 12 minor pentatonics against its own scale (`pentatonicRanking`: most
  shared, then fewest fifths from the written chord root, ♭ side first), lights the scale notes the one at that rank
  shares (`pentatonicPick`) and captions the staff (`Dm pent`; `F♯m pent · #2 · 3 shared` where the best shares
  under 5). Spec: docs/superpowers/specs/2026-10-14-pentatonic-practice-design.md.
```

- [ ] **Step 4: Full verification**

Run: `make test && make lint && make e2e` → all green.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/pentatonics.spec.ts docs/design.md
git commit -m "Pentatonic practice: browser test, print check, design notes (#266)"
```
