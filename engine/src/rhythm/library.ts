/**
 * The rhythm library and its ids (rhythm spec §3): units, runs, cards and custom rhythms,
 * each one string that the preference, the share link and the listboxes carry.
 */
import { PULSES, PULSE_LABELS, PULSE_PER_BEAT, formatRhythm, parseRhythm, type Cell, type Pulse, type Rhythm } from './rhythm'

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
type Card = (typeof CARDS)[number]

const CARD_LABELS: Readonly<Record<Card, string>> = {
  downbeats: 'Downbeats',
  upbeats: 'Upbeats',
  halves: 'Half notes',
}

export type RhythmId = 'off' | `unit:${string}` | `run:${string}` | `card:${Card}` | `custom:${string}`

/** One bar's cells at the id's pulse; a run's holds only its own attacks (spill is laid elsewhere). */
export type BarRhythm = (beats: number) => readonly Cell[]

const UNIT_G = [2, 3, 4, 5, 6, 7] as const
const RUN_PULSES: readonly Pulse[] = ['8', '8t', '16']

/** k runs from 0 to the pulses in a 4/4 bar, less one. */
const maxK = (pulse: Pulse): number => 4 * PULSE_PER_BEAT[pulse] - 1

type Parsed =
  | Readonly<{ kind: 'unit'; pulse: Pulse; g: number; v: Variation }>
  | Readonly<{ kind: 'run'; pulse: Pulse; n: number; k: number }>
  | Readonly<{ kind: 'card'; card: Card }>
  | Readonly<{ kind: 'custom'; rhythm: Rhythm }>

const INT = /^\d{1,2}$/

function parseId(s: string): Parsed | null {
  const parts = s.split(':')
  if (parts[0] === 'unit' && parts.length === 4) {
    const [, p, gs, v] = parts as [string, string, string, string]
    const g = Number(gs)
    if (!(PULSES as readonly string[]).includes(p) || !INT.test(gs) || g < 2 || g > 7) return null
    if (!(VARIATIONS as readonly string[]).includes(v)) return null
    return { kind: 'unit', pulse: p as Pulse, g, v: v as Variation }
  }
  if (parts[0] === 'run' && parts.length === 4) {
    const [, p, ns, ks] = parts as [string, string, string, string]
    if (!(RUN_PULSES as readonly string[]).includes(p) || !INT.test(ns) || !INT.test(ks)) return null
    const n = Number(ns)
    const k = Number(ks)
    if (n < 2 || n > 7 || k > maxK(p as Pulse)) return null
    return { kind: 'run', pulse: p as Pulse, n, k }
  }
  if (parts[0] === 'card' && parts.length === 2) {
    return (CARDS as readonly string[]).includes(parts[1]!) ? { kind: 'card', card: parts[1] as Card } : null
  }
  if (s.startsWith('custom:')) {
    const rhythm = parseRhythm(s.slice('custom:'.length))
    return rhythm ? { kind: 'custom', rhythm } : null
  }
  return null
}

export function isRhythmId(s: string): s is RhythmId {
  return s === 'off' || parseId(s) !== null
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
  const p = parseId(id)
  if (!p) return 'Off'
  switch (p.kind) {
    case 'unit': return `${PULSE_LABELS[p.pulse]} in ${p.g}, ${VARIATION_LABELS[p.v]}`
    case 'run': return `${p.n} ${PULSE_LABELS[p.pulse]} from ${positionLabel(p.pulse, p.k)}`
    case 'card': return CARD_LABELS[p.card]
    case 'custom': return `Your rhythm (${formatRhythm(p.rhythm)})`
  }
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

function cardBar(card: Card, beats: number): readonly Cell[] {
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
  const p = parseId(id)
  if (!p) return null
  switch (p.kind) {
    case 'unit': return { kind: 'repeat', rhythm: unitRhythm(p.pulse, p.g, p.v) }
    case 'custom': return { kind: 'repeat', rhythm: p.rhythm }
    case 'run': return { kind: 'bar', pulse: p.pulse, n: p.n, k: p.k, bar: beats => runBar(p.pulse, p.n, p.k, beats) }
    case 'card': return { kind: 'bar', pulse: '8', n: 0, k: 0, bar: beats => cardBar(p.card, beats) }
  }
}

/** Every unit, run and card, in listbox order (no `off`, no custom). */
export const LIBRARY_IDS: readonly RhythmId[] = [
  ...PULSES.flatMap(p => UNIT_G.flatMap(g => VARIATIONS.map(v => `unit:${p}:${g}:${v}` as RhythmId))),
  ...RUN_PULSES.flatMap(p =>
    range(6).flatMap(i => range(maxK(p) + 1).map(k => `run:${p}:${i + 2}:${k}` as RhythmId)),
  ),
  ...CARDS.map(c => `card:${c}` as RhythmId),
]
