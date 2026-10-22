/**
 * The analyser (docs/plan-analysis.md §12): reads charts, reports the rules' scale for every row and why, and with
 * flags writes the result back. Each chart's report ends with its song page: what it lacks, and its search listing.
 *
 *   npm run analyse -- charts/autumn-leaves.txt      report one chart
 *   npm run analyse -- --all                          report every chart, then a summary (and composers who share a surname)
 *   --strip    blank every written scale the rules reproduce (not `# keep:` rows); list the ones they don't
 *   --save     write the analysis into the chart as comments (a reason per row, `# area:` lines, a header)
 *   --quiet    only the summary (and any song page's gaps: they fail the build)
 *   --ambiguous   list what a function, an @key or a context: could settle, and problems with the ones written
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ambiguities, analyse, applyAnalysis, type Analysis, contextLine } from '../src/analysis'
import { type ChartDoc, changesFor, composerIndex, hasAlternates, isSyncCopy, nearDuplicateComposers, parseChart, sameScale, serializeChart, tuneAdvice, tuneDescription, tuneGaps, tuneSummary } from '../src'

const args = process.argv.slice(2)
const flag = (f: string): boolean => args.includes(f)
const REPO = resolve(import.meta.dirname, '..')
const files = flag('--all')
  ? readdirSync(join(REPO, 'charts'))
      .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
      .sort()
      .map((f) => join(REPO, 'charts', f))
  : args.filter((a) => !a.startsWith('--')).map((a) => resolve(process.cwd(), a))
if (!files.length) {
  console.error('usage: npm run analyse -- [--all | charts/x.txt …] [--strip] [--save] [--quiet] [--ambiguous]')
  process.exit(2)
}
const scales = flag('--strip') ? 'strip' : 'none'
const save = flag('--save')
const quiet = flag('--quiet')
const ambiguous = flag('--ambiguous')
const date = new Date().toISOString().slice(0, 10)

function report(name: string, a: Analysis): string[] {
  const head = `${name}: ${a.key?.name ?? 'no key'} (${a.keyFrom})`
  const areas = a.areas.length > 1 ? [`  areas: ${a.areas.map((x) => `${x.key.name} ${x.from}–${x.to}`).join(' · ')}`] : []
  return [head, `  ${contextLine(a)}`, ...areas]
}

/** the chart's song page as search engines will list it, and what it lacks (libraryMeta.test.ts fails on a gap) */
function songPage(text: string, doc: ChartDoc): string[] {
  const t = tuneSummary(text)
  const description = tuneDescription(t)
  return [
    '  Song page:',
    ...tuneGaps(doc).map((g) => `    ✗ ${g}`),
    ...tuneAdvice(doc).map((g) => `    · ${g}`),
    `    title: ${t.title}`,
    `    description (${description.length}): ${description}`,
  ]
}

let agree = 0
let differ = 0
let blank = 0
let unreached = 0
let written = 0
const disagreements: string[] = []
const toReview: string[] = []
const gaps: string[] = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const doc = parseChart(text).value
  const a = analyse(doc)
  // a chart with alternates: the alternate set read too, over the same line indices (its alt rows are the ones it adds)
  const alt = hasAlternates(doc) ? analyse(changesFor(doc, 'alternate')) : undefined
  const name = basename(file, '.txt')
  const lines = report(name, a)
  if (ambiguous) {
    const found = [...ambiguities(a), ...(alt ? ambiguities(alt).map((l) => `alternate: ${l}`) : [])]
    if (found.length) console.log([`${name}:`, ...found.map((l) => `  ${l}`)].join('\n') + '\n')
    continue
  }
  for (const r of [...a.rows, ...(alt?.rows.filter((x) => doc.lines[x.line]?.kind === 'altRow') ?? [])]) {
    const line = doc.lines[r.line]
    const current = line?.kind === 'row' || line?.kind === 'altRow' ? line.scale : ''
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
    const { doc: next, changes, conflicts, overrides } = applyAnalysis(doc, a, { scales, save, date }, alt)
    const out = serializeChart(next)
    if (out !== text) {
      writeFileSync(file, out)
      written++
    }
    if (changes.length) lines.push(`  stripped ${changes.length} scale(s) the rules reproduce`)
    if (scales === 'strip') toReview.push(...overrides.map((o) => `${name} line ${o.line + 1}: bar ${o.bar} ${o.chord} ${o.scale}, rules ${o.rules}`))
    for (const c of conflicts) lines.push(`  @copy: bar ${c.bar} ${c.chord} would be ${c.copy} in the repeat; the source row has ${c.source}`)
  }
  gaps.push(...tuneGaps(doc).map((g) => `${name}: ${g}`))
  lines.push(...songPage(text, doc))
  if (!quiet) console.log(lines.join('\n') + '\n')
}
const filled = agree + differ
// --ambiguous reads no scales, so it has no summary
if (!ambiguous)
  console.log(
    `${files.length} chart(s): ${agree} rows agree, ${differ} differ${filled ? ` (${Math.round((100 * agree) / filled)}% of written scales)` : ''}, ${blank} blank, ${unreached} unreached${written ? `; ${written} file(s) written` : ''}`,
  )
if (!ambiguous) {
  const missing = new Set(gaps.map((g) => g.slice(0, g.indexOf(':')))).size
  console.log(`Song pages: ${files.length - missing} complete, ${missing} missing data`)
}
if (quiet && gaps.length) console.log(gaps.join('\n'))
if (quiet && disagreements.length) console.log(disagreements.join('\n'))
if (toReview.length) console.log(['left as written, without # keep: (add one with its reason, or blank the cell):', ...toReview.map((l) => `  ${l}`)].join('\n'))
// one person under two spellings would get two composer pages: list them for the owner to check, never failing
if (flag('--all')) {
  const index = composerIndex(files.map((f) => ({ slug: basename(f, '.txt'), text: readFileSync(f, 'utf8') })))
  const dupes = nearDuplicateComposers(index)
  if (dupes.length) console.log(['composers who share a surname (one person spelt two ways? write it one way in the charts):', ...dupes.map((g) => `  ${g.join(' · ')}`)].join('\n'))
}
