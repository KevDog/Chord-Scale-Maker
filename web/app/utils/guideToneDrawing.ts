import { accText, type GuideSystem, toVexKey } from '~~/engine'
import { cropBand, fitSvg, headCentre, STAVE_Y, svgContext, type VexFlowModule } from './vexflow'

/**
 * Drawing guide tone systems (engine/guideTones.ts) with VexFlow: two staves a system, one per line, bars aligned
 * across both. The scale-staff drawing and the shared SVG helpers live in vexflow.ts.
 */

const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const // 3 beats: a dotted half
const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black
const CLEF_SPACE = 70 // the first bar of a system also holds the clef
const TIME_SPACE = 40 // and, on the first system, the time signature
const BAR_UNITS = 300 // drawing width per bar, so 2-bar systems on phones draw as large as 4-bar ones elsewhere
// guide tones sit near the middle of the staff, so their minimum band is just the clef: 8 systems fit a letter page
export const GUIDE_MIN_TOP = 64
export const GUIDE_MIN_BOTTOM = 134

export type SystemLayout = Readonly<{
  /** per line, per bar: each note's centre as a fraction of the width */
  xs: readonly (readonly (readonly number[])[])[]
}>

/**
 * draw one guide tone system: line 1 into els[0], line 2 into els[1], one staff each, bars aligned across both
 * (each bar's two voices are formatted together). Every system uses the same bar width, so a short last system
 * is left-aligned rather than stretched. Colors follow CSS `color`.
 */
export function drawGuideToneSystem(
  vf: VexFlowModule,
  els: readonly [HTMLElement, HTMLElement],
  system: GuideSystem,
  clef: 'treble' | 'bass',
  opts: Readonly<{ timeSignature: boolean; finalBar: boolean; barsPerSystem: number; beats?: 2 | 3 | 4 }>,
): SystemLayout {
  const beats = opts.beats ?? 4
  const lead = CLEF_SPACE + (opts.timeSignature ? TIME_SPACE : 0)
  const total = BAR_UNITS * opts.barsPerSystem
  const barWidth = (total - 1 - lead) / opts.barsPerSystem
  const ctxs = els.map((el) => svgContext(vf, el, total))

  const allNotes: InstanceType<typeof vf.StaveNote>[][] = [[], []]
  const ties: boolean[][] = [[], []]
  const xsNotes: InstanceType<typeof vf.StaveNote>[][][] = [[], []]
  let x = 0
  system.bars.forEach((bar, b) => {
    const width = b === 0 ? barWidth + lead : barWidth
    const isLast = b === system.bars.length - 1
    const staves = ([0, 1] as const).map((l) => {
      const stave = new vf.Stave(x, STAVE_Y, width)
      if (b === 0) stave.addClef(clef)
      if (b === 0 && opts.timeSignature) stave.addTimeSignature(`${beats}/4`)
      if (isLast && opts.finalBar) stave.setEndBarType(vf.BarlineType.END)
      const ctx = ctxs[l]
      if (ctx) stave.setContext(ctx).draw()
      return stave
    })
    const voices = ([0, 1] as const).map((l) => {
      const shown = new Map<string, number>() // accidentals so far in this bar, by letter + octave
      const notes = bar.lines[l].map((n, i) => {
        const tiedIn = i === 0 ? (ties[l]?.at(-1) ?? false) : (bar.lines[l][i - 1]?.tie ?? false)
        const dotted = (note: InstanceType<typeof vf.StaveNote>): InstanceType<typeof vf.StaveNote> => {
          if (n.beats === 3) vf.Dot.buildAndAttach([note], { all: true })
          return note
        }
        if (!n.pitch) return dotted(new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${DURATIONS[n.beats]}r`, clef }))
        const key = toVexKey(n.pitch)
        const note = dotted(new vf.StaveNote({ keys: [key], duration: DURATIONS[n.beats], clef }))
        note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
        const place = `${n.pitch.letter}/${key.split('/')[1]}`
        const before = shown.get(place) ?? 0
        if (!tiedIn && (n.pitch.acc !== 0 || before !== 0)) note.addModifier(new vf.Accidental(n.pitch.acc === 0 ? 'n' : accText(n.pitch.acc)), 0)
        shown.set(place, n.pitch.acc)
        return note
      })
      allNotes[l]?.push(...notes)
      ties[l]?.push(...bar.lines[l].map((n) => n.tie))
      xsNotes[l]?.push(notes)
      return new vf.Voice({ numBeats: beats, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    })
    const [s0] = staves
    const room = width - ((s0?.getNoteStartX() ?? x) - x) - 20
    new vf.Formatter().joinVoices([voices[0] as InstanceType<typeof vf.Voice>]).joinVoices([voices[1] as InstanceType<typeof vf.Voice>]).format(voices as InstanceType<typeof vf.Voice>[], room)
    voices.forEach((v, l) => {
      const ctx = ctxs[l]
      const stave = staves[l]
      if (ctx && stave) v.draw(ctx, stave)
    })
    x += width
  })

  // ties, including one left open at the end of the system (it continues on the next)
  ;([0, 1] as const).forEach((l) => {
    const ctx = ctxs[l]
    const notes = allNotes[l] ?? []
    notes.forEach((n, i) => {
      if (!ties[l]?.[i] || !ctx) return
      new vf.StaveTie({ firstNote: n, lastNote: notes[i + 1] ?? null, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
    })
  })

  // crop both staves to the same band, so the two lines look alike
  const heads = [...(allNotes[0] ?? []), ...(allNotes[1] ?? [])].filter((n) => !n.isRest()).flatMap((n) => n.getYs())
  const band = cropBand(heads, GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM)
  els.forEach((el, l) => {
    const keys = system.bars.map((b) => b.lines[l as 0 | 1].map((n) => (n.pitch ? toVexKey(n.pitch).replace('/', '') : 'rest')).join(' '))
    fitSvg(el, band, total, `Line ${l + 1}: ${keys.join(' | ')}`)
  })
  return {
    xs: xsNotes.map((bars) => bars.map((notes) => notes.map((n) => headCentre(n, total)))),
  }
}
