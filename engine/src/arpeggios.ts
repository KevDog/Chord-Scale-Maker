import { type Approach, approachNotes, scaleStepsBelow } from './approaches'
import { isRest, parseChord, writtenChordRootLenient } from './chord'
import type { GuideInput, GuideLine, GuideNote } from './guideTones'
import { drawnLengths, voiceAccidentals } from './noteValues'
import { barAt, barLength, barStart, type Metre } from './metre'
import type { Range } from './instruments'
import { type Part, rangeOf, writtenScale } from './part'
import { pcOf, type Spelled } from './pitch'
import { baseQuality } from './qualities'
import { spellFrom } from './scales'
import { orNull } from './util'
import { lineRhythm, type LineRhythm, type LineSpan, type RhythmPlan } from './rhythm/pour'
import { restPieces, type RhythmNote, type RhythmValue } from './rhythm/notation'
import { PULSE_PER_BEAT, type Pulse } from './rhythm/rhythm'

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
 * where a line likes to sit: the range less a 4th below and a major 3rd above (vibes F3–F6: B♭3–C♯6), at least an
 * octave (a narrower one reaches down to the octave below its top)
 */
export function comfortBand(range: Range): Readonly<{ lo: number; hi: number }> {
  const hi = range.hi - 4
  return { lo: Math.max(range.lo, Math.min(range.lo + 5, hi - 12)), hi }
}

/**
 * a figure placed whole: of the octaves its first note (pitch class first) can start on, at(m) giving its pitches from
 * m, the one with the fewest notes out of range, then the fewest out of the comfort band when half its notes or more
 * are (so a line moving one way turns back rather than drift to the range's edge), then (rule 4) its first note
 * nearest prev, nearer the centre, the lower; a run's start (prev null, rule 5) at the octave whose notes average
 * nearest the centre (a tie: the higher)
 */
export function placeWhole(first: number, at: (m: number) => readonly number[], range: Range, prev: number | null): readonly number[] {
  const band = comfortBand(range)
  const drifted = (outside: number, of: number): number => (2 * outside >= of ? outside : 0) // a note or so past the band is the line's own reach
  const options: { midi: readonly number[]; out: number; outBand: number }[] = []
  for (let m = range.lo - 12; m <= range.hi + 12; m++) {
    if (((m % 12) + 12) % 12 !== first) continue
    const midi = at(m)
    options.push({ midi, out: midi.filter((x) => x < range.lo || x > range.hi).length, outBand: drifted(midi.filter((x) => x < band.lo || x > band.hi).length, midi.length) })
  }
  const avg = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length
  const key = (o: (typeof options)[number]): readonly number[] => {
    const m = o.midi[0] ?? 0
    return prev === null ? [o.out, Math.abs(avg(o.midi) - range.centre), -m] : [o.out, o.outBand, Math.abs(m - prev), Math.abs(m - range.centre), m]
  }
  const cmp = (a: readonly number[], b: readonly number[]): number => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0)
  return [...options].sort((a, b) => cmp(key(a), key(b)))[0]?.midi ?? at(range.centre)
}

/** one arpeggio's pitches: each note the next of its pitch class above (up) or below (down) the last, placed whole */
function place(pcs: readonly number[], up: boolean, range: Range, prev: number | null): readonly number[] {
  const rel = pcs.reduce<number[]>((acc, pc, i) => {
    if (i === 0) return [0]
    const last = pcs[i - 1] ?? pc
    const step = up ? ((pc - last + 11) % 12) + 1 : -(((last - pc + 11) % 12) + 1)
    return [...acc, (acc[i - 1] ?? 0) + step]
  }, [])
  return placeWhole(pcs[0] ?? 0, (m) => rel.map((r) => m + r), range, prev)
}

/** a run's start: the octave with the fewest notes out of range, then the average nearest the centre (a tie: the higher) */
export function placeRun(pcs: readonly number[], up: boolean, range: Range): readonly number[] {
  return place(pcs, up, range, null)
}

const readable = (chord: string): boolean => orNull(() => parseChord(chord)) !== null

/** why a chord plays nothing: a diagnostic for the sheet */
const noTonesFor = (chord: string): string => `no chord tones for ${chord || 'an empty chord'} (${readable(chord) ? 'unknown chord quality' : "can't read the chord"})`

/** what follows a whole four-note cell (Cells.next) */
export type Follows = 'cell' | 'chord' | null

/**
 * a chord's cells: its tones, and the next cell's order (indexes into them) and direction, given the last note, the
 * run's count, the last cell's pitches, how many cells the chord has played and what follows a whole four-note cell
 * (follows, #379: 'cell', another whole cell of this chord; 'chord', the next chord; null: none, or this slot isn't
 * whole, or a turn-back or a cut cell follows); midi: its pitches where the cell placed
 * itself; carry: a cell the bar line cuts goes on into the chord's next bar (else it is dropped); turn: slots too few
 * for another whole cell turn back on the last one instead, from its second-to-last note (a 3/4 bar: 1 3 5 7 5 3, #348),
 * by bar ('bar': in each bar the chord lasts into) or by chord ('chord': only the chord's last slot, its slots counted
 * from its start across the bar lines, except in a bar that holds no whole number of four-note cells, which turns as
 * 'bar'); a turn-back is no cell of its own, so the run's count and the chord's cells stay
 */
export type Cells = Readonly<{
  tones: readonly Spelled[]
  next: (prev: number | null, count: number, last: readonly number[] | null, nth: number, follows?: Follows) => Readonly<{ order: readonly number[]; up: boolean; midi?: readonly number[] }>
  carry?: boolean
  turn?: 'bar' | 'chord'
}>

/** a chord's 7th chord arpeggio cells in a pattern; null if it has no tones */
export function arpeggioCells(part: Part, chord: GuideInput, pattern: ArpeggioPattern): Cells | null {
  const tones = arpeggioTones(part, chord.chord, chord.scale)
  return tones && { tones, next: (prev, count) => orderFor(pattern, tones, prev, count), turn: 'bar' }
}

/** a cell's notes, for what follows it (Follows) */
const CELL_NOTES = 4

/** where a cell's note goes: its bar (a clock bar, or under a rhythm a drawn bar), its beat in it and its length */
type Slot = Readonly<{ bar: number; beat: number; beats: number }>
/** a chord's part of one bar, or under a rhythm its whole span; slots: the notes it plays (none for a chord without cells) */
type Segment = Readonly<{ chord: number; bar: number; beat: number; at: number; length: number; slots: readonly Slot[] }>
/** a cell's notes the bar line cut, still to play in its chord's next bar; midi: the whole cell's; cell: its notes (none for a turn-back) */
type Carried = Readonly<{ chord: number; notes: readonly NonNullable<GuideNote['pitch']>[]; midi: readonly number[]; cell?: readonly NonNullable<GuideNote['pitch']>[] }>

/**
 * a line of four-note cells for chords in time order (the arpeggio line's rules, docs/superpowers/specs/2026-10-12-seventh-chord-arpeggios-design.md):
 * by timeline bar, the bar's notes, each bar in its own note value (rule 2), each chord's slots filled by cell after
 * cell (rule 3, again in each bar it lasts into), each placed whole nearest the last note in the part's range; a chord
 * without cells rests and ends the run (rule 6); accidentals by the measure rule against keySig (null: C).
 * missing: a diagnostic per chord without cells. valueOf: a chord's note value from its whole length and its bar's
 * shortest segment (default: the bar's, noteValue). approach: a figure into each chord's first note in place of the
 * chord before's last notes (withApproach). rhythm: pour the cells into a rhythm's attacks in place of the note
 * values (rhythm-on-lines spec §4; pourVoices), each chord's span one segment counted by chord; Off: as without one.
 */
export function cellVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  cellsOf: (chord: GuideInput, index: number) => Cells | null,
  valueOf: (chordBeats: number, barShortest: number) => NoteValue = (_, shortest) => noteValue(shortest),
  approach: Approach = 'none',
  rhythm?: RhythmPlan,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  const range = rangeOf(part)
  const missing: string[] = []
  const cells = chords.map((c, i) => {
    const found = cellsOf(c, i)
    if (!found && !isRest(c.chord) && !missing.includes(noTonesFor(c.chord))) missing.push(noTonesFor(c.chord))
    return found
  })
  const poured = rhythm ? lineRhythm(rhythm.id, rhythm.bars, rhythm.breaks, lineSpans(chords, cells, beats, rhythm), rhythm.start, rhythm.anticipate) : null
  const segments: readonly Segment[] = poured ? spanSegments(chords, poured, beats) : barSegments(chords, cells, beats, valueOf)

  const played: Played[] = []
  let prev: number | null = null
  let last: readonly number[] | null = null
  let count = 0
  const nth = new Map<number, number>() // cells each chord has played
  let carried = null as Carried | null
  let whole: readonly NonNullable<GuideNote['pitch']>[] | null = null // the last whole cell: this bar's, or by chord this chord's
  let wholeOf = -1
  for (const [si, s] of segments.entries()) {
    const c = cells[s.chord]
    if (!c) {
      // under a rhythm, its attacks rest when the bars are built (pourVoices)
      let beat = s.beat
      for (const piece of poured ? [] : drawnLengths(s.length)) {
        played.push({ chord: s.chord, bar: s.bar, note: { pitch: null, beat, beats: piece, tie: false, tiedIn: false, accidental: null } })
        beat += piece
      }
      prev = null
      last = null
      count = 0
      carried = null
      continue
    }
    const t = c.tones
    const v = s.slots[0]?.beats ?? 1 // without a rhythm, every slot's note value; with no slots nothing plays, so any will do
    const slots = s.slots.length
    const byChord = poured !== null || (c.turn === 'chord' && Math.round(barLength(beats, s.bar) / v) % 4 === 0)
    if (!byChord || wholeOf !== s.chord) whole = null
    wholeOf = s.chord
    const end = (chords[s.chord]?.start ?? 0) + (chords[s.chord]?.beats ?? 0)
    let k = 0
    const play = (notes: readonly NonNullable<GuideNote['pitch']>[]): void => {
      for (const pitch of notes) {
        const at = s.slots[k++]
        if (!at) return // callers take no more notes than slots are left
        played.push({ chord: s.chord, bar: at.bar, note: { pitch, beat: at.beat, beats: at.beats, tie: false, tiedIn: false, accidental: null } })
      }
    }
    /** what follows a cell from slot k, left slots before it (CELL_NOTES each) */
    const followsAt = (k: number, left: number): Follows => {
      const rest = slots - k - CELL_NOTES // this bar's slots after it
      const after = left - CELL_NOTES // the chord's (by chord) or the bar's
      if (rest < 0 || (after > 0 && after < CELL_NOTES)) return null // not whole, or a turn-back or a cut cell follows
      if (rest >= CELL_NOTES) return 'cell'
      if (rest > 0) return null // the bar line cuts the next cell
      if (s.at + s.length >= end) return 'chord'
      const on = segments[si + 1] // the chord's next bar
      return on !== undefined && on.slots.length >= CELL_NOTES ? 'cell' : null
    }
    const held: Carried | null = carried?.chord === s.chord ? carried : null
    carried = null
    if (held) {
      const take = Math.min(held.notes.length, slots)
      play(held.notes.slice(0, take))
      prev = held.notes[take - 1]?.midi ?? prev
      if (take < held.notes.length) carried = { ...held, notes: held.notes.slice(take) }
      else {
        last = held.midi
        if (byChord && held.cell) whole = held.cell
      }
    }
    while (k < slots) {
      const left = byChord && !poured ? Math.round((end - s.at - k * v) / v) : slots - k // slots left: the chord's, or the bar's (under a rhythm, the chord's attacks)
      if (c.turn && whole && left < whole.length) {
        // the turn-back: not an arpeggio of its own, so the count and the chord's cells stay
        const back = whole.slice(0, -1).reverse().slice(0, left)
        const take = Math.min(back.length, slots - k)
        play(back.slice(0, take))
        prev = back[take - 1]?.midi ?? prev
        if (take < back.length) carried = { chord: s.chord, notes: back.slice(take), midi: last ?? [] }
        break
      }
      const n = nth.get(s.chord) ?? 0
      const { order, up, midi: placed } = c.next(prev, count, last, n, followsAt(k, left))
      const midi: readonly number[] = placed ?? place(order.map((i) => pcOf(t[i] ?? (t[0] as Spelled))), up, range, prev)
      const cell = order.map((i, j) => ({ ...(t[i] ?? (t[0] as Spelled)), midi: midi[j] ?? 0 }))
      const take = Math.min(cell.length, slots - k)
      play(cell.slice(0, take))
      whole = take === cell.length ? cell : null
      carried = c.carry && take < cell.length ? { chord: s.chord, notes: cell.slice(take), midi, cell } : null
      prev = midi[take - 1] ?? prev
      last = midi.slice(0, take)
      // a cell cut off (not carried on) before half of it is heard isn't a turn: Up & down picks up its direction (#433)
      const dropped = take < cell.length && !(carried && s.at + s.length < end)
      if (!dropped || take * 2 >= cell.length) count++
      nth.set(s.chord, n + 1)
    }
  }
  if (poured && rhythm) {
    const all = [...played, ...pickups(poured, played, chords, part)]
    return { bars: pourVoices(poured, rhythm, approach === 'none' ? all : withApproach(all, chords, part, approach), keySig), missing }
  }
  const bars = new Map<number, GuideNote[]>()
  for (const { bar, note } of approach === 'none' ? played : withApproach(played, chords, part, approach)) bars.set(bar, [...(bars.get(bar) ?? []), note])
  for (const [bar, v] of bars) bars.set(bar, voiceAccidentals(v, keySig))
  return { bars, missing }
}

/** a chord's part of each bar it lasts into, its slots that bar's note value (valueOf) apart: the line without a rhythm */
function barSegments(
  chords: readonly GuideInput[],
  cells: readonly (Cells | null)[],
  beats: Metre,
  valueOf: (chordBeats: number, barShortest: number) => NoteValue,
): readonly Segment[] {
  const bare = chords.flatMap((c, chord) => {
    const out: Omit<Segment, 'slots'>[] = []
    for (let at = c.start; at < c.start + c.beats; ) {
      const bar = barAt(beats, at)
      const from = barStart(beats, bar)
      const length = Math.min(c.start + c.beats, from + barLength(beats, bar)) - at
      out.push({ chord, bar, beat: at - from, at, length })
      at += length
    }
    return out
  })
  const shortest = new Map<number, number>()
  for (const s of bare) shortest.set(s.bar, Math.min(shortest.get(s.bar) ?? Infinity, s.length))
  return bare.map((s) => {
    if (!cells[s.chord]) return { ...s, slots: [] }
    const v = valueOf(chords[s.chord]?.beats ?? s.length, shortest.get(s.bar) ?? s.length)
    return { ...s, slots: Array.from({ length: Math.round(s.length / v) }, (_, k) => ({ bar: s.bar, beat: s.beat + k * v, beats: v })) }
  })
}

/** each chord's start in sheet beats (its clock bar's drawn bar), and whether the line plays it (rhythm-on-lines spec §2) */
function lineSpans(chords: readonly GuideInput[], cells: readonly (Cells | null)[], beats: Metre, rhythm: RhythmPlan): readonly LineSpan[] {
  const before = (d: number): number => rhythm.bars.slice(0, d).reduce((a, b) => a + b, 0)
  return chords.map((c, j) => {
    const bar = barAt(beats, c.start)
    const drawn = rhythm.clockBars.indexOf(bar)
    // a chord in an undrawn bar has no sheet beats: an empty span where the next drawn bar starts
    if (drawn < 0) {
      const next = rhythm.clockBars.findIndex((b) => b > bar)
      return { at: before(next < 0 ? rhythm.bars.length : next), sounds: false }
    }
    return { at: before(drawn) + c.start - barStart(beats, bar), sounds: cells[j] !== null && !isRest(c.chord) }
  })
}

/** a rhythm value's length in beats (in a triplet, ⅔ of it) */
const VALUE_BEATS: Readonly<Record<RhythmValue, number>> = { w: 4, hd: 3, h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25 }
const valueBeats = (n: RhythmNote): number => VALUE_BEATS[n.value] * (n.tuplet === null ? 1 : 2 / 3)

/** under a rhythm, a segment a chord: its span's poured attacks (§3.3: owned, below 0), in order, in drawn bars */
function spanSegments(chords: readonly GuideInput[], poured: LineRhythm, beats: Metre): readonly Segment[] {
  const slots = chords.map((): Slot[] => [])
  poured.bars.forEach((bar, d) =>
    bar.forEach((n, i) => {
      const owner = poured.owners[d]?.[i]
      if (owner && owner.below === 0 && !n.rest && !n.tiedIn) slots[owner.chord]?.push({ bar: d, beat: n.beat, beats: valueBeats(n) })
    }),
  )
  return chords.map((c, chord) => ({ chord, bar: barAt(beats, c.start), beat: c.start - barStart(beats, barAt(beats, c.start)), at: c.start, length: c.beats, slots: slots[chord] ?? [] }))
}

/**
 * the scale-below pick-ups (§3.4): each the m-th step below its chord's first poured pitch in the chord's shown scale,
 * written for the part; none where there is no scale, no poured pitch, or the note is out of the part's range
 */
function pickups(poured: LineRhythm, played: readonly Played[], chords: readonly GuideInput[], part: Part): readonly Played[] {
  const range = rangeOf(part)
  const firstOf = new Map<number, NonNullable<GuideNote['pitch']>>() // each chord's first poured pitch
  for (const p of played) if (p.note.pitch && !firstOf.has(p.chord)) firstOf.set(p.chord, p.note.pitch)
  return poured.bars.flatMap((bar, d) =>
    bar.flatMap((n, i): Played[] => {
      const owner = poured.owners[d]?.[i]
      if (!owner || owner.below === 0 || n.rest || n.tiedIn) return []
      const first = firstOf.get(owner.chord)
      const c = chords[owner.chord]
      const text = c?.shown ?? c?.scale
      const scale = text ? orNull(() => writtenScale(part, text).notes) : null
      const pitch = first ? scaleStepsBelow(first, owner.below, scale)?.[0] : undefined
      if (!pitch || pitch.midi < range.lo || pitch.midi > range.hi) return []
      return [{ chord: owner.chord, bar: d, pickup: true, note: { pitch, beat: n.beat, beats: valueBeats(n), tie: false, tiedIn: false, accidental: null } }]
    }),
  )
}

/**
 * the poured line's voices by clock bar: each of the rhythm's notes with its attack's pitch (played, by drawn bar and
 * beat), a tied-in piece its attack's, anything else a rest in the rhythm's own value; accidentals by the measure
 */
function pourVoices(poured: LineRhythm, rhythm: RhythmPlan, played: readonly Played[], keySig: string | null): ReadonlyMap<number, readonly GuideNote[]> {
  const pitchAt = new Map(played.map((p) => [`${p.bar}:${p.note.beat}`, p.note.pitch]))
  const bars = new Map<number, readonly GuideNote[]>()
  let held: GuideNote['pitch'] = null // the last attack's pitch: a tied-in piece sounds it, across barlines too
  poured.bars.forEach((bar, d) => {
    const voice: GuideNote[] = []
    for (const [i, n] of bar.entries()) {
      if (!n.tiedIn) held = n.rest || !poured.owners[d]?.[i] ? null : (pitchAt.get(`${d}:${n.beat}`) ?? null)
      const pitch = n.rest ? null : held
      voice.push({ pitch, beat: n.beat, beats: valueBeats(n), tie: !!pitch && n.tie, tiedIn: !!pitch && n.tiedIn, accidental: null, mark: { value: n.value, tuplet: n.tuplet, beam: n.beam, accent: !!pitch && n.accent } })
    }
    const silent = voice.map((n, i) => !n.pitch && !poured.owners[d]?.[i])
    bars.set(rhythm.clockBars[d] ?? d, voiceAccidentals(mergeSilence(voice, silent, poured.laid.pulse), keySig))
  })
  return bars
}

/**
 * a bar's silences (its rhythm's rests and the attacks no chord plays, as under N.C.) merged within each beat and
 * notated as a rest is (rhythm spec §6.2, §6.3), so a bar no chord plays under 16ths draws a rest a beat, not sixteen;
 * a scale-below pick-up out of range keeps its own rest
 */
function mergeSilence(voice: readonly GuideNote[], silent: readonly boolean[], pulse: Pulse): readonly GuideNote[] {
  const per = PULSE_PER_BEAT[pulse]
  const pulseOf = (beat: number): number => Math.round(beat * per)
  const runs = voice.reduce<GuideNote[][]>((out, n, i) => {
    const last = out.at(-1)
    const prev = voice[i - 1]
    const joins = silent[i] && prev && silent[i - 1] && last && Math.floor(pulseOf(n.beat) / per) === Math.floor(pulseOf(last[0]!.beat) / per)
    return joins ? [...out.slice(0, -1), [...last, n]] : [...out, [n]]
  }, [])
  return runs.flatMap((run) => {
    const first = run[0]!
    if (run.length === 1) return run
    const at = pulseOf(first.beat)
    const length = run.reduce((a, n) => a + pulseOf(n.beat + n.beats) - pulseOf(n.beat), 0)
    return restPieces(at, length, per, pulse === '8t').map((p): GuideNote => {
      const tuplet = p.triplet ? (first.mark?.tuplet ?? null) : null
      return { ...first, beat: p.at / per, beats: VALUE_BEATS[p.value] * (tuplet === null ? 1 : 2 / 3), mark: { value: p.value, tuplet, beam: null, accent: false } }
    })
  })
}

/** a chord's played note: pickup, a scale-below pick-up (the Approach never touches it) */
type Played = Readonly<{ chord: number; bar: number; note: GuideNote; pickup?: true }>

/**
 * a line's notes with a figure into each chord's first note (#381) in place of the chord before's last notes, each
 * keeping that note's beat and length (the whole figure, though a note of it repeats the one before: the slots are
 * the line's); none for the first chord, after or into a rest, across a gap, where the chord before would keep none of its own notes,
 * the figure needs a scale the chord before doesn't have, or a note of it is out of the part's range; a scale-below
 * pick-up is neither a target nor the chord before's own (rhythm-on-lines spec D24)
 */
function withApproach(played: readonly Played[], chords: readonly GuideInput[], part: Part, approach: Approach): readonly Played[] {
  const range = rangeOf(part)
  const out = [...played]
  chords.forEach((c, j) => {
    const before = chords[j - 1]
    if (!before || isRest(c.chord) || isRest(before.chord) || before.start + before.beats !== c.start) return
    const target = out.find((p) => p.chord === j && !p.pickup)?.note.pitch
    const own = out.flatMap((p, i) => (p.chord === j - 1 && p.note.pitch && !p.pickup ? [i] : []))
    if (!target) return
    const text = before.shown ?? before.scale
    const all = approachNotes(target, approach, text ? orNull(() => writtenScale(part, text).notes) : null)
    if (!all || all.some((n) => n.midi < range.lo || n.midi > range.hi)) return
    const figure = all
    if (!figure.length || own.length - figure.length < 1) return
    figure.forEach((pitch, k) => {
      const i = own[own.length - figure.length + k] as number
      const p = out[i] as Played
      out[i] = { ...p, note: { ...p.note, pitch } }
    })
  })
  return out
}

/** the arpeggio line's voice: each chord's 7th chord arpeggio cells in the pattern (cellVoices) */
export function arpeggioVoices(
  chords: readonly GuideInput[],
  part: Part,
  beats: Metre,
  keySig: string | null,
  pattern: ArpeggioPattern,
  approach: Approach = 'none',
  rhythm?: RhythmPlan,
): { bars: ReadonlyMap<number, readonly GuideNote[]>; missing: readonly string[] } {
  return cellVoices(chords, part, beats, keySig, (c) => arpeggioCells(part, c, pattern), undefined, approach, rhythm)
}
