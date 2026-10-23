import { describe, expect, it } from 'vitest'
import { groupsTextError, isGearsRhythm, rhythmTextError, typedGroups } from '~/utils/rhythmText'

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
  it('says a hold can’t follow a rest', () => {
    expect(rhythmTextError('8: x._')).toBe('A _ holds a note, so it can’t follow a rest (.).')
    expect(rhythmTextError('8: x. | _x')).toBe('A _ holds a note, so it can’t follow a rest (.).')
  })
})

describe('rhythmTextError with the tuplet pulses (Phase 4 spec D8)', () => {
  it('reads them with the rhythmGears flag on, and says how to write one with it off', () => {
    expect(rhythmTextError('8q: x_x__', true)).toBe('')
    expect(rhythmTextError('8q: x_x__')).toBe('Use x, ., _ and > after 4:, 8:, 8t: or 16:')
    expect(rhythmTextError('32: x', true)).toBe('Use x, ., _ and > after 4:, 8:, 8t:, 16:, 4t:, 4q:, 8q:, 16q:, 16t: or 16s:')
    expect(rhythmTextError('16s: ...', true)).toBe('At least one x, and at most 64 cells.')
  })
})

describe('isGearsRhythm (Phase 4 spec D8)', () => {
  it('is true for a unit or your rhythm at a tuplet pulse, false for the old pulses, cards and off', () => {
    expect(['unit:8q:5:accents', 'unit:4t:3:rests', 'custom:16s:>xxxxxx'].map(isGearsRhythm)).toEqual([true, true, true])
    expect(['unit:8t:3:accents', 'run:16:4:0', 'card:upbeats', 'custom:8:x.x', 'off'].map(isGearsRhythm)).toEqual([false, false, false, false, false])
  })
})

describe('typedGroups and groupsTextError (Phase 4 spec §3, §7)', () => {
  it('reads 1 to 8 groups of 2 to 7, separated by spaces or commas', () => {
    expect(typedGroups('3 4 5')).toEqual([3, 4, 5])
    expect(typedGroups(' 7,6  5 ')).toEqual([7, 6, 5])
    expect(typedGroups('2 3 4 5 6 7 2 3')).toHaveLength(8)
    for (const bad of ['', '3 8', '1', '3.5', '3 x', '2 3 4 5 6 7 2 3 4']) expect(typedGroups(bad)).toBeNull()
  })

  it('says nothing for a valid list or an empty box, else how to write one', () => {
    expect(groupsTextError('3 4')).toBe('')
    expect(groupsTextError('  ')).toBe('')
    expect(groupsTextError('3 9')).toBe('Groups of 2 to 7, separated by spaces: up to 8 of them.')
  })
})
