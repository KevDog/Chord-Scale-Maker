import { describe, expect, it } from 'vitest'
import { parseBarLine } from '../barLine'

const bars = (text: string, beats?: 2 | 3 | 4) => parseBarLine(text, beats).value

describe('parseBarLine', () => {
  it('reads each bar between pipes as its chords', () => {
    expect(parseBarLine('| Cm7 | F7 | Bm7 E7 |')).toEqual({ value: [['Cm7'], ['F7'], ['Bm7', 'E7']], diagnostics: [] })
  })

  it('needs no outer pipes, and takes a line without any as one bar', () => {
    expect(bars('Cm7 | F7')).toEqual([['Cm7'], ['F7']])
    expect(bars('Bbmaj7')).toEqual([['Bbmaj7']])
  })

  it('ignores extra spaces and blank lines, and runs several lines on', () => {
    expect(bars('  |  Cm7   |F7|  \n\n| Bbmaj7 |\n')).toEqual([['Cm7'], ['F7'], ['Bbmaj7']])
  })

  it('takes an empty bar as held: the chord before goes on', () => {
    expect(bars('| C | | F |')).toEqual([['C'], [], ['F']])
  })

  it('reads % as the bar before again: held after one chord, the same chords after two', () => {
    expect(bars('| C | % | Dm7 G7 | % |')).toEqual([['C'], [], ['Dm7', 'G7'], ['Dm7', 'G7']])
    expect(bars('| C | | % |')).toEqual([['C'], [], []])
    expect(bars('% | C')).toEqual([[], ['C']])
  })

  it('reads double bars, repeat signs and brackets as bar lines, never as an empty bar', () => {
    expect(bars('|: Cm7 | F7 :|| Bbmaj7 || Eb ]  [ Am7b5 | D7 :| { G } ')).toEqual([
      ['Cm7'],
      ['F7'],
      ['Bbmaj7'],
      ['Eb'],
      ['Am7b5'],
      ['D7'],
      ['G'],
    ])
  })

  it('drops section labels (*A) and beat slashes (a bar of slashes is held), but keeps slash chords', () => {
    expect(bars('*A | C / / / | Dm7 / G7/B / |\n*B | F |')).toEqual([['C'], ['Dm7', 'G7/B'], ['F']])
    expect(bars('| C | *B | F | / / / / |')).toEqual([['C'], ['F'], []])
  })

  it('reads nothing from an empty paste', () => {
    expect(parseBarLine('  \n | ')).toEqual({ value: [], diagnostics: [] })
  })

  it('flags a bar with more chords than the beats it has, by the line it is on', () => {
    expect(parseBarLine('| C |\n| C D E F G |')).toEqual({
      value: [['C'], ['C', 'D', 'E', 'F', 'G']],
      diagnostics: [{ line: 2, message: 'more than 4 chords in bar 2' }],
    })
    expect(parseBarLine('| C D E |', 2).diagnostics).toEqual([{ line: 1, message: 'more than 2 chords in bar 1' }])
  })

  it("flags a chord that wouldn't read back as a chart cell, keeping it to show where", () => {
    const long = 'C'.repeat(41)
    expect(parseBarLine(`| @key | ${long} |`)).toEqual({
      value: [['@key'], [long]],
      diagnostics: [
        { line: 1, message: '"@key": may not start with #, @, title: or subtitle:' },
        { line: 1, message: `"${long}": longer than 40 characters` },
      ],
    })
  })
})
