import { accText, type ChangesBar, type Feel, type ChangesLine, type GuideNote, type NoteBeats, type Pitched, PULSE_LABELS, PULSE_SHORT_LABELS, type RhythmCardModel, type RhythmNote, signatureAccidentals, toVexKey } from '@chord-scale-maker/engine'
import { BAR_UNITS, cropBand, fitSvg, headCentre, inkStave, signatureLead, STAFF_WIDTH, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

/**
 * Drawing a Changes line (engine/src/changes.ts) with VexFlow: one stave, one slash a beat (each bar in its own metre),
 * repeat and final barlines, a time signature where a bar carries one (the sheet's first, and wherever the metre changes). Chords, numerals and scales are HTML placed over and under the slashes.
 * With a clef (key signatures or a guide tone on): the first line (first) starts with the clef, and with the
 * chart's key signature when a bar carries one; the rest with neither; without, no clef, as before.
 * With a guide tone line on (bar.voice), each chord's guide tone replaces the slashes: one voice, stems by VexFlow's
 * usual rule, each note held for its chord and tied across barlines and line ends. Drawn in two passes, so a 1st/2nd-
 * ending bracket can be raised over the highest stem tip before anything is drawn.
 */

const VOLTA_Y = 0 // shift for the 1st/2nd-ending bracket, above the staff (at getYForTopText)
const BAND = { top: 74, bottom: 126 } // just the staff (lines at 80-120): slashes sit on the middle line
const VOLTA_BAND = { top: 44, bottom: 126 } // a line with a 1st/2nd-ending bracket needs headroom above the staff
const CLEF_BAND = { top: 64, bottom: 134 } // a line with a clef (key signatures on): room for the clef above and below the staff
const VOLTA_MARGIN = 4 // guide tones: between an ending bracket's foot and the highest stem tip or accidental
const VOLTA_PAD = 4 // guide tones: shown above a bracket's top
const ACCIDENTAL_RISE = 20 // a flat's top over its note head's centre (about two spaces)
const HALF_HEAD = 6 // half a note head's width: a beat with no note starting on it sits where a head would
export const DURATIONS = { 6: 'wd', 4: 'w', 3: 'hd', 2: 'h', 1: 'q', 0.5: '8', 0.25: '16' } as const // 3 beats: a dotted half; 6, a dotted whole
export const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
export const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black

/**
 * per bar, each beat's x (its slash's or note head's centre) and its right edge, as fractions of the width; each chord
 * name's scale; how many of the leading bars fit the line (fitBars): fewer than the line's, it should break there; where
 * its notes can't all fit (Task 3.2), the balanced lines it should split into, their bars a line (split: null where they
 * fit); and the target dots' row (rhythm spec §7) as a fraction of the drawing's height from its top (null: no target beats)
 */
export type ChangesLayout = Readonly<{ xs: readonly (readonly number[])[]; ends: readonly number[]; scales: readonly (readonly number[])[]; fits: number; split: readonly number[] | null; dots: number | null }>

type Clef = 'treble' | 'bass'
/** names: each bar's chords, their widths as fractions of the line, to widen the bars they crowd (fitBars) */
/** first: the sheet's first line, which starts with the clef */
/** rhythmCaption: the sheet's rhythm caption, for the aria-label of a line with a rhythm (rhythm spec §8) */
/** fromBar: the line's first bar, counted from the sheet's first (1), for the step marks' aria-label (Phase 4 spec §6) */
/** feel: the sheet's Feel, marked over its first bar (first) in 2 and in 1 (Phase 4 spec §6, D21); undefined: in 4 */
type Opts = Readonly<{ first: boolean; barsPerLine: number; clef?: Clef; names?: readonly (readonly NamedBeat[])[]; arpeggio?: boolean; lineName?: string; rhythmCaption?: string | null; fromBar?: number; feel?: Feel }>
type Band = Readonly<{ top: number; bottom: number }>
type Beam = InstanceType<VexFlowModule['Beam']>
type Stave = InstanceType<VexFlowModule['Stave']>
type StaveNote = InstanceType<VexFlowModule['StaveNote']>
type GhostNote = InstanceType<VexFlowModule['GhostNote']>
type Voice = InstanceType<VexFlowModule['Voice']>
type Tick = StaveNote | GhostNote

/** how far (0 or less) to raise a line's ending brackets so their foot clears its highest ink by VOLTA_MARGIN */
export function voltaShift(inkTops: readonly number[], bracketBottom: number): number {
  return inkTops.length ? Math.min(0, Math.min(...inkTops) - VOLTA_MARGIN - bracketBottom) : 0
}

const STAFF_TOP = 80 // the staff's top line
const DOT_RISE = 12 // a target dot's center over the highest ink: the staff, a stem tip or an accent
const DOT_ROOM = 6 // the crop's room over a dot's center
/** a slash line's target dots: in the staff's top space, over the slashes (which reach only the lines either side of the middle), so no line grows and the page budgets hold */
export const SLASH_TARGET_ROW = STAFF_TOP + 5
/** a slash line's Feel mark (Phase 4 spec §6): over the staff, in the clef's headroom on the sheet's first line (CLEF_BAND's top, 64), its glyphs about 69 to 76 */
const SLASH_FEEL_ROW = STAFF_TOP - 8

/** the target dots' row (rhythm spec §7), in drawing units: over the staff and the line's ink tops */
export function targetRow(inkTops: readonly number[], staffTop = STAFF_TOP): number {
  return Math.min(staffTop, ...inkTops) - DOT_RISE
}

/**
 * the target dots' row (null: none) in the crop, as a fraction of its height from its top (null: none). The crop never
 * opens for them, so no line grows and the page budgets hold: a row over its headroom comes down to DOT_ROOM under its
 * top (only where the staff, not ink, sets the row: a voiced line's crop keeps 24 over its ink, the row 12)
 */
export function withTargets(band: Band, row: number | null): Readonly<{ band: Band; at: number | null }> {
  if (row === null) return { band, at: null }
  return { band, at: (Math.max(row, band.top + DOT_ROOM) - band.top) / (band.bottom - band.top) }
}

/** a guide tone line's crop: its note heads and stem tips, at least the clef's band, and over its bracket (null: none) */
export function voicedBand(inks: readonly number[], bracketTop: number | null): Band {
  const band = cropBand(inks, CLEF_BAND.top, CLEF_BAND.bottom)
  return bracketTop === null ? band : { top: Math.min(band.top, bracketTop - VOLTA_PAD), bottom: band.bottom }
}

/** each beat's x as a fraction of width: the head centre of a note starting on it, else its ghost's x plus half a head */
export function beatXs(heads: ReadonlyMap<number, number>, ghostXs: readonly number[], width: number): number[] {
  return ghostXs.map((g, beat) => heads.get(beat) ?? (g + HALF_HEAD) / width)
}

/** a chord over a bar: its beat and its name's width, as a fraction of the line's bars */
export type NamedBeat = Readonly<{ beat: number; width: number }>
/**
 * each bar's share of the line's bars (summing to 1), each chord name's scale (1: its full size), and how many of the
 * leading bars fit the line on their own, their names at BREAK_SCALE (at least one; all when they fit): where a line
 * too full breaks
 */
export type BarFit = Readonly<{ shares: readonly number[]; scales: readonly (readonly number[])[]; fits: number; notes: number }>
/**
 * two rows of names over a bar's beats as one (the chords and, above them, the other set's, #215): each beat either row
 * names, as wide as the wider name there, so each row's name clears the next beat of either row
 */
export function mergeNames(a: readonly NamedBeat[], b: readonly NamedBeat[]): NamedBeat[] {
  const widths = new Map<number, number>()
  for (const n of [...a, ...b]) widths.set(n.beat, Math.max(widths.get(n.beat) ?? 0, n.width))
  return [...widths].sort(([x], [y]) => x - y).map(([beat, width]) => ({ beat, width }))
}
const FLOOR = 0.5 // of a bar's even share: the least it keeps when another bar is crowded
const MIN_SCALE = 0.6 // a name shrinks no further, so it stays readable
const BREAK_SCALE = 0.8 // names shrink this far before their line breaks

/** a name's beats: up to the next chord's, the bar's last up to the bar's end */
const spans = (beats: number, chords: readonly NamedBeat[]): number[] => chords.map((c, i) => (chords[i + 1]?.beat ?? beats) - c.beat)
const DEFAULT_BEATS = 4

/**
 * bar widths that keep each chord's name clear of the next (a beat is a bar's width over its beats, each bar's own): bars that fit stay
 * even; a crowded bar takes what its names need and the others share the rest; a line that can't fit them all is
 * shared by need, and the names that still don't fit shrink. A slot past the line's last bar (null) gives up its room.
 * rooms: each bar's notes' least share of the line (notesFit), which a bar takes as its names'; notes don't shrink,
 * so `notes` counts the leading bars whose names (shrunk as far as they go) or notes, the wider, fit the line (all of
 * them where no bar has a room), where the line splits (balancedSplit)
 */
export function fitBars(barBeats: readonly number[], bars: readonly (readonly NamedBeat[] | null)[], rooms: readonly number[] = []): BarFit {
  const floor = FLOOR / bars.length
  const named = bars.map((chords, b) => {
    if (!chords) return 0
    const beats = barBeats[b] ?? DEFAULT_BEATS
    const s = spans(beats, chords)
    return Math.max(floor, ...chords.map((c, i) => (c.width * beats) / (s[i] ?? beats)))
  })
  // names shrink (to BREAK_SCALE) before notes give up their room: where both don't fit whole, the names' needs scale down
  const needsAt = (scale: number): number[] => named.map((n, b) => (bars[b] ? Math.max(n * scale, rooms[b] ?? 0) : 0))
  const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
  let scale = 1
  if (rooms.some((r) => r > 0) && sum(needsAt(1)) > 1) {
    let [lo, hi] = [BREAK_SCALE, 1]
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (sum(needsAt(mid)) > 1) hi = mid
      else lo = mid
    }
    scale = lo
  }
  const needs = needsAt(scale)
  const total = sum(needs)
  const shares = total >= 1 ? needs.map((n) => n / total) : waterFill(needs)
  const scales = bars.map((chords, b) => {
    if (!chords) return []
    const beats = barBeats[b] ?? DEFAULT_BEATS
    const s = spans(beats, chords)
    return chords.map((c, i) => Math.min(1, Math.max(MIN_SCALE, ((shares[b] ?? 0) * (s[i] ?? beats)) / beats / c.width)))
  })
  const present = bars.filter((b) => b !== null).length
  const sums = named.map((_, b) => named.slice(0, b + 1).reduce((a, n) => a + n, 0)) // where the names alone break the line
  const both = named.map((n, b) => Math.max(n * BREAK_SCALE, rooms[b] ?? 0))
  const roomed = both.map((_, b) => both.slice(0, b + 1).reduce((a, n) => a + n, 0)).filter((n) => n <= 1 + 1e-9).length
  const notes = rooms.some((r) => r > 0) ? roomed : present
  return { shares, scales, fits: Math.max(1, Math.min(present, sums.filter((n) => n * BREAK_SCALE <= 1 + 1e-9).length)), notes: Math.max(1, Math.min(present, notes)) }
}

/** each bar at least its need, the rest at one level, summing to 1 (the needs sum to less) */
function waterFill(needs: readonly number[]): number[] {
  let fixed = new Set<number>()
  for (;;) {
    const left = 1 - [...fixed].reduce((a, i) => a + (needs[i] ?? 0), 0)
    const level = left / (needs.length - fixed.size)
    const over = needs.flatMap((n, i) => (!fixed.has(i) && n > level ? [i] : []))
    if (!over.length) return needs.map((n, i) => (fixed.has(i) ? n : level))
    fixed = new Set([...fixed, ...over])
  }
}

/** "C5", "B♭4": a pitch as a screen reader reads it */
function pitchName(p: Pitched): string {
  const [key = '', octave = ''] = toVexKey(p).split('/')
  return `${key.charAt(0).toUpperCase()}${key.slice(1).replaceAll('#', '♯').replaceAll('b', '♭')}${octave}`
}

/**
 * a note that continues the previous line starts a new system with no accidental of its own; restate it (in
 * parentheses) when its pitch differs from what the key signature gives that letter: '#', 'b', 'n', else null
 */
export function restatedAccidental(n: GuideNote, keySig: string | null): string | null {
  if (!n.tiedIn || !n.pitch) return null
  if (n.pitch.acc === (signatureAccidentals(keySig).get(n.pitch.letter) ?? 0)) return null
  return n.pitch.acc === 0 ? 'n' : accText(n.pitch.acc)
}

/** the aria-label's guide tones: each chord's note with its label, "–" for a held bar; '' when off */
export function guideAria(line: ChangesLine): string {
  if (!line.bars.some((b) => b.voice.length)) return ''
  const bars = line.bars.map((bar) => {
    const chords = bar.chords.map((c) => {
      const n = bar.voice.find((x) => x.beat === c.beat) // struck, or tied in where the chord holds the note before
      return `${n?.pitch ? pitchName(n.pitch) : 'rest'} ${c.guide}`.trim()
    })
    return chords.join(', ') || '–'
  })
  return `; guide tones: ${bars.join(' | ')}`
}

/** the aria-label's arpeggio (or, named so, Pentatonic) line: each chord's notes, "rest" for a rest, a bar without chord symbols lists its notes, "–" if it has none; '' when off */
export function arpeggioAria(line: ChangesLine, name = '7th chords'): string {
  if (!line.bars.some((b) => b.voice.length)) return ''
  const bars = line.bars.map((bar) => {
    const chords = bar.chords.map((c, k) => {
      const end = bar.chords[k + 1]?.beat ?? Infinity
      return bar.voice
        .filter((n) => n.beat >= c.beat && n.beat < end)
        .map((n) => (n.pitch ? pitchName(n.pitch) : 'rest'))
        .join(' ')
    })
    const held = bar.voice.map((n) => (n.pitch ? pitchName(n.pitch) : 'rest')).join(' ') // no chord symbol: a chord held over
    return chords.join(', ') || held || '–'
  })
  return `; ${name}: ${bars.join(' | ')}`
}

/** the aria-label's rhythm line (rhythm spec §8): its caption without "Rhythm: "; '' with no rhythm drawn */
export function rhythmAria(caption: string | null): string {
  return caption ? `; rhythm: ${caption.replace(/^Rhythm: /, '')}` : ''
}

/** a step's group as Saindon marks it (Phase 4 spec D17): the circled numeral, ② to ⑦ */
export const stepNumeral = (group: number): string => String.fromCodePoint(0x2460 + group - 1)

/** a step mark's words: "in 5" for its group, the pulse's name where it changes ("in 5, 16ths") */
const stepWords = (step: NonNullable<ChangesBar['step']>): string =>
  [step.group !== null && `in ${step.group}`, step.pulse !== null && PULSE_LABELS[step.pulse].replace(/^./, (c) => c.toLowerCase())].filter(Boolean).join(', ')

/** the aria-label's step marks (Phase 4 spec §6): ", from bar N: in 5" for each, N counted from the sheet's first bar (fromBar: the line's first); '' with none */
export function stepAria(line: ChangesLine, fromBar: number): string {
  return line.bars.map((b, i) => (b.step ? `, from bar ${fromBar + i}: ${stepWords(b.step)}` : '')).join('')
}

/** the Feel mark's words over the sheet's first bar (Phase 4 spec D21): "in 2" or "in 1"; null in 4 */
export const feelMark = (feel: Feel | undefined): string | null => (feel === 2 || feel === 1 ? `in ${feel}` : null)

/** the Feel mark the line draws: its words on the sheet's first line (opts.first), else null */
const lineFeel = (opts: Opts): string | null => (opts.first ? feelMark(opts.feel) : null)

/** the aria-label's Feel mark: "; feel in 2" on the line that draws it; '' without */
export function feelAria(mark: string | null): string {
  return mark ? `; feel ${mark}` : ''
}

const hasTargets = (line: ChangesLine): boolean => line.bars.some((b) => b.targets.length > 0)
/** a line with a step mark to draw: a numeral, a gear's name or both */
const stepped = (line: ChangesLine): boolean => line.bars.some((b) => b.step !== null)

/** the aria-label's target beats, by the count ("1 and 3"; by bar where they differ), and the notes on them, which the drawing tells by color alone (#505); '' with none */
export function targetsAria(line: ChangesLine): string {
  if (!hasTargets(line)) return ''
  const beats = line.bars.map((b) => b.targets.map((t) => t + 1).join(' and ') || '–')
  const named = `; target beats: ${beats.every((b) => b === beats[0]) ? beats[0] : beats.join(' | ')}`
  if (!line.bars.some((b) => b.voice.some((n) => n.target))) return named
  const tones = line.bars.map((b) => b.voice.flatMap((n) => (n.target && n.pitch ? [`${pitchName(n.pitch)}${n.target === 'other' ? ' not a chord tone' : ''}`] : [])).join(', ') || '–')
  return `${named}; target tones: ${tones.join(' | ')}`
}

const barsLabel = (line: ChangesLine): string => `Bars: ${line.bars.map((b) => b.chords.map((c) => c.text).join(' ') || '–').join(' | ')}`

type Geometry = Readonly<{ clef: Clef | undefined; total: number; widths: readonly number[]; scales: readonly (readonly number[])[]; fits: number; notes: number }>

/**
 * the clef the first line starts with, the line's width and each bar's (the first with the lead: clef and key
 * signature; any bar with its time signature's room): even, so bars line up from line to line, unless the chords'
 * names crowd a bar (fitBars)
 */
function geometry(vf: VexFlowModule, line: ChangesLine, opts: Opts, rooms: readonly number[] = []): Geometry {
  const clef = lineClef(opts)
  const leads = line.bars.map((bar, b) => (b === 0 && clef ? signatureLead(vf, clef, bar.keySig) : 0) + (bar.timeSignature ? TIME_SPACE : 0))
  const total = BAR_UNITS * opts.barsPerLine
  const area = total - 1 - leads.reduce((a, l) => a + l, 0)
  const slots = Array.from({ length: opts.barsPerLine }, (_, b) =>
    b < line.bars.length ? (opts.names?.[b] ?? []).map((c) => ({ beat: c.beat, width: (c.width * total) / area })) : null,
  )
  const floors = rooms.map((r, b) => Math.max(0, r - (leads[b] ?? 0)) / area) // a bar's notes' room past its lead
  const { shares, scales, fits, notes } = fitBars(line.bars.map((bar) => bar.beats), slots, floors)
  return { clef, total, widths: line.bars.map((_, b) => area * (shares[b] ?? 0) + (leads[b] ?? 0)), scales, fits, notes }
}

/** with signatures, the clef and key signature start the first line only */
const lineClef = (opts: Opts): Clef | undefined => (opts.first ? opts.clef : undefined)

/**
 * each bar's room (notesFit) on its own stave at the width the names give it, the line's first with its signatures
 * (Task 3.2): all 0 where every bar's notes fit, else each the width its notes need set close, which geometry
 * widens the bar to and the line splits by (balancedSplit)
 */
function lineRooms(vf: VexFlowModule, line: ChangesLine, opts: Opts, notes: NotesOf): number[] {
  const { widths } = geometry(vf, line, opts)
  const fits = line.bars.map((bar, b) => {
    const stave = staveFor(vf, bar, b === 0, 0, widths[b] ?? BAR_UNITS, lineClef(opts))
    return notesFit(vf, stave, () => notes(bar, b, stave))
  })
  // every bar fits at VexFlow's spacing: no rooms, the line as before; else every bar its notes' need, set close, so
  // none of them gives up the room it measured fitting in
  return fits.some((f) => f.tight) ? fits.map((f) => f.need) : fits.map(() => 0)
}

/** a bar's notes, built on its stave (b: its index in the line), for notesFit */
type NotesOf = (bar: ChangesBar, b: number, stave: Stave) => Voice

/**
 * n bars in k lines as even as they go, the longer first: 4 in 3 → 2 1 1
 */
export function evenChunks(n: number, k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0))
}

/**
 * the lines a line whose notes can't all fit splits into (Task 3.2 final ruling), their bars each: the fewest even
 * lines that each fit (fits: from bar `start`, `size` bars), never a one-bar line beside a longer one but 2 1 (4: 2 2,
 * else 1 1 1 1; 3: 2 1, else 1 1 1); one bar a line where nothing else fits
 */
export function balancedSplit(n: number, fits: (start: number, size: number) => boolean): number[] {
  for (let k = 2; k < n; k++) {
    const chunks = evenChunks(n, k)
    if (chunks.includes(1) && k > 2) continue
    const starts = chunks.map((_, i) => chunks.slice(0, i).reduce((a, c) => a + c, 0))
    if (chunks.every((c, i) => fits(starts[i] ?? 0, c))) return chunks
  }
  return Array.from({ length: n }, () => 1)
}

/** a crowded line's balanced split (balancedSplit), each part measured as the line it becomes: the sheet's first keeps the clef */
function crowdedSplit(vf: VexFlowModule, line: ChangesLine, opts: Opts, notes: NotesOf): number[] {
  return balancedSplit(line.bars.length, (start, size) => {
    const part: ChangesLine = { ...line, bars: line.bars.slice(start, start + size) }
    const o: Opts = { ...opts, first: opts.first && start === 0, ...(opts.names ? { names: opts.names.slice(start, start + size) } : {}) }
    return geometry(vf, part, o, lineRooms(vf, part, o, notes)).notes >= size
  })
}

/** each bar's right edge as a fraction of the line */
const endsOf = (widths: readonly number[], total: number): number[] => widths.map((_, b) => widths.slice(0, b + 1).reduce((a, w) => a + w, 0) / total)

/** a bar's stave with its signatures (clef and key: the line's first bar only) and barlines; its bracket comes from setVolta */
function staveFor(vf: VexFlowModule, bar: ChangesBar, first: boolean, x: number, width: number, clef: Clef | undefined): Stave {
  const stave = inkStave(vf, x, STAVE_Y, width)
  if (first && clef) stave.addClef(clef)
  if (first && clef && bar.keySig) stave.addKeySignature(bar.keySig)
  if (bar.timeSignature) stave.addTimeSignature(bar.timeSignature)
  if (bar.repeatStart) stave.setBegBarType(vf.BarlineType.REPEAT_BEGIN)
  if (bar.repeatEnd) stave.setEndBarType(vf.BarlineType.REPEAT_END)
  else if (bar.end === 'final') stave.setEndBarType(vf.BarlineType.END)
  else if (bar.end === 'double') stave.setEndBarType(vf.BarlineType.DOUBLE)
  return stave
}

function setVolta(vf: VexFlowModule, stave: Stave, bar: ChangesBar, y: number): void {
  const v = bar.volta
  if (!v) return
  const t = v.start && v.end ? vf.Volta.type.BEGIN_END : v.start ? vf.Volta.type.BEGIN : v.end ? vf.Volta.type.END : vf.Volta.type.MID
  stave.setVoltaType(t, v.start ? `${v.n}.` : '', y)
}

/**
 * a bar's plain slashes (Phase 4 spec D18): one a beat in 4; in 2 and in 1 one a group, its half or whole slash
 * hollow (VexFlow's slash heads at h and w), dotted where needed, and a group longer than a whole note in tied pieces
 */
function slashes(vf: VexFlowModule, marks: ChangesBar['slashes']): StaveNote[] {
  return marks.map((m) => {
    const note = marked(vf, new vf.StaveNote({ keys: ['b/4'], duration: m.value, type: 's', autoStem: false }), m.value, false)
    note.setStemStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' }) // slashes without stems
    return note
  })
}

/** a ghost a beat where a bar's slashes don't fall one a beat (Feel in 2 or 1), so each beat still has its x; else none */
const slashGrid = (vf: VexFlowModule, bar: ChangesBar): GhostNote[] => (bar.slashes.length === bar.beats ? [] : Array.from({ length: bar.beats }, () => new vf.GhostNote('q')))

/** each beat's x in a bar of plain slashes, as a fraction of total: its slash's head centre, else its ghost's (slashGrid) */
function slashXs(bar: ChangesBar, notes: readonly StaveNote[], grid: readonly GhostNote[], total: number): number[] {
  if (!grid.length) return notes.map((n) => headCentre(n, total))
  const starts = new Map(bar.slashes.flatMap((m, i) => (notes[i] ? [[m.beat, headCentre(notes[i], total)] as const] : [])))
  return beatXs(starts, grid.map((g) => g.getAbsoluteX()), total)
}

/** the ties between a bar's slash pieces (D18: a group longer than a whole note) */
function slashTies(vf: VexFlowModule, ctx: Context, bar: ChangesBar, notes: readonly StaveNote[]): void {
  bar.slashes.forEach((m, i) => {
    if (m.tie && notes[i] && notes[i + 1]) new vf.StaveTie({ firstNote: notes[i], lastNote: notes[i + 1], firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
  })
}

export const voiceOf = (vf: VexFlowModule, beats: number, ticks: readonly Tick[]): Voice =>
  new vf.Voice({ numBeats: beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables([...ticks])

/** room for the notes after the stave's modifiers */
export const staveRoom = (stave: Stave, x: number, width: number): number => width - (stave.getNoteStartX() - x) - 20

const NOTES_CLEAR = 10 // a bar's last note clears its barline by at least this (the formatter leaves about 15 when they fit)
const TIGHT_CLEAR = 6 // set close: the last note's glyph clears the barline by this
const TIGHT_SHIFT = 8 // set close: of the 12 VexFlow leaves before a bar's first note (Stave.padding), the notes take 8

/**
 * voices formatted to a width; tight (Task 3.2): VexFlow never sets notes closer than their glyphs (14.6 a slash, 2
 * apart), but it starts every bar's notes 12 past the stave's note start (Stave.padding, its Metrics); set close, a
 * bar's notes (and its beat grid, joined) start 4 past it, so 16 beamed 16ths take a quarter of a line with a clef
 */
export function formatVoices(vf: VexFlowModule, voices: readonly Voice[], width: number, tight = false): void {
  const all = [...voices]
  new vf.Formatter().joinVoices(all).format(all, width)
  if (!tight) return
  new Set(all.flatMap((v) => v.getTickables()).map((t) => t.checkTickContext())).forEach((c) => c.setX(c.getX() - TIGHT_SHIFT))
}

/**
 * how a bar's notes take its stave (Task 3.2), the voice built afresh for each try: at VexFlow's spacing where they
 * clear the barline by NOTES_CLEAR (tight false: laid out as before), else set close (tight); need: the stave's width
 * that clears the last glyph by TIGHT_CLEAR, set close. VexFlow never sets a note closer than its glyph: in a bar too
 * narrow the notes run on past the barline, under the next bar's notes and tuplets
 */
function notesFit(vf: VexFlowModule, stave: Stave, notes: () => Voice): Readonly<{ tight: boolean; need: number }> {
  const right = stave.getX() + stave.getWidth()
  const end = (tight: boolean): number => {
    const voice = notes()
    formatVoices(vf, [voice], tight ? 1 : staveRoom(stave, stave.getX(), stave.getWidth()), tight) // set close: at their closest
    const last = voice.getTickables().at(-1)
    if (!last) return stave.getNoteStartX()
    return last.getAbsoluteX() + (tight && last instanceof vf.StaveNote ? last.getGlyphWidth() : last.getWidth())
  }
  return { tight: end(false) > right - NOTES_CLEAR, need: end(true) - stave.getX() + TIGHT_CLEAR }
}

/** a dot where the value ends in d (the engine's values are VexFlow's durations), and an accent */
export function marked(vf: VexFlowModule, note: StaveNote, value: string, accent: boolean): StaveNote {
  if (value.endsWith('d')) vf.Dot.buildAndAttach([note], { all: true })
  if (accent) note.addModifier(new vf.Articulation('a>'), 0)
  return note
}

/**
 * a guide tone (or rest), its stem by VexFlow's usual rule (up below the middle line, down above); a poured note
 * (rhythm-on-lines spec §8) takes its value, dot and accent from its mark, any other is dotted at 3 and 6 beats
 */
function tickFor(vf: VexFlowModule, n: GuideNote, clef: Clef, restate: string | null): StaveNote {
  const duration = n.mark?.value ?? DURATIONS[n.beats as NoteBeats]
  const dotted = (note: StaveNote): StaveNote => {
    if (n.mark) return marked(vf, note, n.mark.value, !!n.pitch && n.mark.accent)
    if (n.beats === 3 || n.beats === 6) vf.Dot.buildAndAttach([note], { all: true })
    return note
  }
  if (!n.pitch) return dotted(new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${duration}r`, clef }))
  const note = dotted(new vf.StaveNote({ keys: [toVexKey(n.pitch)], duration, clef, autoStem: true }))
  note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
  if (n.accidental) note.addModifier(new vf.Accidental(n.accidental), 0)
  else if (restate) note.addModifier(new vf.Accidental(restate).setAsCautionary(), 0)
  return note
}

export function drawChangesLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  if (line.bars.some((b) => b.voice.length)) return drawGuideLine(vf, el, line, opts)
  // the rhythm isn't drawn with the Line off, only its path's step marks (#573): its card shows it
  if (stepped(line)) return drawSteppedLine(vf, el, line, opts)
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts)
  const ctx = svgContext(vf, el, total)
  const xs: number[][] = []
  let x = 0
  line.bars.forEach((bar, b) => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    setVolta(vf, stave, bar, VOLTA_Y)
    stave.setContext(ctx).draw()
    const notes = slashes(vf, bar.slashes)
    const grid = slashGrid(vf, bar)
    const voices = [notes, grid].filter((l) => l.length).map((l) => voiceOf(vf, bar.beats, l))
    new vf.Formatter().joinVoices(voices).format(voices, staveRoom(stave, x, width))
    voices.forEach((v) => v.draw(ctx, stave))
    slashTies(vf, ctx, bar, notes)
    xs.push(slashXs(bar, notes, grid, total))
    x += width
  })
  const plain = clef ? CLEF_BAND : BAND
  const { band, at } = withTargets(line.bars.some((b) => b.volta) ? { top: VOLTA_BAND.top, bottom: plain.bottom } : plain, hasTargets(line) ? SLASH_TARGET_ROW : null)
  const feel = lineFeel(opts)
  // the Feel mark over the staff, in the headroom the first line's clef keeps (CLEF_BAND), so no line grows; under it
  // the slash line's target dots sit in the staff's top space (SLASH_TARGET_ROW), clear of it
  if (feel && line.bars[0]) drawFeelMark(ctx, line.bars[0], (xs[0] ?? []).map((x) => x * total), widths[0] ?? 0, feel, clef ? SLASH_FEEL_ROW : SLASH_TARGET_ROW, !clef && hasTargets(line)) // no clef, no headroom: in the top space, after a dot
  fitSvg(el, band, total, barsLabel(line) + feelAria(feel) + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, split: null, dots: at }
}

type Laid = Readonly<{
  bar: ChangesBar
  stave: Stave
  /** the guide tone voice's notes and their tickables; [] for a bar without guide tones */
  model: readonly GuideNote[]
  ticks: readonly StaveNote[]
  grid: readonly GhostNote[] // a ghost a beat, formatted with the notes: where each beat falls
  plain: readonly StaveNote[] // slashes, for a bar without guide tones (their grid: a ghost a beat where they don't fall one a beat)
  all: readonly Voice[]
  beams: readonly Beam[] // eighths and sixteenths of an arpeggio line, grouped by the beat; a poured bar's by its marks
  tuplets: readonly InstanceType<VexFlowModule['Tuplet']>[] // a poured bar's tuplets
}>

/**
 * a poured bar's beams (rhythm-on-lines spec §8): the indexes of each run of two or more consecutive pitched notes
 * sharing a mark's beam; a rest on the Line splits a run
 */
export function beamRuns(notes: readonly GuideNote[]): number[][] {
  let run = 0
  const keys = notes.map((n) => {
    if (!n.pitch) run++
    return n.pitch && n.mark?.beam != null ? `${n.mark.beam}:${run}` : null
  })
  return groupsOf(
    notes.map((_, i) => i),
    (i) => keys[i] ?? null,
  ).filter((g) => g.length > 1)
}

/**
 * a guide line bar's notes on its stave (its first voice: slashes for a bar without guide tones), their tuplets and
 * beams (a poured bar's by its marks, an arpeggio line's by the beat), and a ghost a beat: where each beat falls
 */
function guideVoices(vf: VexFlowModule, bar: ChangesBar, first: boolean, stave: Stave, noteClef: Clef, arpeggio: boolean): Omit<Laid, 'bar' | 'stave' | 'model'> {
  const model = bar.voice
  const ticks = model.map((n, i) => tickFor(vf, n, noteClef, first && i === 0 ? restatedAccidental(n, bar.keySig) : null))
  const poured = model.some((n) => n.mark)
  const tuplets = tupletsOf(vf, ticks, (i) => model[i]?.mark)
  const grid = ticks.length ? Array.from({ length: bar.beats }, () => new vf.GhostNote('q')) : slashGrid(vf, bar)
  const plain = ticks.length ? [] : slashes(vf, bar.slashes)
  const lists: readonly (readonly Tick[])[] = (ticks.length ? [ticks, grid] : [plain, grid]).filter((l) => l.length)
  const all = lists.map((ticks) => {
    ticks.forEach((t) => t.setStave(stave))
    return voiceOf(vf, bar.beats, ticks)
  })
  const beams = poured
    ? beamRuns(model).map((run) => new vf.Beam(run.flatMap((i) => (ticks[i] ? [ticks[i]] : []))))
    : arpeggio
      ? vf.Beam.generateBeams(ticks, { groups: [new vf.Fraction(1, 4)] })
      : []
  return { ticks, tuplets, grid, plain, all, beams }
}

/** a line with guide tones: lay out every bar, place the brackets over the stem tips, then draw */
function drawGuideLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const noteClef: Clef = opts.clef ?? 'treble'
  // a poured rhythm's bars take their notes' room (Task 3.2): sextuplets and septuplets need more than a bar's share
  const pouredLine = line.bars.some((b) => b.voice.some((n) => n.mark))
  const notesOf: NotesOf = (bar, b, stave) => guideVoices(vf, bar, b === 0, stave, noteClef, !!opts.arpeggio).all[0]!
  const rooms = pouredLine ? lineRooms(vf, line, opts, notesOf) : []
  const { clef, total, widths, scales, fits, notes } = geometry(vf, line, opts, rooms)
  const split = notes < line.bars.length ? crowdedSplit(vf, line, opts, notesOf) : null
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): Laid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const model = bar.voice
    const tight = pouredLine && notesFit(vf, stave, () => guideVoices(vf, bar, b === 0, stave, noteClef, !!opts.arpeggio).all[0]!).tight
    const { ticks, tuplets, grid, plain, all, beams } = guideVoices(vf, bar, b === 0, stave, noteClef, !!opts.arpeggio)
    formatVoices(vf, all, staveRoom(stave, x, width), tight)
    beams.forEach((b) => b.postFormat()) // beamed stems change length here, before the crop and the bracket read their tips
    x += width
    return { bar, stave, model, ticks, grid, plain, all, beams, tuplets }
  })

  // pass 2: raise the brackets over the highest stem tip, accidental, accent or tuplet, level across the line; draw staves, then notes
  const pitched = laid.flatMap((l) => l.ticks).filter((t) => !t.isRest())
  const accented = new Set(laid.flatMap((l) => l.ticks.filter((t, i) => !t.isRest() && l.model[i]?.mark?.accent)))
  const heads = pitched.flatMap((n) => n.getYs())
  const tips = inkTips(pitched, accented, laid.flatMap((l) => l.tuplets))
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const tops = [...tips, ...heads.map((y) => y - ACCIDENTAL_RISE)]
  const row = hasTargets(line) ? targetRow([...tips, ...heads]) : null // a dot sits over its head's center, clear of the accidental to its left
  const feel = lineFeel(opts)
  const marks = stepped(line) || feel ? targetRow([...tips, ...heads]) : null // a poured Line's step marks and the Feel mark share the dots' row
  const shift = first && bracket !== null ? voltaShift([...tops, ...[row ?? marks].flatMap((r) => (r === null ? [] : [r - DOT_ROOM]))], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
  unbracketCrowded(laid.flatMap((l) => l.tuplets))
  laid.forEach((l) => l.tuplets.forEach((t) => t.setContext(ctx).draw()))
  laid.forEach((l) => slashTies(vf, ctx, l.bar, l.plain))
  // target tones (rhythm-on-lines spec §6): colored as Practice highlighting colors a scale's notes
  laid.forEach((l) => l.model.forEach((m, i) => m.target && l.ticks[i]?.getSVGElement()?.classList.add(m.target === 'tone' ? 'vf-selected' : 'vf-dimmed')))

  // ties, one chain across the line: open at its end, and a half-tie in where the line starts tied
  const chain = laid.flatMap((l) => l.model.map((m, i) => ({ m, t: l.ticks[i] ?? null })))
  const tie = (firstNote: StaveNote | null, lastNote: StaveNote | null): void => {
    new vf.StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
  }
  chain.forEach(({ m, t }, i) => {
    if (!m.pitch || !t) return
    if (i === 0 && m.tiedIn) tie(null, t)
    if (m.tie) tie(t, chain[i + 1]?.t ?? null)
  })

  const xs = laid.map((l) => {
    if (!l.ticks.length) return slashXs(l.bar, l.plain, l.grid, total)
    const starts = new Map<number, number>()
    l.model.forEach((m, i) => {
      const t = l.ticks[i]
      if (t && onBeat(m.beat) && !starts.has(Math.round(m.beat))) starts.set(Math.round(m.beat), headCentre(t, total))
    })
    return beatXs(starts, l.grid.map((g) => g.getAbsoluteX()), total)
  })
  const { band, at } = withTargets(voicedBand([...heads, ...tips], bracket === null ? null : bracket + shift), row)
  const poured = line.bars.some((b) => b.voice.some((n) => n.mark))
  if (marks !== null) drawMarks(ctx, laid, stepRow(marks, band.top), xs.map((bar) => bar.map((x) => x * total)), row !== null, feel)
  fitSvg(el, band, total, barsLabel(line) + (opts.arpeggio ? arpeggioAria(line, opts.lineName) : guideAria(line)) + (poured && opts.rhythmCaption ? '' : feelAria(feel)) + (poured ? rhythmAria(opts.rhythmCaption ?? null) + stepAria(line, opts.fromBar ?? 1) : '') + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, split, dots: at }
}

const ACCENT_RISE = 12 // an accent over a stem tip
const TUPLET_RISE = 10 // a tuplet's number over its bracket's line
const BRACKET_DROP = 10 // Saindon's bracket: under the staff's bottom line
const BRACKET_FOOT = 5 // its feet, up towards the staff
const onBeat = (beat: number): boolean => Math.abs(beat - Math.round(beat)) < 1e-6 // a beat in thirds is never exact

/** a rhythm note: a slash on the middle line, its stem up and drawn, or a rest; dotted, accented */
function rhythmTick(vf: VexFlowModule, n: RhythmNote, clef: Clef): StaveNote {
  // the engine's values are VexFlow's durations: a trailing d is a dot
  const note = new vf.StaveNote({ keys: [REST_KEY[clef]], duration: n.value, type: n.rest ? 'r' : 's', clef, stemDirection: 1 })
  if (!n.rest) note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
  return marked(vf, note, n.value, n.accent)
}

/** notes grouped by an index (a tuplet's, a beam's), in order; null: in none */
export const groupsOf = <T, K = number>(ticks: readonly T[], index: (i: number) => K | null): T[][] => {
  const groups = new Map<K, T[]>()
  ticks.forEach((t, i) => {
    const g = index(i)
    if (g !== null) groups.set(g, [...(groups.get(g) ?? []), t])
  })
  return [...groups.values()]
}

type Tuplet = InstanceType<VexFlowModule['Tuplet']>

/**
 * a bar's tuplets (Phase 4 spec §2): each group of its notes sharing a tuplet index, at its first note's ratio (3:2,
 * 5:4, 6:4, 7:4; 3:2 where it carries none), drawn as a bare number since more notes crowd the time
 */
export const tupletsOf = (vf: VexFlowModule, ticks: readonly StaveNote[], note: (i: number) => Pick<RhythmNote, 'tuplet' | 'ratio'> | undefined): Tuplet[] =>
  groupsOf(
    ticks.map((_, i) => i),
    (i) => note(i)?.tuplet ?? null,
  ).map((group) => {
    const { notes, of } = note(group[0]!)?.ratio ?? { notes: 3, of: 2 }
    return new vf.Tuplet(
      group.map((i) => ticks[i]!),
      { numNotes: notes, notesOccupied: of, location: 1, ratioed: false },
    )
  })

const BRACKET_OVERHANG = 5 // VexFlow's tuplet bracket, past its first note's left and its last note's right

/** whether any two brackets (their left and right x), in order along the line, cross */
export function bracketsCross(spans: readonly Readonly<{ left: number; right: number }>[]): boolean {
  const sorted = [...spans].sort((a, b) => a.left - b.left)
  return sorted.some((s, i) => i > 0 && s.left < sorted[i - 1]!.right)
}

/**
 * a line's tuplets, formatted: where two brackets would cross (Task 3.2: sextuplets and septuplets, their notes at
 * their least room), each tuplet under one beam draws its number alone, as engravers set a beamed tuplet; elsewhere
 * every tuplet keeps its bracket
 */
export function unbracketCrowded(tuplets: readonly Tuplet[]): void {
  const spans = tuplets.map((t) => {
    const notes = t.getNotes()
    return { left: notes[0]!.getTieLeftX() - BRACKET_OVERHANG, right: notes.at(-1)!.getTieRightX() + BRACKET_OVERHANG }
  })
  if (!bracketsCross(spans)) return
  tuplets.filter((t) => t.getNotes().every((n) => n.hasBeam())).forEach((t) => t.setBracketed(false))
}

/** a line's ink tops: its stem tips (an accent's over them) and its tuplets' numbers and brackets */
export const inkTips = (notes: readonly StaveNote[], accented: ReadonlySet<StaveNote>, tuplets: readonly Tuplet[]): number[] => [
  ...notes.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY - (accented.has(n) ? ACCENT_RISE : 0)),
  ...tuplets.map((t) => t.getYPosition() - TUPLET_RISE),
]

type Context = ReturnType<typeof svgContext>
type RhythmBar = Readonly<{ rhythm: readonly RhythmNote[]; ticks: readonly StaveNote[] }>

/** a rhythm's ties, one chain across its bars: open at its end, and a half-tie in where it starts tied */
export function rhythmTies(vf: VexFlowModule, ctx: Context, bars: readonly RhythmBar[]): void {
  const chain = bars.flatMap((l) => l.rhythm.map((m, i) => ({ m, t: l.ticks[i] ?? null })))
  const tie = (firstNote: StaveNote | null, lastNote: StaveNote | null): void => {
    new vf.StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
  }
  chain.forEach(({ m, t }, i) => {
    if (m.rest || !t) return
    if (i === 0 && m.tiedIn) tie(null, t)
    if (m.tie) tie(t, chain[i + 1]?.t ?? null)
  })
}

/** Saindon's bracket in a bar (data-rhythm-bracket: key): from its first note's head to its last's, at under, feet up */
function saindonBracket(ctx: Context, rhythm: readonly RhythmNote[], ticks: readonly StaveNote[], under: number, key: string): void {
  const from = rhythm.findIndex((m) => m.bracket === 'start' || m.bracket === 'both')
  if (from < 0) return
  const to = rhythm[from]?.bracket === 'both' ? from : rhythm.findIndex((m, i) => i > from && m.bracket === 'end')
  const a = ticks[from]
  const b = ticks[to < 0 ? ticks.length - 1 : to]
  if (!a || !b) return
  const group: unknown = ctx.openGroup('rhythm-bracket')
  if (group instanceof Element) group.setAttribute('data-rhythm-bracket', key)
  ctx.beginPath().moveTo(a.getNoteHeadBeginX(), under - BRACKET_FOOT).lineTo(a.getNoteHeadBeginX(), under).lineTo(b.getNoteHeadEndX(), under).lineTo(b.getNoteHeadEndX(), under - BRACKET_FOOT).stroke()
  ctx.closeGroup()
}

const STEP_MARK_SIZE = 12 // a step's numeral: about a staff space, so it fits the target dots' band (DOT_ROOM a side)
const STEP_MARK_WIDTH = 0.9 // its width, in ems (a circled digit is about square)
// a target dot is 6 CSS px across, drawn over the line, which shows at about half its drawing units on a phone (2 bars of
// BAR_UNITS in some 330 px) and larger elsewhere: its radius is up to 6 drawing units, so the marks keep that and more
const STEP_MARK_GAP = 9 // from a target dot over the same note to the mark's left edge
const GEAR_MARK_SIZE = 10 // a gear's name: small italics, shorter than the numeral, so it keeps to the same band
const GEAR_MARK_MIN = 7 // the smallest it shrinks to, to fit its room, before it is cut short
const GEAR_MARK_GAP = 3 // from the numeral (as measured) to the gear's name
const GEAR_MARK_CLEAR = 10 // from the gear's name's end to the next target dot's centre, or to the barline

const STEP_MARK_MIN = 8 // the smallest a numeral shrinks to, to fit its room (a numeral is never cut)

/**
 * italic words (a gear's name, the Feel mark) at the size that fits room (drawing units): size, else shrunk as far
 * as GEAR_MARK_MIN, else cut short with an ellipsis; the context's font is left at the size returned
 */
function fitItalic(ctx: Context, name: string, room: number, fullSize = GEAR_MARK_SIZE): Readonly<{ text: string; size: number }> {
  const width = (text: string, size: number): number => ctx.setFont('serif', size, 'normal', 'italic').measureText(text).width
  const full = width(name, fullSize)
  if (full <= room) return { text: name, size: fullSize }
  const size = Math.max(GEAR_MARK_MIN, (fullSize * room) / full)
  if (width(name, size) <= room) return { text: name, size }
  const cut = [...name].findLastIndex((_, k) => k > 0 && width(`${name.slice(0, k).trimEnd()}…`, size) <= room)
  return { text: `${name.slice(0, Math.max(1, cut)).trimEnd()}…`, size }
}

/**
 * the step marks over each step's first note (Phase 4 spec §6, D17) on the target dots' row (row, in drawing units,
 * already clear of the crop's top): the circled numeral where the group changes, then the pulse's short name in small
 * italics where the pulse changes; the mark starts centred on the note's head (its numeral, or its name's first
 * letter), or just right of a target dot over it. dots: each bar's target dots' x by beat, in drawing units (null:
 * the line draws none); the mark keeps clear of the next dot and of the barline: the numeral shrinks as far as
 * STEP_MARK_MIN (on the sheet's first bar it may start after the Feel mark: after), the name shrinks or is cut short
 * (fitItalic). data-rhythm-step: the group and pulse
 */
export function drawStepMarks(ctx: Context, bars: readonly MarkedBar[], row: number, dots: readonly (readonly number[])[] | null, after: number | null = null): void {
  bars.forEach(({ bar, ticks, stave }, b) => {
    const first = ticks[0]
    if (!bar.step || !first) return
    const { group, pulse } = bar.step
    const lead = group !== null ? STEP_MARK_SIZE * STEP_MARK_WIDTH : GEAR_MARK_SIZE * 0.6 // the mark's first glyph, to centre
    const centre = (first.getNoteHeadBeginX() + first.getNoteHeadEndX()) / 2
    const dotXs = dots ? bar.targets.flatMap((beat) => (dots[b]?.[beat] === undefined ? [] : [dots[b]![beat]!])) : []
    const own = dots && bar.targets.includes(0) ? centre + STEP_MARK_GAP : centre - lead / 2
    const left = b === 0 && after !== null ? Math.max(own, after + FEEL_MARK_GAP) : own // after the Feel mark on the sheet's first bar
    const g: unknown = ctx.openGroup('rhythm-step')
    if (g instanceof Element) g.setAttribute('data-rhythm-step', [group, pulse].filter((v) => v !== null).join(' '))
    const endFrom = (x: number): number => Math.min(stave.getX() + stave.getWidth(), ...dotXs.filter((d) => d > x)) - GEAR_MARK_CLEAR
    const numeral = group === null ? 0 : fitNumeral(ctx, stepNumeral(group), endFrom(left) - left)
    if (group !== null) ctx.fillText(stepNumeral(group), left, row + STEP_MARK_SIZE * 0.35) // its baseline, so its middle sits on the row
    if (pulse !== null) {
      const x = group !== null ? left + numeral + GEAR_MARK_GAP : left
      const { text, size } = fitItalic(ctx, PULSE_SHORT_LABELS[pulse], endFrom(x) - x)
      ctx.fillText(text, x, row + size * 0.35)
    }
    ctx.closeGroup()
  })
}

/** a numeral at STEP_MARK_SIZE, else shrunk to fit room as far as STEP_MARK_MIN; the context's font is left at that size; returns its width */
function fitNumeral(ctx: Context, numeral: string, room: number): number {
  const full = ctx.setFont('serif', STEP_MARK_SIZE).measureText(numeral).width
  if (full <= room) return full
  return ctx.setFont('serif', Math.max(STEP_MARK_MIN, (STEP_MARK_SIZE * room) / full)).measureText(numeral).width
}

const FEEL_MARK_SIZE = 10 // the Feel mark: small italics, as a gear's name, so it keeps to the target dots' band
const FEEL_MARK_GAP = 5 // from the Feel mark's end to a step mark on the same bar

/** the room (drawing units) the Feel mark leaves on the first bar for its step mark: the numeral and a gear's name at their least */
const stepReserve = (step: ChangesBar['step']): number =>
  step === null ? 0 : FEEL_MARK_GAP + (step.group !== null ? STEP_MARK_MIN * STEP_MARK_WIDTH : 0) + (step.pulse !== null ? GEAR_MARK_GAP + GEAR_MARK_MIN * 2 : 0)

type MarkedBar = Readonly<{ bar: ChangesBar; ticks: readonly StaveNote[]; stave: Stave }>

/**
 * the Feel mark over the sheet's first bar (Phase 4 spec §6, D21) on row (drawing units): "in 2" or "in 1" in small
 * italics, its first letter centred on the bar's first beat (xs: its beats' x, in drawing units), or just right of a
 * target dot on it (dotted: the line draws dots), as a step mark starts; it keeps clear of the next dot and of the
 * barline (right), leaving room for a step mark on the bar (stepReserve), shrunk or cut short as a gear's name is
 * (fitItalic). Returns its right edge: a step mark on the same bar follows it. data-feel-mark: its words
 */
function drawFeelMark(ctx: Context, bar: ChangesBar, xs: readonly number[], right: number, text: string, row: number, dotted: boolean): number {
  const x = xs[0] ?? 0
  const left = dotted && bar.targets.includes(0) ? x + STEP_MARK_GAP : x - FEEL_MARK_SIZE * 0.15
  const dots = dotted ? bar.targets.flatMap((beat) => (xs[beat] === undefined ? [] : [xs[beat]])) : []
  const end = Math.min(right, ...dots.filter((d) => d > left)) - GEAR_MARK_CLEAR - stepReserve(bar.step)
  const fit = fitItalic(ctx, text, end - left, FEEL_MARK_SIZE)
  const g: unknown = ctx.openGroup('feel-mark')
  if (g instanceof Element) g.setAttribute('data-feel-mark', text)
  ctx.fillText(fit.text, left, row + fit.size * 0.35) // its baseline, so its middle sits on the row
  ctx.closeGroup()
  return left + ctx.measureText(fit.text).width
}

/** a voiced or rhythm line's marks on the dots' row (xs: each bar's beats' x, in drawing units; dotted: the line draws target dots): the Feel mark (feel: its words, on the sheet's first line) first, then the step marks after it */
function drawMarks(ctx: Context, bars: readonly MarkedBar[], row: number, xs: readonly (readonly number[])[], dotted: boolean, feel: string | null): void {
  const first = bars[0]
  const after = feel && first && xs[0] ? drawFeelMark(ctx, first.bar, xs[0], first.stave.getX() + first.stave.getWidth(), feel, row, dotted) : null
  const dots = dotted ? xs : null
  drawStepMarks(ctx, bars, row, dots, after)
}

/** the row the step marks sit on, in a crop whose top is top: the target dots' row, brought down as withTargets brings a dot */
const stepRow = (row: number, top: number): number => Math.max(row, top + DOT_ROOM)

type SlashLaid = Readonly<{ bar: ChangesBar; stave: Stave; ticks: readonly StaveNote[]; grid: readonly GhostNote[]; all: readonly Voice[] }>

/** a bar's plain slashes on its stave, and its grid: a ghost a beat where they don't fall one a beat */
function slashVoices(vf: VexFlowModule, bar: ChangesBar, stave: Stave): Omit<SlashLaid, 'bar' | 'stave'> {
  const ticks = slashes(vf, bar.slashes)
  const grid = slashGrid(vf, bar)
  const all = [ticks, grid]
    .filter((l) => l.length)
    .map((list) => {
      list.forEach((t) => t.setStave(stave))
      return voiceOf(vf, bar.beats, list)
    })
  return { ticks, grid, all }
}

/**
 * a slash line under a rhythm path's step marks (Phase 4 spec D17): the plain slashes, with the marks over each step's
 * first slash, on the target dots' row. The rhythm itself isn't drawn with the Line off: its card shows it (#573)
 */
function drawSteppedLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts)
  const ctx = svgContext(vf, el, total)
  let x = 0
  const laid = line.bars.map((bar, b): SlashLaid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const { ticks, grid, all } = slashVoices(vf, bar, stave)
    new vf.Formatter().joinVoices([...all]).format([...all], staveRoom(stave, x, width))
    x += width
    return { bar, stave, ticks, grid, all }
  })
  const tips = inkTips(laid.flatMap((l) => l.ticks), new Set(), [])
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const row = hasTargets(line) ? targetRow(tips) : null
  const feel = lineFeel(opts)
  const marks = targetRow(tips) // the step marks and the Feel mark share the dots' row
  const shift = first && bracket !== null ? voltaShift([...tips, (row ?? marks) - DOT_ROOM], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
    l.all.forEach((v) => v.draw(ctx, l.stave))
    slashTies(vf, ctx, l.bar, l.ticks)
  })
  const xs = laid.map((l) => slashXs(l.bar, l.ticks, l.grid, total))
  const heads = laid.flatMap((l) => l.ticks.flatMap((t) => t.getYs()))
  const { band, at } = withTargets(voicedBand([...heads, ...tips], bracket === null ? null : bracket + shift), row)
  drawMarks(ctx, laid, stepRow(marks, band.top), xs.map((bar) => bar.map((x) => x * total)), row !== null, feel)
  fitSvg(el, band, total, barsLabel(line) + (opts.rhythmCaption ? '' : feelAria(feel)) + rhythmAria(opts.rhythmCaption ?? null) + stepAria(line, opts.fromBar ?? 1) + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, split: null, dots: at }
}

/** the rhythm card's aria-label (rhythm-scales-arpeggios spec §1): the rhythm, its bars, and ", continues" when cut */
export function cardAria(label: string, card: RhythmCardModel): string {
  const n = card.bars.length
  return `Rhythm card: ${label}, ${n} bar${n === 1 ? '' : 's'}${card.cut ? ', continues' : ''}`
}

const CARD_BARS = 4 // a card bar is a quarter of the staff's notes width (D14), as many as the card has
const CARD_LINE = 2 // the one line a card shows: the middle one, where the slashes sit
const CARD_SCALE = 0.8 // the card's notation against the staff's: a cue size, so a page of staves with cards stays short
const ELLIPSIS_ROOM = 64 // after a cut card's bars: its "…"
const ELLIPSIS_SIZE = 32

/**
 * a card's bar widths and how many of its leading bars it shows (Task 3.2): each bar at least its even width, wider
 * where its notes need more (rooms); all of them when they fit `room`, else the leading bars that fit with `ellipsis`
 * after them for the "…" (at least one)
 */
export function cardFit(rooms: readonly number[], even: number, room: number, ellipsis: number): Readonly<{ widths: readonly number[]; shown: number }> {
  const widths = rooms.map((r) => Math.max(even, r))
  const sums = widths.map((_, b) => widths.slice(0, b + 1).reduce((a, w) => a + w, 0))
  const all = (sums.at(-1) ?? 0) <= room + 1e-9
  return { widths, shown: all ? widths.length : Math.max(1, sums.filter((n) => n <= room - ellipsis + 1e-9).length) }
}

/** a card bar's one-line stave at x, the time signature on the first, and its slash notes with their tuplets and beams (not formatted) */
function cardBar(vf: VexFlowModule, rhythm: readonly RhythmNote[], first: boolean, beats: number, x: number, width: number) {
  const stave = inkStave(vf, x, STAVE_Y, width)
  stave.setConfigForLines(Array.from({ length: stave.getNumLines() }, (_, l) => ({ visible: l === CARD_LINE })))
  stave.setBegBarType(vf.BarlineType.NONE).setEndBarType(vf.BarlineType.NONE) // a five-line staff's: drawn below, one-line
  if (first) stave.addTimeSignature(`${beats}/4`)
  const ticks = rhythm.map((n) => rhythmTick(vf, n, 'treble'))
  ticks.forEach((t) => t.setStave(stave))
  const tuplets = tupletsOf(vf, ticks, (i) => rhythm[i])
  const voice = voiceOf(vf, beats, ticks)
  const beams = groupsOf(ticks, (i) => rhythm[i]?.beam ?? null).filter((g) => g.length > 1).map((notes) => new vf.Beam(notes))
  return { rhythm, stave, ticks, voice, beams, tuplets }
}

/**
 * the rhythm card under a Scales staff (rhythm-scales-arpeggios spec §1, §7): a one-line stave per bar (each a quarter
 * of width, the staff's notes width, less the "…"'s room when cut; a bar whose notes need more is wider, and the card
 * shows the bars that fit, cut, cardFit; ending under the staff's end; data-rhythm-bar: its bar from 1) with one-line
 * barlines, the rhythm's slash notes with their tuplets, beams, accents and ties, the time signature on the first bar,
 * Saindon's bracket under the line, and "…" after the last barline when the cycle was cut; drawn at CARD_SCALE;
 * label: its aria-label for the card as shown (cardAria); frame: the SVG's width, the card at its right (a staff's, so
 * the card lines up under its notes; the card's own width + 1 for a card alone: the Changes sheet's and the Rhythm control's, #573)
 */
export function drawRhythmCard(vf: VexFlowModule, el: HTMLElement, card: RhythmCardModel, width: number, label: (shown: RhythmCardModel) => string = () => '', frame = STAFF_WIDTH): void {
  const total = frame / CARD_SCALE // the same SVG width as the staff's, in smaller units
  const ctx = svgContext(vf, el, total)
  const barWidth = (width - (card.cut ? ELLIPSIS_ROOM : 0)) / CARD_BARS / CARD_SCALE
  const left = (frame - 1 - width) / CARD_SCALE
  const rooms = card.bars.map((rhythm, b) => {
    const stave = cardBar(vf, rhythm, b === 0, card.beats, 0, barWidth).stave
    const fit = notesFit(vf, stave, () => cardBar(vf, rhythm, b === 0, card.beats, 0, barWidth).voice)
    return fit.tight ? fit.need : 0
  })
  const fit = cardFit(rooms, barWidth, (width - (card.cut ? ELLIPSIS_ROOM : 0)) / CARD_SCALE, card.cut ? 0 : ELLIPSIS_ROOM / CARD_SCALE)
  const shown: RhythmCardModel = { ...card, bars: card.bars.slice(0, fit.shown), cut: card.cut || fit.shown < card.bars.length }
  const xs = fit.widths.map((_, b) => left + fit.widths.slice(0, b).reduce((a, w) => a + w, 0))
  const laid = shown.bars.map((rhythm, b) => {
    const x = xs[b] ?? left
    const w = fit.widths[b] ?? barWidth
    const bar = cardBar(vf, rhythm, b === 0, card.beats, x, w)
    const { tight } = notesFit(vf, bar.stave, () => cardBar(vf, rhythm, b === 0, card.beats, x, w).voice)
    formatVoices(vf, [bar.voice], staveRoom(bar.stave, x, w), tight)
    bar.beams.forEach((beam) => beam.postFormat())
    return bar
  })
  const first = laid[0]?.stave
  const line = first?.getYForLine(CARD_LINE) ?? 100
  const space = first?.getSpacingBetweenLines() ?? 10
  unbracketCrowded(laid.flatMap((l) => l.tuplets))
  laid.forEach((l, b) => {
    const group: unknown = ctx.openGroup('rhythm-bar')
    if (group instanceof Element) group.setAttribute('data-rhythm-bar', String(b + 1))
    l.stave.setContext(ctx).draw()
    const end = l.stave.getX() + l.stave.getWidth() // its barline: a space over and under the line
    ctx.beginPath().moveTo(end, line - space).lineTo(end, line + space).stroke()
    l.voice.draw(ctx, l.stave)
    l.beams.forEach((beam) => beam.setContext(ctx).draw())
    l.tuplets.forEach((t) => t.setContext(ctx).draw())
    ctx.closeGroup()
  })
  rhythmTies(vf, ctx, laid)
  const under = line + space + BRACKET_DROP // under the slash heads on the line
  laid.forEach((l, b) => saindonBracket(ctx, l.rhythm, l.ticks, under, String(b + 1)))
  if (shown.cut) ctx.setFont('serif', ELLIPSIS_SIZE).fillText('…', (xs[fit.shown - 1] ?? left) + (fit.widths[fit.shown - 1] ?? 0) + 12, line)
  const struck = laid.flatMap((l) => l.ticks.filter((t) => !t.isRest()))
  const accented = new Set(laid.flatMap((l) => l.ticks.filter((_, i) => l.rhythm[i]?.accent)))
  const tips = inkTips(struck, accented, laid.flatMap((l) => l.tuplets))
  const hasBracket = shown.bars.some((bar) => bar.some((m) => m.bracket))
  // the band: the time signature (two spaces over and under the line), the stem tips, accents and tuplets, the bracket
  const top = line - 2 * space
  const bottom = line + 2 * space
  fitSvg(el, { top: Math.min(top, ...tips) - 4, bottom: Math.max(bottom, hasBracket ? under : bottom) + 4 }, total, label(shown))
}
