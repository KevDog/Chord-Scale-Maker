import { buildChanges } from './changes'
import { type ChartDoc, type ChartKind, chartAka, chartKind, keyLabel, metaValue, parseChart } from './chart'
import { CONCERT } from './part'

/**
 * What a tune page shows (docs/superpowers/plans/2026-10-12-seo-discoverability.md): a chart's heading fields as
 * written and its changes as text, in concert pitch. No DOM, like changes.ts.
 */

/** a chord as the Changes sheet draws it: its bar, its symbol, its numeral ('' where the analysis doesn't reach) and its scale */
export type TuneRow = Readonly<{ section: string; bar: string; chord: string; numeral: string; scale: string | null }>
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
  /** one per chord, repeats included as drawn */
  rows: readonly TuneRow[]
}>

export function tuneSummary(text: string): TuneSummary {
  const doc = parseChart(text).value
  const rows = buildChanges(doc, CONCERT).lines.flatMap((l) =>
    l.bars.flatMap((b) => b.chords.map((c) => ({ section: c.at.section, bar: c.at.bar, chord: c.text, numeral: c.numeral, scale: c.scale }))),
  )
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
    rows,
  }
}

/** a search result's snippet, at most this long */
const DESCRIPTION_MAX = 160

/**
 * one sentence for a tune page's description, clauses dropped to fit (a title of LIMITS.maxMeta fits alone): the
 * closing ones from the end first, then the other titles, the lead sheet's, the key and the composer
 */
export function tuneDescription(t: TuneSummary): string {
  // [text, the order it drops in]
  const clauses: readonly (readonly [string, number])[] = [
    [t.aka.length ? ` (also ${t.aka.join(' or ')})` : '', 4],
    [t.composer && ` by ${t.composer}`, 1],
    [t.keyLabel && ` in ${t.keyLabel}`, 2],
    [': the changes as a study lead sheet with guide tones', 3],
    [', and a scale for every chord', 5],
    [', for your instrument', 6],
  ]
  const sentence = (keep: number): string =>
    `Chord-scale practice sheets for ${t.title}${clauses.map(([text, rank]) => (rank <= keep ? text : '')).join('')}.`
  let keep = clauses.length
  while (keep > 0 && sentence(keep).length > DESCRIPTION_MAX) keep--
  return sentence(keep)
}

/** what a library chart's tune page lacks, each with its fix: libraryMeta.test.ts fails on any */
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

/** what a tune page could also use: reported where charts are made, never failing */
export function tuneAdvice(doc: ChartDoc): readonly string[] {
  return [
    !metaValue(doc, 'source') && 'no source: say where the chart came from, if a book or recording',
    !metaValue(doc, 'aka') && 'no aka: add the tune’s other common titles, if it has any',
  ].filter((g): g is string => !!g)
}
