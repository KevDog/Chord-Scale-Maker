/**
 * fixtures/analysis.json: the analyser's report over every library chart (docs/plan-analysis.md §13), one row per
 * line so a rule change shows exactly which rows move. After an intended change, or new charts: npm run golden
 * (which rewrites this fixture too), then review its diff.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse, areaSpan } from '../analysis'
import { expandRowLines, parseChart } from '../chart'
import { isSyncCopy } from '../util'

const FILE = new URL('../../fixtures/analysis.json', import.meta.url)
const CHARTS = new URL('../../charts/', import.meta.url)

function build(): string {
  const charts = readdirSync(CHARTS)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .sort()
  const report = Object.fromEntries(
    charts.map((f) => {
      const doc = parseChart(readFileSync(new URL(f, CHARTS), 'utf8')).value
      const a = analyse(doc)
      const rows = expandRowLines(doc).value
      return [
        f.slice(0, -4),
        {
          key: `${a.key?.name ?? 'none'} (${a.keyFrom}, ${a.context})`,
          areas: a.areas.map((x) => `${x.key.name} ${areaSpan(x)}`),
          rows: a.rows.map((r) => `${rows[r.row]?.section} ${r.bar} ${r.chord} [${r.numeral}] → ${r.scale ?? '?'} (${r.rule}) ${r.reason.startsWith(r.fn) ? r.reason : `${r.fn} — ${r.reason}`}`),
        },
      ]
    }),
  )
  return `${JSON.stringify(report, null, 1)}\n`
}

if (process.env.UPDATE_GOLDEN === '1') writeFileSync(FILE, build())

describe('analysis fixture', () => {
  it('matches the analyser over every library chart (else: npm run golden)', () => {
    expect(build() === readFileSync(FILE, 'utf8')).toBe(true)
  })
})
