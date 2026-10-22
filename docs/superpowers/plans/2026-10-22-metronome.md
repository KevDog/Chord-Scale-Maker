# The Click (metronome, #254 phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A WebAudio click on the song page (docked bar, and inside the focus bar in focus mode) that takes its metre, tempo and feel from the chart, behind the `metronome` flag.

**Architecture:** Everything that can be pure lives in `engine/src/click.ts` (bar patterns, style → tempo/feel, tap tempo, the lookahead scheduler's arithmetic) and is unit-tested there. `web/app/composables/useClick.ts` owns the one `AudioContext`, books the engine's events as oscillators, and exposes state; `web/app/components/ClickBar.vue` renders that state in two homes (`docked`, `focus`). `EditorView.vue` hosts one `useClick` and both homes.

**Tech Stack:** TypeScript strict, Vue 3 / Nuxt 4, vitest (engine: node; web: nuxt env with happy-dom), Playwright, WebAudio (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBufferSourceNode` for the noise hat), Tailwind + the Catalyst ports in `web/app/components/ui/`.

**Spec:** `docs/superpowers/specs/2026-10-21-metronome-design.md`

## Global Constraints

- `engine/` has no Vue, DOM or VexFlow imports (lint rule; its tsconfig has no DOM): `click.ts` takes numbers and returns records, never touches `AudioContext`.
- Runtime `dependencies` do not grow: no metronome or audio library.
- No CSP change: synthesis only, no samples, no third-party origin, no inline script.
- New flag `metronome` starts **off** in `web/nuxt.config.ts` `features`; e2e/a11y builds pass `NUXT_PUBLIC_FEATURES_METRONOME=true` (both `npm run e2e` and `npm run a11y` scripts in `web/package.json`).
- Public API change: `engine/src/__tests__/api.test.ts` snapshot updated on purpose (`npx vitest run -u src/__tests__/api.test.ts` in `engine/`) and its diff reviewed.
- A new heuristic is a `DECISIONS` row with a `DecisionSection` on How it decides (`web/test/docs/decisions.test.ts` fails otherwise). PR 2 touches Help and `releaseNotes.ts`; PR 1's description says `Release notes: none — engine only, nothing visible yet`.
- Tempo: whole numbers, 40–300. Unknown style: 120, swing.
- Audio is concert pitch by definition here (clicks have no pitch class); Instrument is ignored.
- `make test` (typecheck + vitest), `make lint`, and for PR 2 `make e2e` and `make a11y`, green before each PR. Commit messages end with the session's attribution lines.
- Branch per PR off `origin/main`; `gh pr merge N --auto --merge` once CI is green (project default).

## Review Focus

1. **A tempo typed out of range or blank** in the number field (`0`, `999`, `abc`, empty): the click keeps its last tempo and the field snaps back on blur; it never schedules at 0 or NaN. Test in Task 6.
2. **Start pressed twice fast, or Space held** (key repeat): one scheduler, one context; no doubled clicks. `useClick.toggle()` ignores `e.repeat`; `start()` is idempotent. Tests in Tasks 4 and 6.
3. **Tab in the background for a minute, then foregrounded**: no burst of catch-up clicks. `scheduleClicks` drops events whose time is already past `from` (they are skipped, not booked late). Test in Task 2.
4. **`time: 5/4` or `6/4` chart** (`Beats` 5 or 6): a bar of 5 or 6 lights, hat option hidden, count-in plays 5 or 6 counts. Tests in Tasks 1 and 6.
5. **Leaving the song page mid-click** (route to /library, or the chart changes under `editorKey`): sound stops, no `AudioContext` leaks, no console error. Test in Task 7 (e2e) and Task 4 (unit: `dispose()` closes).

---

## File structure

| File | Responsibility |
|---|---|
| `engine/src/click.ts` (new) | types, `clickBar`, `countIn`, `defaultTempo`, `defaultFeel`, `tapTempo`, `clampTempo`, `scheduleClicks`, `CLICK_TEMPO` |
| `engine/src/__tests__/click.test.ts` (new) | its tests |
| `engine/src/index.ts` | `export * from './click'` |
| `engine/src/decisions.ts` | row `click.tempo` |
| `web/app/pages/how-it-decides.vue` | `DecisionSection id="click.tempo"` |
| `web/app/composables/useFeature.ts`, `web/nuxt.config.ts`, `web/package.json`, `web/test/features.test.ts` | the flag |
| `web/app/utils/clickSounds.ts` (new) | `playClick(ctx, out, kind, time, sound)`: the oscillator/noise recipes; the only file that builds audio nodes |
| `web/app/composables/useClick.ts` (new) | state + the lookahead loop + lights clock; takes a `ClickAudio` factory so tests inject a fake |
| `web/app/components/ClickBar.vue` (new) | the controls in two homes |
| `web/app/components/EditorView.vue` | hosts `useClick`, the docked bar, the focus-bar home, the rail action, Space |
| `web/app/components/SheetPages.vue` | focus chrome: measured bar height instead of 60 |
| `web/app/pages/help.vue`, `web/app/utils/releaseNotes.ts` | docs |
| `web/test/click.test.ts`, `web/test/ClickBar.test.ts` (new) | web unit tests |
| `web/e2e/click.spec.ts` (new), `web/e2e/a11y/pages.a11y.ts` | browser tests |

---

## PR 1 — engine: `click.ts` + decision (Tasks 1–3)

Branch: `click-engine`. PR title: `Click: the engine's bar patterns, tempo defaults and scheduler (#254)`.

### Task 1: Bar patterns, count-in, clamp

**Files:**
- Create: `engine/src/click.ts`
- Create: `engine/src/__tests__/click.test.ts`
- Modify: `engine/src/index.ts` (add `export * from './click'` after `./metre`)
- Modify: `engine/src/__tests__/__snapshots__/api.test.ts.snap` (via `-u`)

**Interfaces:**
- Consumes: `type Beats` from `./chart`.
- Produces:
  ```ts
  export type ClickFeel = 'swing' | 'straight'
  export type ClickKind = 'accent' | 'beat' | 'hat' | 'sub' | 'count'
  export type ClickEvent = Readonly<{ at: number; kind: ClickKind }> // at: beats from the bar's start
  export type ClickOptions = Readonly<{ beats: Beats; feel: ClickFeel; subdivision: boolean; hat: boolean }>
  export const CLICK_TEMPO = { min: 40, max: 300, fallback: 120 } as const
  export function clickBar(o: ClickOptions): readonly ClickEvent[]
  export function countIn(beats: Beats, bars: 0 | 1 | 2): readonly ClickEvent[] // at: beats from the count-in's start
  export const clampTempo = (n: number): number
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { clampTempo, clickBar, countIn } from '../click'

describe('clickBar', () => {
  it('accents 1 and clicks the other beats', () => {
    expect(clickBar({ beats: 4, feel: 'swing', subdivision: false, hat: false })).toEqual([
      { at: 0, kind: 'accent' }, { at: 1, kind: 'beat' }, { at: 2, kind: 'beat' }, { at: 3, kind: 'beat' },
    ])
  })
  it('adds the swing skip note two thirds through each beat', () => {
    const subs = clickBar({ beats: 4, feel: 'swing', subdivision: true, hat: false }).filter((e) => e.kind === 'sub').map((e) => e.at)
    expect(subs).toEqual([2 / 3, 1 + 2 / 3, 2 + 2 / 3, 3 + 2 / 3])
  })
  it('adds straight eighths halfway through each beat', () => {
    const subs = clickBar({ beats: 3, feel: 'straight', subdivision: true, hat: false }).filter((e) => e.kind === 'sub').map((e) => e.at)
    expect(subs).toEqual([0.5, 1.5, 2.5])
  })
  it('puts the hat on 2 and 4 in 4/4 only, beside the beat', () => {
    const four = clickBar({ beats: 4, feel: 'swing', subdivision: false, hat: true })
    expect(four.filter((e) => e.kind === 'hat').map((e) => e.at)).toEqual([1, 3])
    expect(four.filter((e) => e.at === 1).map((e) => e.kind).sort()).toEqual(['beat', 'hat'])
    expect(clickBar({ beats: 3, feel: 'swing', subdivision: false, hat: true }).some((e) => e.kind === 'hat')).toBe(false)
  })
  it('is sorted by time', () => {
    const bar = clickBar({ beats: 4, feel: 'swing', subdivision: true, hat: true })
    expect(bar.map((e) => e.at)).toEqual([...bar.map((e) => e.at)].sort((a, b) => a - b))
  })
  it('plays 5 and 6 beats a bar', () => {
    expect(clickBar({ beats: 5, feel: 'straight', subdivision: false, hat: false })).toHaveLength(5)
    expect(clickBar({ beats: 6, feel: 'straight', subdivision: false, hat: true })).toHaveLength(6)
  })
})

describe('countIn', () => {
  it('counts each beat of the bars before the first', () => {
    expect(countIn(4, 0)).toEqual([])
    expect(countIn(3, 1)).toEqual([{ at: 0, kind: 'count' }, { at: 1, kind: 'count' }, { at: 2, kind: 'count' }])
    expect(countIn(5, 2)).toHaveLength(10)
    expect(countIn(4, 2).at(-1)).toEqual({ at: 7, kind: 'count' })
  })
})

describe('clampTempo', () => {
  it('keeps 40–300, whole', () => {
    expect([clampTempo(39.6), clampTempo(132.4), clampTempo(301), clampTempo(Number.NaN)]).toEqual([40, 132, 300, 120])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd engine && npx vitest run src/__tests__/click.test.ts`
Expected: FAIL, `Cannot find module '../click'`.

- [ ] **Step 3: Implement the types and functions above in `engine/src/click.ts`**

`clampTempo`: `NaN` → `CLICK_TEMPO.fallback`; else `Math.round` then clamp. A file header comment names the spec and #254.

- [ ] **Step 4: Export from `engine/src/index.ts`, update the API snapshot**

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && git diff src/__tests__/__snapshots__/`
Expected: the diff adds exactly `CLICK_TEMPO`, `clampTempo`, `clickBar`, `countIn` (Task 2's names come later).

- [ ] **Step 5: Run the tests**

Run: `cd engine && npx vitest run src/__tests__/click.test.ts src/__tests__/api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/src/click.ts engine/src/__tests__/click.test.ts engine/src/index.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Click: bar patterns, count-in and tempo clamp (#254)"
```

### Task 2: Style defaults, tap tempo, scheduler

**Files:**
- Modify: `engine/src/click.ts`, `engine/src/__tests__/click.test.ts`, the API snapshot

**Interfaces:**
- Produces:
  ```ts
  export function defaultTempo(style: string): number
  export function defaultFeel(style: string): ClickFeel
  export function tapTempo(taps: readonly number[]): number | null // taps: ms timestamps, oldest first
  export type TimedClick = Readonly<{ time: number; kind: ClickKind; beat: number }> // time: seconds on the audio clock; beat: 0-based beat in its bar (count-in beats too)
  export type ClickState = Readonly<{ barStart: number; bar: number }> // bar 0 is the first count-in bar or the first bar
  export type ClickPlan = Readonly<{ options: ClickOptions; tempo: number; countIn: 0 | 1 | 2 }>
  export function scheduleClicks(plan: ClickPlan, state: ClickState, from: number, until: number): Readonly<{ events: readonly TimedClick[]; state: ClickState }>
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { defaultFeel, defaultTempo, scheduleClicks, tapTempo } from '../click'

describe('defaultTempo', () => {
  it.each([
    ['Ballad', 66], ['Medium ballad', 84], ['Slow Blues', 72], ['Medium up', 160], ['Med Up Swing', 160], ['Up', 220], ['Fast', 220],
    ['Jazz waltz', 150], ['Latin', 132], ['Medium', 132], ['Medium Blues', 132], ['Even 8ths', 132], ['Medium straight eighths', 132],
    ['Mixed', 120], ['', 120],
  ])('%s → %i', (style, tempo) => expect(defaultTempo(style)).toBe(tempo))
})

describe('defaultFeel', () => {
  it.each([
    ['Medium swing', 'swing'], ['Ballad', 'swing'], ['Shuffle', 'swing'], ['Latin', 'straight'], ['Up samba', 'straight'],
    ['Medium up Latin', 'straight'], ['Medium straight eighths', 'straight'], ['Even 8ths', 'straight'], ['Medium funk ballad', 'straight'], ['', 'swing'],
  ])('%s → %s', (style, feel) => expect(defaultFeel(style)).toBe(feel))
})

describe('tapTempo', () => {
  it('needs two taps', () => expect(tapTempo([1000])).toBeNull())
  it('averages the last four gaps', () => {
    expect(tapTempo([0, 500, 1000, 1500, 2000])).toBe(120)
    expect(tapTempo([0, 10_000, 10_500, 11_000])).toBe(120) // a gap over 2 s starts a new sequence
    expect(tapTempo([0, 100_000])).toBeNull()
  })
  it('rounds and clamps', () => {
    expect(tapTempo([0, 455])).toBe(132)
    expect(tapTempo([0, 100])).toBe(300)
  })
})

describe('scheduleClicks', () => {
  const plan = { options: { beats: 4, feel: 'swing', subdivision: false, hat: false }, tempo: 120, countIn: 0 } as const
  it('books the clicks inside the window, in order', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 10, bar: 0 }, 10, 11.1)
    expect(events).toEqual([
      { time: 10, kind: 'accent', beat: 0 }, { time: 10.5, kind: 'beat', beat: 1 }, { time: 11, kind: 'beat', beat: 2 },
    ])
    expect(state).toEqual({ barStart: 10, bar: 0 })
  })
  it('rolls into the next bar and keeps counting bars', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 10, bar: 0 }, 11.6, 12.2)
    expect(events).toEqual([{ time: 12, kind: 'accent', beat: 0 }])
    expect(state).toEqual({ barStart: 12, bar: 1 })
  })
  it('skips clicks already past, without catching up', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 0, bar: 0 }, 60, 60.1)
    expect(events).toEqual([{ time: 60, kind: 'accent', beat: 0 }])
    expect(state.barStart).toBe(60)
    expect(state.bar).toBe(30)
  })
  it('plays the count-in first', () => {
    const { events } = scheduleClicks({ ...plan, countIn: 1 }, { barStart: 0, bar: 0 }, 0, 2.1)
    expect(events.map((e) => e.kind)).toEqual(['count', 'count', 'count', 'count', 'accent'])
    expect(events.map((e) => e.beat)).toEqual([0, 1, 2, 3, 0])
  })
  it('a tempo change applies from the next click', () => {
    const slow = scheduleClicks({ ...plan, tempo: 60 }, { barStart: 10, bar: 0 }, 10.6, 11.1)
    expect(slow.events).toEqual([{ time: 11, kind: 'beat', beat: 1 }])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd engine && npx vitest run src/__tests__/click.test.ts`
Expected: FAIL, the new names are not exported.

- [ ] **Step 3: Implement**

`defaultTempo`: the spec's rows in order on the lower-cased style (`includes`); `'ballad'` with `'medium'` → 84 before `'ballad'` → 66; `'slow'` → 72; `'medium up'` or `'med up'` → 160; `'up'`/`'fast'` → 220; `'waltz'` → 150; any of `latin bossa samba even straight funk rock blues medium swing` → 132; else 120.
`defaultFeel`: `'straight'` if the style contains any of `latin bossa samba even straight funk rock`, else `'swing'`.
`tapTempo`: cut the list at the last gap > 2000 ms; keep the last five taps (four gaps); fewer than two → null; `clampTempo(60_000 / meanGap)`.
`scheduleClicks`: the bar's events are `countIn(...)` while `state.bar < plan.countIn`, else `clickBar(plan.options)`; a beat lasts `60 / tempo` s; walk bars from `state` while `barStart < until`, emitting events with `time >= from`; advance `state` to the first bar whose start is `>= from` or that still has unemitted events (so `bar` counts bars even when skipped). `beat` is `Math.floor(at)`.

- [ ] **Step 4: Update the API snapshot and run the engine tests**

Run: `cd engine && npx vitest run -u src/__tests__/api.test.ts && npx vitest run`
Expected: PASS; the snapshot diff adds `defaultFeel`, `defaultTempo`, `scheduleClicks`, `tapTempo`.

- [ ] **Step 5: Commit**

```bash
git add engine/src/click.ts engine/src/__tests__/click.test.ts engine/src/__tests__/__snapshots__/api.test.ts.snap
git commit -m "Click: style defaults, tap tempo and the lookahead scheduler (#254)"
```

### Task 3: The `click.tempo` decision

**Files:**
- Modify: `engine/src/decisions.ts` (a row after `spell.chord`)
- Modify: `web/app/pages/how-it-decides.vue` (a `DecisionSection` at the end of "The other lines", or a new `UiSubheading id="click"` "The click" before the page's closing)
- Test: `web/test/docs/decisions.test.ts` (existing: fails until the anchor exists)

- [ ] **Step 1: Add the row**

```ts
{ id: 'click.tempo', title: 'The click’s tempo and feel', page: 'how-it-decides', anchor: 'click.tempo', summary: 'The click starts at a tempo and a feel read from the chart’s style: a ballad at 66, medium at 132, up at 220; Latin, bossa and even 8ths straight, the rest swing.' },
```

- [ ] **Step 2: Run the anchor test to see it fail**

Run: `cd web && npx vitest run test/docs/decisions.test.ts`
Expected: FAIL, `click.tempo: #click.tempo on /how-it-decides` expected length 1, got 0.

- [ ] **Step 3: Write the section**

A `UiSubheading id="click"` "The click" with `<DecisionSection id="click.tempo">`: two `UiText` paragraphs in the page's voice: the table as prose (first match wins, `Medium up` before `medium`; the exact tempos 66, 84, 72, 160, 220, 150, 132, 120), feel decided on its own (the straight words), that the tempo is a starting point the chart remembers over, and that the chart's main metre plays throughout (a metre change waits for the click to follow the form).

- [ ] **Step 4: Run the docs tests and typecheck**

Run: `cd web && npx vitest run test/docs && cd .. && make test`
Expected: PASS.

- [ ] **Step 5: Commit, push, open PR 1**

```bash
git add engine/src/decisions.ts web/app/pages/how-it-decides.vue
git commit -m "Click: the tempo and feel decision (#254)"
git push -u origin click-engine
gh pr create --title "Click: the engine's bar patterns, tempo defaults and scheduler (#254)" --body "<what and why; Spec: docs/superpowers/specs/2026-10-21-metronome-design.md; Release notes: none — engine only, nothing visible yet; the attribution lines>"
gh pr merge --auto --merge
```

---

## PR 2 — the bar, both homes, the flag (Tasks 4–8)

Branch: `click-bar`, from `origin/main` after PR 1 merges. PR title: `Click: a metronome on the song page, behind the metronome flag (#254)`.

### Task 4: `useClick` composable with injected audio

**Files:**
- Create: `web/app/utils/clickSounds.ts`
- Create: `web/app/composables/useClick.ts`
- Create: `web/test/click.test.ts`

**Interfaces:**
- Consumes: `clickBar`, `countIn`, `scheduleClicks`, `tapTempo`, `clampTempo`, `defaultTempo`, `defaultFeel`, `CLICK_TEMPO`, types from `@chord-scale-maker/engine`; `readStored`/`writeStored` from `~/utils/storage`.
- Produces:
  ```ts
  // utils/clickSounds.ts
  export type ClickSound = 'wood' | 'beep'
  export type ClickAudio = Readonly<{
    now: () => number                                   // AudioContext.currentTime
    play: (kind: ClickKind, time: number, sound: ClickSound) => void
    resume: () => Promise<void>; suspend: () => Promise<void>; close: () => Promise<void>
  }>
  export function webAudio(): ClickAudio | null       // null when AudioContext is missing or throws
  export function playClick(ctx: AudioContext, out: GainNode, kind: ClickKind, time: number, sound: ClickSound): void

  // composables/useClick.ts
  export type ClickSettings = Readonly<{ subdivision: boolean; hat: boolean; countIn: 0 | 1 | 2; sound: ClickSound }>
  export const LOOKAHEAD = { interval: 25, ahead: 0.1, hiddenAhead: 1.2 } as const // ms, s, s
  export function useClick(chart: Ref<{ beats: Beats; style: string; metreChanges: boolean }>, storageKey: Ref<string | undefined>, deps?: { audio?: () => ClickAudio | null; setInterval?, clearInterval?, raf? }): {
    shown: Ref<boolean>; running: Ref<boolean>; unavailable: Ref<boolean>
    tempo: Ref<number>; feel: Ref<ClickFeel>; settings: Ref<ClickSettings>
    beat: Ref<number | null>; counting: Ref<boolean>          // the beat lit now (0-based), and whether it is a count-in beat
    start(): Promise<void>; stop(): void; toggle(e?: KeyboardEvent): void; tap(): void; show(): void; hide(): void; dispose(): void
  }
  ```
  `hide()` stops first; `show()` never starts. `shown` is per visit, not stored.
  The component never sees `AudioContext`; tests pass a fake `audio` with a settable clock and a recorded `play` list.

- [ ] **Step 1: Write the failing tests** (`web/test/click.test.ts`, nuxt env)

```ts
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { LOOKAHEAD, useClick } from '~/composables/useClick'
import type { ClickAudio } from '~/utils/clickSounds'

function fakeAudio(): ClickAudio & { clock: { t: number }; played: { kind: string; time: number }[] } {
  const clock = { t: 0 }
  const played: { kind: string; time: number }[] = []
  return { clock, played, now: () => clock.t, play: (kind, time) => played.push({ kind, time }), resume: async () => {}, suspend: async () => {}, close: async () => {} }
}
const chart = () => ref({ beats: 4 as const, style: 'Medium up', metreChanges: false })
const timers = () => {
  let tick: (() => void) | null = null
  return { setInterval: (fn: () => void) => ((tick = fn), 1), clearInterval: () => (tick = null), raf: () => 0, tick: () => tick?.() }
}

describe('useClick', () => {
  it('starts at the style’s tempo and feel, remembers them per chart', () => {
    localStorage.clear()
    const c = useClick(chart(), ref('autumn-leaves'), { audio: fakeAudio })
    expect([c.tempo.value, c.feel.value]).toEqual([160, 'swing'])
    c.tempo.value = 140
    c.feel.value = 'straight'
    const again = useClick(chart(), ref('autumn-leaves'), { audio: fakeAudio })
    expect([again.tempo.value, again.feel.value]).toEqual([140, 'straight'])
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).tempo.value).toBe(160) // a draft: not remembered
  })
  it('books the clicks ahead of the clock, once each', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    await c.start()
    expect(c.running.value).toBe(true)
    t.tick()
    expect(audio.played.map((p) => p.kind)).toEqual(['accent']) // 160 bpm: the next beat is 0.375 s away, past the 0.1 s lookahead
    audio.clock.t = 0.3
    t.tick()
    expect(audio.played).toHaveLength(2)
    await c.start() // idempotent
    t.tick()
    expect(audio.played).toHaveLength(2)
  })
  it('plays the count-in first and lights it', async () => {
    const audio = fakeAudio()
    const t = timers()
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t })
    c.settings.value = { ...c.settings.value, countIn: 1 }
    await c.start()
    t.tick()
    expect(audio.played[0]?.kind).toBe('count')
    expect(c.counting.value).toBe(true)
  })
  it('stop suspends and clears the beat; dispose closes', async () => {
    const audio = fakeAudio()
    const suspend = vi.spyOn(audio, 'suspend')
    const close = vi.spyOn(audio, 'close')
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...timers() })
    await c.start()
    c.stop()
    expect(suspend).toHaveBeenCalled()
    expect([c.running.value, c.beat.value]).toEqual([false, null])
    c.dispose()
    expect(close).toHaveBeenCalled()
  })
  it('toggle ignores key repeat; tap sets the tempo', async () => {
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio, ...timers() })
    c.toggle(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    expect(c.running.value).toBe(false)
    vi.useFakeTimers()
    for (const ms of [0, 500, 1000]) { vi.setSystemTime(ms); c.tap() }
    expect(c.tempo.value).toBe(120)
    vi.useRealTimers()
  })
  it('is unavailable without WebAudio', async () => {
    const c = useClick(chart(), ref(undefined), { audio: () => null, ...timers() })
    await c.start()
    expect([c.running.value, c.unavailable.value]).toEqual([false, true])
  })
  it('settings persist in this browser', () => {
    localStorage.clear()
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio })
    c.settings.value = { subdivision: true, hat: true, countIn: 2, sound: 'beep' }
    expect(useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value).toEqual({ subdivision: true, hat: true, countIn: 2, sound: 'beep' })
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd web && npx vitest run test/click.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `clickSounds.ts`**

`playClick`: Wood: `OscillatorNode` type `triangle`, frequency 1800 (`accent`), 1200 (`beat`, `count`, `sub`); Beep: `sine`, 1320 / 880. Envelope on a per-click `GainNode`: peak 1 (`accent`), 0.8 (`beat`, `count`), 0.3 (`sub`), exponential ramp to 0.001 over 0.06 s, `stop(time + 0.08)`. `hat`: a 30 ms `AudioBuffer` of white noise through a `BiquadFilterNode` highpass 6000 Hz, gain 0.4. All nodes connect to `out`. `webAudio()`: `new AudioContext()` in a try/catch → `null`; one master `GainNode` at 0.8 to `destination`.

- [ ] **Step 4: Implement `useClick.ts`**

Storage keys: `csm-click` (JSON `ClickSettings`), `csm-click:<storageKey>` (JSON `{ tempo, feel }`), read with `readStored`, written on change. `tempo`/`feel` reload when `storageKey` or `chart.style` changes and nothing is stored. `start()`: if `running` return; `audio ??= deps.audio()`; null → `unavailable = true`; `await resume()`; `state = { barStart: now(), bar: 0 }`; interval of `LOOKAHEAD.interval` ms calls `scheduleClicks(plan, state, lastUntil, now() + (document.hidden ? hiddenAhead : ahead))` and `audio.play`s each; keeps the booked `TimedClick`s for the lights; `raf` loop sets `beat`/`counting` from the latest booked click whose `time <= now()`. `plan` is a computed from `tempo`, `feel`, `settings`, `chart.beats`. `stop()`: clear interval and raf, `suspend()`, `running = false`, `beat = null`. `toggle(e)`: return if `e?.repeat`; running ? stop : start. `tap()`: push `Date.now()`, `tapTempo(taps)` → `tempo` when not null. `dispose()`: stop, `close()`.

- [ ] **Step 5: Run the tests**

Run: `cd web && npx vitest run test/click.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/utils/clickSounds.ts web/app/composables/useClick.ts web/test/click.test.ts
git commit -m "Click: the useClick scheduler and synthesized sounds (#254)"
```

### Task 5: The flag

**Files:**
- Modify: `web/app/composables/useFeature.ts` (add `'metronome'` to `Feature`), `web/nuxt.config.ts` (`metronome: false, // the click on the song page (#254; docs/superpowers/specs/2026-10-21-metronome-design.md)`), `web/package.json` (`NUXT_PUBLIC_FEATURES_METRONOME=true` in both `e2e` and `a11y`), `web/test/features.test.ts` (the expected object gains `metronome: false`; the title names #254).

- [ ] **Step 1: Update the features test's expectation, run it to see it fail**

Run: `cd web && npx vitest run test/features.test.ts`
Expected: FAIL (missing `metronome`).

- [ ] **Step 2: Add the flag in the three files; run again**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/app/composables/useFeature.ts web/nuxt.config.ts web/package.json web/test/features.test.ts
git commit -m "Click: the metronome feature flag, off (#254)"
```

### Task 6: `ClickBar.vue`

**Files:**
- Create: `web/app/components/ClickBar.vue`
- Create: `web/test/ClickBar.test.ts`

**Interfaces:**
- Props: `home: 'docked' | 'focus'`, `click: ReturnType<typeof useClick>`, `chart: { beats: Beats; style: string; metreChanges: boolean }`.
- Emits: `hide` (docked ✕).
- Markup contract (the tests and e2e rely on these names): root `role="toolbar" aria-label="Click"`; buttons `Start`/`Stop` (`aria-pressed`), `Slower` (−), `Faster` (+), `Tap the tempo`, `Click settings` (⋯, `RailPopover` label), `Hide the click` (✕, docked only); `UiInput type="number" aria-label="Tempo" min=40 max=300`; `SegmentedControl legend="Feel"` options `Swing`/`Straight`; `data-testid="click-lights"` with one `<i>` per beat, `data-on` on the lit one, `data-count` while counting, `aria-hidden="true"`; metre text `4/4 · Medium up` with ` · metre changes play the main metre` appended when `metreChanges`. Settings popover: `SegmentedControl legend="Count-in"` (`Off`/`1 bar`/`2 bars`), `UiCheckbox` "Skip note" (swing) / "Eighths" (straight), `UiCheckbox` "Hat on 2 & 4" (only when `beats === 4`), `SegmentedControl legend="Sound"` (`Wood`/`Beep`).
- Both homes `flex flex-wrap items-center gap-2` (a phone wraps to two rows, the metre text last so it drops first). Docked: `fixed inset-x-0 bottom-0 z-30 px-4 py-2 print:hidden bg-raised shadow-raised`, measures its own height into `--click-h` on `documentElement` (a `ResizeObserver`, removed on unmount, like `SheetRail`). Focus: no positioning, no ✕.

- [ ] **Step 1: Write the failing tests** (`web/test/ClickBar.test.ts`, `mountSuspended`, a `useClick` built on the fake audio from Task 4's test, extracted to `web/test/clickFakes.ts`)

```ts
it('names its controls and lights a beat', async () => {
  const click = useClick(ref(chart4), ref(undefined), { audio: fakeAudio, ...timers() })
  const w = await mountSuspended(ClickBar, { props: { home: 'docked', click, chart: chart4 } })
  expect(w.find('[role=toolbar][aria-label=Click]').exists()).toBe(true)
  for (const name of ['Start', 'Slower', 'Faster', 'Tap the tempo', 'Click settings', 'Hide the click']) expect(w.find(`button[aria-label="${name}"], button:has-text("${name}")`).exists(), name).toBe(true)
  expect(w.findAll('[data-testid=click-lights] i')).toHaveLength(4)
  click.beat.value = 1
  await nextTick()
  expect(w.findAll('[data-testid=click-lights] i')[1]!.attributes('data-on')).toBeDefined()
})
it('steps and clamps the tempo; a bad entry snaps back', async () => {
  // Faster → 161; type 999 then blur → 300; type "" then blur → 300 (unchanged); type "abc" → unchanged
})
it('hides the hat option outside 4/4 and names the subdivision for the feel', async () => {
  // beats 3: no "Hat on 2 & 4"; feel straight: checkbox labelled "Eighths"; swing: "Skip note"
})
it('in focus has no ✕ and no positioning', async () => {
  // home 'focus': no "Hide the click"; root class lacks 'fixed'
})
it('notes metre changes', async () => {
  // metreChanges true: text contains 'metre changes play the main metre'
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd web && npx vitest run test/ClickBar.test.ts`
Expected: FAIL, component missing.

- [ ] **Step 3: Implement `ClickBar.vue` to the contract above**

Compose: `UiButton` for Start/Stop, −, +, Tap, ✕ (icons from `@heroicons/vue/16/solid`: `PlayIcon`/`StopIcon`, `MinusIcon`, `PlusIcon`, `XMarkIcon`); `UiInput` for the tempo (on `change`: `clampTempo(Number(value))`, `NaN` → keep); `SegmentedControl` for Feel, Count-in, Sound; `UiCheckbox` for the two toggles; `RailPopover` for ⋯. Lights: `<span data-testid="click-lights" aria-hidden="true">` with `<i>` per beat (`size-3 rounded-full bg-zinc-300 data-on:bg-zinc-950 dark:…`, the first `size-3.5`, `data-count:bg-amber-500`).

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run test/ClickBar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/ClickBar.vue web/test/ClickBar.test.ts web/test/clickFakes.ts
git commit -m "Click: the ClickBar in its docked and focus homes (#254)"
```

### Task 7: Host it in `EditorView`, the rail action, Space, focus chrome

**Files:**
- Modify: `web/app/components/EditorView.vue` (the `#actions` template near line 160; the focus bar near line 90; `onPageKeydown` near line 576; script setup near `useFocusMode`)
- Modify: `web/app/components/SheetPages.vue:66-74` (chrome)
- Modify: `web/test/EditorView.test.ts` (one new `describe`)
- Create: `web/e2e/click.spec.ts`
- Modify: `web/e2e/a11y/pages.a11y.ts`

**Interfaces:**
- `EditorView`: `const metronomeOn = useFeature('metronome')`; `const clickChart = computed(() => ({ beats: chartBeats(currentDoc.value), style: chartDetails(currentDoc.value).style, metreChanges: barView.sections.some((s) => s.bars.some((b) => b.time)) }))` (use the existing `BarView` the sheet already builds, or `barView(currentDoc.value)` if none is at hand); `const click = useClick(clickChart, computed(() => props.practiceKey))`; `onBeforeUnmount(click.dispose)`.
- `SheetPages`: `provide`/`inject` key `FOCUS_BAR_HEIGHT` (`Ref<number>`) from `EditorView`, measured on `focusBar` with a `ResizeObserver`; `room.height = window.innerHeight - (FOCUS_CHROME - 60) - focusBarHeight` (keep the constant's other parts, 76).

- [ ] **Step 1: Write the failing unit test** (in `web/test/EditorView.test.ts`, with `mockNuxtImport('useFeature', () => () => true)` in that describe)

```ts
describe('the click (#254)', () => {
  it('shows the docked bar from the rail action and toggles with Space', async () => {
    const w = await mountSuspended(EditorView, { props: { initialText: autumnLeaves } })
    expect(w.find('[role=toolbar][aria-label=Click]').exists()).toBe(false)
    await w.find('button[aria-label="Click"], button:has-text("Click")').trigger('click')
    expect(w.find('[role=toolbar][aria-label=Click]').exists()).toBe(true)
    // Space from the page (not a control) starts it: the Start button reads pressed (fake audio: vi.mock('~/utils/clickSounds') so webAudio() returns the fake)
    await w.trigger('keydown', { key: ' ' })
    expect(w.find('[role=toolbar] button[aria-pressed=true]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to see it fail; then implement**

Rail action (inside `<template v-if="place === 'rail'">`, before Print): `<ToggleButton v-if="metronomeOn && !editor.fatal.value" :model-value="click.shown.value" title="A click to practise with (Space starts and stops it)" @update:model-value="$event ? click.show() : click.hide()"><MusicalNoteIcon data-slot="icon" />Click</ToggleButton>`.
Docked home (after the Preview section, inside the component root): `<ClickBar v-if="metronomeOn && click.shown.value && !focus.on.value" home="docked" :click :chart="clickChart" @hide="click.hide()" />`; the page gets `style="padding-bottom: var(--click-h, 0px)"` on the component's root while shown.
Focus home: in the focus bar `div` (line 90) change `justify-end` to `justify-between gap-3`; first child: `<ClickBar v-if="metronomeOn && click.shown.value" home="focus" … />`, else `<UiButton v-if="metronomeOn" outline @click="click.show()"><MusicalNoteIcon data-slot="icon" />Click</UiButton>`; the Exit button stays last.
Space: in `onPageKeydown`, after the input guard: `if (e.key === ' ' && click.shown.value && !(t && (t.closest('button, a, [role=button], [role=radio], [role=checkbox]')))) { e.preventDefault(); click.toggle(e); return }`.
`SheetPages`: inject `FOCUS_BAR_HEIGHT` (default `ref(60)`), use it in `measure`; re-measure when it changes.

- [ ] **Step 3: Write the e2e** (`web/e2e/click.spec.ts`)

```ts
test('the click opens from the rail, runs, and follows into focus mode', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await page.getByRole('button', { name: 'Click', exact: true }).click()
  const bar = page.getByRole('toolbar', { name: 'Click' })
  await expect(bar).toBeVisible()
  await expect(bar.getByLabel('Tempo')).toHaveValue('132') // style: Medium → 132
  await bar.getByRole('button', { name: 'Start' }).click()
  await expect(bar.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true')
  await expect(bar.locator('[data-testid=click-lights] i[data-on]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Focus' }).click()
  await expect(page.getByRole('dialog', { name: 'Focus mode' }).getByRole('toolbar', { name: 'Click' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true') // still running
  await page.keyboard.press('Escape')
  await page.keyboard.press(' ')
  await expect(bar.getByRole('button', { name: 'Start' })).toBeVisible() // Space stopped it
  await page.goto('/library') // leaving stops it with no console error (the fixture fails on one)
})
test('the focus pages fit above and below the focus bar with the click in it', async ({ page }) => {
  // open click, enter focus, read the first page's bounding box: bottom <= viewport height - 32 and top >= focus bar's bottom + 16
})
```

- [ ] **Step 4: Add the a11y scans** (in `pages.a11y.ts`, inside the theme loop): a song with the click bar open and its ⋯ popover open (`expectAccessible(page)` then `expectAccessible(page, '[role=dialog][aria-label="Click settings"]')`), and focus mode with the click shown.

- [ ] **Step 5: Run everything**

Run: `make test && make lint && make e2e && make a11y`
Expected: all PASS. (Port 4174 is shared across worktrees: on `ECONNREFUSED`, rerun with a temporary alternate `PORT`.)

- [ ] **Step 6: Commit**

```bash
git add web/app/components/EditorView.vue web/app/components/SheetPages.vue web/test/EditorView.test.ts web/e2e/click.spec.ts web/e2e/a11y/pages.a11y.ts
git commit -m "Click: on the song page and in focus mode, Space to start and stop (#254)"
```

### Task 8: Help, release notes, `.gitignore`, PR 2

**Files:**
- Modify: `web/app/pages/help.vue` ("The controls" `dl`: a new `<div>` with `<dt>Click</dt>`; "Back up and restore": a clause that the click's tempo per chart isn't included)
- Modify: `web/app/utils/releaseNotes.ts` (today's date block: `{ text: 'A click to practise with, on the song page and in focus mode: Click in the sheet’s controls shows it, set to the chart’s metre and a tempo and feel from its style; Space starts and stops it; a count-in, the swing skip note and a hat on 2 and 4 are under its settings.', pr: <PR 2's number> }`)
- Modify: `.gitignore` (add `.superpowers/`)
- Test: `web/test/docs/help.test.ts` and `web/test/helpPage.test.ts` (existing; run them)

- [ ] **Step 1: Write the Help entry**

`<dt>Click</dt>`, `<dd>`: shows the bar at the bottom (in focus mode, in the top bar), the chart's metre, tempo and feel from its style (`DecisionLink id="click.tempo"`), Space starts and stops, Tap the tempo, Count-in, Skip note / Eighths, Hat on 2 & 4, Wood or Beep; the chart remembers its tempo; a chart with metre changes plays its main metre for now; on iPhone and iPad the sound stops when the screen locks.

- [ ] **Step 2: Add the release note, the `.gitignore` line; run the docs tests**

Run: `cd web && npx vitest run test/docs test/helpPage.test.ts && cd .. && make test && make lint`
Expected: PASS.

- [ ] **Step 3: Commit, push, PR**

```bash
git add web/app/pages/help.vue web/app/utils/releaseNotes.ts .gitignore
git commit -m "Click: Help and release notes (#254)"
git push -u origin click-bar
gh pr create --title "Click: a metronome on the song page, behind the metronome flag (#254)" --body "<what and why; Spec; Docs: Help 'The controls' + how-it-decides click.tempo; Release notes: the item; the attribution lines>"
gh pr merge --auto --merge
```

Then set the release note's `pr` to the PR's number in a follow-up commit on the branch.

---

## PR 3 — flag on (Task 9)

Branch: `click-on`. Needs a device check first (the owner, or a Playwright run under `devices['iPhone 14']` + `devices['Pixel 7']` for the layout; sound itself is checked by hand on an iPhone and an Android phone: Start on a tap, background tab for a minute, screen lock).

### Task 9: Turn it on

**Files:**
- Modify: `web/nuxt.config.ts` (`metronome: true`), `web/test/features.test.ts` (`metronome: true`, the title lists it as on)

- [ ] **Step 1: Update the features test, see it fail, flip the flag, see it pass**

Run: `cd web && npx vitest run test/features.test.ts`

- [ ] **Step 2: Anything the device check found**: each fix with its test, its own commit.

- [ ] **Step 3: Commit, push, PR**

```bash
git add web/nuxt.config.ts web/test/features.test.ts
git commit -m "Click: flag on (#254)"
git push -u origin click-on
gh pr create --title "Click: turn the metronome flag on (#254)" --body "<device check results; Docs: none — the flag; Release notes: none — PR 2 carried the item; attribution>"
gh pr merge --auto --merge
```

After merge: comment on #254 with what shipped and what phase 2 (follow the form) still holds, and update `docs/design.md` with a one-paragraph "The click" section pointing at the spec.
