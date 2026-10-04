import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { usePreferences } from '~/composables/usePreferences'

function prefs() {
  const scope = effectScope()
  const p = scope.run(() => usePreferences())
  if (!p) throw new Error('no preferences')
  return p
}

describe('usePreferences', () => {
  afterEach(() => localStorage.clear())

  it('defaults to concert pitch starting on C', () => {
    const p = prefs()
    expect([p.instrument.value, p.start.value]).toEqual(['concert', 'C'])
  })

  it('remembers choices in this browser', async () => {
    const p = prefs()
    p.instrument.value = 'alto-sax'
    p.start.value = 'Eb'
    await nextTick()
    const again = prefs()
    expect([again.instrument.value, again.start.value]).toEqual(['alto-sax', 'Eb'])
  })

  it('ignores stored values it does not recognise', () => {
    localStorage.setItem('csm-instrument', 'kazoo')
    localStorage.setItem('csm-start', 'H')
    const p = prefs()
    expect([p.instrument.value, p.start.value]).toEqual(['concert', 'C'])
  })
})
