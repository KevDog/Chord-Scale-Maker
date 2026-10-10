import { accText, type ChangesBar, type ChangesLine, type GuideNote, type Pitched, signatureAccidentals, toVexKey } from '~~/engine'
import { BAR_UNITS, cropBand, fitSvg, headCentre, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

/**
 * Drawing a Changes line (engine/changes.ts) with VexFlow: one stave, one slash a beat, repeat and final barlines,
 * the time signature on the first line. Chords, numerals and scales are HTML placed over and under the slashes.
 * With a clef (key signatures or a guide tone on): the first line (timeSignature) starts with the clef, and with the
 * chart's key signature when a bar carries one; the rest with neither; without, no clef, as before.
 * With guide tones on (bar.voices), each chord's 3rd and/or 7th replace the slashes: one voice, or two with stems up
 * and down, each note held for its chord and tied across barlines and line ends. Drawn in two passes, so a 1st/2nd-
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
export const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const // 3 beats: a dotted half
export const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
export const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black

/** per bar, each beat's x (its slash's or note head's centre) as a fraction of the width */
export type ChangesLayout = Readonly<{ xs: readonly (readonly number[])[] }>

type Clef = 'treble' | 'bass'
type Opts = Readonly<{ timeSignature: boolean; beats: 2 | 3 | 4; barsPerLine: number; clef?: Clef }>
type Band = Readonly<{ top: number; bottom: number }>
type Stave = InstanceType<VexFlowModule['Stave']>
type StaveNote = InstanceType<VexFlowModule['StaveNote']>
type GhostNote = InstanceType<VexFlowModule['GhostNote']>
type Voice = InstanceType<VexFlowModule['Voice']>
type Tick = StaveNote | GhostNote

/** how far (0 or less) to raise a line's ending brackets so their foot clears its highest ink by VOLTA_MARGIN */
export function voltaShift(inkTops: readonly number[], bracketBottom: number): number {
  return inkTops.length ? Math.min(0, Math.min(...inkTops) - VOLTA_MARGIN - bracketBottom) : 0
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

/** two voices' ties curve apart (VexFlow: -1 above the heads, +1 below); null with one voice: VexFlow's own */
export const tieDirection = (voices: number, v: number): number | null => (voices < 2 ? null : v === 0 ? -1 : 1)

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

/** the aria-label's guide tones: each chord's notes top to bottom with their labels, "–" for a held bar; '' when off */
export function guideAria(line: ChangesLine): string {
  if (!line.bars.some((b) => b.voices.length)) return ''
  const bars = line.bars.map((bar) => {
    const chords = bar.chords.map((c) =>
      bar.voices
        .map((notes, v) => {
          const n = notes.find((x) => x.beat === c.beat && !x.tiedIn)
          return `${n?.pitch ? pitchName(n.pitch) : 'rest'} ${c.guide[v] ?? ''}`.trim()
        })
        .join(' / '),
    )
    return chords.join(', ') || '–'
  })
  return `; guide tones: ${bars.join(' | ')}`
}

const barsLabel = (line: ChangesLine): string => `Bars: ${line.bars.map((b) => b.chords.map((c) => c.text).join(' ') || '–').join(' | ')}`

/** the clef the first line starts with, its lead (clef, key and time signatures) and the bar width, so bars line up */
function geometry(vf: VexFlowModule, line: ChangesLine, opts: Opts): Readonly<{ clef: Clef | undefined; lead: number; total: number; barWidth: number }> {
  const clef = opts.timeSignature ? opts.clef : undefined // with signatures, the clef and key signature start the first line only
  const lead = (clef ? signatureLead(vf, clef, line.bars[0]?.keySig ?? null) : 0) + (opts.timeSignature ? TIME_SPACE : 0)
  const total = BAR_UNITS * opts.barsPerLine
  return { clef, lead, total, barWidth: (total - 1 - lead) / opts.barsPerLine }
}

/** a bar's stave with its signatures (first bar only) and barlines; its bracket comes from setVolta */
function staveFor(vf: VexFlowModule, bar: ChangesBar, first: boolean, x: number, width: number, clef: Clef | undefined, opts: Opts): Stave {
  const stave = new vf.Stave(x, STAVE_Y, width)
  if (first && clef) stave.addClef(clef)
  if (first && clef && bar.keySig) stave.addKeySignature(bar.keySig)
  if (first && opts.timeSignature) stave.addTimeSignature(`${opts.beats}/4`)
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

/**
 * a guide tone (or rest) for voice v of count: stems up then down with two voices, VexFlow's choice with one.
 * With two, a rest is written once, in the upper voice; the lower holds a ghost of the same length.
 */
function tickFor(vf: VexFlowModule, n: GuideNote, v: number, count: number, clef: Clef, restate: string | null): Tick {
  const duration = DURATIONS[n.beats]
  const dotted = (note: StaveNote): StaveNote => {
    if (n.beats === 3) vf.Dot.buildAndAttach([note], { all: true })
    return note
  }
  if (!n.pitch) return v > 0 ? new vf.GhostNote(duration) : dotted(new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${duration}r`, clef }))
  const stem = count > 1 ? { stemDirection: v === 0 ? 1 : -1 } : { autoStem: true }
  const note = dotted(new vf.StaveNote({ keys: [toVexKey(n.pitch)], duration, clef, ...stem }))
  note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
  if (n.accidental) note.addModifier(new vf.Accidental(n.accidental), 0)
  else if (restate) note.addModifier(new vf.Accidental(restate).setAsCautionary(), 0)
  return note
}

export function drawChangesLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  if (line.bars.some((b) => b.voices.length)) return drawGuideLine(vf, el, line, opts)
  const { clef, lead, total, barWidth } = geometry(vf, line, opts)
  const ctx = svgContext(vf, el, total)
  const xs: number[][] = []
  let x = 0
  line.bars.forEach((bar, b) => {
    const width = b === 0 ? barWidth + lead : barWidth
    const stave = staveFor(vf, bar, b === 0, x, width, clef, opts)
    setVolta(vf, stave, bar, VOLTA_Y)
    stave.setContext(ctx).draw()
    const notes = slashes(vf, opts.beats)
    const voice = voiceOf(vf, opts.beats, notes)
    new vf.Formatter().joinVoices([voice]).format([voice], room(stave, x, width))
    voice.draw(ctx, stave)
    xs.push(notes.map((n) => headCentre(n, total)))
    x += width
  })
  const plain = clef ? CLEF_BAND : BAND
  const band = line.bars.some((b) => b.volta) ? { top: VOLTA_BAND.top, bottom: plain.bottom } : plain
  fitSvg(el, band, total, barsLabel(line))
  return { xs }
}

type Laid = Readonly<{
  bar: ChangesBar
  stave: Stave
  /** per voice, top first: the model's notes and their tickables */
  voices: readonly Readonly<{ model: readonly GuideNote[]; ticks: readonly Tick[] }>[]
  grid: readonly GhostNote[] // a ghost a beat, formatted with the notes: where each beat falls
  plain: readonly StaveNote[] // slashes, for a bar without guide tones
  all: readonly Voice[]
}>

/** a line with guide tones: lay out every bar, place the brackets over the stem tips, then draw */
function drawGuideLine(vf: VexFlowModule, el: HTMLElement, line: ChangesLine, opts: Opts): ChangesLayout {
  const { clef, lead, total, barWidth } = geometry(vf, line, opts)
  const noteClef: Clef = opts.clef ?? 'treble'
  const count = Math.max(0, ...line.bars.map((b) => b.voices.length))
  const ctx = svgContext(vf, el, total)

  // pass 1: every bar's stave and notes, formatted (not drawn), so the stem tips are known
  let x = 0
  const laid = line.bars.map((bar, b): Laid => {
    const width = b === 0 ? barWidth + lead : barWidth
    const stave = staveFor(vf, bar, b === 0, x, width, clef, opts)
    const voices = bar.voices.map((model, v) => ({ model, ticks: model.map((n, i) => tickFor(vf, n, v, count, noteClef, b === 0 && i === 0 ? restatedAccidental(n, bar.keySig) : null)) }))
    const grid = voices.length ? Array.from({ length: opts.beats }, () => new vf.GhostNote('q')) : []
    const plain = voices.length ? [] : slashes(vf, opts.beats)
    const lists: readonly (readonly Tick[])[] = voices.length ? [...voices.map((v) => v.ticks), grid] : [plain]
    const all = lists.map((ticks) => {
      ticks.forEach((t) => t.setStave(stave))
      return voiceOf(vf, opts.beats, ticks)
    })
    new vf.Formatter().joinVoices(all).format(all, room(stave, x, width))
    x += width
    return { bar, stave, voices, grid, plain, all }
  })

  // pass 2: raise the brackets over the highest stem tip or accidental, level across the line; draw staves, then notes
  const pitched = laid.flatMap((l) => l.voices.flatMap((v) => v.ticks)).filter((t): t is StaveNote => t instanceof vf.StaveNote && !t.isRest())
  const heads = pitched.flatMap((n) => n.getYs())
  const tips = pitched.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY)
  const first = laid[0]?.stave
  const bracket = first && line.bars.some((b) => b.volta) ? first.getYForTopText(first.getNumLines()) + VOLTA_Y : null
  const shift = first && bracket !== null ? voltaShift([...tips, ...heads.map((y) => y - ACCIDENTAL_RISE)], bracket + 1.5 * first.getSpacingBetweenLines()) : 0
  laid.forEach((l) => {
    setVolta(vf, l.stave, l.bar, VOLTA_Y + shift)
    l.stave.setContext(ctx).draw()
  })
  laid.forEach((l) => l.all.forEach((v) => v.draw(ctx, l.stave)))

  // ties, one chain a voice across the line: open at its end, and a half-tie in where the line starts tied
  for (let v = 0; v < count; v++) {
    const chain = laid.flatMap((l) => {
      const voice = l.voices[v]
      return voice ? voice.model.map((m, i) => ({ m, t: voice.ticks[i] ?? null })) : []
    })
    const direction = tieDirection(count, v)
    const tie = (firstNote: Tick | null, lastNote: Tick | null): void => {
      const t = new vf.StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] })
      if (direction !== null) t.setDirection(direction)
      t.setContext(ctx).draw()
    }
    chain.forEach(({ m, t }, i) => {
      if (!m.pitch || !t) return
      if (i === 0 && m.tiedIn) tie(null, t)
      if (m.tie) tie(t, chain[i + 1]?.t ?? null)
    })
  }

  const xs = laid.map((l) => {
    const top = l.voices[0]
    if (!top) return l.plain.map((n) => headCentre(n, total))
    const starts = new Map<number, number>()
    top.model.forEach((m, i) => {
      const t = top.ticks[i]
      if (t instanceof vf.StaveNote) starts.set(m.beat, headCentre(t, total))
    })
    return beatXs(starts, l.grid.map((g) => g.getAbsoluteX()), total)
  })
  fitSvg(el, voicedBand([...heads, ...tips], bracket === null ? null : bracket + shift), total, barsLabel(line) + guideAria(line))
  return { xs }
}
