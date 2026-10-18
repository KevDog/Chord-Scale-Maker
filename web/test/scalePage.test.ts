import { SCALES, type ScaleKey, scaleSlug } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { SCALE_GROUPS, scaleGroupOf } from '~/utils/scaleGroups'
import { scaleHead, scalePage, scalePath } from '~/utils/scalePage'

describe('scaleHead', () => {
  it('gives a scale its title, a description naming the formula, and structured data', () => {
    const h = scaleHead('lydian-dominant')
    expect(h?.head.title).toBe('Lydian Dominant scale: notes, chords and tunes')
    expect(h?.head.description).toContain('1 2 3 ♯4 5 6 ♭7')
    expect(h?.head.robots).toBe('index, follow, max-image-preview:large')
    const ld = JSON.parse(h?.ld ?? '[]') as { '@type': string; url?: string; inDefinedTermSet?: string; itemListElement?: { name: string; item: string }[] }[]
    expect(ld.map((d) => d['@type'])).toEqual(['DefinedTerm', 'BreadcrumbList'])
    expect(ld[0]).toMatchObject({ inDefinedTermSet: 'Jazz scales', url: 'https://www.chordscalemaker.com/scales/lydian-dominant' })
    expect(ld[1]?.itemListElement?.map((i) => i.name)).toEqual(['Scales', 'Lydian Dominant'])
  })
  it('keeps every description to a search snippet (70–160 characters)', () => {
    for (const k of Object.keys(SCALES) as ScaleKey[]) {
      const d = scaleHead(scaleSlug(k))?.head.description ?? ''
      expect(d.length, k).toBeGreaterThanOrEqual(70)
      expect(d.length, k).toBeLessThanOrEqual(160)
    }
  })
  it('is null for an unknown slug', () => {
    expect(scaleHead('nope')).toBeNull()
  })
})

describe('scalePage', () => {
  it("gives a scale's notes on C, its formula and the tunes that play it", () => {
    const p = scalePage('dorian')
    expect(p?.notes).toBe('C D E♭ F G A B♭')
    expect(p?.formula).toBe('1 2 ♭3 4 5 6 ♭7')
    expect(p?.tunes.length).toBeGreaterThan(0)
    expect(p?.tunes.length).toBeLessThanOrEqual(30)
    expect(p?.tunes[0]).toMatchObject({ title: expect.any(String), path: expect.stringMatching(/^\/song\//) })
    expect(p?.more).toBeGreaterThan(0)
  })
  it('says where an option is rooted off the chord root', () => {
    const p = scalePage('minor-pentatonic')
    expect(p?.playsOver.find((o) => o.quality === 'Maj7')?.from).toBe('from A, the 6th')
    expect(p?.playsOver.find((o) => o.quality === 'm7')?.from).toBe('')
  })
  it('links to a scale page by its slug', () => {
    expect(scalePath('C Half-Whole Dim.')).toBe('/scales/half-whole-diminished')
    expect(scalePath('not a scale')).toBeNull()
  })
})

describe('scale groups', () => {
  it('puts every scale in one group', () => {
    for (const k of Object.keys(SCALES) as ScaleKey[]) expect(SCALE_GROUPS.filter((g) => g.scales.includes(k))).toHaveLength(1)
    expect(scaleGroupOf('altered')).toBe('Melodic minor modes')
  })
})

describe('scalePage and versions (#411)', () => {
  it('lists a tune once, at its main chart', () => {
    for (const key of Object.keys(SCALES) as ScaleKey[]) {
      const tunes = scalePage(scaleSlug(key))?.tunes ?? []
      expect(tunes.map((t) => t.path)).not.toContain('/song/summertime-jazz-lab-accelerator')
      expect(new Set(tunes.map((t) => t.path)).size).toBe(tunes.length)
    }
  })
})
