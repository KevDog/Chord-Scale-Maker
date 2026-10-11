import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { barView } from '../bars'
import { chordsAfterTyping, firstPos, gridLines, moveInGrid, placePos, soundingChords } from '../barGrid'
import { type ChartDoc, parseChart } from '../chart'

const chart = (name: string): ChartDoc => parseChart(readFileSync(`charts/${name}.txt`, 'utf8')).value
const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
// A: 6 bars (bar 3 two chords, bar 4 held), then B repeats A, then C: 2 bars
const doc = text(['title: T', 'A | 1 | Cm7', 'A | 2 | F7', 'A | 3 | Bbmaj7', 'A | 3 | Eb7', 'A | 5 | Am7', 'A | 6 | D7', '@copy A B 8', 'C | 17 | Gm7', 'C | 18 | G7'])
const view = barView(doc)
const pos = (section: string, bar: number, chord = 0) => ({ section, bar, chord })

describe('gridLines', () => {
  it('gives each written section its own lines of four bars; a repeat has none', () => {
    expect(gridLines(view).map((l) => [l.section, l.bars.map((b) => b.bar)])).toEqual([
      ['A', [1, 2, 3, 4]],
      ['A', [5, 6, 7, 8]],
      ['C', [17, 18, 19, 20]],
    ])
  })

  it('reads Autumn Leaves as eight lines: A1 two, B four', () => {
    expect(gridLines(barView(chart('autumn_leaves'))).map((l) => l.section)).toEqual(['A1', 'A1', 'B', 'B', 'B', 'B'])
  })
})

describe('moveInGrid', () => {
  it('next goes chord by chord, then to the next bar, across lines and sections; off the end is null', () => {
    expect(moveInGrid(view, pos('A', 2), 'next')).toEqual(pos('A', 3, 0))
    expect(moveInGrid(view, pos('A', 3, 0), 'next')).toEqual(pos('A', 3, 1))
    expect(moveInGrid(view, pos('A', 3, 1), 'next')).toEqual(pos('A', 4, 0))
    expect(moveInGrid(view, pos('A', 8), 'next')).toEqual(pos('C', 17, 0))
    expect(moveInGrid(view, pos('C', 20), 'next')).toBeNull()
  })

  it('prev goes back to the last chord of the bar before; off the start is null', () => {
    expect(moveInGrid(view, pos('A', 4), 'prev')).toEqual(pos('A', 3, 1))
    expect(moveInGrid(view, pos('A', 3, 1), 'prev')).toEqual(pos('A', 3, 0))
    expect(moveInGrid(view, pos('C', 17), 'prev')).toEqual(pos('A', 8, 0))
    expect(moveInGrid(view, pos('A', 1), 'prev')).toBeNull()
  })

  it('up and down keep the column, and stay put at the top and bottom', () => {
    expect(moveInGrid(view, pos('A', 3, 1), 'down')).toEqual(pos('A', 7, 0))
    expect(moveInGrid(view, pos('A', 6), 'down')).toEqual(pos('C', 18, 0))
    expect(moveInGrid(view, pos('C', 19), 'up')).toEqual(pos('A', 7, 0))
    expect(moveInGrid(view, pos('A', 2), 'up')).toEqual(pos('A', 2))
    expect(moveInGrid(view, pos('C', 17), 'down')).toEqual(pos('C', 17))
  })

  it('clamps to a shorter line', () => {
    const short = barView(text(['A | 1 | C', 'A | 5 | F', 'B | 9 | G', 'B | 10 | C', 'B | 11 | D', 'B | 12 | E', 'B | 13 | F']))
    expect(gridLines(short).map((l) => l.bars.length)).toEqual([4, 4, 4, 4])
    expect(moveInGrid(short, pos('B', 12), 'down')).toEqual(pos('B', 16, 0))
  })
})

describe('firstPos and placePos', () => {
  it('starts on the first chord of the first written bar', () => {
    expect(firstPos(view)).toEqual(pos('A', 1))
    expect(firstPos(barView(text(['title: T'])))).toBeNull()
  })

  it('keeps a position that still exists, and pulls one that doesn’t back onto the grid', () => {
    expect(placePos(view, pos('A', 3, 1))).toEqual(pos('A', 3, 1))
    expect(placePos(view, pos('A', 3, 5))).toEqual(pos('A', 3, 1)) // fewer chords now
    expect(placePos(view, pos('A', 4, 1))).toEqual(pos('A', 4, 0)) // held
    expect(placePos(view, pos('A', 30))).toEqual(pos('A', 8, 0)) // the section's last bar
    expect(placePos(view, pos('B', 7))).toEqual(pos('A', 1)) // a repeat isn't on the grid
  })
})

describe('soundingChords', () => {
  it('is what plays in a bar: its chords, or the chord held into it', () => {
    expect(soundingChords(view, 'A', 3)).toEqual(['Bbmaj7', 'Eb7'])
    expect(soundingChords(view, 'A', 4)).toEqual(['Eb7'])
    expect(soundingChords(view, 'X', 1)).toEqual([])
  })
})

describe('chordsAfterTyping', () => {
  it('replaces the chord at the position, or adds one there', () => {
    expect(chordsAfterTyping(view, pos('A', 3, 1), 'E7', false)).toEqual(['Bbmaj7', 'E7'])
    expect(chordsAfterTyping(view, pos('A', 3, 1), 'E7', true)).toEqual(['Bbmaj7', 'E7', 'Eb7'])
    expect(chordsAfterTyping(view, pos('A', 3, 2), 'E7', true)).toEqual(['Bbmaj7', 'Eb7', 'E7'])
    expect(chordsAfterTyping(view, pos('A', 4), 'Ab7', false)).toEqual(['Ab7']) // a held bar gets its own chord
  })

  it('takes the chord out when the text is cleared', () => {
    expect(chordsAfterTyping(view, pos('A', 3, 0), '  ', false)).toEqual(['Eb7'])
    expect(chordsAfterTyping(view, pos('A', 3, 0), '', true)).toEqual(['Bbmaj7', 'Eb7'])
  })

  it('reads % as the bar before, as it plays', () => {
    expect(chordsAfterTyping(view, pos('A', 5), '%', false)).toEqual(['Eb7']) // the bar before is held
    expect(chordsAfterTyping(view, pos('A', 4), '%', false)).toEqual(['Bbmaj7', 'Eb7'])
    expect(chordsAfterTyping(view, pos('A', 1), '%', false)).toEqual([]) // nothing before
  })
})
