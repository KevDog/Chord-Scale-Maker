import { describe, expect, it } from 'vitest'
import { accFor, enharmonics, glyphs, mod, parseRoot, pcOf, rootName } from '../pitch'

describe('glyphs', () => {
  it('turns accidentals into music glyphs', () => {
    expect(glyphs('Eb')).toBe('E♭')
    expect(glyphs('F#')).toBe('F♯')
    expect(glyphs('Bb Mixolydian b6')).toBe('B♭ Mixolydian ♭6')
    expect(glyphs('Lydian #5')).toBe('Lydian ♯5')
    expect(glyphs('1 2 3 4 5 6 b7 7')).toBe('1 2 3 4 5 6 ♭7 7')
    expect(glyphs('bb7')).toBe('♭♭7') // double flat degree
    expect(glyphs('Cbb')).toBe('C♭♭') // double flat root
  })

  it('leaves the b inside a word alone (Bebop, not Be♭op)', () => {
    expect(glyphs('G Bebop Dominant')).toBe('G Bebop Dominant')
    expect(glyphs('Bb Bebop Dorian')).toBe('B♭ Bebop Dorian')
  })
})

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
