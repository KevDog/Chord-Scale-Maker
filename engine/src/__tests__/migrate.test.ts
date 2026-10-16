import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrateChart } from '../migrate'
import { isSyncCopy } from '../util'

const lines = (t: string): string[] => t.trimEnd().split('\n')

describe('migrateChart', () => {
  it('leaves a chart that already has section blocks, or has no rows, as it is', () => {
    const blocks = 'title: T\n\nsection: A\n1 | C\n'
    expect(migrateChart(blocks)).toEqual({ text: blocks, lineMap: [0, 1, 2, 3], prose: [], problems: [] })
    expect(migrateChart('title: T\n').text).toBe('title: T\n')
  })

  it('groups rows into blocks with bars from 1', () => {
    const m = migrateChart('title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nB | 3 | CMaj7\nB | 4 | A7\n')
    expect(lines(m.text)).toEqual(['title: T', 'key: C', '', 'section: A', '1 | Dm7', '2 | G7', '', 'section: B', '1 | CMaj7', '2 | A7'])
    expect(m.lineMap).toEqual([0, 1, 4, 5, 8, 9])
  })

  it('writes bars: where the last chord is held into the next section', () => {
    const m = migrateChart('A | 1 | Dm7\nA | 3 | G7\nB | 5 | C\nB | 6 | C\nB | 7 | C\nB | 8 | C\n')
    expect(lines(m.text)).toEqual(['section: A', 'bars: 4', '1 | Dm7', '3 | G7', '', 'section: B', '1 | C', '2 | C', '3 | C', '4 | C'])
  })

  it("gives the form's last section the old engine's length (rounded up to a 4-bar phrase)", () => {
    const m = migrateChart('A | 1 | C\nA | 2 | F\nA | 3 | G7\n')
    expect(lines(m.text)).toContain('bars: 4')
  })

  it('turns @copy into copy:, with bars: on the copy only when its length differs', () => {
    const m = migrateChart('A1 | 1 | C\nA1 | 8 | G7\n@copy A1 A2 8\nB | 17 | F\nB | 24 | G7\n')
    const t = lines(m.text)
    expect(t).toContain('section: A2')
    expect(t[t.indexOf('section: A2') + 1]).toBe('copy: A1')
    expect(t.filter((l) => l.startsWith('bars:'))).toEqual([]) // A1 and A2 are 8 bars, B rounds up to 8
    expect(m.lineMap[2]).toBe(t.indexOf('copy: A1')) // @copy became the copy: line
  })

  it('moves directives into their block with relative bars', () => {
    const m = migrateChart('A | 1 | C\nA | 2 | G7\nB | 3 | F\nB | 4 | C\n@ending 1 B 3\n@segno A 1\n@coda B 4\n@nav B 4 D.S. al Coda\n')
    const t = lines(m.text)
    const b = t.indexOf('section: B')
    expect(t.slice(b)).toEqual(expect.arrayContaining(['@ending 1 1', '@coda 2', '@nav 2 D.S. al Coda']))
    expect(t.slice(t.indexOf('section: A'), b)).toContain('@segno 1')
  })

  it('replays @key: holds through later sections (key: on each), a mid-section change is an in-block @key', () => {
    const m = migrateChart('key: F\nA | 1 | F\nA | 2 | C7\nB | 3 | Gm7\n@key B 4 Db\nB | 4 | Ab7\nC | 5 | Db\nC | 6 | Db\n')
    const t = lines(m.text)
    const a = t.indexOf('section: A'), b = t.indexOf('section: B'), c = t.indexOf('section: C')
    expect(t.slice(a, b).some((l) => l.startsWith('key:'))).toBe(false) // before the first @key: found
    expect(t.slice(b, c)).toContain('@key 2 Db')
    expect(t.slice(c)).toContain('key: Db') // the old @key held on
  })

  it('makes an @key on a section start its key:', () => {
    const t = lines(migrateChart('A | 1 | C\nA | 2 | C\n@key B 3 Eb\nB | 3 | Eb\nB | 4 | Eb\n').text)
    expect(t[t.indexOf('section: B') + 1]).toBe('key: Eb')
  })

  it('gives a copy its own key: where the old key ran on through it (replacing the source’s @key lines)', () => {
    const t = lines(migrateChart('A1 | 1 | C\n@key A1 2 Eb\nA1 | 2 | Eb\n@copy A1 A2 2\n').text)
    const a2 = t.indexOf('section: A2')
    expect(t.slice(a2, a2 + 3)).toEqual(['section: A2', 'key: Eb', 'copy: A1'])
  })

  it('writes a repeat out as rows when it had an @key of its own (a copy: block takes none)', () => {
    const t = lines(migrateChart('A1 | 1 | C\nA1 | 2 | D\n@copy A1 A2 2\n@key A2 4 Eb\n').text)
    const a2 = t.indexOf('section: A2')
    expect(t.slice(a2)).toEqual(['section: A2', '1 | C', '2 | D', '@key 2 Eb'])
  })

  it('keeps header comments in the header; an # alt: line follows its bar, relative', () => {
    const m = migrateChart('title: T\n# analysis: x\n\n# section | bar | chord\nA | 1 | C\nA | 2 | G7\n# alt: bar 2 (Dm7)\nB | 3 | C\nB | 4 | C\n')
    const t = lines(m.text)
    expect(t.slice(0, t.indexOf('section: A'))).toEqual(['title: T', '# analysis: x', '', '# bar | chord', ''])
    expect(t.slice(t.indexOf('section: A'), t.indexOf('section: B'))).toContain('# alt: bar 2 (Dm7)')
  })

  it('rewrites an # alt: bar in a later section to its relative number', () => {
    const t = lines(migrateChart('A | 1 | C\nA | 2 | C\nB | 3 | F\n# alt: bars 3–4 (F7)\nB | 4 | F\n').text)
    expect(t).toContain('# alt: bars 1–2 (F7)')
  })

  it('lists prose comments that name a bar, and leaves them', () => {
    const m = migrateChart('A | 1 | C\n# the coda after bar 27\nA | 2 | C\n')
    expect(m.prose).toEqual(['line 2: # the coda after bar 27'])
    expect(m.text).toContain('# the coda after bar 27')
  })

  it('reports what it cannot carry: a section that comes back, a directive on a missing section', () => {
    expect(migrateChart('A | 1 | C\nB | 2 | F\nA | 3 | C\n').problems).toContain('section A appears again after another section (line 3)')
    expect(migrateChart('A | 1 | C\n@segno Z 1\n').problems).toContain('@segno names no section Z (line 2)')
  })
})

const CHARTS = new URL('../../charts/', import.meta.url)
const library = readdirSync(CHARTS).filter((f) => f.endsWith('.txt') && !isSyncCopy(f))

describe('migrateChart over the library', () => {
  it.each(library)('%s migrates with no problems', (f) => {
    const m = migrateChart(readFileSync(new URL(f, CHARTS), 'utf8'))
    expect(m.problems).toEqual([])
    expect(m.text).toMatch(/^section: /m)
  })
})