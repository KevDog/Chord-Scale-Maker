import { describe, expect, it } from 'vitest'
import { FUNCTIONS_KEYS, functionsKeyFrom, functionsKeyLabel, keyedLocation } from '~/utils/functionsKey'

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

  it('puts the key in the address, and points the router’s history entry at it', () => {
    const state = { back: '/', current: '/functions?key=Ebm#rule-m4', forward: null, position: 3 }
    expect(keyedLocation('https://x.test/functions?key=Ebm#rule-m4', state, 'F')).toEqual({
      url: 'https://x.test/functions?key=F#rule-m4',
      state: { back: '/', current: '/functions?key=F#rule-m4', forward: null, position: 3 },
    })
  })
  it('replaces a key that does not read, and keeps the rest of the query', () => {
    expect(keyedLocation('https://x.test/functions?key=H&x=1', null, 'C')).toEqual({ url: 'https://x.test/functions?key=C&x=1', state: { current: '/functions?key=C&x=1' } })
    expect(keyedLocation('https://x.test/functions?key=Eb&key=F', null, 'C')?.url).toBe('https://x.test/functions?key=C')
  })
  it('leaves an address that already has the key', () => {
    expect(keyedLocation('https://x.test/functions?key=Eb', {}, 'Eb')).toBeNull()
  })
})
