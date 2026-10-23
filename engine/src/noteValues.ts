/**
 * Note values and accidentals for a line's voice on the Changes sheet: the lengths a note can be drawn at, and the
 * measure rule over a bar. A leaf module (types only from guideTones), so guideTones and arpeggios both import it
 * without importing each other at runtime.
 */
import type { GuideNote } from './guideTones'
import { accidentalsInBar, octaveOf } from './keySignature'

/** the lengths a note can be drawn at, in beats: up to a dotted whole (6/4, #234) */
export type NoteBeats = 0.25 | 0.5 | 1 | 2 | 3 | 4 | 6
const NOTE_BEATS: readonly NoteBeats[] = [6, 4, 3, 2, 1, 0.5, 0.25]
/** a length as notes that can be drawn, tied: 5 beats as 3 + 2, 7 as 4 + 3 (the 5/4 and 7/4 bars' groupings), else the longest first */
export function drawnLengths(length: number): NoteBeats[] {
  if (length <= 0) return []
  const one = NOTE_BEATS.find((b) => b === length)
  if (one) return [one]
  if (length === 5) return [3, 2]
  if (length === 7) return [4, 3]
  const first = NOTE_BEATS.find((b) => b < length) ?? 0.25
  return [first, ...drawnLengths(length - first)]
}

/** one bar's voice with its accidentals: the measure rule (accidentalsInBar) over its notes, rests left as they are */
export function voiceAccidentals(voice: readonly GuideNote[], keySig: string | null): GuideNote[] {
  const pitched = voice.flatMap((n, i) => (n.pitch ? [{ i, n, pitch: n.pitch }] : []))
  const accs = accidentalsInBar(
    pitched.map(({ n, pitch }) => ({ letter: pitch.letter, acc: pitch.acc, octave: octaveOf(pitch), tiedIn: n.tiedIn })),
    keySig,
  )
  const out = [...voice]
  pitched.forEach(({ i, n }, k) => {
    out[i] = { ...n, accidental: accs[k] ?? null }
  })
  return out
}
