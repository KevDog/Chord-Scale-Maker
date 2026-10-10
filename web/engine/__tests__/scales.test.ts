import { describe, expect, it } from 'vitest'
import { parseRoot, rootName } from '../pitch'
import { abbreviateScale, parseScale, SCALES, scaleKey, simplifyRoot, spellFrom, spellScale } from '../scales'

describe('abbreviateScale', () => {
  it('shortens long scale words, leaves roots/degrees/short names alone', () => {
    expect(abbreviateScale('Mixolydian')).toBe('Mixo')
    expect(abbreviateScale('Mixolydian b6')).toBe('Mixo b6')
    expect(abbreviateScale('Lydian Dominant')).toBe('Lyd Dom')
    expect(abbreviateScale('Major Pentatonic')).toBe('Major Pent')
    expect(abbreviateScale('Harmonic Minor')).toBe('Harm min')
    expect(abbreviateScale('Melodic Minor')).toBe('Mel min')
    expect(abbreviateScale('Half-Whole Diminished')).toBe('H/W Dim')
    expect(abbreviateScale('Bebop Dominant')).toBe('Bebop Dom')
    expect(abbreviateScale('Dorian')).toBe('Dorian')
    expect(abbreviateScale('Altered')).toBe('Altered')
  })
})

const spelled = (text: string): string => {
  const { root, key } = parseScale(text)
  return spellScale(root, key).map(rootName).join(' ')
}

describe('scales', () => {
  it('spells scales from their formulas', () => {
    expect(spelled('C Dorian')).toBe('C D Eb F G A Bb')
    expect(spelled('D Half-Whole')).toBe('D Eb F F# G# A B C')
    expect(spelled('G Altered')).toBe('G Ab Bb B C# Eb F')
    expect(spelled('D Dorian b2')).toBe('D Eb F G A B C')
    expect(spelled('G Mixolydian b6')).toBe('G A B C D Eb F') // mode 5 of melodic minor, not Phrygian Dominant
    expect(spelled('E Spanish Phrygian')).toBe('E F G G# A B C D') // Phrygian with the major 3rd too
  })

  it('normalises names and resolves aliases', () => {
    expect(scaleKey('Half Whole Dim')).toBe('half whole diminished')
    expect(scaleKey('major')).toBe('ionian')
    expect(scaleKey('Locrian ♮2')).toBe('locrian natural 2')
    expect(scaleKey('Phrygian ♮6')).toBe('dorian b2')
    expect(scaleKey('Aeolian Dominant')).toBe('mixolydian b6')
    for (const [key, [, label]] of Object.entries(SCALES)) expect(scaleKey(label)).toBe(key) // page labels parse back
    expect(parseScale('  Bb   dorian ')).toEqual({ root: { letter: 6, acc: -1 }, key: 'dorian' })
  })

  it('rejects unknown scales and missing names', () => {
    expect(() => parseScale('C Dorain')).toThrow(/unknown scale/)
    expect(() => parseScale('C constructor')).toThrow(/unknown scale/)
    expect(() => parseScale('C')).toThrow(/root and a name/)
    expect(spellFrom(parseRoot('C'), '0')).toEqual([{ letter: 6, acc: 0, semis: 11 }]) // degree 0 wraps to the 7th below
  })

  it('simplifies roots by looking at the whole scale', () => {
    expect(rootName(simplifyRoot(parseRoot('Db'), 'dorian'))).toBe('C#') // Db Dorian needs Fb, Cb
    expect(rootName(simplifyRoot(parseRoot('D#'), 'dorian'))).toBe('Eb')
    expect(rootName(simplifyRoot(parseRoot('Gb')))).toBe('Gb') // tie keeps flat direction
    expect(rootName(simplifyRoot(parseRoot('E'), 'ionian'))).toBe('E')
  })
})
