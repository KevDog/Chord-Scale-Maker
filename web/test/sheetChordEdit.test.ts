import { describe, expect, it } from 'vitest'
import { parseChart } from '@chord-scale-maker/engine'
import { nextChordLine, popoverPlace } from '~/utils/sheetChordEdit'

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

describe('nextChordLine', () => {
  // lines: 0 title, 1 key, 2 A1 Dm7, 3 A1 G7 (2nd chord), 4 A2 CMaj7, 6 A4 Am7 (bar 3 held), 7 B1 Fm7, 8 @copy
  const doc = parseChart('title: T\nkey: C\nA | 1 | Dm7\nA | 1 | G7\nA | 2 | CMaj7\n\nA | 4 | Am7\nB | 1 | Fm7\n@copy A A2 8\n').value

  it('moves to the next bar’s first chord, past the other chords in this bar', () => {
    expect(nextChordLine(doc, 2, 'next')).toBe(4)
    expect(nextChordLine(doc, 3, 'next')).toBe(4)
  })

  it('skips a held bar, and crosses into the next section', () => {
    expect(nextChordLine(doc, 4, 'next')).toBe(6)
    expect(nextChordLine(doc, 6, 'next')).toBe(7)
  })

  it('moves back to the previous bar’s first chord', () => {
    expect(nextChordLine(doc, 4, 'prev')).toBe(2)
    expect(nextChordLine(doc, 7, 'prev')).toBe(6)
  })

  it('is null off either end, and for a line that isn’t a chord', () => {
    expect(nextChordLine(doc, 7, 'next')).toBeNull()
    expect(nextChordLine(doc, 2, 'prev')).toBeNull()
    expect(nextChordLine(doc, 0, 'next')).toBeNull()
  })
})
