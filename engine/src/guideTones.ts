import { isRest, parseChord, writtenChordRootLenient } from './chord'
import { type Part, type Pitched, rangeOf } from './part'
import { accidentalsInBar, octaveOf } from './keySignature'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'
import { guideToneLine } from './guideToneLines'
import type { Candidate, GuideTones } from './voiceLeading'

/**
 * Guide tones on the Changes sheet: one guide tone line (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md,
 * as amended by 2026-10-10-independent-guide-tone-lines-design.md and 2026-10-11-guide-lines-diverge-note.md: line A
 * from the first chord's 3rd or line B from its 7th, moving to the nearer guide tone of the next chord, the two going
 * apart where they meet) as one voice, a note a chord
 * (docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md), split at barlines, with accidentals by the
 * measure rule. No DOM, like sheet.ts. The timeline (guideToneTimeline.ts) and the lines (guideToneLines.ts) live in
 * their own modules.
 */

/** canonical quality -> the degrees that stand for its "3rd" and "7th" */
const TONES: Readonly<Record<string, readonly [string, string]>> = {
  maj: ['3', '1'], // a triad has no 7th: its root resolves by step from a V7 (B -> C, F# -> G), its 5th would leap
  m: ['b3', '1'],
  Maj7: ['3', '7'],
  'Maj7#11': ['3', '7'],
  'Maj7#5': ['3', '7'],
  '6': ['3', '6'],
  m7: ['b3', 'b7'],
  m6: ['b3', '6'],
  mMaj7: ['b3', '7'],
  '7': ['3', 'b7'],
  '7sus4': ['4', 'b7'],
  '7sus4b9': ['4', 'b7'],
  '7b9': ['3', 'b7'],
  '7b13': ['3', 'b7'],
  '7b9b13': ['3', 'b7'],
  '7#11': ['3', 'b7'],
  '7alt': ['3', 'b7'],
  m7b5: ['b3', 'b7'],
  dim7: ['b3', 'bb7'],
}

/** the degrees standing for a quality's "3rd" and "7th" (canonical or extended symbol), or null if unknown */
export const guideToneDegrees = (quality: string): readonly [string, string] | null => TONES[baseQuality(quality) ?? ''] ?? null

/**
 * a chord's two guide tones, spelled from its written root; null if the chord or its quality is unknown.
 * Extended symbols count as their base quality (Maj7#11 as Maj7).
 */
export function guideTonesFor(part: Part, chord: string, scale?: string): GuideTones | null {
  try {
    const degrees = TONES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    const [third, seventh] = spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' '))
    if (!third || !seventh) return null
    return { third: { note: third, label: degrees[0] }, seventh: { note: seventh, label: degrees[1] } }
  } catch {
    return null
  }
}

/** the guide tone line the Changes sheet shows, at most one: none, line A (from the 3rd) or line B (from the 7th) */
export type GuideLine = 'off' | 'third' | 'seventh'

/** one note (or rest) of a guide tone voice, within a bar */
export type GuideNote = Readonly<{
  /** null: a rest */
  pitch: Pitched | null
  /** where it starts in the bar, from 0 */
  beat: number
  beats: 0.25 | 0.5 | 1 | 2 | 3 | 4
  /** tied into this voice's next note (in the next bar, which may be on the next line) */
  tie: boolean
  /** continues the previous note: no accidental, no label */
  tiedIn: boolean
  /** '#', 'b', 'n', '##', 'bb' or null: the measure rule, against the key signature (none: C) */
  accidental: string | null
}>

/** a degree as the label row prints it: the real degree without its flat or sharp (b3 -> 3, bb7 -> 7) */
export const guideLabel = (degree: string): string => degree.replace(/^[b#]+/, '')

/**
 * a chord to voice: row is the caller's index for its labels; start and beats are in beats from 0; block: where it is
 * drawn (a section, an ending), as a number that changes between blocks: a repeated chord is held only within one
 */
export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number; block?: number }>

/**
 * split [start, start + length) at barlines into notes, tying a held pitch across them (a rest is split untied);
 * accidentals are left for voiceAccidentals
 */
export function notesFor(c: Candidate | null, start: number, length: number, beats: number): { bar: number; note: GuideNote }[] {
  const out: { bar: number; note: GuideNote }[] = []
  const pitch = c?.pitch ?? null
  const end = start + length
  let at = start
  while (at < end) {
    const bar = Math.floor(at / beats)
    const len = Math.min(end, (bar + 1) * beats) - at
    out.push({
      bar,
      note: { pitch, beat: at - bar * beats, beats: len as 1 | 2 | 3 | 4, tie: !!pitch && at + len < end, tiedIn: !!pitch && at > start, accidental: null },
    })
    at += len
  }
  return out
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

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/**
 * the guide tone line's voice for chords in time order: by timeline bar (Math.floor(start / beats)), the bar's
 * notes; by row, the chord's label (no entry for a rest); and a diagnostic for each chord without guide tones. The
 * line is one of the pair guideToneLine builds together (so they can go apart where they meet). A chord that repeats the guide tones in the same block is tied from the
 * one before; a chord without guide tones rests. keySig: the signature in force on every line (null: C). Nothing
 * when the line is 'off'.
 */
export function guideVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  line: GuideLine,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; labels: ReadonlyMap<number, string>; missing: readonly string[] } {
  const bars = new Map<number, GuideNote[]>()
  const labels = new Map<number, string>()
  const missing: string[] = []
  if (line === 'off') return { bars, labels, missing }
  const tones = chords.map((c) => {
    const t = guideTonesFor(part, c.chord, c.scale)
    if (!t && !isRest(c.chord)) {
      const why = `no guide tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const notes = guideToneLine(tones, rangeOf(part), line, chords.map((c) => c.block ?? 0))
  const voice: { bar: number; note: GuideNote }[] = []
  chords.forEach((c, j) => {
    const h = notes[j] ?? null
    if (h) labels.set(c.row, guideLabel(h.label))
    const here = notesFor(h, c.start, c.beats, beats)
    const before = voice.at(-1)
    const first = here[0]
    if (h?.held && before && first) {
      voice[voice.length - 1] = { ...before, note: { ...before.note, tie: true } }
      here[0] = { ...first, note: { ...first.note, tiedIn: true } }
    }
    voice.push(...here)
  })
  for (const { bar, note } of voice) bars.set(bar, [...(bars.get(bar) ?? []), note])
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, labels, missing }
}
