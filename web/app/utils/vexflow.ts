import { type ArpeggioStaffModel, type Pitched, type RunNote, type StaffModel, type StaffRun, toVexKey } from '@chord-scale-maker/engine'
import { groupsOf, INK, inkTips, marked, REST_KEY, rhythmAria, rhythmTies, staveRoom, tupletsOf, voiceOf } from './changesDrawing'

export type VexFlowModule = typeof import('vexflow/bravura')
type Context = ReturnType<InstanceType<VexFlowModule['Renderer']>['getContext']>
type Stave = InstanceType<VexFlowModule['Stave']>

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

/** a stave whose ledger lines follow CSS `color` too (VexFlow draws them #444, unseen in dark mode) */
export function inkStave(vf: VexFlowModule, x: number, y: number, width: number): InstanceType<VexFlowModule['Stave']> {
  const stave = new vf.Stave(x, y, width)
  stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 2 }) // VexFlow's width
  return stave
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
 * width: its drawing units, which the SVG scales to its container (fewer draw it larger).
 * Returns each note head's centre as a fraction of the width, for labels placed under it.
 */
export function drawStaff(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, clef: 'treble' | 'bass', width: number = STAFF_WIDTH, rhythmCaption: string | null = null): number[] {
  if (staff.run) return drawScaleRun(vf, el, staff, staff.run, clef, width, rhythmAria(rhythmCaption))
  const ctx = svgContext(vf, el, width)

  const stave = staffStave(vf, staff, clef, width)
  stave.setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()

  const notes = staff.notes.map((n, i) => {
    const note = new vf.StaveNote({ keys: [toVexKey(n)], duration: 'w', clef })
    const acc = staff.accidentals[i] // the bar rule, against the key signature if any (accidentalsInBar)
    if (acc) note.addModifier(new vf.Accidental(acc), 0)
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length * 4, beatValue: 4 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    new vf.Formatter().joinVoices([voice]).format([voice], width - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
  }

  // practice: VexFlow keeps an element's classes off its drawn group, so tag the groups after drawing (main.css styles them)
  notes.forEach((n, i) => {
    const classes = practiceClasses(staff, i)
    if (classes.length) n.getSVGElement()?.classList.add(...classes)
  })
  const names = staff.notes.map(ariaName)
  const label = staffLabel(names, '', staff.selected ? names.filter((_, i) => staff.selected?.[i]) : null, names.filter((_, i) => staff.outside?.[i]))
  fitSvg(el, cropBand(notes.flatMap((n) => n.getYs())), width, label)
  if (staff.timeSig) el.querySelector('svg')?.setAttribute('data-time-sig', staff.timeSig)
  return notes.map((n) => headCentre(n, width))
}

/** a pitch's name in an aria-label: "eb4" */
const ariaName = (n: Pitched): string => toVexKey(n).replace('/', '')

/** a Scales staff's aria-label: its notes, the rhythm a run is poured into (rhythmAria; '' none), then the practice part (none: Practice off) and the pentatonic's added notes */
const staffLabel = (names: readonly string[], rhythm: string, picked: readonly string[] | null, added: readonly string[]): string =>
  names.join(' ') + rhythm + (picked ? `; practice: ${picked.length ? picked.join(' ') : 'none'}` : '') + (added.length ? `; added from the pentatonic: ${added.join(' ')}` : '')

/** practice classes (main.css): the staff note's pick, its second accent for a hexatonic's group B or a pentatonic's added note (#308) */
function practiceClasses(staff: StaffModel, i: number): readonly string[] {
  const pick = staff.selected?.[i]
  if (pick === undefined) return []
  return pick ? ['vf-selected', ...(staff.second?.[i] || staff.outside?.[i] ? ['vf-second'] : [])] : ['vf-dimmed']
}

const RUN_MARGIN = 4 // the crop's room past a stem tip, a tuplet's number or an accent

/** a run's first-bar signatures and its end: the clef and key signature where the staff shows them, the time signature, the final barline */
type RunSigns = Readonly<{ clef: boolean; keySig: string | null; timeSig: string; last: boolean }>
/** what a run staff draws: the pitches its notes index and their accidentals, its signs, its aria-label and practice classes */
type RunStaff = Readonly<{
  pitches: readonly Pitched[]
  accidentals: readonly (string | null)[]
  signs: RunSigns
  label: (names: readonly string[], attacks: readonly RunNote[]) => string
  classesOf?: (note: number) => readonly string[]
}>

/**
 * a staff drawn as a run (rhythm-scales-arpeggios spec §7), for both sheets: its bars (drawRun) into el, cropped to
 * its ink (stems, accents, tuplet numbers), the time signature on the svg as data-time-sig; classesOf: a pitch's
 * practice classes (none by default); label: the aria-label from the run's names in order ("rest" for a rest) and their attacks.
 * Returns each pitch's head centre (at its attack) as a fraction of the width, for the intervals under it.
 */
function drawRunStaff(vf: VexFlowModule, el: HTMLElement, run: StaffRun, clef: 'treble' | 'bass', width: number, { pitches, accidentals, signs, label, classesOf = () => [] }: RunStaff): number[] {
  const ctx = svgContext(vf, el, width)
  const ticks = drawRun(vf, ctx, run, pitches, accidentals, clef, 0, width - 1, signs)
  const marks = run.bars.flatMap((b) => b.notes)
  marks.forEach((m, i) => {
    const classes = m.note === null ? [] : classesOf(m.note)
    if (classes.length) ticks[i]?.getSVGElement()?.classList.add(...classes)
  })
  const attacks = marks.filter((m) => !m.mark.tiedIn)
  const names = attacks.map((m) => {
    const p = m.note === null ? undefined : pitches[m.note]
    return p ? ariaName(p) : 'rest'
  })
  const pitched = ticks.filter((t) => !t.isRest())
  const heads = pitched.flatMap((n) => n.getYs())
  const stems = pitched.filter((n) => n.hasStem()).map((n) => n.getStemExtents().topY)
  const accented = new Set(ticks.filter((_, i) => marks[i]?.mark.accent))
  const band = cropBand(heads)
  const tuplets = [...new Set(ticks.flatMap((t) => t.getTuplet() ?? []))]
  const tops = inkTips(pitched, accented, tuplets)
  fitSvg(el, { top: Math.min(band.top, ...tops.map((y) => y - RUN_MARGIN)), bottom: Math.max(band.bottom, ...stems.map((y) => y + RUN_MARGIN)) }, width, label(names, attacks))
  el.querySelector('svg')?.setAttribute('data-time-sig', signs.timeSig)
  // each pitch's x: at its attack
  return pitches.map((_, k) => {
    const t = ticks[marks.findIndex((m) => m.note === k && !m.mark.tiedIn)]
    return t ? headCentre(t, width) : 0
  })
}

/**
 * a Scales staff with Notes per bar (spec §7): its run (drawRunStaff); practice classes by the staff note each run note
 * repeats (D15); its aria-label the run's notes, "rest" for a rest, the rhythm it is poured into (rhythmAria: '' for an
 * even run), then the practice part
 */
function drawScaleRun(vf: VexFlowModule, el: HTMLElement, staff: StaffModel, run: NonNullable<StaffModel['run']>, clef: 'treble' | 'bass', width: number, rhythm: string): number[] {
  const signs = { clef: staff.showClefAndKey, keySig: staff.keySig, timeSig: staff.timeSig ?? `${run.beats}/4`, last: staff.last }
  const sourced = (attacks: readonly RunNote[], pick: readonly boolean[] | null | undefined): string[] =>
    attacks.flatMap((m) => {
      const p = m.note === null ? undefined : run.notes[m.note]
      return p && m.note !== null && pick?.[run.source[m.note] ?? -1] ? [ariaName(p)] : []
    })
  const label = (names: readonly string[], attacks: readonly RunNote[]): string =>
    staffLabel(names, rhythm, staff.selected ? sourced(attacks, staff.selected) : null, sourced(attacks, staff.outside))
  return drawRunStaff(vf, el, run, clef, width, { pitches: run.notes, accidentals: run.accidentals, signs, label, classesOf: (k) => practiceClasses(staff, run.source[k] ?? -1) })
}

type StaveNote = InstanceType<VexFlowModule['StaveNote']>

/**
 * a run drawn bar by bar (rhythm-scales-arpeggios spec §7) into ctx, from x0 across width: one stave a bar, the bars
 * sharing the width by their note counts after the first bar's clef, key and time signatures; each note from its
 * mark (value, dot, accent; a rest at the clef's rest line), its pitch from `pitches` with its accidental at its attack
 * only (a tied-in piece draws none), stems by autoStem; one tuplet a bar with a bar-long tuplet (numNotes in the time of
 * notesOccupied, rests included), else the rhythm's tuplets at their ratios (Phase 4 spec §2); beams by mark.beam; ties as one chain across the bars.
 * Ends with the final barline when last, else a double one. Returns the run's notes in order, rests included.
 */
export function drawRun(
  vf: VexFlowModule,
  ctx: Context,
  run: StaffRun,
  pitches: readonly Pitched[],
  accidentals: readonly (string | null)[],
  clef: 'treble' | 'bass',
  x0: number,
  width: number,
  opts: RunSigns,
): StaveNote[] {
  const lead = (stave: Stave): number => stave.getNoteStartX() - stave.getX()
  const first = inkStave(vf, x0, STAVE_Y, width)
  if (opts.clef) first.addClef(clef)
  if (opts.clef && opts.keySig) first.addKeySignature(opts.keySig)
  first.addTimeSignature(opts.timeSig)
  const extra = lead(first) - lead(inkStave(vf, 0, STAVE_Y, width))
  const weights = run.bars.map((b) => b.notes.length + 1) // a bar's notes and its barline's room
  const total = weights.reduce((a, w) => a + w, 0)
  let x = x0
  const laid = run.bars.map((bar, b) => {
    const w = ((width - extra) * (weights[b] ?? 0)) / total + (b === 0 ? extra : 0)
    const stave = b === 0 ? first : inkStave(vf, x, STAVE_Y, w)
    if (b === 0) stave.setWidth(w)
    stave.setEndBarType(b < run.bars.length - 1 ? vf.BarlineType.SINGLE : opts.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
    const rhythm = bar.notes.map((n) => n.mark)
    const ticks = bar.notes.map((n) => {
      const pitch = n.note === null ? undefined : pitches[n.note]
      if (!pitch) return marked(vf, new vf.StaveNote({ keys: [REST_KEY[clef]], duration: `${n.mark.value}r`, clef }), n.mark.value, false)
      const note = marked(vf, new vf.StaveNote({ keys: [toVexKey(pitch)], duration: n.mark.value, clef, autoStem: true }), n.mark.value, n.mark.accent)
      note.setStemStyle(INK) // stems carry their own default (black), not the context's currentColor
      const acc = n.mark.tiedIn || n.note === null ? null : accidentals[n.note]
      if (acc) note.addModifier(new vf.Accidental(acc), 0)
      return note
    })
    ticks.forEach((t) => t.setStave(stave))
    // tuplets before the voice: they set their notes' ticks; a bare number where more notes crowd the time (7 in 4), the ratio where fewer stretch over it (2:5)
    const tuplet = bar.tuplet
    const tuplets = tuplet
      ? groupsOf(ticks, (i) => rhythm[i]?.tuplet ?? null).map((g) => new vf.Tuplet(g, { numNotes: tuplet.notes, notesOccupied: tuplet.of, location: 1, ratioed: tuplet.notes < tuplet.of }))
      : tupletsOf(vf, ticks, (i) => rhythm[i])
    const voice = voiceOf(vf, run.beats, ticks)
    const beams = groupsOf(ticks, (i) => rhythm[i]?.beam ?? null).filter((g) => g.length > 1).map((g) => new vf.Beam(g, true))
    new vf.Formatter().joinVoices([voice]).format([voice], staveRoom(stave, x, w))
    beams.forEach((beam) => beam.postFormat())
    x += w
    return { stave, rhythm, ticks, voice, beams, tuplets }
  })
  laid.forEach((l) => l.stave.setContext(ctx).draw())
  laid.forEach((l) => l.voice.draw(ctx, l.stave))
  laid.forEach((l) => l.beams.forEach((beam) => beam.setContext(ctx).draw()))
  laid.forEach((l) => l.tuplets.forEach((t) => t.setContext(ctx).draw()))
  rhythmTies(vf, ctx, laid)
  return laid.flatMap((l) => l.ticks)
}

/** a Scales staff's stave: the clef and key signature on every line's first staff (a Patterns continuation has neither), then its time signature (with a rhythm card) */
function staffStave(vf: VexFlowModule, staff: StaffModel, clef: 'treble' | 'bass', width: number = STAFF_WIDTH): InstanceType<VexFlowModule['Stave']> {
  const stave = inkStave(vf, 0, STAVE_Y, width - 1)
  if (staff.showClefAndKey) stave.addClef(clef)
  if (staff.showClefAndKey && staff.keySig) stave.addKeySignature(staff.keySig)
  if (staff.timeSig) stave.addTimeSignature(staff.timeSig)
  return stave
}

/** the width the staff's notes take (drawing units), from where they start to its right edge: the rhythm card's (D14) */
export const staffNotesWidth = (vf: VexFlowModule, staff: StaffModel, clef: 'treble' | 'bass'): number => STAFF_WIDTH - 1 - staffStave(vf, staff, clef).getNoteStartX()

/**
 * draw one Arpeggios line: eighths, each group beamed on its own; with a run (spec §4, §7), poured into its rhythm as the
 * Scales run is (drawRunStaff; no Saindon bracket, P2 D19), its aria-label naming the rhythm (rhythmCaption, rhythmAria).
 * Returns each head's centre as a fraction of the width.
 */
export function drawArpeggioStaff(vf: VexFlowModule, el: HTMLElement, staff: ArpeggioStaffModel, clef: 'treble' | 'bass', rhythmCaption: string | null = null): number[] {
  if (staff.run) {
    const signs = { clef: staff.showClefAndKey, keySig: staff.keySig, timeSig: staff.timeSig ?? `${staff.run.beats}/4`, last: staff.last }
    return drawRunStaff(vf, el, staff.run, clef, STAFF_WIDTH, { pitches: staff.notes, accidentals: staff.accidentals, signs, label: (names) => names.join(' ') + rhythmAria(rhythmCaption) })
  }
  const ctx = svgContext(vf, el, STAFF_WIDTH)
  const stave = inkStave(vf, 0, STAVE_Y, STAFF_WIDTH - 1)
  if (staff.showClefAndKey) stave.addClef(clef)
  if (staff.showClefAndKey && staff.keySig) stave.addKeySignature(staff.keySig)
  stave.setEndBarType(staff.last ? vf.BarlineType.END : vf.BarlineType.DOUBLE)
  stave.setContext(ctx).draw()
  // Triad pairs' Block (#436): each group one chord, unbeamed
  const chords = staff.block
    ? staff.groups.reduce<{ at: number; idx: number[][] }>((acc, g) => ({ at: acc.at + g, idx: [...acc.idx, Array.from({ length: g }, (_, k) => acc.at + k)] }), { at: 0, idx: [] }).idx
    : staff.notes.map((_, i) => [i])
  const notes = chords.map((idx) => {
    const note = new vf.StaveNote({ keys: idx.map((i) => toVexKey(staff.notes[i]!)), duration: staff.block ? 'q' : '8', clef, autoStem: true })
    idx.forEach((i, k) => {
      const acc = staff.accidentals[i]
      if (acc) note.addModifier(new vf.Accidental(acc), k)
    })
    return note
  })
  if (notes.length > 0) {
    const voice = new vf.Voice({ numBeats: notes.length, beatValue: staff.block ? 4 : 8 }).setMode(vf.Voice.Mode.SOFT).addTickables(notes)
    // beams are made before the notes draw, so the notes leave their flags to them; autoStem gives a group one stem direction
    const beams = staff.block ? [] : staff.groups.reduce<{ at: number; beams: InstanceType<VexFlowModule['Beam']>[] }>(
      (acc, g) => ({ at: acc.at + g, beams: g > 1 ? [...acc.beams, new vf.Beam(notes.slice(acc.at, acc.at + g), true)] : acc.beams }),
      { at: 0, beams: [] },
    ).beams
    new vf.Formatter().joinVoices([voice]).format([voice], STAFF_WIDTH - stave.getNoteStartX() - 24)
    voice.draw(ctx, stave)
    beams.forEach((b) => b.setContext(ctx).draw())
  }
  fitSvg(el, cropBand(notes.flatMap((n) => [...n.getYs(), n.getStemExtents().topY])), STAFF_WIDTH, staff.notes.map((n) => toVexKey(n).replace('/', '')).join(' '))
  return notes.map((n) => headCentre(n, STAFF_WIDTH))
}

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
