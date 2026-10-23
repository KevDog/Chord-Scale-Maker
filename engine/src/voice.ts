/**
 * Hear line (#507, docs/superpowers/specs/2026-10-23-hear-line-design.md): the Changes sheet's Line as notes to sound,
 * booked from the click's clock (click.ts) so the two never drift. Pure: the app plays them (web/app/composables/useClick.ts).
 */
import type { ClickFeel, ClickPlan, ClickState } from './click'
import type { GuideNote } from './guideTones'
import { CLEF_ROOT_LOW, type Transposition, TRANSPOSITIONS } from './instruments'
import type { Part, Pitched } from './part'
import { mod, pcOf, type Spelled } from './pitch'
import type { RhythmNote } from './rhythm'

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

/** a staff's Play (#507, part 2): at and beats from the phrase's start, midi at concert pitch */
export type PhraseNote = Readonly<{ at: number; beats: number; midi: number }>

/** concert midis in 8ths, the last a quarter */
const eighths = (midis: readonly number[]): PhraseNote[] => midis.map((midi, i) => ({ at: i / 2, beats: i === midis.length - 1 ? 1 : 0.5, midi }))
const concert = (notes: readonly Pitched[], trans: Transposition): number[] => notes.map((n) => n.midi - TRANSPOSITIONS[trans][1])

/** a Scales staff up and down, the top once; with Practice on (selected), its selected notes alone */
export function scalePhrase(notes: readonly Pitched[], selected: readonly boolean[] | null, trans: Transposition): PhraseNote[] {
  const up = concert(selected ? notes.filter((_, i) => selected[i]) : notes, trans)
  return eighths([...up, ...up.slice(0, -1).reverse()])
}

const MINOR_PENT = [0, 3, 5, 7, 10, 12] as const

/** a pentatonic ladder's rung (#507, part 3): its minor pentatonic up to the octave and back, the root where a Scales staff's root-mode root sits */
export function pentatonicPhrase(root: Spelled, part: Part): PhraseNote[] {
  const low = CLEF_ROOT_LOW[part.clef]
  const p0 = low + mod(pcOf(root) - low, 12) - TRANSPOSITIONS[part.trans][1]
  const up = MINOR_PENT.map((s) => p0 + s)
  return eighths([...up, ...up.slice(0, -1).reverse()])
}

/** an Arpeggio staff's notes as drawn; Block: each beamed group one chord, a quarter each */
export function arpeggioPhrase(notes: readonly Pitched[], groups: readonly number[], block: boolean, trans: Transposition): PhraseNote[] {
  const midis = concert(notes, trans)
  if (!block) return eighths(midis)
  let start = 0
  return groups.flatMap((g, i) => midis.slice(start, (start += g)).map((midi) => ({ at: i, beats: 1, midi })))
}

/** the phrase on the audio clock from start (s), swung as Hear line swings (decision hear.swing) */
export function timePhrase(phrase: readonly PhraseNote[], tempo: number, feel: ClickFeel, start: number): TimedNote[] {
  const beat = 60 / tempo
  const swing = feel === 'swing' ? swingBeat : (at: number) => at
  return phrase.map((n) => ({ time: start + swing(n.at) * beat, length: (swing(n.at + n.beats) - swing(n.at)) * beat, midi: n.midi }))
}

/** each bar the click plays in [barStart, until) past the count-in: its start (s) and the drawn bar it plays (the form loops) */
function* eachBar(bars: number, plan: ClickPlan, state: ClickState, until: number): Generator<Readonly<{ start: number; bar: number }>> {
  const length = (plan.options.beats * 60) / plan.tempo
  for (let start = state.barStart, n = state.bar; start < until; start += length, n += 1) if (n >= plan.countIn) yield { start, bar: (n - plan.countIn) % bars }
}

const swingOf = (plan: ClickPlan) => (plan.options.feel === 'swing' ? swingBeat : (at: number) => at)

/**
 * the notes to book in [from, until), from the click's plan and the state it is scheduled from: bar n after the
 * count-in plays drawn bar n mod bars (the form loops). A note before from is skipped, never booked late; one starting
 * past the click's bar (a longer metre's bar) is left out.
 */
export function scheduleVoice(notes: readonly VoiceNote[], bars: number, plan: ClickPlan, state: ClickState, from: number, until: number): TimedNote[] {
  if (!notes.length || bars <= 0) return []
  const beat = 60 / plan.tempo
  const swing = swingOf(plan)
  const out: TimedNote[] = []
  for (const { start, bar } of eachBar(bars, plan, state, until))
    for (const v of notes) {
      if (v.bar !== bar || v.at >= plan.options.beats) continue
      const time = start + swing(v.at) * beat
      if (time >= from && time < until) out.push({ time, length: (swing(v.at + v.beats) - swing(v.at)) * beat, midi: v.midi })
    }
  return out
}

/** a drawn bar's rhythm line and its Line's voice (a ChangesBar's) */
export type RhythmBar = Readonly<{ beats: number; rhythm: readonly RhythmNote[]; voice: readonly GuideNote[] }>
/** a rhythm attack to tap: bar, the drawn bar from 0; at, beats from its start */
export type RhythmHit = Readonly<{ bar: number; at: number; accent: boolean }>
/** time: seconds on the audio clock */
export type TimedHit = Readonly<{ time: number; accent: boolean }>

/**
 * the rhythm's attacks as drawn (decision hear.rhythm): the rhythm line's with the Line off, else the poured Line's;
 * a rest or a tied note strikes nothing. None where no rhythm is drawn (a guide line without Restate)
 */
export function rhythmHits(bars: readonly RhythmBar[]): RhythmHit[] {
  const line = bars.some((b) => b.rhythm.length)
  return bars.flatMap((b, bar) =>
    line
      ? b.rhythm.filter((n) => !n.rest && !n.tiedIn).map((n) => ({ bar, at: n.beat, accent: n.accent }))
      : b.voice.filter((n) => n.mark && n.pitch && !n.tiedIn).map((n) => ({ bar, at: n.beat, accent: !!n.mark?.accent })),
  )
}

/** the hits to book in [from, until), as scheduleVoice books the Line's notes */
export function scheduleRhythm(hits: readonly RhythmHit[], bars: number, plan: ClickPlan, state: ClickState, from: number, until: number): TimedHit[] {
  if (!hits.length || bars <= 0) return []
  const beat = 60 / plan.tempo
  const swing = swingOf(plan)
  const out: TimedHit[] = []
  for (const { start, bar } of eachBar(bars, plan, state, until))
    for (const h of hits) {
      if (h.bar !== bar || h.at >= plan.options.beats) continue
      const time = start + swing(h.at) * beat
      if (time >= from && time < until) out.push({ time, accent: h.accent })
    }
  return out
}
