import raw from '../../chord_scales.json'
import { parseChord } from './chord'
import { type Spelled, rootName } from './pitch'
import { scaleKey, simplifyRoot, spellFrom } from './scales'

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; note?: string }>
type QualityData = Readonly<{
  quality_aliases: Readonly<Record<string, readonly string[]>>
  qualities: Readonly<Record<string, readonly RawOption[]>>
}>

const DATA: QualityData = raw

/** chord-symbol quality text ("-7", "m7", "min7") -> canonical quality ("m7") */
const LOOKUP: ReadonlyMap<string, string> = new Map([
  ...Object.keys(DATA.qualities).map((q) => [q, q] as const),
  ...Object.entries(DATA.quality_aliases).flatMap(([q, names]) => names.map((n) => [n, q] as const)),
])

export type ScaleOption = Readonly<{ scale: string; note: string; default: boolean }>
export type QualityMatch = Readonly<{ quality: string; options: readonly ScaleOption[] }>

/** scale options for a chord, roots spelled from the chord root; null if the quality is unknown */
export function resolveQuality(chord: string): QualityMatch | null {
  const c = parseChord(chord)
  const quality = LOOKUP.get(c.quality)
  if (quality === undefined) return null
  const options = (DATA.qualities[quality] ?? []).map((opt): ScaleOption => {
    const key = scaleKey(opt.scale)
    const r: Spelled = spellFrom(c.root, opt.root)[0]
    const root = opt.root === '1' ? r : simplifyRoot(r, key) // interval-derived: friendliest spelling
    return { scale: `${rootName(root)} ${opt.scale}`, note: opt.note ?? '', default: opt.default ?? false }
  })
  return { quality, options }
}

/** the quality's default scale ("Cm7" -> "C Dorian"); null if the quality is unknown */
export function defaultScale(chord: string): string | null {
  const options = resolveQuality(chord)?.options ?? []
  return (options.find((o) => o.default) ?? options[0])?.scale ?? null
}

/** every quality's options, for validating chord_scales.json */
export const QUALITY_NAMES: readonly string[] = Object.keys(DATA.qualities)
