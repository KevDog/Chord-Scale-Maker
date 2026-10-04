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

// Drawing units. The SVG scales to its container width; in print that is about 650px,
// which makes each staff about 58px tall so 12 fit on a letter page with their labels.
export const STAFF_WIDTH = 960
const STAFF_HEIGHT = 120
const STAVE_Y = 10 // staff lines at y 50-90
// visible band: notes in either mode stay within about two ledger lines of the staff
const VIEW_TOP = 30
const VIEW_HEIGHT = 85

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
  if (notes.length === 0) return
  const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
  new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
  voice.draw(ctx, stave)

  // scale with the container instead of a fixed pixel size
  const svg = el.querySelector('svg')
  svg?.setAttribute('viewBox', `0 ${VIEW_TOP} ${STAFF_WIDTH} ${VIEW_HEIGHT}`)
  svg?.setAttribute('width', '100%')
  svg?.removeAttribute('height')
  svg?.style.removeProperty('width') // VexFlow's resize() sets a fixed pixel size
  svg?.style.removeProperty('height')
  svg?.setAttribute('role', 'img')
  svg?.setAttribute('aria-label', staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
}
