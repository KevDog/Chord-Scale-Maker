import { describe, expect, it } from 'vitest'
import { CELL_ORDER_LABELS, CELL_ORDERS, isCellOrder, orderCell } from '../cellOrder'
import { type Cell, fillContour } from '../cells'
import { parseRoot } from '../pitch'

const cell = (degrees: string, contour: string): Cell => ({ degrees: degrees.split(' ').map(Number), contour: [...contour] as Cell['contour'] })
const tones = (s: string) => s.split(' ').map(parseRoot)

describe('orderCell', () => {
  const c = cell('3 5 1 7', 'uud')
  it('as written returns the cell as is', () => {
    expect(orderCell(c, 'as-written')).toEqual({ degrees: [3, 5, 1, 7], contour: ['u', 'u', 'd'] })
  })
  it('reversed reverses the degrees and the moves, each flipped', () => {
    expect(orderCell(c, 'reversed')).toEqual({ degrees: [7, 1, 5, 3], contour: ['u', 'd', 'd'] })
  })
  it('rotated keeps moves 2 and 3 and leaves the last to the slot', () => {
    expect(orderCell(c, 'rotated')).toEqual({ degrees: [5, 1, 7, 3], contour: ['u', 'd', null] })
  })
  it('pairs swapped leaves every move to the slot', () => {
    expect(orderCell(c, 'swapped')).toEqual({ degrees: [5, 3, 7, 1], contour: [null, null, null] })
  })
  it('knows its orders and labels', () => {
    expect(CELL_ORDERS).toEqual(['as-written', 'reversed', 'rotated', 'swapped'])
    expect(CELL_ORDERS.map((o) => CELL_ORDER_LABELS[o])).toEqual(['As written', 'Reversed', 'Rotated', 'Pairs swapped'])
    expect(isCellOrder('rotated')).toBe(true)
    expect(isCellOrder('sideways')).toBe(false)
    expect(isCellOrder(1)).toBe(false)
  })
})

describe('fillContour', () => {
  it('takes each open move the nearer way', () => {
    expect(fillContour(tones('B G A F'), [null, null, null]).join('')).toBe('dud')
  })
  it('sends a tritone up', () => {
    expect(fillContour(tones('C F# C F#'), [null, null, null]).join('')).toBe('uuu')
  })
  it('keeps a given move', () => {
    expect(fillContour(tones('G A B D'), ['d', null, null]).join('')).toBe('duu')
  })
})
