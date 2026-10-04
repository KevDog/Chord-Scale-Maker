/**
 * Parity with jazz_scales.py: fixtures/golden.json holds the Python engine's answers
 * (regenerate with  python3 tools/export_fixtures.py). Each test collects every
 * mismatch so one run shows them all.
 */
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  type ChordToken,
  type Clef,
  type Part,
  type ScaleOption,
  chartMeta,
  chordTokens,
  defaultScale,
  expandRows,
  lilyNote,
  parseChart,
  resolveQuality,
  resolveScale,
  resolveStart,
  rootName,
  scaleLabel,
  scaleNotes,
} from '..'

type ScaleCase =
  | { error: true }
  | { root: string; label: string; root_notes: string[]; from: Record<string, string[]> }
type Golden = {
  parts: Record<string, Part>
  from_starts: string[]
  starts: Record<Clef, Record<string, number>>
  scales: Record<string, Record<string, ScaleCase>>
  chords: { part: string; chord: string; scale: string | null; tokens: ChordToken[] | null }[]
  options: Record<string, { options: ScaleOption[] | null; default: string | null }>
  charts: Record<string, { text: string; title: string; subtitle: string; rows: string[][] }>
}

const repo = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
const G = JSON.parse(repo('fixtures/golden.json')) as Golden

function partFor(id: string): Part {
  const part = G.parts[id]
  if (!part) throw new Error(`fixture has no part ${id}`)
  return part
}

/** engine domain errors are plain Errors (Python's ValueError); anything else is a bug and must fail */
const isDomainError = (e: unknown): boolean => e instanceof Error && e.constructor === Error

function attempt<T>(f: () => T): T | null {
  try {
    return f()
  } catch (e) {
    if (isDomainError(e)) return null
    throw e
  }
}

/** compare each [label, want, got]; return the first 20 readable mismatches plus a count */
function mismatches(cases: Iterable<readonly [string, unknown, unknown]>): string[] {
  const bad: string[] = []
  for (const [label, want, got] of cases)
    if (!isDeepStrictEqual(want, got)) bad.push(`${label}\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`)
  return bad.length > 20 ? [...bad.slice(0, 20), `... and ${bad.length - 20} more`] : bad
}

function scaleCase(part: Part, text: string): ScaleCase {
  try {
    const label = scaleLabel(part, text)
    return {
      root: rootName(label.root),
      label: label.name,
      root_notes: scaleNotes(part, text, 'root', 0).map(lilyNote),
      from: Object.fromEntries(
        G.from_starts.map((s) => [s, scaleNotes(part, text, 'from', resolveStart(part.clef, s)).map(lilyNote)]),
      ),
    }
  } catch (e) {
    if (isDomainError(e)) return { error: true }
    throw e
  }
}

describe('golden parity with jazz_scales.py', () => {
  it('fixture has every section', () => {
    expect(Object.keys(G.parts)).toHaveLength(5)
    expect(Object.keys(G.scales)).toEqual(Object.keys(G.parts))
    for (const section of [G.from_starts, G.chords, Object.keys(G.options), Object.keys(G.charts)])
      expect(section.length).toBeGreaterThan(0)
  })

  it('start notes', () => {
    const cases = Object.entries(G.starts).flatMap(([clef, starts]) =>
      Object.entries(starts).map(([s, want]) => [`${clef} ${s}`, want, resolveStart(clef as Clef, s)] as const),
    )
    expect(mismatches(cases)).toEqual([])
  })

  for (const [partId, cases] of Object.entries(G.scales)) {
    it(`scales, ${partId}`, () => {
      const part = partFor(partId)
      expect(mismatches(Object.entries(cases).map(([t, want]) => [t, want, scaleCase(part, t)] as const))).toEqual([])
    })
  }

  it('chord symbols', () => {
    const cases = G.chords.map(
      (c) =>
        [
          `${c.part} ${c.chord} / ${c.scale}`,
          c.tokens,
          attempt(() => chordTokens(partFor(c.part), c.chord, c.scale ?? undefined)),
        ] as const,
    )
    expect(mismatches(cases)).toEqual([])
  })

  it('quality options and defaults', () => {
    const cases = Object.entries(G.options).flatMap(([chord, want]) => [
      [`${chord} options`, want.options, attempt(() => resolveQuality(chord)?.options ?? null)] as const,
      [`${chord} default`, want.default, attempt(() => defaultScale(chord))] as const,
    ])
    expect(mismatches(cases)).toEqual([])
  })

  it('library charts', () => {
    const cases = Object.entries(G.charts).flatMap(([name, want]) => {
      const { value: doc, diagnostics } = parseChart(want.text)
      const rows = expandRows(doc)
      return [
        [`${name} diagnostics`, [], [...diagnostics, ...rows.diagnostics]] as const,
        [`${name} meta`, { title: want.title, subtitle: want.subtitle }, chartMeta(doc)] as const,
        [`${name} rows`, want.rows, rows.value.map((r) => [r.section, r.bar, r.chord, resolveScale(r)])] as const,
      ]
    })
    expect(mismatches(cases)).toEqual([])
  })
})
