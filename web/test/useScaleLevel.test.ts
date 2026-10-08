import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useScaleLevel } from '~/composables/useScaleLevel'

const make = (key?: string, initial?: Parameters<typeof useScaleLevel>[1]) => {
  const s = effectScope().run(() => useScaleLevel(key, initial))
  if (!s) throw new Error('no level')
  return s
}

describe('useScaleLevel', () => {
  afterEach(() => localStorage.clear())

  it('starts at Standard and remembers a level and seed per chart', async () => {
    const a = make('autumn_leaves')
    expect(a.level.value).toBe('standard')
    a.level.value = 'random'
    await nextTick()
    const again = make('autumn_leaves')
    expect([again.level.value, again.seed.value]).toEqual(['random', a.seed.value])
    expect(make('so_what').level.value).toBe('standard')
  })

  it('shuffles to a new seed, and forgets the chart once back at Standard', async () => {
    const a = make('f_blues')
    a.level.value = 'random'
    const before = a.seed.value
    a.shuffle()
    expect(a.seed.value).not.toBe(before)
    await nextTick()
    a.level.value = 'standard'
    await nextTick()
    expect(localStorage.getItem('csm-level:f_blues')).toBeNull()
  })

  it('takes a share link’s level for the visit only, and ignores stored junk', async () => {
    localStorage.setItem('csm-level:x', '{"level":"expert"}')
    expect(make('x').level.value).toBe('standard')
    const shared = make(undefined, { level: 'basic', seed: 5 })
    expect([shared.level.value, shared.seed.value]).toEqual(['basic', 5])
    shared.level.value = 'advanced'
    await nextTick()
    expect(localStorage.length).toBe(1) // only the junk entry
  })
})
