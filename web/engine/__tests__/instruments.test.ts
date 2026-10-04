import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, instrumentLabel, isInstrumentName } from '../instruments'
import { partFor } from '../part'

describe('instruments', () => {
  it('labels instruments like the CLI subtitle', () => {
    expect(instrumentLabel('concert')).toBe('')
    expect(instrumentLabel('piano')).toBe('Piano')
    expect(instrumentLabel('tenor-sax')).toBe('Tenor Sax (Bb)')
    expect(instrumentLabel('alto-sax')).toBe('Alto Sax (Eb)')
    expect(instrumentLabel('horn')).toBe('Horn (F)')
    expect(instrumentLabel('trombone')).toBe('Trombone')
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
