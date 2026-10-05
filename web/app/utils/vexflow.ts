import { accText, type GuideSystem, type StaffModel, toVexKey } from '~~/engine'

type VexFlowModule = typeof import('vexflow/bravura')

let loading: Promise<VexFlowModule> | undefined

/**
 * VexFlow with its Bravura music font, loaded on demand (only the editor needs it).
 * The font ships inside the bundle as a data: URL, so nothing is fetched from a CDN.
 */
export function loadVexFlow(): Promise<VexFlowModule> {
  loading ??= import('vexflow/bravura')
    .then(async (vf) => {
      await document.fonts?.load('30px Bravura').catch(() => undefined) // draw with fallback metrics rather than not at all
      return vf
    })
    .catch((e: unknown) => {
      loading = undefined // let the next staff retry
      throw e
    })
  return loading
}

// Drawing units. The SVG scales to its container width (about 650px in print). Each staff's
// viewBox is cropped to what was drawn, so its height depends on how far notes go above or
// below the staff: about 45px in print for most scales, at most about 65px (three ledger
// lines, e.g. bass clef from B), so 12 staves and their labels fit on a letter page.
const STAFF_WIDTH = 1200
const STAFF_HEIGHT = 200
const STAVE_Y = 40 // staff lines at y 80-120, with room for ledger lines on both sides
export const MIN_TOP = 55 // always show the clef and a ledger line's space above and below the staff
export const MIN_BOTTOM = 140
// room around a note head for its accidental: a flat rises about two spaces, a sharp hangs 1.5
const ABOVE_HEAD = 24
const BELOW_HEAD = 18

/** vertical band to show, from note-head y positions (drawing units); never smaller than the staff band */
export function cropBand(headYs: readonly number[]): Readonly<{ top: number; bottom: number }> {
  if (headYs.length === 0) return { top: MIN_TOP, bottom: MIN_BOTTOM }
  return {
    top: Math.min(MIN_TOP, Math.min(...headYs) - ABOVE_HEAD),
    bottom: Math.max(MIN_BOTTOM, Math.max(...headYs) + BELOW_HEAD),
  }
}

/**
 * draw one staff of whole notes into el, replacing what was there; colors follow CSS `color`.
 * Returns each note head's centre as a fraction of the width, for labels placed under it.
 */
export function drawStaff(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, clef: 'treble' | 'bass'): number[] {
  el.replaceChildren()
  const renderer = new vf.Renderer(el as HTMLDivElement, vf.Renderer.Backends.SVG)
  renderer.resize(STAFF_WIDTH, STAFF_HEIGHT)
  const ctx = renderer.getContext()
  ctx.setFillStyle('currentColor').setStrokeStyle('currentColor')

  const stave = new vf.Stave(0, STAVE_Y, STAFF_WIDTH - 1)
  stave.addClef(clef).setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()

  const notes = staff.notes.map((n) => {
    const note = new vf.StaveNote({ keys: [toVexKey(n)], duration: 'w', clef })
    if (n.acc) note.addModifier(new vf.Accidental(accText(n.acc)), 0) // explicit on every altered note
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
  }

  // crop to the notes' actual range (SVG getBBox measures glyphs by font ascent, not ink),
  // and scale with the container instead of a fixed pixel size
  const { top, bottom } = cropBand(notes.flatMap((n) => n.getYs()))
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${top} ${STAFF_WIDTH} ${bottom - top}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width') // VexFlow's resize() sets a fixed pixel size
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
  return notes.map((n) => (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2 / STAFF_WIDTH)
}

// --- guide tone systems (engine/guideTones.ts) ------------------------------------------------------------------

const DURATIONS = { 4: 'w', 2: 'h', 1: 'q' } as const
const REST_KEY = { treble: 'b/4', bass: 'd/3' } as const
const CLEF_SPACE = 70 // the first bar of a system also holds the clef
const TIME_SPACE = 40 // and, on the first system, the time signature
const BAR_UNITS = 300 // drawing width per bar, so 2-bar systems on phones draw as large as 4-bar ones elsewhere

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
  opts: Readonly<{ timeSignature: boolean; finalBar: boolean; barsPerSystem: number }>,
): SystemLayout {
  const lead = CLEF_SPACE + (opts.timeSignature ? TIME_SPACE : 0)
  const total = BAR_UNITS * opts.barsPerSystem
  const barWidth = (total - 1 - lead) / opts.barsPerSystem
  const ctxs = els.map((el) => {
    el.replaceChildren()
    const r = new vf.Renderer(el as HTMLDivElement, vf.Renderer.Backends.SVG)
    r.resize(total, STAFF_HEIGHT)
    return r.getContext().setFillStyle('currentColor').setStrokeStyle('currentColor')
  })

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
      if (b === 0 && opts.timeSignature) stave.addTimeSignature('4/4')
      if (isLast && opts.finalBar) stave.setEndBarType(vf.BarlineType.END)
      const ctx = ctxs[l]
      if (ctx) stave.setContext(ctx).draw()
      return stave
    })
    const voices = ([0, 1] as const).map((l) => {
      const shown = new Map<string, number>() // accidentals so far in this bar, by letter + octave
      const notes = bar.lines[l].map((n, i) => {
        const tiedIn = i === 0 ? (ties[l]?.at(-1) ?? false) : (bar.lines[l][i - 1]?.tie ?? false)
        if (!n.pitch) return new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${DURATIONS[n.beats]}r`, clef })
        const key = toVexKey(n.pitch)
        const note = new vf.StaveNote({ keys: [key], duration: DURATIONS[n.beats], clef })
        const place = `${n.pitch.letter}/${key.split('/')[1]}`
        const before = shown.get(place) ?? 0
        if (!tiedIn && (n.pitch.acc !== 0 || before !== 0)) note.addModifier(new vf.Accidental(n.pitch.acc === 0 ? 'n' : accText(n.pitch.acc)), 0)
        shown.set(place, n.pitch.acc)
        return note
      })
      allNotes[l]?.push(...notes)
      ties[l]?.push(...bar.lines[l].map((n) => n.tie))
      xsNotes[l]?.push(notes)
      return new vf.Voice({ numBeats: 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
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
  const { top, bottom } = cropBand(heads)
  els.forEach((el, l) => {
    const svg = el.querySelector('svg')
    svg?.setAttribute('viewBox', `0 ${top} ${total} ${bottom - top}`)
    svg?.setAttribute('width', '100%')
    svg?.removeAttribute('height')
    svg?.style.removeProperty('width')
    svg?.style.removeProperty('height')
    svg?.setAttribute('role', 'img')
    const keys = system.bars.map((b) => b.lines[l as 0 | 1].map((n) => (n.pitch ? toVexKey(n.pitch).replace('/', '') : 'rest')).join(' '))
    svg?.setAttribute('aria-label', `Line ${l + 1}: ${keys.join(' | ')}`)
  })
  return {
    xs: xsNotes.map((bars) => bars.map((notes) => notes.map((n) => (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2 / total))),
  }
}
