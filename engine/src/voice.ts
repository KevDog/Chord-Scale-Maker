/**
 * Hear line (#507, docs/superpowers/specs/2026-10-23-hear-line-design.md): the Changes sheet's Line as notes to sound,
 * booked from the click's clock (click.ts) so the two never drift. Pure: the app plays them (web/app/composables/useClick.ts).
 */
import type { ClickPlan, ClickState } from './click'
import type { GuideNote } from './guideTones'
import { type Transposition, TRANSPOSITIONS } from './instruments'

/** a drawn bar's beats and its Line's voice (a ChangesBar's) */
export type VoiceBar = Readonly<{ beats: number; voice: readonly GuideNote[] }>
/** bar: the drawn bar it starts in, from 0; at: beats from that bar's start; beats: its length, held ties and all; midi: concert pitch */
export type VoiceNote = Readonly<{ bar: number; at: number; beats: number; midi: number }>
/** time and length: seconds on the audio clock */
export type TimedNote = Readonly<{ time: number; length: number; midi: number }>

/**
 * the drawn bars' notes: rests dropped, a tied note merged into the one it ties to, at concert pitch (written less the
 * part's transposition interval; an octave transposition is ignored, as on the sheet: decision hear.pitch)
 */
export function voiceNotes(bars: readonly VoiceBar[], trans: Transposition): VoiceNote[] {
  const semis = TRANSPOSITIONS[trans][1]
  const out: VoiceNote[] = []
  let held: VoiceNote | null = null // the note a tie carries on
  bars.forEach((b, bar) => {
    for (const n of b.voice) {
      if (!n.pitch) {
        held = null
        continue
      }
      const last = out.at(-1)
      if (n.tiedIn && held && last === held) out[out.length - 1] = held = { ...held, beats: held.beats + n.beats }
      else out.push((held = { bar, at: n.beat, beats: n.beats, midi: n.pitch.midi - semis }))
      if (!n.tie) held = null
    }
  })
  return out
}

/** swing (decision hear.swing): an 8th off the beat moves two thirds through it; other times stay */
export const swingBeat = (at: number): number => (at - Math.floor(at) === 0.5 ? Math.floor(at) + 2 / 3 : at)

/**
 * the notes to book in [from, until), from the click's plan and the state it is scheduled from: bar n after the
 * count-in plays drawn bar n mod bars (the form loops). A note before from is skipped, never booked late; one starting
 * past the click's bar (a longer metre's bar) is left out.
 */
export function scheduleVoice(notes: readonly VoiceNote[], bars: number, plan: ClickPlan, state: ClickState, from: number, until: number): TimedNote[] {
  if (!notes.length || bars <= 0) return []
  const beat = 60 / plan.tempo
  const beats = plan.options.beats
  const swing = plan.options.feel === 'swing' ? swingBeat : (at: number) => at
  const out: TimedNote[] = []
  for (let barStart = state.barStart, n = state.bar; barStart < until; barStart += beats * beat, n += 1) {
    if (n < plan.countIn) continue
    const bar = (n - plan.countIn) % bars
    for (const v of notes) {
      if (v.bar !== bar || v.at >= beats) continue
      const time = barStart + swing(v.at) * beat
      if (time >= from && time < until) out.push({ time, length: (swing(v.at + v.beats) - swing(v.at)) * beat, midi: v.midi })
    }
  }
  return out
}
