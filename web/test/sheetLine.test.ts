import { describe, expect, it } from 'vitest'
import { approachApplies, changesLineOf, lineChoiceOf, lineModes, sheetLineOf, shareLineOf } from '~/utils/sheetLine'

describe('sheetLineOf', () => {
  it('composes the mode with its own detail', () => {
    expect(sheetLineOf('off', 'seventh', 'down-2nd')).toBe('off')
    expect(sheetLineOf('guide', 'seventh', 'down-2nd')).toBe('seventh')
    expect(sheetLineOf('arpeggio', 'seventh', 'down-2nd')).toBe('down-2nd')
  })
})

describe('lineChoiceOf', () => {
  it('splits a line back into its mode and detail', () => {
    expect(lineChoiceOf(undefined)).toEqual({ mode: 'off' })
    expect(lineChoiceOf('off')).toEqual({ mode: 'off' })
    expect(lineChoiceOf('third')).toEqual({ mode: 'guide', guide: 'third' })
    expect(lineChoiceOf('voice-led')).toEqual({ mode: 'arpeggio', arpeggio: 'voice-led' })
  })
})

describe('the Cells line (#298)', () => {
  const base = { guide: 'third', arpeggio: 'down-2nd', leave: 'b3', dir: 'up' } as const
  it('plays mode cells as the cells line only with the Superimpose off: under an overlay the slot is the overlay line', () => {
    expect(changesLineOf({ ...base, mode: 'cells', cells: '1-2-3-5', overlay: 'off' })).toEqual({ kind: 'cells', id: '1-2-3-5' })
    expect(changesLineOf({ ...base, mode: 'cells', cells: '1-2-3-5', overlay: 'pentatonic' })).toEqual({ kind: 'pentatonic', leave: 'b3', dir: 'up', arpeggio: 'down-2nd' })
    expect(changesLineOf({ ...base, mode: 'cells', cells: '1-2-3-5', overlay: 'hexatonic' })).toEqual({ kind: 'triad-pair', dir: 'up', arpeggio: 'down-2nd', shape: 'nearest' })
    expect(changesLineOf({ ...base, mode: 'arpeggio', cells: '1-2-3-5', overlay: 'hexatonic', shape: 'climb' })).toEqual({ kind: 'triad-pair', dir: 'up', arpeggio: 'down-2nd', shape: 'climb' })
    expect(changesLineOf({ ...base, mode: 'cells', cells: '1-2-3-5', overlay: 'quartal' })).toEqual({ kind: 'quartal', dir: 'up', arpeggio: 'down-2nd' })
    expect(changesLineOf({ ...base, mode: 'arpeggio', overlay: 'quartal' })).toEqual({ kind: 'quartal', dir: 'up', arpeggio: 'down-2nd' })
    expect(changesLineOf({ ...base, mode: 'guide', cells: '1-2-3-5', overlay: 'off' })).toBe('third')
  })
  it('has no Cells radio: the Line control keeps three modes (the cells are in the 7th Chords listbox)', () => {
    expect(lineModes('off').map((m) => m.value)).toEqual(['off', 'guide', 'arpeggio'])
  })
  it('puts cells in a share link as cells:<id>, and reads one back', () => {
    expect(shareLineOf('cells', 'third', 'up-root', '3rd-5th')).toBe('cells:3rd-5th')
    expect(shareLineOf('guide', 'third', 'up-root', '3rd-5th')).toBe('third')
    expect(lineChoiceOf('cells:3rd-5th')).toEqual({ mode: 'cells', cells: '3rd-5th', order: 'as-written', phrase: true })
  })
  it("adds the Order and Phrase off to a share link (#376): ~<order> unless as written, ~free with phrase off", () => {
    expect(shareLineOf('cells', 'third', 'up-root', '3rd-3rd', 'rotated', false)).toBe('cells:3rd-3rd~rotated~free')
    expect(shareLineOf('cells', 'third', 'up-root', '3rd-3rd', 'as-written', true)).toBe('cells:3rd-3rd')
    expect(shareLineOf('cells', 'third', 'up-root', '3rd-3rd', 'as-written', false)).toBe('cells:3rd-3rd~free')
    expect(shareLineOf('guide', 'third', 'up-root', '3rd-3rd', 'rotated', false)).toBe('third')
    expect(lineChoiceOf('cells:1-2-3-5~swapped')).toEqual({ mode: 'cells', cells: '1-2-3-5', order: 'swapped', phrase: true })
    expect(lineChoiceOf('cells:3rd-3rd~reversed~free')).toEqual({ mode: 'cells', cells: '3rd-3rd', order: 'reversed', phrase: false })
    expect(lineChoiceOf('cells:3rd-3rd~as-written~rotated')).toEqual({ mode: 'cells', cells: '3rd-3rd', order: 'rotated', phrase: true })
    expect(shareLineOf('cells', 'third', 'up-root', '1-2-3-5', 'as-written', false)).toBe('cells:1-2-3-5')
  })
  it('passes the Order and Phrase on to the cells line (#376)', () => {
    expect(changesLineOf({ ...base, mode: 'cells', cells: '1-2-3-5', overlay: 'off', order: 'reversed', phrase: false })).toEqual({ kind: 'cells', id: '1-2-3-5', order: 'reversed', phrase: false })
  })
})

describe('the Pentatonic line (#284)', () => {
  it('plays the arpeggio slot as the Pentatonic line while Superimpose is Pentatonic, else as stored', () => {
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: 'b3', dir: 'up-down' })).toEqual({ kind: 'pentatonic', leave: 'b3', dir: 'up-down', arpeggio: 'down-2nd' })
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'off', leave: 'b3', dir: 'up' })).toBe('down-2nd')
    expect(changesLineOf({ mode: 'guide', guide: 'seventh', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: '1', dir: 'up' })).toBe('seventh')
    expect(changesLineOf({ mode: 'off', guide: 'seventh', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: '1', dir: 'up' })).toBe('off')
  })
  it("names the slot Pentatonic under the Pentatonic overlay, 7th Chords otherwise; the value stays 'arpeggio'", () => {
    expect(lineModes('pentatonic').map((m) => [m.value, m.label])).toEqual([['off', 'Off'], ['guide', 'Guide Tones'], ['arpeggio', 'Pentatonic']])
    expect(lineModes('off').map((m) => m.label)).toEqual(['Off', 'Guide Tones', '7th Chords'])
  })
})

describe('the Triad pair line (#325)', () => {
  it('plays the arpeggio slot as the Triad pair line while Superimpose is Hexatonic', () => {
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'hexatonic', leave: 'b3', dir: 'up-down' })).toEqual({ kind: 'triad-pair', dir: 'up-down', arpeggio: 'down-2nd', shape: 'nearest' })
    expect(changesLineOf({ mode: 'guide', guide: 'seventh', arpeggio: 'down-2nd', overlay: 'hexatonic', leave: '1', dir: 'up' })).toBe('seventh')
  })
  it("names the slot Triad pair under the Hexatonic overlay; the value stays 'arpeggio'", () => {
    expect(lineModes('hexatonic').map((m) => [m.value, m.label])).toEqual([['off', 'Off'], ['guide', 'Guide Tones'], ['arpeggio', 'Triad pair']])
    expect(lineModes('quartal').map((m) => [m.value, m.label])).toEqual([['off', 'Off'], ['guide', 'Guide Tones'], ['arpeggio', 'Quartal']]) // #432
  })
})

describe('approachApplies (#381)', () => {
  it('leads the guide tone line under any Superimpose, the 7th Chords and Cells lines with none, never no line', () => {
    expect((['off', 'pentatonic', 'hexatonic'] as const).map((o) => approachApplies('guide', o))).toEqual([true, true, true])
    expect([approachApplies('arpeggio', 'off'), approachApplies('cells', 'off')]).toEqual([true, true])
    expect((['pentatonic', 'hexatonic'] as const).flatMap((o) => [approachApplies('arpeggio', o), approachApplies('cells', o)])).toEqual([false, false, false, false])
    expect(approachApplies('off', 'off')).toBe(false)
    expect([approachApplies('guide', 'quartal'), approachApplies('arpeggio', 'quartal'), approachApplies('cells', 'quartal')]).toEqual([true, false, false]) // #432
  })
})
