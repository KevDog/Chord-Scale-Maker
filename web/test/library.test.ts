import { describe, expect, it } from 'vitest'
import { findChart, LIBRARY, searchLibrary, toLibrary } from '~/utils/library'

describe('library', () => {
  it('builds entries from chart files, sorted by title', () => {
    const lib = toLibrary({ '../x/b.txt': 'title: Beta\nA | 1 | C', '../x/a.txt': 'title: Álpha\nsubtitle: S\nA | 1 | C' })
    expect(lib.map((c) => [c.slug, c.title, c.subtitle])).toEqual([
      ['a', 'Álpha', 'S'],
      ['b', 'Beta', ''],
    ])
  })

  it('searches titles ignoring case and accents', () => {
    const lib = toLibrary({ 'a.txt': 'title: Álpha', 'b.txt': 'title: Beta' })
    expect(searchLibrary(lib, 'ALP').map((c) => c.slug)).toEqual(['a'])
    expect(searchLibrary(lib, '  ').map((c) => c.slug)).toEqual(['a', 'b'])
    expect(searchLibrary(lib, 'zzz')).toEqual([])
  })

  it('includes the repo charts', () => {
    expect(LIBRARY.map((c) => c.slug)).toContain('autumn_leaves')
    expect(findChart('autumn_leaves')?.title).toBe('Autumn Leaves')
    expect(findChart('nope')).toBeUndefined()
  })
})
