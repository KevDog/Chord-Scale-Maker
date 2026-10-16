import { describe, expect, it } from 'vitest'
import { PAGE_HEAD } from '~/utils/site'
import { songHead } from '~/utils/songHead'

describe('songHead', () => {
  it("gives a library song its title, description and structured data, indexable", () => {
    const h = songHead('blue-trane')
    expect(h?.head).toEqual({
      title: 'Blue Trane (John Coltrane): Chord Changes and Lead Sheet Practice Charts',
      description: expect.stringContaining('lead-sheet'),
      ogTitle: 'Blue Trane (John Coltrane) · Chord Scale Maker',
      robots: 'index, follow, max-image-preview:large',
    })
    expect(h?.title).toBe('Blue Trane')
    expect(h?.composer).toBe('John Coltrane')
    expect(h?.leadSheet).toBe(
      'Blue Trane (John Coltrane), also known as Blue Train, as a lead sheet gives it: the chord changes bar by bar, without the melody. The sheets add a scale, guide tones, arpeggios and pentatonics for every chord, written for your instrument.',
    )
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
