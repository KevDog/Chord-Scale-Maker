/**
 * The engine against fixtures/golden.json, its frozen answers over a wide fixed set of inputs (see goldenFixture.ts).
 * Each test collects every mismatch so one run shows them all. After an intended change: npm run golden, then review
 * the fixture's diff.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { type Clef, type Part, chartMeta, chordTokens, defaultScale, expandRows, parseChart, resolveQuality, resolveScale, resolveStart } from '..'
import { attempt, buildGolden, GOLDEN_FILE, type Golden, renderGolden, scaleCase } from './goldenFixture'

if (process.env.UPDATE_GOLDEN === '1') writeFileSync(GOLDEN_FILE, renderGolden(buildGolden()))
const TEXT = readFileSync(GOLDEN_FILE, 'utf8')
const G = JSON.parse(TEXT) as Golden

function partFor(id: string): Part {
  const part = G.parts[id]
  if (!part) throw new Error(`fixture has no part ${id}`)
  return part
}

/** compare each [label, want, got]; return the first 20 readable mismatches plus a count */
function mismatches(cases: Iterable<readonly [string, unknown, unknown]>): string[] {
  const bad: string[] = []
  for (const [label, want, got] of cases)
    if (!isDeepStrictEqual(want, got)) bad.push(`${label}\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`)
  return bad.length > 20 ? [...bad.slice(0, 20), `... and ${bad.length - 20} more`] : bad
}

describe('golden fixture', () => {
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
      expect(mismatches(Object.entries(cases).map(([t, want]) => [t, want, scaleCase(part, t, G.from_starts)] as const))).toEqual([])
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
        [`${name} meta`, { title: want.title, subtitle: want.subtitle, key: want.key }, chartMeta(doc)] as const,
        [`${name} rows`, want.rows, rows.value.map((r) => [r.section, r.bar, r.chord, resolveScale(r)])] as const,
      ]
    })
    expect(mismatches(cases)).toEqual([])
  })

  it('covers every current chart, scale and chord (else: npm run golden)', () => {
    expect(renderGolden(buildGolden()) === TEXT).toBe(true)
  })
})
