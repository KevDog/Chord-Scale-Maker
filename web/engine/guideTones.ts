import { type Row, resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull, parseChord, writtenChordRootLenient } from './chord'
import type { Key } from './analysis/keys'
import { guideToneTimeline } from './guideToneTimeline'
import type { Part, Pitched } from './part'
import { accidentalsInBar, keySignature, octaveOf } from './keySignature'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { chunk, orNull } from './util'
import { type Candidate, type GuideTones, voiceLead, voiceLeadOne } from './voiceLeading'

/**
 * Guide tones (docs/superpowers/specs/2026-10-10-guide-tones-on-changes-design.md): each chord's 3rd and 7th as
 * voices for the Changes sheet, one note a chord, voice-led (both on: two voices that move by step; one on: that
 * degree alone, in the nearest octave), split at barlines, with accidentals by the measure rule across both voices.
 * The old Guide tones sheet (buildGuideTones) stays until the Changes sheet replaces it. No DOM, like sheet.ts. The
 * timeline (guideToneTimeline.ts) and the voice leading (voiceLeading.ts) live in their own modules.
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

/** which guide tones the Changes sheet shows */
export type GuideShow = Readonly<{ third: boolean; seventh: boolean }>
export const NO_GUIDES: GuideShow = { third: false, seventh: false }
/** how many guide tone voices are shown: 0, 1 or 2 */
export const guidesOn = (s: GuideShow): number => +s.third + +s.seventh

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

/** a chord to voice: row is the caller's index for its labels; start and beats are in beats from 0 */
export type GuideInput = Readonly<{ row: number; chord: string; scale?: string; start: number; beats: number }>

/** the Guide tones sheet's note; removed with that sheet */
export type LegacyGuideNote = Readonly<{ pitch: Pitched | null; beats: 1 | 2 | 3 | 4; tie: boolean; label: string }> // tie: into the next note
export type GuideChord = Readonly<{ beat: number; text: string; tokens: readonly ChordToken[] | null }>
export type GuideBar = Readonly<{
  keySig: string | null // the chart's key, written for the part; null: none drawn
  label: string // "A · Bar 9" where a chord starts, else ''
  chords: readonly GuideChord[]
  lines: readonly [readonly LegacyGuideNote[], readonly LegacyGuideNote[]]
}>
export type GuideSystem = Readonly<{ bars: readonly GuideBar[] }>
/** beats: a bar's beats (its time signature over 4) */
export type GuideToneSheet = Readonly<{ systems: readonly GuideSystem[]; diagnostics: readonly string[]; beats: 2 | 3 | 4 }>

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
 * and a diagnostic for each chord without guide tones. Both on: the two lines are voice-led as a pair (each moves by
 * step where it can) and sorted by pitch at every chord; one on: that degree's smoothest line alone. A chord without
 * guide tones rests in every voice. keySig: the signature in force on every line (null: C). Nothing when both are off.
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
  const lines: (Candidate | null)[][] = []
  if (count === 2) {
    const [one, two] = voiceLead(tones, part.clef)
    const pairs = one.map((a, j) => {
      const b = two[j] ?? null
      return a && b && b.pitch.midi > a.pitch.midi ? [b, a] : [a, b]
    })
    lines.push(
      pairs.map((p) => p[0] ?? null),
      pairs.map((p) => p[1] ?? null),
    )
  } else lines.push(voiceLeadOne(tones, show.third ? 0 : 1, part.clef))
  chords.forEach((c, j) => {
    const here = lines.map((l) => l[j] ?? null)
    const labelled = here.flatMap((h) => (h ? [guideLabel(h.label)] : []))
    if (labelled.length === here.length) labels.set(c.row, labelled)
    here.forEach((h, v) =>
      notesFor(h, c.start, c.beats, beats).forEach(({ bar, note }) => {
        const voices = bars.get(bar) ?? lines.map((): GuideNote[] => [])
        voices[v]?.push(note)
        bars.set(bar, voices)
      }),
    )
  })
  for (const [bar, voices] of bars) bars.set(bar, voiceAccidentals(voices, keySig))
  return { bars, labels, missing }
}

/** both guide tone lines for a chart, in systems of barsPerSystem bars; key: the chart's key for every bar's signature */
export function buildGuideTones(rows: readonly Row[], part: Part, barsPerSystem = 4, beats: 2 | 3 | 4 = 4, key?: Key | null): GuideToneSheet {
  const { events, diagnostics } = guideToneTimeline(rows, beats)
  const missing: string[] = []
  const tones = events.map((e) => {
    const t = guideTonesFor(part, e.chord, resolveScale(e.row) ?? undefined)
    if (!t) {
      const why = `no guide tones for ${e.chord || 'an empty chord'} (${readable(e.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const voiced = voiceLead(tones, part.clef)
  const end = events.reduce((m, e) => Math.max(m, e.start + e.beats), 0)
  const barCount = Math.ceil(end / beats)
  // each line's notes, split at barlines once, then grouped by bar
  const byBar = ([0, 1] as const).map((l) => {
    const out: LegacyGuideNote[][] = Array.from({ length: barCount }, () => [])
    events.forEach((e, j) => {
      const c = voiced[l][j] ?? null
      notesFor(c, e.start, e.beats, beats).forEach(({ bar, note }) =>
        out[bar]?.push({ pitch: note.pitch, beats: note.beats, tie: note.tie, label: c?.label ?? '' }),
      )
    })
    return out
  })
  const keySig = key === undefined ? null : keySignature(key, part)
  const bars = Array.from({ length: barCount }, (_, i): GuideBar => {
    const starting = events.filter((e) => Math.floor(e.start / beats) === i)
    const firstRow = starting[0]?.row
    const chords = starting.map(
      (e): GuideChord => ({ beat: e.start - i * beats, text: e.chord, tokens: chordTokensOrNull(part, e.chord, resolveScale(e.row)) }),
    )
    return {
      keySig,
      label: firstRow ? `${firstRow.section} · Bar ${firstRow.bar}` : '',
      chords,
      lines: [byBar[0]?.[i] ?? [], byBar[1]?.[i] ?? []],
    }
  })
  return { systems: chunk(bars, barsPerSystem).map((b) => ({ bars: b })), diagnostics: [...diagnostics, ...missing], beats }
}
