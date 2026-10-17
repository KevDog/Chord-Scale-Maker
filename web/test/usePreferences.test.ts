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

  it("defaults to piano spelled from the chart's key, with interval labels on", () => {
    const p = prefs()
    expect([p.instrument.value, p.spell.value, p.intervals.value]).toEqual(['piano', 'key', true])
  })

  it('reads a stored concert instrument as piano, the choice that replaced it (#332)', () => {
    localStorage.setItem('csm-instrument', 'concert')
    expect(prefs().instrument.value).toBe('piano')
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

  it('remembers the Cells line: the mode and the cell, 3rd to 3rd until chosen, and rejects an unknown cell', async () => {
    const p = prefs()
    expect(p.cells.value).toBe('3rd-3rd')
    p.lineMode.value = 'cells'
    p.cells.value = '1-2-3-5'
    await nextTick()
    expect([localStorage.getItem('csm-line'), localStorage.getItem('csm-cells')]).toEqual(['cells', '1-2-3-5'])
    const again = prefs()
    expect([again.lineMode.value, again.cells.value]).toEqual(['cells', '1-2-3-5'])
    localStorage.setItem('csm-cells', '9-9-9-9')
    expect(prefs().cells.value).toBe('3rd-3rd')
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
    p.spell.value = 'Eb'
    await nextTick()
    const again = prefs()
    expect([again.instrument.value, again.spell.value]).toEqual(['alto-sax', 'Eb'])
  })

  it('ignores stored values it does not recognise', () => {
    localStorage.setItem('csm-instrument', 'kazoo')
    localStorage.setItem('csm-spell', 'H')
    const p = prefs()
    expect([p.instrument.value, p.spell.value]).toEqual(['piano', 'key'])
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

  it("takes a link's cells line over your own, for this visit only", async () => {
    localStorage.setItem('csm-cells', '1-3-5-7')
    const p = linked({ line: 'cells:5-3-2-1' })
    expect([p.lineMode.value, p.cells.value]).toEqual(['cells', '5-3-2-1'])
    expect(linked({ line: 'third' }).cells.value).toBe('1-3-5-7')
    p.cells.value = '1-2-3-5'
    await nextTick()
    expect(localStorage.getItem('csm-cells')).toBe('1-3-5-7')
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

  it("takes a link's arpeggio, and no line when it has none, whatever your own", () => {
    expect(linked({ line: 'down-1st' }).lineMode.value).toBe('arpeggio')
    expect(linked({ line: 'down-1st' }).arpeggio.value).toBe('down-1st')
    expect(linked({ line: 'seventh' }).guideLine.value).toBe('seventh')
    localStorage.setItem('csm-line', 'guide')
    expect(linked({}).lineMode.value).toBe('off')
    expect(linked({ sheet: 'changes' }).lineMode.value).toBe('off')
  })

  it('keeps the Arpeggios choices, and a link overrides them for the visit only', async () => {
    const p = prefs()
    expect([p.arpNotes.value, p.arpDir.value]).toEqual(['seventh', 'up'])
    p.arpNotes.value = 'extended'
    await nextTick()
    expect(prefs().arpNotes.value).toBe('extended')
    localStorage.setItem('csm-arp-dir', 'sideways')
    expect(prefs().arpDir.value).toBe('up')
    const l = linked({ sheet: 'arpeggios', arpNotes: 'seventh', arpDir: 'down' })
    expect([l.arpNotes.value, l.arpDir.value]).toEqual(['seventh', 'down'])
    expect(linked({}).arpNotes.value).toBe('extended')
  })

  it('keeps the Patterns choices in canonical form; text that does not parse reads as the default; a link overrides them for the visit only', async () => {
    const p = prefs()
    expect([p.pattern.value, p.patternNotes.value, p.patternDir.value]).toEqual(['+1 +1 +1 −2', 'scale', 'up'])
    p.pattern.value = '+2 -1'
    p.patternNotes.value = 'chord'
    p.patternDir.value = 'up-down'
    await nextTick()
    const again = prefs()
    expect([again.pattern.value, again.patternNotes.value, again.patternDir.value]).toEqual(['+2 −1', 'chord', 'up-down'])
    expect(localStorage.getItem('csm-pattern')).toBe('+2 −1')
    localStorage.setItem('csm-pattern', '+0 +1')
    localStorage.setItem('csm-pattern-notes', 'x')
    localStorage.setItem('csm-pattern-dir', 'sideways')
    const bad = prefs()
    expect([bad.pattern.value, bad.patternNotes.value, bad.patternDir.value]).toEqual(['+1 +1 +1 −2', 'scale', 'up'])
    const l = linked({ sheet: 'patterns', pattern: '+3 -1', patternNotes: 'chord', patternDir: 'down' })
    expect([l.pattern.value, l.patternNotes.value, l.patternDir.value]).toEqual(['+3 −1', 'chord', 'down'])
    expect(localStorage.getItem('csm-pattern')).toBe('+0 +1')
    expect(linked({}).pattern.value).toBe('+1 +1 +1 −2')
  })
})

describe('pentatonic preferences', () => {
  afterEach(() => localStorage.clear())

  it("keeps the Pentatonic line's Leave out at 1 until chosen, remembers it, and reads a bad one as 1 (#284)", async () => {
    const p = prefs()
    expect(p.pentLeave.value).toBe('1')
    p.pentLeave.value = 'b7'
    await nextTick()
    expect(localStorage.getItem('csm-pent-leave')).toBe('b7')
    expect(prefs().pentLeave.value).toBe('b7')
    localStorage.setItem('csm-pent-leave', '♭7')
    expect(prefs().pentLeave.value).toBe('1')
  })

  it("takes a link's Leave out for the visit; a link without one keeps your own, as arpDir does", async () => {
    localStorage.setItem('csm-pent-leave', '5')
    expect(linked({ line: 'up-root', pentLeave: 'b3' }).pentLeave.value).toBe('b3')
    expect(linked({ line: 'up-root' }).pentLeave.value).toBe('5')
    const l = linked({ line: 'up-root', pentLeave: 'b3' })
    l.pentLeave.value = '4'
    await nextTick()
    expect(localStorage.getItem('csm-pent-leave')).toBe('5')
  })

  it('keeps the pentatonic row off at Home, flat side, until chosen, and remembers the choice', async () => {
    const p = prefs()
    expect([p.overlay.value, p.pentRung.value, p.pentSide.value]).toEqual(['off', 0, 'flat'])
    p.overlay.value = 'pentatonic'
    p.pentRung.value = 4
    p.pentSide.value = 'sharp'
    await nextTick()
    expect([localStorage.getItem('csm-overlay'), localStorage.getItem('csm-pent-rung'), localStorage.getItem('csm-pent-side')]).toEqual(['pentatonic', '4', 'sharp'])
  })

  it('falls back from a stored rung or side it cannot read', () => {
    localStorage.setItem('csm-pent-rung', '9')
    localStorage.setItem('csm-pent-side', 'x')
    const p = prefs()
    expect([p.pentRung.value, p.pentSide.value]).toEqual([0, 'flat'])
  })

  it('keeps your own pentatonic choices when you open a share link', () => {
    localStorage.setItem('csm-overlay', 'hexatonic')
    localStorage.setItem('csm-pent-rung', '3')
    const p = linked({})
    expect([p.overlay.value, p.pentRung.value]).toEqual(['hexatonic', 3])
  })

  it('reads and writes the overlay, Off | Pentatonic | Hexatonic; a value it cannot read is Off', async () => {
    localStorage.setItem('csm-overlay', 'hexatonic')
    const p = prefs()
    expect(p.overlay.value).toBe('hexatonic')
    p.overlay.value = 'off'
    await nextTick()
    expect(localStorage.getItem('csm-overlay')).toBe('off')
    localStorage.setItem('csm-overlay', 'sparkles')
    expect(prefs().overlay.value).toBe('off')
  })

  it('reads an old Pentatonics row turned on as the Pentatonic overlay, until an overlay is stored', () => {
    localStorage.setItem('csm-pentatonics', 'on')
    expect(prefs().overlay.value).toBe('pentatonic')
    localStorage.setItem('csm-overlay', 'off')
    expect(prefs().overlay.value).toBe('off')
    localStorage.clear()
    localStorage.setItem('csm-pentatonics', 'off')
    expect(prefs().overlay.value).toBe('off')
  })

  it('reads a stored basis and Built on degree, rejecting junk, and keeps them through a share link', () => {
    localStorage.setItem('csm-pent-basis', 'chord')
    localStorage.setItem('csm-pent-degree', '11')
    expect([prefs().pentBasis.value, prefs().pentDegree.value]).toEqual(['chord', 11])
    const l = linked({})
    expect([l.pentBasis.value, l.pentDegree.value]).toEqual(['chord', 11])
    localStorage.setItem('csm-pent-basis', 'junk')
    expect(prefs().pentBasis.value).toBe('key')
    for (const [raw, want] of [['0', 0], ['auto', 'auto'], ['12', 'auto'], ['-1', 'auto'], ['2.5', 'auto'], ['x', 'auto']] as const) {
      localStorage.setItem('csm-pent-degree', raw)
      expect(prefs().pentDegree.value).toBe(want)
    }
  })

  it('reads an old stored rank as Auto', () => {
    localStorage.setItem('csm-pent-rank', '7')
    expect(prefs().pentDegree.value).toBe('auto')
  })
})
