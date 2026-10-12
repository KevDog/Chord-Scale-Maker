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

  describe('from the place of a chord taken out (its line is gone, or holds the chord after it)', () => {
    // A1 held: Dm7 taken out of a one-chord bar 2 (lines: 2 A1 Cmaj7, 3 A3 Em7, 4 B1 Fm7)
    const held = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 3 | Em7\nB | 1 | Fm7\n').value
    const gone = { section: 'A', bar: 2, chord: 0 }

    it('Tab and ⇧Tab move to the next and previous bars’ first chords, skipping none', () => {
      expect(nextChordLine(held, gone, 'next')).toBe(3)
      expect(nextChordLine(held, gone, 'prev')).toBe(2)
    })

    it('→ takes the chord now in its place, ← the one before it', () => {
      // Dm7 G7 in A2, Dm7 taken out: G7 (line 3) is now at chord 0
      const two = parseChart('title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | G7\nA | 3 | Em7\n').value
      expect(nextChordLine(two, gone, 'next', 'chord')).toBe(3)
      expect(nextChordLine(two, gone, 'prev', 'chord')).toBe(2)
      expect(nextChordLine(two, gone, 'next')).toBe(4)
      expect(nextChordLine(held, gone, 'next', 'chord')).toBe(3)
    })

    it('works after the section’s last bar is taken out', () => {
      const end = { section: 'A', bar: 4, chord: 0 }
      expect(nextChordLine(held, end, 'next')).toBe(4)
      expect(nextChordLine(held, end, 'prev')).toBe(3)
      expect(nextChordLine(held, end, 'next', 'chord')).toBe(4)
    })
  })
})
