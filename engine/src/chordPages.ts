import raw from '../chord_scales.json'
import { expandRows, parseChart } from './chart'
import { isRest } from './chord'
import { resolveQuality, type ScaleOption } from './qualities'

/**
 * The chord reference pages (/chords/<slug>, #498), as scalePages.ts is for the scales: a quality's URL name and
 * title, its formula, the scales chord_scales.json gives it, and the library charts that write it.
 */

/** chord_scales.json's quality -> its URL name, its title, and its formula (the arpeggio, then the written tensions) */
const CHORDS: Readonly<Record<string, Readonly<{ slug: string; title: string; formula: string }>>> = {
  maj: { slug: 'major', title: 'Major triad', formula: '1 3 5' },
  m: { slug: 'minor', title: 'Minor triad', formula: '1 b3 5' },
  Maj7: { slug: 'major-7', title: 'Major 7th', formula: '1 3 5 7' },
  'Maj7#11': { slug: 'major-7-sharp-11', title: 'Major 7♯11', formula: '1 3 5 7 #11' },
  'Maj7#5': { slug: 'major-7-sharp-5', title: 'Major 7♯5', formula: '1 3 #5 7' },
  aug: { slug: 'augmented', title: 'Augmented triad', formula: '1 3 #5' },
  '6': { slug: 'major-6', title: 'Major 6th', formula: '1 3 5 6' },
  m7: { slug: 'minor-7', title: 'Minor 7th', formula: '1 b3 5 b7' },
  m6: { slug: 'minor-6', title: 'Minor 6th', formula: '1 b3 5 6' },
  mMaj7: { slug: 'minor-major-7', title: 'Minor-major 7th', formula: '1 b3 5 7' },
  '7': { slug: 'dominant-7', title: 'Dominant 7th', formula: '1 3 5 b7' },
  '7sus4': { slug: '7sus4', title: '7sus4', formula: '1 4 5 b7' },
  '7sus4b9': { slug: '7sus4-flat-9', title: '7sus4♭9', formula: '1 4 5 b7 b9' },
  '7b9': { slug: '7-flat-9', title: '7♭9', formula: '1 3 5 b7 b9' },
  '7b9b13': { slug: '7-flat-9-flat-13', title: '7♭9♭13', formula: '1 3 5 b7 b9 b13' },
  '7b13': { slug: '7-flat-13', title: '7♭13', formula: '1 3 5 b7 b13' },
  '7#11': { slug: '7-sharp-11', title: '7♯11', formula: '1 3 5 b7 #11' },
  '7alt': { slug: 'altered-dominant', title: 'Altered dominant', formula: '1 3 #5 b7 b9 #9' },
  m7b5: { slug: 'half-diminished', title: 'Half-diminished (m7♭5)', formula: '1 b3 b5 b7' },
  dim7: { slug: 'diminished-7', title: 'Diminished 7th', formula: '1 b3 b5 bb7' },
}

/** every quality with a page, in chord_scales.json's order */
export const CHORD_QUALITIES: readonly string[] = Object.keys(raw.qualities).filter((q) => q in CHORDS)

const entry = (quality: string) => {
  const c = CHORDS[quality]
  if (!c) throw new Error(`no chord page for quality ${JSON.stringify(quality)}`)
  return c
}

export const chordSlug = (quality: string): string => entry(quality).slug
export const chordTitle = (quality: string): string => entry(quality).title
/** its degrees from the root: "1 3 5 b7 b9" */
export const chordFormula = (quality: string): string => entry(quality).formula

const BY_SLUG: ReadonlyMap<string, string> = new Map(CHORD_QUALITIES.map((q) => [chordSlug(q), q]))

export const chordFromSlug = (slug: string): string | null => BY_SLUG.get(slug) ?? null

/** a written chord's canonical quality ("F7(13)" -> "7"), as its scales read it; null for a rest or an unknown chord */
export function chordQualityOf(chord: string): string | null {
  if (isRest(chord)) return null
  try {
    return resolveQuality(chord)?.quality ?? null
  } catch {
    return null
  }
}

/** a quality's scales on C ("C Dorian", "Eb Major Pentatonic"), in chord_scales.json's order */
export const chordScales = (quality: string): readonly ScaleOption[] => resolveQuality(`C${quality === 'maj' ? '' : quality}`)?.options ?? []

type Chart = Readonly<{ slug: string; text: string }>
const usage = new WeakMap<readonly Chart[], ReadonlyMap<string, readonly string[]>>()

/** quality -> the slugs of the charts that write it, in the charts' order; read once per array */
export function chordUsage(charts: readonly Chart[]): ReadonlyMap<string, readonly string[]> {
  const known = usage.get(charts)
  if (known) return known
  const out = new Map<string, string[]>()
  for (const { slug, text } of charts) {
    const qualities = new Set(expandRows(parseChart(text).value).value.map((r) => chordQualityOf(r.chord)))
    for (const q of qualities) if (q) out.set(q, [...(out.get(q) ?? []), slug])
  }
  usage.set(charts, out)
  return out
}
