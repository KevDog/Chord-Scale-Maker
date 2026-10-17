import { describe, expect, it } from 'vitest'
import { INSTRUMENTS } from '@chord-scale-maker/engine'
import { guideRanges, INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'

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
    expect(instrumentOption('alto-sax')).toBe('Alto Sax')
  })
})

describe('guideRanges', () => {
  it('lists each written guide tone range from INSTRUMENTS, instruments sharing one range together, for the help page', () => {
    expect(guideRanges()).toBe(
      'piano F3–E6; vibes F3–F6; flute C4–C6; guitar A3–A5; trumpet, flugelhorn and horn G3–G5; clarinet A3–C6; soprano sax, tenor sax, alto sax and bari sax B♭3–C6; trombone E2–E4; tuba C2–B♭3; bass E2–C4',
    )
  })
})
