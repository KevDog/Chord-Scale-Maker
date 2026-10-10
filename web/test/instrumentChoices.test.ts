import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '~~/engine'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

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

  it('formats dropdown labels in title case', () => {
    expect(instrumentOption('tenor-sax')).toBe('Tenor Sax')
    expect(instrumentOption('concert')).toBe('Concert')
  })
})
