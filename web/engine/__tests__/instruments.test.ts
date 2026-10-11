import { describe, expect, it } from 'vitest'
import { CAPS, INSTRUMENTS, instrumentLabel, isInstrumentName } from '../instruments'
import { CONCERT, partFor, rangeOf } from '../part'
import { RANGES } from '../voiceLeading'

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

  it('maps instruments to the part they read, with their guide tone range', () => {
    expect(partFor('trumpet')).toEqual({ clef: 'treble', trans: 'Bb', range: { lo: 55, hi: 79, centre: 70 } })
    expect(partFor('bari-sax')).toEqual({ clef: 'treble', trans: 'Eb', range: { lo: 58, hi: 84, centre: 68 } })
    expect(partFor('tuba')).toEqual({ clef: 'bass', trans: 'C', range: { lo: 36, hi: 58, centre: 47 } })
  })

  it('gives every instrument the range the spec lists (written MIDI; C4 = 60)', () => {
    const ranges = Object.fromEntries(Object.entries(INSTRUMENTS).map(([name, i]) => [name, [i.range.lo, i.range.hi, i.range.centre]]))
    expect(ranges).toEqual({
      concert: [60, 81, 69], piano: [60, 84, 70], vibes: [55, 86, 70], flute: [60, 84, 73], guitar: [57, 81, 63],
      trumpet: [55, 79, 70], flugelhorn: [55, 79, 70], clarinet: [57, 84, 66],
      'soprano-sax': [58, 84, 68], 'alto-sax': [58, 84, 68], 'tenor-sax': [58, 84, 68], 'bari-sax': [58, 84, 68],
      horn: [60, 79, 70], trombone: [40, 64, 56], tuba: [36, 58, 47], bass: [40, 60, 49],
    })
  })

  it('keeps every range inside its clef’s two-ledger-line cap, with its centre inside the range', () => {
    expect(CAPS).toEqual({ treble: { lo: 55, hi: 86 }, bass: { lo: 35, hi: 65 } })
    for (const [name, { clef, range }] of Object.entries(INSTRUMENTS)) {
      expect(range.lo, name).toBeGreaterThanOrEqual(CAPS[clef].lo)
      expect(range.hi, name).toBeLessThanOrEqual(CAPS[clef].hi)
      expect(range.centre, name).toBeGreaterThanOrEqual(range.lo)
      expect(range.centre, name).toBeLessThanOrEqual(range.hi)
    }
  })

  it('a part without a range takes its clef’s default, today’s range', () => {
    expect(RANGES).toEqual({ treble: { lo: 60, hi: 81, centre: 69 }, bass: { lo: 40, hi: 60, centre: 49 } })
    expect(rangeOf(CONCERT)).toEqual(RANGES.treble)
    expect(rangeOf({ clef: 'treble', trans: 'Bb' })).toEqual(RANGES.treble)
    expect(rangeOf({ clef: 'bass', trans: 'C' })).toEqual(RANGES.bass)
    expect(rangeOf(partFor('vibes'))).toEqual({ lo: 55, hi: 86, centre: 70 })
  })

  it('recognises instrument names safely', () => {
    expect(isInstrumentName('tenor-sax')).toBe(true)
    expect(isInstrumentName('kazoo')).toBe(false)
    expect(isInstrumentName('constructor')).toBe(false)
    expect(Object.keys(INSTRUMENTS)).toHaveLength(16)
  })
})
