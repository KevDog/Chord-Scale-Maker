import { type Row, resolveScale } from './chart'
import { type ChordToken, chordTokens, parseChord, writtenChordRoot } from './chord'
import type { Clef } from './instruments'
import type { Part, Pitched } from './part'
import { pcOf, type Spelled } from './pitch'
import { baseQuality, resolveQuality } from './qualities'
import { spellFrom } from './scales'

/**
 * Guide tone lines (docs/plan-guide-tones.md): each chord's 3rd and 7th, voice-led into two lines, one starting on
 * the 3rd and one on the 7th. 4/4 throughout; a chord lasts until the next change. No DOM, like sheet.ts.
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

/** the written root, following the scale's spelling; a scale that can't be read is ignored, as sheet.ts does */
function rootFor(part: Part, chord: string, scale?: string): Spelled {
  try {
    return writtenChordRoot(part, chord, scale)
  } catch {
    return writtenChordRoot(part, chord)
  }
}

export type GuideTone = Readonly<{ note: Spelled; label: string }>
export type GuideTones = Readonly<{ third: GuideTone; seventh: GuideTone }>

/**
 * a chord's two guide tones, spelled from its written root; null if the chord or its quality is unknown.
 * Extended symbols count as their base quality (Maj7#11 as Maj7).
 */
export function guideTonesFor(part: Part, chord: string, scale?: string): GuideTones | null {
  try {
    const degrees = TONES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    const [third, seventh] = spellFrom(rootFor(part, chord, scale), degrees.join(' '))
    if (!third || !seventh) return null
    return { third: { note: third, label: degrees[0] }, seventh: { note: seventh, label: degrees[1] } }
  } catch {
    return null
  }
}

// --- timeline ---------------------------------------------------------------------------------------------------

const BEATS = 4 // 4/4
const MAX_PER_BAR = 4
/** how a bar is shared by 1-4 chords, in beats */
const SPLITS: readonly (readonly number[])[] = [[4], [2, 2], [2, 1, 1], [1, 1, 1, 1]]
const WHOLE = /^[+-]?\d{1,6}$/

/** "1" and "01" are the same bar */
const sameBar = (a: string, b: string): boolean => (WHOLE.test(a) && WHOLE.test(b) ? Number(a) === Number(b) : a === b)

const sectionStart = (rows: readonly Row[], section: string): number =>
  Math.min(...rows.filter((r) => r.section === section).map((r) => Number(r.bar)))

/** each section's rows relative to its first bar, to spot a section repeated by @copy */
const shape = (rows: readonly Row[], section: string): string => {
  const start = sectionStart(rows, section)
  return rows.filter((r) => r.section === section).map((r) => `${Number(r.bar) - start}|${r.chord}|${r.scale}`).join(';')
}

/**
 * how long the last row lasts. The chart has no end marker, so: a final section that repeats an earlier one
 * (A3 = A1 in an AABA) lasts as long as that one did, and the form then rounds up to whole 4-bar phrases.
 */
function finalBars(rows: readonly Row[]): number {
  const last = rows.at(-1)
  if (!last || !rows.every((r) => WHOLE.test(r.bar))) return 1
  const first = Number(rows[0]?.bar)
  const order = [...new Set(rows.map((r) => r.section))]
  let end = Number(last.bar) + 1
  const twin = order.slice(0, -1).find((s) => s !== last.section && shape(rows, s) === shape(rows, last.section))
  const twinNext = twin === undefined ? undefined : order[order.indexOf(twin) + 1]
  if (twin !== undefined && twinNext !== undefined)
    end = sectionStart(rows, last.section) + sectionStart(rows, twinNext) - sectionStart(rows, twin)
  const length = Math.ceil((end - first) / 4) * 4
  return Math.max(1, first + length - Number(last.bar))
}

export type GuideEvent = Readonly<{ row: Row; chord: string; start: number; beats: number }> // in beats from 0

/** when each chord starts and how long it lasts; rows that share a bar split it */
export function guideToneTimeline(rows: readonly Row[]): Readonly<{ events: readonly GuideEvent[]; diagnostics: readonly string[] }> {
  const groups: Row[][] = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last?.[0] && sameBar(last[0].bar, r.bar)) last.push(r)
    else groups.push([r])
  }
  const diagnostics: string[] = []
  const events: GuideEvent[] = []
  let cursor = 0
  const lastBars = finalBars(rows)
  groups.forEach((group, g) => {
    const first = group[0]
    if (!first) return
    if (group.length > MAX_PER_BAR)
      diagnostics.push(`more than ${MAX_PER_BAR} chords in bar ${first.bar}: the ${MAX_PER_BAR + 1}th and later are left out`)
    const kept = group.slice(0, MAX_PER_BAR)
    const next = groups[g + 1]?.[0]?.bar
    let bars = 1
    if (!WHOLE.test(first.bar)) diagnostics.push(`bar "${first.bar}" is not a whole number, so ${first.chord} gets one bar`)
    else if (next !== undefined && WHOLE.test(next) && Number(next) > Number(first.bar)) bars = Number(next) - Number(first.bar)
    else if (next === undefined) bars = lastBars
    const split = SPLITS[kept.length - 1] ?? [BEATS]
    let offset = 0
    kept.forEach((r, i) => {
      const slot = split[i] ?? 1
      const beats = i === kept.length - 1 ? slot + (bars - 1) * BEATS : slot
      events.push({ row: r, chord: r.chord, start: cursor + offset, beats })
      offset += slot
    })
    cursor += bars * BEATS
  })
  return { events, diagnostics }
}

// --- voice leading ----------------------------------------------------------------------------------------------

/** written ranges: anything inside [lo, hi]; [comfortLo, comfortHi] costs nothing */
const RANGES: Readonly<Record<Clef, Readonly<{ lo: number; hi: number; comfortLo: number; comfortHi: number }>>> = {
  treble: { lo: 60, hi: 81, comfortLo: 64, comfortHi: 74 }, // C4-A5, comfortable E4-D5
  bass: { lo: 40, hi: 60, comfortLo: 43, comfortHi: 55 }, // E2-C4, comfortable G2-G3
}
const OUTSIDE_COST = 3 // per semitone outside the comfortable range
const LEAP_COST = 2 // per semitone beyond a whole step
const CENTRE_COST = 0.01 // ties: nearer the middle of the range

type Candidate = Readonly<{ pitch: Pitched; label: string; role: 0 | 1 }>

function candidates(tones: GuideTones, clef: Clef): Candidate[] {
  const { lo, hi } = RANGES[clef]
  return ([tones.third, tones.seventh] as const).flatMap((t, role) => {
    const pc = pcOf(t.note)
    const out: Candidate[] = []
    for (let midi = lo; midi <= hi; midi++)
      if (midi % 12 === pc) out.push({ pitch: { letter: t.note.letter, acc: t.note.acc, midi }, label: t.label, role: role as 0 | 1 })
    return out
  })
}

function placeCost(midi: number, clef: Clef): number {
  const { comfortLo, comfortHi } = RANGES[clef]
  const outside = Math.max(0, comfortLo - midi, midi - comfortHi)
  return OUTSIDE_COST * outside + CENTRE_COST * Math.abs(midi - (comfortLo + comfortHi) / 2)
}

function moveCost(from: number, to: number): number {
  const d = Math.abs(to - from)
  return d + LEAP_COST * Math.max(0, d - 2) // a held note costs 0, a step 1-2
}

/** the smoothest path through consecutive chords (Viterbi), starting on the given role */
function smoothest(steps: readonly Candidate[][], startRole: 0 | 1, clef: Clef): Candidate[] {
  const first = (steps[0] ?? []).filter((c) => c.role === startRole)
  let costs = first.map((c) => placeCost(c.pitch.midi, clef))
  const back: number[][] = []
  let prev = first
  for (const step of steps.slice(1)) {
    const best = step.map((c) => {
      let min = Infinity
      let arg = 0
      prev.forEach((p, j) => {
        const cost = (costs[j] ?? Infinity) + moveCost(p.pitch.midi, c.pitch.midi)
        if (cost < min) [min, arg] = [cost, j]
      })
      return [min + placeCost(c.pitch.midi, clef), arg] as const
    })
    costs = best.map(([c]) => c)
    back.push(best.map(([, a]) => a))
    prev = step
  }
  let at = costs.indexOf(Math.min(...costs))
  const path: Candidate[] = []
  for (let s = steps.length - 1; s >= 0; s--) {
    const step = s === 0 ? first : (steps[s] ?? [])
    const c = step[at]
    if (c) path.unshift(c)
    at = s > 0 ? (back[s - 1]?.[at] ?? 0) : 0
  }
  return path
}

/** one guide tone (or a rest) per event, for the line starting on the 3rd (0) or the 7th (1) */
function line(tones: readonly (GuideTones | null)[], startRole: 0 | 1, clef: Clef): (Candidate | null)[] {
  const out: (Candidate | null)[] = []
  let run: Candidate[][] = []
  const flush = (): void => {
    if (run.length) out.push(...smoothest(run, startRole, clef))
    run = []
  }
  for (const t of tones) {
    if (t) run.push(candidates(t, clef))
    else {
      flush()
      out.push(null) // a rest; the line starts again on its role after it
    }
  }
  flush()
  return out
}

// --- sheet ------------------------------------------------------------------------------------------------------

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

function readable(chord: string): boolean {
  try {
    resolveQuality(chord)
    return true
  } catch {
    return false
  }
}

function tokensOrNull(part: Part, chord: string, scale: string | null): readonly ChordToken[] | null {
  for (const sc of [scale ?? undefined, undefined]) {
    try {
      return chordTokens(part, chord, sc)
    } catch {
      // a bad scale: try the chord on its own
    }
  }
  return null
}

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
  const lines = [line(tones, 0, part.clef), line(tones, 1, part.clef)] as const
  const end = events.reduce((m, e) => Math.max(m, e.start + e.beats), 0)
  const bars = Array.from({ length: Math.ceil(end / BEATS) }, (_, i) => {
    const starting = events.filter((e) => Math.floor(e.start / BEATS) === i)
    const firstRow = starting[0]?.row
    const chords = starting.map(
      (e): GuideChord => ({ beat: e.start - i * BEATS, text: e.chord, tokens: tokensOrNull(part, e.chord, resolveScale(e.row)) }),
    )
    const notesIn = (l: 0 | 1): GuideNote[] =>
      events.flatMap((e, j) => notesFor(lines[l][j] ?? null, e.start, e.beats)).filter((n) => n.bar === i).map((n) => n.note)
    return { label: firstRow ? `${firstRow.section} · Bar ${firstRow.bar}` : '', chords, lines: [notesIn(0), notesIn(1)] as const }
  })
  const systems: GuideSystem[] = []
  for (let i = 0; i < bars.length; i += barsPerSystem) systems.push({ bars: bars.slice(i, i + barsPerSystem) })
  return { systems, diagnostics: [...diagnostics, ...missing] }
}
