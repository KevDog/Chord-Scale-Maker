import { barView, type ChartDoc, type GridPos, posOfLine } from '@chord-scale-maker/engine'

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
 * `from` is the chord's line, or the place of a chord just taken out (its line is gone, or holds the chord after it):
 * then → takes the chord now in its place.
 */
export function nextChordLine(doc: ChartDoc, from: number | GridPos, dir: 'next' | 'prev', step: 'bar' | 'chord' = 'bar'): number | null {
  const view = barView(doc)
  const sections = view.sections.filter((s) => !s.copy)
  const here = typeof from === 'number' ? posOfLine(view, from) : from
  if (!here) return null
  const chords = sections.flatMap((s, i) => s.bars.flatMap((b) => b.chords.map((c, k) => ({ at: [i, b.bar, k], line: c.line }))))
  const n = step === 'bar' ? 2 : 3
  const order = (a: readonly number[], b: readonly number[]): number => a.slice(0, n).reduce((d, x, i) => d || x - (b[i] ?? 0), 0)
  const at = [sections.findIndex((s) => s.name === here.section), here.bar, here.chord]
  if (dir === 'next') return chords.find((c) => order(c.at, at) > 0 || (step === 'chord' && typeof from !== 'number' && order(c.at, at) === 0))?.line ?? null
  const before = chords.findLast((c) => order(c.at, at) < 0)
  return before ? (chords.find((c) => order(c.at, before.at) === 0)?.line ?? null) : null
}
