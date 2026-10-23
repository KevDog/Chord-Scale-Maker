/**
 * Laying a rhythm over the sheet's drawn bars (rhythm spec §4): each bar's events, the landings, and the caption.
 * Pure TypeScript; the notation (Task 5's notes, beams and brackets) reads these events.
 */
import { rhythmLabel, rhythmOf, type RhythmId } from './library'
import { barPulse, pulseBeat, pulsesIn, range, type Cell, type Pulse } from './rhythm'

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
 * pulse in the stream, so a statement can be found at any pulse. `pulse` is the rhythm's; `pulses` is each bar's,
 * its fallback where the pulse's group doesn't fit the bar (Phase 4 spec §1, D11).
 */
export type Laid = Readonly<{
  pulse: Pulse
  pulses: readonly Pulse[]
  kind: 'repeat' | 'bar'
  bars: readonly (readonly RhythmEvent[])[]
  landings: readonly number[]
  unit: number
  starts: readonly number[]
}>

/** A note (an attack and its following `_`) or one rest cell, in stream pulses. */
type Segment = Readonly<{ start: number; length: number; rest: boolean; accent: boolean }>

/**
 * Cells to notes: a `_` holds the note before it, but sounds as an attack first on the sheet, after a rest, or at a
 * break (a pulse no tie crosses, as into a 2nd ending) (§2).
 */
function segments(cells: readonly Cell[], breaks: ReadonlySet<number>): readonly Segment[] {
  const out: Segment[] = [] // built in place: a spread per cell is quadratic over a long sheet
  cells.forEach((c, i) => {
    const last = out.at(-1)
    if (c === '_' && last && !last.rest && !breaks.has(i)) out[out.length - 1] = { ...last, length: last.length + 1 }
    else out.push({ start: i, length: 1, rest: c === '.', accent: c === '>x' })
  })
  return out
}

/** The cells with each forced pulse inside the sheet made an attack: `>x` stays accented, `.` and `_` become `x` (lines spec §3.2). */
const forced = (cells: readonly Cell[], force: readonly number[]): readonly Cell[] =>
  cells.map((c, i): Cell => (force.includes(i) && (c === '.' || c === '_') ? 'x' : c))

/** The drawn bars in pulses: each bar's length in beats and in pulses, its first pulse in the stream, and the total. */
type Sheet = Readonly<{ beats: readonly number[]; lengths: readonly number[]; starts: readonly number[]; total: number }>

/** A per-bar rhythm's cells over the sheet: each bar's own, then each run's attacks spilled past its barline (§3). */
function perBarCells({ bar, n, k }: Readonly<{ bar: (beats: number) => readonly Cell[]; n: number; k: number }>, { beats, lengths, starts, total }: Sheet): readonly Cell[] {
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
      if (last?.rest && e.rest && last.statement === e.statement) out[out.length - 1] = { ...last, length: last.length + e.length }
      else out.push(e)
      return out
    }, [])
}

/**
 * A rhythm laid over the drawn bars (each bar's length in beats, in sheet order), or null for Off or no bars.
 * breaks: the bars no tie runs into (a 2nd ending after the 1st): the stream keeps counting, but a note held into
 * one starts afresh there.
 * force: stream pulses that sound as attacks whatever the rhythm has there (pulses outside the sheet are ignored).
 */
export function layRhythm(id: RhythmId, bars: readonly number[], breaks: readonly number[] = [], force: readonly number[] = []): Laid | null {
  const r = rhythmOf(id)
  if (!r || bars.length === 0) return null
  const pulse = r.kind === 'repeat' ? r.rhythm.pulse : r.pulse
  // each bar at its own pulse (a fallback where the group doesn't fit); the stream counts cells through every bar
  const pulses = bars.map(b => barPulse(pulse, b))
  const lengths = bars.map(b => pulsesIn(pulse, b))
  let sum = 0
  const starts = lengths.map(len => (sum += len) - len)
  const total = sum
  const cut = new Set(breaks.map(b => starts[b]).filter((p): p is number => p !== undefined))
  if (r.kind === 'repeat') {
    // a repeating rhythm as one stream: the cells, statement after statement, over the total of the bars' pulses;
    // then each note (an attack and its following '_') is cut at the barlines
    const unit = r.rhythm.cells.length
    const segs = segments(forced(range(total).map(i => r.rhythm.cells[i % unit]!), force), cut)
    return {
      pulse,
      pulses,
      kind: 'repeat',
      bars: lengths.map((len, b) => barEvents(segs, starts[b]!, len, at => Math.floor((starts[b]! + at) / unit))),
      landings: range(bars.length).filter(b => starts[b]! % unit === 0),
      unit,
      starts,
    }
  }
  const segs = segments(forced(perBarCells(r, { beats: bars, lengths, starts, total }), force), cut)
  return {
    pulse,
    pulses,
    kind: 'bar',
    bars: lengths.map((len, b) => barEvents(segs, starts[b]!, len, at => Math.floor(pulseBeat(pulses[b]!, at)))),
    landings: [],
    unit: 0,
    starts,
  }
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Bars in a repeating rhythm's cycle: it is back on one when `unit` pulses fit a whole number of bars of `barPulses`. */
export const cycleBars = (unit: number, barPulses: number): number => unit / gcd(unit, barPulses)

const MAX_LISTED = 6

/** "Rhythm: <label> · <cycle>" for a repeating rhythm, "Rhythm: <label>" for a per-bar one (§4). */
export function rhythmCaption(id: RhythmId, laid: Laid): string {
  const caption = `Rhythm: ${rhythmLabel(id)}`
  if (laid.kind === 'bar') return caption
  const { landings, unit } = laid
  const pulses = laid.bars.map(events => events.reduce((n, e) => n + e.length, 0)) // each bar's length: its events fill it
  // bars of one length: the cycle, though a sheet shorter than it never gets there (#505)
  if (pulses.every(p => p === pulses[0])) {
    const n = cycleBars(unit, pulses[0]!)
    return `${caption} · back on one every ${n === 1 ? 'bar' : `${n} bars`}`
  }
  if (landings.length === 1 && landings[0] === 0) return `${caption} · never back on one`
  const listed = landings.slice(0, MAX_LISTED).map(b => b + 1)
  return `${caption} · back on one at bars ${listed.join(', ')}${landings.length > MAX_LISTED ? ', …' : ''}`
}
