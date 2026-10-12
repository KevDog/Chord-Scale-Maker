# Arpeggios sheet: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a third sheet, Arpeggios: each Scales sheet line as an eighth-note arpeggio, 7th Chord or Extended (tensions from the scale), Up / Down / Up & down.

**Architecture:** pure engine module `engine/src/arpeggioSheet.ts` (tensions, one line's notes and beam groups, the sheet model, reusing #189's `scaleLines`); share link fields in `share.ts`; app: a sheet kind, two stored preferences, controls, `ArpeggioSheet.vue` / `ArpeggioStaff.vue` and a VexFlow `drawArpeggioStaff`.

**Tech Stack:** TypeScript (strict), Vitest, Vue 3 / Nuxt 4, VexFlow, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-arpeggios-sheet-design.md` (issue #188).

**Prerequisite:** #189 (`docs/superpowers/plans/2026-10-12-scale-lines.md`) merged: `scaleLines`, `ScaleLine`, `StaffModel.chords`.

## Global Constraints

- Behind the existing `arpeggios` flag (off; e2e builds with it on); no new flag.
- `engine/` has no Vue/DOM/VexFlow imports; the app imports only `@chord-scale-maker/engine`.
- Lines = `scaleLines` (same as the Scales sheet), same label column.
- Notes: eighths, no time signature, one beam per group (chord tones; tensions), 12 lines a printed page.
- Storage keys `csm-arp-notes` (`seventh`|`extended`, default `seventh`), `csm-arp-dir` (`up`|`down`|`up-down`, default `up`).
- Share view fields `sheet: 'arpeggios'`, `arpNotes`, `arpDir`.
- Labels: "7th Chord", "Extended"; "Up", "Down", "Up & down"; group label "Arpeggio"; listbox `aria-label="Arpeggio direction"`.
- `make test` green after every task; `make lint`, `make e2e` green at the end. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage by name.

## Review Focus

- **Extended on a line without a scale** ("Choose a scale"): 7th Chord still draws, Extended shows the error — Task 2 test.
- **A share link with `sheet: 'arpeggios'` while the flag is off**: opens the default sheet, no blank preview — Task 5 test (`firstSheet`).
- **Bass clef and transposing instruments**: the run stays in the instrument's range (`placeRun`) — Task 2 test with trombone and a Bb part.
- **Up & down at 390px wide** (13 eighths, Extended): no horizontal scroll, heads don't collide — Task 6 e2e.
- **Switching 7th Chord ↔ Extended or direction** redraws every staff (ids change) — Task 3 test.

---

### Task 1: `tensionsOf`

**Files:** Create `engine/src/arpeggioSheet.ts`; Test `engine/src/__tests__/arpeggioSheet.test.ts`.

**Interfaces:**
- Produces: `export function tensionsOf(part: Part, chord: string, scale: string, tones: readonly Spelled[]): readonly Spelled[]` — the scale's notes (written for the part) whose pitch class isn't in `tones`, ordered by compound degree, then by semitones above the chord root.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { arpeggioTones } from '../arpeggios'
import { CONCERT } from '../part'
import { rootName } from '../pitch'
import { tensionsOf } from '../arpeggioSheet'

const names = (chord: string, scale: string): string[] =>
  tensionsOf(CONCERT, chord, scale, arpeggioTones(CONCERT, chord, scale) ?? []).map(rootName)

describe('tensionsOf', () => {
  it("stacks the scale's other notes as 9s, 11s, 13s", () => {
    expect(names('Cm7', 'C Dorian')).toEqual(['D', 'F', 'A'])
    expect(names('G7', 'G Altered')).toEqual(['Ab', 'Bb', 'C#', 'Eb'])
    expect(names('C7', 'C Half-Whole')).toEqual(['Db', 'Eb', 'F#', 'A'])
    expect(names('CMaj7', 'C Lydian')).toEqual(['D', 'F#', 'A'])
  })

  it('works for scales that are not seven notes', () => {
    expect(names('CMaj7', 'C Major Pentatonic')).toEqual(['D', 'A'])
    expect(names('C7', 'C Blues')).toEqual(['Eb', 'F', 'Gb']) // #9, 11, #11
  })

  it("puts a triad's or a 6 chord's 7th first", () => {
    expect(names('C', 'C Ionian')).toEqual(['B', 'D', 'F', 'A'])
    expect(names('C6', 'C Ionian')).toEqual(['B', 'D', 'F'])
  })

  it('spells for the part', () => {
    expect(tensionsOf({ clef: 'treble', trans: 'Bb' }, 'Cm7', 'C Dorian', arpeggioTones({ clef: 'treble', trans: 'Bb' }, 'Cm7', 'C Dorian') ?? []).map(rootName)).toEqual(['E', 'G', 'B'])
  })
})
```

- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/arpeggioSheet.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { writtenChordRootLenient } from './chord'
import { intervalLabels } from './intervals'
import { type Part, writtenScale } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import { resolveQuality } from './qualities'

/**
 * The Arpeggios sheet (docs/superpowers/specs/2026-10-12-arpeggios-sheet-design.md): each scale line as an arpeggio,
 * the 7th chord or, Extended, the 7th chord then the scale's other notes as tensions. Pure; no DOM.
 */

/** a leftover note's place above the chord: its interval label as a compound degree (a 2 is a 9, a 3 sits between 9 and 11, a 7 comes first) */
const COMPOUND: Readonly<Record<string, number>> = { '1': 1, '9': 9, '2': 9, '3': 10, '11': 11, '4': 11, '5': 12, '13': 13, '6': 13, '7': 7 }
const compound = (label: string): number => COMPOUND[label.replace(/[b#]/g, '')] ?? 14

/** the scale's notes that aren't chord tones, written for the part, ordered as tensions (7, then 9s, 11s, 13s; lower first) */
export function tensionsOf(part: Part, chord: string, scale: string, tones: readonly Spelled[]): readonly Spelled[] {
  const root = writtenChordRootLenient(part, chord, scale)
  const chordPcs = new Set(tones.map(pcOf))
  const rest = writtenScale(part, scale).notes.filter((n) => !chordPcs.has(pcOf(n)))
  const labels = intervalLabels(root, rest, resolveQuality(chord)?.quality ?? null)
  return rest
    .map((n, i) => ({ note: { letter: n.letter, acc: n.acc }, deg: compound(labels[i] ?? ''), semis: mod(pcOf(n) - pcOf(root), 12) }))
    .sort((a, b) => a.deg - b.deg || a.semis - b.semis)
    .map((t) => t.note)
}
```
(`C Blues` is `1 b3 4 b5 5 b7`: its ♭5 labels `b5`, compound 12, so it sorts between the 11 and any 13.)

- [ ] **Step 4:** run → PASS. **Step 5:** commit `engine/src/arpeggioSheet.ts engine/src/__tests__/arpeggioSheet.test.ts`, "tensionsOf: a scale's other notes as tensions (#188)".

---

### Task 2: one line's notes, groups and placement

**Files:** Modify `engine/src/arpeggios.ts` (export `placeRun`), `engine/src/arpeggioSheet.ts`; Test `engine/src/__tests__/arpeggioSheet.test.ts`, `engine/src/__tests__/arpeggios.test.ts` (unchanged, must stay green).

**Interfaces:**
- Produces (arpeggios.ts): `export function placeRun(pcs: readonly number[], up: boolean, range: Range): readonly number[]` = today's `place(pcs, up, range, null)`; `place` keeps its signature and calls it for `prev === null`.
- Produces (arpeggioSheet.ts):
  ```ts
  export const ARP_NOTES = ['seventh', 'extended'] as const
  export type ArpNotes = (typeof ARP_NOTES)[number]
  export const ARP_DIRECTIONS = ['up', 'down', 'up-down'] as const
  export type ArpDirection = (typeof ARP_DIRECTIONS)[number]
  export const isArpNotes = (x: unknown): x is ArpNotes
  export const isArpDirection = (x: unknown): x is ArpDirection
  export const ARP_NOTES_LABELS: Readonly<Record<ArpNotes, string>> // { seventh: '7th Chord', extended: 'Extended' }
  export const ARP_DIRECTION_LABELS: Readonly<Record<ArpDirection, string>> // { up: 'Up', down: 'Down', 'up-down': 'Up & down' }
  export type ArpeggioLineNotes = Readonly<{ notes: readonly Pitched[]; groups: readonly number[] }>
  export function arpeggioLine(part: Part, chord: string, scale: string | null, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }>
  ```

- [ ] **Step 1: Failing tests** (append):

```ts
import { arpeggioLine, ARP_DIRECTION_LABELS, ARP_NOTES_LABELS, isArpDirection, isArpNotes } from '../arpeggioSheet'
import { rangeOf } from '../part'

const line = (chord: string, scale: string | null, notes: 'seventh' | 'extended', dir: 'up' | 'down' | 'up-down', part = CONCERT) => {
  const l = arpeggioLine(part, chord, scale, notes, dir)
  if ('error' in l) throw new Error(l.error)
  return l
}

describe('arpeggioLine', () => {
  it('plays the 7th chord up, down, and up and down without repeating the top', () => {
    expect(line('Cm7', 'C Dorian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb'])
    expect(line('Cm7', 'C Dorian', 'seventh', 'down').notes.map(rootName)).toEqual(['Bb', 'G', 'Eb', 'C'])
    const ud = line('Cm7', 'C Dorian', 'seventh', 'up-down')
    expect(ud.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'G', 'Eb', 'C'])
    expect(ud.groups).toEqual([4, 3])
  })

  it('adds the tensions above, beamed apart', () => {
    const up = line('Cm7', 'C Dorian', 'extended', 'up')
    expect(up.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'D', 'F', 'A'])
    expect(up.groups).toEqual([4, 3])
    expect(up.notes.every((n, i) => i === 0 || n.midi > (up.notes[i - 1]?.midi ?? 0))).toBe(true)
    expect(line('Cm7', 'C Dorian', 'extended', 'down').groups).toEqual([3, 4])
    const ud = line('Cm7', 'C Dorian', 'extended', 'up-down')
    expect(ud.notes).toHaveLength(13)
    expect(ud.groups).toEqual([4, 3, 2, 4])
  })

  it("plays a triad's root on top in 7th Chord mode", () => {
    expect(line('C', 'C Ionian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'E', 'G', 'C'])
  })

  it('needs a scale only for Extended', () => {
    expect(line('Cm7', null, 'seventh', 'up').notes).toHaveLength(4)
    expect(arpeggioLine(CONCERT, 'Cm7', null, 'extended', 'up')).toEqual({ error: 'Choose a scale' })
    expect(arpeggioLine(CONCERT, 'Xyz', 'C Dorian', 'seventh', 'up')).toEqual({ error: 'No chord tones for Xyz' })
  })

  it("keeps the run in the instrument's range", () => {
    for (const part of [{ clef: 'bass', trans: 'C' }, { clef: 'treble', trans: 'Bb' }] as const) {
      const r = rangeOf(part)
      const out = line('G7', 'G Altered', 'extended', 'up', part).notes.filter((n) => n.midi < r.lo || n.midi > r.hi)
      expect(out.length).toBeLessThanOrEqual(1)
    }
  })

  it('has labels and guards', () => {
    expect(Object.values(ARP_NOTES_LABELS)).toEqual(['7th Chord', 'Extended'])
    expect(Object.values(ARP_DIRECTION_LABELS)).toEqual(['Up', 'Down', 'Up & down'])
    expect([isArpNotes('extended'), isArpNotes('up'), isArpDirection('up-down'), isArpDirection('x')]).toEqual([true, false, true, false])
  })
})
```

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Export `placeRun`** in `engine/src/arpeggios.ts`: move the `prev === null` branch out:

```ts
/** a run's start: the octave with the fewest notes out of range, then the average nearest the centre (a tie: the higher) */
export function placeRun(pcs: readonly number[], up: boolean, range: Range): readonly number[] {
  return place(pcs, up, range, null)
}
```
(Keep `place` private and unchanged; `placeRun` is a named entry to its `prev === null` case.) Run `npx vitest run src/__tests__/arpeggios.test.ts` → still PASS.

- [ ] **Step 4: Implement `arpeggioLine`** in `engine/src/arpeggioSheet.ts` (add imports `arpeggioTones`, `placeRun` from `./arpeggios`; `rangeOf`, `type Pitched` from `./part`):

```ts
export const ARP_NOTES = ['seventh', 'extended'] as const
export type ArpNotes = (typeof ARP_NOTES)[number]
export const ARP_DIRECTIONS = ['up', 'down', 'up-down'] as const
export type ArpDirection = (typeof ARP_DIRECTIONS)[number]
export const isArpNotes = (x: unknown): x is ArpNotes => (ARP_NOTES as readonly unknown[]).includes(x)
export const isArpDirection = (x: unknown): x is ArpDirection => (ARP_DIRECTIONS as readonly unknown[]).includes(x)
export const ARP_NOTES_LABELS: Readonly<Record<ArpNotes, string>> = { seventh: '7th Chord', extended: 'Extended' }
export const ARP_DIRECTION_LABELS: Readonly<Record<ArpDirection, string>> = { up: 'Up', down: 'Down', 'up-down': 'Up & down' }

/** one line's notes, and the length of each beamed group in order */
export type ArpeggioLineNotes = Readonly<{ notes: readonly Pitched[]; groups: readonly number[] }>

/** one scale line's arpeggio: chord tones (a triad's root again on top in 7th Chord mode), Extended adds the tensions above */
export function arpeggioLine(part: Part, chord: string, scale: string | null, notes: ArpNotes, dir: ArpDirection): ArpeggioLineNotes | Readonly<{ error: string }> {
  const tones = arpeggioTones(part, chord, scale ?? undefined)
  if (!tones) return { error: `No chord tones for ${chord}` }
  if (notes === 'extended' && scale === null) return { error: 'Choose a scale' }
  const chordPart = notes === 'seventh' && tones.length === 3 ? [...tones, tones[0] as Spelled] : tones
  const upper = notes === 'extended' && scale !== null ? tensionsOf(part, chord, scale, tones) : []
  const run = [...chordPart, ...upper]
  const midi = placeRun(run.map(pcOf), true, rangeOf(part))
  const up: Pitched[] = run.map((n, i) => ({ letter: n.letter, acc: n.acc, midi: midi[i] ?? 0 }))
  const ups = upper.length ? [chordPart.length, upper.length] : [chordPart.length]
  if (dir === 'up') return { notes: up, groups: ups }
  const down = [...up].reverse()
  const downs = [...ups].reverse()
  if (dir === 'down') return { notes: down, groups: downs }
  return { notes: [...up, ...down.slice(1)], groups: [...ups, ...[(downs[0] ?? 1) - 1, ...downs.slice(1)].filter((g) => g > 0)] }
}
```

- [ ] **Step 5:** run → PASS (if `placeRun` puts Extended G7 Altered out of range by more than one note, check `place`'s rule rather than loosening the test). **Step 6:** `make test`. **Step 7:** commit `engine/src/arpeggios.ts engine/src/arpeggioSheet.ts engine/src/__tests__/arpeggioSheet.test.ts`, "arpeggioLine: one line's notes and beam groups (#188)".

---

### Task 3: the sheet model

**Files:** Modify `engine/src/arpeggioSheet.ts`, `engine/src/index.ts` (`export * from './arpeggioSheet'`), API snapshot; Test `engine/src/__tests__/arpeggioSheet.test.ts`.

**Interfaces:**
- Consumes: `scaleLines`, `ScaleLine` (#189), `chordTokensOrNull`, `scaleLabel`, `keySignature`, `accidentalsInBar`, `octaveOf`, `intervalLabels`, `chunk`, `qualityScale`.
- Produces:
  ```ts
  export type ArpeggioStaffModel = Readonly<{
    id: string; chords: readonly (readonly ChordToken[] | null)[]; scale: ScaleLabel | null
    notes: readonly Pitched[]; groups: readonly number[]; keySig: string | null; showClefAndKey: boolean
    accidentals: readonly (string | null)[]; intervals: readonly string[] | null; error: string | null; last: boolean
  }>
  export type ArpeggioSheetModel = Readonly<{ heading: string; pages: readonly (readonly ArpeggioStaffModel[])[] }>
  export function buildArpeggioSheet(rows: readonly Row[], part: Part, perPage: number, notes: ArpNotes, dir: ArpDirection, key?: Key | null, resolved?: ReadonlyMap<number, Resolved>): ArpeggioSheetModel
  ```

- [ ] **Step 1: Failing tests**:

```ts
import { readFileSync } from 'node:fs'
import { expandRows, parseChart, type Row } from '../chart'
import { resolveScales } from '../resolve'
import { buildSheet } from '../sheet'
import { buildArpeggioSheet } from '../arpeggioSheet'

const row = (chord: string, scale = ''): Row => ({ section: 'A', bar: '1', chord, scale })

describe('buildArpeggioSheet', () => {
  it("draws the Scales sheet's lines, with its labels", () => {
    const doc = parseChart(readFileSync(new URL('../../charts/autumn-leaves.txt', import.meta.url), 'utf8')).value
    const rows = expandRows(doc).value
    const resolved = resolveScales(doc, { level: 'standard', seed: 0 })
    const arp = buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up', undefined, resolved).pages.flat()
    const scales = buildSheet(rows, CONCERT, 'root', 'C', 12, null, undefined, resolved)[0]?.pages.flat() ?? []
    expect(arp.map((s) => [s.chords, s.scale])).toEqual(scales.map((s) => [s.chords, s.scale]))
    expect(arp.at(-1)?.last).toBe(true)
  })

  it('heads the sheet by mode and splits pages', () => {
    const rows = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C'].map((r, i) => row(`${r}${i < 12 ? 'm7' : '7'}`))
    const s = buildArpeggioSheet(rows, CONCERT, 12, 'extended', 'up')
    expect(s.heading).toBe('Extended arpeggios')
    expect(s.pages.map((p) => p.length)).toEqual([12, 1])
    expect(buildArpeggioSheet(rows, CONCERT, 12, 'seventh', 'up').heading).toBe('Arpeggios')
  })

  it('changes ids with mode and direction', () => {
    const id = (n: 'seventh' | 'extended', d: 'up' | 'down') => buildArpeggioSheet([row('Cm7')], CONCERT, 12, n, d).pages[0]?.[0]?.id
    expect(new Set([id('seventh', 'up'), id('extended', 'up'), id('seventh', 'down')]).size).toBe(3)
  })

  it('labels intervals and reports errors per line', () => {
    const [ok, bad] = buildArpeggioSheet([row('Cm7'), row('Xyz')], CONCERT, 12, 'extended', 'up').pages.flat()
    expect(ok?.intervals).toEqual(['1', 'b3', '5', 'b7', '9', '11', '13'])
    expect(bad).toMatchObject({ error: 'No chord tones for Xyz', notes: [], intervals: null })
  })
})
```

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implement** (imports as listed in Interfaces):

```ts
export type ArpeggioStaffModel = Readonly<{ /* as in Interfaces */ }>
export type ArpeggioSheetModel = Readonly<{ heading: string; pages: readonly (readonly ArpeggioStaffModel[])[] }>

/** the Arpeggios sheet: the Scales sheet's lines (scaleLines), each its arpeggio, in pages of perPage; never throws */
export function buildArpeggioSheet(
  rows: readonly Row[],
  part: Part,
  perPage: number,
  notes: ArpNotes,
  dir: ArpDirection,
  key?: Key | null,
  resolved?: ReadonlyMap<number, Resolved>,
): ArpeggioSheetModel {
  const scaleOf = (r: Row, i: number): string | null => (resolved?.has(i) ? (resolved.get(i)?.scale ?? null) : qualityScale(r))
  const lines = scaleLines(rows, scaleOf)
  const keySig = key === undefined ? null : keySignature(key, part)
  const staves = lines.map((l, n): ArpeggioStaffModel => {
    const r = rows[l.row] as Row
    const scale = scaleOf(r, l.row)
    const showClefAndKey = key === undefined || n === 0
    const id = [l.chords.join(' '), scale, part.clef, part.trans, notes, dir, keySig, showClefAndKey ? '' : 'bare'].join('|')
    const base = { id, chords: l.chords.map((c) => chordTokensOrNull(part, c, scale)), scale: orNull(() => (scale ? scaleLabel(part, scale) : null)), keySig, showClefAndKey, last: n === lines.length - 1 }
    const played = arpeggioLine(part, r.chord, scale, notes, dir)
    if ('error' in played) return { ...base, notes: [], groups: [], accidentals: [], intervals: null, error: played.error }
    return {
      ...base,
      ...played,
      accidentals: keySig === null ? played.notes.map((p) => (p.acc ? accText(p.acc) : null)) : accidentalsInBar(played.notes.map((p) => ({ letter: p.letter, acc: p.acc, octave: octaveOf(p) })), keySig),
      intervals: orNull(() => intervalLabels(writtenChordRootLenient(part, r.chord, scale), played.notes, resolveQuality(r.chord)?.quality ?? null)),
      error: null,
    }
  })
  return { heading: notes === 'extended' ? 'Extended arpeggios' : 'Arpeggios', pages: chunk(staves, perPage) }
}
```
Note: without a key signature the Scales sheet marks every altered note (`accText`); with one, the measure rule. Keep both the same here. Intervals: 9/11/13 labels come from `intervalLabel`'s compound names, so an Extended line reads 1 ♭3 5 ♭7 9 11 13.

- [ ] **Step 4:** run → PASS. **Step 5:** add `export * from './arpeggioSheet'` to `engine/src/index.ts`; `npx vitest run -u src/__tests__/api.test.ts`; review the snapshot diff (adds `ARP_DIRECTIONS`, `ARP_DIRECTION_LABELS`, `ARP_NOTES`, `ARP_NOTES_LABELS`, `arpeggioLine`, `buildArpeggioSheet`, `isArpDirection`, `isArpNotes`, `placeRun`, `tensionsOf`). **Step 6:** `make test`. **Step 7:** commit, "buildArpeggioSheet: the Arpeggios sheet's model (#188)".

---

### Task 4: share links

**Files:** Modify `engine/src/share.ts`; Test `engine/src/__tests__/share.test.ts`.

**Interfaces:** `ShareSheet = 'scales' | 'changes' | 'arpeggios'`; `ShareView` adds `arpNotes?: ArpNotes`, `arpDir?: ArpDirection`.

- [ ] **Step 1: Failing test** (in the `shareViewFrom` describe):

```ts
  it('keeps the Arpeggios sheet and its choices, dropping bad ones', () => {
    expect(shareViewFrom({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })).toEqual({ sheet: 'arpeggios', arpNotes: 'extended', arpDir: 'up-down' })
    expect(shareViewFrom({ sheet: 'arps', arpNotes: 'ninth', arpDir: 'sideways' })).toBeUndefined()
  })
```
- [ ] **Step 2:** FAIL. **Step 3:** in `share.ts` import `isArpDirection, isArpNotes, type ArpDirection, type ArpNotes` from `./arpeggioSheet`; extend the types; in `shareViewFrom` replace the sheet line with `...(o.sheet === 'scales' || o.sheet === 'changes' || o.sheet === 'arpeggios' ? { sheet: o.sheet } : {}),` and add `...(isArpNotes(o.arpNotes) ? { arpNotes: o.arpNotes } : {}), ...(isArpDirection(o.arpDir) ? { arpDir: o.arpDir } : {}),`. **Step 4:** PASS; `make test`. **Step 5:** commit, "Share links carry the Arpeggios sheet and its choices (#188)".

---

### Task 5: the app

**Files:**
- Modify: `web/app/utils/sheets.ts`, `web/app/composables/usePreferences.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue`, `web/app/utils/vexflow.ts`
- Create: `web/app/components/ArpeggioSheet.vue`, `web/app/components/ArpeggioStaff.vue`
- Test: `web/test/sheets.test.ts`, `web/test/ArpeggioSheet.test.ts` (new), the preferences test if one exists (`grep -l usePreferences web/test`)

**Interfaces:** consumes Tasks 3–4. Produces `SheetKind = 'scales' | 'changes' | 'arpeggios'`, `firstSheet(shared, on: { changes: boolean; arpeggios: boolean })`, prefs `arpNotes: Ref<ArpNotes>`, `arpDir: Ref<ArpDirection>`.

- [ ] **Step 1: Failing tests** — `web/test/sheets.test.ts`: update `SHEETS` expectations to `['changes', 'scales', 'arpeggios']` / `['Changes', 'Scales', 'Arpeggios']`; pass `{ changes: true, arpeggios: true }` in existing `firstSheet` calls; add

```ts
  it('opens a link on Arpeggios only with the flag on', () => {
    expect(firstSheet('arpeggios', { changes: true, arpeggios: true })).toBe('arpeggios')
    expect(firstSheet('arpeggios', { changes: true, arpeggios: false })).toBe('changes')
  })
```
`web/test/ArpeggioSheet.test.ts` (modelled on `ScaleSheet.test.ts`, `ArpeggioStaff` stubbed):

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CONCERT, type Row } from '@chord-scale-maker/engine'
import ArpeggioSheet from '~/components/ArpeggioSheet.vue'

const rows: Row[] = [{ section: 'A', bar: '1', chord: 'Cm7', scale: '' }, { section: 'A', bar: '2', chord: 'F7', scale: '' }]
const props = { rows, title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '', perPage: 12, notes: 'extended' as const, dir: 'up' as const }

describe('ArpeggioSheet', () => {
  it('draws a staff per line under its heading', async () => {
    const w = await mountSuspended(ArpeggioSheet, { props, global: { stubs: { ArpeggioStaff: true } } })
    expect(w.findAll('arpeggio-staff-stub')).toHaveLength(2)
    expect(w.find('section p').text()).toBe('S (Extended arpeggios)')
  })
})
```
- [ ] **Step 2:** `cd web && npx vitest run test/sheets.test.ts test/ArpeggioSheet.test.ts` → FAIL.

- [ ] **Step 3: `sheets.ts`**:

```ts
/** the preview's sheets: the Changes (a study lead sheet), chord scales and arpeggios (one staff per scale line) */
export type SheetKind = 'scales' | 'changes' | 'arpeggios'

export const SHEETS: readonly { value: SheetKind; label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'scales', label: 'Scales' },
  { value: 'arpeggios', label: 'Arpeggios' },
]

/** the sheet a chart opens on: a share link's own sheet (Arpeggios only with its flag), else the Changes (Scales when that sheet is off) */
export function firstSheet(shared: SheetKind | undefined, on: Readonly<{ changes: boolean; arpeggios: boolean }>): SheetKind {
  if (shared === 'arpeggios' && on.arpeggios) return 'arpeggios'
  return shared === 'scales' || !on.changes ? 'scales' : 'changes'
}
```
In `EditorView.vue:325`: `firstSheet(props.shared?.sheet, { changes: useFeature('changes'), arpeggios: useFeature('arpeggios') })`. In `PreviewControls.vue:115`: `SHEETS.filter((s) => (s.value !== 'changes' || changes) && (s.value !== 'arpeggios' || arpeggios))`.

- [ ] **Step 4: Preferences** — in `usePreferences`:

```ts
  // the Arpeggios sheet: 7th chords or extended, and the direction
  const arpNotes = storedRef<ArpNotes>('csm-arp-notes', (s) => (isArpNotes(s) ? s : undefined), 'seventh')
  const arpDir = storedRef<ArpDirection>('csm-arp-dir', (s) => (isArpDirection(s) ? s : undefined), 'up')
```
return them; in `linkPreferences` add `arpNotes: ref<ArpNotes>(view.arpNotes ?? own.arpNotes.value), arpDir: ref<ArpDirection>(view.arpDir ?? own.arpDir.value),`. In `EditorView.shareUrl` add `...(sheet.value === 'arpeggios' ? { arpNotes: prefs.arpNotes.value, arpDir: prefs.arpDir.value } : {}),`.

- [ ] **Step 5: Controls** — `PreviewControls.vue`: add models `arpNotes`, `arpDir`; show the Intervals field for `sheet !== 'changes'` (already so); add after Transposition:

```vue
      <UiField v-if="sheet === 'arpeggios'">
        <UiLabel class="pl-3">Arpeggio</UiLabel>
        <div class="flex flex-wrap items-center gap-2">
          <SegmentedControl v-model="arpNotes" legend="Arpeggio" name="arp-notes" :options="arpNoteOptions" />
          <UiListbox v-model="arpDir" class="w-32" aria-label="Arpeggio direction">
            <template #selected="{ value }"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[value] }}</UiListboxLabel></template>
            <UiListboxOption v-for="d in ARP_DIRECTIONS" :key="d" :value="d"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[d] }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
      </UiField>
```
with `const arpNoteOptions = ARP_NOTES.map((value) => ({ value, label: ARP_NOTES_LABELS[value] }))` (check `SegmentedControl`'s `options` prop shape against `lineModes` and match it). Bind `v-model:arp-notes="prefs.arpNotes.value"` and `v-model:arp-dir="prefs.arpDir.value"` where `EditorView.vue` renders `<PreviewControls>`.

- [ ] **Step 6: Drawing** — in `web/app/utils/vexflow.ts`, beside `drawStaff`:

```ts
/** draw one Arpeggios line: eighths, each group beamed on its own; returns each head's centre as a fraction of the width */
export function drawArpeggioStaff(vf: VexFlowModule, el: HTMLElement, staff: ArpeggioStaffModel, clef: 'treble' | 'bass'): number[] {
  const ctx = svgContext(vf, el, STAFF_WIDTH)
  const stave = inkStave(vf, 0, STAVE_Y, STAFF_WIDTH - 1)
  if (staff.showClefAndKey) stave.addClef(clef)
  if (staff.showClefAndKey && staff.keySig) stave.addKeySignature(staff.keySig)
  stave.setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()
  const notes = staff.notes.map((n, i) => {
    const note = new vf.StaveNote({ keys: [toVexKey(n)], duration: '8', clef, autoStem: true })
    const acc = staff.accidentals[i]
    if (acc) note.addModifier(new vf.Accidental(acc), 0)
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length, beatValue: 8 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    const beams = staff.groups.reduce<{ at: number; beams: InstanceType<VexFlowModule['Beam']>[] }>(
      (acc, g) => ({ at: acc.at + g, beams: g > 1 ? [...acc.beams, new vf.Beam(notes.slice(acc.at, acc.at + g))] : acc.beams }),
      { at: 0, beams: [] },
    ).beams
    new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
    beams.forEach((b) => b.setContext(ctx).draw())
  }
  fitSvg(el, cropBand(notes.flatMap((n) => n.getYs())), STAFF_WIDTH, staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
  return notes.map((n) => headCentre(n, STAFF_WIDTH))
}
```
(Create the `Beam`s before `voice.draw` so the notes don't draw their own flags.) `cropBand` must include the stems and beams: if a beam is clipped in the e2e screenshot check, widen with the stems' extents (`n.getStemExtents()`).

- [ ] **Step 7: Components** — `ArpeggioStaff.vue`: copy `ScaleStaff.vue` (as left by #189), with `staff: ArpeggioStaffModel`, `drawArpeggioStaff` in place of `drawStaff`, the watch key `` `${props.staff.id}|${props.staff.last}|${props.clef}` ``, and no practice classes. `ArpeggioSheet.vue`:

```vue
<template>
  <SheetPages :title="title" :composer="composer" :pages="pages">
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ArpeggioStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { type ArpDirection, type ArpNotes, buildArpeggioSheet, type Key, pageSubtitle, type Part, type Resolved, type Row } from '@chord-scale-maker/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  composer?: string
  part: Part
  instrumentLabel: string
  perPage: number
  notes: ArpNotes
  dir: ArpDirection
  intervals?: boolean
  homeKey?: Key | null
  resolved?: ReadonlyMap<number, Resolved>
}>()

/** every printed page, in order, with its heading */
const pages = computed(() => {
  const sheet = buildArpeggioSheet(props.rows, props.part, props.perPage, props.notes, props.dir, props.homeKey, props.resolved)
  return sheet.pages.map((staves) => ({ mode: 'root' as const, staves, subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheet.heading) }))
})
</script>
```
(Check `SheetPages`' page type; if `mode` isn't needed, drop it.) In `EditorView.vue`, turn the `<ScaleSheet v-else …>` into `v-else-if="sheet === 'scales'"` and add after it:

```vue
          <ArpeggioSheet
            v-else
            :rows="editor.rows.value"
            :title="editor.meta.value.title"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="part"
            :instrument-label="instrumentLabel(prefs.instrument.value)"
            :per-page="PER_PAGE"
            :notes="prefs.arpNotes.value"
            :dir="prefs.arpDir.value"
            :intervals="prefs.intervals.value"
            :home-key="homeKey"
            :resolved="resolved"
          />
```
- [ ] **Step 8:** `make test` and `make lint` → green. **Step 9:** `make dev`, open `/song/autumn-leaves`, choose Arpeggios, try Extended and each direction in light and dark, and a bass-clef instrument; fix clipping or collisions. **Step 10:** commit all files above, "Arpeggios sheet: controls, drawing and wiring behind the arpeggios flag (#188)".

---

### Task 6: browser tests and design notes

**Files:** Create `web/e2e/arpeggios-sheet.spec.ts`; Modify `docs/design.md`.

- [ ] **Step 1: e2e** (e2e builds with every flag on):

```ts
import { chooseSheet, expect, pickOption, staves, test } from './fixtures'

const heads = (page: import('@playwright/test').Page) => page.locator('svg[role=img]').first().locator('.vf-stavenote')

test('the Arpeggios sheet draws each scale line as an arpeggio', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await expect(staves(page)).toHaveCount(14)
  await expect(heads(page)).toHaveCount(4) // Cm7, up
  await page.getByRole('radio', { name: 'Extended' }).check()
  await expect(heads(page)).toHaveCount(7)
  await pickOption(page, 'Arpeggio direction', 'Up & down')
  await expect(heads(page)).toHaveCount(13)
})

test('a share link reopens the Arpeggios sheet with its choices', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await page.getByRole('radio', { name: 'Extended' }).check()
  await pickOption(page, 'Arpeggio direction', 'Down')
  await page.getByRole('button', { name: 'Share' }).click()
  const link = await page.getByRole('dialog').getByLabel('Link').inputValue()
  const visitor = await (await browser.newContext()).newPage() // fresh storage: the link alone carries the choices
  await visitor.goto(link)
  await expect(staves(visitor)).toHaveCount(14)
  await expect(visitor.getByRole('radio', { name: 'Extended' })).toBeChecked()
  await expect(visitor.getByRole('button', { name: 'Arpeggio direction' })).toContainText('Down')
})

test('prints 12 lines a page and fits a phone', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Arpeggios')
  await page.getByRole('radio', { name: 'Extended' }).check()
  await pickOption(page, 'Arpeggio direction', 'Up & down')
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
```
(The share flow follows `web/e2e/my-charts.spec.ts`' share test; `SegmentedControl` renders `sr-only` radio inputs, so `getByRole('radio')` works.)

- [ ] **Step 2:** `make e2e` → green.

- [ ] **Step 3: `docs/design.md`**: a "### Arpeggios sheet" section after "### Scale sheet" summarising the spec (lines, 7th Chord / Extended and the tension order, directions, eighths beamed by group, placement by `placeRun`, preferences and share fields, behind `arpeggios`); add Arpeggios to the "Work on" list and to the `arpeggios` flag's description in the flags list; in `web/nuxt.config.ts` update the flag's comment to name both the Changes line and the Arpeggios sheet.

- [ ] **Step 4:** commit `web/e2e/arpeggios-sheet.spec.ts docs/design.md web/nuxt.config.ts`, "Browser tests and design notes for the Arpeggios sheet (#188)".
