import { describe, expect, it } from 'vitest'
import { type ChordToken, chordTokens, parseChord } from '../chord'
import { type Part, CONCERT } from '../part'

const BB: Part = { clef: 'treble', trans: 'Bb' }
/** compact view: accidentals as ♭/♯ */
const show = (tokens: readonly ChordToken[]): string =>
  tokens.map((t) => (t.kind === 'text' ? t.text : t.acc === 'b' ? '♭' : '♯')).join('')

describe('chord', () => {
  it('splits root, quality and bass', () => {
    expect(parseChord('D7/F#')).toEqual({ root: { letter: 1, acc: 0 }, quality: '7', bass: { letter: 3, acc: 1 } })
    expect(parseChord('C6/9')).toEqual({ root: { letter: 0, acc: 0 }, quality: '6/9' })
    expect(parseChord('C6/9/E').quality).toBe('6/9')
    expect(() => parseChord('X7')).toThrow(/cannot parse chord/)
  })

  it('formats minor, major and alterations', () => {
    expect(chordTokens(CONCERT, 'Cm7')).toEqual([{ kind: 'text', text: 'C–7' }])
    expect(show(chordTokens(CONCERT, 'Am7b5'))).toBe('A–7(♭5)')
    expect(show(chordTokens(CONCERT, 'G7#9b13'))).toBe('G7(♯9,♭13)')
    expect(show(chordTokens(CONCERT, 'Cmaj7'))).toBe('CMaj7')
    expect(show(chordTokens(CONCERT, 'Db7(b9)'))).toBe('D♭7(♭9)')
  })

  it('transposes root and bass, following the scale spelling', () => {
    expect(show(chordTokens(BB, 'D7/F#', 'D Half-Whole'))).toBe('E7/G♯')
    expect(show(chordTokens(BB, 'Bm7', 'B Dorian'))).toBe('C♯–7')
  })
})
