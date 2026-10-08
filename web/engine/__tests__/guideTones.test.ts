import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Row } from '../chart'
import { expandRows, parseChart } from '../chart'
import { buildGuideTones, guideTonesFor, type GuideNote } from '../guideTones'
import { guideToneTimeline } from '../guideToneTimeline'
import { CONCERT, type Part } from '../part'
import { rootName } from '../pitch'
import { toVexKey } from '../sheet'
import { isSyncCopy } from '../util'

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
    return notes.filter((_, j) => !notes[j - 1]?.tie).map((n: GuideNote) => (n.pitch ? toVexKey(n.pitch) : 'rest'))
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
})
