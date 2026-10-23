import { describe, expect, it } from 'vitest'
import { CLICK_PATTERNS, clampSwing, clampTempo, clickBar, countIn, defaultFeel, defaultPattern, defaultTempo, patternFits, scheduleClicks, tapTempo } from '../click'

describe('clampSwing', () => {
  it('keeps the swing dial in 50–75%, to the hundredth; not a number: two thirds', () => {
    expect([0.4, 0.5, 0.6, 0.6666, 0.75, 0.9].map(clampSwing)).toEqual([0.5, 0.5, 0.6, 0.67, 0.75, 0.75])
    expect(clampSwing(Number.NaN)).toBeCloseTo(2 / 3)
  })
})

describe('clickBar', () => {
  it('puts the swing skip note where the dial says', () => {
    expect(clickBar({ beats: 2, feel: 'swing', hat: false, swing: 0.75 }).filter((e) => e.kind === 'sub').map((e) => e.at)).toEqual([0.75, 1.75])
    expect(clickBar({ beats: 2, feel: 'straight', hat: false, swing: 0.75 }).filter((e) => e.kind === 'sub').map((e) => e.at)).toEqual([0.5, 1.5]) // Straight: halfway, whatever the dial
  })

  it('in quarters, accents 1 and clicks the other beats', () => {
    expect(clickBar({ beats: 4, feel: 'quarters', hat: false })).toEqual([
      { at: 0, kind: 'accent' },
      { at: 1, kind: 'beat' },
      { at: 2, kind: 'beat' },
      { at: 3, kind: 'beat' },
    ])
  })
  it('adds the swing skip note two thirds through each beat', () => {
    const subs = clickBar({ beats: 4, feel: 'swing', hat: false })
      .filter((e) => e.kind === 'sub')
      .map((e) => e.at)
    expect(subs).toEqual([2 / 3, 1 + 2 / 3, 2 + 2 / 3, 3 + 2 / 3])
  })
  it('adds straight eighths halfway through each beat', () => {
    const subs = clickBar({ beats: 3, feel: 'straight', hat: false })
      .filter((e) => e.kind === 'sub')
      .map((e) => e.at)
    expect(subs).toEqual([0.5, 1.5, 2.5])
  })
  it('puts the hat on 2 and 4 in 4/4 only, beside the beat', () => {
    const four = clickBar({ beats: 4, feel: 'quarters', hat: true })
    expect(four.filter((e) => e.kind === 'hat').map((e) => e.at)).toEqual([1, 3])
    expect(four.filter((e) => e.at === 1).map((e) => e.kind).sort()).toEqual(['beat', 'hat'])
    expect(clickBar({ beats: 3, feel: 'quarters', hat: true }).some((e) => e.kind === 'hat')).toBe(false)
  })
  it('is sorted by time', () => {
    const bar = clickBar({ beats: 4, feel: 'swing', hat: true })
    expect(bar.map((e) => e.at)).toEqual([...bar.map((e) => e.at)].sort((a, b) => a - b))
  })
  it('plays 5 and 6 beats a bar', () => {
    expect(clickBar({ beats: 5, feel: 'quarters', hat: false })).toHaveLength(5)
    expect(clickBar({ beats: 6, feel: 'quarters', hat: true })).toHaveLength(6)
  })
})

describe('clickBar with a pattern (Bergonzi 31)', () => {
  const sounding = (pattern: Parameters<typeof clickBar>[0]['pattern'], feel: 'quarters' | 'swing' | 'straight' = 'quarters', beats: 3 | 4 = 4) =>
    clickBar({ beats, feel, hat: false, pattern }).filter((e) => e.kind !== 'tick')
  it('clicks 2 and 4 alone', () => {
    expect(sounding('2-4')).toEqual([
      { at: 1, kind: 'beat' },
      { at: 3, kind: 'beat' },
    ])
  })
  it('accents 1 in 1 and 3', () => {
    expect(sounding('1-3')).toEqual([
      { at: 0, kind: 'accent' },
      { at: 2, kind: 'beat' },
    ])
  })
  it('clicks 3 only, or 4 only', () => {
    expect(sounding('3')).toEqual([{ at: 2, kind: 'beat' }])
    expect(sounding('4')).toEqual([{ at: 3, kind: 'beat' }])
  })
  it('clicks the and of 2 and 4 where the swing dial puts its 8th', () => {
    expect(clickBar({ beats: 4, feel: 'swing', hat: false, pattern: 'and-2-4', swing: 0.6 }).filter((e) => e.kind === 'beat').map((e) => e.at)).toEqual([1.6, 3.6])
  })
  it('clicks the and of 2 and 4 where the feel puts its 8th', () => {
    expect(sounding('and-2-4', 'swing').map((e) => e.at)).toEqual([1 + 2 / 3, 3 + 2 / 3])
    expect(sounding('and-2-4', 'straight').map((e) => e.at)).toEqual([1.5, 3.5])
    expect(sounding('and-2-4', 'quarters').map((e) => e.at)).toEqual([1.5, 3.5])
  })
  it('drops the feel’s notes between the beats', () => {
    expect(sounding('2-4', 'swing').some((e) => e.kind === 'sub')).toBe(false)
  })
  it('keeps the hat', () => {
    expect(clickBar({ beats: 4, feel: 'quarters', hat: true, pattern: '4' }).filter((e) => e.kind === 'hat').map((e) => e.at)).toEqual([1, 3])
  })
  it('marks every beat with a silent tick, for the lights', () => {
    expect(clickBar({ beats: 4, feel: 'quarters', hat: false, pattern: '3' }).filter((e) => e.kind === 'tick').map((e) => e.at)).toEqual([0, 1, 2, 3])
    expect(clickBar({ beats: 4, feel: 'quarters', hat: false, pattern: 'all' }).some((e) => e.kind === 'tick')).toBe(false)
  })
  it('plays every beat where the bar is too short for the pattern', () => {
    expect(sounding('2-4', 'quarters', 3)).toEqual(sounding('all', 'quarters', 3))
    expect(sounding('1-3', 'quarters', 3).map((e) => e.at)).toEqual([0, 2])
  })
  it('is sorted by time', () => {
    const bar = clickBar({ beats: 4, feel: 'swing', hat: true, pattern: 'and-2-4' })
    expect(bar.map((e) => e.at)).toEqual([...bar.map((e) => e.at)].sort((a, b) => a - b))
  })
})

describe('patternFits', () => {
  it('needs a 4th beat for 2 and 4, 4 only and the and of 2 and 4', () => {
    expect(CLICK_PATTERNS.filter((p) => patternFits(p, 3))).toEqual(['all', '1-3', '3'])
    expect(CLICK_PATTERNS.every((p) => patternFits(p, 4))).toBe(true)
  })
})

describe('defaultPattern', () => {
  it('follows the Feel: every beat in 4, the hat’s 2 and 4 in 2, 4 alone in 1', () => {
    expect([defaultPattern(4), defaultPattern(2), defaultPattern(1)]).toEqual(['all', '2-4', '4'])
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

describe('defaultTempo', () => {
  it.each([
    ['Ballad', 66],
    ['Medium ballad', 84],
    ['Slow Blues', 72],
    ['Medium up', 160],
    ['Med Up Swing', 160],
    ['Up', 220],
    ['Fast', 220],
    ['Jazz waltz', 150],
    ['Latin', 132],
    ['Medium', 132],
    ['Medium Blues', 132],
    ['Even 8ths', 132],
    ['Medium straight eighths', 132],
    ['Mixed', 120],
    ['', 120],
  ])('%s → %i', (style, tempo) => expect(defaultTempo(style)).toBe(tempo))
})

describe('defaultFeel', () => {
  it.each([
    ['Medium swing', 'swing'],
    ['Ballad', 'swing'],
    ['Shuffle', 'swing'],
    ['Latin', 'straight'],
    ['Up samba', 'straight'],
    ['Medium up Latin', 'straight'],
    ['Medium straight eighths', 'straight'],
    ['Even 8ths', 'straight'],
    ['Medium funk ballad', 'straight'],
    ['', 'swing'],
  ])('%s → %s', (style, feel) => expect(defaultFeel(style)).toBe(feel))
})

describe('tapTempo', () => {
  it('needs two taps', () => expect(tapTempo([1000])).toBeNull())
  it('averages the last four gaps', () => {
    expect(tapTempo([0, 500, 1000, 1500, 2000])).toBe(120)
    expect(tapTempo([0, 10_000, 10_500, 11_000])).toBe(120) // a gap over 2 s starts a new sequence
    expect(tapTempo([0, 100_000])).toBeNull()
  })
  it('rounds and clamps', () => {
    expect(tapTempo([0, 455])).toBe(132)
    expect(tapTempo([0, 100])).toBe(300)
  })
})

describe('scheduleClicks', () => {
  const plan = { options: { beats: 4, feel: 'quarters', hat: false }, tempo: 120, countIn: 0 } as const
  it('books the clicks inside the window, in order', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 10, bar: 0 }, 10, 11.1)
    expect(events).toEqual([
      { time: 10, kind: 'accent', beat: 0 },
      { time: 10.5, kind: 'beat', beat: 1 },
      { time: 11, kind: 'beat', beat: 2 },
    ])
    expect(state).toEqual({ barStart: 10, bar: 0 })
  })
  it('rolls into the next bar and keeps counting bars', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 10, bar: 0 }, 11.6, 12.2)
    expect(events).toEqual([{ time: 12, kind: 'accent', beat: 0 }])
    expect(state).toEqual({ barStart: 12, bar: 1 })
  })
  it('skips clicks already past, without catching up', () => {
    const { events, state } = scheduleClicks(plan, { barStart: 0, bar: 0 }, 60, 60.1)
    expect(events).toEqual([{ time: 60, kind: 'accent', beat: 0 }])
    expect(state.barStart).toBe(60)
    expect(state.bar).toBe(30)
  })
  it('plays the count-in first', () => {
    const { events } = scheduleClicks({ ...plan, countIn: 1 }, { barStart: 0, bar: 0 }, 0, 2.1)
    expect(events.map((e) => e.kind)).toEqual(['count', 'count', 'count', 'count', 'accent'])
    expect(events.map((e) => e.beat)).toEqual([0, 1, 2, 3, 0])
  })
  it('a tempo change applies from the next click', () => {
    const slow = scheduleClicks({ ...plan, tempo: 60 }, { barStart: 10, bar: 0 }, 10.6, 11.1)
    expect(slow.events).toEqual([{ time: 11, kind: 'beat', beat: 1 }])
  })
})
