import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import type { ClickPlan } from '../click'
import type { GuideNote } from '../guideTones'
import { CONCERT, type Part, partFor } from '../part'
import { arpeggioPhrase, scalePhrase, scheduleVoice, swingBeat, timePhrase, voiceNotes } from '../voice'

const C4 = { letter: 'C', acc: 0, octave: 4, midi: 60 } as unknown as NonNullable<GuideNote['pitch']>
const note = (beat: number, beats: number, midi: number | null, tie = false, tiedIn = false): GuideNote => ({
  pitch: midi === null ? null : { ...C4, midi },
  beat,
  beats,
  tie,
  tiedIn,
  accidental: null,
})

const ii_V_I = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n').value
const bars = (line: 'third' | 'up-root', part = CONCERT) => buildChanges(ii_V_I, part, 4, false, line).lines.flatMap((l) => l.bars)

describe('voiceNotes', () => {
  it('drops rests and merges tied notes across barlines', () => {
    const notes = voiceNotes(
      [
        { beats: 4, voice: [note(0, 2, null), note(2, 2, 64, true)] },
        { beats: 4, voice: [note(0, 4, 64, false, true)] },
      ],
      'C',
    )
    expect(notes).toEqual([{ bar: 0, at: 2, beats: 6, midi: 64 }])
  })

  it('sounds a transposing part at concert pitch, octave transpositions aside', () => {
    const at = (part: Part) => voiceNotes(bars('third', part), part.trans).map((n) => n.midi % 12)
    expect(at(partFor('trumpet'))).toEqual(at(CONCERT))
    expect(at(partFor('alto-sax'))).toEqual(at(CONCERT))
  })

  it('freezes a guide tone line: ii–V–I thirds', () => {
    expect(voiceNotes(bars('third'), 'C')).toMatchInlineSnapshot(`
      [
        {
          "at": 0,
          "bar": 0,
          "beats": 4,
          "midi": 65,
        },
        {
          "at": 0,
          "bar": 1,
          "beats": 4,
          "midi": 65,
        },
        {
          "at": 0,
          "bar": 2,
          "beats": 8,
          "midi": 64,
        },
      ]
    `)
  })

  it('freezes an arpeggio line: up from the root', () => {
    expect(voiceNotes(bars('up-root'), 'C').slice(0, 8)).toMatchInlineSnapshot(`
      [
        {
          "at": 0,
          "bar": 0,
          "beats": 1,
          "midi": 62,
        },
        {
          "at": 1,
          "bar": 0,
          "beats": 1,
          "midi": 65,
        },
        {
          "at": 2,
          "bar": 0,
          "beats": 1,
          "midi": 69,
        },
        {
          "at": 3,
          "bar": 0,
          "beats": 1,
          "midi": 72,
        },
        {
          "at": 0,
          "bar": 1,
          "beats": 1,
          "midi": 67,
        },
        {
          "at": 1,
          "bar": 1,
          "beats": 1,
          "midi": 71,
        },
        {
          "at": 2,
          "bar": 1,
          "beats": 1,
          "midi": 74,
        },
        {
          "at": 3,
          "bar": 1,
          "beats": 1,
          "midi": 77,
        },
      ]
    `)
  })
})

describe('swingBeat', () => {
  it('moves an 8th off the beat to two thirds of it, and leaves other times', () => {
    expect([0, 0.5, 1.5, 0.25, 1 / 3, 2].map(swingBeat)).toEqual([0, 2 / 3, 1 + 2 / 3, 0.25, 1 / 3, 2])
  })
})

describe('scheduleVoice', () => {
  const plan = (o: Partial<ClickPlan> = {}): ClickPlan => ({ options: { beats: 4, feel: 'quarters', hat: false }, tempo: 60, countIn: 0, ...o })
  const line = [
    { bar: 0, at: 0, beats: 2, midi: 60 },
    { bar: 0, at: 2.5, beats: 0.5, midi: 62 },
    { bar: 1, at: 0, beats: 4, midi: 64 },
  ]

  it('books each bar’s notes at the tempo, the form looping from the top', () => {
    expect(scheduleVoice(line, 2, plan(), { barStart: 0, bar: 0 }, 0, 12).map((n) => [n.time, n.length, n.midi])).toEqual([
      [0, 2, 60],
      [2.5, 0.5, 62],
      [4, 4, 64],
      [8, 2, 60],
      [10.5, 0.5, 62],
    ])
  })

  it('waits out the count-in', () => {
    expect(scheduleVoice(line, 2, plan({ countIn: 1 }), { barStart: 0, bar: 0 }, 0, 5).map((n) => n.time)).toEqual([4])
  })

  it('skips a note before from, and one at or after until', () => {
    expect(scheduleVoice(line, 2, plan(), { barStart: 0, bar: 0 }, 1, 4).map((n) => n.time)).toEqual([2.5])
  })

  it('carries on from the click’s state', () => {
    expect(scheduleVoice(line, 2, plan(), { barStart: 4, bar: 1 }, 4, 8).map((n) => n.midi)).toEqual([64])
  })

  it('swings the 8ths with the click on Swing', () => {
    const off = scheduleVoice(line, 2, plan({ options: { beats: 4, feel: 'swing', hat: false } }), { barStart: 0, bar: 0 }, 0, 4)[1]
    expect(off?.time).toBeCloseTo(2 + 2 / 3)
    expect(off?.length).toBeCloseTo(1 / 3)
  })

  it('holds a tied note over the barline, and leaves out a note past the click’s bar (a longer metre’s)', () => {
    const notes = [
      { bar: 0, at: 2, beats: 6, midi: 64 },
      { bar: 0, at: 4, beats: 1, midi: 65 },
    ]
    expect(scheduleVoice(notes, 1, plan(), { barStart: 0, bar: 0 }, 0, 4).map((n) => [n.length, n.midi])).toEqual([[6, 64]])
  })

  it('books nothing for an empty line', () => {
    expect(scheduleVoice([], 0, plan(), { barStart: 0, bar: 0 }, 0, 10)).toEqual([])
  })
})

const pitched = (...midis: number[]) => midis.map((midi) => ({ ...C4, midi }))

describe('scalePhrase', () => {
  it('runs the scale up and down in 8ths, the top once, the last note a quarter', () => {
    expect(scalePhrase(pitched(60, 62, 64), null, 'C')).toEqual([
      { at: 0, beats: 0.5, midi: 60 },
      { at: 0.5, beats: 0.5, midi: 62 },
      { at: 1, beats: 0.5, midi: 64 },
      { at: 1.5, beats: 0.5, midi: 62 },
      { at: 2, beats: 1, midi: 60 },
    ])
  })

  it('plays only the selected notes with Practice on', () => {
    expect(scalePhrase(pitched(60, 62, 64, 65), [true, false, true, false], 'C').map((n) => n.midi)).toEqual([60, 64, 60])
  })

  it('sounds at concert pitch', () => {
    expect(scalePhrase(pitched(62), null, 'Bb')).toEqual([{ at: 0, beats: 1, midi: 60 }])
  })

  it('is empty with no notes', () => {
    expect(scalePhrase([], null, 'C')).toEqual([])
    expect(scalePhrase(pitched(60), [false], 'C')).toEqual([])
  })
})

describe('arpeggioPhrase', () => {
  it('freezes an arpeggio cell: its notes in drawn order, 8ths, the last a quarter', () => {
    expect(arpeggioPhrase(pitched(62, 65, 69, 72), [4], false, 'C')).toEqual([
      { at: 0, beats: 0.5, midi: 62 },
      { at: 0.5, beats: 0.5, midi: 65 },
      { at: 1, beats: 0.5, midi: 69 },
      { at: 1.5, beats: 1, midi: 72 },
    ])
  })

  it('sounds a Block group as one chord, a quarter each', () => {
    expect(arpeggioPhrase(pitched(60, 64, 67, 62, 65, 69), [3, 3], true, 'C')).toEqual([
      ...[60, 64, 67].map((midi) => ({ at: 0, beats: 1, midi })),
      ...[62, 65, 69].map((midi) => ({ at: 1, beats: 1, midi })),
    ])
  })
})

describe('timePhrase', () => {
  const phrase = [
    { at: 0, beats: 0.5, midi: 60 },
    { at: 0.5, beats: 1, midi: 62 },
  ]

  it('times the phrase at the tempo from its start', () => {
    expect(timePhrase(phrase, 120, 'straight', 10)).toEqual([
      { time: 10, length: 0.25, midi: 60 },
      { time: 10.25, length: 0.5, midi: 62 },
    ])
  })

  it('swings its off-beat 8ths', () => {
    const [a, b] = timePhrase(phrase, 60, 'swing', 0)
    expect(a?.length).toBeCloseTo(2 / 3)
    expect(b?.time).toBeCloseTo(2 / 3)
    expect(b?.length).toBeCloseTo(1) // it ends off the beat too, swung
  })
})
