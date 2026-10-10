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

  it('defaults to concert pitch starting on C, with interval labels on', () => {
    const p = prefs()
    expect([p.instrument.value, p.start.value, p.intervals.value]).toEqual(['concert', 'C', true])
  })

  it('keeps interval labels off once turned off', async () => {
    prefs().intervals.value = false
    await nextTick()
    expect(prefs().intervals.value).toBe(false)
  })

  it('shows the text editor until hidden, and remembers', async () => {
    const p = prefs()
    expect(p.textPane.value).toBe(true)
    p.textPane.value = false
    await nextTick()
    expect(prefs().textPane.value).toBe(false)
  })

  it('keeps the grid notes hidden until shown, and remembers', async () => {
    const p = prefs()
    expect(p.notes.value).toBe(false)
    p.notes.value = true
    await nextTick()
    expect(prefs().notes.value).toBe(true)
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
