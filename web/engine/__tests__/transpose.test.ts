import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseChart, serializeChart } from '../chart'
import { enharmonics, parseRoot, type Spelled } from '../pitch'
import { parseScale, samePitches, type ScaleKey, spellFrom, SCALES } from '../scales'
import { isSyncCopy } from '../util'
import { chartKey, keySide, shiftNote, keyShift, spellInKey, TRANSPOSE_KEYS, transposeChart } from '../transpose'

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

  it('spells roots on the target key\'s side, as jazz charts do', () => {
    // Bird blues bar 8 in Bb: Dbm7 Gb7, though Db Dorian has Fb and Cb
    expect(rowsOf('A | 8 | Abm7 | Ab Dorian\nA | 8 | Db7', 'F', 'Bb')).toEqual(['Dbm7 | Db Dorian', 'Gb7'])
    expect(rowsOf('A | 1 | C | C Ionian\nA | 1 | C7 | C Mixolydian', 'C', 'Gb')).toEqual(['Gb | Gb Ionian', 'Gb7 | Gb Mixolydian'])
    expect(rowsOf('A | 1 | C7 | C Mixolydian', 'C', 'F#')).toEqual(['F#7 | F# Mixolydian'])
  })

  it('knows each key\'s side, and falls back to the plain rule in C or to avoid double accidentals', () => {
    expect(['C', 'F', 'Bb', 'Gb', 'G', 'B', 'F#'].map(keySide)).toEqual([0, -1, -1, -1, 1, 1, 1])
    expect(spellInKey(parseRoot('F#'), 'mixolydian', -1)).toEqual(parseRoot('Gb'))
    expect(spellInKey(parseRoot('Gb'), 'mixolydian', 1)).toEqual(parseRoot('F#'))
    expect(spellInKey(parseRoot('Cb'), 'ionian', -1)).toEqual(parseRoot('B')) // a natural beats a flat
    expect(spellInKey(parseRoot('A#'), 'mixolydian', 1)).toEqual(parseRoot('Bb')) // A# Mixolydian needs C## and F##
    expect(spellInKey(parseRoot('Gb'), 'mixolydian', 0)).toEqual(parseRoot('F#')) // C: simplifyRoot decides
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

  it("moves @key lines and a function's key, on the target key's side; the function itself is relative and stays", () => {
    const doc = parseChart('A | 1 | D7 |  | V7/V\nA | 2 | Bb7 |  | Db: V7/ii\n@key A 2 Am\n').value
    const out = serializeChart(transposeChart(doc, 'C', 'Eb').doc)
    expect(out).toBe('A | 1 | F7  |  | V7/V\nA | 2 | Db7 |  | E: V7/ii\n@key A 2 Cm\n')
  })

  it("leaves a function's key alone when its note letter is lower case, so it stays invalid", () => {
    const doc = parseChart('A | 1 | Bb7 |  | bb: V7\nA | 2 | Bb7 |  | eb: V7\n').value
    expect(serializeChart(transposeChart(doc, 'C', 'D').doc)).toBe('A | 1 | C7 |  | bb: V7\nA | 2 | C7 |  | eb: V7\n')
  })

  it('keeps navigation directives verbatim when transposing', () => {
    const text = 'key: C\nA | 1 | Dm7 | D Dorian\n@ending 1 A 1\n@segno A 1\n@coda A 1\n@nav A 1 D.S. al Coda\n'
    const out = serializeChart(transposeChart(parseChart(text).value, 'C', 'Eb').doc)
    for (const d of ['@ending 1 A 1', '@segno A 1', '@coda A 1', '@nav A 1 D.S. al Coda']) expect(out).toContain(d)
  })

  it('letters a diatonic diminished scale as the analysis does (R9): no B♯ E♯ C♭ F♭ or double accidental where a clean lettering exists', () => {
    expect(rowsOf('A1 | 2 | Bbdim7 | Bb Diatonic Diminished bVI', 'D', 'Db')).toEqual(['Adim7 | A Diatonic Diminished']) // Wave, not A A♯ B♯ …
    expect(rowsOf('D | 28 | Ebdim7 | Eb Diatonic Diminished bIII', 'C', 'Ab')).toEqual(['Bdim7 | B Diatonic Diminished']) // Dearly Beloved, not C♭ C E𝄫 …
    expect(rowsOf('D | 28 | Bbdim7 | Bb Diatonic Diminished bIII', 'G', 'Eb')).toEqual(['F#dim7 | F# Diatonic Diminished']) // Here's That Rainy Day
    expect(rowsOf('B | 24 | Abdim7 | Ab Diatonic Diminished bVI', 'C', 'Db')).toEqual(['Adim7 | A Diatonic Diminished']) // The Night We First Met
    expect(rowsOf('A | 1 | Bbdim7 | Bb Diatonic Diminished bVI', 'D', 'C')).toEqual(['Abdim7 | Ab Diatonic Diminished bVI']) // a clean root of its own stays
  })

  it('transposes no library diatonic diminished row into an unclean lettering where a clean one exists, in any key', () => {
    const ugly = (n: { letter: number; acc: number }) => Math.abs(n.acc) > 1 || (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3))
    const clean = (root: Spelled, key: ScaleKey) => !spellFrom(root, SCALES[key][0]).some(ugly)
    const files = readdirSync('../charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    const bad: string[] = []
    for (const f of files) {
      const text = readFileSync(`../charts/${f}`, 'utf8')
      if (!/Diatonic Diminished/.test(text)) continue
      const from = /^key:\s*([A-G][b#]?)/m.exec(text)?.[1]
      if (!from) continue
      for (const to of TRANSPOSE_KEYS) {
        for (const l of transposeChart(parseChart(text).value, from, to).doc.lines) {
          if (l.kind !== 'row' || !l.scale || !/Diatonic Diminished/.test(l.scale)) continue
          const s = parseScale(l.scale)
          const anyClean = enharmonics(s.root).some((r) => clean(r, s.key) || (samePitches(s.key, 'diatonic diminished') && clean(r, 'diatonic diminished')))
          if (!clean(s.root, s.key) && anyClean) bad.push(`${f} → ${to}: ${l.chord} | ${l.scale}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
