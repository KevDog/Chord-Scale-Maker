/**
 * One-off (issue #329): rewrite every library chart from the retired row format to section blocks, column-aligned,
 * and list the prose comments that name a bar (for a person to fix).  npm run migrate-charts -w engine
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { migrateChart, parseChart, serializeChart } from '../src'
import { isSyncCopy } from '../src/util'

const dir = new URL('../charts/', import.meta.url)
let failed = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt') && !isSyncCopy(x)).sort()) {
  const url = new URL(f, dir)
  const m = migrateChart(readFileSync(url, 'utf8'))
  if (m.problems.length) {
    failed++
    console.error(`${f}: ${m.problems.join('; ')}`)
    continue
  }
  const parsed = parseChart(m.text)
  if (parsed.diagnostics.length) {
    failed++
    console.error(`${f}: ${parsed.diagnostics.map((d) => `line ${d.line}: ${d.message}`).join('; ')}`)
    continue
  }
  writeFileSync(url, serializeChart(parsed.value))
  for (const p of m.prose) console.log(`${f} ${p}`)
}
process.exitCode = failed ? 1 : 0
