import { describe, expect, it } from 'vitest'
import { composerIndex, composersOf, nearDuplicateComposers } from '..'

const chart = (slug: string, head: string) => ({ slug, text: `title: ${slug}\n${head}\nkey: C\n\nsection: A\n1 | C\n` })

describe('composers', () => {
  it('splits a credit on commas and ampersands', () => {
    expect(composersOf('Borodin, Wright & Forrest').map((c) => c.name)).toEqual(['Borodin', 'Wright', 'Forrest'])
    expect(composersOf('')).toEqual([])
    expect(composersOf('  ')).toEqual([])
  })

  it('slugs a name: ASCII, lowercase, quotes dropped', () => {
    expect(composersOf('Harry "Sweets" Edison & Count Basie')[0]).toMatchObject({ slug: 'harry-sweets-edison', sortKey: 'edison harry sweets' })
    expect(composersOf('Antonio Carlos Jobim')[0]?.slug).toBe('antonio-carlos-jobim')
    expect(composersOf('J. Fred Coots')[0]?.slug).toBe('j-fred-coots')
    expect(composersOf('Bronisław Kaper')[0]?.slug).toBe('bronislaw-kaper')
    expect(composersOf('Antônio Carlos Jobim')[0]?.slug).toBe('antonio-carlos-jobim')
  })

  it('files by surname: a lowercase particle files under the name after it, a capital one under itself', () => {
    expect(composersOf('Gene de Paul, Patricia Johnston & Don Raye')[0]).toMatchObject({ surname: 'de Paul', sortKey: 'paul gene' })
    expect(composersOf('Jimmy Van Heusen')[0]).toMatchObject({ surname: 'Van Heusen', sortKey: 'van heusen jimmy' })
    expect(composersOf('Borodin')[0]).toMatchObject({ surname: 'Borodin', sortKey: 'borodin' })
  })

  it('a traditional tune has no composer', () => {
    expect(composersOf('Traditional (Australian)')).toEqual([])
    expect(composersOf('Trad.')).toEqual([])
  })

  it('indexes the charts by composer, sorted by surname, each with its tunes', () => {
    const index = composerIndex([
      chart('round-midnight', 'composer: Thelonious Monk & Cootie Williams'),
      chart('monks-mood', 'composer: Thelonious Monk'),
      chart('f-blues', 'composer: Nobody\nkind: form'),
      chart('so-what', 'composer: Miles Davis'),
    ])
    expect(index.map((c) => c.name)).toEqual(['Miles Davis', 'Thelonious Monk', 'Cootie Williams'])
    expect(index.find((c) => c.slug === 'thelonious-monk')?.tunes).toEqual(['round-midnight', 'monks-mood'])
    expect(index.some((c) => c.name === 'Nobody')).toBe(false)
  })

  it('reads one composer from charts that spell the name the same', () => {
    const index = composerIndex([chart('a', 'composer: Charlie Parker, Dizzy Gillespie'), chart('b', 'composer: Charlie Parker & Dizzy Gillespie')])
    expect(index.map((c) => [c.slug, c.tunes])).toEqual([['dizzy-gillespie', ['a', 'b']], ['charlie-parker', ['a', 'b']]])
  })

  it('lists composers who may be one person spelled two ways (same surname)', () => {
    const index = composerIndex([chart('a', 'composer: Duke Ellington'), chart('b', 'composer: Edward Kennedy Ellington'), chart('c', 'composer: Miles Davis')])
    expect(nearDuplicateComposers(index)).toEqual([['duke-ellington', 'edward-kennedy-ellington']])
  })
})
