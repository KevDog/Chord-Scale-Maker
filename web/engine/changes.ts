import { analyse, parseKey } from './analysis'
import { type ChartDoc, type ChartLine, chartBeats, expandRowLines, formPart, type FormPart, type LinedRow, resolveScale } from './chart'
import { type ChordToken, chordTokensOrNull } from './chord'
import { guideToneTimeline } from './guideToneTimeline'
import { type Part, scaleLabel, writtenRoot } from './part'
import { glyphs, parseRoot, rootName } from './pitch'
import { abbreviateScale } from './scales'
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
  /** a 1st/2nd-ending bracket on this bar; null for none. start/end mark the bracket's first/last bar */
  volta: { n: number; start: boolean; end: boolean } | null
  /** a segno glyph above this bar */
  segno: boolean
  /** a coda glyph above this bar (the "To Coda" departure and the Coda arrival both use it) */
  coda: boolean
  /** a navigation instruction above this bar ("D.S. al Coda"); '' = none; several joined with " · " */
  nav: string
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
  return label ? glyphs(`${rootName(label.root)} ${abbreviateScale(label.name)}`) : scale
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

  // directives read straight from doc.lines (like the @copy detection), keyed by section + written bar
  const rowKey = (section: string, bar: number | string): string => `${section}|${bar}`
  const rowIndexAt = new Map<string, number>()
  rows.forEach((r, i) => {
    const k = rowKey(r.section, r.bar)
    if (!rowIndexAt.has(k)) rowIndexAt.set(k, i)
  })
  const layoutBar = (section: string, bar: number): number | undefined => {
    const i = rowIndexAt.get(rowKey(section, bar))
    return i === undefined ? undefined : barOf(i)
  }
  const endings = doc.lines.filter((l): l is Extract<ChartLine, { kind: 'ending' }> => l.kind === 'ending')
  const sectionsWithEndings = new Set(endings.map((e) => e.section))
  const voltaAt = new Map<number, { n: number; start: boolean; end: boolean }>()
  const repeatEndBars = new Set<number>() // last layout bar of each section's 1st ending
  for (const e of endings) {
    for (let w = e.from; w <= e.to; w++) {
      const bar = layoutBar(e.section, w)
      if (bar !== undefined) voltaAt.set(bar, { n: e.n, start: w === e.from, end: w === e.to })
    }
    if (e.n === 1) {
      const last = layoutBar(e.section, e.to)
      if (last !== undefined) repeatEndBars.add(last)
    }
  }
  const segnoBars = new Set<number>()
  const codaBars = new Set<number>()
  const navAt = new Map<number, string[]>()
  for (const l of doc.lines) {
    if (l.kind === 'mark') {
      const bar = layoutBar(l.section, l.bar)
      if (bar !== undefined) (l.mark === 'segno' ? segnoBars : codaBars).add(bar)
    }
    if (l.kind === 'nav') {
      const bar = layoutBar(l.section, l.bar)
      if (bar !== undefined) navAt.set(bar, [...(navAt.get(bar) ?? []), l.text])
    }
  }

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
    if (run.copyOf && prev && prev.section === run.copyOf && contiguous && run.to - run.from === prev.to - prev.from && !sectionsWithEndings.has(run.section) && !sectionsWithEndings.has(prev.section)) {
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
      const hasEndings = sectionsWithEndings.has(block.section)
      return {
        chords,
        marker: j === 0 ? block.marker : '',
        keyArea,
        repeatStart: hasEndings ? j === 0 : j === 0 && block.times > 1,
        repeatEnd: hasEndings ? (repeatEndBars.has(bar) ? 2 : 0) : last && block.times > 1 ? block.times : 0,
        end: !last ? 'none' : k === blocks.length - 1 ? 'final' : k === lastForm || block.part === 'before' ? 'double' : 'none',
        volta: voltaAt.get(bar) ?? null,
        segno: segnoBars.has(bar),
        coda: codaBars.has(bar),
        nav: (navAt.get(bar) ?? []).join(' · '),
      }
    })
    return chunk(bars, barsPerLine).map((b) => ({ bars: b }))
  })

  // within each line, blank a chord's scale when it repeats the previous chord's (the first chord always shows its scale)
  const deduped = lines.map((line): ChangesLine => {
    let prev: string | null = null
    const bars = line.bars.map((bar): ChangesBar => ({
      ...bar,
      chords: bar.chords.map((c): ChangesChord => {
        if (c.scale && c.scale === prev) return { ...c, scale: null }
        prev = c.scale
        return c
      }),
    }))
    return { bars }
  })
  return { lines: deduped, beats, diagnostics }
}
