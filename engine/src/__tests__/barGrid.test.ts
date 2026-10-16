import { describe, expect, it } from 'vitest'
import { barView } from '../bars'
import { chordsAfterTyping, moveInGrid, posOfLine, soundingChords } from '../barGrid'
import { type ChartDoc, parseChart } from '../chart'

const text = (lines: readonly string[]): ChartDoc => parseChart(lines.join('\n')).value
// A: 8 bars (bar 3 two chords, bar 4 held), then B repeats A, then C: 4 bars
const doc = text(['title: T', 'section: A', 'bars: 8', '1 | Cm7', '2 | F7', '3 | Bbmaj7', '3 | Eb7', '5 | Am7', '6 | D7', 'section: B', 'copy: A', 'section: C', 'bars: 4', '1 | Gm7', '2 | G7'])
const view = barView(doc)
const pos = (section: string, bar: number, chord = 0) => ({ section, bar, chord })

describe('moveInGrid', () => {
  it('next goes chord by chord, then to the next bar, across sections; off the end is null', () => {
    expect(moveInGrid(view, pos('A', 2), 'next')).toEqual(pos('A', 3, 0))
    expect(moveInGrid(view, pos('A', 3, 0), 'next')).toEqual(pos('A', 3, 1))
    expect(moveInGrid(view, pos('A', 3, 1), 'next')).toEqual(pos('A', 4, 0))
    expect(moveInGrid(view, pos('A', 8), 'next')).toEqual(pos('C', 1, 0))
    expect(moveInGrid(view, pos('C', 4), 'next')).toBeNull()
  })

  it('prev goes back to the last chord of the bar before; off the start is null', () => {
    expect(moveInGrid(view, pos('A', 4), 'prev')).toEqual(pos('A', 3, 1))
    expect(moveInGrid(view, pos('A', 3, 1), 'prev')).toEqual(pos('A', 3, 0))
    expect(moveInGrid(view, pos('C', 1), 'prev')).toEqual(pos('A', 8, 0))
    expect(moveInGrid(view, pos('A', 1), 'prev')).toBeNull()
  })

  it('starts over from the first written chord for a position that isn’t on the chart (a repeat has none)', () => {
    expect(moveInGrid(view, pos('B', 7), 'next')).toEqual(pos('A', 1))
    expect(moveInGrid(view, pos('X', 1), 'prev')).toEqual(pos('A', 1))
    expect(moveInGrid(barView(text(['title: T'])), pos('A', 1), 'next')).toBeNull()
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

describe('posOfLine', () => {
  it('finds the chord written on a line of the chart', () => {
    expect(posOfLine(view, 3)).toEqual(pos('A', 1, 0))
    expect(posOfLine(view, 6)).toEqual(pos('A', 3, 1))
    expect(posOfLine(view, 13)).toEqual(pos('C', 1, 0))
  })

  it('is null for a line that isn’t a written chord', () => {
    expect(posOfLine(view, 0)).toBeNull() // the title
    expect(posOfLine(view, 10)).toBeNull() // the copy:
    expect(posOfLine(view, 99)).toBeNull()
  })
})
