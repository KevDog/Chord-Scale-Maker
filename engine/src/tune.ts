import { barView } from './bars'
import { type ChartDoc, type ChartKind, chartAka, chartKind, chartRecording, chartYoutube, keyLabel, metaValue, parseChart, type Recording } from './chart'
import { type ChordToken, chordTokensOrNull } from './chord'
import { CONCERT } from './part'

/**
 * What a song page shows (docs/superpowers/plans/2026-10-12-seo-discoverability.md): a chart's heading fields as
 * written. No DOM.
 */

export type TuneSummary = Readonly<{
  title: string
  subtitle: string
  /** which version of the tune ('' : the main chart) */
  version: string
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
  /** one notable recording, and its YouTube video's ID ('' without one) */
  recording: Recording | null
  youtube: string
  /** false when the video won't play embedded: the song page only links to it */
  embeddable: boolean
  /** who sent the chart, credited on its song page ('' without one) */
  contributor: string
}>

export function tuneSummary(text: string): TuneSummary {
  const doc = parseChart(text).value
  const key = metaValue(doc, 'key')
  const video = chartYoutube(doc)
  return {
    title: metaValue(doc, 'title', 'Untitled'),
    subtitle: metaValue(doc, 'subtitle'),
    version: metaValue(doc, 'version'),
    composer: metaValue(doc, 'composer'),
    aka: chartAka(doc),
    kind: chartKind(doc),
    key,
    keyLabel: keyLabel(key),
    style: metaValue(doc, 'style'),
    form: metaValue(doc, 'form'),
    time: metaValue(doc, 'time'),
    source: metaValue(doc, 'source'),
    recording: chartRecording(doc),
    youtube: video?.id ?? '',
    embeddable: video?.embeddable ?? true,
    contributor: metaValue(doc, 'contributor'),
  }
}

/** a search result's snippet, at most this long */
const DESCRIPTION_MAX = 160

/**
 * a song page's description, clauses dropped to fit (a title of LIMITS.maxMeta fits alone): the closing ones from
 * the end first, then the guide tones, the notable recording, the other titles, "no melody", the key, the composer and
 * the lead sheet's
 */
export function tuneDescription(t: TuneSummary): string {
  // [text, the order it drops in]
  const clauses: readonly (readonly [string, number])[] = [
    [t.aka.length ? ` (also ${t.aka.join(' or ')})` : '', 5],
    [t.composer && ` by ${t.composer}`, 2],
    [t.keyLabel && ` in ${t.keyLabel}`, 3],
    [t.recording ? `, as recorded by ${t.recording.artist}${t.recording.year && ` (${t.recording.year})`}` : '', 6],
    [': the chord changes as a lead-sheet style practice chart', 1],
    [', with guide tones', 7],
    [' and a scale, arpeggio and pentatonic for every chord', 8],
    [', for your instrument', 9],
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
    !metaValue(doc, 'recording') && chartKind(doc) === 'tune' && 'no recording: name one notable recording of the tune',
  ].filter((g): g is string => !!g)
}

export type OutlineBar = Readonly<{ bar: number; chords: readonly (readonly ChordToken[])[] }>
/** copyOf: the section a copy: repeats (its bars are that one's, so none are given) */
export type OutlineSection = Readonly<{ name: string; copyOf: string | null; bars: readonly OutlineBar[] }>

const HELD: readonly ChordToken[] = [{ kind: 'text', text: '%' }]

/** a song page's chord changes, readable without the sheet (#319): concert pitch, a held bar as % */
export function chartOutline(text: string): readonly OutlineSection[] {
  return barView(parseChart(text).value).sections.map((s) => ({
    name: s.name,
    copyOf: s.copy?.of ?? null,
    bars: s.copy
      ? []
      : s.bars.map((b) => ({
          bar: b.bar,
          chords: b.kind === 'held' ? [HELD] : b.chords.map((c) => chordTokensOrNull(CONCERT, c.chord) ?? [{ kind: 'text', text: c.chord }]),
        })),
  }))
}
