import { describe, expect, it } from 'vitest'
import { type Mode, type Part, CONCERT, lilyNote, resolveStart, scaleLabel, scaleNotes, writtenScale } from '../part'
import { rootName } from '../pitch'

const BB: Part = { clef: 'treble', trans: 'Bb' }
const EB: Part = { clef: 'treble', trans: 'Eb' }
const BASS: Part = { clef: 'bass', trans: 'C' }

const notes = (part: Part, scale: string, mode: Mode = 'root', start = 60): string =>
  scaleNotes(part, scale, mode, start).map(lilyNote).join(' ')
const root = (part: Part, scale: string): string => rootName(writtenScale(part, scale).root)

describe('part', () => {
  it('spells scales from the root in the clef range', () => {
    expect(notes(CONCERT, 'C Dorian')).toBe("c' d' ees' f' g' a' bes'")
    expect(notes(CONCERT, 'Bb Dorian')).toBe("bes c' des' ees' f' g' aes'")
    expect(notes(CONCERT, 'A Locrian')).toBe("a' bes' c'' d'' ees'' f'' g''")
    expect(notes(CONCERT, 'F Altered')).toBe("f' ges' aes' a' b' des'' ees''")
    expect(notes(BASS, 'C Dorian')).toBe('c d ees f g a bes')
  })

  it('spells scales from a fixed note', () => {
    expect(notes(CONCERT, 'F Mixolydian', 'from')).toBe("c' d' ees' f' g' a' bes'")
    expect(notes(CONCERT, 'B Dorian', 'from')).toBe("cis' d' e' fis' gis' a' b'")
    expect(notes(CONCERT, 'G Half-Whole', 'from', 63)).toBe("e' f' g' aes' bes' b' cis'' d''")
  })

  it('transposes roots with friendly spellings', () => {
    expect(root(BB, 'C Dorian')).toBe('D')
    expect(root(BB, 'B Dorian')).toBe('C#')
    expect(root(BB, 'E Mixolydian')).toBe('F#')
    expect(root(BB, 'C# Dorian')).toBe('Eb')
    expect(root(EB, 'C Dorian')).toBe('A')
    expect(root(EB, 'Eb Lydian')).toBe('C')
    expect(root(EB, 'Bb Dorian')).toBe('G')
  })

  it('labels scales with the written root', () => {
    expect(scaleLabel(BB, 'Bb Half-Whole')).toEqual({ root: { letter: 0, acc: 0 }, name: 'Half-Whole Dim.' })
  })

  it('resolves written start notes', () => {
    expect(resolveStart('treble', 'C')).toBe(60)
    expect(resolveStart('treble', 'Eb')).toBe(63)
    expect(resolveStart('treble', 'F#3')).toBe(54)
    expect(resolveStart('treble', 'Cb')).toBe(71)
    expect(resolveStart('bass', 'G')).toBe(55)
    expect(() => resolveStart('treble', 'X')).toThrow(/bad start note/)
  })
})
