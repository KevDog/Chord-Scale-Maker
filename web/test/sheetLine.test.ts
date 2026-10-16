import { describe, expect, it } from 'vitest'
import { changesLineOf, lineChoiceOf, lineModes, sheetLineOf } from '~/utils/sheetLine'

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

describe('the Pentatonic line (#284)', () => {
  it('plays the arpeggio slot as the Pentatonic line while Superimpose is Pentatonic, else as stored', () => {
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: 'b3', dir: 'up-down' })).toEqual({ kind: 'pentatonic', leave: 'b3', dir: 'up-down', arpeggio: 'down-2nd' })
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'hexatonic', leave: 'b3', dir: 'up' })).toBe('down-2nd')
    expect(changesLineOf({ mode: 'arpeggio', guide: 'third', arpeggio: 'down-2nd', overlay: 'off', leave: 'b3', dir: 'up' })).toBe('down-2nd')
    expect(changesLineOf({ mode: 'guide', guide: 'seventh', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: '1', dir: 'up' })).toBe('seventh')
    expect(changesLineOf({ mode: 'off', guide: 'seventh', arpeggio: 'down-2nd', overlay: 'pentatonic', leave: '1', dir: 'up' })).toBe('off')
  })
  it("names the slot Pentatonic under the Pentatonic overlay, 7th Chords otherwise; the value stays 'arpeggio'", () => {
    expect(lineModes('pentatonic').map((m) => [m.value, m.label])).toEqual([['off', 'Off'], ['guide', 'Guide Tones'], ['arpeggio', 'Pentatonic']])
    expect(lineModes('off').map((m) => m.label)).toEqual(['Off', 'Guide Tones', '7th Chords'])
    expect(lineModes('hexatonic').map((m) => m.label)).toEqual(['Off', 'Guide Tones', '7th Chords'])
  })
})
