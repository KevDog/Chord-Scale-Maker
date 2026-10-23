import { CHORD_QUALITIES, chordSlug } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { CHORD_GROUPS, chordHead, chordPage, chordPath, chordQualityPath } from '~/utils/chordPage'

describe('chordHead', () => {
  it('gives a chord its title, a description naming the formula, and structured data', () => {
    const h = chordHead('minor-7')
    expect(h?.head.title).toBe('Minor 7th chord: notes, scales and tunes')
    expect(h?.head.description).toContain('1 ♭3 5 ♭7')
    expect(h?.head.robots).toBe('index, follow, max-image-preview:large')
    const ld = JSON.parse(h?.ld ?? '[]') as { '@type': string; url?: string; inDefinedTermSet?: string; itemListElement?: { name: string }[] }[]
    expect(ld.map((d) => d['@type'])).toEqual(['DefinedTerm', 'BreadcrumbList'])
    expect(ld[0]).toMatchObject({ inDefinedTermSet: 'Jazz chords', url: 'https://www.chordscalemaker.com/chords/minor-7' })
    expect(ld[1]?.itemListElement?.map((i) => i.name)).toEqual(['Chords', 'Minor 7th'])
  })
  it('keeps every description to a search snippet (70–160 characters)', () => {
    for (const q of CHORD_QUALITIES) {
      const d = chordHead(chordSlug(q))?.head.description ?? ''
      expect(d.length, q).toBeGreaterThanOrEqual(70)
      expect(d.length, q).toBeLessThanOrEqual(160)
    }
  })
  it('is null for an unknown slug', () => {
    expect(chordHead('nope')).toBeNull()
  })
  it('has its own link preview image (make og)', () => {
    expect(chordHead('minor-7')?.head.image).toEqual({ url: 'https://www.chordscalemaker.com/og/chords/minor-7.png', alt: 'Minor 7th chord: its formula, notes and scales' })
  })
})

describe('chordPage', () => {
  it("gives a chord its notes on C, its formula, its scales linked to their pages, and the tunes that use it", () => {
    const p = chordPage('minor-7')
    expect(p?.notes).toBe('C E♭ G B♭')
    expect(p?.formula).toBe('1 ♭3 5 ♭7')
    expect(p?.scales[0]).toMatchObject({ scale: 'C Dorian', path: '/scales/dorian', tags: ['default'] })
    expect(p?.scales.find((s) => s.scale === 'E♭ Major Pentatonic')?.path).toBe('/scales/major-pentatonic')
    expect(p?.tunes.length).toBeGreaterThan(0)
    expect(p?.tunes.length).toBeLessThanOrEqual(30)
    expect(p?.tunes[0]).toMatchObject({ title: expect.any(String), path: expect.stringMatching(/^\/song\//) })
    expect(p?.more).toBeGreaterThan(0)
  })
  it('spells a double flat', () => {
    expect(chordPage('diminished-7')?.notes).toBe('C E♭ G♭ B♭♭')
  })
  it('lists a tune once, at its main chart', () => {
    for (const q of CHORD_QUALITIES) {
      const tunes = chordPage(chordSlug(q))?.tunes ?? []
      expect(new Set(tunes.map((t) => t.path)).size, q).toBe(tunes.length)
    }
  })
  it('is null for an unknown slug', () => {
    expect(chordPage('nope')).toBeNull()
  })
})

describe('chord links', () => {
  it('links a quality, or a written chord, to its page', () => {
    expect(chordQualityPath('7alt')).toBe('/chords/altered-dominant')
    expect(chordPath('Bb-7')).toBe('/chords/minor-7')
    expect(chordPath('F7(13)')).toBe('/chords/dominant-7')
    expect(chordPath('N.C.')).toBeNull()
    expect(chordPath('Xyz')).toBeNull()
  })
})

describe('chord groups', () => {
  it('puts every quality in one group', () => {
    for (const q of CHORD_QUALITIES) expect(CHORD_GROUPS.filter((g) => g.qualities.includes(q)), q).toHaveLength(1)
    expect(CHORD_GROUPS.flatMap((g) => g.qualities)).toHaveLength(CHORD_QUALITIES.length)
  })
})
