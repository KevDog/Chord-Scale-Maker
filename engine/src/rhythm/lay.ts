/**
 * Laying a rhythm over the sheet's drawn bars (rhythm spec §4): each bar's events, the landings, and the caption.
 * Pure TypeScript; the notation (Task 5's notes, beams and brackets) reads these events.
 */
import type { Feel } from './feel'
import { rhythmLabel, rhythmOf, type RhythmId } from './library'
import { rhythmPathCaption, type RhythmPath, type RhythmSteps } from './path'
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
 * its fallback where the pulse's group doesn't fit the bar (Phase 4 spec §1, D11). `steps` is the plan as laid
 * (Phase 4 spec §3), one entry for a bare id; `pulse` and `unit` are step 0's.
 */
export type Laid = Readonly<{
  pulse: Pulse
  pulses: readonly Pulse[]
  kind: 'repeat' | 'bar'
  bars: readonly (readonly RhythmEvent[])[]
  landings: readonly number[]
  unit: number
  starts: readonly number[]
  steps: readonly LaidStep[]
}>

/** One entry of a plan as laid: its first drawn bar, its id, and its unit (a repeating rhythm's statement length, else 0). */
export type LaidStep = Readonly<{ from: number; id: RhythmId; unit: number }>

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

type Rhythmic = NonNullable<ReturnType<typeof rhythmOf>>

/** A rhythm's own pulse. */
export const pulseOf = (r: Rhythmic): Pulse => (r.kind === 'repeat' ? r.rhythm.pulse : r.pulse)

/** A plan's entries over `n` drawn bars: a bare id is one entry; entries past the sheet are dropped. */
export const stepsOf = (id: RhythmId | RhythmSteps, n: number): RhythmSteps =>
  typeof id === 'string' ? [{ from: 0, id }] : id.filter(s => s.from < n)

/**
 * A rhythm laid over the drawn bars (each bar's length in beats, in sheet order), or null for Off or no bars.
 * id: a rhythm, or a plan (Phase 4 spec §3) whose entries each start afresh on their first bar, as at a break (D14):
 * each has its own stream, landings and statements (the statements numbered on through the sheet).
 * breaks: the bars no tie runs into (a 2nd ending after the 1st): the stream keeps counting, but a note held into
 * one starts afresh there.
 * force: stream pulses that sound as attacks whatever the rhythm has there (pulses outside the sheet are ignored).
 */
export function layRhythm(id: RhythmId | RhythmSteps, bars: readonly number[], breaks: readonly number[] = [], force: readonly number[] = []): Laid | null {
  const steps = stepsOf(id, bars.length)
  const rs = steps.map(s => rhythmOf(s.id))
  if (bars.length === 0 || steps[0]?.from !== 0 || !rs.every((r): r is Rhythmic => r !== null)) return null
  const parts: Omit<Laid, 'steps'>[] = []
  let first = 0 // the step's first stream pulse
  let base = 0 // the step's first statement
  steps.forEach((s, i) => {
    const to = steps[i + 1]?.from ?? bars.length
    const own = bars.slice(s.from, to)
    const total = own.reduce((a, b) => a + pulsesIn(pulseOf(rs[i]!), b), 0)
    // a step's first bar is a break by its own stream starting there, so only the breaks inside it are passed
    const part = layStep(
      rs[i]!,
      own,
      breaks.filter(b => b > s.from && b < to).map(b => b - s.from),
      force.filter(p => p >= first && p < first + total).map(p => p - first),
      base,
    )
    parts.push({ ...part, starts: part.starts.map(p => p + first), landings: part.landings.map(b => b + s.from) })
    first += total
    if (part.unit > 0) base += Math.ceil(total / part.unit)
  })
  const [head] = parts
  return {
    ...head!,
    pulses: parts.flatMap(p => p.pulses),
    bars: parts.flatMap(p => p.bars),
    landings: parts.flatMap(p => p.landings),
    starts: parts.flatMap(p => p.starts),
    steps: steps.map((s, i) => ({ from: s.from, id: s.id, unit: parts[i]!.unit })),
  }
}

/**
 * The statement at pulse `at` of drawn bar `b` of a repeating rhythm, as `layRhythm` numbers them: counted from the
 * bar's step's first bar, and on through the sheet (Phase 4 spec §3).
 */
export function statementAt(laid: Laid, b: number): (at: number) => number {
  const s = Math.max(0, laid.steps.findLastIndex(st => st.from <= b))
  const startOf = (k: number): number => laid.starts[laid.steps[k]!.from]!
  const base = laid.steps.slice(0, s).reduce((n, st, k) => n + Math.ceil((startOf(k + 1) - startOf(k)) / st.unit), 0)
  const { unit } = laid.steps[s]!
  return at => base + Math.floor((laid.starts[b]! - startOf(s) + at) / unit)
}

/** One step's rhythm laid over its own bars, its stream from 0, its statements numbered from `base`. */
function layStep(r: Rhythmic, bars: readonly number[], breaks: readonly number[], force: readonly number[], base: number): Omit<Laid, 'steps'> {
  const pulse = pulseOf(r)
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
      bars: lengths.map((len, b) => barEvents(segs, starts[b]!, len, at => base + Math.floor((starts[b]! + at) / unit))),
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

/**
 * "Rhythm: <label> · <cycle>" for a repeating rhythm, "Rhythm: <label>" for a per-bar one (§4). With a path that acts
 * on it, "Rhythm: <label> · <path> · <step>" instead: the step marks say where each grouping starts (Phase 4 spec §3).
 * A Feel in 2 or in 1 appends " · in 2" or " · in 1" (Phase 4 spec D21).
 */
export function rhythmCaption(id: RhythmId, laid: Laid, path?: RhythmPath, feel: Feel = 4): string {
  return feel === 4 ? laidCaption(id, laid, path) : `${laidCaption(id, laid, path)} · in ${feel}`
}

function laidCaption(id: RhythmId, laid: Laid, path?: RhythmPath): string {
  const onPath = rhythmPathCaption(id, path)
  if (onPath) return `Rhythm: ${onPath}`
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
