import { describe, expect, it } from 'vitest'
import { panelShift } from '~/utils/notePlacement'

describe('panelShift', () => {
  it('leaves a panel that fits', () => expect(panelShift(100, 288, 1000)).toBe(0))
  it('moves a panel off the right edge left, to the gutter', () => expect(panelShift(350, 358, 390)).toBe(16 - 350))
  it('moves a panel near the right of a desktop sheet left', () => expect(panelShift(900, 288, 1000)).toBe(1000 - 288 - 16 - 900))
  it('moves a panel from beyond the left gutter right', () => expect(panelShift(4, 288, 1000)).toBe(12))
  it('keeps the left gutter when the panel is wider than the room', () => expect(panelShift(50, 500, 390)).toBe(-34))
})
