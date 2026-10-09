import { describe, expect, it } from 'vitest'
import { beatsPerBar, chartBeats, chartHeading, chartMeta, expandRowLines, expandRows, isFatal, keyLabel, parseChart, resolveScale, serializeChart } from '../chart'
import { LIMITS } from '../limits'

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
    expect(chartMeta(doc)).toEqual({ title: 'T', subtitle: 'S' })
    expect(doc.lines[5]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: 'F7', scale: '' })
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
    expect(rows.map(resolveScale)).toEqual(['C Dorian', 'F Mixolydian', 'C Dorian', 'F Mixolydian'])
    expect(resolveScale({ section: 'A', bar: '1', chord: 'Cm7#5#9x', scale: '' })).toBeNull()
    expect(resolveScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })

  it('reports bad lines without throwing and keeps them verbatim', () => {
    const { value: doc, diagnostics } = parseChart('A | 1\n@copy A\nA | 2 | C')
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
    expect(serializeChart(doc)).toBe('A | 1\n@copy A\nA | 2 | C\n')
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
