/**
 * Measures the guide tone lines (docs/superpowers/specs/2026-10-10-guide-tone-lines-design.md) over every chart in
 * charts/, voiced exactly as the Changes sheet voices them (written order, folded repeats drawn once, blocks for holds).
 * Each line, A (from the 3rd) and B (from the 7th), is built by guideToneLine: on its own (no rule 7), except that lines
 * that meet go apart at the next new chord (docs/superpowers/specs/2026-10-11-guide-lines-diverge-note.md).
 *
 *   npm run guide-lines                      common tone / step / leap shares per line, where the two lines share a pitch,
 *                                            the largest move, each line's height, and every move > a tritone
 *   npm run guide-lines -- --compare         each line alone, with the older global pair search (voiceLead) for reference
 *   --part bass                              a concert bass-clef part instead of the default concert treble
 *   --instrument vibes                       an instrument's part, in its own guide tone range
 *   --check                                  verify the script's chord sequence against buildChanges' labels, one line at a time
 *
 * Moves are between consecutive voiced chords within a run (a rest ends it); a held note is a common tone.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { buildChanges, chartBeats, CONCERT, expandRowLines, guideTonesFor, guideToneLine, guideToneTimeline, INSTRUMENTS, isInstrumentName, isSyncCopy, parseChart, partFor, rangeOf, resolveScale, rootName, voiceLead } from '../src'
import type { ChartLine, GuideInput, LinedRow, Part, Pitched } from '../src'
import { octaveOf } from '../src/keySignature'

const args = process.argv.slice(2)
const flag = (f: string): boolean => args.includes(f)
const REPO = resolve(import.meta.dirname, '..')
const instrument = flag('--instrument') ? args[args.indexOf('--instrument') + 1] : undefined
if (instrument !== undefined && !isInstrumentName(instrument)) throw new Error(`--instrument: no instrument "${instrument}" (${Object.keys(INSTRUMENTS).join(', ')})`)
const part: Part = instrument ? partFor(instrument) : args[args.indexOf('--part') + 1] === 'bass' && flag('--part') ? { ...CONCERT, clef: 'bass' } : CONCERT
/** the part as the report names it: "vibes", or the clef for a concert part */
const partName = instrument ?? `${part.clef} (concert)`
const files = readdirSync(join(REPO, 'charts'))
  .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
  .sort()
  .map((f) => join(REPO, 'charts', f))

type Chord = GuideInput & Readonly<{ at: string; bar: number }> // at: "A 5" (section, written bar); bar: the sheet's bar

/** the chords as the Changes sheet draws them (a mirror of buildChanges' `drawn`: its blocks, folds and endings) */
function drawnChords(text: string): Chord[] {
  const doc = parseChart(text).value
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const { events } = guideToneTimeline(rows, beats)
  const index = new Map<LinedRow, number>(rows.map((r, i) => [r, i]))
  const eventAt = new Map(events.map((e) => [index.get(e.row as LinedRow) ?? -1, e]))
  const barOf = (i: number): number | undefined => {
    const e = eventAt.get(i)
    return e ? Math.floor(e.start / beats) : undefined
  }
  const totalBars = Math.ceil(events.reduce((m, e) => Math.max(m, e.start + e.beats), 0) / beats)
  const rowIndexAt = new Map<string, number>()
  rows.forEach((r, i) => {
    const k = `${r.section}|${r.bar}`
    if (!rowIndexAt.has(k)) rowIndexAt.set(k, i)
  })
  const layoutBar = (section: string, bar: number): number | undefined => {
    const i = rowIndexAt.get(`${section}|${bar}`)
    return i === undefined ? undefined : barOf(i)
  }
  const endings = doc.lines.filter((l): l is Extract<ChartLine, { kind: 'ending' }> => l.kind === 'ending')
  const sectionsWithEndings = new Set(endings.map((e) => e.section))
  const voltaAt = new Map<number, number>()
  for (const e of endings) for (let w = e.from; w <= e.to; w++) {
    const bar = layoutBar(e.section, w)
    if (bar !== undefined) voltaAt.set(bar, e.n)
  }
  type Run = { section: string; rows: number[]; copyOf: string | null; from: number; to: number; times: number }
  const runs: Run[] = []
  rows.forEach((r, i) => {
    const source = doc.lines[r.line]
    const copyOf = source?.kind === 'row' && source.section !== r.section ? source.section : null
    const last = runs.at(-1)
    if (last && last.section === r.section) last.rows.push(i)
    else runs.push({ section: r.section, rows: [i], copyOf, from: 0, to: 0, times: 1 })
  })
  runs.forEach((run, k) => {
    run.from = barOf(run.rows[0] ?? 0) ?? 0
    const next = runs[k + 1]
    run.to = (next ? (barOf(next.rows[0] ?? 0) ?? totalBars) : totalBars) - 1
  })
  const blocks: Run[] = []
  for (const run of runs) {
    const prev = blocks.at(-1)
    const contiguous = prev && run.from === prev.to + 1 + (prev.to - prev.from + 1) * (prev.times - 1)
    if (run.copyOf && prev && prev.section === run.copyOf && contiguous && run.to - run.from === prev.to - prev.from && !sectionsWithEndings.has(run.section) && !sectionsWithEndings.has(prev.section)) {
      prev.times++
      continue
    }
    blocks.push(run)
  }
  let block = -1
  let from = -1 // as buildChanges: a new block at each sheet block and at each 2nd (or later) ending
  let ending = 0
  return blocks.flatMap((b, k) =>
    b.rows.flatMap((i): Chord[] => {
      const e = eventAt.get(i)
      if (!e) return []
      const volta = voltaAt.get(Math.floor(e.start / beats)) ?? 0
      if (k !== from || (volta > 1 && volta !== ending)) block++
      from = k
      ending = volta
      const scale = resolveScale(e.row)
      return [{ row: i, chord: e.chord, ...(scale ? { scale } : {}), start: e.start, beats: e.beats, block, at: `${e.row.section} ${e.row.bar}`, bar: Math.floor(e.start / beats) + 1 }]
    }),
  )
}

type Note = { midi: number; name: string; label: string } | null
const name = (p: Pitched): string => `${rootName(p)}${octaveOf(p)}`
const noteOf = (c: { pitch: Pitched; label: string } | null): Note => (c ? { midi: c.pitch.midi, name: name(c.pitch), label: c.label.replace(/^[b#]+/, '') } : null)

type Seq = Readonly<{ chart: string; chords: readonly Chord[]; lines: readonly (readonly Note[])[] }> // lines: one note a chord, per line
type Method = 'alone' | 'pair' // alone: each line built on its own; pair: voiceLead, for reference

function sequences(method: Method): Seq[] {
  return files.map((file) => {
    const chords = drawnChords(readFileSync(file, 'utf8'))
    const tones = chords.map((c) => guideTonesFor(part, c.chord, c.scale))
    const blocks = chords.map((c) => c.block ?? 0)
    const [a, b] = method === 'alone' ? [guideToneLine(tones, rangeOf(part), 'third', blocks), guideToneLine(tones, rangeOf(part), 'seventh', blocks)] : voiceLead(tones, rangeOf(part))
    return { chart: basename(file, '.txt'), chords, lines: [a.map(noteOf), b.map(noteOf)] }
  })
}

type Move = Readonly<{ chart: string; line: number; j: number; chord: Chord; prev: Chord; from: Note & {}; to: Note & {}; size: number }>
function movesOf(seqs: readonly Seq[]): Move[] {
  return seqs.flatMap((s) =>
    s.lines.flatMap((notes, line) =>
      notes.flatMap((to, j): Move[] => {
        const from = notes[j - 1]
        const [chord, prev] = [s.chords[j], s.chords[j - 1]]
        return to && from && chord && prev ? [{ chart: s.chart, line, j, chord, prev, from, to, size: Math.abs(to.midi - from.midi) }] : []
      }),
    ),
  )
}

const LINES = ['A (from 3rd)', 'B (from 7th)'] as const
const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1)}%` : '-')
const kind = (m: Move): 'common' | 'step' | 'leap' => (m.size === 0 ? 'common' : m.size <= 2 ? 'step' : 'leap')
function shares(moves: readonly Move[]): Record<string, string | number>[] {
  return LINES.map((l, line) => {
    const mine = moves.filter((m) => m.line === line)
    const n = (k: string): number => mine.filter((m) => kind(m) === k).length
    return { line: l, moves: mine.length, 'common tone (0)': pct(n('common'), mine.length), 'step (1-2)': pct(n('step'), mine.length), 'leap (>2)': pct(n('leap'), mine.length), '> tritone': mine.filter((m) => m.size > 6).length }
  })
}
const mdRow = (cells: readonly (string | number)[]): string => `| ${cells.join(' | ')} |`
const mdTable = (head: readonly string[], rows: readonly (readonly (string | number)[])[]): string =>
  [mdRow(head), mdRow(head.map(() => '---')), ...rows.map(mdRow)].join('\n')
const move = (m: Move): string => `${m.prev.chord} -> ${m.chord.chord}`
const leapRow = (m: Move): (string | number)[] => [m.chart, `${m.chord.at} (bar ${m.chord.bar})`, LINES[m.line] ?? '', move(m), `${m.from.name} -> ${m.to.name}`, m.size]

/** the sheet with one line shown (line 0: from the 3rd, 1: from the 7th) against that line of the script */
function check(seqs: readonly Seq[]): void {
  LINES.forEach((lineName, line) => {
    let bad = 0
    files.forEach((file, k) => {
      const text = readFileSync(file, 'utf8')
      const sheet = buildChanges(parseChart(text).value, part, 4, false, line === 0 ? 'third' : 'seventh')
      const theirs = sheet.lines.flatMap((l) => l.bars.flatMap((b) => b.chords.map((c) => c.guide)))
      const s = seqs[k]
      const mine = (s?.chords ?? []).map((_, j) => s?.lines[line]?.[j]?.label ?? '')
      if (theirs.length !== mine.length || theirs.some((t, j) => t !== mine[j])) {
        bad++
        console.log(`MISMATCH ${basename(file)}, ${lineName}: sheet ${theirs.length} chords, script ${mine.length}`)
      }
    })
    console.log(bad ? `${lineName}: ${bad} charts differ from the sheet` : `${lineName}: all ${files.length} charts: chord order and guide labels match the sheet`)
  })
}

/** where the lines share a pitch, the largest move, and how high each line sits: the mean of its chart means */
function together(seqs: readonly Seq[], moves: readonly Move[]): void {
  let [voiced, same, half] = [0, 0, 0]
  for (const s of seqs) {
    const [a = [], b = []] = s.lines
    const both = a.flatMap((x, j) => (x && b[j] ? [x.midi === b[j]?.midi] : []))
    voiced += both.length
    same += both.filter(Boolean).length
    if (both.length && both.filter(Boolean).length / both.length > 0.5) half++
  }
  const top = moves.reduce<Move | undefined>((b, x) => (!b || x.size > b.size ? x : b), undefined)
  const centre = rangeOf(part).centre
  const height = LINES.map((l, line) => {
    const means = seqs.flatMap((s) => {
      const ms = (s.lines[line] ?? []).flatMap((n) => (n ? [n.midi] : []))
      return ms.length ? [ms.reduce((x, y) => x + y, 0) / ms.length] : []
    })
    return { line: l, 'mean of chart means': (means.reduce((x, y) => x + y, 0) / means.length).toFixed(1), centre, 'charts > a M3 below centre': means.filter((m) => m < centre - 4).length }
  })
  console.log(`\n### The two lines together\n`)
  console.log(`chords where both lines share a pitch: ${same} of ${voiced} (${pct(same, voiced)}); charts with the lines identical at more than half their chords: ${half} of ${seqs.length}`)
  if (top) console.log(`largest move: ${top.size} semitones (${leapRow(top).slice(0, 5).join(', ')})`)
  console.log('\n### Each line\'s height')
  console.table(height)
}

function defaultRun(): void {
  const seqs = sequences('alone')
  const moves = movesOf(seqs)
  console.log(`## Guide tone lines over ${seqs.length} charts, ${seqs.reduce((n, s) => n + s.chords.length, 0)} chords, ${partName}\n`)
  console.log('### Moves by line')
  console.table(shares(moves))
  together(seqs, moves)
  const big = moves.filter((m) => m.size > 6)
  console.log(`\n### Moves larger than a tritone (> 6 semitones): ${big.length}\n`)
  if (big.length) console.log(mdTable(['chart', 'section bar', 'line', 'chord -> chord', 'pitch', 'semitones'], big.map(leapRow)))
  const per = [...new Set(big.map((m) => m.chart))].map((c) => [c, big.filter((m) => m.chart === c).length] as const).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  console.log(`\n### Count per chart (${per.length} of ${seqs.length} charts have one)\n`)
  if (per.length) console.log(mdTable(['chart', '> tritone'], per))
}

function compareRun(): void {
  const [g, p] = [sequences('alone'), sequences('pair')]
  const [gm, pm] = [movesOf(g), movesOf(p)]
  const setAt = (s: Seq, j: number): string => s.lines.map((l) => l[j]?.midi ?? -1).sort((x, y) => x - y).join(',')
  let total = 0
  let differ = 0
  const charts = new Set<string>()
  g.forEach((s, k) => {
    const other = p[k]
    if (!other) return
    s.chords.forEach((_, j) => {
      if (!s.lines[0]?.[j]) return
      total++
      if (setAt(s, j) !== setAt(other, j)) {
        differ++
        charts.add(s.chart)
      }
    })
  })
  console.log(`## Each line alone, with the pair search (voiceLead) for reference, ${partName}\n`)
  console.log(`voiced chords where the two pitches differ from the pair's: ${differ} of ${total} (${pct(differ, total)}); charts with any difference: ${charts.size} of ${g.length}\n`)
  const [gs, ps] = [shares(gm), shares(pm)]
  console.log('### Step and leap shares, side by side (pair: reference only; its line 1 / line 2)')
  console.table(LINES.map((l, i) => ({ line: l, 'alone common': gs[i]?.['common tone (0)'], 'pair common': ps[i]?.['common tone (0)'], 'alone step': gs[i]?.['step (1-2)'], 'pair step': ps[i]?.['step (1-2)'], 'alone leap': gs[i]?.['leap (>2)'], 'pair leap': ps[i]?.['leap (>2)'], 'alone >6': gs[i]?.['> tritone'], 'pair >6': ps[i]?.['> tritone'] })))
  const top = (m: readonly Move[]): Move | undefined => m.reduce<Move | undefined>((b, x) => (!b || x.size > b.size ? x : b), undefined)
  const [tg, tp] = [top(gm), top(pm)]
  console.log('\n### Largest leap by method\n')
  console.log(mdTable(['method', 'chart', 'section bar', 'line', 'chord -> chord', 'pitch', 'semitones'], [['alone', ...(tg ? leapRow(tg) : [])], ['pair', ...(tp ? leapRow(tp) : [])]]))
  // open question 2: leaps of a line alone where the pair search stepped (or held) at the same chord, same line index
  const pairAt = new Map(pm.map((m) => [`${m.chart}|${m.line}|${m.j}`, m]))
  const worse = gm
    .flatMap((m) => {
      const q = pairAt.get(`${m.chart}|${m.line}|${m.j}`)
      return m.size > 2 && q && q.size <= 2 ? [{ m, q }] : []
    })
    .sort((x, y) => y.m.size - x.m.size || x.m.chart.localeCompare(y.m.chart))
  const reverse = pm.filter((m) => m.size > 2 && (gm.find((x) => x.chart === m.chart && x.line === m.line && x.j === m.j)?.size ?? 99) <= 2).length
  console.log(`\n### Open question 2: leaps (>2) of a line alone where the pair search stepped (<=2) at the same chord: ${worse.length} (the reverse, pair leaps where the line alone stepped: ${reverse})\n`)
  console.log(mdTable(['chart', 'section bar', 'line', 'chord -> chord', 'alone', 'pair', 'alone size', 'pair size'], worse.slice(0, 20).map(({ m, q }) => [m.chart, `${m.chord.at} (bar ${m.chord.bar})`, LINES[m.line] ?? '', move(m), `${m.from.name} -> ${m.to.name}`, `${q.from.name} -> ${q.to.name}`, m.size, q.size])))
}

if (flag('--check')) check(sequences('alone'))
else if (flag('--compare')) compareRun()
else defaultRun()
