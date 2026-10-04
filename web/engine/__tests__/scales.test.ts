import { describe, expect, it } from 'vitest'
import { parseRoot, rootName } from '../pitch'
import { parseScale, scaleKey, simplifyRoot, spellFrom, spellScale } from '../scales'

const spelled = (text: string): string => {
  const { root, key } = parseScale(text)
  return spellScale(root, key).map(rootName).join(' ')
}

describe('scales', () => {
  it('spells scales from their formulas', () => {
    expect(spelled('C Dorian')).toBe('C D Eb F G A Bb')
    expect(spelled('D Half-Whole')).toBe('D Eb F F# G# A B C')
    expect(spelled('G Altered')).toBe('G Ab Bb B C# Eb F')
  })

  it('normalises names and resolves aliases', () => {
    expect(scaleKey('Half Whole Dim')).toBe('half whole diminished')
    expect(scaleKey('major')).toBe('ionian')
    expect(scaleKey('Locrian ♮2')).toBe('locrian natural 2')
    expect(parseScale('  Bb   dorian ')).toEqual({ root: { letter: 6, acc: -1 }, key: 'dorian' })
  })

  it('rejects unknown scales and missing names', () => {
    expect(() => parseScale('C Dorain')).toThrow(/unknown scale/)
    expect(() => parseScale('C constructor')).toThrow(/unknown scale/)
    expect(() => parseScale('C')).toThrow(/root and a name/)
    expect(spellFrom(parseRoot('C'), '0')).toEqual([{ letter: 6, acc: 0, semis: 11 }]) // degree 0 wraps like Python
  })

  it('simplifies roots by looking at the whole scale', () => {
    expect(rootName(simplifyRoot(parseRoot('Db'), 'dorian'))).toBe('C#') // Db Dorian needs Fb, Cb
    expect(rootName(simplifyRoot(parseRoot('D#'), 'dorian'))).toBe('Eb')
    expect(rootName(simplifyRoot(parseRoot('Gb')))).toBe('Gb') // tie keeps flat direction
    expect(rootName(simplifyRoot(parseRoot('E'), 'ionian'))).toBe('E')
  })
})
