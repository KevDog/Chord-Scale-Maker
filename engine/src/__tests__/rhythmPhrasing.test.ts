import { describe, expect, it } from 'vitest'
import {
  ANTICIPATE_STEPS,
  RHYTHM_STARTS,
  RHYTHM_START_LABELS,
  anticipateLabel,
  isAnticipate,
  isRhythmStart,
  phrasingCaption,
  pickupNotes,
} from '../rhythm/phrasing'

describe('rhythm start (§3.1)', () => {
  it('lists the starts with labels and pick-up counts', () => {
    expect(RHYTHM_STARTS).toEqual(['beat', 'pickup-1', 'pickup-2', 'pickup-3'])
    expect(RHYTHM_STARTS.map((s) => RHYTHM_START_LABELS[s])).toEqual(['On the beat', '1-note pick-up', '2-note pick-up', '3-note pick-up'])
    expect(RHYTHM_STARTS.map(pickupNotes)).toEqual([0, 1, 2, 3])
  })
  it('guards the type', () => {
    expect(['pickup-4', 'Beat', 3, null].some(isRhythmStart)).toBe(false)
    expect(RHYTHM_STARTS.every(isRhythmStart)).toBe(true)
  })
})

describe('anticipate (§2)', () => {
  it('has 13 steps', () => {
    expect(ANTICIPATE_STEPS).toEqual([3, 2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3])
    expect([1.5, -3, 0].every(isAnticipate)).toBe(true)
    expect([0.25, 3.5, -3.5, NaN, '1', null].some(isAnticipate)).toBe(false)
  })
  it('labels', () => {
    expect([0, 0.5, 1, 1.5, -0.5, -2].map(anticipateLabel)).toEqual(['On time', 'Anticipate ½ beat', 'Anticipate 1 beat', 'Anticipate 1½ beats', 'Resolve late ½ beat', 'Resolve late 2 beats'])
  })
  it('labels a value off the steps as it is, not as the nearest half (#505)', () => {
    expect([0.3, -1.25].map(anticipateLabel)).toEqual(['Anticipate 0.3 beat', 'Resolve late 1.25 beats'])
  })
})

describe('phrasingCaption', () => {
  it('appends only what is set', () => {
    expect(phrasingCaption('Rhythm: X', 'beat', 0)).toBe('Rhythm: X')
    expect(phrasingCaption('Rhythm: X', 'pickup-2', 1.5)).toBe('Rhythm: X · 2-note pick-ups · anticipate 1½ beats')
    expect(phrasingCaption('Rhythm: X', 'pickup-3', -1)).toBe('Rhythm: X · 3-note pick-ups · resolve late 1 beat')
    expect(phrasingCaption('Rhythm: X', 'pickup-1', -0.5)).toBe('Rhythm: X · 1-note pick-ups · resolve late ½ beat')
    expect(phrasingCaption('Rhythm: X', 'beat', 2)).toBe('Rhythm: X · anticipate 2 beats')
  })
})
