import { describe, expect, it } from 'vitest'
import { layRhythm, rhythmCaption } from '../rhythm/lay'
import type { RhythmId } from '../rhythm/library'

const cap = (id: RhythmId, bars: number[]) => rhythmCaption(id, layRhythm(id, bars)!, bars)

describe('layRhythm landings (§4)', () => {
  it('follows the landing table', () => {
    expect(layRhythm('unit:8:5:accents', Array(8).fill(4))?.landings).toEqual([0, 5])
    expect(layRhythm('unit:8:4:accents', Array(4).fill(3))?.landings).toEqual([0, 2])
    expect(layRhythm('unit:8t:4:accents', [4, 4])?.landings).toEqual([0, 1])
    expect(layRhythm('unit:8:7:accents', Array(14).fill(3))?.landings).toEqual([0, 7])
    expect(layRhythm('unit:8:5:accents', [4, 4, 3, 4, 4])?.landings).toEqual([0, 4])
  })

  it('has no landings for a per-bar rhythm', () => {
    expect(layRhythm('run:8:4:3', [4, 4])?.landings).toEqual([])
  })

  it('gives the unit and each bar start in pulses', () => {
    expect(layRhythm('unit:8:5:accents', [4, 3, 4])).toMatchObject({ unit: 5, starts: [0, 8, 14] })
    expect(layRhythm('run:8:4:3', [4, 4])).toMatchObject({ unit: 0, starts: [0, 8] })
  })

  it('is null for off, an invalid id or no bars', () => {
    expect(layRhythm('off', [4])).toBeNull()
    expect(layRhythm('unit:8:9:accents' as RhythmId, [4])).toBeNull()
    expect(layRhythm('unit:8:3:accents', [])).toBeNull()
  })
})

describe('rhythmCaption', () => {
  it('names the cycle', () => {
    expect(cap('unit:8:5:accents', Array(8).fill(4))).toBe('Rhythm: 8ths in 5, with accents · back on one every 5 bars')
    expect(cap('unit:8t:4:rests', [4, 4])).toBe('Rhythm: Triplets in 4, with rests · back on one every bar')
    expect(cap('unit:8:5:accents', [4, 4, 3, 4, 4])).toBe('Rhythm: 8ths in 5, with accents · back on one at bars 1, 5')
    expect(cap('unit:8:3:accents', [4, 3])).toBe('Rhythm: 8ths in 3, with accents · never back on one')
    expect(cap('run:8:4:3', [4, 4])).toBe('Rhythm: 4 8ths from the and of 2')
  })

  it('lists six landings at most, then …', () => {
    // 8ths in 2 over alternating 3/4 and 4/4: every bar lands
    const bars = [3, 4, 3, 4, 3, 4, 3, 4]
    expect(cap('unit:8:2:accents', bars)).toBe(
      'Rhythm: 8ths in 2, with accents · back on one at bars 1, 2, 3, 4, 5, 6, …',
    )
  })
})

describe('layRhythm events', () => {
  it('ties a unit held over the barline', () => {
    // 8ths in 3, tied, over 4/4: the third statement (pulses 6–8) crosses into bar 1
    const laid = layRhythm('unit:8:3:tied', [4, 4])!
    expect(laid.bars[0]!.at(-1)).toMatchObject({ at: 6, length: 2, tie: true })
    expect(laid.bars[1]![0]).toMatchObject({ at: 0, length: 1, tiedIn: true })
  })

  it('spills a run into the next bar and merges it with that bar’s own run (§3)', () => {
    const r = layRhythm('run:8:4:6', [4, 4])!
    expect(r.bars[1]!.filter(e => !e.rest).map(e => e.at)).toEqual([0, 1, 6, 7])
    // the sheet's last bar drops what would spill past it
    expect(r.bars[1]!.reduce((n, e) => n + e.length, 0)).toBe(8)
  })

  it('sounds a leading tie on the first pulse or after a rest (Review Focus 1)', () => {
    const c = layRhythm('custom:8:_x.', [3])!
    expect(c.bars[0]!.filter(e => !e.rest).map(e => [e.at, e.tiedIn])).toEqual([
      [0, false],
      [1, false],
      [3, false],
      [4, false],
    ])
  })

  it('lays downbeats in 3/4 as three quarter notes', () => {
    const d = layRhythm('card:downbeats', [3])!
    expect(d.kind).toBe('bar')
    expect(d.bars[0]!.map(e => [e.at, e.length, e.rest, e.statement])).toEqual([
      [0, 2, false, 0],
      [2, 2, false, 1],
      [4, 2, false, 2],
    ])
  })

  it('plays only the spill in a 2/4 bar after 4/4 (Review Focus 2)', () => {
    const r = layRhythm('run:8:3:6', [4, 2, 4])!
    expect(r.bars[1]!.filter(e => !e.rest).map(e => e.at)).toEqual([0])
    for (const bar of r.bars) for (const e of bar) expect(e.length).toBeGreaterThan(0)
    expect(r.bars[1]!.reduce((n, e) => n + e.length, 0)).toBe(4)
    expect(r.bars[2]!.filter(e => !e.rest).map(e => e.at)).toEqual([6, 7])
  })

  it('accents only the attack and merges rests within a statement', () => {
    const r = layRhythm('unit:8:3:rests', [4])!
    expect(r.bars[0]!.map(e => [e.at, e.length, e.rest, e.statement])).toEqual([
      [0, 1, false, 0],
      [1, 2, true, 0],
      [3, 1, false, 1],
      [4, 2, true, 1],
      [6, 1, false, 2],
      [7, 1, true, 2],
    ])
    const a = layRhythm('unit:8:3:accents', [4])!
    expect(a.bars[0]!.filter(e => e.accent).map(e => e.at)).toEqual([0, 3, 6])
  })
})
