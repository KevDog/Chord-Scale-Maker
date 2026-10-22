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
