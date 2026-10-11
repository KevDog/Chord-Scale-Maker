import { describe, expect, it } from 'vitest'
import { popoverPlace } from '~/utils/sheetChordEdit'

const VIEW = { width: 1200, height: 800 }
const PANEL = { width: 352, minHeight: 320 }

describe('popoverPlace', () => {
  it('opens under the chord, lined up with its left edge, as tall as the room below', () => {
    expect(popoverPlace({ left: 300, top: 100, bottom: 120 }, VIEW, PANEL)).toEqual({ left: 300, top: 128, maxHeight: 656 })
  })

  it('keeps inside the window at either side', () => {
    expect(popoverPlace({ left: 1100, top: 100, bottom: 120 }, VIEW, PANEL).left).toBe(1200 - 352 - 16)
    expect(popoverPlace({ left: 4, top: 100, bottom: 120 }, VIEW, PANEL).left).toBe(16)
    expect(popoverPlace({ left: 100, top: 100, bottom: 120 }, { width: 300, height: 800 }, PANEL).left).toBe(16)
  })

  it('opens above a chord near the bottom of the window, when there’s more room there', () => {
    expect(popoverPlace({ left: 300, top: 600, bottom: 620 }, VIEW, PANEL)).toEqual({ left: 300, bottom: 208, maxHeight: 576 })
  })
})
