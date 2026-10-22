import { isRest, parseChord, writtenChordRootLenient } from './chord'
import { type Approach, approachNotes } from './approaches'
import { type Part, type Pitched, rangeOf, writtenScale } from './part'
import { accidentalsInBar, octaveOf } from './keySignature'
import { barAt, barLength, barStart, type Metre } from './metre'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'
import { guideToneLine } from './guideToneLines'
import type { Candidate, GuideTones } from './voiceLeading'
import type { RhythmNote } from './rhythm/notation'
import type { RhythmPlan } from './rhythm/pour'
import { type Cells, cellVoices } from './arpeggios'
import type { LineNote } from './guideToneLines'

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
  aug: ['3', '#5'], // the #5 is the tone that moves (C+ -> F: G# -> A)
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

/** a poured note's notation: its value, tuplet, beam group and accent */
export type RhythmMark = Pick<RhythmNote, 'value' | 'tuplet' | 'beam' | 'accent'>

/** one note (or rest) of a guide tone voice, within a bar */
export type GuideNote = Readonly<{
  /** null: a rest */
  pitch: Pitched | null
  /** where it starts in the bar, from 0 */
  beat: number
  /** its length in beats: a NoteBeats, or under a rhythm its value's (0.75, 1.5, ⅓ of a beat in a triplet…) */
  beats: number
  /** a poured note's notation, from the rhythm (rhythm-on-lines spec §7); none: drawn from beats, as before */
  mark?: RhythmMark
  /** a struck note on a target beat: a tone of the chord sounding there, or another note (§6) */
  target?: 'tone' | 'other'
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
export type GuideInput = Readonly<{
  row: number
  chord: string
  scale?: string
  /** the scale the sheet shows over the chord, which an approach figure's diatonic steps follow (default: scale) */
  shown?: string
  /** its scale is written in the chart (a pin): the Cells line's substitutes never replace it (#378) */
  pinned?: true
  start: number
  beats: number
  block?: number
}>

/**
 * split [start, start + length) at barlines (bars of the metre) into notes, and a length no one note draws (5 beats)
 * into ones that do, tying a held pitch across them (a rest is split untied); accidentals are left for voiceAccidentals
 */
export function notesFor(c: Candidate | null, start: number, length: number, metre: Metre): { bar: number; note: GuideNote }[] {
  const out: { bar: number; note: GuideNote }[] = []
  const pitch = c?.pitch ?? null
  const end = start + length
  let at = start
  while (at < end) {
    const bar = barAt(metre, at)
    const from = barStart(metre, bar)
    const len = Math.min(end, from + barLength(metre, bar)) - at
    for (const piece of drawnLengths(len)) {
      out.push({ bar, note: { pitch, beat: at - from, beats: piece, tie: !!pitch && at + piece < end, tiedIn: !!pitch && at > start, accidental: null } })
      at += piece
    }
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

/** an approach figure's notes are eighths */
const APPROACH_BEATS = 0.5

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/** a placed guide note as a cell of one note, which every attack restates (rhythm-on-lines spec §5); null for a rest */
const oneNote = (note: LineNote | null | undefined): Cells | null =>
  note ? { tones: [note.pitch], next: () => ({ order: [0], up: true, midi: [note.pitch.midi] }) } : null

/**
 * the guide tone line's voice for chords in time order: by timeline bar (barAt), the bar's
 * notes; by row, the chord's label (no entry for a rest); and a diagnostic for each chord without guide tones. The
 * line is one of the pair guideToneLine builds together (so they can go apart where they meet). A chord that repeats the guide tones in the same block is tied from the
 * one before; a chord without guide tones rests. keySig: the signature in force on every line (null: C). Nothing
 * when the line is 'off'. approach: a figure into each chord's guide tone after the first, as eighths at the end of the
 * chord before, which gives up that much of its note (and the tie into a held target); a figure's first notes that
 * are that chord's guide tone are left to it; none where that chord rests or would keep less than an eighth, the
 * figure needs a scale the chord doesn't have, or a note of it is outside the part's range. rhythm, with restate:
 * the same notes, labels and diagnostics, each chord's note restated on every attack of its span (cellVoices, §5);
 * without restate the rhythm is ignored (D17).
 */
export function guideVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  line: GuideLine,
  approach: Approach = 'none',
  rhythm?: RhythmPlan,
  restate = false,
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
  const range = rangeOf(part)
  const notes = guideToneLine(tones, range, line, chords.map((c) => c.block ?? 0))
  if (restate && rhythm) {
    notes.forEach((h, j) => {
      const c = chords[j]
      if (h && c) labels.set(c.row, guideLabel(h.label))
    })
    const poured = cellVoices(chords, part, beats, keySig, (_, j) => oneNote(notes[j]), undefined, approach, rhythm)
    return { bars: poured.bars, labels, missing }
  }
  const lead = chords.map((c, j) => {
    const target = notes[j]?.pitch
    const before = chords[j - 1]
    const prev = notes[j - 1]?.pitch
    if (approach === 'none' || !target || !before || !prev || before.start + before.beats !== c.start) return []
    const text = before.shown ?? before.scale
    const scale = text ? orNull(() => writtenScale(part, text).notes) : null
    const all = approachNotes(target, approach, scale) ?? []
    if (all.some((n) => n.midi < range.lo || n.midi > range.hi)) return []
    const from = all.findIndex((n) => n.midi !== prev.midi) // the guide tone before goes on into it
    const figure = from < 0 ? [] : all.slice(from)
    return before.beats - figure.length * APPROACH_BEATS >= APPROACH_BEATS ? figure : []
  })
  const voice: { bar: number; note: GuideNote }[] = []
  chords.forEach((c, j) => {
    const h = notes[j] ?? null
    if (h) labels.set(c.row, guideLabel(h.label))
    const figure = lead[j + 1] ?? []
    const here = notesFor(h, c.start, c.beats - figure.length * APPROACH_BEATS, beats)
    const before = voice.at(-1)
    const first = here[0]
    if (h?.held && before && first && !lead[j]?.length) {
      voice[voice.length - 1] = { ...before, note: { ...before.note, tie: true } }
      here[0] = { ...first, note: { ...first.note, tiedIn: true } }
    }
    voice.push(...here)
    const end = c.start + c.beats
    figure.forEach((pitch, k) => {
      const at = end - (figure.length - k) * APPROACH_BEATS
      const bar = barAt(beats, at)
      voice.push({ bar, note: { pitch, beat: at - barStart(beats, bar), beats: APPROACH_BEATS, tie: false, tiedIn: false, accidental: null } })
    })
  })
  for (const { bar, note } of voice) bars.set(bar, [...(bars.get(bar) ?? []), note])
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, labels, missing }
}
