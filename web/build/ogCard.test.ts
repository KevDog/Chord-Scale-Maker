import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { libraryCharts, ogCard, ogHash, OG_DIR } from './ogCard'

const chart = (slug: string): string => libraryCharts().find((c) => c.slug === slug)?.text ?? ''

describe('ogCard', () => {
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

describe('the song preview images (web/public/og/)', () => {
  const path = join(OG_DIR, 'manifest.json')
  const manifest = (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}) as Record<string, string>
  const charts = libraryCharts()

  it('has one per library chart and no others', () => {
    expect(Object.keys(manifest).toSorted(), 'run `make og`').toEqual(charts.map((c) => c.slug).toSorted())
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
