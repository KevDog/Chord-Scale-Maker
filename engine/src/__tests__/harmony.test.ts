import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import { type HarmonyBar, bassNotes, pianoNotes, voicingForms } from '../harmony'
import { CONCERT, partFor } from '../part'

/** a voicing's pitch classes as note names, low to high */
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const named = (pcs: readonly number[] | undefined) => pcs?.map((p) => NAMES[p]).join(' ')
const forms = (chord: string, scale: string | null) => voicingForms(chord, scale)?.map(named)

describe('voicingForms (decision hear.harmony)', () => {
  it('a minor 7th: the 3rd, 5th, 7th and 9th (A), or from the 7th (B)', () => {
    expect(forms('Dm7', 'D Dorian')).toEqual(['F A C E', 'C E F A'])
  })

  it('a dominant: 3rd, 13th, 7th and 9th, the tensions as its scale has them', () => {
    expect(forms('G7', 'G Mixolydian')).toEqual(['B E F A', 'F A B E'])
    expect(forms('G7alt', 'G Altered')).toEqual(['B Eb F Ab', 'F Ab B Eb'])
    expect(forms('G7b9', 'G Half-Whole Diminished')).toEqual(['B E F Ab', 'F Ab B E'])
    expect(forms('G7b13', 'G Mixolydian b6')).toEqual(['B Eb F A', 'F A B Eb'])
  })

  it('a major 7th: the 3rd, 5th, 7th and 9th; Lydian’s ♯11 in place of the 5th', () => {
    expect(forms('CMaj7', 'C Ionian')).toEqual(['E G B D', 'B D E G'])
    expect(forms('CMaj7', 'C Lydian')).toEqual(['E Gb B D', 'B D E Gb'])
  })

  it('a half-diminished: the 11th where its scale has no 9th', () => {
    expect(forms('Bm7b5', 'B Locrian')).toEqual(['D F A E', 'A E D F'])
    expect(forms('Bm7b5', 'B Locrian ♮2')).toEqual(['D F A Db', 'A Db D F'])
  })

  it('sus, 6 and diminished chords', () => {
    expect(forms('G7sus4', 'G Mixolydian')?.[0]).toBe('C D F A')
    expect(forms('C6', 'C Ionian')?.[0]).toBe('E G A D')
    expect(forms('Bdim7', 'B Whole-Half Diminished')?.[0]).toBe('D F Ab Db')
  })

  it('a slash chord read as another on its bass voices that one', () => {
    expect(forms('DbMaj7/C', 'C Phrygian')?.[0]).toBe('F G Bb Db')
  })

  it('with no scale, the chord’s own tones and a plain 9th', () => {
    expect(forms('Dm7', null)).toEqual(['F A C E', 'C E F A'])
  })

  it('N.C. or a chord it can’t read: none', () => {
    expect(voicingForms('N.C.', null)).toBeNull()
    expect(voicingForms('Hx9', null)).toBeNull()
  })
})

const ii_V_I = parseChart('title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n').value
const bars = (doc = ii_V_I, part = CONCERT): HarmonyBar[] => buildChanges(doc, part, 4, false, 'off').lines.flatMap((l) => l.bars)

describe('pianoNotes', () => {
  it('voice-leads ii–V–I: each chord the form and octave nearest the last', () => {
    const n = pianoNotes(bars())
    const at = (bar: number) => n.filter((x) => x.bar === bar).map((x) => x.midi)
    expect(at(0)).toEqual([53, 57, 60, 64]) // F3 A3 C4 E4
    expect(at(1)).toEqual([53, 57, 59, 64]) // F3 A3 B3 E4: only the C moves
    expect(at(2)).toEqual([52, 55, 59, 62]) // E3 G3 B3 D4
  })

  it('holds each chord to the next, and strikes it again at each bar it’s held through', () => {
    const n = pianoNotes(bars())
    expect(n.filter((x) => x.bar === 0).every((x) => x.at === 0 && x.beats === 4)).toBe(true)
    expect(n.filter((x) => x.bar === 3).map((x) => x.midi)).toEqual([52, 55, 59, 62])
  })

  it('two chords in a bar split it at the second’s beat', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n1 | G7\n2 | C6\n').value
    const n = pianoNotes(bars(doc)).filter((x) => x.bar === 0)
    expect(n.map((x) => [x.at, x.beats])).toEqual([...Array(4).fill([0, 2]), ...Array(4).fill([2, 2])])
  })

  it('sounds at concert pitch whatever the part: the sheet’s chords as the chart has them', () => {
    expect(pianoNotes(bars(ii_V_I, partFor('tenor-sax')))).toEqual(pianoNotes(bars()))
  })

  it('stays in the left hand’s middle: the lowest note C3 to C♯4, the top no higher than G5', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | C#m7\n2 | F#7\n3 | BMaj7\n4 | Bbm7\n5 | Eb7\n6 | AbMaj7\n7 | Gm7\n8 | C7\n').value
    const n = pianoNotes(bars(doc))
    for (let b = 0; b < 8; b++) {
      const m = n.filter((x) => x.bar === b).map((x) => x.midi)
      expect(Math.min(...m)).toBeGreaterThanOrEqual(48)
      expect(Math.min(...m)).toBeLessThanOrEqual(61)
      expect(Math.max(...m)).toBeLessThanOrEqual(79)
    }
  })

  it('a bar of N.C. is silent', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | N.C.\n').value
    expect(pianoNotes(bars(doc)).filter((x) => x.bar === 1)).toEqual([])
  })
})

describe('bassNotes', () => {
  it('Roots: each chord’s root at its start, held to the next, the nearest octave from E1 to C3', () => {
    const n = bassNotes(bars(), 'roots')
    expect(n.map((x) => [x.bar, x.at, x.beats, x.midi])).toEqual([
      [0, 0, 4, 38], // D2
      [1, 0, 4, 43], // G2
      [2, 0, 4, 36], // C2
      [3, 0, 4, 36],
    ])
  })

  it('Two-feel: the root on 1 and the 5th on 3 of a bar of one chord', () => {
    const n = bassNotes(bars(), 'two')
    expect(n.filter((x) => x.bar === 0).map((x) => [x.at, x.beats, x.midi])).toEqual([
      [0, 2, 38],
      [2, 2, 33], // A1, the 5th below
    ])
    const m7b5 = parseChart('title: T\nkey: C\n\nsection: A\n1 | Bm7b5\n').value
    expect(bassNotes(bars(m7b5), 'two').map((x) => x.midi % 12)).toEqual([11, 5]) // its 5th is flat
  })

  it('a slash chord plays its bass', () => {
    const doc = parseChart('title: T\nkey: C\n\nsection: A\n1 | C/E\n2 | DbMaj7/C\n').value
    expect(bassNotes(bars(doc), 'roots').map((x) => x.midi % 12)).toEqual([4, 0])
  })

  it('in 3/4, Two-feel plays the root for the bar', () => {
    const doc = parseChart('title: T\nkey: C\ntime: 3/4\n\nsection: A\n1 | Dm7\n').value
    expect(bassNotes(bars(doc), 'two').map((x) => [x.at, x.beats])).toEqual([[0, 3]])
  })
})
