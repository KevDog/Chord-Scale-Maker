import { describe, expect, it } from 'vitest'
import { formatRhythm, parseRhythm, PULSE_LABELS, PULSE_PER_BEAT, PULSES } from '../rhythm/rhythm'

describe('rhythm text form (spec §1, §2)', () => {
  it('lists the pulses', () => {
    expect(PULSES).toEqual(['4', '8', '8t', '16'])
    expect(PULSE_PER_BEAT).toEqual({ '4': 1, '8': 2, '8t': 3, '16': 4 })
    expect(PULSE_LABELS).toEqual({ '4': 'Quarters', '8': '8ths', '8t': 'Triplets', '16': '16ths' })
  })

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
