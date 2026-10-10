import { accidentalsInBar, accText, type GuideNote, type GuideSystem, octaveOf, toVexKey } from '~~/engine'
import { BAR_UNITS, CLEF_SPACE, cropBand, fitSvg, headCentre, KEY_CHANGE_TOP, keyChanges, keyChangeWidth, signatureLead, STAVE_Y, svgContext, TIME_SPACE, type VexFlowModule } from './vexflow'

/**
 * Drawing guide tone systems (engine/guideTones.ts) with VexFlow: two staves a system, one per line, bars aligned
 * across both. The scale-staff drawing and the shared SVG helpers live in vexflow.ts.
 */

const DURATIONS = { 4: 'w', 3: 'hd', 2: 'h', 1: 'q' } as const // 3 beats: a dotted half
const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
const INK = { fillStyle: 'currentColor', strokeStyle: 'currentColor' } // follows light/dark mode, prints black
// guide tones sit near the middle of the staff, so their minimum band is just the clef: 8 systems fit a letter page
export const GUIDE_MIN_TOP = 64
export const GUIDE_MIN_BOTTOM = 134

export type SystemLayout = Readonly<{
  /** per line, per bar: each note's centre as a fraction of the width */
  xs: readonly (readonly (readonly number[])[])[]
}>

/** each note's accidental against the key signature and what came before it in the bar (rests: null) */
function barAccidentals(notes: readonly GuideNote[], tiedIn: (i: number) => boolean, keySig: string | null): (string | null)[] {
  const pitched = notes.flatMap((n, i) => (n.pitch ? [{ i, pitch: n.pitch }] : []))
  const accs = accidentalsInBar(pitched.map(({ i, pitch }) => ({ letter: pitch.letter, acc: pitch.acc, octave: octaveOf(pitch), tiedIn: tiedIn(i) })), keySig)
  const out: (string | null)[] = notes.map(() => null)
  pitched.forEach(({ i }, k) => (out[i] = accs[k] ?? null))
  return out
}

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
  // with key signatures (any bar has one): the first bar's lead is measured, and a bar changing key gets the new one
  const signed = system.bars.some((b) => b.keySig !== null)
  const time = opts.timeSignature ? `${beats}/4` : undefined
  const lead = signed ? signatureLead(vf, clef, system.bars[0]?.keySig ?? null, time) : CLEF_SPACE + (opts.timeSignature ? TIME_SPACE : 0)
  const changes = signed ? keyChanges(system.bars) : []
  const extra = changes.map((c) => (c ? keyChangeWidth(vf, c.keySig, c.previous) : 0)) // taken from the other bars' shares
  const total = BAR_UNITS * opts.barsPerSystem
  const barWidth = (total - 1 - lead - extra.reduce((a, w) => a + w, 0)) / opts.barsPerSystem
  const ctxs = els.map((el) => svgContext(vf, el, total))

  const allNotes: InstanceType<typeof vf.StaveNote>[][] = [[], []]
  const ties: boolean[][] = [[], []]
  const xsNotes: InstanceType<typeof vf.StaveNote>[][][] = [[], []]
  let x = 0
  system.bars.forEach((bar, b) => {
    const width = (b === 0 ? barWidth + lead : barWidth) + (extra[b] ?? 0)
    const isLast = b === system.bars.length - 1
    const change = changes[b]
    const staves = ([0, 1] as const).map((l) => {
      const stave = new vf.Stave(x, STAVE_Y, width)
      if (b === 0) stave.addClef(clef)
      if (b === 0 && bar.keySig) stave.addKeySignature(bar.keySig)
      if (change) stave.addKeySignature(change.keySig, change.previous ?? undefined)
      if (b === 0 && opts.timeSignature) stave.addTimeSignature(`${beats}/4`)
      if (isLast && opts.finalBar) stave.setEndBarType(vf.BarlineType.END)
      const ctx = ctxs[l]
      if (ctx) stave.setContext(ctx).draw()
      return stave
    })
    const voices = ([0, 1] as const).map((l) => {
      const shown = new Map<string, number>() // accidentals so far in this bar, by letter + octave
      const tiedIn = (i: number): boolean => (i === 0 ? (ties[l]?.at(-1) ?? false) : (bar.lines[l][i - 1]?.tie ?? false))
      const signedAccs = signed ? barAccidentals(bar.lines[l], tiedIn, bar.keySig) : []
      const notes = bar.lines[l].map((n, i) => {
        const dotted = (note: InstanceType<typeof vf.StaveNote>): InstanceType<typeof vf.StaveNote> => {
          if (n.beats === 3) vf.Dot.buildAndAttach([note], { all: true })
          return note
        }
        if (!n.pitch) return dotted(new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${DURATIONS[n.beats]}r`, clef }))
        const key = toVexKey(n.pitch)
        const note = dotted(new vf.StaveNote({ keys: [key], duration: DURATIONS[n.beats], clef }))
        note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
        if (signed) {
          const acc = signedAccs[i]
          if (acc) note.addModifier(new vf.Accidental(acc), 0)
          return note
        }
        const place = `${n.pitch.letter}/${key.split('/')[1]}`
        const before = shown.get(place) ?? 0
        if (!tiedIn(i) && (n.pitch.acc !== 0 || before !== 0)) note.addModifier(new vf.Accidental(n.pitch.acc === 0 ? 'n' : accText(n.pitch.acc)), 0)
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
  const band = cropBand(heads, changes.some(Boolean) ? KEY_CHANGE_TOP : GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM)
  els.forEach((el, l) => {
    const keys = system.bars.map((b) => b.lines[l as 0 | 1].map((n) => (n.pitch ? toVexKey(n.pitch).replace('/', '') : 'rest')).join(' '))
    fitSvg(el, band, total, `Line ${l + 1}: ${keys.join(' | ')}`)
  })
  return {
    xs: xsNotes.map((bars) => bars.map((notes) => notes.map((n) => headCentre(n, total)))),
  }
}
