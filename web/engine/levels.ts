import type { ChartDoc } from './chart'
import { resolveQuality, type ScaleOption } from './qualities'
import { sameScale } from './scales'

/**
 * The Level control: how sophisticated each chord's scale is. Standard is the quality's default (chord_scales.json);
 * Basic and Advanced are the options tagged `level`, falling back to the default where a quality has none; Random
 * picks among the quality's inside options, repeatably from a seed. Only rows that follow their chord's default
 * (an empty scale cell, or the default written out) change: a scale you chose yourself stays. Applied to the
 * chart's own lines, so @copy repeats share a pick, and Save to chart can write the result back as it is.
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

/** whether a row takes the level: its scale cell is empty, or names the chord's default */
export function followsLevel(chord: string, scale: string): boolean {
  if (scale === '') return true
  const def = optionsFor(chord).find((o) => o.default)
  return def !== undefined && sameScale(scale, def.scale)
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

/** the chart with every following row's scale at the level (Standard leaves the chart as it is) */
export function applyLevel(doc: ChartDoc, level: ScaleLevel, seed = 0): ChartDoc {
  if (level === 'standard') return doc
  return {
    lines: doc.lines.map((l, i) => {
      if (l.kind !== 'row' || !followsLevel(l.chord, l.scale)) return l
      const scale = scaleAtLevel(l.chord, level, seed, `${i}:${l.chord}`)
      return scale ? { ...l, scale } : l
    }),
  }
}

/** how many rows play a different scale at the level (for Save to chart) */
export function levelChanges(doc: ChartDoc, level: ScaleLevel, seed = 0): number {
  const next = applyLevel(doc, level, seed).lines
  return doc.lines.filter((before, i) => {
    const after = next[i]
    if (before.kind !== 'row' || after?.kind !== 'row') return false
    const played = (scale: string, chord: string): string => scale || (optionsFor(chord).find((o) => o.default)?.scale ?? '')
    return !sameScale(played(after.scale, after.chord), played(before.scale, before.chord))
  }).length
}
