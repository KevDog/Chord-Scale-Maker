import { isRest, parseChord, writtenChordRootLenient } from './chord'
import { drawnLengths, type GuideInput, type GuideLine, type GuideNote, voiceAccidentals } from './guideTones'
import { barAt, barLength, barStart, type Metre } from './metre'
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

/** canonical quality -> its arpeggio's degrees: four, a triad's three; extensions dropped, a written altered 5th kept (fifthFor) */
const DEGREES: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  Maj7: ['1', '3', '5', '7'],
  'Maj7#11': ['1', '3', '5', '7'],
  'Maj7#5': ['1', '3', '#5', '7'],
  aug: ['1', '3', '#5'],
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
  '7alt': ['1', '3', '5', 'b7'], // 7#9 and the like read here; the written symbol raises the 5th (fifthFor)
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}

/** the 5th as written: alt, #5, + or aug raise it, b5 lowers it (the written symbol wins), else the quality's own */
function fifthFor(written: string, own: string | undefined): string | undefined {
  const q = written.replace(/[()]/g, '')
  if (/alt|#5|\+|aug/.test(q)) return '#5'
  if (/b5/.test(q)) return 'b5'
  return own
}

/** a chord's arpeggio tones, spelled from its written root; null if the chord or its quality is unknown */
export function arpeggioTones(part: Part, chord: string, scale?: string): readonly Spelled[] | null {
  try {
    const written = parseChord(chord).quality
    const degrees = DEGREES[baseQuality(written) ?? '']
    if (!degrees) return null
    const shaped = degrees.map((d, i) => (i === 2 ? (fifthFor(written, d) ?? d) : d))
    return spellFrom(writtenChordRootLenient(part, chord, scale), shaped.join(' ')).map(({ letter, acc }) => ({ letter, acc }))
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

/** the tone nearest `prev` at any octave, but never prev itself (ties: the lower pitch), as an index into the tones */
export function nearestTone(tones: readonly Spelled[], prev: number): number {
  const best = tones
    .map((t, i) => {
      const up = (pcOf(t) - (prev % 12) + 12) % 12
      const down = (12 - up) % 12
      return { i, midi: down <= up ? prev - down : prev + up }
    })
    .filter((c) => c.midi !== prev)
    .sort((a, b) => Math.abs(a.midi - prev) - Math.abs(b.midi - prev) || a.midi - b.midi)[0]
  return best?.i ?? 0
}

/** the tone nearest `prev` on its way (up: above it, else below), never prev itself, as an index into the tones */
function toneBeyond(tones: readonly Spelled[], prev: number, up: boolean): number {
  const gap = (t: Spelled): number => ((up ? pcOf(t) - prev : prev - pcOf(t)) % 12 + 23) % 12 // semitones away, less one
  return tones.reduce((best, t, i) => (gap(t) < gap(tones[best] as Spelled) ? i : best), 0)
}

/** a Down arpeggio from tone `from`: it and the three tones below it, by index (a triad's from again last) */
const downFrom = (n: 3 | 4, from: number): readonly number[] => [0, 1, 2, 3].map((k) => (from - k + 4 * n) % n)

/** the order and direction of the next arpeggio: count is how many the run has played (for Up & down) */
function orderFor(pattern: ArpeggioPattern, tones: readonly Spelled[], prev: number | null, count: number): Readonly<{ order: readonly number[]; up: boolean }> {
  const n = tones.length as 3 | 4
  if (pattern === 'up-down') {
    // after the run's first, each starts on the tone just past the last note its way, so the line keeps going (#356)
    const up = count % 2 === 0
    if (prev === null) return { order: arpeggioOrder(n, 0, up), up }
    const from = toneBeyond(tones, prev, up)
    return { order: up ? arpeggioOrder(n, from, true) : downFrom(n, from), up }
  }
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

/** a run's start: the octave with the fewest notes out of range, then the average nearest the centre (a tie: the higher) */
export function placeRun(pcs: readonly number[], up: boolean, range: Range): readonly number[] {
  return place(pcs, up, range, null)
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/** why a chord plays nothing: a diagnostic for the sheet */
const noTonesFor = (chord: string): string => `no chord tones for ${chord || 'an empty chord'} (${readable(chord) ? 'unknown chord quality' : "can't read the chord"})`

/**
 * a chord's cells: its tones, and the next cell's order (indexes into them) and direction, given the last note, the
 * run's count, the last cell's pitches and how many cells the chord has played; midi: its pitches where the cell placed
 * itself; carry: a cell the bar line cuts goes on into the chord's next bar (else it is dropped); turn: slots too few
 * for another whole cell turn back on the last one instead, from its second-to-last note (a 3/4 bar: 1 3 5 7 5 3, #348)
 */
export type Cells = Readonly<{
  tones: readonly Spelled[]
  next: (prev: number | null, count: number, last: readonly number[] | null, nth: number) => Readonly<{ order: readonly number[]; up: boolean; midi?: readonly number[] }>
  carry?: boolean
  turn?: boolean
}>

/** a chord's 7th chord arpeggio cells in a pattern; null if it has no tones */
export function arpeggioCells(part: Part, chord: GuideInput, pattern: ArpeggioPattern): Cells | null {
  const tones = arpeggioTones(part, chord.chord, chord.scale)
  return tones && { tones, next: (prev, count) => orderFor(pattern, tones, prev, count), turn: true }
}

type Segment = Readonly<{ chord: number; bar: number; beat: number; length: number }>
/** a cell's notes the bar line cut, still to play in its chord's next bar; midi: the whole cell's */
type Carried = Readonly<{ chord: number; notes: readonly NonNullable<GuideNote['pitch']>[]; midi: readonly number[] }>

/**
 * a line of four-note cells for chords in time order (the arpeggio line's rules, docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * by timeline bar, the bar's notes, each bar in its own note value (rule 2), each chord's slots filled by cell after
 * cell (rule 3, again in each bar it lasts into), each placed whole nearest the last note in the part's range; a chord
 * without cells rests and ends the run (rule 6); accidentals by the measure rule against keySig (null: C).
 * missing: a diagnostic per chord without cells. valueOf: a chord's note value from its whole length and its bar's
 * shortest segment (default: the bar's, noteValue).
 */
export function cellVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  cellsOf: (chord: GuideInput, index: number) => Cells | null,
  valueOf: (chordBeats: number, barShortest: number) => NoteValue = (_, shortest) => noteValue(shortest),
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  const missing: string[] = []
  const cells = chords.map((c, i) => {
    const found = cellsOf(c, i)
    if (!found && !isRest(c.chord) && !missing.includes(noTonesFor(c.chord))) missing.push(noTonesFor(c.chord))
    return found
  })
  const segments: Segment[] = chords.flatMap((c, chord) => {
    const out: Segment[] = []
    for (let at = c.start; at < c.start + c.beats; ) {
      const bar = barAt(beats, at)
      const from = barStart(beats, bar)
      const length = Math.min(c.start + c.beats, from + barLength(beats, bar)) - at
      out.push({ chord, bar, beat: at - from, length })
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
  let last: readonly number[] | null = null
  let count = 0
  const nth = new Map<number, number>() // cells each chord has played
  let carried = null as Carried | null
  for (const s of segments) {
    const c = cells[s.chord]
    if (!c) {
      let beat = s.beat
      for (const piece of drawnLengths(s.length)) {
        push(s.bar, { pitch: null, beat, beats: piece, tie: false, tiedIn: false, accidental: null })
        beat += piece
      }
      prev = null
      last = null
      count = 0
      carried = null
      continue
    }
    const t = c.tones
    const v = valueOf(chords[s.chord]?.beats ?? s.length, shortest.get(s.bar) ?? s.length)
    const slots = Math.round(s.length / v)
    let k = 0
    const play = (notes: readonly NonNullable<GuideNote['pitch']>[]): void => {
      for (const pitch of notes) push(s.bar, { pitch, beat: s.beat + k++ * v, beats: v, tie: false, tiedIn: false, accidental: null })
    }
    const held: Carried | null = carried?.chord === s.chord ? carried : null
    carried = null
    if (held) {
      const take = Math.min(held.notes.length, slots)
      play(held.notes.slice(0, take))
      prev = held.notes[take - 1]?.midi ?? prev
      if (take < held.notes.length) carried = { ...held, notes: held.notes.slice(take) }
      else last = held.midi
    }
    let whole: readonly NonNullable<GuideNote['pitch']>[] | null = null // this bar's last whole cell
    while (k < slots) {
      if (c.turn && whole && slots - k < whole.length) {
        // the turn-back: not an arpeggio of its own, so the count and the chord's cells stay
        const back = whole.slice(0, -1).reverse().slice(0, slots - k)
        play(back)
        prev = back.at(-1)?.midi ?? prev
        break
      }
      const n = nth.get(s.chord) ?? 0
      const { order, up, midi: placed } = c.next(prev, count, last, n)
      const midi: readonly number[] = placed ?? place(order.map((i) => pcOf(t[i] ?? (t[0] as Spelled))), up, range, prev)
      const cell = order.map((i, j) => ({ ...(t[i] ?? (t[0] as Spelled)), midi: midi[j] ?? 0 }))
      const take = Math.min(cell.length, slots - k)
      play(cell.slice(0, take))
      whole = take === cell.length ? cell : null
      carried = c.carry && take < cell.length ? { chord: s.chord, notes: cell.slice(take), midi } : null
      prev = midi[take - 1] ?? prev
      last = midi.slice(0, take)
      count++
      nth.set(s.chord, n + 1)
    }
  }
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, missing }
}

/** the arpeggio line's voice: each chord's 7th chord arpeggio cells in the pattern (cellVoices) */
export function arpeggioVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  pattern: ArpeggioPattern,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  return cellVoices(chords, part, beats, keySig, (c) => arpeggioCells(part, c, pattern))
}
