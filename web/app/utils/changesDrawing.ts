import type { ChangesLine } from '~~/engine'
import { BAR_UNITS, fitSvg, headCentre, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

/**
 * Drawing a Changes line (engine/changes.ts) with VexFlow: one stave, one slash a beat, repeat and final barlines,
 * the time signature on the first line. Chords, numerals and scales are HTML placed over and under the slashes.
 * With a clef (key signatures on): the first line (timeSignature) starts with the clef and the chart's key signature,
 * the rest with neither; without, no clef, as before.
 */

const VOLTA_Y = 0 // shift for the 1st/2nd-ending bracket, above the staff (at getYForTopText)
const BAND = { top: 74, bottom: 126 } // just the staff (lines at 80-120): slashes sit on the middle line
const VOLTA_BAND = { top: 44, bottom: 126 } // a line with a 1st/2nd-ending bracket needs headroom above the staff
const CLEF_BAND = { top: 64, bottom: 134 } // a line with a clef (key signatures on): room for the clef above and below the staff

/** per bar, each beat's slash centre as a fraction of the width */
export type ChangesLayout = Readonly<{ xs: readonly (readonly number[])[] }>

export function drawChangesLine(
  vf: VexFlowModule,
  el: HTMLElement,
  line: ChangesLine,
  opts: Readonly<{ timeSignature: boolean; beats: 2 | 3 | 4; barsPerLine: number; clef?: 'treble' | 'bass' }>,
): ChangesLayout {
  const clef = opts.timeSignature ? opts.clef : undefined // with signatures, the clef and key signature start the first line only
  const lead = (clef ? signatureLead(vf, clef, line.bars[0]?.keySig ?? null) : 0) + (opts.timeSignature ? TIME_SPACE : 0)
  const total = BAR_UNITS * opts.barsPerLine
  const barWidth = (total - 1 - lead) / opts.barsPerLine
  const ctx = svgContext(vf, el, total)
  const xs: number[][] = []
  let x = 0
  line.bars.forEach((bar, b) => {
    const width = b === 0 ? barWidth + lead : barWidth
    const stave = new vf.Stave(x, STAVE_Y, width)
    if (b === 0 && clef) stave.addClef(clef)
    if (b === 0 && clef && bar.keySig) stave.addKeySignature(bar.keySig)
    if (b === 0 && opts.timeSignature) stave.addTimeSignature(`${opts.beats}/4`)
    if (bar.repeatStart) stave.setBegBarType(vf.BarlineType.REPEAT_BEGIN)
    if (bar.repeatEnd) stave.setEndBarType(vf.BarlineType.REPEAT_END)
    else if (bar.end === 'final') stave.setEndBarType(vf.BarlineType.END)
    else if (bar.end === 'double') stave.setEndBarType(vf.BarlineType.DOUBLE)
    if (bar.volta) {
      const t = bar.volta.start && bar.volta.end ? vf.Volta.type.BEGIN_END : bar.volta.start ? vf.Volta.type.BEGIN : bar.volta.end ? vf.Volta.type.END : vf.Volta.type.MID
      stave.setVoltaType(t, bar.volta.start ? `${bar.volta.n}.` : '', VOLTA_Y)
    }
    stave.setContext(ctx).draw()
    const notes = Array.from({ length: opts.beats }, () => {
      const note = new vf.StaveNote({ keys: ['b/4'], duration: 'q', type: 's', autoStem: false })
      note.setStemStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' }) // slashes without stems
      return note
    })
    const voice = new vf.Voice({ numBeats: opts.beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    new vf.Formatter().joinVoices([voice]).format([voice], width - (stave.getNoteStartX() - x) - 20)
    voice.draw(ctx, stave)
    xs.push(notes.map((n) => headCentre(n, total)))
    x += width
  })
  const plain = clef ? CLEF_BAND : BAND
  const band = line.bars.some((b) => b.volta) ? { top: VOLTA_BAND.top, bottom: plain.bottom } : plain
  fitSvg(el, band, total, `Bars: ${line.bars.map((b) => b.chords.map((c) => c.text).join(' ') || '–').join(' | ')}`)
  return { xs }
}
