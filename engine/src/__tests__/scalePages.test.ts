import { describe, expect, it } from 'vitest'
import { type ChordToken, playsOver, SCALES, type ScaleKey, scaleFromSlug, scaleSlug, scaleUsage } from '..'

const text = (tokens: readonly ChordToken[]): string => tokens.map((t) => (t.kind === 'text' ? t.text : t.acc)).join('')

describe('scale pages', () => {
  it('slugs every scale key and reads it back', () => {
    for (const k of Object.keys(SCALES) as ScaleKey[]) expect(scaleFromSlug(scaleSlug(k))).toBe(k)
    expect(scaleSlug('half whole diminished')).toBe('half-whole-diminished')
    expect(scaleSlug('diatonic diminished #iv')).toMatch(/^[a-z0-9-]+$/)
    expect(scaleFromSlug('nope')).toBeNull()
    expect(scaleFromSlug('constructor')).toBeNull()
  })

  it('lists the chord qualities a scale plays over, with its root and tags', () => {
    const dorian = playsOver('dorian')
    const m7 = dorian.find((p) => p.quality === 'm7')
    expect(m7).toMatchObject({ chord: 'Cm7', root: '1', tags: expect.arrayContaining(['default']) })
    expect(text(m7?.symbolOnC ?? [])).toBe('C–7')
    expect(playsOver('lydian dominant').some((p) => p.quality === '7#11')).toBe(true)
    expect(playsOver('whole tone').some((p) => p.quality === 'aug')).toBe(true)
  })

  it('writes the major triad as a bare root', () => {
    expect(playsOver('ionian').find((p) => p.quality === 'maj')?.chord).toBe('C')
  })

  it('keeps an option rooted off the chord root, with its interval', () => {
    expect(playsOver('minor pentatonic').find((p) => p.quality === 'Maj7')).toMatchObject({ root: '6' })
  })

  it('tags levels, outside and functional options', () => {
    expect(playsOver('lydian').find((p) => p.quality === 'Maj7')?.tags).toEqual(['advanced'])
    expect(playsOver('major pentatonic').find((p) => p.quality === 'Maj7' && p.root === '1')?.tags).toEqual(['basic'])
    expect(playsOver('diatonic diminished').every((p) => p.tags.includes('functional'))).toBe(true)
  })

  it('finds the library tunes that play a scale at Standard, once each, in library order', () => {
    const charts = [
      { slug: 'one', text: 'key: C\n\nsection: A\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | Dm7\n' },
      { slug: 'two', text: 'key: C\n\nsection: A\n1 | C7#11\n' },
      { slug: 'three', text: 'key: F\n\nsection: A\n1 | Gm7\n2 | C7\n3 | FMaj7\n' },
    ]
    const use = scaleUsage(charts)
    expect(use.get('dorian')).toEqual(['one', 'three'])
    expect(use.get('lydian dominant')).toEqual(['two'])
    expect(use.get('bebop major')).toBeUndefined()
  })

  it('analyses a library once', () => {
    const charts = [{ slug: 'one', text: 'key: C\n\nsection: A\n1 | Dm7\n' }]
    expect(scaleUsage(charts)).toBe(scaleUsage(charts))
  })
})
