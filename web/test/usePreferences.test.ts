import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { linkPreferences, usePreferences } from '~/composables/usePreferences'
import type { ShareView } from '~~/engine'

function prefs() {
  const scope = effectScope()
  const p = scope.run(() => usePreferences())
  if (!p) throw new Error('no preferences')
  return p
}

function linked(view: ShareView) {
  const scope = effectScope()
  const p = scope.run(() => linkPreferences(view))
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

  it('keeps the guide tones off until turned on, and remembers each', async () => {
    const p = prefs()
    expect([p.fromThird.value, p.fromSeventh.value]).toEqual([false, false])
    p.fromThird.value = true
    await nextTick()
    expect([localStorage.getItem('csm-guide-3rd'), localStorage.getItem('csm-guide-7th')]).toEqual(['on', null])
    const again = prefs()
    expect([again.fromThird.value, again.fromSeventh.value]).toEqual([true, false])
    again.fromThird.value = false
    await nextTick()
    expect(localStorage.getItem('csm-guide-3rd')).toBe('off')
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
    localStorage.setItem('csm-guide-3rd', 'yes')
    const p = prefs()
    expect([p.instrument.value, p.start.value, p.fromThird.value]).toEqual(['concert', 'C', false])
  })
})

describe('linkPreferences', () => {
  afterEach(() => localStorage.clear())

  it("takes a link's guide tones over your own, for this visit only", async () => {
    localStorage.setItem('csm-guide-7th', 'on')
    const p = linked({ fromThird: true })
    expect([p.fromThird.value, p.fromSeventh.value]).toEqual([true, true])
    p.fromThird.value = false
    await nextTick()
    expect(localStorage.getItem('csm-guide-3rd')).toBeNull()
  })
})
