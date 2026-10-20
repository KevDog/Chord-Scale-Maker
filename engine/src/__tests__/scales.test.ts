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
    expect(spelled('C Augmented')).toBe('C D# E G G# B') // two augmented triads a minor third apart (#432)
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

describe('eight-note scales: lettered without C♭ F♭ B♯ E♯ or double accidentals (#281)', () => {
  const EIGHTS = ['bebop dominant', 'bebop major', 'bebop dorian', 'spanish phrygian'] as const
  const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
  const ugly = (n: { letter: number; acc: number }): boolean =>
    Math.abs(n.acc) > 1 || (n.acc === 1 && (n.letter === 6 || n.letter === 2)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3))

  it('letters the passing tone on a root the formula spells badly', () => {
    expect(spelled('Db Bebop Dominant')).toBe('Db Eb F Gb Ab Bb B C') // ♭7 and 7 as B C, not C♭ C
    expect(spelled('F# Bebop Dominant')).toBe('F# G# A# B C# D# E F') // not E♯
    expect(spelled('Db Bebop Major')).toBe('Db Eb F Gb Ab A Bb C') // not B𝄫
    expect(spelled('Ab Bebop Major')).toBe('Ab Bb C Db Eb E F G') // not F♭
    expect(spelled('Ab Bebop Dorian')).toBe('Ab Bb B C Db Eb F Gb') // not C♭
    expect(spelled('Bb Spanish Phrygian')).toBe('Bb B Db D Eb F Gb Ab') // not C♭
  })

  it('keeps the formula’s letters where they spell cleanly', () => {
    expect(spelled('G Bebop Dominant')).toBe('G A B C D E F F#')
    expect(spelled('C Bebop Major')).toBe('C D E F G Ab A B')
    expect(spelled('E Spanish Phrygian')).toBe('E F G G# A B C D')
  })

  it('prefers a root the formula letters cleanly, then keeps the written side', () => {
    expect(rootName(simplifyRoot(parseRoot('A#'), 'bebop dominant'))).toBe('Bb') // not A♯ C D D♯ …
    expect(rootName(simplifyRoot(parseRoot('D#'), 'bebop dominant'))).toBe('Eb')
    expect(rootName(simplifyRoot(parseRoot('Db'), 'bebop dominant'))).toBe('Db')
    expect(rootName(simplifyRoot(parseRoot('Gb'), 'bebop dominant'))).toBe('Gb')
  })

  it('spells every root as simplifyRoot gives it with no double accidental and no B♯ E♯ C♭ F♭', () => {
    for (const key of EIGHTS)
      for (const name of ROOTS) {
        const notes = spellScale(simplifyRoot(parseRoot(name), key), key)
        expect(notes.filter(ugly).map(rootName), `${name} ${key}`).toEqual([])
      }
  })
})

describe('symmetric diminished scales: lettered without double accidentals (#279)', () => {
  const DIMS = ['half whole diminished', 'whole half diminished'] as const
  const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
  const ugly = (n: { letter: number; acc: number }): boolean =>
    Math.abs(n.acc) > 1 || (n.acc === 1 && (n.letter === 6 || n.letter === 2)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3))

  it('letters a root the formula spells badly with the same notes, kept on the flat side', () => {
    expect(spelled('Db Half-Whole')).toBe('Db D E F G Ab Bb B') // not D♭ E𝄫 F♭ F G A♭ B♭ C♭: Db7#9 in All the Things You Are
    expect(spelled('Gb Half-Whole')).toBe('Gb G A Bb C Db Eb E')
    expect(spelled('Db Whole-Half')).toBe('Db Eb E Gb G A Bb C')
    expect(spelled('B Half-Whole')).toBe('B C D D# F F# G# A') // not E♯
  })

  it('keeps the formula’s letters where they spell cleanly', () => {
    expect(spelled('D Half-Whole')).toBe('D Eb F F# G# A B C')
    expect(spelled('C Whole-Half')).toBe('C D Eb F Gb Ab A B')
  })

  it('keeps a written root it can now spell cleanly', () => {
    expect(rootName(simplifyRoot(parseRoot('Db'), 'half whole diminished'))).toBe('Db')
    expect(rootName(simplifyRoot(parseRoot('Gb'), 'whole half diminished'))).toBe('Gb')
  })

  it('spells every root as simplifyRoot gives it with no double accidental and no B♯ E♯ C♭ F♭', () => {
    for (const key of DIMS)
      for (const name of ROOTS) {
        const notes = spellScale(simplifyRoot(parseRoot(name), key), key)
        expect(notes.filter(ugly).map(rootName), `${name} ${key}`).toEqual([])
      }
  })

  it('letters the augmented scale cleanly on every root, keeping the written side (#432)', () => {
    expect(spelled('A Augmented')).toBe('A C C# E F G#') // not B♯ and E♯
    expect(spelled('Db Augmented')).toBe('Db E F Ab A C')
    for (const name of ROOTS) {
      const notes = spellScale(simplifyRoot(parseRoot(name), 'augmented'), 'augmented')
      expect(notes.filter(ugly).map(rootName), name).toEqual([])
      expect(simplifyRoot(parseRoot(name), 'augmented').acc, name).toBe(parseRoot(name).acc)
    }
  })

  it('never spells a written root worse than its formula does', () => {
    for (const key of DIMS)
      for (const name of ROOTS) {
        const root = parseRoot(name)
        const doubles = (ns: readonly { acc: number }[]): number => ns.filter((n) => Math.abs(n.acc) > 1).length
        const formula = spellFrom(root, SCALES[key][0])
        const shown = spellScale(root, key)
        expect(shown.map((n) => n.semis), `${name} ${key}`).toEqual(formula.map((n) => n.semis))
        expect(doubles(shown), `${name} ${key}`).toBeLessThanOrEqual(doubles(formula))
        expect(shown.filter(ugly).length, `${name} ${key}`).toBeLessThanOrEqual(formula.filter(ugly).length)
      }
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
    expect(samePitchScale('F# Whole-Half Diminished', 'Gb Whole-Half Diminished')).toBe(true) // time-after-time's G♭°7
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
