import { parseChord, writtenChordRootLenient } from './chord'
import type { Part, Pitched } from './part'
import { accidentalsInBar, octaveOf } from './keySignature'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'
import { guideToneLines, type LineNote } from './guideToneLines'
import type { Candidate, GuideTones } from './voiceLeading'

/**
 * Guide tones on the Changes sheet: guide tone lines (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md:
 * line A from the first chord's 3rd, line B from its 7th, each moving to the nearer guide tone of the next chord) as
 * voices, one note a chord (docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md), split at barlines, with accidentals by the measure rule across both voices. No DOM, like sheet.ts. The
 * timeline (guideToneTimeline.ts) and the lines (guideToneLines.ts) live in their own modules.
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

/** which guide tone lines the Changes sheet shows: line A, from the 3rd, and line B, from the 7th */
export type GuideShow = Readonly<{ fromThird: boolean; fromSeventh: boolean }>
export const NO_GUIDES: GuideShow = { fromThird: false, fromSeventh: false }
/** how many guide tone voices are shown: 0, 1 or 2 */
export const guidesOn = (s: GuideShow): number => +s.fromThird + +s.fromSeventh

/** one note (or rest) of a guide tone voice, within a bar */
export type GuideNote = Readonly<{
  /** null: a rest */
  pitch: Pitched | null
  /** where it starts in the bar, from 0 */
  beat: number
  beats: 1 | 2 | 3 | 4
  /** tied into this voice's next note (in the next bar, which may be on the next line) */
  tie: boolean
  /** continues the previous note: no accidental, no label */
  tiedIn: boolean
  /** '#', 'b', 'n', '##', 'bb' or null: the measure rule across both voices, against the key signature (none: C) */
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

/**
 * one bar's voices (upper first) with their accidentals: the measure rule (accidentalsInBar) over both voices
 * merged, by beat and the upper note first, so an accidental in one voice is in force for the other
 */
export function voiceAccidentals(voices: readonly (readonly GuideNote[])[], keySig: string | null): GuideNote[][] {
  const merged = voices
    .flatMap((notes, v) => notes.flatMap((n, i) => (n.pitch ? [{ v, i, n, pitch: n.pitch }] : [])))
    .sort((a, b) => a.n.beat - b.n.beat || a.v - b.v)
  const accs = accidentalsInBar(
    merged.map(({ n, pitch }) => ({ letter: pitch.letter, acc: pitch.acc, octave: octaveOf(pitch), tiedIn: n.tiedIn })),
    keySig,
  )
  const out = voices.map((notes) => [...notes])
  merged.forEach(({ v, i, n }, k) => {
    const voice = out[v]
    if (voice) voice[i] = { ...n, accidental: accs[k] ?? null }
  })
  return out
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/**
 * the guide tone voices for chords in time order: by timeline bar (Math.floor(start / beats)), each bar's voices
 * ([line] with one toggle on, [upper, lower] with both); by row, the labels top to bottom (no entry for a rest);
 * and a diagnostic for each chord without guide tones. Lines A and B are always built together (they differ at
 * every chord); one on: that line alone; both on: the two sorted by pitch at every chord. A chord that repeats the
 * guide tones in the same block is tied from the one before. A chord without guide tones rests in every voice.
 * keySig: the signature in force on every line (null: C). Nothing when both are off.
 */
export function guideVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  show: GuideShow,
): { bars: ReadonlyMap<number, readonly (readonly GuideNote[])[]>; labels: ReadonlyMap<number, readonly string[]>; missing: readonly string[] } {
  const bars = new Map<number, GuideNote[][]>()
  const labels = new Map<number, readonly string[]>()
  const missing: string[] = []
  const count = guidesOn(show)
  if (!count) return { bars, labels, missing }
  const tones = chords.map((c) => {
    const t = guideTonesFor(part, c.chord, c.scale)
    if (!t) {
      const why = `no guide tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const [a, b] = guideToneLines(tones, part.clef, chords.map((c) => c.block ?? 0))
  const at = (j: number): (LineNote | null)[] => {
    const [x = null, y = null] = [a[j], b[j]]
    if (count === 1) return [show.fromThird ? x : y]
    return x && y && y.pitch.midi > x.pitch.midi ? [y, x] : [x, y]
  }
  const voices: { bar: number; note: GuideNote }[][] = Array.from({ length: count }, () => [])
  chords.forEach((c, j) => {
    const here = at(j)
    const labelled = here.flatMap((h) => (h ? [guideLabel(h.label)] : []))
    if (labelled.length === here.length) labels.set(c.row, labelled)
    here.forEach((h, v) => {
      const voice = voices[v]
      if (!voice) return
      const notes = notesFor(h, c.start, c.beats, beats)
      const before = voice.at(-1)
      const first = notes[0]
      if (h?.held && before && first) {
        voice[voice.length - 1] = { ...before, note: { ...before.note, tie: true } }
        notes[0] = { ...first, note: { ...first.note, tiedIn: true } }
      }
      voice.push(...notes)
    })
  })
  voices.forEach((voice, v) =>
    voice.forEach(({ bar, note }) => {
      const here = bars.get(bar) ?? voices.map((): GuideNote[] => [])
      here[v]?.push(note)
      bars.set(bar, here)
    }),
  )
  for (const [bar, vs] of bars) bars.set(bar, voiceAccidentals(vs, keySig))
  return { bars, labels, missing }
}
