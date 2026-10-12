# 7th Chord Arpeggios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second practice line on the Changes sheet: each chord's four chord tones arpeggiated in ♩/♪/𝅘𝅥𝅯 per bar, in one of ten patterns, chosen from `Line: Off · Guide Tones · 7th Chords`.

**Architecture:** A new pure engine module `engine/src/arpeggios.ts` voices the drawn rows into `GuideNote`s (the type guide tones already use), so `buildChanges` fills `ChangesBar.voice` either way and the existing drawing path draws it, with beams added. A flat `SheetLine = GuideLine | ArpeggioPattern` replaces `GuideLine` wherever the sheet's line is passed (engine, share link, components). The web keeps three preferences (mode, guide line, pattern) and composes them into a `SheetLine`.

**Tech Stack:** TypeScript strict, Vitest, Nuxt 3/Vue 3, VexFlow (`vexflow/bravura`), Playwright, Catalyst UI ports in `web/app/components/ui/`.

**Spec:** `docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md`

## Global Constraints

- Worktree: `/Users/kevdog/code/Chord-Scale-Maker-7ths`, branch `seventh-chords`. Run `make test` from there.
- `engine/` stays free of Vue/DOM/VexFlow imports; pure functions, `readonly` data.
- Pattern ids, exactly: `up-root`, `up-1st`, `up-2nd`, `up-3rd`, `down-root`, `down-1st`, `down-2nd`, `down-3rd`, `up-down`, `voice-led`. Default `up-root`.
- Labels, exactly: `Up · root`, `Up · 1st inv`, `Up · 2nd inv`, `Up · 3rd inv`, `Down · root`, `Down · 1st inv`, `Down · 2nd inv`, `Down · 3rd inv`, `Up & down`, `Voice-led`.
- Segmented control `Line: Off · Guide Tones · 7th Chords`; guide listbox `From 3rd`, `From 7th`.
- Preferences: `csm-line` (`off | guide | arpeggio`, default `off`), `csm-guide-line` (`third | seventh`, default `third`), `csm-arpeggio` (pattern id, default `up-root`).
- Share link field `line` (a `SheetLine`, absent = off) replaces `guideLine`. No backward compatibility.
- Feature flag `arpeggios`, off in `nuxt.config.ts`, on in the e2e build.
- No labels under arpeggio notes.
- Stage files by name, never `git add -A`. Commit messages: a plain sentence, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After any engine change run `make golden`; it should produce no diff (fixtures don't hold voices). If it does, review the diff before committing it.

## Review Focus

1. **A chord the engine can't read in the middle of a chart** (`N.C.`, a typo): it rests for its length, adds one diagnostic, and the next chord starts a fresh run near the centre. → Task 2, test "rests".
2. **Transposing parts:** a B♭ tenor's arpeggio is spelled from the written root, and accidentals follow the measure rule. → Task 2, test "tenor".
3. **Bass-clef parts:** arpeggios sit inside the bass range (`RANGES.bass`, E2–C4). → Task 2, test "bass".
4. **Flag off with `csm-line` = `arpeggio` saved:** the sheet shows no line and the control offers no 7th Chords. → Task 5, test "flag off".
5. **A chord held across a barline:** its pattern starts again in the next bar, with that bar's note value. → Task 2, test "held chord".

---

## File Structure

- Create `engine/src/arpeggios.ts`: patterns, chord tones, note value, voicing. One responsibility: the arpeggio line.
- Create `engine/src/__tests__/arpeggios.test.ts`.
- Modify `engine/src/guideTones.ts`: widen `GuideNote.beats`.
- Modify `engine/src/changes.ts`: `SheetLine` in `buildChanges`, `changesLinesPerPage`.
- Modify `engine/src/share.ts`: `line` field.
- Modify `engine/src/index.ts`: export the new module; update `api.test.ts` snapshot.
- Modify `web/app/utils/changesDrawing.ts`: 8th/16th durations, beams, `arpeggioAria`.
- Modify `web/app/components/ChangesSystem.vue`, `ChangesSheet.vue`: `arpeggio` prop, `line` prop.
- Create `web/app/utils/sheetLine.ts` (+ `web/test/sheetLine.test.ts`): compose/split the three preferences.
- Modify `web/app/composables/usePreferences.ts`, `PreviewControls.vue`, `EditorView.vue`, `utils/chartReport.ts`, `composables/useFeature.ts`, `web/nuxt.config.ts`, `web/package.json`.
- Modify `web/e2e/fixtures.ts`, `changes.spec.ts`, `print.spec.ts`.
- Modify `docs/design.md`.

---

### Task 1: Patterns and chord tones

**Files:**
- Create: `engine/src/arpeggios.ts`
- Create: `engine/src/__tests__/arpeggios.test.ts`
- Modify: `engine/src/index.ts` (add `export * from './arpeggios'` after `export * from './guideToneLines'`)

**Interfaces:**
- Produces:
  - `ARPEGGIO_PATTERNS: readonly ArpeggioPattern[]`, `type ArpeggioPattern`, `isArpeggioPattern(x: unknown): x is ArpeggioPattern`, `ARPEGGIO_LABELS: Readonly<Record<ArpeggioPattern, string>>`
  - `type SheetLine = GuideLine | ArpeggioPattern`, `isSheetLine(x: unknown): x is SheetLine`
  - `arpeggioTones(part: Part, chord: string, scale?: string): readonly Spelled[] | null` (3 or 4 tones, in degree order 1 3 5 7)
  - `arpeggioOrder(n: 3 | 4, inversion: number, up: boolean): readonly number[]` (4 indexes into the tones)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, arpeggioOrder, arpeggioTones, isArpeggioPattern, isSheetLine } from '../arpeggios'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const names = (chord: string, part: Part = CONCERT) => arpeggioTones(part, chord)?.map(rootName) ?? null

describe('arpeggio patterns', () => {
  it('lists the ten patterns in toolbar order, each labelled', () => {
    expect(ARPEGGIO_PATTERNS).toEqual(['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'])
    expect(ARPEGGIO_PATTERNS.map((p) => ARPEGGIO_LABELS[p])).toEqual(['Up · root', 'Up · 1st inv', 'Up · 2nd inv', 'Up · 3rd inv', 'Down · root', 'Down · 1st inv', 'Down · 2nd inv', 'Down · 3rd inv', 'Up & down', 'Voice-led'])
  })
  it('recognises patterns and sheet lines, nothing else', () => {
    expect(isArpeggioPattern('up-root')).toBe(true)
    expect(isArpeggioPattern('third')).toBe(false)
    expect(['off', 'third', 'seventh', 'voice-led'].every(isSheetLine)).toBe(true)
    expect([undefined, 'both', 3, 'Up · root'].some(isSheetLine)).toBe(false)
  })
})

describe('arpeggio tones', () => {
  it('takes four chord tones from 7th chords, altered 5ths kept, extensions dropped', () => {
    expect(names('CMaj7')).toEqual(['C', 'E', 'G', 'B'])
    expect(names('Dm7')).toEqual(['D', 'F', 'A', 'C'])
    expect(names('G7')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('Em7b5')).toEqual(['E', 'G', 'Bb', 'D'])
    expect(names('Bdim7')).toEqual(['B', 'D', 'F', 'Ab'])
    expect(names('CMaj7#5')).toEqual(['C', 'E', 'G#', 'B'])
    expect(names('G7#9')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('FMaj7#11')).toEqual(['F', 'A', 'C', 'E'])
    expect(names('C6')).toEqual(['C', 'E', 'G', 'A'])
    expect(names('G7sus4')).toEqual(['G', 'C', 'D', 'F'])
    expect(names('G7alt')).toEqual(['G', 'B', 'D#', 'F'])
  })
  it('takes three from a triad, and the chord as written over a slash bass', () => {
    expect(names('C')).toEqual(['C', 'E', 'G'])
    expect(names('Gm')).toEqual(['G', 'Bb', 'D'])
    expect(names('D7/F#')).toEqual(['D', 'F#', 'A', 'C'])
  })
  it('spells from the written root of a transposing part', () => {
    expect(names('Cm7', TENOR)).toEqual(['D', 'F', 'A', 'C'])
  })
  it('is null for a chord it cannot read', () => {
    expect(names('N.C.')).toBeNull()
    expect(names('')).toBeNull()
  })
})

describe('arpeggio order', () => {
  it('rotates four tones up, and reverses the rotation down (each Down ends where its Up starts)', () => {
    expect([0, 1, 2, 3].map((k) => arpeggioOrder(4, k, true))).toEqual([[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]])
    expect([0, 1, 2, 3].map((k) => arpeggioOrder(4, k, false))).toEqual([[3, 2, 1, 0], [0, 3, 2, 1], [1, 0, 3, 2], [2, 1, 0, 3]])
  })
  it('gives a triad its first tone again as the fourth note, and no 3rd inversion', () => {
    expect(arpeggioOrder(3, 0, true)).toEqual([0, 1, 2, 0])
    expect(arpeggioOrder(3, 1, true)).toEqual([1, 2, 0, 1])
    expect(arpeggioOrder(3, 3, true)).toEqual([0, 1, 2, 0])
    expect(arpeggioOrder(3, 0, false)).toEqual([0, 2, 1, 0])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/arpeggios.test.ts`
Expected: FAIL, cannot resolve `../arpeggios`.

- [ ] **Step 3: Implement**

`engine/src/arpeggios.ts`:

```ts
import { parseChord, writtenChordRootLenient } from './chord'
import type { GuideLine } from './guideTones'
import type { Part } from './part'
import type { Spelled } from './pitch'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'

/**
 * 7th chord arpeggios on the Changes sheet (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * each chord's four chord tones (a triad's three), arpeggiated in one of ten patterns, in quarters, eighths or
 * sixteenths by bar. Pure; no DOM.
 */

export const ARPEGGIO_PATTERNS = ['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'] as const
export type ArpeggioPattern = (typeof ARPEGGIO_PATTERNS)[number]
export const isArpeggioPattern = (x: unknown): x is ArpeggioPattern => (ARPEGGIO_PATTERNS as readonly unknown[]).includes(x)
export const ARPEGGIO_LABELS: Readonly<Record<ArpeggioPattern, string>> = {
  'up-root': 'Up · root',
  'up-1st': 'Up · 1st inv',
  'up-2nd': 'Up · 2nd inv',
  'up-3rd': 'Up · 3rd inv',
  'down-root': 'Down · root',
  'down-1st': 'Down · 1st inv',
  'down-2nd': 'Down · 2nd inv',
  'down-3rd': 'Down · 3rd inv',
  'up-down': 'Up & down',
  'voice-led': 'Voice-led',
}

/** the Changes sheet's line: none, a guide tone line, or an arpeggio pattern */
export type SheetLine = GuideLine | ArpeggioPattern
export const isSheetLine = (x: unknown): x is SheetLine => x === 'off' || x === 'third' || x === 'seventh' || isArpeggioPattern(x)

/** canonical quality -> its arpeggio's degrees: four, a triad's three; extensions dropped, altered 5ths kept */
const DEGREES: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  Maj7: ['1', '3', '5', '7'],
  'Maj7#11': ['1', '3', '5', '7'],
  'Maj7#5': ['1', '3', '#5', '7'],
  '6': ['1', '3', '5', '6'],
  m7: ['1', 'b3', '5', 'b7'],
  m6: ['1', 'b3', '5', '6'],
  mMaj7: ['1', 'b3', '5', '7'],
  '7': ['1', '3', '5', 'b7'],
  '7sus4': ['1', '4', '5', 'b7'],
  '7sus4b9': ['1', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7'],
  '7b13': ['1', '3', '5', 'b7'],
  '7b9b13': ['1', '3', '5', 'b7'],
  '7#11': ['1', '3', '5', 'b7'],
  '7alt': ['1', '3', '#5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}

/** a chord's arpeggio tones, spelled from its written root; null if the chord or its quality is unknown */
export function arpeggioTones(part: Part, chord: string, scale?: string): readonly Spelled[] | null {
  try {
    const degrees = DEGREES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    return spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' ')).map(({ letter, acc }) => ({ letter, acc }))
  } catch {
    return null
  }
}

/**
 * one arpeggio's order, as indexes into the tones: the tones rotated by the inversion, four long (a triad's first
 * tone again at the end, and its 3rd inversion is root position); down reverses it, so Down ends where Up starts
 */
export function arpeggioOrder(n: 3 | 4, inversion: number, up: boolean): readonly number[] {
  const seq = [0, 1, 2, 3].map((i) => ((inversion % n) + i) % n)
  return up ? seq : seq.reverse()
}
```

Note the triad down order: `[0,1,2,0].reverse()` is `[0,2,1,0]`, which the test expects (8 5 3 1).

Add to `engine/src/index.ts` after `export * from './guideToneLines'`:

```ts
export * from './arpeggios'
```

- [ ] **Step 4: Run tests**

Run: `cd engine && npx vitest run src/__tests__/arpeggios.test.ts`
Expected: PASS. If `baseQuality('7#9')` doesn't give `'7'`, check `engine/src/qualities.ts` for the name it gives and adjust the test's expected chord to one `guideTonesFor` already supports. Don't add qualities.

Run: `cd engine && npx vitest run src/__tests__/api.test.ts -u`, then read the snapshot diff: only the new names (`ARPEGGIO_LABELS`, `ARPEGGIO_PATTERNS`, `arpeggioOrder`, `arpeggioTones`, `isArpeggioPattern`, `isSheetLine`) should be added.

- [ ] **Step 5: Commit**

```bash
git add engine/src/arpeggios.ts engine/src/__tests__/arpeggios.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Arpeggio patterns and chord tones (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Voicing the arpeggio line

**Files:**
- Modify: `engine/src/arpeggios.ts`
- Modify: `engine/src/guideTones.ts:73` (`beats: 1 | 2 | 3 | 4` → `beats: 0.25 | 0.5 | 1 | 2 | 3 | 4`)
- Test: `engine/src/__tests__/arpeggios.test.ts`

**Interfaces:**
- Consumes: `arpeggioTones`, `arpeggioOrder`, `ArpeggioPattern` (Task 1); `GuideInput`, `GuideNote`, `voiceAccidentals` from `./guideTones`; `rangeOf`, `Pitched` from `./part`; `Range` from `./instruments`; `pcOf` from `./pitch`.
- Produces:
  - `type NoteValue = 1 | 0.5 | 0.25`; `noteValue(shortest: number): NoteValue`
  - `arpeggioVoices(chords: readonly GuideInput[], part: Part, beats: 2 | 3 | 4, keySig: string | null, pattern: ArpeggioPattern): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] }`

Range reference for expectations: concert treble range is `RANGES.treble` = C4–A5 (midi 60–81), centre A4 (69). Bass: E2–C4 (40–60), centre C♯3 (49).

- [ ] **Step 1: Write the failing tests** (append to `arpeggios.test.ts`; add `arpeggioVoices, noteValue` to the import, plus `import type { GuideInput, GuideNote } from '../guideTones'` and `import { toVexKey } from '../sheet'`)

```ts
const BASS: Part = { clef: 'bass', trans: 'C' }
/** chords one after another, each `beats` long */
const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, start, beats }
    start += beats
    return c
  })
}
const voice = (cs: readonly GuideInput[], pattern: Parameters<typeof arpeggioVoices>[4], part: Part = CONCERT, beats: 2 | 3 | 4 = 4) =>
  arpeggioVoices(cs, part, beats, null, pattern)
const pitches = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))

describe('note value', () => {
  it('is the longest of quarter, eighth, sixteenth giving the shortest chord four notes', () => {
    expect([4, 3, 2, 1].map(noteValue)).toEqual([1, 0.5, 0.5, 0.25])
  })
})

describe('arpeggio voices', () => {
  it('plays one chord a bar in quarters, root position up, the run placed nearest the centre', () => {
    const { bars } = voice(seq(['CMaj7', 4], ['Dm7', 4]), 'up-root')
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4'])
    expect(bars.get(0)?.map((n) => [n.beat, n.beats])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]])
    expect(pitches(bars.get(1))).toEqual(['d/4', 'f/4', 'a/4', 'c/5']) // D5 would leave the range at C6
  })
  it('plays two chords a bar in eighths, each from the octave nearest the last note', () => {
    const { bars } = voice(seq(['Dm7', 2], ['G7', 2]), 'up-root')
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5', 'g/4', 'b/4', 'd/5', 'f/5'])
    expect(bars.get(0)?.every((n) => n.beats === 0.5)).toBe(true)
    expect(bars.get(0)?.map((n) => n.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  })
  it('plays three chords a bar (2 + 1 + 1) in sixteenths, the long one twice', () => {
    const { bars } = voice(seq(['Dm7', 2], ['G7', 1], ['C', 1]), 'up-root')
    const bar = bars.get(0) ?? []
    expect(bar).toHaveLength(16)
    expect(bar.every((n) => n.beats === 0.25)).toBe(true)
    expect(bar.filter((n) => n.beat < 2)).toHaveLength(8)
  })
  it('fills a 3/4 bar of one chord with six eighths, the pattern again from its start', () => {
    const { bars } = voice(seq(['CMaj7', 3]), 'up-root', CONCERT, 3)
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4', 'c/4', 'e/4']) // C5 up would leave the range
  })
  it('held chord: starts its pattern again in the next bar, at that bar\'s note value', () => {
    const { bars } = voice([{ row: 0, chord: 'Dm7', start: 0, beats: 2 }, { row: 1, chord: 'CMaj7', start: 2, beats: 6 }], 'up-root')
    expect(bars.get(0)?.map((n) => n.beats)).toEqual(Array(8).fill(0.5)) // Dm7 2 + CMaj7 2: eighths
    expect(bars.get(1)?.map((n) => n.beats)).toEqual([1, 1, 1, 1]) // CMaj7 alone: quarters
    expect(pitches(bars.get(1))[0]).toMatch(/^c\//)
  })
  it('plays Down from the top, ending on the inversion\'s tone', () => {
    expect(pitches(voice(seq(['CMaj7', 4]), 'down-root').bars.get(0))).toEqual(['b/4', 'g/4', 'e/4', 'c/4'])
    expect(pitches(voice(seq(['CMaj7', 4]), 'down-1st').bars.get(0)).map((p) => p[0])).toEqual(['c', 'b', 'g', 'e'])
  })
  it('plays a triad with its first tone again an octave on', () => {
    expect(pitches(voice(seq(['C', 4]), 'up-1st').bars.get(0))).toEqual(['e/4', 'g/4', 'c/5', 'e/5'])
  })
  it('alternates Up & down each arpeggio', () => {
    const { bars } = voice(seq(['Dm7', 4], ['G7', 4], ['CMaj7', 4]), 'up-down')
    expect([0, 1, 2].map((b) => pitches(bars.get(b)))).toEqual([
      ['d/4', 'f/4', 'a/4', 'c/5'],
      ['f/5', 'd/5', 'b/4', 'g/4'],
      ['c/4', 'e/4', 'g/4', 'b/4'],
    ])
  })
  it('voice-led: starts each chord on its tone nearest the last note, going up', () => {
    const { bars } = voice(seq(['Dm7', 4], ['G7', 4]), 'voice-led')
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5'])
    expect(pitches(bars.get(1))).toEqual(['b/4', 'd/5', 'f/5', 'g/5']) // B4 is a step below C5
  })
  it('rests: a chord it cannot read rests and restarts the run near the centre', () => {
    const { bars, missing } = voice(seq(['CMaj7', 4], ['N.C.', 4], ['CMaj7', 4]), 'up-root')
    expect(bars.get(1)).toEqual([{ pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }])
    expect(pitches(bars.get(2))).toEqual(['c/4', 'e/4', 'g/4', 'b/4'])
    expect(missing).toHaveLength(1)
    expect(missing[0]).toMatch(/^no chord tones for N\.C\. \(/)
  })
  it('tenor: spells from the written root, with accidentals by the measure rule', () => {
    const { bars } = arpeggioVoices(seq(['Ab7', 4]), TENOR, 4, null, 'up-root') // written Bb7
    expect(pitches(bars.get(0))).toEqual(['bb/4', 'd/5', 'f/5', 'ab/5'])
    expect(bars.get(0)?.map((n) => n.accidental)).toEqual(['b', null, null, 'b'])
  })
  it('bass: stays inside the bass range', () => {
    expect(pitches(voice(seq(['CMaj7', 4]), 'up-root', BASS).bars.get(0))).toEqual(['c/3', 'e/3', 'g/3', 'b/3'])
  })
  it('never ties and never labels', () => {
    const notes = [...voice(seq(['Dm7', 2], ['G7', 2]), 'up-root').bars.values()].flat()
    expect(notes.some((n) => n.tie || n.tiedIn)).toBe(false)
  })
})
```

`toVexKey` output format: check `engine/src/sheet.ts`; if it returns e.g. `'bb/4'` for B♭4 the expectations stand, otherwise adjust the strings, not the logic.

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/arpeggios.test.ts`
Expected: FAIL, `arpeggioVoices` / `noteValue` not exported.

- [ ] **Step 3: Implement**

In `engine/src/guideTones.ts`, change the `GuideNote` field:

```ts
  beats: 0.25 | 0.5 | 1 | 2 | 3 | 4
```

Append to `engine/src/arpeggios.ts` (extend the imports: `import { type GuideInput, type GuideNote, voiceAccidentals } from './guideTones'`, `import type { Range } from './instruments'`, `import { type Part, rangeOf } from './part'`, `import { pcOf, type Spelled } from './pitch'`, `import { orNull } from './util'`):

```ts
export type NoteValue = 1 | 0.5 | 0.25
const NOTE_VALUES: readonly NoteValue[] = [1, 0.5, 0.25]

/** a bar's note value: the longest that gives its shortest chord (in beats) four notes or more */
export const noteValue = (shortest: number): NoteValue => NOTE_VALUES.find((v) => shortest / v >= 4) ?? 0.25

const INVERSION: Readonly<Record<string, number>> = { root: 0, '1st': 1, '2nd': 2, '3rd': 3 }

/** the tone nearest `prev` at any octave (ties: the lower pitch), as an index into the tones */
function nearestTone(tones: readonly Spelled[], prev: number): number {
  const best = tones
    .map((t, i) => {
      const up = (pcOf(t) - (prev % 12) + 12) % 12
      const down = (12 - up) % 12
      return { i, midi: down <= up ? prev - down : prev + up }
    })
    .sort((a, b) => Math.abs(a.midi - prev) - Math.abs(b.midi - prev) || a.midi - b.midi)[0]
  return best?.i ?? 0
}

/** the order and direction of the next arpeggio: count is how many the run has played (for Up & down) */
function orderFor(pattern: ArpeggioPattern, tones: readonly Spelled[], prev: number | null, count: number): Readonly<{ order: readonly number[]; up: boolean }> {
  const n = tones.length as 3 | 4
  if (pattern === 'up-down') return { order: arpeggioOrder(n, 0, count % 2 === 0), up: count % 2 === 0 }
  if (pattern === 'voice-led') return { order: arpeggioOrder(n, prev === null ? 0 : nearestTone(tones, prev), true), up: true }
  const [dir = 'up', inv = 'root'] = pattern.split('-')
  return { order: arpeggioOrder(n, INVERSION[inv] ?? 0, dir === 'up'), up: dir === 'up' }
}

/**
 * one arpeggio's pitches: each note the next of its pitch class above (up) or below (down) the last, placed whole at
 * the octave with the fewest notes out of range, then (rule 4) its first note nearest prev, nearer the centre, the
 * lower; a run's start (prev null, rule 5) at the octave whose notes average nearest the centre (a tie: the higher)
 */
function place(pcs: readonly number[], up: boolean, range: Range, prev: number | null): readonly number[] {
  const rel = pcs.reduce<number[]>((acc, pc, i) => {
    if (i === 0) return [0]
    const last = pcs[i - 1] ?? pc
    const step = up ? ((pc - last + 11) % 12) + 1 : -(((last - pc + 11) % 12) + 1)
    return [...acc, (acc[i - 1] ?? 0) + step]
  }, [])
  const first = pcs[0] ?? 0
  const options: { midi: number[]; out: number }[] = []
  for (let m = range.lo - 12; m <= range.hi + 12; m++) {
    if (((m % 12) + 12) % 12 !== first) continue
    const midi = rel.map((r) => m + r)
    options.push({ midi, out: midi.filter((x) => x < range.lo || x > range.hi).length })
  }
  const avg = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length
  const key = (o: { midi: number[]; out: number }): readonly number[] => {
    const m = o.midi[0] ?? 0
    return prev === null ? [o.out, Math.abs(avg(o.midi) - range.centre), -m] : [o.out, Math.abs(m - prev), Math.abs(m - range.centre), m]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0)
  return [...options].sort((a, b) => cmp(key(a), key(b)))[0]?.midi ?? rel.map((r) => range.centre + r)
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

type Segment = Readonly<{ chord: number; bar: number; beat: number; length: number }>

/**
 * the arpeggio line's voice for chords in time order (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * by timeline bar, the bar's notes, each bar in its own note value (rule 2), each chord's slots filled by repeating
 * its pattern from the start (rule 3, again in each bar it lasts into); a chord without tones rests and ends the run
 * (rule 6); accidentals by the measure rule against keySig (null: C). missing: a diagnostic per unreadable chord.
 */
export function arpeggioVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  pattern: ArpeggioPattern,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  const missing: string[] = []
  const tones = chords.map((c) => {
    const t = arpeggioTones(part, c.chord, c.scale)
    if (!t) {
      const why = `no chord tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const segments: Segment[] = chords.flatMap((c, chord) => {
    const out: Segment[] = []
    for (let at = c.start; at < c.start + c.beats; ) {
      const bar = Math.floor(at / beats)
      const length = Math.min(c.start + c.beats, (bar + 1) * beats) - at
      out.push({ chord, bar, beat: at - bar * beats, length })
      at += length
    }
    return out
  })
  const shortest = new Map<number, number>()
  for (const s of segments) shortest.set(s.bar, Math.min(shortest.get(s.bar) ?? Infinity, s.length))

  const bars = new Map<number, GuideNote[]>()
  const push = (bar: number, note: GuideNote): void => {
    bars.set(bar, [...(bars.get(bar) ?? []), note])
  }
  let prev: number | null = null
  let count = 0
  for (const s of segments) {
    const t = tones[s.chord]
    if (!t) {
      push(s.bar, { pitch: null, beat: s.beat, beats: s.length as GuideNote['beats'], tie: false, tiedIn: false, accidental: null })
      prev = null
      count = 0
      continue
    }
    const v = noteValue(shortest.get(s.bar) ?? s.length)
    const slots = Math.round(s.length / v)
    for (let k = 0; k < slots; k += 4) {
      const { order, up } = orderFor(pattern, t, prev, count)
      const midi = place(order.map((i) => pcOf(t[i] ?? t[0] as Spelled)), up, range, prev)
      const take = Math.min(4, slots - k)
      for (let j = 0; j < take; j++) {
        const tone = t[order[j] ?? 0] as Spelled
        push(s.bar, { pitch: { ...tone, midi: midi[j] ?? 0 }, beat: s.beat + (k + j) * v, beats: v, tie: false, tiedIn: false, accidental: null })
      }
      prev = midi[take - 1] ?? prev
      count++
    }
  }
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, missing }
}
```

- [ ] **Step 4: Run tests**

Run: `cd engine && npx vitest run src/__tests__/arpeggios.test.ts && npx tsc --noEmit -p .`
Expected: PASS. Widening `beats` may flag `DURATIONS[n.beats]` in `web/app/utils/changesDrawing.ts`; Task 4 fixes it. If the root typecheck fails only there, go on and fix it in Task 4.

- [ ] **Step 5: Commit**

```bash
git add engine/src/arpeggios.ts engine/src/guideTones.ts engine/src/__tests__/arpeggios.test.ts
git commit -m "Voice 7th chord arpeggios bar by bar (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SheetLine through buildChanges and the share link

**Files:**
- Modify: `engine/src/changes.ts` (imports; `changesLinesPerPage`; `buildChanges` signature and the `guideLine` block near line 233)
- Modify: `engine/src/share.ts:1,24-25,99`
- Test: `engine/src/__tests__/changes.test.ts`, `engine/src/__tests__/share.test.ts`

**Interfaces:**
- Consumes: `SheetLine`, `isArpeggioPattern`, `isSheetLine`, `arpeggioVoices` (Tasks 1–2).
- Produces: `buildChanges(doc, part, barsPerLine?, signatures?, line: SheetLine = 'off', view?)`; `changesLinesPerPage(line: SheetLine, rows)`; `ShareView.line?: SheetLine` (no `guideLine`).

- [ ] **Step 1: Write the failing tests**

Append to `engine/src/__tests__/changes.test.ts` (use the file's own chart helper; if it has none, `parseChart` from `../chart` as below):

```ts
describe('buildChanges with an arpeggio line', () => {
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | CMaj7\n').value
  it('fills each bar\'s voice with the arpeggio, and no guide labels', () => {
    const sheet = buildChanges(doc, CONCERT, 4, false, 'up-root')
    const [bar1, bar2] = sheet.lines[0]?.bars ?? []
    expect(bar1?.voice).toHaveLength(8)
    expect(bar2?.voice).toHaveLength(4)
    expect(sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => c.guide)))).toEqual(['', '', ''])
  })
  it('still draws guide tones for third and seventh, and nothing for off', () => {
    expect(buildChanges(doc, CONCERT, 4, false, 'third').lines[0]?.bars[0]?.voice).toHaveLength(2)
    expect(buildChanges(doc, CONCERT, 4, false, 'off').lines[0]?.bars[0]?.voice).toEqual([])
  })
  it('gives an arpeggio line the page count of a guide tone line', () => {
    const rows = { numerals: true, scales: true }
    expect(changesLinesPerPage('up-root', rows)).toBe(changesLinesPerPage('third', rows))
  })
})
```

`parseChart(text).value` is how `changes.test.ts` builds docs; `CONCERT` and `changesLinesPerPage` may need adding to its imports.

In `engine/src/__tests__/share.test.ts`, replace the two `guideLine` tests (lines ~52–62) with:

```ts
  it("carry the Changes sheet's line: a guide tone line or an arpeggio pattern", async () => {
    for (const line of ['third', 'seventh', 'up-root', 'voice-led'] as const) {
      const view = { sheet: 'changes', numerals: true, line } as const
      expect(await decodeShare(await encodeShare(CHART, view))).toEqual({ chart: CHART, view })
    }
  })
  it('read any other line as none (absent), and the old guideLine not at all', () => {
    for (const line of ['off', 'both', 'Up · root', true, 3, null]) expect(shareViewFrom({ sheet: 'changes', line })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ sheet: 'changes', guideLine: 'third' })).toEqual({ sheet: 'changes' })
    expect(shareViewFrom({ fromThird: true, fromSeventh: true, guideThird: true, guideSeventh: true })).toBeUndefined()
  })
```

Keep the existing round-trip helper names (`encodeShare`/`packed`) the file already uses; copy the shape of the test you replace.

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run src/__tests__/changes.test.ts src/__tests__/share.test.ts`
Expected: FAIL (type errors on `'up-root'`; `line` not carried).

- [ ] **Step 3: Implement**

`engine/src/changes.ts`:

```ts
import { arpeggioVoices, isArpeggioPattern, type SheetLine } from './arpeggios'
import { type GuideInput, type GuideNote, guideVoices } from './guideTones'
```

```ts
export function changesLinesPerPage(line: SheetLine, rows: Readonly<{ numerals: boolean; scales: boolean }>): number {
```

```ts
export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false, line: SheetLine = 'off', view: ScaleView = STANDARD): ChangesSheet {
```

Replace `const guideLine = line === 'off' ? null : guideVoices(drawn(), part, beats, keySig, line)` with:

```ts
  const voices: { bars: ReadonlyMap<number, readonly GuideNote[]>; labels: ReadonlyMap<number, string>; missing: readonly string[] } | null =
    line === 'off' ? null : isArpeggioPattern(line) ? { ...arpeggioVoices(drawn(), part, beats, keySig, line), labels: new Map() } : guideVoices(drawn(), part, beats, keySig, line)
```

and rename the three later uses `guideLine?.labels`, `guideLine?.bars`, `guideLine ? [...diagnostics, ...guideLine.missing]` to `voices`. Update the doc comments that say "guide tone line" for `voice` / the sheet header to "guide tone line or arpeggio line".

`engine/src/share.ts`: replace `import type { GuideLine } from './guideTones'` with `import { isSheetLine, type SheetLine } from './arpeggios'`; the field:

```ts
  /** the Changes sheet's line: a guide tone line or an arpeggio pattern; absent: off */
  line?: SheetLine
```

and the parser line:

```ts
    ...(isSheetLine(o.line) && o.line !== 'off' ? { line: o.line } : {}), // anything else: off
```

- [ ] **Step 4: Run tests**

Run: `cd engine && npx vitest run && cd .. && make golden && git status --short engine/fixtures`
Expected: PASS; no fixture change. (Web typecheck still fails until Tasks 4–5; that's expected.)

- [ ] **Step 5: Commit**

```bash
git add engine/src/changes.ts engine/src/share.ts engine/src/__tests__/changes.test.ts engine/src/__tests__/share.test.ts
git commit -m "Changes sheet and share links take a SheetLine (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Drawing eighths and sixteenths, beamed

**Files:**
- Modify: `web/app/utils/changesDrawing.ts` (`DURATIONS` line 22; `Opts` line 34; `tickFor` ~196; `guideAria` ~126; `Laid` + `drawGuideLine` ~236–305)
- Modify: `web/app/components/ChangesSystem.vue` (props ~159, `hasGuideLine` 267, draw call 293, watch 323)
- Modify: `web/app/components/ChangesSheet.vue` (prop `guideLine` → `line`, `guideOn` → `lineOn`, pass `arpeggio`)
- Test: `web/test/changesDrawing.test.ts`, `web/test/ChangesSheet.test.ts`

**Interfaces:**
- Consumes: `SheetLine`, `isArpeggioPattern` from `@chord-scale-maker/engine`; `GuideNote.beats` widened (Task 2).
- Produces: `arpeggioAria(line: ChangesLine): string`; `Opts.arpeggio?: boolean`; `ChangesSystem` prop `arpeggio?: boolean`; `ChangesSheet` prop `line?: SheetLine`.

- [ ] **Step 1: Write the failing tests**

In `web/test/changesDrawing.test.ts`, add `arpeggioAria` and `DURATIONS` to the import from `~/utils/changesDrawing`, and reuse the file's existing bar/line builders from the `guideAria` tests:

```ts
describe('DURATIONS', () => {
  it('has eighths and sixteenths for arpeggio notes', () => {
    expect([DURATIONS[0.5], DURATIONS[0.25]]).toEqual(['8', '16'])
  })
})

describe('arpeggioAria', () => {
  it('is empty without a voice', () => {
    expect(arpeggioAria(lineOf([barOf([chordAt(0, 'C')], [])]))).toBe('')
  })
  it("groups each chord's notes, chords by comma, bars by bar", () => {
    const n = (letter: 'C' | 'E' | 'G' | 'B' | 'D' | 'F' | 'A', midi: number, beat: number) =>
      ({ pitch: { letter, acc: 0, midi }, beat, beats: 0.5, tie: false, tiedIn: false, accidental: null }) as const
    const bar = barOf([chordAt(0, 'Dm7'), chordAt(2, 'G7')], [n('D', 62, 0), n('F', 65, 0.5), n('A', 69, 1), n('C', 72, 1.5), n('G', 67, 2), n('B', 71, 2.5), n('D', 74, 3), n('F', 77, 3.5)])
    expect(arpeggioAria(lineOf([bar]))).toBe('; 7th chords: D4 F4 A4 C5, G4 B4 D5 F5')
  })
})
```

If the file has no `lineOf` / `barOf` / `chordAt` helpers, write them at the top of the new block by copying the object literals the `guideAria` tests build (a `ChangesLine` with `bars`, `sectionEnd: false`).

In `web/test/ChangesSheet.test.ts`: rename the `guideLine` mount option and prop to `line` (type `SheetLine`), and extend the lines-per-page loop at ~line 83 to `for (const line of ['off', 'third', 'up-root'] as const)`. Add:

```ts
  it('tells each system it draws an arpeggio line, and gives line 1 the clef', async () => {
    const system = (await mountSheet({ line: 'up-root' })).findComponent({ name: 'ChangesSystem' })
    expect(system.props('arpeggio')).toBe(true)
    expect(system.props('clef')).toBe('treble')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run test/changesDrawing.test.ts test/ChangesSheet.test.ts`
Expected: FAIL (`arpeggioAria` missing, `line` prop unknown).

- [ ] **Step 3: Implement**

`changesDrawing.ts`:

```ts
export const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q', 0.5: '8', 0.25: '16' } as const // 3 beats: a dotted half
```

```ts
type Opts = Readonly<{ timeSignature: boolean; beats: 2 | 3 | 4; barsPerLine: number; clef?: Clef; names?: readonly (readonly NamedBeat[])[]; arpeggio?: boolean }>
type Beam = InstanceType<VexFlowModule['Beam']>
```

Add after `guideAria`:

```ts
/** the aria-label's arpeggio line: each chord's notes, "rest" for a rest, "–" for a bar without chords; '' when off */
export function arpeggioAria(line: ChangesLine): string {
  if (!line.bars.some((b) => b.voice.length)) return ''
  const bars = line.bars.map((bar) => {
    const chords = bar.chords.map((c, k) => {
      const end = bar.chords[k + 1]?.beat ?? Infinity
      return bar.voice.filter((n) => n.beat >= c.beat && n.beat < end).map((n) => (n.pitch ? pitchName(n.pitch) : 'rest')).join(' ')
    })
    return chords.join(', ') || '–'
  })
  return `; 7th chords: ${bars.join(' | ')}`
}
```

In `Laid` add `beams: readonly Beam[]`. In pass 1 of `drawGuideLine`, after `ticks` is built and before the `Formatter`:

```ts
    const beams = opts.arpeggio ? vf.Beam.generateBeams(ticks.filter((t) => !t.isRest()), { groups: [new vf.Fraction(1, 4)] }) : []
```

and return `beams` in the `Laid` object. After `laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))` add:

```ts
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
```

Replace the label suffix in the final `fitSvg` call: `barsLabel(line) + (opts.arpeggio ? arpeggioAria(line) : guideAria(line))`.

`ChangesSystem.vue`: add the prop `arpeggio?: boolean // the voice is an arpeggio line: beamed, no label row`; `const hasGuideLine = computed(() => !props.arpeggio && props.line.bars.some((b) => b.voice.length > 0))`; in the draw call add `...(props.arpeggio ? { arpeggio: true } : {})`; add `props.arpeggio` to the `watch` array.

`ChangesSheet.vue`: import `isArpeggioPattern, type SheetLine` (drop `GuideLine`); prop `line?: SheetLine // a guide tone or arpeggio line, as notes in place of the slashes (the clef then always starts line 1)`; then

```ts
const line = computed((): SheetLine => props.line ?? 'off')
const lineOn = computed(() => line.value !== 'off')
const arpeggio = computed(() => isArpeggioPattern(line.value))
```

replace `guideOn` with `lineOn` in the template (two places), and add `:arpeggio="arpeggio"` on `<ChangesSystem>`.

- [ ] **Step 4: Run tests**

Run: `cd web && npx vitest run test/changesDrawing.test.ts test/ChangesSheet.test.ts test/ChangesSystem.test.ts`
Expected: PASS. (EditorView still passes `guide-line`; Task 5 changes it.)

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/changesDrawing.ts web/app/components/ChangesSystem.vue web/app/components/ChangesSheet.vue web/test/changesDrawing.test.ts web/test/ChangesSheet.test.ts
git commit -m "Draw the arpeggio line, beamed by the beat (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Toolbar, preferences, share and the feature flag

**Files:**
- Create: `web/app/utils/sheetLine.ts`, `web/test/sheetLine.test.ts`
- Modify: `web/app/composables/usePreferences.ts`, `web/app/components/PreviewControls.vue`, `web/app/components/EditorView.vue` (lines ~133, ~181, ~541, ~618), `web/app/utils/chartReport.ts`, `web/app/composables/useFeature.ts`, `web/nuxt.config.ts:81-87`, `web/package.json:14`
- Test: `web/test/usePreferences.test.ts`, `web/test/EditorView.test.ts` (block at ~161), `web/test/chartReport.test.ts`, `web/test/features.test.ts:15`

**Interfaces:**
- Consumes: `SheetLine`, `ArpeggioPattern`, `isArpeggioPattern`, `ARPEGGIO_PATTERNS`, `ARPEGGIO_LABELS`, `ShareView.line`.
- Produces:
  - `type LineMode = 'off' | 'guide' | 'arpeggio'`, `type GuideFrom = 'third' | 'seventh'`
  - `sheetLineOf(mode: LineMode, guide: GuideFrom, arpeggio: ArpeggioPattern, arpeggiosOn: boolean): SheetLine`
  - `lineChoiceOf(line: SheetLine | undefined): Readonly<{ mode: LineMode; guide?: GuideFrom; arpeggio?: ArpeggioPattern }>`
  - `usePreferences()` returns `lineMode`, `guideLine` (now `GuideFrom`), `arpeggio`; `linkPreferences(view)` the same three.
  - `guidesText(line: SheetLine): string`

- [ ] **Step 1: Write the failing tests**

`web/test/sheetLine.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lineChoiceOf, sheetLineOf } from '~/utils/sheetLine'

describe('sheetLineOf', () => {
  it('composes the mode with its own detail', () => {
    expect(sheetLineOf('off', 'seventh', 'down-2nd', true)).toBe('off')
    expect(sheetLineOf('guide', 'seventh', 'down-2nd', true)).toBe('seventh')
    expect(sheetLineOf('arpeggio', 'seventh', 'down-2nd', true)).toBe('down-2nd')
  })
  it('flag off: a saved arpeggio mode shows no line', () => {
    expect(sheetLineOf('arpeggio', 'third', 'up-root', false)).toBe('off')
  })
})

describe('lineChoiceOf', () => {
  it('splits a line back into its mode and detail', () => {
    expect(lineChoiceOf(undefined)).toEqual({ mode: 'off' })
    expect(lineChoiceOf('off')).toEqual({ mode: 'off' })
    expect(lineChoiceOf('third')).toEqual({ mode: 'guide', guide: 'third' })
    expect(lineChoiceOf('voice-led')).toEqual({ mode: 'arpeggio', arpeggio: 'voice-led' })
  })
})
```

Append to `web/test/usePreferences.test.ts` inside `describe('usePreferences')`:

```ts
  it('starts with no line, guide tones from the 3rd and arpeggios Up · root, and remembers each', async () => {
    const p = prefs()
    expect([p.lineMode.value, p.guideLine.value, p.arpeggio.value]).toEqual(['off', 'third', 'up-root'])
    p.lineMode.value = 'arpeggio'
    p.arpeggio.value = 'voice-led'
    await nextTick()
    expect([localStorage.getItem('csm-line'), localStorage.getItem('csm-arpeggio')]).toEqual(['arpeggio', 'voice-led'])
    expect(prefs().arpeggio.value).toBe('voice-led')
  })
  it('falls back from stored values it does not know', () => {
    localStorage.setItem('csm-line', 'both')
    localStorage.setItem('csm-guide-line', 'off')
    localStorage.setItem('csm-arpeggio', 'sideways')
    const p = prefs()
    expect([p.lineMode.value, p.guideLine.value, p.arpeggio.value]).toEqual(['off', 'third', 'up-root'])
  })
```

and in its `linkPreferences` block (adjust if the existing test asserts `guideLine` from a link):

```ts
  it("takes a link's line, and no line when it has none", () => {
    expect(linked({ line: 'down-1st' }).lineMode.value).toBe('arpeggio')
    expect(linked({ line: 'down-1st' }).arpeggio.value).toBe('down-1st')
    expect(linked({ line: 'seventh' }).guideLine.value).toBe('seventh')
    expect(linked({}).lineMode.value).toBe('off')
  })
```

`web/test/chartReport.test.ts`: add

```ts
  it('names an arpeggio line by its label', () => {
    expect(guidesText('up-2nd')).toBe('7th chords: Up · 2nd inv')
    expect(guidesText('third')).toBe('from 3rd')
    expect(guidesText('off')).toBe('')
  })
```

`web/test/features.test.ts:15`: add `arpeggios: false` to the expected object, so it reads `{ myCharts: true, practice: true, changes: true, functions: true, keySignatures: true, arpeggios: false }`.

`web/test/EditorView.test.ts`, the `EditorView guide tones` block (~161–200): change it to the new control. Replace the helpers and the first two tests with:

```ts
  const modeOptions = (w: Wrapper) => w.findAll('label').filter((l) => l.find('input[type="radio"][name="line-mode"]').exists())
  const checkedMode = (w: Wrapper) => modeOptions(w).filter((l) => (l.find('input').element as HTMLInputElement).checked).map((l) => l.text())
  const chooseMode = async (w: Wrapper, label: string) => {
    const option = modeOptions(w).find((l) => l.text() === label)
    if (!option) throw new Error(`no line option ${label}`)
    await option.find('input').setValue(true)
    await flushPromises()
  }

  it('offers Line: Off, Guide Tones, 7th Chords, off at first', async () => {
    const w = await mount()
    expect(w.findAll('label').some((l) => l.text() === 'Line')).toBe(true)
    expect(modeOptions(w).map((l) => l.text())).toEqual(['Off', 'Guide Tones', '7th Chords'])
    expect(checkedMode(w)).toEqual(['Off'])
    expect(changesSheet(w).props('line')).toBe('off')
    w.unmount()
  })

  it('passes guide tones from the 3rd, then an arpeggio Up · root, and remembers the mode', async () => {
    const w = await mount()
    await chooseMode(w, 'Guide Tones')
    expect(changesSheet(w).props('line')).toBe('third')
    await chooseMode(w, '7th Chords')
    expect(changesSheet(w).props('line')).toBe('up-root')
    expect(localStorage.getItem('csm-line')).toBe('arpeggio')
    w.unmount()
  })
```

Keep whatever `mount()` / `changesSheet()` / `flushPromises` helpers the block already uses; the mount must enable the `arpeggios` flag. Find how the file sets runtime config (search for `features`) and turn on `arpeggios: true` there. If the existing tests choose `From 7th` through the radios, change them to pick it from the `Guide tone line` listbox the way other listbox tests in the file do (search `UiListbox` / `listbox` in `web/test/`).

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run test/sheetLine.test.ts test/usePreferences.test.ts test/chartReport.test.ts test/features.test.ts test/EditorView.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`web/app/utils/sheetLine.ts`:

```ts
import { type ArpeggioPattern, isArpeggioPattern, type SheetLine } from '@chord-scale-maker/engine'

/** the Changes sheet's line as the toolbar picks it: a mode, and each mode's own choice */
export type LineMode = 'off' | 'guide' | 'arpeggio'
export type GuideFrom = 'third' | 'seventh'

/** the line shown: the mode with its choice; with the arpeggios flag off, an arpeggio mode shows none */
export const sheetLineOf = (mode: LineMode, guide: GuideFrom, arpeggio: ArpeggioPattern, arpeggiosOn: boolean): SheetLine =>
  mode === 'guide' ? guide : mode === 'arpeggio' && arpeggiosOn ? arpeggio : 'off'

/** a line (a share link's) as the mode and the choice it sets */
export function lineChoiceOf(line: SheetLine | undefined): Readonly<{ mode: LineMode; guide?: GuideFrom; arpeggio?: ArpeggioPattern }> {
  if (line === 'third' || line === 'seventh') return { mode: 'guide', guide: line }
  if (isArpeggioPattern(line)) return { mode: 'arpeggio', arpeggio: line }
  return { mode: 'off' }
}
```

`usePreferences.ts`: import `type ArpeggioPattern, isArpeggioPattern` (drop `GuideLine`) and `{ type GuideFrom, type LineMode, lineChoiceOf } from '~/utils/sheetLine'`. Replace the `guideLine` ref:

```ts
  // the Changes sheet's line: off, guide tones (from the 3rd or the 7th) or 7th chord arpeggios (a pattern); off until chosen
  const lineMode = storedRef<LineMode>('csm-line', (s) => (s === 'off' || s === 'guide' || s === 'arpeggio' ? s : undefined), 'off')
  const guideLine = storedRef<GuideFrom>('csm-guide-line', (s) => (s === 'third' || s === 'seventh' ? s : undefined), 'third')
  const arpeggio = storedRef<ArpeggioPattern>('csm-arpeggio', (s) => (isArpeggioPattern(s) ? s : undefined), 'up-root')
```

return `lineMode, guideLine, arpeggio` in place of `guideLine`. In `linkPreferences`:

```ts
  const choice = lineChoiceOf(view.line)
  ...
    lineMode: ref<LineMode>(choice.mode), // a link without one shows no line
    guideLine: ref<GuideFrom>(choice.guide ?? own.guideLine.value),
    arpeggio: ref<ArpeggioPattern>(choice.arpeggio ?? own.arpeggio.value),
```

`useFeature.ts`: `export type Feature = 'myCharts' | 'practice' | 'changes' | 'functions' | 'keySignatures' | 'arpeggios'`.

`nuxt.config.ts` features: add `arpeggios: false, // 7th chord arpeggios on the Changes sheet (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md)`.

`web/package.json` `e2e` script: add `NUXT_PUBLIC_FEATURES_ARPEGGIOS=true` after `NUXT_PUBLIC_FEATURES_KEY_SIGNATURES=true`.

`chartReport.ts`:

```ts
import { ARPEGGIO_LABELS, isArpeggioPattern, type SheetLine } from '@chord-scale-maker/engine'
/** which line is shown, for a report: 'from 3rd', 'from 7th', '7th chords: Up · root', or '' with it off */
export const guidesText = (line: SheetLine): string =>
  isArpeggioPattern(line) ? `7th chords: ${ARPEGGIO_LABELS[line]}` : ({ off: '', third: 'from 3rd', seventh: 'from 7th' } as const)[line]
```

`PreviewControls.vue`: replace the `Guide Tones` `UiField` with:

```vue
        <UiField>
          <UiLabel class="pl-3">Line</UiLabel>
          <div class="flex flex-wrap items-center gap-2">
            <SegmentedControl v-model="lineMode" legend="Line" name="line-mode" :options="lineModes" />
            <UiListbox v-if="lineMode === 'guide'" v-model="guideLine" class="w-32" aria-label="Guide tone line">
              <template #selected="{ value }"><UiListboxLabel>{{ guideLabel(value) }}</UiListboxLabel></template>
              <UiListboxOption v-for="g in GUIDE_LINES" :key="g.value" :value="g.value" :title="g.title"><UiListboxLabel>{{ g.label }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
            <UiListbox v-else-if="lineMode === 'arpeggio'" v-model="arpeggio" class="w-40" aria-label="Arpeggio pattern">
              <template #selected="{ value }"><UiListboxLabel>{{ ARPEGGIO_LABELS[value] }}</UiListboxLabel></template>
              <UiListboxOption v-for="p in ARPEGGIO_PATTERNS" :key="p" :value="p"><UiListboxLabel>{{ ARPEGGIO_LABELS[p] }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
          </div>
        </UiField>
```

Script: import `ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, type ArpeggioPattern` (drop `GuideLine`) and `type GuideFrom, type LineMode` from `~/utils/sheetLine`; replace the `guideLine` model and `GUIDE_LINES` with:

```ts
const lineMode = defineModel<LineMode>('lineMode', { default: 'off' })
const guideLine = defineModel<GuideFrom>('guideLine', { default: 'third' })
const arpeggio = defineModel<ArpeggioPattern>('arpeggio', { default: 'up-root' })
const arpeggios = useFeature('arpeggios')
// the Changes sheet's line, at most one: guide tones or 7th chord arpeggios (with the flag on)
const lineModes = computed(() => [
  { value: 'off', label: 'Off', title: 'No line: slashes' },
  { value: 'guide', label: 'Guide Tones', title: "A line that starts on the first chord's 3rd or 7th and moves to the nearest guide tone of each chord" },
  ...(arpeggios ? [{ value: 'arpeggio', label: '7th Chords', title: "Each chord's four chord tones, arpeggiated: quarters, eighths or sixteenths as the bar has one, two or more chords" }] : []),
])
const GUIDE_LINES = [
  { value: 'third', label: 'From 3rd', title: "A line that starts on the first chord's 3rd and moves to the nearest guide tone of each chord" },
  { value: 'seventh', label: 'From 7th', title: "A line that starts on the first chord's 7th and moves to the nearest guide tone of each chord" },
] as const
const guideLabel = (v: GuideFrom): string => GUIDE_LINES.find((g) => g.value === v)?.label ?? ''
```

Check `SegmentedControl`'s `options` prop type: if it requires a readonly literal tuple, type `lineModes` as `{ value: LineMode; label: string; title: string }[]`. If `UiListboxOption` doesn't pass `title` through, drop the `:title`. With the flag off and `lineMode` = `arpeggio`, the radios show none checked. Add a watch that sets `lineMode.value = 'off'` when `!arpeggios && lineMode.value === 'arpeggio'`.

`EditorView.vue`:
- toolbar: replace `v-model:guide-line="prefs.guideLine.value"` with `v-model:line-mode="prefs.lineMode.value" v-model:guide-line="prefs.guideLine.value" v-model:arpeggio="prefs.arpeggio.value"`.
- in `<script setup>`: `const arpeggiosOn = useFeature('arpeggios')` and `const sheetLine = computed(() => sheetLineOf(prefs.lineMode.value, prefs.guideLine.value, prefs.arpeggio.value, arpeggiosOn))`, importing `sheetLineOf` from `~/utils/sheetLine`.
- `<ChangesSheet>`: `:guide-line="prefs.guideLine.value"` → `:line="sheetLine"`.
- `shareUrl`: `...(sheetLine.value !== 'off' ? { line: sheetLine.value } : {}), // absent: off`.
- report: `guides: guidesText(sheetLine.value)`.

- [ ] **Step 4: Run tests**

Run: `make test`
Expected: PASS (typecheck + all vitest). Then `make lint`.

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/sheetLine.ts web/test/sheetLine.test.ts web/app/composables/usePreferences.ts web/app/components/PreviewControls.vue web/app/components/EditorView.vue web/app/utils/chartReport.ts web/app/composables/useFeature.ts web/nuxt.config.ts web/package.json web/test/usePreferences.test.ts web/test/EditorView.test.ts web/test/chartReport.test.ts web/test/features.test.ts
git commit -m "Line: Off · Guide Tones · 7th Chords, behind the arpeggios flag (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Browser tests, print check, design doc

**Files:**
- Modify: `web/e2e/fixtures.ts:107-121`, `web/e2e/changes.spec.ts`, `web/e2e/print.spec.ts:56-70`
- Modify: `docs/design.md` (the Changes toolbar paragraph ~382, a new section after "Guide tones on Changes" ~436, `changesLinesPerPage` note ~516, `PreviewControls` line ~499)

**Interfaces:**
- Consumes: everything above; e2e fixture `pickOption` (already in `fixtures.ts`).
- Produces: fixtures `showGuides(page, 'Off' | 'From 3rd' | 'From 7th')` (same signature, new control), `showArpeggios(page, label: string)`, `arpeggiosDrawn(page)`.

- [ ] **Step 1: Update fixtures and write the failing e2e tests**

`fixtures.ts`, replace `showGuides` and add two helpers:

```ts
/** choose the Changes sheet's line mode, confirmed checked (retried: a click before hydration is lost) */
async function chooseLineMode(page: Page, name: 'Off' | 'Guide Tones' | '7th Chords'): Promise<void> {
  const radio = page.getByRole('radio', { name, exact: true })
  await expect(async () => {
    if (!(await radio.isChecked())) await page.locator('label').filter({ has: radio }).click({ timeout: 1000 })
    await expect(radio).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** choose the guide tone line: Off, or Guide Tones with From 3rd / From 7th */
export async function showGuides(page: Page, name: 'Off' | 'From 3rd' | 'From 7th'): Promise<void> {
  if (name === 'Off') return chooseLineMode(page, 'Off')
  await chooseLineMode(page, 'Guide Tones')
  await pickOption(page, 'Guide tone line', name)
}

/** choose 7th Chords with a pattern ("Up · root", "Voice-led", …) */
export async function showArpeggios(page: Page, pattern: string): Promise<void> {
  await chooseLineMode(page, '7th Chords')
  await pickOption(page, 'Arpeggio pattern', pattern)
}

/** wait until every Changes line has been drawn with its arpeggios */
export async function arpeggiosDrawn(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('svg[aria-label^="Bars:"]').evaluateAll((els) => els.length > 0 && els.every((e) => e.getAttribute('aria-label')?.includes('; 7th chords: '))))
    .toBe(true)
}
```

`pickOption(page, buttonName, option)` clicks the button by accessible name. If the Catalyst listbox button's accessible name is its selected value rather than its `aria-label`, pass a RegExp or click `page.getByLabel('Guide tone line')` directly.

`changes.spec.ts`: the `guide(page, name)` radio helper at line 7 no longer fits `From 3rd`/`From 7th`. Replace every `expect(guide(page, 'From 7th')).toBeChecked()` (and the 3rd) with `await expect(page.getByLabel('Guide tone line')).toContainText('From 7th')`, and `guide(page, 'Off')` with `page.getByRole('radio', { name: 'Off', exact: true })`. Find them all with `grep -n "guide(page" web/e2e/changes.spec.ts`. Then add:

```ts
test('7th Chords arpeggiates each chord: quarters for one a bar, eighths for two, sixteenths for more, beamed', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 2 | G7\nA | 3 | Dm7\nA | 3 | G7\nA | 3 | C\nA | 4 | CMaj7\n')
  const line = lines(page).first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4 \| D4 F4 A4 C5, G4 B4 D5 F5 \| /)
  await expect.poll(async () => (await drawn(line)).heads.length).toBe(4 + 8 + 16 + 4)
  expect((await drawn(line)).slashes).toBe(0)
  expect(await line.locator('.vf-beam').count()).toBeGreaterThan(0) // VexFlow tags beams with class vf-beam; if not in this version, inspect the SVG once and use the class it does give
  await expect(labelRow(line)).toHaveCount(0) // no labels under arpeggio notes
  await showArpeggios(page, 'Down · root')
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: B4 G4 E4 C4 \|/)
  await page.reload()
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked() // remembered
  await expect(page.getByLabel('Arpeggio pattern')).toContainText('Down · root')
})

test('7th Chords in 3/4: six eighths for a bar of one chord', async ({ page }) => {
  await writeChart(page, 'title: W\nkey: C\ntime: 3/4\nA | 1 | CMaj7\nA | 2 | Dm7\n')
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await expect.poll(async () => (await drawn(lines(page).first())).heads.length).toBe(12)
})

test('a share link carries the arpeggio pattern', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | CMaj7\n')
  await showArpeggios(page, 'Voice-led')
  // reuse the share-link steps another spec uses (search `shareUrl`/`Share` in web/e2e), open the link in a new page, then:
  // await expect(other.getByLabel('Arpeggio pattern')).toContainText('Voice-led')
})
```

The metre key is `time: 3/4` (README.md). Check the `drawn()` helper's `heads` counts noteheads before running. Finish the share test with the share steps an existing spec uses (`grep -rn "share" web/e2e/*.spec.ts`), not a stub.

`print.spec.ts`: next to the guide tone print test (~line 61), add the same test for `showArpeggios(page, 'Up · root')` + `arpeggiosDrawn(page)` on the same tune and tuba part. If it shows more lines on a page than fit, lower `changesLinesPerPage` for arpeggio lines in `engine/src/changes.ts`:

```ts
  if (isArpeggioPattern(line)) return 5 + (!rows.numerals && !rows.scales ? 1 : 0)
```

and add that case to the Task 3 unit test (`toBe(5)`).

- [ ] **Step 2: Run e2e to verify the new tests fail first, then pass**

Run: `make e2e` (stash Task 5's flag line locally if you want to see the new tests fail; otherwise just confirm they pass now).
Expected: all specs PASS, including the updated guide tone specs. Look at a screenshot or the `make preview` page once: beams, stems and crop look right in light and dark mode and at phone width (375px), and the toolbar wraps cleanly.

- [ ] **Step 3: Update `docs/design.md`**

- Toolbar paragraph (~382): replace the Guide Tones segmented control sentence with: "a **Line** segmented control (Off · Guide Tones · 7th Chords) with the mode's listbox beside it (From 3rd · From 7th; or the ten arpeggio patterns) replaces Intervals on this sheet (`csm-numerals`, `csm-scale-names`, both on; `csm-line` `off | guide | arpeggio`, off; `csm-guide-line` `third | seventh`; `csm-arpeggio`, `up-root`; share links carry the sheet's line as `line`, absent meaning off). 7th Chords is behind the `arpeggios` flag."
- New section after "Guide tones on Changes": `### 7th chord arpeggios on Changes ([spec](superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md))`, with bullets: the tones (`DEGREES` in `engine/src/arpeggios.ts`), patterns, note value per bar, filling, octave placement, rests, model (`arpeggioVoices` fills `ChangesBar.voice`; `SheetLine`), drawing (beams by the beat, no label row, aria `; 7th chords: …`).
- README.md line 5: the Changes sheet's control is now Line (Off · Guide Tones · 7th Chords); add one sentence on 7th Chords.
- Module list (~46): add `arpeggios.ts         # 7th chord arpeggios for the Changes sheet (arpeggioVoices)`.
- `PreviewControls` line (~499) and lines-per-page note (~516): name the Line control and the arpeggio page count.

- [ ] **Step 4: Full check**

Run: `make test && make lint && make e2e`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/fixtures.ts web/e2e/changes.spec.ts web/e2e/print.spec.ts docs/design.md README.md
git commit -m "Browser tests and design notes for 7th chord arpeggios (#171)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add `engine/src/changes.ts engine/src/__tests__/changes.test.ts` to the `git add` if the print check lowered the page count.)
