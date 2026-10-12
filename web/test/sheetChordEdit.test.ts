import { describe, expect, it } from 'vitest'
import { parseChart } from '@chord-scale-maker/engine'
import { nextChordLine } from '~/utils/sheetChordEdit'

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

  describe('chord by chord (← →)', () => {
    it('moves to the next chord of the bar, then into the next bar’s first', () => {
      expect(nextChordLine(doc, 2, 'next', 'chord')).toBe(3)
      expect(nextChordLine(doc, 3, 'next', 'chord')).toBe(4)
    })

    it('moves back to the previous chord of the bar, or the previous bar’s last', () => {
      expect(nextChordLine(doc, 3, 'prev', 'chord')).toBe(2)
      expect(nextChordLine(doc, 4, 'prev', 'chord')).toBe(3)
    })

    it('skips a held bar, crosses into the next section, and is null off either end', () => {
      expect(nextChordLine(doc, 4, 'next', 'chord')).toBe(6)
      expect(nextChordLine(doc, 6, 'prev', 'chord')).toBe(4)
      expect(nextChordLine(doc, 6, 'next', 'chord')).toBe(7)
      expect(nextChordLine(doc, 7, 'next', 'chord')).toBeNull()
      expect(nextChordLine(doc, 2, 'prev', 'chord')).toBeNull()
    })
  })
})
