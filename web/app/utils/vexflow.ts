import { type StaffModel, toVexKey } from '~~/engine'

export type VexFlowModule = typeof import('vexflow/bravura')
type Context = ReturnType<InstanceType<VexFlowModule['Renderer']>['getContext']>

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
export const STAVE_Y = 40 // staff lines at y 80-120, with room for ledger lines on both sides
export const TIME_SPACE = 40 // extra lead width on the first system, for the time signature
export const CLEF_SPACE = 70 // lead width for a clef alone (signatureLead builds on it)
export const BAR_UNITS = 300 // drawing width per bar on the Changes sheet, so phones' 2-bar lines draw as large as 4-bar ones
export const MIN_TOP = 55 // always show the clef and a ledger line's space above and below the staff
export const MIN_BOTTOM = 140
// room around a note head for its accidental: a flat rises about two spaces, a sharp hangs 1.5
const ABOVE_HEAD = 24
const BELOW_HEAD = 18

/** vertical band to show, from note-head y positions (drawing units); never smaller than the staff band */
export function cropBand(headYs: readonly number[], minTop = MIN_TOP, minBottom = MIN_BOTTOM): Readonly<{ top: number; bottom: number }> {
  if (headYs.length === 0) return { top: minTop, bottom: minBottom }
  return {
    top: Math.min(minTop, Math.min(...headYs) - ABOVE_HEAD),
    bottom: Math.max(minBottom, Math.max(...headYs) + BELOW_HEAD),
  }
}

/** an SVG drawing context in el (replacing what was there), width units wide; colors follow CSS `color` */
export function svgContext(vf: VexFlowModule, el: HTMLElement, width: number): Context {
  el.replaceChildren()
  const renderer = new vf.Renderer(el as HTMLDivElement, vf.Renderer.Backends.SVG)
  renderer.resize(width, STAFF_HEIGHT)
  return renderer.getContext().setFillStyle('currentColor').setStrokeStyle('currentColor')
}

/**
 * crop el's SVG to the band that was drawn (SVG getBBox measures glyphs by font ascent, not ink), let it scale with
 * its container instead of VexFlow's fixed pixel size, and name it for screen readers
 */
export function fitSvg(el: HTMLElement, band: Readonly<{ top: number; bottom: number }>, width: number, label: string): void {
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${band.top} ${width} ${band.bottom - band.top}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width')
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', label)
}

/** a note head's centre as a fraction of the drawing width, for HTML labels placed over or under it */
export const headCentre = (n: { getNoteHeadBeginX(): number; getNoteHeadEndX(): number }, width: number): number =>
  (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2 / width

/**
 * draw one staff of whole notes into el, replacing what was there; colors follow CSS `color`.
 * Returns each note head's centre as a fraction of the width, for labels placed under it.
 */
export function drawStaff(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, clef: 'treble' | 'bass'): number[] {
  const ctx = svgContext(vf, el, STAFF_WIDTH)

  const stave = new vf.Stave(0, STAVE_Y, STAFF_WIDTH - 1)
  if (staff.showClefAndKey) stave.addClef(clef) // with key signatures: each part's first staff only
  if (staff.showClefAndKey && staff.keySig) stave.addKeySignature(staff.keySig)
  stave.setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()

  const notes = staff.notes.map((n, i) => {
    const note = new vf.StaveNote({ keys: [toVexKey(n)], duration: 'w', clef })
    const acc = staff.accidentals[i] // without a key signature: explicit on every altered note
    if (acc) note.addModifier(new vf.Accidental(acc), 0)
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
  }

  // practice: VexFlow keeps an element's classes off its drawn group, so tag the groups after drawing (main.css styles them)
  notes.forEach((n, i) => {
    const pick = staff.selected?.[i]
    if (pick !== undefined) n.getSVGElement()?.classList.add(pick ? 'vf-selected' : 'vf-dimmed')
  })
  const names = staff.notes.map((n) => toVexKey(n).replace('/', ''))
  const picked = staff.selected ? names.filter((_, i) => staff.selected?.[i]) : null
  const label = names.join(' ') + (picked ? `; practice: ${picked.length ? picked.join(' ') : 'none'}` : '')
  fitSvg(el, cropBand(notes.flatMap((n) => n.getYs())), STAFF_WIDTH, label)
  return notes.map((n) => headCentre(n, STAFF_WIDTH))
}

type Stave = InstanceType<VexFlowModule['Stave']>

/** how much later notes start on a stave with these modifiers than on a bare one (drawing units), from a probe stave */
function startWidth(vf: VexFlowModule, add: (stave: Stave) => void): number {
  const probe = new vf.Stave(0, 0, 400)
  add(probe)
  return probe.getNoteStartX() - new vf.Stave(0, 0, 400).getNoteStartX()
}

/**
 * the lead width of a system's first bar with its clef, key signature and (if given) time signature: what they measure,
 * plus the padding CLEF_SPACE gives a clef alone, so bars line up as they do without signatures
 */
export function signatureLead(vf: VexFlowModule, clef: 'treble' | 'bass', keySig: string | null, time?: string): number {
  const all = startWidth(vf, (s) => {
    s.addClef(clef)
    if (keySig) s.addKeySignature(keySig)
    if (time) s.addTimeSignature(time)
  })
  return CLEF_SPACE + all - startWidth(vf, (s) => s.addClef(clef))
}
