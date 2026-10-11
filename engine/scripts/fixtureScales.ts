/**
 * The scale-only check (docs/superpowers/specs/2026-10-10-function-labels-design.md §3 step 4): compares every scale
 * in fixtures/golden.json and fixtures/analysis.json between a git ref and the working tree, and ignores everything
 * else (numerals, functions, reasons, chart comments). For a change that should move text but no scale.
 *
 *   npm run fixture-scales                 against main
 *   npm run fixture-scales -- <ref>        against another ref (a branch, a tag, a commit)
 *
 * Prints each difference (where, before → after) and exits 1 if any; "no scale changed" and exit 0 otherwise.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '..')
const ref = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'main'

type Json = null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json }
type Obj = { readonly [k: string]: Json }
/** where a scale is, and the scale ('' when there is none) */
type Scales = ReadonlyMap<string, string>

const show = (path: string): string =>
  execFileSync('git', ['show', `${ref}:${path}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
/** the file at the ref: in engine/ since the engine became its own package, at the repo root before (`./` and `../` are relative to the cwd, engine/) */
const atRef = (file: string): Json => {
  let text: string
  try {
    text = show(`./${file}`)
  } catch {
    text = show(`../${file}`)
  }
  return JSON.parse(text) as Json
}
const atTree = (file: string): Json => JSON.parse(readFileSync(join(REPO, file), 'utf8')) as Json

const obj = (x: Json | undefined): Obj => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {})
const arr = (x: Json | undefined): readonly Json[] => (Array.isArray(x) ? x : [])
const str = (x: Json | undefined): string => (typeof x === 'string' ? x : x === null || x === undefined ? '' : JSON.stringify(x))

/**
 * golden.json's scales: each chart row's (its 4th cell), each symbol's (chords), each quality's default and options
 * (options), and each part's spelled scales (scales: a scale's notes, as JSON)
 */
function goldenScales(g: Json): Scales {
  const out = new Map<string, string>()
  const root = obj(g)
  for (const [chart, c] of Object.entries(obj(root.charts)))
    arr(obj(c).rows).forEach((row, i) => {
      const [section, bar, chord, scale] = arr(row).map(str)
      out.set(`golden charts.${chart} row ${i + 1} (${section} ${bar} ${chord})`, scale ?? '')
    })
  arr(root.chords).forEach((c, i) => out.set(`golden chords[${i}] (${str(obj(c).chord)}, ${str(obj(c).part)})`, str(obj(c).scale)))
  for (const [chord, o] of Object.entries(obj(root.options))) {
    out.set(`golden options.${chord} default`, str(obj(o).default))
    arr(obj(o).options).forEach((x, i) => out.set(`golden options.${chord} option ${i + 1}`, str(obj(x).scale)))
  }
  for (const [part, scales] of Object.entries(obj(root.scales))) for (const [name, s] of Object.entries(obj(scales))) out.set(`golden scales.${part}.${name}`, JSON.stringify(s))
  return out
}

/** analysis.json's row strings: "5 Gm7 [ii7] → G Dorian (m4) ii of …"; the scale sits between "] → " and " (rule)" */
const ROW = /^(.*?) \[.*?\] → (.+?) \(([^()\s]+)\)(?: |$)/
function analysisScales(a: Json): Scales {
  const out = new Map<string, string>()
  for (const [chart, c] of Object.entries(obj(a)))
    arr(obj(c).rows).forEach((row, i) => {
      const m = ROW.exec(str(row))
      out.set(`analysis ${chart} row ${i + 1} (${m?.[1] ?? str(row)})`, m?.[2] ?? `unreadable row: ${str(row)}`)
    })
  return out
}

/** each place whose scale differs, or that only one side has */
function differences(before: Scales, after: Scales): string[] {
  const keys = [...new Set([...before.keys(), ...after.keys()])]
  return keys.flatMap((k) => {
    const b = before.get(k)
    const a = after.get(k)
    if (b === a) return []
    return [`${k}: ${b ?? '(none)'} → ${a ?? '(none)'}`]
  })
}

const diffs = [
  ...differences(goldenScales(atRef('fixtures/golden.json')), goldenScales(atTree('fixtures/golden.json'))),
  ...differences(analysisScales(atRef('fixtures/analysis.json')), analysisScales(atTree('fixtures/analysis.json'))),
]
if (diffs.length) {
  for (const d of diffs) console.log(d)
  console.log(`${diffs.length} scale(s) changed against ${ref}`)
  process.exit(1)
}
console.log(`no scale changed against ${ref}`)
