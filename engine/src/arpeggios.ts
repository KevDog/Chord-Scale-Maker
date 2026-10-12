import { parseChord, writtenChordRootLenient } from './chord'
import { type GuideInput, type GuideLine, type GuideNote, voiceAccidentals } from './guideTones'
import type { Range } from './instruments'
import { type Part, rangeOf } from './part'
import { pcOf, type Spelled } from './pitch'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'

/**
 * 7th chord arpeggios on the Changes sheet (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * each chord's four chord tones (a triad's three), arpeggiated in one of ten patterns, in quarters, eighths or
 * sixteenths by bar. Pure; no DOM.
 */

export const ARPEGGIO_PATTERNS = ['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'] as const
export type ArpeggioPattern = (typeof ARPEGGIO_PATTERNS)[number]
export const isArpeggioPattern = (x: unknown): x is ArpeggioPattern => (ARPEGGIO_PATTERNS as readonly unknown[]).includes(x)
export const ARPEGGIO_LABELS: Readonly<Record<ArpeggioPattern, string>> = {
  'up-root': 'Up · root',
  'up-1st': 'Up · 1st inv',
  'up-2nd': 'Up · 2nd inv',
  'up-3rd': 'Up · 3rd inv',
  'down-root': 'Down · root',
  'down-1st': 'Down · 1st inv',
  'down-2nd': 'Down · 2nd inv',
  'down-3rd': 'Down · 3rd inv',
  'up-down': 'Up & down',
  'voice-led': 'Voice-led',
}

/** the Changes sheet's line: none, a guide tone line, or an arpeggio pattern */
export type SheetLine = GuideLine | ArpeggioPattern
export const isSheetLine = (x: unknown): x is SheetLine => x === 'off' || x === 'third' || x === 'seventh' || isArpeggioPattern(x)

/** canonical quality -> its arpeggio's degrees: four, a triad's three; extensions dropped, altered 5ths kept */
const DEGREES: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  Maj7: ['1', '3', '5', '7'],
  'Maj7#11': ['1', '3', '5', '7'],
  'Maj7#5': ['1', '3', '#5', '7'],
  '6': ['1', '3', '5', '6'],
  m7: ['1', 'b3', '5', 'b7'],
  m6: ['1', 'b3', '5', '6'],
  mMaj7: ['1', 'b3', '5', '7'],
  '7': ['1', '3', '5', 'b7'],
  '7sus4': ['1', '4', '5', 'b7'],
  '7sus4b9': ['1', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7'],
  '7b13': ['1', '3', '5', 'b7'],
  '7b9b13': ['1', '3', '5', 'b7'],
  '7#11': ['1', '3', '5', 'b7'],
  '7alt': ['1', '3', '#5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}

/** a chord's arpeggio tones, spelled from its written root; null if the chord or its quality is unknown */
export function arpeggioTones(part: Part, chord: string, scale?: string): readonly Spelled[] | null {
  try {
    const degrees = DEGREES[baseQuality(parseChord(chord).quality) ?? '']
    if (!degrees) return null
    return spellFrom(writtenChordRootLenient(part, chord, scale), degrees.join(' ')).map(({ letter, acc }) => ({ letter, acc }))
  } catch {
    return null
  }
}

/**
 * one arpeggio's order, as indexes into the tones: the tones rotated by the inversion, four long (a triad's first
 * tone again at the end, and its 3rd inversion is root position); down reverses it, so Down ends where Up starts
 */
export function arpeggioOrder(n: 3 | 4, inversion: number, up: boolean): readonly number[] {
  const seq = [0, 1, 2, 3].map((i) => ((inversion % n) + i) % n)
  return up ? seq : seq.reverse()
}

export type NoteValue = 1 | 0.5 | 0.25
const NOTE_VALUES: readonly NoteValue[] = [1, 0.5, 0.25]

/** a bar's note value: the longest that gives its shortest chord (in beats) four notes or more */
export const noteValue = (shortest: number): NoteValue => NOTE_VALUES.find((v) => shortest / v >= 4) ?? 0.25

const INVERSION: Readonly<Record<string, number>> = { root: 0, '1st': 1, '2nd': 2, '3rd': 3 }

/** the tone nearest `prev` at any octave (ties: the lower pitch), as an index into the tones */
function nearestTone(tones: readonly Spelled[], prev: number): number {
  const best = tones
    .map((t, i) => {
      const up = (pcOf(t) - (prev % 12) + 12) % 12
      const down = (12 - up) % 12
      return { i, midi: down <= up ? prev - down : prev + up }
    })
    .sort((a, b) => Math.abs(a.midi - prev) - Math.abs(b.midi - prev) || a.midi - b.midi)[0]
  return best?.i ?? 0
}

/** the order and direction of the next arpeggio: count is how many the run has played (for Up & down) */
function orderFor(pattern: ArpeggioPattern, tones: readonly Spelled[], prev: number | null, count: number): Readonly<{ order: readonly number[]; up: boolean }> {
  const n = tones.length as 3 | 4
  if (pattern === 'up-down') return { order: arpeggioOrder(n, 0, count % 2 === 0), up: count % 2 === 0 }
  if (pattern === 'voice-led') return { order: arpeggioOrder(n, prev === null ? 0 : nearestTone(tones, prev), true), up: true }
  const [dir = 'up', inv = 'root'] = pattern.split('-')
  return { order: arpeggioOrder(n, INVERSION[inv] ?? 0, dir === 'up'), up: dir === 'up' }
}

/**
 * one arpeggio's pitches: each note the next of its pitch class above (up) or below (down) the last, placed whole at
 * the octave with the fewest notes out of range, then (rule 4) its first note nearest prev, nearer the centre, the
 * lower; a run's start (prev null, rule 5) at the octave whose notes average nearest the centre (a tie: the higher)
 */
function place(pcs: readonly number[], up: boolean, range: Range, prev: number | null): readonly number[] {
  const rel = pcs.reduce<number[]>((acc, pc, i) => {
    if (i === 0) return [0]
    const last = pcs[i - 1] ?? pc
    const step = up ? ((pc - last + 11) % 12) + 1 : -(((last - pc + 11) % 12) + 1)
    return [...acc, (acc[i - 1] ?? 0) + step]
  }, [])
  const first = pcs[0] ?? 0
  const options: { midi: number[]; out: number }[] = []
  for (let m = range.lo - 12; m <= range.hi + 12; m++) {
    if (((m % 12) + 12) % 12 !== first) continue
    const midi = rel.map((r) => m + r)
    options.push({ midi, out: midi.filter((x) => x < range.lo || x > range.hi).length })
  }
  const avg = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length
  const key = (o: { midi: number[]; out: number }): readonly number[] => {
    const m = o.midi[0] ?? 0
    return prev === null ? [o.out, Math.abs(avg(o.midi) - range.centre), -m] : [o.out, Math.abs(m - prev), Math.abs(m - range.centre), m]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0)
  return [...options].sort((a, b) => cmp(key(a), key(b)))[0]?.midi ?? rel.map((r) => range.centre + r)
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

type Segment = Readonly<{ chord: number; bar: number; beat: number; length: number }>

/**
 * the arpeggio line's voice for chords in time order (docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * by timeline bar, the bar's notes, each bar in its own note value (rule 2), each chord's slots filled by repeating
 * its pattern from the start (rule 3, again in each bar it lasts into); a chord without tones rests and ends the run
 * (rule 6); accidentals by the measure rule against keySig (null: C). missing: a diagnostic per unreadable chord.
 */
export function arpeggioVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: 2 | 3 | 4,
  keySig: string | null,
  pattern: ArpeggioPattern,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  const missing: string[] = []
  const tones = chords.map((c) => {
    const t = arpeggioTones(part, c.chord, c.scale)
    if (!t) {
      const why = `no chord tones for ${c.chord || 'an empty chord'} (${readable(c.chord) ? 'unknown chord quality' : "can't read the chord"})`
      if (!missing.includes(why)) missing.push(why)
    }
    return t
  })
  const segments: Segment[] = chords.flatMap((c, chord) => {
    const out: Segment[] = []
    for (let at = c.start; at < c.start + c.beats; ) {
      const bar = Math.floor(at / beats)
      const length = Math.min(c.start + c.beats, (bar + 1) * beats) - at
      out.push({ chord, bar, beat: at - bar * beats, length })
      at += length
    }
    return out
  })
  const shortest = new Map<number, number>()
  for (const s of segments) shortest.set(s.bar, Math.min(shortest.get(s.bar) ?? Infinity, s.length))

  const bars = new Map<number, GuideNote[]>()
  const push = (bar: number, note: GuideNote): void => {
    bars.set(bar, [...(bars.get(bar) ?? []), note])
  }
  let prev: number | null = null
  let count = 0
  for (const s of segments) {
    const t = tones[s.chord]
    if (!t) {
      push(s.bar, { pitch: null, beat: s.beat, beats: s.length as GuideNote['beats'], tie: false, tiedIn: false, accidental: null })
      prev = null
      count = 0
      continue
    }
    const v = noteValue(shortest.get(s.bar) ?? s.length)
    const slots = Math.round(s.length / v)
    for (let k = 0; k < slots; k += 4) {
      const { order, up } = orderFor(pattern, t, prev, count)
      const midi = place(order.map((i) => pcOf(t[i] ?? (t[0] as Spelled))), up, range, prev)
      const take = Math.min(4, slots - k)
      for (let j = 0; j < take; j++) {
        const tone = t[order[j] ?? 0] as Spelled
        push(s.bar, { pitch: { ...tone, midi: midi[j] ?? 0 }, beat: s.beat + (k + j) * v, beats: v, tie: false, tiedIn: false, accidental: null })
      }
      prev = midi[take - 1] ?? prev
      count++
    }
  }
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, missing }
}
