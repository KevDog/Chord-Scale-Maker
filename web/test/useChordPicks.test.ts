import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { ChordAt, ChordPicks } from '@chord-scale-maker/engine'
import { useChordPicks } from '~/composables/useChordPicks'

const T = (entries: [ChordAt, string][]) => ref<ReadonlyMap<ChordAt, string>>(new Map(entries))
const ALL = T([
  ['A:1:0', 'Cmaj7|Ionian'],
  ['A:2:0', 'Cmaj7|Ionian'],
  ['A:3:0', 'G7|Mixolydian'],
])
const make = (key: string | undefined, targets = ALL, seed?: ChordPicks) => {
  const s = effectScope().run(() => useChordPicks(key, targets, seed))
  if (!s) throw new Error('no picks')
  return s
}
const stored = (key: string): unknown => JSON.parse(localStorage.getItem(`csm-pent-picks:${key}`)!)

describe('useChordPicks', () => {
  afterEach(() => localStorage.clear())

  it('stores both kinds per chart, and removes the key when clearAll leaves none', async () => {
    const p = make('t')
    p.pick('pentatonic', ['A:1:0'], 9)
    p.pick('hexatonic', ['A:3:0'], [5, 7])
    await nextTick()
    expect(stored('t')).toEqual({
      pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|Ionian' } },
      hexatonic: { 'A:3:0': { roots: [5, 7], for: 'G7|Mixolydian' } },
    })
    expect(make('t').picks.value).toEqual(stored('t'))
    p.clearAll()
    await nextTick()
    expect(localStorage.getItem('csm-pent-picks:t')).toBeNull()
  })

  it('round-trips a pick on a section name with spaces', async () => {
    const p = make('sp', T([['Out Chorus:1:0', 'Cmaj7|Ionian']]))
    p.pick('pentatonic', ['Out Chorus:1:0'], 9)
    await nextTick()
    expect(stored('sp')).toEqual({ pentatonic: { 'Out Chorus:1:0': { pc: 9, for: 'Cmaj7|Ionian' } }, hexatonic: {} })
    expect(make('sp', T([['Out Chorus:1:0', 'Cmaj7|Ionian']])).picks.value.pentatonic).toEqual({ 'Out Chorus:1:0': { pc: 9, for: 'Cmaj7|Ionian' } })
  })

  it('reads a legacy map of bare numbers as pentatonic picks, and bad JSON as none', () => {
    localStorage.setItem('csm-pent-picks:old', '{"A:1:0": 7}')
    expect(make('old').picks.value).toEqual({ pentatonic: { 'A:1:0': { pc: 7 } }, hexatonic: {} })
    localStorage.setItem('csm-pent-picks:bad', 'not json')
    expect(make('bad').picks.value).toEqual({ pentatonic: {}, hexatonic: {} })
  })

  it('stamps each position with what it plays, and clears only the positions given', () => {
    const p = make('s')
    p.pick('pentatonic', ['A:1:0', 'A:2:0'], 9)
    expect(p.picks.value.pentatonic).toEqual({ 'A:1:0': { pc: 9, for: 'Cmaj7|Ionian' }, 'A:2:0': { pc: 9, for: 'Cmaj7|Ionian' } })
    p.clear('pentatonic', ['A:1:0'])
    expect(p.picks.value.pentatonic).toEqual({ 'A:2:0': { pc: 9, for: 'Cmaj7|Ionian' } })
  })

  it('drops a stale pick on the next write, while live alone leaves storage as it is', async () => {
    const targets = T([
      ['A:1:0', 'Cmaj7|Ionian'],
      ['A:3:0', 'G7|Mixolydian'],
    ])
    const p = make('st', targets)
    p.pick('pentatonic', ['A:1:0'], 9)
    await nextTick()
    targets.value = new Map([
      ['A:1:0', 'Cm7|Dorian'],
      ['A:3:0', 'G7|Mixolydian'],
    ])
    expect(p.live.value.pentatonic).toEqual({})
    await nextTick()
    expect(stored('st')).toEqual({ pentatonic: { 'A:1:0': { pc: 9, for: 'Cmaj7|Ionian' } }, hexatonic: {} })
    p.pick('pentatonic', ['A:3:0'], 2)
    await nextTick()
    expect(stored('st')).toEqual({ pentatonic: { 'A:3:0': { pc: 2, for: 'G7|Mixolydian' } }, hexatonic: {} })
  })

  it('fills memory only from a seed with no key', async () => {
    const seed: ChordPicks = { pentatonic: { 'A:1:0': { pc: 4, for: 'Cmaj7|Ionian' } }, hexatonic: {} }
    const p = make(undefined, ALL, seed)
    expect(p.picks.value).toEqual(seed)
    p.pick('pentatonic', ['A:2:0'], 4)
    await nextTick()
    expect(localStorage.length).toBe(0)
  })

  it('carries both kinds across an edit, and copies to another key', async () => {
    const p = make('c')
    p.pick('pentatonic', ['A:3:0'], 7)
    p.pick('hexatonic', ['A:3:0'], [5, 7])
    p.carry(
      [{ at: 'A:1:0', text: 'Cmaj7' }, { at: 'A:2:0', text: 'Cmaj7' }, { at: 'A:3:0', text: 'G7' }],
      [{ at: 'A:1:0', text: 'Cmaj7' }, { at: 'A:2:0', text: 'Cmaj7' }, { at: 'A:3:0', text: 'F' }, { at: 'A:4:0', text: 'G7' }],
    )
    await nextTick()
    expect(p.picks.value).toEqual({
      pentatonic: { 'A:4:0': { pc: 7, for: 'G7|Mixolydian' } },
      hexatonic: { 'A:4:0': { roots: [5, 7], for: 'G7|Mixolydian' } },
    })
    p.carryTo('mine:1')
    expect(stored('mine:1')).toEqual(p.picks.value)
  })
})
