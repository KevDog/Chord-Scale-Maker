/**
 * The analyser (docs/plan-analysis.md §12): reads charts, reports the rules' scale for every row and why, and with
 * flags writes the result back.
 *
 *   npm run analyse -- charts/autumn_leaves.txt      report one chart
 *   npm run analyse -- --all                          report every chart, then a summary
 *   --write    fill blank scale cells          --force   rewrite every cell the rules reach (not `# keep:` rows)
 *   --save     write the analysis into the chart as comments (a reason per row, `# area:` lines, a header)
 *   --quiet    only the summary
 *   --ambiguous   list what a function or an @key could settle, and problems with the ones written
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ambiguities, analyse, applyAnalysis, type Analysis } from '../engine/analysis'
import { isSyncCopy, parseChart, sameScale, serializeChart } from '../engine'

const args = process.argv.slice(2)
const flag = (f: string): boolean => args.includes(f)
const REPO = resolve(import.meta.dirname, '../..')
const files = flag('--all')
  ? readdirSync(join(REPO, 'charts'))
      .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
      .sort()
      .map((f) => join(REPO, 'charts', f))
  : args.filter((a) => !a.startsWith('--')).map((a) => resolve(process.cwd(), a))
if (!files.length) {
  console.error('usage: npm run analyse -- [--all | charts/x.txt …] [--write | --force] [--save] [--quiet] [--ambiguous]')
  process.exit(2)
}
const scales = flag('--force') ? 'force' : flag('--write') ? 'fill' : 'none'
const save = flag('--save')
const quiet = flag('--quiet')
const ambiguous = flag('--ambiguous')
const date = new Date().toISOString().slice(0, 10)

function report(name: string, a: Analysis): string[] {
  const head = `${name}: ${a.key?.name ?? 'no key'} (${a.keyFrom}${a.context === 'functional' ? '' : `, ${a.context}`})`
  const areas = a.areas.length > 1 ? [`  areas: ${a.areas.map((x) => `${x.key.name} ${x.from}–${x.to}`).join(' · ')}`] : []
  return [head, ...areas]
}

let agree = 0
let differ = 0
let blank = 0
let unreached = 0
let written = 0
const disagreements: string[] = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const doc = parseChart(text).value
  const a = analyse(doc)
  const name = basename(file, '.txt')
  const lines = report(name, a)
  if (ambiguous) {
    const found = ambiguities(a)
    if (found.length) console.log([`${name}:`, ...found.map((l) => `  ${l}`)].join('\n') + '\n')
    continue
  }
  for (const r of a.rows) {
    const line = doc.lines[r.line]
    const current = line?.kind === 'row' ? line.scale : ''
    const mark = !r.scale ? '?' : !current ? ' ' : sameScale(current, r.scale) ? '✓' : '≠'
    if (mark === '?') unreached++
    else if (mark === ' ') blank++
    else if (mark === '✓') agree++
    else {
      differ++
      disagreements.push(`${name} bar ${r.bar} ${r.chord}: chart ${current}, rules ${r.scale} (${r.rule}: ${r.reason})`)
    }
    lines.push(`  ${mark} ${r.bar.padStart(3)} ${r.chord.padEnd(10)} ${(r.scale ?? '—').padEnd(26)} ${r.rule.padEnd(7)} ${r.reason}${mark === '≠' ? `   [chart: ${current}]` : ''}`)
  }
  for (const p of a.problems) lines.push(`  ! line ${p.line + 1}: ${p.message}`)
  if (scales !== 'none' || save) {
    const { doc: next, changes, conflicts } = applyAnalysis(doc, a, { scales, save, date })
    const out = serializeChart(next)
    if (out !== text) {
      writeFileSync(file, out)
      written++
    }
    for (const c of changes) lines.push(`  wrote line ${c.line + 1}: ${c.chord} ${c.from || '(default)'} -> ${c.to}`)
    for (const c of conflicts) lines.push(`  @copy: bar ${c.bar} ${c.chord} would be ${c.copy} in the repeat; the source row has ${c.source}`)
  }
  if (!quiet) console.log(lines.join('\n') + '\n')
}
const filled = agree + differ
// --ambiguous reads no scales, so it has no summary
if (!ambiguous)
  console.log(
    `${files.length} chart(s): ${agree} rows agree, ${differ} differ${filled ? ` (${Math.round((100 * agree) / filled)}% of written scales)` : ''}, ${blank} blank, ${unreached} unreached${written ? `; ${written} file(s) written` : ''}`,
  )
if (quiet && disagreements.length) console.log(disagreements.join('\n'))
