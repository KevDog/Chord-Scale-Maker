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
  it('keeps a position on a section name with spaces, new or #272', () => {
    expect(chordPicksFrom({ pentatonic: { 'Out Chorus:1:0': { pc: 9 } }, hexatonic: {} })).toEqual({ pentatonic: { 'Out Chorus:1:0': { pc: 9 } }, hexatonic: {} })
    expect(chordPicksFrom({ 'Out Chorus:1:0': 7 })).toEqual({ pentatonic: { 'Out Chorus:1:0': { pc: 7 } }, hexatonic: {} })
    expect(chordPicksFrom({ 'A\nB:1:0': 7, [`${'x'.repeat(65)}:1:0`]: 7 })).toEqual(NO_PICKS)
  })
  it('drops bad entries and never throws', () => {
    const bad = { pentatonic: { 'A:1:0': 12, 'A:2:0': { pc: 1.5 }, __proto__x: 3, constructor: { pc: 1 }, 'A:3:0': { pc: 4, for: 'x'.repeat(10_000) } }, hexatonic: { 'A:1:0': { roots: [2, 2] }, 'A:2:0': { roots: [1] }, 'A:3:0': { roots: [0, 13] } } }
    expect(chordPicksFrom(bad)).toEqual(NO_PICKS)
    for (const v of [null, 3, 'x', [], { pentatonic: [] }]) expect(chordPicksFrom(v)).toEqual(NO_PICKS)
  })
  it('drops a pick whose for is present but bad (too long, no |, not a string); only a missing for is legacy', () => {
    const p = (f: unknown) => chordPicksFrom({ pentatonic: { 'A:1:0': { pc: 4, for: f } }, hexatonic: { 'A:1:0': { roots: [0, 2], for: f } } })
    for (const f of ['x'.repeat(10_000), `${'x'.repeat(200)}|`, 'Cmaj7 C Ionian', 7, null, { a: 1 }, ['a|b']]) expect(p(f)).toEqual(NO_PICKS)
    expect(p(undefined)).toEqual({ pentatonic: { 'A:1:0': { pc: 4 } }, hexatonic: { 'A:1:0': { roots: [0, 2] } } })
    expect(p('Cmaj7|C Ionian')).toEqual({ pentatonic: { 'A:1:0': { pc: 4, for: 'Cmaj7|C Ionian' } }, hexatonic: { 'A:1:0': { roots: [0, 2], for: 'Cmaj7|C Ionian' } } })
  })
  it('ignores own __proto__ keys, inside a kind and at the top', () => {
    expect(chordPicksFrom(JSON.parse('{"pentatonic":{"__proto__":{"pc":1}}}'))).toEqual(NO_PICKS)
    expect(chordPicksFrom(JSON.parse('{"__proto__":{"pentatonic":{"A:1:0":{"pc":1}}}}'))).toEqual(NO_PICKS)
    expect(chordPicksFrom(JSON.parse('{"__proto__":{"A:1:0":1}}'))).toEqual(NO_PICKS)
    expect(({} as Record<string, unknown>).pc).toBeUndefined() // nothing polluted
  })
  it('keeps exactly LIMITS.maxExpandedRows picks a kind', () => {
    expect(LIMITS.maxExpandedRows).toBe(1000)
    const many = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`A:${i}:0`, 1]))
    expect(Object.keys(chordPicksFrom(many).pentatonic).length).toBe(LIMITS.maxExpandedRows)
    const hex = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`A:${i}:0`, { roots: [0, 2] }]))
    expect(Object.keys(chordPicksFrom({ hexatonic: hex }).hexatonic).length).toBe(LIMITS.maxExpandedRows)
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
