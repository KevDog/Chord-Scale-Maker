import raw from '../chord_scales.json'
import { parseChart } from './chart'
import { type ChordToken, chordTokens } from './chord'
import { CONCERT } from './part'
import { resolveScales } from './resolve'
import { parseScale, SCALES, type ScaleKey, scaleKey } from './scales'

/**
 * The scale reference pages (/scales/<slug>, docs/superpowers/specs/2026-10-12-seo-pages-design.md): a scale's URL
 * name, the chord qualities chord_scales.json plays it over, and the library tunes that play it at Standard.
 */

/** "half whole diminished" -> "half-whole-diminished"; a ♯ is spelled out, as a URL can't carry "#" */
export const scaleSlug = (key: ScaleKey): string => key.replaceAll('#', 'sharp-').replaceAll(' ', '-')

const BY_SLUG: ReadonlyMap<string, ScaleKey> = new Map((Object.keys(SCALES) as ScaleKey[]).map((k) => [scaleSlug(k), k]))

export const scaleFromSlug = (slug: string): ScaleKey | null => BY_SLUG.get(slug) ?? null

export type PlaysOverTag = 'default' | 'basic' | 'advanced' | 'outside' | 'functional'
/** chord: the quality on C as a chart writes it; root: the scale's root as an interval above the chord's ('1': the same) */
export type PlaysOver = Readonly<{ quality: string; chord: string; symbolOnC: readonly ChordToken[]; root: string; tags: readonly PlaysOverTag[] }>

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; outside?: boolean; level?: string; functional?: boolean }>
const QUALITIES: Readonly<Record<string, readonly RawOption[]>> = raw.qualities

const tagsOf = (o: RawOption): PlaysOverTag[] =>
  (
    [
      ['default', o.default],
      ['basic', o.level === 'basic'],
      ['advanced', o.level === 'advanced'],
      ['outside', o.outside],
      ['functional', o.functional],
    ] as const
  )
    .filter(([, on]) => on)
    .map(([tag]) => tag)

/** each quality (in chord_scales.json's order) with an option of this scale, once per root */
export function playsOver(key: ScaleKey): readonly PlaysOver[] {
  return Object.entries(QUALITIES).flatMap(([quality, options]) => {
    const chord = 'C' + (quality === 'maj' ? '' : quality)
    return options
      .filter((o) => scaleKey(o.scale) === key)
      .filter((o, i, all) => all.findIndex((x) => x.root === o.root) === i)
      .map((o) => ({ quality, chord, symbolOnC: chordTokens(CONCERT, chord), root: o.root, tags: tagsOf(o) }))
  })
}

type Chart = Readonly<{ slug: string; text: string }>
const usage = new WeakMap<readonly Chart[], ReadonlyMap<ScaleKey, readonly string[]>>()

/** scale -> the slugs of the charts that play it at Standard (seed 0), in the charts' order; analysed once per array */
export function scaleUsage(charts: readonly Chart[]): ReadonlyMap<ScaleKey, readonly string[]> {
  const known = usage.get(charts)
  if (known) return known
  const out = new Map<ScaleKey, string[]>()
  for (const { slug, text } of charts) {
    const keys = new Set<ScaleKey>()
    for (const r of resolveScales(parseChart(text).value, { level: 'standard', seed: 0 }).values()) {
      if (!r.scale) continue
      try {
        keys.add(parseScale(r.scale).key)
      } catch {
        // a scale the chart writes that the engine can't read: the sheet reports it; no page lists it
      }
    }
    for (const k of keys) out.set(k, [...(out.get(k) ?? []), slug])
  }
  usage.set(charts, out)
  return out
}
