import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, instrumentLabel, isInstrumentName } from '../instruments'
import { partFor } from '../part'

describe('instruments', () => {
  it('labels every instrument for the page subtitle', () => {
    // the name in title case, then the key unless it is C; concert -> ""
    const labels: Record<string, string> = {
      concert: '', piano: 'Piano', vibes: 'Vibes', flute: 'Flute', guitar: 'Guitar',
      trumpet: 'Trumpet (Bb)', flugelhorn: 'Flugelhorn (Bb)', clarinet: 'Clarinet (Bb)',
      'soprano-sax': 'Soprano Sax (Bb)', 'tenor-sax': 'Tenor Sax (Bb)', 'alto-sax': 'Alto Sax (Eb)',
      'bari-sax': 'Bari Sax (Eb)', horn: 'Horn (F)', trombone: 'Trombone', tuba: 'Tuba', bass: 'Bass',
    }
    expect(Object.keys(labels).sort()).toEqual(Object.keys(INSTRUMENTS).sort())
    for (const [name, label] of Object.entries(labels)) if (isInstrumentName(name)) expect(instrumentLabel(name), name).toBe(label)
  })

  it('maps instruments to the part they read', () => {
    expect(partFor('trumpet')).toEqual({ clef: 'treble', trans: 'Bb' })
    expect(partFor('bari-sax')).toEqual({ clef: 'treble', trans: 'Eb' })
    expect(partFor('tuba')).toEqual({ clef: 'bass', trans: 'C' })
  })

  it('recognises instrument names safely', () => {
    expect(isInstrumentName('tenor-sax')).toBe(true)
    expect(isInstrumentName('kazoo')).toBe(false)
    expect(isInstrumentName('constructor')).toBe(false)
    expect(Object.keys(INSTRUMENTS)).toHaveLength(16)
  })
})
