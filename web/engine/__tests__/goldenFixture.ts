/**
 * fixtures/golden.json: the engine's answers over a wide fixed set of inputs, frozen so any change in behaviour shows
 * up in review. It began as jazz_scales.py's answers (the Python CLI this engine was ported from, retired after
 * v1-launch); the engine is now its own reference. After an intended change, or new charts or scales:
 *   npm run golden    (rewrites the file; review the diff)
 */
import { readdirSync, readFileSync } from 'node:fs'
import raw from '../../../chord_scales.json'
import {
  ALIASES,
  type ChordToken,
  type Clef,
  CLEF_START,
  chartMeta,
  chordTokens,
  defaultScale,
  expandRows,
  lilyNote,
  type Part,
  parseChart,
  resolveQuality,
  resolveScale,
  resolveStart,
  rootName,
  SCALES,
  type ScaleOption,
  scaleLabel,
  scaleNotes,
} from '..'

export type ScaleCase =
  | { error: true }
  | { root: string; label: string; root_notes: string[]; from: Record<string, string[]> }
export type Golden = {
  parts: Record<string, Part>
  from_starts: string[]
  starts: Record<Clef, Record<string, number>>
  scales: Record<string, Record<string, ScaleCase>>
  chords: { part: string; chord: string; scale: string | null; tokens: ChordToken[] | null }[]
  options: Record<string, { options: readonly ScaleOption[] | null; default: string | null }>
  charts: Record<string, { text: string; title: string; subtitle: string; rows: (string | null)[][] }> // a null scale: unresolved
}

const PARTS: Record<string, Part> = Object.fromEntries(
  (
    [
      ['treble', 'C'],
      ['treble', 'Bb'],
      ['treble', 'Eb'],
      ['treble', 'F'],
      ['bass', 'C'],
    ] as const
  ).map(([clef, trans]) => [`${clef}/${trans}`, { clef, trans }]),
)
const ROOTS = [...'CDEFGAB'].flatMap((l) => [`${l}b`, l, `${l}#`])
const FROM_STARTS = ['C', 'Eb', 'F#3', 'G2', 'Bb5']
const START_TEXTS = ['C', 'Eb', 'F#3', 'Cb', 'B#', 'G2', 'Bb5', 'f#']
const JSON_SCALES = [...new Set(Object.values(raw.qualities).flatMap((opts) => opts.map((o) => `Eb ${o.scale}`)))].sort()
const SCALE_TEXTS = [
  ...ROOTS.flatMap((r) => Object.keys(SCALES).map((k) => `${r} ${k}`)),
  ...Object.keys(ALIASES).map((a) => `D ${a}`),
  ...JSON_SCALES,
  ...['C Dorain', 'H Dorian', 'C', 'Bb  half-whole dim.'], // unknown or malformed
]
const CHORDS = [
  ...['Cm7', 'C-7', 'Cmi7', 'Cmin7', 'Bbm7', 'Am7b5', 'D7#5', 'G7#9b13', 'EbMaj7', 'Cmaj7'],
  ...['CMaj7', 'C9', 'D7/F#', 'Cm6/Eb', 'C6/9', 'Cm6/9', 'F#m7', 'Gm', 'C', 'Bm7', 'Db7(b9)'],
  ...['Abmin7', 'E7alt', 'Bb7sus4', 'F#ø7', 'Cdim7', 'Gbm7b5', 'C#m7', 'B7b9', 'E7(#11)'],
  ...['Fmaj7#11', 'Bb13', 'Ebm(maj7)', 'Ab7/Gb', 'G/B', 'Cm7#5#9x'],
  ...['Csus', 'C7sus4b9', 'Ephryg', 'DbMaj7/C', 'Gbmaj7/F', 'Dbmaj7/B#', 'DbMaj7/F'], // sus b9, slash readings
  ...['H7', 'C7/', '', 'Cmaj7/x'], // unparseable
]
/** chord + scale whose roots differ, or share a pitch but not a spelling */
const CHORD_SCALE_PAIRS = [
  ['C7', 'F# Locrian'],
  ['Db7', 'C# Mixolydian'],
  ['C#m7', 'Db Dorian'],
  ['Gb7/Bb', 'F# Mixolydian'],
  ['D7/F#', 'Ab Altered'],
] as const
/** inline charts for parser paths the library files don't hit */
const CHART_TEXTS: Record<string, string> = {
  inline_defaults: 'TITLE: Defaults\r\nA | 1 | Cm7\r\nA | 2 | F7 |\r\nA | 3 | Bbmaj7 | Bb Lydian\r\n',
  inline_copy: 'title: Copy\nsubtitle: Neg\n# c\nA | 9 | Dm7b5\nA | 10 | G7alt\n@copy A B -8\n@copy B C 0\n',
}

/** engine domain errors are plain Errors; anything else is a bug and must fail */
export const isDomainError = (e: unknown): boolean => e instanceof Error && e.constructor === Error

export function attempt<T>(f: () => T): T | null {
  try {
    return f()
  } catch (e) {
    if (isDomainError(e)) return null
    throw e
  }
}

export function scaleCase(part: Part, text: string, fromStarts: readonly string[]): ScaleCase {
  try {
    const label = scaleLabel(part, text)
    return {
      root: rootName(label.root),
      label: label.name,
      root_notes: scaleNotes(part, text, 'root', 0).map(lilyNote),
      from: Object.fromEntries(fromStarts.map((s) => [s, scaleNotes(part, text, 'from', resolveStart(part.clef, s)).map(lilyNote)])),
    }
  } catch (e) {
    if (isDomainError(e)) return { error: true }
    throw e
  }
}

const repo = (path: string): URL => new URL(`../../../${path}`, import.meta.url)
export const GOLDEN_FILE = repo('fixtures/golden.json')

function libraryCharts(): Record<string, string> {
  const files = readdirSync(repo('charts'))
    .filter((f) => f.endsWith('.txt'))
    .sort()
  return Object.fromEntries(files.map((f) => [f.slice(0, -4), readFileSync(repo(`charts/${f}`), 'utf8')]))
}

/** the fixture as the engine would write it now */
export function buildGolden(): Golden {
  const chords = Object.entries(PARTS).flatMap(([id, part]) => [
    ...CHORDS.flatMap((chord) =>
      [...new Set([null, attempt(() => defaultScale(chord))])].map((scale) => ({
        part: id,
        chord,
        scale,
        tokens: attempt(() => chordTokens(part, chord, scale ?? undefined)),
      })),
    ),
    ...CHORD_SCALE_PAIRS.map(([chord, scale]) => ({ part: id, chord, scale, tokens: attempt(() => chordTokens(part, chord, scale)) })),
  ])
  const charts = Object.fromEntries(
    Object.entries({ ...libraryCharts(), ...CHART_TEXTS }).map(([name, text]) => {
      const doc = parseChart(text).value
      const meta = chartMeta(doc)
      const rows = expandRows(doc).value.map((r) => [r.section, r.bar, r.chord, resolveScale(r)])
      return [name, { text, title: meta.title, subtitle: meta.subtitle, rows }]
    }),
  )
  return {
    parts: PARTS,
    from_starts: FROM_STARTS,
    starts: Object.fromEntries(
      (Object.keys(CLEF_START) as Clef[]).map((clef) => [clef, Object.fromEntries(START_TEXTS.map((s) => [s, resolveStart(clef, s)]))]),
    ) as Record<Clef, Record<string, number>>,
    scales: Object.fromEntries(Object.entries(PARTS).map(([id, part]) => [id, Object.fromEntries(SCALE_TEXTS.map((t) => [t, scaleCase(part, t, FROM_STARTS)]))])),
    chords,
    options: Object.fromEntries(
      CHORDS.map((c) => [c, { options: attempt(() => resolveQuality(c)?.options ?? null), default: attempt(() => defaultScale(c)) }]),
    ),
    charts,
  }
}

/** the file's text: keys sorted at every level, no spaces, one trailing newline (as the Python exporter wrote it) */
export function renderGolden(g: Golden): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]))
        : v
  return `${JSON.stringify(sorted(g))}\n`
}
