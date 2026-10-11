import { barView, type ChartDoc, type GridPos, moveInGrid, posOfLine } from '@chord-scale-maker/engine'

/** a chord tapped on the Changes sheet: the chart line it was written on, where it's drawn, and its box on screen */
export type SheetChordEdit = Readonly<{ line: number; section: string; bar: string; anchor: Readonly<{ left: number; top: number; bottom: number }> }>

export type PopoverPlace = Readonly<{ left: number; top?: number; bottom?: number; maxHeight: number }>

const MARGIN = 16
const GAP = 8

/**
 * where the chord editor's popover goes (from md up): under the chord, at its left edge, kept inside the window; above
 * it when there's less than the panel's minimum height below and more room above
 */
export function popoverPlace(
  anchor: SheetChordEdit['anchor'],
  view: Readonly<{ width: number; height: number }>,
  panel: Readonly<{ width: number; minHeight: number }>,
): PopoverPlace {
  const left = Math.max(MARGIN, Math.min(anchor.left, view.width - panel.width - MARGIN))
  const below = view.height - anchor.bottom - GAP - MARGIN
  const above = anchor.top - GAP - MARGIN
  return below >= panel.minHeight || below >= above
    ? { left, top: anchor.bottom + GAP, maxHeight: below }
    : { left, bottom: view.height - anchor.top + GAP, maxHeight: above }
}

/**
 * where Tab (⇧Tab) takes the chord field: the first chord of the next (previous) bar that has one of its own, over
 * line and section ends; null off either end (the field then closes). Held bars have nothing to edit and are skipped.
 */
export function nextChordLine(doc: ChartDoc, line: number, dir: 'next' | 'prev'): number | null {
  const view = barView(doc)
  const from = posOfLine(view, line)
  if (!from) return null
  const chordAt = (p: GridPos): number | undefined =>
    view.sections.find((s) => s.name === p.section)?.bars.find((b) => b.bar === p.bar)?.chords[0]?.line
  let p: GridPos | null = from
  for (;;) {
    p = moveInGrid(view, p, dir)
    if (!p) return null
    if (p.section === from.section && p.bar === from.bar) continue // another chord of the same bar
    const found = chordAt(p)
    if (found !== undefined) return found
  }
}
