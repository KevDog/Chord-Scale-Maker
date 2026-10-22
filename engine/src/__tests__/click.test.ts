import { describe, expect, it } from 'vitest'
import { clampTempo, clickBar, countIn } from '../click'

describe('clickBar', () => {
  it('accents 1 and clicks the other beats', () => {
    expect(clickBar({ beats: 4, feel: 'swing', subdivision: false, hat: false })).toEqual([
      { at: 0, kind: 'accent' },
      { at: 1, kind: 'beat' },
      { at: 2, kind: 'beat' },
      { at: 3, kind: 'beat' },
    ])
  })
  it('adds the swing skip note two thirds through each beat', () => {
    const subs = clickBar({ beats: 4, feel: 'swing', subdivision: true, hat: false })
      .filter((e) => e.kind === 'sub')
      .map((e) => e.at)
    expect(subs).toEqual([2 / 3, 1 + 2 / 3, 2 + 2 / 3, 3 + 2 / 3])
  })
  it('adds straight eighths halfway through each beat', () => {
    const subs = clickBar({ beats: 3, feel: 'straight', subdivision: true, hat: false })
      .filter((e) => e.kind === 'sub')
      .map((e) => e.at)
    expect(subs).toEqual([0.5, 1.5, 2.5])
  })
  it('puts the hat on 2 and 4 in 4/4 only, beside the beat', () => {
    const four = clickBar({ beats: 4, feel: 'swing', subdivision: false, hat: true })
    expect(four.filter((e) => e.kind === 'hat').map((e) => e.at)).toEqual([1, 3])
    expect(four.filter((e) => e.at === 1).map((e) => e.kind).sort()).toEqual(['beat', 'hat'])
    expect(clickBar({ beats: 3, feel: 'swing', subdivision: false, hat: true }).some((e) => e.kind === 'hat')).toBe(false)
  })
  it('is sorted by time', () => {
    const bar = clickBar({ beats: 4, feel: 'swing', subdivision: true, hat: true })
    expect(bar.map((e) => e.at)).toEqual([...bar.map((e) => e.at)].sort((a, b) => a - b))
  })
  it('plays 5 and 6 beats a bar', () => {
    expect(clickBar({ beats: 5, feel: 'straight', subdivision: false, hat: false })).toHaveLength(5)
    expect(clickBar({ beats: 6, feel: 'straight', subdivision: false, hat: true })).toHaveLength(6)
  })
})

describe('countIn', () => {
  it('counts each beat of the bars before the first', () => {
    expect(countIn(4, 0)).toEqual([])
    expect(countIn(3, 1)).toEqual([
      { at: 0, kind: 'count' },
      { at: 1, kind: 'count' },
      { at: 2, kind: 'count' },
    ])
    expect(countIn(5, 2)).toHaveLength(10)
    expect(countIn(4, 2).at(-1)).toEqual({ at: 7, kind: 'count' })
  })
})

describe('clampTempo', () => {
  it('keeps 40–300, whole', () => {
    expect([clampTempo(39.6), clampTempo(132.4), clampTempo(301), clampTempo(Number.NaN)]).toEqual([40, 132, 300, 120])
  })
})
