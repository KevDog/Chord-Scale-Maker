import { accText, barKey, type ChangesBar, type ChangesLine, type GuideNote, type NoteBeats, type Pitched, PULSE_LABELS, PULSE_SHORT_LABELS, type RhythmCardModel, type RhythmNote, signatureAccidentals, toVexKey } from '@chord-scale-maker/engine'
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
 * name's scale; how many of the leading bars fit the line (fitBars): fewer than the line's, it should break there; and
 * the target dots' row (rhythm spec §7) as a fraction of the drawing's height from its top (null: no target beats)
 */
export type ChangesLayout = Readonly<{ xs: readonly (readonly number[])[]; ends: readonly number[]; scales: readonly (readonly number[])[]; fits: number; dots: number | null }>

type Clef = 'treble' | 'bass'
/** names: each bar's chords, their widths as fractions of the line, to widen the bars they crowd (fitBars) */
/** first: the sheet's first line, which starts with the clef */
/** rhythmCaption: the sheet's rhythm caption, for the aria-label of a line with a rhythm (rhythm spec §8) */
/** fromBar: the line's first bar, counted from the sheet's first (1), for the step marks' aria-label (Phase 4 spec §6) */
type Opts = Readonly<{ first: boolean; barsPerLine: number; clef?: Clef; names?: readonly (readonly NamedBeat[])[]; arpeggio?: boolean; lineName?: string; rhythmCaption?: string | null; fromBar?: number }>
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
export type BarFit = Readonly<{ shares: readonly number[]; scales: readonly (readonly number[])[]; fits: number }>
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
 * rooms: each bar's notes' least share of the line (notesRoom), which a bar takes as its names'; notes don't shrink,
 * so the line breaks after the leading bars whose rooms fit it whole
 */
export function fitBars(barBeats: readonly number[], bars: readonly (readonly NamedBeat[] | null)[], rooms: readonly number[] = []): BarFit {
  const floor = FLOOR / bars.length
  const needs = bars.map((chords, b) => {
    if (!chords) return 0
    const beats = barBeats[b] ?? DEFAULT_BEATS
    const s = spans(beats, chords)
    return Math.max(floor, rooms[b] ?? 0, ...chords.map((c, i) => (c.width * beats) / (s[i] ?? beats)))
  })
  const total = needs.reduce((a, b) => a + b, 0)
  const shares = total >= 1 ? needs.map((n) => n / total) : waterFill(needs)
  const scales = bars.map((chords, b) => {
    if (!chords) return []
    const beats = barBeats[b] ?? DEFAULT_BEATS
    const s = spans(beats, chords)
    return chords.map((c, i) => Math.min(1, Math.max(MIN_SCALE, ((shares[b] ?? 0) * (s[i] ?? beats)) / beats / c.width)))
  })
  const present = bars.filter((b) => b !== null).length
  const sums = needs.map((_, b) => needs.slice(0, b + 1).reduce((a, n) => a + n, 0))
  const roomed = rooms.map((_, b) => rooms.slice(0, b + 1).reduce((a, n) => a + n, 0)).filter((n) => n <= 1 + 1e-9).length
  return { shares, scales, fits: Math.max(1, Math.min(present, rooms.length ? roomed : present, sums.filter((n) => n * BREAK_SCALE <= 1 + 1e-9).length)) }
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

type Geometry = Readonly<{ clef: Clef | undefined; total: number; widths: readonly number[]; scales: readonly (readonly number[])[]; fits: number }>

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
  const { shares, scales, fits } = fitBars(line.bars.map((bar) => bar.beats), slots, floors)
  return { clef, total, widths: line.bars.map((_, b) => area * (shares[b] ?? 0) + (leads[b] ?? 0)), scales, fits }
}

/** with signatures, the clef and key signature start the first line only */
const lineClef = (opts: Opts): Clef | undefined => (opts.first ? opts.clef : undefined)

/**
 * each bar's room (notesRoom) on its own stave at the width the names give it, the line's first with its signatures
 * (Task 3.2): what geometry widens a bar to, and where it breaks a line whose notes can't all fit
 */
function lineRooms(vf: VexFlowModule, line: ChangesLine, opts: Opts, notes: (bar: ChangesBar, b: number, stave: Stave) => Voice): number[] {
  const { widths } = geometry(vf, line, opts)
  return line.bars.map((bar, b) => {
    const stave = staveFor(vf, bar, b === 0, 0, widths[b] ?? BAR_UNITS, lineClef(opts))
    return notesRoom(vf, stave, notes(bar, b, stave))
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

function slashes(vf: VexFlowModule, beats: number): StaveNote[] {
  return Array.from({ length: beats }, () => {
    const note = new vf.StaveNote({ keys: ['b/4'], duration: 'q', type: 's', autoStem: false })
    note.setStemStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' }) // slashes without stems
    return note
  })
}

export const voiceOf = (vf: VexFlowModule, beats: number, ticks: readonly Tick[]): Voice =>
  new vf.Voice({ numBeats: beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables([...ticks])

/** room for the notes after the stave's modifiers */
export const staveRoom = (stave: Stave, x: number, width: number): number => width - (stave.getNoteStartX() - x) - 20

const NOTES_CLEAR = 10 // a bar's last note clears its barline by at least this (the formatter leaves about 15 when they fit)
/**
 * the width a bar needs for its notes (Task 3.2): formatted on its stave as drawn, to the last note's right edge, and
 * NOTES_CLEAR. Notes that fit end short of the barline, so this is under the bar's width; notes the formatter can't
 * squeeze (each glyph keeps its room) run on past it, under the next bar's notes and tuplets, and this is what they need
 */
function notesRoom(vf: VexFlowModule, stave: Stave, notes: Voice): number {
  new vf.Formatter().joinVoices([notes]).format([notes], staveRoom(stave, stave.getX(), stave.getWidth()))
  const last = notes.getTickables().at(-1)
  return (last ? last.getAbsoluteX() + last.getWidth() : stave.getNoteStartX()) - stave.getX() + NOTES_CLEAR
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
  if (line.bars.some((b) => b.rhythm.length)) return drawRhythmLine(vf, el, line, opts)
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts)
  const ctx = svgContext(vf, el, total)
  const xs: number[][] = []
  let x = 0
  line.bars.forEach((bar, b) => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    setVolta(vf, stave, bar, VOLTA_Y)
    stave.setContext(ctx).draw()
    const notes = slashes(vf, bar.beats)
    const voice = voiceOf(vf, bar.beats, notes)
    new vf.Formatter().joinVoices([voice]).format([voice], staveRoom(stave, x, width))
    voice.draw(ctx, stave)
    xs.push(notes.map((n) => headCentre(n, total)))
    x += width
  })
  const plain = clef ? CLEF_BAND : BAND
  const { band, at } = withTargets(line.bars.some((b) => b.volta) ? { top: VOLTA_BAND.top, bottom: plain.bottom } : plain, hasTargets(line) ? SLASH_TARGET_ROW : null)
  fitSvg(el, band, total, barsLabel(line) + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, dots: at }
}

type Laid = Readonly<{
  bar: ChangesBar
  stave: Stave
  /** the guide tone voice's notes and their tickables; [] for a bar without guide tones */
  model: readonly GuideNote[]
  ticks: readonly StaveNote[]
  grid: readonly GhostNote[] // a ghost a beat, formatted with the notes: where each beat falls
  plain: readonly StaveNote[] // slashes, for a bar without guide tones
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
  const grid = ticks.length ? Array.from({ length: bar.beats }, () => new vf.GhostNote('q')) : []
  const plain = ticks.length ? [] : slashes(vf, bar.beats)
  const lists: readonly (readonly Tick[])[] = ticks.length ? [ticks, grid] : [plain]
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
  const rooms = pouredLine ? lineRooms(vf, line, opts, (bar, b, stave) => guideVoices(vf, bar, b === 0, stave, noteClef, !!opts.arpeggio).all[0]!) : []
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts, rooms)
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): Laid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const model = bar.voice
    const { ticks, tuplets, grid, plain, all, beams } = guideVoices(vf, bar, b === 0, stave, noteClef, !!opts.arpeggio)
    new vf.Formatter().joinVoices([...all]).format([...all], staveRoom(stave, x, width))
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
  const marks = stepped(line) ? targetRow([...tips, ...heads]) : null // a poured Line's step marks share the dots' row
  const shift = first && bracket !== null ? voltaShift([...tops, ...[row ?? marks].flatMap((r) => (r === null ? [] : [r - DOT_ROOM]))], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
  unbracketCrowded(laid.flatMap((l) => l.tuplets))
  laid.forEach((l) => l.tuplets.forEach((t) => t.setContext(ctx).draw()))
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
    if (!l.ticks.length) return l.plain.map((n) => headCentre(n, total))
    const starts = new Map<number, number>()
    l.model.forEach((m, i) => {
      const t = l.ticks[i]
      if (t && onBeat(m.beat) && !starts.has(Math.round(m.beat))) starts.set(Math.round(m.beat), headCentre(t, total))
    })
    return beatXs(starts, l.grid.map((g) => g.getAbsoluteX()), total)
  })
  const { band, at } = withTargets(voicedBand([...heads, ...tips], bracket === null ? null : bracket + shift), row)
  const poured = line.bars.some((b) => b.voice.some((n) => n.mark))
  if (marks !== null) drawStepMarks(ctx, laid, stepRow(marks, band.top), row === null ? null : xs.map((bar) => bar.map((x) => x * total)))
  fitSvg(el, band, total, barsLabel(line) + (opts.arpeggio ? arpeggioAria(line, opts.lineName) : guideAria(line)) + (poured ? rhythmAria(opts.rhythmCaption ?? null) + stepAria(line, opts.fromBar ?? 1) : '') + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, dots: at }
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

/**
 * a gear's name at the size that fits room (drawing units): GEAR_MARK_SIZE, else shrunk as far as GEAR_MARK_MIN,
 * else cut short with an ellipsis; the context's font is left at the size returned
 */
function fitGearName(ctx: Context, name: string, room: number): Readonly<{ text: string; size: number }> {
  const width = (text: string, size: number): number => ctx.setFont('serif', size, 'normal', 'italic').measureText(text).width
  const full = width(name, GEAR_MARK_SIZE)
  if (full <= room) return { text: name, size: GEAR_MARK_SIZE }
  const size = Math.max(GEAR_MARK_MIN, (GEAR_MARK_SIZE * room) / full)
  if (width(name, size) <= room) return { text: name, size }
  const cut = [...name].findLastIndex((_, k) => k > 0 && width(`${name.slice(0, k).trimEnd()}…`, size) <= room)
  return { text: `${name.slice(0, Math.max(1, cut)).trimEnd()}…`, size }
}

/**
 * the step marks over each step's first note (Phase 4 spec §6, D17) on the target dots' row (row, in drawing units,
 * already clear of the crop's top): the circled numeral where the group changes, then the pulse's short name in small
 * italics where the pulse changes; the mark starts centred on the note's head (its numeral, or its name's first
 * letter), or just right of a target dot over it. dots: each bar's target dots' x by beat, in drawing units (null:
 * the line draws none); the name keeps clear of the next dot and of the barline (fitGearName). data-rhythm-step: the
 * group and pulse
 */
export function drawStepMarks(ctx: Context, bars: readonly Readonly<{ bar: ChangesBar; ticks: readonly StaveNote[]; stave: Stave }>[], row: number, dots: readonly (readonly number[])[] | null): void {
  bars.forEach(({ bar, ticks, stave }, b) => {
    const first = ticks[0]
    if (!bar.step || !first) return
    const { group, pulse } = bar.step
    const lead = group !== null ? STEP_MARK_SIZE * STEP_MARK_WIDTH : GEAR_MARK_SIZE * 0.6 // the mark's first glyph, to centre
    const centre = (first.getNoteHeadBeginX() + first.getNoteHeadEndX()) / 2
    const dotXs = dots ? bar.targets.flatMap((beat) => (dots[b]?.[beat] === undefined ? [] : [dots[b]![beat]!])) : []
    const left = dots && bar.targets.includes(0) ? centre + STEP_MARK_GAP : centre - lead / 2
    const g: unknown = ctx.openGroup('rhythm-step')
    if (g instanceof Element) g.setAttribute('data-rhythm-step', [group, pulse].filter((v) => v !== null).join(' '))
    const numeral = group === null ? 0 : ctx.setFont('serif', STEP_MARK_SIZE).measureText(stepNumeral(group)).width
    if (group !== null) ctx.fillText(stepNumeral(group), left, row + STEP_MARK_SIZE * 0.35) // its baseline, so its middle sits on the row
    if (pulse !== null) {
      const x = group !== null ? left + numeral + GEAR_MARK_GAP : left
      const end = Math.min(stave.getX() + stave.getWidth(), ...dotXs.filter((d) => d > x)) - GEAR_MARK_CLEAR
      const { text, size } = fitGearName(ctx, PULSE_SHORT_LABELS[pulse], end - x)
      ctx.fillText(text, x, row + size * 0.35)
    }
    ctx.closeGroup()
  })
}

/** the row the step marks sit on, in a crop whose top is top: the target dots' row, brought down as withTargets brings a dot */
const stepRow = (row: number, top: number): number => Math.max(row, top + DOT_ROOM)

type RhythmLaid = Readonly<{
  bar: ChangesBar
  stave: Stave
  ticks: readonly StaveNote[]
  grid: readonly GhostNote[]
  all: readonly Voice[]
  beams: readonly Beam[]
  tuplets: readonly InstanceType<VexFlowModule['Tuplet']>[]
}>

type RhythmVoices = Readonly<{ ticks: readonly StaveNote[]; tuplets: readonly Tuplet[]; grid: readonly GhostNote[]; all: readonly Voice[]; beams: readonly Beam[] }>

/** a rhythm bar's notes on its stave (slashes with none), their tuplets and beams, and a ghost a beat: where each beat falls */
function rhythmVoices(vf: VexFlowModule, rhythm: readonly RhythmNote[], beats: number, stave: Stave, clef: Clef): RhythmVoices {
  const ticks = rhythm.length ? rhythm.map((n) => rhythmTick(vf, n, clef)) : slashes(vf, beats)
  const tuplets = tupletsOf(vf, ticks, (i) => rhythm[i])
  const grid = Array.from({ length: beats }, () => new vf.GhostNote('q'))
  const all = [ticks, grid].map((list) => {
    list.forEach((t) => t.setStave(stave))
    return voiceOf(vf, beats, list)
  })
  const beams = groupsOf(ticks, (i) => rhythm[i]?.beam ?? null).filter((g) => g.length > 1).map((notes) => new vf.Beam(notes))
  return { ticks, tuplets, grid, all, beams }
}

/**
 * a line with a rhythm (rhythm spec §8), in the guide line's two passes: each bar's notes in place of its slashes,
 * with its tuplets, beams and accents; then the brackets over the stem tips, the ties as one chain across the line,
 * and Saindon's bracket under the staff (data-rhythm-bracket: its bar)
 */
function drawRhythmLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const noteClef: Clef = opts.clef ?? 'treble'
  const rooms = lineRooms(vf, line, opts, (bar, _, stave) => rhythmVoices(vf, bar.rhythm, bar.beats, stave, noteClef).all[0]!)
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts, rooms)
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): RhythmLaid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const { ticks, tuplets, grid, all, beams } = rhythmVoices(vf, bar.rhythm, bar.beats, stave, noteClef)
    new vf.Formatter().joinVoices([...all]).format([...all], staveRoom(stave, x, width))
    beams.forEach((beam) => beam.postFormat())
    x += width
    return { bar, stave, ticks, grid, all, beams, tuplets }
  })

  // pass 2: raise the brackets over the highest stem tip, accent or tuplet, level across the line; draw staves, then notes
  const struck = laid.flatMap((l) => l.ticks.filter((t, i) => !t.isRest() && l.bar.rhythm[i]))
  const accented = new Set(laid.flatMap((l) => l.ticks.filter((_, i) => l.bar.rhythm[i]?.accent)))
  const tips = inkTips(struck, accented, laid.flatMap((l) => l.tuplets))
  const heads = struck.flatMap((n) => n.getYs())
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const row = hasTargets(line) ? targetRow(tips) : null
  const marks = stepped(line) ? targetRow(tips) : null // the step marks share the dots' row
  const shift = first && bracket !== null ? voltaShift([...tips, ...[row ?? marks].flatMap((r) => (r === null ? [] : [r - DOT_ROOM]))], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
  unbracketCrowded(laid.flatMap((l) => l.tuplets))
  laid.forEach((l) => l.tuplets.forEach((t) => t.setContext(ctx).draw()))

  rhythmTies(vf, ctx, laid.map((l) => ({ rhythm: l.bar.rhythm, ticks: l.ticks })))
  const under = (first?.getBottomLineY() ?? 120) + BRACKET_DROP
  laid.forEach((l) => saindonBracket(ctx, l.bar.rhythm, l.ticks, under, barKey(l.bar.at)))

  const xs = laid.map((l) => {
    const starts = new Map<number, number>()
    l.bar.rhythm.forEach((m, i) => {
      const t = l.ticks[i]
      if (t && onBeat(m.beat) && !starts.has(Math.round(m.beat))) starts.set(Math.round(m.beat), headCentre(t, total))
    })
    return beatXs(starts, l.grid.map((g) => g.getAbsoluteX()), total)
  })
  const hasBracket = line.bars.some((b) => b.rhythm.some((m) => m.bracket))
  const { band, at } = withTargets(voicedBand([...heads, ...tips, ...(hasBracket ? [under] : [])], bracket === null ? null : bracket + shift), row)
  if (marks !== null) drawStepMarks(ctx, laid, stepRow(marks, band.top), row === null ? null : xs.map((bar) => bar.map((x) => x * total)))
  fitSvg(el, band, total, barsLabel(line) + rhythmAria(opts.rhythmCaption ?? null) + stepAria(line, opts.fromBar ?? 1) + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, dots: at }
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
 * label: its aria-label for the card as shown (cardAria)
 */
export function drawRhythmCard(vf: VexFlowModule, el: HTMLElement, card: RhythmCardModel, width: number, label: (shown: RhythmCardModel) => string = () => ''): void {
  const total = STAFF_WIDTH / CARD_SCALE // the same SVG width as the staff's, in smaller units
  const ctx = svgContext(vf, el, total)
  const barWidth = (width - (card.cut ? ELLIPSIS_ROOM : 0)) / CARD_BARS / CARD_SCALE
  const left = (STAFF_WIDTH - 1 - width) / CARD_SCALE
  const rooms = card.bars.map((rhythm, b) => {
    const bar = cardBar(vf, rhythm, b === 0, card.beats, 0, barWidth)
    return notesRoom(vf, bar.stave, bar.voice)
  })
  const fit = cardFit(rooms, barWidth, (width - (card.cut ? ELLIPSIS_ROOM : 0)) / CARD_SCALE, card.cut ? 0 : ELLIPSIS_ROOM / CARD_SCALE)
  const shown: RhythmCardModel = { ...card, bars: card.bars.slice(0, fit.shown), cut: card.cut || fit.shown < card.bars.length }
  const xs = fit.widths.map((_, b) => left + fit.widths.slice(0, b).reduce((a, w) => a + w, 0))
  const laid = shown.bars.map((rhythm, b) => {
    const x = xs[b] ?? left
    const w = fit.widths[b] ?? barWidth
    const bar = cardBar(vf, rhythm, b === 0, card.beats, x, w)
    new vf.Formatter().joinVoices([bar.voice]).format([bar.voice], staveRoom(bar.stave, x, w))
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
