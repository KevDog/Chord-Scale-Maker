import { analyse, chartKeyOf, parseKey } from './analysis'
import { type ChartDoc, type ChartLine, chartBeats, expandRowLines, formPart, type FormPart, type LinedRow, qualityScale } from './chart'
import { type ChordToken, chordTokensOrNull, writtenChordTextOrNull } from './chord'
import { guideToneTimeline } from './guideToneTimeline'
import { arpeggioVoices, isArpeggioPattern, type SheetLine } from './arpeggios'
import { type GuideInput, type GuideNote, guideVoices } from './guideTones'
import { keySignature } from './keySignature'
import { type Part, scaleLabel, writtenRoot } from './part'
import { glyphs, parseRoot, rootName, shiftBy } from './pitch'
import { pentatonicAt, pentatonicLadder, type PentatonicRung, type PentatonicView } from './pentatonics'
import { resolveScales, type ScaleView } from './resolve'
import { abbreviateScale } from './scales'
import { chunk, orNull } from './util'

/**
 * The Changes sheet (docs/plan-changes.md): the chart as a study lead sheet. Bars of slashes in the chart's metre
 * (or, with a line on, a guide tone line from the 3rd or the 7th, a note a chord held for the chord's length, or a
 * 7th chord arpeggio line, each chord's tones struck in quarters, eighths or sixteenths),
 * each chord on its beat with its Roman numeral and its scale, a key-area label where the key changes, section
 * markers, and repeat signs for a @copy straight after its source. No DOM, like sheet.ts and guideTones.ts.
 */

/** a chord's key-area pentatonic at its section's rung (#255, #264): the label, the area's key, its whole ladder, and the section, view and shared count behind the label */
export type ChangesPentatonic = Readonly<{ label: string; key: string; ladder: readonly PentatonicRung[]; section: string; view: PentatonicView; shared: number }>
/** a section the Changes sheet draws (a block): its key (its first section's name), its marker, its place in the form */
export type ChangesSection = Readonly<{ key: string; marker: string; part: FormPart }>
/** the pentatonic row's rungs (#264): a section's own view, else fallback; counts: the shared count follows each label */
export type PentatonicPlan = Readonly<{ bySection: Readonly<Record<string, PentatonicView>>; fallback: PentatonicView; counts: boolean }>
/** a chord on a line: its bar's index in the line and its index in the bar */
export type ChordRef = Readonly<{ bar: number; chord: number }>
/** chords in a row, across bars, at one rung (`to` inclusive) */
export type ContourRun = Readonly<{ from: ChordRef; to: ChordRef; rung: number }>
/** a line's tension contour (#265): its runs, and the rung the line before ended on where this one starts on another */
export type ContourLine = Readonly<{ entry: number | null; runs: readonly ContourRun[] }>

export type ChangesChord = Readonly<{
  /** the beat it starts on, from 0 */
  beat: number
  /** its symbol as the chart has it, in concert pitch */
  text: string
  /** its symbol as drawn for the part, in the chart's notation ("A7" for a concert G7 on a B♭ part); text when it can't be read */
  written: string
  /** the chart row it comes from: the same chord can be analysed differently in another bar */
  at: Readonly<{ section: string; bar: string }>
  /** the index in doc.lines it was written on, to edit it by; a repeat's chord points at the row it repeats */
  line: number
  tokens: readonly ChordToken[] | null
  /** its Roman numeral in its key area (V7/ii); '' when the analysis doesn't reach it */
  numeral: string
  /** its scale, written for the part ("D Phrygian Dominant"); null when it has none */
  scale: string | null
  /** why the analysis gave it its scale ('' when it doesn't reach it) */
  reason: string
  /** the rule id behind its scale ("m4", "D1+D4"); '' when the analysis doesn't reach it */
  rule: string
  /** the rules could only guess its scale (an @key or a function would settle it); never so for a function the author wrote */
  fallback: boolean
  /** its function was written in the chart, not found */
  stated: boolean
  /** why its written function was set aside (it doesn't read, or doesn't fit the chord); '' when it has none or it fits */
  problem: string
  /** the key it's heard in, written for the part ("B♭ major"); '' when the analysis doesn't reach it */
  heardIn: string
  /** where that key came from: the key before its function's colon, an @key over its area, or the analysis */
  keyFrom: 'found' | 'area' | 'function'
  /** its guide tone's label ("3", "7"; "4" on a sus chord); '' with the line off or none found */
  guide: string
  /** its key area's pentatonic at the sheet's rung; null with the row off or no key. `label: ''` where showPentatonics leaves it unprinted */
  pentatonic: ChangesPentatonic | null
}>
export type ChangesBar = Readonly<{
  /** the bar's place in the chart, held bars too: the section as drawn (a repeat's own name) and its bar number */
  at: Readonly<{ section: string; bar: string }>
  /** for a bar of a written-out @copy, the section it repeats (edits go to that section); null otherwise */
  repeatOf: string | null
  /** the chart's key signature, written for the part; null when signatures are off or it has no key: */
  keySig: string | null
  chords: readonly ChangesChord[]
  /** the guide tone or arpeggio line's notes in place of the slashes; [] with the line off */
  voice: readonly GuideNote[]
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
/** sectionEnd: the line is its section's last, where the editor offers a bar to add */
export type ChangesLine = Readonly<{ bars: readonly ChangesBar[]; sectionEnd: boolean }>
export type ChangesSheet = Readonly<{ lines: readonly ChangesLine[]; beats: 2 | 3 | 4; diagnostics: readonly string[] }>

/** a run of rows in one section, as the chart plays them; a copy names the section it repeats */
type Run = { section: string; part: FormPart; rows: number[]; copyOf: string | null; from: number; to: number; times: number; marker: string }

/** "Bb major" (concert) -> "B♭ major", written for the part */
function keyName(name: string, part: Part): string {
  const k = parseKey(name.replace(/ major$/, '').replace(/ minor$/, 'm'))
  const root = /^[A-G][b#]?/.exec(name)?.[0]
  if (!k || !root) return glyphs(name)
  return glyphs(`${rootName(writtenRoot(part, parseRoot(root), k.minor ? 'aeolian' : 'ionian'))} ${k.minor ? 'minor' : 'major'}`)
}

/** a scale as the sheet labels it: its root written for the part (♭/♯ glyphs), the long words shortened; null for none */
export const sheetScale = (part: Part, scale: string | null): string | null => {
  if (!scale) return null
  const label = orNull(() => scaleLabel(part, scale))
  return label ? glyphs(`${rootName(label.root)} ${abbreviateScale(label.name)}`) : scale
}

/**
 * a key area's ladder, written for the part, with the key it is named by: home is the tonic minor (a major key's
 * relative minor), and the key is spelled from that home so the title and the ladder's Home always agree
 */
function areaLadder(name: string, part: Part): Readonly<{ ladder: readonly PentatonicRung[]; key: string }> | null {
  const root = /^[A-G][b#]?/.exec(name)?.[0]
  if (!root) return null
  const minor = / minor$/.test(name)
  const tonic = parseRoot(root)
  const home = minor ? tonic : shiftBy(tonic, 5, 9) // a major 6th up: the relative minor
  const ladder = pentatonicLadder(writtenRoot(part, home, 'aeolian'))
  const homeRoot = ladder[0]!.root
  return { ladder, key: glyphs(minor ? `${rootName(homeRoot)} minor` : `${rootName(shiftBy(homeRoot, 2, 3))} major`) } // a minor third above home
}

/**
 * Changes lines on a printed page, one rule a line:
 * - no guide line: 8, or 7 with numerals, scales and pentatonics all shown;
 * - a guide tone or arpeggio line: 5 with all three rows, 6 with any row, 7 with none.
 * Notes, stems and the label row take more height. Measured over the library in every transposition at letter width,
 * with a page's tallest lines (an ending raised over the stems); the 5 and 7 were measured on Stardust (tuba, From
 * 7th), the documented worst case, and print.spec checks it. The pentatonic contour band (#265) costs no line, so this
 * function takes no contour option: measured with the band drawn on Stardust, all three rows give 7 (no line) and 5 (a
 * line), and one more line spills; with Pentatonics plus Numerals or Scales, 8 and 6 hold.
 */
export function changesLinesPerPage(line: SheetLine, rows: Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean }>): number {
  const all = !!(rows.pentatonics && rows.numerals && rows.scales)
  if (line === 'off') return all ? 7 : 8
  if (all) return 5
  return 6 + (!rows.numerals && !rows.scales && !rows.pentatonics ? 1 : 0)
}

const STANDARD: ScaleView = { level: 'standard', seed: 0 }

/** a bar's name for breakLines: "A 2" */
export const barKey = (at: Readonly<{ section: string; bar: string }>): string => `${at.section} ${at.bar}`

/** the lines with a new line started at each bar named (barKey) that isn't already a line's first: where names don't fit */
export function breakLines(lines: readonly ChangesLine[], at: ReadonlySet<string>): readonly ChangesLine[] {
  if (!at.size) return lines
  return lines.flatMap((line) => {
    const starts = line.bars.flatMap((b, i) => (i === 0 || at.has(barKey(b.at)) ? [i] : []))
    if (starts.length === 1) return [line]
    return starts.map((s, k): ChangesLine => ({ bars: line.bars.slice(s, starts[k + 1]), sectionEnd: line.sectionEnd && k === starts.length - 1 }))
  })
}

/**
 * the pentatonic row as printed (#255), run after breakLines: a chord's label stays on a line's first labelled chord
 * and wherever it differs from the last one shown on the line (relative keys share a home: shown once); elsewhere
 * its label is '' (not printed), its key and ladder kept for nothing but the model's completeness
 */
export function showPentatonics(lines: readonly ChangesLine[]): readonly ChangesLine[] {
  return lines.map((line): ChangesLine => {
    let last: string | null = null // the label last shown on this line
    const bars = line.bars.map((bar): ChangesBar => ({
      ...bar,
      chords: bar.chords.map((c): ChangesChord => {
        if (!c.pentatonic) return c
        const shown = c.pentatonic.label !== last
        last = c.pentatonic.label
        return shown ? c : { ...c, pentatonic: { ...c.pentatonic, label: '' } }
      }),
    }))
    return { ...line, bars }
  })
}

/**
 * the tension contour (#265), run on the lines as drawn: each line's runs of one rung (a chord with no pentatonic is a
 * gap; blanked labels still have their view), and its entry, the previous line's last rung where this line's first
 * chord sits on another
 */
export function pentatonicContour(lines: readonly ChangesLine[]): readonly ContourLine[] {
  let before: number | null = null // the rung the previous line ended on; null: a gap, or no line yet
  return lines.map((line): ContourLine => {
    const rungs = line.bars.flatMap((bar, b) => bar.chords.map((c, k) => ({ at: { bar: b, chord: k }, rung: c.pentatonic?.view.rung ?? null })))
    const runs = rungs.reduce<ContourRun[]>((acc, { at, rung }, i) => {
      if (rung === null) return acc
      const last = acc.at(-1)
      return last && last.rung === rung && rungs[i - 1]?.rung === rung ? [...acc.slice(0, -1), { ...last, to: at }] : [...acc, { from: at, to: at, rung }]
    }, [])
    const first = rungs[0]?.rung ?? null
    const entry = before !== null && first !== null && first !== before ? before : null
    before = rungs.at(-1)?.rung ?? null
    return { entry, runs }
  })
}

type TimelineEvent = ReturnType<typeof guideToneTimeline>['events'][number]
type Timing = Readonly<{ eventAt: ReadonlyMap<number, TimelineEvent>; barOf: (i: number) => number | undefined; totalBars: number }>
function timing(rows: readonly LinedRow[], events: readonly TimelineEvent[], beats: number): Timing {
  const index = new Map<LinedRow, number>(rows.map((r, i) => [r, i]))
  const eventAt = new Map(events.map((e) => [index.get(e.row as LinedRow) ?? -1, e]))
  const barOf = (i: number): number | undefined => {
    const e = eventAt.get(i)
    return e ? Math.floor(e.start / beats) : undefined
  }
  const totalBars = Math.ceil(events.reduce((m, e) => Math.max(m, e.start + e.beats), 0) / beats)
  return { eventAt, barOf, totalBars }
}

/** the blocks the sheet draws: runs of rows in a section, a @copy straight after its source folded into it as a repeat */
function drawnBlocks(doc: ChartDoc, rows: readonly LinedRow[], t: Timing, sectionsWithEndings: ReadonlySet<string>): Run[] {
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
    run.from = t.barOf(run.rows[0] ?? 0) ?? 0
    const next = runs[k + 1]
    run.to = (next ? (t.barOf(next.rows[0] ?? 0) ?? t.totalBars) : t.totalBars) - 1
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
  return blocks
}

/** the sections the Changes sheet draws, in order: a repeat drawn once (A1 · A2) or a section with endings is one (#264) */
export function changesSections(doc: ChartDoc): readonly ChangesSection[] {
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const t = timing(rows, guideToneTimeline(rows, beats).events, beats)
  const withEndings = new Set(doc.lines.flatMap((l) => (l.kind === 'ending' ? [l.section] : [])))
  return drawnBlocks(doc, rows, t, withEndings).map((b) => ({ key: b.section, marker: b.marker, part: b.part }))
}

/** view: the level the sheet plays blank cells at (resolve.ts); the guide tones read the chords only; pentatonic: the row's rungs by section (null: no row) */
export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false, line: SheetLine = 'off', view: ScaleView = STANDARD, pentatonic: PentatonicPlan | null = null): ChangesSheet {
  const rows = expandRowLines(doc).value
  const beats = chartBeats(doc)
  const { events, diagnostics } = guideToneTimeline(rows, beats)
  const analysis = analyse(doc)
  const resolved = resolveScales(doc, view, analysis)
  const keySig = signatures ? keySignature(chartKeyOf(doc), part) : null
  const byRow = new Map(analysis.rows.map((r) => [r.row, r]))
  const problemAt = new Map(analysis.problems.map((p) => [p.line, p.message]))
  const t = timing(rows, events, beats)
  const { eventAt, barOf } = t

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

  const blocks = drawnBlocks(doc, rows, t, sectionsWithEndings)

  // guide tones, as a line over the rows as drawn (a folded repeat is drawn once, so it's voiced once), before the
  // lines are cut, so the pitches don't depend on how many bars a line holds. Holds start afresh at each block and
  // at each 2nd (or later) ending, so a tie never runs into a new section or from one ending into the next
  const drawn = (): GuideInput[] => {
    let block = -1
    let from = -1 // the sheet block the last chord was in
    let ending = 0
    return blocks.flatMap((b, k) =>
      b.rows.flatMap((i): GuideInput[] => {
        const e = eventAt.get(i)
        if (!e) return []
        const volta = voltaAt.get(Math.floor(e.start / beats))?.n ?? 0
        if (k !== from || (volta > 1 && volta !== ending)) block++
        from = k
        ending = volta
        const scale = qualityScale(e.row)
        return [{ row: i, chord: e.chord, ...(scale ? { scale } : {}), start: e.start, beats: e.beats, block }]
      }),
    )
  }
  const voices: { bars: ReadonlyMap<number, readonly GuideNote[]>; labels: ReadonlyMap<number, string>; missing: readonly string[] } | null =
    line === 'off' ? null : isArpeggioPattern(line) ? { ...arpeggioVoices(drawn(), part, beats, keySig, line), labels: new Map() } : guideVoices(drawn(), part, beats, keySig, line)

  const ladders = new Map<string, ReturnType<typeof areaLadder>>()
  const pentatonicOf = (name: string | undefined, section: string): ChangesPentatonic | null => {
    if (!pentatonic || !name) return null
    if (!ladders.has(name)) ladders.set(name, areaLadder(name, part))
    const area = ladders.get(name)
    if (!area) return null
    const view = (Object.hasOwn(pentatonic.bySection, section) ? pentatonic.bySection[section] : undefined) ?? pentatonic.fallback
    const p = pentatonicAt(area.ladder, view)
    return { label: `${p.name}♪${pentatonic.counts ? ` ${p.shared}` : ''}`, key: area.key, ladder: area.ladder, section, view, shared: p.shared }
  }

  let lastKey = ''
  const lastForm = blocks.findLastIndex((b) => b.part === 'form')
  const lines = blocks.flatMap((block, k) => {
    const firstBar = Number((rows[block.rows[0] ?? -1] as LinedRow | undefined)?.bar ?? 1)
    const bars = Array.from({ length: Math.max(1, block.to - block.from + 1) }, (_, j): ChangesBar => {
      const bar = block.from + j
      const chords = block.rows
        .filter((i) => barOf(i) === bar)
        .map((i): ChangesChord => {
          const row = rows[i] as LinedRow
          const a = byRow.get(i)
          const scale = resolved.get(i)?.scale ?? null
          return {
            beat: (eventAt.get(i)?.start ?? bar * beats) - bar * beats,
            text: row.chord,
            written: writtenChordTextOrNull(part, row.chord, scale) ?? row.chord,
            at: { section: row.section, bar: row.bar },
            line: row.line,
            tokens: chordTokensOrNull(part, row.chord, scale),
            numeral: a?.numeral && a.numeral !== '?' ? a.numeral : '',
            scale: sheetScale(part, scale),
            reason: a?.reason ?? '',
            rule: a?.rule && a.rule !== '?' ? a.rule : '',
            fallback: !!a?.fallback && !a?.stated,
            stated: a?.stated ?? false,
            problem: problemAt.get(row.line) ?? '',
            heardIn: a ? keyName((a.statedKey ?? a.key).name, part) : '',
            keyFrom: a?.statedKey ? 'function' : analysis.areas.findLast((x) => x.row <= i)?.stated ? 'area' : 'found',
            guide: voices?.labels.get(i) ?? '',
            pentatonic: pentatonicOf(a?.key.name, block.section),
          }
        })
      const firstKey = block.rows.map((i) => byRow.get(i)).find((a) => a && barOf(a.row) === bar)?.key.name
      const keyArea = firstKey && firstKey !== lastKey ? keyName(firstKey, part) : ''
      for (const i of block.rows) if (barOf(i) === bar) lastKey = byRow.get(i)?.key.name ?? lastKey
      const last = j === block.to - block.from
      const hasEndings = sectionsWithEndings.has(block.section)
      return {
        at: { section: block.section, bar: String(firstBar + j) },
        repeatOf: block.copyOf,
        keySig,
        chords,
        voice: voices?.bars.get(bar) ?? [],
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
    const chunks = chunk(bars, barsPerLine)
    return chunks.map((b, c): ChangesLine => ({ bars: b, sectionEnd: c === chunks.length - 1 }))
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
    return { bars, sectionEnd: line.sectionEnd }
  })
  return { lines: deduped, beats, diagnostics: voices ? [...diagnostics, ...voices.missing] : diagnostics }
}
