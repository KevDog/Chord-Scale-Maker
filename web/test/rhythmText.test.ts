import { describe, expect, it } from 'vitest'
import { rhythmTextError } from '~/utils/rhythmText'

describe('rhythmTextError', () => {
  it('says nothing for a valid rhythm, or for an empty box', () => {
    expect(rhythmTextError('8: >xx.x_')).toBe('')
    expect(rhythmTextError('8t: x__ | x..')).toBe('')
    expect(rhythmTextError('  ')).toBe('')
  })
  it('names the cells and pulses for text it cannot read', () => {
    expect(rhythmTextError('8: xq')).toBe('Use x, ., _ and > after 4:, 8:, 8t: or 16:')
    expect(rhythmTextError('32: x')).toBe('Use x, ., _ and > after 4:, 8:, 8t: or 16:')
    expect(rhythmTextError('x.x')).toBe('Use x, ., _ and > after 4:, 8:, 8t: or 16:')
  })
  it('asks for an x, or fewer cells, where the cells read but break those limits', () => {
    expect(rhythmTextError('8: ...')).toBe('At least one x, and at most 64 cells.')
    expect(rhythmTextError('8:')).toBe('At least one x, and at most 64 cells.')
    expect(rhythmTextError(`16: ${'x'.repeat(65)}`)).toBe('At least one x, and at most 64 cells.')
  })
})
