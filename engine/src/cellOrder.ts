import type { Cell, Degree } from './cells'

/**
 * A cell's Order (#376): how the Changes sheet's Cells line re-reads every cell before playing it. Pure; no DOM.
 */
export type CellOrder = 'as-written' | 'reversed' | 'rotated' | 'swapped'

export const CELL_ORDERS: readonly CellOrder[] = ['as-written', 'reversed', 'rotated', 'swapped']

export const CELL_ORDER_LABELS: Readonly<Record<CellOrder, string>> = {
  'as-written': 'As written',
  reversed: 'Reversed',
  rotated: 'Rotated',
  swapped: 'Pairs swapped',
}

export const isCellOrder = (x: unknown): x is CellOrder => typeof x === 'string' && (CELL_ORDERS as readonly string[]).includes(x)

/** a contour with moves left open: null is decided per slot, the nearer way (fillContour) */
export type PartialContour = readonly ('u' | 'd' | null)[]

const flip = (m: 'u' | 'd'): 'u' | 'd' => (m === 'u' ? 'd' : 'u')

/**
 * a cell in an Order: reversed is d c b a with the moves reversed and flipped; rotated is b c d a, keeping the original
 * moves 2 and 3 and leaving the last open; pairs swapped is b a d c with every move open
 */
export function orderCell(cell: Cell, order: CellOrder): Readonly<{ degrees: readonly Degree[]; contour: PartialContour }> {
  const [a, b, c, d] = cell.degrees
  const [, m2, m3] = cell.contour
  if (cell.degrees.length !== 4 || a === undefined || b === undefined || c === undefined || d === undefined || m2 === undefined || m3 === undefined) {
    throw new Error(`a cell has four degrees: ${cell.degrees.length}`)
  }
  switch (order) {
    case 'reversed':
      return { degrees: [d, c, b, a], contour: [...cell.contour].reverse().map(flip) }
    case 'rotated':
      return { degrees: [b, c, d, a], contour: [m2, m3, null] }
    case 'swapped':
      return { degrees: [b, a, d, c], contour: [null, null, null] }
    case 'as-written':
      return { degrees: cell.degrees, contour: cell.contour }
    default: {
      const unreachable: never = order
      throw new Error(`unknown order: ${String(unreachable)}`)
    }
  }
}
