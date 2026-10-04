import { accText, type StaffModel, toVexKey } from '~~/engine'

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
export const STAFF_WIDTH = 1200
const STAFF_HEIGHT = 200
const STAVE_Y = 40 // staff lines at y 80-120, with room for ledger lines on both sides
const MIN_TOP = 55 // always show the clef and a ledger line's space above and below the staff
const MIN_BOTTOM = 140
// room around a note head for its accidental: a flat rises about two spaces, a sharp hangs 1.5
const ABOVE_HEAD = 24
const BELOW_HEAD = 18

/** draw one staff of whole notes into el, replacing what was there; colors follow CSS `color` */
export function drawStaff(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, clef: 'treble' | 'bass'): void {
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
  const heads = notes.flatMap((n) => n.getYs())
  const top = Math.min(MIN_TOP, Math.min(...heads) - ABOVE_HEAD)
  const bottom = Math.max(MIN_BOTTOM, Math.max(...heads) + BELOW_HEAD)
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${top} ${STAFF_WIDTH} ${bottom - top}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width') // VexFlow's resize() sets a fixed pixel size
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
}
