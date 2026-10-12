import { describe, expect, it } from 'vitest'
import { arpeggioTones } from '../arpeggios'
import { CONCERT } from '../part'
import { rootName } from '../pitch'
import { tensionsOf } from '../arpeggioSheet'

const names = (chord: string, scale: string): string[] =>
  tensionsOf(CONCERT, chord, scale, arpeggioTones(CONCERT, chord, scale) ?? []).map(rootName)

describe('tensionsOf', () => {
  it("stacks the scale's other notes as 9s, 11s, 13s", () => {
    expect(names('Cm7', 'C Dorian')).toEqual(['D', 'F', 'A'])
    expect(names('G7', 'G Altered')).toEqual(['Ab', 'Bb', 'C#', 'Eb'])
    expect(names('C7', 'C Half-Whole')).toEqual(['Db', 'Eb', 'F#', 'A'])
    expect(names('CMaj7', 'C Lydian')).toEqual(['D', 'F#', 'A'])
  })

  it('works for scales that are not seven notes', () => {
    expect(names('CMaj7', 'C Major Pentatonic')).toEqual(['D', 'A'])
    expect(names('C7', 'C Blues')).toEqual(['Eb', 'F', 'Gb']) // #9, 11, #11
  })

  it("puts a triad's or a 6 chord's 7th first", () => {
    expect(names('C', 'C Ionian')).toEqual(['B', 'D', 'F', 'A'])
    expect(names('C6', 'C Ionian')).toEqual(['B', 'D', 'F'])
  })

  it('spells for the part', () => {
    const part = { clef: 'treble', trans: 'Bb' } as const
    expect(tensionsOf(part, 'Cm7', 'C Dorian', arpeggioTones(part, 'Cm7', 'C Dorian') ?? []).map(rootName)).toEqual(['E', 'G', 'B'])
  })
})
