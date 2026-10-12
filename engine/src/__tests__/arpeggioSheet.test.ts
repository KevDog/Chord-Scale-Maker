import { describe, expect, it } from 'vitest'
import { arpeggioTones } from '../arpeggios'
import { CONCERT, rangeOf } from '../part'
import { rootName } from '../pitch'
import { arpeggioLine, ARP_DIRECTION_LABELS, ARP_NOTES_LABELS, isArpDirection, isArpNotes, tensionsOf } from '../arpeggioSheet'

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

const line = (chord: string, scale: string | null, notes: 'seventh' | 'extended', dir: 'up' | 'down' | 'up-down', part = CONCERT) => {
  const l = arpeggioLine(part, chord, scale, notes, dir)
  if ('error' in l) throw new Error(l.error)
  return l
}

describe('arpeggioLine', () => {
  it('plays the 7th chord up, down, and up and down without repeating the top', () => {
    expect(line('Cm7', 'C Dorian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb'])
    expect(line('Cm7', 'C Dorian', 'seventh', 'down').notes.map(rootName)).toEqual(['Bb', 'G', 'Eb', 'C'])
    const ud = line('Cm7', 'C Dorian', 'seventh', 'up-down')
    expect(ud.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'G', 'Eb', 'C'])
    expect(ud.groups).toEqual([4, 3])
  })

  it('adds the tensions above, beamed apart', () => {
    const up = line('Cm7', 'C Dorian', 'extended', 'up')
    expect(up.notes.map(rootName)).toEqual(['C', 'Eb', 'G', 'Bb', 'D', 'F', 'A'])
    expect(up.groups).toEqual([4, 3])
    expect(up.notes.every((n, i) => i === 0 || n.midi > (up.notes[i - 1]?.midi ?? 0))).toBe(true)
    expect(line('Cm7', 'C Dorian', 'extended', 'down').groups).toEqual([3, 4])
    const ud = line('Cm7', 'C Dorian', 'extended', 'up-down')
    expect(ud.notes).toHaveLength(13)
    expect(ud.groups).toEqual([4, 3, 2, 4])
  })

  it("plays a triad's root on top in 7th Chord mode", () => {
    expect(line('C', 'C Ionian', 'seventh', 'up').notes.map(rootName)).toEqual(['C', 'E', 'G', 'C'])
  })

  it('needs a scale only for Extended', () => {
    expect(line('Cm7', null, 'seventh', 'up').notes).toHaveLength(4)
    expect(arpeggioLine(CONCERT, 'Cm7', null, 'extended', 'up')).toEqual({ error: 'Choose a scale' })
    expect(arpeggioLine(CONCERT, 'Xyz', 'C Dorian', 'seventh', 'up')).toEqual({ error: 'No chord tones for Xyz' })
  })

  it("places the run at the fewest notes out of the instrument's range", () => {
    for (const part of [{ clef: 'bass', trans: 'C' }, { clef: 'treble', trans: 'Bb' }] as const) {
      const r = rangeOf(part)
      const midis = line('G7', 'G Altered', 'extended', 'up', part).notes.map((n) => n.midi)
      const outBy = (shift: number): number => midis.filter((m) => m + shift < r.lo || m + shift > r.hi).length
      const base = outBy(0)
      expect(base).toBeLessThanOrEqual(2)
      expect(outBy(12)).toBeGreaterThanOrEqual(base)
      expect(outBy(-12)).toBeGreaterThanOrEqual(base)
    }
  })

  it('has labels and guards', () => {
    expect(Object.values(ARP_NOTES_LABELS)).toEqual(['7th Chord', 'Extended'])
    expect(Object.values(ARP_DIRECTION_LABELS)).toEqual(['Up', 'Down', 'Up & down'])
    expect([isArpNotes('extended'), isArpNotes('up'), isArpDirection('up-down'), isArpDirection('x')]).toEqual([true, false, true, false])
  })
})
