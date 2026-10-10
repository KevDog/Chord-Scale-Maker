import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ChartDoc, Row } from '../chart'
import { chartBeats, expandRows, parseChart, resolveScale } from '../chart'
import {
  buildGuideTones,
  type GuideInput,
  guideLabel,
  type GuideNote,
  type GuideShow,
  guideTonesFor,
  guideVoices,
  type LegacyGuideNote,
  NO_GUIDES,
  voiceAccidentals,
} from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { toVexKey } from '../sheet'
import { isSyncCopy } from '../util'
import { parseKey } from '../analysis/keys'
import { voiceLeadOne } from '../voiceLeading'

const row = (bar: string, chord: string, scale = ''): Row => ({ section: 'A', bar, chord, scale })
const rowsOf = (text: string): readonly Row[] => expandRows(parseChart(text).value).value
const TENOR: Part = { clef: 'treble', trans: 'Bb' }
const BASS: Part = { clef: 'bass', trans: 'C' }

/** each line's notes as "f/4" keys, one per chord (struck notes only, ties skipped) */
const struck = (rows: readonly Row[], part: Part = CONCERT): [string[], string[]] => {
  const sheet = buildGuideTones(rows, part)
  const bars = sheet.systems.flatMap((s) => s.bars)
  const line = (i: 0 | 1): string[] => {
    const notes = bars.flatMap((b) => b.lines[i])
    return notes.filter((_, j) => !notes[j - 1]?.tie).map((n: LegacyGuideNote) => (n.pitch ? toVexKey(n.pitch) : 'rest'))
  }
  return [line(0), line(1)]
}

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

describe('timeline', () => {
  it('splits shared bars and holds a chord until the next change', () => {
    const t = guideToneTimeline([row('1', 'Dm7'), row('2', 'G7'), row('2', 'C7'), row('3', 'F'), row('3', 'Bb'), row('3', 'Eb'), row('5', 'Ab')])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 4],
      ['G7', 4, 2],
      ['C7', 6, 2],
      ['F', 8, 2],
      ['Bb', 10, 1],
      ['Eb', 11, 5], // to bar 5
      ['Ab', 16, 16], // the last row fills out the 4-bar phrase (bars 5-8)
    ])
    expect(t.diagnostics).toEqual([])
  })

  it('runs the last section as long as the one it repeats, in whole 4-bar phrases', () => {
    const end = (text: string) => {
      const { events } = guideToneTimeline(rowsOf(text))
      const last = events.at(-1)
      return last && last.start + last.beats
    }
    expect(end('A1 | 1 | Dm7\n@copy A1 A2 8\nB | 17 | Ebm7\n@copy A1 A3 24\n')).toBe(32 * 4) // So What: 32 bars
    expect(end('A | 1 | Cm7\nA | 5 | Fm7\nA | 7 | Cm7\nA | 9 | F#m7b5\nA | 10 | E7alt\nA | 11 | Cm7\n')).toBe(12 * 4) // 12-bar
    expect(end('A | 1 | C7\nA | 12 | G7\n')).toBe(12 * 4)
  })

  it('treats 1 and 01 as the same bar', () => {
    expect(guideToneTimeline([row('1', 'C7'), row('01', 'F7'), row('2', 'G7')]).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 2],
      ['F7', 2, 2],
      ['G7', 4, 12],
    ])
  })

  it('reports bars it cannot place and keeps going', () => {
    const t = guideToneTimeline([row('1', 'C7'), row('x', 'F7'), row('3', 'G7'), row('2', 'C7'), ...['1', '1', '1', '1', '1'].map((b) => row(b, 'D7'))])
    expect(t.events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['C7', 0, 4],
      ['F7', 4, 4], // "x": one bar
      ['G7', 8, 4], // next bar is earlier: one bar
      ['C7', 12, 4],
      ['D7', 16, 1],
      ['D7', 17, 1],
      ['D7', 18, 1],
      ['D7', 19, 1],
    ])
    expect(t.diagnostics).toEqual(['bar "x" is not a whole number, so F7 gets one bar', 'more than 4 chords in bar 1: the 5th and later are left out'])
  })
})

describe('guide tone lines', () => {
  it('voice-leads a ii–V–I as in the textbooks', () => {
    expect(struck([row('1', 'Dm7'), row('2', 'G7'), row('3', 'CMaj7')])).toEqual([
      ['f/4', 'f/4', 'e/4'], // 3rd -> 7th (held) -> 3rd
      ['c/5', 'b/4', 'b/4'], // 7th -> 3rd -> 7th (held)
    ])
  })

  it('moves at most a whole step through the ii–Vs of Autumn Leaves', () => {
    const text = 'A | 1 | Cm7\nA | 2 | F7\nA | 3 | BbMaj7\nA | 4 | EbMaj7\nA | 5 | Am7b5\nA | 6 | D7\nA | 7 | Gm\nA | 8 | Gm\n'
    for (const line of struck(rowsOf(text))) expect(line).toHaveLength(8)
    const sheet = buildGuideTones(rowsOf(text), CONCERT)
    for (const i of [0, 1] as const) {
      const pitches = sheet.systems.flatMap((s) => s.bars).flatMap((b) => b.lines[i]).flatMap((n) => (n.pitch ? [n.pitch.midi] : []))
      const leaps = pitches.slice(1).map((m, j) => Math.abs(m - (pitches[j] ?? m)))
      expect(Math.max(...leaps), `line ${i + 1}`).toBeLessThanOrEqual(2)
    }
  })

  it('times a waltz in 3/4: three beats a bar, a dotted half for a whole bar', () => {
    const text = 'A | 1 | Dm7\nA | 2 | G7\nA | 2 | C7\nA | 3 | FMaj7\nA | 5 | Bb\n'
    expect(guideToneTimeline(rowsOf(text), 3).events.map((e) => [e.chord, e.start, e.beats])).toEqual([
      ['Dm7', 0, 3], ['G7', 3, 2], ['C7', 5, 1], ['FMaj7', 6, 6], ['Bb', 12, 12], // Bb holds bars 5–8
    ])
    const sheet = buildGuideTones(rowsOf(text), CONCERT, 4, 3)
    const bar1 = sheet.systems[0]?.bars[0]
    expect([sheet.beats, bar1?.lines[0].map((n) => n.beats)]).toEqual([3, [3]])
  })

  it('times an intro and a coda on their own, each numbered from bar 1', () => {
    const text = 'Intro | 1 | Dm7\nIntro | 3 | G7\nA | 1 | CMaj7\nA | 3 | Am7\nA | 5 | Dm7\nA | 7 | G7\nCoda | 1 | Db7\nCoda | 2 | CMaj7\n'
    expect(guideToneTimeline(rowsOf(text)).events.map((e) => [e.chord, e.start / 4, e.beats / 4])).toEqual([
      ['Dm7', 0, 2], ['G7', 2, 2], // the intro: 4 bars
      ['CMaj7', 4, 2], ['Am7', 6, 2], ['Dm7', 8, 2], ['G7', 10, 2], // the form, from bar 1
      ['Db7', 12, 1], ['CMaj7', 13, 3], // the coda, rounded to 4 bars
    ])
  })

  it('keeps the two lines complementary: where one plays the 3rd, the other plays the 7th', () => {
    const text = readFileSync('../charts/autumn_leaves.txt', 'utf8')
    const bars = buildGuideTones(rowsOf(text), CONCERT).systems.flatMap((s) => s.bars)
    bars.forEach((b, i) =>
      b.lines[0].forEach((n, j) => {
        const other = b.lines[1][j]
        if (n.pitch && other?.pitch) expect(n.label, `bar ${i + 1}`).not.toBe(other.label)
      }),
    )
  })

  // the first charts never needed more than a 4th; the wider library has chords a tritone apart and triads
  // (whose "7th" is the root), where a 5th is the price of staying in the range
  const STEPWISE = ['autumn_leaves', 'blue_bossa', 'stella_by_starlight', 'all_the_things_you_are', 'lady_bird', 'f_blues', 'bb_jazz_blues', 'rhythm_changes']
  it('never leaps more than a 5th in any library chart, nor a 4th in the first ones, in either line', () => {
    for (const f of readdirSync('../charts').filter((name) => !isSyncCopy(name))) {
      const sheet = buildGuideTones(rowsOf(readFileSync(`../charts/${f}`, 'utf8')), CONCERT)
      for (const i of [0, 1] as const) {
        const notes = sheet.systems.flatMap((s) => s.bars).flatMap((b) => b.lines[i])
        const midis = notes.filter((_, j) => !notes[j - 1]?.tie).flatMap((n) => (n.pitch ? [n.pitch.midi] : []))
        const leaps = midis.slice(1).map((m, j) => Math.abs(m - (midis[j] ?? m)))
        expect(Math.max(0, ...leaps), `${f} line ${i + 1}`).toBeLessThanOrEqual(STEPWISE.includes(f.slice(0, -4)) ? 5 : 7)
      }
      expect(sheet.diagnostics, f).toEqual([])
    }
  })

  it('holds long chords with tied whole notes, four bars a system', () => {
    const sheet = buildGuideTones(rowsOf('A | 1 | Dm7\nB | 7 | Ebm7\n'), CONCERT)
    const bars = sheet.systems.flatMap((s) => s.bars)
    expect(sheet.systems.map((s) => s.bars.length)).toEqual([4, 4])
    expect(bars.map((b) => b.lines[0].map((n) => `${n.beats}${n.tie ? '~' : ''}`).join(' '))).toEqual(['4~', '4~', '4~', '4~', '4~', '4', '4~', '4'])
    expect(bars.map((b) => b.chords.map((c) => c.text).join(' '))).toEqual(['Dm7', '', '', '', '', '', 'Ebm7', ''])
    expect(bars[0]?.label).toBe('A · Bar 1')
    expect(bars[6]?.label).toBe('B · Bar 7')
  })

  it('writes shared bars as halves and quarters, with chord symbols on their beats', () => {
    const [bar] = buildGuideTones([row('1', 'Dm7'), row('1', 'G7'), row('1', 'C7')], CONCERT).systems[0]?.bars ?? []
    expect(bar?.lines[0].map((n) => n.beats)).toEqual([2, 1, 1])
    expect(bar?.chords.map((c) => [c.text, c.beat])).toEqual([['Dm7', 0], ['G7', 2], ['C7', 3]])
  })

  it('writes the lines for a transposing instrument and keeps the bass clef in range', () => {
    expect(struck([row('1', 'Cm7'), row('2', 'F7'), row('3', 'BbMaj7')], TENOR)).toEqual([
      ['f/4', 'f/4', 'e/4'], // written D: the same shapes as concert ii-V-I in C
      ['c/5', 'b/4', 'b/4'],
    ])
    for (const line of struck([row('1', 'Dm7'), row('2', 'G7'), row('3', 'CMaj7')], BASS))
      for (const key of line) expect(Number(key.split('/')[1])).toBeGreaterThanOrEqual(2)
  })

  it('ignores a scale it cannot read rather than the chord', () => {
    const [bar] = buildGuideTones([row('1', 'Dm7', 'D Dorain')], CONCERT).systems[0]?.bars ?? []
    expect(bar?.lines[0][0]?.label).toBe('b3')
    expect(bar?.chords[0]?.tokens).not.toBeNull()
  })

  it('rests on chords it cannot read and starts again after them', () => {
    const [one, two] = struck([row('1', 'Dm7'), row('2', 'Cm7#5#9x'), row('3', 'CMaj7')])
    expect(one).toEqual(['f/4', 'rest', 'e/4'])
    expect(two[1]).toBe('rest')
    expect(buildGuideTones([row('1', 'Cm7#5#9x')], CONCERT).diagnostics).toEqual(['no guide tones for Cm7#5#9x (unknown chord quality)'])
  })

  it("gives every bar the chart's key, written for the part", () => {
    const rows = [
      { section: 'A', bar: '1', chord: 'EbMaj7', scale: '' },
      { section: 'B', bar: '2', chord: 'DMaj7', scale: '' }, // an @key D here changes nothing on the staff
      { section: 'B', bar: '3', chord: 'Em7', scale: '' },
    ]
    const sigs = (key?: ReturnType<typeof parseKey>, part: Part = CONCERT) => new Set(buildGuideTones(rows, part, 2, 4, key).systems.flatMap((s) => s.bars.map((b) => b.keySig)))
    expect(sigs(parseKey('Eb'))).toEqual(new Set(['Eb']))
    expect(sigs(parseKey('Eb'), { clef: 'treble', trans: 'Bb' })).toEqual(new Set(['F']))
    expect(sigs(null)).toEqual(new Set([null]))
    expect(sigs()).toEqual(new Set([null]))
  })
})

const BOTH: GuideShow = { third: true, seventh: true }
const THIRD: GuideShow = { third: true, seventh: false }
const SEVENTH: GuideShow = { third: false, seventh: true }
/** chord i on row i, one after another, len beats each */
const inTurn = (chords: readonly string[], len = 4): GuideInput[] => chords.map((chord, i) => ({ row: i, chord, start: i * len, beats: len }))
/** a note as "beat:key/beats", then ~ (tie), ^ (tied in) and its accidental */
const noteText = (n: GuideNote): string =>
  `${n.beat}:${n.pitch ? toVexKey(n.pitch) : 'rest'}/${n.beats}${n.tie ? '~' : ''}${n.tiedIn ? '^' : ''}${n.accidental ?? ''}`
/** each bar in order, its voices top to bottom joined by " | " */
const barsText = (g: ReturnType<typeof guideVoices>): string[] =>
  [...g.bars.entries()].sort(([a], [b]) => a - b).map(([, voices]) => voices.map((v) => v.map(noteText).join(' ')).join(' | '))

describe('voiceLeadOne', () => {
  const line = (role: 0 | 1, chords: readonly string[]) =>
    voiceLeadOne(chords.map((c) => guideTonesFor(CONCERT, c)), role, 'treble').map((c) => c && `${toVexKey(c.pitch)} ${c.label} ${c.role}`)

  it('voices one guide tone alone in its smoothest line, which cannot always move by step', () => {
    expect(line(0, ['Dm7', 'G7', 'CMaj7'])).toEqual(['f/4 b3 0', 'b/4 3 0', 'e/5 3 0']) // F -> B -> E: a 4th each way
    expect(line(1, ['Dm7', 'G7', 'CMaj7'])).toEqual(['c/5 b7 1', 'f/4 b7 1', 'b/4 7 1'])
  })

  it('reports the role asked for and labels each note with its own degree, resting where there is none', () => {
    const chords = ['Bdim7', 'C', 'C6', 'Cm7#5#9x', 'G7sus4']
    expect(line(1, chords)).toEqual(['ab/4 bb7 1', 'c/5 1 1', 'a/4 6 1', null, 'f/4 b7 1'])
    expect(line(0, chords)).toEqual(['d/4 b3 0', 'e/4 3 0', 'e/4 3 0', null, 'c/5 4 0'])
  })
})

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

  it('both on: two voices, upper first, that move by step, their labels swapping 7/3 -> 3/7 -> 7/3', () => {
    const g = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, BOTH)
    expect(barsText(g)).toEqual(['0:c/5/4 | 0:f/4/4', '0:b/4/4 | 0:f/4/4', '0:b/4/4 | 0:e/4/4'])
    expect([...g.labels]).toEqual([[0, ['7', '3']], [1, ['3', '7']], [2, ['7', '3']]])
  })

  it('one on: that degree alone, in the nearest octave, correctly labelled', () => {
    const third = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, THIRD)
    expect(barsText(third)).toEqual(['0:f/4/4', '0:b/4/4', '0:e/5/4'])
    expect([...third.labels]).toEqual([[0, ['3']], [1, ['3']], [2, ['3']]])
    const seventh = guideVoices(inTurn(['Dm7', 'G7', 'CMaj7']), CONCERT, 4, null, SEVENTH)
    expect(barsText(seventh)).toEqual(['0:c/5/4', '0:f/4/4', '0:b/4/4'])
    expect([...seventh.labels]).toEqual([[0, ['7']], [1, ['7']], [2, ['7']]])
  })

  it('labels the real degree: 6 on a 6 chord, 4 on a sus chord, 1 on a triad, 7 on a dim7', () => {
    const g = guideVoices(inTurn(['C6', 'C7sus4', 'C', 'Bdim7']), CONCERT, 4, null, BOTH)
    expect([...g.labels]).toEqual([[0, ['6', '3']], [1, ['7', '4']], [2, ['1', '3']], [3, ['3', '7']]])
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
      { row: 1, chord: 'Eb', start: 2, beats: 2 },
    ]
    expect(barsText(guideVoices(chords, CONCERT, 4, null, BOTH))).toEqual(['0:bb/4/2b 2:g/4/2n | 0:gb/4/2b 2:eb/4/2b'])
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
