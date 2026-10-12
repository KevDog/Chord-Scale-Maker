import { describe, expect, it } from 'vitest'
import { lineChoiceOf, sheetLineOf } from '~/utils/sheetLine'

describe('sheetLineOf', () => {
  it('composes the mode with its own detail', () => {
    expect(sheetLineOf('off', 'seventh', 'down-2nd', true)).toBe('off')
    expect(sheetLineOf('guide', 'seventh', 'down-2nd', true)).toBe('seventh')
    expect(sheetLineOf('arpeggio', 'seventh', 'down-2nd', true)).toBe('down-2nd')
  })
  it('flag off: a saved arpeggio mode shows no line', () => {
    expect(sheetLineOf('arpeggio', 'third', 'up-root', false)).toBe('off')
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
