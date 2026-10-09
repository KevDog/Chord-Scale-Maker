import { analyse, parseKey } from './analysis'
import { type ChartDoc, chartBeats, expandRowLines, formPart, type FormPart, type LinedRow, resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull } from './chord'
import { guideToneTimeline } from './guideToneTimeline'
import { type Part, scaleLabel, writtenRoot } from './part'
import { glyphs, parseRoot, rootName } from './pitch'
import { chunk, orNull } from './util'

/**
 * The Changes sheet (docs/plan-changes.md): the chart as a study lead sheet. Bars of slashes in the chart's metre,
 * each chord on its beat with its Roman numeral and its scale, a key-area label where the key changes, section
 * markers, and repeat signs for a @copy straight after its source. No DOM, like sheet.ts and guideTones.ts.
 */

export type ChangesChord = Readonly<{
  /** the beat it starts on, from 0 */
  beat: number
  text: string
  tokens: readonly ChordToken[] | null
  /** its Roman numeral in its key area (V7/ii); '' when the analysis doesn't reach it */
  numeral: string
  /** its scale, written for the part ("D Phrygian Dominant"); null when it has none */
  scale: string | null
}>
export type ChangesBar = Readonly<{
  chords: readonly ChangesChord[]
  /** a section marker on its first bar: "A1", "A3 (= A1)", "Intro", "Coda (after the last chorus)" */
  marker: string
  /** the key, written for the part, where a key area starts: "B♭ major" */
  keyArea: string
  repeatStart: boolean
  /** the end of a repeated section, and how many times it's played in all (2 or more) */
  repeatEnd: number
  /** the barline after it: the end of the form, of an intro, or of the sheet */
  end: 'none' | 'double' | 'final'
}>
export type ChangesLine = Readonly<{ bars: readonly ChangesBar[] }>
export type ChangesSheet = Readonly<{ lines: readonly ChangesLine[]; beats: 2 | 3 | 4; diagnostics: readonly string[] }>

/** a run of rows in one section, as the chart plays them; a copy names the section it repeats */
type Run = { section: string; part: FormPart; rows: number[]; copyOf: string | null; from: number; to: number; times: number; marker: string }

/** "Bb major" (concert) -> "B♭ major", written for the part */
function keyName(name: string, part: Part): string {
  const k = parseKey(name.replace(/ major$/, '').replace(/ minor$/, 'm'))
  const root = /^[A-G][b#]?/.exec(name)?.[0]
  if (!k || !root) return glyphs(name)
  return glyphs(`${rootName(writtenRoot(part, parseRoot(root)))} ${k.minor ? 'minor' : 'major'}`)
}

const writtenScale = (part: Part, scale: string | null): string | null => {
  if (!scale) return null
  const label = orNull(() => scaleLabel(part, scale))
  return label ? glyphs(`${rootName(label.root)} ${label.name}`) : scale
}

export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4): ChangesSheet {
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const { events, diagnostics } = guideToneTimeline(rows, beats)
  const analysis = analyse(doc)
  const byRow = new Map(analysis.rows.map((r) => [r.row, r]))
  const index = new Map<LinedRow, number>(rows.map((r, i) => [r, i]))
  const eventAt = new Map(events.map((e) => [index.get(e.row as LinedRow) ?? -1, e]))
  const barOf = (i: number): number | undefined => {
    const e = eventAt.get(i)
    return e ? Math.floor(e.start / beats) : undefined
  }
  const totalBars = Math.ceil(events.reduce((m, e) => Math.max(m, e.start + e.beats), 0) / beats)

  // runs of rows in one section; a run whose rows come from another section's lines is a @copy of it
  const runs: Run[] = []
  rows.forEach((r, i) => {
    const source = doc.lines[r.line]
    const copyOf = source?.kind === 'row' && source.section !== r.section ? source.section : null
    const last = runs.at(-1)
    if (last && last.section === r.section) last.rows.push(i)
    else runs.push({ section: r.section, part: formPart(r.section), rows: [i], copyOf, from: 0, to: 0, times: 1, marker: r.section })
  })
  runs.forEach((run, k) => {
    run.from = barOf(run.rows[0] ?? 0) ?? 0
    const next = runs[k + 1]
    run.to = (next ? (barOf(next.rows[0] ?? 0) ?? totalBars) : totalBars) - 1
  })

  // a copy straight after its source (or after the source's earlier repeats) is a repeat; a later one is written out
  const blocks: Run[] = []
  for (const run of runs) {
    const prev = blocks.at(-1)
    const contiguous = prev && run.from === prev.to + 1 + (prev.to - prev.from + 1) * (prev.times - 1)
    if (run.copyOf && prev && prev.section === run.copyOf && contiguous && run.to - run.from === prev.to - prev.from) {
      prev.times++
      prev.marker = `${prev.marker} · ${run.section}`
      continue
    }
    if (run.copyOf) run.marker = `${run.section} (= ${run.copyOf})`
    if (run.part === 'after' && /^(coda|ending)/i.test(run.section)) run.marker = `${run.section} (after the last chorus)`
    blocks.push(run)
  }

  let lastKey = ''
  const lastForm = blocks.findLastIndex((b) => b.part === 'form')
  const lines = blocks.flatMap((block, k) => {
    const bars = Array.from({ length: Math.max(1, block.to - block.from + 1) }, (_, j): ChangesBar => {
      const bar = block.from + j
      const chords = block.rows
        .filter((i) => barOf(i) === bar)
        .map((i): ChangesChord => {
          const row = rows[i] as LinedRow
          const a = byRow.get(i)
          const scale = resolveScale(row)
          return {
            beat: (eventAt.get(i)?.start ?? bar * beats) - bar * beats,
            text: row.chord,
            tokens: chordTokensOrNull(part, row.chord, scale),
            numeral: a?.numeral && a.numeral !== '?' ? a.numeral : '',
            scale: writtenScale(part, scale),
          }
        })
      const firstKey = block.rows.map((i) => byRow.get(i)).find((a) => a && barOf(a.row) === bar)?.key.name
      const keyArea = firstKey && firstKey !== lastKey ? keyName(firstKey, part) : ''
      for (const i of block.rows) if (barOf(i) === bar) lastKey = byRow.get(i)?.key.name ?? lastKey
      const last = j === block.to - block.from
      return {
        chords,
        marker: j === 0 ? block.marker : '',
        keyArea,
        repeatStart: j === 0 && block.times > 1,
        repeatEnd: last && block.times > 1 ? block.times : 0,
        end: !last ? 'none' : k === blocks.length - 1 ? 'final' : k === lastForm || block.part === 'before' ? 'double' : 'none',
      }
    })
    return chunk(bars, barsPerLine).map((b) => ({ bars: b }))
  })
  return { lines, beats, diagnostics }
}
