import { barView, type ChartDoc, type GridPos, moveInGrid, posOfLine } from '@chord-scale-maker/engine'

/** a chord tapped on the Changes sheet (below md): the chart line it was written on, and where it's drawn */
export type SheetChordEdit = Readonly<{ line: number; section: string; bar: string }>

/**
 * what the sheet is editing: a chord by its doc line and where it is drawn (a written-out repeat draws a line twice),
 * or a new chord slot after a bar's chords (the bar as written)
 */
export type SheetEdit = Readonly<{ kind: 'chord'; line: number; at: SheetPlace } | { kind: 'slot'; section: string; bar: string }>
export type SheetPlace = Readonly<{ section: string; bar: string }>
/** a chord the editor wants focus on (its button), by line and where it is drawn; n makes each request its own */
export type SheetFocus = Readonly<{ line: number; at: SheetPlace; n: number }>

/** how the chord field closed, and where it wants to go: a bar (Tab), a chord (← →), a new chord slot, or nowhere */
export type SheetDone = 'stay' | 'next' | 'prev' | 'nextChord' | 'prevChord' | 'add' | 'cancel'

/**
 * where a key takes the chord field, over line and section ends; null off either end (the field then closes). By
 * `bar` (Tab, ⇧Tab): the first chord of the next (previous) bar that has one of its own. By `chord` (→, ←): the next
 * (previous) chord, in this bar or the next (previous) bar with one. Held bars have nothing to edit and are skipped.
 */
export function nextChordLine(doc: ChartDoc, line: number, dir: 'next' | 'prev', step: 'bar' | 'chord' = 'bar'): number | null {
  const view = barView(doc)
  const from = posOfLine(view, line)
  if (!from) return null
  const chordAt = (p: GridPos): number | undefined =>
    view.sections.find((s) => s.name === p.section)?.bars.find((b) => b.bar === p.bar)?.chords[step === 'bar' ? 0 : p.chord]?.line
  let p: GridPos | null = from
  for (;;) {
    p = moveInGrid(view, p, dir)
    if (!p) return null
    if (step === 'bar' && p.section === from.section && p.bar === from.bar) continue // another chord of the same bar
    const found = chordAt(p)
    if (found !== undefined) return found
  }
}
