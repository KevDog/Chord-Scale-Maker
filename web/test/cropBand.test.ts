import { describe, expect, it } from 'vitest'
import { GUIDE_MIN_BOTTOM, GUIDE_MIN_TOP } from '~/utils/guideToneDrawing'
import { cropBand, MIN_BOTTOM, MIN_TOP } from '~/utils/vexflow'

// staff lines are at y 80-120 in drawing units; note heads are 5 units per step
describe('cropBand', () => {
  it('shows the standard band when the notes stay near the staff', () => {
    expect(cropBand([])).toEqual({ top: MIN_TOP, bottom: MIN_BOTTOM })
    expect(cropBand([85, 100, 115])).toEqual({ top: MIN_TOP, bottom: MIN_BOTTOM })
  })

  it('grows upward for notes above the staff, leaving room for a flat', () => {
    expect(cropBand([25, 100])).toEqual({ top: 1, bottom: MIN_BOTTOM }) // three ledger lines up (bass clef from B)
  })

  it('grows downward for notes below the staff, leaving room for a sharp', () => {
    expect(cropBand([95, 135])).toEqual({ top: MIN_TOP, bottom: 153 })
  })

  it('takes a tighter minimum band for guide tone staves', () => {
    expect(cropBand([95, 100], GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM)).toEqual({ top: GUIDE_MIN_TOP, bottom: GUIDE_MIN_BOTTOM })
    expect(cropBand([30], GUIDE_MIN_TOP, GUIDE_MIN_BOTTOM).top).toBe(6) // ledger lines still widen it
  })
})
