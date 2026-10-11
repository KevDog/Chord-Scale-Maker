import { describe, expect, it } from 'vitest'
import { parseRoot, rootName } from '../pitch'
import { abbreviateScale, cleanLettering, parseScale, samePitchScale, SCALES, scaleKey, simplifyRoot, spellFrom, spellScale } from '../scales'

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

  it('spells the diatonic diminished scales as M&H’s figures (R3b)', () => {
    expect(spelled('C# Diatonic Diminished')).toBe('C# D E F G A Bb C') // ascending vii°7 of Dm7: A7♭9♯9♭13 from the C♯
    expect(spelled('C# Leading-Tone Diminished')).toBe('C# D E F G A Bb C')
    expect(spelled('Eb Diatonic Diminished bIII')).toBe('Eb E Gb G A B C D') // fig. 7.22 (Q1a)
    expect(spelled('Eb Diatonic Diminished bIII optional')).toBe('Eb F Gb G A B C D') // fig. 7.23, the menu's option
    expect(spelled('Bb Diatonic Diminished bVI')).toBe('Bb B C# D E F# G A') // fig. 7.27, Wave in D
    expect(spelled('C Diatonic Diminished I')).toBe('C D Eb E Gb G A B') // fig. 7.31, first (Q2a)
    expect(spelled('C Diatonic Diminished I optional')).toBe('C D Eb F Gb G A B') // fig. 7.31, second
    expect(spelled('G Diatonic Diminished V')).toBe('G A Bb C Db D E F') // fig. 7.34
    expect(spelled('F# Diatonic Diminished #IV')).toBe('F# G A B C D Eb E') // fig. 7.13, ♯IV°7 to I/5
    expect(spelled('F# Diatonic Diminished #IV optional')).toBe('F# G A B C D Eb F') // fig. 7.14, with the major 7th
    expect(spellFrom(parseRoot('C#'), 'b8').map((n) => n.semis)).toEqual([11]) // an 8th is an octave above the root
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

describe('cleanLettering (R9): a scale on a pitch, on the root the project rule spells best', () => {
  const at = (root: string, key: Parameters<typeof cleanLettering>[1]) => {
    const r = cleanLettering(parseRoot(root), key)
    return `${rootName(r.root)} ${r.name ?? r.key}`
  }

  it('takes simplifyRoot’s root where it spells the formula cleanly', () => {
    expect(at('Eb', 'diatonic diminished')).toBe('D# diatonic diminished') // E♭ ascending needs F♭ and double flats
    expect(at('Bb', 'diatonic diminished bvi')).toBe('Bb diatonic diminished bvi')
    expect(at('Eb', 'diatonic diminished biii')).toBe('Eb diatonic diminished biii')
    expect(at('Gb', 'dorian')).toBe('F# dorian')
  })

  it('letters ♭III°7’s and ♭VI°7’s notes as the ascending formula where no root of theirs spells cleanly (fig. 7.22)', () => {
    expect(at('Cb', 'diatonic diminished biii')).toBe('B Diatonic Diminished') // not C♭ C E𝄫 E♭ …
    expect(at('A', 'diatonic diminished bvi')).toBe('A Diatonic Diminished') // not A A♯ B♯ C♯ D♯ E♯ …
  })

  it('keeps a formula with no same-pitch lettering as simplifyRoot gives it', () => {
    expect(at('D', 'diatonic diminished #iv')).toBe('D diatonic diminished #iv')
  })
})

describe('samePitchScale (R18): the same menu entry, however its root is spelled', () => {
  it('matches the same scale on an enharmonically equal root, however the name is written', () => {
    expect(samePitchScale('F# Whole-Half Diminished', 'Gb Whole-Half Diminished')).toBe(true) // time_after_time's G♭°7
    expect(samePitchScale('D# Diatonic Diminished', 'Eb Diatonic Diminished')).toBe(true)
    expect(samePitchScale('D Half-Whole', 'D Half-Whole Diminished')).toBe(true)
  })

  it('does not match another root, another scale, or text it cannot read', () => {
    expect(samePitchScale('G Whole-Half Diminished', 'Gb Whole-Half Diminished')).toBe(false)
    expect(samePitchScale('F# Half-Whole Diminished', 'Gb Whole-Half Diminished')).toBe(false)
    expect(samePitchScale('F# Whole-Half Diminished', null)).toBe(false)
    expect(samePitchScale('F# Nonsense', 'F# Nonsense')).toBe(true) // the same text is the same entry
    expect(samePitchScale('F# Nonsense', 'Gb Nonsense')).toBe(false)
  })
})
