import { describe, expect, it } from 'vitest'
import { isOverlay, OVERLAY_CHOICES } from '~/utils/overlay'

describe('the overlay', () => {
  it('reads Off, Pentatonic, Hexatonic and Quartal, nothing else', () => {
    expect(['off', 'pentatonic', 'hexatonic', 'quartal', 'on', ''].map(isOverlay)).toEqual([true, true, true, true, false, false])
  })

  it('offers Off, Pentatonic, Hexatonic and Quartal', () => {
    expect(OVERLAY_CHOICES.map((c) => c.label)).toEqual(['Off', 'Pentatonic', 'Hexatonic', 'Quartal'])
  })
})
