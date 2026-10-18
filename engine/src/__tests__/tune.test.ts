import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keyLabel, parseChart, serializeChart } from '../chart'
import { LIMITS } from '../limits'
import type { ChordToken } from '../chord'
import { chartOutline, tuneAdvice, tuneDescription, tuneGaps, tuneSummary } from '../tune'
import { isSyncCopy } from '../util'

const read = (name: string) => readFileSync(`charts/${name}`, 'utf8')
const charts = readdirSync('charts').filter((f) => f.endsWith('.txt') && !isSyncCopy(f))

describe('tuneSummary', () => {
  it('reads the version, trimmed; none is the main chart', () => {
    expect(tuneSummary('title: Summertime\nversion:  Jazz Lab Accelerator \n\nsection: A\nbars: 4\n1 | C').version).toBe('Jazz Lab Accelerator')
    expect(tuneSummary('title: Summertime\n\nsection: A\nbars: 4\n1 | C').version).toBe('')
  })

  it('keeps version: through parse and serialize', () => {
    const text = 'title: Summertime\nversion: Jazz Lab Accelerator\n\nsection: A\nbars: 4\n1 | C\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

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
    expect(tuneSummary('aka: Blue Train; Blue Trane (alt take)\n\nsection: A\nbars: 4\n1 | C').aka).toEqual(['Blue Train', 'Blue Trane (alt take)'])
    expect(tuneSummary('aka: Me, Myself and I\n\nsection: A\nbars: 4\n1 | C').aka).toEqual(['Me, Myself and I'])
    expect(tuneSummary('aka: ;\n\nsection: A\nbars: 4\n1 | C').aka).toEqual([])
  })

  it('leaves the fields a chart lacks empty', () => {
    const t = tuneSummary('A | 1 | C')
    expect(t).toMatchObject({ title: 'Untitled', composer: '', key: '', keyLabel: '', form: '', source: '', recording: null, youtube: '' })
  })

  it('gives the notable recording and its video', () => {
    const t = tuneSummary('recording: John Coltrane; Blue Train; Blue Note; 1957\nyoutube: XpZHUVjQydI\n\nsection: A\nbars: 4\n1 | C')
    expect(t.recording).toEqual({ artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1957' })
    expect(t.youtube).toBe('XpZHUVjQydI')
    expect(t.embeddable).toBe(true)
  })

  it('gives a (link only) video its ID, not embeddable', () => {
    const t = tuneSummary('recording: John Coltrane; Blue Train\nyoutube: XpZHUVjQydI (link only)\n\nsection: A\nbars: 4\n1 | C')
    expect(t.youtube).toBe('XpZHUVjQydI')
    expect(t.embeddable).toBe(false)
  })
})

describe('tuneDescription', () => {
  it('names the tune, its other title, its composer and its key, as a lead-sheet style chart with no melody', () => {
    expect(tuneDescription(tuneSummary(read('blue-trane.txt')))).toBe(
      'Blue Trane (also Blue Train) by John Coltrane in E♭: the chord changes as a lead-sheet style practice chart. Chords only, no melody.',
    )
  })

  it('has no "by" or empty commas without a composer or key', () => {
    const d = tuneDescription(tuneSummary('title: Tune\n\nsection: A\nbars: 4\n1 | C'))
    expect(d).toBe(
      'Tune: the chord changes as a lead-sheet style practice chart, with guide tones and a scale, arpeggio and pentatonic for every chord. Chords only, no melody.',
    )
  })

  it('adds the other titles after the title when they fit with the composer and key', () => {
    const t = tuneSummary('title: Tune\naka: Song; Ditty\ncomposer: Someone\nkey: C\n\nsection: A\nbars: 4\n1 | C')
    expect(tuneDescription(t)).toMatch(/^Tune \(also Song or Ditty\) by Someone in C: /)
    const long = tuneSummary(`title: Tune\naka: ${'x'.repeat(120)}\ncomposer: Someone\nkey: C\nA | 1 | C`)
    expect(tuneDescription(long)).toMatch(/^Tune by Someone in C: /)
  })

  it('names the notable recording after the key, kept over the guide tones, the other titles kept over it', () => {
    const head = 'title: Tune\ncomposer: Someone\nkey: C\nrecording: Miles Davis; Kind of Blue; Columbia'
    expect(tuneDescription(tuneSummary(`${head}; 1959\nA | 1 | C`))).toMatch(/^Tune by Someone in C, as recorded by Miles Davis \(1959\): the chord changes/)
    expect(tuneDescription(tuneSummary(`${head}\nA | 1 | C`))).toMatch(/^Tune by Someone in C, as recorded by Miles Davis: /)
    const mid = tuneDescription(tuneSummary(`title: Tune\naka: Song\ncomposer: Someone\nkey: C\nrecording: ${'x'.repeat(15)}; Album; Label; 1959\nA | 1 | C`))
    expect(mid).toMatch(/^Tune \(also Song\) by Someone in C, as recorded by x+ \(1959\): the chord changes as a lead-sheet style practice chart\. Chords only/)
    const long = tuneDescription(tuneSummary(`title: Tune\naka: Song\ncomposer: Someone\nkey: C\nrecording: ${'x'.repeat(80)}; Album; Label; 1959\nA | 1 | C`))
    expect(long).toBe('Tune (also Song) by Someone in C: the chord changes as a lead-sheet style practice chart. Chords only, no melody.')
  })

  it('drops clauses from the end to fit, the lead-sheet clause last but for the title', () => {
    const long = tuneDescription(tuneSummary(`title: ${'Long '.repeat(13)}Tune\ncomposer: Someone With A Long Name\nkey: F#m\nA | 1 | C`))
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long).not.toMatch(/[,:]\s*$/)
    expect(long).toContain('lead-sheet')
    const longest = 'x'.repeat(LIMITS.maxMeta) // a title as long as a chart allows still fits, alone
    expect(tuneDescription(tuneSummary(`title: ${longest}\ncomposer: Someone\nA | 1 | C`))).toBe(`${longest}.`)
  })

  it.each(charts)('fits in 70–160 characters and says lead-sheet: %s', (file) => {
    const d = tuneDescription(tuneSummary(read(file)))
    expect(d.length).toBeGreaterThanOrEqual(70)
    expect(d.length).toBeLessThanOrEqual(160)
    expect(d).toContain('lead-sheet')
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
    expect(tuneGaps(doc('kind: form\n\nsection: A\nbars: 4\n1 | C'))).toEqual(['no title:', 'no key:', 'no style:', 'no form:'])
  })
})

describe('tuneAdvice: what a song page could also use', () => {
  const doc = (head: string) => parseChart(`${head}\nA | 1 | C`).value

  it('suggests source: and aka: when they are missing', () => {
    expect(tuneAdvice(doc('title: X'))).toEqual([
      'no source: say where the chart came from, if a book or recording',
      'no aka: add the tune’s other common titles, if it has any',
      'no recording: name one notable recording of the tune',
    ])
    expect(tuneAdvice(doc('title: X\nsource: Real Book\naka: Y\nrecording: A; B'))).toEqual([])
  })

  it('asks no form or exercise for a recording', () => {
    expect(tuneAdvice(doc('title: X\nkind: form\nsource: S\naka: Y'))).toEqual([])
  })
})

describe('chartOutline', () => {
  const text = (tokens: readonly ChordToken[]) => tokens.map((t) => (t.kind === 'text' ? t.text : t.acc === 'b' ? '♭' : '♯')).join('')
  const bars = (chart: string) =>
    chartOutline(chart).map((s) => ({ name: s.name, copyOf: s.copyOf, bars: s.bars.map((b) => b.chords.map(text)) }))

  it('gives each bar its chords as the sheet draws them, a held bar as %', () => {
    const [a] = bars(read('blue-trane.txt'))
    expect(a).toMatchObject({ name: 'A', copyOf: null })
    expect(a?.bars).toEqual([['E♭7(♯9)'], ['%'], ['%'], ['%'], ['A♭7(♯11)'], ['%'], ['E♭7(♯9)'], ['%'], ['B♭7(♯9)'], ['%'], ['E♭7(♯9)'], ['%']])
  })

  it('gives a bar of two chords both, in order', () => {
    expect(bars('section: A\n1 | Dm7\n1 | G7\n2 | CMaj7')[0]?.bars).toEqual([['D–7', 'G7'], ['CMaj7']])
  })

  it('gives a copy: section as the one it repeats, with no bars', () => {
    const s = bars('section: A1\n1 | C\n2 | G7\n\nsection: A2\ncopy: A1')
    expect(s[1]).toEqual({ name: 'A2', copyOf: 'A1', bars: [] })
  })

  it('reads in concert pitch, as written', () => {
    expect(bars('key: Bb\ninstrument: Tenor Sax\n\nsection: A\n1 | Bb7')[0]?.bars).toEqual([['B♭7']])
  })

  it('outlines every library chart with no bar left empty', () => {
    for (const f of charts)
      for (const s of chartOutline(read(f))) for (const b of s.bars) expect(b.chords.length, `${f} ${s.name} ${b.bar}`).toBeGreaterThan(0)
  })
})
