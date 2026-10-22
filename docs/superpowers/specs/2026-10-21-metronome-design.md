# The click: a metronome on the song page (#254, phase 1)

Reopens #254, scoped down from #317 (metronome + playback): a plain, Polybeat-like click without polyrhythms, so a
player practising a tune from the sheet never switches apps. #317 (playback) and #481 (MIDI export) come later and
reuse this spec's audio groundwork.

## Intent

The owner's moment: **practising a tune from the sheet, no app switching.** Today the sheet is on one screen and the
metronome on another device or app. The click lives on the song page, stays reachable while the sheet scrolls, takes
its time signature and a sensible tempo from the chart, and gets out of the way.

Phase 1 is **plain timekeeping**: it does not know where in the form you are. Following the form (bar and section on
screen, a cursor on the sheet, looping a section) is phase 2, in #254's thread.

## Goals

1. **One tap to a tune-appropriate click.** `♩ Click` in the sheet's rail shows the bar, already set to the chart's
   metre, a tempo and a feel from its `style:`. Start plays.
2. **Reachable mid-practice.** The bar is docked to the bottom of the window and stays while the sheet scrolls. What a
   player touches between choruses is on it: start/stop, tempo, feel, beat lights. Space starts and stops.
3. **Jazz-aware without being clever.** Swing feel (the ride's skip note), an optional hat on 2 & 4, a count-in.
4. **Within the site's rules.** WebAudio synthesis only: no samples, no third-party origins, no CSP change; works
   offline; nothing leaves the browser.

## Non-goals (phase 2 or never)

- Following the form, section loops, drop-out bars, tempo ramps (phase 2, #254).
- Polyrhythms, odd groupings, tempo trainer modes (Polybeat does these; not this app's job).
- Metre changes mid-chart (`@time`, a section's `time:`): phase 1 plays the chart's main metre throughout. A chart with
  changes gets a note on the bar. Form-following makes them possible.
- Playing the chords or scales (#317), drums (#481).
- A metronome anywhere but the song page.

## Anti-goals

- A click that drifts or stutters: scheduling on `setTimeout` alone, or a scheduler that stops when the tab is in the
  background. The schedule runs on the AudioContext clock with a lookahead.
- Audio samples in the bundle or fetched from anywhere: synthesis only.
- A control that hides the music: the bar is one row tall on a laptop, never covers the staff it sits under (the page
  gets bottom padding while the bar is shown), and prints as nothing.
- Sound before a gesture (autoplay policies), or sound that continues after leaving the song page.

## Design

### The engine part (pure, `engine/src/click.ts`)

Everything that can be tested without a browser lives here.

- `ClickFeel = 'swing' | 'straight'`; `Subdivision = 'off' | 'on'` (in swing: the skip note, a triplet eighth before
  each beat; in straight: even eighths); `ClickKind = 'accent' | 'beat' | 'hat' | 'sub' | 'count'`.
- `ClickOptions = { beats: Beats; feel: ClickFeel; subdivision: Subdivision; hat: boolean }` (`Beats` from `chart.ts`).
- `clickBar(options): readonly ClickEvent[]`: one bar's events, `{ at: number; kind: ClickKind }` with `at` in beats
  from the bar's start. Beat 1 is `accent`, other beats `beat`. `hat` on beats 2 and 4 when `hat` and `beats === 4`
  (in other metres the option is hidden and ignored). `sub` at the swing skip (`n + 2/3`) or the straight eighth
  (`n + 1/2`), when `subdivision` is on. Events sorted by `at`; a `hat` and a `beat` at the same time are both kept.
- `countIn(beats, bars: 0 | 1 | 2): readonly ClickEvent[]`: `count` events on each beat of the count-in bars, before
  the first bar.
- `defaultTempo(style: string): number` and `defaultFeel(style: string): ClickFeel`: each a word match on the chart's
  `style:`, case-insensitive, decided **independently** (`DECISIONS` row `click.tempo`, below). Unknown or empty:
  120, swing.
- `tapTempo(taps: readonly number[]): number | null`: the tempo from the last four tap times (ms); null with fewer
  than two taps or a gap over 2 s (a new tap sequence starts).
- `clampTempo(n)`: 40–300, whole numbers.
- `scheduleClicks(from: number, until: number, state): { events: readonly TimedClick[]; state }`: the pure heart of
  the scheduler. Given a bar pattern, a tempo and the time the current bar started, returns every click whose time is
  in `[from, until)` as `{ time: number; kind }` in seconds, and the next state (next bar's start). Tempo changes take
  effect at the next event, not the next bar (the player hears the change at once).

**Tempo** (first matching row wins: `Medium up` before `medium`, `Slow Blues` before `blues`):

| `style:` contains | tempo |
|---|---|
| `ballad` with `medium` | 84 |
| `ballad` | 66 |
| `slow` | 72 |
| `medium up`, `med up` | 160 |
| `up`, `fast` | 220 |
| `waltz` | 150 |
| `latin`, `bossa`, `samba`, `even`, `straight`, `funk`, `rock`, `blues`, `medium`, `swing` | 132 |
| anything else | 120 |

**Feel**: `straight` when the style contains any of `latin`, `bossa`, `samba`, `even`, `straight`, `funk`, `rock`
(`Up samba`, `Medium up Latin`, `Medium straight eighths` all play straight); `swing` otherwise (`shuffle` included).

The tempo is a starting point: the player sets the tempo they want and the chart remembers it.

### The browser part

`web/app/composables/useClick.ts`: the scheduler, one per song page.

- The `AudioContext` is created (or resumed) inside the Start gesture handler, never before: iOS and Chrome autoplay
  rules. A failure to create it shows "Sound isn't available in this browser" in the bar.
- Lookahead scheduling (Chris Wilson's two clocks): a `setInterval` every 25 ms calls `scheduleClicks` for the window
  `[now, now + 0.1 s)` and books each click as an oscillator with an envelope at its exact `time`. A background tab
  slows the interval to ~1 s; the lookahead grows to 1.2 s while `document.hidden`, so the click never gaps.
- Sounds, all synthesized: two sets, **Wood** (short triangle-wave tick with a fast exponential decay: accent 1800 Hz,
  beat 1200 Hz, sub 1200 Hz at a third the gain) and **Beep** (sine: accent 1320 Hz, beat 880 Hz). `hat` is a 30 ms
  burst of white noise through a high-pass filter in both. `count` sounds like `beat`. Output through one `GainNode`
  so a volume control can come later.
- Beat lights: a `requestAnimationFrame` loop compares the booked click times with `currentTime` and lights the beat
  that is sounding (and the count-in). Lights are decorative (`aria-hidden`); the Start button's `aria-pressed` is the
  accessible state.
- Stops: Stop, ✕, leaving the song page (`onBeforeUnmount`), and opening another chart. Suspends the context when
  stopped so the browser shows no "playing" indicator.
- Settings: `subdivision`, `hat`, `countIn`, `sound` are remembered in this browser (`csm-click`, `storedRef`).
  `tempo` and `feel` are remembered **per chart** only, under the key `source.practiceKey` gives (a library slug or
  `mine:<id>`; a draft or a share link has none and keeps them for the visit), so a tune opens at the tempo you last
  practised it at. Precedence: the chart's stored value, else `defaultTempo` / `defaultFeel` from its `style:`. There
  is no browser-wide feel. The per-chart keys stay out of Back up… (#466) in phase 1: `backup.ts`'s allowlist is
  unchanged, and the Help's backup paragraph says the click's tempo isn't included.

`web/app/components/ClickBar.vue`: the docked bar (mockup A).

```
[■ Stop]  [−] 132 [+]  Tap   [Swing | Straight]   4/4 · Medium up    ● ○ ○ ○   [⋯] [✕]
```

- `position: fixed; bottom: 0`, full width, `print:hidden`, raised surface (`bg-raised shadow-raised`, like the
  stuck rail), `role="toolbar" aria-label="Click"`. While shown, the page's content gets `padding-bottom` equal to
  the bar's height (`--click-h`, set like `--rail-h` in `SheetRail.vue`), so the last staff is never under it.
- Controls, left to right: Start/Stop (`UiButton`, `aria-pressed`, label "Start" / "Stop"); tempo − / number / +
  (the number is a `UiInput type="number"` 40–300, `aria-label="Tempo"`; − and + step 1, with the arrow keys in the
  field stepping 1 and Shift+arrow 5); **Tap** (a `UiButton`: tap the beat four times); Feel as a
  `SegmentedControl` (Swing · Straight); the chart's metre and style as text (plus "metre changes play the main
  metre" when the chart has any); the beat lights (one per beat; the accent larger; a count-in lights them amber);
  ⋯ (a `RailPopover`, label "Click settings": Count-in Off · 1 bar · 2 bars, Subdivision off · on (named "Skip note"
  in swing, "Eighths" in straight), Hat on 2 & 4 (4/4 only), Sound Wood · Beep); ✕ (label "Hide the click", stops).
- Phones: the bar wraps to two rows (Start, tempo, Tap, lights on the first; Feel, text, ⋯, ✕ on the second); the
  `rounded-paper` corners drop. From `sm` it is one row.
- The rail's `♩ Click` action (`UiButton`, `aria-pressed`, in `PreviewControls`'s `actions` slot, behind the flag)
  toggles the bar. Showing the bar does not start it; Start does.
- Space toggles Start/Stop when the bar is shown and the key's target is not an input, textarea, select, button, link
  or contenteditable (so a focused button still activates with Space on its own). Goes through `onPageKeydown` in
  `EditorView.vue`, the page's existing key handler, in and out of focus mode.

### Focus mode (mockup A of the second screen)

Focus mode is the practising moment, so the click is there too. Its overlay (`EditorView.vue`, the `fixed inset-0
z-50` section) already has a sticky top bar holding **Exit focus**; the click controls join that bar, on its left,
Exit staying at the right. The same `ClickBar` component renders in both homes with a `home: 'docked' | 'focus'` prop:
docked at the bottom on the normal page, inline in the focus bar in focus mode; no ✕ in focus (Exit leaves focus, the
click keeps running), and the metre/style text drops first when the row is short. The click's shown/running state is
one `useClick` instance in `EditorView`, so entering or leaving focus changes nothing audible.

- `SheetPages.vue` fits pages to `window.innerHeight - FOCUS_CHROME` (136, a constant). The focus bar now varies in
  height (two rows on a phone), so its height is measured (`ResizeObserver`, like `SheetRail`'s `--rail-h`) and
  replaces the constant's 60 for the bar; the other margins stay.
- Phones in focus: the focus bar wraps to two rows (Start, tempo, lights, Exit on the first; Feel, Tap, ⋯ on the
  second).
- The rail's `♩ Click` toggle is hidden in focus with the rail. If the click wasn't shown before entering focus, the
  focus bar shows a single `♩ Click` button at its left that shows the controls (in focus only; it stays shown after
  exit).

### Feature flag

`metronome` in `nuxt.config.ts` `features` and `useFeature.ts`, off. Turned on in a follow-up PR after a device check
(iOS Safari, Android Chrome, desktop Safari/Chrome/Firefox: start on a gesture, background tab, screen lock).

### Docs

- Help, "The controls": a **Click** paragraph (what it does, Space, that it plays the chart's main metre, that iOS stops
  sound when the screen locks); the Help page's install line mentions it works offline.
- `DECISIONS`: `click.tempo` ("Default tempo and feel", how-it-decides): the table above in prose.
- Release notes item: "A click on the song page".

## Build order (each its own PR, TDD)

1. **Engine**: `click.ts` (`clickBar`, `countIn`, `defaultTempo`, `defaultFeel`, `tapTempo`, `clampTempo`,
   `scheduleClicks`), exported from `index.ts` (the API snapshot updates); `DECISIONS` row and its how-it-decides
   section. No user-facing change yet: `Release notes: none`.
2. **Bar**: `useClick.ts`, `ClickBar.vue` (both homes), the rail action, the focus bar's measured height, the flag,
   Space, Help paragraph, release notes item; unit tests for `useClick` with a fake `AudioContext` and a fake clock
   (what gets booked when); e2e: the bar opens, Start presses, Space toggles, lights move, the bar is in focus mode and
   the pages still fit (a flag-on build), axe on the open bar, its ⋯ popover and the focus bar.
3. **Flag on**, after the device check, with any fixes it found.

## Decided

- Placement A, the docked bottom bar (owner, from the mockups), over a floating pill (B) and a rail popover (C).
- In focus mode the click joins the focus bar at the top (owner, from the second mockups), over a bottom dock there.
- Plain timekeeping in phase 1; following the form later (owner).
- Synthesis only, no samples (site rules).
- The main metre only; metre changes wait for form-following (ours: without knowing the bar, a change can't be placed).
- Tempo and feel per chart (chart → style, no browser-wide feel); the rarer settings per browser; neither per-chart
  key in backups for now (ours, after the builder check).
- Feel is decided independently of tempo, and `straight` counts as a straight style (ours, after the builder check:
  `Up samba` and `Medium straight eighths` would otherwise swing).
- Swing's subdivision is the skip note, straight's the even eighth; one switch, named for the feel (ours).
- Hat on 2 & 4 in 4/4 only (ours: in 3/4 there is no standard answer worth a control).
- The style → tempo table (ours, a heuristic: hence the `DECISIONS` row). Tempo is a starting point the chart remembers
  over.

## Left to the builder

- Exact oscillator envelopes and gains; the lights' colours within the theme tokens; the number field's look next to
  − and + (Catalyst has no stepper; compose one from `UiButton` and `UiInput`).
- Whether `scheduleClicks`'s state is a class or a plain record, as long as it is pure and tested.
- The per-chart storage key's exact form (built on `source.practiceKey`, as `usePractice` does).
- How `ClickBar` lays out its two homes (one template with the prop, or two thin wrappers over shared parts).
- How the `--click-h` padding is applied (body or the page's main element), matching how `--rail-h` is done.
