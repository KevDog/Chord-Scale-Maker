import { describe, expect, it } from 'vitest'
import { ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, arpeggioCells, arpeggioOrder, arpeggioTones, arpeggioVoices, cellVoices, comfortBand, isArpeggioPattern, isSheetLine, noteValue } from '../arpeggios'
import type { GuideInput, GuideNote } from '../guideTones'
import { clockOf, type Metre } from '../metre'
import { CONCERT, type Part, partFor } from '../part'
import { INSTRUMENTS } from '../instruments'
import { rootName } from '../pitch'
import chordScales from '../../chord_scales.json'
import type { Approach } from '../approaches'
import type { RhythmId, RhythmPlan } from '../rhythm'
import { toVexKey } from '../sheet'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const names = (chord: string, part: Part = CONCERT) => arpeggioTones(part, chord)?.map(rootName) ?? null

describe('arpeggio patterns', () => {
  it('lists the ten patterns in toolbar order, each labeled', () => {
    expect(ARPEGGIO_PATTERNS).toEqual(['up-root', 'up-1st', 'up-2nd', 'up-3rd', 'down-root', 'down-1st', 'down-2nd', 'down-3rd', 'up-down', 'voice-led'])
    expect(ARPEGGIO_PATTERNS.map((p) => ARPEGGIO_LABELS[p])).toEqual(['Up · root', 'Up · 1st inv', 'Up · 2nd inv', 'Up · 3rd inv', 'Down · root', 'Down · 1st inv', 'Down · 2nd inv', 'Down · 3rd inv', 'Up & down', 'Voice-led'])
  })
  it('recognizes patterns and sheet lines, nothing else', () => {
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

describe('approaches (#381)', () => {
  type Bars = ReturnType<typeof arpeggioVoices>['bars']
  const first = (bars: Bars, bar: number) => bars.get(bar)![0]!.pitch!
  const rhythm = (notes: readonly GuideNote[] | undefined) => (notes ?? []).map((n) => [n.beat, n.beats])
  const line = (cs: readonly GuideInput[], approach?: Parameters<typeof arpeggioVoices>[5], part: Part = CONCERT) => arpeggioVoices(cs, part, 4, null, 'up-root', approach).bars
  /** chords in time order, each showing a scale (a figure's diatonic steps need one) */
  const shown = (...cs: readonly (readonly [string, number, string])[]): GuideInput[] => seq(...cs.map(([c, b]) => [c, b] as const)).map((c, i) => ({ ...c, shown: cs[i]![2] }))

  it('swaps the chord before’s last note for a figure into the next chord’s first note, on its beat', () => {
    const cs = seq(['CMaj7', 4], ['FMaj7', 4])
    const plain = line(cs)
    const led = line(cs, 'chromatic-below')
    expect(led.get(1)).toEqual(plain.get(1))
    expect(led.get(0)!.slice(0, 3)).toEqual(plain.get(0)!.slice(0, 3))
    expect(led.get(0)![3]).toMatchObject({ beat: 3, beats: 1, pitch: { letter: 2, acc: 0, midi: first(plain, 1).midi - 1 } }) // E into F
  })

  it('leaves the line as it is with none', () => {
    const cs = seq(['Dm7', 4], ['G7', 4], ['CMaj7', 4])
    expect(line(cs, 'none')).toEqual(line(cs))
  })

  it('plays a three-note figure in the line’s own rhythm', () => {
    const cs = shown(['Dm7', 2, 'D Dorian'], ['G7', 2, 'G Mixolydian']) // D F A C | G B D F
    const plain = line(cs).get(0)!
    const led = line(cs, 'delayed').get(0)!
    expect(rhythm(led)).toEqual(rhythm(plain))
    expect(led[0]).toEqual(plain[0])
    expect(led.slice(4)).toEqual(plain.slice(4))
    expect(led.slice(1, 4).map((n) => n.pitch?.midi)).toEqual([69, 65, 66]) // A F F♯ into G (67)
  })

  it('leaves no figure after a rest, into a rest, or across a gap', () => {
    const gap: GuideInput[] = [{ row: 0, chord: 'CMaj7', start: 0, beats: 2 }, { row: 1, chord: 'FMaj7', start: 4, beats: 4 }]
    for (const cs of [seq(['NC', 4], ['FMaj7', 4]), seq(['CMaj7', 4], ['NC', 4]), gap]) expect(line(cs, 'chromatic-below')).toEqual(line(cs))
  })

  it('leaves the chord before at least one note of its own', () => {
    const cs = seq(['CMaj7', 3], ['Dm7', 0.5], ['G7', 4.5]) // Dm7: two sixteenths, too few for a three-note figure
    const dm = (bars: Bars) => bars.get(0)!.filter((n) => n.beat >= 3)
    expect(dm(line(cs, 'delayed'))).toEqual(dm(line(cs)))
  })

  it('carries a figure across the bar line', () => {
    const cs = shown(['Dm7', 4.5, 'D Dorian'], ['G7', 3.5, 'G Mixolydian']) // Dm7's last notes: one in bar 0, two in bar 1; Delayed into G: A F F♯
    const plain = line(cs)
    const led = line(cs, 'delayed')
    expect(rhythm(led.get(0))).toEqual(rhythm(plain.get(0)))
    expect(rhythm(led.get(1))).toEqual(rhythm(plain.get(1)))
    expect(led.get(0)!.at(-1)).not.toEqual(plain.get(0)!.at(-1))
    expect(led.get(1)!.slice(0, 2)).not.toEqual(plain.get(1)!.slice(0, 2))
    expect(led.get(1)!.slice(2)).toEqual(plain.get(1)!.slice(2))
  })

  it('drops a figure that would leave the part’s range', () => {
    const cs = seq(['CMaj7', 4], ['FMaj7', 4])
    const lo = first(line(cs), 1).midi
    const part: Part = { ...CONCERT, range: { lo, hi: lo + 12, centre: lo + 6 } }
    const plain = line(cs, undefined, part)
    expect(first(plain, 1).midi).toBe(lo) // the target is the floor
    expect(line(cs, 'chromatic-below', part)).toEqual(plain)
  })

  it('steps in the scale the sheet shows over the chord before', () => {
    const step = (scale: string) => line(shown(['CMaj7', 4, scale], ['FMaj7', 4, 'F Ionian']), 'diatonic-above').get(0)![3]!.pitch
    expect(line(seq(['CMaj7', 4], ['FMaj7', 4]), 'diatonic-above')).toEqual(line(seq(['CMaj7', 4], ['FMaj7', 4]))) // no scale: no figure
    expect(step('C Ionian')).toMatchObject({ letter: 4, acc: 0 }) // G above F
    expect(step('C Lydian')).toMatchObject({ letter: 3, acc: 1 }) // F♯ above F
  })

  it('sets the figure’s accidentals by the measure', () => {
    const led = line(seq(['CMaj7', 2], ['Em7', 2]), 'chromatic-below').get(0)!
    expect(led[3]).toMatchObject({ pitch: { letter: 1, acc: 1 }, accidental: '#' }) // D♯ into E
  })
})

const plan = (id: RhythmId, bars: number[], more: Partial<RhythmPlan> = {}): RhythmPlan => ({ id, start: 'beat', anticipate: 0, bars, clockBars: bars.map((_, i) => i), breaks: [], ...more })
// a range reaching F3 (piano's low end), so pick-ups below C4 fit; CMaj7 after a rest still sits at C4 (avg 65.5 nearer the centre 69 than C5's 77.5)
const WIDE: Part = { ...CONCERT, range: { lo: 53, hi: 81, centre: 69 } }
const poured = (cs: GuideInput[], m: Metre, p: RhythmPlan, approach: Approach = 'none', part: Part = CONCERT) => arpeggioVoices(cs, part, m, null, 'up-root', approach, p).bars
const letters = (v: readonly GuideNote[] | undefined) => (v ?? []).map((n) => (n.pitch ? rootName(n.pitch) : 'r'))

describe('a rhythm poured into the line (rhythm-on-lines spec §4)', () => {
  it('pours each worked example of §4\'s table', () => {
    const u = poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:accents', [4])).get(0)!
    expect(letters(u)).toEqual(['C', 'E', 'G', 'B', 'C', 'E', 'G', 'B'])
    expect(u.map((n) => n.mark?.beam)).toEqual([0, 0, 0, 1, 1, 1, 2, 2])
    expect(u.flatMap((n, i) => (n.mark?.accent ? [i] : []))).toEqual([0, 3, 6])
    expect(letters(poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:rests', [4])).get(0))).toEqual(['C', 'r', 'r', 'E', 'r', 'G', 'r'])
    const t = poured(seq(['CMaj7', 4]), 4, plan('unit:8:3:tied', [4])).get(0)!
    expect(letters(t)).toEqual(['C', 'E', 'E', 'G'])
    expect(t.map((n) => n.tiedIn)).toEqual([false, false, true, false])
    expect(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('card:downbeats', [4])).get(0)!.map((n) => n.mark?.value)).toEqual(['q', 'q', 'q', 'q'])
    expect(letters(poured(seq(['CMaj7', 3]), 3, plan('unit:8:2:accents', [3])).get(0))).toEqual(['C', 'E', 'G', 'B', 'G', 'E'])
    const p1 = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { start: 'pickup-1' }))
    expect(letters(p1.get(0))).toEqual(['C', 'E', 'G', 'B', 'G'])
    expect(p1.get(0)!.map((n) => n.mark?.value)).toEqual(['q', 'q', 'q', '8', '8'])
    expect(letters(p1.get(1))).toEqual(['D', 'F', 'A', 'C'])
    const nc = seq(['N.C.', 4], ['CMaj7', 4]).map((c, i) => (i === 1 ? { ...c, scale: 'C Ionian' } : c))
    const p3 = poured(nc, 4, plan('card:downbeats', [4, 4], { start: 'pickup-3' }), 'none', WIDE)
    expect(letters(p3.get(0))).toEqual(['r', 'r', 'r', 'G', 'A', 'B'])
    expect(p3.get(0)!.slice(3).map((n) => n.pitch!.midi)).toEqual([55, 57, 59])
    expect(p3.get(1)![0]!.pitch!.midi).toBe(60)
    // the same in the concert treble range (lo C4): G3 A3 B3 are out of range and rest (§3.4)
    expect(letters(poured(nc, 4, plan('card:downbeats', [4, 4], { start: 'pickup-3' })).get(0))).toEqual(['r', 'r', 'r', 'r', 'r', 'r'])
    const ant = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { anticipate: 1 }))
    expect([letters(ant.get(0)), letters(ant.get(1))]).toEqual([['C', 'E', 'G', 'D'], ['F', 'A', 'C', 'A']])
    const late = poured(seq(['CMaj7', 4], ['Dm7', 4]), 4, plan('card:downbeats', [4, 4], { anticipate: -1 }))
    expect([letters(late.get(0)), letters(late.get(1))]).toEqual([['C', 'E', 'G', 'B'], ['G', 'D', 'F', 'A']])
  })
  it('cuts a cell at its chord\'s last attack: C E D F', () => {
    expect(letters(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('card:downbeats', [4])).get(0))).toEqual(['C', 'E', 'D', 'F'])
  })
  it('counts by chord across the barline, turning back at the chord\'s end (D15)', () => {
    const over = poured(seq(['CMaj7', 6]), 3, plan('card:downbeats', [3, 3]))
    expect([letters(over.get(0)), letters(over.get(1))]).toEqual([['C', 'E', 'G'], ['B', 'G', 'E']])
  })
  it('holds a tied attack into the next chord\'s span: C E E D', () => {
    expect(letters(poured(seq(['CMaj7', 2], ['Dm7', 2]), 4, plan('unit:8:3:tied', [4])).get(0))).toEqual(['C', 'E', 'E', 'D'])
  })
  it('approaches each chord\'s poured target, never a scale-below pick-up', () => {
    const nc = seq(['N.C.', 4], ['CMaj7', 4]).map((c, i) => (i === 1 ? { ...c, scale: 'C Ionian' } : c))
    const ap = poured([...nc, { row: 2, chord: 'Dm7', start: 8, beats: 4 }], 4, plan('card:downbeats', [4, 4, 4], { start: 'pickup-1' }), 'chromatic-below', WIDE)
    expect(letters(ap.get(0))).toEqual(['r', 'r', 'r', 'r', 'B'])
    expect(ap.get(2)![0]!.pitch!.midi - ap.get(1)!.at(-1)!.pitch!.midi).toBe(1)
  })
  it('(guard) a plan whose rhythm is off gives the voices of no plan', () => {
    const cs = seq(['CMaj7', 4], ['Dm7', 4])
    expect(arpeggioVoices(cs, CONCERT, 4, null, 'up-root', 'none', plan('off', [4, 4]))).toEqual(arpeggioVoices(cs, CONCERT, 4, null, 'up-root'))
  })
})
