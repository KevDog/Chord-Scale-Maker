import type { TuneSummary } from '@chord-scale-maker/engine'
import { describe, expect, it } from 'vitest'
import { breadcrumbLd, jsonLd, tuneLd, webAppLd, websiteLd } from '~/utils/structuredData'

const TUNE: TuneSummary = {
  title: 'Blue Trane',
  subtitle: '',
  composer: 'John Coltrane',
  aka: [],
  kind: 'tune',
  key: 'Eb',
  keyLabel: 'E♭',
  style: 'Blues',
  form: 'A, 12 bars',
  time: '',
  source: '',
}
const PATH = '/song/blue-trane'

describe('websiteLd', () => {
  it('names the site at its root', () => {
    expect(websiteLd()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Chord Scale Maker',
      url: 'https://www.chordscalemaker.com/',
    })
  })
})

describe('webAppLd', () => {
  it('is a free educational web app for any OS, with no invented rating', () => {
    const ld = webAppLd()
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Chord Scale Maker',
      url: 'https://www.chordscalemaker.com/',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    })
    expect(ld.description).toBeTruthy()
    expect(ld.browserRequirements).toBeTruthy()
    expect(ld).not.toHaveProperty('aggregateRating')
  })
})

describe('tuneLd', () => {
  it('is a composition with its composer, key and page', () => {
    expect(tuneLd(TUNE, PATH)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'MusicComposition',
      name: 'Blue Trane',
      composer: { '@type': 'Person', name: 'John Coltrane' },
      musicalKey: 'E♭ major',
      url: 'https://www.chordscalemaker.com/song/blue-trane',
    })
  })

  it('reads a minor key as written', () => {
    expect(tuneLd({ ...TUNE, key: 'Cm', keyLabel: 'C minor' }, PATH).musicalKey).toBe('C minor')
  })

  it('has no composer or key without them', () => {
    const ld = tuneLd({ ...TUNE, composer: '', key: '', keyLabel: '' }, PATH)
    expect(ld).not.toHaveProperty('composer')
    expect(ld).not.toHaveProperty('musicalKey')
  })

  it('is a creative work, not a composition, for a form or an exercise', () => {
    expect(tuneLd({ ...TUNE, kind: 'form', composer: '' }, PATH)['@type']).toBe('CreativeWork')
    expect(tuneLd({ ...TUNE, kind: 'exercise', composer: '' }, PATH)['@type']).toBe('CreativeWork')
  })

  it('gives its other titles', () => {
    expect(tuneLd({ ...TUNE, aka: ['Tune Up'] }, PATH).alternateName).toEqual(['Tune Up'])
    expect(tuneLd(TUNE, PATH)).not.toHaveProperty('alternateName')
  })
})

describe('breadcrumbLd', () => {
  it('goes from the library to the tune', () => {
    expect(breadcrumbLd(TUNE, PATH)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Library', item: 'https://www.chordscalemaker.com/library' },
        { '@type': 'ListItem', position: 2, name: 'Blue Trane', item: 'https://www.chordscalemaker.com/song/blue-trane' },
      ],
    })
  })
})

describe('jsonLd', () => {
  it('is JSON that round-trips', () => {
    const data = [websiteLd(), tuneLd(TUNE, PATH)]
    expect(JSON.parse(jsonLd(data))).toEqual(data)
  })

  it('cannot close its script tag: no < survives', () => {
    const title = '</script><script>alert(1)</script>'
    const out = jsonLd(tuneLd({ ...TUNE, title }, PATH))
    expect(out).not.toContain('<')
    expect(JSON.parse(out).name).toBe(title)
  })
})
