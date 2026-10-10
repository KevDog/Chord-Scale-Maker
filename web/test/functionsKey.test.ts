import { describe, expect, it } from 'vitest'
import { FUNCTIONS_KEYS, functionsKeyFrom, functionsKeyLabel, keyedLocation } from '~/utils/functionsKey'
import { CATALOGUE_KEYS, functionsTable, parseKey } from '~~/engine'

describe('the functions page key', () => {
  it('offers every Transpose major, then the minors as their key signatures spell them', () => {
    expect(FUNCTIONS_KEYS.slice(0, 3)).toEqual(['C', 'Db', 'D'])
    expect(FUNCTIONS_KEYS.slice(13)).toEqual(['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'])
    expect(FUNCTIONS_KEYS).toContain('C#m')
    expect(FUNCTIONS_KEYS).toContain('G#m')
    expect(FUNCTIONS_KEYS).not.toContain('Dbm')
    expect(FUNCTIONS_KEYS).not.toContain('Gbm')
    expect(FUNCTIONS_KEYS).toHaveLength(25)
  })
  it('offers only real key signatures, the ones the engine sweeps', () => {
    expect(FUNCTIONS_KEYS.filter((k) => !CATALOGUE_KEYS.includes(k))).toEqual([])
  })
  it('offers no key whose table spells a double accidental', () => {
    const doubled = /[A-G](bb|##)|𝄫|𝄪/
    const bad = FUNCTIONS_KEYS.flatMap((k) =>
      functionsTable(parseKey(k)!)
        .flatMap((r) => [r.chord, r.scale ?? '', r.reason])
        .filter((t) => doubled.test(t))
        .map((t) => `${k}: ${t}`),
    )
    expect(bad).toEqual([])
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
    expect(functionsKeyFrom(undefined, 'Dbm')).toBe('C')
  })
  it('names each key with its mode', () => {
    expect(functionsKeyLabel('Eb')).toBe('E♭ major')
    expect(functionsKeyLabel('F#m')).toBe('F♯ minor')
    expect(functionsKeyLabel('C#m')).toBe('C♯ minor')
    expect(functionsKeyLabel('G#m')).toBe('G♯ minor')
    expect(functionsKeyLabel('Bbm')).toBe('B♭ minor')
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
