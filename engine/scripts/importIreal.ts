/**
 * An iReal Pro song as a library chart (docs/superpowers/specs/2026-10-17-ireal-import-design.md, "CLI"):
 *   npm run import-ireal -- <irealb:// link | export.html> [--list] [--song <n | title>] [--save] [--force]
 * Prints the chart (or writes engine/charts/<slug>.txt with --save) and what it couldn't map. Then the usual
 * new-chart steps: check the header, analyse --save, --ambiguous, make golden, make og.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { decodeIReal, irealToChart } from '../src'
import { chartSlug, parseImportArgs, pickSong } from './importIrealArgs'

const CHARTS = new URL('../charts/', import.meta.url).pathname

const args = parseImportArgs(process.argv.slice(2))
if (typeof args === 'string') {
  console.error(args)
  process.exit(1)
}
const text = /^irealb(ook)?:\/\//.test(args.input) ? args.input : readFileSync(args.input, 'utf8')
const { value: playlist, diagnostics } = decodeIReal(text)
for (const d of diagnostics) console.error(`${d.fatal ? '✗' : '⚠️'} ${d.message}`)
if (!playlist.songs.length) process.exit(1)

if (args.list) {
  if (playlist.name) console.log(playlist.name)
  playlist.songs.forEach((s, i) => console.log(`${i + 1}. ${s.title}${s.composer ? ` (${s.composer})` : ''}`))
  process.exit(0)
}
const pick = pickSong(playlist, args.song)
if (typeof pick === 'string') {
  console.error(pick)
  process.exit(1)
}
const song = playlist.songs[pick]!
const chart = irealToChart(song)
const slug = chartSlug(song.title)
if (args.save) {
  const path = `${CHARTS}${slug}.txt`
  if (existsSync(path) && !args.force) {
    console.error(`charts/${slug}.txt exists: --force to replace it`)
    process.exit(1)
  }
  writeFileSync(path, chart.value)
  console.log(`📁 charts/${slug}.txt`)
} else console.log(chart.value)
for (const d of chart.diagnostics) console.log(`⚠️ ${d.message}`)
if (args.save) console.log(`next: check composer:/form:, add recording:/aka:, then npm run analyse -- charts/${slug}.txt --save`)
