import { describe, expect, it } from 'vitest'
import { ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, arpeggioOrder, arpeggioTones, arpeggioVoices, isArpeggioPattern, isSheetLine, noteValue } from '../arpeggios'
import type { GuideInput, GuideNote } from '../guideTones'
import { clockOf, type Metre } from '../metre'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import chordScales from '../../chord_scales.json'
import { toVexKey } from '../sheet'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const names = (chord: string, part: Part = CONCERT) => arpeggioTones(part, chord)?.map(rootName) ?? null

describe('arpeggio patterns', () => {
  it('lists the ten patterns in toolbar order, each labelled', () => {
    expect(ARPEGGIO_PATTERNS).toEqual(['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'])
    expect(ARPEGGIO_PATTERNS.map((p) => ARPEGGIO_LABELS[p])).toEqual(['Up · root', 'Up · 1st inv', 'Up · 2nd inv', 'Up · 3rd inv', 'Down · root', 'Down · 1st inv', 'Down · 2nd inv', 'Down · 3rd inv', 'Up & down', 'Voice-led'])
  })
  it('recognises patterns and sheet lines, nothing else', () => {
    expect(isArpeggioPattern('up-root')).toBe(true)
    expect(isArpeggioPattern('third')).toBe(false)
    expect(['off', 'third', 'seventh', 'voice-led'].every(isSheetLine)).toBe(true)
    expect([undefined, 'both', 3, 'Up · root'].some(isSheetLine)).toBe(false)
  })
})

describe('arpeggio tones', () => {
  it('takes four chord tones from 7th chords, altered 5ths kept, extensions dropped', () => {
    expect(names('CMaj7')).toEqual(['C', 'E', 'G', 'B'])
    expect(names('Dm7')).toEqual(['D', 'F', 'A', 'C'])
    expect(names('G7')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('Em7b5')).toEqual(['E', 'G', 'Bb', 'D'])
    expect(names('Bdim7')).toEqual(['B', 'D', 'F', 'Ab'])
    expect(names('CMaj7#5')).toEqual(['C', 'E', 'G#', 'B'])
    expect(names('G7#9')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('FMaj7#11')).toEqual(['F', 'A', 'C', 'E'])
    expect(names('C6')).toEqual(['C', 'E', 'G', 'A'])
    expect(names('G7sus4')).toEqual(['G', 'C', 'D', 'F'])
    expect(names('G7alt')).toEqual(['G', 'B', 'D#', 'F'])
  })
  it('follows the written symbol for the 5th: #5, +, aug and alt raise it, b5 lowers it, else the quality is kept', () => {
    expect(names('G7#9b13')).toEqual(['G', 'B', 'D', 'F']) // b13 is not a 5th alteration
    expect(names('C7b5')).toEqual(['C', 'E', 'Gb', 'Bb'])
    expect(names('C7(b5)')).toEqual(['C', 'E', 'Gb', 'Bb'])
    expect(names('G7#5')).toEqual(['G', 'B', 'D#', 'F'])
    expect(names('G7+')).toEqual(['G', 'B', 'D#', 'F'])
    expect(names('G7alt')).toEqual(['G', 'B', 'D#', 'F'])
    expect(names('G7b13')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('G7b9b13')).toEqual(['G', 'B', 'D', 'F'])
    expect(names('Em7b5')).toEqual(['E', 'G', 'Bb', 'D'])
    expect(names('Bdim7')).toEqual(['B', 'D', 'F', 'Ab'])
  })
  it('has the other rows too', () => {
    expect(names('Cm6')).toEqual(['C', 'Eb', 'G', 'A'])
    expect(names('CmMaj7')).toEqual(['C', 'Eb', 'G', 'B'])
    expect(names('C7b9')).toEqual(['C', 'E', 'G', 'Bb'])
    expect(names('C7#11')).toEqual(['C', 'E', 'G', 'Bb'])
    expect(names('C7sus4b9')).toEqual(['C', 'F', 'G', 'Bb'])
  })
  it('has a row for every canonical quality in chord_scales.json', () => {
    const qualities = Object.keys((chordScales as { qualities: object }).qualities)
    expect(qualities.length).toBeGreaterThan(10)
    expect(qualities.filter((q) => arpeggioTones(CONCERT, `C${q === 'maj' ? '' : q}`) === null)).toEqual([])
  })
  it('takes three from a triad, and the chord as written over a slash bass', () => {
    expect(names('C')).toEqual(['C', 'E', 'G'])
    expect(names('Gm')).toEqual(['G', 'Bb', 'D'])
    expect(names('D7/F#')).toEqual(['D', 'F#', 'A', 'C'])
  })
  it('spells from the written root of a transposing part', () => {
    expect(names('Cm7', TENOR)).toEqual(['D', 'F', 'A', 'C'])
  })
  it('is null for a chord it cannot read', () => {
    expect(names('N.C.')).toBeNull()
    expect(names('')).toBeNull()
  })
})

describe('arpeggio order', () => {
  it('rotates four tones up, and reverses the rotation down (each Down ends where its Up starts)', () => {
    expect([0, 1, 2, 3].map((k) => arpeggioOrder(4, k, true))).toEqual([[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]])
    expect([0, 1, 2, 3].map((k) => arpeggioOrder(4, k, false))).toEqual([[3, 2, 1, 0], [0, 3, 2, 1], [1, 0, 3, 2], [2, 1, 0, 3]])
  })
  it('gives a triad its first tone again as the fourth note, and no 3rd inversion', () => {
    expect(arpeggioOrder(3, 0, true)).toEqual([0, 1, 2, 0])
    expect(arpeggioOrder(3, 1, true)).toEqual([1, 2, 0, 1])
    expect(arpeggioOrder(3, 3, true)).toEqual([0, 1, 2, 0])
    expect(arpeggioOrder(3, 0, false)).toEqual([0, 2, 1, 0])
  })
})

const BASS: Part = { clef: 'bass', trans: 'C' }
/** chords one after another, each `beats` long */
const seq = (...cs: readonly (readonly [string, number])[]): GuideInput[] => {
  let start = 0
  return cs.map(([chord, beats], row) => {
    const c = { row, chord, start, beats }
    start += beats
    return c
  })
}
const voice = (cs: readonly GuideInput[], pattern: Parameters<typeof arpeggioVoices>[4], part: Part = CONCERT, beats: Metre = 4) =>
  arpeggioVoices(cs, part, beats, null, pattern)
const pitches = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => (n.pitch ? toVexKey(n.pitch) : 'r'))

describe('note value', () => {
  it('is the longest of quarter, eighth, sixteenth giving the shortest chord four notes', () => {
    expect([4, 3, 2, 1].map(noteValue)).toEqual([1, 0.5, 0.5, 0.25])
  })
})

describe('arpeggio voices', () => {
  it('plays one chord a bar in quarters, root position up, the run placed nearest the centre', () => {
    const { bars } = voice(seq(['CMaj7', 4], ['Dm7', 4]), 'up-root')
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4'])
    expect(bars.get(0)?.map((n) => [n.beat, n.beats])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]])
    expect(pitches(bars.get(1))).toEqual(['d/4', 'f/4', 'a/4', 'c/5']) // D5 would leave the range at C6
  })
  it('plays two chords a bar in eighths, each from the octave nearest the last note', () => {
    const { bars } = voice(seq(['Dm7', 2], ['G7', 2]), 'up-root')
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5', 'g/4', 'b/4', 'd/5', 'f/5'])
    expect(bars.get(0)?.every((n) => n.beats === 0.5)).toBe(true)
    expect(bars.get(0)?.map((n) => n.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  })
  it('plays three chords a bar (2 + 1 + 1) in sixteenths, the long one twice', () => {
    const { bars } = voice(seq(['Dm7', 2], ['G7', 1], ['C', 1]), 'up-root')
    const bar = bars.get(0) ?? []
    expect(bar).toHaveLength(16)
    expect(bar.every((n) => n.beats === 0.25)).toBe(true)
    expect(bar.filter((n) => n.beat < 2)).toHaveLength(8)
  })
  it('fills a 3/4 bar of one chord with six eighths, the pattern again from its start', () => {
    const { bars } = voice(seq(['CMaj7', 3]), 'up-root', CONCERT, 3)
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4', 'c/4', 'e/4']) // C5 up would leave the range
  })
  it("held chord: starts its pattern again in the next bar, at that bar's note value", () => {
    const { bars } = voice([{ row: 0, chord: 'Dm7', start: 0, beats: 2 }, { row: 1, chord: 'CMaj7', start: 2, beats: 6 }], 'up-root')
    expect(bars.get(0)?.map((n) => n.beats)).toEqual(Array(8).fill(0.5)) // Dm7 2 + CMaj7 2: eighths
    expect(bars.get(1)?.map((n) => n.beats)).toEqual([1, 1, 1, 1]) // CMaj7 alone: quarters
    expect(pitches(bars.get(1))[0]).toMatch(/^c\//)
  })
  it("plays Down from the top, ending on the inversion's tone", () => {
    expect(pitches(voice(seq(['CMaj7', 4]), 'down-root').bars.get(0))).toEqual(['b/4', 'g/4', 'e/4', 'c/4'])
    expect(pitches(voice(seq(['CMaj7', 4]), 'down-1st').bars.get(0)).map((p) => p[0])).toEqual(['c', 'b', 'g', 'e'])
  })
  it('plays a triad with its first tone again an octave on', () => {
    expect(pitches(voice(seq(['C', 4]), 'up-1st').bars.get(0))).toEqual(['e/4', 'g/4', 'c/5', 'e/5'])
  })
  it('alternates Up & down each arpeggio', () => {
    const { bars } = voice(seq(['Dm7', 4], ['G7', 4], ['CMaj7', 4]), 'up-down')
    expect([0, 1, 2].map((b) => pitches(bars.get(b)))).toEqual([
      ['d/4', 'f/4', 'a/4', 'c/5'],
      ['f/5', 'd/5', 'b/4', 'g/4'],
      ['c/4', 'e/4', 'g/4', 'b/4'],
    ])
  })
  it('voice-led: starts each chord on its tone nearest the last note, going up', () => {
    const { bars } = voice(seq(['Dm7', 4], ['G7', 4]), 'voice-led')
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5'])
    expect(pitches(bars.get(1))).toEqual(['b/4', 'd/5', 'f/5', 'g/5']) // B4 is a step below C5
  })
  it('voice-led: never repeats the note it just played, a held chord starts its next arpeggio on the nearest other tone', () => {
    const { bars } = voice(seq(['Dm7', 8]), 'voice-led')
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5'])
    expect(pitches(bars.get(1))[0]).toBe('d/4') // D, not C again (D5 up would leave the range)
    expect(pitches(voice(seq(['Dm7', 3]), 'voice-led', CONCERT, 3).bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5', 'd/4', 'f/4'])
  })
  it('voice-led: a chord sharing the last note starts on its next nearest tone', () => {
    const { bars } = voice(seq(['Dm7', 4], ['FMaj7', 4]), 'voice-led') // C5 just played: A4 is nearest of F A C E
    expect(pitches(bars.get(1))).toEqual(['a/4', 'c/5', 'e/5', 'f/5'])
  })
  it('voice-led: a tie between a tone above and below goes lower', () => {
    const { bars } = voice(seq(['Dm7', 4], ['Cdim7', 4]), 'voice-led') // C5 played: Eb5 and Bbb4 (A) are both 3 away
    expect(bars.get(1)?.[0]?.pitch?.midi).toBe(69)
  })
  it('rests: N.C. rests and restarts the run near the centre, with nothing to report; a chord it cannot read is reported', () => {
    const { bars, missing } = voice(seq(['CMaj7', 4], ['N.C.', 4], ['CMaj7', 4]), 'up-root')
    expect(bars.get(1)).toEqual([{ pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }])
    expect(pitches(bars.get(2))).toEqual(['c/4', 'e/4', 'g/4', 'b/4'])
    expect(missing).toEqual([])
    expect(voice(seq(['CMaj7', 4], ['Xyz', 4]), 'up-root').missing[0]).toMatch(/^no chord tones for Xyz \(/)
  })
  it('tenor: spells from the written root, with accidentals by the measure rule', () => {
    const { bars } = arpeggioVoices(seq(['Ab7', 4]), TENOR, 4, null, 'up-root') // written Bb7
    expect(pitches(bars.get(0))).toEqual(['bb/4', 'd/5', 'f/5', 'ab/5'])
    expect(bars.get(0)?.map((n) => n.accidental)).toEqual(['b', null, null, 'b'])
  })
  it('fills each bar in its own metre: a 2/4 bar, then a 6/4 bar (#235)', () => {
    const { bars } = arpeggioVoices(seq(['CMaj7', 8]), CONCERT, clockOf([2, 6], 4), null, 'up-root')
    expect([bars.get(0)?.length, bars.get(1)?.length]).toEqual([4, 6])
    expect(bars.get(0)?.map((n) => n.beats)).toEqual([0.5, 0.5, 0.5, 0.5])
  })
  it('rests a 5/4 bar as a dotted half and a half', () => {
    expect(voice(seq(['N.C.', 5]), 'up-root', CONCERT, 5).bars.get(0)?.map((n) => [n.beat, n.beats])).toEqual([[0, 3], [3, 2]])
  })
  it('bass: stays inside the bass range', () => {
    expect(pitches(voice(seq(['CMaj7', 4]), 'up-root', BASS).bars.get(0))).toEqual(['c/3', 'e/3', 'g/3', 'b/3'])
  })
  it('never ties and never labels', () => {
    const notes = [...voice(seq(['Dm7', 2], ['G7', 2]), 'up-root').bars.values()].flat()
    expect(notes.some((n) => n.tie || n.tiedIn)).toBe(false)
  })
})
