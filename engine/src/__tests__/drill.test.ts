import { describe, expect, it } from 'vitest'
import type { ClickPlan } from '../click'
import { chorusOf, chorusShift, rampTempo } from '../drill'
import { scheduleVoice } from '../voice'

const plan = (extra: Partial<ClickPlan> = {}): ClickPlan => ({
  options: { beats: 4, feel: 'quarters', hat: false },
  tempo: 60,
  countIn: 1,
  form: { order: [0, 1], beats: [4, 4] },
  ...extra,
})

describe('practice tools (#509)', () => {
  it('counts the choruses: the count-in and the first time through are chorus 0', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => chorusOf(plan(), n))).toEqual([0, 0, 0, 1, 1, 2])
    expect(chorusOf(plan({ form: undefined }), 7)).toBe(0)
  })

  it('all twelve keys: up a 4th a chorus, or a half step, kept within a tritone of the written key', () => {
    expect([0, 1, 2, 3, 11, 12].map((c) => chorusShift('fourths', c))).toEqual([0, 5, -2, 3, -5, 0])
    expect([0, 1, 5, 6, 7, 11, 12].map((c) => chorusShift('half', c))).toEqual([0, 1, 5, -6, -5, -1, 0])
    expect(chorusShift('off', 3)).toBe(0)
  })

  it('a pitched track books each chorus in its key', () => {
    const notes = [{ bar: 0, at: 0, beats: 1, midi: 60 }]
    const booked = scheduleVoice(notes, 2, plan({ keys: 'fourths' }), { barStart: 0, bar: 0 }, 0, 20)
    expect(booked.map((n) => [n.time, n.midi])).toEqual([
      [4, 60],
      [12, 65],
    ])
  })

  it('the tempo ramp: a few beats a minute faster each chorus, within the click’s range', () => {
    expect([0, 1, 2].map((c) => rampTempo(120, 4, c))).toEqual([120, 124, 128])
    expect(rampTempo(298, 8, 3)).toBe(300)
    expect(rampTempo(120, 0, 5)).toBe(120)
  })
})
