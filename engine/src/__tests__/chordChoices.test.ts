import { describe, expect, it } from 'vitest'
import { hexatonicChoices, pentatonicChoices, pickHeading , quartalChoices } from '../chordChoices'
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

describe('quartalChoices (#432)', () => {
  it('lists the stacks in Auto order, by their bottom note concert, with the guide tones each holds', () => {
    const c = quartalChoices('G7', 'G Mixolydian', CONCERT, 4, false)
    expect(c[0]).toMatchObject({ pc: 5, name: 'F B E A', degree: 7, guides: 2, label: 'F B E A · on 7 · 2 guide tones' })
    expect(quartalChoices('G7', 'G Mixolydian', CONCERT, 3, true).map((x) => x.name)).not.toContain('F B E')
  })
  it('keeps concert bottoms on a B♭ part', () => {
    expect(quartalChoices('G7', 'G Mixolydian', TENOR, 4, false)[0]).toMatchObject({ pc: 5, name: 'G C♯ F♯ B' })
  })
  it('gives nothing on a scale with no stacks', () => {
    expect(quartalChoices('C7', 'C Half-Whole', CONCERT, 4, false)).toEqual([])
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
  it("ends a dominant's list with its tritone sub's pairs, concert roots, named for the part (#432)", () => {
    const own = hexatonicChoices('G7', 'G Mixolydian', CONCERT).filter((c) => !c.from)
    const subs = hexatonicChoices('G7', 'G Mixolydian', CONCERT).slice(own.length)
    expect(subs.map((c) => c.label)).toEqual(['from D♭7: B/D♭ · covers 2', 'from D♭7: B♭m/B · covers 2'])
    expect(subs[0]).toMatchObject({ roots: [11, 1], from: 'D♭7', name: 'B/D♭' })
    expect(hexatonicChoices('G7', 'G Mixolydian', TENOR).find((c) => c.from)).toMatchObject({ roots: [11, 1], from: 'E♭7', name: 'D♭/E♭' })
    expect(hexatonicChoices('Cmaj7', 'C Ionian', CONCERT).some((c) => c.from)).toBe(false)
  })
})

it('heads a popover with the written chord and its scale’s name', () => {
  expect(pickHeading(CONCERT, 'Db7', 'Db Mixolydian')).toBe('D♭7 Mixolydian')
  expect(pickHeading(TENOR, 'Db7', 'Db Mixolydian')).toBe('E♭7 Mixolydian')
})
