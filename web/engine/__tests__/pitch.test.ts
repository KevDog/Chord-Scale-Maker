import { describe, expect, it } from 'vitest'
import { accFor, enharmonics, mod, parseRoot, pcOf, rootName } from '../pitch'

describe('pitch', () => {
  it('mod is always positive', () => {
    expect(mod(-1, 12)).toBe(11)
    expect(mod(13, 12)).toBe(1)
  })

  it('parses note names with ascii and unicode accidentals', () => {
    expect(parseRoot('Bb')).toEqual({ letter: 6, acc: -1 })
    expect(parseRoot('f#')).toEqual({ letter: 3, acc: 1 })
    expect(parseRoot('E♭♭')).toEqual({ letter: 2, acc: -2 })
    expect(() => parseRoot('H')).toThrow(/bad note name/)
  })

  it('names, pitch classes and accidentals', () => {
    expect(rootName({ letter: 1, acc: -1 })).toBe('Db')
    expect(pcOf({ letter: 0, acc: -1 })).toBe(11) // Cb
    expect(accFor(6, 3)).toBe(1) // pc 6 on F = F#
    expect(accFor(6, 4)).toBe(-1) // pc 6 on G = Gb
  })

  it('lists single-accidental enharmonics in letter order', () => {
    expect(enharmonics(parseRoot('F#')).map(rootName)).toEqual(['F#', 'Gb'])
    expect(enharmonics(parseRoot('F')).map(rootName)).toEqual(['E#', 'F'])
    expect(enharmonics(parseRoot('D')).map(rootName)).toEqual(['D'])
  })
})
