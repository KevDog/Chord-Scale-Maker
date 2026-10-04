import { describe, expect, it } from 'vitest'
import { parseScale } from '~~/engine'
import { PICKER_SCALES, scaleChoices } from '~/utils/scaleChoices'

describe('scaleChoices', () => {
  it('splits the default from the alternates', () => {
    const c = scaleChoices('Cm7')
    expect(c).toMatchObject({ known: true, defaultScale: 'C Dorian' })
    expect(c.alternates.map((o) => o.scale)).toContain('Eb Major Pentatonic')
    expect(c.alternates.map((o) => o.scale)).not.toContain('C Dorian')
  })

  it('offers nothing for unknown or unreadable chords', () => {
    expect(scaleChoices('Cm7#5#9x')).toEqual({ known: false, defaultScale: null, alternates: [] })
    expect(scaleChoices('')).toEqual({ known: false, defaultScale: null, alternates: [] })
  })

  it('picker labels parse back to scales', () => {
    for (const name of PICKER_SCALES) expect(() => parseScale(`C ${name}`), name).not.toThrow()
  })
})
