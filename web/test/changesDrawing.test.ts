import { describe, expect, it } from 'vitest'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '@chord-scale-maker/engine'
import { arpeggioAria, beatXs, DURATIONS, fitBars, guideAria, mergeNames, restatedAccidental, rhythmAria, SLASH_TARGET_ROW, targetRow, voicedBand, voltaShift, withTargets } from '~/utils/changesDrawing'

const chord = (beat: number, text: string, guide: string): ChangesChord => ({
  beat,
  text,
  tokens: null,
  numeral: '',
  scale: null,
  reason: '',
  stated: false,
  heardIn: '',
  keyFrom: 'found',
  guide,
  pentatonic: null,
})
const bar = (chords: readonly ChangesChord[], voice: readonly GuideNote[]): ChangesBar => ({
  keySig: null,
  beats: 4,
  timeSignature: null,
  chords,
  marker: '',
  keyArea: '',
  repeatStart: false,
  repeatEnd: 0,
  end: 'none',
  volta: null,
  segno: false,
  coda: false,
  nav: '',
  voice,
  rhythm: [],
  targets: [],
})
const note = (letter: Letter, acc: number, midi: number, beat: number, beats: 1 | 2 | 3 | 4, more: Partial<GuideNote> = {}): GuideNote => ({
  pitch: { letter, acc, midi },
  beat,
  beats,
  tie: false,
  tiedIn: false,
  accidental: null,
  ...more,
})
const rest = (beat: number, beats: 1 | 2 | 3 | 4): GuideNote => ({ pitch: null, beat, beats, tie: false, tiedIn: false, accidental: null })

// drawing units: staff lines at y 80-120; an ending bracket's top at 20 (getYForTopText(5)), its foot 1.5 spaces lower, at 35
describe('voltaShift', () => {
  it('leaves the bracket where it is when every note is below it', () => {
    expect(voltaShift([60, 95], 35)).toBe(0)
    expect(voltaShift([], 35)).toBe(0)
  })
  it('raises it so its foot clears the highest stem tip by a margin', () => {
    expect(voltaShift([35, 60], 35)).toBe(-4)
    expect(voltaShift([20, 150], 35)).toBe(-19)
  })
})

describe('voicedBand', () => {
  it('is at least the clef band, as on a line with a clef', () => {
    expect(voicedBand([95, 100], null)).toEqual({ top: 64, bottom: 134 })
  })
  it('grows to stem tips above and below the staff', () => {
    expect(voicedBand([35, 160], null)).toEqual({ top: 11, bottom: 178 })
  })
  it('reaches over a raised ending bracket', () => {
    expect(voicedBand([60, 95], 16)).toEqual({ top: 12, bottom: 134 })
  })
})

describe('beatXs', () => {
  it("puts a beat where a note starts at its head's centre, and the others half a head past their ghost", () => {
    expect(beatXs(new Map([[0, 0.1]]), [100, 160, 220, 280], 1200)).toEqual([0.1, 166 / 1200, 226 / 1200, 286 / 1200])
  })
})

describe('restatedAccidental', () => {
  const tied = (letter: Letter, acc: number): GuideNote => note(letter, acc, 60, 0, 4, { tiedIn: true })
  it('is null for a note that does not continue the last line', () => {
    expect(restatedAccidental(note(6, -1, 70, 0, 4), null)).toBeNull()
  })
  it('restates a tied note the key does not imply: flat, sharp, natural', () => {
    expect(restatedAccidental(tied(6, -1), 'C')).toBe('b')
    expect(restatedAccidental(tied(3, 1), null)).toBe('#')
    expect(restatedAccidental(tied(6, 0), 'F')).toBe('n') // F major has Bb
  })
  it('leaves a tied note the signature already gives, and plain naturals without one', () => {
    expect(restatedAccidental(tied(6, -1), 'F')).toBeNull()
    expect(restatedAccidental(tied(0, 0), null)).toBeNull()
  })
})

describe('guideAria', () => {
  it('is empty with the line off', () => {
    expect(guideAria({ bars: [bar([chord(0, 'C7', '')], [])] })).toBe('')
  })

  it("names each chord's note with its label, and a held bar as a dash", () => {
    const line: ChangesLine = {
      bars: [
        bar([chord(0, 'Dm7', '7'), chord(2, 'G7', '3')], [note(0, 0, 72, 0, 2), note(6, 0, 71, 2, 2)]),
        bar([chord(0, 'CMaj7', '7')], [note(6, 0, 71, 0, 4, { tie: true })]),
        bar([], [note(6, 0, 71, 0, 4, { tiedIn: true })]),
      ],
    }
    expect(guideAria(line)).toBe('; guide tones: C5 7, B4 3 | B4 7 | –')
  })

  it("names a held chord's note, tied in on its own beat, rather than a rest", () => {
    const line: ChangesLine = { bars: [bar([chord(0, 'C7', '3'), chord(2, 'C7b9', '3')], [note(2, 0, 64, 0, 2, { tie: true }), note(2, 0, 64, 2, 2, { tiedIn: true })])] }
    expect(guideAria(line)).toBe('; guide tones: E4 3, E4 3')
  })

  it('spells accidentals and names a rest', () => {
    const line: ChangesLine = { bars: [bar([chord(0, 'Gm7', '3'), chord(2, 'Cm7#5#9x', '')], [note(6, -1, 70, 0, 2), rest(2, 2)])] }
    expect(guideAria(line)).toBe('; guide tones: B♭4 3, rest')
  })
})

describe('mergeNames', () => {
  const at = (beat: number, width: number) => ({ beat, width })
  it('names every beat either row names, as wide as the wider name there, in beat order (#475)', () => {
    expect(mergeNames([at(0, 0.1), at(2, 0.05)], [at(0, 0.2), at(1, 0.15), at(2, 0.01), at(3, 0.3)])).toEqual([at(0, 0.2), at(1, 0.15), at(2, 0.05), at(3, 0.3)])
  })
  it('is the one row when the other is empty', () => {
    expect(mergeNames([at(0, 0.1), at(2, 0.05)], [])).toEqual([at(0, 0.1), at(2, 0.05)])
    expect(mergeNames([], [at(1, 0.1)])).toEqual([at(1, 0.1)])
  })
})

const FOUR = [4, 4, 4, 4]
describe('fitBars', () => {
  it('counts a beat as its own bar’s width over its own beats: a beat of a 2/4 bar is half of it (#235)', () => {
    const crowded = [at(0, 0.3), at(1, 0.3)]
    const fit = fitBars([2, 4], [crowded, crowded])
    expect(fit.shares[0]).toBeLessThan(fit.shares[1]!)
    expect(fitBars([4, 4], [crowded, crowded]).shares).toEqual([0.5, 0.5])
  })

  const at = (beat: number, width: number) => ({ beat, width })
  it('keeps bars even when every name fits', () => {
    expect(fitBars(FOUR, [[at(0, 0.1)], [at(0, 0.05), at(2, 0.05)], [], [at(0, 0.2)]])).toEqual({ shares: [0.25, 0.25, 0.25, 0.25], scales: [[1], [1, 1], [], [1]], fits: 4 })
  })
  it('widens a crowded bar by what its names need, and the others share the rest evenly', () => {
    const fit = fitBars(FOUR, [[at(0, 0.1), at(1, 0.1), at(2, 0.1), at(3, 0.1)], [at(0, 0.05)], [], [at(0, 0.05)]])
    expect(fit.shares.map((s) => +s.toFixed(6))).toEqual([0.4, 0.2, 0.2, 0.2])
    expect(fit.scales).toEqual([[1, 1, 1, 1], [1], [], [1]])
  })
  it("gives a name the beats up to the next chord, the bar's last up to the bar's end", () => {
    const fit = fitBars(FOUR, [[at(0, 0.3), at(2, 0.1)], []])
    expect(fit.shares.map((s) => +s.toFixed(6))).toEqual([0.6, 0.4])
  })
  it('lets a bar take the room of a slot past the line\'s last bar (null) when it needs it', () => {
    const fit = fitBars(FOUR, [[at(0, 0.225), at(1, 0.225), at(2, 0.225), at(3, 0.225)], null])
    expect(fit.shares.map((s) => +s.toFixed(6))).toEqual([0.9, 0.1])
    expect(fitBars(FOUR, [[at(0, 0.1)], null]).shares).toEqual([0.5, 0.5])
  })
  it('counts the leading bars that fit the line on their own, their names at no less than 0.8 (at least one): where a line too full breaks', () => {
    const crowded = [at(0, 0.25), at(1, 0.25), at(2, 0.25), at(3, 0.25)] // needs the whole line
    expect(fitBars(FOUR, [[at(0, 0.1)], [at(0, 0.2), at(1, 0.2), at(2, 0.2), at(3, 0.2)], [], []]).fits).toBe(4) // 1.175 of the line: names at 0.85
    expect(fitBars(FOUR, [[at(0, 0.2)], crowded, [], []]).fits).toBe(2) // 0.2 + 1 fit, a third bar's 0.125 doesn't
    expect(fitBars(FOUR, [crowded, [at(0, 0.3)], null, null]).fits).toBe(1)
    expect(fitBars(FOUR, [crowded, [at(0, 0.2)], null, null]).fits).toBe(2)
    expect(fitBars(FOUR, [[at(0, 0.2), at(1, 0.2), at(2, 0.2), at(3, 0.5)], [at(0, 0.1)]]).fits).toBe(1)
    expect(fitBars(FOUR, [[at(0, 0.1)], []]).fits).toBe(2)
  })
  it('never squeezes a bar below half its even share', () => {
    const fit = fitBars(FOUR, [[at(0, 0.225), at(1, 0.225), at(2, 0.225), at(3, 0.225)], [at(0, 0.01)]])
    expect(fit.shares.map((s) => +s.toFixed(6))).toEqual([+(0.9 / 1.15).toFixed(6), +(0.25 / 1.15).toFixed(6)])
  })
  it("shares an overfull line by need and shrinks the names that still don't fit, to no less than 0.6", () => {
    // needs 2 (0.5 over one beat) and 0.25 (the floor): shares 2/2.25 and 0.25/2.25, a beat of bar 0 is 0.2222 of the line
    const fit = fitBars(FOUR, [[at(0, 0.5), at(1, 0.25), at(2, 0.1), at(3, 0.1)], [at(0, 0.01)]])
    expect(fit.shares.map((s) => +s.toFixed(6))).toEqual([+(2 / 2.25).toFixed(6), +(0.25 / 2.25).toFixed(6)])
    expect(fit.scales[0]?.map((s) => +s.toFixed(3))).toEqual([0.6, +(2 / 2.25 / 4 / 0.25).toFixed(3), 1, 1])
    expect(fit.scales[1]).toEqual([1])
  })
})

describe('DURATIONS', () => {
  it('has eighths and sixteenths for arpeggio notes', () => {
    expect([DURATIONS[0.5], DURATIONS[0.25]]).toEqual(['8', '16'])
  })
})

describe('arpeggioAria', () => {
  it('is empty without a voice', () => {
    expect(arpeggioAria({ bars: [bar([chord(0, 'C', '')], [])] } as ChangesLine)).toBe('')
  })
  it("groups each chord's notes, chords by comma, bars by bar", () => {
    const n = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 0.5, tie: false, tiedIn: false, accidental: null })
    const b = bar([chord(0, 'Dm7', ''), chord(2, 'G7', '')], [n(1, 62, 0), n(3, 65, 0.5), n(5, 69, 1), n(0, 72, 1.5), n(4, 67, 2), n(6, 71, 2.5), n(1, 74, 3), n(3, 77, 3.5)])
    expect(arpeggioAria({ bars: [b] } as ChangesLine)).toBe('; 7th chords: D4 F4 A4 C5, G4 B4 D5 F5')
  })
  it('lists the notes of a bar with no chord symbols (a chord held over), rest for a rest', () => {
    const n = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 1, tie: false, tiedIn: false, accidental: null })
    const held = bar([], [n(1, 62, 0), n(3, 65, 1), rest(2, 2)])
    expect(arpeggioAria({ bars: [held] } as ChangesLine)).toBe('; 7th chords: D4 F4 rest')
  })
  it('names the Pentatonic line as such (#284)', () => {
    const n = (letter: Letter, midi: number, beat: number): GuideNote => ({ pitch: { letter, acc: 0, midi }, beat, beats: 1, tie: false, tiedIn: false, accidental: null })
    expect(arpeggioAria({ bars: [bar([chord(0, 'Am7', '')], [n(0, 60, 0), n(1, 62, 1), n(2, 64, 2), n(4, 67, 3)])] } as ChangesLine, 'pentatonic')).toBe('; pentatonic: C4 D4 E4 G4')
  })
})

describe('targetRow', () => {
  it('sits over the staff with nothing above it', () => {
    expect(targetRow([], 80)).toBe(68)
  })
  it('sits over the highest stem tip or accent', () => {
    expect(targetRow([65, 90], 80)).toBe(53)
  })
})

describe('withTargets', () => {
  it('leaves a band with room for the dots as it is, and gives the row its height from the top', () => {
    expect(withTargets({ top: 40, bottom: 140 }, 60)).toEqual({ band: { top: 40, bottom: 140 }, at: 0.2 })
  })
  it('opens the band upwards to hold them', () => {
    expect(withTargets({ top: 74, bottom: 126 }, 68)).toEqual({ band: { top: 62, bottom: 126 }, at: 6 / 64 })
  })
  it('keeps a slash line’s crop: its dots sit in the staff’s top space, over the slashes', () => {
    expect(withTargets({ top: 74, bottom: 126 }, SLASH_TARGET_ROW).band).toEqual({ top: 74, bottom: 126 })
    expect(SLASH_TARGET_ROW).toBe(85)
  })
  it('has no row without target beats', () => {
    expect(withTargets({ top: 74, bottom: 126 }, null)).toEqual({ band: { top: 74, bottom: 126 }, at: null })
  })
})

describe('rhythmAria', () => {
  it('reads the rhythm caption without its "Rhythm: "', () => {
    expect(rhythmAria('Rhythm: 8ths in 5, with accents · back on one every 5 bars')).toBe('; rhythm: 8ths in 5, with accents · back on one every 5 bars')
  })
  it('is empty with no rhythm drawn', () => {
    expect(rhythmAria(null)).toBe('')
  })
})
