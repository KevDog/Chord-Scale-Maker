import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type ChartDoc, chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import {
  type GuideInput,
  guideLabel,
  type GuideNote,
  type GuideShow,
  guideTonesFor,
  guideVoices,
  NO_GUIDES,
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

const BOTH: GuideShow = { fromThird: true, fromSeventh: true }
const THIRD: GuideShow = { fromThird: true, fromSeventh: false }
const SEVENTH: GuideShow = { fromThird: false, fromSeventh: true }
/** chord i on row i, one after another, len beats each */
const inTurn = (chords: readonly string[], len = 4): GuideInput[] => chords.map((chord, i) => ({ row: i, chord, start: i * len, beats: len }))
/** a note as "beat:key/beats", then ~ (tie), ^ (tied in) and its accidental */
const noteText = (n: GuideNote): string =>
  `${n.beat}:${n.pitch ? toVexKey(n.pitch) : 'rest'}/${n.beats}${n.tie ? '~' : ''}${n.tiedIn ? '^' : ''}${n.accidental ?? ''}`
/** each bar in order, its voices top to bottom joined by " | " */
const barsText = (g: ReturnType<typeof guideVoices>): string[] =>
  [...g.bars.entries()].sort(([a], [b]) => a - b).map(([, voices]) => voices.map((v) => v.map(noteText).join(' ')).join(' | '))

describe('guideLabel', () => {
  it('drops the flat or sharp from the degree', () => {
    expect(['b3', '3', 'b7', 'bb7', '7', '4', '1', '6', '#11'].map(guideLabel)).toEqual(['3', '3', '7', '7', '7', '4', '1', '6', '11'])
  })
})

describe('guideVoices', () => {
  it('gives nothing, not even a diagnostic, with both toggles off', () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x']), CONCERT, 4, null, NO_GUIDES)
    expect([g.bars.size, g.labels.size, g.missing]).toEqual([0, 0, []])
  })

  it('both on: lines A and B as two voices, upper first, that move by step, their labels swapping 7/3 -> 3/7 -> 7/3', () => {
    const g = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:c/5/4 | 0:f/4/4', '0:b/4/4 | 0:f/4/4', '0:b/4/4 | 0:e/4/4'])
    expect([...g.labels]).toEqual([[0, ['7', '3']], [1, ['3', '7']], [2, ['7', '3']]])
  })

  it('one on: that line alone, from the 3rd (A) or the 7th (B), its labels alternating 3 and 7', () => {
    const third = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, THIRD)
    expect(barsText(third)).toEqual(['0:f/4/4', '0:f/4/4', '0:e/4/4'])
    expect([...third.labels]).toEqual([[0, ['3']], [1, ['7']], [2, ['3']]])
    const seventh = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, SEVENTH)
    expect(barsText(seventh)).toEqual(['0:c/5/4', '0:b/4/4', '0:b/4/4'])
    expect([...seventh.labels]).toEqual([[0, ['7']], [1, ['3']], [2, ['7']]])
  })

  it('one on: the line shown is still built with the other, so it gives way where they collide (rule 7)', () => {
    const third = guideVoices(inTurn(['Cm6', 'D7']), CONCERT, 4, null, THIRD) // alone, A would take F#4; B falls to it
    expect(barsText(third)).toEqual(['0:eb/4/4b', '0:c/4/4'])
    expect([...third.labels]).toEqual([[0, ['3']], [1, ['7']]])
  })

  it('both on: the voices are sorted by pitch at every chord, so lines that cross swap voices (rule 7.3)', () => {
    const g = guideVoices(inTurn(['Fm7', 'GMaj7']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:ab/4/4b | 0:eb/4/4b', '0:b/4/4 | 0:f#/4/4#']) // A: Ab4 -> F#4, B: Eb4 -> B4
    expect([...g.labels]).toEqual([[0, ['3', '7']], [1, ['3', '7']]])
  })

  it('holds a chord that repeats the guide tones: tied from the chord before, its label printed again (rule 5)', () => {
    const g = guideVoices(inTurn(['C7', 'C7b9'], 2), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:bb/4/2~b 2:bb/4/2^ | 0:e/4/2~ 2:e/4/2^'])
    expect([...g.labels]).toEqual([[0, ['7', '3']], [1, ['7', '3']]])
  })

  it('strikes a repeated chord again in a new block, untied (rule 5)', () => {
    const chords = inTurn(['C7', 'C7b9']).map((c, i) => ({ ...c, block: i }))
    expect(barsText(guideVoices(chords, CONCERT, 4, null, THIRD))).toEqual(['0:e/4/4', '0:e/4/4'])
  })

  it('labels the real degree: 6 on a 6 chord, 4 on a sus chord, 1 on a triad, 7 on a dim7', () => {
    const g = guideVoices(inTurn(['C6', 'C7sus4', 'C', 'Bdim7']), CONCERT, 4, null, BOTH)
    expect([...g.labels]).toEqual([[0, ['6', '3']], [1, ['7', '4']], [2, ['1', '3']], [3, ['7', '3']]])
  })

  it('holds a chord across barlines with ties, the carried pieces marked tied in', () => {
    expect(barsText(guideVoices(inTurn(['Dm7'], 8), CONCERT, 4, null, THIRD))).toEqual(['0:f/4/4~', '0:f/4/4^'])
  })

  it('writes a whole bar of 3/4 as a dotted half, tied over the barline in both voices', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Dm7', start: 0, beats: 3 },
      { row: 1, chord: 'G7', start: 3, beats: 6 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 3, null, BOTH))).toEqual(['0:c/5/3 | 0:f/4/3', '0:b/4/3~ | 0:f/4/3~', '0:b/4/3^ | 0:f/4/3^'])
  })

  it('writes accidentals against the key signature, and against C without one', () => {
    const chords = inTurn(['Gm7', 'C7', 'FMaj7'])
    expect(barsText(guideVoices(chords, CONCERT, 4, 'F', BOTH))).toEqual(['0:bb/4/4 | 0:f/4/4', '0:bb/4/4 | 0:e/4/4', '0:a/4/4 | 0:e/4/4'])
    expect(barsText(guideVoices(chords, CONCERT, 4, null, BOTH))).toEqual(['0:bb/4/4b | 0:f/4/4', '0:bb/4/4b | 0:e/4/4', '0:a/4/4 | 0:e/4/4'])
  })

  it("applies the measure rule across both voices: the upper G4 cancels the lower voice's Gb4 earlier in the bar", () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'Gb', start: 0, beats: 2 },
      { row: 1, chord: 'Em', start: 2, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, BOTH))).toEqual(['0:bb/4/2b 2:g/4/2n | 0:gb/4/2b 2:e/4/2'])
  })

  it('writes the sharp again on a note struck after the same note was held over the barline', () => {
    const chords: GuideInput[] = [
      { row: 0, chord: 'D7', start: 0, beats: 6 },
      { row: 1, chord: 'D', start: 6, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, THIRD))).toEqual(['0:f#/4/4~#', '0:f#/4/2^ 2:f#/4/2#'])
  })

  it('rests in every voice on a chord without guide tones, reports it once, and labels nothing there', () => {
    const g = guideVoices(inTurn(['Dm7', 'Cm7#5#9x', 'CMaj7', 'Cm7#5#9x', '???']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:c/5/4 | 0:f/4/4', '0:rest/4 | 0:rest/4', '0:b/4/4 | 0:e/4/4', '0:rest/4 | 0:rest/4', '0:rest/4 | 0:rest/4'])
    expect([...g.labels.keys()]).toEqual([0, 2])
    expect(g.missing).toEqual(['no guide tones for Cm7#5#9x (unknown chord quality)', "no guide tones for ??? (can't read the chord)"])
  })

  it('ignores a scale it cannot read rather than the chord', () => {
    const g = guideVoices([{ row: 0, chord: 'Dm7', scale: 'D Dorain', start: 0, beats: 4 }], CONCERT, 4, null, THIRD)
    expect([[...g.labels], g.missing]).toEqual([[[0, ['3']]], []])
  })

  it('writes for the part: a Bb part a step up, a bass part inside E2-C4', () => {
    expect(barsText(guideVoices(inTurn(['Cm7', 'F7', 'BbMaj7']), TENOR, 4, null, BOTH))).toEqual(['0:c/5/4 | 0:f/4/4', '0:b/4/4 | 0:f/4/4', '0:b/4/4 | 0:e/4/4'])
    const bass = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7', 'C6', 'C7sus4', 'C']), BASS, 4, null, BOTH)
    expect(barsText(bass)).toEqual([
      '0:f/3/4 | 0:c/3/4',
      '0:f/3/4 | 0:b/2/4',
      '0:e/3/4 | 0:b/2/4',
      '0:e/3/4 | 0:a/2/4',
      '0:f/3/4 | 0:bb/2/4b',
      '0:e/3/4 | 0:c/3/4',
    ])
  })
})

describe('voiceAccidentals', () => {
  const at = (beat: number, letter: 0 | 1 | 3, acc: number, midi: number, tiedIn = false): GuideNote => ({
    pitch: { letter, acc, midi },
    beat,
    beats: 2,
    tie: false,
    tiedIn,
    accidental: null,
  })
  const C5 = (beat: number) => at(beat, 0, 0, 72)
  const D4 = (beat: number) => at(beat, 1, 0, 62)
  const accs = (voices: readonly (readonly GuideNote[])[]) => voiceAccidentals(voices, null).map((v) => v.map((n) => n.accidental))

  it('F#4 in the lower voice, then F4 in the upper: a natural', () => {
    expect(accs([[C5(0), at(2, 3, 0, 65)], [at(0, 3, 1, 66), D4(2)]])).toEqual([[null, 'n'], ['#', null]])
  })

  it('a lower note tied in puts nothing in force: the upper voice on its letter and octave writes its sharp', () => {
    expect(accs([[C5(0), at(2, 3, 1, 66)], [at(0, 3, 1, 66, true), D4(2)]])).toEqual([[null, '#'], [null, null]])
  })

  it('leaves rests without an accidental', () => {
    const rest: GuideNote = { pitch: null, beat: 0, beats: 4, tie: false, tiedIn: false, accidental: null }
    expect(accs([[rest], [rest]])).toEqual([[null], [null]])
  })
})

describe('guide tone voices over the library', () => {
  const charts = readdirSync('../charts')
    .filter((name) => !isSyncCopy(name))
    .map((name) => ({ name, doc: parseChart(readFileSync(`../charts/${name}`, 'utf8')).value }))
  const inputs = (doc: ChartDoc): GuideInput[] => {
    const { events } = guideToneTimeline(expandRows(doc).value, chartBeats(doc))
    return events.map((e, i) => ({ row: i, chord: e.chord, scale: resolveScale(e.row) ?? undefined, start: e.start, beats: e.beats }))
  }
  const RANGE = { treble: [60, 81], bass: [40, 60] } as const

  for (const [name, part] of [['concert', CONCERT], ['bass', BASS]] as const) {
    it(`both on, ${name}: at least 85% of moves are steps; the voices never cross, stay a minor 3rd apart and in range`, () => {
      let moves = 0
      let steps = 0
      const faults: string[] = []
      for (const { name: chart, doc } of charts) {
        const chords = inputs(doc)
        const g = guideVoices(chords, part, chartBeats(doc), null, BOTH)
        if (g.missing.length) faults.push(`${chart}: ${g.missing.join('; ')}`)
        if (g.labels.size !== chords.length) faults.push(`${chart}: ${g.labels.size} of ${chords.length} chords labelled`)
        for (const [row, l] of g.labels) if (l[0] === l[1]) faults.push(`${chart} row ${row}: both voices labelled ${l[0]}`)
        const bars = [...g.bars.entries()].sort(([a], [b]) => a - b)
        for (const [bar, [upper = [], lower = []]] of bars) {
          if (upper.map((n) => n.beat).join() !== lower.map((n) => n.beat).join()) faults.push(`${chart} bar ${bar}: voices out of step`)
          upper.forEach((u, i) => {
            const l = lower[i]
            if (u.pitch && l?.pitch && u.pitch.midi - l.pitch.midi < 3) faults.push(`${chart} bar ${bar}: ${toVexKey(u.pitch)} over ${toVexKey(l.pitch)}`)
          })
          for (const n of [...upper, ...lower])
            if (n.pitch && (n.pitch.midi < RANGE[part.clef][0] || n.pitch.midi > RANGE[part.clef][1])) faults.push(`${chart} bar ${bar}: ${toVexKey(n.pitch)} out of range`)
        }
        for (const v of [0, 1]) {
          const struck = bars.flatMap(([, voices]) => voices[v] ?? []).filter((n) => !n.tiedIn)
          struck.slice(1).forEach((n, j) => {
            const before = struck[j]?.pitch
            if (!n.pitch || !before) return
            moves++
            if (Math.abs(n.pitch.midi - before.midi) <= 2) steps++
          })
        }
      }
      expect(faults).toEqual([])
      expect(steps / moves).toBeGreaterThanOrEqual(0.85)
    })
  }
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
