import { type Row, resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull, parseChord, writtenChordRootLenient } from './chord'
import { BEATS, guideToneTimeline } from './guideToneTimeline'
import type { Part, Pitched } from './part'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { chunk, orNull } from './util'
import { type Candidate, type GuideTones, voiceLead } from './voiceLeading'

/**
 * Guide tone lines (docs/plan-guide-tones.md): each chord's 3rd and 7th, voice-led into two lines, one starting on
 * the 3rd and one on the 7th, laid out in bars and systems. No DOM, like sheet.ts. The timeline
 * (guideToneTimeline.ts) and the voice leading (voiceLeading.ts) live in their own modules.
 */

/** canonical quality -> the degrees that stand for its "3rd" and "7th" */
const TONES: Readonly<Record<string, readonly [string, string]>> = {
  maj: ['3', '1'], // a triad has no 7th: its root resolves by step from a V7 (B -> C, F# -> G), its 5th would leap
  m: ['b3', '1'],
  Maj7: ['3', '7'],
  '6': ['3', '6'],
  m7: ['b3', 'b7'],
  m6: ['b3', '6'],
  mMaj7: ['b3', '7'],
  '7': ['3', 'b7'],
  '7sus4': ['4', 'b7'],
  '7b9': ['3', 'b7'],
  '7#11': ['3', 'b7'],
  '7alt': ['3', 'b7'],
  m7b5: ['b3', 'b7'],
  dim7: ['b3', 'bb7'],
}

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

export type GuideNote = Readonly<{ pitch: Pitched | null; beats: 1 | 2 | 4; tie: boolean; label: string }> // tie: into the next note
export type GuideChord = Readonly<{ beat: number; text: string; tokens: readonly ChordToken[] | null }>
export type GuideBar = Readonly<{
  label: string // "A · Bar 9" where a chord starts, else ''
  chords: readonly GuideChord[]
  lines: readonly [readonly GuideNote[], readonly GuideNote[]]
}>
export type GuideSystem = Readonly<{ bars: readonly GuideBar[] }>
export type GuideToneSheet = Readonly<{ systems: readonly GuideSystem[]; diagnostics: readonly string[] }>

/** split [start, start + beats) at barlines into notes, tying a held pitch across them */
function notesFor(c: Candidate | null, start: number, beats: number): { bar: number; note: GuideNote }[] {
  const out: { bar: number; note: GuideNote }[] = []
  let at = start
  const end = start + beats
  while (at < end) {
    const barEnd = (Math.floor(at / BEATS) + 1) * BEATS
    const len = Math.min(end, barEnd) - at
    const last = at + len >= end
    out.push({
      bar: Math.floor(at / BEATS),
      note: { pitch: c?.pitch ?? null, beats: len as 1 | 2 | 4, tie: !!c && !last, label: c?.label ?? '' },
    })
    at += len
  }
  return out
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/** both guide tone lines for a chart, in systems of barsPerSystem bars */
export function buildGuideTones(rows: readonly Row[], part: Part, barsPerSystem = 4): GuideToneSheet {
  const { events, diagnostics } = guideToneTimeline(rows)
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
  const barCount = Math.ceil(end / BEATS)
  // each line's notes, split at barlines once, then grouped by bar
  const byBar = ([0, 1] as const).map((l) => {
    const out: GuideNote[][] = Array.from({ length: barCount }, () => [])
    events.forEach((e, j) => notesFor(voiced[l][j] ?? null, e.start, e.beats).forEach((n) => out[n.bar]?.push(n.note)))
    return out
  })
  const bars = Array.from({ length: barCount }, (_, i): GuideBar => {
    const starting = events.filter((e) => Math.floor(e.start / BEATS) === i)
    const firstRow = starting[0]?.row
    const chords = starting.map(
      (e): GuideChord => ({ beat: e.start - i * BEATS, text: e.chord, tokens: chordTokensOrNull(part, e.chord, resolveScale(e.row)) }),
    )
    return {
      label: firstRow ? `${firstRow.section} · Bar ${firstRow.bar}` : '',
      chords,
      lines: [byBar[0]?.[i] ?? [], byBar[1]?.[i] ?? []],
    }
  })
  return { systems: chunk(bars, barsPerSystem).map((b) => ({ bars: b })), diagnostics: [...diagnostics, ...missing] }
}
