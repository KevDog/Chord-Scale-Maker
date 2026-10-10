import { describe, expect, it } from 'vitest'
import { type Key, parseKey } from '../analysis/keys'
import { accidentalsInBar, keySignature, octaveOf, signatureAccidentals } from '../keySignature'
import { CONCERT, partFor } from '../part'

const key = (t: string): Key => parseKey(t) ?? (() => { throw new Error(t) })()

describe('keySignature', () => {
  it('writes the key for the part, minor keys by their relative major', () => {
    expect(keySignature(key('Eb'), CONCERT)).toBe('Eb')
    expect(keySignature(key('Eb'), partFor('tenor-sax'))).toBe('F')
    expect(keySignature(key('Eb'), partFor('alto-sax'))).toBe('C')
    expect(keySignature(key('Gm'), CONCERT)).toBe('Bb')
    expect(keySignature(key('Gm'), partFor('trumpet'))).toBe('C')
    expect(keySignature(key('F#'), CONCERT)).toBe('F#')
    expect(keySignature(key('Gb'), CONCERT)).toBe('Gb')
    expect(keySignature(null, CONCERT)).toBeNull()
  })

  it('never names a signature VexFlow lacks', () => {
    expect(keySignature(key('A#'), CONCERT)).toBe('Bb')
    expect(keySignature(key('D#'), CONCERT)).toBe('Eb')
    expect(keySignature(key('B'), partFor('tenor-sax'))).toBe('Db') // C# major has 7 sharps; Db 5 flats
  })
})

describe('signatureAccidentals', () => {
  it('lists the letters a signature alters', () => {
    expect([...signatureAccidentals('Eb')].sort()).toEqual([[2, -1], [5, -1], [6, -1]]) // E, A, B
    expect([...signatureAccidentals('D')].sort()).toEqual([[0, 1], [3, 1]]) // C#, F#
    expect(signatureAccidentals('C').size).toBe(0)
    expect(signatureAccidentals(null).size).toBe(0)
  })
})

describe('accidentalsInBar', () => {
  it('shows only what leaves the key: D Dorian in Eb needs just the B natural', () => {
    // D E F G A B C (octave 4)
    const notes = [1, 2, 3, 4, 5, 6, 0].map((letter, i) => ({ letter: letter as 0, acc: 0, octave: i === 6 ? 5 : 4 }))
    expect(accidentalsInBar(notes, 'Eb')).toEqual([null, 'n', null, null, 'n', 'n', null])
  })

  it('keeps an accidental in force through the bar on its line and octave only', () => {
    const n = (letter: number, acc: number, octave = 4) => ({ letter: letter as 0, acc, octave })
    expect(accidentalsInBar([n(2, -1), n(2, 0)], 'C')).toEqual(['b', 'n'])
    expect(accidentalsInBar([n(2, -1), n(2, -1, 5)], 'C')).toEqual(['b', 'b'])
    expect(accidentalsInBar([n(2, -1), n(2, -1)], 'C')).toEqual(['b', null])
  })

  it('shows nothing on a note tied in from the bar before', () => {
    expect(accidentalsInBar([{ letter: 6, acc: 0, octave: 4, tiedIn: true }], 'F')).toEqual([null])
  })

  it('reads a pitched note the way VexFlow places it', () => {
    expect(octaveOf({ letter: 0, acc: 0, midi: 60 })).toBe(4)
    expect(octaveOf({ letter: 6, acc: 1, midi: 72 })).toBe(4) // B#4 sounds as C5
  })
})
