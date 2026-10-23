/**
 * The rhythm card (Scales and Arpeggios spec §1), Notes per bar (§2) and a run poured into a rhythm (§3, §4): the
 * notes a staff's run draws, bar by bar. Pure TypeScript.
 */
import { cycleBars, layRhythm } from './lay'
import { rhythmOf, type RhythmId } from './library'
import { restPieces, rhythmNotes, tupletGroup, type RhythmNote, type RhythmValue, type TupletRatio } from './notation'
import { barPulse, PULSE_GRID, pulseAt, pulseBeat, pulsesIn, range, type Pulse } from './rhythm'

/** The longest card: a cycle longer than this is cut and the card says it continues. */
const MAX_CARD_BARS = 4

/** The card's bars of notes, whether the cycle was cut, and the bar length in beats it was laid in. */
export type RhythmCardModel = Readonly<{ bars: readonly (readonly RhythmNote[])[]; cut: boolean; beats: number }>

/**
 * A rhythm's card over bars of `beats` beats: its cycle (a repeating rhythm's `unit / gcd(unit, barPulses)` bars, a
 * per-bar rhythm's 1) up to four bars, laid with `layRhythm`; null for Off.
 */
export function cardBars(id: RhythmId, beats: number): RhythmCardModel | null {
  const r = rhythmOf(id)
  if (!r) return null
  const cycle = r.kind === 'repeat' ? cycleBars(r.rhythm.cells.length, pulsesIn(r.rhythm.pulse, beats)) : 1
  const laid = layRhythm(id, Array<number>(Math.min(cycle, MAX_CARD_BARS)).fill(beats))
  if (!laid) return null
  return { bars: rhythmNotes(laid), cut: cycle > MAX_CARD_BARS, beats }
}

/** Notes per bar (§2): Whole notes is today's staff; a number draws the run as that many even attacks a bar. */
export type NotesPerBar = 'whole' | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const NOTES_PER_BAR: readonly NotesPerBar[] = ['whole', 1, 2, 3, 4, 5, 6, 7]

export const NOTES_PER_BAR_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  NOTES_PER_BAR.map(n => [String(n), n === 'whole' ? 'Whole notes' : `${n} a bar`]),
)

export const isNotesPerBar = (x: unknown): x is NotesPerBar => (NOTES_PER_BAR as readonly unknown[]).includes(x)

/** One bar's tuplet: `notes` notes in the time of `of` notes of their value. */
export type BarTuplet = TupletRatio

/** A run note: the index of the note it plays (null: a rest), and its value and marks. */
export type RunNote = Readonly<{ note: number | null; mark: RhythmNote }>
export type RunBar = Readonly<{ notes: readonly RunNote[]; tuplet: BarTuplet | null }>
export type StaffRun = Readonly<{ beats: number; bars: readonly RunBar[] }>

const VALUE_BEATS: Readonly<Record<RhythmValue, number>> = { w: 4, hd: 3, h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25 }
const UNDOTTED: readonly RhythmValue[] = ['w', 'h', 'q', '8', '16']
const DOTTED: readonly RhythmValue[] = ['hd', 'qd', '8d']
/** a bar-long tuplet's values, longest first (§2 rule 3) */
const TUPLET_VALUES: readonly RhythmValue[] = ['h', 'q', '8', '16']
const BEAMED: ReadonlySet<RhythmValue> = new Set(['8', '16'])

/** Even runs are notated on a grid of 16ths. */
const GRID_PULSE: Pulse = '16'
const GRID = PULSE_GRID[GRID_PULSE].n

/**
 * A bar of `beats` beats as `n` even attacks (§2's four rules, in order): one note the bar long; an undotted value (or
 * two dotted); a bar-long tuplet of the longest value that fits; else quarters, `n` in the time of `beats`.
 */
export function evenBar(beats: number, n: number): Readonly<{ values: readonly RhythmValue[]; tuplet: BarTuplet | null }> {
  if (n === 1) return { values: restPieces(0, beats * GRID, GRID_PULSE).map(p => p.value), tuplet: null }
  const all = (v: RhythmValue): readonly RhythmValue[] => Array<RhythmValue>(n).fill(v)
  const each = beats / n
  const even = UNDOTTED.find(v => VALUE_BEATS[v] === each) ?? (n === 2 ? DOTTED.find(v => VALUE_BEATS[v] === each) : undefined)
  if (even) return { values: all(even), tuplet: null }
  const v = TUPLET_VALUES.find(v => beats <= n * VALUE_BEATS[v] && n * VALUE_BEATS[v] < 2 * beats && Number.isInteger(beats / VALUE_BEATS[v]))
  return v ? { values: all(v), tuplet: { notes: n, of: beats / VALUE_BEATS[v] } } : { values: all('q'), tuplet: { notes: n, of: beats } }
}

const mark = (beat: number, value: RhythmValue, rest: boolean, tuplet: number | null = null, ratio: TupletRatio | null = null): RhythmNote => ({
  beat,
  value,
  rest,
  accent: false,
  tie: false,
  tiedIn: false,
  tuplet,
  ratio,
  beam: null,
  bracket: null,
})

const WHOLE_BEATS: readonly number[] = [4, 3, 2, 1]

/**
 * A silence from `at` for `length` pulses, notated as `restPieces` does, except that a rest of whole beats starts on
 * a beat its length divides (§4's table: after an 8th on beat 1 of 4/4, `8 q h`, not `8 hd`). At a tuplet pulse,
 * whole groups take the beat's place (Phase 4 spec §2).
 */
function silence(at: number, length: number, pulse: Pulse): readonly RhythmNote[] {
  const { n, beats: group } = PULSE_GRID[pulse]
  const out: RhythmNote[] = []
  for (let p = at, left = length; left > 0; ) {
    const whole = (): number => WHOLE_BEATS.find(b => b % group === 0 && (b / group) * n <= left && pulseBeat(pulse, p) % b === 0)!
    const len = p % n !== 0 || left < n ? Math.min(left, n - (p % n)) : (whole() / group) * n
    out.push(...restPieces(p, len, pulse).map(r => mark(pulseBeat(pulse, r.at), r.value, true, r.ratio ? tupletGroup(pulse, r.at) : null, r.ratio)))
    p += len
    left -= len
  }
  return out
}

/** Every beamable note of a bar in one beam group, when there are two or more (§2). */
function beamBar(notes: readonly RunNote[]): readonly RunNote[] {
  const beamable = (n: RunNote): boolean => !n.mark.rest && BEAMED.has(n.mark.value)
  const group = notes.filter(beamable).length > 1
  return notes.map(n => (group && beamable(n) ? { ...n, mark: { ...n.mark, beam: 0 } } : n))
}

/**
 * `count` notes as `n` even attacks a bar of `beats` beats (§2): consecutive bars of `n`; the last bar's unused
 * attacks rest, inside its tuplet one a slot, else merged.
 */
export function evenRun(count: number, beats: number, n: number): StaffRun {
  const { values, tuplet } = evenBar(beats, n)
  const inTuplet = tuplet ? 0 : null
  const bars = range(Math.ceil(count / n)).map((b): RunBar => {
    const used = Math.min(n, count - b * n)
    if (n === 1) {
      // one note the bar long, tied across its pieces
      let beat = 0
      const pieces = values.map((value, i): RunNote => {
        const m = { ...mark(beat, value, false), tie: i < values.length - 1, tiedIn: i > 0 }
        beat += VALUE_BEATS[value]
        return { note: b, mark: m }
      })
      return { notes: pieces, tuplet }
    }
    const at = (k: number): number => (k * beats) / n
    const played = range(used).map((k): RunNote => ({ note: b * n + k, mark: mark(at(k), values[k]!, false, inTuplet, tuplet) }))
    const rests: readonly RunNote[] = tuplet
      ? range(n - used).map(k => ({ note: null, mark: mark(at(used + k), values[0]!, true, 0, tuplet) }))
      : used < n
        ? silence(at(used) * GRID, (beats - at(used)) * GRID, GRID_PULSE).map(m => ({ note: null, mark: m }))
        : []
    return { notes: beamBar([...played, ...rests]), tuplet }
  })
  return { beats, bars }
}

/** Renumbers keys from 0 in order of first appearance, keeping null. */
function renumber(keys: readonly (number | null)[]): readonly (number | null)[] {
  const seen = [...new Set(keys.filter((k): k is number => k !== null))]
  return keys.map(k => (k === null ? null : seen.indexOf(k)))
}

/** A poured piece: the note it plays, or `silent` for an attack (or its tied piece) that plays none. */
type Poured = Readonly<{ note: number | null; mark: RhythmNote; silent: boolean }>

/** Notes in order onto the rhythm's attacks, the first `perBar` a bar (all with null); a tied-in piece holds its attack's. */
function pour(bars: readonly (readonly RhythmNote[])[], count: number, perBar: number | null): readonly (readonly Poured[])[] {
  let next = 0
  let held: number | null = null
  return bars.map(bar => {
    let attacks = 0
    return bar.map((m): Poured => {
      if (m.rest) return { note: null, mark: m, silent: false }
      if (!m.tiedIn) held = (perBar === null || ++attacks <= perBar) && next < count ? next++ : null
      return { note: held, mark: m, silent: held === null }
    })
  })
}

/**
 * One poured bar's notes: each run of rests holding a silent attack merges into one silence (§2, §3); the rhythm's
 * own values, accents and tuplets stand, its beams break at the new rests, and no bracket draws (§4).
 */
function notateBar(bar: readonly Poured[], barPulses: number, pulse: Pulse): readonly RunNote[] {
  const pulseOf = (m: RhythmNote): number => pulseAt(pulse, m.beat)
  const runs = bar.reduce<Poured[][]>((out, p, i) => {
    const last = out.at(-1)
    if (p.note === null && last && bar[i - 1]!.note === null) last.push(p)
    else out.push([p])
    return out
  }, [])
  const notes = runs.flatMap((run, r): readonly (RunNote & { beamKey: number | null })[] => {
    if (run[0]!.note !== null || !run.some(p => p.silent)) return run.map(p => ({ note: p.note, mark: p.mark, beamKey: p.mark.beam }))
    const at = pulseOf(run[0]!.mark)
    const end = runs[r + 1] ? pulseOf(runs[r + 1]![0]!.mark) : barPulses
    return silence(at, end - at, pulse).map(m => ({ note: null, mark: m, beamKey: null }))
  })
  // a beam group continues only through notes of its own group
  let group = -1
  const beams = notes.map((n, i) => {
    if (n.note === null || n.beamKey === null) return null
    const prev = notes[i - 1]
    if (!(prev && prev.note !== null && prev.beamKey === n.beamKey)) group++
    return group
  })
  const sizes = beams.reduce<Map<number, number>>((m, b) => (b === null ? m : m.set(b, (m.get(b) ?? 0) + 1)), new Map())
  const beam = renumber(beams.map(b => (b !== null && sizes.get(b)! > 1 ? b : null)))
  const tuplet = renumber(notes.map(n => (n.mark.tuplet === null ? null : tupletGroup(pulse, pulseOf(n.mark)))))
  return notes.map((n, i) => ({ note: n.note, mark: { ...n.mark, beam: beam[i]!, tuplet: tuplet[i]!, bracket: null } }))
}

/** The most bars a run is poured over before it gives up (§3). */
const MAX_RUN_BARS = 64

/**
 * `count` notes poured into a rhythm laid over bars of `beats` beats (§3, §4): one note an attack, the first
 * `perBar` attacks a bar (every attack with null), later ones resting; bars after the last note dropped. Null for
 * Off, an invalid id, or a rhythm with fewer than `count` such attacks in 64 bars.
 */
export function pourRun(count: number, id: RhythmId, beats: number, perBar: number | null): StaffRun | null {
  const r = rhythmOf(id)
  if (!r || count <= 0) return null
  const pulse = r.kind === 'repeat' ? r.rhythm.pulse : r.pulse
  // every bar is `beats` long, so every bar has one pulse
  const barP = barPulse(pulse, beats)
  for (let n = Math.min(MAX_RUN_BARS, Math.max(1, count)); ; n = Math.min(MAX_RUN_BARS, n * 2)) {
    const laid = layRhythm(id, Array<number>(n).fill(beats))
    if (!laid) return null
    const poured = pour(rhythmNotes(laid), count, perBar)
    const last = poured.findLastIndex(bar => bar.some(p => p.note === count - 1))
    // the last laid bar may cut the last note's tie: lay more unless at the cap
    if (last >= 0 && (last < n - 1 || n === MAX_RUN_BARS)) {
      return { beats, bars: poured.slice(0, last + 1).map(bar => ({ notes: notateBar(bar, pulsesIn(pulse, beats), barP), tuplet: null })) }
    }
    if (n === MAX_RUN_BARS) return null
  }
}
