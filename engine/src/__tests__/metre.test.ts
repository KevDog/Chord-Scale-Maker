import { describe, expect, it } from 'vitest'
import { barAt, barLength, barStart, clockOf } from '../metre'

describe('a clock: bars of their own lengths, one after another (#235)', () => {
  const clock = clockOf([4, 2, 3], 4) // then 4/4 on

  it('finds the bar a beat falls in', () => {
    expect([0, 3, 4, 5, 6, 8, 9, 12, 13].map((b) => barAt(clock, b))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4])
  })

  it('gives each bar’s first beat and its length, past the listed bars too', () => {
    expect([0, 1, 2, 3, 4].map((b) => barStart(clock, b))).toEqual([0, 4, 6, 9, 13])
    expect([0, 1, 2, 3, 4].map((b) => barLength(clock, b))).toEqual([4, 2, 3, 4, 4])
  })

  it('is a steady metre as a number', () => {
    expect([barAt(3, 7), barStart(3, 2), barLength(3, 5)]).toEqual([2, 6, 3])
  })
})
