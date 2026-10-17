import raw from '../chord_scales.json'
import { analyse } from './analysis'
import type { ChartDoc } from './chart'
import { rootName } from './pitch'
import { type QualityMatch, readChord, resolveQuality, type ScaleOption } from './qualities'
import { parseScale, samePitchScale, scaleKey, simplifyRoot, spellFrom } from './scales'

/**
 * The Level control: how sophisticated each chord's scale is, a view preference the sheets play blank cells at
 * (resolve.ts), never chart text. Standard is the quality's
 * default (chord_scales.json); Basic and Advanced are the options tagged `level`, falling back to the default where a
 * quality has none; Random picks among the quality's inside options (not one that fits a single function), repeatably from a seed. A row whose Standard is
 * not its quality's default (the analysis chose it: D7 → D Phrygian Dominant) climbs that scale's ladder instead
 * (chord_scales.json `ladders`, docs/plan-analysis.md §11), so Basic over a V7 of a minor chord is the minor key's
 * pentatonic, not the major one. A tonic minor chord (the analysis's rule m5) is Aeolian at Basic, the natural
 * minor beginners learn first (decision 7).
 */
export type ScaleLevel = 'basic' | 'standard' | 'advanced' | 'random'
export const SCALE_LEVELS: readonly ScaleLevel[] = ['basic', 'standard', 'advanced', 'random']
export const LEVEL_LABELS: Readonly<Record<ScaleLevel, string>> = { basic: 'Basic', standard: 'Standard', advanced: 'Advanced', random: 'Random' }

export const isScaleLevel = (v: unknown): v is ScaleLevel => typeof v === 'string' && (SCALE_LEVELS as readonly string[]).includes(v)

const qualityOf = (chord: string): QualityMatch | null => {
  try {
    return resolveQuality(chord)
  } catch {
    return null // a chord that can't be parsed: nothing to choose from
  }
}
const optionsFor = (chord: string): readonly ScaleOption[] => qualityOf(chord)?.options ?? []

/** a number in [0, 1) from a seed and a key, the same every time (FNV-1a, then a mulberry32 step) */
export function seededUnit(seed: number, key: string): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let t = (h + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Rung = readonly [string, string] // interval above the Standard root, scale name
const LADDERS: Readonly<Record<string, Readonly<{ basic?: Rung; advanced?: Rung }>>> = raw.ladders as never
const LADDER_BY_KEY = new Map(Object.entries(LADDERS).map(([name, rungs]) => [scaleKey(name), rungs]))
/** per-quality overrides of a ladder (chord_scales.json `quality_ladders`): a minor chord on Phrygian is Dorian at Advanced */
const QUALITY_LADDERS: Readonly<Record<string, Readonly<Record<string, Readonly<{ basic?: Rung; advanced?: Rung }>>>>> =
  raw.quality_ladders as never

/**
 * Basic or Advanced on a Standard scale's ladder, the chord quality's own override first (`quality`: m7, 7sus4b9);
 * the Standard itself where the ladder has no rung; null if unreadable
 */
export function ladderScale(standard: string, level: 'basic' | 'advanced', quality?: string): string | null {
  try {
    const s = parseScale(standard)
    const override = quality ? Object.entries(QUALITY_LADDERS[quality] ?? {}).find(([name]) => scaleKey(name) === s.key)?.[1]?.[level] : undefined
    const rung = override ?? LADDER_BY_KEY.get(s.key)?.[level]
    if (!rung) return standard
    const [interval, name] = rung
    const [r] = spellFrom(s.root, interval)
    if (!r) return standard
    return `${rootName(interval === '1' ? r : simplifyRoot(r, scaleKey(name)))} ${name}`
  } catch {
    return null
  }
}

/**
 * the chord's scale at a level, or null if the chord has no options; `key` makes a Random pick repeatable.
 * `standard`: the row's Standard when it isn't the quality's default (a library chart's own choice), whose ladder
 * then gives Basic and Advanced.
 */
export function scaleAtLevel(chord: string, level: ScaleLevel, seed = 0, key = '', standard?: string): string | null {
  const match = qualityOf(chord)
  const options = match?.options ?? []
  const def = options.find((o) => o.default) ?? options[0]
  if (!def) return null
  if (level === 'standard') return standard || def.scale
  // a Standard the analysis only respelled (Gbdim7: F# Whole-Half, R9) is still the default, and keeps its spelling
  if ((level === 'basic' || level === 'advanced') && standard && !samePitchScale(standard, def.scale)) return ladderScale(standard, level, match?.quality) ?? def.scale
  if (level === 'random') {
    const pool = options.filter((o) => !o.outside && !o.functional)
    return pool[Math.floor(seededUnit(seed, key) * pool.length)]?.scale ?? def.scale
  }
  const pick = options.find((o) => o.level === level)?.scale ?? def.scale
  return standard && samePitchScale(pick, standard) ? standard : pick
}

/**
 * a level as a browser once stored it: the level, its Random seed, and the rows it wrote its scales into (`line:chord`
 * keys), back when a level was written into the chart. Only the migration (unlevel) reads `owned`.
 */
export type LevelState = Readonly<{ level: ScaleLevel; seed: number; owned?: readonly string[] }>

const defaultOf = (chord: string): string => optionsFor(chord).find((o) => o.default)?.scale ?? ''
const rowKey = (i: number, chord: string): string => `${i}:${chord}`

/** a row's scale at a level as a level once wrote it: `standard` is the row's Standard, `tonicMinor` the rows on rule m5 */
function scaleAt(state: LevelState, i: number, chord: string, standard: string, tonicMinor: ReadonlySet<number>): string | null {
  if (state.level === 'standard') return standard || null
  if (state.level === 'basic' && tonicMinor.has(i)) {
    const r = readChord(chord)
    return r ? `${rootName(r.root)} Aeolian` : null
  }
  return scaleAtLevel(chord, state.level, state.seed, rowKey(i, chord), standard)
}

/** the row's Standard: the library's own choice for this line, else the chord's default */
const standardOf = (baseline: ChartDoc | undefined, i: number, chord: string): string => {
  const b = baseline?.lines[i]
  return b?.kind === 'row' && b.chord === chord && b.scale ? b.scale : defaultOf(chord)
}

// the rows that are a tonic minor chord, from the analysis (it reads the chords, so it's the same at every level)
const tonicMinorOf = (doc: ChartDoc): ReadonlySet<number> => new Set(analyse(doc).rows.filter((r) => r.rule === 'm5').map((r) => r.line))

/** `owned` keys (`line:chord`) moved to the lines a chart migration (migrateChart) put their rows on; a key whose line went is dropped */
export function remapOwned(owned: readonly string[], lineMap: readonly number[]): string[] {
  return owned.flatMap((k) => {
    const m = /^(\d+):(.*)$/.exec(k)
    const to = m ? lineMap[Number(m[1])] : undefined
    return m && to !== undefined && to >= 0 ? [`${to}:${m[2]}`] : []
  })
}

/**
 * the migration (docs/superpowers/specs/2026-10-11-proposed-scales-design.md §3): a chart a level once wrote its
 * scales into, with its cells blank again where they still hold the level's scale, so the resolver plays the level there.
 * Only the rows `state.owned` lists; a row changed by hand since, or never owned, keeps its scale. `baseline`: the
 * library chart it came from, whose own scale choices were its Standard.
 */
export function unlevel(doc: ChartDoc, state: LevelState, baseline?: ChartDoc): Readonly<{ doc: ChartDoc; blanked: number }> {
  if (!state.owned?.length) return { doc, blanked: 0 }
  const owned = new Set(state.owned)
  const tonicMinor = tonicMinorOf(doc)
  let blanked = 0
  const lines = doc.lines.map((l, i) => {
    if (l.kind !== 'row' || !l.scale || !owned.has(rowKey(i, l.chord))) return l
    if (!samePitchScale(l.scale, scaleAt(state, i, l.chord, standardOf(baseline, i, l.chord), tonicMinor))) return l
    blanked++
    return { ...l, scale: '' }
  })
  return { doc: blanked ? { lines } : doc, blanked }
}
