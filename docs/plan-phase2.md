# Phase 2: Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Nuxt 4 site with a chart library (title search), an editor with a grid and the chart text side by side and kept in sync, default and alternate scales per chord, a prompt when a chord needs a scale, a live VexFlow preview, light/dark mode, and browser print to PDF at 12 staves per letter page. Concert pitch only.

**Architecture:** `web/engine/` stays pure TypeScript. Phase 2 adds `edit.ts` (grid edits, cell validation) and `sheet.ts` (rows → pages of staff view models), and tightens the engine to Nuxt's strictness (`noUncheckedIndexedAccess`). `web/app/` is a thin Nuxt layer:
- `useChartEditor` keeps the text and the `ChartDoc` in sync.
- Components render the engine's view models.
- VexFlow draws each staff into an SVG that uses `currentColor`.

`nuxt generate` builds a fully static site. The library reads `charts/*.txt` at build time.

**Tech Stack:**
- Nuxt 4.5.2, Vue 3.5.43, Tailwind CSS 4.3.3 (`@tailwindcss/vite`), VexFlow 5.0.0 (`vexflow/bravura`)
- Tests: vitest 5 projects (engine in node, app via `@nuxt/test-utils` 4.3.3 + happy-dom)
- Lint and types: ESLint 10 via `@nuxt/eslint`, vue-tsc

Specs: [requirements.md](requirements.md), [design.md](design.md). The code below has been run in a scratch worktree:
- **Engine and app:** 12 pytest and 72 vitest tests pass; lint, `nuxt typecheck`, the engine typecheck and `nuxt generate` are all clean.
- **In the browser:** the dev server and the static preview were driven in headless Chromium (library search, grid ⇄ text sync, rejected cells, scale picker, mode toggle, draft restore, dark mode), with no console errors.
- **Print:** emulated print gives 8 letter pages for Autumn Leaves (39 rows × 2 modes at 12 per page).

---

## Background for the implementer

- **Engine (from phase 1):** `web/engine/` ports `jazz_scales.py`. `fixtures/golden.json` holds the Python answers, and `engine/__tests__/golden.test.ts` must keep passing; it proves the TS port matches Python.
- **Charts:** concert-pitch text. `parseChart(text)` returns a `ChartDoc` (lines: `meta | row | copy | comment | blank | invalid`) plus diagnostics, and never throws. `serializeChart(doc)` writes canonical text. `expandRows(doc)` applies `@copy`. A diagnostic with `fatal: true` means a hard size limit was hit: don't render it or write it back.
- **Scales:** a row's scale is its own scale cell, else the default for its chord type (`resolveScale(row)`). `null` means the user must choose one. `resolveQuality(chord)` lists the default and alternate scales.
- **Nuxt 4:** the app lives in `web/app/` (the `~` alias); `~~` is `web/`, so the engine is imported as `~~/engine`. Components, composables and utils in `app/` are auto-imported in `.vue` files. The tests import them explicitly.
- **Run every npm/npx command from `web/`,** never from the repo root.
- **Commit trailer:** every commit message ends with a blank line and then exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `web/tsconfig.engine.json` (new; replaces the old `web/tsconfig.json` content) | engine + engine tests typecheck, Nuxt-level strictness |
| `web/engine/{chart,chord,part,pitch,qualities,scales}.ts`, `__tests__/{chart,golden}.test.ts` (modify) | pass `noUncheckedIndexedAccess`, behavior unchanged |
| `web/engine/edit.ts` + test | pure grid edits on a `ChartDoc`; `cellError` |
| `web/engine/sheet.ts` + test | `buildSheet` → parts → pages → `StaffModel`; `toVexKey`, `noteText` |
| `web/nuxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `package.json` | Nuxt app, types, tests (engine + app projects), lint, scripts |
| `web/app/app.vue`, `assets/css/main.css`, `public/theme-init.js`, `composables/useTheme.ts`, `components/AppHeader.vue` | shell, palette, dark mode |
| `web/app/utils/library.ts`, `pages/index.vue` + `test/library.test.ts` | build-time chart library, title search |
| `web/app/composables/useChartEditor.ts`, `useDraft.ts` + test | editor state: text ⇄ doc sync, draft |
| `web/app/utils/scaleChoices.ts`, `components/ScaleCell.vue`, `ChartGrid.vue` + tests | grid editing, scale dropdown, picker |
| `web/app/utils/vexflow.ts`, `components/{ChordSymbol,NoteName,ScaleStaff,ScaleSheet,ChartText,EditorView}.vue`, `pages/editor.vue` + test | text pane, preview, print |
| `Makefile`, `.github/workflows/ci.yml`, `.gitignore`, `docs/design.md`, `README.md`, `CLAUDE.md` | dev/preview targets, CI, docs |

---

### Task 1: Engine strictness (`noUncheckedIndexedAccess`)

Nuxt 4 type-checks with `noUncheckedIndexedAccess`, and the app imports the engine, so the engine must pass it. The changes are mechanical: regex groups are destructured with defaults, and indexed reads are guarded. Behavior does not change, and the golden test proves it.

**Files:**
- Create: `web/tsconfig.engine.json`
- Delete: `web/tsconfig.json` (Task 4 recreates it for Nuxt)
- Modify: `web/package.json` (typecheck script), `web/engine/{chart,chord,part,pitch,qualities,scales}.ts`, `web/engine/__tests__/{chart,golden}.test.ts`

- [ ] **Step 1: Create the strict engine tsconfig and point the typecheck at it**

`web/tsconfig.engine.json`:

```json
{
  // The engine and its tests, outside Nuxt (the app's tsconfigs come from .nuxt/ via tsconfig.json).
  // Same strictness as Nuxt's generated config, plus Node types for the tests.
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["engine/**/*.ts"]
}
```

Then `git rm web/tsconfig.json`, and in `web/package.json` set `"typecheck": "tsc -p tsconfig.engine.json"`.

- [ ] **Step 2: Run it to see the failures**

Run: `cd web && npm run typecheck`
Expected: about 30 errors such as `Object is possibly 'undefined'` and `Type 'string | undefined' is not assignable`, all in `engine/`.

- [ ] **Step 3: Replace these files with the strict versions** (full contents below)

`web/engine/pitch.ts`:

```ts
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6 // C D E F G A B
export type Spelled = Readonly<{ letter: Letter; acc: number }>

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const NAT_PC = [0, 2, 4, 5, 7, 9, 11] as const

/** always-positive modulo (JS % keeps the sign of the dividend) */
export const mod = (n: number, m: number): number => ((n % m) + m) % m
export const toLetter = (n: number): Letter => mod(n, 7) as Letter

export function parseRoot(tok: string): Spelled {
  const m = /^([A-Ga-g])([b#♭♯]*)$/.exec(tok)
  if (!m) throw new Error(`bad note name: ${JSON.stringify(tok)}`)
  const [, letter = '', accs = ''] = m
  const acc = [...accs].reduce((s, c) => s + (c === '#' || c === '♯' ? 1 : -1), 0)
  return { letter: 'CDEFGAB'.indexOf(letter.toUpperCase()) as Letter, acc }
}

export const accText = (acc: number): string => (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc))
export const rootName = (n: Spelled): string => LETTERS[n.letter] + accText(n.acc)
export const pcOf = (n: Spelled): number => mod(NAT_PC[n.letter] + n.acc, 12)
export const accFor = (pc: number, letter: Letter): number => mod(pc - NAT_PC[letter] + 6, 12) - 6

/** all spellings of this pitch class with at most one accidental, in letter order */
export function enharmonics(n: Spelled): Spelled[] {
  const pc = pcOf(n)
  return LETTERS.map((_, l) => ({ letter: l as Letter, acc: accFor(pc, l as Letter) })).filter(
    (s) => Math.abs(s.acc) <= 1,
  )
}
```

`web/engine/scales.ts`:

```ts
import { type Spelled, accFor, enharmonics, mod, NAT_PC, parseRoot, pcOf, rootName, toLetter } from './pitch'

/** name: [degree formula, label printed on the page]; copied verbatim from jazz_scales.py */
export const SCALES = {
  ionian: ['1 2 3 4 5 6 7', 'Ionian'],
  dorian: ['1 2 b3 4 5 6 b7', 'Dorian'],
  phrygian: ['1 b2 b3 4 5 b6 b7', 'Phrygian'],
  lydian: ['1 2 3 #4 5 6 7', 'Lydian'],
  mixolydian: ['1 2 3 4 5 6 b7', 'Mixolydian'],
  aeolian: ['1 2 b3 4 5 b6 b7', 'Aeolian'],
  locrian: ['1 b2 b3 4 b5 b6 b7', 'Locrian'],
  'locrian natural 2': ['1 2 b3 4 b5 b6 b7', 'Locrian ♮2'],
  'melodic minor': ['1 2 b3 4 5 6 7', 'Melodic Minor'],
  'harmonic minor': ['1 2 b3 4 5 b6 7', 'Harmonic Minor'],
  'lydian dominant': ['1 2 3 #4 5 6 b7', 'Lydian Dominant'],
  'lydian augmented': ['1 2 3 #4 #5 6 7', 'Lydian Augmented'],
  altered: ['1 b2 b3 3 #4 b6 b7', 'Altered'],
  'phrygian dominant': ['1 b2 3 4 5 b6 b7', 'Phrygian Dominant'],
  'half whole diminished': ['1 b2 b3 3 #4 5 6 b7', 'Half-Whole Dim.'],
  'whole half diminished': ['1 2 b3 4 b5 b6 6 7', 'Whole-Half Dim.'],
  'whole tone': ['1 2 3 #4 #5 b7', 'Whole Tone'],
  'major pentatonic': ['1 2 3 5 6', 'Major Pentatonic'],
  'minor pentatonic': ['1 b3 4 5 b7', 'Minor Pentatonic'],
  blues: ['1 b3 4 b5 5 b7', 'Blues'],
  'bebop dominant': ['1 2 3 4 5 6 b7 7', 'Bebop Dominant'],
  'bebop major': ['1 2 3 4 5 b6 6 7', 'Bebop Major'],
  'bebop dorian': ['1 2 b3 3 4 5 6 b7', 'Bebop Dorian'],
} as const satisfies Record<string, readonly [string, string]>

export type ScaleKey = keyof typeof SCALES

export const ALIASES: Readonly<Record<string, ScaleKey>> = {
  major: 'ionian',
  minor: 'aeolian',
  'natural minor': 'aeolian',
  'locrian 2': 'locrian natural 2',
  'locrian #2': 'locrian natural 2',
  'lydian b7': 'lydian dominant',
  'lydian #5': 'lydian augmented',
  'super locrian': 'altered',
  'diminished whole half': 'whole half diminished',
  'half whole': 'half whole diminished',
  hw: 'half whole diminished',
  'half whole dim': 'half whole diminished',
  'dominant diminished': 'half whole diminished',
  'whole half': 'whole half diminished',
  wh: 'whole half diminished',
  'whole half dim': 'whole half diminished',
  diminished: 'whole half diminished',
  'mixolydian b6': 'phrygian dominant',
  bebop: 'bebop dominant',
}

export type ScaleNote = Readonly<Spelled & { semis: number }>
export type ParsedScale = Readonly<{ root: Spelled; key: ScaleKey }>

export const norm = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll('-', ' ')
    .replaceAll('♮', 'natural ')
    .replaceAll('.', '')
    .replace(/\s+/g, ' ')
    .trim()

const count = (s: string, c: string): number => s.split(c).length - 1

/** scale formula on a root -> spelled notes with semitones above the root */
export function spellFrom(root: Spelled, formula: string): ScaleNote[] {
  const rootPc = pcOf(root)
  return formula
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const m = /^([b#]*)(\d+)$/.exec(tok)
      if (!m) throw new Error(`bad scale degree: ${JSON.stringify(tok)}`)
      const [, accs = '', degree = ''] = m
      const idx = toLetter(Number(degree) - 1) // degree's offset in letters, wrapping like Python's %
      const semis = NAT_PC[idx] + count(accs, '#') - count(accs, 'b')
      const letter = toLetter(root.letter + idx)
      return { letter, acc: accFor(mod(rootPc + semis, 12), letter), semis }
    })
}

const isUgly = (n: Spelled): boolean =>
  Math.abs(n.acc) > 1 ||
  (n.acc === 1 && (n.letter === 6 || n.letter === 2)) || // B#, E#
  (n.acc === -1 && (n.letter === 0 || n.letter === 3)) // Cb, Fb

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

/** first element with the smallest key (lexicographic), like Python's min() */
function minBy<T>(xs: readonly T[], key: (x: T) => readonly number[]): T {
  const [first, ...rest] = xs
  if (first === undefined) throw new Error('minBy of an empty list')
  return rest.reduce((best, x) => (lexLess(key(x), key(best)) ? x : best), first)
}

/**
 * friendliest spelling of a root, judged over the whole scale: no B#/E#/Cb/Fb or
 * double accidentals if avoidable, then fewest accidentals; ties keep the original
 * direction, else flats (but F# over Gb)
 */
export function simplifyRoot(n: Spelled, key: ScaleKey = 'ionian'): Spelled {
  const formula = SCALES[key][0]
  const cost = (o: Spelled): readonly number[] => {
    const notes = spellFrom(o, formula)
    const ugly = notes.filter(isUgly).length
    const total = notes.reduce((s, x) => s + Math.abs(x.acc), 0)
    const sameDir = o.acc === n.acc || (n.acc === 0 && (o.acc <= 0 || pcOf(o) === 6)) ? 0 : 1
    return [ugly, total, sameDir]
  }
  return minBy(enharmonics(n), cost)
}

const isScaleKey = (k: string): k is ScaleKey => Object.hasOwn(SCALES, k)

/** scale name ("Half-Whole Dim.", "hw", "Locrian ♮2") -> SCALES key */
export function scaleKey(name: string): ScaleKey {
  const k = norm(name)
  const key = (Object.hasOwn(ALIASES, k) ? ALIASES[k] : undefined) ?? k
  if (!isScaleKey(key)) throw new Error(`unknown scale ${JSON.stringify(name.trim())}`)
  return key
}

/** "Bb Dorian" -> root + key */
export function parseScale(text: string): ParsedScale {
  const t = text.trim()
  const i = t.search(/\s/)
  if (i < 0) throw new Error(`scale needs a root and a name: ${JSON.stringify(text)}`)
  return { root: parseRoot(t.slice(0, i)), key: scaleKey(t.slice(i)) }
}

export function spellScale(root: Spelled, key: ScaleKey): ScaleNote[] {
  const notes = spellFrom(root, SCALES[key][0])
  if (notes.some((n) => Math.abs(n.acc) > 2))
    throw new Error(`${rootName(root)} ${key} needs a triple accidental; pick an enharmonic root`)
  if (notes.some((n, i) => i > 0 && n.semis <= (notes[i - 1]?.semis ?? -1)))
    throw new Error(`scale formula not ascending: ${key}`)
  return notes
}
```

`web/engine/part.ts`:

```ts
import { type Clef, type Transposition, CLEF_ROOT_LOW, CLEF_START, TRANSPOSITIONS } from './instruments'
import { type Spelled, accFor, LETTERS, mod, NAT_PC, parseRoot, pcOf, toLetter } from './pitch'
import { type ScaleKey, type ScaleNote, parseScale, SCALES, simplifyRoot, spellScale } from './scales'

/** an instrument "view" of the chart */
export type Part = Readonly<{ clef: Clef; trans: Transposition }>
export type Mode = 'from' | 'root'
export type Pitched = Readonly<Spelled & { midi: number }>
export type WrittenScale = Readonly<{ root: Spelled; key: ScaleKey; notes: readonly ScaleNote[] }>
export type ScaleLabel = Readonly<{ root: Spelled; name: string }>

export const CONCERT: Part = { clef: 'treble', trans: 'C' }

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

`web/engine/chord.ts`:

```ts
import { type Part, writtenRoot } from './part'
import { type Spelled, accFor, LETTERS, mod, parseRoot, pcOf, toLetter } from './pitch'
import { parseScale, simplifyRoot } from './scales'

/** root, quality (everything between root and /bass), optional bass; same regex as jazz_scales.py */
export const CHORD_RE = /^([A-G])([b#♭♯]?)(.*?)(?:\/([A-G])([b#♭♯]?))?$/

export type ChordParts = Readonly<{ root: Spelled; quality: string; bass?: Spelled }>
export type ChordToken = Readonly<{ kind: 'text'; text: string } | { kind: 'acc'; acc: 'b' | '#' }>

export function parseChord(text: string): ChordParts {
  const m = CHORD_RE.exec(text.trim())
  if (!m) throw new Error(`cannot parse chord ${JSON.stringify(text)}`)
  const [, letter = '', acc = '', quality = '', bassLetter, bassAcc = ''] = m
  const root = parseRoot(letter + acc)
  return bassLetter === undefined ? { root, quality } : { root, quality, bass: parseRoot(bassLetter + bassAcc) }
}

const text = (t: string): ChordToken => ({ kind: 'text', text: t })
const accTokens = (acc: number): ChordToken[] =>
  Array.from({ length: Math.abs(acc) }, () => ({ kind: 'acc', acc: acc > 0 ? '#' : 'b' }) as const)

/** "m7b5" -> "–7(", ♭, "5)": minor as en dash, alterations in parentheses */
function qualityTokens(quality: string): ChordToken[] {
  const rest = quality
    .replace(/[()]/g, '')
    .replace(/^(?:min|mi|m(?!a))/, '–')
    .replace(/^-/, '–')
    .replace(/^ma(?:j)?/, 'Maj')
  const out: ChordToken[] = []
  let pos = 0
  for (const run of rest.matchAll(/(?:[b#]\d+)+/g)) {
    const start = run.index
    if (start > pos) out.push(text(rest.slice(pos, start)))
    out.push(text('('))
    const alts = [...run[0].matchAll(/([b#])(\d+)/g)]
    alts.forEach((a, i) => {
      out.push({ kind: 'acc', acc: a[1] === 'b' ? 'b' : '#' })
      out.push(text(a[2] + (i < alts.length - 1 ? ',' : '')))
    })
    out.push(text(')'))
    pos = start + run[0].length
  }
  if (pos < rest.length) out.push(text(rest.slice(pos)))
  return out
}

const mergeText = (tokens: readonly ChordToken[]): ChordToken[] =>
  tokens.reduce<ChordToken[]>((out, t) => {
    const last = out[out.length - 1]
    return t.kind === 'text' && last?.kind === 'text'
      ? [...out.slice(0, -1), text(last.text + t.text)]
      : [...out, t]
  }, [])

/**
 * written chord symbol as display tokens. The root follows the scale's spelling when
 * they share a pitch; a slash bass keeps its interval from the root (D7/F# -> E7/G# on Bb).
 */
export function chordTokens(part: Part, chord: string, scaleText?: string): ChordToken[] {
  const c = parseChord(chord)
  const s = scaleText ? parseScale(scaleText) : undefined
  const root = s && pcOf(s.root) === pcOf(c.root) ? writtenRoot(part, s.root, s.key) : writtenRoot(part, c.root)
  const tokens = [text(LETTERS[root.letter]), ...accTokens(root.acc), ...qualityTokens(c.quality)]
  if (c.bass) {
    const letter = toLetter(root.letter + (c.bass.letter - c.root.letter))
    const acc = accFor(mod(pcOf(root) + (pcOf(c.bass) - pcOf(c.root)), 12), letter)
    const bass = Math.abs(acc) > 1 ? simplifyRoot({ letter, acc }) : { letter, acc }
    tokens.push(text('/' + LETTERS[bass.letter]), ...accTokens(bass.acc))
  }
  return mergeText(tokens)
}
```

`web/engine/qualities.ts`:

```ts
import raw from '../../chord_scales.json'
import { parseChord } from './chord'
import { rootName } from './pitch'
import { scaleKey, simplifyRoot, spellFrom } from './scales'

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; note?: string }>
type QualityData = Readonly<{
  quality_aliases: Readonly<Record<string, readonly string[]>>
  qualities: Readonly<Record<string, readonly RawOption[]>>
}>

const DATA: QualityData = raw

/** chord-symbol quality text ("-7", "m7", "min7") -> canonical quality ("m7") */
const LOOKUP: ReadonlyMap<string, string> = new Map([
  ...Object.keys(DATA.qualities).map((q) => [q, q] as const),
  ...Object.entries(DATA.quality_aliases).flatMap(([q, names]) => names.map((n) => [n, q] as const)),
])

export type ScaleOption = Readonly<{ scale: string; note: string; default: boolean }>
export type QualityMatch = Readonly<{ quality: string; options: readonly ScaleOption[] }>

/** scale options for a chord, roots spelled from the chord root; null if the quality is unknown */
export function resolveQuality(chord: string): QualityMatch | null {
  const c = parseChord(chord)
  const quality = LOOKUP.get(c.quality)
  if (quality === undefined) return null
  const options = (DATA.qualities[quality] ?? []).map((opt): ScaleOption => {
    const key = scaleKey(opt.scale)
    const [r] = spellFrom(c.root, opt.root)
    if (!r) throw new Error(`bad interval ${JSON.stringify(opt.root)} in chord_scales.json`)
    const root = opt.root === '1' ? r : simplifyRoot(r, key) // interval-derived: friendliest spelling
    return { scale: `${rootName(root)} ${opt.scale}`, note: opt.note ?? '', default: opt.default ?? false }
  })
  return { quality, options }
}

/** the quality's default scale ("Cm7" -> "C Dorian"); null if the quality is unknown */
export function defaultScale(chord: string): string | null {
  const options = resolveQuality(chord)?.options ?? []
  return (options.find((o) => o.default) ?? options[0])?.scale ?? null
}

/** canonical quality names, for validating chord_scales.json */
export const QUALITY_NAMES: readonly string[] = Object.keys(DATA.qualities)
```

`web/engine/chart.ts`:

```ts
import { LIMITS } from './limits'
import { defaultScale } from './qualities'

export type MetaKey = 'title' | 'subtitle'
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string }> // scale '' = default
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
export type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
/** line is 1-based (0 = whole chart); fatal = over a hard input limit: don't render it or write it back */
export type Diagnostic = Readonly<{ line: number; message: string; fatal?: true }>
export type Row = Readonly<{ section: string; bar: string; chord: string; scale: string }>
export type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>

const INT_RE = /^[+-]?\d{1,6}$/ // bar numbers; longer would lose precision as Number
const OFFSET_RE = /^[+-]?\d{1,4}$/ // bar offsets stay well inside safe integers

function parseLine(line: string): ChartLine | string {
  if (!line) return { kind: 'blank' }
  if (line.startsWith('#')) return { kind: 'comment', text: line }
  const low = line.toLowerCase()
  for (const key of ['title', 'subtitle'] as const) {
    if (low.startsWith(`${key}:`)) {
      const value = line.slice(key.length + 1).trim()
      return value.length > LIMITS.maxMeta ? `${key} longer than ${LIMITS.maxMeta} characters` : { kind: 'meta', key, value }
    }
  }
  if (low.startsWith('@copy')) {
    const [, src = '', dst = '', offset = '', ...extra] = line.split(/\s+/)
    if (extra.length > 0 || !OFFSET_RE.test(offset)) return 'use  @copy SRC DST BAR_OFFSET'
    if (src.length > LIMITS.maxCell || dst.length > LIMITS.maxCell)
      return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'copy', src, dst, offset: Number(offset) }
  }
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length !== 3 && cells.length !== 4) return 'expected  section | bar | chord [| scale]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  const [section = '', bar = '', chord = '', scale = ''] = cells
  return { kind: 'row', section, bar, chord, scale }
}

/** tolerant parse: bad lines become 'invalid' lines plus a diagnostic, never an exception */
export function parseChart(text: string): Parsed<ChartDoc> {
  if (text.length > LIMITS.maxChars)
    return { value: { lines: [] }, diagnostics: [{ line: 0, message: `chart longer than ${LIMITS.maxChars} characters`, fatal: true }] }
  const diagnostics: Diagnostic[] = []
  const lines = text.split(/\r?\n/).map((raw, i): ChartLine => {
    const t = raw.trim()
    const parsed = parseLine(t)
    if (typeof parsed !== 'string') return parsed
    diagnostics.push({ line: i + 1, message: parsed })
    return { kind: 'invalid', text: t }
  })
  if (lines.at(-1)?.kind === 'blank') lines.pop() // trailing newline
  if (lines.filter((l) => l.kind === 'row').length > LIMITS.maxRows)
    diagnostics.push({ line: 0, message: `more than ${LIMITS.maxRows} rows`, fatal: true })
  return { value: { lines }, diagnostics }
}

export const isFatal = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some((d) => d.fatal)

/** canonical text: chord rows column-aligned, everything else verbatim */
export function serializeChart(doc: ChartDoc): string {
  const rows = doc.lines.filter((l) => l.kind === 'row')
  const width = (f: (r: (typeof rows)[number]) => string): number => Math.max(0, ...rows.map((r) => f(r).length))
  const [ws, wb, wc] = [width((r) => r.section), width((r) => r.bar), width((r) => r.chord)]
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
        return l.scale ? `${head}${l.chord.padEnd(wc)} | ${l.scale}` : `${head}${l.chord}`
      }
      case 'copy':
        return `@copy ${l.src} ${l.dst} ${l.offset}`
      case 'comment':
      case 'invalid':
        return l.text
      case 'blank':
        return ''
    }
  })
  return out.join('\n') + '\n'
}

export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string }> {
  const meta = (key: MetaKey, fallback: string): string =>
    doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)
  return { title: meta('title', 'Untitled'), subtitle: meta('subtitle', '') }
}

/** chart rows in order with @copy applied (a copy repeats the rows seen so far); at most maxExpandedRows */
export function expandRows(doc: ChartDoc): Parsed<readonly Row[]> {
  const diagnostics: Diagnostic[] = []
  const rows: Row[] = []
  const tooMany = (line: number): Diagnostic => ({
    line,
    message: `more than ${LIMITS.maxExpandedRows} rows after @copy`,
    fatal: true,
  })
  for (const [i, l] of doc.lines.entries()) {
    if (l.kind === 'row') {
      if (rows.length >= LIMITS.maxExpandedRows) {
        diagnostics.push(tooMany(i + 1))
        break
      }
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale })
    }
    if (l.kind !== 'copy') continue
    const src = rows.filter((r) => r.section === l.src)
    if (src.some((r) => !INT_RE.test(r.bar))) {
      diagnostics.push({ line: i + 1, message: `@copy needs whole-number bars in section ${l.src}` })
      continue
    }
    if (rows.length + src.length > LIMITS.maxExpandedRows) {
      // checked before growing: chained copies would otherwise double the rows each time
      diagnostics.push(tooMany(i + 1))
      break
    }
    rows.push(...src.map((r) => ({ ...r, section: l.dst, bar: String(Number(r.bar) + l.offset) })))
  }
  return { value: rows, diagnostics }
}

/** the row's scale, else the chord quality's default; null means "ask the user" */
export function resolveScale(row: Row): string | null {
  if (row.scale) return row.scale
  try {
    return defaultScale(row.chord)
  } catch {
    return null // unparseable chord
  }
}
```

`web/engine/__tests__/chart.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chartMeta, expandRows, isFatal, parseChart, resolveScale, serializeChart } from '../chart'
import { LIMITS } from '../limits'

const SAMPLE = `title: T
subtitle: S

# section | bar | chord | scale
A | 1 | Cm7 | C Dorian
A | 2 | F7
@copy A B 8
`

describe('chart', () => {
  it('parses meta, rows, copies, comments and blanks', () => {
    const { value: doc, diagnostics } = parseChart(SAMPLE)
    expect(diagnostics).toEqual([])
    expect(doc.lines.map((l) => l.kind)).toEqual(['meta', 'meta', 'blank', 'comment', 'row', 'row', 'copy'])
    expect(chartMeta(doc)).toEqual({ title: 'T', subtitle: 'S' })
    expect(doc.lines[5]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: 'F7', scale: '' })
  })

  it('defaults the title', () => {
    expect(chartMeta(parseChart('A | 1 | C').value).title).toBe('Untitled')
  })

  it('expands @copy with bar offsets', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map((r) => `${r.section}${r.bar} ${r.chord}`)).toEqual(['A1 Cm7', 'A2 F7', 'B9 Cm7', 'B10 F7'])
  })

  it('resolves missing scales from the chord quality', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map(resolveScale)).toEqual(['C Dorian', 'F Mixolydian', 'C Dorian', 'F Mixolydian'])
    expect(resolveScale({ section: 'A', bar: '1', chord: 'Cm7#5#9x', scale: '' })).toBeNull()
    expect(resolveScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })

  it('reports bad lines without throwing and keeps them verbatim', () => {
    const { value: doc, diagnostics } = parseChart('A | 1\n@copy A\nA | 2 | C')
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
    expect(serializeChart(doc)).toBe('A | 1\n@copy A\nA | 2 | C\n')
  })

  it('serializes canonically and round-trips', () => {
    const doc = parseChart(SAMPLE).value
    const text = serializeChart(doc)
    expect(text).toContain('A | 1 | Cm7 | C Dorian\nA | 2 | F7\n')
    expect(parseChart(text).value).toEqual(doc)
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('marks hard-limit diagnostics as fatal, line errors as not', () => {
    expect(isFatal(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics)).toBe(true)
    const many = Array.from({ length: LIMITS.maxRows + 1 }, () => '|1|C').join('\n')
    expect(isFatal(parseChart(many).diagnostics)).toBe(true)
    const bomb = 'A | 1 | C\n' + '@copy A A 1\n'.repeat(20)
    expect(isFatal(expandRows(parseChart(bomb).value).diagnostics)).toBe(true)
    expect(isFatal(parseChart('A | 1\nA | 2 | C').diagnostics)).toBe(false)
    expect(parseChart('A | 1234567 | C\n@copy A B 1').value.lines.length).toBe(2)
    expect(expandRows(parseChart('A | 1234567 | C\n@copy A B 1').value).diagnostics[0]?.message).toMatch(/whole-number/)
  })

  it('enforces input limits', () => {
    expect(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics[0]?.message).toMatch(/longer than/)
    expect(parseChart(`A | 1 | ${'C'.repeat(LIMITS.maxCell + 1)}`).diagnostics[0]?.message).toMatch(/cell longer/)
    const many = Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `A | ${i} | C`).join('\n')
    expect(parseChart(many).diagnostics.at(-1)?.message).toMatch(/more than 500 rows/)
  })

  it('caps expanded rows even without @copy', () => {
    const many = Array.from({ length: LIMITS.maxExpandedRows + 5 }, () => '|1|C').join('\n')
    const { value: rows, diagnostics } = expandRows(parseChart(many).value)
    expect(rows).toHaveLength(LIMITS.maxExpandedRows)
    expect(diagnostics.map((d) => d.line)).toEqual([LIMITS.maxExpandedRows + 1])
  })

  it('caps @copy section names and offsets', () => {
    const { diagnostics } = parseChart(`@copy A ${'B'.repeat(LIMITS.maxCell + 1)} 8\n@copy A B 12345\n@copy A B -8`)
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
  })

  it('caps @copy expansion before it can grow exponentially', () => {
    const bomb = 'A | 1 | C\n' + '@copy A A 1\n'.repeat(1_000)
    const { value: rows, diagnostics } = expandRows(parseChart(bomb).value)
    expect(rows.length).toBeLessThanOrEqual(LIMITS.maxExpandedRows)
    expect(diagnostics).toHaveLength(1)
  })
})
```

`web/engine/__tests__/golden.test.ts`:

```ts
/**
 * Parity with jazz_scales.py: fixtures/golden.json holds the Python engine's answers
 * (regenerate with  python3 tools/export_fixtures.py). Each test collects every
 * mismatch so one run shows them all.
 */
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  type ChordToken,
  type Clef,
  type Part,
  type ScaleOption,
  chartMeta,
  chordTokens,
  defaultScale,
  expandRows,
  lilyNote,
  parseChart,
  resolveQuality,
  resolveScale,
  resolveStart,
  rootName,
  scaleLabel,
  scaleNotes,
} from '..'

type ScaleCase =
  | { error: true }
  | { root: string; label: string; root_notes: string[]; from: Record<string, string[]> }
type Golden = {
  parts: Record<string, Part>
  from_starts: string[]
  starts: Record<Clef, Record<string, number>>
  scales: Record<string, Record<string, ScaleCase>>
  chords: { part: string; chord: string; scale: string | null; tokens: ChordToken[] | null }[]
  options: Record<string, { options: ScaleOption[] | null; default: string | null }>
  charts: Record<string, { text: string; title: string; subtitle: string; rows: string[][] }>
}

const repo = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
const G = JSON.parse(repo('fixtures/golden.json')) as Golden

function partFor(id: string): Part {
  const part = G.parts[id]
  if (!part) throw new Error(`fixture has no part ${id}`)
  return part
}

/** engine domain errors are plain Errors (Python's ValueError); anything else is a bug and must fail */
const isDomainError = (e: unknown): boolean => e instanceof Error && e.constructor === Error

function attempt<T>(f: () => T): T | null {
  try {
    return f()
  } catch (e) {
    if (isDomainError(e)) return null
    throw e
  }
}

/** compare each [label, want, got]; return the first 20 readable mismatches plus a count */
function mismatches(cases: Iterable<readonly [string, unknown, unknown]>): string[] {
  const bad: string[] = []
  for (const [label, want, got] of cases)
    if (!isDeepStrictEqual(want, got)) bad.push(`${label}\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`)
  return bad.length > 20 ? [...bad.slice(0, 20), `... and ${bad.length - 20} more`] : bad
}

function scaleCase(part: Part, text: string): ScaleCase {
  try {
    const label = scaleLabel(part, text)
    return {
      root: rootName(label.root),
      label: label.name,
      root_notes: scaleNotes(part, text, 'root', 0).map(lilyNote),
      from: Object.fromEntries(
        G.from_starts.map((s) => [s, scaleNotes(part, text, 'from', resolveStart(part.clef, s)).map(lilyNote)]),
      ),
    }
  } catch (e) {
    if (isDomainError(e)) return { error: true }
    throw e
  }
}

describe('golden parity with jazz_scales.py', () => {
  it('fixture has every section', () => {
    expect(Object.keys(G.parts)).toHaveLength(5)
    expect(Object.keys(G.scales)).toEqual(Object.keys(G.parts))
    for (const section of [G.from_starts, G.chords, Object.keys(G.options), Object.keys(G.charts)])
      expect(section.length).toBeGreaterThan(0)
  })

  it('start notes', () => {
    const cases = Object.entries(G.starts).flatMap(([clef, starts]) =>
      Object.entries(starts).map(([s, want]) => [`${clef} ${s}`, want, resolveStart(clef as Clef, s)] as const),
    )
    expect(mismatches(cases)).toEqual([])
  })

  for (const [partId, cases] of Object.entries(G.scales)) {
    it(`scales, ${partId}`, () => {
      const part = partFor(partId)
      expect(mismatches(Object.entries(cases).map(([t, want]) => [t, want, scaleCase(part, t)] as const))).toEqual([])
    })
  }

  it('chord symbols', () => {
    const cases = G.chords.map(
      (c) =>
        [
          `${c.part} ${c.chord} / ${c.scale}`,
          c.tokens,
          attempt(() => chordTokens(partFor(c.part), c.chord, c.scale ?? undefined)),
        ] as const,
    )
    expect(mismatches(cases)).toEqual([])
  })

  it('quality options and defaults', () => {
    const cases = Object.entries(G.options).flatMap(([chord, want]) => [
      [`${chord} options`, want.options, attempt(() => resolveQuality(chord)?.options ?? null)] as const,
      [`${chord} default`, want.default, attempt(() => defaultScale(chord))] as const,
    ])
    expect(mismatches(cases)).toEqual([])
  })

  it('library charts', () => {
    const cases = Object.entries(G.charts).flatMap(([name, want]) => {
      const { value: doc, diagnostics } = parseChart(want.text)
      const rows = expandRows(doc)
      return [
        [`${name} diagnostics`, [], [...diagnostics, ...rows.diagnostics]] as const,
        [`${name} meta`, { title: want.title, subtitle: want.subtitle }, chartMeta(doc)] as const,
        [`${name} rows`, want.rows, rows.value.map((r) => [r.section, r.bar, r.chord, resolveScale(r)])] as const,
      ]
    })
    expect(mismatches(cases)).toEqual([])
  })
})
```

- [ ] **Step 4: Verify types, tests and parity**

Run: `cd web && npm run typecheck && npx vitest run`
Expected: no type errors and `Tests 41 passed`, including the golden parity test.

- [ ] **Step 5: Commit**

```bash
git add -A web && git commit -m "refactor(engine): pass noUncheckedIndexedAccess"
```

---

### Task 2: `engine/edit.ts`: grid edits and cell validation

The grid edits a `ChartDoc` immutably. `cellError` rejects values that would re-parse as a different line, such as `|`, a line break, or a leading `#`, `@`, `title:` or `subtitle:` (design §4).

**Files:** Create: `web/engine/edit.ts`, Test: `web/engine/__tests__/edit.test.ts`

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/edit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chartMeta, parseChart, serializeChart } from '../chart'
import { cellError, insertRowAfter, removeLine, setMeta, setRowField } from '../edit'

const doc = parseChart('title: T\nA | 1 | Cm7\n# note\nA | 2 | F7 | F Mixolydian\n').value

describe('edit', () => {
  it('rejects cell values that would re-parse as a different line', () => {
    expect(cellError('Cm7')).toBeNull()
    expect(cellError('C|7')).toMatch(/\|/)
    expect(cellError('a\nb')).toMatch(/line breaks/)
    expect(cellError('#1')).toMatch(/start with/)
    expect(cellError('@copy')).toMatch(/start with/)
    expect(cellError('Title: x')).toMatch(/start with/)
    expect(cellError(' A')).toMatch(/spaces/)
    expect(cellError('x'.repeat(41))).toMatch(/longer/)
    expect(cellError('x'.repeat(100), 120)).toBeNull()
  })

  it('sets row fields immutably and ignores non-row lines', () => {
    const next = setRowField(doc, 1, 'scale', 'C Aeolian')
    expect(next.lines[1]).toEqual({ kind: 'row', section: 'A', bar: '1', chord: 'Cm7', scale: 'C Aeolian' })
    expect(doc.lines[1]).toMatchObject({ scale: '' })
    expect(setRowField(doc, 2, 'chord', 'X')).toBe(doc)
  })

  it('inserts rows that inherit section and bar, and removes lines', () => {
    const next = insertRowAfter(doc, 3)
    expect(next.lines[4]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: '', scale: '' })
    expect(insertRowAfter(parseChart('').value, -1).lines).toEqual([
      { kind: 'row', section: 'A', bar: '1', chord: '', scale: '' },
    ])
    expect(removeLine(doc, 2).lines.map((l) => l.kind)).toEqual(['meta', 'row', 'row'])
  })

  it('sets meta in place or inserts it at the top', () => {
    expect(chartMeta(setMeta(doc, 'title', 'New')).title).toBe('New')
    const withSub = setMeta(doc, 'subtitle', 'S')
    expect(serializeChart(withSub).split('\n').slice(0, 2)).toEqual(['title: T', 'subtitle: S'])
    expect(setMeta(parseChart('A | 1 | C').value, 'title', 'X').lines[0]).toEqual({ kind: 'meta', key: 'title', value: 'X' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/edit.test.ts`
Expected: FAIL, `../edit` cannot be resolved

- [ ] **Step 3: Implement**

`web/engine/edit.ts`:

```ts
import type { ChartDoc, ChartLine, MetaKey } from './chart'
import { LIMITS } from './limits'

export type RowLine = Extract<ChartLine, { kind: 'row' }>
export type RowField = 'section' | 'bar' | 'chord' | 'scale'

/**
 * why a grid cell value would not survive serialize -> parse as the same line, or null if fine
 * (see docs/design.md §4 "Cell validation")
 */
export function cellError(value: string, maxLength: number = LIMITS.maxCell): string | null {
  if (value.length > maxLength) return `longer than ${maxLength} characters`
  if (/[|\r\n]/.test(value)) return 'may not contain | or line breaks'
  if (value !== value.trim()) return 'may not start or end with spaces'
  const low = value.toLowerCase()
  if (value.startsWith('#') || value.startsWith('@') || low.startsWith('title:') || low.startsWith('subtitle:'))
    return 'may not start with #, @, title: or subtitle:'
  return null
}

const replaceAt = <T>(xs: readonly T[], i: number, x: T): T[] => [...xs.slice(0, i), x, ...xs.slice(i + 1)]

/** set one field of the row at line index i (a no-op if that line is not a row) */
export function setRowField(doc: ChartDoc, i: number, field: RowField, value: string): ChartDoc {
  const line = doc.lines[i]
  if (line?.kind !== 'row') return doc
  return { lines: replaceAt(doc.lines, i, { ...line, [field]: value }) }
}

/** insert a row after line index i (-1 = at the top), copying section and bar from the row above */
export function insertRowAfter(doc: ChartDoc, i: number): ChartDoc {
  const above = doc.lines
    .slice(0, i + 1)
    .reverse()
    .find((l): l is RowLine => l.kind === 'row')
  const row: RowLine = { kind: 'row', section: above?.section ?? 'A', bar: above?.bar ?? '1', chord: '', scale: '' }
  return { lines: [...doc.lines.slice(0, i + 1), row, ...doc.lines.slice(i + 1)] }
}

export function removeLine(doc: ChartDoc, i: number): ChartDoc {
  return { lines: doc.lines.filter((_, j) => j !== i) }
}

/** set title/subtitle: update the last such line (the one that wins), else add it at the top */
export function setMeta(doc: ChartDoc, key: MetaKey, value: string): ChartDoc {
  const i = doc.lines.findLastIndex((l) => l.kind === 'meta' && l.key === key)
  if (i >= 0) return { lines: replaceAt(doc.lines, i, { kind: 'meta', key, value }) }
  const at = key === 'subtitle' ? doc.lines.findIndex((l) => l.kind === 'meta' && l.key === 'title') + 1 : 0
  return { lines: [...doc.lines.slice(0, at), { kind: 'meta', key, value }, ...doc.lines.slice(at)] }
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx vitest run && npm run typecheck`
Expected: `Tests 45 passed`, no type errors

- [ ] **Step 5: Commit**

```bash
git add web/engine/edit.ts web/engine/__tests__/edit.test.ts && git commit -m "feat(engine): pure grid edits and cell validation"
```

---

### Task 3: `engine/sheet.ts`: the printable sheet as data

`buildSheet` turns rows into one part per mode. Each part is split into pages of `perPage` staves, and each staff is a `StaffModel` holding labels, notes and an error if any. A bad row becomes a staff with an error message, never an exception. `toVexKey` converts a pitched note to VexFlow's key format.

**Files:** Create: `web/engine/sheet.ts`, Test: `web/engine/__tests__/sheet.test.ts`; Modify: `web/engine/index.ts`

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/sheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { CONCERT } from '../part'
import { type ModeChoice, type StaffModel, buildSheet, noteText, toVexKey } from '../sheet'

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
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/sheet.test.ts`
Expected: FAIL, `../sheet` cannot be resolved

- [ ] **Step 3: Implement, and export both new modules**

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

`web/engine/index.ts` becomes:

`web/engine/index.ts`:

```ts
export * from './chart'
export * from './chord'
export * from './instruments'
export * from './limits'
export * from './part'
export * from './pitch'
export * from './qualities'
export * from './scales'
export * from './edit'
export * from './sheet'
```

- [ ] **Step 4: Verify**

Run: `cd web && npx vitest run && npm run typecheck`
Expected: `Tests 53 passed`, no type errors

- [ ] **Step 5: Commit**

```bash
git add web/engine && git commit -m "feat(engine): sheet view model for the preview"
```

---

### Task 4: Nuxt scaffold, theme and library page

**Files:**
- Create: `web/nuxt.config.ts`, `web/tsconfig.json`, `web/eslint.config.mjs`, `web/app/app.vue`, `web/app/assets/css/main.css`, `web/public/theme-init.js`, `web/app/composables/useTheme.ts`, `web/app/components/AppHeader.vue`, `web/app/utils/library.ts`, `web/app/pages/index.vue`
- Test: `web/test/library.test.ts`
- Modify: `web/package.json`, `web/vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Install dependencies.** `vue` and `vexflow` are runtime `dependencies` (they ship to browsers); everything else is build tooling.

```bash
cd web
npm install -E vue@3.5.43 vexflow@5.0.0
npm install -D -E nuxt@4.5.2 @tailwindcss/vite@4.3.3 tailwindcss@4.3.3 @nuxt/test-utils@4.3.3 @vue/test-utils@2.5.1 happy-dom@20.14.5 vue-tsc@3.3.12 @nuxt/eslint@1.17.0 eslint@10.12.0
```

Then make `web/package.json` match this (keep the exact versions npm wrote):

`web/package.json`:

```json
{
  "name": "jazz-scales-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt generate && nuxt preview",
    "postinstall": "nuxt prepare",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "nuxt typecheck && tsc -p tsconfig.engine.json",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@nuxt/eslint": "1.17.0",
    "@nuxt/test-utils": "4.3.3",
    "@tailwindcss/vite": "4.3.3",
    "@types/node": "26.6.4",
    "@vue/test-utils": "2.5.1",
    "eslint": "10.12.0",
    "happy-dom": "20.14.5",
    "nuxt": "4.5.2",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "5.0.3",
    "vue-tsc": "3.3.12"
  },
  "dependencies": {
    "vexflow": "5.0.0",
    "vue": "3.5.43"
  },
  "engines": {
    "node": ">=24"
  }
}
```

Append to the repo-root `.gitignore`:

```text
web/.nuxt/
web/.output/
web/.data/
web/dist
```

- [ ] **Step 2: Nuxt, TypeScript, test and lint config**

`web/nuxt.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'

// Fully static site (nuxt generate). Engine + rendering run in the browser; see docs/design.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Chord Scale Maker',
      meta: [{ name: 'description', content: 'Chord-scale practice sheets from a chord chart.' }],
      // sets the dark class before first paint. A file, not inline, so it needs no CSP hash
      // (Nuxt's own inline scripts still do: see docs/design.md §9)
      script: [{ src: '/theme-init.js' }],
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: '', // NUXT_PUBLIC_SITE_URL, e.g. https://www.chordscalemaker.com
      issuesUrl: 'https://github.com/KevDog/Chord-Scale-Maker/issues/new',
    },
  },
  nitro: { prerender: { routes: ['/', '/editor'] } },
  vite: {
    plugins: [tailwindcss()],
    // the engine imports ../chord_scales.json and the library reads ../charts
    server: { fs: { allow: ['..'] } },
  },
})
```

`web/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

`web/vitest.config.ts`:

```ts
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // pure TypeScript, no Nuxt
      { test: { name: 'engine', include: ['engine/**/*.test.ts'], environment: 'node' } },
      // components and composables inside a Nuxt runtime (happy-dom)
      await defineVitestProject({ test: { name: 'app', include: ['test/**/*.test.ts'], environment: 'nuxt' } }),
    ],
  },
})
```

`web/eslint.config.mjs`:

```js
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // chart text is user input: never render it as HTML (docs/design.md §9)
    'vue/no-v-html': 'error',
  },
})
```

- [ ] **Step 3: Write the failing library test**

`web/test/library.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findChart, LIBRARY, searchLibrary, toLibrary } from '~/utils/library'

describe('library', () => {
  it('builds entries from chart files, sorted by title', () => {
    const lib = toLibrary({ '../x/b.txt': 'title: Beta\nA | 1 | C', '../x/a.txt': 'title: Álpha\nsubtitle: S\nA | 1 | C' })
    expect(lib.map((c) => [c.slug, c.title, c.subtitle])).toEqual([
      ['a', 'Álpha', 'S'],
      ['b', 'Beta', ''],
    ])
  })

  it('searches titles ignoring case and accents', () => {
    const lib = toLibrary({ 'a.txt': 'title: Álpha', 'b.txt': 'title: Beta' })
    expect(searchLibrary(lib, 'ALP').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, '  ').map((c) => c.slug)).toEqual(['a', 'b'])
    expect(searchLibrary(lib, 'zzz')).toEqual([])
  })

  it('includes the repo charts', () => {
    expect(LIBRARY.map((c) => c.slug)).toContain('autumn_leaves')
    expect(findChart('autumn_leaves')?.title).toBe('Autumn Leaves')
    expect(findChart('nope')).toBeUndefined()
  })
})
```

Run: `cd web && npx nuxi prepare && npx vitest run --project app`
Expected: FAIL, `~/utils/library` cannot be resolved

- [ ] **Step 4: App shell, palette, dark mode and library**

`web/app/assets/css/main.css`:

```css
@import 'tailwindcss';

/* dark mode follows the .dark class on <html> (toggle in the header, default light) */
@custom-variant dark (&:where(.dark, .dark *));

/* cool palette: slate neutrals, teal accent, sky for focus.
   Light accent is teal-700 so small text meets WCAG AA (about 5.5:1 on white). */
@theme {
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --color-accent: var(--color-teal-700);
  --color-accent-strong: var(--color-teal-800);
}

@layer base {
  html {
    @apply bg-slate-50 text-slate-800 antialiased;
  }
  html.dark {
    @apply bg-slate-950 text-slate-200;
    --color-accent: var(--color-teal-400);
    --color-accent-strong: var(--color-teal-300);
    color-scheme: dark;
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-sky-600 dark:outline-sky-400;
  }
}

/* print: letter pages, light colors, only the sheet */
@page {
  size: letter;
  margin: 10mm;
}
@media print {
  html,
  html.dark {
    @apply bg-white text-black;
    color-scheme: light;
  }
}
```

`web/public/theme-init.js`:

```js
// Apply the saved theme before first paint (default light). Kept in sync with app/composables/useTheme.ts.
try {
  if (localStorage.getItem('csm-theme') === 'dark') document.documentElement.classList.add('dark')
} catch {}
```

`web/app/composables/useTheme.ts`:

```ts
export type Theme = 'light' | 'dark'

const KEY = 'csm-theme' // also read by public/theme-init.js

/** light/dark toggle, persisted per browser; default light */
export function useTheme() {
  const theme = useState<Theme>('theme', () => 'light')

  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  function setTheme(next: Theme): void {
    theme.value = next
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage unavailable (private mode): the toggle still works for this visit
    }
  }

  return { theme, toggle: () => setTheme(theme.value === 'dark' ? 'light' : 'dark') }
}
```

`web/app/components/AppHeader.vue`:

```vue
<template>
  <header class="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
    <div class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
        Chord <span class="text-accent">Scale</span> Maker
      </NuxtLink>
      <nav aria-label="Main" class="flex gap-4 text-sm">
        <NuxtLink to="/" class="hover:text-accent" active-class="text-accent">Library</NuxtLink>
        <NuxtLink to="/editor?new=1" class="hover:text-accent">New chart</NuxtLink>
      </nav>
      <button
        type="button"
        class="ml-auto rounded-md border border-slate-300 px-3 py-1 text-sm hover:border-accent dark:border-slate-700"
        :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
        @click="toggle"
      >
        {{ theme === 'dark' ? 'Light' : 'Dark' }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
const { theme, toggle } = useTheme()
</script>
```

`web/app/app.vue`:

```vue
<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader class="print:hidden" />
    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 print:max-w-none print:p-0">
      <NuxtPage />
    </main>
    <footer class="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-slate-500 print:hidden dark:text-slate-400">
      Chord Scale Maker · charts are concert pitch ·
      <a :href="issuesUrl" class="text-accent hover:underline" rel="noopener" target="_blank">request a chart</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
const issuesUrl = useRuntimeConfig().public.issuesUrl
</script>
```

`web/app/utils/library.ts`:

```ts
import { chartMeta, parseChart } from '~~/engine'

export type LibraryChart = Readonly<{ slug: string; title: string; subtitle: string; text: string }>

/** build-time: every chart in the repo's charts/ folder, as raw text */
const files = import.meta.glob<string>('../../../charts/*.txt', { query: '?raw', import: 'default', eager: true })

export function toLibrary(entries: Readonly<Record<string, string>>): LibraryChart[] {
  return Object.entries(entries)
    .map(([path, text]) => ({
      slug: path.slice(path.lastIndexOf('/') + 1).replace(/\.txt$/, ''),
      ...chartMeta(parseChart(text).value),
      text,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en')) // fixed locale: same order in prerender and browser
}

export const LIBRARY: readonly LibraryChart[] = toLibrary(files)

/** case- and accent-insensitive */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const searchLibrary = (charts: readonly LibraryChart[], query: string): LibraryChart[] =>
  charts.filter((c) => fold(c.title).includes(fold(query.trim())))

export const findChart = (slug: string): LibraryChart | undefined => LIBRARY.find((c) => c.slug === slug)
```

`web/app/pages/index.vue`:

```vue
<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-semibold tracking-tight">Chart library</h1>
    <p class="mt-1 text-slate-600 dark:text-slate-400">
      Pick a tune to open it in the editor, or start a <NuxtLink to="/editor?new=1" class="text-accent hover:underline">new chart</NuxtLink>.
    </p>
    <label class="mt-6 block">
      <span class="sr-only">Search by title</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search by title"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      >
    </label>
    <ul class="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      <li v-for="chart in charts" :key="chart.slug">
        <NuxtLink :to="`/editor?chart=${chart.slug}`" class="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
          <span class="font-medium">{{ chart.title }}</span>
          <span v-if="chart.subtitle" class="block text-sm text-slate-500 dark:text-slate-400">{{ chart.subtitle }}</span>
        </NuxtLink>
      </li>
      <li v-if="charts.length === 0" class="px-4 py-3 text-slate-500">No charts match "{{ query }}".</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
</script>
```

- [ ] **Step 5: Verify**

Run: `cd web && npx nuxi prepare && npm run lint && npm run typecheck && npx vitest run`
Expected: lint and typecheck clean, and `Tests 56 passed` (53 engine + 3 library).
- Run `nuxi prepare` again because it regenerates the ESLint config, which needs to see `app/pages/`.
- Skip `nuxt generate` here: it prerenders `/editor`, which arrives in Task 7.

Commit `web/.nuxtrc` too if `@nuxt/test-utils` created it.

- [ ] **Step 6: Commit**

```bash
git add .gitignore web && git commit -m "feat(web): Nuxt app shell, theme and chart library"
```

---

### Task 5: Editor state (`useChartEditor`, drafts)

One composable owns the editor state. Text edits are re-parsed after 150 ms, and the text the user typed is left as they typed it. A grid edit serializes the new doc into canonical text at once and cancels any pending re-parse.

**Files:** Create: `web/app/composables/useChartEditor.ts`, `web/app/composables/useDraft.ts`; Test: `web/test/useChartEditor.test.ts`

- [ ] **Step 1: Write the failing test**

`web/test/useChartEditor.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { setRowField } from '~~/engine'
import { TEXT_DEBOUNCE_MS, useChartEditor } from '~/composables/useChartEditor'

const TEXT = 'title: T\nA | 1 | Cm7\n@copy A B 8\n'

function editor(text = TEXT) {
  const scope = effectScope()
  const e = scope.run(() => useChartEditor(text))
  if (!e) throw new Error('no editor')
  return { e, stop: () => scope.stop() }
}

describe('useChartEditor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('parses the initial text and expands rows', () => {
    const { e } = editor()
    expect(e.meta.value.title).toBe('T')
    expect(e.rows.value.map((r) => `${r.section}${r.bar}`)).toEqual(['A1', 'B9'])
    expect(e.diagnostics.value).toEqual([])
  })

  it('re-parses text edits after a pause, without reformatting the text', () => {
    const { e } = editor()
    e.setText('A|1|Cm7\nA|2|F7')
    expect(e.text.value).toBe('A|1|Cm7\nA|2|F7')
    expect(e.rows.value).toHaveLength(2) // still the old doc
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value.map((r) => r.chord)).toEqual(['Cm7', 'F7'])
    expect(e.text.value).toBe('A|1|Cm7\nA|2|F7')
  })

  it('serializes grid edits into canonical text at once', () => {
    const { e } = editor()
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    expect(e.text.value).toBe('title: T\nA | 1 | Dm7\n@copy A B 8\n')
    expect(e.rows.value.map((r) => r.chord)).toEqual(['Dm7', 'Dm7'])
  })

  it('a grid edit cancels a pending text parse', () => {
    const { e } = editor()
    e.setText('A | 1 | X')
    e.setDoc(setRowField(e.doc.value, 1, 'chord', 'Dm7'))
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value[0]?.chord).toBe('Dm7')
  })

  it('flags charts over a hard limit as fatal and keeps the text', () => {
    const { e } = editor()
    const huge = 'x'.repeat(20_001)
    e.setText(huge)
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.fatal.value).toBe(true)
    expect(e.text.value).toBe(huge)
  })

  it('stops its timer when the scope is disposed', () => {
    const { e, stop } = editor()
    e.setText('A | 1 | F7')
    stop()
    vi.advanceTimersByTime(TEXT_DEBOUNCE_MS)
    expect(e.rows.value[0]?.chord).toBe('Cm7')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run --project app test/useChartEditor.test.ts`
Expected: FAIL, `~/composables/useChartEditor` cannot be resolved

- [ ] **Step 3: Implement**

`web/app/composables/useChartEditor.ts`:

```ts
import {
  type ChartDoc,
  type Diagnostic,
  type Parsed,
  chartMeta,
  expandRows,
  isFatal,
  parseChart,
  serializeChart,
} from '~~/engine'

export const TEXT_DEBOUNCE_MS = 150

/**
 * Single source of truth for the editor: chart text and the parsed ChartDoc kept in sync.
 * Text edits re-parse after a short pause (the text is not reformatted while typing);
 * grid edits produce a new doc, which is serialized into canonical text at once.
 */
export function useChartEditor(initialText: string) {
  const text = ref(initialText)
  const parsed = shallowRef<Parsed<ChartDoc>>(parseChart(initialText))
  let timer: ReturnType<typeof setTimeout> | undefined

  function setText(next: string): void {
    text.value = next
    clearTimeout(timer)
    timer = setTimeout(() => {
      parsed.value = parseChart(next)
    }, TEXT_DEBOUNCE_MS)
  }

  function setDoc(next: ChartDoc): void {
    clearTimeout(timer)
    text.value = serializeChart(next)
    parsed.value = parseChart(text.value) // re-parse so diagnostics describe the new text
  }

  onScopeDispose(() => clearTimeout(timer))

  const doc = computed(() => parsed.value.value)
  const expanded = computed(() => expandRows(doc.value))
  const diagnostics = computed<readonly Diagnostic[]>(() => [...parsed.value.diagnostics, ...expanded.value.diagnostics])

  return {
    text: readonly(text),
    doc,
    rows: computed(() => expanded.value.value),
    meta: computed(() => chartMeta(doc.value)),
    diagnostics,
    /** over a hard input limit: don't render, and don't let the grid write back over the text */
    fatal: computed(() => isFatal(diagnostics.value)),
    setText,
    setDoc,
  }
}
```

`web/app/composables/useDraft.ts`:

```ts
const KEY = 'csm-draft'

export const STARTER_CHART = `title: Untitled
subtitle:

# section | bar | chord | scale (optional)
A | 1 | Dm7
A | 2 | G7
A | 3 | CMaj7
`

/** the editor's last text, kept in this browser only (nothing is sent anywhere) */
export function loadDraft(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveDraft(text: string): void {
  try {
    localStorage.setItem(KEY, text)
  } catch {
    // storage full or unavailable: drafts are a convenience only
  }
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx vitest run && npm run typecheck && npm run lint`
Expected: `Tests 62 passed`, typecheck and lint clean

- [ ] **Step 5: Commit**

```bash
git add web/app/composables web/test/useChartEditor.test.ts && git commit -m "feat(web): editor state with text and grid kept in sync"
```

---

### Task 6: Chart grid and scale cell

The grid edits rows, the title and the subtitle. Only values that pass `cellError` are applied; anything else stays in the input with a red border and the reason in its tooltip. The scale cell offers "Default · …", the alternates with their notes, any scale already typed in the text, and "Other…", which opens a picker of root plus any scale. A chord with no known default shows "Choose a scale…" with an amber border.

**Files:** Create: `web/app/utils/scaleChoices.ts`, `web/app/components/ScaleCell.vue`, `web/app/components/ChartGrid.vue`; Test: `web/test/scaleChoices.test.ts`, `web/test/ScaleCell.test.ts`, `web/test/ChartGrid.test.ts`

- [ ] **Step 1: Write the failing tests**

`web/test/scaleChoices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseScale } from '~~/engine'
import { PICKER_SCALES, scaleChoices } from '~/utils/scaleChoices'

describe('scaleChoices', () => {
  it('splits the default from the alternates', () => {
    const c = scaleChoices('Cm7')
    expect(c).toMatchObject({ known: true, defaultScale: 'C Dorian' })
    expect(c.alternates.map((o) => o.scale)).toContain('Eb Major Pentatonic')
    expect(c.alternates.map((o) => o.scale)).not.toContain('C Dorian')
  })

  it('offers nothing for unknown or unreadable chords', () => {
    expect(scaleChoices('Cm7#5#9x')).toEqual({ known: false, defaultScale: null, alternates: [] })
    expect(scaleChoices('')).toEqual({ known: false, defaultScale: null, alternates: [] })
  })

  it('picker labels parse back to scales', () => {
    for (const name of PICKER_SCALES) expect(() => parseScale(`C ${name}`), name).not.toThrow()
  })
})
```

`web/test/ScaleCell.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ScaleCell from '~/components/ScaleCell.vue'

const mount = (chord: string, scale = '') => mountSuspended(ScaleCell, { props: { chord, scale, field: '' } })

describe('ScaleCell', () => {
  it('offers the default, the alternates and Other', async () => {
    const w = await mount('Cm7')
    const labels = w.findAll('option').map((o) => o.text())
    expect(labels[0]).toBe('Default · C Dorian')
    expect(labels).toContain('C Aeolian (when the chord is vi or iv)')
    expect(labels.at(-1)).toBe('Other…')
  })

  it('emits the chosen alternate, or empty for the default', async () => {
    const w = await mount('Cm7')
    await w.find('select').setValue('C Aeolian')
    await w.find('select').setValue('')
    expect(w.emitted('update')).toEqual([['C Aeolian'], ['']])
  })

  it('shows a scale typed in the text even if it is not an option', async () => {
    const w = await mount('Cm7', 'C Bebop Dominant')
    expect((w.find('select').element as HTMLSelectElement).value).toBe('C Bebop Dominant')
  })

  it('prompts for unknown chords and picks any scale via Other', async () => {
    const w = await mount('Cm7#5#9x')
    expect(w.find('option').text()).toBe('Choose a scale…')
    await w.find('select').setValue('__other')
    await w.find('[aria-label="Scale name"]').setValue('Altered')
    await w.find('button').trigger('click')
    expect(w.emitted('update')).toEqual([['C Altered']])
  })
})
```

`web/test/ChartGrid.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, parseChart } from '~~/engine'
import ChartGrid from '~/components/ChartGrid.vue'

const doc = parseChart('title: T\nA | 1 | Cm7\n@copy A B 8\nbad line\n').value
const lastDoc = (w: { emitted: (e: string) => unknown[][] | undefined }): ChartDoc | undefined =>
  w.emitted('update:doc')?.at(-1)?.[0] as ChartDoc | undefined

describe('ChartGrid', () => {
  it('shows rows, copies and invalid lines', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    expect(w.find('[aria-label="chord for row 1"]').element).toHaveProperty('value', 'Cm7')
    expect(w.text()).toContain('repeat section A as B, bars +8')
    expect(w.text()).toContain('bad line')
  })

  it('emits a new doc for valid cell edits', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    await w.find('[aria-label="chord for row 1"]').setValue('Dm7')
    expect(lastDoc(w)?.lines[1]).toMatchObject({ kind: 'row', chord: 'Dm7' })
  })

  it('keeps invalid values out of the doc and explains why', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    const input = w.find('[aria-label="chord for row 1"]')
    await input.setValue('C|7')
    expect(w.emitted('update:doc')).toBeUndefined()
    expect(input.attributes('title')).toMatch(/\|/)
  })

  it('edits the title and adds rows', async () => {
    const w = await mountSuspended(ChartGrid, { props: { doc } })
    await w.find('input').setValue('New title')
    expect(lastDoc(w)?.lines[0]).toEqual({ kind: 'meta', key: 'title', value: 'New title' })
    await w.find('[aria-label="Add row after row 1"]').trigger('click')
    expect(lastDoc(w)?.lines[2]).toEqual({ kind: 'row', section: 'A', bar: '1', chord: '', scale: '' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run --project app`
Expected: the 3 new files FAIL (modules cannot be resolved); the earlier app tests pass

- [ ] **Step 3: Implement**

`web/app/utils/scaleChoices.ts`:

```ts
import { resolveQuality, SCALES, type ScaleOption } from '~~/engine'

/** roots offered by the scale picker, in chromatic order */
export const PICKER_ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const

/** every scale the engine knows, by its printed label (labels parse back via scaleKey) */
export const PICKER_SCALES: readonly string[] = Object.values(SCALES).map(([, label]) => label)

export type ScaleChoices = Readonly<{
  known: boolean // the chord quality is in chord_scales.json
  defaultScale: string | null
  alternates: readonly ScaleOption[] // options other than the default
}>

/** what the scale dropdown offers for a chord */
export function scaleChoices(chord: string): ScaleChoices {
  let options: readonly ScaleOption[] = []
  try {
    options = resolveQuality(chord)?.options ?? []
  } catch {
    // unparseable chord: no suggestions, the picker is still available
  }
  const def = options.find((o) => o.default) ?? null
  return { known: options.length > 0, defaultScale: def?.scale ?? null, alternates: options.filter((o) => o !== def) }
}
```

`web/app/components/ScaleCell.vue`:

```vue
<template>
  <div class="flex flex-col gap-1">
    <select
      v-if="!picking"
      :value="selectValue"
      :aria-label="`Scale for ${chord || 'this row'}`"
      :class="[field, needsScale && 'border-amber-500 dark:border-amber-500']"
      @change="onSelect(($event.target as HTMLSelectElement).value)"
    >
      <option v-if="choices.defaultScale" value="">Default · {{ choices.defaultScale }}</option>
      <option v-else value="" disabled>Choose a scale…</option>
      <option v-for="o in choices.alternates" :key="o.scale" :value="o.scale">{{ o.scale }}{{ o.note ? ` (${o.note})` : '' }}</option>
      <option v-if="custom" :value="scale">{{ scale }}</option>
      <option value="__other">Other…</option>
    </select>
    <div v-else class="flex gap-1">
      <select v-model="pickRoot" aria-label="Scale root" :class="field">
        <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ r }}</option>
      </select>
      <select v-model="pickName" aria-label="Scale name" :class="[field, 'min-w-0 flex-1']">
        <option v-for="n in PICKER_SCALES" :key="n" :value="n">{{ n }}</option>
      </select>
      <button type="button" class="rounded bg-accent px-2 text-sm text-white dark:text-slate-950" @click="apply">Set</button>
      <button type="button" class="px-1 text-sm text-slate-500" aria-label="Cancel" @click="picking = false">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseChord, rootName } from '~~/engine'

const props = defineProps<{ chord: string; scale: string; field: string }>()
const emit = defineEmits<{ update: [scale: string] }>()

const choices = computed(() => scaleChoices(props.chord))
const custom = computed(() => props.scale !== '' && !choices.value.alternates.some((o) => o.scale === props.scale))
const selectValue = computed(() => props.scale)
const needsScale = computed(() => props.scale === '' && !choices.value.defaultScale)

const picking = ref(false)
const pickRoot = ref<string>('C')
const pickName = ref<string>(PICKER_SCALES[0] ?? 'Ionian')

function openPicker(): void {
  try {
    const root = rootName(parseChord(props.chord).root)
    pickRoot.value = (PICKER_ROOTS as readonly string[]).includes(root) ? root : 'C'
  } catch {
    pickRoot.value = 'C'
  }
  picking.value = true
}

function onSelect(value: string): void {
  if (value === '__other') openPicker()
  else emit('update', value)
}

function apply(): void {
  emit('update', `${pickRoot.value} ${pickName.value}`)
  picking.value = false
}
</script>
```

`web/app/components/ChartGrid.vue`:

```vue
<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-2">
      <label v-for="key in META_KEYS" :key="key" class="text-sm">
        <span class="mb-1 block capitalize text-slate-500 dark:text-slate-400">{{ key }}</span>
        <input
          :value="meta[key]"
          :class="[field, 'w-full', errors[`meta:${key}`] && invalid]"
          :title="errors[`meta:${key}`]"
          @input="onMeta(key, ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <table class="w-full border-separate border-spacing-y-1 text-sm">
      <thead class="text-left text-slate-500 dark:text-slate-400">
        <tr>
          <th class="w-16 font-normal">Section</th>
          <th class="w-14 font-normal">Bar</th>
          <th class="w-28 font-normal">Chord</th>
          <th class="font-normal">Scale</th>
          <th class="w-14"><span class="sr-only">Row actions</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(line, i) in doc.lines" :key="i">
          <tr v-if="line.kind === 'row'">
            <td v-for="f in TEXT_FIELDS" :key="f" class="pr-1">
              <input
                :value="line[f]"
                :aria-label="`${f} for row ${rowNumber[i]}`"
                :class="[field, 'w-full', errors[`${i}:${f}`] && invalid]"
                :title="errors[`${i}:${f}`]"
                @input="onCell(i, f, ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="pr-1">
              <ScaleCell :chord="line.chord" :scale="line.scale" :field="`${field} w-full`" @update="(s) => emitDoc(setRowField(doc, i, 'scale', s))" />
            </td>
            <td class="whitespace-nowrap text-right">
              <button type="button" :class="iconButton" :aria-label="`Add row after row ${rowNumber[i]}`" @click="emitDoc(insertRowAfter(doc, i))">+</button>
              <button type="button" :class="iconButton" :aria-label="`Delete row ${rowNumber[i]}`" @click="emitDoc(removeLine(doc, i))">−</button>
            </td>
          </tr>
          <tr v-else-if="line.kind === 'copy'" class="text-slate-500 dark:text-slate-400">
            <td colspan="4" class="py-1 pl-1 font-mono text-xs">
              repeat section <b>{{ line.src }}</b> as <b>{{ line.dst }}</b>, bars {{ line.offset >= 0 ? '+' : '' }}{{ line.offset }}
              <span class="ml-1 text-slate-400">(edit in text)</span>
            </td>
            <td class="text-right">
              <button type="button" :class="iconButton" :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))">−</button>
            </td>
          </tr>
          <tr v-else-if="line.kind === 'invalid'">
            <td colspan="5" class="rounded bg-rose-50 px-2 py-1 font-mono text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              line {{ i + 1 }}: {{ line.text }} <span class="font-sans">— fix in the text editor</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <button type="button" class="rounded-md border border-slate-300 px-3 py-1 text-sm hover:border-accent dark:border-slate-700" @click="emitDoc(insertRowAfter(doc, doc.lines.length - 1))">
      Add row
    </button>
  </div>
</template>

<script setup lang="ts">
import { type ChartDoc, type MetaKey, type RowField, cellError, chartMeta, insertRowAfter, LIMITS, removeLine, setMeta, setRowField } from '~~/engine'

const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly MetaKey[] = ['title', 'subtitle']
const TEXT_FIELDS: readonly Exclude<RowField, 'scale'>[] = ['section', 'bar', 'chord']
const field = 'rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900'
const invalid = 'border-rose-500 dark:border-rose-500'
const iconButton = 'h-7 w-7 rounded text-slate-500 hover:bg-slate-100 hover:text-accent dark:hover:bg-slate-800'

const meta = computed(() => chartMeta(props.doc))
/** line index -> 1-based number among chord rows, for labels */
const rowNumber = computed(() => {
  let n = 0
  return props.doc.lines.map((l) => (l.kind === 'row' ? ++n : 0))
})
/** cell key -> why the typed value was not applied */
const errors = ref<Readonly<Record<string, string>>>({})

const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)

/** only values that survive serialize -> parse are applied; others stay in the input, flagged */
function guarded(key: string, value: string, maxLength: number, apply: () => ChartDoc): void {
  const error = cellError(value, maxLength)
  if (error) {
    errors.value = { ...errors.value, [key]: error }
    return
  }
  const { [key]: _cleared, ...rest } = errors.value
  errors.value = rest
  emitDoc(apply())
}

const onCell = (i: number, f: RowField, value: string): void =>
  guarded(`${i}:${f}`, value, LIMITS.maxCell, () => setRowField(props.doc, i, f, value))
const onMeta = (key: MetaKey, value: string): void =>
  guarded(`meta:${key}`, value, LIMITS.maxMeta, () => setMeta(props.doc, key, value))
</script>
```

- [ ] **Step 4: Verify**

Run: `cd web && npx nuxi prepare && npx vitest run && npm run typecheck && npm run lint`
Expected: `Tests 73 passed`, typecheck and lint clean

- [ ] **Step 5: Commit**

```bash
git add web/app web/test && git commit -m "feat(web): chart grid with scale defaults, alternates and picker"
```

---

### Task 7: Text pane, preview, print and the editor page

The text pane shows diagnostics under the textarea. The preview renders `buildSheet` pages: each staff has a label column (section and bar, chord symbol, scale) and a VexFlow SVG. VexFlow and its embedded Bravura font load only on the editor page, and nothing comes from a CDN. In print, only the sheet shows: always light, 12 staves per letter page, one page per section.

**Files:** Create: `web/app/utils/vexflow.ts`, `web/app/components/{ChordSymbol,NoteName,ScaleStaff,ScaleSheet,ChartText,EditorView}.vue`, `web/app/pages/editor.vue`; Test: `web/test/ScaleSheet.test.ts`

- [ ] **Step 1: Write the failing test** (`ScaleStaff` is stubbed, because VexFlow needs a real browser)

`web/test/ScaleSheet.test.ts`:

```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { Row } from '~~/engine'
import ScaleSheet from '~/components/ScaleSheet.vue'

const rows: Row[] = Array.from({ length: 13 }, (_, i) => ({ section: 'A', bar: String(i + 1), chord: 'Cm7', scale: '' }))

describe('ScaleSheet', () => {
  it('lays out pages of perPage staves for each mode, each with a heading', async () => {
    const w = await mountSuspended(ScaleSheet, {
      props: { rows, title: 'T', subtitle: 'S', mode: 'both', perPage: 12 },
      global: { stubs: { ScaleStaff: true } }, // VexFlow needs a real browser
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
})
```

Run: `cd web && npx vitest run --project app test/ScaleSheet.test.ts`
Expected: FAIL, `~/components/ScaleSheet.vue` cannot be resolved

- [ ] **Step 2: Implement the preview**

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
  loading ??= import('vexflow/bravura').then(async (vf) => {
    await document.fonts.load('30px Bravura')
    return vf
  })
  return loading
}

// Drawing units. The SVG scales to its container width; in print that is about 650px,
// which makes each staff about 58px tall so 12 fit on a letter page with their labels.
export const STAFF_WIDTH = 960
const STAFF_HEIGHT = 120
const STAVE_Y = 10 // staff lines at y 50-90
// visible band: notes in either mode stay within about two ledger lines of the staff
const VIEW_TOP = 30
const VIEW_HEIGHT = 85

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
  if (notes.length === 0) return
  const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
  new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
  voice.draw(ctx, stave)

  // scale with the container instead of a fixed pixel size
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${VIEW_TOP} ${STAFF_WIDTH} ${VIEW_HEIGHT}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width') // VexFlow's resize() sets a fixed pixel size
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
}
```

`web/app/components/ChordSymbol.vue`:

```vue
<template>
  <span class="whitespace-nowrap"><template v-for="(t, i) in tokens" :key="i"><span v-if="t.kind === 'text'">{{ t.text }}</span><sup v-else class="text-[0.75em]">{{ t.acc === 'b' ? '♭' : '♯' }}</sup></template></span>
</template>

<script setup lang="ts">
import type { ChordToken } from '~~/engine'

defineProps<{ tokens: readonly ChordToken[] }>()
</script>
```

`web/app/components/NoteName.vue`:

```vue
<template>
  <span>{{ LETTERS[note.letter] }}<span v-if="note.acc" class="not-italic">{{ accidental }}</span></span>
</template>

<script setup lang="ts">
import { LETTERS, type Spelled } from '~~/engine'

const props = defineProps<{ note: Spelled }>()
const accidental = computed(() => (props.note.acc > 0 ? '♯' : '♭').repeat(Math.abs(props.note.acc)))
</script>
```

`web/app/components/ScaleStaff.vue`:

```vue
<template>
  <div class="grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]">
    <div class="text-right leading-tight">
      <div class="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">{{ staff.section }} · Bar {{ staff.bar }}</div>
      <div class="text-lg font-semibold"><ChordSymbol v-if="staff.chord" :tokens="staff.chord" /><span v-else>—</span></div>
      <div v-if="staff.scale" class="whitespace-nowrap text-sm italic"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
    </div>
    <div v-if="staff.error" class="rounded border border-dashed border-amber-500 px-3 py-6 text-sm text-amber-700 dark:text-amber-400">
      {{ staff.error }}
    </div>
    <div v-else ref="el" class="text-slate-900 dark:text-slate-100 print:text-black" />
  </div>
</template>

<script setup lang="ts">
import type { StaffModel } from '~~/engine'

const props = defineProps<{ staff: StaffModel; clef: 'treble' | 'bass' }>()
const el = useTemplateRef<HTMLDivElement>('el')

async function draw(): Promise<void> {
  if (props.staff.error) return
  const vf = await loadVexFlow()
  if (el.value) drawStaff(vf, el.value, props.staff, props.clef)
}

onMounted(draw)
watch(() => [props.staff.id, props.staff.last, props.clef], () => nextTick(draw))
</script>
```

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
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="clef" />
      </div>
      <p class="mt-3 text-right text-xs text-slate-400 print:hidden">Page {{ page.number }} of {{ pages.length }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { buildSheet, CONCERT, type ModeChoice, type Row } from '~~/engine'

const props = defineProps<{ rows: readonly Row[]; title: string; subtitle: string; mode: ModeChoice; perPage: number }>()

const part = CONCERT // phase 3 adds the instrument picker
const clef = part.clef

/** every printed page, in order, with its own heading (the CLI's bookparts flattened) */
const pages = computed(() =>
  buildSheet(props.rows, part, props.mode, 'C', props.perPage)
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: [props.subtitle, `(${sheetPart.heading})`].filter(Boolean).join(' '),
      })),
    )
    .map((page, i) => ({ ...page, number: i + 1 })),
)
</script>
```

- [ ] **Step 3: Text pane, editor view and page**

`web/app/components/ChartText.vue`:

```vue
<template>
  <div class="flex h-full flex-col gap-2">
    <textarea
      :value="text"
      spellcheck="false"
      aria-label="Chart text"
      class="h-[60vh] min-h-60 resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm leading-6 dark:border-slate-700 dark:bg-slate-900"
      @input="emit('update:text', ($event.target as HTMLTextAreaElement).value)"
    />
    <ul v-if="diagnostics.length" class="space-y-1 text-sm" aria-live="polite">
      <li v-for="(d, i) in diagnostics" :key="i" :class="d.fatal ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'">
        {{ d.line ? `Line ${d.line}: ` : '' }}{{ d.message }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Diagnostic } from '~~/engine'

defineProps<{ text: string; diagnostics: readonly Diagnostic[] }>()
const emit = defineEmits<{ 'update:text': [text: string] }>()
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
      <fieldset class="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
        <legend class="sr-only">Which spellings to show</legend>
        <label v-for="m in MODES" :key="m.value" class="cursor-pointer px-3 py-1 has-checked:bg-accent has-checked:text-white dark:has-checked:text-slate-950">
          <input v-model="mode" type="radio" name="mode" :value="m.value" class="sr-only" >{{ m.label }}
        </label>
      </fieldset>
      <button type="button" class="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong dark:text-slate-950" @click="print">
        Print / Save PDF
      </button>
    </div>

    <p v-if="editor.fatal.value" class="text-sm text-rose-600">Preview paused: the chart is over a size limit.</p>
    <ScaleSheet v-else :rows="editor.rows.value" :title="editor.meta.value.title" :subtitle="editor.meta.value.subtitle" :mode="mode" :per-page="PER_PAGE" />
  </div>
</template>

<script setup lang="ts">
import type { ModeChoice } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12
const MODES: readonly { value: ModeChoice; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'from', label: 'From C' },
  { value: 'root', label: 'From root' },
]

const editor = useChartEditor(props.initialText)
const mode = ref<ModeChoice>('both')

watch(editor.text, (t) => saveDraft(t))

function print(): void {
  window.print()
}
</script>
```

`web/app/pages/editor.vue`:

```vue
<template>
  <ClientOnly>
    <EditorView :initial-text="initialText" />
    <template #fallback><p class="text-slate-500">Loading editor…</p></template>
  </ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute()

/** library chart (?chart=slug), a blank starter (?new=1), else this browser's draft */
const initialText = computed(() => {
  const slug = typeof route.query.chart === 'string' ? route.query.chart : ''
  if (slug) return findChart(slug)?.text ?? STARTER_CHART
  if (route.query.new !== undefined) return STARTER_CHART
  return (import.meta.client && loadDraft()) || STARTER_CHART
})

useHead({ title: 'Editor · Chord Scale Maker' })
</script>
```

- [ ] **Step 4: Verify the automated checks**

Run: `cd web && npx nuxi prepare && npx vitest run && npm run typecheck && npm run lint && npm run generate`
Expected:
- `Tests 74 passed`, typecheck and lint clean
- `nuxt generate` prerenders `/`, `/editor`, `/200.html` and `/404.html`

- [ ] **Step 5: Check it by hand in a browser.** Run `cd web && npm run preview`, open http://localhost:3000, and confirm:
  - Library → Autumn Leaves opens the editor with the grid and text side by side. The preview shows 8 pages ("Page 1 of 8") with staves drawn and no browser-console errors.
  - Changing a grid chord updates the text at once. Typing `|` in a cell is rejected (red border, with a tooltip saying why).
  - Typing a new row in the text updates the grid and preview after a moment. A chord like `Cm7#5#9x` shows "Choose a scale", and Other… → C Altered → Set fixes it.
  - Both / From C / From root switches the parts. Dark mode toggles, survives a reload, and the staves stay visible.
  - Print preview (Cmd+P) shows only the sheet, light, 12 staves per page, 8 pages.

- [ ] **Step 6: Commit**

```bash
git add web/app web/test && git commit -m "feat(web): live preview, text pane and print"
```

---

### Task 8: Tooling, CI and docs

**Files:** Modify: `Makefile`, `.github/workflows/ci.yml`, `docs/design.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Replace `Makefile`** (recipe lines start with a tab)

```makefile
CHART ?= charts/autumn_leaves.txt
INST  ?= concert
PY    ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

.PHONY: pdf setup test lint fixtures dev preview clean
pdf:
	python3 jazz_scales.py $(CHART) -i $(INST) -o output/$(notdir $(basename $(CHART)))_$(INST)
setup:
	python3 -m venv .venv && $(PY) -m pip install -q pytest
	cd web && npm ci
test:
	$(PY) -m pytest tests
	cd web && npm run typecheck && npm test
lint:
	cd web && npm run lint
fixtures:
	$(PY) tools/export_fixtures.py
# web app: live-reloading dev server at http://localhost:3000
dev:
	cd web && npm run dev
# web app: build the static site as it will be deployed, then serve it at http://localhost:3000
preview:
	cd web && npm run preview
clean:
	rm -f output/*.pdf output/*.ly
	rm -rf web/.output
```

- [ ] **Step 2: Update CI.** In `.github/workflows/ci.yml`, the engine job's steps after `npm ci` become:

```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run generate
      # gate on what ships to browsers (vue, vexflow); build tooling advisories are reported, not blocking
      - run: npm audit --omit=dev --audit-level=high
      - run: npm audit --audit-level=high || true
```

- [ ] **Step 3: Update the docs** to match the code. Replace these files with the versions below:

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
    components/           # AppHeader, EditorView, ChartGrid, ScaleCell, ChartText,
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
- Cell validation: values may not contain `|` or line breaks, or start with `#`, `@`, `title:` or `subtitle:`. Otherwise the serialized text would re-parse as a different line.
- Chord cell: free text with validation. Scale cell: dropdown of the chord
  quality's options (with notes) plus "Other…" → `ScalePicker` (root + any of
  the 23 scales). Unknown quality → cell is flagged and shows `ScalePicker`.

## 5. Rendering

- One `ScaleStaff` per expanded row: HTML label column (section · bar, chord
  symbol, scale name) on the left, VexFlow SVG stave on the right. HTML labels
  give better typography and accessibility than VexFlow text.
- VexFlow: one stave, clef, no time signature, whole notes, an explicit
  accidental on every altered note (matches `\accidentalStyle forget`), double
  bar line, final bar line on the last staff.
- Two parts as in the CLI: "Spelled from X" and "Spelled from the Root", each
  with its own title header. Mode selector: both / from / root; start-note input
  (written pitch).
- VexFlow is loaded client-only (dynamic import of `vexflow/bravura`, editor page only) and bundled,
  not from a CDN, so the CSP stays `script-src 'self'`. Its Bravura font is embedded as a
  `data:` URL, so the CSP needs `font-src 'self' data:`. Drawing waits for `document.fonts.load`.
- The staff SVG uses `currentColor`, so it follows light/dark mode and prints black.
  It is drawn in a 960-unit-wide space and cropped to the band notes can reach, so in print
  each staff is about 58px tall and 12 fit on a letter page with their labels.
- `engine/sheet.ts` builds the view model (`StaffModel`: labels, notes, or an error such as
  "Choose a scale"); components only draw it. Live preview re-renders only changed staves
  (each staff's `id` combines its position, its row content and the mode).

## 6. Styling

- Tailwind CSS v4 through `@tailwindcss/vite` in `nuxt.config.ts`. Styles live in utility classes on components, with a single `app/assets/css/main.css` for `@import "tailwindcss"` and theme tokens.
- Palette: cool slate neutrals with a teal accent (`--color-accent`: teal-600, teal-400 in dark mode) and sky focus rings. The look is clean and minimal.
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

- `import.meta.glob('../../charts/*.txt', { query: '?raw', eager: true })` →
  `{ slug, title, subtitle, text }[]` at build time. The same parser runs, and
  the build fails if any library chart has errors (via a test).
- Title search: case- and accent-insensitive substring filter, client-side.
- "Open in editor" copies the chart into editor state; library files are never mutated.
- Contact: a "request a chart" link to the repo's new-issue page, in the footer. The URL is `runtimeConfig.public.issuesUrl`.

## 8. State

- `useChartEditor(initialText)`: `text`, `doc`, `diagnostics`, `fatal`, `rows`, `meta`,
  `setText` (debounced re-parse) and `setDoc` (grid edit → canonical text). Immutable updates only.
  Mode (both/from/root) is page state; part is fixed to concert until phase 3.
- Editor draft is kept in `localStorage` (try/catch) as a per-browser convenience.
  Nothing is sent anywhere.
- Instrument picker (phase 3) only changes `part`. The engine already supports
  every transposition, so phase 3 is UI only.

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

## Tests

```bash
make setup   # once: .venv with pytest, npm ci in web/
make test    # pytest + the TypeScript engine (typecheck, vitest)
```

`web/engine/` is a TypeScript port of the engine for the web app. `fixtures/golden.json`
records the Python engine's answers and the TS tests must match them; run `make fixtures`
after changing `jazz_scales.py`, `chord_scales.json` or `charts/`.
````

`CLAUDE.md`:

```markdown
# Claude Code notes for jazz-scales

## What this is
A single-file Python CLI (`jazz_scales.py`) that turns a concert-pitch chord
chart (`charts/*.txt`) into a LilyPond file and PDF of chord scales, one staff
per chord, optionally transposed for a jazz instrument. See README.md for the
chart format and options.

## Working here
- No third-party Python packages. Keep it that way unless there is a strong reason.
- LilyPond must be installed to produce PDFs; `--no-pdf` writes the `.ly` only.
- `make setup` once, then `make test` after changes: pytest (scale spelling, transposition,
  enharmonic choice, chart parsing, fixture freshness) plus the TS engine's typecheck and vitest.
- `web/engine/` is a TS port of the Python engine. After changing `jazz_scales.py`,
  `chord_scales.json` or `charts/`, run `make fixtures` and port the change to TS. The golden
  parity test (`web/engine/__tests__/golden.test.ts`) fails until both agree.
- Generated `.ly`/`.pdf` files belong in `output/` and are git-ignored.
- Web app: `make dev` / `make preview`; `make lint`. App code is in `web/app/`, its tests in `web/test/`.
  Keep `web/engine/` free of Vue/DOM imports; put view logic that can be pure in the engine (`sheet.ts`, `edit.ts`).
- Runtime `dependencies` are only what ships to browsers (`vue`, `vexflow`); CI gates on `npm audit --omit=dev`.

## Design rules
- Charts are always concert pitch; `--from` is always a written pitch.
- Scales are computed from degree formulas in `SCALES`; never hand-type note lists.
- Enharmonic spelling is decided per scale by `simplify_root` (avoid double
  accidentals and B#/E#/Cb/Fb, then fewest accidentals, then keep the original
  sharp/flat direction). A chord symbol follows its scale's spelling when they
  share a root; a slash bass keeps its interval from the root.
- Page fitting: `--per-page` unset means the script compiles with decreasing
  staves per page until no page overflows.
- Chart rows may omit the scale; both engines use the quality's default from `chord_scales.json`.

## Typical requests
- "Make a chart for <tune>": create `charts/<tune>.txt` in concert pitch, one row
  per chord with a sensible scale, then run the script for the requested instrument.
- "Add scale X": add a formula to `SCALES` (and an alias if common), add a test.
- "Add instrument X": add to `INSTRUMENTS` with clef and key.
```

- [ ] **Step 4: Verify**

Run: `make test && make lint`
Expected: `12 passed`, then `Test Files 15 passed`, `Tests 74 passed`; lint clean.

- [ ] **Step 5: Commit**

```bash
git add Makefile .github/workflows/ci.yml docs README.md CLAUDE.md && git commit -m "chore: dev/preview targets, CI build and audit policy, docs for the web app"
```

---

## After the tasks (controller)

- Point the Vercel project `chord-scale-maker` at the app: root directory `web`, framework Nuxt, build command `npm run generate`, Node 24. Then confirm the PR's preview deploy renders.
- Open the PR.

## Notes for phase 3 and 4

- **Phase 3 (transposition):** `ScaleSheet` hard-codes `CONCERT` and the start note `'C'`. The instrument and start-note pickers set these, and `buildSheet` already takes a `Part` and a start text.
- **Phase 4:**
  - Security headers in `vercel.json`. The CSP needs `font-src 'self' data:` for the embedded Bravura font and `style-src 'self' 'unsafe-inline'`, since Vue sets inline styles.
  - Firewall rate-limit rule.
  - Playwright E2E tests covering VexFlow drawing and print pagination.
  - Pin the CI actions to commit SHAs, and add Dependabot.
