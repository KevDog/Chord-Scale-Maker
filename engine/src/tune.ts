import { type ChartDoc, type ChartKind, chartAka, chartKind, keyLabel, metaValue, parseChart } from './chart'

/**
 * What a song page shows (docs/superpowers/plans/2026-10-12-seo-discoverability.md): a chart's heading fields as
 * written. No DOM.
 */

export type TuneSummary = Readonly<{
  title: string
  subtitle: string
  composer: string
  /** other titles the tune goes by */
  aka: readonly string[]
  kind: ChartKind
  /** as written ("Eb"); keyLabel is how it reads ("E♭") */
  key: string
  keyLabel: string
  style: string
  form: string
  time: string
  source: string
}>

export function tuneSummary(text: string): TuneSummary {
  const doc = parseChart(text).value
  const key = metaValue(doc, 'key')
  return {
    title: metaValue(doc, 'title', 'Untitled'),
    subtitle: metaValue(doc, 'subtitle'),
    composer: metaValue(doc, 'composer'),
    aka: chartAka(doc),
    kind: chartKind(doc),
    key,
    keyLabel: keyLabel(key),
    style: metaValue(doc, 'style'),
    form: metaValue(doc, 'form'),
    time: metaValue(doc, 'time'),
    source: metaValue(doc, 'source'),
  }
}

/** a search result's snippet, at most this long */
const DESCRIPTION_MAX = 160

/**
 * a song page's description, clauses dropped to fit (a title of LIMITS.maxMeta fits alone): the closing ones from
 * the end first, then the other titles, the guide tones, "no melody", the key, the composer and the lead sheet's
 */
export function tuneDescription(t: TuneSummary): string {
  // [text, the order it drops in]
  const clauses: readonly (readonly [string, number])[] = [
    [t.aka.length ? ` (also ${t.aka.join(' or ')})` : '', 6],
    [t.composer && ` by ${t.composer}`, 2],
    [t.keyLabel && ` in ${t.keyLabel}`, 3],
    [': the chord changes as a lead-sheet style practice chart', 1],
    [', with guide tones', 5],
    [' and a scale, arpeggio and pentatonic for every chord', 7],
    [', for your instrument', 8],
    ['. Chords only, no melody', 4],
  ]
  const sentence = (keep: number): string => `${t.title}${clauses.map(([text, rank]) => (rank <= keep ? text : '')).join('')}.`
  let keep = clauses.length
  while (keep > 0 && sentence(keep).length > DESCRIPTION_MAX) keep--
  return sentence(keep)
}

/** what a library chart's song page lacks, each with its fix: libraryMeta.test.ts fails on any */
export function tuneGaps(doc: ChartDoc): readonly string[] {
  const missing = (key: 'title' | 'key' | 'style' | 'form' | 'composer') => !metaValue(doc, key)
  return [
    missing('title') && 'no title:',
    missing('composer') && chartKind(doc) === 'tune' && 'no composer: a tune’s page needs one (or write kind: form or kind: exercise)',
    missing('key') && 'no key:',
    missing('style') && 'no style:',
    missing('form') && 'no form:',
  ].filter((g): g is string => !!g)
}

/** what a song page could also use: reported where charts are made, never failing */
export function tuneAdvice(doc: ChartDoc): readonly string[] {
  return [
    !metaValue(doc, 'source') && 'no source: say where the chart came from, if a book or recording',
    !metaValue(doc, 'aka') && 'no aka: add the tune’s other common titles, if it has any',
  ].filter((g): g is string => !!g)
}
