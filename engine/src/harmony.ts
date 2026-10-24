/**
 * Hear changes (#508): the chart's harmony as a piano and a bass to sound under the click, from the Changes sheet's
 * bars (concert pitch, so a transposed chart is heard in its new key). Pure: the app plays them (useClick), booked as
 * Hear line's notes are (voice.ts scheduleVoice). Decision hear.harmony.
 *
 * The piano plays rootless voicings (after Levine, The Jazz Piano Book, ch. 4): the 3rd and 7th with two of the 5th,
 * 9th, 11th and 13th, in form A (from the 3rd) or form B (from the 7th), the tensions as the chord's scale at the
 * sheet's level has them (Advanced's altered scale: ♭9 and ♭13; Lydian: ♯11 for the 5th). Each chord takes the form
 * and octave nearest the one before, its lowest note C3 to C♯4. The bass plays roots, or roots and 5ths in two.
 */
import type { Beats } from './chart'
import { isRest, parseChord } from './chord'
import { mod, pcOf } from './pitch'
import { CHORD_TONES, defaultScaleOrNull, readChord } from './qualities'
import { parseScale, SCALES, spellFrom } from './scales'
import type { VoiceNote } from './voice'

/** a drawn bar's beats and chords (a ChangesBar's): text concert, concertScale the scale the sheet plays */
export type HarmonyBar = Readonly<{ beats: Beats | number; chords: readonly Readonly<{ beat: number; text: string; concertScale: string | null }>[] }>
export type BassStyle = 'roots' | 'two'

/** a degree's semitones above the root: "b3" 3, "#5" 8, "bb7" 9 */
function degreeSemis(degree: string): number {
  const m = /^([b#]*)(\d+)$/.exec(degree)
  if (!m) return 0
  const n = Number(m[2])
  const base = [0, 2, 4, 5, 7, 9, 11][(n - 1) % 7] ?? 0
  return base + [...(m[1] ?? '')].reduce((s, c) => s + (c === '#' ? 1 : -1), 0)
}

/** the chord's reading and its tones as semitones above its root; null for N.C. or a chord that can't be read */
function chordOf(text: string) {
  if (isRest(text)) return null
  const r = readChord(text)
  const tones = r && CHORD_TONES[r.quality]
  if (!r || !tones) return null
  const semis = tones.map(degreeSemis)
  const pick = (from: readonly number[]) => semis.find((s) => from.includes(s)) ?? null
  return { root: pcOf(r.root), third: pick([3, 4, 5]), fifth: pick([6, 7, 8]), seventh: pick([9, 10, 11]), sixth: tones.includes('6'), tones: semis }
}

/** the scale's notes as semitones above the chord's root (pitch classes); empty when it can't be read */
function scaleSemis(scale: string | null, root: number): ReadonlySet<number> {
  if (!scale) return new Set()
  try {
    const s = parseScale(scale)
    const at = pcOf(s.root)
    return new Set(spellFrom(s.root, SCALES[s.key][0]).map((n) => mod(at + n.semis - root, 12)))
  } catch {
    return new Set()
  }
}

/** a voicing's four tones above the root, form A (from the 3rd or its stand-in) */
function formA(c: NonNullable<ReturnType<typeof chordOf>>, has: (s: number) => boolean): readonly number[] {
  const first = (prefs: readonly number[], otherwise: number) => prefs.find(has) ?? otherwise
  const { third, fifth, seventh } = c
  if (third === 4 && seventh === 10) return [4, first([9, 8], 9), 10, first([2, 1, 3], 2)] // dominant: 3 13 7 9
  if (third === 5 && seventh === 10) return [5, 7, 10, first([2, 1], 2)] // sus: 4 5 7 9
  if (third === 4 && seventh === 11) return [4, fifth === 8 ? 8 : has(6) ? 6 : 7, 11, first([2], 0)] // major 7th: 3 5 (♯11) 7 9
  if (third === 3 && fifth === 6 && seventh === 10) return [3, 6, 10, first([2], 5)] // half-diminished: ♭3 ♭5 ♭7 9 (or 11)
  if (third === 3 && seventh === 10) return [3, 7, 10, first([2], 5)] // minor 7th: ♭3 5 ♭7 9 (or 11)
  if (third === 3 && seventh === 9 && fifth === 6) return [3, 6, 9, first([2], 0)] // diminished 7th: ♭3 ♭5 𝄫7 9
  if (third !== null && (c.sixth || seventh === 11)) return [third, 7, c.sixth ? 9 : 11, first([2], 0)] // 6, m6, m(maj7): 3 5 6 9
  if (third !== null && fifth !== null) return [third, fifth, third === 4 && fifth === 7 && has(9) ? 9 : 0, first([2], 0)] // a triad: 3 5 6 9 where the scale allows
  return c.tones
}

/**
 * a chord's rootless voicing as pitch classes, form A then form B (its upper pair under its lower), from the scale the
 * sheet plays (its quality's default where it has none); null for N.C. or a chord that can't be read
 */
export function voicingForms(chord: string, scale: string | null): readonly (readonly number[])[] | null {
  const c = chordOf(chord)
  if (!c) return null
  const semis = scaleSemis(scale ?? defaultScaleOrNull(chord), c.root)
  const a = [...new Set(formA(c, (s) => semis.has(s)).map((s) => mod(c.root + s, 12)))]
  const half = Math.ceil(a.length / 2)
  return [a, [...a.slice(half), ...a.slice(0, half)]]
}

/** the piano's range (decision hear.harmony): its lowest note from C3 to C♯4, its top no higher than G5 */
const PIANO = { lo: 48, hi: 61, top: 79, centre: 59 } as const
/** the bass's range, E1 to C3, and where it centres */
const BASS = { lo: 28, hi: 48, centre: 38 } as const

/** pitch classes stacked upward from bottom */
function stack(pcs: readonly number[], bottom: number): number[] {
  const out = [bottom]
  for (const pc of pcs.slice(1)) {
    const prev = out.at(-1)!
    out.push(prev + mod(pc - prev, 12) || prev + 12)
  }
  return out
}

/** each chord's span: the bar it sounds in, from at for beats; a bar with no chord holds the last one again */
type Span = Readonly<{ bar: number; at: number; beats: number; text: string; scale: string | null }>
function spans(bars: readonly HarmonyBar[]): Span[] {
  const out: Span[] = []
  let last: Readonly<{ text: string; scale: string | null }> | null = null
  bars.forEach((b, bar) => {
    if (!b.chords.length) {
      if (last) out.push({ bar, at: 0, beats: b.beats, ...last })
      return
    }
    b.chords.forEach((c, k) => {
      const end = b.chords[k + 1]?.beat ?? b.beats
      last = { text: c.text, scale: c.concertScale }
      out.push({ bar, at: c.beat, beats: end - c.beat, ...last })
    })
  })
  return out
}

const motion = (a: readonly number[], b: readonly number[]): number =>
  a.length === b.length ? a.reduce((s, m, i) => s + Math.abs(m - b[i]!), 0) : Math.abs(a.reduce((s, m) => s + m, 0) / a.length - b.reduce((s, m) => s + m, 0) / b.length) * a.length
const mean = (a: readonly number[]): number => a.reduce((s, m) => s + m, 0) / a.length

/** the piano's voicings, each chord struck at its start (and again each bar it's held through), held to the next */
export function pianoNotes(bars: readonly HarmonyBar[]): VoiceNote[] {
  let prev: readonly number[] | null = null
  return spans(bars).flatMap((s) => {
    const forms = voicingForms(s.text, s.scale)
    if (!forms) return []
    const options = forms.flatMap((pcs) =>
      Array.from({ length: PIANO.hi - PIANO.lo + 1 }, (_, i) => PIANO.lo + i)
        .filter((m) => mod(m, 12) === pcs[0])
        .map((m) => stack(pcs, m))
        .filter((v) => v.at(-1)! <= PIANO.top),
    )
    const cost = (v: readonly number[]) => (prev ? motion(v, prev) : 0) + Math.abs(mean(v) - PIANO.centre) * (prev ? 0.25 : 1)
    const best = options.reduce((x, y) => (cost(y) < cost(x) ? y : x))
    prev = best
    return best.map((midi) => ({ bar: s.bar, at: s.at, beats: s.beats, midi }))
  })
}

/** the bass note's pitch class: a slash chord's bass, else its root */
function bassPc(text: string): number | null {
  const c = chordOf(text)
  if (!c) return null
  const bass = parseChord(text).bass
  return bass ? pcOf(bass) : c.root
}

/** the bass: each chord's root (a slash chord's bass) at its start, held; Two-feel (an even metre): the root and the 5th below on alternate halves */
export function bassNotes(bars: readonly HarmonyBar[], style: BassStyle): VoiceNote[] {
  let prev: number = BASS.centre
  return spans(bars).flatMap((s) => {
    const pc = bassPc(s.text)
    if (pc === null) return []
    const options = Array.from({ length: BASS.hi - BASS.lo + 1 }, (_, i) => BASS.lo + i).filter((m) => mod(m, 12) === pc)
    const cost = (m: number) => Math.abs(m - prev) + 0.5 * Math.abs(m - BASS.centre)
    const root = options.reduce((x, y) => (cost(y) < cost(x) ? y : x))
    prev = root
    const c = chordOf(s.text)!
    const slash = !!parseChord(s.text).bass
    const halves = style === 'two' && bars[s.bar]!.beats % 2 === 0 && s.beats >= 4 && !slash
    if (!halves) return [{ bar: s.bar, at: s.at, beats: s.beats, midi: root }]
    const fifth = root - (12 - (c.fifth ?? 7)) >= BASS.lo ? root - (12 - (c.fifth ?? 7)) : root + (c.fifth ?? 7)
    return Array.from({ length: Math.floor(s.beats / 2) }, (_, i) => ({ bar: s.bar, at: s.at + 2 * i, beats: i === Math.floor(s.beats / 2) - 1 ? s.beats - 2 * i : 2, midi: i % 2 ? fifth : root }))
  })
}
