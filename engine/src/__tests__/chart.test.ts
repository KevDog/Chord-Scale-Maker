import { describe, expect, it } from 'vitest'
import { beatsPerBar, chartAka, chartBeats, chartKind, chartDetails, chartHeading, chartMeta, expandRowLines, expandRows, isFatal, isValidKey, keyLabel, parseChart, parseContext, qualityScale, serializeChart } from '../chart'
import { LIMITS } from '../limits'

describe('isValidKey', () => {
  it('accepts a real major or minor key, rejects junk', () => {
    for (const k of ['C', 'Eb', 'F#', 'Bb', 'Am', 'F#m', 'Dm']) expect(isValidKey(k)).toBe(true)
    for (const k of ['', 'H', 'Cmaj', 'x', 'C7', '  ']) expect(isValidKey(k)).toBe(false)
  })
})

const SAMPLE = `title: T
subtitle: S

# section | bar | chord | scale
A | 1 | Cm7 | C Dorian
A | 2 | F7
@copy A B 8
`

describe('chart', () => {
  it('parses meta, rows, copies, comments and blanks', () => {
    const { value: doc, diagnostics } = parseChart(SAMPLE)
    expect(diagnostics).toEqual([])
    expect(doc.lines.map((l) => l.kind)).toEqual(['meta', 'meta', 'blank', 'comment', 'row', 'row', 'copy'])
    expect(chartMeta(doc)).toEqual({ title: 'T', subtitle: 'S', key: '' })
    expect(doc.lines[5]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: 'F7', scale: '' })
  })

  it('reads the details the editor shows under the heading, as written', () => {
    expect(chartDetails(parseChart('time: 3/4\ncomposer: X\nstyle: Waltz\nform: AABA\ncomposer: Y').value)).toEqual({ time: '3/4', composer: 'Y', style: 'Waltz', form: 'AABA' })
    expect(chartDetails(parseChart('A | 1 | C').value)).toEqual({ time: '', composer: '', style: '', form: '' })
  })

  it('defaults the title', () => {
    expect(chartMeta(parseChart('A | 1 | C').value).title).toBe('Untitled')
  })

  it('builds the heading from the tune metadata', () => {
    const heading = (text: string) => chartHeading(parseChart(text).value)
    const tune = 'title: T\ncomposer: C. Porter\nstyle: Latin\nkey: Bbm\nform: AABA, 32 bars\n'
    expect(heading(tune)).toEqual({ title: 'T', subtitle: 'Latin · B♭ minor · AABA, 32 bars', composer: 'C. Porter' })
    expect(heading(`${tune}subtitle: Bossa nova\n`).subtitle).toBe('Bossa nova · B♭ minor · AABA, 32 bars') // the subtitle says more than the style
    expect(heading('subtitle: S\n')).toEqual({ title: 'Untitled', subtitle: 'S', composer: '' })
    expect(heading('title: T\nkey: G modal\n').subtitle).toBe('G modal')
    expect(['C', 'F#', 'Ebm', 'f', 'Dorian'].map(keyLabel)).toEqual(['C', 'F♯', 'E♭ minor', 'f', 'Dorian'])
  })

  it('expands @copy with bar offsets', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map((r) => `${r.section}${r.bar} ${r.chord}`)).toEqual(['A1 Cm7', 'A2 F7', 'B9 Cm7', 'B10 F7'])
  })

  it('resolves missing scales from the chord quality', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map(qualityScale)).toEqual(['C Dorian', 'F Mixolydian', 'C Dorian', 'F Mixolydian'])
    expect(qualityScale({ section: 'A', bar: '1', chord: 'Cm7#5#9x', scale: '' })).toBeNull()
    expect(qualityScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })

  it('reports bad lines without throwing and keeps them verbatim', () => {
    const { value: doc, diagnostics } = parseChart('A | 1\n@copy A\nA | 2 | C')
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
    expect(serializeChart(doc)).toBe('A | 1\n@copy A\nA | 2 | C\n')
  })

  it('gives each aka: name, split at semicolons (titles may hold commas)', () => {
    const aka = (text: string) => chartAka(parseChart(text).value)
    expect(aka('aka: Blue Train; Blue Trane (alt take)')).toEqual(['Blue Train', 'Blue Trane (alt take)'])
    expect(aka('aka: Me, Myself and I')).toEqual(['Me, Myself and I'])
    expect(aka('aka: ;  \nA | 1 | C')).toEqual([])
    expect(aka('A | 1 | C')).toEqual([])
  })

  it('keeps an aka: line as written, round-trip', () => {
    const text = 'title: Blue Trane\naka: Blue Train; Blue Trane (alt take)\nA | 1 | C\n'
    const doc = parseChart(text).value
    expect(doc.lines[1]).toEqual({ kind: 'meta', key: 'aka', value: 'Blue Train; Blue Trane (alt take)' })
    expect(serializeChart(doc)).toBe(text)
  })

  it('serializes canonically and round-trips', () => {
    const doc = parseChart(SAMPLE).value
    const text = serializeChart(doc)
    expect(text).toContain('A | 1 | Cm7 | C Dorian\nA | 2 | F7\n')
    expect(parseChart(text).value).toEqual(doc)
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('marks hard-limit diagnostics as fatal, line errors as not', () => {
    expect(isFatal(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics)).toBe(true)
    const many = Array.from({ length: LIMITS.maxRows + 1 }, () => '|1|C').join('\n')
    expect(isFatal(parseChart(many).diagnostics)).toBe(true)
    const bomb = 'A | 1 | C\n' + '@copy A A 1\n'.repeat(20)
    expect(isFatal(expandRows(parseChart(bomb).value).diagnostics)).toBe(true)
    expect(isFatal(parseChart('A | 1\nA | 2 | C').diagnostics)).toBe(false)
    expect(parseChart('A | 1234567 | C\n@copy A B 1').value.lines.length).toBe(2)
    expect(expandRows(parseChart('A | 1234567 | C\n@copy A B 1').value).diagnostics[0]?.message).toMatch(/whole-number/)
  })

  it('enforces input limits', () => {
    expect(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics[0]?.message).toMatch(/longer than/)
    expect(parseChart(`A | 1 | ${'C'.repeat(LIMITS.maxCell + 1)}`).diagnostics[0]?.message).toMatch(/cell longer/)
    const many = Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `A | ${i} | C`).join('\n')
    expect(parseChart(many).diagnostics.at(-1)?.message).toMatch(/more than 500 rows/)
  })

  it('caps expanded rows even without @copy', () => {
    const many = Array.from({ length: LIMITS.maxExpandedRows + 5 }, () => '|1|C').join('\n')
    const { value: rows, diagnostics } = expandRows(parseChart(many).value)
    expect(rows).toHaveLength(LIMITS.maxExpandedRows)
    expect(diagnostics.map((d) => d.line)).toEqual([LIMITS.maxExpandedRows + 1])
  })

  it('caps @copy section names and offsets', () => {
    const { diagnostics } = parseChart(`@copy A ${'B'.repeat(LIMITS.maxCell + 1)} 8\n@copy A B 12345\n@copy A B -8`)
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
  })

  it('caps @copy expansion before it can grow exponentially', () => {
    const bomb = 'A | 1 | C\n' + '@copy A A 1\n'.repeat(1_000)
    const { value: rows, diagnostics } = expandRows(parseChart(bomb).value)
    expect(rows.length).toBeLessThanOrEqual(LIMITS.maxExpandedRows)
    expect(diagnostics).toHaveLength(1)
  })

  it('keeps a trailing comment on a row, apart from sharps', () => {
    const text = 'A | 1 | F#m7 | F# Dorian  # ii of the ii–V to E\nA | 2 | B7 #\nA | 3 | C#7\n'
    const { value: doc, diagnostics } = parseChart(text)
    expect(diagnostics).toEqual([])
    expect(doc.lines).toEqual([
      { kind: 'row', section: 'A', bar: '1', chord: 'F#m7', scale: 'F# Dorian', comment: 'ii of the ii–V to E' },
      { kind: 'row', section: 'A', bar: '2', chord: 'B7', scale: '', comment: '' },
      { kind: 'row', section: 'A', bar: '3', chord: 'C#7', scale: '' },
    ])
    const out = serializeChart(doc)
    expect(out).toBe('A | 1 | F#m7 | F# Dorian  # ii of the ii–V to E\nA | 2 | B7    #\nA | 3 | C#7\n')
    expect(serializeChart(parseChart(out).value)).toBe(out) // round-trips
    expect(parseChart(`A | 1 | C # ${'x'.repeat(LIMITS.maxMeta + 1)}`).diagnostics).toHaveLength(1)
  })

  it('expands rows with the line each came from', () => {
    const rows = expandRowLines(parseChart(SAMPLE).value).value
    expect(rows.map((r) => `${r.section}${r.bar}@${r.line}`)).toEqual(['A1@4', 'A2@5', 'B9@4', 'B10@5'])
  })

  it('reads a time: line, and flags one it can’t use', () => {
    expect(['3/4', '2/4', '4/4', '', '6/8', 'waltz'].map(beatsPerBar)).toEqual([3, 2, 4, 4, null, null])
    expect(chartBeats(parseChart('time: 3/4\nA | 1 | C').value)).toBe(3)
    expect(parseChart('time: 6/8\nA | 1 | C').diagnostics.map((d) => d.message)).toEqual(['time: 2/4, 3/4 or 4/4'])
  })

  it('reads a kind: line (a tune without one), and flags one it can’t use', () => {
    expect(chartKind(parseChart('A | 1 | C').value)).toBe('tune')
    expect(chartKind(parseChart('kind: Form\nA | 1 | C').value)).toBe('form')
    expect(chartKind(parseChart('kind: exercise\nA | 1 | C').value)).toBe('exercise')
    expect(parseChart('kind: etude\nA | 1 | C').diagnostics.map((d) => d.message)).toEqual(['kind: tune, form or exercise'])
  })
})

describe('navigation directives', () => {
  const round = (text: string): string => serializeChart(parseChart(text).value)

  it('parses @ending with an explicit and a defaulted last bar', () => {
    const lines = parseChart('@ending 1 Intro 7 8\n@ending 2 Intro 9\n').value.lines
    expect(lines[0]).toEqual({ kind: 'ending', n: 1, section: 'Intro', from: 7, to: 8 })
    expect(lines[1]).toEqual({ kind: 'ending', n: 2, section: 'Intro', from: 9, to: 9 })
  })

  it('parses @segno, @coda and @nav', () => {
    const lines = parseChart('@segno A 1\n@coda Coda 1\n@nav D 8 D.S. al Coda\n').value.lines
    expect(lines[0]).toEqual({ kind: 'mark', mark: 'segno', section: 'A', bar: 1 })
    expect(lines[1]).toEqual({ kind: 'mark', mark: 'coda', section: 'Coda', bar: 1 })
    expect(lines[2]).toEqual({ kind: 'nav', section: 'D', bar: 8, text: 'D.S. al Coda' })
  })

  it('round-trips every directive (one-bar ending drops its LAST)', () => {
    const text = '@ending 1 Intro 7 8\n@ending 2 Intro 9\n@segno A 1\n@coda Coda 1\n@nav D 8 D.S. al Coda\n'
    expect(round(text)).toBe(text)
  })

  it('rejects malformed directives as invalid lines, kept verbatim', () => {
    for (const bad of ['@ending 3 A 1 2', '@ending 1 A x', '@segno A', '@coda A 1 extra', '@nav A 8']) {
      const { value, diagnostics } = parseChart(bad + '\n')
      expect(value.lines[0]).toEqual({ kind: 'invalid', text: bad })
      expect(diagnostics.length).toBe(1)
      expect(serializeChart(value)).toBe(bad + '\n')
    }
  })
})

describe('the function cell and @key lines', () => {
  it('reads an optional fifth cell as the function, with or without a scale', () => {
    const { value, diagnostics } = parseChart('A | 1 | F7 | F Mixolydian | V7/V\nA | 2 | Bb7 |  | D: V7/ii\nA | 3 | F7\nA | 4 | F7 | |\n')
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'row', section: 'A', bar: '1', chord: 'F7', scale: 'F Mixolydian', function: 'V7/V' },
      { kind: 'row', section: 'A', bar: '2', chord: 'Bb7', scale: '', function: 'D: V7/ii' },
      { kind: 'row', section: 'A', bar: '3', chord: 'F7', scale: '' },
      { kind: 'row', section: 'A', bar: '4', chord: 'F7', scale: '' }, // an empty fifth cell is no function
    ])
  })

  it('rejects a sixth cell', () => {
    expect(parseChart('A | 1 | Cm7 | C Dorian | ii7 | extra\n').diagnostics[0]?.message).toBe('expected  section | bar | chord [| scale [| function]]')
  })

  it('writes functions back aligned, with comments after them', () => {
    const text =
      'A | 1 | F7     | F Mixolydian | V7/V  # x\n' +
      `A | 2 | Bb7    | ${' '.repeat(12)} | V7    # y\n` +
      'A | 3 | EbMaj7 | Eb Ionian\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('reads @key SECTION BAR KEY and writes it back', () => {
    const { value, diagnostics } = parseChart('@key B 17 D\n@key A3 25 Bb minor\n')
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'key', section: 'B', bar: 17, key: 'D' },
      { kind: 'key', section: 'A3', bar: 25, key: 'Bb minor' },
    ])
    expect(serializeChart(value)).toBe('@key B 17 D\n@key A3 25 Bb minor\n')
  })

  it('rejects a malformed @key', () => {
    for (const bad of ['@key B 17', '@key B x D', '@key B 17 H', '@key B 17 Dorian', '@key B 17 d'])
      expect(parseChart(bad).diagnostics[0]?.message, bad).toBe('use  @key SECTION BAR KEY  (a key like Eb or Cm)')
  })

  it("copies a row's function to its @copy repeats", () => {
    const rows = expandRowLines(parseChart('A | 1 | D7 |  | V7/V\n@copy A B 8\n').value).value
    expect(rows.map((r) => `${r.section} ${r.bar} ${r.function}`)).toEqual(['A 1 V7/V', 'B 9 V7/V'])
  })
})

describe('context: and @context (docs/superpowers/specs/2026-10-10-chart-context-design.md §1)', () => {
  it('reads context: and writes it back', () => {
    for (const v of ['functional', 'modal', 'blues']) {
      const text = `title: T\ncontext: ${v}\n`
      const { value, diagnostics } = parseChart(text)
      expect(diagnostics).toEqual([])
      expect(value.lines[1]).toEqual({ kind: 'meta', key: 'context', value: v })
      expect(serializeChart(value)).toBe(text)
    }
  })

  it('a context: that is none of the three is a header error, the line kept as written (like a bad key:)', () => {
    const { value, diagnostics } = parseChart('title: T\ncontext: bossa\n')
    expect(diagnostics).toEqual([{ line: 2, message: 'context: functional, modal or blues' }])
    expect(value.lines[1]).toEqual({ kind: 'meta', key: 'context', value: 'bossa' })
    expect(serializeChart(value)).toBe('title: T\ncontext: bossa\n')
  })

  it('reads a context: with a trailing comment (the spec example), keeping the line as written', () => {
    const text = 'context: modal          # the whole tune\n'
    const { value, diagnostics } = parseChart(text)
    expect(diagnostics).toEqual([])
    expect(value.lines[0]).toEqual({ kind: 'meta', key: 'context', value: 'modal          # the whole tune' })
    expect(parseContext('modal          # the whole tune')).toBe('modal')
    expect(serializeChart(value)).toBe(text)
  })

  it('an empty context: is absent, like an empty key:: no diagnostic', () => {
    expect(parseChart('title: T\ncontext:\n').diagnostics).toEqual([])
    expect(parseChart('title: T\ncontext:   \n').diagnostics).toEqual([])
  })

  it('rejects an @context whose section name is over the limit', () => {
    expect(parseChart(`@context ${'S'.repeat(LIMITS.maxCell + 1)} 1 modal`).diagnostics[0]?.message).toBe(`section name longer than ${LIMITS.maxCell} characters`)
  })

  it('accepts minor: (reserved) and keeps it', () => {
    const { value, diagnostics } = parseChart('minor: dorian\n')
    expect(diagnostics).toEqual([])
    expect(value.lines[0]).toEqual({ kind: 'meta', key: 'minor', value: 'dorian' })
    expect(serializeChart(value)).toBe('minor: dorian\n')
  })

  it('reads @context SECTION BAR VALUE and writes it back', () => {
    const { value, diagnostics } = parseChart('@context A 1 modal\n@context B 17 Blues\n')
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'context', section: 'A', bar: 1, context: 'modal' },
      { kind: 'context', section: 'B', bar: 17, context: 'blues' },
    ])
    expect(serializeChart(value)).toBe('@context A 1 modal\n@context B 17 blues\n')
  })

  it('rejects a malformed @context', () => {
    for (const bad of ['@context A 1', '@context A x modal', '@context A 1 bossa', '@context A 1 modal extra'])
      expect(parseChart(bad).diagnostics[0]?.message, bad).toBe('use  @context SECTION BAR CONTEXT  (functional, modal or blues)')
  })
})
