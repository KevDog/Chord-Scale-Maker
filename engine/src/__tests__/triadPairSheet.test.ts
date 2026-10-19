import { describe, expect, it } from 'vitest'
import { chainTriad, type TriadQuality } from '../hexatonics'
import type { Range } from '../instruments'
import { parseRoot } from '../pitch'
import { toVexKey } from '../sheet'
import type { TriadPair } from '../triadPairLine'
import { triadPairFigure } from '../triadPairSheet'

const t = (name: string): ReturnType<typeof chainTriad> => {
  const m = /^([A-G][b#]?)(m|°|\+)?$/.exec(name)!
  const quality: TriadQuality = m[2] === 'm' ? 'min' : m[2] === '°' ? 'dim' : m[2] === '+' ? 'aug' : 'maj'
  return chainTriad(parseRoot(m[1]!), quality)
}
const pair = (name: string): TriadPair => ({ lower: t(name.split('/')[0]!), upper: t(name.split('/')[1]!) })
const TREBLE: Range = { lo: 60, hi: 84, centre: 72 }
const keys = (name: string, shape: 'arpeggiated' | 'block', dir: 'up' | 'down' | 'up-down', range = TREBLE) => {
  const f = triadPairFigure(pair(name), shape, dir, range)
  return { keys: f.notes.map(toVexKey).join(' '), groups: f.groups }
}

describe('triadPairFigure', () => {
  it("alternates the triads through their inversions, each shape's bottom a step above the last (Weiskopf ex. 1)", () => {
    expect(keys('F/G', 'arpeggiated', 'up')).toEqual({
      keys: 'f/4 a/4 c/5 g/4 b/4 d/5 a/4 c/5 f/5 b/4 d/5 g/5 c/5 f/5 a/5 d/5 g/5 b/5',
      groups: [3, 3, 3, 3, 3, 3],
    })
  })

  it('spells each triad from its own root', () => {
    expect(keys('Ab/Bb', 'arpeggiated', 'up', { lo: 55, hi: 88, centre: 76 }).keys).toBe('ab/4 c/5 eb/5 bb/4 d/5 f/5 c/5 eb/5 ab/5 d/5 f/5 bb/5 eb/5 ab/5 c/6 f/5 bb/5 d/6')
  })

  it('places the figure whole, nearest the centre', () => {
    expect(keys('F/G', 'arpeggiated', 'up', { lo: 48, hi: 72, centre: 60 }).keys.split(' ')[0]).toBe('f/3')
  })

  it("starts the upper triad nearest the lower's root, below where that is nearer", () => {
    expect(keys('F#m/Eb', 'arpeggiated', 'up').keys.split(' ').slice(0, 6)).toEqual(['f#/4', 'a/4', 'c#/5', 'eb/4', 'g/4', 'bb/4'])
  })

  it('moves a shape still out of the range an octave, whole (a tritone pair on the bass)', () => {
    const f = triadPairFigure(pair('C/F#m'), 'arpeggiated', 'up', { lo: 40, hi: 60, centre: 49 })
    expect(f.notes.filter((n) => n.midi < 40 || n.midi > 60)).toEqual([])
    const shapes = [0, 1, 2, 3, 4, 5].map((s) => f.notes.slice(3 * s, 3 * s + 3).map((n) => n.midi))
    expect(shapes.every(([a, b, c]) => a! < b! && b! < c! && c! - a! < 12)).toBe(true)
  })

  it('Down plays the figure backwards', () => {
    expect(keys('F/G', 'arpeggiated', 'down')).toEqual({
      keys: 'b/5 g/5 d/5 a/5 f/5 c/5 g/5 d/5 b/4 f/5 c/5 a/4 d/5 b/4 g/4 c/5 a/4 f/4',
      groups: [3, 3, 3, 3, 3, 3],
    })
  })

  it('Up & down climbs and comes back, sharing the top', () => {
    const f = keys('F/G', 'arpeggiated', 'up-down')
    expect(f.keys.split(' ')).toHaveLength(35)
    expect(f.keys.split(' ').slice(16, 20)).toEqual(['g/5', 'b/5', 'g/5', 'd/5'])
    expect(f.groups).toEqual([3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3])
  })

  it('Block writes the six shapes as chords, whatever the direction', () => {
    expect(triadPairFigure(pair('F/G'), 'block', 'down', TREBLE)).toEqual(triadPairFigure(pair('F/G'), 'block', 'up', TREBLE))
    expect(keys('F/G', 'block', 'up').groups).toEqual([3, 3, 3, 3, 3, 3])
  })
})
