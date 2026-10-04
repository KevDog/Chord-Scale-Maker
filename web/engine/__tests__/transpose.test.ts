import { describe, expect, it } from 'vitest'
import { parseChart, serializeChart } from '../chart'
import { parseRoot } from '../pitch'
import { chartKey, shiftNote, keyShift, TRANSPOSE_KEYS, transposeChart } from '../transpose'

const rowsOf = (text: string, from: string, to: string): string[] =>
  transposeChart(parseChart(text).value, from, to)
    .doc.lines.filter((l) => l.kind === 'row')
    .map((l) => [l.chord, l.scale].filter(Boolean).join(' | '))

describe('transpose', () => {
  it('measures the key interval in letters and semitones', () => {
    expect(keyShift(parseRoot('F'), parseRoot('Bb'))).toEqual({ steps: 3, semis: 5 })
    expect(keyShift(parseRoot('Bb'), parseRoot('F'))).toEqual({ steps: 4, semis: 7 })
    expect(shiftNote(parseRoot('B'), { steps: 3, semis: 5 })).toEqual(parseRoot('E'))
    expect(shiftNote(parseRoot('Eb'), { steps: 3, semis: 5 })).toEqual(parseRoot('Ab'))
  })

  it('moves chords and explicit scale roots, keeping qualities and scale names as typed', () => {
    expect(rowsOf('A | 1 | F7 | F Mixolydian\nA | 6 | Bdim7\nA | 8 | Am7b5 | A Locrian ♮2\nA | 9 | D7b9 | d hw', 'F', 'Bb')).toEqual([
      'Bb7 | Bb Mixolydian',
      'Edim7',
      'Dm7b5 | D Locrian ♮2',
      'G7b9 | G hw',
    ])
  })

  it('spells roots by the design rule: no Cb/Fb/E#/B# or double accidentals in the scale', () => {
    // Db Dorian would need Fb and Cb, so the chord follows C# Dorian
    expect(rowsOf('A | 8 | Abm7 | Ab Dorian\nA | 8 | Db7', 'F', 'Bb')).toEqual(['C#m7 | C# Dorian', 'F#7'])
    // the key's spelling wins ties (Gb Ionian, like F# Ionian, has one of them) but not clear cases
    expect(rowsOf('A | 1 | C | C Ionian\nA | 1 | C7 | C Mixolydian', 'C', 'Gb')).toEqual(['Gb | Gb Ionian', 'F#7 | F# Mixolydian'])
  })

  it('keeps a slash bass at its interval from the root', () => {
    expect(rowsOf('A | 1 | D7/F# | D Half-Whole', 'G', 'C')).toEqual(['G7/B | G Half-Whole'])
    expect(rowsOf('A | 1 | C/E', 'C', 'Eb')).toEqual(['Eb/G'])
  })

  it('leaves everything but rows alone and reports rows it cannot read', () => {
    const text = 'title: F Blues\n# comment\nA | 1 | F7\n@copy A B 12\nA | 2 | ???\nA | 3 | C7 | C Nonsense\n'
    const { doc, skipped } = transposeChart(parseChart(text).value, 'F', 'Bb')
    expect(skipped).toBe(2)
    const expected = 'title: F Blues\n# comment\nA | 1 | Bb7\n@copy A B 12\nA | 2 | ???\nA | 3 | C7 | C Nonsense\n'
    expect(serializeChart(doc)).toBe(serializeChart(parseChart(expected).value))
  })

  it('round-trips F -> Bb -> F', () => {
    const text = 'A | 1 | FMaj7 | F Ionian\nA | 2 | Em7b5\nA | 2 | A7b9 | A Phrygian Dominant\nA | 6 | Bbm7\nA | 6 | Eb7\n'
    const there = transposeChart(parseChart(text).value, 'F', 'Bb').doc
    expect(serializeChart(transposeChart(there, 'Bb', 'F').doc)).toBe(serializeChart(parseChart(text).value))
  })

  it("guesses the chart's key from its first chord, and lists keys to choose", () => {
    expect(chartKey(parseChart('# x\nA | 1 | Bb7\nA | 2 | Eb7').value)).toBe('Bb')
    expect(chartKey(parseChart('A | 1 | ???').value)).toBeNull()
    expect(TRANSPOSE_KEYS).toContain('F#')
    expect(TRANSPOSE_KEYS).toHaveLength(13)
  })
})
