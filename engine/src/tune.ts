import { buildChanges } from './changes'
import { keyLabel, metaValue, parseChart } from './chart'
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
    aka: [],
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

/** one sentence for a tune page's description, clauses dropped from the end to fit (a title of LIMITS.maxMeta fits alone) */
export function tuneDescription(t: TuneSummary): string {
  const clauses = [
    t.composer && ` by ${t.composer}`,
    t.keyLabel && ` in ${t.keyLabel}`,
    ': the changes as a study lead sheet with guide tones',
    ', and a scale for every chord',
    ', for your instrument',
  ].filter(Boolean)
  const sentence = (n: number): string => `Chord-scale practice sheets for ${t.title}${clauses.slice(0, n).join('')}.`
  let n = clauses.length
  while (n > 0 && sentence(n).length > DESCRIPTION_MAX) n--
  return sentence(n)
}
