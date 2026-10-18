import raw from '../chord_scales.json'
import { parseChord } from './chord'
import { rootName, type Spelled, spellEqual } from './pitch'
import { cleanLettering, scaleKey, simplifyRoot, spellFrom } from './scales'

/**
 * Chord qualities from chord_scales.json: aliases, default and alternate scales per
 * quality, and baseQuality for extended symbols.
 */

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; note?: string; outside?: boolean; level?: string; functional?: boolean }>
/** a chord of `quality` whose bass is the interval `bass` above its root takes `as`'s options on the bass */
type SlashRule = Readonly<{ quality: string; bass: string; as: string; note?: string }>
type QualityData = Readonly<{
  quality_aliases: Readonly<Record<string, readonly string[]>>
  qualities: Readonly<Record<string, readonly RawOption[]>>
  slash_chords: readonly SlashRule[]
}>

const DATA: QualityData = raw

/** a tension's place in a stack: 9, 11, 13, the 5th, then any other; a flat before a sharp */
const tensionRank = (t: string): number => {
  const place = [9, 11, 13, 5].indexOf(Number(t.slice(1)))
  return (place < 0 ? 4 : place) * 2 + (t[0] === '#' ? 1 : 0)
}
const ALTERATION = /[b#]\d{1,2}/g
/**
 * a quality text with its alterations in one order, out of parentheses ("7b5b9", "7(b9 b5)" -> "7b9b5"), so a stack
 * reads the same however it's written; natural tensions keep their parentheses ("7(13)": not 7 + 13)
 */
function inOrder(text: string): string {
  const sorted = (run: string) => (run.match(ALTERATION) ?? []).sort((a, b) => tensionRank(a) - tensionRank(b)).join('')
  return text.replace(/\(((?:[b#]\d{1,2}[ ,]*)+)\)/g, (_, run: string) => sorted(run)).replace(/(?:[b#]\d{1,2})+/g, sorted)
}

/** chord-symbol quality text ("-7", "m7", "min7") -> canonical quality ("m7"), keyed by inOrder */
const LOOKUP: ReadonlyMap<string, string> = new Map([
  ...Object.keys(DATA.qualities).map((q) => [inOrder(q), q] as const),
  ...Object.entries(DATA.quality_aliases).flatMap(([q, names]) => names.map((n) => [inOrder(n), q] as const)),
])

/**
 * outside: a deliberate outside sound (tension to resolve), listed apart from the inside options.
 * level: the quality's Basic or Advanced choice for the Level control (engine/levels.ts), if it is one.
 * functional: fits one function only (a °7's diatonic diminished scales): in the menu, never dealt at random.
 */
export type ScaleOption = Readonly<{ scale: string; note: string; default: boolean; outside: boolean; level?: 'basic' | 'advanced'; functional?: true }>
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
  const quality = LOOKUP.get(inOrder(c.quality))
  if (quality === undefined) return null
  const reading = slashReading(quality, c.root, c.bass)
  const options = (DATA.qualities[reading.quality] ?? []).map((opt): ScaleOption => {
    const key = scaleKey(opt.scale)
    const [r] = spellFrom(reading.root, opt.root)
    if (!r) throw new Error(`bad interval ${JSON.stringify(opt.root)} in chord_scales.json`)
    // a functional °7 scale is lettered as the analysis letters it (R9, R17); others keep the chord's root
    const spelled = opt.functional ? cleanLettering(r, key) : { root: opt.root === '1' ? r : simplifyRoot(r, key) } // interval-derived: friendliest spelling
    const tag = opt.level
    const level: { level?: 'basic' | 'advanced' } = tag === 'basic' || tag === 'advanced' ? { level: tag } : {}
    const name = ('name' in spelled ? spelled.name : undefined) ?? opt.scale
    return { scale: `${rootName(spelled.root)} ${name}`, note: opt.note ?? '', default: opt.default ?? false, outside: opt.outside ?? false, ...level, ...(opt.functional ? { functional: true as const } : {}) }
  })
  // a ♭III°7 or ♭VI°7 re-lettered as the ascending formula is that option already: listed once
  return { quality, options: options.filter((o, i) => options.findIndex((x) => x.scale === o.scale) === i) }
}

/** natural tensions only in parentheses: M9 is not M + 9 */
const ALTERATIONS = /(?:[b#]\d{1,2}|\((?:[b#]?\d{1,2},?)+\))+$/
type Stemmed = Readonly<{ stem: string; alts: readonly string[]; quality: string }>
/** an inOrder text's quality before its alterations, and the alterations ("7b9b5" -> "7", [b9, b5]) */
function split(text: string): Readonly<{ stem: string; alts: readonly string[] }> {
  const tail = ALTERATIONS.exec(text)?.[0] ?? ''
  return { stem: text.slice(0, text.length - tail.length), alts: tail.match(ALTERATION) ?? [] }
}
const STEMMED: readonly Stemmed[] = [...LOOKUP].map(([k, quality]) => ({ ...split(k), quality }))

/**
 * a quality symbol read as the known quality whose alterations it has, in any order, when the rest is only alterations
 * ("Maj7#9" -> "Maj7", "7sus4#9" -> "7sus4", "Maj7#9#11" -> "Maj7#11"); exact names win. null if it doesn't fit ("m7#5#9x").
 */
export function baseQuality(written: string): string | null {
  const text = inOrder(written)
  const exact = LOOKUP.get(text)
  if (exact !== undefined) return exact
  const { stem, alts } = split(text)
  // a triad takes alterations only in parentheses: "(#11)" is a triad with a #11, "b5" is no chord
  if (stem === '' && !written.startsWith('(')) return null
  const fits = STEMMED.filter((k) => k.stem === stem && k.alts.every((a) => alts.includes(a)))
  // the most alterations a quality names; of two, the one nearer the 9 (7b9b5: 7b9's Half-Whole, not 7b5's)
  const rank = (k: Stemmed) => -k.alts.length * 100 + Math.min(99, ...k.alts.map(tensionRank))
  const best = fits.sort((a, b) => rank(a) - rank(b))[0]
  return best?.quality ?? null
}

/**
 * a chord as the ear hears it: its root and canonical quality, read on the bass when a slash chord is another chord
 * there (DbMaj7/C -> C 7sus4b9), and the quality text whose tensions the symbol pins ("7#9b13"; for a slash reading,
 * the reading's own quality). slash: read on its bass. null if the chord can't be read or its quality is unknown.
 */
export type ChordReading = Readonly<{ root: Spelled; quality: string; symbol: string; slash: boolean }>
export function readChord(chord: string): ChordReading | null {
  try {
    const c = parseChord(chord)
    const quality = baseQuality(c.quality)
    if (quality === null) return null
    const reading = slashReading(quality, c.root, c.bass)
    const slash = reading.quality !== quality
    return { root: reading.root, quality: reading.quality, symbol: slash ? reading.quality : c.quality, slash }
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

/** canonical quality -> its chord tones as spelled degrees (6 chords: the 6; sus: the 4; alt: no 5th) */
export const CHORD_TONES: Readonly<Record<string, readonly string[]>> = {
  maj: ['1', '3', '5'],
  m: ['1', 'b3', '5'],
  Maj7: ['1', '3', '5', '7'],
  'Maj7#11': ['1', '3', '5', '7'],
  'Maj7#5': ['1', '3', '#5', '7'],
  aug: ['1', '3', '#5'],
  '6': ['1', '3', '5', '6'],
  m7: ['1', 'b3', '5', 'b7'],
  m6: ['1', 'b3', '5', '6'],
  mMaj7: ['1', 'b3', '5', '7'],
  '7': ['1', '3', '5', 'b7'],
  '7sus4': ['1', '4', '5', 'b7'],
  '7sus4b9': ['1', 'b2', '4', '5', 'b7'],
  '7b9': ['1', '3', '5', 'b7'],
  '7b13': ['1', '3', '5', 'b7'],
  '7b9b13': ['1', '3', '5', 'b7'],
  '7#11': ['1', '3', '5', 'b7'],
  '7alt': ['1', '3', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
}
