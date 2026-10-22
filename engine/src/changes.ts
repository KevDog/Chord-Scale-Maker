import { analyse, chartKeyOf, parseKey } from './analysis'
import { type Beats, type ChartDoc, chartBeats, type FormPart, type LinedRow, qualityScale, type Row } from './chart'
import { type ChordToken, chordTokensOrNull, parseChord, writtenChordRootLenient, writtenChordTextOrNull } from './chord'
import { type HexatonicBasis, type HexPair, hexatonicPairs, hexatonicRanking, keyedPair, pickablePairs, writtenKeyPair } from './hexatonics'
import { guideToneTimeline } from './guideToneTimeline'
import { type Directive, type Layout, sectionLayout } from './layout'
import { barAt, barLength, barStart, type Clock } from './metre'
import { type HexPick, livePick, type PentPick, pickTarget, type QuartPick } from './chordPicks'
import type { Approach } from './approaches'
import { arpeggioVoices, isArpeggioPattern, type SheetLine } from './arpeggios'
import { type GuideInput, type GuideNote, guideVoices } from './guideTones'
import { keySignature } from './keySignature'
import { type CellsLine, cellsVoices } from './cells'
import { type PentatonicLine, pentatonicVoices } from './pentatonicLine'
import { type TriadPairLine, triadPairVoices } from './triadPairLine'
import { concertPc, type Part, rangeOf, scaleLabel, writtenRoot, writtenScale } from './part'
import { glyphs, mod, parseRoot, pcOf, rootName, type Spelled, shiftBy } from './pitch'
import { isPentatonicPreset, type PentatonicDegree, pentatonicDegreeFrom, PENTATONIC_HOME, PENTATONIC_STEP, pentatonicAt, pentatonicCycle, pentatonicPathCaption, type PentatonicPathName, type PentatonicStep, pentatonicLadder, pentatonicRanking, type RankedPentatonic, type PentatonicRung, type PentatonicView } from './pentatonics'
import { baseQuality, readChord } from './qualities'
import { bluesTonic, isBluesRule, type Resolved, resolveScales, type ScaleView } from './resolve'
import { abbreviateScale } from './scales'
import { type QuartalNotesChoice, type QuartalStack, rankedStacks } from './quartal'
import { type QuartalLine, quartalVoices } from './quartalLine'
import { chunk, orNull } from './util'
import { layRhythm, phrasingCaption, rhythmCaption, type RhythmId, type RhythmNote, rhythmNotes, type RhythmPlan, type RhythmStart, targetBeats } from './rhythm'

/**
 * The Changes sheet (docs/plan-changes.md): the chart as a study lead sheet. Bars of slashes in the chart's metre
 * (or, with a line on, a guide tone line from the 3rd or the 7th, a note a chord held for the chord's length, or a
 * 7th chord arpeggio line, each chord's tones struck in quarters, eighths or sixteenths),
 * each chord on its beat with its Roman numeral and its scale, a key-area label where the key changes, section
 * markers, and repeat signs for a copy: straight after its source. No DOM, like sheet.ts and guideTones.ts.
 */

export type ChordAt = string // `${section}:${bar}:${k}`: the drawn bar's at.section, at.bar, the chord's index in the bar
/** a chord the Changes sheet draws, by its ChordAt, with its chart text */
export type DrawnChord = Readonly<{ at: ChordAt; text: string }>
export type PentatonicBasis = 'key' | 'chord'
/** what a chord's pick would be made for (#303): its chart text and resolved scale, concert; null when it has no scale */
export type PickSource = Readonly<{ chord: string; scale: string }> | null
/** a chord's pentatonic (#255, #264, #272): its label, and what made it (the key area's ladder or its own scale's ranking) */
export type ChangesPentatonic = Readonly<{
  label: string
  basis: PentatonicBasis
  title: string // 'B · F major pentatonic ladder' | 'Dm7 · D Aeolian pentatonic ranking'
  key: string // key basis: the area's key; chord basis: ''
  scale: string // its scale, written ('D Aeolian'); '' when it has none
  ladder: readonly PentatonicRung[] // key basis; [] for chord
  ranking: readonly RankedPentatonic[] // chord basis; [] for key
  section: string
  chord: ChordAt
  view: PentatonicView // key basis: the rung played; chord basis: PENTATONIC_HOME
  degree: number | null // chord basis: the degree it's built on, semitones above the chord root; null for key
  root: Spelled // written
  name: string // 'Dm'
  shared: number
  level: number // 0–6, by shared count (the label's tint)
  pc: number // concert pitch class of root
  picked: boolean
  run: readonly ChordAt[] // a printed label's chord and the following ones it stands for; [] on an unprinted label
  sheet: string // the name it plays without a pick (#303)
  source: PickSource
}>
/** the line the Changes sheet draws: off, a guide tone line, a 7th chord arpeggio pattern, the Pentatonic line (#284) or the Triad pair line (#325) */
export type ChangesLineChoice = SheetLine | PentatonicLine | TriadPairLine | QuartalLine | CellsLine
/** a section the Changes sheet draws (a block): its key (its first section's name), its marker, its place in the form */
export type ChangesSection = Readonly<{ key: string; marker: string; part: FormPart }>
/** the pentatonic row's rungs (#264): a section's own view, else fallback; counts: the shared count follows each label */
export type PentatonicPlan = Readonly<{
  kind: 'pentatonic'
  bySection: Readonly<Record<string, PentatonicView>>
  fallback: PentatonicView
  counts: boolean
  basis?: PentatonicBasis // default 'key'
  degree?: PentatonicDegree // chord basis (#286): the degree each chord's pentatonic is built on, 0–11, or Auto (the default; a bad one reads as Auto)
  picks?: Readonly<Record<ChordAt, PentPick>> // a picked pentatonic's root, concert pc, and what it was picked for (#303)
  path?: PentatonicPathName // a preset (#276): each chord plays its unit's step of it; bySection and fallback then unused
  step?: PentatonicStep // what a preset steps by; default PENTATONIC_STEP
}>
/** the Hexatonic overlay: each chord's Auto pair on its resolved scale (basis 'chord', the default) or its key area's pair (basis 'key', #432), or its live pick (#303) */
export type HexatonicPlan = Readonly<{ kind: 'hexatonic'; basis?: HexatonicBasis; picks?: Readonly<Record<ChordAt, HexPick>> }>
/** the Quartal overlay (#432): each chord's Auto stack of fourths on its resolved scale (notes: 3 or 4, default 4; perfect: perfect fourths only), or its live pick */
export type QuartalPlan = Readonly<{ kind: 'quartal'; notes?: QuartalNotesChoice; perfect?: boolean; picks?: Readonly<Record<ChordAt, QuartPick>> }>
/** the row under the chords (Off | Pentatonic | Hexatonic | Quartal): null for none */
export type OverlayPlan = PentatonicPlan | HexatonicPlan | QuartalPlan
/**
 * a chord's hexatonic: the pair it plays ("G/Am", its pick or else Auto), and its label (the name; '' where
 * showHexatonics leaves it unprinted); run and picked as the pentatonic row's (#303); sheet: the name it plays without
 * a pick; offKey: ranked against the key, its chain lacks the key's pair, so it plays its Auto (#432)
 */
export type ChangesHexatonic = Readonly<{ label: string; name: string; chord: ChordAt; picked: boolean; run: readonly ChordAt[]; sheet: string; source: PickSource; offKey: boolean }>
/** a chord's quartal stack (#432): the stack it plays ('D G C F', its pick or else Auto) and its label, run, picked and sheet as the hexatonic row's; degree: the scale degree it's built on */
export type ChangesQuartal = Readonly<{ label: string; name: string; chord: ChordAt; picked: boolean; run: readonly ChordAt[]; sheet: string; source: PickSource; degree: number }>

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
  /** its scale is written in the chart: it plays at every level */
  pinned: boolean
  /** a slash chord that takes its scales from another chord on its bass (DbMaj7/C → C 7sus4♭9) */
  slash: boolean
  /** why its written function was set aside (it doesn't read, or doesn't fit the chord); '' when it has none or it fits */
  problem: string
  /** the key it's heard in, written for the part ("B♭ major"); '' when the analysis doesn't reach it */
  heardIn: string
  /** at Basic, a blues chord's level note ("Basic: the E Blues scale over the whole blues"); '' otherwise */
  levelNote: string
  /** where that key came from: the key before its function's colon, an @key over its area, or the analysis */
  keyFrom: 'found' | 'area' | 'function'
  /** its guide tone's label ("3", "7"; "4" on a sus chord); '' with the line off or none found */
  guide: string
  /** its pentatonic (key area's ladder or its own scale's ranking); null with the row off, no key (key basis) or no scale (chord basis). `label: ''` where showPentatonics leaves it unprinted */
  pentatonic: ChangesPentatonic | null
  /** its hexatonic (the Auto pair of its resolved scale, written for the part); null with the overlay not Hexatonic, no scale, or no pairs */
  hexatonic: ChangesHexatonic | null
  /** its quartal stack (#432); null with the overlay not Quartal, no scale, or no stacks */
  quartal: ChangesQuartal | null
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
  /** the rhythm line's notes in place of the slashes (rhythm spec §8); [] with the rhythm off or a Line on */
  rhythm: readonly RhythmNote[]
  /** its target beats, from 0 (rhythm spec §7); [] with target beats off */
  targets: readonly number[]
  /** a section marker on its first bar: "A1", "A3 (= A1)", "Intro", "Coda (after the last chorus)" */
  marker: string
  /** the key, written for the part, where a key area starts: "B♭ major" */
  keyArea: string
  repeatStart: boolean
  /** its metre's beats (#235) */
  beats: Beats
  /** the time signature drawn at its start ("3/4"): on the sheet's first bar and wherever the metre changes; null for none */
  timeSignature: string | null
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
/** pentatonicCaption: the path a preset plays (#276), "Pentatonics: Fifths · every 4 bars"; null otherwise */
/** beats: the song's metre (each bar has its own, ChangesBar.beats) */
/** rhythmCaption: the rhythm line's label and cycle, "Rhythm: 8ths in 5 · back on one every 5 bars"; null with no rhythm drawn */
export type ChangesSheet = Readonly<{ lines: readonly ChangesLine[]; beats: Beats; diagnostics: readonly string[]; pentatonicCaption: string | null; rhythmCaption: string | null }>

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
 * - a guide tone or arpeggio line, or a rhythm line (rhythm spec §8): 5 with all three rows, 6 with any row, 7 with none.
 * Notes, stems and the label row take more height. Measured over the library in every transposition at letter width,
 * with a page's tallest lines (an ending raised over the stems); the 5 and 7 were measured on Stardust (tuba, From
 * 7th), the documented worst case, and print.spec checks it. With Pentatonics plus Numerals or Scales, 8 and 6 hold
 * (measured with the contour band #265 drew, since removed: #277).
 */
export function changesLinesPerPage(line: ChangesLineChoice, rows: Readonly<{ numerals: boolean; scales: boolean; pentatonics?: boolean; hexatonics?: boolean; quartals?: boolean }>, rhythm = false): number {
  const overlay = !!(rows.pentatonics || rows.hexatonics || rows.quartals) // the hexatonic and quartal rows take the pentatonic row's place and height
  const all = overlay && rows.numerals && rows.scales
  if (line === 'off' && !rhythm) return all ? 7 : 8
  if (all) return 5
  return 6 + (!rows.numerals && !rows.scales && !overlay ? 1 : 0)
}

const STANDARD: ScaleView = { level: 'standard', seed: 0 }

/** a bar's name for breakLines: "A 2" */
export const barKey = (at: Readonly<{ section: string; bar: string }>): string => `${at.section} ${at.bar}`

/** a chord of the other set, for the small line above a bar: its beat and its symbol as drawn for the part; held: none starts in the bar, it goes on from before (#491) */
export type AltChord = Readonly<{ beat: number; written: string; held: boolean }>

/**
 * the other set's chords by barKey, for the bars where it plays differently from main's: a bar's own chords, or on a
 * held bar the chord held into it (marked held); a bar the other set leaves empty maps to []
 */
export function otherChords(main: ChangesSheet, other: ChangesSheet): ReadonlyMap<string, readonly AltChord[]> {
  const chordsOf = (sheet: ChangesSheet): ReadonlyMap<string, readonly AltChord[]> => {
    let last = ''
    return new Map(
      sheet.lines.flatMap((l) => l.bars).map((b) => {
        const own = b.chords.map((c) => ({ beat: c.beat, written: c.written, held: false }))
        last = own.at(-1)?.written ?? last
        return [barKey(b.at), own.length || !last ? own : [{ beat: 0, written: last, held: true }]]
      }),
    )
  }
  const theirs = chordsOf(other)
  const same = (x: readonly AltChord[], y: readonly AltChord[]) => x.length === y.length && x.every((c, i) => c.beat === y[i]?.beat && c.written === y[i]?.written)
  return new Map(
    [...chordsOf(main)].flatMap(([key, mine]) => {
      const alt = theirs.get(key) ?? []
      return same(mine, alt) ? [] : [[key, alt] as const]
    }),
  )
}

/** the lines with a new line started at each bar named (barKey) that isn't already a line's first: where names don't fit */
export function breakLines(lines: readonly ChangesLine[], at: ReadonlySet<string>): readonly ChangesLine[] {
  if (!at.size) return lines
  return lines.flatMap((line) => {
    const starts = line.bars.flatMap((b, i) => (i === 0 || at.has(barKey(b.at)) ? [i] : []))
    if (starts.length === 1) return [line]
    return starts.map((s, k): ChangesLine => ({ bars: line.bars.slice(s, starts[k + 1]), sectionEnd: line.sectionEnd && k === starts.length - 1 }))
  })
}

/** a pentatonic's tension, 0–6, for the tints: the rung (key basis), else from the notes it shares (5 → 0, 4 → 2 … 0 → 6) */
const levelOf = (shared: number): number => (shared >= 5 ? 0 : 6 - shared)
const flatChords = (lines: readonly ChangesLine[]): ChangesChord[] => lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
const mapChords = (line: ChangesLine, f: (c: ChangesChord) => ChangesChord): ChangesLine => ({ ...line, bars: line.bars.map((bar) => ({ ...bar, chords: bar.chords.map(f) })) })
const mapPentatonics = (line: ChangesLine, f: (p: ChangesPentatonic) => ChangesPentatonic): ChangesLine => mapChords(line, (c) => (c.pentatonic ? { ...c, pentatonic: f(c.pentatonic) } : c))

/**
 * the pentatonic row as printed (#255), run after breakLines: a chord's label stays on a line's first labeled chord
 * and wherever it differs from the last one shown on the line (relative keys share a home: shown once); elsewhere
 * its label is '' (not printed), its key and ladder kept for nothing but the model's completeness. A chord with no
 * pentatonic ends the line's last shown label: the label after the gap prints again. A printed label's run (#272) is its
 * chord and the following ones it stands for, to the next printed label, a chord with no pentatonic, or the line's end;
 * it is picked when any chord in its run is
 */
export function showPentatonics(lines: readonly ChangesLine[]): readonly ChangesLine[] {
  return lines.map((line): ChangesLine => {
    const all = line.bars.flatMap((b) => b.chords)
    let last: string | null = null // the label last shown on this line
    const printed = all.map((c) => {
      if (!c.pentatonic) {
        last = null
        return false
      }
      const shown = c.pentatonic.label !== last
      last = c.pentatonic.label
      return shown
    })
    const runAt = (i: number): ChangesPentatonic[] => {
      const out = [all[i]!.pentatonic!]
      for (let j = i + 1; j < all.length && all[j]!.pentatonic && !printed[j]; j++) out.push(all[j]!.pentatonic!)
      return out
    }
    let n = 0
    return mapChords(line, (c) => {
      const i = n++
      if (!c.pentatonic) return c
      if (!printed[i]) return { ...c, pentatonic: { ...c.pentatonic, label: '' } }
      const run = runAt(i)
      return { ...c, pentatonic: { ...c.pentatonic, run: run.map((p) => p.chord), picked: run.some((p) => p.picked) } }
    })
  })
}

/** a row label the hexatonic and quartal rows share */
type RowLabel = Readonly<{ label: string; name: string; chord: ChordAt; picked: boolean; run: readonly ChordAt[] }>

/**
 * a named row as printed, run after breakLines: a label where its name differs from the last one on the line; a chord
 * with none ends it. A printed label's run is its chord and the unprinted ones after it, picked when any in it is
 * (#303). Idempotent: a label reads its name, and a run its chords' own picks
 */
function showNamed<T extends RowLabel>(lines: readonly ChangesLine[], get: (c: ChangesChord) => T | null, set: (c: ChangesChord, v: T) => ChangesChord): readonly ChangesLine[] {
  return lines.map((line): ChangesLine => {
    const all = line.bars.flatMap((b) => b.chords)
    let last: string | null = null
    const printed = all.map((c) => {
      const v = get(c)
      if (!v) {
        last = null
        return false
      }
      const shown = v.name !== last
      last = v.name
      return shown
    })
    const runAt = (i: number): T[] => {
      const out = [get(all[i]!)!]
      for (let j = i + 1; j < all.length && get(all[j]!) && !printed[j]; j++) out.push(get(all[j]!)!)
      return out
    }
    let n = 0
    return mapChords(line, (c) => {
      const i = n++
      const v = get(c)
      if (!v) return c
      if (!printed[i]) return set(c, { ...v, label: '' })
      const run = runAt(i)
      return set(c, { ...v, label: v.name, run: run.map((h) => h.chord), picked: run.some((h) => h.picked) })
    })
  })
}

/** the hexatonic row as printed (showNamed) */
export const showHexatonics = (lines: readonly ChangesLine[]): readonly ChangesLine[] => showNamed(lines, (c) => c.hexatonic, (c, hexatonic) => ({ ...c, hexatonic }))
/** the quartal row as printed (showNamed, #432) */
export const showQuartals = (lines: readonly ChangesLine[]): readonly ChangesLine[] => showNamed(lines, (c) => c.quartal, (c, quartal) => ({ ...c, quartal }))

type TimelineEvent = ReturnType<typeof guideToneTimeline>['events'][number]
type Timing = Readonly<{ eventAt: ReadonlyMap<number, TimelineEvent>; barOf: (i: number) => number | undefined; totalBars: number }>
function timing(rows: readonly LinedRow[], events: readonly TimelineEvent[], clock: Clock): Timing {
  const index = new Map<LinedRow, number>(rows.map((r, i) => [r, i]))
  const eventAt = new Map(events.map((e) => [index.get(e.row as LinedRow) ?? -1, e]))
  const barOf = (i: number): number | undefined => {
    const e = eventAt.get(i)
    return e ? barAt(clock, e.start) : undefined
  }
  const end = events.reduce((m, e) => Math.max(m, e.start + e.beats), 0)
  const last = barAt(clock, end)
  return { eventAt, barOf, totalBars: barStart(clock, last) === end ? last : last + 1 }
}

/** the blocks the sheet draws: runs of rows in a section, a copy: straight after its source folded into it as a repeat */
function drawnBlocks(layout: Layout, t: Timing, sectionsWithEndings: ReadonlySet<string>): Run[] {
  // runs of rows in one section, each with the section it copies
  const copyOfName = new Map(layout.sections.flatMap((s) => (s.copyOf ? [[s.name, s.copyOf] as const] : [])))
  const partOf = new Map(layout.sections.map((s) => [s.name, s.part] as const))
  const runs: Run[] = []
  layout.rows.forEach((r, i) => {
    const copyOf = copyOfName.get(r.section) ?? null
    const last = runs.at(-1)
    if (last && last.section === r.section) last.rows.push(i)
    else runs.push({ section: r.section, part: partOf.get(r.section) ?? 'form', rows: [i], copyOf, from: 0, to: 0, times: 1, marker: r.section })
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

/** each drawn row's ChordAt: its block's section, the block's written first bar plus the layout offset, its index in the bar */
function chordKeys(rows: readonly LinedRow[], blocks: readonly Run[], barOf: (i: number) => number | undefined): ReadonlyMap<number, ChordAt> {
  const keys = new Map<number, ChordAt>()
  for (const block of blocks) {
    const firstBar = Number(rows[block.rows[0] ?? -1]?.bar ?? 1)
    for (let j = 0; j <= block.to - block.from; j++) {
      block.rows.filter((i) => barOf(i) === block.from + j).forEach((i, k) => keys.set(i, `${block.section}:${firstBar + j}:${k}`))
    }
  }
  return keys
}

const endingsOf = (layout: Layout): Extract<Directive, { kind: 'ending' }>[] => layout.directives.filter((d): d is Extract<Directive, { kind: 'ending' }> => d.kind === 'ending')
const sectionsWithEndingsOf = (layout: Layout): ReadonlySet<string> => new Set(endingsOf(layout).map((e) => e.section))
/** the chart's layout, rows and their timing, as every view of the Changes sheet reads them */
function laidOut(doc: ChartDoc) {
  const layout = sectionLayout(doc).value
  const beats = chartBeats(doc)
  const timeline = guideToneTimeline(layout.rows, beats, layout.lengths, layout.metres)
  return { layout, rows: layout.rows, beats, timeline, clock: timeline.clock, t: timing(layout.rows, timeline.events, timeline.clock) }
}

/** each drawn chord's position by its row in expandRowLines(doc); a folded repeat's rows have none (the sheet draws its source's) */
export function chordPositions(doc: ChartDoc): ReadonlyMap<number, ChordAt> {
  const { layout, rows, t } = laidOut(doc)
  return chordKeys(rows, drawnBlocks(layout, t, sectionsWithEndingsOf(layout)), t.barOf)
}

/** the chords the Changes sheet draws, in order, by ChordAt with their chart text: for carrying picks across an edit (#275) */
export function drawnChords(doc: ChartDoc): readonly DrawnChord[] {
  const rows = sectionLayout(doc).value.rows
  return [...chordPositions(doc)].sort(([a], [b]) => a - b).map(([i, at]) => ({ at, text: rows[i]?.chord ?? '' }))
}

/** what a pick at each drawn position is made for: its chord and the scale it plays at this view (#303) */
export function pickTargets(doc: ChartDoc, resolved: ReadonlyMap<number, Resolved>): ReadonlyMap<ChordAt, string> {
  const rows = sectionLayout(doc).value.rows
  return new Map([...chordPositions(doc)].map(([i, at]) => [at, pickTarget(rows[i]?.chord ?? '', resolved.get(i)?.scale ?? null)]))
}

/** the sections the Changes sheet draws, in order: a repeat drawn once (A1 · A2) or a section with endings is one (#264) */
export function changesSections(doc: ChartDoc): readonly ChangesSection[] {
  const { layout, t } = laidOut(doc)
  return drawnBlocks(layout, t, sectionsWithEndingsOf(layout)).map((b) => ({ key: b.section, marker: b.marker, part: b.part }))
}

/** whether a Line plays the rhythm (rhythm-on-lines spec §1): every Line but Off, and a guide line only with Restate */
export function takesRhythm(line: ChangesLineChoice, restate: boolean): boolean {
  if (line === 'off') return false
  if (line === 'third' || line === 'seventh') return restate
  return true
}

/** view: the level the sheet plays blank cells at (resolve.ts); the guide tones read the chords only; overlay: the row under the chords, the pentatonics' rungs by section or the hexatonics (null: no row); approach: the figure into the guide tone line's notes, and the 7th Chords and Cells lines' first note over each chord (#381); options: rhythm, over the bars as drawn: the rhythm line with the Line off (rhythm spec §8), else poured into a Line that takes it (rhythm-on-lines spec §1); targets, each bar's target beats (§7); start, anticipate and restate, how a Line plays the rhythm (rhythm-on-lines spec §3, §2, §5), inert without one */
export function buildChanges(doc: ChartDoc, part: Part, barsPerLine = 4, signatures = false, line: ChangesLineChoice = 'off', view: ScaleView = STANDARD, overlay: OverlayPlan | null = null, approach: Approach = 'none', { rhythm = 'off', targets = false, start = 'beat', anticipate = 0, restate = false }: Readonly<{ rhythm?: RhythmId; targets?: boolean; start?: RhythmStart; anticipate?: number; restate?: boolean }> = {}): ChangesSheet {
  const pentatonic = overlay?.kind === 'pentatonic' ? overlay : null
  const { layout, rows, beats, timeline, clock, t } = laidOut(doc)
  const { diagnostics } = timeline
  const analysis = analyse(doc)
  const resolved = resolveScales(doc, view, analysis)
  // at Basic, the blues key's note as the part reads it, for a blues chord's Why note
  const bluesNote = view.level === 'basic' && bluesTonic(analysis) ? (sheetScale(part, `${bluesTonic(analysis)} Blues`) ?? '') : '' // spelled as the label
  const keySig = signatures ? keySignature(chartKeyOf(doc), part) : null
  const byRow = new Map(analysis.rows.map((r) => [r.row, r]))
  const problemAt = new Map(analysis.problems.map((p) => [p.line, p.message]))
  const { eventAt, barOf } = t

  // directives from the layout, placed by their section's first bar (sections are timed one after another)
  const sectionFirst = new Map<string, number>()
  layout.sections.reduce((first, s) => (sectionFirst.set(s.name, first), first + s.length), 0)
  const layoutBar = (section: string, bar: number): number | undefined => {
    const f = sectionFirst.get(section)
    const length = layout.lengths.get(section) ?? 0
    return f === undefined || bar < 1 || bar > length ? undefined : f + bar - 1
  }
  const endings = endingsOf(layout)
  const sectionsWithEndings = sectionsWithEndingsOf(layout)
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
  for (const d of layout.directives) {
    if (d.kind === 'mark') {
      const bar = layoutBar(d.section, d.bar)
      if (bar !== undefined) (d.mark === 'segno' ? segnoBars : codaBars).add(bar)
    }
    if (d.kind === 'nav') {
      const bar = layoutBar(d.section, d.bar)
      if (bar !== undefined) navAt.set(bar, [...(navAt.get(bar) ?? []), d.text])
    }
  }

  const blocks = drawnBlocks(layout, t, sectionsWithEndings)
  const keyOf = chordKeys(rows, blocks, barOf)

  // guide tones, as a line over the rows as drawn (a folded repeat is drawn once, so it's voiced once), before the
  // lines are cut, so the pitches don't depend on how many bars a line holds. Holds start afresh at each block and
  // at each 2nd (or later) ending, so a tie never runs into a new section or from one ending into the next.
  // scaleOf: a chord's scale (default: its written scale, else its quality's)
  const drawn = (scaleOf: (i: number, row: Row) => string | null = (_, row) => qualityScale(row)): GuideInput[] => {
    let block = -1
    let from = -1 // the sheet block the last chord was in
    let ending = 0
    return blocks.flatMap((b, k) =>
      b.rows.flatMap((i): GuideInput[] => {
        const e = eventAt.get(i)
        if (!e) return []
        const volta = voltaAt.get(barAt(clock, e.start))?.n ?? 0
        if (k !== from || (volta > 1 && volta !== ending)) block++
        from = k
        ending = volta
        const scale = scaleOf(i, e.row)
        const shown = resolved.get(i)?.scale // what an approach's diatonic steps follow
        const pinned = resolved.get(i)?.source === 'written' // a written scale: the Cells line's substitutes keep it (#378)
        return [{ row: i, chord: e.chord, ...(scale ? { scale } : {}), ...(shown ? { shown } : {}), ...(pinned ? { pinned } : {}), start: e.start, beats: e.beats, block }]
      }),
    )
  }

  const basis = pentatonic?.basis ?? 'key'
  const toWritten = pcOf(writtenRoot(part, parseRoot('C'), 'ionian')) // concert pc + this = written pc
  const rankings = new Map<string, Readonly<{ entries: readonly RankedPentatonic[]; scaleName: string }> | null>()
  const rankingOf = (scale: string, chordText: string) => {
    const k = `${scale}|${chordText}`
    if (!rankings.has(k)) {
      rankings.set(
        k,
        orNull(() => {
          const w = writtenScale(part, scale)
          const label = scaleLabel(part, scale)
          return { entries: pentatonicRanking(new Set(w.notes.map((n) => mod(pcOf(w.root) + n.semis, 12))), orNull(() => writtenChordRootLenient(part, chordText, scale)) ?? w.root), scaleName: glyphs(`${rootName(label.root)} ${label.name}`) }
        }),
      )
    }
    return rankings.get(k) ?? null
  }
  // a preset's units over the form (#276), worked out once: each form block, each run of one key area, its bars as drawn
  const step = pentatonic?.step ?? PENTATONIC_STEP
  const preset = isPentatonicPreset(pentatonic?.path)
  const formBlocks = blocks.flatMap((b, k) => (b.part === 'form' ? [k] : []))
  const sectionUnit = new Map(formBlocks.map((k, n) => [k, n]))
  const formStart = new Map<number, number>() // block → its first bar's index in the form
  const areaUnit = new Map<number, number>() // row → its run of one key area
  {
    let formBars = 0
    let run = 0
    let key: string | undefined
    for (const k of formBlocks) {
      const b = blocks[k]!
      formStart.set(k, formBars)
      formBars += Math.max(1, b.to - b.from + 1)
      for (const i of b.rows) {
        const here = byRow.get(i)?.key.name
        if (here !== undefined && key !== undefined && here !== key) run++
        if (here !== undefined) key = here
        areaUnit.set(i, run)
      }
    }
  }
  /** a chord's unit: its block k, its bar j in the block, its row i; null outside the form */
  const unitOf = (k: number, j: number, i: number): number | null => {
    const n = sectionUnit.get(k)
    if (n === undefined) return null
    if (step.unit === 'section') return n
    if (step.unit === 'bars') return Math.floor(((formStart.get(k) ?? 0) + j) / step.bars)
    return areaUnit.get(i) ?? 0
  }
  const ladders = new Map<string, ReturnType<typeof areaLadder>>()
  const pentatonicOf = (keyName: string | undefined, section: string, chord: ChordAt, written: string, scale: string | null, chordText: string, unit: number | null, target: string): ChangesPentatonic | null => {
    if (!pentatonic) return null
    const pick = livePick(pentatonic.picks ?? {}, chord, target)?.pc
    const want = pick === undefined ? null : mod(pick + toWritten, 12) // the pick, written
    const common = { section, chord, run: [] as readonly ChordAt[], source: scale ? { chord: chordText, scale } : null }
    if (basis === 'chord') {
      if (!scale) return null
      const r = rankingOf(scale, chordText)
      if (!r) return null
      const found = want === null ? undefined : r.entries.find((e) => pcOf(e.root) === want)
      const degree = pentatonicDegreeFrom(pentatonic.degree)
      const sheet = (degree === 'auto' ? undefined : r.entries.find((e) => e.degree === degree)) ?? r.entries[0]!
      const at = found ?? sheet
      return { ...common, sheet: sheet.name, label: `${at.name}♪`, basis, title: `${written} · ${r.scaleName} pentatonic ranking`, key: '', scale: r.scaleName, ladder: [], ranking: r.entries, view: PENTATONIC_HOME, degree: at.degree, root: at.root, name: at.name, shared: at.shared, level: levelOf(at.shared), pc: concertPc(part, pcOf(at.root)), picked: !!found }
    }
    if (!keyName) return null
    if (!ladders.has(keyName)) ladders.set(keyName, areaLadder(keyName, part))
    const area = ladders.get(keyName)
    if (!area) return null
    const found = want === null ? undefined : area.ladder.find((e) => pcOf(e.root) === want)
    const sectionView = preset
      ? unit === null ? PENTATONIC_HOME : pentatonicCycle(pentatonic.path!, unit)
      : (Object.hasOwn(pentatonic.bySection, section) ? pentatonic.bySection[section] : undefined) ?? pentatonic.fallback
    const sheet = pentatonicAt(area.ladder, sectionView)
    const p = found ?? sheet
    const view = found ? { rung: found.rung, side: found.side ?? sectionView.side } : sectionView
    return { ...common, sheet: sheet.name, label: `${p.name}♪`, basis, title: `${section} · ${area.key} pentatonic ladder`, key: area.key, scale: sheetScale(part, scale) ?? '', ladder: area.ladder, ranking: [], view, degree: null, root: p.root, name: p.name, shared: p.shared, level: p.rung, pc: concertPc(part, pcOf(p.root)), picked: !!found }
  }

  const hexRankings = new Map<string, Readonly<{ ranking: readonly HexPair[]; pickable: readonly HexPair[] }>>()
  /** a chord's hexatonic and the pair it plays */
  const keyPairs = new Map<string, ReturnType<typeof writtenKeyPair>>()
  const hexatonicOf = (scale: string | null, chordText: string, at: ChordAt, target: string, keyName: string | undefined): Readonly<{ hex: ChangesHexatonic; pair: HexPair }> | null => {
    if (overlay?.kind !== 'hexatonic' || !scale) return null
    const k = `${scale}|${chordText}`
    if (!hexRankings.has(k)) {
      const ranking = orNull(() => {
        const w = writtenScale(part, scale)
        const chordRoot = orNull(() => writtenChordRootLenient(part, chordText, scale)) ?? w.root
        const quality = orNull(() => baseQuality(parseChord(chordText).quality))
        const ranking = hexatonicRanking(hexatonicPairs(w.notes, chordRoot, quality), chordRoot)
        return { ranking, pickable: pickablePairs(ranking, chordRoot, quality) }
      })
      hexRankings.set(k, ranking ?? { ranking: [], pickable: [] })
    }
    const { ranking, pickable } = hexRankings.get(k)!
    const auto = ranking[0]
    if (!auto) return null
    const byKey = overlay.basis === 'key'
    if (byKey && keyName !== undefined && !keyPairs.has(keyName)) keyPairs.set(keyName, writtenKeyPair(keyName, part))
    const keyed = byKey && keyName !== undefined ? keyPairs.get(keyName) : null
    const sheet = (keyed && keyedPair(ranking, keyed)) || auto
    const pick = livePick(overlay.picks ?? {}, at, target)
    const want = pick ? pick.roots.map((pc) => mod(pc + toWritten, 12)) : null // the pick, written
    const found = want ? pickable.find((p) => pcOf(p.lower.root) === want[0] && pcOf(p.upper.root) === want[1]) : undefined
    const used = found ?? sheet
    return { hex: { label: used.name, name: used.name, chord: at, picked: !!found, run: [], sheet: sheet.name, source: { chord: chordText, scale }, offKey: byKey && sheet === auto }, pair: used }
  }
  // each row's hexatonic, worked out before the line, which plays its pair (#325)
  const hexAt = new Map(
    blocks.flatMap((b) => b.rows).map((i) => {
      const row = rows[i] as LinedRow
      const scale = resolved.get(i)?.scale ?? null
      return [i, hexatonicOf(scale, row.chord, keyOf.get(i) ?? '', pickTarget(row.chord, scale), byRow.get(i)?.key.name)] as const
    }),
  )
  const hexPairs = new Map([...hexAt].flatMap(([i, h]) => (h ? [[i, h.pair] as const] : [])))

  const quartRankings = new Map<string, readonly QuartalStack[]>()
  /** a chord's quartal stack (#432): its live pick (a bottom note, concert) where its scale has that stack, else Auto */
  const quartalOf = (scale: string | null, chordText: string, at: ChordAt, target: string): Readonly<{ q: ChangesQuartal; stacks: readonly QuartalStack[] }> | null => {
    if (overlay?.kind !== 'quartal' || !scale) return null
    const k = `${scale}|${chordText}`
    if (!quartRankings.has(k)) {
      const ranking = orNull(() => {
        const w = writtenScale(part, scale)
        const chordRoot = orNull(() => writtenChordRootLenient(part, chordText, scale)) ?? w.root
        const quality = orNull(() => baseQuality(parseChord(chordText).quality))
        return rankedStacks(w.notes, chordRoot, quality, overlay.notes ?? 'auto', !!overlay.perfect, rangeOf(part))
      })
      quartRankings.set(k, ranking ?? [])
    }
    const ranking = quartRankings.get(k)!
    const auto = ranking[0]
    if (!auto) return null
    const pick = livePick(overlay.picks ?? {}, at, target)
    const found = pick ? ranking.find((s) => s.pcs[0] === mod(pick.pc + toWritten, 12)) : undefined
    const used = found ?? auto
    return { q: { label: used.name, name: used.name, chord: at, picked: !!found, run: [], sheet: auto.name, source: { chord: chordText, scale }, degree: used.degree }, stacks: [used, ...ranking.filter((s) => s !== used)] }
  }
  const quartAt: ReadonlyMap<number, Readonly<{ q: ChangesQuartal; stacks: readonly QuartalStack[] }> | null> = new Map(
    blocks.flatMap((b) => b.rows).map((i) => {
      const row = rows[i] as LinedRow
      const scale = resolved.get(i)?.scale ?? null
      return [i, quartalOf(scale, row.chord, keyOf.get(i) ?? '', pickTarget(row.chord, scale))] as const
    }),
  )
  const quartStacks = new Map([...quartAt].flatMap(([i, q]) => (q ? [[i, q.stacks] as const] : [])))

  // each drawn chord's pentatonic (its label's, picks and all), worked out before the line, which plays it (#284)
  const pentAt = new Map<number, ChangesPentatonic | null>()
  blocks.forEach((block, k) => {
    for (let j = 0; j < Math.max(1, block.to - block.from + 1); j++) {
      for (const i of block.rows.filter((r) => barOf(r) === block.from + j)) {
        const row = rows[i] as LinedRow
        const scale = resolved.get(i)?.scale ?? null
        const written = writtenChordTextOrNull(part, row.chord, scale) ?? row.chord
        pentAt.set(i, pentatonicOf(byRow.get(i)?.key.name, block.section, keyOf.get(i) ?? '', written, scale, row.chord, unitOf(k, j, i), pickTarget(row.chord, scale)))
      }
    }
  })
  const pentRoots = new Map([...pentAt].flatMap(([i, p]) => (p ? [[i, p.root] as const] : [])))
  // the bars as drawn (a repeat drawn with repeat signs counts once), which the rhythm is laid over: their clock bars,
  // lengths, and the breaks no tie runs into (a 2nd or later ending: the player jumps there from before the 1st)
  const clockBars = blocks.flatMap((b) => Array.from({ length: Math.max(1, b.to - b.from + 1) }, (_, j) => b.from + j))
  const lengths = clockBars.map((bar) => barLength(clock, bar))
  const breaks = clockBars.flatMap((bar, d) => ((voltaAt.get(bar)?.n ?? 0) > 1 && voltaAt.get(bar)?.n !== voltaAt.get(clockBars[d - 1] ?? -1)?.n ? [d] : []))
  const poured = rhythm !== 'off' && takesRhythm(line, restate)
  const plan: RhythmPlan | undefined = poured ? { id: rhythm, start, anticipate, bars: lengths, clockBars, breaks } : undefined
  const voices: { bars: ReadonlyMap<number, readonly GuideNote[]>; labels: ReadonlyMap<number, string>; missing: readonly string[] } | null =
    line === 'off'
      ? null
      : typeof line === 'object'
        ? {
            ...(line.kind === 'pentatonic'
              ? pentatonicVoices(drawn(), part, clock, keySig, line, pentRoots, plan)
              : line.kind === 'cells'
                ? cellsVoices(drawn((i, row) => resolved.get(i)?.scale ?? qualityScale(row)), part, clock, keySig, line, approach, plan) // the scale the sheet shows
                : line.kind === 'quartal'
                  ? quartalVoices(drawn(), part, clock, keySig, line, quartStacks, plan)
                  : triadPairVoices(drawn(), part, clock, keySig, line, hexPairs, plan)),
            labels: new Map(),
          }
        : isArpeggioPattern(line)
          ? { ...arpeggioVoices(drawn(), part, clock, keySig, line, approach, plan), labels: new Map() }
          : guideVoices(drawn(), part, clock, keySig, line, approach, plan, restate)

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
          const written = writtenChordTextOrNull(part, row.chord, scale) ?? row.chord
          return {
            beat: (eventAt.get(i)?.start ?? barStart(clock, bar)) - barStart(clock, bar),
            text: row.chord,
            written,
            at: { section: row.section, bar: row.bar },
            line: row.line,
            tokens: chordTokensOrNull(part, row.chord, scale),
            numeral: a?.numeral && a.numeral !== '?' ? a.numeral : '',
            scale: sheetScale(part, scale),
            reason: a?.reason ?? '',
            rule: a?.rule && a.rule !== '?' ? a.rule : '',
            fallback: !!a?.fallback && !a?.stated,
            stated: a?.stated ?? false,
            pinned: resolved.get(i)?.source === 'written',
            slash: readChord(row.chord)?.slash ?? false,
            problem: problemAt.get(row.line) ?? '',
            heardIn: a ? keyName((a.statedKey ?? a.key).name, part) : '',
            levelNote: bluesNote && a && !a.stated && resolved.get(i)?.source !== 'written' && isBluesRule(a.rule) ? `Basic: the ${bluesNote} scale over the whole blues` : '',
            keyFrom: a?.statedKey ? 'function' : analysis.areas.findLast((x) => x.row <= i)?.stated ? 'area' : 'found',
            guide: voices?.labels.get(i) ?? '',
            pentatonic: pentAt.get(i) ?? null,
            hexatonic: hexAt.get(i)?.hex ?? null,
            quartal: quartAt.get(i)?.q ?? null,
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
        beats: barLength(clock, bar) as Beats,
        timeSignature: null,
        chords,
        voice: voices?.bars.get(bar) ?? [],
        rhythm: [],
        targets: [],
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

  // within each line, blank a chord's scale when it repeats the previous chord's (the first chord always shows its scale);
  // a time signature on the sheet's first bar and wherever the metre changes from the bar drawn before
  let metre = 0
  const deduped = lines.map((line): ChangesLine => {
    let prev: string | null = null
    const bars = line.bars.map((bar): ChangesBar => {
      const timeSignature = bar.beats !== metre ? `${bar.beats}/4` : null
      metre = bar.beats
      return {
        ...bar,
        timeSignature,
        chords: bar.chords.map((c): ChangesChord => {
          if (c.scale && c.scale === prev) return { ...c, scale: null }
          prev = c.scale
          return c
        }),
      }
    })
    return { bars, sectionEnd: line.sectionEnd }
  })
  const counts = !!pentatonic && (pentatonic.counts || basis === 'chord' || flatChords(deduped).some((c) => c.pentatonic?.picked))
  const counted = counts ? deduped.map((l) => mapPentatonics(l, (p) => ({ ...p, label: `${p.label} ${p.shared}` }))) : deduped
  const pentatonicCaption = pentatonic && basis === 'key' ? pentatonicPathCaption(pentatonic.path ?? 'one', step) : null
  // the rhythm over the bars as drawn: the rhythm line with the Line off, else captioned when a Line took it; its
  // landings don't depend on forcing, so the caption reads the rhythm as laid
  const laid = line === 'off' || poured ? layRhythm(rhythm, lengths, breaks) : null
  const notes = laid && line === 'off' ? rhythmNotes(laid) : []
  const caption = laid ? rhythmCaption(rhythm, laid, lengths) : null
  const firstOf = counted.reduce<number[]>((acc, l) => [...acc, acc.at(-1)! + l.bars.length], [0]) // each line's first bar, counted over the sheet
  const rhythmLines = counted.map((l, n): ChangesLine => ({
    ...l,
    bars: l.bars.map((b, j): ChangesBar => ({ ...b, rhythm: notes[firstOf[n]! + j] ?? [], targets: targets ? targetBeats(b.beats) : [] })),
  }))
  return {
    lines: rhythmLines,
    beats,
    diagnostics: voices ? [...diagnostics, ...voices.missing] : diagnostics,
    pentatonicCaption,
    rhythmCaption: caption && poured ? phrasingCaption(caption, start, anticipate) : caption,
  }
}
