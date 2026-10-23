import { describe, expect, it } from 'vitest'
import { cardBars, layRhythm, rhythmNotes } from '../rhythm'
import type { RhythmId } from '../rhythm'

describe('cardBars (§1)', () => {
  const card = (id: string, beats = 4) => cardBars(id as RhythmId, beats)!
  it.each([
    ['unit:8:3:accents', 4, 3, false],
    ['unit:8:5:accents', 4, 4, true],
    ['unit:8:4:accents', 4, 1, false],
    ['card:downbeats', 4, 1, false],
    ['run:8:3:0', 4, 1, false],
    ['unit:8:3:accents', 3, 1, false],
  ])('%s at %i beats', (id, beats, bars, cut) => {
    expect(card(id, beats)).toMatchObject({ beats, cut })
    expect(card(id, beats).bars.length).toBe(bars)
  })

  it('is null for off', () => {
    expect(cardBars('off', 4)).toBeNull()
  })

  it('lays the rhythm over the card bars', () => {
    expect(cardBars('unit:8:3:accents', 4)!.bars).toEqual(rhythmNotes(layRhythm('unit:8:3:accents', [4, 4, 4])!))
  })
})
