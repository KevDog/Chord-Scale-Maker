# Clefs and key signatures: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the scale, guide tone and Changes sheets draw a clef and the tune's key signature (written for the
instrument) at the start of every line, change it at an `@key`, and give notes accidentals only where they leave the
key. Behind a `keySignatures` flag (off).

**Architecture:** pure engine first — which key each row is in (`rowKeys`), the written VexFlow key spec
(`keySignature`) and the measure rule for accidentals (`accidentalsInBar`) — then the three sheet builders carry a
`keySig` (and, for scales, `accidentals`), then the VexFlow drawing uses them, wired through the components behind
the flag. With the flag off nothing changes.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 4 / Vue 3, VexFlow 5 (`stave.addKeySignature(spec, cancelSpec?)`),
Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-key-signatures-design.md`

## Global Constraints

- Run commands from `web/`; vitest has no `--project` flag here (`npx vitest run <file>`). `make test`, `make lint`
  (repo root) before each commit; `make e2e` in Task 5.
- `web/engine/` stays free of Vue/DOM imports. With the `keySignatures` flag off, every sheet draws exactly as today.
- `fixtures/golden.json` and `fixtures/analysis.json` must not change (they don't serialise the new fields); if they
  do, stop and report.
- Minor keys use the relative major's signature; no `key:` → no signature; signatures change only at `@key`.
- TDD; stage files by name; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A key that would need a signature VexFlow lacks (`A#`, `Fb`, `D#` major…) — `keySignature` must spell it
   (`simplifyRoot`), never hand VexFlow an unknown spec. *Task 1.*
2. The measure rule: two notes on the same letter and octave in one bar (half-whole diminished: E♭ then E♮) — the
   second needs its natural; the same letter an octave apart is independent. *Task 1.*
3. A transposing instrument: concert E♭ tune on tenor (B♭) → F major signature, and the scale notes' accidentals are
   judged against the written signature, not the concert one. *Tasks 1, 3.*
4. A chart with no `key:` and the flag on: no signature, today's accidentals, no crash. *Tasks 3, 4.*
5. An `@key` mid-system on the guide tone / Changes sheet: the new signature appears at that bar and the bars still
   line up with the HTML labels (xs come from the drawing). *Task 4.*

---

### Task 1: `engine/keySignature.ts`

**Files:** Create `web/engine/keySignature.ts`; modify `web/engine/index.ts` (`export * from './keySignature'`);
test `web/engine/__tests__/keySignature.test.ts`.

**Produces:** `keySignature(key: Key | null, part: Part): string | null`;
`signatureAccidentals(spec: string | null): ReadonlyMap<Letter, number>`;
`type BarNote = Readonly<{ letter: Letter; acc: number; octave: number; tiedIn?: boolean }>`;
`accidentalsInBar(notes: readonly BarNote[], spec: string | null): (string | null)[]`;
`octaveOf(p: Pitched): number` (the octave VexFlow uses: `toVexKey`'s number).

- [ ] **Step 1: failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { type Key, parseKey } from '../analysis/keys'
import { accidentalsInBar, keySignature, octaveOf, signatureAccidentals } from '../keySignature'
import { CONCERT, partFor } from '../part'

const key = (t: string): Key => parseKey(t) ?? (() => { throw new Error(t) })()

describe('keySignature', () => {
  it('writes the key for the part, minor keys by their relative major', () => {
    expect(keySignature(key('Eb'), CONCERT)).toBe('Eb')
    expect(keySignature(key('Eb'), partFor('tenor'))).toBe('F')
    expect(keySignature(key('Eb'), partFor('alto'))).toBe('C')
    expect(keySignature(key('Gm'), CONCERT)).toBe('Bb')
    expect(keySignature(key('Gm'), partFor('trumpet'))).toBe('C')
    expect(keySignature(key('F#'), CONCERT)).toBe('F#')
    expect(keySignature(key('Gb'), CONCERT)).toBe('Gb')
    expect(keySignature(null, CONCERT)).toBeNull()
  })

  it('never names a signature VexFlow lacks', () => {
    expect(keySignature(key('A#'), CONCERT)).toBe('Bb')
    expect(keySignature(key('D#'), CONCERT)).toBe('Eb')
    expect(keySignature(key('B'), partFor('tenor'))).toBe('Db') // C# major has 7 sharps; Db 5 flats
  })
})

describe('signatureAccidentals', () => {
  it('lists the letters a signature alters', () => {
    expect([...signatureAccidentals('Eb')].sort()).toEqual([[2, -1], [5, -1], [6, -1]]) // E, A, B
    expect([...signatureAccidentals('D')].sort()).toEqual([[0, 1], [3, 1]]) // C#, F#
    expect(signatureAccidentals('C').size).toBe(0)
    expect(signatureAccidentals(null).size).toBe(0)
  })
})

describe('accidentalsInBar', () => {
  it('shows only what leaves the key: D Dorian in Eb needs just the B natural', () => {
    // D E F G A B C (octave 4)
    const notes = [1, 2, 3, 4, 5, 6, 0].map((letter, i) => ({ letter: letter as 0, acc: 0, octave: i === 6 ? 5 : 4 }))
    expect(accidentalsInBar(notes, 'Eb')).toEqual([null, 'n', null, null, 'n', 'n', null])
  })

  it('keeps an accidental in force through the bar on its line and octave only', () => {
    // half-whole from C: C Db Eb E F# G A Bb — E after Eb needs its natural
    const n = (letter: number, acc: number, octave = 4) => ({ letter: letter as 0, acc, octave })
    expect(accidentalsInBar([n(2, -1), n(2, 0)], 'C')).toEqual(['b', 'n'])
    expect(accidentalsInBar([n(2, -1), n(2, -1, 5)], 'C')).toEqual(['b', 'b'])
    expect(accidentalsInBar([n(2, -1), n(2, -1)], 'C')).toEqual(['b', null])
  })

  it('shows nothing on a note tied in from the bar before', () => {
    expect(accidentalsInBar([{ letter: 6, acc: 0, octave: 4, tiedIn: true }], 'F')).toEqual([null])
  })

  it('reads a pitched note the way VexFlow places it', () => {
    expect(octaveOf({ letter: 0, acc: 0, midi: 60 })).toBe(4)
    expect(octaveOf({ letter: 6, acc: 1, midi: 72 })).toBe(4) // B#4 sounds as C5
  })
})
```

Check the tenor/alto/trumpet instrument names against `INSTRUMENTS` in `engine/instruments.ts` and use the real ids.

- [ ] **Step 2:** run, see it fail (module missing).
- [ ] **Step 3: implement**

```ts
import { tonicOf } from './analysis/functions'
import type { Key } from './analysis/keys'
import { type Part, type Pitched, writtenRoot } from './part'
import { accText, type Letter, NAT_PC, parseRoot, rootName, shiftBy } from './pitch'
import { SCALES, simplifyRoot, spellFrom } from './scales'

/**
 * Key signatures (docs/superpowers/specs/2026-10-10-key-signatures-design.md): the tune's key written for a part as
 * VexFlow names it, the letters it alters, and which notes then need an accidental (the measure rule).
 */

/** the VexFlow major-key spec for the key as written for the part (a minor key by its relative major); null: none */
export function keySignature(key: Key | null, part: Part): string | null {
  if (!key) return null
  const tonic = tonicOf(key)
  const major = key.minor ? shiftBy(tonic, 2, 3) : tonic
  return rootName(simplifyRoot(writtenRoot(part, major, 'ionian'), 'ionian'))
}

/** the letters a signature alters, and by how much (Eb: E, A and B a flat) */
export function signatureAccidentals(spec: string | null): ReadonlyMap<Letter, number> {
  if (!spec) return new Map()
  return new Map(spellFrom(parseRoot(spec), SCALES.ionian[0]).filter((n) => n.acc !== 0).map((n) => [n.letter, n.acc]))
}

export type BarNote = Readonly<{ letter: Letter; acc: number; octave: number; tiedIn?: boolean }>

/** each note's printed accidental ('#', 'b', 'n', '##', 'bb') or null: shown where it differs from what's in force */
export function accidentalsInBar(notes: readonly BarNote[], spec: string | null): (string | null)[] {
  const sig = signatureAccidentals(spec)
  const inForce = new Map<string, number>()
  return notes.map((n) => {
    const place = `${n.letter}/${n.octave}`
    const current = inForce.get(place) ?? sig.get(n.letter) ?? 0
    inForce.set(place, n.acc)
    if (n.tiedIn || n.acc === current) return null
    return n.acc === 0 ? 'n' : accText(n.acc)
  })
}

/** the octave number VexFlow writes for a spelled pitch (middle C = 4; B#4 sounds as C5) */
export const octaveOf = (p: Pitched): number => (p.midi - NAT_PC[p.letter] - p.acc) / 12 - 1
```

(`writtenRoot` must be exported from `part.ts` — it is; if `spellFrom`'s note type lacks `letter`, adapt.)

- [ ] **Step 4:** tests pass; `make test`, `make lint`.
- [ ] **Step 5:** commit "Engine: key signatures for a part, and the measure rule for accidentals".

---

### Task 2: `rowKeys(doc)`

**Files:** modify `web/engine/analysis/index.ts`, `web/engine/notes.ts` (re-export `rowKeys` and `type Key`); test
`web/engine/__tests__/notes.test.ts`.

**Produces:** `rowKeys(doc: ChartDoc): readonly (Key | null)[]`, one per `expandRowLines(doc)` row.

- [ ] **Step 1: failing tests** (append to notes.test.ts; import `rowKeys`)

```ts
describe('rowKeys', () => {
  const names = (text: string) => rowKeys(parseChart(text).value).map((k) => k?.name ?? null)
  it("gives every row the chart's key, an @key's from its bar until the next", () => {
    expect(names('title: T\nkey: Eb\nA | 1 | EbMaj7\nB | 2 | DMaj7\nB | 3 | Em7\nC | 4 | EbMaj7\n@key B 2 D\n@key C 4 Eb\n')).toEqual([
      'Eb major', 'D major', 'D major', 'Eb major',
    ])
  })
  it('ignores key areas the analyser only found', () => {
    const body = readFileSync('../charts/body_and_soul.txt', 'utf8')
    expect(new Set(names(body))).toEqual(new Set(['Db major']))
  })
  it('is null without a key: line', () => {
    expect(names('title: T\nA | 1 | Cm7\n')).toEqual([null])
  })
})
```

(`readFileSync` from `node:fs`; add the import if missing. If body_and_soul's `key:` line reads differently, use its
real key name.)

- [ ] **Step 2:** run, fail.
- [ ] **Step 3: implement** in `analysis/index.ts` (after `functionChoices`; `meta` and `prepare` are in scope):

```ts
/** each expanded row's key for its key signature: the @key in force there, else the chart's key:, else null */
export function rowKeys(doc: ChartDoc): readonly (Key | null)[] {
  const home = parseKey(meta(doc, 'key'))
  const out: (Key | null)[] = expandRowLines(doc).value.map(() => home)
  const p = prepare(doc)
  if (p.global === null) return out
  p.stream.forEach((e, i) => {
    if (p.areaStated[i]) for (const r of e.rows) out[r] = p.areaKeys[i] ?? home
  })
  return out
}
```

In `notes.ts`: `export { rowKeys } from './analysis'` and `export type { Key } from './analysis/keys'` (check
`engine/index.ts` doesn't already export a `Key` name; if it does, export as `type ChartKey`).

- [ ] **Step 4:** pass; `make test`, `make lint`. **Step 5:** commit "Engine: each row's key for its signature".

---

### Task 3: the sheet builders carry their signatures

**Files:** modify `web/engine/sheet.ts`, `web/engine/guideTones.ts`, `web/engine/changes.ts`; tests in
`web/engine/__tests__/sheet.test.ts`, `guideTones.test.ts`, `changes.test.ts`.

**Produces:**
- `StaffModel` gains `keySig: string | null` and `accidentals: readonly (string | null)[]` (one per note);
  `buildSheet(rows, part, choice, startText, perPage, practice = null, keys?: readonly (Key | null)[])`. With `keys`:
  `keySig = keySignature(keys[i] ?? null, part)`, `accidentals = accidentalsInBar(notes → {letter, acc,
  octave: octaveOf(n)}, keySig)`; the staff `id` includes `keySig`. Without `keys`: `keySig: null`, `accidentals`
  = today's rule (`n.acc ? accText(n.acc) : null`). Error staves: `accidentals: []`.
- `GuideBar` gains `keySig: string | null`; `buildGuideTones(rows, part, barsPerSystem, beats, keys?)`: a bar's key is
  that of the first event starting in it (`rows.indexOf(e.row)`), else the previous bar's (bar 0: `keys[0]`);
  `keySig = keySignature(that, part)`. Without `keys`: null.
- `ChangesBar` gains `keySig: string | null`; `buildChanges(doc, part, barsPerLine = 4, signatures = false)` does the
  same from `rowKeys(doc)` when `signatures`. Without: null.

- [ ] **Step 1: failing tests**

```ts
// sheet.test.ts
it('with keys, gives each staff its written signature and only the accidentals that leave it', () => {
  const rows = [{ section: 'A', bar: '1', chord: 'Dm7', scale: 'D Dorian' }]
  const [staff] = buildSheet(rows, CONCERT, 'root', 'C', 12, null, [parseKey('Eb')]).flatMap((p) => p.pages.flat())
  expect(staff?.keySig).toBe('Eb')
  expect(staff?.notes.map((n, i) => (staff.accidentals[i] ?? '') + 'CDEFGAB'[n.letter])).toEqual(['D', 'nE', 'F', 'G', 'nA', 'nB', 'C'])
  const [plain] = buildSheet(rows, CONCERT, 'root', 'C', 12).flatMap((p) => p.pages.flat())
  expect([plain?.keySig, plain?.accidentals.every((a) => a === null)]).toEqual([null, true])
})
it('writes the signature for a transposing part', () => {
  const rows = [{ section: 'A', bar: '1', chord: 'EbMaj7', scale: 'Eb Ionian' }]
  const [staff] = buildSheet(rows, partFor('tenor'), 'root', 'C', 12, null, [parseKey('Eb')]).flatMap((p) => p.pages.flat())
  expect([staff?.keySig, staff?.accidentals.every((a) => a === null)]).toEqual(['F', true]) // F Ionian in F: no accidentals
})
```

```ts
// guideTones.test.ts
it('gives each bar the key in force, changing at the bar an @key starts', () => {
  const rows = [
    { section: 'A', bar: '1', chord: 'EbMaj7', scale: '' },
    { section: 'B', bar: '2', chord: 'DMaj7', scale: '' },
    { section: 'B', bar: '3', chord: 'Em7', scale: '' },
  ]
  const sheet = buildGuideTones(rows, CONCERT, 4, 4, [parseKey('Eb'), parseKey('D'), parseKey('D')])
  expect(sheet.systems.flatMap((s) => s.bars.map((b) => b.keySig))).toEqual(['Eb', 'D', 'D'])
  expect(buildGuideTones(rows, CONCERT).systems[0]?.bars[0]?.keySig).toBeNull()
})
```

```ts
// changes.test.ts
it('with signatures, gives each bar its written key, changing at an @key', () => {
  const doc = parseChart('title: T\nkey: Eb\nA | 1 | EbMaj7\nB | 2 | DMaj7\n@key B 2 D\n').value
  const bars = buildChanges(doc, partFor('tenor'), 4, true).lines.flatMap((l) => l.bars)
  expect(bars.map((b) => b.keySig)).toEqual(['F', 'E'])
  expect(buildChanges(doc, CONCERT).lines[0]?.bars[0]?.keySig).toBeNull()
})
```

(Use the real tenor instrument id; import `parseKey` from `../analysis/keys`, `partFor`/`CONCERT` from `../part`.
Adapt row shapes to `Row`. If `buildChanges` emits filler bars, filter to bars with chords.)

- [ ] **Step 2:** fail. **Step 3:** implement as specified. **Step 4:** pass; `make test` (golden unchanged),
  `make lint`. **Step 5:** commit "Sheets carry their key signatures".

---

### Task 4: drawing, the flag, and wiring

**Files:** modify `web/app/utils/vexflow.ts`, `web/app/utils/guideToneDrawing.ts`, `web/app/utils/changesDrawing.ts`,
`web/app/components/{EditorView,ScaleSheet,GuideToneSheet,ChangesSheet,ChangesSystem}.vue`, `web/nuxt.config.ts`,
`web/app/composables/useFeature.ts`, `web/package.json` (e2e script), tests `web/test/features.test.ts` and the
sheet component tests.

**Behaviour:**
- **Flag:** `keySignatures: false` in `nuxt.config.ts` features (comment: clefs and key signatures on every sheet,
  spec path; off until reviewed), `Feature` gains `'keySignatures'`, the `e2e` script gains
  `NUXT_PUBLIC_FEATURES_KEY_SIGNATURES=true`, `features.test.ts` expects `keySignatures: false`.
- **Wiring:** `EditorView` computes `keys = useFeature('keySignatures') ? rowKeys(editor.doc.value) : undefined` and
  passes it as a `keys` prop to `ScaleSheet` and `GuideToneSheet`, which pass it to `buildSheet` / `buildGuideTones`;
  it passes `signatures` (the flag) to `ChangesSheet`, which calls `buildChanges(doc, part, barsPerLine, signatures)`
  and passes the part's clef down to `ChangesSystem` → `drawChangesLine(…, { …, clef })` only when the flag is on.
  The practice `buildSheet` call in EditorView (line ~261) needs no keys.
- **Scale staff** (`drawStaff`): if `staff.keySig`, `stave.addClef(clef).addKeySignature(staff.keySig)`; each note's
  modifier from `staff.accidentals[i]` (`new vf.Accidental(a)` when non-null). Without `keySig`, today's code path
  exactly (it equals `accidentals` from today's rule, so using `staff.accidentals` in both paths is fine).
- **Guide tone system:** when `system.bars.some((b) => b.keySig !== null)`:
  - lead: measure with a probe — `new vf.Stave(0, 0, 400)` with the clef, the first bar's `keySig` and (if
    `opts.timeSignature`) the time signature; `lead = probe.getNoteStartX() - new vf.Stave(0, 0, 400).getNoteStartX()`
    plus the same small padding the current CLEF_SPACE gives; use it instead of `CLEF_SPACE + TIME_SPACE`.
  - bar 0: clef + `keySig` (+ time); a bar whose `keySig` differs from the previous bar's gets
    `addKeySignature(keySig, previousKeySig)` and extra width equal to that signature's measured width (probe again),
    taken from the other bars' shares so the total stays `BAR_UNITS * barsPerSystem`.
  - accidentals per bar and line: `accidentalsInBar(notes → {letter, acc, octave: octaveOf(pitch), tiedIn}, bar.keySig)`
    for pitched notes (rests skipped), replacing the inline `shown` map.
  - otherwise: today's code path exactly.
- **Changes line:** when `opts.clef` is given: bar 0 gets the clef and, if `bar.keySig`, the signature (lead measured
  by probe as above, plus `TIME_SPACE` logic as today); a mid-line bar whose `keySig` changes gets the new signature
  and extra width as above. Slashes still sit on the middle line. Without `opts.clef`: today exactly.

- [ ] **Step 1: failing tests** — component-level, flag on (set `useRuntimeConfig().public.features.keySignatures =
  true`, restore after): `ScaleSheet`/`GuideToneSheet` receive `keys` from `EditorView` (assert the prop on the
  stubbed/child component, the way existing EditorView tests find `ScaleSheet`); with the flag off the prop is
  undefined. `features.test.ts` expects `keySignatures: false`. (Drawing itself is covered by e2e in Task 5 — the
  drawing code may stay e2e-gated per the project's TDD note.)
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** `make test`, `make lint`. **Step 5:** commit "Draw clefs and
  key signatures on every sheet (keySignatures flag)".

---

### Task 5: browser test and docs

**Files:** `web/e2e/` (a new `key-signatures.spec.ts`), `README.md` (one line under Instruments or the sheets),
`docs/design.md` §5 Rendering (a short "Clefs and key signatures" paragraph).

- [ ] **Step 1: e2e** (flag on in the e2e build): open `/song?chart=misty` (key: Eb):
  - Scales sheet: the first staff's SVG contains a key signature — VexFlow draws a group with class
    `vf-keysignature` (check the actual class name in a debug run); assert `svg .vf-keysignature` count ≥ 1 in the
    first staff.
  - Guide tones sheet and Changes sheet: the first system/line likewise has `.vf-keysignature` and a clef
    (`.vf-clef`).
  - Choose Tenor: the signature changes (F major: one flat glyph — assert the key signature group's glyph count
    changes, or compare the aria/structure before and after).
  - A chart with an `@key` (fill the editor text with a 3-bar chart with `@key B 2 D`) on the Changes sheet: two
    key signature groups on the first line.
- [ ] **Step 2:** `make e2e` — all pass (existing suites unchanged). Fix the app, not the test, if it fails.
- [ ] **Step 3:** docs. **Step 4:** `make test`, `make lint`, `make e2e`. **Step 5:** commit "Key signatures: browser
  test and docs".
