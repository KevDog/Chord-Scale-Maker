import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '../instruments'
import { partFor, rangeOf } from '../part'
import { fitRange, MIN_SPAN, rangeChoices } from '../playerRange'

describe('the player’s range (#359)', () => {
  it('keeps every preset as it is', () => {
    for (const [name, { range }] of Object.entries(INSTRUMENTS)) expect(fitRange(name as keyof typeof INSTRUMENTS, range), name).toEqual(range)
  })

  it('stays inside the full range and the staff’s cap', () => {
    expect(fitRange('horn', { lo: 42, hi: 70 })).toMatchObject({ lo: 52, hi: 76 }) // horn's F♯2 is below the treble cap, E3
    expect(fitRange('flute', { lo: 70, hi: 96 }, 'hi')).toMatchObject({ lo: 65, hi: 89 }) // C7 is above F6
    expect(fitRange('trumpet', { lo: 40, hi: 99 })).toMatchObject({ lo: 54, hi: 84 }) // F♯3–C6
  })

  it('spans two octaves at least: moving one end pushes the other along', () => {
    expect(MIN_SPAN).toBe(24)
    expect(fitRange('trumpet', { lo: 58, hi: 79 }, 'lo')).toMatchObject({ lo: 58, hi: 82 })
    expect(fitRange('trumpet', { lo: 55, hi: 78 }, 'hi')).toMatchObject({ lo: 54, hi: 78 })
    expect(fitRange('trumpet', { lo: 62, hi: 79 }, 'lo')).toMatchObject({ lo: 60, hi: 84 }) // as far up as C6 allows
    expect(fitRange('trumpet', { lo: 55, hi: 76 }, 'hi')).toMatchObject({ lo: 54, hi: 78 }) // as far down as F♯3 allows
  })

  it('lets tuba and bass, whose presets are under two octaves, span no less than their preset', () => {
    expect(fitRange('bass', { lo: 44, hi: 60 }, 'lo')).toMatchObject({ lo: 44, hi: 64 }) // E2–C4 spans 20
    expect(fitRange('tuba', { lo: 36, hi: 50 }, 'hi')).toMatchObject({ lo: 35, hi: 57 }) // C2–B♭3 spans 22; the bass cap is B1
  })

  it('keeps the preset’s centre, which every range the player can set holds', () => {
    expect(fitRange('piano', { lo: 74, hi: 88 }, 'lo')).toEqual({ lo: 64, hi: 88, centre: 70 })
    for (const [name, { range }] of Object.entries(INSTRUMENTS)) {
      const { lows, highs } = rangeChoices(name as keyof typeof INSTRUMENTS)
      expect(lows.at(-1), name).toBeLessThanOrEqual(range.centre)
      expect(highs[0], name).toBeGreaterThanOrEqual(range.centre)
    }
  })

  it('offers each end the notes it can take', () => {
    expect(rangeChoices('trumpet')).toEqual({ lows: [54, 55, 56, 57, 58, 59, 60], highs: [78, 79, 80, 81, 82, 83, 84] })
    expect(rangeChoices('bass').lows.at(-1)).toBe(45) // the bass cap F4, less 20
  })

  it('puts the range in the part, or the preset’s', () => {
    expect(rangeOf(partFor('trumpet'))).toEqual(INSTRUMENTS.trumpet.range)
    expect(rangeOf(partFor('trumpet', { lo: 58, hi: 82, centre: 70 }))).toEqual({ lo: 58, hi: 82, centre: 70 })
  })
})
