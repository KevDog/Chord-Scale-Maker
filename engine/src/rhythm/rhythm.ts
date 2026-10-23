/**
 * The rhythm model's text form (rhythm spec §1, §2): `<pulse>: <cells>`, e.g. `8: >xx.x_`.
 * Pure TypeScript; nothing here knows about metre, sheets or notation.
 */

export type Pulse = '4' | '8' | '8t' | '16' | '4t' | '4q' | '8q' | '16q' | '16t' | '16s'

export const PULSES: readonly Pulse[] = ['4', '8', '8t', '16', '4t', '4q', '8q', '16q', '16t', '16s']

/** A note value: whole, dotted half, half, dotted quarter, quarter, dotted 8th, 8th, 16th. */
export type RhythmValue = 'w' | 'hd' | 'h' | 'qd' | 'q' | '8d' | '8' | '16'

/**
 * A pulse as a ratio (Phase 4 spec §1): `n` pulses in a group of `beats` beats, each drawn as `value`, inside a
 * `notes:of` tuplet (null when straight); `fallback` is the pulse of a bar the group doesn't fit (D11).
 */
export type PulseGrid = Readonly<{
  n: number
  beats: number
  value: RhythmValue
  tuplet: Readonly<{ notes: number; of: number }> | null
  fallback: Pulse | null
}>

export const PULSE_GRID: Readonly<Record<Pulse, PulseGrid>> = {
  '4': { n: 1, beats: 1, value: 'q', tuplet: null, fallback: null },
  '8': { n: 2, beats: 1, value: '8', tuplet: null, fallback: null },
  '8t': { n: 3, beats: 1, value: '8', tuplet: { notes: 3, of: 2 }, fallback: null },
  '16': { n: 4, beats: 1, value: '16', tuplet: null, fallback: null },
  '4t': { n: 3, beats: 2, value: 'q', tuplet: { notes: 3, of: 2 }, fallback: '4' },
  '4q': { n: 5, beats: 4, value: 'q', tuplet: { notes: 5, of: 4 }, fallback: '4' },
  '8q': { n: 5, beats: 2, value: '8', tuplet: { notes: 5, of: 4 }, fallback: '8' },
  '16q': { n: 5, beats: 1, value: '16', tuplet: { notes: 5, of: 4 }, fallback: null },
  '16t': { n: 6, beats: 1, value: '16', tuplet: { notes: 6, of: 4 }, fallback: null },
  '16s': { n: 7, beats: 1, value: '16', tuplet: { notes: 7, of: 4 }, fallback: null },
}

/** The six pulses Phase 4 adds (tuplets over more than a beat, and quintuplets to septuplets), which sit behind the rhythmGears flag. */
export const isPhase4Pulse = (p: Pulse): boolean => p === '4t' || p === '4q' || p === '8q' || p === '16q' || p === '16t' || p === '16s'

/** Pulses in one beat for the four pulses with a whole number of them (a beat is a quarter note in every metre). */
export const PULSE_PER_BEAT: Readonly<Record<'4' | '8' | '8t' | '16', number>> = { '4': 1, '8': 2, '8t': 3, '16': 4 }

/** A bar's pulse: `p`, or its fallback where the bar isn't a whole number of its groups (Phase 4 spec D11). */
export function barPulse(p: Pulse, beats: number): Pulse {
  const { beats: group, fallback } = PULSE_GRID[p]
  return beats % group === 0 || fallback === null ? p : fallback
}

/** The pulses in a bar of `beats` beats, at the bar's pulse. */
export function pulsesIn(p: Pulse, beats: number): number {
  const { n, beats: group } = PULSE_GRID[barPulse(p, beats)]
  return (beats / group) * n
}

/** Pulse `i` of a bar at pulse `p`, in beats from the bar's start. */
export const pulseBeat = (p: Pulse, i: number): number => (i * PULSE_GRID[p].beats) / PULSE_GRID[p].n

/** pulseBeat's inverse: the pulse at `beat` beats from a bar's start at pulse `p` (rounded, so a tuplet's beat finds its pulse). */
export const pulseAt = (p: Pulse, beat: number): number => Math.round((beat * PULSE_GRID[p].n) / PULSE_GRID[p].beats)

/** 0, 1, …, n − 1: the rhythm modules' pulse and beat indexes (not in the engine's API) */
export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

export const PULSE_LABELS: Readonly<Record<Pulse, string>> = {
  '4': 'Quarters',
  '8': '8ths',
  '8t': 'Triplets',
  '16': '16ths',
  '4t': 'Quarter-note triplets',
  '4q': 'Quarter-note quintuplets',
  '8q': '8th-note quintuplets',
  '16q': '16th quintuplets',
  '16t': 'Sextuplets',
  '16s': 'Septuplets',
}

/** `x` attack, `.` rest, `_` tie to the note before, `>x` accented attack (one cell). */
export type Cell = 'x' | '.' | '_' | '>x'

export type Rhythm = Readonly<{ pulse: Pulse; cells: readonly Cell[] }>

const MAX_CELLS = 64

/** The rhythm a text spells, or null when it isn't valid (spec §2). */
export function parseRhythm(text: string): Rhythm | null {
  const colon = text.indexOf(':')
  if (colon < 0) return null
  const pulse = text.slice(0, colon).trim()
  if (!(PULSES as readonly string[]).includes(pulse)) return null
  const body = text.slice(colon + 1).replace(/[|\s]/g, '')
  const cells: Cell[] = []
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === 'x' || c === '.' || c === '_') cells.push(c)
    else if (c === '>' && body[i + 1] === 'x') {
      cells.push('>x')
      i++
    } else return null
  }
  if (cells.length < 1 || cells.length > MAX_CELLS) return null
  if (!cells.some(c => c !== '.' && c !== '_')) return null
  if (cells.some((c, i) => c === '_' && cells[i - 1] === '.')) return null
  return { pulse: pulse as Pulse, cells }
}

/** The canonical spelling: no `|` or spaces, one space after the colon. */
export function formatRhythm(r: Rhythm): string {
  return `${r.pulse}: ${r.cells.join('')}`
}
