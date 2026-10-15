import type { ChordAt } from './changes'
import { LIMITS } from './limits'

/**
 * Chord picks (#303, docs/superpowers/specs/2026-10-15-chord-picks-design.md): a player's own pentatonic or triad pair
 * for one drawn chord, overriding the sheet's choice on both sheets. Each pick remembers the chord and scale it was
 * made for; where its position now plays something else it is ignored.
 */
export type PickKind = 'pentatonic' | 'hexatonic'
export type PentPick = Readonly<{ pc: number; for?: string }>
export type HexPick = Readonly<{ roots: readonly [number, number]; for?: string }>
export type ChordPicks = Readonly<{ pentatonic: Readonly<Record<ChordAt, PentPick>>; hexatonic: Readonly<Record<ChordAt, HexPick>> }>
export type PickValue = Readonly<{ pentatonic: number; hexatonic: readonly [number, number] }>
export const NO_PICKS: ChordPicks = { pentatonic: {}, hexatonic: {} }

/** what a pick was made for: the position's chord text and resolved scale, concert */
export const pickTarget = (chord: string, scale: string | null): string => `${chord}|${scale ?? ''}`

const AT = /^\S{1,64}:\d{1,4}:\d{1,2}$/
const isPc = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 12
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (v: Record<string, unknown>, k: string): unknown => (Object.hasOwn(v, k) ? v[k] : undefined)
/** an entry's for: {} when missing (a legacy pick), null when present but bad (the entry is dropped) */
const forOf = (v: unknown): { for?: string } | null =>
  v === undefined ? {} : typeof v === 'string' && v.length <= 200 && v.includes('|') ? { for: v } : null

function pentFrom(v: unknown): PentPick | null {
  if (isPc(v)) return { pc: v }
  if (!isObject(v)) return null
  const pc = own(v, 'pc')
  const f = forOf(own(v, 'for'))
  return isPc(pc) && f ? { pc, ...f } : null
}
function hexFrom(v: unknown): HexPick | null {
  if (!isObject(v)) return null
  const roots = own(v, 'roots')
  const f = forOf(own(v, 'for'))
  if (!f || !Array.isArray(roots) || roots.length !== 2) return null
  const [a, b] = roots as unknown[]
  return isPc(a) && isPc(b) && a !== b ? { roots: [a, b], ...f } : null
}
function entries<T>(v: unknown, read: (x: unknown) => T | null): Readonly<Record<ChordAt, T>> {
  if (!isObject(v)) return {}
  const out: [ChordAt, T][] = []
  for (const [k, x] of Object.entries(v)) {
    if (out.length >= LIMITS.maxExpandedRows) break
    const p = AT.test(k) ? read(x) : null
    if (p) out.push([k, p])
  }
  return Object.fromEntries(out)
}

/** picks read from untrusted data (storage, a share link): bad entries dropped; a #272 map of bare numbers is pentatonic picks */
export function chordPicksFrom(v: unknown): ChordPicks {
  if (!isObject(v)) return NO_PICKS
  if (Object.hasOwn(v, 'pentatonic') || Object.hasOwn(v, 'hexatonic')) return { pentatonic: entries(own(v, 'pentatonic'), pentFrom), hexatonic: entries(own(v, 'hexatonic'), hexFrom) }
  return { pentatonic: entries(v, (x) => (isPc(x) ? { pc: x } : null)), hexatonic: {} }
}

/** a position's pick, if it still plays what the pick was made for (a legacy pick, with no for, always does) */
export const livePick = <T extends { for?: string }>(m: Readonly<Record<ChordAt, T>>, at: ChordAt, target: string): T | null => {
  const p = Object.hasOwn(m, at) ? m[at] : undefined
  return p && (p.for === undefined || p.for === target) ? p : null
}
const keepLive = <T extends { for?: string }>(m: Readonly<Record<ChordAt, T>>, targets: ReadonlyMap<ChordAt, string>): Readonly<Record<ChordAt, T>> =>
  Object.fromEntries(Object.entries(m).filter(([at]) => targets.has(at) && livePick(m, at, targets.get(at)!) !== null))
/** the picks whose positions are drawn and still play what they were made for */
export const livePicks = (picks: ChordPicks, targets: ReadonlyMap<ChordAt, string>): ChordPicks => ({
  pentatonic: keepLive(picks.pentatonic, targets),
  hexatonic: keepLive(picks.hexatonic, targets),
})

/** `value` picked at each drawn position, stamped with its target; stale picks go on the write */
export function withPick<K extends PickKind>(picks: ChordPicks, kind: K, positions: readonly ChordAt[], value: PickValue[K], targets: ReadonlyMap<ChordAt, string>): ChordPicks {
  const live = livePicks(picks, targets)
  const made = Object.fromEntries(
    positions.flatMap((at) => {
      const t = targets.get(at)
      if (t === undefined) return []
      return [[at, kind === 'pentatonic' ? { pc: value as number, for: t } : { roots: value as readonly [number, number], for: t }]]
    }),
  )
  return { ...live, [kind]: { ...live[kind], ...made } }
}
/** the sheet's choice again at these positions; stale picks go on the write */
export function withoutPicks(picks: ChordPicks, kind: PickKind, positions: readonly ChordAt[], targets: ReadonlyMap<ChordAt, string>): ChordPicks {
  const live = livePicks(picks, targets)
  return { ...live, [kind]: Object.fromEntries(Object.entries(live[kind]).filter(([at]) => !positions.includes(at))) }
}
export const hasPicks = (p: ChordPicks, kind?: PickKind): boolean => (kind ? Object.keys(p[kind]).length > 0 : hasPicks(p, 'pentatonic') || hasPicks(p, 'hexatonic'))

/** the bar numbers positions are in, once each, in order */
export const pickBars = (positions: readonly ChordAt[]): readonly string[] => [...new Set(positions.flatMap((at) => /:(\d+):\d+$/.exec(at)?.[1] ?? []))]
