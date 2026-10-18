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
      image: { url: 'https://www.chordscalemaker.com/og/blue-trane.png', alt: 'Blue Trane, John Coltrane: chord changes' },
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
  it("gives a song's notable recording only with the recordings flag", () => {
    const on = songHead('blue-trane', { recordings: true })
    expect(on?.recording).toEqual({ artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1958' })
    expect(on?.ld).toContain('"recordedAs"')
    expect(on?.embeddable).toBe(true)
    const off = songHead('blue-trane', { recordings: false })
    expect(off?.recording).toBeNull()
    expect(off?.youtube).toBe('')
    expect(off?.ld).not.toContain('recordedAs')
    expect(songHead('all-blues', { recordings: true })?.head.description).toContain(', as recorded by Miles Davis (1959)')
    expect(songHead('all-blues', { recordings: false })?.head.description).not.toContain('as recorded by')
    expect(songHead('blue-trane')?.recording).toBeNull()
  })
  it("gives a song's chord changes, section by section", () => {
    const outline = songHead('blue-trane')?.outline
    expect(outline?.map((s) => s.name)).toEqual(['A'])
    expect(outline?.[0]?.bars).toHaveLength(12)
  })
  it("names a song's preview image without a composer when it has none", () => {
    expect(songHead('f-blues')?.head.image?.alt).toBe('F Blues: chord changes')
  })
  it('credits no contributor where the chart names none', () => {
    expect(songHead('autumn-leaves')?.contributor).toBe('')
  })

  it('is null for anything that is not a library chart', () => {
    expect(songHead('no-such-tune')).toBeNull()
  })
  it('keeps /song itself out of search', () => {
    expect(PAGE_HEAD.song.robots).toBe('noindex')
  })
})
