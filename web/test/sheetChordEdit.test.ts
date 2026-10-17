import { describe, expect, it } from 'vitest'
import { parseChart } from '@chord-scale-maker/engine'
import { nextChordLine } from '~/utils/sheetChordEdit'

describe('nextChordLine', () => {
  // lines: 0 title, 4 A1 Dm7, 5 A1 G7 (2nd chord), 6 A2 CMaj7, 7 A4 Am7 (bar 3 held), 11 B1 Fm7, 14 copy:
  const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n1 | G7\n2 | CMaj7\n4 | Am7\n\nsection: B\nbars: 8\n1 | Fm7\n\nsection: A2\ncopy: A\n').value

  it('moves to the next bar’s first chord, past the other chords in this bar', () => {
    expect(nextChordLine(doc, 4, 'next')).toBe(6)
    expect(nextChordLine(doc, 5, 'next')).toBe(6)
  })

  it('skips a held bar, and crosses into the next section', () => {
    expect(nextChordLine(doc, 6, 'next')).toBe(7)
    expect(nextChordLine(doc, 7, 'next')).toBe(11)
  })

  it('moves back to the previous bar’s first chord', () => {
    expect(nextChordLine(doc, 6, 'prev')).toBe(4)
    expect(nextChordLine(doc, 11, 'prev')).toBe(7)
  })

  it('is null off either end, and for a line that isn’t a chord', () => {
    expect(nextChordLine(doc, 11, 'next')).toBeNull()
    expect(nextChordLine(doc, 4, 'prev')).toBeNull()
    expect(nextChordLine(doc, 0, 'next')).toBeNull()
  })

  describe('chord by chord (← →)', () => {
    it('moves to the next chord of the bar, then into the next bar’s first', () => {
      expect(nextChordLine(doc, 4, 'next', 'chord')).toBe(5)
      expect(nextChordLine(doc, 5, 'next', 'chord')).toBe(6)
    })

    it('moves back to the previous chord of the bar, or the previous bar’s last', () => {
      expect(nextChordLine(doc, 5, 'prev', 'chord')).toBe(4)
      expect(nextChordLine(doc, 6, 'prev', 'chord')).toBe(5)
    })

    it('skips a held bar, crosses into the next section, and is null off either end', () => {
      expect(nextChordLine(doc, 6, 'next', 'chord')).toBe(7)
      expect(nextChordLine(doc, 7, 'prev', 'chord')).toBe(6)
      expect(nextChordLine(doc, 7, 'next', 'chord')).toBe(11)
      expect(nextChordLine(doc, 11, 'next', 'chord')).toBeNull()
      expect(nextChordLine(doc, 4, 'prev', 'chord')).toBeNull()
    })
  })

  describe('from the place of a chord taken out (its line is gone, or holds the chord after it)', () => {
    // A1 held: Dm7 taken out of a one-chord bar 2 (lines: 4 A1 Cmaj7, 5 A3 Em7, 9 B1 Fm7)
    const held = parseChart('title: T\nkey: C\n\nsection: A\n1 | CMaj7\n3 | Em7\n\nsection: B\nbars: 4\n1 | Fm7\n').value
    const gone = { section: 'A', bar: 2, chord: 0 }

    it('Tab and ⇧Tab move to the next and previous bars’ first chords, skipping none', () => {
      expect(nextChordLine(held, gone, 'next')).toBe(5)
      expect(nextChordLine(held, gone, 'prev')).toBe(4)
    })

    it('→ takes the chord now in its place, ← the one before it', () => {
      // Dm7 G7 in A2, Dm7 taken out: G7 (line 6) is now at chord 0
      const two = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | CMaj7\n2 | G7\n3 | Em7\n').value
      expect(nextChordLine(two, gone, 'next', 'chord')).toBe(6)
      expect(nextChordLine(two, gone, 'prev', 'chord')).toBe(5)
      expect(nextChordLine(two, gone, 'next')).toBe(7)
      expect(nextChordLine(held, gone, 'next', 'chord')).toBe(5)
    })

    it('works after the section’s last bar is taken out', () => {
      const end = { section: 'A', bar: 4, chord: 0 }
      expect(nextChordLine(held, end, 'next')).toBe(9)
      expect(nextChordLine(held, end, 'prev')).toBe(5)
      expect(nextChordLine(held, end, 'next', 'chord')).toBe(9)
    })
  })
})
