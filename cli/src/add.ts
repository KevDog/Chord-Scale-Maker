import { decodeIReal, irealToChart, prepareChart } from '@chord-scale-maker/engine'
import { type AddArgs, HEADER_FLAGS, type HeaderFlag, pickSong, saveName } from './args'

/** what csm add does to the world, passed in so the sequence is testable without disk or make */
export type Effects = Readonly<{
  read: (path: string) => string
  exists: (path: string) => boolean
  write: (path: string, text: string) => void
  run: (target: 'golden' | 'og') => number
  out: (line: string) => void
  err: (line: string) => void
  chartsDir: string
  date: string
}>

/** the flag that fills a song page's gap, when there is one (`no composer:` → --composer) */
function gapHint(gap: string): string {
  const key = /^no (\w+):/.exec(gap)?.[1]
  if (key === 'composer') return `${gap} → --composer "…" (or --kind form|exercise)`
  return key && HEADER_FLAGS.includes(key as HeaderFlag) ? `${gap} → --${key} "…"` : `${gap} → edit the chart`
}

/** csm add (docs/superpowers/specs/2026-10-18-csm-add-design.md): one iReal song to a library chart; the exit code */
export function add(args: AddArgs, fx: Effects): number {
  let text: string
  try {
    text = /^irealb(ook)?:\/\//.test(args.input) ? args.input : fx.read(args.input)
  } catch {
    fx.err(`can't read ${args.input}`)
    return 1
  }
  const { value: playlist, diagnostics } = decodeIReal(text)
  for (const d of diagnostics) fx.err(`${d.fatal ? '✗' : '⚠️'} ${d.message}`)
  if (!playlist.songs.length) {
    if (!diagnostics.length) fx.err('no songs in it')
    return 1
  }
  if (args.list) {
    if (playlist.name) fx.out(playlist.name)
    playlist.songs.forEach((s, i) => fx.out(`${i + 1}. ${s.title}${s.composer ? ` (${s.composer})` : ''}`))
    return 0
  }
  const pick = pickSong(playlist, args.song)
  if (typeof pick === 'string') {
    fx.err(pick)
    return 1
  }
  const song = playlist.songs[pick]!
  const imported = irealToChart(song)
  for (const d of imported.diagnostics) fx.err(`⚠️ ${d.message}`)
  const p = prepareChart(imported.value, args.overrides, fx.date)
  const report = (): void => {
    for (const a of p.ambiguities) fx.err(`❓ ${a}`)
    for (const g of p.gaps) fx.err(`✗ ${gapHint(g)}`)
  }
  if (args.print) {
    fx.out(p.chart)
    report()
    for (const a of p.advice) fx.out(`· ${a}`)
    return 0
  }
  const named = saveName(song.title)
  if ('error' in named) {
    fx.err(named.error)
    return 1
  }
  const path = `${fx.chartsDir}${named.slug}.txt`
  if (fx.exists(path) && !args.force) {
    fx.err(`charts/${named.slug}.txt exists: --force to replace it`)
    return 1
  }
  fx.write(path, p.chart)
  fx.out(`📁 charts/${named.slug}.txt`)
  report()
  if (p.gaps.length) return 1
  for (const target of ['golden', 'og'] as const) {
    const code = fx.run(target)
    if (code !== 0) return code
  }
  for (const a of p.advice) fx.out(`· ${a}`)
  fx.out('next: review git diff engine/fixtures web/public/og, then commit the chart with them')
  return 0
}
