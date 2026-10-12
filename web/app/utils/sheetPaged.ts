import type { InjectionKey, Ref } from 'vue'

/** focus mode: the sheet as separate pages fitted to the window (EditorView provides it; SheetPages reads it) */
export const SHEET_PAGED: InjectionKey<Readonly<Ref<boolean>>> = Symbol('sheetPaged')

/** the zoom of the page a sheet's popovers sit in (1 off focus mode): they undo it, to read at full size */
export const PAGE_ZOOM: InjectionKey<Readonly<Ref<number>>> = Symbol('pageZoom')

/** a page on screen: a letter page at 96 dpi, so its staves lay out as printed (taller if its music needs it) */
export const PAGE_WIDTH = 816
export const PAGE_HEIGHT = 1056

/** the zoom that fits the tallest page (and the width) into the room there is, never above 1.5 */
export const pageZoom = (room: Readonly<{ width: number; height: number }>, tallest: number): number =>
  tallest > 0 ? Math.min(1.5, room.width / PAGE_WIDTH, room.height / tallest) : 1
