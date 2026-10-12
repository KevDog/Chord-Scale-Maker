import { describe, expect, it } from 'vitest'
import { PAGE_HEAD } from '~/utils/site'
import { songHead } from '~/utils/songHead'

describe('songHead', () => {
  it("gives a library song its title, description and structured data, indexable", () => {
    const h = songHead('blue-trane')
    expect(h?.head).toEqual({ title: 'Blue Trane (John Coltrane): changes and chord scales', description: expect.stringContaining('Blue Trane') })
    expect(h?.head).not.toHaveProperty('robots')
    expect(h?.title).toBe('Blue Trane')
    expect(h?.composer).toBe('John Coltrane')
    const ld = JSON.parse(h?.ld ?? '[]') as { '@type': string; url?: string }[]
    expect(ld.map((d) => d['@type'])).toEqual(['MusicComposition', 'BreadcrumbList'])
    expect(ld[0]?.url).toBe('https://www.chordscalemaker.com/song/blue-trane')
  })
  it('is null for anything that is not a library chart', () => {
    expect(songHead('no-such-tune')).toBeNull()
  })
  it('keeps /song itself out of search', () => {
    expect(PAGE_HEAD.song.robots).toBe('noindex')
  })
})
