import { describe, expect, it } from 'vitest'
import raw from '../../chord_scales.json'
import { CHORD_QUALITIES, chordFormula, chordFromSlug, chordQualityOf, chordScales, chordSlug, chordTitle, chordUsage } from '..'

const QUALITIES = Object.keys(raw.qualities)

describe('chord pages', () => {
  it('names and slugs every quality in chord_scales.json, in its order, and reads the slug back', () => {
    expect(CHORD_QUALITIES).toEqual(QUALITIES)
    for (const q of QUALITIES) {
      expect(chordSlug(q), q).toMatch(/^[a-z0-9-]+$/)
      expect(chordFromSlug(chordSlug(q))).toBe(q)
      expect(chordTitle(q), q).not.toBe('')
    }
    expect(new Set(QUALITIES.map(chordSlug)).size).toBe(QUALITIES.length)
    expect(chordSlug('m7')).toBe('minor-7')
    expect(chordSlug('Maj7#11')).toBe('major-7-sharp-11')
    expect(chordFromSlug('nope')).toBeNull()
    expect(chordFromSlug('constructor')).toBeNull()
  })

  it('titles a quality as a player says it', () => {
    expect(chordTitle('m7')).toBe('Minor 7th')
    expect(chordTitle('m7b5')).toBe('Half-diminished (m7♭5)')
    expect(chordTitle('7alt')).toBe('Altered dominant')
  })

  it('gives each quality a formula, its arpeggio first, then its written tensions', () => {
    expect(chordFormula('Maj7')).toBe('1 3 5 7')
    expect(chordFormula('Maj7#11')).toBe('1 3 5 7 #11')
    expect(chordFormula('7b9b13')).toBe('1 3 5 b7 b9 b13')
    expect(chordFormula('dim7')).toBe('1 b3 b5 bb7')
    for (const q of QUALITIES) expect(chordFormula(q), q).toMatch(/^1 /)
  })

  it('lists the scales a quality takes, spelled on C, as chord_scales.json orders them', () => {
    const m7 = chordScales('m7')
    expect(m7[0]).toMatchObject({ scale: 'C Dorian', default: true })
    expect(m7.map((o) => o.scale)).toContain('Eb Major Pentatonic')
    expect(chordScales('Maj7').find((o) => o.scale === 'C Lydian')?.level).toBe('advanced')
  })

  it("reads a written chord's quality, extensions and slashes included", () => {
    expect(chordQualityOf('Bb-7')).toBe('m7')
    expect(chordQualityOf('F7(13)')).toBe('7')
    expect(chordQualityOf('DbMaj7/C')).toBe('Maj7')
    expect(chordQualityOf('N.C.')).toBeNull()
    expect(chordQualityOf('Xyz')).toBeNull()
  })

  it('finds the charts that use a quality, once each, in the charts’ order', () => {
    const charts = [
      { slug: 'a', text: 'key: C\nsection: A\n1 | Dm7\n2 | G7\n3 | Cmaj7\n4 | Dm7' },
      { slug: 'b', text: 'key: C\nsection: A\n1 | Em7b5\n2 | A7b9\n3 | Dm7' },
    ]
    const used = chordUsage(charts)
    expect(used.get('m7')).toEqual(['a', 'b'])
    expect(used.get('Maj7')).toEqual(['a'])
    expect(used.get('m7b5')).toEqual(['b'])
    expect(used.has('dim7')).toBe(false)
    expect(chordUsage(charts)).toBe(used)
  })
})
