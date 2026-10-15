import { describe, expect, it } from 'vitest'
import { type ChordPicks, chordPicksFrom, hasPicks, livePick, livePicks, NO_PICKS, pickBars, pickTarget, withoutPicks, withPick } from '../chordPicks'
import { LIMITS } from '../limits'

const T = new Map([['A:1:0', 'Cmaj7|C Ionian'], ['A:2:0', 'Dm7|D Dorian'], ['B:5:0', 'Cmaj7|C Ionian']])

describe('chordPicksFrom', () => {
  it('reads both kinds', () => {
    const v = { pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: { 'A:2:0': { roots: [0, 2], for: 'Dm7|D Dorian' } } }
    expect(chordPicksFrom(v)).toEqual(v)
  })
  it('reads a #272 map of bare numbers as pentatonic picks with no for', () => {
    expect(chordPicksFrom({ 'A:1:0': 7, 'A:2:0': 2 })).toEqual({ pentatonic: { 'A:1:0': { pc: 7 }, 'A:2:0': { pc: 2 } }, hexatonic: {} })
  })
  it('drops bad entries and never throws', () => {
    const bad = { pentatonic: { 'A:1:0': 12, 'A:2:0': { pc: 1.5 }, __proto__x: 3, constructor: { pc: 1 }, 'A:3:0': { pc: 4, for: 'x'.repeat(10_000) } }, hexatonic: { 'A:1:0': { roots: [2, 2] }, 'A:2:0': { roots: [1] }, 'A:3:0': { roots: [0, 13] } } }
    expect(chordPicksFrom(bad)).toEqual({ pentatonic: { 'A:3:0': { pc: 4 } }, hexatonic: {} }) // an overlong for is dropped, the pick kept
    for (const v of [null, 3, 'x', [], { pentatonic: [] }]) expect(chordPicksFrom(v)).toEqual(NO_PICKS)
  })
  it('keeps at most LIMITS.maxExpandedRows picks a kind', () => {
    expect(LIMITS.maxExpandedRows).toBe(1000)
    const many = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`A:${i}:0`, 1]))
    expect(Object.keys(chordPicksFrom(many).pentatonic).length).toBeLessThanOrEqual(LIMITS.maxExpandedRows)
  })
})

describe('livePicks', () => {
  it('keeps a pick whose for matches its position, and a legacy one anywhere drawn', () => {
    const p: ChordPicks = { pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'A:2:0': { pc: 2, for: 'Dm7|D Aeolian' }, 'B:5:0': { pc: 4 }, 'Z:9:0': { pc: 1 } }, hexatonic: {} }
    expect(livePicks(p, T).pentatonic).toEqual({ 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'B:5:0': { pc: 4 } })
    expect(livePick(p.pentatonic, 'A:2:0', 'Dm7|D Dorian')).toBeNull()
  })
})

describe('withPick / withoutPicks', () => {
  it('stamps each position with its own target and drops stale picks on the write', () => {
    const stale = { pentatonic: { 'A:2:0': { pc: 2, for: 'Dm7|D Aeolian' } }, hexatonic: {} }
    expect(withPick(stale, 'pentatonic', ['A:1:0', 'B:5:0', 'Z:9:0'], 9, T)).toEqual({ pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|C Ionian' }, 'B:5:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: {} })
    expect(withPick(NO_PICKS, 'hexatonic', ['A:2:0'], [0, 2], T).hexatonic).toEqual({ 'A:2:0': { roots: [0, 2], for: 'Dm7|D Dorian' } })
  })
  it('clears one kind at the positions given', () => {
    const p = withPick(withPick(NO_PICKS, 'pentatonic', ['A:1:0', 'B:5:0'], 9, T), 'hexatonic', ['A:1:0'], [7, 9], T)
    expect(withoutPicks(p, 'pentatonic', ['A:1:0'], T)).toEqual({ pentatonic: { 'B:5:0': { pc: 9, for: 'Cmaj7|C Ionian' } }, hexatonic: p.hexatonic })
    expect(hasPicks(p, 'hexatonic')).toBe(true)
    expect(hasPicks(NO_PICKS)).toBe(false)
  })
})

it('names the bars positions cover, once each, in order', () => {
  expect(pickBars(['A1:6:0', 'A1:6:1', 'A3:22:0'])).toEqual(['6', '22'])
  expect(pickTarget('Db7', null)).toBe('Db7|')
})
