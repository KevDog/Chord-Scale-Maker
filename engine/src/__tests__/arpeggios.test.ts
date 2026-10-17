import { describe, expect, it } from 'vitest'
import { ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, arpeggioCells, arpeggioOrder, arpeggioTones, arpeggioVoices, cellVoices, comfortBand, isArpeggioPattern, isSheetLine, noteValue } from '../arpeggios'
import type { GuideInput, GuideNote } from '../guideTones'
import { clockOf, type Metre } from '../metre'
import { CONCERT, type Part, partFor } from '../part'
import { INSTRUMENTS } from '../instruments'
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

describe('cellVoices valueOf', () => {
  it('takes the chord’s whole length and the bar’s shortest segment; the default is the bar’s noteValue', () => {
    const seen: (readonly [number, number])[] = []
    const cs = seq(['Dm7', 6])
    const cells = (c: GuideInput) => arpeggioCells(CONCERT, c, 'up-root')
    const { bars } = cellVoices(cs, CONCERT, 4, null, cells, (chordBeats, shortest) => {
      seen.push([chordBeats, shortest])
      return 1
    })
    expect(seen.every(([c]) => c === 6)).toBe(true) // the whole chord, though its second bar holds two beats
    expect(seen.map(([, s]) => s)).toEqual([4, 2])
    expect(bars.get(1)?.every((n) => n.beats === 1)).toBe(true)
    expect(cellVoices(cs, CONCERT, 4, null, cells).bars).toEqual(arpeggioVoices(cs, CONCERT, 4, null, 'up-root').bars)
  })
})

describe('the comfort band', () => {
  it('is the range less a 4th below and a major 3rd above: vibes F3–F6 → B♭3–C♯6', () => {
    expect(comfortBand(INSTRUMENTS.vibes.range)).toEqual({ lo: 58, hi: 85 })
  })
  it('is at least an octave, about the range\'s middle, when the range is narrow', () => {
    expect(comfortBand({ lo: 40, hi: 60, centre: 49 })).toEqual({ lo: 44, hi: 56 })
  })
  it('keeps a one-way line from drifting out of it: vibes Fm7 Down repeats from E♭5 rather than fall to F3', () => {
    const { bars } = voice(seq(['Fm7', 4], ['Fm7', 4]), 'down-root', partFor('vibes'))
    expect(pitches(bars.get(0))).toEqual(['eb/5', 'c/5', 'ab/4', 'f/4'])
    expect(pitches(bars.get(1))).toEqual(['eb/5', 'c/5', 'ab/4', 'f/4'])
  })
  it('still takes the nearest octave while it stays inside', () => {
    const { bars } = voice(seq(['Fm7', 4], ['Bbm7', 4]), 'down-root', partFor('vibes'))
    expect(pitches(bars.get(1))).toEqual(['ab/4', 'f/4', 'db/4', 'bb/3'])
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
  it('fills a 3/4 bar of one chord with six eighths, turning back on the cell after it', () => {
    const { bars } = voice(seq(['CMaj7', 3]), 'up-root', CONCERT, 3)
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4', 'g/4', 'e/4'])
  })
  it.each([
    ['FMaj7/A', 'up-root', 'f a c e c a'],
    ['Dm7', 'up-root', 'd f a c a f'],
    ['C7', 'down-root', 'bb g e c e g'],
    ['Gm7b5', 'up-2nd', 'db f g bb g f'],
    ['F', 'up-root', 'f a c f c a'],
  ] as const)('turns back in a 3/4 bar of %s, %s', (chord, pattern, notes) => {
    const bar = voice(seq([chord, 3]), pattern, CONCERT, 3).bars.get(0) ?? []
    expect(pitches(bar).map((p) => p.split('/')[0]).join(' ')).toBe(notes)
    expect(bar.slice(4).map((n) => n.pitch?.midi)).toEqual([bar[2], bar[1]].map((n) => n?.pitch?.midi)) // the cell's own pitches
  })
  it('turns back in each bar of a chord held over two 3/4 bars', () => {
    const { bars } = voice(seq(['Dm7', 6]), 'up-root', CONCERT, 3)
    expect([0, 1].map((b) => pitches(bars.get(b)))).toEqual([
      ['d/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4'],
      ['d/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4'],
    ])
  })
  it('places the next chord nearest the turn-back’s last note', () => {
    const { bars } = voice(seq(['CMaj7', 5], ['Dm7', 5]), 'voice-led', CONCERT, 5) // quarters: one note left after the cell
    expect(pitches(bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4', 'g/4'])
    expect(pitches(bars.get(1))[0]).toBe('f/4') // F4 and A4 are both a step from G4: the lower
  })
  it('Up & down: a turn-back is not an arpeggio of its own', () => {
    const { bars } = voice(seq(['Dm7', 3], ['G7', 3]), 'up-down', CONCERT, 3)
    expect(pitches(bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4'])
    expect(pitches(bars.get(1)).slice(0, 4).map((p) => p[0])).toEqual(['d', 'b', 'g', 'f']) // down: the second arpeggio, from below F4
  })
  it('Up & down: a Down arpeggio starts on the chord tone just below the last note, never that note (#356)', () => {
    const piano: Part = { ...CONCERT, range: { lo: 53, hi: 88, centre: 70 } }
    const { bars } = voice(seq(['FMaj7/A', 3], ['Dm7', 3]), 'up-down', piano, 3) // Waltz for Debby bars 1-2
    expect(pitches(bars.get(0))).toEqual(['f/4', 'a/4', 'c/5', 'e/5', 'c/5', 'a/4'])
    expect(pitches(bars.get(1))).toEqual(['f/4', 'd/4', 'c/4', 'a/3', 'c/4', 'd/4']) // A4 is a chord tone: F4 below it
  })
  it('splits that divide evenly never turn back', () => {
    expect(pitches(voice(seq(['CMaj7', 2], ['Dm7', 1]), 'up-root', CONCERT, 3).bars.get(0))).toHaveLength(12) // sixteenths
    expect(pitches(voice(seq(['CMaj7', 4]), 'up-root').bars.get(0))).toEqual(['c/4', 'e/4', 'g/4', 'b/4'])
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
      ['b/4', 'g/4', 'f/4', 'd/4'], // down from the tone below C5
      ['e/4', 'g/4', 'b/4', 'c/5'], // up from the tone above D4
    ])
  })
  it('Up & down: a later Up arpeggio starts on the chord tone just above the last note, never that note (#356)', () => {
    const { bars } = voice(seq(['Dm7', 4], ['G7', 4], ['FMaj7', 4]), 'up-down')
    expect(pitches(bars.get(2))).toEqual(['e/4', 'f/4', 'a/4', 'c/5']) // D4 just played: E4 above it, not F3
    expect(pitches(voice(seq(['Dm7', 4], ['G7', 4], ['GMaj7', 4]), 'up-down').bars.get(2))).toEqual(['f#/4', 'g/4', 'b/4', 'd/5']) // D4 a chord tone: the next above
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
    expect(pitches(voice(seq(['Dm7', 3]), 'voice-led', CONCERT, 3).bars.get(0))).toEqual(['d/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4'])
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
