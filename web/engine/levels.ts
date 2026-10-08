import type { ChartDoc } from './chart'
import { resolveQuality, type ScaleOption } from './qualities'
import { sameScale } from './scales'

/**
 * The Level control: how sophisticated each chord's scale is, written into the chart. Standard is the quality's
 * default (chord_scales.json); Basic and Advanced are the options tagged `level`, falling back to the default where a
 * quality has none; Random picks among the quality's inside options, repeatably from a seed. Changing level moves
 * only the rows that play the old level's scale (relevel), so a scale you chose yourself stays.
 */
export type ScaleLevel = 'basic' | 'standard' | 'advanced' | 'random'
export const SCALE_LEVELS: readonly ScaleLevel[] = ['basic', 'standard', 'advanced', 'random']
export const LEVEL_LABELS: Readonly<Record<ScaleLevel, string>> = { basic: 'Basic', standard: 'Standard', advanced: 'Advanced', random: 'Random' }

export const isScaleLevel = (v: unknown): v is ScaleLevel => typeof v === 'string' && (SCALE_LEVELS as readonly string[]).includes(v)

const optionsFor = (chord: string): readonly ScaleOption[] => {
  try {
    return resolveQuality(chord)?.options ?? []
  } catch {
    return [] // a chord that can't be parsed: nothing to choose from
  }
}

/** a number in [0, 1) from a seed and a key, the same every time (FNV-1a, then a mulberry32 step) */
export function seededUnit(seed: number, key: string): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let t = (h + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** the chord's scale at a level, or null if the chord has no options; `key` makes a Random pick repeatable */
export function scaleAtLevel(chord: string, level: ScaleLevel, seed = 0, key = ''): string | null {
  const options = optionsFor(chord)
  const def = options.find((o) => o.default) ?? options[0]
  if (!def) return null
  if (level === 'standard') return def.scale
  if (level === 'random') {
    const pool = options.filter((o) => !o.outside)
    return pool[Math.floor(seededUnit(seed, key) * pool.length)]?.scale ?? def.scale
  }
  return options.find((o) => o.level === level)?.scale ?? def.scale
}

/**
 * where a chart's scales stand: the level, its Random seed, and the rows the level owns (`line:chord` keys). A row
 * is owned when the chart leaves Standard and the row plays its default; a hand edit takes it back.
 */
export type LevelState = Readonly<{ level: ScaleLevel; seed: number; owned?: readonly string[] }>

const defaultOf = (chord: string): string => optionsFor(chord).find((o) => o.default)?.scale ?? ''
const rowKey = (i: number, chord: string): string => `${i}:${chord}`

/**
 * move a chart from one level to another, writing the scales into its rows. Only rows the level owns move, and only
 * while they still play the old level's scale; a scale you chose yourself stays, even one that happens to be a
 * level's choice (Autumn Leaves' B♭ Lydian). @copy repeats follow their source rows. Returns the chart, how many
 * rows changed, and the rows the level owns now (none back at Standard).
 */
export function relevel(doc: ChartDoc, from: LevelState, to: LevelState): Readonly<{ doc: ChartDoc; changed: number; owned: readonly string[] }> {
  const owns = (i: number, chord: string, scale: string): boolean => {
    const key = rowKey(i, chord)
    if (from.level === 'standard') return scale === '' || sameScale(scale, defaultOf(chord))
    const mine = from.owned ? from.owned.includes(key) : true // without a record (an old share link), any match counts
    return mine && (scale === '' || sameScale(scale, scaleAtLevel(chord, from.level, from.seed, key)))
  }
  let changed = 0
  const owned: string[] = []
  const lines = doc.lines.map((l, i) => {
    if (l.kind !== 'row' || !owns(i, l.chord, l.scale)) return l
    const key = rowKey(i, l.chord)
    if (to.level !== 'standard') owned.push(key)
    const next = scaleAtLevel(l.chord, to.level, to.seed, key)
    if (!next || sameScale(next, l.scale || defaultOf(l.chord))) return l
    changed++
    return { ...l, scale: next }
  })
  return { doc: changed ? { lines } : doc, changed, owned }
}
