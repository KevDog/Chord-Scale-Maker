import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useChangesSet } from '~/composables/useChangesSet'

const make = (key?: string, initial?: Parameters<typeof useChangesSet>[1]) => {
  const s = effectScope().run(() => useChangesSet(key, initial))
  if (!s) throw new Error('no changes set')
  return s
}

describe('useChangesSet', () => {
  afterEach(() => localStorage.clear())

  it('starts on the standard changes with the alternates shown', () => {
    const a = make('autumn-leaves')
    expect([a.main.value, a.shown.value]).toEqual(['standard', true])
  })

  it('remembers the main set and the toggle per chart, and forgets the chart at the defaults', async () => {
    const a = make('rhythm-changes')
    a.main.value = 'alternate'
    a.shown.value = false
    await nextTick()
    const again = make('rhythm-changes')
    expect([again.main.value, again.shown.value]).toEqual(['alternate', false])
    expect(make('so-what').main.value).toBe('standard')
    a.main.value = 'standard'
    a.shown.value = true
    await nextTick()
    expect(localStorage.getItem('csm-changes:rhythm-changes')).toBeNull()
  })

  it('takes a share link’s view for the visit only, and ignores stored junk', async () => {
    localStorage.setItem('csm-changes:x', '{"main":"nope","shown":3}')
    expect([make('x').main.value, make('x').shown.value]).toEqual(['standard', true])
    const shared = make('y', { changes: 'alternate', altHidden: true })
    expect([shared.main.value, shared.shown.value]).toEqual(['alternate', false])
    await nextTick()
    expect(localStorage.getItem('csm-changes:y')).toBeNull()
    shared.shown.value = true
    await nextTick()
    expect(localStorage.getItem('csm-changes:y')).not.toBeNull()
  })

  it('carries a non-default view to another chart', () => {
    const a = make('a')
    a.carryTo('b')
    expect(localStorage.getItem('csm-changes:b')).toBeNull()
    a.main.value = 'alternate'
    a.carryTo('b')
    expect(make('b').main.value).toBe('alternate')
  })
})
