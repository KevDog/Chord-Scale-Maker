/**
 * The rhythm library and its ids (rhythm spec §3): units, runs, cards and custom rhythms,
 * each one string that the preference, the share link and the listboxes carry.
 */
import { PULSES, PULSE_LABELS, PULSE_PER_BEAT, formatRhythm, parseRhythm, range, type Cell, type Pulse, type Rhythm } from './rhythm'

export type Variation = 'accents' | 'rests' | 'rest-last' | 'syncopated' | 'tied'

export const VARIATIONS: readonly Variation[] = ['accents', 'rests', 'rest-last', 'syncopated', 'tied']

export const VARIATION_LABELS: Readonly<Record<Variation, string>> = {
  accents: 'with accents',
  rests: 'with rests',
  'rest-last': 'rest last',
  syncopated: 'syncopated',
  tied: 'tied',
}

const CARDS = ['downbeats', 'upbeats', 'halves'] as const
export type RhythmCard = (typeof CARDS)[number]

const CARD_LABELS: Readonly<Record<RhythmCard, string>> = {
  downbeats: 'Downbeats',
  upbeats: 'Upbeats',
  halves: 'Half notes',
}

export type RhythmId = 'off' | `unit:${string}` | `run:${string}` | `card:${RhythmCard}` | `custom:${string}`

/** One bar's cells at the id's pulse; a run's holds only its own attacks (spill is laid elsewhere). */
export type BarRhythm = (beats: number) => readonly Cell[]

/** A unit's group sizes ("In"). */
export const UNIT_GROUPS: readonly number[] = [2, 3, 4, 5, 6, 7]
/** A run's pulses, attacks and positions ("From"). */
export const RUN_PULSES: readonly Pulse[] = ['8', '8t', '16']
export const RUN_ATTACKS: readonly number[] = [2, 3, 4, 5, 6, 7]

/** k runs from 0 to the pulses in a 4/4 bar, less one. */
const maxK = (pulse: Pulse): number => 4 * PULSE_PER_BEAT[pulse] - 1

/** A run's starting positions at a pulse, from 0 (beat 1) to the last pulse of a 4/4 bar. */
export const runPositions = (pulse: Pulse): readonly number[] => range(maxK(pulse) + 1)

/** An id's parts, as its listboxes show them. */
export type ParsedRhythmId =
  | Readonly<{ kind: 'unit'; pulse: Pulse; group: number; variation: Variation }>
  | Readonly<{ kind: 'run'; pulse: Pulse; attacks: number; from: number }>
  | Readonly<{ kind: 'card'; card: RhythmCard }>
  | Readonly<{ kind: 'custom'; rhythm: Rhythm }>

const INT = /^(0|[1-9]\d?)$/

/** An id's parts, or null for `off` or an invalid id. */
export function parseRhythmId(s: string): ParsedRhythmId | null {
  const parts = s.split(':')
  if (parts[0] === 'unit' && parts.length === 4) {
    const [, p, gs, v] = parts as [string, string, string, string]
    const g = Number(gs)
    if (!(PULSES as readonly string[]).includes(p) || !INT.test(gs) || !UNIT_GROUPS.includes(g)) return null
    if (!(VARIATIONS as readonly string[]).includes(v)) return null
    return { kind: 'unit', pulse: p as Pulse, group: g, variation: v as Variation }
  }
  if (parts[0] === 'run' && parts.length === 4) {
    const [, p, ns, ks] = parts as [string, string, string, string]
    if (!(RUN_PULSES as readonly string[]).includes(p) || !INT.test(ns) || !INT.test(ks)) return null
    const n = Number(ns)
    const k = Number(ks)
    if (!RUN_ATTACKS.includes(n) || k > maxK(p as Pulse)) return null
    return { kind: 'run', pulse: p as Pulse, attacks: n, from: k }
  }
  if (parts[0] === 'card' && parts.length === 2) {
    return (CARDS as readonly string[]).includes(parts[1]!) ? { kind: 'card', card: parts[1] as RhythmCard } : null
  }
  if (s.startsWith('custom:')) {
    const rhythm = parseRhythm(s.slice('custom:'.length))
    // canonical spelling only: ids are persisted and shared
    return rhythm && s === 'custom:' + formatRhythm(rhythm).replace(': ', ':') ? { kind: 'custom', rhythm } : null
  }
  return null
}

export function isRhythmId(s: string): s is RhythmId {
  return s === 'off' || parseRhythmId(s) !== null
}

/** One group of g pulses (Saindon), repeated from the sheet's first beat. */
export function unitRhythm(pulse: Pulse, g: number, v: Variation): Rhythm {
  const rest = (c: Cell): Cell[] => Array.from({ length: g - 1 }, () => c)
  const cells: Cell[] =
    v === 'accents' ? ['>x', ...rest('x')]
    : v === 'rests' ? ['x', ...rest('.')]
    : v === 'rest-last' ? [...rest('x'), '.']
    : v === 'syncopated' ? ['_', ...rest('x')]
    : ['x', ...rest('_')]
  return { pulse, cells }
}

const COUNT: Readonly<Record<Pulse, readonly string[]>> = {
  '4': [''],
  '8': ['', 'and'],
  '8t': ['', 'trip', 'let'],
  '16': ['', 'e', 'and', 'a'],
}

/** A pulse position read as the count: `1`, `the and of 1`, `2`, … */
export function positionLabel(pulse: Pulse, k: number): string {
  const per = PULSE_PER_BEAT[pulse]
  const beat = Math.floor(k / per) + 1
  const word = COUNT[pulse][k % per]!
  return word ? `the ${word} of ${beat}` : `${beat}`
}

export function rhythmLabel(id: RhythmId): string {
  if (id === 'off') return 'Off'
  const p = parseRhythmId(id)
  if (!p) return 'Off'
  switch (p.kind) {
    case 'unit': return `${PULSE_LABELS[p.pulse]} in ${p.group}, ${VARIATION_LABELS[p.variation]}`
    case 'run': return `${p.attacks} ${PULSE_LABELS[p.pulse]} from ${positionLabel(p.pulse, p.from)}`
    case 'card': return CARD_LABELS[p.card]
    case 'custom': return `Your rhythm (${formatRhythm(p.rhythm)})`
  }
}

function cardBar(card: RhythmCard, beats: number): readonly Cell[] {
  if (card === 'downbeats') return range(beats).flatMap((): Cell[] => ['x', '_'])
  if (card === 'upbeats') return range(beats).flatMap((): Cell[] => ['.', 'x'])
  return range(Math.ceil(beats / 2)).flatMap((i): Cell[] => (beats - 2 * i >= 2 ? ['x', '_', '_', '_'] : ['x', '_']))
}

function runBar(pulse: Pulse, n: number, k: number, beats: number): readonly Cell[] {
  return range(beats * PULSE_PER_BEAT[pulse]).map((i): Cell => (i >= k && i < k + n ? 'x' : '.'))
}

export function rhythmOf(
  id: RhythmId,
): Readonly<{ kind: 'repeat'; rhythm: Rhythm } | { kind: 'bar'; pulse: Pulse; bar: BarRhythm; n: number; k: number }> | null {
  if (id === 'off') return null
  const p = parseRhythmId(id)
  if (!p) return null
  switch (p.kind) {
    case 'unit': return { kind: 'repeat', rhythm: unitRhythm(p.pulse, p.group, p.variation) }
    case 'custom': return { kind: 'repeat', rhythm: p.rhythm }
    case 'run': return { kind: 'bar', pulse: p.pulse, n: p.attacks, k: p.from, bar: beats => runBar(p.pulse, p.attacks, p.from, beats) }
    case 'card': return { kind: 'bar', pulse: '8', n: 0, k: 0, bar: beats => cardBar(p.card, beats) }
  }
}

/** Every unit, run and card, in listbox order (no `off`, no custom). */
export const LIBRARY_IDS: readonly RhythmId[] = [
  ...PULSES.flatMap(p => UNIT_GROUPS.flatMap(g => VARIATIONS.map(v => `unit:${p}:${g}:${v}` as RhythmId))),
  ...RUN_PULSES.flatMap(p => RUN_ATTACKS.flatMap(n => runPositions(p).map(k => `run:${p}:${n}:${k}` as RhythmId))),
  ...CARDS.map(c => `card:${c}` as RhythmId),
]
