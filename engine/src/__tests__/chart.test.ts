import { describe, expect, it } from 'vitest'
import { beatsPerBar, chartAka, chartRecording, chartBeats, chartKind, chartDetails, chartHeading, chartMeta, expandRowLines, expandRows, isFatal, isValidKey, keyLabel, lineSections, parseChart, parseContext, qualityScale, serializeChart } from '../chart'
import { LIMITS } from '../limits'

describe('isValidKey', () => {
  it('accepts a real major or minor key, rejects junk', () => {
    for (const k of ['C', 'Eb', 'F#', 'Bb', 'Am', 'F#m', 'Dm']) expect(isValidKey(k)).toBe(true)
    for (const k of ['', 'H', 'Cmaj', 'x', 'C7', '  ']) expect(isValidKey(k)).toBe(false)
  })
})

const SAMPLE = `title: T
subtitle: S

# bar | chord | scale
section: A
1 | Cm7 | C Dorian
2 | F7

section: B
copy: A
`

describe('chart', () => {
  it('parses the header, section lines, section fields and rows', () => {
    const { value, diagnostics } = parseChart(SAMPLE)
    expect(diagnostics).toEqual([])
    expect(value.lines).toEqual([
      { kind: 'meta', key: 'title', value: 'T' },
      { kind: 'meta', key: 'subtitle', value: 'S' },
      { kind: 'blank' },
      { kind: 'comment', text: '# bar | chord | scale' },
      { kind: 'section', name: 'A' },
      { kind: 'row', bar: '1', chord: 'Cm7', scale: 'C Dorian' },
      { kind: 'row', bar: '2', chord: 'F7', scale: '' },
      { kind: 'blank' },
      { kind: 'section', name: 'B' },
      { kind: 'sectionMeta', field: 'copy', value: 'A' },
    ])
    expect(chartMeta(value)).toEqual({ title: 'T', subtitle: 'S', key: '' })
  })

  it('reads the details the editor shows under the heading, as written', () => {
    expect(chartDetails(parseChart('time: 3/4\ncomposer: X\nstyle: Waltz\nform: AABA\ncomposer: Y').value)).toEqual({ time: '3/4', composer: 'Y', style: 'Waltz', form: 'AABA' })
    expect(chartDetails(parseChart('section: A\n1 | C').value)).toEqual({ time: '', composer: '', style: '', form: '' })
  })

  it('defaults the title', () => {
    expect(chartMeta(parseChart('section: A\n1 | C').value).title).toBe('Untitled')
  })

  it('builds the heading from the tune metadata', () => {
    const heading = (text: string) => chartHeading(parseChart(text).value)
    const tune = 'title: T\ncomposer: C. Porter\nstyle: Latin\nkey: Bbm\nform: AABA, 32 bars\n'
    expect(heading(tune)).toEqual({ title: 'T', subtitle: 'Latin · B♭ minor · AABA, 32 bars', composer: 'C. Porter' })
    expect(heading(`${tune}subtitle: Bossa nova\n`).subtitle).toBe('Bossa nova · B♭ minor · AABA, 32 bars') // the subtitle says more than the style
    expect(heading('subtitle: S\n')).toEqual({ title: 'Untitled', subtitle: 'S', composer: '' })
    expect(heading('title: T\nkey: G modal\n').subtitle).toBe('G modal')
    expect(['C', 'F#', 'Ebm', 'f', 'Dorian'].map(keyLabel)).toEqual(['C', 'F♯', 'E♭ minor', 'f', 'Dorian'])
  })

  it('expands copy: with bars from 1 and the source lines', () => {
    const rows = expandRowLines(parseChart(SAMPLE).value).value
    expect(rows.map((r) => `${r.section}${r.bar}@${r.line} at ${r.at}`)).toEqual(['A1@5 at 1', 'A2@6 at 2', 'B1@5 at 3', 'B2@6 at 4'])
  })

  it('resolves missing scales from the chord quality', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map(qualityScale)).toEqual(['C Dorian', 'F Mixolydian', 'C Dorian', 'F Mixolydian'])
    expect(qualityScale({ section: 'A', bar: '1', chord: 'Cm7#5#9x', scale: '' })).toBeNull()
    expect(qualityScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })

  it('reports bad lines without throwing and keeps them verbatim', () => {
    const { value: doc, diagnostics } = parseChart('section: A\n1 | C | x | y | z\n@copy A\n2 | C')
    expect(diagnostics.map((d) => d.line)).toEqual([2, 3])
    expect(serializeChart(doc)).toBe('section: A\n1 | C | x | y | z\n@copy A\n2 | C\n')
  })

  it('gives each aka: name, split at semicolons (titles may hold commas)', () => {
    const aka = (text: string) => chartAka(parseChart(text).value)
    expect(aka('aka: Blue Train; Blue Trane (alt take)')).toEqual(['Blue Train', 'Blue Trane (alt take)'])
    expect(aka('aka: Me, Myself and I')).toEqual(['Me, Myself and I'])
    expect(aka('aka: ;  \nsection: A\n1 | C')).toEqual([])
    expect(aka('section: A\n1 | C')).toEqual([])
  })

  it('keeps an aka: line as written, round-trip', () => {
    const text = 'title: Blue Trane\naka: Blue Train; Blue Trane (alt take)\nsection: A\n1 | C\n'
    const doc = parseChart(text).value
    expect(doc.lines[1]).toEqual({ kind: 'meta', key: 'aka', value: 'Blue Train; Blue Trane (alt take)' })
    expect(serializeChart(doc)).toBe(text)
  })

  it('serializes canonically and round-trips', () => {
    const doc = parseChart(SAMPLE).value
    const text = serializeChart(doc)
    expect(text).toBe(SAMPLE)
    expect(parseChart(text).value).toEqual(doc)
  })

  it('round-trips section fields and in-block directives, aligning rows across the chart', () => {
    const text = 'section: A\nkey: Eb\nbars: 12\n1  | Cm7 | C Dorian | ii\n12 | F7\n@key 3 Bb\n@ending 1 3 4\n@segno 1\n@nav 4 D.S.\n'
    expect(parseChart(text).diagnostics).toEqual([])
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('marks hard-limit diagnostics as fatal, line errors as not', () => {
    expect(isFatal(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics)).toBe(true)
    const many = `section: A\n${Array.from({ length: LIMITS.maxRows + 1 }, () => '1|C').join('\n')}`
    expect(isFatal(parseChart(many).diagnostics)).toBe(true)
    expect(isFatal(parseChart('section: A\n1 | C | x | y | z\n2 | C').diagnostics)).toBe(false)
  })

  it('enforces input limits', () => {
    expect(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics[0]?.message).toMatch(/longer than/)
    expect(parseChart(`section: A\n1 | ${'C'.repeat(LIMITS.maxCell + 1)}`).diagnostics[0]?.message).toMatch(/cell longer/)
    const many = `section: A\n${Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `${i + 1} | C`).join('\n')}`
    expect(parseChart(many).diagnostics.at(-1)?.message).toMatch(/more than 500 rows/)
  })

  it('caps copy: expansion before it can grow exponentially', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `${i + 1} | C`).join('\n')
    const copies = Array.from({ length: 200 }, (_, i) => `section: C${i}\ncopy: ${i ? `C${i - 1}` : 'A'}`).join('\n')
    const { value, diagnostics } = expandRows(parseChart(`section: A\n${rows}\n${copies}\n`).value)
    expect(value.length).toBeLessThanOrEqual(LIMITS.maxExpandedRows)
    expect(diagnostics).toHaveLength(1)
    expect(isFatal(diagnostics)).toBe(true)
  })

  it('keeps a trailing comment on a row, apart from sharps', () => {
    const text = 'section: A\n1 | F#m7 | F# Dorian  # ii of the ii–V to E\n2 | B7 #\n3 | C#7\n'
    const { value: doc, diagnostics } = parseChart(text)
    expect(diagnostics).toEqual([])
    expect(doc.lines.slice(1)).toEqual([
      { kind: 'row', bar: '1', chord: 'F#m7', scale: 'F# Dorian', comment: 'ii of the ii–V to E' },
      { kind: 'row', bar: '2', chord: 'B7', scale: '', comment: '' },
      { kind: 'row', bar: '3', chord: 'C#7', scale: '' },
    ])
    const out = serializeChart(doc)
    expect(out).toBe('section: A\n1 | F#m7 | F# Dorian  # ii of the ii–V to E\n2 | B7    #\n3 | C#7\n')
    expect(serializeChart(parseChart(out).value)).toBe(out) // round-trips
    expect(parseChart(`section: A\n1 | C # ${'x'.repeat(LIMITS.maxMeta + 1)}`).diagnostics).toHaveLength(1)
  })

  it('reads a time: line, and flags one it can’t use', () => {
    expect(['3/4', '2/4', '4/4', '5/4', '6/4', '', '6/8', '7/4', 'waltz'].map(beatsPerBar)).toEqual([3, 2, 4, 5, 6, 4, null, null, null])
    expect(chartBeats(parseChart('time: 3/4\nsection: A\n1 | C').value)).toBe(3)
    expect(chartBeats(parseChart('time: 6/4\nsection: A\n1 | C').value)).toBe(6)
    expect(parseChart('time: 6/8\nsection: A\n1 | C').diagnostics.map((d) => d.message)).toEqual(['time: 2/4, 3/4, 4/4, 5/4 or 6/4'])
  })

  it('reads a kind: line (a tune without one), and flags one it can’t use', () => {
    expect(chartKind(parseChart('section: A\n1 | C').value)).toBe('tune')
    expect(chartKind(parseChart('kind: Form\nsection: A\n1 | C').value)).toBe('form')
    expect(chartKind(parseChart('kind: exercise\nsection: A\n1 | C').value)).toBe('exercise')
    expect(parseChart('kind: etude\nsection: A\n1 | C').diagnostics.map((d) => d.message)).toEqual(['kind: tune, form or exercise'])
  })
})

describe('section blocks', () => {
  it.each([
    ['a song field after the first section:', 'section: A\ntitle: X\n1 | C\n', 2, 'title: belongs in the header, before the first section:'],
    ['a section field after a row', 'section: A\n1 | C\nkey: Eb\n', 3, 'section fields go straight under section:, before its bars'],
    ['a section field after a directive', 'section: A\n@segno 1\nbars: 4\n1 | C\n', 3, 'section fields go straight under section:, before its bars'],
    ['a second section with one name', 'section: A\n1 | C\nsection: A\n1 | F\n', 3, 'section A is already in the chart'],
    ['a row in the header', 'title: T\n1 | C\n', 2, 'bars go in a section: add  section: A  above'],
    ['an old-format row', 'A | 1 | C\n', 1, 'old chart format: put rows under a section: line, numbered from 1'],
    ['a directive in the header', '@segno 1\nsection: A\n1 | C\n', 1, 'directives go in a section: add  section: A  above'],
    ['@copy', 'section: A\n1 | C\n@copy A B 8\n', 3, '@copy is gone: write  copy: SRC  under the section’s section: line'],
    ['bars: under the last bar', 'section: A\nbars: 2\n1 | C\n3 | F\n', 2, 'bars: 2 is shorter than the section (its last bar is 3)'],
    ['bars: that is no number', 'section: A\nbars: x\n1 | C\n', 2, 'bars: a whole number of bars'],
    ['bars: under the length a copy: carries', 'section: A\n1 | C\n2 | F\nsection: B\nbars: 1\ncopy: A\n', 5, 'bars: 1 is shorter than the section it repeats (2 bars)'],
    ['rows in a copy', 'section: A\n1 | C\nsection: B\ncopy: A\n1 | F\n', 5, 'a section with copy: has no bars of its own'],
    ['copy: of a later section', 'section: B\ncopy: A\nsection: A\n1 | C\n', 2, 'copy: A must name a section above it'],
    ['copy: of no section', 'section: B\ncopy: Z\n', 2, 'copy: Z must name a section above it'],
    ['copy: of itself', 'section: B\ncopy: B\n', 2, 'copy: B must name a section above it'],
    ['outside: other than yes/no', 'section: V\noutside: maybe\n1 | C\n', 2, 'outside: yes or no'],
    ['a bad section name', 'section: A 1\n1 | C\n', 1, 'section: a name without spaces, at most 40 characters'],
    ['outside: in the header', 'outside: yes\nsection: A\n1 | C\n', 1, 'outside: belongs to a section'],
    ['a bad section key:', 'section: A\nkey: Dorian\n1 | C\n', 2, 'key: a key like Eb or Cm'],
    ['a sixth cell', 'section: A\n1 | Cm7 | C Dorian | ii7 | extra\n', 2, 'expected  bar | chord [| scale [| function]]'],
  ])('reports %s', (_, text, line, message) => {
    expect(parseChart(text).diagnostics).toContainEqual({ line, message })
  })

  it('keeps a section metre that differs from the song', () => {
    const { value, diagnostics } = parseChart('time: 4/4\nsection: B\ntime: 3/4\n1 | C\n')
    expect(value.lines[2]).toEqual({ kind: 'sectionMeta', field: 'time', value: '3/4' })
    expect(diagnostics).toEqual([])
  })

  it('reads key:, bars: and context: as section fields in a block and as meta in the header', () => {
    const lines = parseChart('key: F\nbars: 32\nsection: A\nkey: Db\nbars: 8\ncontext: modal\noutside: Yes\n1 | C\n').value.lines
    expect(lines.slice(0, 2).map((l) => l.kind)).toEqual(['meta', 'meta'])
    expect(lines.slice(3, 7)).toEqual([
      { kind: 'sectionMeta', field: 'key', value: 'Db' },
      { kind: 'sectionMeta', field: 'bars', value: '8' },
      { kind: 'sectionMeta', field: 'context', value: 'modal' },
      { kind: 'sectionMeta', field: 'outside', value: 'yes' },
    ])
  })

  it('names each line’s block', () => {
    expect(lineSections(parseChart('title: T\nsection: A\n1 | C\n\nsection: B\n1 | F\n').value)).toEqual([null, 'A', 'A', 'A', 'B', 'B'])
  })
})

describe('navigation directives', () => {
  const round = (text: string): string => serializeChart(parseChart(text).value)

  it('parses @ending with an explicit and a defaulted last bar', () => {
    const lines = parseChart('section: Intro\n@ending 1 7 8\n@ending 2 9\n').value.lines
    expect(lines[1]).toEqual({ kind: 'ending', n: 1, from: 7, to: 8 })
    expect(lines[2]).toEqual({ kind: 'ending', n: 2, from: 9, to: 9 })
  })

  it('parses @segno, @coda and @nav', () => {
    const lines = parseChart('section: A\n@segno 1\n@coda 1\n@nav 8 D.S. al Coda\n').value.lines
    expect(lines.slice(1)).toEqual([
      { kind: 'mark', mark: 'segno', bar: 1 },
      { kind: 'mark', mark: 'coda', bar: 1 },
      { kind: 'nav', bar: 8, text: 'D.S. al Coda' },
    ])
  })

  it('round-trips every directive (one-bar ending drops its LAST)', () => {
    const text = 'section: A\n@ending 1 7 8\n@ending 2 9\n@segno 1\n@coda 1\n@nav 8 D.S. al Coda\n'
    expect(round(text)).toBe(text)
  })

  it('rejects malformed directives as invalid lines, kept verbatim', () => {
    for (const bad of ['@ending 3 1 2', '@ending 1 x', '@segno', '@coda 1 extra', '@nav 8']) {
      const { value, diagnostics } = parseChart(`section: A\n${bad}\n`)
      expect(value.lines[1]).toEqual({ kind: 'invalid', text: bad })
      expect(diagnostics.length).toBe(1)
      expect(serializeChart(value)).toBe(`section: A\n${bad}\n`)
    }
  })
})

describe('the function cell and @key lines', () => {
  it('reads an optional fourth cell as the function, with or without a scale', () => {
    const { value, diagnostics } = parseChart('section: A\n1 | F7 | F Mixolydian | V7/V\n2 | Bb7 |  | D: V7/ii\n3 | F7\n4 | F7 | |\n')
    expect(diagnostics).toEqual([])
    expect(value.lines.slice(1)).toEqual([
      { kind: 'row', bar: '1', chord: 'F7', scale: 'F Mixolydian', function: 'V7/V' },
      { kind: 'row', bar: '2', chord: 'Bb7', scale: '', function: 'D: V7/ii' },
      { kind: 'row', bar: '3', chord: 'F7', scale: '' },
      { kind: 'row', bar: '4', chord: 'F7', scale: '' }, // an empty function cell is no function
    ])
  })

  it('writes functions back aligned, with comments after them', () => {
    const text = 'section: A\n' + '1 | F7     | F Mixolydian | V7/V  # x\n' + `2 | Bb7    | ${' '.repeat(12)} | V7    # y\n` + '3 | EbMaj7 | Eb Ionian\n'
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('reads @key BAR KEY and writes it back', () => {
    const { value, diagnostics } = parseChart('section: B\n@key 17 D\n@key 25 Bb minor\n')
    expect(diagnostics).toEqual([])
    expect(value.lines.slice(1)).toEqual([
      { kind: 'key', bar: 17, key: 'D' },
      { kind: 'key', bar: 25, key: 'Bb minor' },
    ])
    expect(serializeChart(value)).toBe('section: B\n@key 17 D\n@key 25 Bb minor\n')
  })

  it('rejects a malformed @key', () => {
    for (const bad of ['@key 17', '@key x D', '@key 17 H', '@key 17 Dorian', '@key 17 d'])
      expect(parseChart(`section: A\n${bad}`).diagnostics[0]?.message, bad).toBe('use  @key BAR KEY  (a key like Eb or Cm)')
  })

  it("copies a row's function to its copy: repeats", () => {
    const rows = expandRowLines(parseChart('section: A\n1 | D7 |  | V7/V\nsection: B\ncopy: A\n').value).value
    expect(rows.map((r) => `${r.section} ${r.bar} ${r.function}`)).toEqual(['A 1 V7/V', 'B 1 V7/V'])
  })
})

describe('context: and @context (docs/superpowers/specs/2026-10-10-chart-context-design.md §1)', () => {
  it('reads context: and writes it back', () => {
    for (const v of ['functional', 'modal', 'blues']) {
      const text = `title: T\ncontext: ${v}\n`
      const { value, diagnostics } = parseChart(text)
      expect(diagnostics).toEqual([])
      expect(value.lines[1]).toEqual({ kind: 'meta', key: 'context', value: v })
      expect(serializeChart(value)).toBe(text)
    }
  })

  it('a context: that is none of the three is a header error, the line kept as written (like a bad key:)', () => {
    const { value, diagnostics } = parseChart('title: T\ncontext: bossa\n')
    expect(diagnostics).toEqual([{ line: 2, message: 'context: functional, modal or blues' }])
    expect(value.lines[1]).toEqual({ kind: 'meta', key: 'context', value: 'bossa' })
    expect(serializeChart(value)).toBe('title: T\ncontext: bossa\n')
    expect(parseChart('section: A\ncontext: bossa\n1 | C\n').diagnostics).toEqual([{ line: 2, message: 'context: functional, modal or blues' }])
  })

  it('reads a context: with a trailing comment (the spec example), keeping the line as written', () => {
    const text = 'context: modal          # the whole tune\n'
    const { value, diagnostics } = parseChart(text)
    expect(diagnostics).toEqual([])
    expect(value.lines[0]).toEqual({ kind: 'meta', key: 'context', value: 'modal          # the whole tune' })
    expect(parseContext('modal          # the whole tune')).toBe('modal')
    expect(serializeChart(value)).toBe(text)
  })

  it('an empty context: is absent, like an empty key:: no diagnostic', () => {
    expect(parseChart('title: T\ncontext:\n').diagnostics).toEqual([])
    expect(parseChart('title: T\ncontext:   \n').diagnostics).toEqual([])
  })

  it('accepts minor: (reserved) and keeps it', () => {
    const { value, diagnostics } = parseChart('minor: dorian\n')
    expect(diagnostics).toEqual([])
    expect(value.lines[0]).toEqual({ kind: 'meta', key: 'minor', value: 'dorian' })
    expect(serializeChart(value)).toBe('minor: dorian\n')
  })

  it('reads @context BAR VALUE and writes it back', () => {
    const { value, diagnostics } = parseChart('section: A\n@context 1 modal\n@context 17 Blues\n')
    expect(diagnostics).toEqual([])
    expect(value.lines.slice(1)).toEqual([
      { kind: 'context', bar: 1, context: 'modal' },
      { kind: 'context', bar: 17, context: 'blues' },
    ])
    expect(serializeChart(value)).toBe('section: A\n@context 1 modal\n@context 17 blues\n')
  })

  it('reads @time BAR METRE and writes it back (#235)', () => {
    const { value, diagnostics } = parseChart('section: A\n1 | C\n@time 3 2/4\n@time 4 6/4\n')
    expect(diagnostics).toEqual([])
    expect(value.lines.slice(2)).toEqual([
      { kind: 'time', bar: 3, time: '2/4' },
      { kind: 'time', bar: 4, time: '6/4' },
    ])
    expect(serializeChart(value)).toBe('section: A\n1 | C\n@time 3 2/4\n@time 4 6/4\n')
  })

  it('rejects a malformed @time', () => {
    for (const bad of ['@time 1', '@time x 3/4', '@time 1 6/8', '@time 1 3/4 extra'])
      expect(parseChart(`section: A\n${bad}`).diagnostics[0]?.message, bad).toBe('use  @time BAR METRE  (2/4, 3/4, 4/4, 5/4 or 6/4)')
  })

  it('rejects a malformed @context', () => {
    for (const bad of ['@context 1', '@context x modal', '@context 1 bossa', '@context 1 modal extra'])
      expect(parseChart(`section: A\n${bad}`).diagnostics[0]?.message, bad).toBe('use  @context BAR CONTEXT  (functional, modal or blues)')
  })
})

describe('chartRecording', () => {
  const rec = (text: string) => chartRecording(parseChart(text).value)
  const diags = (text: string) => parseChart(`${text}\n\nsection: A\nbars: 4\n1 | C`).diagnostics.map((d) => d.message)
  const need = 'recording: artist; album; label; year (artist and album required)'

  it('reads artist; album; label; year, keeping commas in the album', () => {
    expect(rec('recording: John Coltrane; Blue Train; Blue Note; 1957')).toEqual({ artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1957' })
    expect(rec('recording: Bill Evans Trio; Sunday at the Village Vanguard, Live')).toEqual({ artist: 'Bill Evans Trio', album: 'Sunday at the Village Vanguard, Live', label: '', year: '' })
    expect(rec('recording: Miles Davis; Kind of Blue; ; 1959')).toMatchObject({ label: '', year: '1959' })
    expect(rec('title: X')).toBeNull()
  })

  it('reports a recording without artist and album, a bad year, extra fields', () => {
    expect(diags('recording: John Coltrane, Blue Train')).toContain(need)
    expect(diags('recording: ; Blue Train')).toContain(need)
    expect(diags('recording: A; B; C; 57')).toContain('recording: the year is four digits')
    expect(diags('recording: A; B; C; 1957; D')).toContain(need)
    expect(diags('recording: A; B; Blue Note; 1957')).toEqual([])
    expect(rec('recording: John Coltrane, Blue Train')).toBeNull()
  })

  it('checks youtube: is an 11-character ID, given with a recording', () => {
    expect(diags('recording: A; B\nyoutube: XpZHUVjQydI')).toEqual([])
    expect(diags('recording: A; B\nyoutube: https://youtu.be/XpZHUVjQydI')).toContain('youtube: the 11-character video ID')
    expect(diags('youtube: XpZHUVjQydI')).toContain('youtube: needs a recording: line')
  })

  it('keeps recording: in the header', () => {
    expect(parseChart('section: A\nrecording: A; B\n1 | C').diagnostics.map((d) => d.message)).toContain('recording: belongs in the header, before the first section:')
  })
})
