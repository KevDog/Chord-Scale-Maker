import { accText, barKey, type ChangesBar, type ChangesLine, type GuideNote, type NoteBeats, type Pitched, type RhythmNote, signatureAccidentals, toVexKey } from '@chord-scale-maker/engine'
import { BAR_UNITS, cropBand, fitSvg, headCentre, inkStave, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

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
type Opts = Readonly<{ first: boolean; barsPerLine: number; clef?: Clef; names?: readonly (readonly NamedBeat[])[]; arpeggio?: boolean; lineName?: string; rhythmCaption?: string | null }>
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
 */
export function fitBars(barBeats: readonly number[], bars: readonly (readonly NamedBeat[] | null)[]): BarFit {
  const floor = FLOOR / bars.length
  const needs = bars.map((chords, b) => {
    if (!chords) return 0
    const beats = barBeats[b] ?? DEFAULT_BEATS
    const s = spans(beats, chords)
    return Math.max(floor, ...chords.map((c, i) => (c.width * beats) / (s[i] ?? beats)))
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
  return { shares, scales, fits: Math.max(1, Math.min(present, sums.filter((n) => n * BREAK_SCALE <= 1 + 1e-9).length)) }
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

const hasTargets = (line: ChangesLine): boolean => line.bars.some((b) => b.targets.length > 0)

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
function geometry(vf: VexFlowModule, line: ChangesLine, opts: Opts): Geometry {
  const clef = opts.first ? opts.clef : undefined // with signatures, the clef and key signature start the first line only
  const leads = line.bars.map((bar, b) => (b === 0 && clef ? signatureLead(vf, clef, bar.keySig) : 0) + (bar.timeSignature ? TIME_SPACE : 0))
  const total = BAR_UNITS * opts.barsPerLine
  const area = total - 1 - leads.reduce((a, l) => a + l, 0)
  const slots = Array.from({ length: opts.barsPerLine }, (_, b) =>
    b < line.bars.length ? (opts.names?.[b] ?? []).map((c) => ({ beat: c.beat, width: (c.width * total) / area })) : null,
  )
  const { shares, scales, fits } = fitBars(line.bars.map((bar) => bar.beats), slots)
  return { clef, total, widths: line.bars.map((_, b) => area * (shares[b] ?? 0) + (leads[b] ?? 0)), scales, fits }
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

const voiceOf = (vf: VexFlowModule, beats: number, ticks: readonly Tick[]): Voice =>
  new vf.Voice({ numBeats: beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables([...ticks])

/** room for the notes after the stave's modifiers */
const room = (stave: Stave, x: number, width: number): number => width - (stave.getNoteStartX() - x) - 20

/** a dot where the value ends in d (the engine's values are VexFlow's durations), and an accent */
function marked(vf: VexFlowModule, note: StaveNote, value: string, accent: boolean): StaveNote {
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
    new vf.Formatter().joinVoices([voice]).format([voice], room(stave, x, width))
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
  tuplets: readonly InstanceType<VexFlowModule['Tuplet']>[] // a poured bar's triplets
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

/** a line with guide tones: lay out every bar, place the brackets over the stem tips, then draw */
function drawGuideLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts)
  const noteClef: Clef = opts.clef ?? 'treble'
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): Laid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const model = bar.voice
    const ticks = model.map((n, i) => tickFor(vf, n, noteClef, b === 0 && i === 0 ? restatedAccidental(n, bar.keySig) : null))
    const poured = model.some((n) => n.mark)
    const tuplets = groupsOf(ticks, (i) => model[i]?.mark?.tuplet ?? null).map((notes) => new vf.Tuplet(notes, { numNotes: 3, notesOccupied: 2, location: 1 }))
    const grid = ticks.length ? Array.from({ length: bar.beats }, () => new vf.GhostNote('q')) : []
    const plain = ticks.length ? [] : slashes(vf, bar.beats)
    const lists: readonly (readonly Tick[])[] = ticks.length ? [ticks, grid] : [plain]
    const all = lists.map((ticks) => {
      ticks.forEach((t) => t.setStave(stave))
      return voiceOf(vf, bar.beats, ticks)
    })
    const beams = poured
      ? beamRuns(model).map((run) => new vf.Beam(run.flatMap((i) => (ticks[i] ? [ticks[i]] : []))))
      : opts.arpeggio
        ? vf.Beam.generateBeams(ticks, { groups: [new vf.Fraction(1, 4)] })
        : []
    new vf.Formatter().joinVoices(all).format(all, room(stave, x, width))
    beams.forEach((b) => b.postFormat()) // beamed stems change length here, before the crop and the bracket read their tips
    x += width
    return { bar, stave, model, ticks, grid, plain, all, beams, tuplets }
  })

  // pass 2: raise the brackets over the highest stem tip, accidental, accent or triplet, level across the line; draw staves, then notes
  const pitched = laid.flatMap((l) => l.ticks).filter((t) => !t.isRest())
  const accented = new Set(laid.flatMap((l) => l.ticks.filter((t, i) => !t.isRest() && l.model[i]?.mark?.accent)))
  const heads = pitched.flatMap((n) => n.getYs())
  const tips = [
    ...pitched.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY - (accented.has(n) ? ACCENT_RISE : 0)),
    ...laid.flatMap((l) => l.tuplets.map((t) => t.getYPosition() - TUPLET_RISE)), // the triplets' 3s and brackets
  ]
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const tops = [...tips, ...heads.map((y) => y - ACCIDENTAL_RISE)]
  const row = hasTargets(line) ? targetRow([...tips, ...heads]) : null // a dot sits over its head's center, clear of the accidental to its left
  const shift = first && bracket !== null ? voltaShift([...tops, ...(row === null ? [] : [row - DOT_ROOM])], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
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
  fitSvg(el, band, total, barsLabel(line) + (opts.arpeggio ? arpeggioAria(line, opts.lineName) : guideAria(line)) + (poured ? rhythmAria(opts.rhythmCaption ?? null) : '') + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, dots: at }
}

const ACCENT_RISE = 12 // an accent over a stem tip
const TUPLET_RISE = 10 // a triplet's 3 over its bracket's line
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
const groupsOf = <T, K = number>(ticks: readonly T[], index: (i: number) => K | null): T[][] => {
  const groups = new Map<K, T[]>()
  ticks.forEach((t, i) => {
    const g = index(i)
    if (g !== null) groups.set(g, [...(groups.get(g) ?? []), t])
  })
  return [...groups.values()]
}

type RhythmLaid = Readonly<{
  bar: ChangesBar
  stave: Stave
  ticks: readonly StaveNote[]
  grid: readonly GhostNote[]
  all: readonly Voice[]
  beams: readonly Beam[]
  tuplets: readonly InstanceType<VexFlowModule['Tuplet']>[]
}>

/**
 * a line with a rhythm (rhythm spec §8), in the guide line's two passes: each bar's notes in place of its slashes,
 * with its tuplets, beams and accents; then the brackets over the stem tips, the ties as one chain across the line,
 * and Saindon's bracket under the staff (data-rhythm-bracket: its bar)
 */
function drawRhythmLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const { clef, total, widths, scales, fits } = geometry(vf, line, opts)
  const noteClef: Clef = opts.clef ?? 'treble'
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): RhythmLaid => {
    const width = widths[b] ?? 0
    const stave = staveFor(vf, bar, b === 0, x, width, clef)
    const ticks = bar.rhythm.length ? bar.rhythm.map((n) => rhythmTick(vf, n, noteClef)) : slashes(vf, bar.beats)
    const tuplets = groupsOf(ticks, (i) => bar.rhythm[i]?.tuplet ?? null).map((notes) => new vf.Tuplet(notes, { numNotes: 3, notesOccupied: 2, location: 1 }))
    const grid = Array.from({ length: bar.beats }, () => new vf.GhostNote('q'))
    const all = [ticks, grid].map((list) => {
      list.forEach((t) => t.setStave(stave))
      return voiceOf(vf, bar.beats, list)
    })
    const beams = groupsOf(ticks, (i) => bar.rhythm[i]?.beam ?? null).filter((g) => g.length > 1).map((notes) => new vf.Beam(notes))
    new vf.Formatter().joinVoices(all).format(all, room(stave, x, width))
    beams.forEach((beam) => beam.postFormat())
    x += width
    return { bar, stave, ticks, grid, all, beams, tuplets }
  })

  // pass 2: raise the brackets over the highest stem tip, accent or triplet, level across the line; draw staves, then notes
  const struck = laid.flatMap((l) => l.ticks.filter((t, i) => !t.isRest() && l.bar.rhythm[i]))
  const accented = new Set(laid.flatMap((l) => l.ticks.filter((_, i) => l.bar.rhythm[i]?.accent)))
  const tips = [
    ...struck.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY - (accented.has(n) ? ACCENT_RISE : 0)),
    ...laid.flatMap((l) => l.tuplets.map((t) => t.getYPosition() - TUPLET_RISE)), // the triplets' 3s and brackets
  ]
  const heads = struck.flatMap((n) => n.getYs())
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const row = hasTargets(line) ? targetRow(tips) : null
  const shift = first && bracket !== null ? voltaShift([...tips, ...(row === null ? [] : [row - DOT_ROOM])], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))
  laid.forEach((l) => l.beams.forEach((b) => b.setContext(ctx).draw()))
  laid.forEach((l) => l.tuplets.forEach((t) => t.setContext(ctx).draw()))

  // ties, one chain across the line: open at its end, and a half-tie in where the line starts tied
  const chain = laid.flatMap((l) => l.bar.rhythm.map((m, i) => ({ m, t: l.ticks[i] ?? null })))
  const tie = (firstNote: StaveNote | null, lastNote: StaveNote | null): void => {
    new vf.StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
  }
  chain.forEach(({ m, t }, i) => {
    if (m.rest || !t) return
    if (i === 0 && m.tiedIn) tie(null, t)
    if (m.tie) tie(t, chain[i + 1]?.t ?? null)
  })

  // Saindon's bracket: from its first note's head to its last's, under the staff, feet up
  const under = (first?.getBottomLineY() ?? 120) + BRACKET_DROP
  laid.forEach((l) => {
    const from = l.bar.rhythm.findIndex((m) => m.bracket === 'start' || m.bracket === 'both')
    if (from < 0) return
    const to = l.bar.rhythm[from]?.bracket === 'both' ? from : l.bar.rhythm.findIndex((m, i) => i > from && m.bracket === 'end')
    const a = l.ticks[from]
    const b = l.ticks[to < 0 ? l.ticks.length - 1 : to]
    if (!a || !b) return
    const group: unknown = ctx.openGroup('rhythm-bracket')
    if (group instanceof Element) group.setAttribute('data-rhythm-bracket', barKey(l.bar.at))
    ctx.beginPath().moveTo(a.getNoteHeadBeginX(), under - BRACKET_FOOT).lineTo(a.getNoteHeadBeginX(), under).lineTo(b.getNoteHeadEndX(), under).lineTo(b.getNoteHeadEndX(), under - BRACKET_FOOT).stroke()
    ctx.closeGroup()
  })

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
  fitSvg(el, band, total, barsLabel(line) + rhythmAria(opts.rhythmCaption ?? null) + targetsAria(line))
  return { xs, ends: endsOf(widths, total), scales, fits, dots: at }
}
