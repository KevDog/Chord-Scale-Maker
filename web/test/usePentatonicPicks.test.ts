import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { usePentatonicPicks } from '~/composables/usePentatonicPicks'

const make = (key: string | undefined) => {
  const s = effectScope().run(() => usePentatonicPicks(key))
  if (!s) throw new Error('no picks')
  return s
}

describe('usePentatonicPicks', () => {
  afterEach(() => localStorage.clear())

  it('picks a pentatonic for a run, stores it per chart, and reloads it', async () => {
    const p = make('autumn-leaves')
    p.pick(['A1:1:0', 'A1:2:0'], 7)
    await nextTick()
    expect(JSON.parse(localStorage.getItem('csm-pent-picks:autumn-leaves')!)).toEqual({ 'A1:1:0': 7, 'A1:2:0': 7 })
    expect(make('autumn-leaves').picks.value).toEqual({ 'A1:1:0': 7, 'A1:2:0': 7 })
  })

  it('resets a run, and removes the entry when nothing is picked', async () => {
    const p = make('t')
    p.pick(['A:1:0', 'A:2:0'], 7)
    p.pick(['A:3:0'], 2)
    p.reset(['A:1:0', 'A:2:0'])
    expect(p.picks.value).toEqual({ 'A:3:0': 2 })
    p.clear()
    await nextTick()
    expect(localStorage.getItem('csm-pent-picks:t')).toBeNull()
  })

  it('ignores junk: bad JSON, non-integer or out-of-range pcs, own-property names', () => {
    localStorage.setItem('csm-pent-picks:j', '{"A:1:0": 13, "A:2:0": "x", "A:3:0": 4, "constructor": 1.5}')
    expect(make('j').picks.value).toEqual({ 'A:3:0': 4 })
    localStorage.setItem('csm-pent-picks:k', 'not json')
    expect(make('k').picks.value).toEqual({})
  })

  it('keeps picks for the visit only with no chart key, and carries them to another key', async () => {
    const p = make(undefined)
    p.pick(['A:1:0'], 3)
    await nextTick()
    expect(localStorage.length).toBe(0)
    p.carryTo('mine:1')
    expect(make('mine:1').picks.value).toEqual({ 'A:1:0': 3 })
  })
})
