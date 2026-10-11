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
