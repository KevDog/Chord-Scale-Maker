import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { linkPreferences, usePreferences } from '~/composables/usePreferences'
import type { ShareView } from '@chord-scale-maker/engine'

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

  it('starts with no line, guide tones from the 3rd and arpeggios Up · root, and remembers each', async () => {
    const p = prefs()
    expect([p.lineMode.value, p.guideLine.value, p.arpeggio.value]).toEqual(['off', 'third', 'up-root'])
    p.lineMode.value = 'arpeggio'
    p.arpeggio.value = 'voice-led'
    p.guideLine.value = 'seventh'
    await nextTick()
    expect([localStorage.getItem('csm-line'), localStorage.getItem('csm-arpeggio'), localStorage.getItem('csm-guide-line')]).toEqual(['arpeggio', 'voice-led', 'seventh'])
    const again = prefs()
    expect([again.lineMode.value, again.arpeggio.value, again.guideLine.value]).toEqual(['arpeggio', 'voice-led', 'seventh'])
    expect(Object.keys(p)).not.toContain('fromThird')
  })

  it('falls back from stored values it does not know, and ignores the old keys', () => {
    localStorage.setItem('csm-line', 'both')
    localStorage.setItem('csm-guide-line', 'off')
    localStorage.setItem('csm-arpeggio', 'sideways')
    const p = prefs()
    expect([p.lineMode.value, p.guideLine.value, p.arpeggio.value]).toEqual(['off', 'third', 'up-root'])
    localStorage.clear()
    localStorage.setItem('csm-guide-3rd', 'on')
    expect(prefs().lineMode.value).toBe('off')
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

  it("remembers the functions page's key, C major until chosen", async () => {
    localStorage.setItem('csm-functions-key', 'H')
    const p = prefs()
    expect(p.functionsKey.value).toBe('C')
    p.functionsKey.value = 'Ebm'
    await nextTick()
    expect(prefs().functionsKey.value).toBe('Ebm')
  })
})

describe('linkPreferences', () => {
  afterEach(() => localStorage.clear())

  it("takes a link's line over your own, for this visit only", async () => {
    localStorage.setItem('csm-line', 'arpeggio')
    localStorage.setItem('csm-guide-line', 'seventh')
    const p = linked({ line: 'third' })
    expect([p.lineMode.value, p.guideLine.value]).toEqual(['guide', 'third'])
    p.lineMode.value = 'off'
    p.guideLine.value = 'seventh'
    await nextTick()
    expect(localStorage.getItem('csm-line')).toBe('arpeggio')
    expect(localStorage.getItem('csm-guide-line')).toBe('seventh')
  })

  it("takes a link's arpeggio, and no line when it has none, whatever your own", () => {
    expect(linked({ line: 'down-1st' }).lineMode.value).toBe('arpeggio')
    expect(linked({ line: 'down-1st' }).arpeggio.value).toBe('down-1st')
    expect(linked({ line: 'seventh' }).guideLine.value).toBe('seventh')
    localStorage.setItem('csm-line', 'guide')
    expect(linked({}).lineMode.value).toBe('off')
    expect(linked({ sheet: 'changes' }).lineMode.value).toBe('off')
  })
})
