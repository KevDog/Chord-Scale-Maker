import { describe, expect, it } from 'vitest'
import { intervalLabel, intervalLabels } from '../intervals'
import { parseRoot } from '../pitch'

const labels = (root: string, notes: string, quality: string | null) =>
  intervalLabels(parseRoot(root), notes.split(' ').map(parseRoot), quality)

describe('interval labels', () => {
  it('names chord tones and tensions as jazz players do', () => {
    expect(labels('G', 'G Ab Bb B C# Eb F', '7alt')).toEqual(['1', 'b9', '#9', '3', '#11', 'b13', 'b7']) // G Altered
    expect(labels('C', 'C D E F G A B', 'Maj7')).toEqual(['1', '9', '3', '11', '5', '13', '7'])
    expect(labels('D', 'D E F G A B C', 'm7')).toEqual(['1', '9', 'b3', '11', '5', '13', 'b7'])
  })

  it('labels a pentatonic from another root against the chord root', () => {
    expect(labels('G', 'Db Eb F Ab Bb', '7')).toEqual(['b5', 'b13', 'b7', 'b9', '#9']) // off the b5
    expect(labels('D', 'E G A B D', 'm7')).toEqual(['9', '11', '5', '13', '1'])
  })

  it('uses 4 on sus chords, 6 on sixth chords, and plain names when the quality is unknown', () => {
    expect(intervalLabel(parseRoot('G'), parseRoot('C'), '7sus4')).toBe('4')
    expect(intervalLabel(parseRoot('G'), parseRoot('C'), '7sus4b9')).toBe('4')
    expect(intervalLabel(parseRoot('C'), parseRoot('A'), '6')).toBe('6')
    expect(intervalLabel(parseRoot('C'), parseRoot('Eb'), null)).toBe('b3')
    expect(intervalLabel(parseRoot('C'), parseRoot('Ab'), 'dim7')).toBe('b13')
    expect(intervalLabel(parseRoot('C'), parseRoot('Bbb'), 'dim7')).toBe('bb7')
    expect(intervalLabel(parseRoot('C'), parseRoot('G#'), '7alt')).toBe('#5')
  })
})
