/**
 * The click (#254, docs/superpowers/specs/2026-10-21-metronome-design.md): a metronome's bar patterns and tempo
 * arithmetic. Pure: the app books these events on its audio clock (web/app/composables/useClick.ts).
 */
import type { Beats } from './chart'
import type { Feel } from './rhythm/feel'

/** quarters: the beats alone; swing: the skip note two thirds through each beat; straight: eighths halfway */
export type ClickFeel = 'quarters' | 'swing' | 'straight'
/** tick: a silent beat, for the lights, where a pattern leaves it out */
export type ClickKind = 'accent' | 'beat' | 'hat' | 'sub' | 'count' | 'tick'
/** at: beats from the bar's start */
export type ClickEvent = Readonly<{ at: number; kind: ClickKind }>

/** Click on (Bergonzi 31): every beat, 2 and 4, 1 and 3, 3 only, 4 only, or the and of 2 and 4 */
export type ClickPattern = 'all' | '2-4' | '1-3' | '3' | '4' | 'and-2-4'
export const CLICK_PATTERNS: readonly ClickPattern[] = ['all', '2-4', '1-3', '3', '4', 'and-2-4']
/** each pattern's beats, from 0; and: on the beat's 8th after it */
const PATTERN_BEATS: Readonly<Record<Exclude<ClickPattern, 'all'>, Readonly<{ beats: readonly number[]; and: boolean }>>> = {
  '2-4': { beats: [1, 3], and: false },
  '1-3': { beats: [0, 2], and: false },
  '3': { beats: [2], and: false },
  '4': { beats: [3], and: false },
  'and-2-4': { beats: [1, 3], and: true },
}

/** a bar of `beats` has every beat the pattern clicks on */
export const patternFits = (p: ClickPattern, beats: number): boolean => p === 'all' || PATTERN_BEATS[p].beats.every((b) => b < beats)

/** the Feel's click (decision click.pattern): every beat in 4, the hat's 2 and 4 in 2, 4 alone in 1 */
export const defaultPattern = (feel: Feel): ClickPattern => (feel === 4 ? 'all' : feel === 2 ? '2-4' : '4')

/** hat: on 2 and 4, in 4/4 only; pattern: every beat when left out */
export type ClickOptions = Readonly<{ beats: Beats; feel: ClickFeel; hat: boolean; pattern?: ClickPattern }>

export const CLICK_TEMPO = { min: 40, max: 300, fallback: 120 } as const

const byTime = (a: ClickEvent, b: ClickEvent): number => a.at - b.at

const onBeat = (n: number): ClickEvent => ({ at: n, kind: n === 0 ? 'accent' : 'beat' })

/**
 * one bar's clicks: the accent on 1, a click on the other beats, then the feel's note between them and the hat. A
 * pattern clicks its beats alone, with a silent tick on every beat and no notes between them; a bar too short for
 * it plays every beat.
 */
export function clickBar(o: ClickOptions): readonly ClickEvent[] {
  const beats = Array.from({ length: o.beats }, (_, n) => n)
  const sub = o.feel === 'swing' ? 2 / 3 : o.feel === 'straight' ? 1 / 2 : null
  const pattern = o.pattern ?? 'all'
  const hat = o.hat && o.beats === 4 ? [1, 3].map((n): ClickEvent => ({ at: n, kind: 'hat' })) : []
  if (pattern === 'all' || !patternFits(pattern, o.beats))
    return [...beats.map(onBeat), ...(sub === null ? [] : beats.map((n): ClickEvent => ({ at: n + sub, kind: 'sub' }))), ...hat].sort(byTime)
  const p = PATTERN_BEATS[pattern]
  const clicks = p.and ? p.beats.map((n): ClickEvent => ({ at: n + (sub ?? 1 / 2), kind: 'beat' })) : p.beats.map(onBeat)
  return [...beats.map((n): ClickEvent => ({ at: n, kind: 'tick' })), ...clicks, ...hat].sort(byTime)
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
