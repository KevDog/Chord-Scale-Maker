import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildChanges } from '../changes'
import { keyLabel, parseChart } from '../chart'
import { LIMITS } from '../limits'
import { CONCERT } from '../part'
import { tuneDescription, tuneSummary } from '../tune'
import { isSyncCopy } from '../util'

const read = (name: string) => readFileSync(`charts/${name}`, 'utf8')
const charts = readdirSync('charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))

describe('tuneSummary', () => {
  it('gives the heading fields as written', () => {
    const t = tuneSummary(read('blue_trane.txt'))
    expect(t).toMatchObject({
      title: 'Blue Trane',
      subtitle: 'Medium blues',
      composer: 'John Coltrane',
      aka: [],
      key: 'Eb',
      keyLabel: keyLabel('Eb'),
      style: 'Blues',
      form: 'A, 12 bars',
      time: '',
      source: 'Colorado Cookbook, p. 33',
    })
  })

  it('gives one row per chord, as the Changes sheet draws it in concert pitch', () => {
    const text = read('blue_trane.txt')
    const chords = buildChanges(parseChart(text).value, CONCERT).lines.flatMap((l) => l.bars.flatMap((b) => b.chords))
    const t = tuneSummary(text)
    expect(t.rows[0]).toEqual({ section: 'A', bar: '1', chord: 'Eb7#9', numeral: chords[0]?.numeral, scale: chords[0]?.scale })
    expect(t.rows).toEqual(chords.map((c) => ({ section: c.at.section, bar: c.at.bar, chord: c.text, numeral: c.numeral, scale: c.scale })))
  })

  it('includes a repeated section as drawn: written out after another section, once under repeat signs', () => {
    const rows = (text: string) => tuneSummary(text).rows.map((r) => `${r.section} ${r.bar} ${r.chord}`)
    expect(rows('A | 1 | C\nB | 2 | F\n@copy A A2 2')).toEqual(['A 1 C', 'B 2 F', 'A2 3 C'])
    expect(rows('A | 1 | C\nA | 2 | G7\n@copy A A2 2')).toEqual(['A 1 C', 'A 2 G7'])
  })

  it('leaves the fields a chart lacks empty', () => {
    const t = tuneSummary('A | 1 | C')
    expect(t).toMatchObject({ title: 'Untitled', composer: '', key: '', keyLabel: '', form: '', source: '' })
  })
})

describe('tuneDescription', () => {
  it('names the tune, its composer and its key', () => {
    expect(tuneDescription(tuneSummary(read('blue_trane.txt')))).toBe(
      'Chord-scale practice sheets for Blue Trane by John Coltrane in E♭: the changes as a study lead sheet with guide tones, and a scale for every chord.',
    )
  })

  it('has no "by" or empty commas without a composer or key', () => {
    const d = tuneDescription(tuneSummary('title: Tune\nA | 1 | C'))
    expect(d).toBe('Chord-scale practice sheets for Tune: the changes as a study lead sheet with guide tones, and a scale for every chord, for your instrument.')
  })

  it('drops clauses from the end to fit', () => {
    const long = tuneDescription(tuneSummary(`title: ${'Long '.repeat(20)}Tune\ncomposer: Someone With A Long Name\nkey: F#m\nA | 1 | C`))
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long).not.toMatch(/[,:]\s*$/)
    const longest = 'x'.repeat(LIMITS.maxMeta) // a title as long as a chart allows still fits, alone
    expect(tuneDescription(tuneSummary(`title: ${longest}\ncomposer: Someone\nA | 1 | C`))).toBe(`Chord-scale practice sheets for ${longest}.`)
  })

  it.each(charts)('fits in 160 characters: %s', (file) => {
    expect(tuneDescription(tuneSummary(read(file))).length).toBeLessThanOrEqual(160)
  })
})
