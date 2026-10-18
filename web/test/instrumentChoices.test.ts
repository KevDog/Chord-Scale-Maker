import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '@chord-scale-maker/engine'
import { INSTRUMENT_GROUPS, instrumentOption, pitchOf } from '~/utils/instrumentChoices'

describe('instrumentChoices', () => {
  it('groups every instrument exactly once, by what it reads', () => {
    expect(INSTRUMENT_GROUPS.map((g) => g.label)).toEqual([
      'Concert Pitch (C)',
      'B♭ Instruments',
      'E♭ Instruments',
      'F Instruments',
      'Bass Clef (C)',
    ])
    expect(INSTRUMENT_GROUPS.flatMap((g) => g.instruments).sort()).toEqual(Object.keys(INSTRUMENTS).sort())
    expect(INSTRUMENT_GROUPS[1]?.instruments).toContain('tenor-sax')
    expect(INSTRUMENT_GROUPS[4]?.instruments).toEqual(['trombone', 'tuba', 'bass'])
  })

  it('names each group by its pitch, the first step of the picker (#417)', () => {
    expect(INSTRUMENT_GROUPS.map((g) => g.pitch)).toEqual(['Concert', 'B♭', 'E♭', 'F', 'Bass'])
    expect(pitchOf('tenor-sax')).toBe('B♭')
    expect(pitchOf('alto-sax')).toBe('E♭')
    expect(pitchOf('trombone')).toBe('Bass')
    expect(pitchOf('piano')).toBe('Concert')
  })

  it('formats dropdown labels in title case', () => {
    expect(instrumentOption('tenor-sax')).toBe('Tenor Sax')
    expect(instrumentOption('alto-sax')).toBe('Alto Sax')
  })
})
