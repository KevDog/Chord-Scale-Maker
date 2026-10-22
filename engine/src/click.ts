/**
 * The click (#254, docs/superpowers/specs/2026-10-21-metronome-design.md): a metronome's bar patterns and tempo
 * arithmetic. Pure: the app books these events on its audio clock (web/app/composables/useClick.ts).
 */
import type { Beats } from './chart'

export type ClickFeel = 'swing' | 'straight'
export type ClickKind = 'accent' | 'beat' | 'hat' | 'sub' | 'count'
/** at: beats from the bar's start */
export type ClickEvent = Readonly<{ at: number; kind: ClickKind }>
/** subdivision: swing's skip note, or straight eighths; hat: on 2 and 4, in 4/4 only */
export type ClickOptions = Readonly<{ beats: Beats; feel: ClickFeel; subdivision: boolean; hat: boolean }>

export const CLICK_TEMPO = { min: 40, max: 300, fallback: 120 } as const

const byTime = (a: ClickEvent, b: ClickEvent): number => a.at - b.at

/** one bar's clicks: the accent on 1, a click on the other beats, then the subdivision and the hat */
export function clickBar(o: ClickOptions): readonly ClickEvent[] {
  const beats = Array.from({ length: o.beats }, (_, n) => n)
  const sub = o.feel === 'swing' ? 2 / 3 : 1 / 2
  return [
    ...beats.map((n): ClickEvent => ({ at: n, kind: n === 0 ? 'accent' : 'beat' })),
    ...(o.subdivision ? beats.map((n): ClickEvent => ({ at: n + sub, kind: 'sub' })) : []),
    ...(o.hat && o.beats === 4 ? [1, 3].map((n): ClickEvent => ({ at: n, kind: 'hat' })) : []),
  ].sort(byTime)
}

/** a count on each beat of the count-in bars; at: beats from the count-in's start */
export const countIn = (beats: Beats, bars: 0 | 1 | 2): readonly ClickEvent[] =>
  Array.from({ length: beats * bars }, (_, n): ClickEvent => ({ at: n, kind: 'count' }))

/** a whole tempo in 40–300; not a number: the fallback */
export const clampTempo = (n: number): number =>
  Number.isNaN(n) ? CLICK_TEMPO.fallback : Math.min(CLICK_TEMPO.max, Math.max(CLICK_TEMPO.min, Math.round(n)))

const has = (style: string, ...words: readonly string[]): boolean => words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(style))

/** a starting tempo from the chart's style: the first row that matches (decision click.tempo) */
export function defaultTempo(style: string): number {
  if (has(style, 'ballad')) return has(style, 'medium') ? 84 : 66
  if (has(style, 'slow')) return 72
  if (has(style, 'medium up', 'med up')) return 160
  if (has(style, 'up', 'fast')) return 220
  if (has(style, 'waltz')) return 150
  if (has(style, 'latin', 'bossa', 'samba', 'even', 'straight', 'funk', 'rock', 'blues', 'medium', 'swing')) return 132
  return CLICK_TEMPO.fallback
}

/** straight for Latin, bossa, samba, even or straight 8ths, funk and rock; else swing (decided apart from the tempo) */
export const defaultFeel = (style: string): ClickFeel => (has(style, 'latin', 'bossa', 'samba', 'even', 'straight', 'funk', 'rock') ? 'straight' : 'swing')

/** a gap longer than this starts a new tap sequence, in ms */
const TAP_RESET = 2000

/** the tempo from tap times (ms, oldest first): the mean of the last four gaps; null with fewer than two taps */
export function tapTempo(taps: readonly number[]): number | null {
  const reset = taps.findLastIndex((t, i) => i > 0 && t - (taps[i - 1] ?? t) > TAP_RESET)
  const recent = taps.slice(Math.max(reset, 0)).slice(-5)
  if (recent.length < 2) return null
  const mean = ((recent.at(-1) ?? 0) - (recent[0] ?? 0)) / (recent.length - 1)
  return clampTempo(60_000 / mean)
}

/** time: seconds on the audio clock; beat: the beat in its bar, from 0 (a count-in's too) */
export type TimedClick = Readonly<{ time: number; kind: ClickKind; beat: number }>
/** the bar being scheduled: its start, in seconds, and its number from 0 (count-in bars first) */
export type ClickState = Readonly<{ barStart: number; bar: number }>
export type ClickPlan = Readonly<{ options: ClickOptions; tempo: number; countIn: 0 | 1 | 2 }>

/**
 * the clicks to book in [from, until) on the audio clock, and the bar to carry on from. A click before `from` is
 * skipped, never booked late (a tab back from the background doesn't burst); a tempo change applies from the next
 * click, its bar's beats measured from the bar's start at the new tempo.
 */
export function scheduleClicks(plan: ClickPlan, state: ClickState, from: number, until: number): Readonly<{ events: readonly TimedClick[]; state: ClickState }> {
  const beat = 60 / plan.tempo
  const bar = clickBar(plan.options)
  const counts = countIn(plan.options.beats, 1)
  const events: TimedClick[] = []
  let { barStart, bar: n } = state
  for (;;) {
    const times = (n < plan.countIn ? counts : bar).map((e) => ({ time: barStart + e.at * beat, kind: e.kind, beat: Math.floor(e.at) }))
    events.push(...times.filter((e) => e.time >= from && e.time < until))
    if (times.some((e) => e.time >= until)) return { events, state: { barStart, bar: n } }
    barStart += plan.options.beats * beat
    n += 1
  }
}
