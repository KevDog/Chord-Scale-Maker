import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { linkPreferences, usePreferences } from '~/composables/usePreferences'
import { INSTRUMENTS, type ShareView } from '@chord-scale-maker/engine'

const flags = vi.hoisted(() => ({ cells: true, approaches: true, phraseCells: true, rhythm: true, rhythmSheets: true, rhythmGears: true }))
mockNuxtImport('useFeature', () => (name: string) => (name === 'cells' && flags.cells) || (name === 'approaches' && flags.approaches) || (name === 'phraseCells' && flags.phraseCells) || (name === 'rhythm' && flags.rhythm) || (name === 'rhythmSheets' && flags.rhythmSheets) || (name === 'rhythmGears' && flags.rhythmGears))

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
  afterEach(() => {
    localStorage.clear()
    flags.cells = true
    flags.approaches = true
    flags.phraseCells = true
    flags.rhythm = true
    flags.rhythmSheets = true
    flags.rhythmGears = true
  })

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

  it("remembers the Cells line's Order and Phrase (#376): as written and on until chosen, rejects an unknown Order", async () => {
    const p = prefs()
    expect([p.cellsOrder.value, p.cellsPhrase.value]).toEqual(['as-written', true])
    p.cellsOrder.value = 'rotated'
    p.cellsPhrase.value = false
    await nextTick()
    expect([localStorage.getItem('csm-cells-order'), localStorage.getItem('csm-cells-phrase')]).toEqual(['rotated', 'off'])
    expect([prefs().cellsOrder.value, prefs().cellsPhrase.value]).toEqual(['rotated', false])
    localStorage.setItem('csm-cells-order', 'sideways')
    expect(prefs().cellsOrder.value).toBe('as-written')
    localStorage.setItem('csm-cells-phrase', 'bogus')
    expect(prefs().cellsPhrase.value).toBe(true)
  })

  it('reads a stored Order and Phrase as the defaults with the phraseCells flag off, and keeps them stored', async () => {
    localStorage.setItem('csm-cells-order', 'reversed')
    localStorage.setItem('csm-cells-phrase', 'off')
    flags.phraseCells = false
    const p = prefs()
    expect([p.cellsOrder.value, p.cellsPhrase.value]).toEqual(['as-written', true])
    const l = linked({ line: 'cells:3rd-3rd~reversed~free' })
    expect([l.cellsOrder.value, l.cellsPhrase.value]).toEqual(['as-written', true])
    await nextTick()
    expect([localStorage.getItem('csm-cells-order'), localStorage.getItem('csm-cells-phrase')]).toEqual(['reversed', 'off'])
    flags.phraseCells = true
    expect([prefs().cellsOrder.value, prefs().cellsPhrase.value]).toEqual(['reversed', false])
  })

  it('reads a stored or linked chromatic cell as the default with the phraseCells flag off, and keeps it stored (#377)', async () => {
    localStorage.setItem('csm-cells', 'b9-1-3-5')
    expect(prefs().cells.value).toBe('b9-1-3-5')
    expect(linked({ line: 'cells:ii-v-chromatic' }).cells.value).toBe('ii-v-chromatic')
    flags.phraseCells = false
    expect(prefs().cells.value).toBe('3rd-3rd')
    expect(linked({ line: 'cells:ii-v-chromatic' }).cells.value).toBe('3rd-3rd')
    expect(linked({ line: 'cells:1-3-5-7' }).cells.value).toBe('1-3-5-7')
    await nextTick()
    expect(localStorage.getItem('csm-cells')).toBe('b9-1-3-5')
    flags.phraseCells = true
  })

  it("takes a link's Order and Phrase, as written and on when it has none, for this visit only", async () => {
    localStorage.setItem('csm-cells-order', 'swapped')
    const p = linked({ line: 'cells:3rd-3rd~reversed~free' })
    expect([p.cellsOrder.value, p.cellsPhrase.value]).toEqual(['reversed', false])
    const bare = linked({ line: 'cells:3rd-3rd' })
    expect([bare.cellsOrder.value, bare.cellsPhrase.value]).toEqual(['as-written', true])
    p.cellsOrder.value = 'rotated'
    await nextTick()
    expect(localStorage.getItem('csm-cells-order')).toBe('swapped')
  })

  it('remembers the Approach: None until chosen, rejects an unknown one', async () => {
    const p = prefs()
    expect(p.approach.value).toBe('none')
    p.approach.value = 'enclosure'
    await nextTick()
    expect(localStorage.getItem('csm-approach')).toBe('enclosure')
    expect(prefs().approach.value).toBe('enclosure')
    localStorage.setItem('csm-approach', 'sideways')
    expect(prefs().approach.value).toBe('none')
  })

  it('reads a stored rhythm, and Off for one the engine rejects or with the rhythm flag off, keeping it stored', () => {
    localStorage.setItem('csm-rhythm', 'unit:8:5:accents')
    expect(prefs().rhythm.value).toBe('unit:8:5:accents')
    for (const bad of ['unit:8:8:accents', 'unit:32:3:accents']) {
      localStorage.setItem('csm-rhythm', bad)
      expect(prefs().rhythm.value).toBe('off')
    }
    localStorage.setItem('csm-rhythm', 'unit:8:5:accents')
    flags.rhythm = false
    expect(prefs().rhythm.value).toBe('off')
    expect(localStorage.getItem('csm-rhythm')).toBe('unit:8:5:accents')
  })

  it('reads a stored rhythm at a tuplet pulse as Off with the rhythmGears flag off, keeping it stored (Phase 4 spec D8)', () => {
    for (const id of ['unit:16s:7:accents', 'custom:8q:x_x__']) {
      localStorage.setItem('csm-rhythm', id)
      expect(prefs().rhythm.value).toBe(id)
      flags.rhythmGears = false
      expect(prefs().rhythm.value).toBe('off')
      expect(localStorage.getItem('csm-rhythm')).toBe(id)
      localStorage.setItem('csm-rhythm', 'unit:8t:3:accents') // the old pulses play with the flag off
      expect(prefs().rhythm.value).toBe('unit:8t:3:accents')
      flags.rhythmGears = true
    }
  })

  it('reads Notes per bar (rhythm-scales-arpeggios spec §9): 1 to 7, else Whole notes; Whole notes with the rhythmSheets flag off, keeping it stored', async () => {
    expect(prefs().notesPerBar.value).toBe('whole')
    localStorage.setItem('csm-notes-per-bar', '5')
    expect(prefs().notesPerBar.value).toBe(5)
    for (const bad of ['9', 'x', '0']) {
      localStorage.setItem('csm-notes-per-bar', bad)
      expect(prefs().notesPerBar.value).toBe('whole')
    }
    localStorage.setItem('csm-notes-per-bar', '5')
    flags.rhythmSheets = false
    expect(prefs().notesPerBar.value).toBe('whole')
    expect(localStorage.getItem('csm-notes-per-bar')).toBe('5')
    flags.rhythmSheets = true
    const p = prefs()
    p.notesPerBar.value = 3
    await nextTick()
    expect(localStorage.getItem('csm-notes-per-bar')).toBe('3')
  })

  it('stores the target beats as on/off, off until chosen and with the flag off', () => {
    expect(prefs().targets.value).toBe(false)
    localStorage.setItem('csm-targets', 'on')
    expect(prefs().targets.value).toBe(true)
    flags.rhythm = false
    expect(prefs().targets.value).toBe(false)
    expect(localStorage.getItem('csm-targets')).toBe('on')
  })

  it('reads a stored Start, timing and Restate, defaults for a bad one or with the flag off, keeping them stored', () => {
    localStorage.setItem('csm-rhythm-start', 'pickup-2')
    localStorage.setItem('csm-anticipate', '-1.5')
    localStorage.setItem('csm-guide-restate', 'on')
    expect(prefs().rhythmStart.value).toBe('pickup-2')
    expect(prefs().anticipate.value).toBe(-1.5)
    expect(prefs().restate.value).toBe(true)
    localStorage.setItem('csm-rhythm-start', 'pickup-4')
    expect(prefs().rhythmStart.value).toBe('beat')
    for (const bad of ['0.25', '4']) {
      localStorage.setItem('csm-anticipate', bad)
      expect(prefs().anticipate.value).toBe(0)
    }
    localStorage.setItem('csm-rhythm-start', 'pickup-2')
    localStorage.setItem('csm-anticipate', '-1.5')
    flags.rhythm = false
    expect(prefs().rhythmStart.value).toBe('beat')
    expect(prefs().anticipate.value).toBe(0)
    expect(prefs().restate.value).toBe(false)
    expect(localStorage.getItem('csm-rhythm-start')).toBe('pickup-2')
    expect(localStorage.getItem('csm-anticipate')).toBe('-1.5')
    expect(localStorage.getItem('csm-guide-restate')).toBe('on')
  })

  it('reads a stored Approach as None with the approaches flag off, and keeps it stored', async () => {
    localStorage.setItem('csm-approach', 'enclosure')
    flags.approaches = false
    expect(prefs().approach.value).toBe('none')
    expect(linked({ approach: 'delayed' }).approach.value).toBe('none')
    await nextTick()
    expect(localStorage.getItem('csm-approach')).toBe('enclosure')
    flags.approaches = true
    expect(prefs().approach.value).toBe('enclosure')
  })

  it("takes a link's Approach over your own, None when the link has none, for this visit only", async () => {
    localStorage.setItem('csm-approach', 'enclosure')
    const p = linked({ line: 'third', approach: 'delayed' })
    expect(p.approach.value).toBe('delayed')
    expect(linked({ line: 'third' }).approach.value).toBe('none')
    p.approach.value = 'double-below'
    await nextTick()
    expect(localStorage.getItem('csm-approach')).toBe('enclosure')
  })

  it('shows a stored Cells line as Off with the cells flag off, and keeps it stored', async () => {
    localStorage.setItem('csm-line', 'cells')
    flags.cells = false
    const p = prefs()
    expect(p.lineMode.value).toBe('off')
    await nextTick()
    expect(localStorage.getItem('csm-line')).toBe('cells')
    expect(linked({ line: 'cells:5-3-2-1' }).lineMode.value).toBe('off')
    flags.cells = true
    expect(prefs().lineMode.value).toBe('cells')
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

  it('ignores stored values it does not recognize', () => {
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
  afterEach(() => {
    localStorage.clear()
    flags.rhythm = true
    flags.rhythmSheets = true
    flags.rhythmGears = true
  })

  it('shows a linked rhythm at a tuplet pulse, and Off with the rhythmGears flag off (Phase 4 spec D8)', () => {
    expect(linked({ rhythm: 'unit:16s:7:accents' }).rhythm.value).toBe('unit:16s:7:accents')
    flags.rhythmGears = false
    expect(linked({ rhythm: 'unit:16s:7:accents' }).rhythm.value).toBe('off')
    expect(linked({ rhythm: 'unit:8t:3:accents' }).rhythm.value).toBe('unit:8t:3:accents')
  })

  it("shows the Notes per bar a link was sent with, and Whole notes without one or with the rhythmSheets flag off", () => {
    localStorage.setItem('csm-notes-per-bar', '3')
    expect(linked({ sheet: 'scales', notesPerBar: 5 }).notesPerBar.value).toBe(5)
    expect(linked({ sheet: 'scales' }).notesPerBar.value).toBe('whole')
    flags.rhythmSheets = false
    expect(linked({ sheet: 'scales', notesPerBar: 5 }).notesPerBar.value).toBe('whole')
  })

  it('shows the rhythm a link was sent with, and Off, no targets and no Restate without one, over your own (#505)', () => {
    localStorage.setItem('csm-rhythm', 'card:upbeats')
    localStorage.setItem('csm-targets', 'on')
    localStorage.setItem('csm-guide-restate', 'on')
    const sent = linked({ rhythm: 'unit:8:5:accents', targets: true, restate: true })
    expect([sent.rhythm.value, sent.targets.value, sent.restate.value]).toEqual(['unit:8:5:accents', true, true])
    const none = linked({ sheet: 'changes' })
    expect([none.rhythm.value, none.targets.value, none.restate.value]).toEqual(['off', false, false])
  })

  it('shows no rhythm from a link with the rhythm flag off (#505)', () => {
    flags.rhythm = false
    const p = linked({ rhythm: 'unit:8:5:accents', targets: true, restate: true })
    expect([p.rhythm.value, p.targets.value, p.restate.value]).toEqual(['off', false, false])
  })

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

  it('keeps the Triad pairs shape, Arpeggiated by default, and a link overrides it for the visit only (#436)', async () => {
    const p = prefs()
    expect(p.arpShape.value).toBe('arpeggiated')
    p.arpShape.value = 'block'
    await nextTick()
    expect(localStorage.getItem('csm-arp-shape')).toBe('block')
    expect(prefs().arpShape.value).toBe('block')
    localStorage.setItem('csm-arp-shape', 'stacked')
    expect(prefs().arpShape.value).toBe('arpeggiated')
    expect(linked({ sheet: 'arpeggios', arpNotes: 'pairs', arpShape: 'block' }).arpShape.value).toBe('block')
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

  it("keeps the Triad pair line's shape at Nearest until chosen, a bad one as Nearest; a link's for the visit, else yours (#432)", async () => {
    expect(prefs().pairLine.value).toBe('nearest')
    localStorage.setItem('csm-pair-line', 'climb')
    expect(prefs().pairLine.value).toBe('climb')
    expect([linked({ line: 'up-root', pairLine: 'arpeggios' }).pairLine.value, linked({ line: 'up-root' }).pairLine.value]).toEqual(['arpeggios', 'climb'])
    localStorage.setItem('csm-pair-line', 'Climb')
    expect(prefs().pairLine.value).toBe('nearest')
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

  it('reads the Hexatonic basis (#432): Chord until Key is stored, junk as Chord, yours through a share link', () => {
    expect(prefs().hexBasis.value).toBe('chord')
    localStorage.setItem('csm-hex-basis', 'key')
    expect([prefs().hexBasis.value, linked({}).hexBasis.value]).toEqual(['key', 'key'])
    localStorage.setItem('csm-hex-basis', 'junk')
    expect(prefs().hexBasis.value).toBe('chord')
  })

  it('reads the Quartal overlay\'s notes and Perfect only (#432): Auto and off until stored, junk as the default, yours through a share link', async () => {
    expect([prefs().quartNotes.value, prefs().quartPerfect.value]).toEqual(['auto', false])
    localStorage.setItem('csm-quart-notes', '3')
    localStorage.setItem('csm-quart-perfect', 'on')
    expect([prefs().quartNotes.value, prefs().quartPerfect.value, linked({}).quartNotes.value, linked({}).quartPerfect.value]).toEqual([3, true, 3, true])
    localStorage.setItem('csm-quart-notes', '5')
    expect(prefs().quartNotes.value).toBe('auto')
    const p = prefs()
    p.quartPerfect.value = false
    await nextTick()
    expect(localStorage.getItem('csm-quart-perfect')).toBe('off')
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

  it("keeps the player's range per instrument, the preset's until set (#359)", async () => {
    const p = prefs()
    expect(p.range.value).toEqual(INSTRUMENTS.piano.range)
    p.instrument.value = 'trumpet'
    await nextTick()
    expect(p.range.value).toEqual(INSTRUMENTS.trumpet.range)
    p.range.value = { lo: 58, hi: 82, centre: 70 }
    await nextTick()
    expect(localStorage.getItem('csm-range-trumpet')).toBe('58-82')
    p.instrument.value = 'piano'
    await nextTick()
    expect(p.range.value).toEqual(INSTRUMENTS.piano.range)
    expect(prefs().range.value).toEqual(INSTRUMENTS.piano.range)
    p.instrument.value = 'trumpet'
    await nextTick()
    expect(p.range.value).toEqual({ lo: 58, hi: 82, centre: 70 })
  })

  it("fits a stored range it can't use into the instrument's, and ignores junk", () => {
    localStorage.setItem('csm-instrument', 'trumpet')
    localStorage.setItem('csm-range-trumpet', '40-99')
    expect(prefs().range.value).toEqual({ lo: 54, hi: 84, centre: 70 })
    localStorage.setItem('csm-range-trumpet', 'high')
    expect(prefs().range.value).toEqual(INSTRUMENTS.trumpet.range)
  })

  it("keeps a share link's instrument at your range for it; the link carries none", async () => {
    localStorage.setItem('csm-range-tenor-sax', '60-86')
    const p = linked({ instrument: 'tenor-sax' })
    expect(p.range.value).toMatchObject({ lo: 60, hi: 86 })
  })
})
