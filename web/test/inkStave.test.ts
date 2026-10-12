import { describe, expect, it } from 'vitest'
import * as vf from 'vexflow/bravura'
import { inkStave } from '~/utils/vexflow'

describe('inkStave', () => {
  it('draws ledger lines in the ink color, so they show in dark mode', () => {
    const style = inkStave(vf, 0, 40, 400).getDefaultLedgerLineStyle()
    expect(style.strokeStyle).toBe('currentColor')
  })

  it('places the stave where asked', () => {
    const stave = inkStave(vf, 10, 40, 400)
    expect([stave.getX(), stave.getY(), stave.getWidth()]).toEqual([10, 40, 400])
  })
})
