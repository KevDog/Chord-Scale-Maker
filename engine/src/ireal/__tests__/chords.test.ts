import { describe, expect, it } from 'vitest'
import { irealChord } from '../chords'

describe('irealChord', () => {
  it.each([
    ['C', 'C'], ['C^', 'CMaj7'], ['C^7', 'CMaj7'], ['C^9', 'CMaj9'], ['C^7#11', 'CMaj7#11'], ['C^7#5', 'CMaj7#5'],
    ['C-', 'Cm'], ['C-7', 'Cm7'], ['C-6', 'Cm6'], ['C-9', 'Cm9'], ['C-11', 'Cm11'], ['C-^7', 'CmMaj7'], ['C-69', 'Cm6/9'],
    ['Ch', 'Cm7b5'], ['Ch7', 'Cm7b5'], ['Ch9', 'Cm7b5'], ['Co', 'Cdim'], ['Co7', 'Cdim7'], ['C+', 'C+'],
    ['C7', 'C7'], ['C7b9', 'C7b9'], ['C7alt', 'C7alt'], ['C13', 'C13'], ['C7sus', 'C7sus'], ['C7b9sus', 'C7sus4b9'],
    ['C69', 'C69'], ['Cadd9', 'Cadd9'], ['Bb^7/D', 'BbMaj7/D'], ['F#-7/E', 'F#m7/E'],
  ])('%s → %s', (ireal, ours) => expect(irealChord(ireal)).toEqual({ chord: ours }))

  it.each([
    ['C^13', 'CMaj9', 'C^13 written as CMaj9'],
    ['C-^9', 'CmMaj7', 'C-^9 written as CmMaj7'],
    ['C2', 'Cadd9', 'C2 written as Cadd9'],
    ['C5', 'C', 'C5 written as C'],
    ['C7susadd3', 'C7sus', 'C7susadd3 written as C7sus'],
    ['C7b13sus', 'C7sus', 'C7b13sus written as C7sus'],
  ])('%s is approximated as %s, with a note', (ireal, ours, note) => expect(irealChord(ireal)).toEqual({ chord: ours, note }))

  it('a quality the engine doesn’t know is dropped, with a note', () => {
    expect(irealChord('Co^7')).toEqual({ chord: null, note: 'Co^7: no chord like it here, left out' })
  })
})
