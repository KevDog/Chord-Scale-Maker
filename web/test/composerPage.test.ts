import { describe, expect, it } from 'vitest'
import { COMPOSERS, composerHead, composerPage, creditParts } from '~/utils/composerPage'

type Ld = { '@type': string; name?: string; url?: string; itemListElement?: { name?: string; item: string | { '@type': string; name: string; url: string } }[] }

describe('composerHead', () => {
  it('names the composer in the title, and gives a Person, their tunes and breadcrumbs', () => {
    const h = composerHead('thelonious-monk')
    expect(h?.head.title).toBe('Thelonious Monk: tunes, changes and chord scales')
    expect(h?.head.robots).toBe('index, follow, max-image-preview:large')
    const ld = JSON.parse(h?.ld ?? '[]') as Ld[]
    expect(ld.map((d) => d['@type'])).toEqual(['Person', 'ItemList', 'BreadcrumbList'])
    expect(ld[0]).toMatchObject({ name: 'Thelonious Monk', url: 'https://www.chordscalemaker.com/composers/thelonious-monk' })
    const tunes = ld[1]?.itemListElement?.map((i) => i.item) as { '@type': string; name: string; url: string }[]
    expect(tunes.every((t) => t['@type'] === 'MusicComposition' && t.url.startsWith('https://www.chordscalemaker.com/song/'))).toBe(true)
    expect(tunes.some((t) => t.name === '’Round Midnight' || t.name === "'Round Midnight")).toBe(true)
    expect(ld[2]?.itemListElement?.map((i) => i.name)).toEqual(['Composers', 'Thelonious Monk'])
  })
  it('keeps every description to a search snippet (70–160 characters)', () => {
    for (const c of COMPOSERS) {
      const d = composerHead(c.slug)?.head.description ?? ''
      expect(d.length, c.slug).toBeGreaterThanOrEqual(70)
      expect(d.length, c.slug).toBeLessThanOrEqual(160)
    }
  })
  it('is null for an unknown composer', () => {
    expect(composerHead('nobody')).toBeNull()
    expect(composerPage('nobody')).toBeNull()
  })
})

describe('composerPage', () => {
  it("lists the composer's tunes in library order, each with its co-writers linked", () => {
    const p = composerPage('thelonious-monk')
    expect(p?.name).toBe('Thelonious Monk')
    expect(p?.tunes.length).toBeGreaterThan(1)
    const midnight = p?.tunes.find((t) => t.path === '/song/round-midnight')
    expect(midnight?.with).toEqual([{ text: 'Cootie Williams', path: '/composers/cootie-williams' }])
    expect(p?.tunes.find((t) => t.path === '/song/monks-mood')?.with).toEqual([])
    expect(p?.tunes[0]?.details).toMatch(/·/)
    const three = composerPage('bobby-plater')?.tunes[0]?.with.map((w) => w.text).join('')
    expect(three).toBe('Tiny Bradshaw & Edward Johnson')
  })
})

describe('creditParts', () => {
  it('links each library composer, keeping the credit as written', () => {
    expect(creditParts('Thelonious Monk & Cootie Williams')).toEqual([
      { text: 'Thelonious Monk', path: '/composers/thelonious-monk' },
      { text: ' & ', path: null },
      { text: 'Cootie Williams', path: '/composers/cootie-williams' },
    ])
  })
  it('leaves a name with no page, and a traditional tune, as text', () => {
    expect(creditParts('Nobody Atall')).toEqual([{ text: 'Nobody Atall', path: null }])
    expect(creditParts('Traditional (Australian)')).toEqual([{ text: 'Traditional (Australian)', path: null }])
    expect(creditParts('')).toEqual([])
  })
})

describe('COMPOSERS', () => {
  it('files by surname', () => {
    const keys = COMPOSERS.map((c) => c.sortKey)
    expect(keys).toEqual(keys.toSorted((a, b) => a.localeCompare(b, 'en')))
    expect(COMPOSERS.find((c) => c.slug === 'gene-de-paul')?.sortKey.startsWith('p')).toBe(true)
  })
})
