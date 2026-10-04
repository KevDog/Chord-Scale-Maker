import { describe, expect, it } from 'vitest'
import { chartMeta, expandRows, isFatal, parseChart, resolveScale, serializeChart } from '../chart'
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
})
