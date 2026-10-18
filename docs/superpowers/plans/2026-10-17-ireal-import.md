# iReal Pro Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an iReal Pro link or `.html` export into our chart text: in the engine (pure TS), from a CLI into
`engine/charts/`, and in the web app (Library and Paste bars) behind the `ireal` flag.

**Architecture:** Three pure engine modules in `engine/src/ireal/`: `decode.ts` (link → songs, unscrambled),
`music.ts` (music string → bars with marks), `toChart.ts` (bars → chart text or a flat bar list, with a report).
A vite-node CLI wraps them for the library; the web app wraps them in `useOpenChart` plus one dialog component.

**Tech Stack:** TypeScript strict, vitest, vite-node, Nuxt 4 / Vue 3, Catalyst UI (`web/app/components/ui/`),
Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-ireal-import-design.md`

## Global Constraints

- `engine/` stays free of Vue/DOM imports; no runtime dependencies added anywhere.
- Our own parser: no code copied from infojunkie/ireal-musicxml (GPL-3.0).
- No network: parse only what the user supplies (CSP: no third-party origins).
- Charts are concert pitch; iReal's transpose field is ignored.
- Every chord written is one the engine knows: `baseQuality(quality) !== null` (exported from `engine/src/qualities.ts`).
- Feature flag `ireal` starts off in `web/nuxt.config.ts`; e2e and a11y builds turn it on (`NUXT_PUBLIC_FEATURES_IREAL=true`).
- New engine exports update the snapshot in `engine/src/__tests__/api.test.ts` (`npx vitest run -u src/__tests__/api.test.ts` in `engine/`, then read the diff).
- Commits: stage files by name (never `git add -A`), message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Worktree guard: plain git commands one at a time, no git inside pipelines, `$(…)` or heredocs.
- Run from the repo root unless a step says `engine/`: `make test` (typecheck + vitest, both packages), `make lint`, `make e2e`, `make a11y`.

## Review Focus

1. **A playlist with a song whose composer is blank** (`Title===Style=…`): split by field count, not on `===`; the
   songs after it must still be right. → Task 1 test "an empty composer doesn't split the song".
2. **A forum link pasted with surrounding prose or the whole `.html` file**: the first `irealb://` link is found
   and read; trailing `"` or `<` isn't part of it. → Task 1 test "finds the link inside html and prose".
3. **A broken link** (truncated, bad `%` escape, no `1r34LbKcu7` music): a diagnostic, never a throw.
   → Task 1 test "a malformed link is a diagnostic".
4. **`x`/`r` repeats at a section's or the song's start** (nothing before to repeat): the bar is held, reported
   only if there is nothing at all. → Task 3 test "a repeat with nothing before holds".
5. **A song whose every chord is unmapped, or with no chords**: the chart is still valid text (`parseChart` with no
   fatal diagnostics) with the report, and the web flow still offers Open anyway. → Task 3 test "no chords at all".

---

## File Structure

| File | Responsibility |
| --- | --- |
| `engine/src/ireal/decode.ts` (new) | find link, percent-decode, split songs/fields, unscramble, title/composer/key tidy |
| `engine/src/ireal/music.ts` (new) | tokenize an unscrambled music string into `IRealBar[]` |
| `engine/src/ireal/chords.ts` (new) | one iReal chord token → our chord symbol, or why not |
| `engine/src/ireal/toChart.ts` (new) | `irealToChart` (full chart text) and `irealBars` (flat bars for Paste bars) |
| `engine/src/ireal/index.ts` (new) | the module's public names |
| `engine/src/ireal/__tests__/link.ts` (new) | test helper: build an `irealb://` link from readable songs |
| `engine/src/ireal/__tests__/*.test.ts` (new) | unit tests per module |
| `engine/src/index.ts` | `export * from './ireal'` |
| `engine/scripts/importIreal.ts` (new) + `engine/package.json` | CLI `npm run import-ireal` |
| `engine/scripts/importIrealArgs.ts` (new) + test | the CLI's pure part: args, song pick, slug |
| `CLAUDE.md` | a "Typical requests" line for the CLI |
| `web/nuxt.config.ts`, `web/app/composables/useFeature.ts`, `web/package.json` | flag `ireal` |
| `web/app/utils/chartFile.ts` | `.html` accepted when iReal is on; result says which kind |
| `web/app/composables/useOpenChart.ts` | the shared import flow: decode → pick → report → save |
| `web/app/components/IRealImportDialog.vue` (new) | link entry, playlist picker, report |
| `web/app/pages/library.vue` | Import iReal link… button, `.html` in the file input, the dialog |
| `web/app/components/BarDialog.vue` | Paste bars takes an iReal link |
| `web/app/pages/help.vue` | one sentence |
| `web/test/chartFile.test.ts`, `web/test/useOpenChart.test.ts` (new), `web/test/IRealImportDialog.test.ts` (new), `web/test/BarDialog.test.ts` | unit tests |
| `web/e2e/ireal-import.spec.ts` (new), `web/e2e/a11y/pages.a11y.ts` | browser tests |

---

### Task 1: Decode links (`decode.ts`)

**Files:**
- Create: `engine/src/ireal/decode.ts`, `engine/src/ireal/__tests__/link.ts`, `engine/src/ireal/__tests__/decode.test.ts`

**Interfaces:**
- Consumes: `Diagnostic`, `Parsed` from `engine/src/chart.ts`.
- Produces:
  ```ts
  export type IRealSong = Readonly<{ title: string; composer: string; style: string; key: string; music: string }>
  export type IRealPlaylist = Readonly<{ name?: string; songs: readonly IRealSong[] }>
  export function decodeIReal(text: string): Parsed<IRealPlaylist>   // diagnostics fatal when nothing could be read
  export function unscramble(music: string): string                   // the 50-char block swap only (self-inverse)
  export const IREAL_PREFIX = '1r34LbKcu7'
  ```
  Test helper (`__tests__/link.ts`):
  ```ts
  export type RawSong = Readonly<{ title: string; composer?: string; style?: string; key?: string; music: string }>
  export function irealLink(songs: readonly RawSong[], name?: string, encode?: boolean): string
  ```

- [ ] **Step 1: Write the test helper**

`engine/src/ireal/__tests__/link.ts`:
```ts
import { IREAL_PREFIX, unscramble } from '../decode'

export type RawSong = Readonly<{ title: string; composer?: string; style?: string; key?: string; music: string }>

/** an irealb:// link as the app writes one; `music` is readable (the swap is self-inverse, so it scrambles too) */
export function irealLink(songs: readonly RawSong[], name?: string, encode = false): string {
  const song = (s: RawSong) =>
    [s.title, s.composer ?? 'Composer Unknown', '', s.style ?? 'Medium Swing', s.key ?? 'C', '', IREAL_PREFIX + unscramble(s.music), '', '0', '0'].join('=')
  const body = songs.map(song).join('===') + (name ? `===${name}` : '')
  return 'irealb://' + (encode ? encodeURIComponent(body) : encodeURI(body))
}
```

- [ ] **Step 2: Write the failing tests**

`engine/src/ireal/__tests__/decode.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { decodeIReal, unscramble } from '../decode'
import { irealLink } from './link'

const BLUES = '{*AT44C7 |F7 |C7 |C7 |F7 |F7 |C7 |A7 |D-7 |G7 |C7 A7 |D-7 G7 }'

describe('decodeIReal', () => {
  it('unscramble is its own inverse and leaves a tail of 51 or fewer alone', () => {
    const s = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{};:,./<>?~'
    expect(unscramble(unscramble(s))).toBe(s)
    expect(unscramble(s.slice(0, 51))).toBe(s.slice(0, 51))
    expect(unscramble(s.slice(0, 52)).slice(0, 5)).toBe(s.slice(45, 50).split('').reverse().join(''))
  })

  it('reads one song: title and composer tidied, key, music unscrambled', () => {
    const { value, diagnostics } = decodeIReal(irealLink([{ title: 'Gentle Rain, The', composer: 'Bonfa Luiz', key: 'A-', style: 'Bossa Nova', music: BLUES }]))
    expect(diagnostics).toEqual([])
    expect(value.name).toBeUndefined()
    expect(value.songs).toEqual([{ title: 'The Gentle Rain', composer: 'Luiz Bonfa', style: 'Bossa Nova', key: 'Am', music: BLUES }])
  })

  it('expands the scrambler’s shorthands', () => {
    const { value } = decodeIReal(irealLink([{ title: 'T', music: '[C7XyQKcl LZF7 Z' }]))
    expect(value.songs[0]?.music).toBe('[C7   | x  |F7 Z')
  })

  it('reads a playlist, its name last, and percent-encoded = from the app’s html', () => {
    const link = irealLink([{ title: 'One', music: BLUES }, { title: 'Two', music: BLUES }], 'My Set', true)
    const { value } = decodeIReal(link)
    expect(value.name).toBe('My Set')
    expect(value.songs.map((s) => s.title)).toEqual(['One', 'Two'])
  })

  it('an empty composer doesn’t split the song', () => {
    const { value } = decodeIReal(irealLink([{ title: 'One', composer: '', music: BLUES }, { title: 'Two', music: BLUES }], 'Set'))
    expect(value.songs.map((s) => [s.title, s.composer])).toEqual([['One', ''], ['Two', 'Composer Unknown']])
  })

  it('finds the link inside html and prose', () => {
    const link = irealLink([{ title: 'One', music: BLUES }], undefined, true)
    const html = `<html><body><h3><a href="${link}">One</a></h3><p>Made with iReal Pro</p></body></html>`
    expect(decodeIReal(html).value.songs).toHaveLength(1)
    expect(decodeIReal(`try this: ${irealLink([{ title: 'One', music: BLUES }])} thanks!`).value.songs).toHaveLength(1)
  })

  it('reads the legacy irealbook:// six-field form', () => {
    const { value } = decodeIReal(encodeURI('irealbook://Tune=Hall Jim=Ballad=F=n=[F^7 |G-7 C7 Z=Two=X Y=Waltz=C=n=[C |C Z'))
    expect(value.songs.map((s) => [s.title, s.composer, s.key, s.music])).toEqual([['Tune', 'Jim Hall', 'F', '[F^7 |G-7 C7 Z'], ['Two', 'Y X', 'C', '[C |C Z']])
  })

  it('a malformed link is a diagnostic', () => {
    for (const text of ['no link here', 'irealb://%E0%A4%A', 'irealb://Title=Comp==Style=C==not music=x=0=0']) {
      const { value, diagnostics } = decodeIReal(text)
      expect(value.songs).toEqual([])
      expect(diagnostics[0]).toMatchObject({ fatal: true })
    }
  })
})
```

- [ ] **Step 3: Run to see them fail**

Run: `cd engine && npx vitest run src/ireal/__tests__/decode.test.ts`
Expected: FAIL, cannot resolve `../decode`.

- [ ] **Step 4: Implement**

`engine/src/ireal/decode.ts`:
```ts
import type { Diagnostic, Parsed } from '../chart'

/*
 * iReal Pro links (docs/superpowers/specs/2026-10-17-ireal-import-design.md, "The format"): irealb:// (10 fields a song,
 * music scrambled) and the legacy irealbook:// (6 fields, plain), in a forum post or the app's .html export.
 */

export type IRealSong = Readonly<{ title: string; composer: string; style: string; key: string; music: string }>
export type IRealPlaylist = Readonly<{ name?: string; songs: readonly IRealSong[] }>

export const IREAL_PREFIX = '1r34LbKcu7'
const LINK = /irealb(ook)?:\/\/([^\s"'<>]+)/

/** each 50-character block swaps b[i] with b[49-i] for i in 0–4 and 10–23 while more than 51 remain; self-inverse */
export function unscramble(music: string): string {
  let out = ''
  let rest = music
  while (rest.length > 51) {
    const b = [...rest.slice(0, 50)]
    for (let i = 0; i < 24; i++) {
      if (i > 4 && i < 10) continue
      ;[b[i], b[49 - i]] = [b[49 - i] as string, b[i] as string]
    }
    out += b.join('')
    rest = rest.slice(50)
  }
  return out + rest
}

const expand = (music: string): string => music.replace(/Kcl/g, '| x').replace(/LZ/g, ' |').replace(/XyQ/g, '   ')

/** "Gentle Rain, The" -> "The Gentle Rain" */
const title = (t: string): string => t.replace(/^(.*), (The|A|An)$/, '$2 $1').trim()
/** "Hancock Herbie" -> "Herbie Hancock" (the last word first); one word stays */
function composer(c: string): string {
  const words = c.trim().split(/\s+/).filter(Boolean)
  return words.length < 2 || c.trim() === 'Composer Unknown' ? c.trim() : [words.at(-1), ...words.slice(0, -1)].join(' ')
}
/** "A-" -> "Am" */
const key = (k: string): string => k.trim().replace(/-$/, 'm')

const fatal = (message: string): Parsed<IRealPlaylist> => ({ value: { songs: [] }, diagnostics: [{ line: 1, message, fatal: true }] })

export function decodeIReal(text: string): Parsed<IRealPlaylist> {
  const m = LINK.exec(text)
  if (!m) return fatal('no iReal Pro link (irealb://…) found')
  let body: string
  try {
    body = decodeURIComponent(m[2] ?? '')
  } catch {
    return fatal('the iReal Pro link is damaged (a bad % escape): copy it again')
  }
  const fields = body.split('=')
  const legacy = m[1] === 'ook'
  const width = legacy ? 6 : 10
  const songs: IRealSong[] = []
  const diagnostics: Diagnostic[] = []
  let i = 0
  while (fields.length - i >= width) {
    const f = fields.slice(i, i + width)
    const raw = f[legacy ? 5 : 6] ?? ''
    if (!legacy && !raw.startsWith(IREAL_PREFIX)) {
      diagnostics.push({ line: songs.length + 1, message: `"${f[0]}": not an iReal Pro song (its music is missing)` })
    } else {
      const music = legacy ? raw : expand(unscramble(raw.slice(IREAL_PREFIX.length)))
      songs.push({ title: title(f[0] ?? ''), composer: composer(f[1] ?? ''), style: (f[legacy ? 2 : 3] ?? '').trim(), key: key(f[legacy ? 3 : 4] ?? ''), music })
    }
    i += width
    while (!legacy && fields[i] === '' && fields.length - i > 0) i++ // the `===` between songs
  }
  const name = fields.slice(i).join('=').trim()
  if (!songs.length) return fatal(diagnostics[0]?.message ?? 'the iReal Pro link has no songs')
  return { value: name ? { name, songs } : { songs }, diagnostics }
}
```

- [ ] **Step 5: Run to see them pass**

Run: `cd engine && npx vitest run src/ireal/__tests__/decode.test.ts`
Expected: PASS. If the empty-composer test fails, the skip loop is eating a field: the skip runs only *between*
songs (after a full `width` block), and a song's own empty field 2 sits inside the block.

- [ ] **Step 6: Commit**

```bash
git add engine/src/ireal/decode.ts engine/src/ireal/__tests__/link.ts engine/src/ireal/__tests__/decode.test.ts
git commit -m "iReal import: decode links and unscramble songs (#261)"
```

---

### Task 2: Tokenize music (`music.ts`)

**Files:**
- Create: `engine/src/ireal/music.ts`, `engine/src/ireal/__tests__/music.test.ts`

**Interfaces:**
- Consumes: `Diagnostic`, `Parsed`.
- Produces:
  ```ts
  export type IRealItem =
    | Readonly<{ kind: 'chord'; text: string; alt?: string }>   // text as iReal writes it ("C-7", "Bb^7/D")
    | Readonly<{ kind: 'repeat'; bars: 1 | 2 }>                   // x, r
    | Readonly<{ kind: 'rest' }>                                  // n
    | Readonly<{ kind: 'bass'; bass: string }>                    // W/C
  export type IRealBar = Readonly<{
    items: readonly IRealItem[]
    section?: string          // the letter after * ("A", "B", "i", "V")
    time?: string             // "3/4", "6/8", "12/8"
    ending?: number           // N1 → 1 (N0 → 0)
    open?: true; close?: true // { and }
    count?: number            // <3x> on the bar
    segno?: true; coda?: true
    comments: readonly string[]
    final?: true              // Z after it
  }>
  export function readMusic(music: string): Parsed<readonly IRealBar[]>   // diagnostic line = the bar's number from 1
  ```

- [ ] **Step 1: Write the failing tests**

`engine/src/ireal/__tests__/music.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { readMusic } from '../music'

const chords = (music: string) => readMusic(music).value.map((b) => b.items.map((i) => (i.kind === 'chord' ? i.text : i.kind === 'repeat' ? `x${i.bars}` : i.kind === 'rest' ? 'NC' : `W/${i.bass}`)))

describe('readMusic', () => {
  it('splits bars on every bar line; commas and spaces separate chords', () => {
    expect(chords('[T44C^7 A-7,|D-7 G7 |C6   Z')).toEqual([['C^7', 'A-7'], ['D-7', 'G7'], ['C6']])
  })

  it('an empty bar between plain bar lines is a held bar; space between ] and [ is not a bar', () => {
    expect(chords('[C7 |    |F7 ] [G7 Z')).toEqual([['C7'], [], ['F7'], ['G7']])
  })

  it('marks: section, time, repeats with endings and count, segno, coda, comments, final', () => {
    const bars = readMusic('{*AT34C7 |N1F7 }|N2<3x>G7 Z[*BSQC <D.S. al Coda>Z').value
    expect(bars[0]).toMatchObject({ section: 'A', time: '3/4', open: true })
    expect(bars[1]).toMatchObject({ ending: 1, close: true })
    expect(bars[2]).toMatchObject({ ending: 2, count: 3, final: true })
    expect(bars[3]).toMatchObject({ section: 'B', segno: true, coda: true, comments: ['D.S. al Coda'], final: true })
  })

  it('12/8 and 6/8', () => {
    expect(readMusic('[T12C7 |T68F7 Z').value.map((b) => b.time)).toEqual(['12/8', '6/8'])
  })

  it('repeat signs, N.C., slashes, invisible roots and alternate chords', () => {
    const bars = readMusic('[C7 |x |r|   |n |C7 p p p|W/E Z|D-7(Ab7) Z').value
    expect(bars.map((b) => b.items.map((i) => i.kind))).toEqual([['chord'], ['repeat'], ['repeat'], [], ['rest'], ['chord'], ['bass'], ['chord']])
    expect(bars[2]?.items[0]).toEqual({ kind: 'repeat', bars: 2 })
    expect(bars[7]?.items[0]).toEqual({ kind: 'chord', text: 'D-7', alt: 'Ab7' })
  })

  it('layout marks are ignored silently: sizes, spacing, fermata, end, comment heights', () => {
    const r = readMusic('[sC7lF7 |YYfG7 U|<*72Fine>C Z')
    expect(r.diagnostics).toEqual([])
    expect(r.value.map((b) => b.items.length)).toEqual([2, 1, 1])
    expect(r.value[2]?.comments).toEqual(['Fine'])
  })

  it('an unreadable token is a diagnostic naming its bar', () => {
    const r = readMusic('[C7 |F7 ?? Z')
    expect(r.diagnostics).toEqual([{ line: 2, message: 'bar 2: "??" not read' }])
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd engine && npx vitest run src/ireal/__tests__/music.test.ts`
Expected: FAIL, cannot resolve `../music`.

- [ ] **Step 3: Implement**

`engine/src/ireal/music.ts`:
```ts
import type { Diagnostic, Parsed } from '../chart'

/*
 * An unscrambled iReal music string as bars (spec "The format", "Tokens"). Bar lines | [ ] { } Z; marks between them
 * belong to the next bar written. Layout-only tokens (sizes, spacing, fermata, End) are read and dropped.
 */

export type IRealItem =
  | Readonly<{ kind: 'chord'; text: string; alt?: string }>
  | Readonly<{ kind: 'repeat'; bars: 1 | 2 }>
  | Readonly<{ kind: 'rest' }>
  | Readonly<{ kind: 'bass'; bass: string }>

export type IRealBar = Readonly<{
  items: readonly IRealItem[]
  section?: string
  time?: string
  ending?: number
  open?: true
  close?: true
  count?: number
  segno?: true
  coda?: true
  comments: readonly string[]
  final?: true
}>

type Draft = { -readonly [K in keyof IRealBar]: IRealBar[K] } & { items: IRealItem[]; comments: string[]; text: boolean }

const TOKENS: readonly (readonly [RegExp, (m: RegExpExecArray, d: Draft) => void])[] = [
  [/\s+|,/y, () => {}],
  [/T(12|\d\d)/y, (m, d) => (d.time = m[1] === '12' ? '12/8' : `${m[1]?.[0]}/${m[1]?.[1]}`)],
  [/\*([A-Za-z])/y, (m, d) => (d.section = m[1])],
  [/N(\d)/y, (m, d) => (d.ending = Number(m[1]))],
  [/<(?:\*\d\d)?([^>]*)>/y, (m, d) => {
    const text = (m[1] ?? '').trim()
    const count = /^(\d+)x$/i.exec(text)
    if (count) d.count = Number(count[1])
    else if (text) d.comments.push(text)
  }],
  [/S/y, (_, d) => (d.segno = true)],
  [/Q/y, (_, d) => (d.coda = true)],
  [/[slfUY]|p/y, (_, d) => (d.text = true)], // layout, and the slash that holds the chord
  [/x/y, (_, d) => d.items.push({ kind: 'repeat', bars: 1 })],
  [/r/y, (_, d) => d.items.push({ kind: 'repeat', bars: 2 })],
  [/n/y, (_, d) => d.items.push({ kind: 'rest' })],
  [/W\/([A-G][b#]?)/y, (m, d) => d.items.push({ kind: 'bass', bass: m[1] ?? '' })],
  [/([A-G][b#]?(?:sus|alt|add|[+\-^\dhob#])*(?:\/[A-G][b#]?)?)(?:\(([^)]*)\))?/y, (m, d) => d.items.push(m[2] ? { kind: 'chord', text: m[1] ?? '', alt: m[2] } : { kind: 'chord', text: m[1] ?? '' })],
]

const OPENS = new Set(['|', '[', '{'])
const CLOSES = new Set(['|', ']', '}', 'Z'])

export function readMusic(music: string): Parsed<readonly IRealBar[]> {
  const bars: IRealBar[] = []
  const diagnostics: Diagnostic[] = []
  const fresh = (): Draft => ({ items: [], comments: [], text: false })
  let d = fresh()
  let before = '' // the bar line that opened this stretch
  let spaces = false
  let i = 0
  const close = (line: string) => {
    const marks = d.section !== undefined || d.time !== undefined || d.ending !== undefined || d.segno || d.coda || d.comments.length > 0 || d.count !== undefined
    const held = spaces && OPENS.has(before) && CLOSES.has(line) // `|    |`: a bar of the chord before
    if (d.items.length || d.text || held || (marks && line !== '')) {
      const { text: _text, ...bar } = d
      bars.push({ ...bar, ...(line === '}' ? { close: true as const } : {}), ...(line === 'Z' ? { final: true as const } : {}) })
      d = fresh()
    } else if (line === '}' && bars.length) bars[bars.length - 1] = { ...bars[bars.length - 1]!, close: true }
    else if (line === 'Z' && bars.length) bars[bars.length - 1] = { ...bars[bars.length - 1]!, final: true }
    spaces = false
  }
  while (i < music.length) {
    const c = music[i] as string
    if (OPENS.has(c) || CLOSES.has(c)) {
      if (CLOSES.has(c)) close(c)
      if (c === '{') d.open = true
      before = c
      spaces = false
      i++
      continue
    }
    const hit = TOKENS.map(([re, act]) => {
      re.lastIndex = i
      const m = re.exec(music)
      return m ? ([m, act] as const) : null
    }).find(Boolean)
    if (!hit) {
      const bad = /\S+?(?=[\s|[\]{}Z]|$)/y
      bad.lastIndex = i
      const tok = bad.exec(music)?.[0] ?? c
      diagnostics.push({ line: bars.length + 1, message: `bar ${bars.length + 1}: "${tok}" not read` })
      i += tok.length
      continue
    }
    const [m, act] = hit
    if (/^\s+$/.test(m[0])) spaces = true
    act(m, d)
    i += m[0].length
  }
  close('')
  return { value: bars, diagnostics }
}
```

Notes for the implementer:
- `Z` is a bar line here, so a chord rooted on Z can't exist (roots are A–G); `S`, `Q`, `N`, `T`, `W`, `U`, `Y` are
  never chord roots either.
- A bar with only `p` slashes counts as written (`d.text`), so `C7 p p p` stays one bar.
- `r` in iReal sits in one bar and the next bar is empty (`r|XyQ` → `r|   `): Task 4 fills both.

- [ ] **Step 4: Run to see them pass**

Run: `cd engine && npx vitest run src/ireal/__tests__/music.test.ts`
Expected: PASS. Adjust only `music.ts`, never the tests, unless a test contradicts the spec.

- [ ] **Step 5: Commit**

```bash
git add engine/src/ireal/music.ts engine/src/ireal/__tests__/music.test.ts
git commit -m "iReal import: read the music string into bars (#261)"
```

---

### Task 3: Map chords (`chords.ts`)

**Files:**
- Create: `engine/src/ireal/chords.ts`, `engine/src/ireal/__tests__/chords.test.ts`

**Interfaces:**
- Consumes: `baseQuality` from `engine/src/qualities.ts`; `cellError` from `engine/src/edit.ts`.
- Produces:
  ```ts
  export type ChordMapping = Readonly<{ chord: string; note?: string } | { chord: null; note: string }>
  export function irealChord(text: string): ChordMapping   // note: why it was approximated or dropped
  ```

Known engine qualities (checked with `baseQuality` on this branch): `''`, `+`, `dim`, `m7b5`, `sus`, `Maj7`, `m`,
`m7`, `7`, `7sus`, `dim7`, `Maj9`, `6`, `69`, `Maj7#11`, `Maj9#11`, `Maj7#5`, `m6`, `m6/9`, `mMaj7`, `m9`, `m11`,
`9`, every `7`+alterations form, `7alt`, `13`, `13#11`, `13b9`, `7sus4b9`, `9sus`, `13sus`, `11`, `m13`, `add9`.
Unknown: `5`, `2`, `Maj13`, `m69`, `mMaj9`, `mMaj11`, `mMaj13`, `7susadd3`, `7b13sus`, `7add13`, `dimMaj7`.

- [ ] **Step 1: Write the failing tests**

`engine/src/ireal/__tests__/chords.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { irealChord } from '../chords'

describe('irealChord', () => {
  it.each([
    ['C', 'C'], ['C^', 'CMaj7'], ['C^7', 'CMaj7'], ['C^9', 'CMaj9'], ['C^7#11', 'CMaj7#11'], ['C^7#5', 'CMaj7#5'],
    ['C-', 'Cm'], ['C-7', 'Cm7'], ['C-6', 'Cm6'], ['C-9', 'Cm9'], ['C-11', 'Cm11'], ['C-^7', 'CmMaj7'], ['C-69', 'Cm6/9'],
    ['Ch', 'Cm7b5'], ['Ch7', 'Cm7b5'], ['Ch9', 'Cm7b5'], ['Co', 'Cdim'], ['Co7', 'Cdim7'], ['C+', 'C+'],
    ['C7', 'C7'], ['C7b9', 'C7b9'], ['C7alt', 'C7alt'], ['C13', 'C13'], ['C7sus', 'C7sus'], ['C7b9sus', 'C7sus4b9'],
    ['C69', 'C69'], ['Cadd9', 'Cadd9'], ['Bb^7/D', 'BbMaj7/D'], ['F#-7/E', 'F#m7/E'],
  ])('%s → %s', (ireal, ours) => expect(irealChord(ireal)).toEqual({ chord: ours }))

  it.each([
    ['C^13', 'CMaj9', 'C^13 written as CMaj9'],
    ['C-^9', 'CmMaj7', 'C-^9 written as CmMaj7'],
    ['C2', 'Cadd9', 'C2 written as Cadd9'],
    ['C5', 'C', 'C5 written as C'],
    ['C7susadd3', 'C7sus', 'C7susadd3 written as C7sus'],
    ['C7b13sus', 'C7sus', 'C7b13sus written as C7sus'],
  ])('%s is approximated as %s, with a note', (ireal, ours, note) => expect(irealChord(ireal)).toEqual({ chord: ours, note }))

  it('a quality the engine doesn’t know is dropped, with a note', () => {
    expect(irealChord('Co^7')).toEqual({ chord: null, note: 'Co^7: no chord like it here, left out' })
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd engine && npx vitest run src/ireal/__tests__/chords.test.ts`
Expected: FAIL, cannot resolve `../chords`.

- [ ] **Step 3: Implement**

`engine/src/ireal/chords.ts`:
```ts
import { cellError } from '../edit'
import { baseQuality } from '../qualities'

/** an iReal chord as ours: ^ is Maj, - minor, h half-diminished, o diminished; null when we have nothing like it */
export type ChordMapping = Readonly<{ chord: string; note?: string } | { chord: null; note: string }>

const CHORD = /^([A-G][b#]?)(.*?)(\/[A-G][b#]?)?$/

/** iReal spellings first (exact), then glyph rewrites */
const EXACT: Readonly<Record<string, string>> = { '^': 'Maj7', h: 'm7b5', h7: 'm7b5', h9: 'm7b5', o: 'dim', '-69': 'm6/9', '7b9sus': '7sus4b9' }
/** qualities we don't have, written as the nearest we do (and said so) */
const NEAREST: Readonly<Record<string, string>> = { '^13': 'Maj9', '-^9': 'mMaj7', '-^11': 'mMaj7', '-^13': 'mMaj7', '2': 'add9', '5': '', '7susadd3': '7sus', '7b13sus': '7sus', '7add13': '7' }

const rewrite = (q: string): string => q.replace(/^-\^/, 'mMaj').replace(/^\^/, 'Maj').replace(/^-/, 'm').replace(/^o(?=\d)/, 'dim')

export function irealChord(text: string): ChordMapping {
  const m = CHORD.exec(text)
  const dropped = { chord: null, note: `${text}: no chord like it here, left out` } as const
  if (!m) return dropped
  const [, root = '', quality = '', bass = ''] = m
  const near = NEAREST[quality]
  const ours = near ?? EXACT[quality] ?? rewrite(quality)
  if (quality !== '' && ours !== '' && baseQuality(ours) === null) return dropped
  const chord = root + ours + bass
  if (cellError(chord)) return dropped
  return near === undefined ? { chord } : { chord, note: `${text} written as ${chord}` }
}
```

- [ ] **Step 4: Run to see them pass**

Run: `cd engine && npx vitest run src/ireal/__tests__/chords.test.ts`
Expected: PASS. `C+` stays `C+` (an alias of `aug`); `C69` stays (alias of `6`).

- [ ] **Step 5: Commit**

```bash
git add engine/src/ireal/chords.ts engine/src/ireal/__tests__/chords.test.ts
git commit -m "iReal import: map iReal chord qualities to ours (#261)"
```

---

### Task 4: Songs to charts (`toChart.ts`), exports

**Files:**
- Create: `engine/src/ireal/toChart.ts`, `engine/src/ireal/index.ts`, `engine/src/ireal/__tests__/toChart.test.ts`
- Modify: `engine/src/index.ts` (add `export * from './ireal'` after `export * from './barLine'`)
- Modify: `engine/src/__tests__/__snapshots__/api.test.ts.snap` (via `-u`)

**Interfaces:**
- Consumes: `IRealSong` (Task 1), `readMusic`, `IRealBar` (Task 2), `irealChord` (Task 3), `parseChart` from `../chart` (tests only), `REST` from `../chord`.
- Produces:
  ```ts
  export function irealToChart(song: IRealSong): Parsed<string>                              // diagnostics never fatal
  export function irealBars(song: IRealSong): Parsed<readonly (readonly string[])[]>        // for Paste bars
  ```
  `engine/src/ireal/index.ts`:
  ```ts
  export { decodeIReal, type IRealPlaylist, type IRealSong } from './decode'
  export { irealBars, irealToChart } from './toChart'
  ```
  Diagnostic `line` is the song's bar number from 1; `message` starts with the section and bar: `A bar 3: …`.

- [ ] **Step 1: Write the failing tests**

`engine/src/ireal/__tests__/toChart.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseChart } from '../../chart'
import type { IRealSong } from '../decode'
import { irealBars, irealToChart } from '../toChart'

const song = (music: string, over: Partial<IRealSong> = {}): IRealSong => ({ title: 'Tune', composer: 'Jim Hall', style: 'Medium Swing', key: 'C', music, ...over })
const valid = (text: string) => expect(parseChart(text).diagnostics.filter((d) => d.fatal)).toEqual([])

describe('irealToChart', () => {
  it('writes the header and one section with rows from bar 1', () => {
    const { value, diagnostics } = irealToChart(song('[*AT44C^7 A-7 |D-7 G7 |C^7 |x Z'))
    expect(diagnostics).toEqual([])
    expect(value).toBe([
      'title: Tune', 'composer: Jim Hall', 'style: Medium Swing', 'key: C', 'form: A, 4 bars', 'source: iReal Pro', '',
      'section: A', '1 | CMaj7', '1 | Am7', '2 | Dm7', '2 | G7', '3 | CMaj7', '4 | CMaj7', '',
    ].join('\n'))
    valid(value)
  })

  it('AABA: repeated letters are numbered, a {…} with endings becomes @ending, the form counts it twice', () => {
    const music = '{*AC^7 |A-7 |D-7 |N1G7 }|N2G7 |C^7 ][*BE-7 |A7 |D-7 |G7 ][*AC^7 |A-7 |D-7 G7 |C^7 Z'
    const { value } = irealToChart(song(music))
    expect(value).toContain('form: AABA, 17 bars') // A1: body 3 twice + endings 1 + 2; B 4; A2 4
    expect(value).toContain('section: A1\n1 | CMaj7\n2 | Am7\n3 | Dm7\n4 | G7\n5 | G7\n6 | CMaj7\n@ending 1 4\n@ending 2 5 6\n')
    expect(value).toContain('section: B\n')
    expect(value).toContain('section: A2\n')
    valid(value)
  })

  it('a {…} without endings is the section then a copy of it', () => {
    const { value } = irealToChart(song('{*AC7 |F7 |C7 |G7 }[*BF7 |C7 Z'))
    expect(value).toContain('section: A1\n1 | C7\n2 | F7\n3 | C7\n4 | G7\n\nsection: A2\ncopy: A1\n\nsection: B\n')
    expect(value).toContain('form: AAB, 10 bars')
    valid(value)
  })

  it('intro and verse are outside the form', () => {
    const { value } = irealToChart(song('[*iC7 |F7 ][*VG7 |C7 ][*AC^7 |D-7 G7 Z'))
    expect(value).toContain('section: Intro\n')
    expect(value).toContain('section: Verse\noutside: yes\n')
    expect(value).toContain('form: A, 2 bars')
    valid(value)
  })

  it('held chords: an empty bar writes no row, a held last chord gives bars: N, slashes hold', () => {
    const { value } = irealToChart(song('[*AC7 p p p|    |F7 |    Z'))
    expect(value).toContain('section: A\nbars: 4\n1 | C7\n3 | F7\n')
  })

  it('x and r repeat the bars before; N.C. is a rest', () => {
    const { value } = irealToChart(song('[*AC7 |F7 |r|   |n |x Z'))
    expect(value).toContain('1 | C7\n2 | F7\n3 | C7\n4 | F7\n5 | N.C.\n6 | N.C.\n')
  })

  it('a repeat with nothing before holds', () => {
    const { value, diagnostics } = irealToChart(song('[*Ax |C7 Z'))
    expect(value).toContain('section: A\n2 | C7\n')
    expect(diagnostics).toEqual([{ line: 1, message: 'A bar 1: a repeat sign with no bar before it, left empty' }])
  })

  it('segno, coda and the jumps we know become marks; other comments are reported', () => {
    const { value, diagnostics } = irealToChart(song('[*ASC7 |F7 <D.S. al Coda>|QG7 <play softly>|C7 Z'))
    expect(value).toContain('@segno 1\n@nav 2 D.S. al Coda\n@coda 3\n')
    expect(diagnostics).toEqual([{ line: 3, message: 'A bar 3: the comment "play softly" is left out' }])
  })

  it('metre: the song’s first is time:, a change is @time, a later section restates it', () => {
    const { value } = irealToChart(song('[*AT34C7 |F7 |T44G7 |C7 ][*BF7 |C7 Z'))
    expect(value).toContain('time: 3/4\n')
    expect(value).toContain('4 | C7\n@time 3 4/4\n')
    expect(value).toContain('section: B\ntime: 4/4\n')
    valid(value)
  })

  it('reports what it can’t write: 6/8, alternate chords, a bass alone, an unknown chord, a third time through', () => {
    const { diagnostics } = irealToChart(song('{*AT68C7(Db7) |W/E |Co^7 |<3x>F7 }Z'))
    expect(diagnostics.map((d) => d.message)).toEqual([
      'A bar 1: the alternate chord Db7 is left out',
      'A bar 1: 6/8 is not a metre the sheets have; read as 4/4',
      'A bar 2: a bass note with no chord (W/E) is left out',
      'A bar 3: Co^7: no chord like it here, left out',
      'A bar 4: played 3 times; written as twice',
    ])
  })

  it('approximations are reported and written', () => {
    const { value, diagnostics } = irealToChart(song('[*AC^13 Z'))
    expect(value).toContain('1 | CMaj9\n')
    expect(diagnostics).toEqual([{ line: 1, message: 'A bar 1: C^13 written as CMaj9' }])
  })

  it('no chords at all is still a valid chart', () => {
    const { value } = irealToChart(song('[*AW/C |n Z'))
    valid(value)
  })

  it('a minor key and no composer', () => {
    const { value } = irealToChart(song('[*AC-7 Z', { key: 'Cm', composer: '' }))
    expect(value).toMatch(/^title: Tune\nstyle: Medium Swing\nkey: Cm\n/)
  })
})

describe('irealBars', () => {
  it('the bars as Paste bars takes them, repeats filled in, sections and endings flat', () => {
    expect(irealBars(song('{*AC7 |x |N1F7 }|N2G7 |    Z')).value).toEqual([['C7'], ['C7'], ['F7'], ['G7'], []])
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd engine && npx vitest run src/ireal/__tests__/toChart.test.ts`
Expected: FAIL, cannot resolve `../toChart`.

- [ ] **Step 3: Implement**

`engine/src/ireal/toChart.ts`:
```ts
import type { Diagnostic, Parsed } from '../chart'
import { REST } from '../chord'
import { irealChord } from './chords'
import type { IRealSong } from './decode'
import { type IRealBar, readMusic } from './music'

/*
 * An iReal song as our chart text (spec "Engine", toChart.ts). Bars are played first (x/r filled in, chords mapped),
 * then cut into sections at each *X mark; { } with endings is @ending, without them a copy: section.
 */

const METRES = new Set(['2/4', '3/4', '4/4', '5/4', '6/4'])
const NAV: readonly string[] = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
const navOf = (comment: string): string | undefined => NAV.find((n) => n.toLowerCase() === comment.replace(/\s+/g, ' ').trim().toLowerCase())

type Played = Readonly<{ bar: IRealBar; chords: readonly string[]; n: number }>

/** each bar's chords as written (empty: held), x/r filled from the bars before; reports what's left out */
function play(bars: readonly IRealBar[], where: (n: number) => string, report: (n: number, m: string) => void): Played[] {
  const out: Played[] = []
  let pending: readonly string[] | null = null // r's second bar
  for (const [i, bar] of bars.entries()) {
    const n = i + 1
    let chords: string[] = []
    if (pending) {
      chords = [...pending]
      pending = null
    }
    for (const item of bar.items) {
      if (item.kind === 'repeat') {
        const back = out.at(-item.bars)
        if (!back) report(n, `${where(n)}: a repeat sign with no bar before it, left empty`)
        else {
          chords.push(...back.chords)
          if (item.bars === 2) pending = out.at(-1)?.chords ?? []
        }
      } else if (item.kind === 'rest') chords.push(REST)
      else if (item.kind === 'bass') report(n, `${where(n)}: a bass note with no chord (W/${item.bass}) is left out`)
      else {
        if (item.alt) report(n, `${where(n)}: the alternate chord ${item.alt} is left out`)
        const m = irealChord(item.text)
        if (m.note) report(n, `${where(n)}: ${m.note}`)
        if (m.chord !== null) chords.push(m.chord)
      }
    }
    out.push({ bar, chords, n })
  }
  return out
}

type Section = { base: string; name: string; outside: boolean; bars: Played[] }

const baseName = (mark: string): string => (mark === 'i' ? 'Intro' : mark === 'V' ? 'Verse' : mark.toUpperCase())

function sections(played: readonly Played[]): Section[] {
  const out: Section[] = []
  for (const p of played) {
    if (p.bar.section !== undefined || !out.length) {
      const base = baseName(p.bar.section ?? 'A')
      out.push({ base, name: base, outside: base === 'Verse' || base === 'Intro', bars: [] })
    }
    out.at(-1)!.bars.push(p)
  }
  return out
}

/** our where-text for a bar: "A bar 3" (section names as numbered later, so computed after naming) */
export function irealToChart(song: IRealSong): Parsed<string> {
  const read = readMusic(song.music)
  const diagnostics: Diagnostic[] = [...read.diagnostics]
  const at: string[] = [] // song bar n → "A bar 3"
  // first pass: sections by mark, to name the bars in reports
  const marks = read.value
  let s = ''
  let k = 0
  const raw: string[] = []
  for (const b of marks) {
    if (b.section !== undefined || !raw.length) {
      s = baseName(b.section ?? 'A')
      k = 0
    }
    raw.push(s)
    at.push(`${s} bar ${++k}`)
  }
  const report = (n: number, message: string) => diagnostics.push({ line: n, message })
  const played = play(marks, (n) => at[n - 1] ?? `bar ${n}`, report)
  const secs = sections(played)

  // a { } without endings repeats its section: a copy: section after it
  type Block = Readonly<{ sec: Section; copy?: true; endings?: readonly (readonly [number, number, number])[] }>
  const blocks: Block[] = []
  for (const sec of secs) {
    const first = sec.bars[0]?.bar
    const last = sec.bars.at(-1)?.bar
    const count = sec.bars.find((p) => p.bar.count !== undefined)
    if (count) report(count.n, `${at[count.n - 1]}: played ${count.bar.count} times; written as twice`)
    const endingStarts = sec.bars.map((p, i) => [p.bar.ending, i] as const).filter(([e]) => e !== undefined && e > 0)
    if (first?.open && endingStarts.length) {
      const endings = endingStarts.map(([e, i], j) => [e as number, i + 1, (endingStarts[j + 1]?.[1] ?? sec.bars.length) ] as const)
      blocks.push({ sec, endings })
    } else if (first?.open && sec.bars.some((p) => p.bar.close) && last?.close) {
      blocks.push({ sec }, { sec, copy: true })
    } else blocks.push({ sec })
  }

  // numbering: a letter that comes more than once is A1, A2… (a copy counts)
  const total = new Map<string, number>()
  for (const b of blocks) total.set(b.sec.base, (total.get(b.sec.base) ?? 0) + 1)
  const seen = new Map<string, number>()
  const names = blocks.map((b) => {
    const n = (seen.get(b.sec.base) ?? 0) + 1
    seen.set(b.sec.base, n)
    return (total.get(b.sec.base) ?? 1) > 1 ? `${b.sec.base}${n}` : b.sec.base
  })

  // metre
  const metreOf = (bar: IRealBar, n: number): string | undefined => {
    if (bar.time === undefined) return undefined
    if (METRES.has(bar.time)) return bar.time
    report(n, `${at[n - 1]}: ${bar.time} is not a metre the sheets have; read as 4/4`)
    return undefined
  }
  const songTime = (marks[0] && metreOf(marks[0], 1)) ?? '4/4'
  let metre = songTime

  const lines: string[] = []
  const formLetters: string[] = []
  let formBars = 0
  blocks.forEach((b, j) => {
    const name = names[j] as string
    const out = [`section: ${name}`]
    if (b.copy) {
      const src = names[j - 1] as string
      out.push(`copy: ${src}`)
      if (!b.sec.outside) {
        formLetters.push(b.sec.base)
        formBars += b.sec.bars.length
      }
      lines.push(out.join('\n'), '')
      return
    }
    if (b.sec.outside && b.sec.base === 'Verse') out.push('outside: yes')
    if (metre !== songTime) out.push(`time: ${metre}`)
    const rows: string[] = []
    const marksOut: string[] = []
    let lastRowBar = 0
    b.sec.bars.forEach((p, i) => {
      const bar = i + 1
      if (!(i === 0 && j === 0)) {
        const t = metreOf(p.bar, p.n)
        if (t !== undefined && t !== metre) {
          metre = t
          marksOut.push(`@time ${bar} ${t}`)
        }
      }
      for (const c of p.chords) rows.push(`${bar} | ${c}`)
      if (p.chords.length) lastRowBar = bar
      if (p.bar.segno) marksOut.push(`@segno ${bar}`)
      for (const c of p.bar.comments) {
        const nav = navOf(c)
        if (nav) marksOut.push(`@nav ${bar} ${nav}`)
        else report(p.n, `${at[p.n - 1]}: the comment "${c}" is left out`)
      }
      if (p.bar.coda) marksOut.push(`@coda ${bar}`)
    })
    const length = b.sec.bars.length
    if (lastRowBar < length && rows.length) out.push(`bars: ${length}`)
    out.push(...rows, ...marksOut.sort(byBar))
    for (const [e, first, last] of b.endings ?? []) out.push(first === last ? `@ending ${e} ${first}` : `@ending ${e} ${first} ${last}`)
    lines.push(out.join('\n'), '')
    if (!b.sec.outside) {
      const endingBars = (b.endings ?? []).reduce((sum, [, f, l]) => sum + (l - f + 1), 0)
      const body = length - endingBars
      const times = b.endings ? b.endings.length : 1
      for (let t = 0; t < times; t++) formLetters.push(b.sec.base)
      formBars += b.endings ? body * times + endingBars : length
    }
  })

  const header = [
    `title: ${song.title}`,
    ...(song.composer ? [`composer: ${song.composer}`] : []),
    ...(song.style ? [`style: ${song.style}`] : []),
    ...(song.key ? [`key: ${song.key}`] : []),
    ...(songTime !== '4/4' ? [`time: ${songTime}`] : []),
    `form: ${formLetters.join('')}, ${formBars} bars`,
    'source: iReal Pro',
    '',
  ]
  // in bar order (a stable sort keeps one bar's in the order found)
  return { value: [...header, ...lines].join('\n'), diagnostics: [...diagnostics].sort((a, b) => a.line - b.line) }
}

/** marks in bar order (a stable sort keeps a bar's own order: segno, nav, coda) */
const byBar = (a: string, b: string): number => Number(a.split(' ')[1]) - Number(b.split(' ')[1])

/** the song's bars, flat, as Paste bars inserts them (parseBarLine's shape) */
export function irealBars(song: IRealSong): Parsed<readonly (readonly string[])[]> {
  const read = readMusic(song.music)
  const diagnostics: Diagnostic[] = [...read.diagnostics]
  const played = play(read.value, (n) => `bar ${n}`, (n, message) => diagnostics.push({ line: n, message }))
  return { value: played.map((p) => p.chords), diagnostics }
}
```

Implementation notes:
- This is a starting point that the tests pin; refactor freely (pure functions, no mutation leaking out) once green.
  The first-pass `at[]` naming uses base names, so a report says `A bar 3` even where the section later becomes
  `A1`. That's what the tests expect; keep it.
- The ending ranges: an ending runs from its `N` bar to the bar before the next `N` (or the section's end): in the
  AABA test `@ending 1 4` and `@ending 2 5 6`.
- `@ending`, `@segno`, `@coda`, `@nav`, `@time` syntax: README "Charts" table. `copy:` needs the source above it.
- If `parseChart` complains about something the code writes, the README is the authority: fix the writer.

- [ ] **Step 4: Run to green**

Run: `cd engine && npx vitest run src/ireal/__tests__/toChart.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and update the API snapshot**

`engine/src/ireal/index.ts`:
```ts
export { decodeIReal, type IRealPlaylist, type IRealSong } from './decode'
export { irealBars, irealToChart } from './toChart'
```
In `engine/src/index.ts`, after `export * from './barLine'`, add `export * from './ireal'`.
Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts`, then `git diff engine/src/__tests__/__snapshots__/`
Expected: exactly `decodeIReal`, `irealBars`, `irealToChart` added (types aren't runtime names).

- [ ] **Step 6: Whole engine suite + lint**

Run: `make test` and `make lint`
Expected: PASS. The engine lint bars Vue/VexFlow/app imports; none are used.

- [ ] **Step 7: Commit**

```bash
git add engine/src/ireal/toChart.ts engine/src/ireal/index.ts engine/src/ireal/__tests__/toChart.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "iReal import: songs as chart text and as pasted bars (#261)"
```

---

### Task 5: CLI `npm run import-ireal`

**Files:**
- Create: `engine/scripts/importIrealArgs.ts`, `engine/scripts/importIreal.ts`, `engine/src/ireal/__tests__/importIrealArgs.test.ts`
- Modify: `engine/package.json` (scripts), `CLAUDE.md` ("Typical requests")

**Interfaces:**
- Consumes: `decodeIReal`, `irealToChart`, `IRealPlaylist` (Tasks 1, 4).
- Produces (pure, tested):
  ```ts
  export type ImportArgs = Readonly<{ input: string; list: boolean; song?: string; save: boolean; force: boolean }>
  export function parseImportArgs(argv: readonly string[]): ImportArgs | string    // string: usage error
  export function pickSong(playlist: IRealPlaylist, song: string | undefined): number | string  // index or error
  export function chartSlug(title: string): string
  ```

- [ ] **Step 1: Write the failing tests**

`engine/src/ireal/__tests__/importIrealArgs.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { chartSlug, parseImportArgs, pickSong } from '../../../scripts/importIrealArgs'

const list = { songs: [{ title: 'Blue Bossa' }, { title: "'Round Midnight" }].map((s) => ({ ...s, composer: '', style: '', key: 'C', music: '' })) }

describe('import-ireal arguments', () => {
  it('reads the input and flags', () => {
    expect(parseImportArgs(['x.html', '--song', '2', '--save'])).toEqual({ input: 'x.html', list: false, song: '2', save: true, force: false })
    expect(parseImportArgs(['irealb://…', '--list'])).toMatchObject({ list: true })
    expect(parseImportArgs([])).toMatch(/usage/i)
    expect(parseImportArgs(['x', '--song'])).toMatch(/--song/)
    expect(parseImportArgs(['x', '--nope'])).toMatch(/--nope/)
  })

  it('picks a song by number or title, and needs one when there are several', () => {
    expect(pickSong(list, '2')).toBe(1)
    expect(pickSong(list, 'blue bossa')).toBe(0)
    expect(pickSong(list, undefined)).toMatch(/--song/)
    expect(pickSong(list, '9')).toMatch(/no song/)
    expect(pickSong({ songs: list.songs.slice(0, 1) }, undefined)).toBe(0)
  })

  it('names the file as the library does', () => {
    expect(chartSlug("'Round Midnight")).toBe('round-midnight')
    expect(chartSlug('Here’s That Rainy Day')).toBe('heres-that-rainy-day')
    expect(chartSlug('Chega de Saudade (No More Blues)')).toBe('chega-de-saudade-no-more-blues')
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd engine && npx vitest run src/ireal/__tests__/importIrealArgs.test.ts`
Expected: FAIL, cannot resolve `../../../scripts/importIrealArgs`. (If vitest's include doesn't reach `scripts/`, that's fine: the import is relative from a test under `src/`.)

- [ ] **Step 3: Implement the pure part**

`engine/scripts/importIrealArgs.ts`:
```ts
import type { IRealPlaylist } from '../src'

export type ImportArgs = Readonly<{ input: string; list: boolean; song?: string; save: boolean; force: boolean }>

export const USAGE = 'usage: npm run import-ireal -- <irealb:// link | export.html> [--list] [--song <n | title>] [--save] [--force]'

export function parseImportArgs(argv: readonly string[]): ImportArgs | string {
  let input: string | undefined
  let song: string | undefined
  const flags = { list: false, save: false, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string
    if (a === '--list') flags.list = true
    else if (a === '--save') flags.save = true
    else if (a === '--force') flags.force = true
    else if (a === '--song') {
      song = argv[++i]
      if (song === undefined) return '--song needs a number or a title'
    } else if (a.startsWith('--')) return `unknown option ${a}\n${USAGE}`
    else input ??= a
  }
  if (input === undefined) return USAGE
  return { input, ...flags, ...(song === undefined ? {} : { song }) }
}

export function pickSong(playlist: IRealPlaylist, song: string | undefined): number | string {
  const n = playlist.songs.length
  if (song === undefined) return n === 1 ? 0 : `${n} songs here: say which with --song <n | title> (--list lists them)`
  const i = /^\d+$/.test(song) ? Number(song) - 1 : playlist.songs.findIndex((s) => s.title.toLowerCase() === song.toLowerCase())
  return i >= 0 && i < n ? i : `no song ${JSON.stringify(song)} here (--list lists them)`
}

/** as the library's files are named: lowercase, hyphens, no punctuation */
export const chartSlug = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
```

- [ ] **Step 4: Run to see them pass**

Run: `cd engine && npx vitest run src/ireal/__tests__/importIrealArgs.test.ts`
Expected: PASS.

- [ ] **Step 5: The script and its npm entry**

`engine/scripts/importIreal.ts`:
```ts
/**
 * An iReal Pro song as a library chart (docs/superpowers/specs/2026-10-17-ireal-import-design.md, "CLI"):
 *   npm run import-ireal -- <irealb:// link | export.html> [--list] [--song <n | title>] [--save] [--force]
 * Prints the chart (or writes engine/charts/<slug>.txt with --save) and what it couldn't map. Then the usual
 * new-chart steps: check the header, analyse --save, --ambiguous, make golden, make og.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { decodeIReal, irealToChart } from '../src'
import { chartSlug, parseImportArgs, pickSong } from './importIrealArgs'

const CHARTS = new URL('../charts/', import.meta.url).pathname

const args = parseImportArgs(process.argv.slice(2))
if (typeof args === 'string') {
  console.error(args)
  process.exit(1)
}
const text = /^irealb(ook)?:\/\//.test(args.input) ? args.input : readFileSync(args.input, 'utf8')
const { value: playlist, diagnostics } = decodeIReal(text)
for (const d of diagnostics) console.error(`${d.fatal ? '✗' : '⚠️'} ${d.message}`)
if (!playlist.songs.length) process.exit(1)

if (args.list) {
  if (playlist.name) console.log(playlist.name)
  playlist.songs.forEach((s, i) => console.log(`${i + 1}. ${s.title}${s.composer ? ` (${s.composer})` : ''}`))
  process.exit(0)
}
const pick = pickSong(playlist, args.song)
if (typeof pick === 'string') {
  console.error(pick)
  process.exit(1)
}
const song = playlist.songs[pick]!
const chart = irealToChart(song)
const slug = chartSlug(song.title)
if (args.save) {
  const path = `${CHARTS}${slug}.txt`
  if (existsSync(path) && !args.force) {
    console.error(`charts/${slug}.txt exists: --force to replace it`)
    process.exit(1)
  }
  writeFileSync(path, chart.value)
  console.log(`📁 charts/${slug}.txt`)
} else console.log(chart.value)
for (const d of chart.diagnostics) console.log(`⚠️ ${d.message}`)
if (args.save) console.log(`next: check composer:/form:, add recording:/aka:, then npm run analyse -- charts/${slug}.txt --save`)
```

In `engine/package.json` `scripts`, after `"check-recordings"`, add:
```json
    "import-ireal": "vite-node scripts/importIreal.ts --"
```

- [ ] **Step 6: Try it by hand**

Make a throwaway link in the scratchpad (not the repo) with the test helper, then:
Run: `cd engine && npm run import-ireal -- "<that link>"` → prints the chart and its report.
Run: `cd engine && npm run import-ireal -- "<a two-song link>"` → exits 1 with the `--song` message.
Do not run `--save` against `engine/charts/` here (it would add a library chart).

- [ ] **Step 7: CLAUDE.md line**

In `CLAUDE.md` "Typical requests", after the "Make a chart for <tune>" item, add:
```markdown
- "Import <tune> from iReal": `cd engine && npm run import-ireal -- <irealb:// link | export.html> --song <n | title> --save`
  (`--list` lists a playlist) writes `engine/charts/<slug>.txt` and prints what it couldn't map; check `composer:`
  and `form:`, add `recording:`/`aka:`, then the "Make a chart" steps from `npm run analyse` on.
```

- [ ] **Step 8: Lint, typecheck, commit**

Run: `make lint` and `make test`
Expected: PASS.
```bash
git add engine/scripts/importIrealArgs.ts engine/scripts/importIreal.ts engine/src/ireal/__tests__/importIrealArgs.test.ts engine/package.json CLAUDE.md
git commit -m "iReal import: npm run import-ireal writes a library chart (#261)"
```

---

### Task 6: Web flow: flag, files, links, picker, report (Library)

**Files:**
- Modify: `web/nuxt.config.ts` (features), `web/app/composables/useFeature.ts` (`Feature`), `web/package.json` (e2e, a11y env)
- Modify: `web/app/utils/chartFile.ts`, `web/app/composables/useOpenChart.ts`, `web/app/pages/library.vue`, `web/app/pages/help.vue`
- Create: `web/app/components/IRealImportDialog.vue`, `web/test/useOpenChart.test.ts`, `web/test/IRealImportDialog.test.ts`
- Modify: `web/test/chartFile.test.ts`

**Interfaces:**
- Consumes: `decodeIReal`, `irealToChart`, `IRealSong`, `Diagnostic` from `@chord-scale-maker/engine`; `saveChart`, `newChartId` (web utils, auto-imported).
- Produces:
  ```ts
  // chartFile.ts
  export type ChartFileResult = Readonly<{ ok: true; text: string; kind: 'chart' | 'ireal' }> | Readonly<{ ok: false; error: string }>
  export async function readChartFile(file: File, opts?: Readonly<{ ireal?: boolean }>): Promise<ChartFileResult>
  // useOpenChart.ts (returned object)
  { open(file?: File): Promise<void>; openIReal(text: string): Promise<void>; choose(index: number): Promise<void>;
    confirm(): Promise<void>; cancel(): void;
    error: Readonly<Ref<string>>; busy: Readonly<Ref<boolean>>;
    songs: Readonly<Ref<readonly IRealSong[]>>; playlist: Readonly<Ref<string>>; report: Readonly<Ref<readonly Diagnostic[]>> }
  ```
  `IRealImportDialog.vue` props: `{ open: boolean; songs: readonly IRealSong[]; playlist: string; report: readonly Diagnostic[]; error: string; busy: boolean }`; emits `link(text: string)`, `choose(index: number)`, `confirm()`, `close()`.

- [ ] **Step 1: Flag**

`web/nuxt.config.ts`, in `features`, after `playerRange`:
```ts
        ireal: false, // iReal Pro import: Library's Open chart… and Import iReal link…, Paste bars (#261; docs/superpowers/specs/2026-10-17-ireal-import-design.md)
```
`web/app/composables/useFeature.ts`: add `| 'ireal'` to `Feature`.
`web/package.json`: add `NUXT_PUBLIC_FEATURES_IREAL=true` to both the `e2e` and `a11y` scripts' env lists.
Check `web/test/features.test.ts` still passes (it may list the flags; add `ireal` where it does).

- [ ] **Step 2: Failing tests for files**

Append to `web/test/chartFile.test.ts` (inside the describe), and update the first test's expectation to include `kind: 'chart'`:
```ts
  it('an .html file is an iReal export when iReal is on, and turned away when it’s off', async () => {
    const html = '<a href="irealb://T%3DC%3D%3DS%3DC%3D%3D1r34LbKcu7%5BC7%20Z%3D%3D0%3D0">T</a>'
    expect(await readChartFile(file(html, 'Tune.html', 'text/html'), { ireal: true })).toEqual({ ok: true, text: html, kind: 'ireal' })
    expect(await readChartFile(file(html, 'Tune.html', 'text/html'))).toMatchObject({ ok: false, error: /\.txt/ })
    expect(await readChartFile(file('title: T\n'), { ireal: true })).toMatchObject({ ok: true, kind: 'chart' })
  })

  it('.htm is an export too', async () => {
    expect(await readChartFile(file('<html>', 'x.htm', 'text/html'), { ireal: true })).toMatchObject({ ok: true, kind: 'ireal' })
  })
```

- [ ] **Step 3: Failing tests for the flow**

`web/test/useOpenChart.test.ts`:
```ts
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenChart } from '~/composables/useOpenChart'
import { irealLink } from '../../engine/src/ireal/__tests__/link'
import { loadChart } from '~/utils/myCharts'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
mockNuxtImport('useFeature', () => () => true)

const BLUES = '[*AC7 |F7 |C7 |G7 Z'
const mineId = (): string => navigateTo.mock.calls.at(-1)?.[0]?.query?.mine

describe('useOpenChart with iReal', () => {
  beforeEach(() => {
    localStorage.clear()
    navigateTo.mockReset()
  })

  it('one clean song opens straight away as a new chart', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'Blues', music: BLUES }]))
    expect(navigateTo).toHaveBeenCalledOnce()
    expect(loadChart(mineId())?.text).toMatch(/^title: Blues\n/)
  })

  it('a playlist asks which song; choosing opens it', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'One', music: BLUES }, { title: 'Two', music: BLUES }], 'Set'))
    expect(o.songs.value.map((s) => s.title)).toEqual(['One', 'Two'])
    expect(o.playlist.value).toBe('Set')
    expect(navigateTo).not.toHaveBeenCalled()
    await o.choose(1)
    expect(loadChart(mineId())?.text).toMatch(/^title: Two\n/)
    expect(o.songs.value).toEqual([])
  })

  it('a song with a report waits for Open anyway; cancel leaves nothing behind', async () => {
    const o = useOpenChart()
    await o.openIReal(irealLink([{ title: 'Odd', music: '[*AC7(Db7) |F7 Z' }]))
    expect(o.report.value.map((d) => d.message)).toEqual(['A bar 1: the alternate chord Db7 is left out'])
    expect(navigateTo).not.toHaveBeenCalled()
    o.cancel()
    expect(o.report.value).toEqual([])
    await o.openIReal(irealLink([{ title: 'Odd', music: '[*AC7(Db7) |F7 Z' }]))
    await o.confirm()
    expect(loadChart(mineId())?.text).toMatch(/^title: Odd\n/)
  })

  it('a link it can’t read is an error', async () => {
    const o = useOpenChart()
    await o.openIReal('irealb://%E0%A4%A')
    expect(o.error.value).toMatch(/damaged/)
  })
})
```
If importing the engine's test helper across packages fails to resolve in the web vitest, copy `irealLink` into `web/test/irealLink.ts` (it only needs `unscramble` and `IREAL_PREFIX`; inline the swap there rather than exporting more from the engine).

- [ ] **Step 4: Run them to see them fail**

Run: `cd web && npx vitest run test/chartFile.test.ts test/useOpenChart.test.ts`
Expected: FAIL (`kind` missing; `openIReal` not a function).

- [ ] **Step 5: Implement files and flow**

`web/app/utils/chartFile.ts`: change the type and `readChartFile`:
```ts
export type ChartFileResult = Readonly<{ ok: true; text: string; kind: 'chart' | 'ireal' }> | Readonly<{ ok: false; error: string }>

const isText = (f: Pick<File, 'name' | 'type'>): boolean => /\.txt$/i.test(f.name) || f.type === 'text/plain' || f.type === ''
const isHtml = (f: Pick<File, 'name' | 'type'>): boolean => /\.html?$/i.test(f.name) || f.type === 'text/html'

/** a chart file's text, or an iReal Pro export's (when iReal import is on), or why it can't be opened */
export async function readChartFile(file: File, opts: Readonly<{ ireal?: boolean }> = {}): Promise<ChartFileResult> {
  const ireal = opts.ireal === true && isHtml(file)
  if (!isText(file) && !ireal) return { ok: false, error: opts.ireal ? 'Please open a chart saved as a .txt file, or an iReal Pro export (.html).' : 'Please open a chart saved as a .txt file.' }
  // an iReal playlist can be far bigger than a chart; the link inside is what's read
  const max = ireal ? 4_000_000 : LIMITS.maxChars * 4
  if (file.size > max) return { ok: false, error: `That file is too big for a chart (over ${LIMITS.maxChars.toLocaleString()} characters).` }
  …(unchanged reading)…
  if (!ireal && text.length > LIMITS.maxChars) return { ok: false, error: … }
  …
  return { ok: true, text, kind: ireal ? 'ireal' : 'chart' }
}
```
(Keep the existing checks' text as they are; only the size limits and the `kind` change. The NUL check applies to both.)

`web/app/composables/useOpenChart.ts`:
```ts
import { type Diagnostic, decodeIReal, type IRealSong, irealToChart } from '@chord-scale-maker/engine'

/**
 * Open chart…: a chart file becomes a new chart in My charts, then opens in the editor. With iReal import on, an
 * iReal Pro export or link does too: a playlist asks which song, and anything it couldn't map waits for Open anyway.
 */
export function useOpenChart() {
  const ireal = useFeature('ireal')
  const error = ref('')
  const busy = ref(false)
  const songs = ref<readonly IRealSong[]>([])
  const playlist = ref('')
  const report = ref<readonly Diagnostic[]>([])
  let pending = '' // the chart text waiting on Open anyway

  async function save(text: string): Promise<void> {
    const id = newChartId()
    if (!saveChart({ id, text, kind: 'new' }).ok) {
      error.value = "Couldn't open it: this browser's storage is full, or My charts is at its limit."
      return
    }
    await navigateTo({ path: '/song', query: { mine: id } })
  }

  async function choose(index: number): Promise<void> {
    const song = songs.value[index]
    if (!song) return
    songs.value = []
    const chart = irealToChart(song)
    if (chart.diagnostics.length) {
      pending = chart.value
      report.value = chart.diagnostics
      return
    }
    await save(chart.value)
  }

  async function openIReal(text: string): Promise<void> {
    error.value = ''
    const { value, diagnostics } = decodeIReal(text)
    if (!value.songs.length) {
      error.value = `Couldn't read that iReal Pro link: ${diagnostics[0]?.message ?? 'no songs in it'}.`
      return
    }
    playlist.value = value.name ?? ''
    songs.value = value.songs
    if (value.songs.length === 1) await choose(0)
  }

  async function confirm(): Promise<void> {
    const text = pending
    cancel()
    if (text) await save(text)
  }

  function cancel(): void {
    pending = ''
    report.value = []
    songs.value = []
  }

  async function open(file: File | undefined): Promise<void> {
    if (!file || busy.value) return
    busy.value = true
    error.value = ''
    try {
      const read = await readChartFile(file, { ireal })
      if (!read.ok) {
        error.value = read.error
        return
      }
      if (read.kind === 'ireal') await openIReal(read.text)
      else await save(read.text)
    } finally {
      busy.value = false
    }
  }

  return { open, openIReal, choose, confirm, cancel, error: readonly(error), busy: readonly(busy), songs: readonly(songs), playlist: readonly(playlist), report: readonly(report) }
}
```

- [ ] **Step 6: Run the flow tests to green**

Run: `cd web && npx vitest run test/chartFile.test.ts test/useOpenChart.test.ts`
Expected: PASS.

- [ ] **Step 7: Failing test for the dialog**

`web/test/IRealImportDialog.test.ts`:
```ts
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import IRealImportDialog from '~/components/IRealImportDialog.vue'

const song = (title: string) => ({ title, composer: '', style: '', key: 'C', music: '' })
const base = { open: true, songs: [], playlist: '', report: [], error: '', busy: false }
const mount = async (props: Partial<typeof base> & Record<string, unknown>) => {
  const w = await mountSuspended(IRealImportDialog, { props: { ...base, ...props }, attachTo: document.body })
  await nextTick()
  const dialog = document.querySelector('[role=dialog]') as HTMLElement
  const button = (name: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
  return { w, dialog, button }
}

describe('IRealImportDialog', () => {
  beforeEach(() => (document.body.innerHTML = ''))

  it('takes a pasted link', async () => {
    const { w, dialog, button } = await mount({})
    expect(dialog.textContent).toContain('Import from iReal Pro')
    const field = dialog.querySelector('textarea') as HTMLTextAreaElement
    field.value = 'irealb://abc'
    field.dispatchEvent(new Event('input'))
    await nextTick()
    button('Import')?.click()
    await nextTick()
    expect(w.emitted('link')?.[0]).toEqual(['irealb://abc'])
  })

  it('a playlist: pick a song by title', async () => {
    const { w, dialog, button } = await mount({ songs: [song('One'), song('Two')], playlist: 'Set' })
    expect(dialog.textContent).toContain('Set')
    const select = dialog.querySelector('select') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['One', 'Two'])
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    button('Open')?.click()
    await nextTick()
    expect(w.emitted('choose')?.[0]).toEqual([1])
  })

  it('the report lists what was left out, with Open anyway', async () => {
    const { w, dialog, button } = await mount({ report: [{ line: 1, message: 'A bar 1: the alternate chord Db7 is left out' }] })
    expect(dialog.textContent).toContain('the alternate chord Db7 is left out')
    button('Open anyway')?.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    button('Cancel')?.click()
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```
Run: `cd web && npx vitest run test/IRealImportDialog.test.ts` → FAIL (no component).

- [ ] **Step 8: The dialog**

`web/app/components/IRealImportDialog.vue` (one dialog, three steps: the report first if there is one, else the
picker if there are songs, else the link field):
```vue
<template>
  <UiDialog :open="open" size="lg" @close="emit('close')">
    <form @submit.prevent="submit">
      <UiDialogTitle>{{ report.length ? 'Some of it didn’t come across' : songs.length > 1 ? 'Choose a song' : 'Import from iReal Pro' }}</UiDialogTitle>
      <UiDialogDescription v-if="report.length">The chart opens without these. Charts are in concert pitch, as iReal Pro stores them.</UiDialogDescription>
      <UiDialogDescription v-else-if="songs.length > 1">{{ playlist || 'This playlist' }} has {{ songs.length }} songs. Import one at a time.</UiDialogDescription>
      <UiDialogDescription v-else>Paste a song or playlist link (irealb://…), copied from iReal Pro or its forums.</UiDialogDescription>
      <UiDialogBody>
        <ul v-if="report.length" class="list-disc space-y-1 pl-5 text-sm/6 text-zinc-700 dark:text-zinc-300">
          <li v-for="(d, i) in report" :key="i">{{ d.message }}</li>
        </ul>
        <UiField v-else-if="songs.length > 1">
          <UiLabel>Song</UiLabel>
          <UiSelect v-model="index" autofocus>
            <option v-for="(s, i) in songs" :key="i" :value="String(i)">{{ s.title }}</option>
          </UiSelect>
        </UiField>
        <UiField v-else>
          <UiLabel>Link</UiLabel>
          <UiTextarea v-model="text" rows="3" autofocus class="font-mono" :invalid="!!error" />
          <UiErrorMessage v-if="error">{{ error }}</UiErrorMessage>
        </UiField>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton plain @click="emit('close')">Cancel</UiButton>
        <UiButton v-if="report.length" type="submit" color="note">Open anyway</UiButton>
        <UiButton v-else-if="songs.length > 1" type="submit" color="note" :disabled="busy">Open</UiButton>
        <UiButton v-else type="submit" color="note" :disabled="busy || !text.trim()">Import</UiButton>
      </UiDialogActions>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
import type { Diagnostic, IRealSong } from '@chord-scale-maker/engine'

/** Import iReal link…: a pasted link, then the song if it's a playlist, then what didn't come across (useOpenChart) */
const props = defineProps<{ open: boolean; songs: readonly IRealSong[]; playlist: string; report: readonly Diagnostic[]; error: string; busy: boolean }>()
const emit = defineEmits<{ link: [text: string]; choose: [index: number]; confirm: []; close: [] }>()

const text = ref('')
const index = ref('0')
watch(() => props.open, (o) => o && ((text.value = ''), (index.value = '0')))
watch(() => props.songs, () => (index.value = '0'))

function submit(): void {
  if (props.report.length) emit('confirm')
  else if (props.songs.length > 1) emit('choose', Number(index.value))
  else if (text.value.trim()) emit('link', text.value.trim())
}
</script>
```
(Check `UiErrorMessage`, `UiSelect`, `UiTextarea` prop names against `web/app/components/ui/`; BarDialog uses the same ones.)

Run: `cd web && npx vitest run test/IRealImportDialog.test.ts` → PASS.

- [ ] **Step 9: Library page wiring**

In `web/app/pages/library.vue`:
- Next to Open chart…, under the flag:
  ```vue
  <UiButton v-if="ireal" outline :disabled="opener.busy.value" @click="linkOpen = true"><ArrowDownTrayIcon data-slot="icon" />Import iReal link…</UiButton>
  ```
- Open chart…'s `title` under the flag: `Open a chart saved as a .txt file, or an iReal Pro export (or drop one on this page)`.
- File input: `:accept="ireal ? '.txt,text/plain,.html,.htm,text/html' : '.txt,text/plain'"`.
- The page's error line stays where it is (the file's errors). Below it:
  ```vue
  <IRealImportDialog
    v-if="ireal"
    :open="linkOpen || opener.songs.value.length > 1 || opener.report.value.length > 0"
    :songs="opener.songs.value" :playlist="opener.playlist.value" :report="opener.report.value"
    :error="linkOpen ? opener.error.value : ''" :busy="opener.busy.value"
    @link="opener.openIReal($event)" @choose="opener.choose($event)" @confirm="linkOpen = false; opener.confirm()" @close="linkOpen = false; opener.cancel()"
  />
  ```
- Script: `const ireal = useFeature('ireal')`, `const linkOpen = ref(false)`, import `ArrowDownTrayIcon` from `@heroicons/vue/16/solid`.
- When a link opens a chart, the page navigates away, so `linkOpen` needs no reset there.
- The page-level error `<UiText v-if="opener.error.value" …>` should hide while the dialog shows it: `v-if="opener.error.value && !linkOpen"`.

- [ ] **Step 10: Help line**

`web/app/pages/help.vue`, the Open chart… item (around line 375): after "brings it back.", add (rendered only when the flag is on; the page's script gets `const ireal = useFeature('ireal')`):
```vue
<template v-if="ireal"> It also opens an iReal Pro export (.html), and <strong class="font-semibold">Import iReal link…</strong> takes a song or playlist link: the chords come across in concert pitch, and it lists anything it leaves out.</template>
```

- [ ] **Step 11: Whole suite, lint, commit**

Run: `make test` and `make lint`
Expected: PASS (`web/test/helpPage.test.ts` and `libraryPage.test.ts` may need the flag mocked; keep their existing expectations with the flag off).
```bash
git add web/nuxt.config.ts web/app/composables/useFeature.ts web/package.json web/app/utils/chartFile.ts web/app/composables/useOpenChart.ts web/app/components/IRealImportDialog.vue web/app/pages/library.vue web/app/pages/help.vue web/test/chartFile.test.ts web/test/useOpenChart.test.ts web/test/IRealImportDialog.test.ts
git commit -m "iReal import: Library opens iReal exports and links, behind the ireal flag (#261)"
```
(Add `web/test/features.test.ts` / `web/test/irealLink.ts` to the `git add` if Step 1 or Step 3 touched them.)

---

### Task 7: Paste bars takes an iReal link

**Files:**
- Modify: `web/app/components/BarDialog.vue`, `web/test/BarDialog.test.ts`

**Interfaces:**
- Consumes: `decodeIReal`, `irealBars` from the engine; `useFeature('ireal')`.
- Produces: no new emits: `submit` with `{ kind: 'paste', bars, before }` as today.

- [ ] **Step 1: Failing test**

Append to `web/test/BarDialog.test.ts` (top of file: `mockNuxtImport('useFeature', () => () => true)` with `import { mockNuxtImport } from '@nuxt/test-utils/runtime'`, and the `irealLink` helper import used in Task 6):
```ts
  it('the paste kind takes an iReal link: a song’s bars, a playlist’s song by choice, its report shown but not blocking', async () => {
    const { w, dialog, button } = await open('paste')
    const area = dialog.querySelector('textarea') as HTMLTextAreaElement
    await type(area, irealLink([{ title: 'One', music: '[*AC7 |x |F7(Gb7) Z' }, { title: 'Two', music: '[*AG7 Z' }], 'Set'))
    const select = dialog.querySelector('select') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['One', 'Two'])
    expect(dialog.textContent).toContain('3 bars')
    expect(dialog.textContent).toContain('the alternate chord Gb7 is left out')
    button('Insert after bar 2')?.click()
    await nextTick()
    expect(w.emitted('submit')?.[0]).toEqual([{ kind: 'paste', bars: [['C7'], ['C7'], ['F7']], before: false }])
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    expect(dialog.textContent).toContain('1 bar')
  })
```
Run: `cd web && npx vitest run test/BarDialog.test.ts` → FAIL.

- [ ] **Step 2: Implement**

In `BarDialog.vue` script, replace `pasted`/`canPaste`:
```ts
const ireal = useFeature('ireal')
/** an iReal Pro link in the paste field: its songs, and which one (a playlist's) */
const linked = computed(() => (ireal && /irealb(ook)?:\/\//.test(text.value) ? decodeIReal(text.value) : null))
const song = ref('0')
watch(linked, () => (song.value = '0'))
const pasted = computed(() => {
  const s = linked.value?.value.songs[Number(song.value)]
  if (linked.value && !s) return { value: [], diagnostics: linked.value.diagnostics }
  return s ? irealBars(s) : parseBarLine(text.value, props.beats)
})
/** an iReal song's report is what it left out: shown, not blocking */
const canPaste = computed(() => !!pasted.value.value.length && (!!linked.value?.value.songs.length || !pasted.value.diagnostics.length))
```
Import `decodeIReal`, `irealBars` with `parseBarLine` from `@chord-scale-maker/engine`. In the template, inside the paste `UiField`, after the textarea:
```vue
          <UiSelect v-if="linked && linked.value.songs.length > 1" v-model="song" aria-label="Song">
            <option v-for="(s, i) in linked.value.songs" :key="i" :value="String(i)">{{ s.title }}</option>
          </UiSelect>
```
And the diagnostics list: for an iReal link show the message alone (no "Line N:"), not as `role="alert"` red, but as a plain note:
```vue
        <ul v-if="kind === 'paste' && pasted.diagnostics.length" :role="linked ? undefined : 'alert'" :class="['list-disc pl-5 text-sm/6', linked ? 'text-zinc-600 dark:text-zinc-400' : 'text-red-700 dark:text-red-400']">
          <li v-for="(d, i) in pasted.diagnostics" :key="i">{{ linked ? d.message : `Line ${d.line}: ${d.message}` }}</li>
        </ul>
        <UiText v-if="kind === 'paste' && pasted.value.length && (linked || !pasted.diagnostics.length)" class="text-sm/6!">{{ pasted.value.length === 1 ? '1 bar' : `${pasted.value.length} bars` }}</UiText>
```
(the second line replaces the existing `v-else-if` bar count so the count shows beside an iReal report).
The paste field's `:invalid` becomes `!linked && !!pasted.diagnostics.length`.

- [ ] **Step 3: Green, lint, commit**

Run: `cd web && npx vitest run test/BarDialog.test.ts`, then `make test`, `make lint`
Expected: PASS; the existing paste tests still pass (flag mocked on changes nothing for non-iReal text).
```bash
git add web/app/components/BarDialog.vue web/test/BarDialog.test.ts
git commit -m "iReal import: Paste bars takes an iReal link (#261)"
```

---

### Task 8: Browser tests and accessibility

**Files:**
- Create: `web/e2e/ireal-import.spec.ts`
- Modify: `web/e2e/a11y/pages.a11y.ts` (or the a11y spec that scans dialogs; follow how BarDialog/ShareDialog are scanned there)

- [ ] **Step 1: The e2e spec**

`web/e2e/ireal-import.spec.ts`:
```ts
import { expect, test } from './fixtures'
import { irealLink } from '../../engine/src/ireal/__tests__/link'

const BLUES = '[*AT44C7 |F7 |C7 |C7 |F7 |F7 |C7 |A7 |D-7 |G7 |C7 A7 |D-7 G7 Z'
const one = irealLink([{ title: 'Blues for Test', composer: 'Doe Jane', music: BLUES }], undefined, true)
const two = irealLink([{ title: 'First', music: BLUES }, { title: 'Second', music: '[*AF^7 |x Z' }], 'Set', true)
const odd = irealLink([{ title: 'Odd One', music: '[*AC7(Db7) |F7 Z' }], undefined, true)

test('an iReal export opens from Open chart… as a new chart', async ({ page }) => {
  await page.goto('/library')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open chart…' }).click()
  await (await chooser).setFiles({ name: 'Blues.html', mimeType: 'text/html', buffer: Buffer.from(`<html><body><a href="${one}">Blues</a></body></html>`) })
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'Blues for Test', level: 1 })).toBeVisible()
})

test('a pasted playlist link asks which song, and a report waits for Open anyway', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Link').fill(two)
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByText('Set has 2 songs')).toBeVisible()
  await dialog.getByLabel('Song').selectOption({ label: 'Second' })
  await dialog.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { name: 'Second', level: 1 })).toBeVisible()

  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  await page.getByRole('dialog').getByLabel('Link').fill(odd)
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('dialog').getByText('the alternate chord Db7 is left out')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Open anyway' }).click()
  await expect(page.getByRole('heading', { name: 'Odd One', level: 1 })).toBeVisible()
})

test('a damaged link says so in the dialog', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  await page.getByRole('dialog').getByLabel('Link').fill('irealb://%E0%A4%A')
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('dialog').getByText(/damaged/)).toBeVisible()
})
```
Then a Paste bars case, set up as `web/e2e/sheet-edit.spec.ts:199` does (the starter chart: Dm7 G7 CMaj7):
```ts
test('Paste bars takes an iReal link', async ({ page }) => {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).hover()
  await page.getByRole('button', { name: 'More actions for A bar 2' }).click()
  await page.getByRole('menuitem', { name: 'Paste bars…' }).click()
  const paste = page.getByRole('dialog')
  await paste.getByLabel('Bars').fill(irealLink([{ title: 'T', music: '[*AF-7 |Bb7 |Eb^7 Z' }]))
  await expect(paste.getByText('3 bars')).toBeVisible()
  await paste.getByRole('button', { name: 'Insert after bar 2' }).click()
  await expect.poll(async () => (await page.getByLabel('Chart text').inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')).toMatch(/\n2 \| G7\n3 \| Fm7\n4 \| Bb7\n5 \| EbMaj7\n6 \| CMaj7/)
})
```
(import `openEditor` from `./fixtures` beside `expect` and `test`.)

- [ ] **Step 2: Accessibility**

In `web/e2e/a11y/pages.a11y.ts`, inside the `for (const theme …)` describe, beside the other tests:
```ts
    test('the library’s Import iReal link… dialog', async ({ page }) => {
      await page.goto('/library')
      if (theme === 'dark') await darkMode(page)
      await opens(page, page.getByRole('button', { name: 'Import iReal link…' }), page.getByRole('dialog', { name: 'Import from iReal Pro' }))
      await expectAccessible(page, '[role="dialog"]')
    })
```
`web/package.json`'s `a11y` script gets `NUXT_PUBLIC_FEATURES_IREAL=true` (Task 6 Step 1).

- [ ] **Step 3: Run**

Run: `make e2e` then `make a11y`
Expected: PASS. The fixtures fail any test on a console error or CSP violation, so the import must not fetch anything.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/ireal-import.spec.ts web/e2e/a11y/pages.a11y.ts
git commit -m "iReal import: browser and accessibility tests (#261)"
```

---

### Task 9: Finish

- [ ] **Step 1: Full verification**

Run: `make test`, `make lint`, `make e2e`, `make a11y`
Expected: all PASS. Then the CLI by hand on a real export in the scratchpad (a forum song link; print only, no `--save`), and read its report for anything the tests missed; a real miss gets a test in the owning task's file first.

- [ ] **Step 2: PR**

Push the branch and open the PR (`Closes` nothing: #261 keeps its MusicXML half; write "Part of #261"). Queue with
`gh pr merge <N> --auto --merge` only when the user says to merge.
