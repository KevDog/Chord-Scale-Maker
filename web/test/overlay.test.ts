import { describe, expect, it } from 'vitest'
import { isOverlay, OVERLAY_CHOICES } from '~/utils/overlay'

describe('the overlay', () => {
  it('reads Off, Pentatonic and Hexatonic, nothing else', () => {
    expect(['off', 'pentatonic', 'hexatonic', 'on', ''].map(isOverlay)).toEqual([true, true, true, false, false])
  })

  it('offers Off, Pentatonic and Hexatonic', () => {
    expect(OVERLAY_CHOICES.map((c) => c.label)).toEqual(['Off', 'Pentatonic', 'Hexatonic'])
  })
})
