import { describe, expect, it } from 'vitest'
import { isOverlay, overlayChoices, overlayInForce, overlayTitle } from '~/utils/overlay'

const flags = (pentatonics: boolean, hexatonics: boolean) => ({ pentatonics, hexatonics })

describe('the overlay', () => {
  it('reads Off, Pentatonic and Hexatonic, nothing else', () => {
    expect(['off', 'pentatonic', 'hexatonic', 'on', ''].map(isOverlay)).toEqual([true, true, true, false, false])
  })

  it('plays an overlay only with its flag', () => {
    expect(overlayInForce('hexatonic', flags(true, false))).toBe('off')
    expect(overlayInForce('pentatonic', flags(false, true))).toBe('off')
    expect(overlayInForce('hexatonic', flags(false, true))).toBe('hexatonic')
    expect(overlayInForce('pentatonic', flags(true, false))).toBe('pentatonic')
    expect(overlayInForce('off', flags(true, true))).toBe('off')
  })

  it('offers Off and each option whose flag is on', () => {
    expect(overlayChoices(flags(true, true)).map((c) => c.label)).toEqual(['Off', 'Pentatonic', 'Hexatonic'])
    expect(overlayChoices(flags(false, true)).map((c) => c.value)).toEqual(['off', 'hexatonic'])
    expect(overlayChoices(flags(true, false)).map((c) => c.value)).toEqual(['off', 'pentatonic'])
  })

  it('titles the listbox with the options on offer only', () => {
    const title = (p: boolean, h: boolean) => overlayTitle(overlayChoices(flags(p, h)))
    expect(title(true, false)).toMatch(/pentatonic/)
    expect(title(true, false)).not.toMatch(/hexatonic/)
    expect(title(false, true)).toMatch(/hexatonic/)
    expect(title(false, true)).not.toMatch(/pentatonic/)
    expect(title(true, true)).toMatch(/pentatonic.*, or .*hexatonic/)
    expect(title(false, false)).toBe('A row under the chords')
  })
})
