import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, chordSlug } from '@chord-scale-maker/engine'
import { chordOgCard, libraryCharts, ogCard, ogHash, OG_DIR } from './ogCard'

const chart = (slug: string): string => libraryCharts().find((c) => c.slug === slug)?.text ?? ''

describe('ogCard', () => {
  it('names a version in its title', () => {
    expect(ogCard(chart('summertime-jazz-mind-accelerator')).title).toBe('Summertime (Jazz Mind Accelerator)')
    expect(ogCard(chart('summertime')).title).toBe('Summertime')
  })

  it('gives what a song’s preview image shows: title, composer, details and the first four bars', () => {
    const card = ogCard(chart('autumn-leaves'))
    expect(card).toMatchObject({ title: 'Autumn Leaves', composer: 'Joseph Kosma', details: 'Medium · G minor · AAB', beats: 4 })
    expect(card.bars).toHaveLength(4)
    expect(card.bars[0]).toEqual([[{ kind: 'text', text: 'C–7' }]])
  })

  it('counts a bar’s slashes from the time signature', () => {
    expect(ogCard(chart('baubles-bangles-and-beads')).beats).toBe(3)
  })

  it('hashes what the image shows, so an edit elsewhere in the chart keeps it', () => {
    const text = chart('autumn-leaves')
    expect(ogHash(ogCard(text + '\n# a note\n'))).toBe(ogHash(ogCard(text)))
    expect(ogHash(ogCard(text.replace('Joseph Kosma', 'J. Kosma')))).not.toBe(ogHash(ogCard(text)))
  })
})

describe('chordOgCard', () => {
  it('gives what a chord page’s preview shows: the chord on C, its name, formula, notes and first scales', () => {
    expect(chordOgCard('minor-7')).toEqual({
      symbol: [{ kind: 'text', text: 'C–7' }],
      title: 'Minor 7th chord',
      formula: '1 ♭3 5 ♭7',
      notes: 'C E♭ G B♭',
      scales: expect.stringMatching(/^C Dorian · /),
    })
  })

  it('lists at most four scales, none outside', () => {
    for (const q of CHORD_QUALITIES) expect(chordOgCard(chordSlug(q))!.scales.split(' · ').length, q).toBeLessThanOrEqual(4)
  })

  it('is null for an unknown slug', () => {
    expect(chordOgCard('nope')).toBeNull()
  })
})

describe('the song preview images (web/public/og/)', () => {
  const path = join(OG_DIR, 'manifest.json')
  const manifest = (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}) as Record<string, string>
  const charts = libraryCharts()

  const chords = CHORD_QUALITIES.map((q) => chordSlug(q))

  it('has one per library chart and one per chord page (chords/<slug>), and no others', () => {
    expect(Object.keys(manifest).toSorted(), 'run `make og`').toEqual([...charts.map((c) => c.slug), ...chords.map((c) => `chords/${c}`)].toSorted())
  })

  it.each(chords)('chords/%s: drawn from the chord as it is, 1200×630, at most 60 KB', (slug) => {
    const file = join(OG_DIR, 'chords', `${slug}.png`)
    expect(existsSync(file), 'run `make og`').toBe(true)
    expect(manifest[`chords/${slug}`], 'stale: run `make og`').toBe(ogHash(chordOgCard(slug)!))
    const png = readFileSync(file)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    expect(statSync(file).size).toBeLessThanOrEqual(60_000)
  })

  it.each(charts)('$slug: drawn from the chart as it is, 1200×630, at most 60 KB', ({ slug, text }) => {
    const file = join(OG_DIR, `${slug}.png`)
    expect(existsSync(file), 'run `make og`').toBe(true)
    expect(manifest[slug], 'stale: run `make og`').toBe(ogHash(ogCard(text)))
    const png = readFileSync(file)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]) // the IHDR's width and height
    expect(statSync(file).size).toBeLessThanOrEqual(60_000)
  })
})
