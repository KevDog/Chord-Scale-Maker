/**
 * Laying a rhythm over the sheet's drawn bars (rhythm spec §4): each bar's events, the landings, and the caption.
 * Pure TypeScript; the notation (Task 5's notes, beams and brackets) reads these events.
 */
import { rhythmLabel, rhythmOf, type RhythmId } from './library'
import { PULSE_PER_BEAT, type Cell, type Pulse } from './rhythm'

/**
 * One note, rest or tied piece in a bar. `at` and `length` are in pulses from the bar's start; `statement` is the
 * unit statement's index on the sheet for a repeating rhythm, and the beat's index in the bar for a per-bar one.
 */
export type RhythmEvent = Readonly<{
  at: number
  length: number
  rest: boolean
  accent: boolean
  tiedIn: boolean
  tie: boolean
  statement: number
}>

/**
 * `unit` is a repeating rhythm's statement length in pulses (0 for a per-bar one); `starts` is each bar's first
 * pulse in the stream, so a statement can be found at any pulse.
 */
export type Laid = Readonly<{
  pulse: Pulse
  kind: 'repeat' | 'bar'
  bars: readonly (readonly RhythmEvent[])[]
  landings: readonly number[]
  unit: number
  starts: readonly number[]
}>

/** A note (an attack and its following `_`) or one rest cell, in stream pulses. */
type Segment = Readonly<{ start: number; length: number; rest: boolean; accent: boolean }>

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

/**
 * Cells to notes: a `_` holds the note before it, but sounds as an attack first on the sheet, after a rest, or at a
 * break (a pulse no tie crosses, as into a 2nd ending) (§2).
 */
function segments(cells: readonly Cell[], breaks: ReadonlySet<number>): readonly Segment[] {
  return cells.reduce<Segment[]>((out, c, i) => {
    const last = out.at(-1)
    if (c === '.') return [...out, { start: i, length: 1, rest: true, accent: false }]
    if (c === '_' && last && !last.rest && !breaks.has(i)) return [...out.slice(0, -1), { ...last, length: last.length + 1 }]
    return [...out, { start: i, length: 1, rest: false, accent: c === '>x' }]
  }, [])
}

/** A per-bar rhythm's cells over the sheet: each bar's own, then each run's attacks spilled past its barline (§3). */
function perBarCells(
  bar: (beats: number) => readonly Cell[],
  n: number,
  k: number,
  beats: readonly number[],
  lengths: readonly number[],
  starts: readonly number[],
  total: number,
): readonly Cell[] {
  const cells: Cell[] = Array.from({ length: total }, (): Cell => '.')
  beats.forEach((b, i) => bar(b).forEach((c, p) => (cells[starts[i]! + p] = c)))
  // after every bar's own cells, so the spill merges with them; a bar too short to start its run has no spill
  // either, and the sheet's last bar drops what passes its end
  lengths.forEach((len, i) => {
    if (k < len) for (let j = len; j < k + n && starts[i]! + j < total; j++) cells[starts[i]! + j] = 'x'
  })
  return cells
}

/** The pieces of the segments that fall in one bar, tied where a note crosses its barlines, rests merged per statement. */
function barEvents(segs: readonly Segment[], start: number, length: number, statement: (at: number) => number): readonly RhythmEvent[] {
  const end = start + length
  return segs
    .filter(s => s.start < end && s.start + s.length > start)
    .map((s): RhythmEvent => {
      const from = Math.max(s.start, start)
      const to = Math.min(s.start + s.length, end)
      const tiedIn = !s.rest && s.start < start
      return {
        at: from - start,
        length: to - from,
        rest: s.rest,
        accent: s.accent && !tiedIn,
        tiedIn,
        tie: !s.rest && s.start + s.length > end,
        statement: statement(from - start),
      }
    })
    .reduce<RhythmEvent[]>((out, e) => {
      const last = out.at(-1)
      return last?.rest && e.rest && last.statement === e.statement
        ? [...out.slice(0, -1), { ...last, length: last.length + e.length }]
        : [...out, e]
    }, [])
}

/**
 * A rhythm laid over the drawn bars (each bar's length in beats, in sheet order), or null for Off or no bars.
 * breaks: the bars no tie runs into (a 2nd ending after the 1st): the stream keeps counting, but a note held into
 * one starts afresh there.
 */
export function layRhythm(id: RhythmId, bars: readonly number[], breaks: readonly number[] = []): Laid | null {
  const r = rhythmOf(id)
  if (!r || bars.length === 0) return null
  const pulse = r.kind === 'repeat' ? r.rhythm.pulse : r.pulse
  const per = PULSE_PER_BEAT[pulse]
  const lengths = bars.map(b => b * per)
  const starts = lengths.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + lengths[i - 1]!], [])
  const total = starts.at(-1)! + lengths.at(-1)!
  const cut = new Set(breaks.map(b => starts[b]).filter((p): p is number => p !== undefined))
  if (r.kind === 'repeat') {
    // a repeating rhythm as one stream: the cells, statement after statement, over the total of the bars' pulses;
    // then each note (an attack and its following '_') is cut at the barlines
    const unit = r.rhythm.cells.length
    const segs = segments(range(total).map(i => r.rhythm.cells[i % unit]!), cut)
    return {
      pulse,
      kind: 'repeat',
      bars: lengths.map((len, b) => barEvents(segs, starts[b]!, len, at => Math.floor((starts[b]! + at) / unit))),
      landings: range(bars.length).filter(b => starts[b]! % unit === 0),
      unit,
      starts,
    }
  }
  const segs = segments(perBarCells(r.bar, r.n, r.k, bars, lengths, starts, total), cut)
  return {
    pulse,
    kind: 'bar',
    bars: lengths.map((len, b) => barEvents(segs, starts[b]!, len, at => Math.floor(at / per))),
    landings: [],
    unit: 0,
    starts,
  }
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

const MAX_LISTED = 6

/** "Rhythm: <label> · <cycle>" for a repeating rhythm, "Rhythm: <label>" for a per-bar one (§4). */
export function rhythmCaption(id: RhythmId, laid: Laid, bars: readonly number[]): string {
  const caption = `Rhythm: ${rhythmLabel(id)}`
  const r = rhythmOf(id)
  if (!r || r.kind === 'bar') return caption
  const { landings } = laid
  if (landings.length === 1 && landings[0] === 0) return `${caption} · never back on one`
  if (bars.every(b => b === bars[0])) {
    const unit = r.rhythm.cells.length
    const bar = bars[0]! * PULSE_PER_BEAT[r.rhythm.pulse]
    const n = unit / gcd(unit, bar)
    return `${caption} · back on one every ${n === 1 ? 'bar' : `${n} bars`}`
  }
  const listed = landings.slice(0, MAX_LISTED).map(b => b + 1)
  return `${caption} · back on one at bars ${listed.join(', ')}${landings.length > MAX_LISTED ? ', …' : ''}`
}
