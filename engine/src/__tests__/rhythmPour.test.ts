import { describe, expect, it } from 'vitest'
import { lineRhythm, type LineRhythm, type LineSpan } from '../rhythm/pour'

const S = (at: number, sounds = true): LineSpan => ({ at, sounds })
const vals = (r: LineRhythm, b: number) => r.bars[b]!.map(n => `${n.value}${n.rest ? 'r' : ''}`)
const who = (r: LineRhythm, b: number) => r.owners[b]!.map(o => (o ? (o.below ? `${o.chord}<${o.below}` : o.chord) : null))

describe('lineRhythm (rhythm-on-lines spec §2–3)', () => {
  it('is null for Off or no bars', () => {
    expect(lineRhythm('off', [4], [], [S(0)], 'beat', 0)).toBeNull()
    expect(lineRhythm('card:downbeats', [], [], [], 'beat', 0)).toBeNull()
  })

  it('pours a 1-note pick-up into a sounding chord from the chord before', () => {
    const a = lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'pickup-1', 0)!
    expect(vals(a, 0)).toEqual(['q', 'q', 'q', '8', '8'])
    expect(who(a, 0)).toEqual([0, 0, 0, 0, 0])
    expect(who(a, 1)).toEqual([1, 1, 1, 1])
  })

  it('plays a 3-note pick-up after a rest as scale notes below', () => {
    const b = lineRhythm('card:downbeats', [4, 4], [], [S(0, false), S(4)], 'pickup-3', 0)!
    expect(vals(b, 0)).toEqual(['q', 'q', '8', '8', '8', '8'])
    expect(who(b, 0)).toEqual([null, null, null, '1<3', '1<2', '1<1'])
  })

  it('moves the boundary to anticipate or resolve late', () => {
    expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'beat', 1)!, 0)).toEqual([0, 0, 0, 1])
    expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4)], 'beat', -1)!, 1)).toEqual([0, 1, 1, 1])
  })

  it('gives each triplet attack to the span holding its start, with a boundary between pulses', () => {
    expect(who(lineRhythm('unit:8t:3:accents', [4, 4], [], [S(0), S(4)], 'beat', 0.5)!, 0)).toEqual([...Array(11).fill(0), 1])
  })

  it('strikes the first chord\'s target but gives it no pick-up', () => {
    expect(vals(lineRhythm('card:upbeats', [4], [], [S(0)], 'pickup-1', 0)!, 0)).toEqual(['8', '8', '8r', '8', '8r', '8', '8r', '8'])
    expect(vals(lineRhythm('card:upbeats', [4], [], [S(0)], 'beat', 0)!, 0)).toEqual(['8r', '8', '8r', '8', '8r', '8', '8r', '8'])
  })

  it('forces no pick-up into a 2nd ending, and keeps its boundary', () => {
    const g = lineRhythm('card:downbeats', [4, 4, 4], [2], [S(0), S(4), S(8)], 'pickup-1', 1)!
    expect(vals(g, 0)).toEqual(['q', 'q', '8', '8', 'q'])
    expect(who(g, 0)).toEqual([0, 0, 0, 0, 1])
    expect(vals(g, 1)).toEqual(['q', 'q', 'q', 'q'])
    expect(who(g, 1)).toEqual([1, 1, 1, 1])
    expect(who(g, 2)).toEqual([2, 2, 2, 2])
  })

  it('clamps a Timing longer than a chord, leaving an empty span', () => {
    expect(who(lineRhythm('card:downbeats', [4, 4], [], [S(0), S(4), S(6)], 'beat', -3)!, 1)).toEqual([0, 0, 0, 1])
  })

  it('gives a pulse two chords\' pick-ups both claim to the earlier chord (#505)', () => {
    // after N.C., 3-note pick-ups into chords at beats 4 and 4½: pulses 6 and 7 are both's, and stay the first's
    const r = lineRhythm('card:upbeats', [4, 4], [], [S(0, false), S(4), S(4.5)], 'pickup-3', 0)!
    expect(who(r, 0).slice(-3)).toEqual(['1<3', '1<2', '1<1'])
  })

  it('forces no target for a chord whose span holds no pulse, nor pick-ups for it (#505)', () => {
    // 4.1 to 4.4: its target, pulse 9, is past its end, so pulse 8 is the next chord's pick-up
    const r = lineRhythm('card:upbeats', [4, 4], [], [S(0, false), S(4.1), S(4.4)], 'pickup-1', 0)!
    expect(who(r, 1).slice(0, 2)).toEqual(['2<1', 2])
  })

  it('gives a tied piece its attack\'s owner', () => {
    expect(who(lineRhythm('unit:8:3:tied', [4], [], [S(0), S(2)], 'beat', 0)!, 0)).toEqual([0, 0, 0, 1])
  })
})

describe('lineRhythm by steps (Phase 4 spec §3 "Lines", D14)', () => {
  const pattern = (r: LineRhythm, b: number) => r.laid.bars[b]!.map(e => (e.rest ? '.' : 'x').repeat(e.rest ? e.length : 1) + (e.rest ? '' : '_'.repeat(e.length - 1))).join('')

  it('forces no pick-up back across a step boundary, as across a break', () => {
    const chords = [S(0), S(4), S(8)]
    // the bare rhythm forces the 2 pick-ups into bar 3's chord at the end of bar 2
    expect(pattern(lineRhythm('unit:8:4:rests', [4, 4, 4], [], chords, 'pickup-2', 0)!, 1)).toBe('x...x.xx')
    const steps = [
      { from: 0, id: 'unit:8:4:rests' },
      { from: 2, id: 'unit:8:3:rests' },
    ] as const
    const r = lineRhythm(steps, [4, 4, 4], [], chords, 'pickup-2', 0)!
    expect(pattern(r, 1)).toBe('x...x...')
    expect(pattern(r, 2)).toBe('x..x..x.')
  })

  it('reads each bar at its step\'s pulse (Gears)', () => {
    const r = lineRhythm(
      [
        { from: 0, id: 'unit:8:4:accents' },
        { from: 1, id: 'unit:16:4:accents' },
      ],
      [4, 4],
      [],
      [S(0), S(4)],
      'beat',
      0,
    )!
    expect(who(r, 0)).toEqual(Array(8).fill(0))
    expect(who(r, 1)).toEqual(Array(16).fill(1))
  })

  it('forces targets and pick-ups at each step\'s own pulses, 8ths then triplets, never across the boundary', () => {
    const chords = [S(0), S(4), S(8), S(10)]
    const steps = [
      { from: 0, id: 'unit:8:3:rests' },
      { from: 2, id: 'unit:8t:4:rests' },
    ] as const
    const r = lineRhythm(steps, [4, 4, 4], [], chords, 'pickup-2', 0)!
    // 8ths: chord 1's target is stream pulse 8 (bar 2's first), its pick-ups 6 and 7 (bar 1's last two), from chord 0
    expect(pattern(r, 0)).toBe('x..x..xx')
    expect(who(r, 0)).toEqual([0, null, null, 0, null, 0, 0])
    expect(r.laid.bars[1]![0]).toMatchObject({ rest: false })
    // chord 2 starts the triplet step: no pick-ups back in bar 2, whose stream keeps its 8ths in 3
    expect(pattern(r, 1)).toBe('xx..x..x') // the bare rhythm would force pulse 14 as chord 2's 2nd pick-up
    expect(pattern(lineRhythm('unit:8:3:rests', [4, 4, 4], [], chords, 'pickup-2', 0)!, 1)).toBe('xx..x.xx')
    // triplets: chord 3 at beat 2 of bar 3 is triplet pulse 6, its pick-ups pulses 4 and 5
    expect(pattern(r, 2)).toBe('x...xxx.x...')
    expect(who(r, 2)).toEqual([2, null, null, 2, 2, 3, null, 3, null])
  })
})
