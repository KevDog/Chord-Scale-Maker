import { describe, expect, it } from 'vitest'
import { FUNCTIONS_KEYS, functionsKeyFrom, functionsKeyLabel } from '~/utils/functionsKey'

describe('the functions page key', () => {
  it('offers every Transpose key, major then minor', () => {
    expect(FUNCTIONS_KEYS.slice(0, 3)).toEqual(['C', 'Db', 'D'])
    expect(FUNCTIONS_KEYS).toContain('Ebm')
    expect(FUNCTIONS_KEYS).toHaveLength(26)
  })
  it('takes the query, then the stored choice, then C', () => {
    expect(functionsKeyFrom('Eb', 'Am')).toBe('Eb')
    expect(functionsKeyFrom(undefined, 'Am')).toBe('Am')
    expect(functionsKeyFrom(undefined, null)).toBe('C')
  })
  it('ignores a key that does not read, or is not offered', () => {
    expect(functionsKeyFrom('H', 'Am')).toBe('Am')
    expect(functionsKeyFrom('', null)).toBe('C')
    expect(functionsKeyFrom(['Eb', 'F'], null)).toBe('C')
    expect(functionsKeyFrom('Cb', 'zz')).toBe('C')
  })
  it('names each key with its mode', () => {
    expect(functionsKeyLabel('Eb')).toBe('E♭ major')
    expect(functionsKeyLabel('F#m')).toBe('F♯ minor')
  })
})
