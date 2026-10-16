import { describe, expect, it } from 'vitest'
import { parseChart } from '../chart'
import { sectionLayout, statedKeyAt } from '../layout'

const layout = (text: string) => sectionLayout(parseChart(text).value).value

describe('sectionLayout', () => {
  it('fills in each row’s section and its bar counted through the part', () => {
    const l = layout('section: A\n1 | C\n2 | F\nsection: B\n1 | G7\n')
    expect(l.rows.map((r) => [r.section, r.bar, r.at])).toEqual([['A', '1', 1], ['A', '2', 2], ['B', '1', 3]])
    expect(l.sections.map((s) => [s.name, s.start, s.length])).toEqual([['A', 0, 2], ['B', 2, 1]])
  })

  it('takes a length from bars:, else the last written bar', () => {
    const l = layout('section: A\nbars: 8\n1 | C\n5 | F\nsection: B\n1 | G7\n')
    expect([...l.lengths]).toEqual([['A', 8], ['B', 1]])
    expect(l.rows[2]?.at).toBe(9)
  })

  it('numbers an intro and a coda from their own start', () => {
    const l = layout('section: Intro\n1 | C\n2 | C\nsection: A\n1 | F\nsection: Coda\n1 | C\n')
    expect(l.rows.map((r) => r.at)).toEqual([1, 2, 1, 1])
    expect(l.sections.map((s) => s.part)).toEqual(['before', 'form', 'after'])
  })

  it('puts an outside: yes section before or after the form', () => {
    const l = layout('section: Vamp\noutside: yes\n1 | Dm7\nsection: A\n1 | C\nsection: Out\noutside: yes\n1 | C\n')
    expect(l.sections.map((s) => s.part)).toEqual(['before', 'form', 'after'])
  })

  it('repeats a copy’s source rows, pointing at the source lines, with its key, time, context and length', () => {
    const l = layout('section: A1\nkey: Eb\ntime: 3/4\ncontext: modal\nbars: 4\n1 | Cm7\n@key 3 Bb\nsection: A2\ncopy: A1\n')
    const a2 = l.sections[1]
    expect(a2?.rows.map((r) => [r.section, r.bar, r.line])).toEqual([['A2', '1', 5]])
    expect([a2?.key, a2?.beats, a2?.context, a2?.length, a2?.copyOf]).toEqual(['Eb', 3, 'modal', 4, 'A1'])
    expect(l.directives.filter((d) => d.section === 'A2')).toEqual([{ kind: 'key', section: 'A2', bar: 3, key: 'Bb', line: 6 }])
  })

  it('lets a copy’s own key: replace the source’s key: and its in-block @key lines', () => {
    const l = layout('section: A1\nkey: Eb\n1 | Cm7\n@key 2 Bb\n2 | F7\nsection: A2\nkey: G\ncopy: A1\n')
    expect(l.sections[1]?.key).toBe('G')
    expect(l.directives.filter((d) => d.section === 'A2')).toEqual([])
  })

  it('carries through a copy of a copy', () => {
    const l = layout('section: A\nkey: Eb\n1 | C\nsection: B\ncopy: A\nsection: C\ncopy: B\n')
    expect(l.sections[2]?.rows.map((r) => r.line)).toEqual([2])
    expect(l.sections[2]?.key).toBe('Eb')
  })

  it('does not carry endings, marks or nav into a copy', () => {
    const l = layout('section: A\n1 | C\n2 | F\n@ending 1 2\n@segno 1\nsection: B\ncopy: A\n@coda 2\n')
    expect(l.directives.map((d) => [d.kind, d.section])).toEqual([['ending', 'A'], ['mark', 'A'], ['mark', 'B']])
  })

  it('states keys that revert at the section’s end', () => {
    const l = layout('key: F\nsection: A\n1 | F\n2 | C7\nsection: B\nkey: Db\n1 | Db\n@key 3 E\n3 | E\nsection: C\n1 | F\n')
    expect([statedKeyAt(l, 'A', 1), statedKeyAt(l, 'B', 1), statedKeyAt(l, 'B', 2), statedKeyAt(l, 'B', 3), statedKeyAt(l, 'C', 1)]).toEqual([null, 'Db', 'Db', 'E', null])
  })

  it('stops at maxExpandedRows with a fatal diagnostic', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `${i + 1} | C`).join('\n')
    const copies = Array.from({ length: 120 }, (_, i) => `section: C${i}\ncopy: A`).join('\n')
    const { diagnostics } = sectionLayout(parseChart(`section: A\n${rows}\n${copies}\n`).value)
    expect(diagnostics.some((d) => d.fatal)).toBe(true)
  })
})
