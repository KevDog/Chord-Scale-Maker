import raw from '../../chord_scales.json'
import { parseChord } from './chord'
import { rootName, type Spelled, spellEqual } from './pitch'
import { scaleKey, simplifyRoot, spellFrom } from './scales'

/**
 * Chord qualities from chord_scales.json: aliases, default and alternate scales per
 * quality, and baseQuality for extended symbols.
 */

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; note?: string; outside?: boolean; level?: string }>
/** a chord of `quality` whose bass is the interval `bass` above its root takes `as`'s options on the bass */
type SlashRule = Readonly<{ quality: string; bass: string; as: string; note?: string }>
type QualityData = Readonly<{
  quality_aliases: Readonly<Record<string, readonly string[]>>
  qualities: Readonly<Record<string, readonly RawOption[]>>
  slash_chords: readonly SlashRule[]
}>

const DATA: QualityData = raw

/** chord-symbol quality text ("-7", "m7", "min7") -> canonical quality ("m7") */
const LOOKUP: ReadonlyMap<string, string> = new Map([
  ...Object.keys(DATA.qualities).map((q) => [q, q] as const),
  ...Object.entries(DATA.quality_aliases).flatMap(([q, names]) => names.map((n) => [n, q] as const)),
])

/**
 * outside: a deliberate outside sound (tension to resolve), listed apart from the inside options.
 * level: the quality's Basic or Advanced choice for the Level control (engine/levels.ts), if it is one.
 */
export type ScaleOption = Readonly<{ scale: string; note: string; default: boolean; outside: boolean; level?: 'basic' | 'advanced' }>
export type QualityMatch = Readonly<{ quality: string; options: readonly ScaleOption[] }>

const same = (a: Spelled | undefined, b: Spelled): boolean => a !== undefined && spellEqual(a, b)

/** the chord its scales come from: a slash chord that is really another chord on its bass (DbMaj7/C -> C 7sus4b9) */
function slashReading(quality: string, root: Spelled, bass: Spelled | undefined): Readonly<{ quality: string; root: Spelled }> {
  const rule = bass && DATA.slash_chords.find((r) => r.quality === quality && same(spellFrom(root, r.bass)[0], bass))
  return rule && bass ? { quality: rule.as, root: bass } : { quality, root }
}

/**
 * scale options for a chord, roots spelled from the chord root (or from the bass, for a slash chord read on it);
 * null if the quality is unknown. `quality` is the chord's own, as written.
 */
export function resolveQuality(chord: string): QualityMatch | null {
  const c = parseChord(chord)
  const quality = LOOKUP.get(c.quality)
  if (quality === undefined) return null
  const reading = slashReading(quality, c.root, c.bass)
  const options = (DATA.qualities[reading.quality] ?? []).map((opt): ScaleOption => {
    const key = scaleKey(opt.scale)
    const [r] = spellFrom(reading.root, opt.root)
    if (!r) throw new Error(`bad interval ${JSON.stringify(opt.root)} in chord_scales.json`)
    const root = opt.root === '1' ? r : simplifyRoot(r, key) // interval-derived: friendliest spelling
    const tag = opt.level
    const level: { level?: 'basic' | 'advanced' } = tag === 'basic' || tag === 'advanced' ? { level: tag } : {}
    return { scale: `${rootName(root)} ${opt.scale}`, note: opt.note ?? '', default: opt.default ?? false, outside: opt.outside ?? false, ...level }
  })
  return { quality, options }
}

/**
 * a quality symbol read as the known quality it starts with, when the rest is only alterations
 * ("Maj7#11" -> "Maj7", "7sus4#9" -> "7sus4"); exact names win. null if it doesn't fit ("m7#5#9x").
 */
export function baseQuality(text: string): string | null {
  const exact = LOOKUP.get(text)
  if (exact !== undefined) return exact
  const alterations = /^(?:[b#]\d{1,2}|\((?:[b#]?\d{1,2},?)+\))+$/ // natural tensions only in parentheses: M9 is not M + 9
  const prefixes = [...LOOKUP.keys()].filter((k) => k && text.startsWith(k) && alterations.test(text.slice(k.length)))
  const longest = prefixes.sort((a, b) => b.length - a.length)[0]
  return longest === undefined ? null : (LOOKUP.get(longest) ?? null)
}

/**
 * a chord as the ear hears it: its root and canonical quality, read on the bass when a slash chord is another chord
 * there (DbMaj7/C -> C 7sus4b9), and the quality text whose tensions the symbol pins ("7#9b13"; for a slash reading,
 * the reading's own quality). null if the chord can't be read or its quality is unknown.
 */
export type ChordReading = Readonly<{ root: Spelled; quality: string; symbol: string }>
export function readChord(chord: string): ChordReading | null {
  try {
    const c = parseChord(chord)
    const quality = baseQuality(c.quality)
    if (quality === null) return null
    const reading = slashReading(quality, c.root, c.bass)
    return { root: reading.root, quality: reading.quality, symbol: reading.quality === quality ? c.quality : reading.quality }
  } catch {
    return null
  }
}

/** the quality's default scale ("Cm7" -> "C Dorian"); null if the quality is unknown */
export function defaultScale(chord: string): string | null {
  const options = resolveQuality(chord)?.options ?? []
  return (options.find((o) => o.default) ?? options[0])?.scale ?? null
}

/** defaultScale, but null instead of throwing on a chord that can't be parsed (e.g. mid-typing) */
export const defaultScaleOrNull = (chord: string): string | null => {
  try {
    return defaultScale(chord)
  } catch {
    return null
  }
}

/** canonical quality names, for validating chord_scales.json */
export const QUALITY_NAMES: readonly string[] = Object.keys(DATA.qualities)
