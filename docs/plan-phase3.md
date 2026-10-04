# Phase 3: Transposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the preview for any of the CLI's 16 instruments: clef, transposed notes, chord symbols and scale names. Add a written start note for the "from" part, and label the page subtitles like the CLI. Remember both choices per browser.

**Architecture:** The engine already transposes, and the golden parity test covers it. Phase 3 adds a few small engine helpers:
- `partFor` maps an instrument name to its clef and transposition.
- `instrumentLabel` is the CLI's subtitle label, such as "Tenor Sax (Bb)".
- `pageSubtitle` builds the subtitle the way the CLI does.

In the app, `usePreferences` holds the instrument and start note, and the editor toolbar sets them. `ScaleSheet` takes the part, the start note and the label.

The staff drawing also changes. Each viewBox is now cropped to its notes' real range, because transposed and "from" scales can sit three ledger lines above the staff and were being clipped.

**Tech Stack:** as phase 2 (Nuxt 4, Tailwind 4, VexFlow 5, vitest + @nuxt/test-utils).

Spec: [requirements.md](requirements.md) item 7; [design.md](design.md) §5 and §8. The code below has been run in a scratch worktree:
- **Engine and app:** 12 pytest and 92 vitest tests pass, and lint, typecheck and generate are clean.
- **Headless Chromium:**
  - Tenor sax shows D–7 and D Dorian for a concert Cm7, with the subtitle "… – Tenor Sax (Bb) (Spelled from C)".
  - Trombone uses the bass clef, and "From F" relabels the mode.
  - The choices survive a reload.
  - Autumn Leaves prints to 8 letter pages for concert/C, concert/B, trombone/B, trombone/C and alto/A.
  - There are no console errors, and the phase 2 browser checks still pass.

---

## Background for the implementer

- **Engine:** `web/engine/` is pure TypeScript. `Part` is `{ clef: 'treble' | 'bass'; trans: 'C' | 'Bb' | 'Eb' | 'F' }`. `INSTRUMENTS` maps the 16 preset names to clef and transposition. `buildSheet(rows, part, mode, startText, perPage)` already writes everything for the part.
- **App:** `web/app/` is Nuxt 4. Vue APIs, composables, utils and components are auto-imported in `.vue` files and in `app/` code. Tests in `web/test/` import explicitly. The engine is imported as `~~/engine`.
- **Where to run commands:** npm/npx from `web/` only.
- **Commit trailer:** every commit message ends with a blank line and then exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Git:** stage only the files your task lists, by explicit path. Never run `git checkout`, `git stash`, `git restore` or `git reset`.

---

### Task 1: Engine helpers: `partFor`, `instrumentLabel`, `pageSubtitle`

**Files:** Modify: `web/engine/instruments.ts`, `web/engine/part.ts`, `web/engine/sheet.ts`, `web/engine/__tests__/sheet.test.ts`. Create: `web/engine/__tests__/instruments.test.ts`

- [ ] **Step 1: Write the failing tests.** Create the instruments test, and replace the sheet test with this version, which adds two tests at the end.

`web/engine/__tests__/instruments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, instrumentLabel, isInstrumentName } from '../instruments'
import { partFor } from '../part'

describe('instruments', () => {
  it('labels instruments like the CLI subtitle', () => {
    expect(instrumentLabel('concert')).toBe('')
    expect(instrumentLabel('piano')).toBe('Piano')
    expect(instrumentLabel('tenor-sax')).toBe('Tenor Sax (Bb)')
    expect(instrumentLabel('alto-sax')).toBe('Alto Sax (Eb)')
    expect(instrumentLabel('horn')).toBe('Horn (F)')
    expect(instrumentLabel('trombone')).toBe('Trombone')
  })

  it('maps instruments to the part they read', () => {
    expect(partFor('trumpet')).toEqual({ clef: 'treble', trans: 'Bb' })
    expect(partFor('bari-sax')).toEqual({ clef: 'treble', trans: 'Eb' })
    expect(partFor('tuba')).toEqual({ clef: 'bass', trans: 'C' })
  })

  it('recognises instrument names safely', () => {
    expect(isInstrumentName('tenor-sax')).toBe(true)
    expect(isInstrumentName('kazoo')).toBe(false)
    expect(isInstrumentName('constructor')).toBe(false)
    expect(Object.keys(INSTRUMENTS)).toHaveLength(16)
  })
})
```

`web/engine/__tests__/sheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT } from '../part'
import { type ModeChoice, type StaffModel, buildSheet, noteText, pageSubtitle, toVexKey } from '../sheet'

const row = (chord: string, scale = '', bar = '1'): Row => ({ section: 'A', bar, chord, scale })

/** every staff of the first part, across pages */
const staves = (rows: readonly Row[], mode: ModeChoice = 'root'): StaffModel[] =>
  buildSheet(rows, CONCERT, mode, 'C', 12)[0]?.pages.flat() ?? []

describe('sheet', () => {
  it('converts pitched notes to VexFlow keys', () => {
    expect(toVexKey({ letter: 2, acc: -1, midi: 63 })).toBe('eb/4')
    expect(toVexKey({ letter: 0, acc: -1, midi: 59 })).toBe('cb/4') // Cb4 sounds as B3
    expect(toVexKey({ letter: 6, acc: 1, midi: 72 })).toBe('b#/4') // B#4 sounds as C5
    expect(toVexKey({ letter: 4, acc: 0, midi: 43 })).toBe('g/2')
  })

  it('formats start notes for headings', () => {
    expect(noteText('Eb')).toBe('E♭')
    expect(noteText('F#3')).toBe('F♯')
    expect(noteText('Ebb')).toBe('E♭♭')
  })

  it('builds one part per mode with pages of perPage staves', () => {
    const rows = Array.from({ length: 13 }, (_, i) => row('Cm7', '', String(i + 1)))
    const sheet = buildSheet(rows, CONCERT, 'both', 'C', 12)
    expect(sheet.map((p) => [p.mode, p.heading, p.pages.map((pg) => pg.length)])).toEqual([
      ['from', 'Spelled from C', [12, 1]],
      ['root', 'Spelled from the Root', [12, 1]],
    ])
    const first = sheet[0]?.pages.flat() ?? []
    expect(first.map((s) => s.last)).toEqual([...Array(12).fill(false), true])
  })

  it('fills in default scales and spells the notes', () => {
    const [s] = staves([row('Cm7')])
    if (!s) throw new Error('no staff')
    expect(s.scale).toEqual({ root: { letter: 0, acc: 0 }, name: 'Dorian' })
    expect(s.notes.map(toVexKey)).toEqual(['c/4', 'd/4', 'eb/4', 'f/4', 'g/4', 'a/4', 'bb/4'])
    expect(s.chord).toEqual([{ kind: 'text', text: 'C–7' }])
    expect(s.error).toBeNull()
  })

  it('reports staves that need attention instead of throwing', () => {
    const [unknown, bad, typo] = staves([row('Cm7#5#9x'), row('Xyz'), row('Cm7', 'C Dorain')])
    expect(unknown).toMatchObject({ error: 'Choose a scale' })
    expect(unknown?.chord).not.toBeNull()
    expect(bad).toMatchObject({ chord: null, error: "Can't read this chord" })
    expect(typo).toMatchObject({ scale: null, error: 'unknown scale "Dorain"', chord: [{ kind: 'text', text: 'C–7' }] })
  })

  it('rejects a pitch that does not match its spelling', () => {
    expect(() => toVexKey({ letter: 0, acc: 0, midi: 61 })).toThrow(/does not match/)
  })

  it('never throws for a bad start note or page size', () => {
    const rows = [row('Cm7'), row('F7')]
    expect(buildSheet(rows, CONCERT, 'root', 'H', 12)[0]?.pages.flat()).toHaveLength(2) // start unused in root mode
    const [from] = buildSheet(rows, CONCERT, 'from', 'H', 12)
    expect(from?.heading).toBe('Spelled from H')
    expect(from?.pages.flat().map((s) => s.error)).toEqual(['bad start note "H" (try C, Eb, F#3)', 'bad start note "H" (try C, Eb, F#3)'])
    for (const perPage of [0, -3, Number.NaN, 1.5])
      expect(buildSheet(rows, CONCERT, 'root', 'C', perPage)[0]?.pages.map((p) => p.length)).toEqual([1, 1])
    expect(buildSheet([], CONCERT, 'both', 'C', 12).map((p) => p.pages)).toEqual([[], []])
  })

  it('gives staves stable ids that change with their content', () => {
    const id = (rows: readonly Row[]): string[] => staves(rows).map((s) => s.id)
    expect(id([row('Cm7')])).toEqual(id([row('Cm7')]))
    expect(id([row('Cm7')])).not.toEqual(id([row('Cm7', 'C Aeolian')]))
    const [a, b] = id([row('Cm7'), row('Cm7')])
    expect(a).not.toBe(b)
    const bb = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat()[0]?.id
    expect(bb).not.toBe(id([row('Cm7')])[0]) // a different instrument redraws
  })

  it('builds page subtitles like the CLI', () => {
    expect(pageSubtitle('Full Form', 'Tenor Sax (Bb)', 'Spelled from C')).toBe('Full Form – Tenor Sax (Bb) (Spelled from C)')
    expect(pageSubtitle('Full Form', '', 'Spelled from the Root')).toBe('Full Form (Spelled from the Root)')
    expect(pageSubtitle('', 'Trombone', 'Spelled from C')).toBe('Trombone (Spelled from C)')
    expect(pageSubtitle('', '', 'Spelled from C')).toBe('Spelled from C')
  })

  it('writes the sheet for a transposing instrument', () => {
    const [s] = buildSheet([row('Cm7')], { clef: 'treble', trans: 'Bb' }, 'root', 'C', 12)[0]?.pages.flat() ?? []
    expect(s?.chord).toEqual([{ kind: 'text', text: 'D–7' }])
    expect(s?.scale?.name).toBe('Dorian')
    expect(s?.notes.map(toVexKey)).toEqual(['d/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'])
    const [b] = buildSheet([row('Cm7')], { clef: 'bass', trans: 'C' }, 'from', 'C', 12)[0]?.pages.flat() ?? []
    expect(b?.notes.map(toVexKey)[0]).toBe('c/3') // bass clef starts an octave lower
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run --project engine`
Expected: FAIL. `instrumentLabel`, `isInstrumentName`, `partFor` and `pageSubtitle` are not exported.

- [ ] **Step 3: Implement.** Replace these three files with the versions below.

`web/engine/instruments.ts`:

```ts
export type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
export type Clef = 'treble' | 'bass'
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string }>

/** written = concert + interval: [letter steps, semitones] up from concert */
export const TRANSPOSITIONS: Readonly<Record<Transposition, readonly [number, number]>> = {
  C: [0, 0],
  Bb: [1, 2],
  Eb: [5, 9],
  F: [4, 7],
}

/** octave transpositions (guitar, bass, tenor, bari) don't matter: scales sit in a fixed written range */
export const INSTRUMENTS = {
  concert: { clef: 'treble', trans: 'C', description: 'any C instrument, treble clef (piano RH, vibes, flute, violin)' },
  piano: { clef: 'treble', trans: 'C', description: 'same as concert' },
  vibes: { clef: 'treble', trans: 'C', description: 'same as concert' },
  flute: { clef: 'treble', trans: 'C', description: 'same as concert' },
  guitar: { clef: 'treble', trans: 'C', description: 'same as concert' },
  trumpet: { clef: 'treble', trans: 'Bb', description: 'Bb, written a major 2nd up' },
  flugelhorn: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  clarinet: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'soprano-sax': { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'tenor-sax': { clef: 'treble', trans: 'Bb', description: 'same key as trumpet (sounds an octave lower)' },
  'alto-sax': { clef: 'treble', trans: 'Eb', description: 'Eb, written a major 6th up' },
  'bari-sax': { clef: 'treble', trans: 'Eb', description: 'same key as alto (sounds an octave lower)' },
  horn: { clef: 'treble', trans: 'F', description: 'French horn in F, written a perfect 5th up' },
  trombone: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  tuba: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  bass: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
} as const satisfies Record<string, Instrument>

export type InstrumentName = keyof typeof INSTRUMENTS

export const isInstrumentName = (name: string): name is InstrumentName => Object.hasOwn(INSTRUMENTS, name)

/** "tenor-sax" -> "Tenor Sax (Bb)"; concert -> "" (the CLI's page-subtitle label) */
export function instrumentLabel(name: InstrumentName): string {
  if (name === 'concert') return ''
  const words = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  const { trans } = INSTRUMENTS[name]
  return words.join(' ') + (trans === 'C' ? '' : ` (${trans})`)
}

/** default 'from' pitch: C4 / C3 (MIDI, middle C = 60) */
export const CLEF_START: Readonly<Record<Clef, number>> = { treble: 60, bass: 48 }
/** root-spelled scales start in Bb3..A4 / G2..F#3 */
export const CLEF_ROOT_LOW: Readonly<Record<Clef, number>> = { treble: 58, bass: 43 }
```

`web/engine/part.ts`:

```ts
import { type Clef, type InstrumentName, type Transposition, CLEF_ROOT_LOW, CLEF_START, INSTRUMENTS, TRANSPOSITIONS } from './instruments'
import { type Spelled, accFor, LETTERS, mod, NAT_PC, parseRoot, pcOf, toLetter } from './pitch'
import { type ScaleKey, type ScaleNote, parseScale, SCALES, simplifyRoot, spellScale } from './scales'

/** an instrument "view" of the chart */
export type Part = Readonly<{ clef: Clef; trans: Transposition }>
export type Mode = 'from' | 'root'
export type Pitched = Readonly<Spelled & { midi: number }>
export type WrittenScale = Readonly<{ root: Spelled; key: ScaleKey; notes: readonly ScaleNote[] }>
export type ScaleLabel = Readonly<{ root: Spelled; name: string }>

export const CONCERT: Part = { clef: 'treble', trans: 'C' }

/** the clef and transposition an instrument reads in */
export const partFor = (name: InstrumentName): Part => {
  const { clef, trans } = INSTRUMENTS[name]
  return { clef, trans }
}

/** move a spelled note up by the transposition interval */
export function transposeRoot(n: Spelled, trans: Transposition): Spelled {
  const [steps, semis] = TRANSPOSITIONS[trans]
  const letter = toLetter(n.letter + steps)
  return { letter, acc: accFor(mod(pcOf(n) + semis, 12), letter) }
}

export const writtenRoot = (part: Part, n: Spelled, key?: ScaleKey): Spelled =>
  part.trans === 'C' ? n : simplifyRoot(transposeRoot(n, part.trans), key)

/** concert scale text -> written root, key and spelled notes */
export function writtenScale(part: Part, text: string): WrittenScale {
  const { root, key } = parseScale(text)
  const written = writtenRoot(part, root, key)
  return { root: written, key, notes: spellScale(written, key) }
}

export function scaleNotes(part: Part, text: string, mode: Mode, start: number): Pitched[] {
  const { root, notes } = writtenScale(part, text)
  const rootPc = pcOf(root)
  if (mode === 'root') {
    const low = CLEF_ROOT_LOW[part.clef]
    const p0 = low + mod(rootPc - low, 12)
    return notes.map((n) => ({ letter: n.letter, acc: n.acc, midi: p0 + n.semis }))
  }
  // every note in the octave beginning at the start pitch
  return notes
    .map((n) => ({ letter: n.letter, acc: n.acc, midi: start + mod(rootPc + n.semis - start, 12) }))
    .sort((a, b) => a.midi - b.midi)
}

export function scaleLabel(part: Part, text: string): ScaleLabel {
  const { root, key } = writtenScale(part, text)
  return { root, name: SCALES[key][1] }
}

/** LilyPond note name, e.g. ees' (used for parity with jazz_scales.py) */
export function lilyNote(n: Pitched): string {
  const d = n.midi - NAT_PC[n.letter] - n.acc
  if (mod(d, 12) !== 0) throw new Error(`pitch ${n.midi} does not match its spelling`)
  const marks = Math.floor(d / 12) - 4 // written octave, C4 = 60; c = octave 3
  const name = LETTERS[n.letter].toLowerCase() + (n.acc > 0 ? 'is'.repeat(n.acc) : 'es'.repeat(-n.acc))
  return name + (marks >= 0 ? "'".repeat(marks) : ','.repeat(-marks))
}

/** 'C' -> { exact: null, pc: 0 }; 'F#3' -> { exact: 54, pc: 6 } (middle C = C4) */
export function parseStart(text: string): Readonly<{ exact: number | null; pc: number }> {
  const m = /^([A-Ga-g][b#♭♯]*)(\d)?$/.exec(text.trim())
  if (!m) throw new Error(`bad start note ${JSON.stringify(text)} (try C, Eb, F#3)`)
  const [, note = '', octave] = m
  const r = parseRoot(note)
  const pc = NAT_PC[r.letter] + r.acc
  return { exact: octave === undefined ? null : 12 * (Number(octave) + 1) + pc, pc }
}

/** written start pitch: exact octave if given, else the first one at/above the clef's default */
export function resolveStart(clef: Clef, text: string): number {
  const { exact, pc } = parseStart(text)
  const base = CLEF_START[clef]
  return exact ?? base + mod(pc - base, 12)
}
```

`web/engine/sheet.ts`:

```ts
import type { Row } from './chart'
import { resolveScale } from './chart'
import { type ChordToken, chordTokens } from './chord'
import { type Mode, type Part, type Pitched, type ScaleLabel, resolveStart, scaleLabel, scaleNotes } from './part'
import { accText, LETTERS, mod, NAT_PC, parseRoot, rootName } from './pitch'

/** one staff on the page: everything a component needs, no DOM */
export type StaffModel = Readonly<{
  id: string // unique per sheet; stable while the row and its position are unchanged
  section: string
  bar: string
  chord: readonly ChordToken[] | null // null: chord can't be read
  scale: ScaleLabel | null
  notes: readonly Pitched[]
  error: string | null // shown instead of notes
  last: boolean // final bar line
}>
export type SheetPart = Readonly<{ mode: Mode; heading: string; pages: readonly (readonly StaffModel[])[] }>
export type ModeChoice = Mode | 'both'

export const modesFor = (choice: ModeChoice): readonly Mode[] => (choice === 'both' ? ['from', 'root'] : [choice])

/** VexFlow key for a pitched note, e.g. { E, -1, 63 } -> "eb/4" (middle C = C4) */
export function toVexKey(n: Pitched): string {
  const d = n.midi - NAT_PC[n.letter] - n.acc
  if (mod(d, 12) !== 0) throw new Error(`pitch ${n.midi} does not match its spelling`)
  return `${LETTERS[n.letter].toLowerCase()}${accText(n.acc)}/${d / 12 - 1}`
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function chordOrNull(part: Part, chord: string, scale: string | null): readonly ChordToken[] | null {
  try {
    return chordTokens(part, chord, scale ?? undefined)
  } catch {
    try {
      return chordTokens(part, chord) // scale is bad but the chord may be fine
    } catch {
      return null
    }
  }
}

/** the written start pitch for 'from' mode; 'root' mode ignores it, so a bad start text only matters there */
type Start = Readonly<{ midi: number } | { error: string }>

function startFor(part: Part, mode: Mode, text: string): Start {
  if (mode === 'root') return { midi: 0 }
  try {
    return { midi: resolveStart(part.clef, text) }
  } catch (e) {
    return { error: message(e) }
  }
}

function staff(row: Row, index: number, part: Part, mode: Mode, start: Start, last: boolean): StaffModel {
  const scale = resolveScale(row)
  const startKey = 'midi' in start ? start.midi : start.error
  const id = [index, row.section, row.bar, row.chord, row.scale, part.clef, part.trans, mode, startKey].join('|')
  const base = { id, section: row.section, bar: row.bar, last }
  const chord = chordOrNull(part, row.chord, scale)
  if (scale === null) return { ...base, chord, scale: null, notes: [], error: chord ? 'Choose a scale' : "Can't read this chord" }
  try {
    const label = scaleLabel(part, scale)
    if ('error' in start) return { ...base, chord, scale: label, notes: [], error: start.error }
    return { ...base, chord, scale: label, notes: scaleNotes(part, scale, mode, start.midi), error: null }
  } catch (e) {
    return { ...base, chord, scale: null, notes: [], error: message(e) }
  }
}

/** "Eb" -> "E♭" for headings; text that isn't a note is shown as typed */
export function noteText(text: string): string {
  try {
    return rootName(parseRoot(text.trim().replace(/\d$/, ''))).replace(/b/g, '♭').replace(/#/g, '♯')
  } catch {
    return text.trim()
  }
}

/**
 * page subtitle as the CLI builds it: "Subtitle – Tenor Sax (Bb) (Spelled from C)";
 * just the heading when there is neither a subtitle nor an instrument label
 */
export function pageSubtitle(subtitle: string, instrument: string, heading: string): string {
  const bits = [subtitle, instrument].filter(Boolean)
  return bits.length ? `${bits.join(' – ')} (${heading})` : heading
}

/** split into pages of n (n is clamped to a whole number of at least 1) */
function chunk<T>(xs: readonly T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n) || 1)
  return Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size))
}

/** the printable sheet: one part per mode, each split into pages of perPage staves; never throws */
export function buildSheet(
  rows: readonly Row[],
  part: Part,
  choice: ModeChoice,
  startText: string,
  perPage: number,
): SheetPart[] {
  return modesFor(choice).map((mode) => {
    const start = startFor(part, mode, startText)
    return {
      mode,
      heading: mode === 'from' ? `Spelled from ${noteText(startText)}` : 'Spelled from the Root',
      pages: chunk(
        rows.map((r, i) => staff(r, i, part, mode, start, i === rows.length - 1)),
        perPage,
      ),
    }
  })
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx vitest run && npm run typecheck`
Expected: `Tests 83 passed`, no type errors

- [ ] **Step 5: Commit**

```bash
git add web/engine/instruments.ts web/engine/part.ts web/engine/sheet.ts web/engine/__tests__/instruments.test.ts web/engine/__tests__/sheet.test.ts
git commit -m "feat(engine): instrument parts, CLI subtitle labels"
```

---

### Task 2: Instrument choices and saved preferences

**Files:** Create: `web/app/utils/instrumentChoices.ts`, `web/app/composables/usePreferences.ts`; Test: `web/test/instrumentChoices.test.ts`, `web/test/usePreferences.test.ts`

- [ ] **Step 1: Write the failing tests**

`web/test/instrumentChoices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '~~/engine'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

describe('instrumentChoices', () => {
  it('groups every instrument exactly once, by what it reads', () => {
    expect(INSTRUMENT_GROUPS.map((g) => g.label)).toEqual([
      'Concert pitch (C)',
      'B♭ instruments',
      'E♭ instruments',
      'F instruments',
      'Bass clef (C)',
    ])
    expect(INSTRUMENT_GROUPS.flatMap((g) => g.instruments).sort()).toEqual(Object.keys(INSTRUMENTS).sort())
    expect(INSTRUMENT_GROUPS[1]?.instruments).toContain('tenor-sax')
    expect(INSTRUMENT_GROUPS[4]?.instruments).toEqual(['trombone', 'tuba', 'bass'])
  })

  it('formats dropdown labels', () => {
    expect(instrumentOption('tenor-sax')).toBe('Tenor sax')
    expect(instrumentOption('concert')).toBe('Concert')
  })
})
```

`web/test/usePreferences.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { usePreferences } from '~/composables/usePreferences'

function prefs() {
  const scope = effectScope()
  const p = scope.run(() => usePreferences())
  if (!p) throw new Error('no preferences')
  return p
}

describe('usePreferences', () => {
  afterEach(() => localStorage.clear())

  it('defaults to concert pitch starting on C', () => {
    const p = prefs()
    expect([p.instrument.value, p.start.value]).toEqual(['concert', 'C'])
  })

  it('remembers choices in this browser', async () => {
    const p = prefs()
    p.instrument.value = 'alto-sax'
    p.start.value = 'Eb'
    await nextTick()
    const again = prefs()
    expect([again.instrument.value, again.start.value]).toEqual(['alto-sax', 'Eb'])
  })

  it('ignores stored values it does not recognise', () => {
    localStorage.setItem('csm-instrument', 'kazoo')
    localStorage.setItem('csm-start', 'H')
    const p = prefs()
    expect([p.instrument.value, p.start.value]).toEqual(['concert', 'C'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run --project app test/instrumentChoices.test.ts test/usePreferences.test.ts`
Expected: FAIL, the modules cannot be resolved

- [ ] **Step 3: Implement**

`web/app/utils/instrumentChoices.ts`:

```ts
import { type InstrumentName, INSTRUMENTS } from '~~/engine'

export type InstrumentGroup = Readonly<{ label: string; instruments: readonly InstrumentName[] }>

const GROUP_LABELS: Readonly<Record<string, string>> = {
  'treble/C': 'Concert pitch (C)',
  'treble/Bb': 'B♭ instruments',
  'treble/Eb': 'E♭ instruments',
  'treble/F': 'F instruments',
  'bass/C': 'Bass clef (C)',
}

/** instruments grouped by what they read (clef + key), in the CLI's preset order */
export const INSTRUMENT_GROUPS: readonly InstrumentGroup[] = Object.entries(GROUP_LABELS).map(([id, label]) => ({
  label,
  instruments: (Object.keys(INSTRUMENTS) as InstrumentName[]).filter((n) => {
    const { clef, trans } = INSTRUMENTS[n]
    return `${clef}/${trans}` === id
  }),
}))

/** "tenor-sax" -> "Tenor sax" for the dropdown */
export const instrumentOption = (name: InstrumentName): string => {
  const words = name.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
```

`web/app/composables/usePreferences.ts`:

```ts
import { type InstrumentName, isInstrumentName } from '~~/engine'

const INSTRUMENT_KEY = 'csm-instrument'
const START_KEY = 'csm-start'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the choice still applies for this visit
  }
}

/** the preview's instrument and start note, remembered in this browser (client-only) */
export function usePreferences() {
  const stored = read(INSTRUMENT_KEY) ?? ''
  const storedStart = read(START_KEY) ?? ''
  const instrument = ref<InstrumentName>(isInstrumentName(stored) ? stored : 'concert')
  const start = ref<string>((PICKER_ROOTS as readonly string[]).includes(storedStart) ? storedStart : 'C')

  watch(instrument, (v) => write(INSTRUMENT_KEY, v))
  watch(start, (v) => write(START_KEY, v))

  return { instrument, start }
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx nuxi prepare && npx vitest run && npm run typecheck && npm run lint`
Expected: `Tests 88 passed`, typecheck and lint clean

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/instrumentChoices.ts web/app/composables/usePreferences.ts web/test/instrumentChoices.test.ts web/test/usePreferences.test.ts
git commit -m "feat(web): instrument choices and per-browser preferences"
```

---

### Task 3: Toolbar pickers, transposed sheet, staff cropping

The toolbar gets an Instrument select (grouped) and a "Start on" select. The mode label follows the start note ("From E♭"). A short note says the chart stays in concert pitch whenever the preview is transposed or in bass clef.

`ScaleSheet` takes `part`, `instrumentLabel` and `start`. `drawStaff` crops each viewBox to the notes' real range, measured from VexFlow's note-head positions. SVG `getBBox` can't be used for this, because it measures glyphs by font ascent, not ink.

**Files:** Modify: `web/app/components/EditorView.vue`, `web/app/components/ScaleSheet.vue`, `web/app/utils/vexflow.ts`, `web/test/ScaleSheet.test.ts`; Test: `web/test/EditorView.test.ts`

- [ ] **Step 1: Write the failing tests.** Replace the `ScaleSheet` test, and create the `EditorView` test.

`web/test/ScaleSheet.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CONCERT, type Row } from '~~/engine'
import ScaleSheet from '~/components/ScaleSheet.vue'

const rows: Row[] = Array.from({ length: 13 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: 'Cm7', scale: '' }))
const stubs = { ScaleStaff: true } // VexFlow needs a real browser

describe('ScaleSheet', () => {
  it('lays out pages of perPage staves for each mode, each with a heading', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: { rows, title: 'T', subtitle: 'S', part: CONCERT, instrumentLabel: '', start: 'C', mode: 'both', perPage: 12 },
      global: { stubs },
    })
    const pages = w.findAll('section')
    expect(pages.map((p) => p.findAll('scale-staff-stub').length)).toEqual([12, 1, 12, 1])
    expect(pages.map((p) => p.find('p').text())).toEqual([
      'S (Spelled from C)',
      'S (Spelled from C)',
      'S (Spelled from the Root)',
      'S (Spelled from the Root)',
    ])
    expect(w.text()).toContain('Page 4 of 4')
  })

  it('names the instrument and start note, and passes the clef to every staff', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: {
        rows: rows.slice(0, 1),
        title: 'T',
        subtitle: '',
        part: { clef: 'bass', trans: 'C' },
        instrumentLabel: 'Trombone',
        start: 'Eb',
        mode: 'from',
        perPage: 12,
      },
      global: { stubs },
    })
    expect(w.find('section p').text()).toBe('Trombone (Spelled from E♭)')
    expect(w.find('scale-staff-stub').attributes('clef')).toBe('bass')
  })
})
```

`web/test/EditorView.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import EditorView from '~/components/EditorView.vue'

const TEXT = 'title: T\nA | 1 | Cm7\n'
const mount = () =>
  mountSuspended(EditorView, { props: { initialText: TEXT }, global: { stubs: { ScaleSheet: true } } })
type Wrapper = Awaited<ReturnType<typeof mount>>
const sheet = (w: Wrapper) => w.findComponent({ name: 'ScaleSheet' })
/** the select inside the toolbar label that starts with this text */
const control = (w: Wrapper, label: string) => {
  const select = w.findAll('label').find((l) => l.text().startsWith(label))?.find('select')
  if (!select?.exists()) throw new Error(`no ${label} control`)
  return select
}

describe('EditorView', () => {
  afterEach(() => localStorage.clear())

  it('previews in concert pitch by default', async () => {
    const w = await mount()
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'C' }, instrumentLabel: '', start: 'C' })
    expect(w.text()).not.toContain('concert pitch; the preview is written for')
  })

  it('transposes the preview for the chosen instrument and start note', async () => {
    const w = await mount()
    await control(w, 'Instrument').setValue('tenor-sax')
    await control(w, 'Start on').setValue('Eb')
    expect(sheet(w).props()).toMatchObject({ part: { clef: 'treble', trans: 'Bb' }, instrumentLabel: 'Tenor Sax (Bb)', start: 'Eb' })
    expect(w.text()).toContain('the preview is written for tenor sax')
    expect(w.text()).toContain('From E♭')
  })

  it('uses the bass clef for trombone', async () => {
    const w = await mount()
    await control(w, 'Instrument').setValue('trombone')
    expect(sheet(w).props('part')).toEqual({ clef: 'bass', trans: 'C' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run --project app test/ScaleSheet.test.ts test/EditorView.test.ts`
Expected: FAIL. `ScaleSheet` doesn't use the new props yet, and `EditorView` has no Instrument or Start on controls.

- [ ] **Step 3: Implement.** Replace these files with the versions below.

`web/app/components/ScaleSheet.vue`:

```vue
<template>
  <div class="space-y-8 print:space-y-0">
    <section
      v-for="(page, p) in pages"
      :key="`${page.mode}-${p}`"
      class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:break-after-page print:last:break-after-auto print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
    >
      <header class="mb-4 text-center">
        <h2 class="text-xl font-semibold">{{ title }}</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">{{ page.subtitle }}</p>
      </header>
      <div class="space-y-1 print:space-y-0">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" />
      </div>
      <p class="mt-3 text-right text-xs text-slate-400 print:hidden">Page {{ page.number }} of {{ pages.length }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { buildSheet, type ModeChoice, type Part, pageSubtitle, type Row } from '~~/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  part: Part
  instrumentLabel: string // e.g. "Tenor Sax (Bb)"; '' for concert
  start: string // written start note for the "from" part
  mode: ModeChoice
  perPage: number
}>()

/** every printed page, in order, with its own heading (the CLI's bookparts flattened) */
const pages = computed(() =>
  buildSheet(props.rows, props.part, props.mode, props.start, props.perPage)
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheetPart.heading),
      })),
    )
    .map((page, i) => ({ ...page, number: i + 1 })),
)
</script>
```

`web/app/components/EditorView.vue`:

```vue
<template>
  <div class="space-y-6">
    <div class="grid gap-6 print:hidden lg:grid-cols-2">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <h2 id="grid-heading" class="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Chart</h2>
        <p v-if="editor.fatal.value" class="rounded bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </p>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </div>
      </section>
      <section aria-labelledby="text-heading" class="min-w-0">
        <h2 id="text-heading" class="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Text</h2>
        <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
      </section>
    </div>

    <div class="flex flex-wrap items-center gap-3 print:hidden">
      <h2 class="text-sm font-medium uppercase tracking-wide text-slate-500">Preview</h2>
      <label class="flex items-center gap-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Instrument</span>
        <select v-model="prefs.instrument.value" :class="control">
          <optgroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
            <option v-for="name in g.instruments" :key="name" :value="name" :title="INSTRUMENTS[name].description">{{ instrumentOption(name) }}</option>
          </optgroup>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Start on</span>
        <select v-model="prefs.start.value" :class="control" aria-describedby="start-help">
          <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
        </select>
        <span id="start-help" class="sr-only">Written pitch the "from" part starts on</span>
      </label>
      <fieldset class="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
        <legend class="sr-only">Which spellings to show</legend>
        <label v-for="m in modes" :key="m.value" class="cursor-pointer px-3 py-1 has-checked:bg-accent has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-sky-600 dark:has-checked:text-slate-950 dark:has-focus-visible:outline-sky-400">
          <input v-model="mode" type="radio" name="mode" :value="m.value" class="sr-only" >{{ m.label }}
        </label>
      </fieldset>
      <button type="button" class="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong dark:text-slate-950" @click="print">
        Print / Save PDF
      </button>
    </div>

    <p v-if="part.trans !== 'C' || part.clef === 'bass'" class="text-sm text-slate-500 print:hidden dark:text-slate-400">
      The chart is in concert pitch; the preview is written for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.
    </p>
    <p v-if="editor.fatal.value" class="text-sm text-rose-600">Preview paused: the chart is over a size limit.</p>
    <ScaleSheet
      v-else
      :rows="editor.rows.value"
      :title="editor.meta.value.title"
      :subtitle="editor.meta.value.subtitle"
      :part="part"
      :instrument-label="instrumentLabel(prefs.instrument.value)"
      :start="prefs.start.value"
      :mode="mode"
      :per-page="PER_PAGE"
    />
  </div>
</template>

<script setup lang="ts">
import { INSTRUMENTS, instrumentLabel, type ModeChoice, noteText, partFor } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12
const control = 'rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900'

const editor = useChartEditor(props.initialText)
const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
const mode = ref<ModeChoice>('both')
const modes = computed((): readonly { value: ModeChoice; label: string }[] => [
  { value: 'both', label: 'Both' },
  { value: 'from', label: `From ${noteText(prefs.start.value)}` },
  { value: 'root', label: 'From root' },
])

watch(editor.text, (t) => saveDraft(t))

function print(): void {
  editor.flush() // include anything typed in the last moment
  nextTick(() => window.print())
}
</script>
```

`web/app/utils/vexflow.ts`:

```ts
import { accText, type StaffModel, toVexKey } from '~~/engine'

type VexFlowModule = typeof import('vexflow/bravura')

let loading: Promise<VexFlowModule> | undefined

/**
 * VexFlow with its Bravura music font, loaded on demand (only the editor needs it).
 * The font ships inside the bundle as a data: URL, so nothing is fetched from a CDN.
 */
export function loadVexFlow(): Promise<VexFlowModule> {
  loading ??= import('vexflow/bravura')
    .then(async (vf) => {
      await document.fonts?.load('30px Bravura').catch(() => undefined) // draw with fallback metrics rather than not at all
      return vf
    })
    .catch((e: unknown) => {
      loading = undefined // let the next staff retry
      throw e
    })
  return loading
}

// Drawing units. The SVG scales to its container width (about 650px in print). Each staff's
// viewBox is cropped to what was drawn, so its height depends on how far notes go above or
// below the staff: about 45px in print for most scales, at most about 65px (three ledger
// lines, e.g. bass clef from B), so 12 staves and their labels fit on a letter page.
export const STAFF_WIDTH = 1200
const STAFF_HEIGHT = 200
const STAVE_Y = 40 // staff lines at y 80-120, with room for ledger lines on both sides
const MIN_TOP = 55 // always show the clef and a ledger line's space above and below the staff
const MIN_BOTTOM = 140
// room around a note head for its accidental: a flat rises about two spaces, a sharp hangs 1.5
const ABOVE_HEAD = 24
const BELOW_HEAD = 18

/** draw one staff of whole notes into el, replacing what was there; colors follow CSS `color` */
export function drawStaff(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, clef: 'treble' | 'bass'): void {
  el.replaceChildren()
  const renderer = new vf.Renderer(el as HTMLDivElement, vf.Renderer.Backends.SVG)
  renderer.resize(STAFF_WIDTH, STAFF_HEIGHT)
  const ctx = renderer.getContext()
  ctx.setFillStyle('currentColor').setStrokeStyle('currentColor')

  const stave = new vf.Stave(0, STAVE_Y, STAFF_WIDTH - 1)
  stave.addClef(clef).setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()

  const notes = staff.notes.map((n) => {
    const note = new vf.StaveNote({ keys: [toVexKey(n)], duration: 'w', clef })
    if (n.acc) note.addModifier(new vf.Accidental(accText(n.acc)), 0) // explicit on every altered note
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
  }

  // crop to the notes' actual range (SVG getBBox measures glyphs by font ascent, not ink),
  // and scale with the container instead of a fixed pixel size
  const heads = notes.flatMap((n) => n.getYs())
  const top = Math.min(MIN_TOP, Math.min(...heads) - ABOVE_HEAD)
  const bottom = Math.max(MIN_BOTTOM, Math.max(...heads) + BELOW_HEAD)
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${top} ${STAFF_WIDTH} ${bottom - top}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width') // VexFlow's resize() sets a fixed pixel size
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx nuxi prepare && npx vitest run && npm run typecheck && npm run lint && npm run generate`
Expected: `Tests 92 passed`, typecheck and lint clean, generate succeeds

- [ ] **Step 5: Check it by hand** (the controller does this). In `npm run preview`, check:
  - Tenor sax shows D–7 and D Dorian for bar 1.
  - Trombone with Start on B shows bass clef staves, and the high notes aren't clipped.
  - Print still gives 8 pages.

- [ ] **Step 6: Commit**

```bash
git add web/app/components/EditorView.vue web/app/components/ScaleSheet.vue web/app/utils/vexflow.ts web/test/ScaleSheet.test.ts web/test/EditorView.test.ts
git commit -m "feat(web): instrument and start-note pickers; crop staves to their notes"
```

---

### Task 4: Docs

**Files:** Modify: `docs/design.md`, `README.md`

- [ ] **Step 1: Replace both files** with the versions below.

`docs/design.md`:

````markdown
# jazz-scales web app: design

Companion to [requirements.md](requirements.md).

## 1. Overview

A fully static Nuxt 4 site, styled with Tailwind CSS, (`nuxt generate`) on Vercel. The scale engine,
chart parser and renderer all run in the browser. The chart library is built
into the site at build time from `charts/*.txt`. There is no server runtime,
database or API.

```text
charts/*.txt ─┐                        ┌─> Library page (title search)
chord_scales.json ─┼─> build (Vite raw import) ─┤
              │                        └─> Editor: text ⇄ grid ─> engine ─> VexFlow preview ─> browser print
jazz_scales.py ──> tools/export_fixtures.py ──> fixtures/golden.json ──> vitest parity tests
```

## 2. Repository layout

```text
jazz_scales.py            # Python reference engine + LilyPond CLI (local use)
chord_scales.json         # shared: qualities, aliases, default/alternate scales
charts/*.txt              # shared: chart library (concert pitch)
fixtures/golden.json      # generated by Python, consumed by TS tests
tools/export_fixtures.py  # writes fixtures/golden.json
tests/                    # pytest
docs/
web/                      # Nuxt app (Vercel root directory)
  engine/                 # pure TS, no Vue/DOM imports
    pitch.ts              # letters, pitch classes, accFor, enharmonics
    scales.ts             # SCALES, ALIASES, spellFrom, simplifyRoot, spellScale, parseScale
    instruments.ts        # TRANSPOSITIONS, INSTRUMENTS, clef ranges
    part.ts               # writtenRoot, scaleNotes, scaleLabel, lilyNote, resolveStart (functional "Part")
    chord.ts              # parseChord -> ChordParts, chordTokens
    qualities.ts          # resolve quality via chord_scales.json, options + defaults
    chart.ts              # parse/serialize chart text <-> ChartDoc, expand @copy
    edit.ts               # grid edits on a ChartDoc (pure), cell validation
    sheet.ts              # rows -> pages of StaffModel (labels, notes, errors), toVexKey
    limits.ts             # input caps
    index.ts
    __tests__/            # vitest, incl. golden parity
  app/
    pages/index.vue       # library + title search
    pages/editor.vue      # ?chart=<slug> | ?new=1 | this browser's draft
    components/           # AppHeader, EditorView, ChartGrid, GridCell, ScaleCell, ChartText,
                          # ScaleSheet, ScaleStaff, ChordSymbol, NoteName
    composables/          # useChartEditor (editor state), useDraft, useTheme
    utils/                # library (build-time charts), scaleChoices, vexflow (drawing)
    assets/css/main.css   # Tailwind, theme tokens, print rules
  public/theme-init.js    # applies the saved theme before first paint
  test/                   # app tests (@nuxt/test-utils, happy-dom)
  nuxt.config.ts, vitest.config.ts (engine + app projects), eslint.config.mjs,
  tsconfig.json (Nuxt's generated configs), tsconfig.engine.json (engine + its tests)
```

Python stays at the repo root so the existing CLI, Makefile and tests are
unchanged. Vercel builds from `web/` with "include files outside root
directory" enabled so `charts/` and `chord_scales.json` are importable.

## 3. Engine (TypeScript port)

Pure functions over immutable data. A one-to-one port of `jazz_scales.py`
names and behaviour so the two can be diffed by eye.

### Types

```ts
type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6        // C..B
type Spelled = Readonly<{ letter: Letter; acc: number }>
type ScaleNote = Readonly<Spelled & { semis: number }>
type Pitched = Readonly<Spelled & { midi: number }>
type ScaleKey = keyof typeof SCALES
type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
type Clef = 'treble' | 'bass'
type Part = Readonly<{ clef: Clef; trans: Transposition }>
type Mode = 'from' | 'root'

type ChordParts = Readonly<{
  root: Spelled
  quality: string          // raw text between root and /bass, e.g. "m7b5", "6/9"
  bass?: Spelled
}>
// display tokens, rendered by ChordSymbol.vue (replaces LilyPond markup)
type ChordToken =
  | { kind: 'text'; text: string }
  | { kind: 'acc'; acc: 'b' | '#' }
```

### Port map

| Python | TS | Notes |
|---|---|---|
| `parse_root`, `root_name`, `pc_of`, `acc_for`, `enharmonics` | `pitch.ts` | identical arithmetic; JS `%` needs a `mod()` helper for negatives |
| `simplify_root` | `scales.ts` `simplifyRoot` | same cost tuple `(ugly, total, sameDir)`; tie order = order of `enharmonics()` |
| `spell_from`, `spell_scale`, `parse_scale`, `norm` | `scales.ts` | formulas copied verbatim from `SCALES` |
| `Part.written_root/scale/scale_notes/scale_label` | `part.ts` | functions taking a `Part` value |
| `Part.chord_markup` | `chord.ts` `chordTokens(part, chord, scaleText?)` | returns `ChordToken[]`, not LilyPond |
| `lily_note` | `part.ts` `lilyNote` | used for parity tests; phase 2 adds `toVexKey` (`{letter, acc, midi}` → `"eb/4"`) |
| `parse_start` + start logic in `main()` | `part.ts` `parseStart`, `resolveStart` | |
| `read_chart` | `chart.ts` | returns errors, never exits |

### New beyond Python

- `qualities.ts`: `resolveQuality(chord)` looks the quality up in `chord_scales.json`
  aliases and returns `{ quality, options: { scale, note, default }[] }`, or `null`
  for an unknown quality. It throws on an unparseable chord. An option's scale root = chord root +
  interval (letter-step arithmetic, e.g. `b3` over C → Eb). Interval-derived roots
  are respelled by `simplifyRoot` for their scale (`b2` over Bb → B, not Cb).
  `defaultScale(chord)` gives the default option's scale text.
- `chart.ts` `resolveScale(row)`: explicit scale cell, else the default, else
  `null` (UI prompts).

## 4. Chart model and text ⇄ grid sync

The text format needs a document model that preserves comments and `@copy`.

```ts
type ChartLine =
  | { kind: 'meta'; key: 'title' | 'subtitle'; value: string }
  | { kind: 'row'; section: string; bar: string; chord: string; scale: string }  // scale '' = default
  | { kind: 'copy'; src: string; dst: string; offset: number }
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }
  | { kind: 'invalid'; text: string }     // bad line, kept verbatim so text round-trips

type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>  // line 0 = whole chart
type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>
```

- `parseChart(text) → Parsed<ChartDoc>`: tolerant; bad lines become `invalid` lines plus a diagnostic, never exceptions.
- `fatal` diagnostics (`isFatal`) mean a hard input limit was exceeded (length, rows, expanded rows). The UI must not render or write back such a chart. Non-fatal ones are per-line errors shown inline.
- `serializeChart(doc) → text`: canonical, column-aligned.
- `expandRows(doc) → Parsed<Row[]>`: applies `@copy` in order (as Python does), capped at 1,000 rows.
- Single source of truth is `ChartDoc` in `useChart`.
  - Text edits → debounce (~150 ms) → parse → replace doc. Text is not reformatted while you type; the canonical form applies only after a grid edit.
  - Grid edits → new doc (immutable update) → serialize → text.
- Grid shows each `ChartLine` as a row: data rows are editable cells, `@copy` is
  a compact directive row, comments are collapsed. Expanded copies are shown
  read-only in the preview, not the grid.
- Cell validation (`cellError`): values may not contain `|` or line breaks, start or end with spaces, or start with `#`, `@`, `title:` or `subtitle:`. Otherwise the serialized text would re-parse as a different line. A rejected value stays visible and flagged in its cell (`GridCell`), and the doc keeps the last good value.
- Chord cell: free text with validation. Scale cell (`ScaleCell`): a dropdown of
  "Default · …", the quality's alternates (with notes), and "Other…", which opens an inline
  picker (root + any of the 23 scales). Unknown quality → amber border and "Choose a scale…",
  with "Other…" still available.

## 5. Rendering

- One `ScaleStaff` per expanded row: HTML label column (section · bar, chord
  symbol, scale name) on the left, VexFlow SVG stave on the right. HTML labels
  give better typography and accessibility than VexFlow text.
- VexFlow: one stave, clef, no time signature, whole notes, an explicit
  accidental on every altered note (matches `\accidentalStyle forget`), double
  bar line, final bar line on the last staff.
- Two parts as in the CLI: "Spelled from X" and "Spelled from the Root", each
  with its own title header. Mode selector: both / from / root; start-note select
  (written pitch, any of the picker's 17 roots, default C). Page subtitles follow the CLI
  (`pageSubtitle`): "Subtitle – Tenor Sax (Bb) (Spelled from C)".
- Instrument select: the CLI's 16 presets, grouped by what they read (C treble, B♭, E♭, F,
  bass clef). The choice sets the `Part` (clef + transposition) for the whole preview: notes,
  chord symbols and scale names are all written for that instrument. The chart stays concert pitch.
- VexFlow is loaded client-only (dynamic import of `vexflow/bravura`, editor page only) and bundled,
  not from a CDN, so the CSP stays `script-src 'self'`. Its Bravura font is embedded as a
  `data:` URL, so the CSP needs `font-src 'self' data:`. Drawing waits for `document.fonts.load`.
- The staff SVG uses `currentColor`, so it follows light/dark mode and prints black.
  It is drawn in a 1200-unit-wide space, and each staff's viewBox is cropped to its notes'
  vertical range, measured from VexFlow's note-head positions plus room for accidentals.
  SVG `getBBox` can't be used, because it measures glyphs by font ascent, not ink. There is
  a minimum band around the staff so ordinary staves line up. In print, staves are about
  45–65px tall, so 12 fit on a letter page even when every note has ledger lines
  (e.g. bass clef from B).
- `engine/sheet.ts` builds the view model (`StaffModel`: labels, notes, or an error such as
  "Choose a scale"); components only draw it. Live preview re-renders only changed staves
  (each staff's `id` combines its position, its row content and the mode).

## 6. Styling

- Tailwind CSS v4 through `@tailwindcss/vite` in `nuxt.config.ts`. Styles live in utility classes on components, with a single `app/assets/css/main.css` for `@import "tailwindcss"` and theme tokens.
- Palette: cool slate neutrals with a teal accent (`--color-accent`: teal-700 for AA contrast, teal-400 in dark mode) and sky focus rings (sky-600, sky-400 in dark mode). The look is clean and minimal.
- Dark mode is a `.dark` class on `<html>`, toggled in the header. The default is light, and the choice is saved per browser. `public/theme-init.js` applies it before first paint; it is a file, not an inline script, so the CSP needs no `unsafe-inline` for scripts. Print is always light.
- Tailwind generates its CSS at build time and serves it as a static file, so the CSP stays the same.
- The print layout uses Tailwind's `print:` variant (`print:hidden`, `print:break-after-page`) plus a small `@page` rule in `main.css`.

## 6a. Print / PDF

- `@page { size: letter; margin: 10mm }`; print stylesheet hides the editor.
- Fixed N staves per page (default 12, the CLI's `--no-pdf` default),
  implemented as page containers of N staves with `break-after: page`. The
  title/subtitle header repeats on each page.
- Users choose "Save as PDF" in the browser print dialog. No server PDF.

## 7. Library

- `import.meta.glob('../../../charts/*.txt', { query: '?raw', eager: true })` in `app/utils/library.ts` →
  `{ slug, title, subtitle, text }[]` at build time. The same parser runs, and
  the build fails if any library chart has errors (via a test).
- Title search: case- and accent-insensitive substring filter, client-side.
- "Open in editor" copies the chart into editor state; library files are never mutated.
- Contact: a "request a chart" link to the repo's new-issue page, in the footer. The URL is `runtimeConfig.public.issuesUrl`.

## 8. State

- `useChartEditor(initialText)`: `text`, `doc`, `diagnostics`, `fatal`, `rows`, `meta`,
  `setText` (debounced re-parse) and `setDoc` (grid edit → canonical text). Immutable updates only.
  Mode (both/from/root) is page state.
- `usePreferences()`: the instrument and start note, saved per browser. Stored values that
  aren't a known instrument or picker root are ignored.
- Editor draft is kept in `localStorage` (try/catch) as a per-browser convenience.
  Nothing is sent anywhere.
- The instrument picker only changes `part` and the subtitle label (`partFor`,
  `instrumentLabel` in the engine). The engine already supported every transposition.

## 9. Security

The site is static with no server code, so most of the attack surface is gone. Remaining measures:

- **Edge:** Vercel's automatic DDoS mitigation plus a Firewall rate-limit
  rule per IP on `/*` (e.g. 300 req/min) to stop scraping and floods.
- **Headers** (`vercel.json`): CSP `default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none';
  base-uri 'none'; frame-ancestors 'none'`, HSTS, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying all.
- **Input:** caps in `limits.ts`: 20,000 chars of text, 500 rows, 40 chars per
  cell, `@copy` expansion ≤ 1,000 rows. These are enforced in the parser before
  any work runs.
- **CSP and Nuxt's inline scripts:** the static HTML contains Nuxt's inline
  `window.__NUXT__` config script and an inline import map, so `script-src 'self'` alone
  would block hydration. Phase 4 must allow them by hash, generated at build time (for example
  with `nuxt-security`'s SSG hashes), or remove them via Nuxt options. Don't fall back to `'unsafe-inline'`.
- **XSS:** no `v-html` anywhere (lint rule `vue/no-v-html: error`). Chart text
  is only ever rendered as text nodes or VexFlow-escaped SVG text.
- **Supply chain:** lockfile committed, exact versions, Dependabot, `npm audit`
  in CI, minimal deps (nuxt, vexflow, tailwindcss + @tailwindcss/vite; dev: vitest, @nuxt/test-utils,
  playwright, eslint).
- If an API route is ever added: Zod validation, body-size cap, and its own
  Firewall rate-limit rule.

## 10. Testing

- **Golden parity:** `tools/export_fixtures.py` imports `jazz_scales` and writes
  `fixtures/golden.json`:
  - every scale × 21 roots (7 letters × ♭/♮/♯) × 4 transpositions → written root, notes, label, or error
  - `scale_notes` for both modes, both clefs, and several start notes
  - chord-symbol tokens for a chord corpus, including slash chords
  - `read_chart` results for each chart in `charts/`

  pytest checks that the file is up to date. vitest checks that TS output matches it exactly.
- **Engine unit tests (vitest):** written test-first, alongside each module.
  They cover what fixtures can't: quality resolution, interval roots, diagnostics, limits.
- **App (`web/test/`):** `@nuxt/test-utils` (Nuxt runtime, happy-dom) + Vue Test Utils:
  `useChartEditor` sync and debounce, library build/search, scale choices, `ChartGrid`
  edits and validation, `ScaleCell` dropdown and picker, and `ScaleSheet` pagination with
  `ScaleStaff` stubbed. VexFlow drawing needs a real browser, so it is covered by the phase 4 E2E tests.
- **Local preview:** `make dev` (live reload) and `make preview` (the production static
  build, served locally).
- **E2E (Playwright, smoke):** library search → open → preview staves count →
  print media emulation shows N staves/page.
- **CI (GitHub Actions):** pytest, fixture freshness, lint, typecheck (`nuxt typecheck`
  + engine tsconfig), vitest, `nuxt generate`, and `npm audit --omit=dev` (gating).
  A full `npm audit` is reported but does not block: build-tooling advisories don't ship.
  `vue` and `vexflow` are the only `dependencies`; everything else is build-time `devDependencies`.
  Vercel's Git integration builds a preview deploy per PR.

## 11. Phases

1. **Engine:** fixtures exporter, TS engine, parity and unit tests. No UI.
2. **App:** library, editor (text ⇄ grid), quality defaults and alternates, scale
   prompt, live preview, print. Concert pitch only.
3. **Transposition:** instrument picker, clef, start note.
4. **Hardening/deploy:** headers, Firewall rules, Playwright, Vercel project, domain later.

## 12. Decisions

1. **Optional scale column (both engines).** Rows may omit the scale (3 cells,
   or an empty 4th cell); the scale then comes from the quality's default in
   `chord_scales.json`. `jazz_scales.py` gains the same stdlib-only lookup, so
   `charts/` works in both. The CLI errors if it can't resolve a quality; the
   web app prompts.
2. **Triads.** `chord_scales.json` now has `maj` (`""`, `M`, `ma`, `major` →
   Ionian) and `m` (`-`, `mi`, `min` → Dorian).
3. **Slash-bass parsing.** `CHORD_RE` takes the quality lazily and the bass only
   as `/` + a note letter at the end, so `C6/9` gives quality `6/9` and `D7/F#`
   gives quality `7` with bass F#. The quality is then matched exactly against the aliases.
4. **Staves per page.** N = 12.
````

`README.md`:

````markdown
# jazz-scales

Generate chord-scale practice sheets from a chord chart. Each chord in the
chart becomes one staff of whole notes (no time signature), labelled with the
chord symbol and scale name. Scales are computed from their names, so spellings
are always correct. Parts can be transposed for any common jazz instrument.

## Requirements

- Python 3.8 or later (standard library only)
- [LilyPond](https://lilypond.org) 2.24 or later on your `PATH`
  - macOS: `brew install lilypond`
  - Debian/Ubuntu: `sudo apt install lilypond`
- `pdfinfo` (poppler) is optional; it improves automatic page fitting

## Quick start

```bash
python3 jazz_scales.py charts/autumn_leaves.txt
python3 jazz_scales.py charts/autumn_leaves.txt -i tenor-sax
python3 jazz_scales.py charts/autumn_leaves.txt -i trombone --from Eb
```

Each run writes a `.ly` file and a `.pdf` next to the script (use `-o output/name`
to choose the location and basename).

## Chart format

Charts are plain text, always written in **concert pitch**:

```
title: Autumn Leaves
subtitle: Full Form, Alternate Changes

# section | bar | chord | scale
A1 | 1 | Cm7   | C Dorian
A1 | 2 | F7    | F Mixolydian
A1 | 3 | Bm7   | B Dorian
A1 | 3 | E7    | E Mixolydian
@copy A1 A2 8
```

| Element | Meaning |
| --- | --- |
| `section \| bar \| chord \| scale` | One row per chord. Two chords in a bar are two rows with the same bar number. |
| `section \| bar \| chord` | Scale omitted: the chord quality's default from `chord_scales.json` is used (e.g. `Cm7` → `C Dorian`). |
| `@copy SRC DST OFFSET` | Repeat section `SRC` as `DST`, adding `OFFSET` to each bar number. |
| `title:`, `subtitle:` | Printed at the top of each page. |
| `#` | Comment line. |

Chord symbols accepted: `Cm7`, `C-7`, `Cmi7`, `Bbm7`, `Am7b5`, `D7#5`, `G7#9b13`,
`EbMaj7`, `C9`, `D7/F#`, `Cm6/Eb`. Minor chords are printed with an en dash (`C–7`).

Scales are written as `<root> <name>`, for example `Bb Dorian`, `D Half-Whole`,
`G Altered`. Run `python3 jazz_scales.py --list-scales` for the full list (23
scales plus aliases).

## Output

By default the PDF contains two parts:

1. **Spelled from a fixed note.** Every scale is written in the octave starting
   at middle C (`--from` changes the note; `--from F#3` sets the octave). If the
   start note is not in a scale, the scale begins on the next note above it.
2. **Spelled from the root.** Each scale is written from its own root.

`--mode from` or `--mode root` produces one part only.

## Instruments

```
python3 jazz_scales.py --list-instruments
```

| Preset | Clef | Key |
| --- | --- | --- |
| `concert` (default), `piano`, `vibes`, `flute`, `guitar` | treble | C |
| `trumpet`, `flugelhorn`, `clarinet`, `soprano-sax`, `tenor-sax` | treble | Bb |
| `alto-sax`, `bari-sax` | treble | Eb |
| `horn` | treble | F |
| `trombone`, `tuba`, `bass` | bass | C |

For transposing instruments the notes, chord symbols and scale names are all
transposed. `--from` is always a *written* pitch. `--clef` and `--transpose`
override a preset. Enharmonic spellings are chosen per scale to avoid
double accidentals and B#/E#/Cb/Fb (for example, concert Bm7 becomes C#m7 on a
Bb instrument, not Dbm7). Octave transpositions (tenor, bari, guitar, bass) do
not affect the output because every scale is placed in a comfortable written
range.

## Options

```
-o, --output NAME       output basename (default: derived from title and instrument)
-i, --instrument NAME   instrument preset (default: concert)
--clef {treble,bass}    override the preset's clef
--transpose {C,Bb,Eb,F} override the preset's transposition
--mode {from,root,both} which part(s) to produce (default: both)
--from NOTE             written start note for the "from" part (default: C4 treble, C3 bass)
--per-page N            force N staves per page (default: automatic)
--no-pdf                write the LilyPond file only
--list-scales           show supported scales and aliases
--list-instruments      show instrument presets
```

## Adding a scale or instrument

Both live in dictionaries near the top of `jazz_scales.py`:

- `SCALES`: `"name": ("degree formula", "Printed label")`, e.g.
  `"lydian dominant": ("1 2 3 #4 5 6 b7", "Lydian Dominant")`.
- `INSTRUMENTS`: `"name": ("clef", "key", "description")`.

## Web app

The web version lives in `web/` (Nuxt 4, Tailwind CSS, VexFlow) and is deployed as a static site.

```bash
make setup     # once
make dev       # live-reloading dev server at http://localhost:3000
make preview   # build the production static site and serve it at http://localhost:3000
```

The library lists every chart in `charts/`; add a `.txt` file there and it appears on the next build.
In the editor, pick an instrument to write the sheet for it (clef, key, chord symbols); the chart itself stays in concert pitch.

## Tests

```bash
make setup   # once: .venv with pytest, npm ci in web/
make test    # pytest + the TypeScript engine (typecheck, vitest)
```

`web/engine/` is a TypeScript port of the engine for the web app. `fixtures/golden.json`
records the Python engine's answers and the TS tests must match them; run `make fixtures`
after changing `jazz_scales.py`, `chord_scales.json` or `charts/`.
````

- [ ] **Step 2: Verify**

Run: `make test && make lint`
Expected: `12 passed`, then `Tests 92 passed`; lint clean

- [ ] **Step 3: Commit**

```bash
git add docs/design.md README.md && git commit -m "docs: instrument picker and staff cropping"
```
