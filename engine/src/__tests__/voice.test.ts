import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { parseChart } from '../chart'
import type { ClickPlan } from '../click'
import type { GuideNote } from '../guideTones'
import type { RhythmNote } from '../rhythm'
import { CONCERT, type Part, partFor } from '../part'
import { arpeggioPhrase, pentatonicPhrase, rhythmHits, scalePhrase, scheduleRhythm, scheduleVoice, swingBeat, timePhrase, voiceNotes } from '../voice'

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
    expect([0, 0.5, 1.5, 0.25, 1 / 3, 2].map((at) => swingBeat(at))).toEqual([0, 2 / 3, 1 + 2 / 3, 0.25, 1 / 3, 2])
  })

  it('moves it as far as the dial says: straight at 50%, a dotted 8th and 16th at 75%', () => {
    expect([0.5, 2.5].map((at) => swingBeat(at, 0.5))).toEqual([0.5, 2.5])
    expect([0.5, 2.5].map((at) => swingBeat(at, 0.75))).toEqual([0.75, 2.75])
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

  it('swings as far as the click’s swing dial says', () => {
    const off = scheduleVoice(line, 2, plan({ options: { beats: 4, feel: 'swing', hat: false, swing: 0.75 } }), { barStart: 0, bar: 0 }, 0, 4)[1]
    expect(off?.time).toBeCloseTo(2.75)
    expect(off?.length).toBeCloseTo(0.25)
  })

  it('leaves a 16th beat straight: no two notes at once, none of no length', () => {
    const sixteenths = [
      { bar: 0, at: 0, beats: 0.5, midi: 60, straight: true as const, straightEnd: true as const },
      { bar: 0, at: 0.5, beats: 0.25, midi: 62, straight: true as const, straightEnd: true as const },
      { bar: 0, at: 0.75, beats: 0.25, midi: 64 },
    ]
    const notes = scheduleVoice(sixteenths, 1, plan({ options: { beats: 4, feel: 'swing', hat: false, swing: 0.75 } }), { barStart: 0, bar: 0 }, 0, 4)
    expect(notes.map((n) => [n.time, n.length])).toEqual([
      [0, 0.5],
      [0.5, 0.25],
      [0.75, 0.25],
    ])
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

describe('voiceNotes and rhythmHits mark a beat that isn’t 8ths straight', () => {
  it('a 16th beat: its notes keep their place under swing', () => {
    const voice = [note(0, 0.5, 60), note(0.5, 0.25, 62), note(0.75, 0.25, 64), note(1, 0.5, 65), note(1.5, 0.5, 67)]
    expect(voiceNotes([{ beats: 4, voice }], 'C').map((n) => [n.at, !!n.straight, !!n.straightEnd])).toEqual([
      [0, true, true],
      [0.5, true, true],
      [0.75, true, false],
      [1, false, false],
      [1.5, false, false],
    ])
    const rhythm = [0, 0.5, 0.75, 1.5].map((beat) => ({ beat, value: '16', rest: false, accent: false, tie: false, tiedIn: false, tuplet: null, ratio: null }) as unknown as RhythmNote)
    expect(rhythmHits([{ beats: 4, rhythm, voice: [] }]).map((h) => [h.at, !!h.straight])).toEqual([
      [0, true],
      [0.5, true],
      [0.75, true],
      [1.5, false],
    ])
  })

  it('a rest’s edges count: an 8th then a 16th rest keeps the beat straight', () => {
    const voice = [note(0, 0.5, 60), note(0.5, 0.25, 62), note(0.75, 0.25, null)]
    expect(voiceNotes([{ beats: 4, voice }], 'C').map((n) => !!n.straight)).toEqual([true, true])
  })
})

describe('rhythmHits', () => {
  const eight = parseChart('title: T\nkey: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | CMaj7\n5 | Dm7\n6 | G7\n7 | CMaj7\n8 | CMaj7\n').value
  const drawn = (line: 'off' | 'third' | 'up-root', restate = false) =>
    buildChanges(eight, CONCERT, 4, false, line, undefined, null, 'none', { rhythm: 'unit:8:5:accents', restate }).lines.flatMap((l) => l.bars)

  it('taps the rhythm line’s attacks with the Line off: rests silent, accents kept', () => {
    const bars = drawn('off')
    const struck = bars.flatMap((b, bar) => b.rhythm.filter((n) => !n.rest && !n.tiedIn).map((n) => ({ bar, at: n.beat, accent: n.accent })))
    expect(struck.length).toBeGreaterThan(0)
    expect(rhythmHits(bars)).toEqual(struck)
    expect(rhythmHits(bars).some((h) => h.accent)).toBe(true)
  })

  it('taps the poured Line’s attacks with a Line on: the same rhythm as with the Line off', () => {
    const off = rhythmHits(drawn('off'))
    const on = rhythmHits(drawn('up-root'))
    expect(on.map((h) => [h.bar, h.at])).toEqual(off.map((h) => [h.bar, h.at]))
  })

  it('a Line under a rhythm sounds in its attacks', () => {
    const bars = drawn('up-root')
    expect(voiceNotes(bars, 'C').map((n) => [n.bar, n.at])).toEqual(rhythmHits(bars).map((h) => [h.bar, h.at]))
  })

  it('holds a tie: a note tied in is no new hit', () => {
    const tied = { beat: 0, value: '8', rest: false, accent: false, tie: false, tiedIn: true, tuplet: null, ratio: null } as unknown as RhythmNote
    const struck = { ...tied, beat: 1, tiedIn: false, accent: true } as RhythmNote
    expect(rhythmHits([{ beats: 4, rhythm: [tied, struck], voice: [] }])).toEqual([{ bar: 0, at: 1, accent: true }])
    const voice = [note(0, 1, 60, false, true), note(1, 1, 62)].map((n) => ({ ...n, mark: { value: '4', tuplet: null, ratio: null, beam: null, accent: false } }) as unknown as GuideNote)
    expect(rhythmHits([{ beats: 4, rhythm: [], voice }])).toEqual([{ bar: 0, at: 1, accent: false }])
  })

  it('none for an unpoured Line: a guide line without Restate', () => {
    expect(rhythmHits(drawn('third'))).toEqual([])
  })
})

describe('scheduleRhythm', () => {
  const plan = (o: Partial<ClickPlan> = {}): ClickPlan => ({ options: { beats: 4, feel: 'quarters', hat: false }, tempo: 60, countIn: 0, ...o })
  const hits = [
    { bar: 0, at: 0, accent: true },
    { bar: 0, at: 2.5, accent: false },
    { bar: 1, at: 1, accent: false },
  ]

  it('books each bar’s hits at the tempo, the form looping from the top', () => {
    expect(scheduleRhythm(hits, 2, plan(), { barStart: 0, bar: 0 }, 0, 9).map((h) => [h.time, h.accent])).toEqual([
      [0, true],
      [2.5, false],
      [5, false],
      [8, true],
    ])
  })

  it('waits out the count-in', () => {
    expect(scheduleRhythm(hits, 2, plan({ countIn: 1 }), { barStart: 0, bar: 0 }, 0, 6).map((h) => h.time)).toEqual([4])
  })

  it('swings an off-beat 8th with the click on Swing', () => {
    const off = scheduleRhythm(hits, 2, plan({ options: { beats: 4, feel: 'swing', hat: false } }), { barStart: 0, bar: 0 }, 0, 4)[1]
    expect(off?.time).toBeCloseTo(2 + 2 / 3)
  })

  it('leaves a straight hit in place under swing', () => {
    const at = scheduleRhythm([{ bar: 0, at: 0.5, accent: false, straight: true }], 1, plan({ options: { beats: 4, feel: 'swing', hat: false, swing: 0.75 } }), { barStart: 0, bar: 0 }, 0, 4)
    expect(at.map((h) => h.time)).toEqual([0.5])
  })

  it('books nothing with no hits', () => {
    expect(scheduleRhythm([], 0, plan(), { barStart: 0, bar: 0 }, 0, 10)).toEqual([])
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

describe('pentatonicPhrase', () => {
  const A = { letter: 5, acc: 0 } as const
  const E = { letter: 2, acc: 0 } as const

  it('runs the minor pentatonic up to its octave and back, from the Scales root register', () => {
    const phrase = pentatonicPhrase(A, CONCERT)
    expect(phrase.map((n) => n.midi)).toEqual([69, 72, 74, 76, 79, 81, 79, 76, 74, 72, 69])
    expect(phrase.at(-1)).toEqual({ at: 5, beats: 1, midi: 69 })
  })

  it('places the written root for the part and sounds at concert pitch', () => {
    expect(pentatonicPhrase(E, partFor('tenor-sax'))[0]!.midi).toBe(64 - 2)
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

  it('swings as far as the dial says', () => {
    expect(timePhrase(phrase, 60, 'swing', 0, 0.75)[1]?.time).toBeCloseTo(0.75)
  })
})
