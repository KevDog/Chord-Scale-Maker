import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, chartBeats, expandRows, parseChart, qualityScale } from '../chart'
import {
  type GuideInput,
  guideLabel,
  type GuideNote,
  guideTonesFor,
  guideVoices,
  voiceAccidentals,
} from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import * as engine from '../index'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { toVexKey } from '../sheet'
import { isSyncCopy } from '../util'

const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const BASS: Part = { clef: 'bass', trans: 'C' }

describe('guide tones per chord', () => {
  it('takes the 3rd and 7th from the quality, spelled from the written root', () => {
    const tones = (chord: string, part: Part = CONCERT) => {
      const g = guideTonesFor(part, chord)
      return g && [rootName(g.third.note), g.third.label, rootName(g.seventh.note), g.seventh.label]
    }
    expect(tones('Dm7')).toEqual(['F', 'b3', 'C', 'b7'])
    expect(tones('G7')).toEqual(['B', '3', 'F', 'b7'])
    expect(tones('CMaj7')).toEqual(['E', '3', 'B', '7'])
    expect(tones('Bdim7')).toEqual(['D', 'b3', 'Ab', 'bb7'])
    expect(tones('C6')).toEqual(['E', '3', 'A', '6'])
    expect(tones('G7sus4')).toEqual(['C', '4', 'F', 'b7'])
    expect(tones('F')).toEqual(['A', '3', 'F', '1'])
    expect(tones('Gm')).toEqual(['Bb', 'b3', 'G', '1'])
    expect(tones('CmMaj7')).toEqual(['Eb', 'b3', 'B', '7'])
    expect(tones('Em7b5')).toEqual(['G', 'b3', 'D', 'b7'])
    expect(tones('D7/F#')).toEqual(['F#', '3', 'C', 'b7'])
    expect(tones('Cm7', TENOR)).toEqual(['F', 'b3', 'C', 'b7']) // written Dm7
    expect(tones('FMaj7#11')).toEqual(['A', '3', 'E', '7']) // extended: its base quality
    expect(tones('D7sus4b9')).toEqual(['G', '4', 'C', 'b7'])
    expect(tones('Cm7#5#9x')).toBeNull()
    expect(tones('???')).toBeNull()
  })
})

/** chord i on row i, one after another, len beats each */
const inTurn = (chords: readonly string[], len = 4): GuideInput[] => chords.map((chord, i) => ({ row: i, chord, start: i * len, beats: len }))
/** a note as "beat:key/beats", then ~ (tie), ^ (tied in) and its accidental */
const noteText = (n: GuideNote): string =>
  `${n.beat}:${n.pitch ? toVexKey(n.pitch) : 'rest'}/${n.beats}${n.tie ? '~' : ''}${n.tiedIn ? '^' : ''}${n.accidental ?? ''}`
/** each bar's one voice in order */
const barsText = (g: ReturnType<typeof guideVoices>): string[] =>
  [...g.bars.entries()].sort(([a], [b]) => a - b).map(([, voice]) => voice.map(noteText).join(' '))

describe('guideLabel', () => {
  it('drops the flat or sharp from the degree', () => {
    expect(['b3', '3', 'b7', 'bb7', '7', '4', '1', '6', '#11'].map(guideLabel)).toEqual(['3', '3', '7', '7', '7', '4', '1', '6', '11'])
  })
})

describe('guideVoices', () => {
  it("gives nothing, not even a diagnostic, with the line 'off'", () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x']), CONCERT, 4, null, 'off')
    expect([g.bars.size, g.labels.size, g.missing]).toEqual([0, 0, []])
  })

  it('voices one line, from the 3rd or the 7th: one voice a bar and one label a chord, alternating 3 and 7', () => {
    const third = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, 'third')
    expect(barsText(third)).toEqual(['0:f/4/4', '0:f/4/4', '0:e/4/4'])
    expect([...third.labels]).toEqual([[0, '3'], [1, '7'], [2, '3']])
    const seventh = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, 'seventh')
    expect(barsText(seventh)).toEqual(['0:c/5/4', '0:b/4/4', '0:b/4/4'])
    expect([...seventh.labels]).toEqual([[0, '7'], [1, '3'], [2, '7']])
  })

  it('builds the line on its own: from the 3rd it takes F#4, the tone the line from the 7th takes too', () => {
    const third = guideVoices(inTurn(['Fm7', 'GMaj7']), CONCERT, 4, null, 'third')
    expect(barsText(third)).toEqual(['0:ab/4/4b', '0:f#/4/4#'])
    expect([...third.labels]).toEqual([[0, '3'], [1, '7']])
  })

  it('holds a chord that repeats the guide tones: tied from the chord before, its label printed again (rule 5)', () => {
    const third = guideVoices(inTurn(['C7', 'C7b9'], 2), CONCERT, 4, null, 'third')
    expect(barsText(third)).toEqual(['0:e/4/2~ 2:e/4/2^'])
    expect([...third.labels]).toEqual([[0, '3'], [1, '3']])
    expect(barsText(guideVoices(inTurn(['C7', 'C7b9'], 2), CONCERT, 4, null, 'seventh'))).toEqual(['0:bb/4/2~b 2:bb/4/2^'])
  })

  it('strikes a repeated chord again in a new block, untied (rule 5)', () => {
    const chords = inTurn(['C7', 'C7b9']).map((c, i) => ({ ...c, block: i }))
    expect(barsText(guideVoices(chords, CONCERT, 4, null, 'third'))).toEqual(['0:e/4/4', '0:e/4/4'])
  })

  it('labels the real degree: 6 on a 6 chord, 4 on a sus chord, 1 on a triad, 7 on a dim7', () => {
    expect([...guideVoices(inTurn(['C6', 'C7sus4', 'C']), CONCERT, 4, null, 'third').labels.values()]).toEqual(['3', '4', '3'])
    expect([...guideVoices(inTurn(['C6', 'C7sus4', 'C']), CONCERT, 4, null, 'seventh').labels.values()]).toEqual(['6', '7', '1'])
    expect([...guideVoices(inTurn(['Bdim7']), CONCERT, 4, null, 'seventh').labels]).toEqual([[0, '7']])
  })

  it('holds a chord across barlines with ties, the carried pieces marked tied in', () => {
    expect(barsText(guideVoices(inTurn(['Dm7'], 8), CONCERT, 4, null, 'third'))).toEqual(['0:f/4/4~', '0:f/4/4^'])
  })

  it('writes a whole bar of 3/4 as a dotted half, tied over the barline', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Dm7', start: 0, beats: 3 },
      { row: 1, chord: 'G7', start: 3, beats: 6 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 3, null, 'seventh'))).toEqual(['0:c/5/3', '0:b/4/3~', '0:b/4/3^'])
  })

  it('writes accidentals against the key signature, and against C without one', () => {
    const chords = inTurn(['Gm7', 'C7', 'FMaj7'])
    expect(barsText(guideVoices(chords, CONCERT, 4, 'F', 'third'))).toEqual(['0:bb/4/4', '0:bb/4/4', '0:a/4/4'])
    expect(barsText(guideVoices(chords, CONCERT, 4, null, 'third'))).toEqual(['0:bb/4/4b', '0:bb/4/4b', '0:a/4/4'])
  })

  it('applies the measure rule within the bar: G4 after Gb4 takes a natural', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Gb', start: 0, beats: 2 },
      { row: 1, chord: 'Em', start: 2, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, 'seventh'))).toEqual(['0:gb/4/2b 2:g/4/2n'])
  })

  it('writes the sharp again on a note struck after the same note was held over the barline', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'D7', start: 0, beats: 6 },
      { row: 1, chord: 'D', start: 6, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, 'third'))).toEqual(['0:f#/4/4~#', '0:f#/4/2^ 2:f#/4/2#'])
  })

  it('rests on a chord without guide tones, reports it once, and labels nothing there', () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x', 'CMaj7', 'Cm7#5#9x', '???']), CONCERT, 4, null, 'third')
    expect(barsText(g)).toEqual(['0:f/4/4', '0:rest/4', '0:e/4/4', '0:rest/4', '0:rest/4'])
    expect([...g.labels.keys()]).toEqual([0, 2])
    expect(g.missing).toEqual(['no guide tones for Cm7#5#9x (unknown chord quality)', "no guide tones for ??? (can't read the chord)"])
  })

  it('ignores a scale it cannot read rather than the chord', () => {
    const g = guideVoices([{ row: 0, chord: 'Dm7', scale: 'D Dorain', start: 0, beats: 4 }], CONCERT, 4, null, 'third')
    expect([[...g.labels], g.missing]).toEqual([[[0, '3']], []])
  })

  it('writes for the part: a Bb part a step up, a bass part inside E2-C4', () => {
    expect(barsText(guideVoices(inTurn(['Cm7', 'F7', 'BbMaj7']), TENOR, 4, null, 'third'))).toEqual(['0:f/4/4', '0:f/4/4', '0:e/4/4'])
    const bass = inTurn(['Dm7', 'G7', 'CMaj7', 'C6', 'C7sus4', 'C'])
    expect(barsText(guideVoices(bass, BASS, 4, null, 'third'))).toEqual(['0:f/3/4', '0:f/3/4', '0:e/3/4', '0:e/3/4', '0:f/3/4', '0:e/3/4'])
    expect(barsText(guideVoices(bass, BASS, 4, null, 'seventh'))).toEqual(['0:c/3/4', '0:b/2/4', '0:b/2/4', '0:a/2/4', '0:bb/2/4b', '0:c/3/4'])
  })
})

describe('voiceAccidentals', () => {
  const at = (beat: number, letter: 0 | 1 | 3, acc: number, midi: number, tiedIn = false): GuideNote => ({
    pitch: { letter, acc, midi },
    beat,
    beats: 1,
    tie: false,
    tiedIn,
    accidental: null,
  })
  const accs = (voice: readonly GuideNote[]) => voiceAccidentals(voice, null).map((n) => n.accidental)

  it('F#4, then F4: a natural', () => {
    expect(accs([at(0, 3, 1, 66), at(1, 3, 0, 65)])).toEqual(['#', 'n'])
  })

  it('a note tied in puts nothing in force: the next F#4 struck writes its sharp', () => {
    expect(accs([at(0, 3, 1, 66, true), at(1, 1, 0, 62), at(2, 3, 1, 66)])).toEqual([null, null, '#'])
  })

  it('leaves rests without an accidental', () => {
    const rest: GuideNote = { pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }
    expect(accs([rest])).toEqual([null])
  })
})

describe('guide tone lines over the library', () => {
  const charts = readdirSync('charts')
    .filter((name) => !isSyncCopy(name))
    .map((name) => ({ name, doc: parseChart(readFileSync(`charts/${name}`, 'utf8')).value }))
  const inputs = (doc: ChartDoc): GuideInput[] => {
    const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
    return events.map((e, i) => ({ row: i, chord: e.chord, scale: qualityScale(e.row) ?? undefined, start: e.start, beats: e.beats }))
  }
  const RANGE = { treble: [60, 81], bass: [40, 60] } as const

  for (const [name, part] of [['concert', CONCERT], ['bass', BASS]] as const)
    for (const line of ['third', 'seventh'] as const)
      it(`from the ${line === 'third' ? '3rd' : '7th'}, ${name}: at least 85% of moves are steps; every chord is labelled and the line stays in range`, () => {
        let moves = 0
        let steps = 0
        const faults: string[] = []
        for (const { name: chart, doc } of charts) {
          const chords = inputs(doc)
          const g = guideVoices(chords, part, chartBeats(doc), null, line)
          if (g.missing.length) faults.push(`${chart}: ${g.missing.join('; ')}`)
          if (g.labels.size !== chords.length) faults.push(`${chart}: ${g.labels.size} of ${chords.length} chords labelled`)
          const bars = [...g.bars.entries()].sort(([a], [b]) => a - b)
          for (const [bar, voice] of bars)
            for (const n of voice)
              if (n.pitch && (n.pitch.midi < RANGE[part.clef][0] || n.pitch.midi > RANGE[part.clef][1])) faults.push(`${chart} bar ${bar}: ${toVexKey(n.pitch)} out of range`)
          const struck = bars.flatMap(([, voice]) => voice).filter((n) => !n.tiedIn)
          struck.slice(1).forEach((n, j) => {
            const before = struck[j]?.pitch
            if (!n.pitch || !before) return
            moves++
            if (Math.abs(n.pitch.midi - before.midi) <= 2) steps++
          })
        }
        expect(faults).toEqual([])
        expect(steps / moves).toBeGreaterThanOrEqual(0.85)
      })
})

describe('the engine', () => {
  it('keeps the guide tone helpers, and has no Guide tones sheet model', () => {
    expect(engine).toHaveProperty('guideToneDegrees')
    expect(engine).toHaveProperty('guideTonesFor')
    expect(engine).toHaveProperty('guideToneTimeline')
    expect(engine).toHaveProperty('guideVoices')
    expect(engine).not.toHaveProperty('buildGuideTones')
  })
})
