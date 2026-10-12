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

  it("defaults to concert pitch spelled from the chart's key, with interval labels on", () => {
    const p = prefs()
    expect([p.instrument.value, p.spell.value, p.intervals.value]).toEqual(['concert', 'key', true])
  })

  it('remembers spelling from the root', async () => {
    prefs().spell.value = 'root'
    await nextTick()
    expect(prefs().spell.value).toBe('root')
  })

  it('ignores the old start note, kept before the key was the default', () => {
    localStorage.setItem('csm-start', 'Eb')
    expect(prefs().spell.value).toBe('key')
  })

  it('keeps interval labels off once turned off', async () => {
    prefs().intervals.value = false
    await nextTick()
    expect(prefs().intervals.value).toBe(false)
  })

  it('keeps the guide tone line off until chosen, and remembers it', async () => {
    const p = prefs()
    expect(p.guideLine.value).toBe('off')
    p.guideLine.value = 'third'
    await nextTick()
    expect(localStorage.getItem('csm-guide-line')).toBe('third')
    const again = prefs()
    expect(again.guideLine.value).toBe('third')
    again.guideLine.value = 'seventh'
    await nextTick()
    expect(localStorage.getItem('csm-guide-line')).toBe('seventh')
    again.guideLine.value = 'off'
    await nextTick()
    expect(localStorage.getItem('csm-guide-line')).toBe('off')
    expect(Object.keys(p)).not.toContain('fromThird')
  })

  it('falls back to off on a stored guide line it does not know, and ignores the old keys', () => {
    for (const junk of ['both', 'on', 'Third', '']) {
      localStorage.setItem('csm-guide-line', junk)
      expect(prefs().guideLine.value).toBe('off')
    }
    localStorage.removeItem('csm-guide-line')
    localStorage.setItem('csm-guide-3rd', 'on')
    expect(prefs().guideLine.value).toBe('off')
  })

  it('remembers choices in this browser', async () => {
    const p = prefs()
    p.instrument.value = 'alto-sax'
    p.spell.value = 'Eb'
    await nextTick()
    const again = prefs()
    expect([again.instrument.value, again.spell.value]).toEqual(['alto-sax', 'Eb'])
  })

  it('ignores stored values it does not recognise', () => {
    localStorage.setItem('csm-instrument', 'kazoo')
    localStorage.setItem('csm-spell', 'H')
    const p = prefs()
    expect([p.instrument.value, p.spell.value]).toEqual(['concert', 'key'])
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

  it("takes a link's guide tone line over your own, for this visit only", async () => {
    localStorage.setItem('csm-guide-line', 'seventh')
    const p = linked({ guideLine: 'third' })
    expect(p.guideLine.value).toBe('third')
    p.guideLine.value = 'off'
    await nextTick()
    expect(localStorage.getItem('csm-guide-line')).toBe('seventh')
  })

  it("reads a link's spelling: its start note, from the root, or the key when it has no note", () => {
    expect(linked({ mode: 'from', start: 'Eb' }).spell.value).toBe('Eb')
    expect(linked({ mode: 'root', start: 'C' }).spell.value).toBe('root')
    expect(linked({ mode: 'from' }).spell.value).toBe('key')
  })

  it('keeps your own spelling for a link without one, and saves nothing', async () => {
    localStorage.setItem('csm-spell', 'root')
    const p = linked({ sheet: 'scales' })
    expect(p.spell.value).toBe('root')
    p.spell.value = 'D'
    await nextTick()
    expect(localStorage.getItem('csm-spell')).toBe('root')
  })

  it('opens a link without a guide line with the line off, whatever your own', () => {
    localStorage.setItem('csm-guide-line', 'seventh')
    expect(linked({ sheet: 'changes' }).guideLine.value).toBe('off')
  })
})
