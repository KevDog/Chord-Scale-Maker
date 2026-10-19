import { describe, expect, it } from 'vitest'
import { hexatonicChoices, pentatonicChoices, pickHeading } from '../chordChoices'
import { CONCERT, type Part } from '../part'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }

describe('pentatonicChoices', () => {
  it('lists all 12 in pentatonicRanking order, labelled with degree and shared count', () => {
    const c = pentatonicChoices('Cmaj7', 'C Ionian', CONCERT)
    expect(c).toHaveLength(12)
    expect(c[0]).toMatchObject({ name: 'Dm', degree: 2, shared: 5, pc: 2, label: 'Dm pent · on 2 · 5 shared' }) // the ranking's Auto: of the three that share 5, fewest fifths from C
    expect(c.slice(0, 3).map((x) => x.name)).toEqual(['Dm', 'Am', 'Em'])
    expect(c.map((x) => x.shared)).toEqual([...c.map((x) => x.shared)].sort((a, b) => b - a))
  })
  it('orders inside → outside per chord: the minor pentatonic on 6 is inside on Cmaj7, not on Cm7, where the one on 1 leads', () => {
    const on6 = (chord: string, scale: string) => pentatonicChoices(chord, scale, CONCERT).find((x) => x.degree === 9)?.shared
    expect(on6('Cmaj7', 'C Ionian')).toBe(5)
    expect(on6('Cm7', 'C Dorian')).toBe(4)
    expect(pentatonicChoices('Cm7', 'C Dorian', CONCERT)[0]?.degree).toBe(0)
  })
  it('writes names for a B♭ part, keeps pitch classes concert', () => {
    const c = pentatonicChoices('Cmaj7', 'C Ionian', TENOR)[0]!
    expect([c.name, c.pc]).toEqual(['Em', 2]) // concert Dm, written a tone up
  })
  it('gives nothing for a scale it cannot read', () => {
    expect(pentatonicChoices('Cmaj7', 'C Nonsense', CONCERT)).toEqual([])
  })
})

describe('hexatonicChoices', () => {
  it('lists the pairs in Auto order with coverage', () => {
    const c = hexatonicChoices('Cmaj7', 'C Ionian', CONCERT)
    expect(c[0]).toMatchObject({ name: 'G/Am', roots: [7, 9], coverage: 4, label: 'G/Am · covers 4' })
    expect(c.map((x) => x.name)).toHaveLength(7)
  })
  it('keeps concert roots on a B♭ part', () => {
    expect(hexatonicChoices('Cmaj7', 'C Ionian', TENOR)[0]).toMatchObject({ name: 'A/Bm', roots: [7, 9] })
  })
  it('gives nothing where the scale has no pairs', () => {
    expect(hexatonicChoices('C6', 'C Major Pentatonic', CONCERT)).toEqual([])
  })
})

it('heads a popover with the written chord and its scale’s name', () => {
  expect(pickHeading(CONCERT, 'Db7', 'Db Mixolydian')).toBe('D♭7 Mixolydian')
  expect(pickHeading(TENOR, 'Db7', 'Db Mixolydian')).toBe('E♭7 Mixolydian')
})
