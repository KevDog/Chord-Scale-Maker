import { describe, expect, it } from 'vitest'
import type { ChangesBar, ChangesChord, ChangesLine, GuideNote, Letter } from '~~/engine'
import { beatXs, guideAria, restatedAccidental, tieDirection, voicedBand, voltaShift } from '~/utils/changesDrawing'

const chord = (beat: number, text: string, guide: readonly string[]): ChangesChord => ({
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
})
const bar = (chords: readonly ChangesChord[], voices: readonly (readonly GuideNote[])[]): ChangesBar => ({
  keySig: null,
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
  voices,
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

describe('tieDirection', () => {
  it("curves two voices' ties apart, the upper above and the lower below; one voice keeps VexFlow's", () => {
    expect(tieDirection(2, 0)).toBe(-1)
    expect(tieDirection(2, 1)).toBe(1)
    expect(tieDirection(1, 0)).toBeNull()
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
  it('is empty with no guide tone on', () => {
    expect(guideAria({ bars: [bar([chord(0, 'C7', [])], [])] })).toBe('')
  })

  it("names each chord's notes top to bottom with their labels, and a held bar as a dash", () => {
    const line: ChangesLine = {
      bars: [
        bar(
          [chord(0, 'Dm7', ['7', '3']), chord(2, 'G7', ['3', '7'])],
          [
            [note(0, 0, 72, 0, 2), note(6, 0, 71, 2, 2)],
            [note(3, 0, 65, 0, 2), note(3, 0, 65, 2, 2)],
          ],
        ),
        bar([chord(0, 'CMaj7', ['7', '3'])], [[note(6, 0, 71, 0, 4, { tie: true })], [note(2, 0, 64, 0, 4, { tie: true })]]),
        bar([], [[note(6, 0, 71, 0, 4, { tiedIn: true })], [note(2, 0, 64, 0, 4, { tiedIn: true })]]),
      ],
    }
    expect(guideAria(line)).toBe('; guide tones: C5 7 / F4 3, B4 3 / F4 7 | B4 7 / E4 3 | –')
  })

  it("names a held chord's note, tied in on its own beat, rather than a rest", () => {
    const line: ChangesLine = { bars: [bar([chord(0, 'C7', ['3']), chord(2, 'C7b9', ['3'])], [[note(2, 0, 64, 0, 2, { tie: true }), note(2, 0, 64, 2, 2, { tiedIn: true })]])] }
    expect(guideAria(line)).toBe('; guide tones: E4 3, E4 3')
  })

  it('spells accidentals and names a rest', () => {
    const line: ChangesLine = { bars: [bar([chord(0, 'Gm7', ['3']), chord(2, 'Cm7#5#9x', [])], [[note(6, -1, 70, 0, 2), rest(2, 2)]])] }
    expect(guideAria(line)).toBe('; guide tones: B♭4 3, rest')
  })
})
