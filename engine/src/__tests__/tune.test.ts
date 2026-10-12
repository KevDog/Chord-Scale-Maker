import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keyLabel, parseChart } from '../chart'
import { LIMITS } from '../limits'
import { tuneAdvice, tuneDescription, tuneGaps, tuneSummary } from '../tune'
import { isSyncCopy } from '../util'

const read = (name: string) => readFileSync(`charts/${name}`, 'utf8')
const charts = readdirSync('charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))

describe('tuneSummary', () => {
  it('gives the heading fields as written', () => {
    const t = tuneSummary(read('blue-trane.txt'))
    expect(t).toMatchObject({
      title: 'Blue Trane',
      subtitle: 'Medium blues',
      composer: 'John Coltrane',
      aka: ['Blue Train'],
      key: 'Eb',
      keyLabel: keyLabel('Eb'),
      style: 'Blues',
      form: 'A, 12 bars',
      time: '',
      source: 'Colorado Cookbook, p. 33',
    })
  })

  it('gives each aka: name, split at semicolons (titles may hold commas)', () => {
    expect(tuneSummary('aka: Blue Train; Blue Trane (alt take)\nA | 1 | C').aka).toEqual(['Blue Train', 'Blue Trane (alt take)'])
    expect(tuneSummary('aka: Me, Myself and I\nA | 1 | C').aka).toEqual(['Me, Myself and I'])
    expect(tuneSummary('aka: ;  \nA | 1 | C').aka).toEqual([])
  })

  it('leaves the fields a chart lacks empty', () => {
    const t = tuneSummary('A | 1 | C')
    expect(t).toMatchObject({ title: 'Untitled', composer: '', key: '', keyLabel: '', form: '', source: '' })
  })
})

describe('tuneDescription', () => {
  it('names the tune, its other title, its composer and its key', () => {
    expect(tuneDescription(tuneSummary(read('blue-trane.txt')))).toBe(
      'Chord-scale practice sheets for Blue Trane (also Blue Train) by John Coltrane in E♭: the changes as a study lead sheet with guide tones.',
    )
  })

  it('has no "by" or empty commas without a composer or key', () => {
    const d = tuneDescription(tuneSummary('title: Tune\nA | 1 | C'))
    expect(d).toBe('Chord-scale practice sheets for Tune: the changes as a study lead sheet with guide tones, and a scale for every chord, for your instrument.')
  })

  it('adds the other titles after the title when they fit with the composer and key', () => {
    const t = tuneSummary('title: Tune\naka: Song; Ditty\ncomposer: Someone\nkey: C\nA | 1 | C')
    expect(tuneDescription(t)).toMatch(/^Chord-scale practice sheets for Tune \(also Song or Ditty\) by Someone in C: /)
    const long = tuneSummary(`title: Tune\naka: ${'x'.repeat(120)}\ncomposer: Someone\nkey: C\nA | 1 | C`)
    expect(tuneDescription(long)).toMatch(/^Chord-scale practice sheets for Tune by Someone in C: /)
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

describe('tuneGaps: what a song page needs from its chart', () => {
  const doc = (head: string) => parseChart(`${head}\nA | 1 | C`).value
  const TUNE = 'title: Blue Trane\ncomposer: John Coltrane\nkey: Eb\nstyle: Blues\nform: A, 12 bars'

  it('finds none in a complete tune', () => {
    expect(tuneGaps(doc(TUNE))).toEqual([])
  })

  it('asks a tune for its composer, with or without kind: tune', () => {
    const noComposer = TUNE.replace('composer: John Coltrane\n', '')
    expect(tuneGaps(doc(noComposer))).toEqual(['no composer: a tune’s page needs one (or write kind: form or kind: exercise)'])
    expect(tuneGaps(doc(`kind: tune\n${noComposer}`))).toHaveLength(1)
  })

  it('asks no composer of a form or an exercise', () => {
    const noComposer = TUNE.replace('composer: John Coltrane\n', '')
    expect(tuneGaps(doc(`kind: form\n${noComposer}`))).toEqual([])
    expect(tuneGaps(doc(`kind: exercise\n${noComposer}`))).toEqual([])
  })

  it('asks every kind for its title, key, style and form', () => {
    expect(tuneGaps(doc('kind: form\nA | 1 | C'))).toEqual(['no title:', 'no key:', 'no style:', 'no form:'])
  })
})

describe('tuneAdvice: what a song page could also use', () => {
  const doc = (head: string) => parseChart(`${head}\nA | 1 | C`).value

  it('suggests source: and aka: when they are missing', () => {
    expect(tuneAdvice(doc('title: X'))).toEqual([
      'no source: say where the chart came from, if a book or recording',
      'no aka: add the tune’s other common titles, if it has any',
    ])
    expect(tuneAdvice(doc('title: X\nsource: Real Book\naka: Y'))).toEqual([])
  })
})
