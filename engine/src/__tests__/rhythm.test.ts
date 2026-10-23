import { describe, expect, it } from 'vitest'
import { barPulse, formatRhythm, parseRhythm, PULSE_GRID, PULSE_LABELS, PULSE_PER_BEAT, pulseBeat, PULSES, pulsesIn } from '../rhythm/rhythm'

describe('rhythm text form (spec §1, §2)', () => {
  it('lists the pulses', () => {
    expect(PULSES).toEqual(['4', '8', '8t', '16', '4t', '4q', '8q', '16q', '16t', '16s'])
    expect(PULSE_PER_BEAT).toEqual({ '4': 1, '8': 2, '8t': 3, '16': 4 })
    expect(PULSE_LABELS).toEqual({
      '4': 'Quarters',
      '8': '8ths',
      '8t': 'Triplets',
      '16': '16ths',
      '4t': 'Quarter-note triplets',
      '4q': 'Quarter-note quintuplets',
      '8q': '8th-note quintuplets',
      '16q': '16th quintuplets',
      '16t': 'Sextuplets',
      '16s': 'Septuplets',
    })
  })

  it('parses accents as one cell', () => {
    expect(parseRhythm('8: >xx.x_')).toEqual({ pulse: '8', cells: ['>x', 'x', '.', 'x', '_'] })
  })

  it('parses the tuplet pulses (Phase 4 spec §1)', () => {
    const r = parseRhythm('16s: >xxxxxxx')
    expect(r?.pulse).toBe('16s')
    expect(r?.cells).toHaveLength(7)
  })
})

describe('the pulse grid (Phase 4 spec §1, D11)', () => {
  it('follows the table', () => {
    expect(PULSE_GRID).toEqual({
      '4': { n: 1, beats: 1, value: 'q', tuplet: null, fallback: null },
      '8': { n: 2, beats: 1, value: '8', tuplet: null, fallback: null },
      '8t': { n: 3, beats: 1, value: '8', tuplet: { notes: 3, of: 2 }, fallback: null },
      '16': { n: 4, beats: 1, value: '16', tuplet: null, fallback: null },
      '4t': { n: 3, beats: 2, value: 'q', tuplet: { notes: 3, of: 2 }, fallback: '4' },
      '4q': { n: 5, beats: 4, value: 'q', tuplet: { notes: 5, of: 4 }, fallback: '4' },
      '8q': { n: 5, beats: 2, value: '8', tuplet: { notes: 5, of: 4 }, fallback: '8' },
      '16q': { n: 5, beats: 1, value: '16', tuplet: { notes: 5, of: 4 }, fallback: null },
      '16t': { n: 6, beats: 1, value: '16', tuplet: { notes: 6, of: 4 }, fallback: null },
      '16s': { n: 7, beats: 1, value: '16', tuplet: { notes: 7, of: 4 }, fallback: null },
    })
  })

  it('keeps the old pulses per beat', () => {
    for (const p of ['4', '8', '8t', '16'] as const) expect(PULSE_GRID[p].n / PULSE_GRID[p].beats).toBe(PULSE_PER_BEAT[p])
  })

  it("falls back where the pulse's group doesn't fit the bar", () => {
    expect(barPulse('4t', 3)).toBe('4')
    expect(barPulse('4t', 4)).toBe('4t')
    expect(barPulse('4q', 5)).toBe('4')
    expect(barPulse('16s', 3)).toBe('16s')
    expect(barPulse('8q', 3)).toBe('8')
  })

  it('counts the pulses in a bar', () => {
    expect(pulsesIn('4t', 4)).toBe(6)
    expect(pulsesIn('4t', 3)).toBe(3)
    expect(pulsesIn('8q', 4)).toBe(10)
    expect(pulsesIn('8q', 3)).toBe(6)
    expect(pulsesIn('16', 3)).toBe(12)
  })

  it("finds a pulse's beat", () => {
    expect(pulseBeat('8', 3)).toBe(1.5)
    expect(pulseBeat('4t', 3)).toBe(2)
    expect(pulseBeat('4q', 5)).toBe(4)
    expect(pulseBeat('16s', 7)).toBe(1)
  })
})

describe('rhythm text form, canonically (spec §2)', () => {

  it('parses accents as one cell', () => {
    expect(parseRhythm('8: >xx.x_')).toEqual({ pulse: '8', cells: ['>x', 'x', '.', 'x', '_'] })
  })

  it('formats canonically', () => {
    expect(formatRhythm(parseRhythm('8:  x x | . x')!)).toBe('8: xx.x')
    expect(formatRhythm(parseRhythm('16:>x x_')!)).toBe('16: >xx_')
  })

  it('round-trips every pulse', () => {
    for (const p of PULSES) expect(formatRhythm(parseRhythm(`${p}: x.>x_`)!)).toBe(`${p}: x.>x_`)
  })

  it('ignores | and spaces', () => {
    expect(parseRhythm('4: x | . | x x')).toEqual(parseRhythm('4:x.xx'))
  })

  it('reads the pulse with spaces round it, but only in lower case (#505)', () => {
    expect(parseRhythm(' 8 : x')).toEqual({ pulse: '8', cells: ['x'] })
    expect(parseRhythm('8t : x')).toEqual({ pulse: '8t', cells: ['x'] })
    expect(parseRhythm('8T: x')).toBeNull()
  })

  it('allows a leading tie', () => {
    expect(parseRhythm('8t: _xx')?.cells[0]).toBe('_')
  })

  it('allows a tie after a tie or an attack', () => {
    expect(parseRhythm('8: x__.x')).not.toBeNull()
  })

  it('bounds the length at 64 cells', () => {
    expect(parseRhythm(`8: ${'x'.repeat(64)}`)?.cells).toHaveLength(64)
    expect(parseRhythm(`8: ${'x'.repeat(65)}`)).toBeNull()
  })

  it('rejects anything invalid', () => {
    for (const bad of ['', '8:', '8: ...', '8: x>', '8: x._', '32: x', '8: xyz', '8: >.x', '8: >>x', 'x', '8 x', '8: . _ x']) {
      expect(parseRhythm(bad), bad).toBeNull()
    }
  })
})
