# Pentatonics per chord, picks per label: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Changes sheet's Pentatonics row, add a "Ranked against: Key | Chord" choice (Chord: each chord ranks the 12 minor pentatonics against its own scale at one sheet-wide Rank), and make a popover pick apply to the clicked label's run only.

**Architecture:** The engine (`buildChanges`) takes an extended `PentatonicPlan` (basis, rank, picks keyed by drawn chord) and gives each chord a richer `ChangesPentatonic` (title, ranking, level, chord key, concert pc, picked); `showPentatonics` fills each printed label's `run`. The app adds two preferences (basis, rank), a per-chart picks store (`usePentatonicPicks`), and generalises the popover (`PentatonicLadder.vue`) to list a ladder or a ranking and emit a pick or a reset.

**Tech Stack:** TypeScript strict, Vue 3 / Nuxt, vitest (`make test`), Playwright (`make e2e`).

**Spec:** `docs/superpowers/specs/2026-10-14-pentatonic-per-chord-design.md`

## Global Constraints

- Everything stays behind the `pentatonics` feature flag (off; e2e builds with it on). No new flag.
- Pentatonic basis, rank and picks are preferences only: never in chart rows or share links.
- `engine/` stays free of Vue/DOM imports. TDD: tests first, engine before app.
- `buildChanges(…, null)` (row off) and a key-basis plan with no picks must give today's sheets: existing tests unchanged except where this plan says. `make golden`: expect no diff.
- Tailwind emits only literal class names (keep `RUNG_TINT` an array of literals).
- Print: no new row; `changesLinesPerPage` unchanged.
- Rail stays ≤ 2 rows at 1440 (`editor.spec` "stays tidy").
- Stage files by name; never `git add -A`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Transposed parts with picks:** a pick made on a B♭ part, then the instrument switched to concert, must keep the same sounding pentatonic (picks store concert pcs). Test in Task 2.
2. **A pick on a run that spans a key change (key basis):** relative keys share a label, so a run may span C major → A minor; the picked pc must be found in each chord's own ladder. Test in Task 2.
3. **Chord with no scale under the chord basis** (N.C.): no label, no crash, and it ends a run. Test in Task 1.
4. **Stale picks** (chart edited, chord gone) must not turn counts on or crash. Test in Task 2.
5. **Changing any control clears picks, but loading the page does not.** Test in Task 4 (watch fires on change only).

---

## File map

- `engine/src/part.ts`: add `concertPc(part, writtenPc)`.
- `engine/src/changes.ts`: `ChordAt`, `PentatonicBasis`, extended `PentatonicPlan` and `ChangesPentatonic`; chord basis, picks, counts post-pass, `run` in `showPentatonics`, contour by `level`.
- `engine/src/__tests__/changes.test.ts`, `engine/src/__tests__/api.test.ts` (snapshot).
- `web/app/composables/usePreferences.ts`: `pentBasis`, `pentRank`.
- `web/app/utils/pentatonics.ts`: `PENT_BASES`, `PENT_RANK_CHOICES`, `rankLabel` (moved from `PracticePanel.vue`).
- `web/app/components/PreviewControls.vue`: Ranked against + Rank.
- `web/app/composables/usePentatonicPicks.ts` (new), `web/app/composables/usePentatonicPath.ts` (drop `setSection`).
- `web/app/components/PentatonicLadder.vue`: takes a `ChangesPentatonic`, emits `pick(writtenPc)` / `reset`.
- `web/app/components/ChangesSystem.vue`, `ChangesSheet.vue`, `EditorView.vue`: wiring.
- Tests: `web/test/usePentatonicPicks.test.ts` (new), `web/test/usePentatonicPath.test.ts`, `web/test/PentatonicLadder.test.ts`, `web/test/pentatonics.test.ts`, `web/e2e/pentatonics.spec.ts`, `web/e2e/print.spec.ts`.
- `docs/design.md` §Pentatonics on Changes.

---

### Task 1: Engine, chord basis

**Files:**
- Modify: `engine/src/part.ts`, `engine/src/changes.ts`
- Test: `engine/src/__tests__/changes.test.ts`, `engine/src/__tests__/api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // part.ts
  /** a written pitch class back to concert for the part */
  export function concertPc(part: Part, written: number): number
  // changes.ts
  export type ChordAt = string // `${section}:${bar}:${k}`: the drawn bar's at.section, at.bar, the chord's index in the bar
  export type PentatonicBasis = 'key' | 'chord'
  export type PentatonicPlan = Readonly<{
    bySection: Readonly<Record<string, PentatonicView>>
    fallback: PentatonicView
    counts: boolean
    basis?: PentatonicBasis // default 'key'
    rank?: number // chord basis, 1–12, default 1
    picks?: Readonly<Record<ChordAt, number>> // concert pc of a picked pentatonic's root (Task 2)
  }>
  export type ChangesPentatonic = Readonly<{
    label: string
    basis: PentatonicBasis
    title: string // 'B · F major pentatonic ladder' | 'Dm7 · D Aeolian pentatonic ranking'
    key: string // key basis: the area's key; chord basis: ''
    scale: string // chord basis: its scale, written ('D Aeolian'); key basis: ''
    ladder: readonly PentatonicRung[] // key basis; [] for chord
    ranking: readonly PentatonicRank[] // chord basis; [] for key
    section: string
    chord: ChordAt
    view: PentatonicView // key basis: the rung played; chord basis: PENTATONIC_HOME
    rank: number // chord basis; 0 for key
    root: Spelled // written
    name: string // 'Dm'
    shared: number
    level: number // 0–6 (contour height, tint)
    pc: number // concert pitch class of root
    picked: boolean
    run: readonly ChordAt[] // Task 2; [] until then
  }>
  ```
  Optional plan fields keep every existing `PentatonicPlan` literal valid.

- [ ] **Step 1: Failing tests** (append inside `describe('the Changes sheet')` in `changes.test.ts`; add `concertPc` import from `../part`)

```ts
  const chordPlan = (rank = 1): PentatonicPlan => ({ bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord', rank })
  const flat = (lines: readonly ChangesLine[]) => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))

  it('ranks each chord against its own scale under the chord basis: Waltz for Debby bars 1–4', () => {
    const built = buildChanges(library('waltz-for-debby'), CONCERT, 4, false, 'off', undefined, chordPlan())
    const first4 = flat(built.lines).slice(0, 4)
    // F Ionian from F, D Aeolian, G Dorian, C Mixolydian: all F major's notes, ties by fifths from each chord root
    expect(first4.map((c) => c.pentatonic?.name)).toEqual(['Gm', 'Dm', 'Gm', 'Gm'])
    expect(first4.map((c) => [c.pentatonic?.rank, c.pentatonic?.shared, c.pentatonic?.level])).toEqual([[1, 5, 0], [1, 5, 0], [1, 5, 0], [1, 5, 0]])
    expect(showPentatonics(built.lines)[0]?.bars.flatMap((b) => b.chords.map((c) => c.pentatonic?.label))).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5', ''])
  })

  it('names the chord basis title and keeps its ranking; rank 12 is the farthest', () => {
    const doc = parseChart('title: T\nkey: F\nA | 1 | Dm7').value
    const [c] = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan(12)).lines)
    expect([c?.pentatonic?.basis, c?.pentatonic?.title, c?.pentatonic?.ranking.length, c?.pentatonic?.rank, c?.pentatonic?.shared, c?.pentatonic?.level]).toEqual(['chord', 'Dm7 · D Aeolian pentatonic ranking', 12, 12, 0, 6])
  })

  it('spells the chord basis for the part, and reports the root in concert', () => {
    const doc = parseChart('title: T\nkey: F\nA | 1 | Dm7').value
    const [c] = flat(buildChanges(doc, TENOR, 4, false, 'off', undefined, chordPlan()).lines)
    expect([c?.pentatonic?.name, c?.pentatonic?.pc]).toEqual(['Em', 2]) // written E minor = concert D
    expect(concertPc(TENOR, 4)).toBe(2)
  })

  it('gives a chord with no scale no label under the chord basis', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | N.C.\nA | 3 | Cmaj7').value
    const chords = flat(showPentatonics(buildChanges(doc, CONCERT, 4, false, 'off', undefined, chordPlan()).lines))
    expect(chords[1]?.pentatonic).toBeNull()
    expect(chords.map((c) => c.pentatonic?.label ?? null)).toEqual(['Dm♪ 5', null, 'Dm♪ 5']) // a gap: the label prints again
  })

  it('keys each chord by its drawn bar and index, and keeps the key basis’s title and level', () => {
    const doc = parseChart('title: T\nkey: C\nA | 1 | Cmaj7\nA | 1 | Dm7\nB | 2 | Cmaj7').value
    const plan: PentatonicPlan = { bySection: { B: { rung: 3, side: 'sharp' } }, fallback: { rung: 0, side: 'flat' }, counts: true }
    const chords = flat(buildChanges(doc, CONCERT, 4, false, 'off', undefined, plan).lines)
    expect(chords.map((c) => c.pentatonic?.chord)).toEqual(['A:1:0', 'A:1:1', 'B:2:0'])
    expect([chords[2]?.pentatonic?.title, chords[2]?.pentatonic?.level, chords[2]?.pentatonic?.rank, chords[2]?.pentatonic?.basis]).toEqual(['B · C major pentatonic ladder', 3, 0, 'key'])
  })
```

Also change the `pentatonicContour` test "steps mid-line where the rung changes inside a line": in the hand-built `stepped` line set `level: 3` as well as `view` (`pentatonic: { ...second.pentatonic!, view: { rung: 3, side: 'sharp' as const }, level: 3 }`), since the contour now reads `level`.

- [ ] **Step 2: Run, expect failures**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: FAIL (`concertPc` not exported, `name`/`title`/`chord`/`level` undefined).

- [ ] **Step 3: Implement**

`part.ts` (after `writtenRoot`):

```ts
/** a written pitch class back to concert for the part */
export const concertPc = (part: Part, written: number): number => mod(written - pcOf(writtenRoot(part, parseRoot('C'), 'ionian')), 12)
```
(import `mod`, `pcOf`, `parseRoot` from `./pitch` if not already; check `writtenRoot`'s third parameter type and pass a valid key name.)

`changes.ts`:
- Imports: add `type PentatonicRank, pentatonicRanking, PENTATONIC_HOME, PENTATONIC_RANKS` from `./pentatonics`; `mod, pcOf, type Spelled` from `./pitch`; `concertPc, scaleLabel, writtenScale` from `./part`; `writtenChordRootLenient` from `./chord`.
- Replace the `ChangesPentatonic` and `PentatonicPlan` types with the Interfaces above; add `ChordAt`, `PentatonicBasis`. Update `ChangesChord.pentatonic`'s doc comment: "its pentatonic (key area's ladder or its own scale's ranking); null with the row off, no key (key basis) or no scale (chord basis)".
- Add near `areaLadder`:

```ts
/** a pentatonic's tension, 0–6, for the contour and tints: the rung (key basis), else from the notes it shares (5 → 0, 4 → 2 … 0 → 6) */
const levelOf = (shared: number): number => (shared >= 5 ? 0 : 6 - shared)
const clampRank = (rank: number | undefined): number => (Number.isInteger(rank) ? Math.min(Math.max(rank!, 1), PENTATONIC_RANKS) : 1)
```

- In `buildChanges`, replace `pentatonicOf` with:

```ts
  const basis = pentatonic?.basis ?? 'key'
  const rankings = new Map<string, Readonly<{ entries: readonly PentatonicRank[]; scaleName: string }> | null>()
  const rankingOf = (scale: string, chordText: string) => {
    const k = `${scale}|${chordText}`
    if (!rankings.has(k)) rankings.set(k, orNull(() => {
      const w = writtenScale(part, scale)
      const root = orNull(() => writtenChordRootLenient(part, chordText, scale)) ?? w.root
      const label = scaleLabel(part, scale)
      return { entries: pentatonicRanking(new Set(w.notes.map((n) => pcOf(n))), root), scaleName: glyphs(`${rootName(label.root)} ${label.name}`) }
    }))
    return rankings.get(k) ?? null
  }
  const ladders = new Map<string, ReturnType<typeof areaLadder>>()
  const pentatonicOf = (keyName: string | undefined, section: string, chord: ChordAt, written: string, scale: string | null, chordText: string): ChangesPentatonic | null => {
    if (!pentatonic) return null
    const picks = pentatonic.picks ?? {}
    const pick = Object.hasOwn(picks, chord) ? picks[chord] : undefined
    const want = pick === undefined ? null : mod(pick + (mod(pcOf(writtenRoot(part, parseRoot('C'), 'ionian')), 12)), 12) // the pick, written
    const common = { section, chord, run: [] as readonly ChordAt[] }
    if (basis === 'chord') {
      if (!scale) return null
      const r = rankingOf(scale, chordText)
      if (!r) return null
      const found = want === null ? undefined : r.entries.find((e) => pcOf(e.root) === want)
      const at = found ?? r.entries[clampRank(pentatonic.rank) - 1]!
      return { ...common, label: `${at.name}♪`, basis, title: `${written} · ${r.scaleName} pentatonic ranking`, key: '', scale: r.scaleName, ladder: [], ranking: r.entries, view: PENTATONIC_HOME, rank: at.rank, root: at.root, name: at.name, shared: at.shared, level: levelOf(at.shared), pc: concertPc(part, pcOf(at.root)), picked: !!found }
    }
    if (!keyName) return null
    if (!ladders.has(keyName)) ladders.set(keyName, areaLadder(keyName, part))
    const area = ladders.get(keyName)
    if (!area) return null
    const found = want === null ? undefined : area.ladder.find((e) => pcOf(e.root) === want)
    const sectionView = (Object.hasOwn(pentatonic.bySection, section) ? pentatonic.bySection[section] : undefined) ?? pentatonic.fallback
    const p = found ?? pentatonicAt(area.ladder, sectionView)
    const view = found ? { rung: found.rung, side: found.side ?? sectionView.side } : sectionView
    return { ...common, label: `${p.name}♪`, basis, title: `${section} · ${area.key} pentatonic ladder`, key: area.key, scale: '', ladder: area.ladder, ranking: [], view, rank: 0, root: p.root, name: p.name, shared: p.shared, level: p.rung, pc: concertPc(part, pcOf(p.root)), picked: !!found }
  }
```
(Simplify `want`: hoist `const toWritten = pcOf(writtenRoot(part, parseRoot('C'), 'ionian'))` once, then `want = mod(pick + toWritten, 12)`.)

- At the call site, the chord's `at` key needs its drawn bar and index: inside `bars` the chord map is `.map((i, k) => …)` over the filtered rows; pass `pentatonicOf(a?.key.name, block.section, \`${block.section}:${firstBar + j}:${k}\`, written, scale, row.chord)`, computing `written` once into a const used by both the `written` field and the call.
- Counts post-pass, in the final `return` of `buildChanges` (on `deduped`):

```ts
  const counts = !!pentatonic && (pentatonic.counts || basis === 'chord' || flatChords(deduped).some((c) => c.pentatonic?.picked))
  const counted = counts ? deduped.map((l) => mapPentatonics(l, (p) => ({ ...p, label: `${p.label} ${p.shared}` }))) : deduped
  return { lines: counted, beats, diagnostics: … }
```
with module-level helpers:

```ts
const flatChords = (lines: readonly ChangesLine[]): ChangesChord[] => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
const mapPentatonics = (line: ChangesLine, f: (p: ChangesPentatonic) => ChangesPentatonic): ChangesLine => ({
  ...line,
  bars: line.bars.map((bar) => ({ ...bar, chords: bar.chords.map((c) => (c.pentatonic ? { ...c, pentatonic: f(c.pentatonic) } : c)) })),
})
```
- `pentatonicContour`: read `c.pentatonic?.level ?? null` instead of `c.pentatonic?.view.rung ?? null`; update its doc comment ("runs of one level: the rung, or the chord basis's level"). `ContourRun.rung` keeps its name (the level).

- [ ] **Step 4: Run, expect pass**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts`
Expected: PASS, every pre-existing pentatonic test unchanged and green.

- [ ] **Step 5: API snapshot + full engine tests**

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && npx vitest run`
Expected: snapshot gains `concertPc`; all pass. `make golden` then `git diff --stat engine/fixtures` → no change.

- [ ] **Step 6: Commit**

```bash
git add engine/src/part.ts engine/src/changes.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/__snapshots__
git commit -m "Pentatonics per chord: rank each chord against its own scale (#272)"
```

---

### Task 2: Engine, picks and runs

**Files:**
- Modify: `engine/src/changes.ts` (`showPentatonics`)
- Test: `engine/src/__tests__/changes.test.ts`

**Interfaces:**
- Consumes: Task 1's `PentatonicPlan.picks`, `ChangesPentatonic.chord/picked/pc/run`.
- Produces: `showPentatonics(lines)` sets `run` on each printed label: its own `chord` and the following chords on the line whose label it blanked (stops at a chord with no pentatonic, the next printed label, or the line's end). Unprinted labels keep `run: []`.

- [ ] **Step 1: Failing tests**

```ts
  describe('picks', () => {
    const C4 = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | Cmaj7'
    const keyPlan = (picks: Record<string, number> = {}): PentatonicPlan => ({ bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, picks })
    const shown = (text: string, plan: PentatonicPlan, part = CONCERT) => flat(showPentatonics(buildChanges(parseChart(text).value, part, 4, false, 'off', undefined, plan).lines))

    it('gives each printed label the run of chords it covers', () => {
      expect(shown(C4, keyPlan()).map((c) => c.pentatonic?.run)).toEqual([['A:1:0', 'A:2:0', 'A:3:0', 'A:4:0'], [], [], []])
    })

    it('plays a picked pentatonic on its chords only, marks it, and turns the counts on', () => {
      const chords = shown(C4, keyPlan({ 'A:2:0': 7, 'A:3:0': 7 })) // concert G: rung 2 ♭ of C major (home Am)
      expect(chords.map((c) => c.pentatonic?.label)).toEqual(['Am♪ 5', 'Gm♪ 4', '', 'Am♪ 5'])
      expect(chords.map((c) => c.pentatonic?.picked)).toEqual([false, true, true, false])
      expect(chords[1]?.pentatonic?.view).toEqual({ rung: 2, side: 'flat' })
      expect(chords[1]?.pentatonic?.run).toEqual(['A:2:0', 'A:3:0'])
    })

    it('reports a chord-basis pick’s own rank and shared on each chord', () => {
      const plan: PentatonicPlan = { ...keyPlan({ 'A:1:0': 4, 'A:2:0': 4 }), basis: 'chord', rank: 1 } // Em on Cmaj7 and Dm7
      const chords = shown(C4, plan)
      expect(chords.slice(0, 2).map((c) => [c.pentatonic?.name, c.pentatonic?.rank, c.pentatonic?.shared, c.pentatonic?.picked])).toEqual([['Em', 3, 5, true], ['Em', 3, 5, true]])
    })

    it('keeps a pick’s sounding pentatonic on a transposed part', () => {
      const chords = shown(C4, keyPlan({ 'A:1:0': 7 }), TENOR) // concert Gm, written Am on a B♭ part
      expect([chords[0]?.pentatonic?.name, chords[0]?.pentatonic?.pc, chords[0]?.pentatonic?.picked]).toEqual(['Am', 7, true])
    })

    it('finds a pick in each chord’s own ladder across relative keys', () => {
      const doc = 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Am7\n@key A 2 Am'
      const chords = shown(doc, keyPlan({ 'A:1:0': 2, 'A:2:0': 2 })) // Dm: C major rung 1 ♭, A minor rung 1 ♭
      expect(chords.map((c) => [c.pentatonic?.key, c.pentatonic?.name, c.pentatonic?.view.rung])).toEqual([['C major', 'Dm', 1], ['A minor', 'Dm', 1]])
    })

    it('ignores a stale pick: no counts, nothing picked', () => {
      const chords = shown(C4, keyPlan({ 'Z:9:0': 7 }))
      expect(chords.map((c) => c.pentatonic?.label)).toEqual(['Am♪', '', '', ''])
      expect(chords.some((c) => c.pentatonic?.picked)).toBe(false)
    })

    it('ends a run at a chord with no pentatonic', () => {
      const plan: PentatonicPlan = { ...keyPlan(), basis: 'chord', rank: 1 }
      const chords = shown('title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | N.C.\nA | 3 | Cmaj7', plan)
      expect(chords.map((c) => c.pentatonic?.run ?? null)).toEqual([['A:1:0'], null, ['A:3:0']])
    })
  })
```
(Check the Em rank on Cmaj7: C Ionian ranks Dm ♯2, Am ♯3, Em ♯4 at 1–3, so Em is rank 3 over Cmaj7; over Dm7 (D Aeolian from D? or D Dorian, per the analysis) Em is ♯2 → rank 3 there too (Dm home, Am ♯1, Em ♯2). If the analysis gives a different scale for Dm7, correct the expected rank from `pentatonicRanking`, never by changing the code.)

- [ ] **Step 2: Run, expect failures**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts -t picks`
Expected: FAIL on `run` (all `[]`). The pick tests may already pass from Task 1: fine.

- [ ] **Step 3: Implement** — replace `showPentatonics`:

```ts
/**
 * the pentatonic row as printed (#255), run after breakLines: a chord's label stays on a line's first labelled chord
 * and wherever it differs from the last one shown on the line (relative keys share a home: shown once); elsewhere
 * its label is ''. A printed label's run (#272) is its chord and the following ones it stands for, to the next
 * printed label, a chord with no pentatonic, or the line's end: a pick in its popover covers them
 */
export function showPentatonics(lines: readonly ChangesLine[]): readonly ChangesLine[] {
  return lines.map((line): ChangesLine => {
    const all = line.bars.flatMap((b) => b.chords)
    let last: string | null = null
    const printed = all.map((c) => {
      if (!c.pentatonic) {
        last = null
        return false
      }
      const shown = c.pentatonic.label !== last
      last = c.pentatonic.label
      return shown
    })
    const runAt = (i: number): ChordAt[] => {
      const out = [all[i]!.pentatonic!.chord]
      for (let j = i + 1; j < all.length && all[j]!.pentatonic && !printed[j]; j++) out.push(all[j]!.pentatonic!.chord)
      return out
    }
    let n = 0
    return mapChords(line, (c) => {
      const i = n++
      if (!c.pentatonic) return c
      return printed[i] ? { ...c, pentatonic: { ...c.pentatonic, run: runAt(i) } } : { ...c, pentatonic: { ...c.pentatonic, label: '' } }
    })
  })
}
```
with helper `const mapChords = (line: ChangesLine, f: (c: ChangesChord) => ChangesChord): ChangesLine => ({ ...line, bars: line.bars.map((bar) => ({ ...bar, chords: bar.chords.map(f) })) })` (and have Task 1's `mapPentatonics` reuse it).

Note the behaviour change: a chord with no pentatonic now resets `last`, so the label after a gap prints again. Today's code kept `last` across a gap. Run the whole file: if an existing test relied on the old behaviour, stop and report rather than change its expectation.

- [ ] **Step 4: Run, expect pass**

Run: `cd engine && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/src/changes.ts engine/src/__tests__/changes.test.ts
git commit -m "Pentatonics: picks per chord, each printed label's run (#272)"
```

---

### Task 3: App, preferences and controls

**Files:**
- Modify: `web/app/composables/usePreferences.ts`, `web/app/utils/pentatonics.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/PracticePanel.vue` (import `rankLabel` from utils), `web/app/components/EditorView.vue` (v-models only)
- Test: `web/test/pentatonics.test.ts`, the PreviewControls unit test that covers Pentatonics (find it: `grep -ln "Pentatonic path" web/test`)

**Interfaces:**
- Produces: `prefs.pentBasis: Ref<PentatonicBasis>` (`csm-pent-basis`, `key | chord`, default `key`), `prefs.pentRank: Ref<number>` (`csm-pent-rank`, `1`–`12`, default `1`); `PreviewControls` models `pentBasis`, `pentRank`; utils `PENT_BASES`, `PENT_RANK_CHOICES`, `rankLabel`.

- [ ] **Step 1: Failing tests**

In `web/test/pentatonics.test.ts`:

```ts
  it('offers Key | Chord and twelve ranks, closest and farthest named', () => {
    expect(PENT_BASES.map((b) => b.value)).toEqual(['key', 'chord'])
    expect(PENT_RANK_CHOICES.map((r) => r.label)).toEqual(['1 · closest', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12 · farthest'])
    expect(rankLabel(1)).toBe('1 · closest')
  })
```

In the PreviewControls test (same mount helper it uses for the Path test), with `pentatonics: true`:

```ts
  it('shows Rank in place of Path under the chord basis', async () => {
    const w = await mountControls({ pentatonics: true, pentBasis: 'chord' })
    expect(w.find('[aria-label="Pentatonic rank"]').exists()).toBe(true)
    expect(w.find('[aria-label="Pentatonic path"]').exists()).toBe(false)
    expect(w.find('[aria-label="Pentatonics ranked against"]').exists()).toBe(true)
  })
```
(Adapt `mountControls` to the file's existing helper and prop names.)

- [ ] **Step 2: Run, expect failures**

Run: `cd web && npx vitest run test/pentatonics.test.ts <controls test>`

- [ ] **Step 3: Implement**

`utils/pentatonics.ts`:

```ts
import { PENTATONIC_RANKS, type PentatonicBasis } from '@chord-scale-maker/engine'
/** what the Pentatonics row ranks against (#272): the key area's ladder, or each chord's own scale */
export const PENT_BASES: readonly { value: PentatonicBasis; label: string; title: string }[] = [
  { value: 'key', label: 'Key', title: 'One pentatonic per key area, on its tension ladder' },
  { value: 'chord', label: 'Chord', title: 'Each chord’s own pentatonic, ranked against its scale' },
]
export const rankLabel = (r: number): string => (r === 1 ? '1 · closest' : r === PENTATONIC_RANKS ? `${r} · farthest` : String(r))
export const PENT_RANK_CHOICES = Array.from({ length: PENTATONIC_RANKS }, (_, i) => ({ value: i + 1, label: rankLabel(i + 1) }))
```
`PracticePanel.vue`: delete its local `rankLabel`, import it from `~/utils/pentatonics`.

`usePreferences.ts` (after `pentSide`; add to the returned object):

```ts
  // #272: what the row ranks against, and the chord basis's rank
  const pentBasis = storedRef<PentatonicBasis>('csm-pent-basis', (s) => (s === 'key' || s === 'chord' ? s : undefined), 'key')
  const pentRank = storedRef<number>('csm-pent-rank', (s) => (/^([1-9]|1[0-2])$/.test(s) ? Number(s) : undefined), 1)
```

`PreviewControls.vue`: models `pentBasis = defineModel<PentatonicBasis>('pentBasis', { default: 'key' })`, `pentRank = defineModel<number>('pentRank', { default: 1 })`. Inside the `v-if="pentatonicsOn && pentatonics"` block, first:

```vue
<SegmentedControl v-model="pentBasis" legend="Ranked against" name="pent-basis" aria-label="Pentatonics ranked against" :options="PENT_BASES" />
<UiListbox v-if="pentBasis === 'chord'" v-model="pentRank" class="w-48" aria-label="Pentatonic rank">
  <template #selected="{ value }"><UiListboxLabel>{{ rankLabel(value) }}</UiListboxLabel></template>
  <UiListboxOption v-for="r in PENT_RANK_CHOICES" :key="r.value" :value="r.value"><UiListboxLabel>{{ r.label }}</UiListboxLabel></UiListboxOption>
</UiListbox>
<template v-else>
  <!-- the existing Path listbox and the One rung template, unchanged -->
</template>
```
Update the Pentatonics toggle `title`: "Each key area's or each chord's minor pentatonic, ranked by how far out it is".

`EditorView.vue`: `v-model:pent-basis="prefs.pentBasis.value"`, `v-model:pent-rank="prefs.pentRank.value"` beside the other pent models.

- [ ] **Step 4: Run, expect pass**

Run: `cd web && npx vitest run test/pentatonics.test.ts <controls test> test/PracticePanel*`

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/usePreferences.ts web/app/utils/pentatonics.ts web/app/components/PreviewControls.vue web/app/components/PracticePanel.vue web/app/components/EditorView.vue web/test/pentatonics.test.ts <controls test>
git commit -m "Pentatonics: Ranked against Key | Chord, and the chord basis's Rank (#272)"
```

---

### Task 4: App, picks store

**Files:**
- Create: `web/app/composables/usePentatonicPicks.ts`, `web/test/usePentatonicPicks.test.ts`
- Modify: `web/app/composables/usePentatonicPath.ts` (delete `setSection`), `web/test/usePentatonicPath.test.ts` (delete or rewrite tests that call `setSection`: "treats a section named after an Object built-in…" → use `setPath('fifths')` and assert `bySection.constructor` is a view; delete "edits one section into Custom…" and "switching from a preset to Custom…" only if they need `setSection`; keep "writes a Custom edit and reloads it" by seeding storage directly with a custom JSON)

**Interfaces:**
- Produces:
  ```ts
  export function usePentatonicPicks(key: string | undefined): {
    picks: Readonly<Ref<Readonly<Record<ChordAt, number>>>>
    pick(run: readonly ChordAt[], pc: number): void // concert pc
    reset(run: readonly ChordAt[]): void
    clear(): void
    carryTo(otherKey: string): void
  }
  ```
  Stored under `csm-pent-picks:<key>`; empty → removed. No key → memory only.

- [ ] **Step 1: Failing tests** (`web/test/usePentatonicPicks.test.ts`)

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { usePentatonicPicks } from '~/composables/usePentatonicPicks'

const make = (key: string | undefined) => {
  const s = effectScope().run(() => usePentatonicPicks(key))
  if (!s) throw new Error('no picks')
  return s
}

describe('usePentatonicPicks', () => {
  afterEach(() => localStorage.clear())

  it('picks a pentatonic for a run, stores it per chart, and reloads it', async () => {
    const p = make('autumn-leaves')
    p.pick(['A1:1:0', 'A1:2:0'], 7)
    await nextTick()
    expect(JSON.parse(localStorage.getItem('csm-pent-picks:autumn-leaves')!)).toEqual({ 'A1:1:0': 7, 'A1:2:0': 7 })
    expect(make('autumn-leaves').picks.value).toEqual({ 'A1:1:0': 7, 'A1:2:0': 7 })
  })

  it('resets a run, and removes the entry when nothing is picked', async () => {
    const p = make('t')
    p.pick(['A:1:0', 'A:2:0'], 7)
    p.pick(['A:3:0'], 2)
    p.reset(['A:1:0', 'A:2:0'])
    expect(p.picks.value).toEqual({ 'A:3:0': 2 })
    p.clear()
    await nextTick()
    expect(localStorage.getItem('csm-pent-picks:t')).toBeNull()
  })

  it('ignores junk: bad JSON, non-integer or out-of-range pcs, own-property names', () => {
    localStorage.setItem('csm-pent-picks:j', '{"A:1:0": 13, "A:2:0": "x", "A:3:0": 4, "constructor": 1.5}')
    expect(make('j').picks.value).toEqual({ 'A:3:0': 4 })
    localStorage.setItem('csm-pent-picks:k', 'not json')
    expect(make('k').picks.value).toEqual({})
  })

  it('keeps picks for the visit only with no chart key, and carries them to another key', async () => {
    const p = make(undefined)
    p.pick(['A:1:0'], 3)
    await nextTick()
    expect(localStorage.length).toBe(0)
    p.carryTo('mine:1')
    expect(make('mine:1').picks.value).toEqual({ 'A:1:0': 3 })
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `cd web && npx vitest run test/usePentatonicPicks.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** (`usePentatonicPicks.ts`; `readStored`/`writeStored`/`removeStored` are auto-imported as in `usePentatonicPath.ts`)

```ts
import type { Ref } from 'vue'
import type { ChordAt } from '@chord-scale-maker/engine'

type Picks = Readonly<Record<ChordAt, number>>

function parse(raw: string | null): Picks {
  if (raw === null) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => Number.isInteger(e[1]) && e[1] >= 0 && e[1] < 12))
  } catch {
    return {}
  }
}

/**
 * the pentatonics picked in labels' popovers (#272), per chart in this browser under `csm-pent-picks:<key>`: each
 * drawn chord's picked pentatonic root, concert. Without a key they last for the visit. Never in the chart or a share link.
 */
export function usePentatonicPicks(key: string | undefined) {
  const storeKey = key ? `csm-pent-picks:${key}` : null
  const picks: Ref<Picks> = ref(storeKey ? parse(readStored(storeKey)) : {})
  watch(picks, (p) => {
    if (!storeKey) return
    if (Object.keys(p).length) writeStored(storeKey, JSON.stringify(p))
    else removeStored(storeKey)
  })
  const without = (run: readonly ChordAt[]): Picks => Object.fromEntries(Object.entries(picks.value).filter(([k]) => !run.includes(k)))
  return {
    picks: readonly(picks),
    pick(run: readonly ChordAt[], pc: number): void {
      picks.value = { ...without(run), ...Object.fromEntries(run.map((k) => [k, pc])) }
    },
    reset(run: readonly ChordAt[]): void {
      picks.value = without(run)
    },
    clear(): void {
      if (Object.keys(picks.value).length) picks.value = {}
    },
    carryTo(otherKey: string): void {
      if (Object.keys(picks.value).length) writeStored(`csm-pent-picks:${otherKey}`, JSON.stringify(picks.value))
    },
  }
}
```

`usePentatonicPath.ts`: delete `setSection` and the `seeded` helper if only it used it (check `setPath('custom')`: it uses `seeded()`; keep `seeded` then). Update the doc comment: "a preset fills every section; a stored Custom path (from before #272) still plays its sections".

- [ ] **Step 4: Run, expect pass**

Run: `cd web && npx vitest run test/usePentatonicPicks.test.ts test/usePentatonicPath.test.ts`
(`npx nuxi typecheck` will flag `EditorView.vue`'s `setSection` call until Task 5: do Task 5 before `make test`.)

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/usePentatonicPicks.ts web/test/usePentatonicPicks.test.ts web/app/composables/usePentatonicPath.ts web/test/usePentatonicPath.test.ts
git commit -m "Pentatonics: a per-chart store of label picks (#272)"
```

---

### Task 5: App, popover and wiring

**Files:**
- Modify: `web/app/components/PentatonicLadder.vue`, `ChangesSystem.vue`, `ChangesSheet.vue`, `EditorView.vue`
- Test: `web/test/PentatonicLadder.test.ts`

**Interfaces:**
- Consumes: `ChangesPentatonic` (Task 1–2), `usePentatonicPicks` (Task 4), `prefs.pentBasis/pentRank` (Task 3), `concertPc(part, written)` (Task 1).
- Produces: `PentatonicLadder` props `{ p: ChangesPentatonic }`, emits `pick: [written: number]` (the picked root's written pc) and `reset: []`. `ChangesSystem`/`ChangesSheet` emit `pentatonic: [run: readonly ChordAt[], written: number | null]` (`null` = reset).

- [ ] **Step 1: Failing tests** (rewrite `web/test/PentatonicLadder.test.ts`'s fixtures to build `p` from the engine)

```ts
import { buildChanges, CONCERT, parseChart, type ChangesPentatonic, type PentatonicPlan, showPentatonics } from '@chord-scale-maker/engine'

const pentOf = (text: string, plan: PentatonicPlan): ChangesPentatonic =>
  showPentatonics(buildChanges(parseChart(text).value, CONCERT, 4, false, 'off', undefined, plan).lines)[0]!.bars[0]!.chords[0]!.pentatonic!
const KEY = pentOf('title: T\nkey: C\nA | 1 | Cmaj7', { bySection: {}, fallback: { rung: 2, side: 'flat' }, counts: false })
const CHORD = pentOf('title: T\nkey: F\nA | 1 | Dm7', { bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, basis: 'chord', rank: 2 })
const PICKED = pentOf('title: T\nkey: C\nA | 1 | Cmaj7', { bySection: {}, fallback: { rung: 0, side: 'flat' }, counts: false, picks: { 'A:1:0': 7 } })

  it('is a button naming the pentatonic, its shared notes and the key', async () => {
    const w = await mountSuspended(PentatonicLadder, { props: { p: KEY } })
    expect(w.find('button').attributes('aria-label')).toBe('Pentatonic: G minor, 4 of 5 notes in C major. Show the ladder')
    expect(w.find('button').text()).toBe('Gm♪')
  })

  it('lists the ladder’s 12 by rung, marks the current one, and emits the written pc of a pick', async () => {
    const w = await mountSuspended(PentatonicLadder, { props: { p: KEY }, attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('A · C major pentatonic ladder')
    expect(w.findAll('[data-pent]')).toHaveLength(12)
    expect(w.find('[aria-current="true"]').text()).toBe('Gm')
    await w.findAll('[data-pent]').find((x) => x.text() === 'F♯m')?.trigger('click')
    expect(w.emitted('pick')?.[0]).toEqual([6])
    w.unmount()
  })

  it('lists a chord’s ranking, 12 rows with rank and shared', async () => {
    const w = await mountSuspended(PentatonicLadder, { props: { p: CHORD }, attachTo: document.body })
    expect(w.find('button').attributes('aria-label')).toBe(`Pentatonic: ${CHORD.name.replace('m', '')} minor, rank 2, ${CHORD.shared} of 5 notes in D Aeolian. Show the ranking`)
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('Dm7 · D Aeolian pentatonic ranking')
    const rows = w.findAll('li')
    expect(rows).toHaveLength(12)
    expect(rows[0]?.text()).toMatch(/^1 · 5 shared/)
    expect(w.find('[aria-current="true"]').text()).toBe(CHORD.name)
    w.unmount()
  })

  it('marks a pick, and offers Reset only on one', async () => {
    const picked = await mountSuspended(PentatonicLadder, { props: { p: PICKED }, attachTo: document.body })
    expect(picked.find('button').attributes('aria-label')).toContain(', your pick.')
    expect(picked.find('button').classes()).toContain('decoration-solid')
    await picked.find('button').trigger('click')
    await flushPromises()
    await picked.find('[data-reset]').trigger('click')
    expect(picked.emitted('reset')).toHaveLength(1)
    picked.unmount()
    const plain = await mountSuspended(PentatonicLadder, { props: { p: KEY }, attachTo: document.body })
    await plain.find('button').trigger('click')
    await flushPromises()
    expect(plain.find('[data-reset]').exists()).toBe(false)
    plain.unmount()
  })
```
Keep the existing zoom test, passing `{ p: KEY }`. (If the D Aeolian assumption is wrong for `Dm7` in F, take the scale name from `CHORD.title` in the assertions instead of hard-coding it.)

- [ ] **Step 2: Run, expect failures**

Run: `cd web && npx vitest run test/PentatonicLadder.test.ts`

- [ ] **Step 3: Implement**

`PentatonicLadder.vue` script:

```ts
import { glyphs, rootName, pcOf, type ChangesPentatonic, type PentatonicRank, type PentatonicRung } from '@chord-scale-maker/engine'

/** a Changes label and its popover: a key area's ladder (one row a rung, ♭ then ♯) or a chord's ranking (one row a rank); a pick covers the label's run */
const props = defineProps<{ p: ChangesPentatonic }>()
const emit = defineEmits<{ pick: [written: number]; reset: [] }>()
const longName = computed(() => glyphs(`${rootName(props.p.root)} minor`))
const mine = computed(() => (props.p.picked ? ', your pick' : ''))
const ariaLabel = computed(() => props.p.basis === 'chord'
  ? `Pentatonic: ${longName.value}, rank ${props.p.rank}, ${props.p.shared} of 5 notes in ${props.p.scale}${mine.value}. Show the ranking`
  : `Pentatonic: ${longName.value}, ${props.p.shared} of 5 notes in ${props.p.key}${mine.value}. Show the ladder`)
type Row = Readonly<{ key: string; head: string; picks: readonly (PentatonicRung | PentatonicRank)[] }>
const rows = computed((): readonly Row[] => props.p.basis === 'chord'
  ? props.p.ranking.map((r) => ({ key: `r${r.rank}`, head: `${r.rank} · ${r.shared} shared`, picks: [r] }))
  : [0, 1, 2, 3, 4, 5, 6].map((rung) => {
      const picks = props.p.ladder.filter((x) => x.rung === rung)
      return { key: `g${rung}`, head: `${rung === 0 ? 'Home' : rung === 6 ? '6 Outside' : rung} · ${picks[0]?.shared ?? 0}`, picks }
    }))
const isCurrent = (x: PentatonicRung | PentatonicRank): boolean => x.name === props.p.name
function pick(x: PentatonicRung | PentatonicRank, close: () => void): void {
  emit('pick', pcOf(x.root))
  close()
}
function reset(close: () => void): void {
  emit('reset')
  close()
}
```
(keep `shift`, `pageZoom`, `place` as they are.)

Template: button `:aria-label="ariaLabel"`, class list as today plus `p.picked ? 'decoration-solid decoration-note-600' : 'decoration-dotted'` (move `decoration-dotted` out of the static list), text `{{ p.label }}`. Panel `:aria-label="p.title"`, `<p>{{ p.title }}</p>`. `<li v-for="r in rows" :key="r.key">` with `<span>{{ r.head }}</span>` and the buttons over `r.picks` (`:key="x.name"`, `r.picks.length === 1 && 'col-span-2'` as today). After the `ul`:

```vue
<button v-if="p.picked" type="button" data-reset class="mt-1 w-full rounded-control px-2 py-1 text-left text-xs text-zinc-600 hover:bg-note-50 dark:text-zinc-300 dark:hover:bg-white/5" @click="reset(close)">Reset to {{ p.basis === 'chord' ? 'the sheet’s rank' : 'the path' }}</button>
```

`ChangesSystem.vue`:
- emit type: `pentatonic: [run: readonly ChordAt[], written: number | null]` (import `ChordAt`).
- label span: `tint(m.p.level)`, keep `:data-section="m.p.section"`, add `:data-chord="m.p.chord"`; `<PentatonicLadder class="print:hidden" :p="m.p" @pick="emit('pentatonic', m.p.run, $event)" @reset="emit('pentatonic', m.p.run, null)" />`.
- `tint` and the contour test `props.pentatonic?.counts`; counts now also come from the chord basis and picks. Add a prop `counted?: boolean` (passed by `ChangesSheet`, below) and use `props.counted` in `tint`, in `contourLines` and in the contour div's `v-if`. Update the comment over the contour div.

`ChangesSheet.vue`:
- emit type as ChangesSystem's; pass through `@pentatonic="(run, w) => emit('pentatonic', run, w)"`.
- compute `counted` as `!!props.pentatonic && (props.pentatonic.counts || props.pentatonic.basis === 'chord' || built.value.lines.some((l) => l.bars.some((b) => b.chords.some((c) => c.pentatonic?.picked))))`, the same rule as the engine's post-pass (Task 1), and pass `:counted="counted"` to each `ChangesSystem`. `contour` becomes `counted.value ? pentatonicContour(sheet.value.lines) : null`.

`EditorView.vue`:

```ts
const pentPicks = usePentatonicPicks(props.practiceKey)
watch([pentPath.path, prefs.pentRung, prefs.pentSide, prefs.pentRank, prefs.pentBasis], () => pentPicks.clear())
const pentatonicPlan = computed((): PentatonicPlan | null => (pentatonicsOn && prefs.pentatonics.value
  ? { ...pentPath.plan.value, basis: prefs.pentBasis.value, rank: prefs.pentRank.value, picks: pentPicks.picks.value }
  : null))
/** a label's popover (#272): a pick (written for the part) covers its run, stored concert; null resets the run */
function onPentatonic(run: readonly ChordAt[], written: number | null): void {
  if (written === null) pentPicks.reset(run)
  else pentPicks.pick(run, concertPc(part.value, written))
}
```
(use the editor's current `Part` ref; find its name where `buildChanges`' part is passed to `ChangesSheet`.) Template: `@pentatonic="onPentatonic"`. Beside both `pentPath.carryTo(\`mine:${id}\`)` calls add `pentPicks.carryTo(\`mine:${id}\`)`.

- [ ] **Step 4: Run, expect pass**

Run: `make test && make lint`
Expected: PASS (typecheck catches any leftover `setSection` / old props).

- [ ] **Step 5: Commit**

```bash
git add web/app/components/PentatonicLadder.vue web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/app/components/EditorView.vue web/test/PentatonicLadder.test.ts
git commit -m "Pentatonics: a label's popover picks for its run, with Reset; chord rankings (#272)"
```

---

### Task 6: Browser tests, print, docs

**Files:**
- Modify: `web/e2e/pentatonics.spec.ts`, `web/e2e/print.spec.ts`, `docs/design.md`

- [ ] **Step 1: Update existing e2e for the new behaviour**

In `pentatonics.spec.ts`:
- First test: dialog name `'A1 · G minor pentatonic ladder'`; after the pick expect `Fm♪ 4` and the Path listbox still `One rung` (not Custom): `await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('One rung')`.
- "a pick in one section’s ladder changes that section only" → rename "a pick changes its label’s run only, and Reset restores it": same setup (Satin Doll, Fifths), but compare by `[data-chord]` and expect exactly the clicked label's text to change; Path stays `Fifths`; then reopen the label, click `[data-reset]`, and expect the texts to equal `before`.

```ts
test('a pick changes its label’s run only, and Reset restores it', async ({ page }) => {
  await page.goto('/song/satin-doll')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await choosePath(page, 'Fifths')
  const texts = async () => page.locator('[data-slot="pentatonic"] [data-chord]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-chord')}: ${e.textContent}`))
  const before = await texts()
  const target = sectionLabels(page, 'B').first()
  await target.click()
  await page.getByRole('dialog', { name: /^B · / }).locator('li').first().locator('[data-pent]').click() // Home
  await expect(target).toHaveText(/♪ 5$/)
  const after = await texts()
  expect(after.filter((t, i) => t !== before[i])).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toContainText('Fifths')
  await target.click()
  await page.locator('[data-reset]').click()
  await expect.poll(texts).toEqual(before)
})
```

- [ ] **Step 2: New e2e**

```ts
test('Ranked against Chord follows each chord: Waltz for Debby’s first bars', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await page.getByRole('radio', { name: 'Chord' }).click() // the Ranked against control; adjust to SegmentedControl's role
  await expect(page.getByRole('button', { name: 'Pentatonic path' })).toHaveCount(0)
  const firstLine = page.locator('[data-slot="system"]').first().locator('[data-slot="pentatonic"] button')
  await expect.poll(async () => (await firstLine.allTextContents()).slice(0, 3)).toEqual(['Gm♪ 5', 'Dm♪ 5', 'Gm♪ 5']) // bars 1–3; bar 4's C7 repeats Gm
  await pickOption(page, 'Pentatonic rank', '12 · farthest')
  await expect(firstLine.first()).toHaveText(/♪ 0$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pentatonic rank' })).toContainText('12 · farthest')
})

test('a pick is per chart, kept over a reload, and cleared by a change of Rank', async ({ page }) => {
  await page.goto('/song/waltz-for-debby')
  await chooseSheet(page, 'Changes')
  await showPentatonics(page)
  await page.getByRole('radio', { name: 'Chord' }).click()
  const second = page.locator('[data-slot="pentatonic"] [data-chord]').nth(1)
  await second.locator('button').click()
  await page.getByRole('dialog', { name: /pentatonic ranking$/ }).locator('li').nth(2).locator('[data-pent]').click() // rank 3
  const picked = await second.textContent()
  await page.reload()
  await expect(second).toHaveText(picked!)
  await expect(second.locator('button')).toHaveAttribute('aria-label', /your pick/)
  await pickOption(page, 'Pentatonic rank', '2')
  await expect(second.locator('button')).not.toHaveAttribute('aria-label', /your pick/)
})
```
(Check `pickOption`'s signature in `fixtures.ts` and the SegmentedControl's accessible role; in the phone test add `await expect(page.getByRole('radio', { name: 'Chord' })).toBeVisible()` inside the Controls dialog.)

- [ ] **Step 3: Print** — in `print.spec.ts`, beside the worst case "prints the Changes with a guide tone line and the Pentatonics row…", add the same test with the chord basis on (click `Chord` after `showPentatonics`) and the same page-count expectation. Measure: if it adds a page, stop and report (spec: the row must cost no line).

- [ ] **Step 4: Run**

Run: `make e2e`
Expected: all pass.

- [ ] **Step 5: Docs** — `docs/design.md` §Pentatonics on Changes: add a bullet

```markdown
- **Ranked against** (#272, [spec](superpowers/specs/2026-10-14-pentatonic-per-chord-design.md)): Key (the area's
  ladder, as above) or Chord (each chord ranks the 12 against its own scale, `pentatonicRanking`, at one Rank 1–12 for
  the sheet; counts, tints and the contour by shared count, `level`). Preferences `csm-pent-basis`, `csm-pent-rank`.
- **Picks** (#272): a label's popover pick covers its `run` (that chord and those its label stands for), stored as
  the concert root per drawn chord (`ChordAt`) in `csm-pent-picks:<slug>`; cleared by any change of Path, Rung, Side,
  Rank or basis; Reset in the popover. A pick no longer makes the path Custom (a stored Custom still plays).
```
and fix any sentence there that says a pick sets the section's rung.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/pentatonics.spec.ts web/e2e/print.spec.ts docs/design.md
git commit -m "Pentatonics per chord: browser tests, print check, design notes (#272)"
```

---

## Verification (before the PR)

`make test`, `make lint`, `make e2e`, `make golden` (no diff). Then push `-u origin pentatonic-per-chord` and open the PR (`Closes #272`).
